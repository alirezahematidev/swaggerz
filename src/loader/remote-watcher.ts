import { createHash } from 'node:crypto';
import type { ResolvedConfig } from '../config/resolved.ts';
import { isLoopback } from '../utils/net.ts';
import { fetchTextIfModified, type FetchTextOptions, type Validators } from './fetch.ts';
import { documentFetchOptions, type DocumentStore } from './store.ts';

/** A remote document to poll for changes. */
export interface PolledDocument {
  readonly url: string;
  /** The text that was loaded; `undefined` when it never loaded, so any response is a change. */
  readonly text?: string;
  readonly validators?: Validators;
  /** Same policy as loading it: credentials, redirects, timeout and size limit. */
  readonly fetch: FetchTextOptions;
}

export interface RemoteWatcherOptions {
  /**
   * Called with the documents (URLs, sorted) whose content changed. Calls never overlap; polling
   * resumes after it returns.
   */
  readonly onChange: (urls: readonly string[]) => Promise<void> | void;
  /** A document could not be fetched. Reported once until it can be fetched again. */
  readonly onError?: (url: string, error: unknown) => void;
  /** A document that could not be fetched is available again. */
  readonly onRecover?: (url: string) => void;
}

interface Entry {
  hash: string | undefined;
  validators: Validators;
  fetch: FetchTextOptions;
  failing: boolean;
}

function hashText(text: string): string {
  return createHash('sha256')
    .update(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
    .digest('hex');
}

/**
 * Polls remote documents with conditional requests (`If-None-Match`, `If-Modified-Since`) and
 * reports documents whose content changed. Servers without validators are compared by content,
 * so an unchanged document never triggers a reload. The counterpart of `FileWatcher` for URLs.
 */
export class RemoteWatcher {
  readonly #options: RemoteWatcherOptions;
  #entries = new Map<string, Entry>();
  #interval = 2000;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #running: Promise<void> | undefined;
  #closed = false;

  constructor(options: RemoteWatcherOptions) {
    this.#options = options;
  }

  /** The polled URLs, sorted. */
  get urls(): readonly string[] {
    return [...this.#entries.keys()].sort();
  }

  /**
   * Replaces the polled documents and the interval (milliseconds between the end of one round of
   * requests and the start of the next). Documents that are already polled keep the last content
   * the watcher saw, so a reload that fails does not report the same change again.
   */
  set(documents: readonly PolledDocument[], interval: number): void {
    if (this.#closed) return;
    this.#interval = interval;
    const next = new Map<string, Entry>();
    for (const document of documents) {
      const existing = this.#entries.get(document.url);
      next.set(
        document.url,
        existing === undefined
          ? {
              hash: document.text === undefined ? undefined : hashText(document.text),
              validators: document.validators ?? {},
              fetch: document.fetch,
              failing: false,
            }
          : { ...existing, fetch: document.fetch },
      );
    }
    this.#entries = next;
    if (next.size === 0) {
      if (this.#timer !== undefined) clearTimeout(this.#timer);
      this.#timer = undefined;
    } else if (this.#timer === undefined && this.#running === undefined) {
      this.#schedule();
    }
  }

  /** Stops polling and waits for a running round to finish. */
  async close(): Promise<void> {
    this.#closed = true;
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;
    await this.#running;
  }

  #schedule(): void {
    if (this.#closed) return;
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      this.#running = this.#poll().finally(() => {
        this.#running = undefined;
        if (this.#entries.size > 0 && this.#timer === undefined) this.#schedule();
      });
    }, this.#interval);
    // Polling alone never keeps the process alive.
    this.#timer.unref();
  }

  async #poll(): Promise<void> {
    const changed: string[] = [];
    await Promise.all(
      [...this.#entries].map(async ([url, entry]) => {
        try {
          const fetched = await fetchTextIfModified(new URL(url), entry.fetch, entry.validators);
          if (entry.failing) {
            entry.failing = false;
            this.#options.onRecover?.(url);
          }
          if (fetched === undefined) return;
          entry.validators = fetched.validators;
          const hash = hashText(fetched.text);
          if (hash === entry.hash) return;
          entry.hash = hash;
          changed.push(url);
        } catch (error) {
          if (entry.failing) return;
          entry.failing = true;
          this.#options.onError?.(url, error);
        }
      }),
    );
    if (changed.length === 0 || this.#closed) return;
    try {
      await this.#options.onChange(changed.sort());
    } catch (error) {
      this.#options.onError?.(changed[0] ?? '', error);
    }
  }
}

/** How remote documents are polled: hosts and interval (`spec.fetch.poll`). */
export function pollsUrl(config: ResolvedConfig, url: string): boolean {
  const { hosts } = config.spec.fetch.poll;
  if (hosts === 'none' || !/^https?:\/\//i.test(url)) return false;
  return hosts === 'all' || isLoopback(new URL(url).hostname);
}

/**
 * The remote documents to poll after a compilation: every `http(s)` document of the store, or the
 * configured input alone when it could not be loaded (so a server that comes up later is noticed).
 */
export function polledDocuments(
  config: ResolvedConfig,
  store: DocumentStore | undefined,
): PolledDocument[] {
  const loaded = store?.documents ?? [];
  let documents: PolledDocument[] = [];
  if (store !== undefined && loaded.length > 0) {
    documents = loaded
      .filter((doc) => /^https?:/.test(doc.url))
      .map((doc) => ({
        url: doc.url,
        text: doc.text,
        ...(doc.validators === undefined ? {} : { validators: doc.validators }),
        fetch: store.fetchOptions(new URL(doc.url)),
      }));
  } else if (/^https?:\/\//i.test(config.spec.input)) {
    const url = new URL(config.spec.input);
    const policy = { fetch: config.spec.fetch, policy: config.spec.refs };
    documents = [{ url: url.href, fetch: documentFetchOptions(policy, url, { isRoot: true }) }];
  }
  return documents.filter((doc) => pollsUrl(config, doc.url));
}
