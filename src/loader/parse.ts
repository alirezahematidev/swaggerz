import {
  isAlias,
  isMap,
  isPair,
  isScalar,
  isSeq,
  LineCounter,
  parseDocument,
  type Alias,
  type Document,
} from 'yaml';
import { setOwn } from '../utils/object.ts';

export type DocumentFormat = 'json' | 'yaml';

export class DocumentParseError extends Error {
  readonly line?: number;
  readonly column?: number;

  constructor(message: string, position?: { line: number; column: number }) {
    super(message);
    this.name = 'DocumentParseError';
    if (position !== undefined) {
      this.line = position.line;
      this.column = position.column;
    }
  }
}

/**
 * Maximum nesting of arrays and objects in a document. Real descriptions stay far below it; deeper
 * documents are rejected right after parsing, so later stages can walk documents recursively.
 */
export const MAX_DOCUMENT_DEPTH = 1000;

/**
 * Values that YAML aliases and merge keys may add to a document: a million, or one per character
 * of longer documents, so aliases cannot make a document much larger than an alias-free document
 * of the same size could be ("billion laughs").
 */
const MIN_ALIAS_EXPANSION = 1_000_000;

/** Determines the format from a file extension, content type or the content itself. */
export function detectFormat(text: string, hint?: string): DocumentFormat {
  const lowerHint = hint?.toLowerCase() ?? '';
  if (lowerHint.endsWith('.json') || lowerHint.includes('application/json')) return 'json';
  if (/\.ya?ml$/.test(lowerHint) || lowerHint.includes('yaml')) return 'yaml';
  const first = text.trimStart()[0];
  return first === '{' || first === '[' ? 'json' : 'yaml';
}

function lineColumnAt(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

const TOO_DEEP = `the document nests arrays and objects more than ${MAX_DOCUMENT_DEPTH} levels deep.`;

/**
 * Parses JSON or YAML into plain data: a tree of arrays, objects (with own properties only, also
 * for keys such as `__proto__`) and primitives, nested at most {@link MAX_DOCUMENT_DEPTH} levels.
 * YAML is parsed with the YAML 1.2 core schema (so `yes`/`no` and dates stay strings) and duplicate
 * keys are rejected. Every alias and merge key becomes a copy of its anchor, so no two places of
 * the result share a node; aliases that contain themselves are rejected and the copies are bounded
 * to prevent "billion laughs" style documents.
 */
export function parseDocumentText(text: string, format: DocumentFormat): unknown {
  if (format === 'json') {
    let data: unknown;
    try {
      data = JSON.parse(text) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const match = /position (\d+)/.exec(message);
      const position = match?.[1] === undefined ? undefined : lineColumnAt(text, Number(match[1]));
      throw new DocumentParseError(`Invalid JSON: ${message}`, position);
    }
    if (exceedsDepth(data)) throw new DocumentParseError(`Invalid JSON: ${TOO_DEEP}`);
    return data;
  }
  return parseYamlText(text);
}

/** Whether arrays and objects nest deeper than {@link MAX_DOCUMENT_DEPTH}, without recursion. */
function exceedsDepth(data: unknown): boolean {
  const stack: [unknown, number][] = [[data, 1]];
  for (let entry = stack.pop(); entry !== undefined; entry = stack.pop()) {
    const [value, depth] = entry;
    if (typeof value !== 'object' || value === null) continue;
    if (depth > MAX_DOCUMENT_DEPTH) return true;
    for (const child of Array.isArray(value) ? value : Object.values(value))
      if (typeof child === 'object' && child !== null) stack.push([child, depth + 1]);
  }
  return false;
}

function parseYamlText(text: string): unknown {
  const lineCounter = new LineCounter();
  let document: Document.Parsed;
  try {
    document = parseDocument(text, {
      schema: 'core',
      merge: true,
      // Checked while converting, in linear time.
      uniqueKeys: false,
      prettyErrors: true,
      lineCounter,
    });
  } catch (error) {
    // The YAML composer recurses once per nesting level.
    const message =
      error instanceof RangeError
        ? TOO_DEEP
        : error instanceof Error
          ? error.message
          : String(error);
    throw new DocumentParseError(`Invalid YAML: ${message}`);
  }
  const [first] = document.errors;
  if (first !== undefined) {
    const position = first.linePos?.[0];
    const message = first.message.startsWith('Maximum call stack size exceeded')
      ? TOO_DEEP
      : (first.message.split('\n')[0] ?? first.message);
    throw new DocumentParseError(
      `Invalid YAML: ${message}`,
      position === undefined ? undefined : { line: position.line, column: position.col },
    );
  }
  const budget = Math.max(MIN_ALIAS_EXPANSION, text.length);
  return new YamlConverter(lineCounter, budget).convert(document.contents);
}

/** A node to convert, and whether it is reached through an alias (and counts as a copy). */
interface Source {
  readonly node: unknown;
  readonly expanded: boolean;
}

interface FrameBase {
  /** The YAML node, while it is on the path of nodes being converted. */
  readonly node: object;
  readonly depth: number;
  readonly expanded: boolean;
  readonly assign: (value: unknown) => void;
  index: number;
}

/** A YAML map (or a single pair in a flow sequence) being converted. */
interface MapFrame extends FrameBase {
  readonly kind: 'map';
  readonly pairs: readonly unknown[];
  readonly target: Record<string, unknown>;
  /** Explicit keys seen so far, to reject duplicates. */
  readonly keys: Set<string>;
  /** The maps a merge key (`<<`) names that are still to be merged. */
  sources: Source[];
}

/** A YAML sequence being converted. */
interface SeqFrame extends FrameBase {
  readonly kind: 'seq';
  readonly items: readonly unknown[];
  readonly target: unknown[];
}

/**
 * Converts a parsed YAML document to plain data without recursion. Anchors are bound in document
 * order (an alias refers to the last anchor of that name before it, as in the YAML library), each
 * alias is converted again where it is used, and the values created for aliases count against a
 * budget. Merge keys follow the YAML 1.1 rules the library implements: keys of the map itself win,
 * then earlier merge sources over later ones.
 */
class YamlConverter {
  readonly #lines: LineCounter;
  readonly #anchors = new Map<string, unknown>();
  readonly #targets = new WeakMap<Alias, unknown>();
  /** Collections being converted, to detect aliases that refer to their own ancestors. */
  readonly #path = new Set<object>();
  readonly #stack: (MapFrame | SeqFrame)[] = [];
  readonly #budget: number;
  #remaining: number;

  constructor(lines: LineCounter, budget: number) {
    this.#lines = lines;
    this.#budget = budget;
    this.#remaining = budget;
  }

  convert(root: unknown): unknown {
    let result: unknown = null;
    this.#value({ node: root, expanded: false }, 0, (value) => {
      result = value;
    });
    for (let frame = this.#stack.at(-1); frame !== undefined; frame = this.#stack.at(-1)) {
      if (frame.kind === 'seq') this.#stepSeq(frame);
      else this.#stepMap(frame);
    }
    return result;
  }

  #fail(message: string, node: unknown): never {
    const offset = rangeStart(node);
    const position = offset === undefined ? undefined : this.#lines.linePos(offset);
    throw new DocumentParseError(
      `Invalid YAML: ${message}`,
      position === undefined ? undefined : { line: position.line, column: position.col },
    );
  }

  /**
   * Follows an alias to its anchored node. Anchors and alias targets are bound where they appear
   * in the text, never inside the copy of an alias, which may contain anchors redefined later.
   */
  #resolve(source: Source): Source {
    const { node, expanded } = source;
    if (!isAlias(node)) {
      if (!expanded && hasAnchor(node)) this.#anchors.set(node.anchor, node);
      return source;
    }
    let target = this.#targets.get(node);
    if (target === undefined) {
      target = this.#anchors.get(node.source);
      if (target === undefined) this.#fail(`unresolved alias *${node.source}.`, node);
      this.#targets.set(node, target);
    }
    if (typeof target === 'object' && target !== null && this.#path.has(target))
      this.#fail(`the alias *${node.source} refers to a node that contains it.`, node);
    return { node: target, expanded: true };
  }

  #count(source: Source, at: unknown): void {
    if (!source.expanded) return;
    this.#remaining--;
    if (this.#remaining < 0)
      this.#fail(
        `aliases and merge keys add more than ${this.#budget} values to the document.`,
        at,
      );
  }

  /** Converts a node: scalars at once, collections through a new frame. */
  #value(raw: Source, parentDepth: number, assign: (value: unknown) => void): void {
    const resolved = this.#resolve(raw);
    this.#count(resolved, raw.node);
    const { node, expanded } = resolved;
    if (node === null || node === undefined) {
      assign(null);
      return;
    }
    if (isScalar(node)) {
      assign(scalarValue(node.value, node.source));
      return;
    }
    const depth = parentDepth + 1;
    if (depth > MAX_DOCUMENT_DEPTH) this.#fail(TOO_DEEP, node);
    if (isMap(node) || isPair(node)) {
      this.#path.add(node);
      this.#stack.push({
        kind: 'map',
        node,
        pairs: isPair(node) ? [node] : node.items,
        target: {},
        keys: new Set(),
        sources: [],
        depth,
        expanded,
        assign,
        index: 0,
      });
    } else if (isSeq(node)) {
      this.#path.add(node);
      this.#stack.push({
        kind: 'seq',
        node,
        items: node.items,
        target: [],
        depth,
        expanded,
        assign,
        index: 0,
      });
    } else {
      this.#fail('unsupported node.', raw.node);
    }
  }

  #complete(frame: MapFrame | SeqFrame): void {
    this.#stack.pop();
    this.#path.delete(frame.node);
    frame.assign(frame.target);
  }

  #stepSeq(frame: SeqFrame): void {
    if (frame.index >= frame.items.length) {
      this.#complete(frame);
      return;
    }
    const item = frame.items[frame.index++];
    const index = frame.target.push(null) - 1;
    this.#value({ node: item, expanded: frame.expanded }, frame.depth, (value) => {
      frame.target[index] = value;
    });
  }

  #stepMap(frame: MapFrame): void {
    const source = frame.sources.shift();
    if (source !== undefined) {
      this.#merge(frame, source);
      return;
    }
    if (frame.index >= frame.pairs.length) {
      this.#complete(frame);
      return;
    }
    const pair = frame.pairs[frame.index++];
    if (!isPair(pair)) this.#fail('unsupported map entry.', frame.node);
    const parent: Source = { node: pair.key, expanded: frame.expanded };
    if (isScalar(pair.key) && typeof pair.key.value === 'symbol') {
      // A merge key: its value is a map or a sequence of maps (each possibly an alias).
      const value = this.#resolve({ node: pair.value, expanded: frame.expanded });
      this.#count(value, pair.value);
      frame.sources = isSeq(value.node)
        ? value.node.items.map((node) => ({ node, expanded: value.expanded }))
        : [{ node: pair.value, expanded: frame.expanded }];
      return;
    }
    const key = this.#key(parent);
    if (frame.keys.has(key)) this.#fail(`map keys must be unique; "${key}" is repeated.`, pair.key);
    frame.keys.add(key);
    // A key of the map itself replaces a merged one and keeps its position.
    setOwn(frame.target, key, null);
    this.#value({ node: pair.value, expanded: frame.expanded }, frame.depth, (value) => {
      setOwn(frame.target, key, value);
    });
  }

  /** Merges one source of a merge key: only keys the map does not have yet are added. */
  #merge(frame: MapFrame, source: Source): void {
    if (!isMap(this.#resolve(source).node))
      this.#fail(
        'merge keys (<<) take a map, an alias of a map or a sequence of them.',
        source.node,
      );
    this.#value(source, frame.depth - 1, (merged) => {
      if (typeof merged !== 'object' || merged === null) return;
      for (const [key, value] of Object.entries(merged))
        if (!Object.hasOwn(frame.target, key)) setOwn(frame.target, key, value);
    });
  }

  /** The property name of a map key: a scalar, or an alias of one. */
  #key(raw: Source): string {
    if (raw.node === null || raw.node === undefined) return '';
    const { node } = this.#resolve(raw);
    if (!isScalar(node))
      this.#fail('map keys must be strings, numbers, booleans or null.', raw.node);
    const value = scalarValue(node.value, node.source);
    return value === null ? '' : String(value);
  }
}

function scalarValue(value: unknown, source: string | undefined): string | number | boolean | null {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return value;
  if (typeof value === 'bigint') return Number(value);
  // Other tagged scalars (`!!binary`, custom tags) keep their text.
  return source ?? '';
}

function hasAnchor(node: unknown): node is { anchor: string } {
  return (
    typeof node === 'object' &&
    node !== null &&
    'anchor' in node &&
    typeof node.anchor === 'string' &&
    node.anchor !== ''
  );
}

function rangeStart(node: unknown): number | undefined {
  if (!isAlias(node) && !isScalar(node) && !isMap(node) && !isSeq(node)) return undefined;
  return node.range?.[0];
}
