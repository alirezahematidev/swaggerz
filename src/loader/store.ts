import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SwaggerzError, type DiagnosticBag } from '../diagnostics/bag.ts';
import type { Diagnostic } from '../diagnostics/types.ts';
import { isRecord } from '../utils/object.ts';
import { fetchText, type FetchTextOptions, type Validators } from './fetch.ts';
import {
  DocumentParseError,
  detectFormat,
  parseDocumentText,
  type DocumentFormat,
} from './parse.ts';
import { appendPointer, getAtPointer, parsePointer } from './pointer.ts';
import { collectRefs } from './refs.ts';

export interface LoadedDocument {
  /** Canonical URL without fragment (`file://` or `http(s)://`). */
  readonly url: string;
  /** Path relative to the root document directory, or a URL for remote documents. */
  readonly display: string;
  /** Absolute file path or URL, for diagnostics. */
  readonly location: string;
  readonly format: DocumentFormat;
  readonly text: string;
  readonly data: unknown;
  /** Remote documents: HTTP cache validators, used when polling for changes. */
  readonly validators?: Validators;
}

export interface ResolvedRef {
  readonly doc: LoadedDocument;
  /** JSON pointer of the target inside `doc` (always starts with `/` or is empty). */
  readonly pointer: string;
  readonly value: unknown;
}

export interface RefPolicy {
  readonly external: 'none' | 'local' | 'remote';
  readonly allowedDirectories: readonly string[];
  readonly allowedHosts: readonly string[];
}

export interface DocumentStoreOptions {
  readonly policy: RefPolicy;
  readonly fetch: {
    readonly headers: Readonly<Record<string, string>>;
    readonly timeout: number;
    readonly maxBytes: number;
  };
  readonly diagnostics: DiagnosticBag;
  /** Maximum number of documents that may be loaded (`spec.refs.maxDocuments`). */
  readonly maxDocuments: number;
}

/**
 * Fetch options for a remote document under the store's policy. Configured headers (which may
 * carry credentials) only go to the origin of the root document; the root may redirect anywhere,
 * other documents only to their own origin or an allowed host.
 */
export function documentFetchOptions(
  options: Pick<DocumentStoreOptions, 'fetch' | 'policy'>,
  url: URL,
  root: { readonly isRoot: true } | { readonly isRoot: false; readonly origin: string | undefined },
): FetchTextOptions {
  return {
    ...options.fetch,
    credentialOrigin: root.isRoot ? url.origin : root.origin,
    checkRedirect: (next) => {
      if (next.protocol !== 'https:' && next.protocol !== 'http:') return 'unsupported protocol';
      if (root.isRoot || next.origin === url.origin) return undefined;
      return hostAllowed(next.hostname, options.policy.allowedHosts)
        ? undefined
        : 'host not allowed';
    },
  };
}

/** Documents read or fetched at the same time. */
const LOAD_CONCURRENCY = 32;

/** Maps items with at most `limit` calls running at once; results keep the input order. */
async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const stripHash = (url: URL): string => {
  const copy = new URL(url.href);
  copy.hash = '';
  return copy.href;
};

/**
 * Loads the root document and every external document it references (subject to the reference
 * policy), and resolves `$ref` values across documents.
 */
export class DocumentStore {
  readonly #options: DocumentStoreOptions;
  readonly #documents = new Map<string, LoadedDocument>();
  readonly #failed = new Set<string>();
  readonly #anchors = new Map<string, Map<string, string>>();
  readonly #ids = new Map<string, { doc: LoadedDocument; pointer: string }>();
  /** Per document: pointer of each schema with an `$id` → its resolved base URI. */
  readonly #bases = new Map<string, Map<string, string>>();
  /** OpenAPI 3.2 `$self`: document URL → the base URI it declares. */
  readonly #selfBases = new Map<string, string>();
  /** Other URIs that identify a loaded document (`$self`, or the URI a reference used). */
  readonly #aliases = new Map<string, LoadedDocument>();
  #schemaIds = false;
  #self = false;
  #root: LoadedDocument | undefined;
  #rootBase = '';
  #allowedRealDirs: string[] | undefined;

  constructor(options: DocumentStoreOptions) {
    this.#options = options;
  }

  get root(): LoadedDocument {
    if (this.#root === undefined) throw new Error('Root document not loaded');
    return this.#root;
  }

  get documents(): readonly LoadedDocument[] {
    return [...this.#documents.values()];
  }

  byDisplay(display: string): LoadedDocument | undefined {
    return this.documents.find((doc) => doc.display === display);
  }

  byLocation(location: string): LoadedDocument | undefined {
    return this.documents.find((doc) => doc.location === location);
  }

  /** Loads the configured input. Throws {@link SwaggerzError} if it cannot be read or parsed. */
  async loadRoot(input: string): Promise<LoadedDocument> {
    const url = /^https?:\/\//i.test(input) ? new URL(input) : pathToFileURL(path.resolve(input));
    this.#rootBase = url.protocol === 'file:' ? path.dirname(fileURLToPath(url)) : url.href;
    try {
      const doc = await this.#read(url, true);
      this.#root = doc;
      this.#documents.set(doc.url, doc);
      return doc;
    } catch (error) {
      throw new SwaggerzError(`Unable to load specification ${input}`, [
        loadFailure(error, url.protocol === 'file:' ? fileURLToPath(url) : url.href),
      ]);
    }
  }

  /**
   * Enables JSON Schema 2020-12 base URIs (OpenAPI 3.1): `$id` values resolve against the
   * enclosing schema's base, and `$ref` values against the nearest enclosing `$id`.
   */
  enableSchemaIds(): void {
    this.#schemaIds = true;
    this.#ids.clear();
    this.#bases.clear();
  }

  /**
   * Enables OpenAPI 3.2 `$self`: a document's `$self` is its base URI and identifies it, so
   * references resolved against it reach the document without fetching. A reference to a
   * document next to it is fetched next to where the referencing document was read.
   */
  enableSelf(): void {
    this.#self = true;
    for (const doc of this.documents) this.#indexSelf(doc);
  }

  #indexSelf(doc: LoadedDocument): void {
    if (!this.#self || !isRecord(doc.data) || typeof doc.data.$self !== 'string') return;
    try {
      const base = stripHash(new URL(doc.data.$self, doc.url));
      this.#selfBases.set(doc.url, base);
      if (!this.#aliases.has(base)) this.#aliases.set(base, doc);
    } catch {
      // An invalid $self cannot be used as a base; the retrieval URL stays the base.
    }
  }

  /** The URI relative references of a document resolve against: `$self`, else its URL. */
  #documentBase(doc: LoadedDocument): string {
    return this.#selfBases.get(doc.url) ?? doc.url;
  }

  /** A document by its URL or by another URI that identifies it. */
  #document(url: string): LoadedDocument | undefined {
    return this.#documents.get(url) ?? this.#aliases.get(url);
  }

  /**
   * Where to read a document a reference identifies. A target next to the referencing document's
   * `$self` is read at the same relative location next to that document's retrieval URL.
   */
  #retrievalUrl(target: URL, from: LoadedDocument): URL {
    const self = this.#selfBases.get(from.url);
    if (self === undefined) return target;
    const directory = new URL('.', self).href;
    if (!target.href.startsWith(directory)) return target;
    return new URL(target.href.slice(directory.length), new URL('.', from.url));
  }

  /** Replaces the parsed root data (used by `beforeParse` plugin hooks). */
  replaceRootData(data: unknown): void {
    const root = this.root;
    const updated: LoadedDocument = { ...root, data };
    this.#root = updated;
    this.#documents.set(root.url, updated);
    this.#anchors.delete(root.url);
    this.#bases.delete(root.url);
    this.#ids.clear();
  }

  /**
   * Loads all documents reachable through `$ref`s and validates every reference target. Documents
   * are loaded breadth-first, a whole level at a time with bounded concurrency, and registered in
   * a deterministic (sorted) order.
   */
  async loadReferencedDocuments(): Promise<void> {
    const max = this.#options.maxDocuments;
    let level: LoadedDocument[] = [this.root];
    let limitReported = false;
    while (level.length > 0) {
      const pending = new Map<string, { from: LoadedDocument; pointer: string; target: URL }>();
      for (const doc of level) {
        for (const occurrence of collectRefs(doc.data)) {
          const target = this.#parseRef(occurrence.ref, doc, occurrence.pointer);
          if (target === undefined) continue;
          const docUrl = stripHash(target);
          if (
            docUrl === doc.url ||
            this.#document(docUrl) !== undefined ||
            this.#failed.has(docUrl)
          )
            continue;
          // A schema resource (`$id`) of a loaded document; nothing to fetch.
          if (this.#findById(docUrl) !== undefined) continue;
          if (!pending.has(docUrl))
            pending.set(docUrl, { from: doc, pointer: occurrence.pointer, target });
        }
      }
      const ordered = [...pending.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      const room = Math.max(0, max - this.#documents.size);
      for (const [docUrl, request] of ordered.slice(room)) {
        this.#failed.add(docUrl);
        if (limitReported) continue;
        limitReported = true;
        this.#options.diagnostics.error({
          code: 'ref/too-many-documents',
          message: `Reference resolution stopped after loading ${max} documents; ${ordered.length - room} more ${ordered.length - room === 1 ? 'is' : 'are'} referenced at this depth alone.`,
          location: { file: request.from.location, pointer: request.pointer },
          hint: 'Raise spec.refs.maxDocuments if the description really consists of that many files.',
        });
      }
      const loaded = await mapLimit(
        ordered.slice(0, room),
        LOAD_CONCURRENCY,
        async ([docUrl, request]) => {
          const document = await this.#loadExternal(request.target, request.from, request.pointer);
          return document === undefined ? undefined : { docUrl, document };
        },
      );
      const next: LoadedDocument[] = [];
      for (const item of loaded) {
        if (item === undefined) continue;
        const { docUrl, document } = item;
        // The same document reached through another URI (a `$self`-relative reference).
        const existing = this.#documents.get(document.url);
        if (existing !== undefined) {
          this.#aliases.set(docUrl, existing);
          continue;
        }
        this.#documents.set(document.url, document);
        if (docUrl !== document.url) this.#aliases.set(docUrl, document);
        this.#indexSelf(document);
        this.#indexIds(document);
        next.push(document);
      }
      level = next;
    }
    // Report every broken reference target once, even for parts of the spec no operation uses.
    for (const doc of this.documents) {
      for (const occurrence of collectRefs(doc.data)) {
        if (occurrence.mapping === true) continue;
        this.resolve(occurrence.ref, doc, occurrence.pointer);
      }
    }
  }

  /** Resolves a `$ref` relative to `from`. Reports a diagnostic and returns `undefined` on failure. */
  resolve(ref: string, from: LoadedDocument, refPointer: string): ResolvedRef | undefined {
    const target = this.#parseRef(ref, from, refPointer);
    if (target === undefined) return undefined;
    const docUrl = stripHash(target);
    let doc = docUrl === from.url ? from : this.#document(docUrl);
    let basePointer = '';
    if (doc === undefined) {
      const byId = this.#findById(docUrl);
      if (byId !== undefined) {
        doc = byId.doc;
        basePointer = byId.pointer;
      }
    }
    if (doc === undefined) {
      if (!this.#failed.has(docUrl)) {
        this.#options.diagnostics.error({
          code: 'ref/unresolved',
          message: `Cannot resolve $ref "${ref}": document ${docUrl} was not loaded.`,
          location: { file: from.location, pointer: refPointer },
        });
      }
      return undefined;
    }
    const fragment = target.hash.startsWith('#') ? target.hash.slice(1) : target.hash;
    let pointer: string | undefined;
    if (fragment === '' || fragment.startsWith('/') || fragment.startsWith('%2F')) {
      const segments = parsePointer(fragment);
      if (segments === undefined) {
        this.#reportInvalid(ref, from, refPointer, 'the fragment is not a valid JSON pointer');
        return undefined;
      }
      pointer = appendPointer(basePointer, ...segments);
    } else {
      pointer = this.#anchorIndex(doc).get(decodeURIComponent(fragment));
      if (pointer === undefined) {
        this.#options.diagnostics.error({
          code: 'ref/missing-target',
          message: `$ref "${ref}" points to anchor "${fragment}", which does not exist in ${doc.display}.`,
          location: { file: from.location, pointer: refPointer },
        });
        return undefined;
      }
    }
    const lookup = getAtPointer(doc.data, parsePointer(pointer) ?? []);
    if (!lookup.found) {
      this.#options.diagnostics.error({
        code: 'ref/missing-target',
        message: `$ref "${ref}" points to "${pointer || '/'}", which does not exist in ${doc.display}.`,
        location: { file: from.location, pointer: refPointer },
      });
      return undefined;
    }
    return { doc, pointer, value: lookup.value };
  }

  /** Stable identifier of a document for schema ids: empty for the root document. */
  documentKey(doc: LoadedDocument): string {
    return doc.url === this.root.url ? '' : doc.display;
  }

  #parseRef(ref: string, from: LoadedDocument, refPointer: string): URL | undefined {
    if (ref.trim() === '') {
      this.#reportInvalid(ref, from, refPointer, 'the reference is empty');
      return undefined;
    }
    try {
      return new URL(ref, this.#baseFor(from, refPointer));
    } catch {
      this.#reportInvalid(ref, from, refPointer, 'the reference is not a valid URI');
      return undefined;
    }
  }

  #reportInvalid(ref: string, from: LoadedDocument, refPointer: string, reason: string): void {
    this.#options.diagnostics.error({
      code: 'ref/invalid',
      message: `Invalid $ref "${ref}": ${reason}.`,
      location: { file: from.location, pointer: refPointer },
    });
  }

  async #loadExternal(
    reference: URL,
    from: LoadedDocument,
    refPointer: string,
  ): Promise<LoadedDocument | undefined> {
    const target = this.#retrievalUrl(reference, from);
    const docUrl = stripHash(target);
    const refusal = await this.#checkPolicy(target, from);
    if (refusal !== undefined) {
      this.#failed.add(docUrl);
      this.#options.diagnostics.error({
        code: 'ref/external-blocked',
        message: `External reference to ${docUrl} was blocked: ${refusal.reason}`,
        location: { file: from.location, pointer: refPointer },
        hint: refusal.hint,
      });
      return undefined;
    }
    try {
      return await this.#read(new URL(docUrl), false);
    } catch (error) {
      this.#failed.add(docUrl);
      const failure = loadFailure(
        error,
        target.protocol === 'file:' ? fileURLToPath(target) : docUrl,
      );
      this.#options.diagnostics.add({
        ...failure,
        code: 'ref/external-load-failed',
        message: `Failed to load referenced document: ${failure.message}`,
        location:
          failure.location?.line === undefined
            ? { file: from.location, pointer: refPointer }
            : failure.location,
      });
      return undefined;
    }
  }

  async #checkPolicy(
    target: URL,
    from: LoadedDocument,
  ): Promise<{ reason: string; hint: string } | undefined> {
    const { policy } = this.#options;
    if (
      target.protocol !== 'file:' &&
      target.protocol !== 'http:' &&
      target.protocol !== 'https:'
    ) {
      return {
        reason: `the ${target.protocol} protocol is not supported.`,
        hint: 'Use a relative path or an http(s) URL.',
      };
    }
    if (policy.external === 'none') {
      return {
        reason: 'external references are disabled (spec.refs.external = "none").',
        hint: 'Set spec.refs.external to "local" or "remote" to allow external documents.',
      };
    }
    const fromRemote = !from.url.startsWith('file:');
    if (target.protocol === 'file:') {
      if (fromRemote) {
        return {
          reason: 'a remote document may not reference local files.',
          hint: 'Download the documents locally if they are trusted.',
        };
      }
      const filePath = fileURLToPath(target);
      let real: string;
      try {
        real = await realpath(filePath);
      } catch {
        real = path.resolve(filePath);
      }
      const allowed = await this.#allowedDirectories();
      if (!allowed.some((dir) => real === dir || real.startsWith(dir + path.sep))) {
        return {
          reason: `${filePath} is outside the allowed directories.`,
          hint: `Add its directory to spec.refs.allowedDirectories (currently: ${allowed.join(', ')}).`,
        };
      }
      return undefined;
    }
    if (rootOrigin(this.root) === target.origin) return undefined;
    if (policy.external !== 'remote') {
      return {
        reason: 'remote references are disabled (spec.refs.external = "local").',
        hint: `Set spec.refs.external to "remote" and add "${target.host}" to spec.refs.allowedHosts.`,
      };
    }
    if (!hostAllowed(target.hostname, policy.allowedHosts)) {
      return {
        reason: `host "${target.hostname}" is not in spec.refs.allowedHosts.`,
        hint: `Add "${target.hostname}" to spec.refs.allowedHosts if it is trusted.`,
      };
    }
    return undefined;
  }

  async #allowedDirectories(): Promise<string[]> {
    if (this.#allowedRealDirs === undefined) {
      this.#allowedRealDirs = await Promise.all(
        this.#options.policy.allowedDirectories.map(async (dir) => {
          try {
            return await realpath(dir);
          } catch {
            return path.resolve(dir);
          }
        }),
      );
    }
    return this.#allowedRealDirs;
  }

  async #read(url: URL, isRoot: boolean): Promise<LoadedDocument> {
    let text: string;
    let hint: string;
    let finalUrl = url;
    let validators: Validators | undefined;
    if (url.protocol === 'file:') {
      const file = fileURLToPath(url);
      text = await readFile(file, 'utf8');
      hint = file;
    } else {
      const fetched = await fetchText(url, this.fetchOptions(url, isRoot));
      text = fetched.text;
      hint = `${fetched.contentType} ${fetched.url.pathname}`;
      finalUrl = fetched.url;
      validators = fetched.validators;
    }
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const format = detectFormat(text, hint);
    const data = parseDocumentText(text, format);
    const canonical = stripHash(finalUrl);
    const location = finalUrl.protocol === 'file:' ? fileURLToPath(finalUrl) : canonical;
    return {
      url: canonical,
      display: this.#display(finalUrl),
      location,
      format,
      text,
      data,
      ...(validators === undefined ? {} : { validators }),
    };
  }

  /** Fetch options for a remote document of this store (see {@link documentFetchOptions}). */
  fetchOptions(
    url: URL,
    isRoot = this.#root === undefined || stripHash(url) === this.#root.url,
  ): FetchTextOptions {
    return documentFetchOptions(
      this.#options,
      url,
      isRoot
        ? { isRoot: true }
        : { isRoot: false, origin: this.#root === undefined ? undefined : rootOrigin(this.#root) },
    );
  }

  #display(url: URL): string {
    if (url.protocol === 'file:' && !this.#rootBase.includes('://')) {
      return path.relative(this.#rootBase, fileURLToPath(url)).split(path.sep).join('/');
    }
    return stripHash(url);
  }

  #anchorIndex(doc: LoadedDocument): Map<string, string> {
    let index = this.#anchors.get(doc.url);
    if (index === undefined) {
      index = new Map();
      walkSchemas(doc.data, '', (node, pointer) => {
        if (typeof node.$anchor === 'string') index?.set(node.$anchor, pointer);
      });
      this.#anchors.set(doc.url, index);
    }
    return index;
  }

  /** Base URIs of the schema resources (`$id`) of a document. */
  #baseIndex(doc: LoadedDocument): Map<string, string> {
    let index = this.#bases.get(doc.url);
    if (index !== undefined) return index;
    const bases = new Map<string, string>();
    const visit = (node: unknown, pointer: string, base: string): void => {
      if (Array.isArray(node)) {
        node.forEach((child, i) => {
          visit(child, appendPointer(pointer, i), base);
        });
        return;
      }
      if (!isRecord(node)) return;
      let current = base;
      if (typeof node.$id === 'string') {
        try {
          current = new URL(node.$id, base).href;
          bases.set(pointer, current);
        } catch {
          // Ignore invalid $id values; they cannot be referenced.
        }
      }
      for (const [key, child] of Object.entries(node)) {
        if (SCHEMA_DATA_KEYS.has(key)) continue;
        visit(child, appendPointer(pointer, key), current);
      }
    };
    visit(doc.data, '', this.#documentBase(doc));
    index = bases;
    this.#bases.set(doc.url, index);
    return index;
  }

  /** The base URI `$ref` values at `pointer` resolve against. */
  #baseFor(doc: LoadedDocument, pointer: string): string {
    if (!this.#schemaIds) return this.#documentBase(doc);
    const index = this.#baseIndex(doc);
    for (let current = pointer; ; current = current.slice(0, current.lastIndexOf('/'))) {
      const base = index.get(current);
      if (base !== undefined) return base;
      if (current === '') return this.#documentBase(doc);
    }
  }

  #indexIds(doc: LoadedDocument): void {
    if (this.#schemaIds) {
      for (const [pointer, base] of this.#baseIndex(doc)) {
        const id = stripHash(new URL(base));
        if (!this.#ids.has(id)) this.#ids.set(id, { doc, pointer });
      }
      return;
    }
    walkSchemas(doc.data, '', (node, pointer) => {
      if (typeof node.$id !== 'string') return;
      try {
        const id = stripHash(new URL(node.$id, doc.url));
        if (!this.#ids.has(id)) this.#ids.set(id, { doc, pointer });
      } catch {
        // Ignore invalid $id values; they cannot be referenced.
      }
    });
  }

  #findById(url: string): { doc: LoadedDocument; pointer: string } | undefined {
    if (this.#ids.size === 0 && this.#root !== undefined) this.#indexIds(this.#root);
    return this.#ids.get(url);
  }
}

function rootOrigin(doc: LoadedDocument): string | undefined {
  return doc.url.startsWith('file:') ? undefined : new URL(doc.url).origin;
}

function hostAllowed(hostname: string, allowedHosts: readonly string[]): boolean {
  return allowedHosts.some((pattern) =>
    pattern.startsWith('*.') ? hostname.endsWith(pattern.slice(1)) : hostname === pattern,
  );
}

/** Keys whose values are instance data, not schemas. */
const SCHEMA_DATA_KEYS: ReadonlySet<string> = new Set([
  'example',
  'examples',
  'default',
  'enum',
  'const',
]);

function walkSchemas(
  node: unknown,
  pointer: string,
  visit: (node: Record<string, unknown>, pointer: string) => void,
): void {
  if (Array.isArray(node)) {
    node.forEach((child, index) => {
      walkSchemas(child, appendPointer(pointer, index), visit);
    });
    return;
  }
  if (!isRecord(node)) return;
  visit(node, pointer);
  for (const [key, child] of Object.entries(node)) {
    if (SCHEMA_DATA_KEYS.has(key)) continue;
    walkSchemas(child, appendPointer(pointer, key), visit);
  }
}

function loadFailure(error: unknown, file: string): Diagnostic {
  if (error instanceof DocumentParseError) {
    return {
      code: 'spec/parse-error',
      severity: 'error',
      message: error.message,
      location: {
        file,
        ...(error.line === undefined ? {} : { line: error.line }),
        ...(error.column === undefined ? {} : { column: error.column }),
      },
    };
  }
  const code = isRecord(error) && typeof error.code === 'string' ? error.code : undefined;
  const message =
    code === 'ENOENT'
      ? `File not found: ${file}`
      : `Could not read ${file}: ${error instanceof Error ? error.message : String(error)}`;
  return { code: 'spec/load-failed', severity: 'error', message, location: { file } };
}
