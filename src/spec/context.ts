import type { DiagnosticBag } from '../diagnostics/bag.ts';
import type { SourceLocation } from '../diagnostics/types.ts';
import type { Extensions, JsonValue, SourceRef } from '../ir/types.ts';
import { appendPointer } from '../loader/pointer.ts';
import type { DocumentStore, LoadedDocument } from '../loader/store.ts';
import { isRecord } from '../utils/object.ts';

/** A raw value together with where it came from. */
export interface Cursor {
  readonly doc: LoadedDocument;
  readonly pointer: string;
  readonly value: unknown;
}

export function child(cursor: Cursor, ...keys: readonly (string | number)[]): Cursor {
  let value: unknown = cursor.value;
  for (const key of keys) {
    if (Array.isArray(value) && typeof key === 'number') value = value[key];
    else if (isRecord(value) && Object.hasOwn(value, String(key))) value = value[String(key)];
    else value = undefined;
  }
  return { doc: cursor.doc, pointer: appendPointer(cursor.pointer, ...keys), value };
}

/** Child cursors of an object cursor, in declaration order. */
export function entries(cursor: Cursor): [string, Cursor][] {
  if (!isRecord(cursor.value)) return [];
  return Object.keys(cursor.value).map((key) => [key, child(cursor, key)]);
}

export function keysOf(cursor: Cursor): string[] {
  return isRecord(cursor.value) ? Object.keys(cursor.value) : [];
}

export function items(cursor: Cursor): Cursor[] {
  return Array.isArray(cursor.value) ? cursor.value.map((_, index) => child(cursor, index)) : [];
}

export function str(cursor: Cursor, key: string): string | undefined {
  const value = isRecord(cursor.value) ? cursor.value[key] : undefined;
  return typeof value === 'string' ? value : undefined;
}

export function bool(cursor: Cursor, key: string): boolean | undefined {
  const value = isRecord(cursor.value) ? cursor.value[key] : undefined;
  return typeof value === 'boolean' ? value : undefined;
}

export function num(cursor: Cursor, key: string): number | undefined {
  const value = isRecord(cursor.value) ? cursor.value[key] : undefined;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function has(cursor: Cursor, key: string): boolean {
  return (
    isRecord(cursor.value) && Object.hasOwn(cursor.value, key) && cursor.value[key] !== undefined
  );
}

export function toJsonValue(value: unknown): JsonValue | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    return value.map((entry) => toJsonValue(entry) ?? null);
  }
  if (isRecord(value)) {
    const result: Record<string, JsonValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      const converted = toJsonValue(entry);
      if (converted !== undefined) result[key] = converted;
    }
    return result;
  }
  return undefined;
}

export function readExtensions(cursor: Cursor): Extensions {
  if (!isRecord(cursor.value)) return {};
  const result: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(cursor.value)) {
    if (!key.startsWith('x-')) continue;
    const converted = toJsonValue(value);
    if (converted !== undefined) result[key] = converted;
  }
  return result;
}

const REF_CHAIN_LIMIT = 64;

/** Shared state for one normalization run. */
export class ParseContext {
  readonly store: DocumentStore;
  readonly diagnostics: DiagnosticBag;

  constructor(store: DocumentStore, diagnostics: DiagnosticBag) {
    this.store = store;
    this.diagnostics = diagnostics;
  }

  get root(): Cursor {
    return { doc: this.store.root, pointer: '', value: this.store.root.data };
  }

  /** Loaded documents: the root first, then the others sorted by path. */
  sources(): string[] {
    const root = this.store.root.display;
    const others = this.store.documents
      .map((doc) => doc.display)
      .filter((display) => display !== root);
    return [root, ...others.sort()];
  }

  sourceRef(cursor: Cursor): SourceRef {
    return { file: cursor.doc.display, pointer: cursor.pointer };
  }

  location(cursor: Cursor): SourceLocation {
    return { file: cursor.doc.location, pointer: cursor.pointer };
  }

  error(
    code: string,
    message: string,
    at: Cursor,
    extra: { hint?: string; operation?: string } = {},
  ): void {
    this.diagnostics.error({ code, message, location: this.location(at), ...extra });
  }

  warning(
    code: string,
    message: string,
    at: Cursor,
    extra: { hint?: string; operation?: string } = {},
  ): void {
    this.diagnostics.warning({ code, message, location: this.location(at), ...extra });
  }

  info(
    code: string,
    message: string,
    at: Cursor,
    extra: { hint?: string; operation?: string } = {},
  ): void {
    this.diagnostics.info({ code, message, location: this.location(at), ...extra });
  }

  /**
   * Follows a `$ref` where the specification does not allow one but tools commonly accept it
   * (Operation Objects in descriptions split into files), noting it with `spec/non-standard-ref`.
   */
  derefNonStandard(cursor: Cursor, what: string): Cursor | undefined {
    if (!isRecord(cursor.value) || typeof cursor.value.$ref !== 'string') return cursor;
    this.info(
      'spec/non-standard-ref',
      `${what} cannot be a $ref according to the specification; the reference is followed.`,
      cursor,
    );
    return this.deref(cursor);
  }

  /**
   * Follows `$ref` chains for non-schema objects (parameters, responses, request bodies, path
   * items, headers, examples, security schemes). Returns `undefined` when a reference is broken
   * (already reported) or circular.
   */
  deref(cursor: Cursor): Cursor | undefined {
    let current = cursor;
    const seen = new Set<string>();
    for (let depth = 0; depth < REF_CHAIN_LIMIT; depth++) {
      const value = current.value;
      if (!isRecord(value) || typeof value.$ref !== 'string') return current;
      const key = `${current.doc.url}#${current.pointer}`;
      if (seen.has(key)) {
        this.error('ref/circular', `Circular $ref chain detected at "${value.$ref}".`, current);
        return undefined;
      }
      seen.add(key);
      const resolved = this.store.resolve(value.$ref, current.doc, current.pointer);
      if (resolved === undefined) return undefined;
      current = { doc: resolved.doc, pointer: resolved.pointer, value: resolved.value };
    }
    this.error('ref/too-deep', 'Reference chain is too deep.', cursor);
    return undefined;
  }
}
