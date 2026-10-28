# Astro example

A static Astro site that renders a task list and one page per task at build time, through a client generated from an OpenAPI 3.1 document ([openapi.yaml](openapi.yaml)). The `swaggerz/astro` integration generates the client: there is no separate generate step.

```sh
pnpm example:astro   # from the repository root: build swaggerz, start astro dev
```

Or, inside this directory once swaggerz is built:

```sh
pnpm dev          # http://localhost:4321: generates src/generated/api, regenerates when openapi.yaml changes
pnpm check        # builds the site (generating the client first), then type-checks it (astro check)
pnpm dashboard    # explore the API and the generated code
```

What to look at:

- [astro.config.ts](astro.config.ts) adds `swaggerz()` from `swaggerz/astro`. `astro dev` generates the client when it starts and again whenever [openapi.yaml](openapi.yaml) or [swaggerz.config.ts](swaggerz.config.ts) changes (errors show over the page, as Vite's overlay); `astro build` and `astro check` generate it first. See [framework integrations](../../docs/integrations.md).
- [src/pages/index.astro](src/pages/index.astro) lists the tasks with `listTasks`; [src/pages/tasks/[id].astro](src/pages/tasks/[id].astro) builds one page per task with `getStaticPaths` and `getTask`, and handles a `404` with the operation's error guard, which types the body by status.
- [src/api.ts](src/api.ts) configures the client once. Its requests are answered in process by the generated mock handlers through `mockFetch()` ([src/mocks.ts](src/mocks.ts)): no server and no network, at build time and in `astro dev`. To call the real API, drop the transport and set `baseUrl`. See [mocks](../../docs/mocks.md).
