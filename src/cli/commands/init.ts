import { access, readFile, readdir, writeFile } from 'node:fs/promises';
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

async function detectVersion(file: string): Promise<'2.0' | '3.0' | '3.1' | undefined> {
  try {
    const text = await readFile(file, 'utf8');
    const detection = detectSpecVersion(parseDocumentText(text, detectFormat(text, file)), file);
    return detection.ok ? detection.version : undefined;
  } catch {
    return undefined;
  }
}

export interface InitAnswers {
  readonly input: string;
  readonly version: '2.0' | '3.0' | '3.1' | 'auto';
  readonly output: string;
  readonly language: 'typescript' | 'javascript';
  readonly adapter: 'fetch' | 'axios';
  readonly reactQuery: boolean;
}

export type ConfigFormat = 'ts' | 'js' | 'json' | 'yaml';

/** Path of the JSON Schema shipped with the package, relative to a project root. */
const SCHEMA_PATH = `./node_modules/${PACKAGE_NAME}/config.schema.json`;

/** Renders the starter config file in the given format. */
export function configTemplate(answers: InitAnswers, format: ConfigFormat = 'ts'): string {
  if (format === 'json') {
    return `${JSON.stringify(
      {
        $schema: SCHEMA_PATH,
        spec: { version: answers.version, input: answers.input },
        output: { directory: answers.output, language: answers.language },
        client: { adapter: answers.adapter },
        features: { reactQuery: answers.reactQuery },
      },
      null,
      2,
    )}\n`;
  }
  if (format === 'yaml') {
    return `# yaml-language-server: $schema=${SCHEMA_PATH}
spec:
  # Swagger 2.0 ("2.0"), OpenAPI 3.0 ("3.0"), OpenAPI 3.1 ("3.1") or "auto".
  version: ${JSON.stringify(answers.version)}
  # A local file (JSON or YAML) or an http(s) URL.
  input: ${JSON.stringify(answers.input)}
output:
  directory: ${JSON.stringify(answers.output)}
  language: ${answers.language}
client:
  # fetch (no dependencies) or axios.
  adapter: ${answers.adapter}
features:
  # TanStack Query v5 hooks, generated into <output>/react-query.
  reactQuery: ${String(answers.reactQuery)}
# Plugins are referenced by module path, e.g.
# plugins:
#   - ./plugins/my-plugin.ts
#   - [./plugins/other.ts, { option: true }]
`;
  }
  return `import { defineConfig } from ${quote(PACKAGE_NAME)};

export default defineConfig({
  spec: {
    // Swagger 2.0 ('2.0'), OpenAPI 3.0 ('3.0'), OpenAPI 3.1 ('3.1') or 'auto'.
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
    // TanStack Query v5 hooks, generated into <output>/react-query.
    reactQuery: ${String(answers.reactQuery)},
  },
});
`;
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
        value: '2.0|3.0|3.1|auto',
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
      'react-query': { type: 'boolean', description: 'Generate TanStack Query hooks.' },
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
        choice(ctx, 'spec-version', ['2.0', '3.0', '3.1', 'auto'] as const) ??
        detectedVersion ??
        '3.1',
      output: option(ctx, 'output') ?? DEFAULT_OUTPUT_DIRECTORY,
      language:
        choice(ctx, 'language', ['typescript', 'javascript'] as const) ??
        (typescriptProject ? 'typescript' : 'javascript'),
      adapter: choice(ctx, 'adapter', ['fetch', 'axios'] as const) ?? 'fetch',
      reactQuery: flag(ctx, 'react-query'),
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
