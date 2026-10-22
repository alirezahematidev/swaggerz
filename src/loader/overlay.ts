import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DiagnosticBag } from '../diagnostics/bag.ts';
import type { Diagnostic } from '../diagnostics/types.ts';
import { isRecord } from '../utils/object.ts';
import { fetchText } from './fetch.ts';
import {
  JsonPathError,
  normalizedPath,
  parseJsonPath,
  queryJsonPath,
  type JsonPathNode,
} from './jsonpath.ts';
import { locatePointer } from './locate.ts';
import { DocumentParseError, detectFormat, parseDocumentText } from './parse.ts';
import { parseFragment } from './pointer.ts';
import type { LoadedDocument } from './store.ts';

/**
 * OpenAPI Overlays (Overlay Specification 1.0, 1.1 and 1.2): documents of ordered actions that
 * update, copy or remove the nodes a JSONPath (RFC 9535) query selects. They are applied to the
 * root document after it is loaded and before anything else reads it, so a third-party
 * specification can be fixed without forking it. Actions follow the 1.1 rules for every version
 * (arrays are concatenated, primitives can be targeted), which only clarified 1.0.
 */

export interface OverlayOptions {
  /** Absolute paths or `http(s)` URLs, applied in order. */
  readonly overlays: readonly string[];
  readonly fetch: {
    readonly headers: Readonly<Record<string, string>>;
    readonly timeout: number;
    readonly maxBytes: number;
  };
  /** Origin of a remote specification: configured headers are only sent there. */
  readonly credentialOrigin?: string;
  readonly diagnostics: DiagnosticBag;
  /**
   * Receives every array of the result that elements were removed from: positions inside it no
   * longer match the text of the document.
   */
  readonly shifted?: WeakSet<object>;
}

/** The newest Overlay Specification minor version whose features are implemented. */
const SUPPORTED_MINOR = 2;

/**
 * Applies the configured overlays to a parsed document and returns the patched copy (the input is
 * not modified). Problems are reported as `overlay/*` diagnostics; actions that fail are skipped.
 */
export async function applyOverlays(document: unknown, options: OverlayOptions): Promise<unknown> {
  let result = structuredClone(document);
  const shifted = options.shifted ?? new WeakSet<object>();
  for (const location of options.overlays) {
    const overlay = await loadOverlay(location, options);
    if (overlay !== undefined)
      result = new OverlayRun(overlay, options.diagnostics, shifted).apply(result);
  }
  return result;
}

async function loadOverlay(
  location: string,
  options: OverlayOptions,
): Promise<LoadedDocument | undefined> {
  const remote = /^https?:\/\//i.test(location);
  try {
    let text: string;
    let hint: string;
    if (remote) {
      const fetched = await fetchText(new URL(location), {
        ...options.fetch,
        credentialOrigin: options.credentialOrigin,
        checkRedirect: (next) =>
          next.protocol === 'https:' || next.protocol === 'http:'
            ? undefined
            : 'unsupported protocol',
      });
      text = fetched.text;
      hint = `${fetched.contentType} ${fetched.url.pathname}`;
    } else {
      text = await readFile(location, 'utf8');
      hint = location;
    }
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const format = detectFormat(text, hint);
    const data = parseDocumentText(text, format);
    const url = remote ? location : pathToFileURL(location).href;
    return {
      url,
      display: remote ? location : path.basename(location),
      location,
      format,
      text,
      data,
    };
  } catch (error) {
    options.diagnostics.add(loadFailure(error, location));
    return undefined;
  }
}

function loadFailure(error: unknown, location: string): Diagnostic {
  if (error instanceof DocumentParseError) {
    return {
      code: 'overlay/load-failed',
      severity: 'error',
      message: `Overlay ${location} could not be parsed: ${error.message}`,
      location: {
        file: location,
        ...(error.line === undefined ? {} : { line: error.line }),
        ...(error.column === undefined ? {} : { column: error.column }),
      },
    };
  }
  const missing = isRecord(error) && error.code === 'ENOENT';
  return {
    code: 'overlay/load-failed',
    severity: 'error',
    message: missing
      ? `Overlay not found: ${location}`
      : `Overlay ${location} could not be read: ${error instanceof Error ? error.message : String(error)}`,
    location: { file: location },
    hint: 'spec.overlays paths are relative to the config file.',
  };
}

type Path = readonly (string | number)[];

/** Raised while merging; carries the location inside the target document. */
class MergeError extends Error {}

class OverlayRun {
  readonly #overlay: LoadedDocument;
  readonly #diagnostics: DiagnosticBag;
  readonly #shifted: WeakSet<object>;

  constructor(overlay: LoadedDocument, diagnostics: DiagnosticBag, shifted: WeakSet<object>) {
    this.#overlay = overlay;
    this.#diagnostics = diagnostics;
    this.#shifted = shifted;
  }

  #report(
    severity: 'error' | 'warning' | 'info',
    code: string,
    message: string,
    pointer: string,
    hint?: string,
  ): void {
    const position = locatePointer(this.#overlay, pointer);
    this.#diagnostics.add({
      code,
      severity,
      message,
      location: {
        file: this.#overlay.location,
        pointer,
        ...(position === undefined ? {} : position),
      },
      ...(hint === undefined ? {} : { hint }),
    });
  }

  apply(document: unknown): unknown {
    const overlay = this.#overlay.data;
    const name = this.#overlay.display;
    if (!isRecord(overlay)) {
      this.#report('error', 'overlay/invalid', `Overlay ${name} is not an object.`, '');
      return document;
    }
    const version =
      typeof overlay.overlay === 'string' ? /^(\d+)\.(\d+)\.\d+/.exec(overlay.overlay) : null;
    if (version === null) {
      this.#report(
        'error',
        'overlay/unsupported-version',
        `Overlay ${name} has no valid \`overlay\` version (e.g. "1.1.0").`,
        '/overlay',
      );
      return document;
    }
    if (version[1] !== '1') {
      this.#report(
        'error',
        'overlay/unsupported-version',
        `Overlay ${name} uses Overlay Specification ${String(overlay.overlay)}; versions 1.0 to 1.${SUPPORTED_MINOR} are supported.`,
        '/overlay',
      );
      return document;
    }
    if (Number(version[2]) > SUPPORTED_MINOR) {
      this.#report(
        'warning',
        'overlay/unsupported-version',
        `Overlay ${name} uses Overlay Specification ${String(overlay.overlay)}, newer than the supported 1.${SUPPORTED_MINOR}; it is applied with the 1.${SUPPORTED_MINOR} rules.`,
        '/overlay',
      );
    }
    if (!isRecord(overlay.info) || typeof overlay.info.title !== 'string') {
      this.#report(
        'warning',
        'overlay/invalid',
        `Overlay ${name} has no \`info\` object with a \`title\` and \`version\`.`,
        '/info',
      );
    }
    const actions = overlay.actions;
    if (!Array.isArray(actions) || actions.length === 0) {
      this.#report(
        'error',
        'overlay/invalid',
        `Overlay ${name} needs a non-empty \`actions\` array.`,
        '/actions',
      );
      return document;
    }
    const components =
      isRecord(overlay.components) && isRecord(overlay.components.actions)
        ? overlay.components.actions
        : {};
    // The root is wrapped so that removing or replacing a top-level node works like any other.
    const holder: { root: unknown } = { root: document };
    let applied = 0;
    actions.forEach((entry, index) => {
      if (this.#action(entry, `/actions/${index}`, holder, components)) applied++;
    });
    this.#report(
      'info',
      'overlay/applied',
      `Applied ${applied} of ${actions.length} overlay action${actions.length === 1 ? '' : 's'} from ${name}.`,
      '/actions',
    );
    return holder.root;
  }

  /** Applies one action; returns whether it changed the document. */
  #action(
    entry: unknown,
    pointer: string,
    holder: { root: unknown },
    components: Record<string, unknown>,
  ): boolean {
    if (!isRecord(entry)) {
      this.#report('error', 'overlay/invalid', 'An overlay action must be an object.', pointer);
      return false;
    }
    const action = this.#resolveReference(entry, pointer, components);
    if (action === undefined) return false;
    if (typeof action.target !== 'string') {
      this.#report(
        'error',
        'overlay/invalid',
        'An overlay action needs a `target` JSONPath.',
        `${pointer}/target`,
      );
      return false;
    }
    const targets = this.#query(holder.root, action.target, `${pointer}/target`);
    if (targets === undefined) return false;
    if (targets.length === 0) {
      this.#report(
        'warning',
        'overlay/no-match',
        `Overlay target ${action.target} matches nothing; the action changes nothing.`,
        `${pointer}/target`,
        'The specification may have changed since the overlay was written.',
      );
      return false;
    }
    if (action.remove === true) {
      if (targets.some((node) => node.path.length === 0)) {
        this.#report(
          'error',
          'overlay/invalid',
          'An overlay action cannot remove the whole document (`$`).',
          `${pointer}/target`,
        );
        return false;
      }
      this.#remove(holder, targets);
      return true;
    }
    let value: unknown;
    let source: string;
    if (action.update !== undefined) {
      value = action.update;
      source = `${pointer}/update`;
    } else if (typeof action.copy === 'string') {
      const copied = this.#query(holder.root, action.copy, `${pointer}/copy`);
      if (copied === undefined) return false;
      if (copied.length !== 1) {
        this.#report(
          'error',
          'overlay/invalid-copy',
          `Overlay copy source ${action.copy} must select exactly one node; it selects ${copied.length}.`,
          `${pointer}/copy`,
        );
        return false;
      }
      value = copied[0]?.value;
      source = `${pointer}/copy`;
    } else {
      this.#report(
        'warning',
        'overlay/invalid',
        'This overlay action has no `update`, `copy` or `remove: true`; it changes nothing.',
        pointer,
      );
      return false;
    }
    try {
      for (const node of distinctTargets(holder, targets))
        mergeAt(holder, node, structuredClone(value));
    } catch (error) {
      if (!(error instanceof MergeError)) throw error;
      this.#report('error', 'overlay/incompatible-update', error.message, source);
      return false;
    }
    return true;
  }

  /**
   * Removes the selected nodes. Every parent is looked up before anything is removed, each member
   * is removed once even when several paths lead to it, and array elements from the last, so the
   * indices of the others stay valid.
   */
  #remove(holder: { root: unknown }, targets: readonly JsonPathNode[]): void {
    const removals = new Map<object, Set<string | number>>();
    for (const node of targets) {
      const { parent, key } = parentOf(holder, node.path);
      if (!Array.isArray(parent) && !isRecord(parent)) continue;
      const keys = removals.get(parent) ?? new Set<string | number>();
      keys.add(key);
      removals.set(parent, keys);
    }
    for (const [parent, keys] of removals) {
      if (Array.isArray(parent)) {
        const indices = [...keys].filter((key) => typeof key === 'number').sort((a, b) => b - a);
        for (const index of indices) parent.splice(index, 1);
        // Positions of the remaining elements in the document's text are no longer valid.
        if (indices.length > 0) this.#shifted.add(parent);
      } else if (isRecord(parent)) {
        for (const key of keys) if (typeof key === 'string') delete parent[key];
      }
    }
  }

  /** Overlay 1.2 Reusable Action Reference Objects: `{ $ref: '#/components/actions/x', target }`. */
  #resolveReference(
    entry: Record<string, unknown>,
    pointer: string,
    components: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (entry.$ref === undefined) return entry;
    const segments =
      typeof entry.$ref === 'string' && entry.$ref.startsWith('#')
        ? parseFragment(entry.$ref)
        : undefined;
    const name =
      segments?.length === 3 && segments[0] === 'components' && segments[1] === 'actions'
        ? segments[2]
        : undefined;
    // Own entries only: `#/components/actions/__proto__` must not reach Object.prototype.
    const reusable =
      name === undefined || !Object.hasOwn(components, name) ? undefined : components[name];
    if (!isRecord(reusable)) {
      this.#report(
        'error',
        'overlay/invalid-reference',
        `Overlay action reference ${JSON.stringify(entry.$ref)} does not point to an entry of components.actions.`,
        `${pointer}/$ref`,
      );
      return undefined;
    }
    const fields = isRecord(reusable.fields) ? reusable.fields : {};
    // Fields of the reference itself (its `target`, a `description`) take precedence.
    const overrides = Object.fromEntries(Object.entries(entry).filter(([key]) => key !== '$ref'));
    return { ...fields, ...overrides };
  }

  #query(root: unknown, expression: string, pointer: string): JsonPathNode[] | undefined {
    try {
      const nodes = queryJsonPath(root, parseJsonPath(expression));
      // A query may select the same node twice (`$['a','a']`); each node changes once.
      const seen = new Set<string>();
      return nodes.filter((node) => {
        const key = normalizedPath(node.path);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } catch (error) {
      if (!(error instanceof JsonPathError)) throw error;
      this.#report(
        'error',
        'overlay/invalid-target',
        `Invalid JSONPath ${expression}: ${error.message}`,
        pointer,
        "Overlays use RFC 9535 JSONPath: member names with special characters need brackets, e.g. $.paths['/pets'].",
      );
      return undefined;
    }
  }
}

/**
 * The selected nodes, each once: an object or array reached through several paths is merged into
 * once, and so is a primitive in the same member of the same parent.
 */
function distinctTargets(
  holder: { root: unknown },
  targets: readonly JsonPathNode[],
): JsonPathNode[] {
  const containers = new Set<object>();
  const slots = new Map<unknown, Set<string | number>>();
  return targets.filter((node) => {
    if (typeof node.value === 'object' && node.value !== null) {
      if (containers.has(node.value)) return false;
      containers.add(node.value);
      return true;
    }
    const { parent, key } = parentOf(holder, node.path);
    const keys = slots.get(parent) ?? new Set<string | number>();
    if (keys.has(key)) return false;
    keys.add(key);
    slots.set(parent, keys);
    return true;
  });
}

const isPrimitive = (value: unknown): boolean => value === null || typeof value !== 'object';

/** Sets an own property, which also works for keys such as `__proto__`. */
function define(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

function parentOf(
  holder: { root: unknown },
  trail: Path,
): { parent: unknown; key: string | number } {
  let parent: unknown = holder;
  let key: string | number = 'root';
  for (const segment of trail) {
    parent =
      Array.isArray(parent) || isRecord(parent)
        ? (parent as Record<string | number, unknown>)[key]
        : undefined;
    key = segment;
  }
  return { parent, key };
}

function describe(value: unknown): string {
  return value === null
    ? 'null'
    : Array.isArray(value)
      ? 'an array'
      : typeof value === 'object'
        ? 'an object'
        : `a ${typeof value}`;
}

/** Merges `value` into the node at `node.path` with the Overlay update rules. */
function mergeAt(holder: { root: unknown }, node: JsonPathNode, value: unknown): void {
  const current = node.value;
  const where = normalizedPath(node.path);
  if (Array.isArray(current)) {
    // Arrays are concatenated; any other value is appended as one element.
    if (Array.isArray(value)) current.push(...(value as unknown[]));
    else current.push(value);
    return;
  }
  if (isRecord(current)) {
    if (!isRecord(value))
      throw new MergeError(
        `${where} is an object; the update must be an object, not ${describe(value)}.`,
      );
    mergeObject(current, value, where);
    return;
  }
  if (!isPrimitive(value))
    throw new MergeError(
      `${where} is ${describe(current)}; the update must be a primitive value, not ${describe(value)}.`,
    );
  const { parent, key } = parentOf(holder, node.path);
  if (Array.isArray(parent) && typeof key === 'number') parent[key] = value;
  else if (isRecord(parent) && typeof key === 'string') define(parent, key, value);
}

function mergeObject(
  target: Record<string, unknown>,
  update: Record<string, unknown>,
  where: string,
): void {
  for (const [key, value] of Object.entries(update)) {
    if (!Object.hasOwn(target, key)) {
      define(target, key, value);
      continue;
    }
    const existing = target[key];
    const at = `${where}${normalizedPath([key]).slice(1)}`;
    if (isPrimitive(existing) && isPrimitive(value)) define(target, key, value);
    else if (Array.isArray(existing) && Array.isArray(value))
      existing.push(...(value as unknown[]));
    else if (isRecord(existing) && isRecord(value)) mergeObject(existing, value, at);
    else
      throw new MergeError(
        `${at} is ${describe(existing)} and cannot be merged with ${describe(value)}; remove it in an earlier action first.`,
      );
  }
}
