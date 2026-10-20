import { HTTP_METHODS } from '../ir/types.ts';
import { PACKAGE_NAME, TOOL_NAME } from '../meta.ts';
import { t, type Check, type ConfigIssue, type JsonSchema } from './schema.ts';

const caseStyles = ['camelCase', 'PascalCase', 'snake_case', 'preserve'] as const;

export const HOOK_NAMES = [
  'beforeParse',
  'afterNormalize',
  'operationName',
  'modelName',
  'jsdoc',
  'queryKey',
  'resolveImport',
  'beforeGenerate',
  'generate',
  'transformFile',
  'afterGenerate',
  'beforeWrite',
  'afterWrite',
] as const;

const hooksShape: Record<string, Check> = Object.fromEntries(
  HOOK_NAMES.map((name) => [name, t.func()]),
);

// Plugin objects contain functions, so they only exist in JavaScript/TypeScript configs.
export const pluginObjectCheck: Check = t.codeOnly(
  t.object(
    { name: t.string({ nonEmpty: true }), enforce: t.literal('pre', 'post'), ...hooksShape },
    { required: ['name'] },
  ),
);

const pluginSpecifier = t.doc(
  t.string({ nonEmpty: true }),
  'Module that exports a plugin (or a function returning one) as its default export: a path relative to the config file, or a package name.',
);

const pluginCheck = t.union(
  [
    pluginObjectCheck,
    pluginSpecifier,
    t.doc(
      t.tuple([pluginSpecifier, t.unknown()], { minItems: 1 }),
      '`[module, options]`: the module default-exports a function that receives `options` and returns a plugin.',
    ),
  ],
  'a plugin object, a module path or [module path, options]',
);

const reactQueryCheck = t.object({
  queryMethods: t.doc(
    t.array(t.literal(...HTTP_METHODS)),
    'HTTP methods that produce query hooks; all others produce mutation hooks.',
    { default: ['get', 'query'] },
  ),
  infinite: t.doc(
    t.record(
      t.object(
        {
          pageParam: t.doc(
            t.string({ nonEmpty: true }),
            'The query parameter that receives the page parameter.',
          ),
        },
        { required: ['pageParam'] },
      ),
    ),
    'Infinite query hooks, keyed by operation name or `operationId`.',
  ),
  invalidates: t.doc(
    t.record(t.array(t.string({ nonEmpty: true }))),
    'Queries to invalidate after a successful mutation, keyed by mutation name or `operationId`. Values are operation names, `operationId`s or tags.',
  ),
});

const configCheck: Check = t.object(
  {
    $schema: t.doc(t.string(), 'JSON Schema used by editors for completion and validation.'),
    spec: t.doc(
      t.object(
        {
          version: t.doc(
            t.literal('2.0', '3.0', '3.1', '3.2', 'auto'),
            "Specification version the input must declare: '2.0' (Swagger), '3.0', '3.1', '3.2', or 'auto' for any supported version.",
          ),
          input: t.doc(
            t.string({ nonEmpty: true }),
            'Path (relative to the config file) or http(s) URL of a JSON or YAML document.',
          ),
          refs: t.doc(
            t.object({
              external: t.doc(
                t.literal('none', 'local', 'remote'),
                "Which external $refs may be followed: 'none', 'local' files inside allowedDirectories, or 'remote' URLs on allowedHosts as well.",
                { default: 'local' },
              ),
              allowedDirectories: t.doc(
                t.array(t.string({ nonEmpty: true })),
                'Directories local references may read. Defaults to the project root and the directory of the specification.',
              ),
              allowedHosts: t.doc(
                t.array(t.string({ nonEmpty: true })),
                "Hosts remote references may be fetched from, e.g. 'schemas.example.com' or '*.example.com'.",
              ),
              maxDocuments: t.doc(
                t.number({ min: 1, integer: true }),
                'Maximum number of documents a description may consist of.',
                { default: 5000 },
              ),
            }),
            'External reference policy.',
          ),
          fetch: t.doc(
            t.object({
              headers: t.doc(
                t.record(t.string()),
                'Headers sent with remote documents (only to the origin of spec.input).',
              ),
              timeout: t.doc(t.number({ min: 1, integer: true }), 'Timeout in milliseconds.', {
                default: 30_000,
              }),
              maxBytes: t.doc(
                t.number({ min: 1, integer: true }),
                'Maximum document size in bytes.',
                { default: 52_428_800 },
              ),
              poll: t.doc(
                t.union(
                  [t.boolean(), t.number({ min: 500, integer: true })],
                  'a boolean or an interval in milliseconds (at least 500)',
                ),
                'Poll remote documents for changes in `generate --watch` and the dashboard: true (every 2000 ms), an interval in milliseconds, or false. By default only documents on loopback hosts (localhost, 127.0.0.1, [::1]) are polled.',
              ),
            }),
            'Options for fetching remote documents.',
          ),
        },
        { required: ['version', 'input'] },
      ),
      'The specification to generate from.',
    ),
    output: t.doc(
      t.object({
        directory: t.doc(
          t.string({ nonEmpty: true }),
          'Output directory, relative to the config file.',
          { default: './src/generated/api' },
        ),
        language: t.doc(
          t.literal('typescript', 'javascript'),
          'Generate TypeScript, or JavaScript with JSDoc and .d.ts declarations.',
          { default: 'typescript' },
        ),
        moduleFormat: t.doc(t.literal('esm'), 'Only ES modules are generated.', {
          default: 'esm',
        }),
        clean: t.doc(
          t.boolean(),
          'Remove generated files that are no longer produced (only files recorded in the manifest).',
          { default: true },
        ),
        declarations: t.doc(
          t.boolean(),
          'JavaScript output: emit .d.ts declarations next to each module.',
          { default: true },
        ),
        importExtension: t.doc(
          t.literal('.js', '.ts', 'none'),
          'Extension used in relative imports between generated modules.',
          { default: '.js' },
        ),
        barrel: t.doc(t.boolean(), 'Emit index barrels.', { default: true }),
        groupBy: t.doc(
          t.literal('tag', 'none'),
          'Group operation modules in directories by their first tag.',
          { default: 'tag' },
        ),
        models: t.doc(
          t.literal('all', 'used'),
          "Emit every named schema ('all') or only those operations use ('used').",
          { default: 'all' },
        ),
        webhooks: t.doc(
          t.boolean(),
          'Generate payload types and handler signatures for webhooks and callbacks.',
          { default: true },
        ),
        banner: t.doc(t.string(), 'Extra text for the header comment of every generated file.'),
      }),
      'Where and how generated files are written.',
    ),
    client: t.doc(
      t.object({
        adapter: t.doc(
          t.literal('fetch', 'axios'),
          "HTTP transport: 'fetch' (no dependencies) or 'axios'.",
          { default: 'fetch' },
        ),
        baseUrl: t.doc(
          t.string(),
          'Base URL compiled into the client. Defaults to the first server of the specification.',
        ),
        operationServers: t.doc(
          t.boolean(),
          'Send operations that declare their own `servers` to that server instead of the base URL.',
          { default: true },
        ),
        includeCredentials: t.doc(t.boolean(), 'Send cookies with cross-origin requests.', {
          default: false,
        }),
        headers: t.doc(t.record(t.string()), 'Static headers sent with every request.'),
        timeout: t.doc(
          t.number({ min: 0, integer: true }),
          'Default request timeout in milliseconds (0 disables it).',
        ),
        responseStyle: t.doc(
          t.literal('data', 'full'),
          "'data' resolves with the body; 'full' resolves with { data, status, headers }.",
          { default: 'data' },
        ),
      }),
      'Defaults of the generated HTTP client.',
    ),
    features: t.doc(
      t.object({
        reactQuery: t.doc(
          t.union([t.boolean(), reactQueryCheck], 'a boolean or React Query options'),
          'Generate TanStack Query v5 hooks and option factories.',
          { default: false },
        ),
        jsdoc: t.doc(t.boolean(), 'Generate documentation comments.', { default: true }),
        validation: t.doc(
          t.union(
            [
              t.literal(false, 'zod'),
              t.object(
                {
                  library: t.doc(t.literal('zod'), 'Validation library.'),
                  response: t.doc(t.boolean(), 'Validate response bodies.', { default: true }),
                  request: t.doc(t.boolean(), 'Validate request bodies before sending.', {
                    default: false,
                  }),
                },
                { required: ['library'] },
              ),
            ],
            "false, 'zod' or Zod options",
          ),
          'Generate Zod 4 schemas and validate at runtime.',
          { default: false },
        ),
      }),
      'Optional generators.',
    ),
    naming: t.doc(
      t.object({
        operations: t.doc(t.literal(...caseStyles), 'Operation function names.', {
          default: 'camelCase',
        }),
        models: t.doc(t.literal(...caseStyles), 'Model type names.', { default: 'PascalCase' }),
        files: t.doc(
          t.literal('kebab-case', 'camelCase', 'PascalCase', 'snake_case'),
          'File names.',
          { default: 'kebab-case' },
        ),
        parameters: t.doc(
          t.literal('preserve', 'camelCase'),
          "Parameter property names: wire names ('preserve') or camelCase identifiers.",
          { default: 'preserve' },
        ),
        inputSuffix: t.doc(
          t.string({ nonEmpty: true }),
          'Suffix of request-side model variants created when models have readOnly or writeOnly properties.',
          { default: 'Input' },
        ),
      }),
      'Naming conventions.',
    ),
    types: t.doc(
      t.object({
        enums: t.doc(
          t.literal('union', 'const'),
          "'union' emits literal unions; 'const' also emits a frozen object per named enum.",
          { default: 'union' },
        ),
        readonlyProperties: t.doc(
          t.boolean(),
          'Mark readOnly properties with the readonly modifier.',
          { default: true },
        ),
        readWrite: t.doc(
          t.literal('split', 'merged'),
          "'split' leaves readOnly properties out of request types and writeOnly properties out of response types; 'merged' uses one type for both.",
          { default: 'split' },
        ),
        dates: t.doc(
          t.literal('string', 'Date'),
          "Type `date` and `date-time` strings as 'string', or as 'Date' with responses converted at runtime.",
          { default: 'string' },
        ),
      }),
      'How schemas map to types.',
    ),
    dashboard: t.doc(
      t.object({
        host: t.doc(t.string({ nonEmpty: true }), 'Interface to listen on.', {
          default: '127.0.0.1',
        }),
        port: t.doc(t.number({ min: 0, max: 65_535, integer: true }), 'Port (0 picks one).', {
          default: 4400,
        }),
        allowNetworkAccess: t.doc(t.boolean(), 'Required to listen on a non-loopback interface.', {
          default: false,
        }),
        usage: t.doc(
          t.object({
            include: t.doc(t.array(t.string({ nonEmpty: true })), 'Files or directories to scan.', {
              default: ['src'],
            }),
            exclude: t.doc(t.array(t.string({ nonEmpty: true })), 'Path segments to skip.'),
          }),
          'Usage scanning of your source code.',
        ),
      }),
      `Options of \`${TOOL_NAME} dashboard\`.`,
    ),
    plugins: t.doc(
      t.array(pluginCheck),
      'Plugins, run in order within their enforce group. In JSON and YAML configs, reference modules by path or package name.',
    ),
    hooks: t.object(hooksShape),
  },
  { required: ['spec'] },
);

/** Validates an untrusted config value. Returns all issues; an empty array means valid. */
export function validateUserConfig(value: unknown): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  configCheck(value, '', issues);
  return issues;
}

/** The JSON Schema of config files, published as `config.schema.json`. */
export function configJsonSchema(): JsonSchema {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://unpkg.com/${PACKAGE_NAME}/config.schema.json`,
    title: `${TOOL_NAME} configuration`,
    ...configCheck.schema,
  };
}
