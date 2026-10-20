# Security policy

## Supported versions

Until 1.0, only the latest `0.x` release receives security fixes.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's private vulnerability reporting ("Report a vulnerability" on the repository's **Security** tab). Do not open a public issue. Include the version, a minimal specification or config that reproduces the problem and the impact you observed. You should receive an acknowledgement within a few days. Once a fix is released, the advisory is published with credit unless you prefer otherwise.

## Threat model

What swaggerz trusts and what it does not:

| Input                                            | Trust            | Consequence                                                                                                      |
| ------------------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| Config files (`swaggerz.config.ts`/`.js`/`.mjs`) | **Trusted code** | They are imported and executed with your user's permissions, like any build script. Only run configs you trust.  |
| Plugins                                          | **Trusted code** | Plugins run in-process with full access. Review third-party plugins as you would any dependency.                 |
| Specifications and documents they reference      | Untrusted        | Parsed as data only; see below.                                                                                  |
| Environment variables (`SWAGGERZ_*`)             | Trusted          | They override config values.                                                                                     |
| Dashboard HTTP clients                           | Untrusted        | Only the holder of the session token can use the API; see [docs/dashboard.md](docs/dashboard.md#security-model). |

Protections for untrusted specifications:

- No code execution: specifications are never evaluated, and swaggerz contains no `eval` or `new Function`.
- Parsing: strict JSON; YAML is limited to the core schema with duplicate keys rejected and alias expansion bounded (no "billion laughs").
- References: external `$ref`s follow a policy (`spec.refs.external`: `none`, `local` by default, or `remote` with an `allowedHosts` list). Local references cannot leave `allowedDirectories`; symbolic links are resolved before the check. At most 500 documents are loaded.
- Remote documents: 30 s timeout and 50 MiB size limit by default; at most 5 redirects, and redirects of referenced documents must stay on the same origin or go to an allowed host. `spec.fetch.headers` (for example credentials for a private specification) are sent only to the origin of a remote root document, never to other hosts or after a cross-origin redirect.
- Recursion: reference chains and inline nesting are processed iteratively or with depth limits, so hostile documents produce diagnostics instead of stack overflows.
- Generated code: names from the specification are converted to safe identifiers and file names; strings and comments are escaped (including `*/` and line separators), so specification text cannot inject code into generated modules.
- Output: the generator writes only inside the output directory (paths are validated, symbolic links resolved), refuses output directories that contain the project, config or specification, and never overwrites or deletes files it did not create (tracked in `.swaggerz-manifest.json`). Writes are atomic per file.

## Dashboard

`swaggerz dashboard` is a local development tool. It binds to `127.0.0.1` and refuses other interfaces unless `dashboard.allowNetworkAccess` is set. Every API request requires a random per-session token; `Host` and `Origin` headers are checked against DNS rebinding and cross-site requests; a strict Content Security Policy forbids inline and third-party scripts and allows inline styles only with a per-response nonce. Do not expose it to untrusted networks: anyone with the token can read the specification and trigger generation into the configured output directory.

## Generated clients

Generated clients send credentials only through the `auth` callbacks and headers you configure, and only to the URLs you call. They do not log request or response data. Response validation with Zod is opt-in; without it, response bodies are typed but not checked at runtime.

## Out of scope

- Behavior of the APIs you generate clients for.
- Malicious config files or plugins (they are code you chose to run).
- Denial of service by specifications that are within the configured size limits but expensive to process; tighten `spec.fetch.maxBytes` and the reference policy when processing specifications from unknown sources.
