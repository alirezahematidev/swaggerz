# Troubleshooting

`swaggerz doctor` checks most of what follows in one go: the Node.js version, the config, the specification, the output directory and the versions of the libraries the generated client imports.

| Symptom                                                                   | Fix                                                                                                                                                             |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config/load-failed` mentioning "type stripping"                          | Use Node.js 22.18 or later, avoid `enum`, `namespace` and parameter properties in the config, or rename it to `swaggerz.config.mjs`                             |
| `spec/version-mismatch`                                                   | Set `spec.version` to the version the document declares, or to `'auto'`                                                                                         |
| `ref/external-blocked`                                                    | Allow the directory (`spec.refs.allowedDirectories`) or the host (`spec.refs.external: 'remote'` and `spec.refs.allowedHosts`)                                  |
| `output/user-file`                                                        | A file you created sits where generated code goes: move it, change `output.directory`, or pass `--force`                                                        |
| Imports like `./client.js` fail with Next.js, webpack or Create React App | Set `output.importExtension: 'none'` (`swaggerz init` does in projects that depend on `next`)                                                                   |
| Running generated **TypeScript** directly with `node` fails               | Node.js does not map `.js` imports to `.ts` files: compile or bundle it, generate JavaScript, or use `importExtension: '.ts'` with `allowImportingTsExtensions` |
| The dashboard says the usage scanner is unavailable                       | Optional dependencies were skipped (`--omit=optional`, `--no-optional`) or the platform has no oxc binaries; reinstall with optional dependencies               |
| Cookie parameters are not sent in browsers                                | Browsers forbid the `Cookie` header and send cookies themselves: use `includeCredentials: true`                                                                 |
| `SyntaxError: Cannot use import statement outside a module`               | Generated modules are ES modules: add `"type": "module"` to the consuming package, or bundle the client                                                         |
| Types of a hook's `data` include `null`                                   | TanStack Query does not allow `undefined` as query data, so bodiless responses resolve with `null` in hooks (the operation itself returns `undefined`)          |

Every diagnostic code, with an example that triggers it and the fix, is in the [diagnostics](diagnostics.md) reference.

## Reporting a problem

Run the failing command with `--verbose` (notes, timings and stack traces of internal errors) and, if you can, reduce the specification to the smallest document that still fails. An `internal/error` is always a bug in swaggerz; please [open an issue](https://github.com/alirezahematidev/swaggerz/issues) with the command, the output and the document.
