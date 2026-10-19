import { isMap, isScalar, isSeq, LineCounter, parseDocument, type Node } from 'yaml';
import type { Diagnostic } from '../diagnostics/types.ts';
import { parsePointer } from './pointer.ts';
import type { DocumentStore, LoadedDocument } from './store.ts';

const MAX_LOCATABLE_BYTES = 25 * 1024 * 1024;

interface PositionIndex {
  readonly contents: Node | null;
  readonly lines: LineCounter;
}

const cache = new WeakMap<LoadedDocument, PositionIndex | null>();

function index(doc: LoadedDocument): PositionIndex | null {
  let entry = cache.get(doc);
  if (entry === undefined) {
    if (doc.text.length > MAX_LOCATABLE_BYTES) {
      entry = null;
    } else {
      const lines = new LineCounter();
      const parsed = parseDocument(doc.text, {
        lineCounter: lines,
        keepSourceTokens: false,
        uniqueKeys: false,
      });
      entry = { contents: parsed.contents, lines };
    }
    cache.set(doc, entry);
  }
  return entry;
}

/**
 * Finds the 1-based line and column of a JSON pointer in a document. The document is re-parsed
 * with position information on first use, so this is only paid for when diagnostics need it.
 */
export function locatePointer(
  doc: LoadedDocument,
  pointer: string,
): { line: number; column: number } | undefined {
  const positions = index(doc);
  const segments = parsePointer(pointer);
  if (positions === null || segments === undefined) return undefined;
  let node: unknown = positions.contents;
  let anchor: Node | undefined = positions.contents ?? undefined;
  for (const segment of segments) {
    if (isMap(node)) {
      const pair = node.items.find(
        (item) => isScalar(item.key) && String(item.key.value) === segment,
      );
      if (pair === undefined) break;
      anchor = isScalar(pair.key) ? pair.key : anchor;
      node = pair.value;
    } else if (isSeq(node)) {
      const item: unknown = node.items[Number(segment)];
      if (item === undefined) break;
      node = item;
      if (isMap(item) || isSeq(item) || isScalar(item)) anchor = item;
    } else {
      break;
    }
  }
  const offset = anchor?.range?.[0];
  if (offset === undefined) return undefined;
  const { line, col } = positions.lines.linePos(offset);
  return { line, column: col };
}

/** Adds line/column information to diagnostics that point into loaded documents. */
export function enrichLocations(
  diagnostics: readonly Diagnostic[],
  store: DocumentStore,
): Diagnostic[] {
  return diagnostics.map((diagnostic) => {
    const loc = diagnostic.location;
    if (loc?.pointer === undefined || loc.line !== undefined) return diagnostic;
    const doc = store.byLocation(loc.file);
    if (doc === undefined) return diagnostic;
    const position = locatePointer(doc, loc.pointer);
    return position === undefined
      ? diagnostic
      : { ...diagnostic, location: { ...loc, ...position } };
  });
}
