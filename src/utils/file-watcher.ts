import { existsSync, watch, type FSWatcher } from 'node:fs';
import path from 'node:path';

/**
 * File systems on Windows and macOS are usually case-insensitive: a path from the config may
 * differ in case from the name the platform watcher reports.
 */
const caseInsensitive = process.platform === 'win32' || process.platform === 'darwin';
const fold = (file: string): string => (caseInsensitive ? file.toLowerCase() : file);

export interface FileWatcherOptions {
  /**
   * Called with the changed files (sorted) once no further change arrived for `debounceMs`. Calls
   * never overlap: changes that arrive while a call runs are delivered in the next call.
   */
  readonly onChange: (files: readonly string[]) => Promise<void> | void;
  /** A directory could not be watched, or `onChange` threw. Watching continues. */
  readonly onError?: (directory: string, error: unknown) => void;
  readonly debounceMs?: number;
}

/**
 * Watches a set of files. Directories are watched rather than files, so editors that save by
 * replacing a file are handled. A file whose directory does not exist yet (an output directory
 * before the first generation) is watched through its nearest existing ancestor and picked up once
 * the directory appears.
 */
export class FileWatcher {
  readonly #options: FileWatcherOptions;
  readonly #watchers = new Map<string, FSWatcher>();
  #targets = new Set<string>();
  #pending = new Set<string>();
  #timer: ReturnType<typeof setTimeout> | undefined;
  #running: Promise<void> | undefined;
  #closed = false;

  constructor(options: FileWatcherOptions) {
    this.#options = options;
  }

  get targets(): ReadonlySet<string> {
    return this.#targets;
  }

  /** Replaces the watched files (absolute paths). */
  set(files: Iterable<string>): void {
    if (this.#closed) return;
    this.#targets = new Set([...files].map((file) => path.resolve(file)));
    this.#sync();
  }

  /** Stops watching and waits for a running `onChange` call to finish. */
  async close(): Promise<void> {
    this.#closed = true;
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;
    for (const watcher of this.#watchers.values()) watcher.close();
    this.#watchers.clear();
    await this.#running;
  }

  /** The directory to watch for `file`: its own directory, or the nearest one that exists. */
  #watchPoint(file: string): string {
    let directory = path.dirname(file);
    while (!existsSync(directory)) {
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
    return directory;
  }

  #sync(): void {
    const directories = new Set([...this.#targets].map((file) => this.#watchPoint(file)));
    for (const [directory, watcher] of this.#watchers) {
      if (!directories.has(directory)) {
        watcher.close();
        this.#watchers.delete(directory);
      }
    }
    for (const directory of directories) {
      if (this.#watchers.has(directory)) continue;
      try {
        const watcher = watch(directory, (_event, name) => {
          this.#onEvent(directory, name);
        });
        watcher.on('error', (error) => {
          watcher.close();
          this.#watchers.delete(directory);
          this.#options.onError?.(directory, error);
        });
        this.#watchers.set(directory, watcher);
      } catch (error) {
        this.#options.onError?.(directory, error);
      }
    }
  }

  #onEvent(directory: string, name: string | null): void {
    if (this.#closed) return;
    const changed = name === null ? undefined : fold(path.join(directory, name));
    for (const target of this.#targets) {
      const folded = fold(target);
      // The file itself, a directory on the way to it (created or removed), or an unnamed event.
      if (
        changed === undefined
          ? fold(path.dirname(target)) === fold(directory)
          : folded === changed || folded.startsWith(`${changed}${path.sep}`)
      ) {
        this.#pending.add(target);
      }
    }
    if (this.#pending.size > 0) this.#schedule();
  }

  #schedule(): void {
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      this.#flush();
    }, this.#options.debounceMs ?? 120);
  }

  #flush(): void {
    if (this.#closed || this.#running !== undefined || this.#pending.size === 0) return;
    const files = [...this.#pending].sort();
    this.#pending.clear();
    // Directories may have appeared or disappeared (for example a first output directory).
    this.#sync();
    this.#running = (async () => {
      try {
        await this.#options.onChange(files);
      } catch (error) {
        this.#options.onError?.(path.dirname(files[0] ?? ''), error);
      }
    })().finally(() => {
      this.#running = undefined;
      if (this.#pending.size > 0) this.#schedule();
    });
  }
}
