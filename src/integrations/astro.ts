/**
 * `swaggerz/astro`: an Astro integration. `astro dev` generates the client and keeps it in step
 * with the specification (through the Vite plugin, with Vite's error overlay); `astro build` and
 * `astro sync` (which `astro check` runs) generate it first.
 *
 * ```ts
 * import swaggerz from 'swaggerz/astro';
 * export default defineConfig({ integrations: [swaggerz()] });
 * ```
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { formatProblems, generateOnce, logReport, summarize, terminalColors } from './core.ts';
import { vitePlugin, type SwaggerzViteOptions } from './vite-plugin.ts';

/** The options of the Vite plugin; `build` applies to `astro build` and `astro sync`. */
export type SwaggerzAstroOptions = SwaggerzViteOptions;

/** The swaggerz Astro integration. Paths in the options are relative to Astro's `root`. */
export default function swaggerz(options: SwaggerzAstroOptions = {}): AstroIntegration {
  return {
    name: 'swaggerz',
    hooks: {
      'astro:config:setup': async ({ config, command, updateConfig, logger }) => {
        const cwd = path.resolve(fileURLToPath(config.root), options.cwd ?? '.');
        if (command === 'dev') {
          // Astro's dev server is Vite's: the plugin generates, watches and shows errors.
          updateConfig({
            vite: { plugins: [vitePlugin({ ...options, cwd, build: false }, logger)] },
          });
          return;
        }
        if ((command !== 'build' && command !== 'sync') || options.build === false) return;
        const report = await generateOnce({
          cwd,
          check: options.build === 'check',
          ...(options.configFile === undefined ? {} : { configFile: options.configFile }),
          ...(options.force === undefined ? {} : { force: options.force }),
        });
        const color = terminalColors();
        if (report.ok) {
          logReport(report, logger, { cwd, color });
          return;
        }
        const { warnings } = formatProblems(report, { cwd, color });
        if (warnings !== '') logger.warn(warnings);
        const { errors } = formatProblems(report, { cwd, color: false });
        throw new Error(
          [`swaggerz: ${summarize(report, cwd)}`, errors]
            .filter((part) => part !== '')
            .join('\n\n'),
        );
      },
    },
  };
}
