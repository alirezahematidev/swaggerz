# Framework integrations

Instead of running `swaggerz generate` before the dev server, let the dev server run it. `swaggerz/vite`, `swaggerz/astro` and `swaggerz/next` generate the client when the dev server or the build starts and, while the dev server runs, again whenever the config file, the specification (every local document it references), an overlay or a local plugin changes. Only files whose content changed are written, so hot module replacement updates the page and nothing else is touched.

They read the same `swaggerz.config.*` and run the same pipeline as the CLI, with the same [ownership rules](determinism-and-safety.md): the output is identical to `swaggerz generate`, and the dashboard, `swaggerz lint`, the MCP server and `generate --check` keep working on it. Config functions receive `command: 'generate'`, and `SWAGGERZ_*` environment variables apply as they do on the command line.

## Vite

```ts check
// vite.config.ts
import { swaggerz } from 'swaggerz/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [swaggerz()],
});
```

- **`vite`** generates the client before the dev server starts listening, so the first request already finds it. While it runs, changes regenerate it. A remote specification is polled when [`spec.fetch.poll`](configuration.md#spec) is set.
- **Errors** are printed with their location and shown over the page with Vite's error overlay: the first error's file and line (a link that opens it in your editor) and the lines of the specification around it. Pages that load while the problem lasts show it too; fixing it clears the overlay. A change that does not compile writes nothing: the last client stays in place. A config that does not load when Vite starts is watched until it does.
- **`vite build`** generates the client first and fails when it cannot be generated. `vite build --watch` builds again when the specification changes.
- **Vitest** runs the plugin too, so tests always see the current client: `vitest` keeps watching, `vitest run` (Vite's `server.watch: null`) generates once.
- `vite preview` does nothing.

| Option       | Default             | Description                                                                                                                                                                                                                                              |
| ------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cwd`        | Vite's `root`       | The directory the config file is searched in, relative to Vite's `root`.                                                                                                                                                                                 |
| `configFile` | `swaggerz.config.*` | The config file, relative to `cwd`, when it has another name or place.                                                                                                                                                                                   |
| `watch`      | `true`              | Regenerate on changes while `vite` runs. `false` generates once.                                                                                                                                                                                         |
| `build`      | `'generate'`        | What `vite build` does first: `'generate'` writes the client; `'check'` fails the build when the output directory differs from what would be generated, like `swaggerz generate --check`, for clients committed to the repository; `false` does nothing. |
| `overlay`    | `true`              | Show generation errors over the page.                                                                                                                                                                                                                    |
| `force`      | `false`             | Overwrite files in the output directory that the generator does not own or that were edited by hand, like `generate --force`. Otherwise such a file stops generation with an error that names it.                                                        |

The plugin runs before the others (`enforce: 'pre'`), so plugins that read the generated files find them.

## Astro

```ts check
// astro.config.ts
import { defineConfig } from 'astro/config';
import swaggerz from 'swaggerz/astro';

export default defineConfig({
  integrations: [swaggerz()],
});
```

- **`astro dev`** runs the Vite plugin above (Astro's dev server is Vite's): generation on start and on change, errors in the overlay. Messages go through Astro's logger, labelled `swaggerz`.
- **`astro build`** and **`astro sync`** (which `astro check` runs first) generate the client before anything else, and fail when it cannot be generated, so `astro check` works on a fresh checkout. `build: 'check'` checks instead.
- `astro preview` does nothing.

The options are the Vite plugin's; `cwd` is relative to Astro's `root`, and `build` applies to `astro build` and `astro sync`. The [Astro example](../examples/astro) renders pages at build time through the client.

## Next.js

```ts check
// next.config.ts
import { withSwaggerz } from 'swaggerz/next';

export default withSwaggerz({
  reactStrictMode: true,
});
```

`withSwaggerz()` takes a config object or a config function (`(phase, { defaultConfig }) => config`) and returns a config function that Next.js calls with the phase:

- **`next dev`** generates the client before Next.js compiles anything and regenerates it on changes while the server runs (Next.js restarts the server process when `next.config` changes, and the integration with it). Problems are printed in the terminal: Next.js has no API for its error overlay.
- **`next build`** generates the client first and fails when it cannot be generated, or with `build: 'check'` when it is out of date. Next.js loads the config again in its build workers; they inherit a marker and do not generate again.
- `next start` and other commands do nothing.

The options are `cwd` (default: the directory Next.js runs in; set it, for example to `import.meta.dirname`, when you run `next dev <dir>` from elsewhere), `configFile`, `watch`, `build` and `force`, as for Vite.

> [!IMPORTANT]
> Neither Turbopack nor webpack in Next.js resolves the default `./client.js` imports of TypeScript output to `client.ts` files. Set [`output.importExtension: 'none'`](configuration.md#output) in projects that use Next.js; `swaggerz init` does when the project depends on `next`. JavaScript output is not affected.

The [Next.js example](../examples/next) renders server components through the client.

## Choosing between the integrations and the CLI

- **A client committed to the repository** stays reviewable either way: generate in development with the integration, and let CI fail on a stale client with `swaggerz generate --check` or `build: 'check'` ([CI and monorepos](ci-and-monorepos.md)).
- **Other bundlers and tools** (webpack, Rspack, esbuild scripts, React Native) can run `swaggerz generate --watch` next to their dev server.
- **One output directory, one writer.** When several apps share one generated client (a workspace package), generate it in one place, with the CLI or in the package that owns it, rather than in every app's dev server.

## Limitations

- Only one config file per integration: for [several APIs](ci-and-monorepos.md#several-apis-in-one-repository), add the integration once per config with `configFile`.
- A plugin module's own imports are not watched; editing them takes effect on the next restart, as with `generate --watch`.
- Next.js shows problems in the terminal only.

The integrations are tested with the versions in [compatibility](compatibility.md#tested-versions).
