import path from 'node:path';
import { SwaggerzError } from '../diagnostics/bag.ts';
import { polledDocuments, RemoteWatcher, type PolledDocument } from '../loader/remote-watcher.ts';
import { FileWatcher } from '../utils/file-watcher.ts';
import { generateOnce } from './commands/generate.ts';
import { findConfigFile } from '../config/load.ts';
import { EXIT, option, relative, type CommandContext } from './context.ts';

const DEBOUNCE_MS = 120;

/**
 * Watches the config file and every local document of the specification (including external
 * `$ref` targets), polls remote documents (`spec.fetch.poll`), and regenerates on change.
 * Failures are reported and watching continues.
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
  let remoteTargets: readonly PolledDocument[] = [];
  let interval = 0;
  let unpolledInput: string | undefined;

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
      remoteTargets = polledDocuments(loaded.config, result.store);
      interval = loaded.config.spec.fetch.poll.interval;
      const input = loaded.config.spec.input;
      unpolledInput =
        /^https?:/i.test(input) && !remoteTargets.some((doc) => doc.url === new URL(input).href)
          ? input
          : undefined;
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
    remote.set(remoteTargets, interval);
  };

  // File and remote changes can arrive together; generations never overlap.
  let queue = Promise.resolve();
  const regenerate = (): Promise<void> =>
    (queue = queue.then(async () => {
      reporter.log(reporter.paint('Change detected, regenerating…', 'dim'));
      await run();
    }));
  const watcher = new FileWatcher({
    debounceMs: DEBOUNCE_MS,
    onChange: regenerate,
    onError: (directory, error) => {
      reporter.warn(
        `Cannot watch ${relative(ctx, directory)}: ${error instanceof Error ? error.message : String(error)}`,
      );
    },
  });
  const remote = new RemoteWatcher({
    onChange: regenerate,
    onError: (url, error) => {
      reporter.warn(
        `Cannot poll ${url}: ${error instanceof Error ? error.message : String(error)}. Retrying…`,
      );
    },
    onRecover: (url) => {
      reporter.log(reporter.paint(`${url} is reachable again.`, 'dim'));
    },
  });

  await run();
  const watched = [
    ...[...targets].map((file) => relative(ctx, file)),
    ...remote.urls.map((url) => `${url} (every ${interval / 1000} s)`),
  ];
  if (unpolledInput !== undefined) {
    reporter.warn(
      `${unpolledInput} is not polled for changes; set spec.fetch.poll to true or an interval to poll it.`,
    );
  }
  if (watched.length === 0) {
    reporter.warn('Nothing to watch.');
  } else {
    reporter.log(reporter.paint(`Watching ${watched.join(', ')}. Press Ctrl+C to stop.`, 'dim'));
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
  await Promise.all([watcher.close(), remote.close()]);
  return EXIT.OK;
}
