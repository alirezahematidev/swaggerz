/**
 * `swaggerz/next`: wraps a Next.js config. `next dev` generates the client and keeps it in step
 * with the specification; `next build` generates it first.
 *
 * ```ts
 * import { withSwaggerz } from 'swaggerz/next';
 * export default withSwaggerz({ reactStrictMode: true });
 * ```
 *
 * Next.js loads its config in each process that needs it (the dev server, build workers): the
 * dev server's process watches once, and a build generates once, in the process that loads the
 * config first.
 */
import path from 'node:path';
import { styleText } from 'node:util';
import {
  formatProblems,
  generateOnce,
  GenerationSession,
  logReport,
  summarize,
  terminalColors,
  type IntegrationLogger,
  type IntegrationOptions,
} from './core.ts';

export interface SwaggerzNextOptions extends IntegrationOptions {
  /**
   * During `next dev`, generate again whenever the config file, the specification, an overlay or
   * a local plugin changes. Default `true`.
   */
  readonly watch?: boolean;
  /**
   * What `next build` does first. `'generate'` (the default) writes the client. `'check'` fails
   * the build when the output directory differs from what would be generated, like
   * `swaggerz generate --check`. `false` does nothing.
   */
  readonly build?: 'generate' | 'check' | false;
}

/** A Next.js config function: `(phase, { defaultConfig }) => config`. */
export type NextConfigFunction<Config> = (
  phase: string,
  context: { readonly defaultConfig: Config },
) => Config | Promise<Config>;

/** The phases of `next/constants`; others (`next start`, `next info`) generate nothing. */
const PHASE_DEVELOPMENT_SERVER = 'phase-development-server';
const PHASE_PRODUCTION_BUILD = 'phase-production-build';

/** Set once a build generated, so the build workers it starts (which inherit it) do not again. */
const BUILT = 'SWAGGERZ_NEXT_GENERATED';

/** Per process: one dev session, one build generation, however often Next.js loads the config. */
const STATE = Symbol.for('swaggerz.next');

interface ProcessState {
  /** The dev server's session, started once. */
  dev?: Promise<GenerationSession>;
  build?: Promise<void> | undefined;
}

function processState(): ProcessState {
  const global = globalThis as typeof globalThis & { [STATE]?: ProcessState };
  global[STATE] ??= {};
  return global[STATE];
}

function consoleLogger(color: boolean): IntegrationLogger {
  const paint = (text: string, style: 'cyan' | 'yellow' | 'red'): string =>
    color ? styleText(style, text, { validateStream: false }) : text;
  return {
    info: (message) => console.log(` ${paint('swaggerz', 'cyan')} ${message}`),
    warn: (message) => console.warn(` ${paint('swaggerz', 'yellow')} ${message}`),
    error: (message) => console.error(` ${paint('swaggerz', 'red')} ${message}`),
  };
}

async function dev(options: SwaggerzNextOptions, cwd: string): Promise<GenerationSession> {
  const color = terminalColors();
  const logger = consoleLogger(color);
  // The session lives as long as the dev server's process (Next.js restarts the process when
  // next.config changes).
  const session = new GenerationSession({
    cwd,
    watch: options.watch !== false,
    ...(options.configFile === undefined ? {} : { configFile: options.configFile }),
    ...(options.force === undefined ? {} : { force: options.force }),
    onReport: (report) => {
      logReport(report, logger, { cwd, color });
    },
    onRemote: (event) => {
      if (event.reachable) logger.info(`${event.url} is reachable again.`);
      else logger.warn(`Cannot fetch ${event.url}: ${event.error ?? 'unknown error'}. Retrying…`);
    },
  });
  await session.start();
  return session;
}

async function build(options: SwaggerzNextOptions, cwd: string): Promise<void> {
  if (options.build === false || process.env[BUILT] !== undefined) return;
  const color = terminalColors();
  const report = await generateOnce({
    cwd,
    check: options.build === 'check',
    ...(options.configFile === undefined ? {} : { configFile: options.configFile }),
    ...(options.force === undefined ? {} : { force: options.force }),
  });
  const logger = consoleLogger(color);
  if (report.ok) {
    logReport(report, logger, { cwd, color });
    process.env[BUILT] = '1';
    return;
  }
  const { warnings } = formatProblems(report, { cwd, color });
  if (warnings !== '') logger.warn(warnings);
  const { errors } = formatProblems(report, { cwd, color: false });
  throw new Error(
    [`swaggerz: ${summarize(report, cwd)}`, errors].filter((part) => part !== '').join('\n\n'),
  );
}

/**
 * Wraps a Next.js config (an object or a config function) so `next dev` and `next build`
 * generate the client first. Paths in the options are relative to `cwd`, which defaults to the
 * directory Next.js runs in (set it when running `next dev <dir>` from elsewhere).
 */
export function withSwaggerz<Config extends object>(
  nextConfig: Config | NextConfigFunction<Config>,
  options: SwaggerzNextOptions = {},
): (phase: string, context: { readonly defaultConfig: Config }) => Promise<Config> {
  return async (phase, context) => {
    const cwd = path.resolve(options.cwd ?? '.');
    const state = processState();
    if (phase === PHASE_DEVELOPMENT_SERVER) await (state.dev ??= dev(options, cwd));
    else if (phase === PHASE_PRODUCTION_BUILD) {
      // A failed generation is retried by the next load rather than remembered.
      state.build ??= build(options, cwd).catch((error: unknown) => {
        state.build = undefined;
        throw error;
      });
      await state.build;
    }
    return typeof nextConfig === 'function' ? nextConfig(phase, context) : nextConfig;
  };
}
