import { isRecord } from '../utils/object.ts';

/** Escapes a single JSON pointer reference token (RFC 6901). */
export function escapeSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

export function unescapeSegment(segment: string): string {
  return segment.replaceAll('~1', '/').replaceAll('~0', '~');
}

/** Appends segments to a pointer: `appendPointer('/paths', '/pets')` → `/paths/~1pets`. */
export function appendPointer(pointer: string, ...segments: readonly (string | number)[]): string {
  return segments.reduce<string>(
    (acc, segment) => `${acc}/${escapeSegment(String(segment))}`,
    pointer,
  );
}

/** Splits a pointer (`/a/b`, `#/a/b` or `""`) into unescaped segments. */
export function parsePointer(pointer: string): string[] | undefined {
  let value = pointer.startsWith('#') ? pointer.slice(1) : pointer;
  if (value === '') return [];
  if (!value.startsWith('/')) return undefined;
  try {
    value = decodeURIComponent(value);
  } catch {
    return undefined;
  }
  return value.slice(1).split('/').map(unescapeSegment);
}

export type PointerLookup =
  | { readonly found: true; readonly value: unknown }
  | { readonly found: false };

/** Reads the value at a pointer. Own properties only, so `__proto__` cannot be traversed. */
export function getAtPointer(root: unknown, segments: readonly string[]): PointerLookup {
  let current: unknown = root;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      if (!/^(0|[1-9]\d*)$/.test(segment)) return { found: false };
      const index = Number(segment);
      if (index >= current.length) return { found: false };
      current = current[index];
    } else if (isRecord(current) && Object.hasOwn(current, segment)) {
      current = current[segment];
    } else {
      return { found: false };
    }
  }
  return { found: true, value: current };
}

/** The last segment of a pointer, unescaped. */
export function lastSegment(pointer: string): string | undefined {
  return parsePointer(pointer)?.at(-1);
}
