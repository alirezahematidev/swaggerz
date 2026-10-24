# swaggerz docs website

The documentation site: Astro with Starlight, a custom editorial layout, references generated from the source, real generated code beside its specification, measured numbers and an in-browser playground. The plan and the notes on how it was built are in [website.md](../website.md).

```sh
pnpm install                 # from the repository root
pnpm website:dev             # http://localhost:4321 (run `pnpm build` once first)
pnpm website:build           # everything CI does to build it
pnpm website:check           # contrast check + astro check
pnpm website:test            # Playwright: axe, CSP, budgets, screenshots (after a build)
pnpm --filter swaggerz-website run data --measure   # measure bundle sizes and timings again
```

## How it is put together

| Path                 | What                                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/navigation.ts`  | Chapters and pages, and which repository file each page renders. Every `docs/*.md` needs a page here.                                                                                                               |
| `src/loaders/`       | Content loaders that read `docs/*.md`, the examples' READMEs, `CHANGELOG.md` and `brand/README.md` in place.                                                                                                        |
| `scripts/data.ts`    | Generates `src/generated/` from the repository: references (CLI, config, API, diagnostics), twins, measurements, examples, OG images, font fallbacks, the code theme and the playground's compiler. Fails on drift. |
| `scripts/samples.ts` | Type-checks `samples/` and the ` ```ts check ` blocks of `docs/*.md` and `README.md` against freshly generated clients.                                                                                             |
| `twins/`             | The specifications of the spec ↔ code panels (`twins.ts` lists them); their right-hand side is compiled at build time.                                                                                              |
| `playground/`        | The browser compiler: the repository's pipeline with Node.js shims, bundled by `scripts/playground.ts` and checked against the CLI's output on the fixture specifications.                                          |
| `src/overrides/`     | Starlight component overrides: chapter sidebar, margin column, the "On this page" menu, page title, theme switch and footer.                                                                                        |
| `src/components/`    | The site's own components: search dialog, disclosures, spec ↔ code twins, samples, measured tables, references.                                                                                                     |
| `src/styles/`        | `theme.css` maps the shared palette (`src/dashboard/client/tokens.css`) onto Starlight; layout, twin and reference styles.                                                                                          |
| `src/pages/`         | The landing page, the playground, examples, changelog and brand pages.                                                                                                                                              |
| `integrations/`      | Completes each page's Content Security Policy with the hashes of its inline scripts after the build.                                                                                                                |
| `tests/`             | Playwright: accessibility (axe, both themes), CSP and console errors, budgets, the search dialog and menus, visual regression.                                                                                      |

## Adding things

- **A guide**: write `docs/<name>.md` (it must read well on GitHub), add it to `src/navigation.ts`, and optionally a twin (`twin: '<id>'`) shown under "What's generated".
- **A twin**: add a specification to `twins/` and an entry to `twins/twins.ts` with the generated files to show.
- **A diagnostic example**: add a case to `scripts/data/diagnostic-examples.ts`; the build fails if it stops reporting its code.
- **A code sample**: put it in `samples/<variant>/` and include it with `<Sample file="…" />`, or mark a Markdown code block ` ```ts check `.

## Deploying

The output (`dist/`) is static. `.github/workflows/website.yml` builds and tests it on every pull request, and on a release tag (the `v*` tags that `pnpm release` pushes and `release.yml` publishes) deploys it to **GitHub Pages**: it builds again with `SITE_URL` and `SITE_BASE` taken from the repository's Pages settings (`https://<owner>.github.io/<repository>/` by default), checks the links under that base and deploys. To deploy again without a new release, run the workflow by hand from the Actions tab on the latest tag.

- **Setup (once)**: Settings → Pages → _Source_: _GitHub Actions_; then Settings → Environments → `github-pages` → _Deployment branches and tags_: add a tag rule `v*` (by default only `main` may deploy, and deployments come from tags).
- **Custom domain**: add it in Settings → Pages → _Custom domain_ (a `CNAME` file is not used with Actions deployments) and create the DNS record GitHub shows (a `CNAME` to `<owner>.github.io` for a subdomain, or the `A`/`AAAA` records for an apex domain), then enable _Enforce HTTPS_. Run the workflow again: the build picks up the new address and serves the site from `/`, so canonical URLs, the sitemap, `robots.txt` and the social images follow.
- **Other hosts**: set `SITE_URL` (canonical URLs, the sitemap, social images) and, for a project path, `SITE_BASE=/<path>/`. `public/_headers` carries response headers for Cloudflare Pages and Netlify; GitHub Pages cannot set headers, so there the Content Security Policy comes only from each page's `<meta>` element (which covers everything but `frame-ancestors`).
