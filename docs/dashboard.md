# Dashboard

```sh
npx swaggerz dashboard [--port 4400] [--host 127.0.0.1] [--open]
```

The command prints a link such as `http://127.0.0.1:4400/?token=…`. Open it in a browser; the page stores the token in session storage and removes it from the address bar. Press Ctrl+C to stop.

The dashboard compiles the specification with the same pipeline as `generate` and shows the result. **Reload** re-reads the config and specification from disk.

## Pages

- **Overview**: specification and API versions, servers, counts, HTTP method distribution, tags, generation status (up to date, out of date, never generated, failed), last run, timings, unresolved references, unsupported constructs and all diagnostics with severity filters.
- **Operations**: search across names, operation ids, paths, summaries, descriptions, tags and the names of every model an operation depends on (`/` focuses the search). Filters for HTTP method, tag and deprecation. Details show parameters by location, request bodies per media type, responses with headers and examples, authentication, the exported types and hooks, model dependencies with the reference chain that explains each, the generated code (and JavaScript/declaration previews) and the source location.
- **Models**: search and filters (used, unused, recursive). Details show the schema (properties, constraints, enums, unions, discriminators), references, referencing models, operations that use the model and why, structural duplicates, generated TypeScript, JavaScript and declarations, and the source location.
- **Dependencies**: a diagram of an operation's transitive models, a table explaining why each one is included, the most referenced models, unused models, recursive models and possible duplicates.
- **Usage**: scans your source code (`dashboard.usage.include`, default `src`) with the TypeScript compiler installed in your project. Each generated export is reported as _used_ (imported and referenced), _imported_ (imported or re-exported but not referenced), _not imported_, or _undetermined_ (reachable through a dynamic `import()`, `require()`, an escaping namespace object or `export *`). Import locations are listed. Path aliases from your `tsconfig.json` are honored. The scan is static: it reports what the code imports, not what runs.
- **Generate**: computes the changes generation would make (new, changed, removed, unchanged files with line counts), shows unified diffs per file and writes after an explicit confirmation. The same ownership rules as the CLI apply.

## Security model

- Binds to `127.0.0.1` by default. Other interfaces are refused unless `dashboard.allowNetworkAccess` is `true`.
- Every API request needs the random per-session token in an `Authorization` header. Other websites cannot obtain the token, and the header makes cross-origin requests require a CORS preflight, which the server never grants.
- Requests whose `Host` header is not the dashboard's address are rejected (DNS rebinding protection); state-changing requests with a foreign `Origin` are rejected; request bodies are limited to 64 KB and must be JSON.
- The HTML shell contains no specification data and no inline scripts. A strict Content Security Policy (`default-src 'none'; script-src 'self'; …`), `X-Frame-Options: DENY`, `nosniff` and `no-referrer` are sent with every response.
- Specification text (descriptions, examples, names) is rendered as text, never as HTML.
- Writing files requires a confirmed request and never overwrites files the generator does not own.

## Performance

List views receive compact summaries; details are loaded on demand. Lists render in pages of a few hundred entries, so specifications with thousands of operations stay responsive. Graph queries use linear-time algorithms ([benchmarks](benchmarks.md)).
