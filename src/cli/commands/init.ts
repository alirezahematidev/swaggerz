import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import type { SpecVersion } from '../../ir/types.ts';
import path from 'node:path';
import { findConfigFile } from '../../config/load.ts';
import { DEFAULT_OUTPUT_DIRECTORY } from '../../config/resolve.ts';
import { CONFIG_BASENAME, PACKAGE_NAME, TOOL_NAME } from '../../meta.ts';
import { detectFormat, parseDocumentText } from '../../loader/parse.ts';
import { detectSpecVersion } from '../../spec/detect.ts';
import { quote } from '../../codegen/printer.ts';
import { UsageError } from '../args.ts';
import { EXIT, flag, option, relative, type Command, type CommandContext } from '../context.ts';

const SPEC_CANDIDATES = /^(openapi|swagger|api|spec)(\.[\w-]+)?\.(ya?ml|json)$/i;
const SPEC_DIRECTORIES = ['.', 'spec', 'specs', 'openapi', 'docs', 'api'];

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

/** Looks for a likely specification file in common locations. */
async function findSpec(cwd: string): Promise<string | undefined> {
  for (const directory of SPEC_DIRECTORIES) {
    try {
      const entries = (await readdir(path.join(cwd, directory)))
        .filter((entry) => SPEC_CANDIDATES.test(entry))
        .sort();
      const first = entries[0];
      if (first !== undefined) return path.join(cwd, directory, first);
    } catch {
      // Directory does not exist.
    }
  }
  return undefined;
}

async function isModulePackage(cwd: string): Promise<boolean> {
  try {
    const manifest: unknown = JSON.parse(await readFile(path.join(cwd, 'package.json'), 'utf8'));
    return typeof manifest === 'object' && manifest !== null && 'type' in manifest
      ? manifest.type === 'module'
      : false;
  } catch {
    return false;
  }
}

async function detectVersion(file: string): Promise<SpecVersion | undefined> {
  try {
    const text = await readFile(file, 'utf8');
    const detection = detectSpecVersion(parseDocumentText(text, detectFormat(text, file)), file);
    return detection.ok ? detection.version : undefined;
  } catch {
    return undefined;
  }
}

export type QueryFramework = 'react' | 'vue' | 'svelte' | 'solid';
export type ValidationChoice = 'zod' | 'valibot' | 'arktype';

export interface InitAnswers {
  readonly input: string;
  readonly version: SpecVersion | 'auto';
  readonly output: string;
  readonly language: 'typescript' | 'javascript';
  readonly adapter: 'fetch' | 'axios';
  /** Data-fetching hooks: TanStack Query for a framework, or SWR. */
  readonly hooks?: { readonly query: QueryFramework } | { readonly swr: true };
  readonly validation?: ValidationChoice;
}

export type ConfigFormat = 'ts' | 'js' | 'json' | 'yaml';

/** Path of the JSON Schema shipped with the package, relative to a project root. */
const SCHEMA_PATH = `./node_modules/${PACKAGE_NAME}/config.schema.json`;

/** The `features` of a config with these answers. */
function features(answers: InitAnswers): Record<string, unknown> {
  const hooks = answers.hooks;
  return {
    ...(hooks === undefined
      ? {}
      : 'swr' in hooks
        ? { swr: true }
        : { query: { framework: hooks.query } }),
    ...(answers.validation === undefined ? {} : { validation: answers.validation }),
  };
}

/** Renders the starter config file in the given format. */
export function configTemplate(answers: InitAnswers, format: ConfigFormat = 'ts'): string {
  const chosen = features(answers);
  if (format === 'json') {
    return `${JSON.stringify(
      {
        $schema: SCHEMA_PATH,
        spec: { version: answers.version, input: answers.input },
        output: { directory: answers.output, language: answers.language },
        client: { adapter: answers.adapter },
        ...(Object.keys(chosen).length === 0 ? {} : { features: chosen }),
      },
      null,
      2,
    )}\n`;
  }
  const hooks = answers.hooks;
  const framework = hooks !== undefined && 'query' in hooks ? hooks.query : undefined;
  if (format === 'yaml') {
    const hooksLine =
      hooks === undefined
        ? '  # query: { framework: react }'
        : 'swr' in hooks
          ? '  swr: true'
          : `  query: { framework: ${framework ?? 'react'} }`;
    const validationLine =
      answers.validation === undefined
        ? '  # validation: zod'
        : `  validation: ${answers.validation}`;
    const block = [
      'features:',
      '  # Data-fetching hooks: TanStack Query v5 (framework react, vue, svelte or solid), or swr: true.',
      hooksLine,
      '  # Validate responses at runtime with zod, valibot or arktype.',
      validationLine,
    ];
    // Without any feature the block is a comment: an empty `features:` is null in YAML.
    const featuresBlock = (
      Object.keys(chosen).length === 0
        ? block.map((line) => `# ${line.replace(/^ {2}# /, '  ')}`)
        : block
    ).join('\n');
    return `# yaml-language-server: $schema=${SCHEMA_PATH}
spec:
  # Swagger 2.0 ("2.0"), OpenAPI 3.0 ("3.0"), 3.1 ("3.1"), 3.2 ("3.2") or "auto".
  version: ${JSON.stringify(answers.version)}
  # A local file (JSON or YAML) or an http(s) URL.
  input: ${JSON.stringify(answers.input)}
output:
  directory: ${JSON.stringify(answers.output)}
  language: ${answers.language}
client:
  # fetch (no dependencies) or axios.
  adapter: ${answers.adapter}
${featuresBlock}
# Plugins are referenced by module path, e.g.
# plugins:
#   - ./plugins/my-plugin.ts
#   - [./plugins/other.ts, { option: true }]
`;
  }
  const hooksLine =
    hooks === undefined
      ? "    // query: { framework: 'react' },"
      : 'swr' in hooks
        ? '    swr: true,'
        : `    query: { framework: ${quote(framework ?? 'react')} },`;
  const validationLine =
    answers.validation === undefined
      ? "    // validation: 'zod',"
      : `    validation: ${quote(answers.validation)},`;
  return `import { defineConfig } from ${quote(PACKAGE_NAME)};

export default defineConfig({
  spec: {
    // Swagger 2.0 ('2.0'), OpenAPI 3.0 ('3.0'), 3.1 ('3.1'), 3.2 ('3.2') or 'auto'.
    version: ${quote(answers.version)},
    // A local file (JSON or YAML) or an http(s) URL.
    input: ${quote(answers.input)},
  },
  output: {
    directory: ${quote(answers.output)},
    language: ${quote(answers.language)},
  },
  client: {
    // 'fetch' (no dependencies) or 'axios'.
    adapter: ${quote(answers.adapter)},
  },
  features: {
    // Data-fetching hooks: TanStack Query v5 (framework 'react', 'vue', 'svelte' or 'solid'), or
    // \`swr: true\`.
${hooksLine}
    // Validate responses at runtime with 'zod', 'valibot' or 'arktype'.
${validationLine}
  },
});
`;
}

/** The dependencies of the project's package.json (all kinds), or none. */
async function dependencies(cwd: string): Promise<Set<string>> {
  try {
    const manifest: unknown = JSON.parse(await readFile(path.join(cwd, 'package.json'), 'utf8'));
    const names = new Set<string>();
    if (typeof manifest !== 'object' || manifest === null) return names;
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
      const entries: unknown = (manifest as Record<string, unknown>)[field];
      if (typeof entries === 'object' && entries !== null)
        for (const name of Object.keys(entries)) names.add(name);
    }
    return names;
  } catch {
    return new Set();
  }
}

/**
 * The data-fetching hooks for the library the project already depends on (the first that
 * matches). Validation is never detected: it checks responses at runtime, which an existing
 * dependency (zod for forms, say) does not ask for.
 */
function detectHooks(installed: ReadonlySet<string>): InitAnswers['hooks'] {
  const framework = (
    [
      ['@tanstack/react-query', 'react'],
      ['@tanstack/vue-query', 'vue'],
      ['@tanstack/svelte-query', 'svelte'],
      ['@tanstack/solid-query', 'solid'],
    ] as const
  ).find(([name]) => installed.has(name))?.[1];
  if (framework !== undefined) return { query: framework };
  return installed.has('swr') ? { swr: true } : undefined;
}

function choice<T extends string>(
  ctx: CommandContext,
  name: string,
  allowed: readonly T[],
): T | undefined {
  const value = option(ctx, name);
  if (value === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(value)) {
    throw new UsageError(`--${name} must be one of ${allowed.join(', ')}.`);
  }
  return value as T;
}

/** Hooks (from the options, or else detected from package.json) and validation. */
async function chosenFeatures(
  ctx: CommandContext,
  cwd: string,
): Promise<Pick<InitAnswers, 'hooks' | 'validation'>> {
  let query = choice(ctx, 'query', ['react', 'vue', 'svelte', 'solid'] as const);
  if (flag(ctx, 'react-query')) {
    if (query !== undefined && query !== 'react')
      throw new UsageError('--react-query and --query select different frameworks.');
    query = 'react';
  }
  const swr = flag(ctx, 'swr');
  if (swr && query !== undefined)
    throw new UsageError('Choose TanStack Query (--query) or SWR (--swr), not both.');
  const validation = choice(ctx, 'validation', ['zod', 'valibot', 'arktype'] as const);
  const hooks =
    query !== undefined
      ? { query }
      : swr
        ? ({ swr: true } as const)
        : flag(ctx, 'no-detect')
          ? undefined
          : detectHooks(await dependencies(cwd));
  return {
    ...(hooks === undefined ? {} : { hooks }),
    ...(validation === undefined ? {} : { validation }),
  };
}

export const initCommand: Command = {
  spec: {
    name: 'init',
    summary: `Create a ${CONFIG_BASENAME}.{ts,mjs,json,yaml} file for this project.`,
    usage: `${TOOL_NAME} init [options]`,
    options: {
      spec: {
        type: 'string',
        value: 'path|url',
        description: 'Specification file or URL (default: detected).',
      },
      'spec-version': {
        type: 'string',
        value: '2.0|3.0|3.1|3.2|auto',
        description: 'Specification version (default: detected).',
      },
      output: {
        type: 'string',
        value: 'dir',
        description: `Output directory (default: ${DEFAULT_OUTPUT_DIRECTORY}).`,
      },
      language: {
        type: 'string',
        value: 'typescript|javascript',
        description: 'Output language (default: detected).',
      },
      adapter: {
        type: 'string',
        value: 'fetch|axios',
        description: 'HTTP adapter (default: fetch).',
      },
      query: {
        type: 'string',
        value: 'react|vue|svelte|solid',
        description: 'Generate TanStack Query hooks for a framework (default: detected).',
      },
      'react-query': { type: 'boolean', description: 'Same as --query react.' },
      swr: { type: 'boolean', description: 'Generate SWR hooks (default: detected).' },
      validation: {
        type: 'string',
        value: 'zod|valibot|arktype',
        description: 'Validate responses at runtime with this library.',
      },
      'no-detect': {
        type: 'boolean',
        description: "Do not pick the hooks from package.json's dependencies.",
      },
      format: {
        type: 'string',
        value: 'ts|js|json|yaml',
        description: 'Config file format (default: ts in TypeScript projects, otherwise js).',
      },
      force: { type: 'boolean', description: 'Overwrite an existing config file.' },
    },
  },
  async run(ctx) {
    const { reporter, cwd } = ctx;
    const existing = await findConfigFile(cwd);
    if (existing !== undefined && !flag(ctx, 'force')) {
      reporter.json({ ok: false, file: existing, reason: 'exists' });
      reporter.error(`${relative(ctx, existing)} already exists. Use --force to overwrite it.`);
      return EXIT.FAILED;
    }
    const typescriptProject = await exists(path.join(cwd, 'tsconfig.json'));
    const detectedSpec = option(ctx, 'spec') ?? (await findSpec(cwd));
    const input =
      detectedSpec === undefined
        ? './openapi.yaml'
        : /^https?:/i.test(detectedSpec)
          ? detectedSpec
          : `./${path.relative(cwd, path.resolve(cwd, detectedSpec)).split(path.sep).join('/')}`;
    const detectedVersion =
      detectedSpec === undefined || /^https?:/i.test(detectedSpec)
        ? undefined
        : await detectVersion(path.resolve(cwd, detectedSpec));
    const answers: InitAnswers = {
      input,
      version:
        choice(ctx, 'spec-version', ['2.0', '3.0', '3.1', '3.2', 'auto'] as const) ??
        detectedVersion ??
        '3.1',
      output: option(ctx, 'output') ?? DEFAULT_OUTPUT_DIRECTORY,
      language:
        choice(ctx, 'language', ['typescript', 'javascript'] as const) ??
        (typescriptProject ? 'typescript' : 'javascript'),
      adapter: choice(ctx, 'adapter', ['fetch', 'axios'] as const) ?? 'fetch',
      ...(await chosenFeatures(ctx, cwd)),
    };
    const format =
      choice(ctx, 'format', ['ts', 'js', 'json', 'yaml'] as const) ??
      (typescriptProject ? 'ts' : 'js');
    // `.js` is only an ES module in packages with "type": "module"; `.mjs` always is.
    const extension = format === 'js' ? ((await isModulePackage(cwd)) ? 'js' : 'mjs') : format;
    const file = path.join(cwd, `${CONFIG_BASENAME}.${extension}`);
    if (existing !== undefined && existing !== file) {
      reporter.warn(
        `${relative(ctx, existing)} also exists and takes precedence when both are present.`,
      );
    }
    await writeFile(file, configTemplate(answers, format));
    reporter.json({ ok: true, file, ...answers });
    reporter.success(`Created ${relative(ctx, file)}.`);
    if (detectedSpec === undefined)
      reporter.warn(`No specification found; edit spec.input in ${relative(ctx, file)}.`);
    else if (
      detectedVersion === undefined &&
      answers.version !== 'auto' &&
      option(ctx, 'spec-version') === undefined
    ) {
      reporter.warn(`Could not detect the specification version; check spec.version.`);
    }
    reporter.log(`Next: run \`${TOOL_NAME} generate\` to create the client in ${answers.output}.`);
    return EXIT.OK;
  },
};
