# Next.js example

A Next.js App Router site whose server components render a task list and one page per task, through a client generated from an OpenAPI 3.1 document ([openapi.yaml](openapi.yaml)). `withSwaggerz()` from `swaggerz/next` generates the client: there is no separate generate step.

```sh
pnpm example:next   # from the repository root: build swaggerz, start next dev
```

Or, inside this directory once swaggerz is built:

```sh
pnpm dev          # http://localhost:3000: generates src/generated/api, regenerates when openapi.yaml changes
pnpm check        # builds the site (generating the client first, then type-checking it)
pnpm dashboard    # explore the API and the generated code
```

What to look at:

- [next.config.ts](next.config.ts) wraps the config with `withSwaggerz()`. `next dev` generates the client when it starts and again whenever [openapi.yaml](openapi.yaml) or [swaggerz.config.ts](swaggerz.config.ts) changes (problems are printed in the terminal); `next build` generates it first and fails when it cannot. See [framework integrations](../../docs/integrations.md).
- [swaggerz.config.ts](swaggerz.config.ts) sets `output.importExtension: 'none'`: neither Turbopack nor webpack in Next.js resolves the default `./client.js` imports to `client.ts` files. `swaggerz init` sets it in projects that depend on `next`.
- [src/app/page.tsx](src/app/page.tsx) lists the tasks with `listTasks`; [src/app/tasks/[id]/page.tsx](src/app/tasks/[id]/page.tsx) prerenders one page per task with `generateStaticParams` and `getTask`, and turns a `404` into `notFound()` with the operation's error guard, which types the body by status.
- [src/api.ts](src/api.ts) configures the client once. Its requests are answered in process by the generated mock handlers through `mockFetch()` ([src/mocks.ts](src/mocks.ts)): no server and no network, at build time and in `next dev`. To call the real API, drop the transport and set `baseUrl`. See [mocks](../../docs/mocks.md).
