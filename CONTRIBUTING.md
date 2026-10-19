# Contributing to swaggerz

Thanks for helping. This guide covers the development setup, the checks a change must pass and how releases work. For how the code is organized, read [docs/architecture.md](docs/architecture.md) first; [docs/decisions.md](docs/decisions.md) explains the main design choices.

## Setup

Requirements: Node.js 22.18 or later (24 recommended) and Corepack.

```sh
corepack enable
yarn install
yarn build        # dist/, runtime templates (assets/runtime) and the dashboard bundle (assets/dashboard)
yarn check        # typecheck, lint, format check, tests
```

The sources are run directly by Node.js (type stripping): `node src/cli/bin.ts generate --config path/to/swaggerz.config.ts` uses your working tree without a build, except for the runtime templates and dashboard bundle, which `yarn build:assets` regenerates.

## Scripts

| Script                                       | Purpose                                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `yarn typecheck`                             | Type-checks the sources, the runtime templates (browser-only lib), the dashboard client and its tests  |
| `yarn lint` / `yarn format`                  | oxlint (type-aware rules via oxlint-tsgolint) / oxfmt                                                  |
| `yarn test`, `test:unit`, `test:integration` | Vitest; the global setup builds the runtime templates and the dashboard bundle                         |
| `yarn test:smoke`                            | Generates a JavaScript client and runs it on the current Node.js (CI runs it on Node.js 18–24)         |
| `yarn test:pack`                             | Packs the tarball and uses it in a fresh project: `init`, `generate`, `tsc`, a real request, the API   |
| `yarn compat`                                | Type-checks generated clients with the oldest and newest supported TypeScript, React Query, axios, Zod |
| `yarn bench`                                 | Compiler benchmarks on synthetic specifications ([docs/benchmarks.md](docs/benchmarks.md))             |
| `node scripts/verify-examples.ts`            | Installs the packed tarball into each example and runs its `generate`, `check` and `start` scripts     |

`test:pack`, `compat` and `verify-examples` install packages from the npm registry.

## Tests

- **Unit tests** (`tests/unit`) cover the parser, naming, the dependency graph, printers, the diff algorithm, serialization and config validation.
- **Integration tests** (`tests/integration`) generate clients from the fixtures and then type-check them with the TypeScript compiler API under the strictest settings, run them against a local HTTP server, render React Query hooks with Testing Library, bundle them with esbuild, Rollup and Vite to verify tree-shaking, drive the CLI as a subprocess and exercise the dashboard server and UI.

Guidelines:

- Add a fixture in `fixtures/specs` for new specification features, and a test that compiles the generated code. "It generates" is not enough; the output must type-check and, where it has runtime behavior, run.
- Prefer asserting behavior and types over snapshotting whole files.
- Specification features follow the three versions: when you add one, check how Swagger 2.0, OpenAPI 3.0 and 3.1 express it.
- Any change to generated output must keep it deterministic: the same input produces byte-identical files on every platform.

## Rules for code

- No `eval`, `new Function` or `vm` (the linter enforces the first two). Config files are loaded with a native `import()`.
- No `any` in public APIs or generated code. Use `unknown` and narrow.
- The generator must never overwrite or delete files it does not own (see the manifest in `src/output/writer.ts`).
- Treat specifications as untrusted input: bound recursion and sizes, escape everything that reaches comments, strings or identifiers, and never render specification text as HTML in the dashboard.
- New user-facing problems are diagnostics with a stable code (add them to [docs/diagnostics.md](docs/diagnostics.md)).
- Keep the generated runtime dependency-free and compatible with the browser-only `src/templates/tsconfig.json`.

## Pull requests

1. Open an issue first for larger changes so the approach can be discussed.
2. Keep pull requests focused, with tests and documentation updates.
3. Run `yarn check` locally.
4. Add a changeset (`yarn changeset`) when the change affects users: `patch` for fixes, `minor` for features. While the version is `0.x`, breaking changes are released as `minor` and must be described as breaking in the changeset.

## Releases

Releases are made only by the [release workflow](.github/workflows/release.yml), never from a developer machine:

1. Merged changesets accumulate on `main`. The workflow opens or updates a "Version Packages" pull request that bumps the version and updates `CHANGELOG.md`.
2. A maintainer reviews and merges it. The workflow then runs the full check, builds, and publishes to npm with [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OpenID Connect, no long-lived token) and provenance, then tags the release.

`publishConfig.provenance` is set, so `npm publish` fails outside a supported CI environment — an additional guard against accidental local publishing.

Before the first release, a maintainer must:

- replace the `your-org/swaggerz` placeholders in `package.json` and `.github/workflows/release.yml`;
- choose an available package name (`swaggerz` is already taken on npm; a scoped name such as `@your-org/swaggerz` keeps the `swaggerz` binary and config file name);
- configure the package's trusted publisher on npmjs.com for this repository and the `release.yml` workflow, and create the `npm` environment in the repository settings (add required reviewers to gate publishing).
