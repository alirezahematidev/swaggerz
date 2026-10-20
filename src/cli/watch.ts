import path from 'node:path';
import { SwaggerzError } from '../diagnostics/bag.ts';
import { FileWatcher } from '../utils/file-watcher.ts';
import { generateOnce } from './commands/generate.ts';
import { findConfigFile } from '../config/load.ts';
import { EXIT, option, relative, type CommandContext } from './context.ts';

const DEBOUNCE_MS = 120;

/**
 * Watches the config file and every local document of the specification (including external
 * `$ref` targets) and regenerates on change. Failures are reported and watching continues.
 */
export async function watchAndRegenerate(ctx: CommandContext): Promise<number> {
  const { reporter } = ctx;

  // The config file is watched even before it loads successfully, so fixing it recovers.
  const explicitConfig = option(ctx, 'config');
  const configFile =
    explicitConfig === undefined
      ? await findConfigFile(ctx.cwd)
      : path.resolve(ctx.cwd, explicitConfig);
  let targets = new Set<string>(configFile === undefined ? [] : [configFile]);

  const run = async (): Promise<void> => {
    try {
      const { result, loaded } = await generateOnce(ctx);
      const files = new Set<string>(configFile === undefined ? [] : [configFile]);
      if (loaded.file !== undefined) files.add(loaded.file);
      if (!/^https?:/i.test(loaded.config.spec.input)) files.add(loaded.config.spec.input);
      for (const doc of result.store?.documents ?? []) {
        if (doc.url.startsWith('file:')) files.add(doc.location);
      }
      targets = files;
    } catch (error) {
      if (error instanceof SwaggerzError) {
        reporter.diagnostics(error.diagnostics);
        reporter.error(`${error.message}. Waiting for changes…`);
      } else {
        reporter.error(
          `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    watcher.set(targets);
  };

  const watcher = new FileWatcher({
    debounceMs: DEBOUNCE_MS,
    onChange: async () => {
      reporter.log(reporter.paint('Change detected, regenerating…', 'dim'));
      await run();
    },
    onError: (directory, error) => {
      reporter.warn(
        `Cannot watch ${relative(ctx, directory)}: ${error instanceof Error ? error.message : String(error)}`,
      );
    },
  });

  await run();
  if (targets.size === 0) {
    reporter.warn('Nothing to watch (remote specifications are not watched).');
  } else {
    reporter.log(
      reporter.paint(
        `Watching ${[...targets].map((file) => relative(ctx, file)).join(', ')}. Press Ctrl+C to stop.`,
        'dim',
      ),
    );
  }

  await new Promise<void>((resolve) => {
    if (ctx.signal.aborted) resolve();
    ctx.signal.addEventListener(
      'abort',
      () => {
        resolve();
      },
      { once: true },
    );
  });
  await watcher.close();
  return EXIT.OK;
}
