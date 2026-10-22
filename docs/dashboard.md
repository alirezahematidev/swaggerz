# Dashboard

```sh
npx swaggerz dashboard [--port 4400] [--host 127.0.0.1] [--open] [--no-watch]
```

The command prints a link such as `http://127.0.0.1:4400/?token=…`. Open it in a browser; the page stores the token in session storage and removes it from the address bar. Press Ctrl+C to stop.

The dashboard compiles the specification with the same pipeline as `generate` and shows the result. **Reload** re-reads the config and specification from disk.

## Live reload

While the dashboard runs, it watches the config file, local plugin modules, every local document of the specification (including files reached through external `$ref`s), remote documents served from your machine, and the output manifest. Open pages update without a restart:

- **Editing the specification or the config** recompiles it and refreshes whatever is on screen, keeping the selection, the open tab and the scroll position. A notification says what changed ("1 new operation, 2 updated models").
- **Generating** (from the CLI, an editor task or the Generate page) refreshes the generation status.
- **New** and **Updated** badges mark operations and models that appeared or changed since the dashboard started, in the lists, the details, the command palette and the sidebar. The overview lists them, including removed ones. Restarting the dashboard clears them. A change counts as an update when the operation or model differs in the specification or in its generated code (a config change that alters generated code counts too).
- **A change that does not load** (a YAML syntax error halfway through an edit, an invalid config) does not replace what you are looking at: the last version that loaded stays on screen with a banner and the diagnostics, until the files are fixed. Meanwhile the files that would fix it are watched too: a new input the config points at, and `$ref` targets that do not exist yet.
- **A remote document that cannot be fetched** (the backend serving the specification is restarting, or the network is down) is shown in a banner with the error. Polling goes on and the last version that loaded stays on screen; the banner disappears when the document can be fetched again.
- **If the server stops**, the sidebar shows _Disconnected_ and a banner explains that the page no longer updates. A restarted dashboard has a new session token, so open the new link it prints.

Remote documents (an `http(s)` input or remote `$ref`s) are polled with conditional requests: those on loopback hosts by default, others when [`spec.fetch.poll`](configuration.md#spec) is set; use **Reload** for the rest. `--no-watch` turns live reload off. Updates are pushed over a server-sent event stream that requires the session token like every other API call.

The interface has light, dark and system themes, works down to phone widths (the sidebar becomes a drawer), and is fully keyboard accessible. Press <kbd>⌘K</kbd> / <kbd>Ctrl+K</kbd> for the command palette, which jumps to any page, operation or model.

## Pages

- **Overview**: specification and API versions, servers, counts, HTTP method distribution, tags (nested OpenAPI 3.2 tags are indented under their parent, with their `kind`), generation status (up to date, out of date, never generated, or cannot generate: the specification does not compile or `output.directory` is [unsafe](diagnostics.md)), last run, timings, unresolved references, unsupported constructs and all diagnostics with severity filters.
- **Operations**: search across names, operation ids, paths, summaries, descriptions, tags and the names of every model an operation depends on (`/` focuses the search). Filters for HTTP method, tag and deprecation. Details show parameters by location, request bodies per media type, responses with headers and examples, authentication, the exported types and hooks, model dependencies with the reference chain that explains each, the generated code (and JavaScript/declaration previews) and the source location.
- **Models**: search and filters (used, unused, recursive). Details show the schema (properties, constraints, enums, unions, discriminators), references, referencing models, operations that use the model and why, structural duplicates, generated TypeScript, JavaScript and declarations, and the source location.
- **Dependencies**: a diagram of an operation's transitive models, a table explaining why each one is included, the most referenced models, unused models, recursive models and possible duplicates.
- **Usage**: scans your source code (`dashboard.usage.include`, default `src`) with [oxc](https://oxc.rs) (`oxc-parser` and `oxc-resolver`, optional dependencies of swaggerz; no TypeScript installation needed). TypeScript, JavaScript, JSX and CommonJS `require()` are understood. Each generated export is reported as _used_ (imported and referenced), _imported_ (imported or re-exported but not referenced), _not imported_, or _undetermined_ (reachable through a dynamic `import()`, `require()`, an escaping namespace object or `export *`). Imports through a barrel (the client's `index`, the hooks' `react-query/index`, `swr/index`… and the schemas' `zod/index`…) count for the module that defines the name. A reference counts only when it reaches the imported binding: a local variable, parameter or type parameter of the same name shadows it. Import locations are listed. Path aliases from your `tsconfig.json` are honored, and a project opened through a symbolic link resolves like its real location. `dashboard.usage.exclude` skips paths inside the project by segment ([configuration](configuration.md#dashboard)). The scan is static: it reports what the code imports, not what runs.
- **Generate**: computes the changes generation would make (new, changed, removed, unchanged files with line counts), shows unified diffs per file and writes after an explicit confirmation. What is written is exactly the preview on screen: when the specification, the config or the output directory changed since it was computed, nothing is written and the page asks you to review the new preview. A live reload drops an outdated preview by itself. The same ownership rules as the CLI apply.

## Interface

Every region scrolls in its own area with thin custom scrollbars; the page itself never scrolls. Lists and details keep their positions independently, and a newly selected item starts at the top. Data that is being refreshed stays on screen until the new data arrives, so reloads and selection changes do not make the layout jump.

## Security model

- Binds to `127.0.0.1` by default. Other interfaces are refused unless `dashboard.allowNetworkAccess` is `true`.
- Every API request needs the random per-session token in an `Authorization` header. Other websites cannot obtain the token, and the header makes cross-origin requests require a CORS preflight, which the server never grants.
- Requests whose `Host` header is not one of the dashboard's addresses are rejected (DNS rebinding protection). Its addresses are the one it listens on, `localhost`, `127.0.0.1` and `[::1]`, and, when it listens on every interface (`0.0.0.0` or `::`), the addresses of the machine's network interfaces and its host name. State-changing requests whose `Origin` is not one of these addresses (with the same port, over `http`) are rejected; request bodies are limited to 64 KB and must be JSON.
- The HTML shell contains no specification data and no inline scripts. A strict Content Security Policy (`default-src 'none'; script-src 'self'; style-src 'self' 'nonce-…'; …`), `X-Frame-Options: DENY`, `nosniff` and `no-referrer` are sent with every response. The style nonce is random per response and only lets the interface components inject their positioning styles; there is no `unsafe-inline`.
- Static assets are served from a fixed allow-list built at startup; any other path under `/assets/` is a 404, so the server cannot be used to read other files. Fonts are bundled; the page makes no third-party requests.
- Specification text (descriptions, examples, names) is rendered as text, never as HTML.
- Writing files requires a confirmed request naming the preview that was reviewed (an id derived from every file's content before and after), writes only that plan, and never overwrites files the generator does not own.

## Performance

List views receive compact summaries; details are loaded on demand. Lists render in pages of a few hundred entries, so specifications with thousands of operations stay responsive. Graph queries use linear-time algorithms ([benchmarks](benchmarks.md)).
