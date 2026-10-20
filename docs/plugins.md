# Plugins

A plugin is an object with a `name` and any of the hooks below. Register plugins in `plugins`, or add hooks directly with `hooks`.

```ts
import { defineConfig, definePlugin } from 'swaggerz';

const addOperationIndex = definePlugin({
  name: 'operation-index',
  generate(ctx) {
    const operations = ctx.project.operations.map((op) => ({
      name: op.name,
      method: op.operation.method,
      path: op.operation.path,
      module: op.module,
    }));
    return [
      { path: 'operations.json', content: `${JSON.stringify(operations, null, 2)}\n`, origin: '' },
    ];
  },
});

export default defineConfig({
  spec: { version: '3.1', input: './openapi.yaml' },
  plugins: [addOperationIndex],
  hooks: {
    jsdoc: (block, target) =>
      target.kind === 'operation'
        ? { ...block, tags: [...block.tags, { tag: 'see', text: 'https://docs.example.com/api' }] }
        : block,
  },
});
```

## Referencing plugins

Plugins can also be referenced by module, which is the only way to use them from JSON and YAML configs:

```ts
export default defineConfig({
  spec: { version: '3.1', input: './openapi.yaml' },
  plugins: [
    './plugins/add-operation-index.mjs', // relative to the config file
    ['some-swaggerz-plugin', { prefix: 'api' }], // a package, with options
  ],
});
```

The module's default export is a plugin object, or a factory called with the options (`(options) => plugin`, possibly async); wrap the plugin object in `definePlugin` for type checking. References are resolved from the config file's directory: relative paths, `file:` URLs and packages (honoring their `exports`). Each loaded plugin is validated like an inline one; problems are reported as `config/plugin-load-failed` with the reference that failed.

## Hooks

| Hook                                     | When                                                                     | Return                                    |
| ---------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------- |
| `beforeParse(document, ctx)`             | After loading the root document, before version detection and validation | A replacement document, or nothing        |
| `afterNormalize(ir, ctx)`                | After the document became the IR                                         | A modified IR, or nothing                 |
| `operationName(operation, suggested)`    | Naming an operation (before uniqueness)                                  | A name, or `undefined`                    |
| `modelName(definition, suggested)`       | Naming a model                                                           | A name, or `undefined`                    |
| `queryKey(operation, prefix)`            | Building a React Query key prefix                                        | A new prefix, or nothing                  |
| `jsdoc(block, target)`                   | Rendering documentation for an operation, model or hook                  | A modified `JsDocBlock`, or nothing       |
| `resolveImport({ from, to, specifier })` | Writing a relative import between generated modules                      | A new specifier, or nothing               |
| `beforeGenerate(ctx)`                    | After analysis                                                           | —                                         |
| `generate(ctx)`                          | After the built-in generators                                            | Additional files                          |
| `transformFile(file, ctx)`               | For every file (built-in and added)                                      | A new file, `null` to drop it, or nothing |
| `afterGenerate(files, ctx)`              | All files are final                                                      | —                                         |
| `beforeWrite(plan, ctx)`                 | The write plan is known (also in dry runs)                               | — (throw to abort)                        |
| `afterWrite(result, ctx)`                | Files were written                                                       | —                                         |

Contexts include `config` (resolved, read-only), `report(diagnostic)` to add diagnostics attributed to the plugin, and, from `beforeGenerate` on, `project` — the IR plus names, module paths and the dependency graph.

## Order and errors

Plugins run sequentially: `enforce: 'pre'` plugins, then default plugins, then `hooks`, then `enforce: 'post'` plugins, each group in array order. Hooks that transform a value receive the previous plugin's result. If a hook throws, the run stops with a `plugin/hook-failed` diagnostic naming the plugin and the hook, and nothing is written. Error diagnostics reported with `report()` also prevent writing.

## Generated files

Files returned by `generate` need a `path` relative to the output directory (normalized, without `..`), `content` and `origin` (overwritten with `plugin:<name>`). Paths are checked for collisions (case-insensitively) with every other generated file. Plugin files are owned by the generator like built-in files: they appear in the manifest and are cleaned up when a later run stops producing them.

## Stability

The plugin interface and hook contexts follow semantic versioning. The IR (`ApiDocument` and related types) and the project model are **experimental** until 1.0: they may change in minor releases, with changes listed in the changelog.

## Custom transports and integrations

A transport is a function `(request) => Promise<response>` (see [generated code](generated-code.md#runtime-contract)). To ship one with the client, emit it from a plugin's `generate` hook (for example `runtime/my-transport.ts`) and install it at startup with `client.setConfig({ transport })`. Framework integrations follow the same pattern: generate modules that import the operation modules listed in `ctx.project.operations` (`op.module`, `op.name`, `op.typeNames`).
