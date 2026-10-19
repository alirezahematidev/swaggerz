import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { ParseResult, ParserOptions } from 'oxc-parser';
import type { NapiResolveOptions, ResolveResult } from 'oxc-resolver';
import type { GeneratedFile } from '../codegen/types.ts';
import type {
  AmbiguousUsage,
  UsageEntry,
  UsageLocation,
  UsageReport,
  UsageStatus,
} from './api-types.ts';
import { isRecord } from '../utils/object.ts';
import { compareStrings } from '../utils/strings.ts';

export interface UsageOptions {
  /** Project root (directory of the config file). */
  readonly root: string;
  /** Absolute output directory of the generated client. */
  readonly outputDirectory: string;
  readonly files: readonly GeneratedFile[];
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly maxFiles?: number;
}

const SOURCE_EXTENSIONS = /\.(m|c)?(t|j)sx?$/;
const ALWAYS_SKIPPED = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.output',
  '.turbo',
]);
const BARRELS = new Set(['index', 'react-query/index']);

interface Scanner {
  readonly parse: (file: string, source: string, options: ParserOptions) => ParseResult;
  readonly resolve: (file: string, specifier: string) => string | undefined;
  readonly name: string;
}

/**
 * Loads the parser and resolver (the optional dependencies `oxc-parser` and `oxc-resolver`).
 * Neither TypeScript nor a particular TypeScript version is required; `tsconfig.json` path
 * aliases are honored.
 */
async function loadScanner(): Promise<Scanner | { reason: string }> {
  try {
    const [parser, resolver] = await Promise.all([import('oxc-parser'), import('oxc-resolver')]);
    const options: NapiResolveOptions = {
      tsconfig: 'auto',
      extensions: ['.ts', '.tsx', '.mts', '.cts', '.d.ts', '.js', '.jsx', '.mjs', '.cjs', '.json'],
      // Generated TypeScript is imported with `.js` specifiers.
      extensionAlias: {
        '.js': ['.ts', '.tsx', '.d.ts', '.js', '.jsx'],
        '.mjs': ['.mts', '.mjs'],
        '.cjs': ['.cts', '.cjs'],
      },
      conditionNames: ['types', 'import', 'module', 'node', 'default', 'require'],
      mainFields: ['types', 'module', 'main'],
    };
    const factory = new resolver.ResolverFactory(options);
    return {
      parse: (file, source, parseOptions) => parser.parseSync(file, source, parseOptions),
      resolve: (file, specifier) => {
        const result: ResolveResult = factory.resolveFileSync(file, specifier);
        return result.path;
      },
      name: 'oxc-parser',
    };
  } catch (error) {
    return {
      reason: `Usage scanning needs the optional dependencies oxc-parser and oxc-resolver, which could not be loaded on this platform (${error instanceof Error ? error.message : String(error)}). Reinstall the package to retry.`,
    };
  }
}

async function collectFiles(
  options: UsageOptions,
  limit: number,
): Promise<{ files: string[]; truncated: boolean }> {
  const output = path.resolve(options.outputDirectory);
  const files: string[] = [];
  let truncated = false;
  const excluded = (target: string): boolean => {
    const relative = path.relative(options.root, target).split(path.sep);
    return (
      relative.some((segment) => ALWAYS_SKIPPED.has(segment)) ||
      options.exclude.some((pattern) => target.includes(pattern))
    );
  };
  const walk = async (directory: string): Promise<void> => {
    if (truncated) return;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => compareStrings(a.name, b.name))) {
      const target = path.join(directory, entry.name);
      if (target === output || target.startsWith(output + path.sep) || excluded(target)) continue;
      if (entry.isDirectory()) await walk(target);
      else if (
        entry.isFile() &&
        SOURCE_EXTENSIONS.test(entry.name) &&
        !entry.name.endsWith('.d.ts')
      ) {
        if (files.length >= limit) {
          truncated = true;
          return;
        }
        files.push(target);
      }
    }
  };
  for (const include of options.include) {
    const target = path.resolve(options.root, include);
    try {
      const info = await stat(target);
      if (info.isDirectory()) await walk(target);
      else if (info.isFile()) files.push(target);
    } catch {
      // Missing include paths are ignored.
    }
  }
  return { files: [...new Set(files)], truncated };
}

/** Maps generated modules to their exports, and exported names to the module that defines them. */
function exportIndex(files: readonly GeneratedFile[]): {
  modules: Map<string, GeneratedFile['exports']>;
  origin: Map<string, string>;
} {
  const modules = new Map<string, GeneratedFile['exports']>();
  const origin = new Map<string, string>();
  for (const file of files) {
    const module = file.path.replace(/\.d\.ts$/, '').replace(/\.(ts|js)$/, '');
    if (file.exports === undefined || modules.has(module)) continue;
    modules.set(module, file.exports);
    if (BARRELS.has(module)) continue;
    for (const entry of file.exports) if (!origin.has(entry.name)) origin.set(entry.name, module);
  }
  return { modules, origin };
}

/** A node of the ESTree-compatible AST produced by oxc-parser. */
type AstNode = Record<string, unknown> & { readonly type: string; readonly start: number };

function isNode(value: unknown): value is AstNode {
  return isRecord(value) && typeof value.type === 'string' && typeof value.start === 'number';
}

/** Keys holding names that are not references to a binding (`a.b`, `{ b: 1 }`, `b() {}`). */
function isNameKey(parent: AstNode, key: string): boolean {
  switch (parent.type) {
    case 'MemberExpression':
    case 'JSXMemberExpression':
      return key === 'property' && parent.computed !== true;
    case 'Property':
    case 'MethodDefinition':
    case 'PropertyDefinition':
    case 'AccessorProperty':
    case 'TSPropertySignature':
    case 'TSMethodSignature':
      return key === 'key' && parent.computed !== true;
    case 'TSQualifiedName':
      return key === 'right';
    case 'JSXAttribute':
      return key === 'name';
    case 'ExportSpecifier':
      return key === 'exported';
    case 'LabeledStatement':
    case 'BreakStatement':
    case 'ContinueStatement':
      return key === 'label';
    default:
      return false;
  }
}

function stringLiteral(node: unknown): string | undefined {
  return isNode(node) && node.type === 'Literal' && typeof node.value === 'string'
    ? node.value
    : undefined;
}

function parserLanguage(file: string): 'ts' | 'tsx' | 'jsx' {
  if (/\.(m|c)?tsx$/.test(file)) return 'tsx';
  if (/\.(m|c)?ts$/.test(file)) return 'ts';
  // `.js` files in React projects often contain JSX.
  return 'jsx';
}

/**
 * Statically scans application source files for imports of generated modules. Only static
 * imports can be attributed precisely; dynamic imports and escaping namespace objects are reported
 * as ambiguous rather than counted as unused.
 */
export async function scanUsage(options: UsageOptions): Promise<UsageReport> {
  const started = performance.now();
  const scanner = await loadScanner();
  const empty = { scannedFiles: 0, truncated: false, entries: [], ambiguous: [] };
  if ('reason' in scanner)
    return { status: 'unavailable', reason: scanner.reason, durationMs: 0, ...empty };
  const output = path.resolve(options.outputDirectory);
  const { modules, origin } = exportIndex(options.files);
  const { files, truncated } = await collectFiles(options, options.maxFiles ?? 20_000);

  const references = new Map<string, number>();
  const locations = new Map<string, UsageLocation[]>();
  const imported = new Set<string>();
  const ambiguousModules = new Set<string>();
  const ambiguous: AmbiguousUsage[] = [];
  const key = (module: string, name: string): string => `${module}\u0000${name}`;
  const resolutionCache = new Map<string, string | undefined>();

  const generatedModule = (specifier: string, containingFile: string): string | undefined => {
    const cacheKey = `${path.dirname(containingFile)}\u0000${specifier}`;
    if (resolutionCache.has(cacheKey)) return resolutionCache.get(cacheKey);
    const resolved = scanner.resolve(containingFile, specifier);
    let module: string | undefined;
    if (resolved !== undefined) {
      const absolute = path.resolve(resolved);
      if (absolute.startsWith(output + path.sep)) {
        module = path
          .relative(output, absolute)
          .split(path.sep)
          .join('/')
          .replace(/\.d\.(m|c)?ts$/, '')
          .replace(/\.(m|c)?(t|j)sx?$/, '');
        if (!modules.has(module)) module = undefined;
      }
    }
    resolutionCache.set(cacheKey, module);
    return module;
  };

  const record = (module: string, name: string, location: UsageLocation, count: number): void => {
    const target = BARRELS.has(module) ? (origin.get(name) ?? module) : module;
    const id = key(target, name);
    imported.add(id);
    references.set(id, (references.get(id) ?? 0) + count);
    const list = locations.get(id) ?? [];
    list.push(location);
    locations.set(id, list);
  };

  for (const file of files) {
    let text: string;
    try {
      text = await readFile(file, 'utf8');
    } catch {
      continue;
    }
    // Cheap pre-filter: files that never mention a module specifier cannot import the client.
    if (!/\bimport\b|\brequire\s*\(|\bexport\b/.test(text)) continue;
    const parsed = scanner.parse(file, text, { lang: parserLanguage(file), sourceType: 'module' });
    const relativeFile = path.relative(options.root, file).split(path.sep).join('/');
    const lineStarts = [0];
    for (let index = 0; index < text.length; index++)
      if (text.charCodeAt(index) === 10) lineStarts.push(index + 1);
    const locate = (offset: number): UsageLocation => {
      let low = 0;
      let high = lineStarts.length - 1;
      while (low < high) {
        const middle = (low + high + 1) >> 1;
        if ((lineStarts[middle] ?? 0) <= offset) low = middle;
        else high = middle - 1;
      }
      return { file: relativeFile, line: low + 1, column: offset - (lineStarts[low] ?? 0) + 1 };
    };

    const pending: { module: string; imported: string; local: string; location: UsageLocation }[] =
      [];
    const namespaces = new Map<string, string>();
    for (const declaration of parsed.module.staticImports) {
      const module = generatedModule(declaration.moduleRequest.value, file);
      if (module === undefined) continue;
      for (const entry of declaration.entries) {
        const location = locate(entry.localName.start);
        // The kinds are string-valued enums in oxc-parser's typings.
        const kind: string = entry.importName.kind;
        if (kind === 'Default') {
          ambiguousModules.add(module);
          ambiguous.push({ module, reason: 'default import', location });
        } else if (kind === 'NamespaceObject') {
          namespaces.set(entry.localName.value, module);
        } else {
          pending.push({
            module,
            imported: entry.importName.name ?? entry.localName.value,
            local: entry.localName.value,
            location,
          });
        }
      }
    }
    for (const declaration of parsed.module.staticExports) {
      for (const entry of declaration.entries) {
        if (entry.moduleRequest === null) continue;
        const module = generatedModule(entry.moduleRequest.value, file);
        if (module === undefined) continue;
        const kind: string = entry.importName.kind;
        if (kind === 'Name' && entry.importName.name !== null) {
          record(module, entry.importName.name, locate(entry.start), 0);
        } else {
          ambiguousModules.add(module);
          ambiguous.push({ module, reason: 'export * re-export', location: locate(entry.start) });
        }
      }
    }

    // Identifier occurrences outside import declarations, for reference counting.
    const identifiers = new Map<string, number>();
    const namespaceUses = new Map<string, Map<string, number>>();
    const escapingNamespaces = new Set<string>();
    const dynamic = (node: AstNode, specifier: string | undefined, reason: string): void => {
      const module = specifier === undefined ? undefined : generatedModule(specifier, file);
      if (module === undefined) return;
      ambiguousModules.add(module);
      ambiguous.push({ module, reason, location: locate(node.start) });
    };
    const visit = (node: AstNode, parent: AstNode | undefined, parentKey: string): void => {
      switch (node.type) {
        case 'ImportDeclaration':
          return;
        case 'ImportExpression':
          dynamic(node, stringLiteral(node.source), 'dynamic import()');
          break;
        case 'CallExpression': {
          const callee = node.callee;
          if (isNode(callee) && callee.type === 'Identifier' && callee.name === 'require') {
            const args: unknown = node.arguments;
            const argument: unknown = Array.isArray(args)
              ? (args as readonly unknown[])[0]
              : undefined;
            dynamic(node, stringLiteral(argument), 'require()');
          }
          break;
        }
        case 'TSImportEqualsDeclaration': {
          const reference = node.moduleReference;
          if (isNode(reference) && reference.type === 'TSExternalModuleReference')
            dynamic(node, stringLiteral(reference.expression), 'import = require()');
          return;
        }
        case 'Identifier':
        case 'JSXIdentifier': {
          const name = typeof node.name === 'string' ? node.name : '';
          if (parent === undefined || !isNameKey(parent, parentKey))
            identifiers.set(name, (identifiers.get(name) ?? 0) + 1);
          if (namespaces.has(name) && parent !== undefined) {
            let member: string | undefined;
            if (parent.type === 'MemberExpression' && parentKey === 'object') {
              member =
                parent.computed === true
                  ? stringLiteral(parent.property)
                  : isNode(parent.property) && typeof parent.property.name === 'string'
                    ? parent.property.name
                    : undefined;
            } else if (parent.type === 'TSQualifiedName' && parentKey === 'left') {
              member =
                isNode(parent.right) && typeof parent.right.name === 'string'
                  ? parent.right.name
                  : undefined;
            }
            if (member !== undefined) {
              const uses = namespaceUses.get(name) ?? new Map<string, number>();
              uses.set(member, (uses.get(member) ?? 0) + 1);
              namespaceUses.set(name, uses);
            } else if (!isNameKey(parent, parentKey)) {
              escapingNamespaces.add(name);
            }
          }
          // Binding identifiers carry type annotations and decorators as children.
          break;
        }
        default:
          break;
      }
      for (const [childKey, value] of Object.entries(node)) {
        if (Array.isArray(value)) {
          for (const item of value) if (isNode(item)) visit(item, node, childKey);
        } else if (isNode(value)) {
          visit(value, node, childKey);
        }
      }
    };
    visit(parsed.program as unknown as AstNode, undefined, '');

    for (const entry of pending)
      record(entry.module, entry.imported, entry.location, identifiers.get(entry.local) ?? 0);
    for (const [local, module] of namespaces) {
      for (const [member, count] of namespaceUses.get(local) ?? [])
        record(module, member, { file: relativeFile, line: 0, column: 0 }, count);
      if (escapingNamespaces.has(local)) {
        ambiguousModules.add(module);
        ambiguous.push({
          module,
          reason: `namespace \`${local}\` is used dynamically`,
          location: { file: relativeFile, line: 0, column: 0 },
        });
      }
    }
  }

  const barrelAmbiguity = [...ambiguousModules].some((module) => BARRELS.has(module));
  const entries: UsageEntry[] = [];
  for (const [module, exports] of modules) {
    if (BARRELS.has(module) || exports === undefined) continue;
    for (const entry of exports) {
      const id = key(module, entry.name);
      const count = references.get(id) ?? 0;
      const status: UsageStatus = imported.has(id)
        ? count > 0
          ? 'used'
          : 'imported'
        : ambiguousModules.has(module) || barrelAmbiguity
          ? 'unknown'
          : 'unused';
      entries.push({
        name: entry.name,
        kind: entry.kind,
        module,
        typeOnly: entry.typeOnly,
        status,
        references: count,
        locations: locations.get(id) ?? [],
      });
    }
  }
  entries.sort((a, b) => compareStrings(a.module, b.module) || compareStrings(a.name, b.name));
  return {
    status: 'ok',
    scanner: scanner.name,
    scannedFiles: files.length,
    truncated,
    durationMs: Math.round(performance.now() - started),
    entries,
    ambiguous,
  };
}
