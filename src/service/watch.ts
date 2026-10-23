import { existsSync, watch, type FSWatcher } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { RemoteWatcher } from '../loader/remote-watcher.ts';
import { FileWatcher, type FileWatcherOptions } from '../utils/file-watcher.ts';
import type { ProjectService, ReloadOutcome } from './project.ts';
import type { ReloadTrigger } from './types.ts';

export interface ProjectWatcherEvents {
  /** The project was reloaded (after a change, or on request). */
  readonly reloaded?: (outcome: ReloadOutcome, trigger: ReloadTrigger) => void;
  /** Only the output directory changed (a generation): the generation status is stale. */
  readonly outputChanged?: (revision: number) => void;
  /** A polled remote document became unreachable, or reachable again. */
  readonly remote?: (event: {
    readonly revision: number;
    readonly url: string;
    readonly reachable: boolean;
    readonly error?: string;
  }) => void;
}

/**
 * How often the output manifest is checked in addition to file events, which do not always arrive:
 * Windows reports nothing when another process removes a watched output directory (`clean`).
 */
const MANIFEST_CHECK_MS = 2000;

/** Changes inside the output directory (a generation writes many files) are reported together. */
const OUTPUT_DEBOUNCE_MS = 300;

export interface ProjectWatcherOptions {
  /** How often the output manifest is checked besides file events (milliseconds). */
  readonly manifestCheckMs?: number;
  /**
   * Creates the platform file watchers (`fs.watch`; replaced in tests). The output directory is
   * watched with it too, recursively.
   */
  readonly watch?: FileWatcherOptions['watch'];
}

/**
 * Keeps a {@link ProjectService} in step with its sources: the config file, every local document
 * of the specification, local overlays and the output manifest are watched, remote documents are
 * polled (`spec.fetch.poll`). Reloads never overlap, whether they come from a change or from
 * {@link reload}.
 */
export class ProjectWatcher {
  readonly #service: ProjectService;
  readonly #events: ProjectWatcherEvents;
  readonly #options: ProjectWatcherOptions;
  #files: FileWatcher | undefined;
  #remote: RemoteWatcher | undefined;
  #queue: Promise<unknown> = Promise.resolve();
  #manifestTimer: ReturnType<typeof setInterval> | undefined;
  /** The output manifest's path, size and modification time when it was last looked at. */
  #manifest: Promise<string> | undefined;
  /** Watches the generated files, so a hand edit makes the generation status stale. */
  #output: { readonly directory: string; readonly watcher: FSWatcher } | undefined;
  #outputTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    service: ProjectService,
    events: ProjectWatcherEvents = {},
    options: ProjectWatcherOptions = {},
  ) {
    this.#service = service;
    this.#events = events;
    this.#options = options;
  }

  /** Starts watching; until then, only {@link reload} reloads. */
  start(): void {
    if (this.#files !== undefined) return;
    this.#files = new FileWatcher({
      debounceMs: 150,
      ...(this.#options.watch === undefined ? {} : { watch: this.#options.watch }),
      onChange: async (files) => {
        const { manifest } = this.#service.watchTargets();
        const sources = files.filter((file) => file !== manifest);
        if (sources.length === 0) {
          this.#outputChanged();
          return;
        }
        await this.#reload('watch', sources);
      },
    });
    this.#remote = new RemoteWatcher({
      onChange: async (urls) => {
        await this.#reload('watch', urls);
      },
      onError: (url, error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.#events.remote?.({
          revision: this.#service.remoteFailed(url, message),
          url,
          reachable: false,
          error: message,
        });
      },
      onRecover: (url) => {
        this.#events.remote?.({
          revision: this.#service.remoteRecovered(url),
          url,
          reachable: true,
        });
      },
    });
    this.#watch();
    this.#manifest = this.#manifestState();
    this.#manifestTimer = setInterval(() => {
      void this.#checkManifest();
    }, this.#options.manifestCheckMs ?? MANIFEST_CHECK_MS);
    // The check never keeps the process alive on its own.
    this.#manifestTimer.unref();
    this.#watchOutput();
  }

  /** Reloads the project now, after any reload in progress. */
  reload(trigger: ReloadTrigger = 'manual'): Promise<ReloadOutcome> {
    return this.#reload(trigger, []);
  }

  async close(): Promise<void> {
    if (this.#manifestTimer !== undefined) clearInterval(this.#manifestTimer);
    this.#manifestTimer = undefined;
    if (this.#outputTimer !== undefined) clearTimeout(this.#outputTimer);
    this.#outputTimer = undefined;
    this.#output?.watcher.close();
    this.#output = undefined;
    await Promise.all([this.#files?.close(), this.#remote?.close()]);
  }

  /** The output changed: the service drops its cached generation status. */
  #outputChanged(): void {
    this.#manifest = this.#manifestState();
    this.#watchOutput();
    const revision = this.#service.outputChanged();
    this.#events.outputChanged?.(revision);
  }

  /**
   * Watches the output directory (recursively) while it exists, so changes to generated files,
   * hand edits included, are noticed and not only changes to the manifest.
   */
  #watchOutput(): void {
    if (this.#manifestTimer === undefined) return;
    const directory = path.dirname(this.#service.watchTargets().manifest);
    if (this.#output?.directory === directory) return;
    this.#output?.watcher.close();
    this.#output = undefined;
    if (!existsSync(directory)) return;
    try {
      const listener = (): void => {
        if (this.#outputTimer !== undefined) clearTimeout(this.#outputTimer);
        this.#outputTimer = setTimeout(() => {
          this.#outputTimer = undefined;
          this.#outputChanged();
        }, OUTPUT_DEBOUNCE_MS);
      };
      const watcher =
        this.#options.watch?.(directory, listener) ??
        watch(directory, { recursive: true }, listener);
      watcher.on('error', () => {
        // Removed (or no longer readable): the manifest check watches it again when it is back.
        watcher.close();
        if (this.#output?.watcher === watcher) this.#output = undefined;
      });
      this.#output = { directory, watcher };
    } catch {
      // Not watchable right now; the manifest check tries again.
    }
  }

  async #manifestState(): Promise<string> {
    const { manifest } = this.#service.watchTargets();
    try {
      const info = await stat(manifest);
      return `${manifest}\n${info.size}\n${info.mtimeMs}`;
    } catch {
      return `${manifest}\nmissing`;
    }
  }

  /** Compares the manifest with the last state seen, for changes no file event reported. */
  async #checkManifest(): Promise<void> {
    const previous = this.#manifest;
    if (previous === undefined) return;
    const [before, now] = await Promise.all([previous, this.#manifestState()]);
    // A file event (or a check) that ran meanwhile already handled it.
    if (this.#manifestTimer === undefined || this.#manifest !== previous) return;
    if (now !== before) {
      this.#outputChanged();
      return;
    }
    // The output directory may have been created or removed without the manifest changing.
    const directory = path.dirname(this.#service.watchTargets().manifest);
    if ((this.#output === undefined) === existsSync(directory)) this.#watchOutput();
  }

  #reload(trigger: ReloadTrigger, changed: readonly string[]): Promise<ReloadOutcome> {
    const next = this.#queue.then(async () => {
      const outcome = await this.#service.reload(trigger, changed);
      this.#watch();
      this.#events.reloaded?.(outcome, trigger);
      return outcome;
    });
    this.#queue = next.catch(() => undefined);
    return next;
  }

  /** Points the watchers at the current sources, which a reload may have changed. */
  #watch(): void {
    if (this.#files === undefined) return;
    const { sources, manifest, remote, interval } = this.#service.watchTargets();
    this.#files.set([...sources, manifest]);
    this.#remote?.set(remote, interval);
    // The output directory may have moved (a changed config).
    this.#watchOutput();
    this.#service.setWatching([...sources, ...remote.map((document) => document.url)]);
  }
}
