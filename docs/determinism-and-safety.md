# Determinism and safety

A code generator runs on two kinds of input it does not control: specifications written by someone else, and a project directory full of files that are yours. swaggerz treats the first as untrusted data and the second as off limits, and produces the same output for the same input every time.

## The same input, the same output

Output depends only on the specification, the config and the swaggerz version. Everything that comes from object iteration or the file system is sorted, and no file contains a timestamp, a version or an absolute path (the generator version is only recorded in the manifest). File names are allocated case-insensitively, so no two generated files collide on macOS or Windows. The test suite regenerates a client and checks that every file is identical and nothing was rewritten, and snapshot tests catch changes to the output.

That is what makes [`generate --check`](ci-and-monorepos.md#checking-a-committed-client) possible: CI regenerates in memory and compares.

## Files that are yours

The output directory contains `.swaggerz-manifest.json`: every file the generator owns, with the SHA-256 of its content. Regeneration compares the new files with the directory and the manifest:

| Situation                        | What happens                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| File unchanged                   | Not written (its modification time is kept, so watchers and builds do not fire)                |
| Generated file changed           | Rewritten                                                                                      |
| New file                         | Created                                                                                        |
| File no longer generated         | Deleted, unless it was edited by hand (then kept, with a warning); `--no-clean` keeps them all |
| A file you created is in the way | Error `output/user-file`, unless `--force`                                                     |

Every file also starts with a `@generated` marker. `swaggerz clean` deletes exactly the files in the manifest.

The output directory itself is checked first: a directory that contains the project root, the config file or the specification is refused (`config/unsafe-output`), also when it is reached through a symbolic link or another letter case.

## Atomic writes

All new content is written to temporary files next to their targets first, and every path to write or delete is checked to stay inside the output directory, symbolic links included, before anything changes. Files are renamed into place only after every write succeeded, so an interrupted or failed run leaves the previous output intact. Temporary files left by a process that no longer runs are removed by the next run.

## Specifications are untrusted

- **Nothing in a specification is executed.** Descriptions, examples, names and defaults reach the generated code only through escaping for their context: comments, string literals and identifiers.
- **References are fenced in.** External `$ref`s may read only the project and specification directories by default; remote references need an explicit host allow-list, redirects are checked again, and a remote document may never reference a local file. Credentials from `spec.fetch.headers` are sent only to the origin of `spec.input`.
- **Limits** bound document size (`spec.fetch.maxBytes`), the number of documents (`spec.refs.maxDocuments`), YAML alias expansion and schema nesting, so a hostile document cannot exhaust memory or the stack.
- **The terminal is protected.** Control characters from specifications and plugins are printed as `\xNN` escapes, so text cannot move the cursor, clear the screen or write to the clipboard.

## Tools that serve the project

- **The dashboard** binds to loopback, requires a per-session token for every request, rejects foreign `Host` and `Origin` headers, sends a strict Content Security Policy and renders specification text as text, never as HTML. See [dashboard](dashboard.md#security-model).
- **The MCP server** only reads unless started with `--allow-write`. Its `generate` tool keeps the manifest rules, asks the user first when the client can ask, and writes exactly the plan that was confirmed. Specification text is returned in fields marked as data, never as instructions. See [MCP server](mcp.md#safety).

## Trusted code

Config files and the plugins they reference are your code: they are imported with Node.js's own module loader and run with the CLI's permissions. swaggerz never evaluates code with `eval`, `new Function` or `vm`.

Vulnerabilities are reported as described in [SECURITY.md](../SECURITY.md).
