import path from 'node:path';
import { RemoteWatcher } from '../loader/remote-watcher.ts';
import { FileWatcher } from '../utils/file-watcher.ts';
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
 * Keeps a {@link ProjectService} in step with its sources: the config file, every local document
 * of the specification, local overlays and the output manifest are watched, remote documents are
 * polled (`spec.fetch.poll`). Reloads never overlap, whether they come from a change or from
 * {@link reload}.
 */
export class ProjectWatcher {
  readonly #service: ProjectService;
  readonly #events: ProjectWatcherEvents;
  #files: FileWatcher | undefined;
  #remote: RemoteWatcher | undefined;
  #queue: Promise<unknown> = Promise.resolve();

  constructor(service: ProjectService, events: ProjectWatcherEvents = {}) {
    this.#service = service;
    this.#events = events;
  }

  /** Starts watching; until then, only {@link reload} reloads. */
  start(): void {
    if (this.#files !== undefined) return;
    this.#files = new FileWatcher({
      debounceMs: 150,
      onChange: async (files) => {
        const output = this.#outputTargets();
        const sources = files.filter((file) => !output.has(file));
        if (sources.length === 0) {
          // The service drops its cached generation status whether or not anyone listens.
          const revision = this.#service.outputChanged();
          this.#events.outputChanged?.(revision);
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
  }

  /** Reloads the project now, after any reload in progress. */
  reload(trigger: ReloadTrigger = 'manual'): Promise<ReloadOutcome> {
    return this.#reload(trigger, []);
  }

  async close(): Promise<void> {
    await Promise.all([this.#files?.close(), this.#remote?.close()]);
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

  /**
   * The output manifest, and the output directory itself: it is watched through its parent, so its
   * creation or removal (a `clean` elsewhere) is noticed even when the platform stops reporting
   * changes inside a removed directory (Windows).
   */
  #outputTargets(): Set<string> {
    const { manifest } = this.#service.watchTargets();
    return new Set([manifest, path.dirname(manifest)]);
  }

  /** Points the watchers at the current sources, which a reload may have changed. */
  #watch(): void {
    if (this.#files === undefined) return;
    const { sources, remote, interval } = this.#service.watchTargets();
    this.#files.set([...sources, ...this.#outputTargets()]);
    this.#remote?.set(remote, interval);
    this.#service.setWatching([...sources, ...remote.map((document) => document.url)]);
  }
}
