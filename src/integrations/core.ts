/**
 * The core the framework integrations share (`swaggerz/vite`, `swaggerz/astro`, `swaggerz/next`):
 * generating once before a build, and keeping the output in step with the specification while a
 * dev server runs. Generation goes through the same pipeline as the CLI; watching goes through
 * the `ProjectService` and `ProjectWatcher` the dashboard and the MCP server use.
 */
import path from 'node:path';
import { CONFIG_EXTENSIONS, loadConfig, type LoadedConfig } from '../config/load.ts';
import { SwaggerzError } from '../diagnostics/bag.ts';
import { formatDiagnostic } from '../diagnostics/format.ts';
import type { Diagnostic } from '../diagnostics/types.ts';
import type { DocumentStore } from '../loader/store.ts';
import { CONFIG_BASENAME, TOOL_NAME } from '../meta.ts';
import type { WriteResult } from '../output/types.ts';
import { runGeneration } from '../pipeline/generate.ts';
import { ProjectService } from '../service/project.ts';
import { ProjectWatcher } from '../service/watch.ts';
import { FileWatcher, type FileWatcherOptions } from '../utils/file-watcher.ts';
import { pluralize } from '../utils/strings.ts';

/** Options every integration accepts. */
export interface IntegrationOptions {
  /**
   * The directory the config file is searched in (`swaggerz.config.*`) and `configFile` is
   * relative to. Default: the framework's root (Vite's `root`, Astro's `root`, the Next.js
   * project directory).
   */
  readonly cwd?: string;
  /** The config file, when it is not `swaggerz.config.*` in `cwd`. */
  readonly configFile?: string;
  /**
   * Overwrite files in the output directory that the generator does not own or that were edited
   * by hand, like `swaggerz generate --force`. Default `false`: such files stop the generation.
   */
  readonly force?: boolean;
}

/** The outcome of one generation (or check). */
export interface GenerationReport {
  /** Nothing failed (and, for a check, the output is up to date). */
  readonly ok: boolean;
  /** Why the generation could not start (no config file, a config that does not load). */
  readonly error?: string;
  /** The compiler's and the writer's diagnostics. */
  readonly diagnostics: readonly Diagnostic[];
  /** What was written (or, for a check, what would be). Absent when nothing could be written. */
  readonly write?: WriteResult;
  /** A check: whether the output directory matches what would be generated. */
  readonly upToDate?: boolean;
  /** The files and URLs whose change started this generation, relative to the project root. */
  readonly changed: readonly string[];
  /** Milliseconds, from the change (or the start) to the end of the write. */
  readonly elapsed: number;
}

/** Where an integration's messages go: Vite's logger, Astro's, or the console. */
export interface IntegrationLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/** The report of a generation that could not start. */
function failed(error: unknown, changed: readonly string[], started: number): GenerationReport {
  const known = error instanceof SwaggerzError;
  return {
    ok: false,
    error: known
      ? error.message
      : `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
    diagnostics: known ? error.diagnostics : [],
    changed,
    elapsed: performance.now() - started,
  };
}

/** The config files a project without a loadable config could get. */
function configCandidates(cwd: string, configFile: string | undefined): string[] {
  return configFile === undefined
    ? CONFIG_EXTENSIONS.map((extension) => path.join(cwd, `${CONFIG_BASENAME}${extension}`))
    : [path.resolve(cwd, configFile)];
}

const isRemote = (location: string): boolean => /^https?:/i.test(location);

/**
 * The local files a generation read: the config file, local plugin modules, the specification
 * with every local document it references, and local overlays.
 */
function localSources(loaded: LoadedConfig, store: DocumentStore | undefined): string[] {
  const files = new Set<string>();
  if (loaded.file !== undefined) files.add(loaded.file);
  for (const file of loaded.watchFiles) files.add(file);
  if (!isRemote(loaded.config.spec.input)) files.add(loaded.config.spec.input);
  for (const overlay of loaded.config.spec.overlays) if (!isRemote(overlay)) files.add(overlay);
  for (const doc of store?.documents ?? [])
    if (doc.url.startsWith('file:')) files.add(doc.location);
  return [...files].sort();
}

export interface GenerateOnceOptions extends IntegrationOptions {
  readonly cwd: string;
  /**
   * Compare the output directory with what would be generated instead of writing it, like
   * `swaggerz generate --check`: the report is not `ok` when they differ.
   */
  readonly check?: boolean;
}

/** A one-shot report, with the local files to watch for the next build (`vite build --watch`). */
export interface OneShotReport extends GenerationReport {
  readonly sources: readonly string[];
}

/** Generates (or checks) the client once, as `swaggerz generate` does. Never throws. */
export async function generateOnce(options: GenerateOnceOptions): Promise<OneShotReport> {
  const started = performance.now();
  let loaded: LoadedConfig;
  try {
    loaded = await loadConfig({
      cwd: options.cwd,
      command: 'generate',
      ...(options.configFile === undefined ? {} : { configFile: options.configFile }),
    });
  } catch (error) {
    return {
      ...failed(error, [], started),
      sources: configCandidates(options.cwd, options.configFile),
    };
  }
  try {
    const result = await runGeneration({
      config: loaded.config,
      plugins: loaded.plugins,
      dryRun: options.check === true,
      force: options.force === true,
    });
    const write = result.write;
    const upToDate =
      options.check === true && result.ok && write !== undefined
        ? write.created.length + write.updated.length + write.deleted.length === 0 &&
          (result.manifestChange ?? 'unchanged') === 'unchanged'
        : undefined;
    return {
      ok: result.ok && upToDate !== false,
      diagnostics: result.diagnostics,
      ...(write === undefined ? {} : { write }),
      ...(upToDate === undefined ? {} : { upToDate }),
      changed: [],
      elapsed: performance.now() - started,
      sources: localSources(loaded, result.store),
    };
  } catch (error) {
    return { ...failed(error, [], started), sources: localSources(loaded, undefined) };
  }
}

export interface SessionOptions extends IntegrationOptions {
  readonly cwd: string;
  /** Generate again whenever the config, the specification or an overlay changes. */
  readonly watch: boolean;
  /** Called after every generation, the first one included. */
  readonly onReport: (report: GenerationReport) => void;
  /** A polled remote document (`spec.fetch.poll`) became unreachable, or reachable again. */
  readonly onRemote?: (event: {
    readonly url: string;
    readonly reachable: boolean;
    readonly error?: string;
  }) => void;
  /** Creates the platform file watchers (`fs.watch`; replaced in tests). */
  readonly fileWatch?: FileWatcherOptions['watch'];
}

/**
 * Generates the client and, with `watch`, keeps it in step with its sources for as long as a
 * dev server runs: changes reload the project (`ProjectWatcher`) and the new compilation is
 * written, touching only the files whose content changed. A config that cannot be loaded at
 * first is watched until it can.
 */
export class GenerationSession {
  readonly #options: SessionOptions;
  readonly #service: ProjectService;
  #watcher: ProjectWatcher | undefined;
  /** Watches the config file until the first load succeeds. */
  #configWatcher: FileWatcher | undefined;
  #queue: Promise<void> = Promise.resolve();
  /** When the reload in progress started. */
  #reloadStarted = 0;
  #closed = false;

  constructor(options: SessionOptions) {
    this.#options = options;
    this.#service = new ProjectService({
      cwd: options.cwd,
      env: process.env,
      command: 'generate',
      ...(options.configFile === undefined ? {} : { configFile: options.configFile }),
    });
  }

  /** Runs the first generation; resolves once it is written (or has failed). */
  start(): Promise<void> {
    return this.#enqueue(() => this.#load([], performance.now()));
  }

  /** Stops watching and waits for a generation in progress. */
  async close(): Promise<void> {
    this.#closed = true;
    await Promise.all([this.#watcher?.close(), this.#configWatcher?.close()]);
    await this.#queue;
  }

  #enqueue(task: () => Promise<void>): Promise<void> {
    const next = this.#queue.then(async () => {
      if (this.#closed) return;
      try {
        await task();
      } catch (error) {
        this.#report(failed(error, [], performance.now()));
      }
    });
    this.#queue = next;
    return next;
  }

  #report(report: GenerationReport): void {
    if (!this.#closed) this.#options.onReport(report);
  }

  #relative(file: string): string {
    if (isRemote(file)) return file;
    const relative = path.relative(this.#options.cwd, file);
    return relative.startsWith('..') ? file : relative.split(path.sep).join('/');
  }

  /** The first load; until one succeeds, the config file is watched. */
  async #load(changed: readonly string[], started: number): Promise<void> {
    try {
      await this.#service.reload('start');
    } catch (error) {
      this.#report(failed(error, changed, started));
      if (this.#options.watch) this.#waitForConfig();
      return;
    }
    // Not awaited: this may run inside the config watcher's own callback.
    void this.#configWatcher?.close();
    this.#configWatcher = undefined;
    await this.#write(changed, started);
    if (this.#options.watch && !this.#closed) this.#watch();
  }

  #waitForConfig(): void {
    if (this.#configWatcher !== undefined || this.#closed) return;
    this.#configWatcher = new FileWatcher({
      debounceMs: 150,
      ...(this.#options.fileWatch === undefined ? {} : { watch: this.#options.fileWatch }),
      onChange: (files) => {
        const started = performance.now();
        void this.#enqueue(() =>
          this.#load(
            files.map((file) => this.#relative(file)),
            started,
          ),
        );
      },
    });
    this.#configWatcher.set(configCandidates(this.#options.cwd, this.#options.configFile));
  }

  #watch(): void {
    this.#watcher = new ProjectWatcher(
      this.#service,
      {
        reloading: () => {
          this.#reloadStarted = performance.now();
        },
        reloaded: (outcome) => {
          const started = this.#reloadStarted;
          void this.#enqueue(() => this.#write(outcome.files, started));
        },
        remote: (event) => {
          if (!this.#closed) this.#options.onRemote?.(event);
        },
      },
      this.#options.fileWatch === undefined ? {} : { watch: this.#options.fileWatch },
    );
    this.#watcher.start();
  }

  async #write(changed: readonly string[], started: number): Promise<void> {
    const response = await this.#service.write({ force: this.#options.force === true });
    this.#report({
      ok: response.ok,
      diagnostics: response.diagnostics,
      ...(response.write === undefined ? {} : { write: response.write }),
      changed,
      elapsed: performance.now() - started,
    });
  }
}

/** A path for messages: relative to `cwd` when it is inside it, with `/` separators. */
function display(file: string, cwd: string): string {
  const relative = path.relative(cwd, file);
  if (relative === '') return '.';
  return relative.startsWith('..') || path.isAbsolute(relative)
    ? file
    : relative.split(path.sep).join('/');
}

function list(items: readonly string[]): string {
  return items.length <= 3
    ? items.join(', ')
    : `${items.slice(0, 3).join(', ')} and ${items.length - 3} more`;
}

function counts(diagnostics: readonly Diagnostic[]): string {
  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length;
  return warnings === 0
    ? pluralize(errors, 'error')
    : `${pluralize(errors, 'error')}, ${pluralize(warnings, 'warning')}`;
}

/**
 * One line on what a generation did, e.g. `Generated 42 files in src/api (42 created) in 310 ms.`
 * or `openapi.yaml changed: regenerated src/api (2 updated) in 85 ms.`
 */
export function summarize(report: GenerationReport, cwd: string): string {
  const prefix = report.changed.length === 0 ? '' : `${list(report.changed)} changed: `;
  /** The sentence, after the prefix or capitalized when there is none. */
  const sentence = (text: string): string =>
    prefix === '' ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : `${prefix}${text}`;
  const ms = `${Math.round(report.elapsed)} ms`;
  const write = report.write;
  if (report.error !== undefined) return `${prefix}${report.error}.`;
  if (write === undefined)
    return sentence(`generation failed (${counts(report.diagnostics)}); nothing was written.`);
  const directory = display(write.directory, cwd);
  if (report.upToDate === true)
    return `${directory} is up to date (${pluralize(write.unchanged.length, 'file')}).`;
  if (report.upToDate === false) {
    const parts = [
      write.created.length > 0 ? `${write.created.length} missing` : '',
      write.updated.length > 0 ? `${write.updated.length} outdated or edited` : '',
      write.deleted.length > 0 ? `${write.deleted.length} no longer generated` : '',
    ].filter((part) => part !== '');
    return `${directory} is out of date${parts.length === 0 ? ' (its manifest)' : ` (${parts.join(', ')})`}. Run \`${TOOL_NAME} generate\` and commit the result.`;
  }
  if (!report.ok)
    return sentence(
      `the files in ${directory} were written, but errors were reported afterwards (${counts(report.diagnostics)}).`,
    );
  const changes = [
    write.created.length > 0 ? `${write.created.length} created` : '',
    write.updated.length > 0 ? `${write.updated.length} updated` : '',
    write.deleted.length > 0 ? `${write.deleted.length} deleted` : '',
  ].filter((part) => part !== '');
  if (report.changed.length > 0)
    return changes.length === 0
      ? `${prefix}no generated file changed (${ms}).`
      : `${prefix}regenerated ${directory} (${changes.join(', ')}) in ${ms}.`;
  const total = write.created.length + write.updated.length + write.unchanged.length;
  return changes.length === 0
    ? `${directory} is up to date (${pluralize(total, 'file')}, ${ms}).`
    : `Generated ${pluralize(total, 'file')} in ${directory} (${changes.join(', ')}) in ${ms}.`;
}

/** The report's errors and warnings, formatted as the CLI prints them. */
export function formatProblems(
  report: GenerationReport,
  options: { readonly cwd: string; readonly color: boolean },
): { readonly errors: string; readonly warnings: string } {
  const format = (severity: Diagnostic['severity']): string =>
    report.diagnostics
      .filter((diagnostic) => diagnostic.severity === severity)
      .map((diagnostic) => formatDiagnostic(diagnostic, options))
      .join('\n');
  return { errors: format('error'), warnings: format('warning') };
}

/** Prints a report: its warnings, its errors, then the summary line. */
export function logReport(
  report: GenerationReport,
  logger: IntegrationLogger,
  options: { readonly cwd: string; readonly color: boolean },
): void {
  const { errors, warnings } = formatProblems(report, options);
  if (warnings !== '') logger.warn(warnings);
  if (errors !== '') logger.error(errors);
  const summary = summarize(report, options.cwd);
  if (report.ok) logger.info(summary);
  else logger.error(summary);
}

/** Whether the terminal shows colors (honoring `NO_COLOR` and `FORCE_COLOR`). */
export function terminalColors(): boolean {
  return process.stdout.isTTY && process.stdout.hasColors();
}

/** The first located error of a report, for editors and overlays that link to it. */
export function firstLocation(
  report: GenerationReport,
): { readonly file: string; readonly line?: number; readonly column?: number } | undefined {
  for (const diagnostic of report.diagnostics) {
    if (diagnostic.severity !== 'error' || diagnostic.location === undefined) continue;
    const { file, line, column } = diagnostic.location;
    if (isRemote(file) || !path.isAbsolute(file)) continue;
    return {
      file,
      ...(line === undefined ? {} : { line }),
      ...(column === undefined ? {} : { column }),
    };
  }
  return undefined;
}
