/**
 * The Vite plugin behind `swaggerz/vite` and, during `astro dev`, `swaggerz/astro`: generates
 * the client when Vite starts, keeps it in step with the specification while the dev server runs
 * (Vite's hot module replacement picks up the files that changed), shows generation errors in
 * Vite's error overlay, and generates before `vite build`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { styleText } from 'node:util';
import type { ErrorPayload, Logger, Plugin, ViteDevServer, WebSocket } from 'vite';
import { printable } from '../diagnostics/format.ts';
import {
  firstLocation,
  formatProblems,
  generateOnce,
  GenerationSession,
  logReport,
  summarize,
  terminalColors,
  type GenerationReport,
  type IntegrationLogger,
  type IntegrationOptions,
  type OneShotReport,
} from './core.ts';

export interface SwaggerzViteOptions extends IntegrationOptions {
  /**
   * While `vite` runs, generate again whenever the config file, the specification (every local
   * document it references), an overlay or a local plugin changes; remote documents are polled
   * when `spec.fetch.poll` is set. Default `true`. Off when Vite does not watch either
   * (`server.watch: null`, as in `vitest run`): the client is then generated once.
   */
  readonly watch?: boolean;
  /**
   * What `vite build` does first. `'generate'` (the default) writes the client. `'check'` fails
   * the build when the output directory differs from what would be generated, like
   * `swaggerz generate --check`, for clients committed to the repository. `false` does nothing.
   */
  readonly build?: 'generate' | 'check' | false;
  /** Show generation errors over the page with Vite's error overlay. Default `true`. */
  readonly overlay?: boolean;
}

/** The lines around a located error, as Vite's overlay shows them under the message. */
function codeFrame(file: string, line: number, column: number | undefined): string | undefined {
  let lines: string[];
  try {
    lines = readFileSync(file, 'utf8').split(/\r?\n/);
  } catch {
    return undefined;
  }
  if (line < 1 || line > lines.length) return undefined;
  const first = Math.max(1, line - 2);
  const last = Math.min(lines.length, line + 2);
  const width = String(last).length;
  // Minified JSON can be one very long line: show at most a window of it.
  const start = column === undefined || column < 80 ? 0 : column - 40;
  const frame: string[] = [];
  for (let current = first; current <= last; current++) {
    const text = printable(lines[current - 1] ?? '').slice(start, start + 160);
    frame.push(`${current === line ? '>' : ' '} ${String(current).padStart(width)} | ${text}`);
    if (current === line && column !== undefined)
      frame.push(`  ${' '.repeat(width)} | ${' '.repeat(Math.max(0, column - 1 - start))}^`);
  }
  return frame.join('\n');
}

/** The error Vite's overlay shows for a failed generation: the summary, then each error. */
function overlayError(report: GenerationReport, cwd: string): ErrorPayload['err'] {
  const { errors } = formatProblems(report, { cwd, color: false });
  const location = firstLocation(report);
  const frame =
    location?.line === undefined
      ? undefined
      : codeFrame(location.file, location.line, location.column);
  return {
    message: [summarize(report, cwd), errors].filter((part) => part !== '').join('\n\n'),
    stack: '',
    plugin: 'swaggerz',
    ...(location === undefined ? {} : { id: location.file }),
    ...(location?.line === undefined
      ? {}
      : { loc: { file: location.file, line: location.line, column: location.column ?? 1 } }),
    ...(frame === undefined ? {} : { frame }),
  };
}

/** Vite's logger, with each message labelled like Vite labels its environments. */
function viteLogger(logger: Logger, color: boolean, timestamp: boolean): IntegrationLogger {
  const label = color ? styleText('dim', '(swaggerz)', { validateStream: false }) : '(swaggerz)';
  return {
    info: (message) => logger.info(`${label} ${message}`, { timestamp }),
    warn: (message) => logger.warn(`${label} ${message}`, { timestamp }),
    error: (message) => logger.error(`${label} ${message}`, { timestamp }),
  };
}

/**
 * The plugin. Paths in the options are relative to Vite's `root`. Messages go to `log` when it is
 * given (Astro's logger), otherwise to Vite's logger.
 */
export function vitePlugin(options: SwaggerzViteOptions, log?: IntegrationLogger): Plugin {
  let root = process.cwd();
  let command: 'build' | 'serve' = 'serve';
  let viteLog: Logger | undefined;
  /**
   * Each dev server's session, by the server's environments: Vite closes a server by calling
   * `closeBundle` for each of them, and starts the next server before closing the previous one
   * when it restarts with the same plugin.
   */
  const sessions = new WeakMap<object, GenerationSession>();
  /** The generation before a build; once per build, or once per rebuild in watch mode. */
  let building: Promise<OneShotReport> | undefined;
  const cwd = (): string => path.resolve(root, options.cwd ?? '.');
  const configFile = options.configFile === undefined ? {} : { configFile: options.configFile };
  const force = options.force === undefined ? {} : { force: options.force };

  return {
    name: 'swaggerz',
    // Before other plugins, so the client exists before they look at the project.
    enforce: 'pre',
    // One generation per build, whichever environments Vite builds.
    sharedDuringBuild: true,

    configResolved(config) {
      root = config.root;
      command = config.command;
      viteLog = config.logger;
      // A new build (Vite resolves its config once per build, for every environment).
      building = undefined;
    },

    async configureServer(server: ViteDevServer) {
      const directory = cwd();
      const color = terminalColors();
      const logger = log ?? viteLogger(server.config.logger, color, true);
      const overlay = options.overlay !== false;
      /** The error the overlay shows, sent again to pages that connect (or reload) later. */
      let shown: ErrorPayload | undefined;
      // The socket's own `connection` event (Vite 8's `vite:client:connect` is not in Vite 6 or 7);
      // Vite's listener, registered first, has already greeted the page.
      server.ws.on('connection', (socket: WebSocket) => {
        if (shown !== undefined) socket.send(JSON.stringify(shown));
      });
      const session = new GenerationSession({
        cwd: directory,
        watch: options.watch !== false && server.config.server.watch !== null,
        ...configFile,
        ...force,
        onReport: (report) => {
          logReport(report, logger, { cwd: directory, color });
          if (!overlay) return;
          if (!report.ok) {
            shown = { type: 'error', err: overlayError(report, directory) };
            // Pages that connect later get it on connection; Vite would otherwise keep one for
            // the next page even after the problem is fixed.
            if (server.ws.clients.size > 0) server.ws.send(shown);
          } else if (shown !== undefined) {
            shown = undefined;
            // An update clears the overlay (or reloads a page that failed to load).
            if (server.ws.clients.size > 0) server.ws.send({ type: 'update', updates: [] });
          }
        },
        onRemote: (event) => {
          if (event.reachable) logger.info(`${event.url} is reachable again.`);
          else
            logger.warn(`Cannot fetch ${event.url}: ${event.error ?? 'unknown error'}. Retrying…`);
        },
      });
      // The dev server starts listening once the first generation is written, so the first
      // request already sees the client.
      for (const environment of Object.values(server.environments))
        sessions.set(environment, session);
      await session.start();
    },

    async buildStart() {
      if (command !== 'build' || options.build === false) return;
      const watchMode = this.meta.watchMode;
      if (building === undefined || watchMode) {
        building = generateOnce({
          cwd: cwd(),
          check: options.build === 'check',
          ...configFile,
          ...force,
        });
      }
      const report = await building;
      // `vite build --watch` builds again when the specification changes.
      if (watchMode) for (const file of report.sources) this.addWatchFile(file);
      const directory = cwd();
      const color = terminalColors();
      const logger = log ?? (viteLog === undefined ? undefined : viteLogger(viteLog, color, false));
      if (report.ok) {
        if (logger !== undefined) logReport(report, logger, { cwd: directory, color });
        return;
      }
      const { warnings } = formatProblems(report, { cwd: directory, color });
      if (warnings !== '') logger?.warn(warnings);
      // The build's error message: Vite prints it in its own colors.
      const { errors } = formatProblems(report, { cwd: directory, color: false });
      this.error([summarize(report, directory), errors].filter((part) => part !== '').join('\n\n'));
    },

    async closeBundle() {
      // A dev server closes; a build's environments have no session.
      await sessions.get(this.environment)?.close();
    },
  };
}
