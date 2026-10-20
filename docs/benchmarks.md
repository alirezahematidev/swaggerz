# Benchmarks

## Compiler

`node --expose-gc scripts/bench.ts [resources…]` generates synthetic OpenAPI 3.0 specifications (`scripts/large-spec.ts`) and compiles each one in memory six times (one warm-up, then the median of five runs is reported). Each resource group contributes five CRUD operations, three models (a model with a nested reference, an enum and an input model) and shared paging/error models. Every model references the previous resource's model, so the reference graph is unusually deep — a deliberately pessimistic case for dependency analysis.

"Total" covers loading, parsing, reference resolution, normalization, analysis and generating every file in memory; writing to disk is excluded. "Heap after" is the largest heap observed across runs.

Apple M4, Node.js 24.16.0, macOS (arm64):

| Operations | Models | Spec size |  Parse | Analyze | Generate |    Total |  Files | Heap after |
| ---------: | -----: | --------: | -----: | ------: | -------: | -------: | -----: | ---------: |
|        100 |     62 |   0.03 MB |   6 ms |    1 ms |     8 ms |    15 ms |    170 |      26 MB |
|        500 |    302 |    0.2 MB |  23 ms |    4 ms |    33 ms |    60 ms |    810 |      38 MB |
|      2,500 |  1,502 |      1 MB | 113 ms |   18 ms |   137 ms |   267 ms |  4,010 |     122 MB |
|     10,000 |  6,002 |      6 MB | 441 ms |   76 ms |   504 ms | 1,019 ms | 16,010 |     355 MB |

Time and memory grow linearly with the size of the specification. Two optimizations came out of profiling these runs:

- Referenced schemas are converted through a work queue instead of recursively, so long reference chains no longer exhaust the call stack (2,000-deep chains used to overflow).
- Dependency analysis uses breadth-first reachability, reverse search and Tarjan's strongly connected components instead of cached per-schema closures; at 10,000 operations analysis went from 1.4 s to 76 ms and peak heap from 1.4 GB to 355 MB.

Regeneration only rewrites files whose content changed, so a typical incremental run writes a handful of files regardless of the specification size.

## Bundle size

`tests/integration/treeshake/bundle.test.ts` generates a client for 1,000 operations and 602 models and bundles small applications with esbuild, Rollup, Vite and webpack. Sizes are minified (except Rollup) and not gzipped:

| Bundle                                                    |     Size |
| --------------------------------------------------------- | -------: |
| 1 operation, direct module import (esbuild)               |  13.3 KB |
| 3 operations through the barrel (esbuild)                 |  13.7 KB |
| 3 operations through the barrel (Rollup, unminified)      |  41.4 KB |
| 3 operations through the barrel (Vite production build)   |  17.9 KB |
| 3 operations through the barrel (webpack production)      |  13.8 KB |
| 1 React Query hook, minus TanStack Query itself (esbuild) |  13.8 KB |
| The whole client (esbuild)                                | 326.4 KB |

The whole client includes every operation's error guard (`isGetPetByIdApiError`); applications that import some operations only get the guards they import.

The tests assert which operations remain in each bundle (only the imported ones) rather than exact byte counts, so they do not break when a minifier changes.

## Reproducing

```sh
pnpm bench                     # compiler benchmarks (default sizes 20, 100, 500, 2000 resource groups)
node --expose-gc scripts/bench.ts 50 400
pnpm vitest run tests/integration/treeshake   # writes tests/.output/treeshake/sizes.json
```
