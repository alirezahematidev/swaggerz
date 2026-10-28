# CI and monorepos

swaggerz output is deterministic: the same specification, config and swaggerz version produce byte-identical files, with no timestamps or absolute paths. That makes two workflows safe: committing the generated client and checking it in CI, or generating it in CI and never committing it.

## Checking a committed client

When the generated client is committed, fail a pull request that changes the specification or the config without regenerating:

```sh
swaggerz generate --check   # writes nothing; exits 1 and lists the differences when the output is stale
```

It reports missing files, generated files that changed or were edited by hand, files that are no longer generated, and a manifest whose file list is out of date. With the [Vite plugin or the Astro or Next.js integration](integrations.md), `build: 'check'` runs the same check when the app builds. Commit `.swaggerz-manifest.json` with the generated files. The generator version recorded in the manifest is not compared, so upgrading swaggerz only fails the check when the generated code changes. Line endings are ignored, so a checkout with `core.autocrlf` passes.

> [!TIP]
> Commit `.swaggerz-manifest.json` with the client. Without it, the check cannot tell generated files from yours.

```yaml
# .github/workflows/api-client.yml
name: API client
on: [pull_request]
jobs:
  generated-client:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
      - run: npm ci
      - run: npx swaggerz generate --check
      - run: npx swaggerz lint --max-warnings 0
```

## Generating in CI

When the client is not committed, run `swaggerz generate` before the build (a `prebuild` script, or a step before `tsc`); with the [Vite plugin or the Astro or Next.js integration](integrations.md), the build generates it first by itself. Pin the specification: a remote `spec.input` that changes between runs changes the client. Environment variables override the config without editing it, for example to build against a staging specification:

```sh
SWAGGERZ_SPEC_INPUT=https://staging.example.com/openapi.json npx swaggerz generate
```

The overrides are `SWAGGERZ_SPEC_INPUT`, `SWAGGERZ_SPEC_VERSION`, `SWAGGERZ_OUTPUT_DIRECTORY`, `SWAGGERZ_OUTPUT_LANGUAGE`, `SWAGGERZ_CLIENT_ADAPTER` and `SWAGGERZ_CLIENT_BASE_URL`; `--verbose` lists the ones that were applied.

## Checks without writing

| Command                          | What it checks                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `swaggerz validate`              | The config and the specification; generates in memory, writes nothing             |
| `swaggerz lint --max-warnings 0` | What in the specification makes the client worse ([linting](lint.md))             |
| `swaggerz generate --check`      | That the committed output is up to date                                           |
| `swaggerz doctor`                | Node.js, the config, the specification, the output directory, dependency versions |

Every command takes `--json` and then prints one JSON document with its diagnostics, for annotations or bots. Exit codes: `0` success, `1` failed checks or generation errors, `2` invalid usage or configuration, `3` an internal error.

## Several APIs in one repository

Give every API its own config file and output directory, and pass the config with `--config`:

```sh
swaggerz generate --config apis/billing.config.ts
swaggerz generate --config apis/catalog.config.ts
```

```ts
// apis/billing.config.ts
import { defineConfig } from 'swaggerz';

export default defineConfig({
  spec: { version: '3.1', input: '../specs/billing.yaml' },
  output: { directory: '../src/clients/billing' },
});
```

Relative paths in a config resolve from the config file's directory. Each output directory has its own manifest, so the clients are regenerated and cleaned independently and never touch each other's files.

In a workspace (pnpm, npm or Yarn workspaces, Nx, Turborepo), install swaggerz once and keep a config in each package that consumes an API, then run `swaggerz generate` per package (`pnpm -r exec swaggerz generate`, or a task per package). Packages that share one API can share one generated client package instead of generating it several times.

Every client carries its own runtime, so an application that imports two clients bundles two copies of it (the runtime's size is measured on the [benchmarks](benchmarks.md#bundle-size) page).

## Limitations

- One config describes one specification; there is no list of APIs in a single config file.
- Watch mode (`generate --watch`) follows one config at a time.
