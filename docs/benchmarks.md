# Benchmarks

## Compiler

`node --expose-gc scripts/bench.ts [resources…]` generates synthetic OpenAPI 3.0 specifications (`scripts/large-spec.ts`) and compiles each one in memory six times (one warm-up, then the median of five runs is reported). Each resource group contributes five CRUD operations, three models (a model with a nested reference, an enum and an input model) and shared paging/error models. Every model references the previous resource's model, so the reference graph is unusually deep — a deliberately pessimistic case for dependency analysis.

"Total" covers loading, parsing, reference resolution, normalization, analysis and generating every file in memory; writing to disk is excluded. "Heap after" is the largest heap observed across runs.

Apple M4, Node.js 24.16.0, macOS (arm64), measured on 23 October 2026 (the docs website measures again on every build and shows the date):

| Operations | Models | Spec size |  Parse | Analyze | Generate |    Total |  Files | Heap after |
| ---------: | -----: | --------: | -----: | ------: | -------: | -------: | -----: | ---------: |
|        100 |     62 |   0.06 MB |   7 ms |    1 ms |    13 ms |    21 ms |    171 |    27.0 MB |
|        500 |    302 |    0.3 MB |  25 ms |    7 ms |    55 ms |    86 ms |    811 |    37.3 MB |
|      2,500 |  1,502 |    1.5 MB | 117 ms |   33 ms |   237 ms |   390 ms |  4,011 |   152.0 MB |
|     10,000 |  6,002 |    6.0 MB | 460 ms |  115 ms |   855 ms | 1,438 ms | 16,011 |   415.5 MB |

Time and memory grow linearly with the size of the specification. Two optimizations came out of profiling these runs:

- Referenced schemas are converted through a work queue instead of recursively, so long reference chains no longer exhaust the call stack (2,000-deep chains used to overflow).
- Dependency analysis uses breadth-first reachability, reverse search and Tarjan's strongly connected components instead of cached per-schema closures; when that changed, analysis of 10,000 operations went from 1.4 s to 76 ms and peak heap from 1.4 GB to 355 MB.

Regeneration only rewrites files whose content changed, so a typical incremental run writes a handful of files regardless of the specification size.

## Bundle size

`tests/integration/treeshake/bundle.test.ts` generates a client for 1,000 operations and 602 models and bundles small applications with esbuild, Rollup, Vite and webpack. Sizes are minified (except Rollup) and not gzipped:

| Bundle                                                    |     Size |
| --------------------------------------------------------- | -------: |
| 1 operation, direct module import (esbuild)               |  16.1 KB |
| 3 operations through the barrel (esbuild)                 |  16.5 KB |
| 3 operations through the barrel (Rollup, unminified)      |  51.0 KB |
| 3 operations through the barrel (Vite production build)   |  21.4 KB |
| 3 operations through the barrel (webpack production)      |  16.7 KB |
| 1 React Query hook, minus TanStack Query itself (esbuild) |  16.6 KB |
| The whole client (esbuild)                                | 336.7 KB |

The ~16 KB base is the shared runtime (serialization, errors, the client and the transport); the `retry()` and `refreshAuth()` middleware are only added when imported, and each further operation adds about 0.2 KB. Importing from the barrel is as tree-shakeable as importing modules directly with every bundler above. webpack removes the unused exports of these side-effect-free modules in production mode through its `usedExports` analysis and minifier.

The whole client includes every operation's error guard (`isGetPetByIdApiError`); applications that import some operations only get the guards they import.

The tests assert which operations remain in each bundle (only the imported ones) rather than exact byte counts, so they do not break when a minifier changes.

## Reproducing

```sh
pnpm bench                     # compiler benchmarks (default sizes 20, 100, 500, 2000 resource groups)
node --expose-gc scripts/bench.ts 50 400
pnpm vitest run tests/integration/treeshake   # writes tests/.output/treeshake/sizes.json
```
