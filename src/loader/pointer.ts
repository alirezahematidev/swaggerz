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

/**
 * Splits a JSON pointer (`/a/b` or `""`) into unescaped segments. This is for pointers built with
 * {@link appendPointer} (diagnostics, cursors, resolved references), which are not URI-encoded:
 * `/a%25` names the member `a%25`. Use {@link parseFragment} for the fragment of a `$ref`.
 */
export function parsePointer(pointer: string): string[] | undefined {
  if (pointer === '') return [];
  if (!pointer.startsWith('/')) return undefined;
  return pointer.slice(1).split('/').map(unescapeSegment);
}

/**
 * Decodes the percent-escapes of a URI fragment (without its `#`); `undefined` when one is
 * malformed, such as `%zz`.
 */
export function decodeFragment(fragment: string): string | undefined {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return undefined;
  }
}

/**
 * Splits the fragment of a URI reference (`#/a/b`, `/a/b` or `""`) into unescaped segments. The
 * fragment is URI-encoded (RFC 6901, section 6), so `#/a%25` names the member `a%`. Returns
 * `undefined` when it is not a JSON pointer or contains a malformed percent-escape.
 */
export function parseFragment(fragment: string): string[] | undefined {
  const decoded = decodeFragment(fragment.startsWith('#') ? fragment.slice(1) : fragment);
  return decoded === undefined ? undefined : parsePointer(decoded);
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

/** The last segment of a pointer (see {@link parsePointer}), unescaped. */
export function lastSegment(pointer: string): string | undefined {
  return parsePointer(pointer)?.at(-1);
}
