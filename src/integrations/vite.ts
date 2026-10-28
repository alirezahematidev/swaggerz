/**
 * `swaggerz/vite`: generates the client when Vite starts, keeps it in step with the
 * specification while the dev server runs, shows generation errors in Vite's error overlay, and
 * generates before `vite build`.
 *
 * ```ts
 * import { swaggerz } from 'swaggerz/vite';
 * export default defineConfig({ plugins: [swaggerz()] });
 * ```
 */
import type { Plugin } from 'vite';
import { vitePlugin, type SwaggerzViteOptions } from './vite-plugin.ts';

export type { SwaggerzViteOptions } from './vite-plugin.ts';

/** The swaggerz Vite plugin. Paths in the options are relative to Vite's `root`. */
export function swaggerz(options: SwaggerzViteOptions = {}): Plugin {
  return vitePlugin(options);
}
