# swaggerz for VS Code — plan

Status: plan, nothing built yet. Owner: maintainers. This document describes what the extension does, how it is built, and the order of work. It assumes the current core (`swaggerz` 0.1) and calls out the core changes the extension needs.

## 1. Goals

1. **See the API without leaving the editor**: operations, models, webhooks and diagnostics of every `swaggerz.config.*` in the workspace, with a preview of each operation, its schemas and the exact code swaggerz generates for it.
2. **Call the API like Postman, but spec-aware**: build requests from the specification (parameters, bodies, auth), send them, and check every response against the specification automatically.
3. **Turn requests into tests**: saved requests with declarative assertions and captured variables, run from VS Code's Testing view and, with the same files, from CI.
4. **Generate safely**: preview generation as native diffs, write with the same manifest guarantees as the CLI, show diagnostics in the Problems panel at the right line of the right spec file.
5. **Make the config file recognizable**: a swaggerz file icon for `swaggerz.config.*` and schema-backed completion in every config format.

Non-goals for 1.0: a full OpenAPI editor (other extensions do this well), mock servers, scripting with JavaScript in tests, GraphQL/gRPC, running in vscode.dev (the core needs Node).

## 2. What users get

| Surface                         | Contents                                                                                                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activity bar → **swaggerz**     | One root per config file. Under it: _Operations_ (grouped by tag, method badge, deprecated struck through), _Models_, _Webhooks_, _Requests_ (saved requests), _Environments_. Filter box, "Reveal in spec", "Try it", "Preview".           |
| **API Preview** (editor tab)    | Operation page: summary, parameters, request/response schemas (expandable tree), security, generated TypeScript/JavaScript/declarations/React Query/Zod code with copy buttons, "Try it". Model page: schema tree, used-by, generated code. |
| **Request runner** (editor tab) | Postman-style: method and URL bar, server and environment pickers, tabs for Params, Headers, Cookies, Body, Auth, Tests; response pane with status, time, size, headers, body, and a **Spec check** tab listing schema violations.          |
| **Testing view**                | Saved requests appear as tests (file → request). Run, debug-log, re-run failed; results inline with the failing assertion.                                                                                                                  |
| **Problems panel**              | swaggerz diagnostics (errors, warnings, info) at file/line/column, with the diagnostic code linking to its documentation.                                                                                                                   |
| **Spec files**                  | CodeLens above each operation in OpenAPI YAML/JSON: `▶ Try it · Preview · Generated code`. Language status item: `OpenAPI 3.1 · 34 operations · 2 warnings`.                                                                                |
| **Commands**                    | Generate, Preview changes (opens native diff editors), Validate, Init config (walkthrough), Open dashboard, Select environment, Run all requests, Copy as cURL / fetch / generated client call.                                             |
| **Status bar**                  | `$(swaggerz) petstore ✓` — last generation state for the active config; click to generate or open the preview.                                                                                                                              |
| **Config files**                | Completion, hover docs and validation for `swaggerz.config.json` and `.yaml` from `config.schema.json`; TypeScript/JavaScript configs already get this from `defineConfig`. The swaggerz file icon (section 9).                             |

## 3. Architecture

```text
┌──────────────────────── VS Code extension host (Electron Node) ────────────────────────┐
│ extension.ts                                                                            │
│  ├─ ProjectRegistry      finds swaggerz.config.* (FileSystemWatcher), one entry per config │
│  ├─ ServiceClient ─────────── JSON-RPC over stdio ──────────────┐                        │
│  ├─ Explorer (TreeDataProvider), CodeLens, DiagnosticCollection, │                        │
│  │  LanguageStatus, StatusBar, TextDocumentContentProvider       │                        │
│  │  (swaggerz-generated: and swaggerz-preview: virtual documents)│                        │
│  ├─ RequestRunner        builds and sends HTTP requests (Node fetch, VS Code proxy setup) │
│  ├─ TestController       request files → tests, assertions, captures                       │
│  ├─ Secrets              SecretStorage (never files)                                       │
│  └─ Webviews (React) ◄── typed postMessage RPC ──► host                                    │
└─────────────────────────────────────────────────────────────────┼────────────────────────┘
                                                                  ▼
            ┌──────────── swaggerz service process (user's Node ≥ 22.18) ────────────┐
            │ the workspace's installed swaggerz (fallback: the bundled copy)        │
            │ loadConfig → compile → ProjectService (what the dashboard uses today)   │
            │ caches the compile result per config, recompiles on file changes        │
            └────────────────────────────────────────────────────────────────────────┘
```

### Why a separate service process

- **Config files are code.** `swaggerz.config.ts` and plugins execute on load. Running them out of the extension host means a hanging or crashing config cannot freeze or kill VS Code, and the process can be restarted.
- **Same Node, same output.** TypeScript configs need Node 22.18+ type stripping. VS Code's Electron Node version does not follow the user's Node, so loading configs in the extension host could fail or differ from the CLI. The service is spawned with the `node` on `PATH` (or `swaggerz.nodePath`), the same one the CLI uses, so preview and generation match `swaggerz generate` byte for byte.
- **Same version as the project.** The service imports the swaggerz installed in the workspace (`node_modules/swaggerz`), so a project pinned to an older swaggerz previews that version's output. If none is installed, the bundled copy is used and the status bar says so. A handshake exchanges `SERVICE_PROTOCOL_VERSION`; incompatible versions get a clear message ("update swaggerz to ≥ x to use this extension version").

### Core changes this needs (in the `swaggerz` package)

1. **`swaggerz/service` export (experimental)**: `createProjectService({ configFile, cwd })` returning the data the dashboard computes today in `src/dashboard/state.ts` (overview, operation and model details, generated code variants, graph, preview, diff, generate). The dashboard server becomes a thin HTTP adapter over it, so both stay in step.
2. **`swaggerz serve --stdio`** (hidden CLI command): JSON-RPC 2.0 with LSP-style `Content-Length` framing over stdin/stdout, no new dependencies. Methods: `initialize`, `project/open`, `project/overview`, `operation/detail`, `model/detail`, `code/variants`, `generate/preview`, `generate/diff`, `generate/write` (requires `confirm: true`), `schema/validate` (value against a schema id, for the request runner). Notifications: `project/didChange`, `diagnostics/publish`.
3. **IR-based value validator** (`validateValue(schema, value, ir)` in core): interprets `SchemaIR` (no code generation, no `eval`), returns violations with JSON pointers. Used for request-body checks and response spec checks, and later by `swaggerz test`.
4. **Positions for operations**: `locatePointer` already maps pointers to line/column; expose operation and schema source ranges so CodeLens and "Reveal in spec" can be placed without re-parsing in the extension.

### Code layout

Add pnpm workspaces while keeping the root as the published `swaggerz` package:

```text
/                     swaggerz (unchanged)
extension/            swaggerz-vscode (private to npm; published to the marketplaces)
  src/host/           extension host code
  src/webview/        React webviews (preview, request runner)
  src/shared/         message types shared by host and webviews
  test/               @vscode/test-cli suites and a fixture workspace
website/              docs site (see website.md)
```

- **Webview UI** reuses the dashboard's Radix-based components (`src/dashboard/client/components/ui`) through a Vite alias; they move into a `ui/` workspace only when a third consumer appears. Colors come from a second token file that maps the dashboard tokens to VS Code theme variables (`--background: var(--vscode-editor-background)`, `--border: var(--vscode-panel-border)`, `--ring: var(--vscode-focusBorder)` and so on), so webviews follow every theme, including high contrast, and marigold remains the only brand accent. Icons use `@vscode/codicons`. (The Webview UI Toolkit is deprecated and is not used.)
- **Bundling**: the extension host is bundled into one file (Rolldown or esbuild), webviews are built with Vite. `vscode` is external.
- **Request serialization** reuses `src/templates/runtime/serialization.ts` (path, query, header, cookie styles, bodies), so a request sent from the runner puts the same bytes on the wire as the generated client would.

## 4. Security and trust

- **Workspace Trust**: `capabilities.untrustedWorkspaces.supported = "limited"`. In restricted mode the extension never loads config files or plugins and never starts the service. It still offers JSON/YAML schema validation for config files and the file icon, and explains what trusting the workspace enables.
- **Secrets** (tokens, API keys, passwords) live in `SecretStorage`, keyed by environment and variable name. Request and environment files hold `{{secret:name}}` references only. History redacts `Authorization`, `Cookie`, `Proxy-Authorization`, and every header or parameter whose value came from a secret or whose security scheme is `apiKey`.
- **Sending credentials**: the runner warns before sending secrets over plain `http:` to a non-loopback host, or to a host that is not one of the specification's servers or the selected environment's base URL.
- **Webviews**: strict CSP (`default-src 'none'`, scripts and styles only from `webview.cspSource` with a nonce, `img-src` limited to `webview.cspSource`, `data:` and `blob:` for image responses), `localResourceRoots` limited to the built webview folder, `enableCommandUris: false`. Specification and response text is rendered as text, never as HTML. Messages from webviews are validated in the host and webviews never get secrets back.
- **Network**: requests run in the extension host, so VS Code's proxy and certificate settings apply. No telemetry. The extension makes no network calls of its own.
- **Generation** goes through the service's `generate/write`, which keeps the manifest rule: only files swaggerz owns are overwritten or deleted.

## 5. Feature specifications

### 5.1 Project discovery and config support

- Activation: `workspaceContains:**/swaggerz.config.{ts,mts,cts,js,mjs,cjs,json,yaml,yml}`, plus the extension's views and commands. Activation itself does no work beyond registering providers; the service starts when a swaggerz view or command is first used, or a config or spec file is opened.
- Multi-root and multiple configs: each config is a project; the explorer shows one root per project (flattened when there is only one).
- `contributes.jsonValidation` maps `swaggerz.config.json` to the bundled `config.schema.json`. For YAML, `contributes.yamlValidation` (honored by the Red Hat YAML extension when installed) does the same. Files that declare `$schema` (as `swaggerz init` writes it) keep theirs.
- Walkthrough (`contributes.walkthroughs`): install swaggerz → create a config (format picker: TypeScript, JavaScript, JSON, YAML, running `swaggerz init`) → generate → try a request.

### 5.2 Explorer

- Tree: `Operations` (by tag, then path order; label `getPetById`, description `GET /pets/{petId}`, method shown with a colored codicon), `Models`, `Webhooks`, `Requests`, `Environments`. Diagnostics count badges on project roots.
- Context menu: Preview, Try it, Reveal in spec, Copy generated import (`import { getPetById } from './api/operations/getPetById'`), Find usages (uses the service's usage scan, results in the Search panel via a references provider).
- Updates when the config or any spec file in the reference closure changes; the tree keeps expansion state across recompiles.

### 5.3 API Preview

- One reusable webview panel (`swaggerz.preview`) that follows the explorer selection, with "Open to the side" for pinning.
- Operation view: header (method, path, operation id, deprecation, tags), parameters table, request body per media type, responses per status, security requirements, servers, and generated code tabs (the dashboard's code variants: TypeScript, JavaScript, declarations, React Query, Zod).
- Generated code can be opened as a real read-only editor (`swaggerz-generated:` virtual document) to get the user's editor theme, search and folding.
- Model view: schema tree with `readOnly`/`writeOnly`, the `…Input` variant when the read/write split produced one, used-by list, generated code.
- State is restored with `WebviewPanelSerializer`. `retainContextWhenHidden` stays off to save memory.

### 5.4 Request runner

Opening "Try it" on an operation creates a draft request from the specification:

- **URL bar**: method (fixed by the operation), server picker (operation servers, path servers, document servers, environment base URL), path with highlighted parameters.
- **Params**: a form generated from parameter schemas (enums become selects, booleans switches, arrays repeatable rows), with descriptions, examples and defaults pre-filled. Path, query, header and cookie sections. Style/explode serialization is shown as a live preview of the final URL.
- **Body**: media type picker for operations with several (`application/json`, `multipart/form-data`, `application/x-www-form-urlencoded`, `application/xml`, raw). JSON bodies get a schema-aware editor: by default a real VS Code editor tab for a `swaggerz-request:` document, with the request schema registered for validation and completion; the webview shows a form view for flat objects. Multipart fields accept files picked from the workspace.
- **Auth**: one section per security requirement of the operation (API key in header/query/cookie, HTTP basic, bearer, OAuth 2 client credentials and authorization code with PKCE through VS Code's authentication flow later). Values come from the environment's secrets.
- **Variables**: `{{name}}` from the active environment, `{{secret:name}}` from SecretStorage, `{{captured.name}}` from earlier responses in the same run. Unresolved variables are flagged before sending.
- **Send** runs in the extension host with Node `fetch`, a timeout, cancellation, and an optional per-environment cookie jar. Redirects are followed by default (toggle).
- **Response**: status with the matching documented response highlighted (or "undocumented status"), duration, size, headers, body (pretty JSON with folding, images inline, other binary as "Save as…", large bodies opened in an editor tab).
- **Spec check** (automatic): status is documented, `Content-Type` is a documented media type, body validates against the response schema (through `schema/validate`), required response headers are present. Violations list the JSON pointer and the expected schema, so a passing request means the server matches the contract the generated client was built from.
- **Export**: copy as cURL, as `fetch`, or as a call through the generated client (`await getPetById({ petId: 42 })`, using the real generated names and options), and save as a request file (5.5).
- **History**: the last 100 sends per workspace in `workspaceState`, redacted (section 4).

### 5.5 Request files and tests

Saved requests are YAML files in `.swaggerz/requests/`, meant to be committed. Postman-style JavaScript test scripts are deliberately not supported: assertions are declarative, so files are reviewable, safe to run from an untrusted pull request in CI, and need no `eval`.

```yaml
# .swaggerz/requests/pets.yaml
config: ../../swaggerz.config.ts # which project these requests belong to
requests:
  - name: Create a pet
    operation: createPet # operationId, or "post /pets"
    params:
      query: { dryRun: false }
    body:
      name: Rex
      tag: dog
    capture:
      petId: $.body.id # JSONPath into { status, headers, body }
    expect:
      status: 201
      spec: true # the automatic spec check (default true)
      body:
        $.name: { equals: Rex }
        $.id: { exists: true }
      headers:
        location: { matches: '^/pets/\d+$' }
      duration: { below: 800 }

  - name: Fetch it back
    operation: getPetById
    params:
      path: { petId: '{{captured.petId}}' }
    expect:
      status: 200
```

```yaml
# .swaggerz/environments.yaml
environments:
  local:
    baseUrl: http://localhost:3000
  staging:
    baseUrl: https://staging.example.com
    variables: { tenant: acme }
secrets: [apiKey, bearerToken] # names only; values are set with "swaggerz: Set Secret…"
```

- Matchers: `equals`, `notEquals`, `exists`, `matches` (regex, with a length limit), `contains`, `oneOf`, `below`/`above`, `length`, `type`, `schema` (a schema id from the spec).
- A JSON schema for both files ships with the extension (completion and validation while editing). Operation names, parameter names and body fields are completed from the project.
- **Testing view**: a `TestController` maps files to suites and requests to tests. Requests in one file run in order (captures flow downward); files run in parallel up to a limit. Failures show expected vs actual and the request/response transcript.
- **CI parity** (core): `swaggerz test [--env staging] [--reporter junit]` runs the same files with the same matcher and spec-check code from core, reading secrets from environment variables (`SWAGGERZ_SECRET_APIKEY`).
- Import from Postman collections (v2.1) and export to HAR are post-1.0.

### 5.6 Generation

- **Preview changes**: calls `generate/preview`, then lists changes in a quick pick or a "swaggerz changes" tree; selecting a file opens VS Code's native diff editor between the file on disk and a `swaggerz-preview:` virtual document. "Write all" asks for confirmation, then calls `generate/write`.
- **Generate** command and an optional `swaggerz.generateOnSave` setting (off by default) for config and spec files; the status bar shows progress and the result.
- **Problems**: the service publishes diagnostics with file, line and column; they map to a `DiagnosticCollection` with the diagnostic code linking to docs/diagnostics.md on the docs site. Quick fixes where the fix is mechanical (for example adding `version` when detection is ambiguous).
- A `swaggerz` task type with a problem matcher for the CLI's output, for people who prefer tasks.

### 5.7 Spec file assistance

- Spec detection: a `yaml` or `json` file that belongs to a project's reference closure, or whose top level has `openapi:` or `swagger:`.
- CodeLens above each operation (positions from the service), above each component schema (`Preview · Used by N`).
- Go to definition and hover for `$ref` values, including external files and `$id`-based references, by asking the service (which already resolves them).
- Language status item: version, operation count, diagnostics count, link to the preview.

## 6. Manifest sketch

```jsonc
{
  "name": "swaggerz-vscode",
  "displayName": "swaggerz",
  "publisher": "swaggerz",
  "engines": { "vscode": "^1.100.0" },
  "categories": ["Programming Languages", "Testing", "Other"],
  "icon": "media/icon.png", // brand/mark.png (transparent, 512 px)
  "galleryBanner": { "color": "#141311", "theme": "dark" },
  "extensionKind": ["workspace"],
  "capabilities": {
    "untrustedWorkspaces": {
      "supported": "limited",
      "description": "Config files and plugins are code; they run only in trusted workspaces.",
    },
    "virtualWorkspaces": false,
  },
  "activationEvents": [
    "workspaceContains:**/swaggerz.config.{ts,mts,cts,js,mjs,cjs,json,yaml,yml}",
  ],
  "contributes": {
    "viewsContainers": {
      "activitybar": [{ "id": "swaggerz", "title": "swaggerz", "icon": "media/glyph.svg" }],
    },
    "views": {
      "swaggerz": [
        { "id": "swaggerz.projects", "name": "API" },
        { "id": "swaggerz.requests", "name": "Requests" },
      ],
    },
    "jsonValidation": [
      { "fileMatch": "swaggerz.config.json", "url": "./schemas/config.schema.json" },
      { "fileMatch": ".swaggerz/requests/*.json", "url": "./schemas/requests.schema.json" },
    ],
    "yamlValidation": [
      { "fileMatch": "swaggerz.config.{yaml,yml}", "url": "./schemas/config.schema.json" },
      { "fileMatch": ".swaggerz/requests/*.{yaml,yml}", "url": "./schemas/requests.schema.json" },
      {
        "fileMatch": ".swaggerz/environments.{yaml,yml}",
        "url": "./schemas/environments.schema.json",
      },
    ],
    "configuration": {
      "properties": {
        "swaggerz.nodePath": {
          "type": "string",
          "description": "Node.js used to run the swaggerz service (22.18+). Defaults to node on PATH.",
        },
        "swaggerz.generateOnSave": { "type": "boolean", "default": false },
        "swaggerz.requests.timeout": { "type": "number", "default": 30000 },
        "swaggerz.requests.followRedirects": { "type": "boolean", "default": true },
      },
    },
    "walkthroughs": ["…"],
    "commands": ["swaggerz.generate", "swaggerz.previewChanges", "swaggerz.tryOperation", "…"],
  },
}
```

## 7. Quality

- **Unit** (Vitest, no VS Code): request building against the generated client (same request through the runner and through a generated client with a recording transport must be identical), variable resolution, redaction, matchers, JSONPath captures, request file parsing and schema, service protocol framing.
- **Service contract tests** against the shared `fixtures/specs` (petstore 2.0/3.0, features 3.1, advanced 3.1 with webhooks, callbacks, dates and multiple media types).
- **Extension integration**: `@vscode/test-cli` with `@vscode/test-electron` on a fixture workspace: activation, tree contents, preview opening, diagnostics positions, generate with confirmation, a test run against the repository's mock server (`tests/support/mock-server.ts`), restricted mode behavior.
- **Webviews**: React Testing Library for behavior (as the dashboard does), plus screenshot checks of the webview pages in a harness that sets VS Code's light, dark and high-contrast theme variables.
- **Matrix**: macOS, Windows, Linux; VS Code stable and Insiders; Remote SSH/WSL/Dev Containers (the extension runs on the remote side, so requests go out from there — documented); Cursor and VSCodium through Open VSX.
- **Budgets**: activation under 50 ms (nothing is loaded eagerly), host bundle under 1 MB, webview bundles under 400 KB gzipped, preview of an operation under 150 ms from a warm service on the large benchmark spec.
- **Accessibility**: every tree item and control labeled, full keyboard flow in the runner (send with Ctrl/Cmd+Enter), visible focus using `--vscode-focusBorder`, high-contrast borders.

## 8. Release

- Its own version line and tags (`vscode-v0.1.0`) via release-it in `extension/` (same conventional changelog setup as the core), and a `release-vscode.yml` workflow triggered by those tags: build, test, `vsce package`, publish the same `.vsix` to the Visual Studio Marketplace and Open VSX, attach it to a GitHub release.
- Marketplace authentication: prefer `vsce publish --azure-credential` with GitHub OIDC (no stored token); otherwise a marketplace token stored only in the `vscode` environment secret with required reviewers. Open VSX needs its own token in the same environment.
- Pre-releases use `vsce publish --pre-release` with odd minor versions (0.3.x), releases even minors (0.4.x), as the marketplace does not support semver pre-release tags.
- Publisher ID `swaggerz` and the Open VSX namespace have to be registered before the first release.

## 9. The config file icon

What a file tree shows for a file is decided by the active **file icon theme**; an extension cannot add one icon to the theme a user already has. The options:

| Option                                                                                   | Verdict                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contributes.languages[].icon` with a `swaggerz-config` language for `swaggerz.config.*` | Rejected. The icon only applies to files of that language, so `swaggerz.config.ts` would stop being TypeScript (no IntelliSense, no type checking) and JSON/YAML configs would lose their language features.                                                                                    |
| Ship a complete icon theme                                                               | Rejected. It replaces the user's whole theme to change one icon.                                                                                                                                                                                                                                |
| Pull requests to the popular icon themes                                                 | **Chosen.** Material Icon Theme and vscode-icons accept icons for tool config files and match file names like `swaggerz.config.ts`. Seti (VS Code's built-in theme) is maintained upstream in `jesseweed/seti-ui` and pulled into VS Code; a pull request there is slower but reaches everyone. |
| User settings in the meantime                                                            | Documented: vscode-icons can load custom icons from a folder (`vsicons.customIconFolderPath`) and map file names to them; Material Icon Theme can map file names to existing icons (`material-icon-theme.files.associations`).                                                                  |

The icon is ready: [`brand/file-icon.svg`](brand/file-icon.svg) (dark themes) and [`brand/file-icon-light.svg`](brand/file-icon-light.svg) (light themes) — the swaggerz mark fitted to the 16 px icon grid, marigold on dark themes and a deeper gold on light ones, where marigold is too faint at that size. The upstream pull requests should cover `swaggerz.config.{ts,mts,cts,js,mjs,cjs,json,yaml,yml}` and the `.swaggerz` folder.

Before implementing, re-check the VS Code API for a file icon contribution that does not require a theme; if one has landed, use it and keep the upstream pull requests for users of other editors' themes.

## 10. Milestones

| Milestone                   | Scope                                                                                                                                                                                                     | Done when                                                                                                                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M0 Foundations**          | Workspaces; `swaggerz/service` and `serve --stdio` in core; extension skeleton with trust handling, project discovery, JSON/YAML config validation; CI with integration tests; icon pull requests opened. | The extension starts the service from a fixture workspace on all three OSes, shows diagnostics for an invalid config, and does nothing (except schema validation) in restricted mode. |
| **M1 Explorer and preview** | Explorer tree, API Preview webview, generated code documents, Problems, CodeLens, `$ref` navigation, generate and diff preview, status bar.                                                               | Every fixture spec can be explored and previewed; preview code equals `swaggerz generate` output; diagnostics land on the right line.                                                 |
| **M2 Request runner**       | Runner webview, environments and secrets, auth for API key/basic/bearer, spec check, history, cURL/fetch/client-call export.                                                                              | Requests built for every operation of the fixture specs match the generated client byte for byte; spec check catches each kind of contract violation in a test server.                |
| **M3 Tests**                | IR value validator and `swaggerz test` in core; request files with matchers and captures; Testing view; JUnit reporter.                                                                                   | The same request files pass in VS Code and in CI; failures show the transcript.                                                                                                       |
| **M4 1.0**                  | OAuth 2 flows, walkthrough, docs on the website, marketplace listing and screenshots, accessibility and performance passes, Open VSX.                                                                     | Budgets in section 7 are met; published through the release workflow.                                                                                                                 |

## 11. Risks and open questions

- **Service startup cost** on large specs: mitigated by lazy start and per-config caching; measure with `scripts/large-spec.ts` before M1 ends.
- **Version skew** between the extension and the workspace's swaggerz: the protocol handshake plus a fallback to the bundled core; the supported range is listed in the extension's README.
- **Remote and container setups**: requests go out from the remote machine, so `localhost` means the remote. The runner shows where requests are sent from.
- **OAuth 2**: authorization code flows need a redirect URI; use VS Code's `env.asExternalUri` with a local callback, and verify with at least two real providers before claiming support.
- **Schema completion in request bodies**: registering per-request schemas dynamically relies on virtual documents plus a JSON schema provider; prototype it in M2 week one, with the form view as the fallback.
- Open question: should `.swaggerz/requests` also accept JSON? (Leaning yes; same schema.)
