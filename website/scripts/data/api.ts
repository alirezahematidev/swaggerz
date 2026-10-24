/**
 * The programmatic API reference, read from the declarations the package publishes
 * (`dist/index.d.ts`, built by `pnpm build`): every export with its declaration and its
 * documentation comment. Types of the IR and the project model are marked experimental, as
 * `src/index.ts` says.
 */
import path from 'node:path';
import ts from 'typescript';
import { inlineMarkdown } from './markdown.ts';
import { DriftError, ROOT, writeGenerated } from './output.ts';

interface ApiExport {
  readonly name: string;
  readonly kind: 'function' | 'class' | 'interface' | 'type' | 'variable';
  readonly module: string;
  readonly declaration: string;
  readonly summary: string;
  readonly tags: readonly { name: string; text: string }[];
  readonly experimental: boolean;
}

/** Modules whose types are experimental until 1.0. */
const EXPERIMENTAL_MODULES = new Set(['ir', 'analysis']);

const KIND_ORDER = ['function', 'class', 'variable', 'interface', 'type'] as const;

function kindOf(declaration: ts.Declaration): ApiExport['kind'] {
  if (ts.isFunctionDeclaration(declaration)) return 'function';
  if (ts.isClassDeclaration(declaration)) return 'class';
  if (ts.isInterfaceDeclaration(declaration)) return 'interface';
  if (ts.isTypeAliasDeclaration(declaration)) return 'type';
  return 'variable';
}

/** The declaration as written in the .d.ts file, without its own documentation comment. */
function declarationText(declarations: readonly ts.Declaration[]): string {
  return declarations
    .map((declaration) => {
      const node = ts.isVariableDeclaration(declaration) ? declaration.parent.parent : declaration;
      return node
        .getText()
        .replace(/^export declare /, '')
        .replace(/^export /, '')
        .replace(/^declare /, '');
    })
    .join('\n');
}

export async function api(): Promise<void> {
  const entry = path.join(ROOT, 'dist', 'index.d.ts');
  const program = ts.createProgram([entry], {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2023,
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(entry);
  const moduleSymbol = source === undefined ? undefined : checker.getSymbolAtLocation(source);
  if (moduleSymbol === undefined) {
    throw new DriftError('Cannot read the published declarations:', [
      `${path.relative(ROOT, entry)} is missing; run \`pnpm build\` in the repository root first.`,
    ]);
  }

  const exports: ApiExport[] = [];
  for (const exported of checker.getExportsOfModule(moduleSymbol)) {
    const symbol =
      exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
    const declarations = (symbol.declarations ?? []).filter(
      (declaration) => !ts.isSourceFile(declaration),
    );
    const first = declarations[0];
    if (first === undefined) continue;
    const file = path.relative(path.join(ROOT, 'dist'), first.getSourceFile().fileName);
    const module = file.split(path.sep)[0]?.replace(/\.d\.ts$/, '') ?? file;
    const tags = symbol.getJsDocTags(checker).map((tag) => ({
      name: tag.name,
      text: ts.displayPartsToString(tag.text),
    }));
    const summary = ts.displayPartsToString(symbol.getDocumentationComment(checker));
    exports.push({
      name: exported.name,
      kind: kindOf(first),
      module,
      declaration: declarationText(
        kindOf(first) === 'function' ? declarations.filter(ts.isFunctionDeclaration) : [first],
      ),
      summary,
      tags,
      experimental:
        EXPERIMENTAL_MODULES.has(module) ||
        tags.some((tag) => tag.name === 'experimental') ||
        /\bexperimental\b/i.test(summary),
    });
  }
  exports.sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      Number(a.experimental) - Number(b.experimental) ||
      a.name.localeCompare(b.name),
  );
  const missingDocs = exports
    .filter((item) => !item.experimental && item.kind === 'function' && item.summary === '')
    .map((item) => `${item.name} has no documentation comment`);
  if (missingDocs.length > 0) {
    throw new DriftError('Public functions need documentation comments:', missingDocs);
  }
  const names = new Set(exports.map((item) => item.name));
  // TSDoc to HTML: `{@link Name}` points at the export when it is one, code spans become <code>.
  const html = (text: string): string =>
    inlineMarkdown(
      text.replace(/\{@link\s+([^}\s|]+)(?:\s*\|[^}]*)?\}/g, '\uE000$1\uE000'),
      'src/index.ts',
    ).replace(/\uE000([^\uE000]+)\uE000/g, (_match, name: string) =>
      names.has(name) ? `<a href="#${name}"><code>${name}</code></a>` : `<code>${name}</code>`,
    );
  await writeGenerated('api.json', {
    exports: exports.map((item) => ({
      ...item,
      summaryHtml: item.summary
        .split(/\n\s*\n/)
        .map((paragraph) => html(paragraph.replace(/\n/g, ' ')))
        .filter((paragraph) => paragraph !== ''),
      tags: item.tags.map((tag) => ({ ...tag, html: html(tag.text.replace(/\n/g, ' ')) })),
    })),
  });
}
