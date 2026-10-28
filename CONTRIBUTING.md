# Contributing to swaggerz

Thanks for helping. This guide covers the development setup, the checks a change must pass and how releases work. For how the code is organized, read [docs/architecture.md](docs/architecture.md) first; [docs/decisions.md](docs/decisions.md) explains the main design choices.

## Setup

Requirements: Node.js 22.18 or later (24 recommended) and pnpm (`npm install --global pnpm`, or `corepack enable` on Node.js versions that bundle Corepack). Any recent pnpm switches to the exact version pinned in `packageManager` by itself.

```sh
pnpm install
pnpm build        # dist/, runtime templates (assets/runtime) and the dashboard bundle (assets/dashboard)
pnpm check        # typecheck, lint, format check, unused code (knip), tests
```

`pnpm install` also installs the git hooks ([husky](https://typicode.github.io/husky/), in `.husky/`): `pre-commit` runs `pnpm format:check`, `pnpm lint` and `pnpm knip`, `pre-push` runs `pnpm typecheck` and `pnpm test:unit`, and `commit-msg` rejects messages that are not [Conventional Commits](https://www.conventionalcommits.org/). Run `pnpm format` when the format check fails. `git commit --no-verify` (or `HUSKY=0`) skips them; CI runs the same checks.

Dependencies may only run install scripts when they are listed under `allowBuilds` in `pnpm-workspace.yaml` (today only esbuild). pnpm stops the install when a new dependency wants to run one; review what the script does before approving it with `pnpm approve-builds <package>`.

The sources are run directly by Node.js (type stripping): `node src/cli/bin.ts generate --config path/to/swaggerz.config.ts` uses your working tree without a build, except for the runtime templates and dashboard bundle, which `pnpm build:assets` regenerates.

## Scripts

| Script                                                | Purpose                                                                                                                           |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                                      | Type-checks the sources, the runtime templates (browser-only lib), the dashboard client and its tests                             |
| `pnpm lint` / `pnpm format`                           | oxlint (type-aware rules via oxlint-tsgolint) / oxfmt                                                                             |
| `pnpm knip`                                           | Unused files, exports and dependencies in the package and the examples (configured in `knip.jsonc`)                               |
| `pnpm test`, `test:unit`, `test:integration`          | Vitest; the global setup builds the runtime templates and the dashboard bundle                                                    |
| `pnpm test:smoke`                                     | Generates a JavaScript client and runs it on the current Node.js (CI runs it on Node.js 18–24)                                    |
| `pnpm test:runtimes [runtime…]`                       | Runs generated clients in Node.js, Deno, Bun, Chromium, Firefox, WebKit and workerd (installed on demand)                         |
| `pnpm corpus [name…] [--update]`                      | Compiles and type-checks 24 public API descriptions and compares the diagnostics with a baseline                                  |
| `pnpm test:pack`                                      | Packs the tarball and uses it in a fresh project: `init`, `generate`, `tsc`, a real request, the API                              |
| `pnpm compat`                                         | Type-checks generated clients with the oldest supported TypeScript, TanStack Query adapters, SWR, axios, Zod, Valibot and ArkType |
| `pnpm bench`                                          | Compiler benchmarks on synthetic specifications ([docs/benchmarks.md](docs/benchmarks.md))                                        |
| `pnpm example:<name>`, `pnpm example <name> [script]` | Builds swaggerz, generates the example's client and runs it (`dev`/`start`) or the given script                                   |
| `pnpm examples:check`                                 | Builds swaggerz, then generates and type-checks every example                                                                     |
| `node scripts/verify-examples.ts`                     | Installs the packed tarball into each example and runs its `generate`, `check` and `start` scripts                                |

`test:pack`, `compat`, `test:runtimes`, `corpus` and `verify-examples` download packages or documents (network).

## Tests

- **Unit tests** (`tests/unit`) cover the parser, naming, the dependency graph, printers, the diff algorithm, serialization and config validation.
- **Fuzz tests** (`tests/unit/fuzz`) feed random specification text and random documents (well-formed and hostile, in all four versions, with every validation library) to the compiler with [fast-check](https://fast-check.dev): it must report diagnostics, never crash. They run 100 documents per mode with the unit tests; `FUZZ_RUNS=10000 pnpm vitest run tests/unit/fuzz` runs a longer campaign, and a failure prints the seed and the smallest document that reproduces it.
- **Integration tests** (`tests/integration`) generate clients from the fixtures and then type-check them with the TypeScript compiler API under the strictest settings, run them against a local HTTP server, render React Query and SWR hooks with Testing Library, run Vue Query composables, drive the MCP server with the official SDK clients, bundle them with esbuild, Rollup and Vite to verify tree-shaking, drive the CLI as a subprocess and exercise the dashboard server and UI.

Guidelines:

- Add a fixture in `fixtures/specs` for new specification features, and a test that compiles the generated code. "It generates" is not enough; the output must type-check and, where it has runtime behavior, run.
- Prefer asserting behavior and types over snapshotting whole files.
- Specification features follow the four versions: when you add one, check how Swagger 2.0, OpenAPI 3.0, 3.1 and 3.2 express it.
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
3. Run `pnpm check` locally.
4. Write commit messages (or the squash-merge title) as [Conventional Commits](https://www.conventionalcommits.org/): `feat:` for features, `fix:` for fixes, `perf:` and `docs:` where they apply; `refactor:`, `test:`, `chore:` and `ci:` are left out of the changelog. Mark breaking changes with `!` (`feat!: …`) or a `BREAKING CHANGE:` footer. While the version is `0.x`, breaking changes are released as minor versions.

## Releases

A release is a version bump and a tag made by a maintainer with [release-it](https://github.com/release-it/release-it), and a publish made by the [release workflow](.github/workflows/release.yml). Nothing is ever published from a developer machine.

```sh
pnpm release:dry   # show the next version and the changelog without changing anything
pnpm release       # bump, update CHANGELOG.md, commit, tag v<version> and push
```

`pnpm release` runs `pnpm check` first, works only on a clean `main` that tracks its remote, and picks the next version from the commits since the last tag (pass `major`, `minor`, `patch` or `--preRelease=beta` to override). release-it 21 needs Node 22.22 or 24.15 and later; the generator itself supports 22.18.

Pushing the `v<version>` tag starts the release workflow, which:

1. checks that the tag matches the `package.json` version and points to a commit on `main`;
2. builds and runs `pnpm check` and `pnpm test:pack`;
3. packs the package once and attests the tarball's build provenance with [GitHub artifact attestations](https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations);
4. publishes that tarball to npm with provenance, using the `next` dist-tag for pre-releases. npm authenticates with [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OpenID Connect, no long-lived token) when it is configured for the workflow, and otherwise with the `NPM_TOKEN` repository secret;
5. creates the GitHub release with that version's section of `CHANGELOG.md`, and attaches the tarball and its provenance (`swaggerz-<version>.tgz.intoto.jsonl`, a Sigstore bundle). Check a downloaded tarball with `gh attestation verify swaggerz-<version>.tgz --repo alirezahematidev/swaggerz`.

The same tag starts the website workflow (`website.yml`), which builds and tests the docs site from the tagged commit and deploys it to GitHub Pages, so the site documents the released version. It also keeps a snapshot of the release's docs at `/v<major>.<minor>/` (on the `website-archive` branch, which only the workflow writes), so every minor release keeps its documentation after the next one ([website/README.md](website/README.md#versions)).

`publishConfig.provenance` is set, so `npm publish` fails outside a supported CI environment — an additional guard against accidental local publishing.

The first version, `0.1.0`, already has its changelog entry, so it is tagged by hand once `main` is green: `git tag -a v0.1.0 -m "Release v0.1.0" && git push origin v0.1.0`. The workflow publishes it with `NPM_TOKEN` (an npm granular access token with read and write access to the package). Afterwards, configure the package's trusted publisher on npmjs.com (this repository, workflow `release.yml`, environment `npm`) and delete the token, so no long-lived credential is left. Later releases use `pnpm release`.

## Repository settings

The workflows in `.github/workflows` check every change: `ci.yml` (tests on Linux, macOS and Windows, generated clients in every runtime, the corpus, oldest and newest dependencies, the packed package, the examples; the `CI passed` job sums them up), `codeql.yml` (code scanning), `dependency-review.yml` (vulnerable or copyleft dependencies in pull requests), `scorecard.yml` (OpenSSF Scorecard), `zizmor.yml` (audits the workflows) and `website.yml` (builds and tests the docs site; on release tags archives the release's docs and deploys every version). Actions are pinned to commit SHAs, checkouts do not keep credentials, and every job has least-privilege permissions; Dependabot updates actions and npm dependencies after a cooldown.

Settings that live outside the repository, configured once by an admin:

- **Rulesets** (Settings → Rules → Rulesets → New ruleset → Import a ruleset): [`.github/rulesets/main.json`](.github/rulesets/main.json) protects `main` — pull requests with one approval from a code owner, resolved conversations, squash merges, linear and signed history, no force pushes or deletion, and the required checks `CI passed`, CodeQL and dependency review; [`.github/rulesets/release-tags.json`](.github/rulesets/release-tags.json) lets only admins create, move or delete `v*` tags, which trigger publishing. Repository admins can bypass both, so a maintainer can push release commits and tags.
- **Advanced Security** (Settings → Advanced Security): dependency graph, Dependabot alerts and security updates, secret scanning with push protection, and private vulnerability reporting (see [SECURITY.md](SECURITY.md)). Code scanning uses `codeql.yml`, so leave CodeQL's default setup off.
- **Environment** `npm` (Settings → Environments): optionally add required reviewers to approve each publish.
- **GitHub Pages** (Settings → Pages): _Source_ set to _GitHub Actions_; in Settings → Environments → `github-pages` → _Deployment branches and tags_, add a tag rule `v*`, since the site deploys from release tags. A custom domain goes in Settings → Pages; the next deployment picks it up (see [website/README.md](website/README.md#deploying)).
