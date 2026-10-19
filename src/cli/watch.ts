import { watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { SwaggerzError } from '../diagnostics/bag.ts';
import { generateOnce } from './commands/generate.ts';
import { findConfigFile } from '../config/load.ts';
import { EXIT, option, relative, type CommandContext } from './context.ts';

const DEBOUNCE_MS = 120;

/**
 * Watches the config file and every local document of the specification (including external
 * `$ref` targets) and regenerates on change. Directories are watched rather than files so editors
 * that save by replacing files are handled. Failures are reported and watching continues.
 */
export async function watchAndRegenerate(ctx: CommandContext): Promise<number> {
  const { reporter } = ctx;
  const watchers = new Map<string, FSWatcher>();
  let targets = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;
  let pending = false;

  // The config file is watched even before it loads successfully, so fixing it recovers.
  const explicitConfig = option(ctx, 'config');
  const configFile =
    explicitConfig === undefined
      ? await findConfigFile(ctx.cwd)
      : path.resolve(ctx.cwd, explicitConfig);
  if (configFile !== undefined) targets.add(configFile);

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
    sync();
  };

  const schedule = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      if (running !== undefined) {
        pending = true;
        return;
      }
      reporter.log(reporter.paint('Change detected, regenerating…', 'dim'));
      running = run().finally(() => {
        running = undefined;
        if (pending) {
          pending = false;
          schedule();
        }
      });
    }, DEBOUNCE_MS);
  };

  const sync = (): void => {
    const directories = new Set([...targets].map((file) => path.dirname(file)));
    for (const [directory, watcher] of watchers) {
      if (!directories.has(directory)) {
        watcher.close();
        watchers.delete(directory);
      }
    }
    for (const directory of directories) {
      if (watchers.has(directory)) continue;
      try {
        const watcher = watch(directory, (_event, name) => {
          if (name !== null && targets.has(path.join(directory, name))) schedule();
        });
        watcher.on('error', () => {
          watcher.close();
          watchers.delete(directory);
        });
        watchers.set(directory, watcher);
      } catch (error) {
        reporter.warn(
          `Cannot watch ${relative(ctx, directory)}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  };

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
  if (timer !== undefined) clearTimeout(timer);
  for (const watcher of watchers.values()) watcher.close();
  await running;
  return EXIT.OK;
}
