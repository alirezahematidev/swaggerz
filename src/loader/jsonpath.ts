import { isRecord } from '../utils/object.ts';

/**
 * JSONPath (RFC 9535) for OpenAPI Overlays: a parser and an evaluator that returns every selected
 * node with its location, so actions can change or remove it. Filter expressions, the five
 * standard functions (`length`, `count`, `match`, `search`, `value`) and their well-typedness
 * rules are supported; regular expressions are I-Regexp (RFC 9485) run by the JavaScript engine.
 */

/** A selected node: its value and the member names or indices leading to it from the root. */
export interface JsonPathNode {
  readonly value: unknown;
  readonly path: readonly (string | number)[];
}

export class JsonPathError extends Error {
  /** 0-based offset in the expression. */
  readonly offset: number;

  constructor(message: string, offset: number) {
    super(`${message} (at character ${offset + 1})`);
    this.name = 'JsonPathError';
    this.offset = offset;
  }
}

// AST ---------------------------------------------------------------------------------------

type Selector =
  | { readonly kind: 'name'; readonly name: string }
  | { readonly kind: 'wildcard' }
  | { readonly kind: 'index'; readonly index: number }
  | {
      readonly kind: 'slice';
      readonly start?: number;
      readonly end?: number;
      readonly step?: number;
    }
  | { readonly kind: 'filter'; readonly expression: LogicalExpr };

interface Segment {
  readonly descendant: boolean;
  readonly selectors: readonly Selector[];
}

interface Query {
  readonly root: '$' | '@';
  readonly segments: readonly Segment[];
}

type Comparable =
  | { readonly kind: 'literal'; readonly value: unknown }
  | { readonly kind: 'query'; readonly query: Query }
  | FunctionCall;

interface FunctionCall {
  readonly kind: 'function';
  readonly name: FunctionName;
  readonly args: readonly FunctionArgument[];
}

type FunctionArgument =
  | { readonly kind: 'literal'; readonly value: unknown }
  | { readonly kind: 'query'; readonly query: Query }
  | { readonly kind: 'logical'; readonly expression: LogicalExpr }
  | FunctionCall;

type LogicalExpr =
  | { readonly kind: 'or' | 'and'; readonly operands: readonly LogicalExpr[] }
  | { readonly kind: 'not'; readonly operand: LogicalExpr }
  | {
      readonly kind: 'compare';
      readonly op: ComparisonOp;
      readonly left: Comparable;
      readonly right: Comparable;
    }
  | { readonly kind: 'exists'; readonly query: Query }
  | { readonly kind: 'test'; readonly call: FunctionCall };

type ComparisonOp = '==' | '!=' | '<' | '<=' | '>' | '>=';
type FunctionName = 'length' | 'count' | 'match' | 'search' | 'value';

/** The declared result type of each function extension (RFC 9535, section 2.4). */
const FUNCTION_RESULTS: Readonly<Record<FunctionName, 'value' | 'logical'>> = {
  length: 'value',
  count: 'value',
  match: 'logical',
  search: 'logical',
  value: 'value',
};

const FUNCTION_PARAMETERS: Readonly<Record<FunctionName, readonly ('value' | 'nodes')[]>> = {
  length: ['value'],
  count: ['nodes'],
  match: ['value', 'value'],
  search: ['value', 'value'],
  value: ['nodes'],
};

const MAX_SAFE = Number.MAX_SAFE_INTEGER;

// Parser ------------------------------------------------------------------------------------

class Parser {
  readonly #text: string;
  #position = 0;

  constructor(text: string) {
    this.#text = text;
  }

  parse(): Query {
    if (this.#peek() !== '$')
      throw new JsonPathError('A JSONPath query starts with `$`', this.#position);
    const query = this.#query();
    if (this.#position < this.#text.length)
      throw new JsonPathError(`Unexpected "${this.#peek()}"`, this.#position);
    return query;
  }

  #peek(offset = 0): string {
    return this.#text[this.#position + offset] ?? '';
  }

  #startsWith(token: string): boolean {
    return this.#text.startsWith(token, this.#position);
  }

  #fail(message: string): never {
    throw new JsonPathError(message, this.#position);
  }

  #expect(token: string): void {
    if (!this.#startsWith(token)) this.#fail(`Expected "${token}"`);
    this.#position += token.length;
  }

  /** Blank space: space, tab, line feed and carriage return. */
  #skipSpace(): void {
    while (/[ \t\n\r]/.test(this.#peek())) this.#position++;
  }

  /** `$` or `@` followed by segments. */
  #query(): Query {
    const root = this.#peek() as '$' | '@';
    this.#position++;
    const segments: Segment[] = [];
    for (;;) {
      // Blank space may separate segments, but must not swallow what follows the query.
      const before = this.#position;
      this.#skipSpace();
      if (this.#startsWith('..')) {
        this.#position += 2;
        segments.push({ descendant: true, selectors: this.#descendantSelectors() });
      } else if (this.#peek() === '.') {
        this.#position++;
        segments.push({ descendant: false, selectors: [this.#dotSelector()] });
      } else if (this.#peek() === '[') {
        segments.push({ descendant: false, selectors: this.#bracketed() });
      } else {
        this.#position = before;
        return { root, segments };
      }
    }
  }

  #descendantSelectors(): Selector[] {
    if (this.#peek() === '[') return this.#bracketed();
    return [this.#dotSelector()];
  }

  /** `*` or a member name shorthand after `.` or `..`. */
  #dotSelector(): Selector {
    if (this.#peek() === '*') {
      this.#position++;
      return { kind: 'wildcard' };
    }
    const match =
      /^[A-Za-z_\u{80}-\u{D7FF}\u{E000}-\u{10FFFF}][\w\u{80}-\u{D7FF}\u{E000}-\u{10FFFF}]*/u.exec(
        this.#text.slice(this.#position),
      );
    if (match === null) this.#fail('Expected a member name or `*`');
    this.#position += match[0].length;
    return { kind: 'name', name: match[0] };
  }

  #bracketed(): Selector[] {
    this.#expect('[');
    const selectors: Selector[] = [];
    for (;;) {
      this.#skipSpace();
      selectors.push(this.#selector());
      this.#skipSpace();
      if (this.#peek() === ',') {
        this.#position++;
        continue;
      }
      this.#expect(']');
      return selectors;
    }
  }

  #selector(): Selector {
    const char = this.#peek();
    if (char === "'" || char === '"') return { kind: 'name', name: this.#string() };
    if (char === '*') {
      this.#position++;
      return { kind: 'wildcard' };
    }
    if (char === '?') {
      this.#position++;
      this.#skipSpace();
      return { kind: 'filter', expression: this.#logicalOr() };
    }
    // An index or a slice.
    const start = this.#peek() === ':' ? undefined : this.#integer();
    this.#skipSpace();
    if (this.#peek() !== ':') {
      if (start === undefined) this.#fail('Expected a selector');
      return { kind: 'index', index: start };
    }
    this.#position++;
    this.#skipSpace();
    const end = /[-0-9]/.test(this.#peek()) ? this.#integer() : undefined;
    this.#skipSpace();
    let step: number | undefined;
    if (this.#peek() === ':') {
      this.#position++;
      this.#skipSpace();
      step = /[-0-9]/.test(this.#peek()) ? this.#integer() : undefined;
    }
    return {
      kind: 'slice',
      ...(start === undefined ? {} : { start }),
      ...(end === undefined ? {} : { end }),
      ...(step === undefined ? {} : { step }),
    };
  }

  /** An integer within the I-JSON range, without leading zeros (`-0` is not allowed). */
  #integer(): number {
    const match = /^(0|-?[1-9][0-9]*)/.exec(this.#text.slice(this.#position));
    if (match === null) this.#fail('Expected an integer');
    const value = Number(match[0]);
    if (Math.abs(value) > MAX_SAFE) this.#fail('Integer out of range');
    this.#position += match[0].length;
    return value;
  }

  /** A single- or double-quoted string literal with JSON-style escapes. */
  #string(): string {
    const quote = this.#peek();
    this.#position++;
    let result = '';
    for (;;) {
      const char = this.#peek();
      if (char === '') this.#fail('Unterminated string');
      this.#position++;
      if (char === quote) return result;
      if (char === '\\') {
        result += this.#escape(quote);
        continue;
      }
      const code = char.charCodeAt(0);
      if (code < 0x20) this.#fail('Control characters must be escaped in strings');
      result += char;
    }
  }

  #escape(quote: string): string {
    const char = this.#peek();
    this.#position++;
    const simple: Record<string, string> = {
      b: '\b',
      f: '\f',
      n: '\n',
      r: '\r',
      t: '\t',
      '/': '/',
      '\\': '\\',
    };
    if (char === quote) return quote;
    const mapped = simple[char];
    if (mapped !== undefined) return mapped;
    if (char !== 'u') this.#fail(`Invalid escape "\\${char}"`);
    const unit = (): number => {
      const hex = this.#text.slice(this.#position, this.#position + 4);
      if (!/^[0-9A-Fa-f]{4}$/.test(hex)) this.#fail('Invalid \\u escape');
      this.#position += 4;
      return Number.parseInt(hex, 16);
    };
    const high = unit();
    if (high >= 0xdc00 && high <= 0xdfff) this.#fail('Unpaired low surrogate');
    if (high >= 0xd800 && high <= 0xdbff) {
      if (!this.#startsWith('\\u')) this.#fail('Unpaired high surrogate');
      this.#position += 2;
      const low = unit();
      if (low < 0xdc00 || low > 0xdfff) this.#fail('Invalid low surrogate');
      return String.fromCharCode(high, low);
    }
    return String.fromCharCode(high);
  }

  #logicalOr(): LogicalExpr {
    const operands = [this.#logicalAnd()];
    for (;;) {
      this.#skipSpace();
      if (!this.#startsWith('||')) break;
      this.#position += 2;
      this.#skipSpace();
      operands.push(this.#logicalAnd());
    }
    return operands.length === 1 ? (operands[0] as LogicalExpr) : { kind: 'or', operands };
  }

  #logicalAnd(): LogicalExpr {
    const operands = [this.#basic()];
    for (;;) {
      this.#skipSpace();
      if (!this.#startsWith('&&')) break;
      this.#position += 2;
      this.#skipSpace();
      operands.push(this.#basic());
    }
    return operands.length === 1 ? (operands[0] as LogicalExpr) : { kind: 'and', operands };
  }

  #basic(): LogicalExpr {
    if (this.#peek() === '!' && !this.#startsWith('!=')) {
      this.#position++;
      this.#skipSpace();
      if (this.#peek() === '(') return { kind: 'not', operand: this.#parenthesized() };
      return { kind: 'not', operand: this.#test(true) };
    }
    if (this.#peek() === '(') return this.#parenthesized();
    const start = this.#position;
    const left = this.#comparableOrTest();
    this.#skipSpace();
    const op = (['==', '!=', '<=', '>=', '<', '>'] as const).find((o) => this.#startsWith(o));
    if (op === undefined) {
      // A test expression: a filter query or a logical function.
      if (left.kind === 'query') return { kind: 'exists', query: left.query };
      if (left.kind === 'function') {
        if (FUNCTION_RESULTS[left.name] !== 'logical')
          throw new JsonPathError(
            `${left.name}() returns a value; compare it instead of testing it`,
            start,
          );
        return { kind: 'test', call: left };
      }
      throw new JsonPathError('A literal is not a test; compare it with something', start);
    }
    this.#position += op.length;
    this.#skipSpace();
    const right = this.#comparableOrTest();
    for (const side of [left, right]) this.#checkComparable(side, start);
    return { kind: 'compare', op, left, right };
  }

  #parenthesized(): LogicalExpr {
    this.#expect('(');
    this.#skipSpace();
    const expression = this.#logicalOr();
    this.#skipSpace();
    this.#expect(')');
    return expression;
  }

  /** After `!`: a filter query or a logical function. */
  #test(negated: boolean): LogicalExpr {
    const start = this.#position;
    const operand = this.#comparableOrTest();
    if (operand.kind === 'query') return { kind: 'exists', query: operand.query };
    if (operand.kind === 'function' && FUNCTION_RESULTS[operand.name] === 'logical')
      return { kind: 'test', call: operand };
    throw new JsonPathError(
      negated ? '`!` applies to a filter query or a logical function' : 'Expected a test',
      start,
    );
  }

  #checkComparable(side: Comparable, start: number): void {
    if (side.kind === 'query' && !isSingular(side.query))
      throw new JsonPathError(
        'Only singular queries (names and indices) can be compared; use count() or length() for others',
        start,
      );
    if (side.kind === 'function' && FUNCTION_RESULTS[side.name] !== 'value')
      throw new JsonPathError(
        `${side.name}() returns a logical value and cannot be compared`,
        start,
      );
  }

  #comparableOrTest(): Comparable {
    const char = this.#peek();
    if (char === '$' || char === '@') return { kind: 'query', query: this.#query() };
    if (char === "'" || char === '"') return { kind: 'literal', value: this.#string() };
    if (/[-0-9]/.test(char)) return { kind: 'literal', value: this.#number() };
    for (const [word, value] of [
      ['true', true],
      ['false', false],
      ['null', null],
    ] as const) {
      if (this.#startsWith(word) && !/[a-z0-9_]/.test(this.#peek(word.length))) {
        this.#position += word.length;
        return { kind: 'literal', value };
      }
    }
    const name = /^[a-z][a-z0-9_]*/.exec(this.#text.slice(this.#position))?.[0];
    if (name !== undefined && this.#peek(name.length) === '(') return this.#function(name);
    this.#fail('Expected a query, a literal or a function');
  }

  #number(): number {
    const match = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][-+]?[0-9]+)?/.exec(
      this.#text.slice(this.#position),
    );
    if (match === null) this.#fail('Expected a number');
    this.#position += match[0].length;
    return Number(match[0]);
  }

  #function(name: string): FunctionCall {
    const start = this.#position;
    if (!Object.hasOwn(FUNCTION_RESULTS, name))
      throw new JsonPathError(`Unknown function ${name}()`, start);
    const fn = name as FunctionName;
    this.#position += name.length;
    this.#expect('(');
    this.#skipSpace();
    const args: FunctionArgument[] = [];
    if (this.#peek() !== ')') {
      for (;;) {
        args.push(this.#argument());
        this.#skipSpace();
        if (this.#peek() !== ',') break;
        this.#position++;
        this.#skipSpace();
      }
    }
    this.#expect(')');
    const parameters = FUNCTION_PARAMETERS[fn];
    if (args.length !== parameters.length)
      throw new JsonPathError(`${fn}() takes ${parameters.length} argument(s)`, start);
    args.forEach((arg, index) => {
      const parameter = parameters[index];
      const ok =
        parameter === 'nodes'
          ? arg.kind === 'query'
          : arg.kind === 'literal' ||
            (arg.kind === 'query' && isSingular(arg.query)) ||
            (arg.kind === 'function' && FUNCTION_RESULTS[arg.name] === 'value');
      if (!ok)
        throw new JsonPathError(
          `Argument ${index + 1} of ${fn}() must be ${parameter === 'nodes' ? 'a query' : 'a value (a literal, a singular query or a value function)'}`,
          start,
        );
    });
    return { kind: 'function', name: fn, args };
  }

  #argument(): FunctionArgument {
    const start = this.#position;
    const char = this.#peek();
    if (char === '!' || char === '(') return { kind: 'logical', expression: this.#logicalOr() };
    const first = this.#comparableOrTest();
    this.#skipSpace();
    if (/^(==|!=|<=|>=|<|>|&&|\|\|)/.test(this.#text.slice(this.#position))) {
      // A logical expression starting with a comparison or a test.
      this.#position = start;
      return { kind: 'logical', expression: this.#logicalOr() };
    }
    return first;
  }
}

function isSingular(query: Query): boolean {
  return query.segments.every(
    (segment) =>
      !segment.descendant &&
      segment.selectors.length === 1 &&
      (segment.selectors[0]?.kind === 'name' || segment.selectors[0]?.kind === 'index'),
  );
}

/** Parses a JSONPath query. Throws {@link JsonPathError} when it is not valid RFC 9535. */
export function parseJsonPath(expression: string): Query {
  return new Parser(expression).parse();
}

// Evaluation --------------------------------------------------------------------------------

/** `Nothing`: the value of a query that selects no node, distinct from every JSON value. */
const NOTHING: unique symbol = Symbol('Nothing');
/** A JSON value or {@link NOTHING}. */
type Value = unknown;

/** The Unicode code points of a string (UTF-16 surrogate pairs count as one). */
function codePoints(text: string): string[] {
  const result: string[] = [];
  for (const char of text) result.push(char);
  return result;
}

function children(node: JsonPathNode): JsonPathNode[] {
  const { value, path } = node;
  if (Array.isArray(value))
    return (value as readonly unknown[]).map((item, index) => ({
      value: item,
      path: [...path, index],
    }));
  if (isRecord(value))
    return Object.keys(value).map((key) => ({ value: value[key], path: [...path, key] }));
  return [];
}

function descendantsOrSelf(node: JsonPathNode): JsonPathNode[] {
  const result: JsonPathNode[] = [node];
  for (const child of children(node)) result.push(...descendantsOrSelf(child));
  return result;
}

function normalizeIndex(index: number, length: number): number {
  return index >= 0 ? index : length + index;
}

function select(selector: Selector, node: JsonPathNode, root: unknown): JsonPathNode[] {
  const { value, path } = node;
  switch (selector.kind) {
    case 'name':
      return isRecord(value) && Object.hasOwn(value, selector.name)
        ? [{ value: value[selector.name], path: [...path, selector.name] }]
        : [];
    case 'wildcard':
      return children(node);
    case 'index': {
      if (!Array.isArray(value)) return [];
      const index = normalizeIndex(selector.index, value.length);
      return index >= 0 && index < value.length
        ? [{ value: value[index], path: [...path, index] }]
        : [];
    }
    case 'slice': {
      if (!Array.isArray(value)) return [];
      // RFC 9535, section 2.3.4.2.2.
      const length = value.length;
      const step = selector.step ?? 1;
      if (step === 0) return [];
      const start = normalizeIndex(selector.start ?? (step > 0 ? 0 : length - 1), length);
      const end = normalizeIndex(selector.end ?? (step > 0 ? length : -length - 1), length);
      const clamp = (n: number, low: number, high: number): number =>
        Math.min(Math.max(n, low), high);
      const result: JsonPathNode[] = [];
      if (step > 0) {
        const upper = clamp(end, 0, length);
        for (let i = clamp(start, 0, length); i < upper; i += step)
          result.push({ value: value[i], path: [...path, i] });
      } else {
        const lower = clamp(end, -1, length - 1);
        for (let i = clamp(start, -1, length - 1); lower < i; i += step)
          result.push({ value: value[i], path: [...path, i] });
      }
      return result;
    }
    case 'filter':
      return children(node).filter((child) => test(selector.expression, child.value, root));
  }
}

function evaluate(query: Query, current: unknown, root: unknown): JsonPathNode[] {
  let nodes: JsonPathNode[] = [{ value: query.root === '$' ? root : current, path: [] }];
  for (const segment of query.segments) {
    const inputs = segment.descendant ? nodes.flatMap(descendantsOrSelf) : nodes;
    nodes = inputs.flatMap((node) =>
      segment.selectors.flatMap((selector) => select(selector, node, root)),
    );
  }
  return nodes;
}

function test(expression: LogicalExpr, current: unknown, root: unknown): boolean {
  switch (expression.kind) {
    case 'or':
      return expression.operands.some((operand) => test(operand, current, root));
    case 'and':
      return expression.operands.every((operand) => test(operand, current, root));
    case 'not':
      return !test(expression.operand, current, root);
    case 'exists':
      return evaluate(expression.query, current, root).length > 0;
    case 'test':
      return callFunction(expression.call, current, root) === true;
    case 'compare':
      return compare(
        expression.op,
        comparable(expression.left, current, root),
        comparable(expression.right, current, root),
      );
  }
}

function comparable(side: Comparable, current: unknown, root: unknown): Value {
  if (side.kind === 'literal') return side.value;
  if (side.kind === 'function') return callFunction(side, current, root);
  const nodes = evaluate(side.query, current, root);
  return nodes.length === 1 ? nodes[0]?.value : NOTHING;
}

function argumentValue(arg: FunctionArgument, current: unknown, root: unknown): Value {
  switch (arg.kind) {
    case 'literal':
      return arg.value;
    case 'function':
      return callFunction(arg, current, root);
    case 'logical':
      return test(arg.expression, current, root);
    case 'query': {
      const nodes = evaluate(arg.query, current, root);
      return nodes.length === 1 ? nodes[0]?.value : NOTHING;
    }
  }
}

function callFunction(call: FunctionCall, current: unknown, root: unknown): Value {
  const nodes = (index: number): JsonPathNode[] => {
    const arg = call.args[index];
    return arg?.kind === 'query' ? evaluate(arg.query, current, root) : [];
  };
  const value = (index: number): Value => {
    const arg = call.args[index];
    return arg === undefined ? NOTHING : argumentValue(arg, current, root);
  };
  switch (call.name) {
    case 'length': {
      const input = value(0);
      if (typeof input === 'string') return codePoints(input).length;
      if (Array.isArray(input)) return input.length;
      if (isRecord(input)) return Object.keys(input).length;
      return NOTHING;
    }
    case 'count':
      return nodes(0).length;
    case 'value': {
      const list = nodes(0);
      return list.length === 1 ? list[0]?.value : NOTHING;
    }
    case 'match':
    case 'search': {
      const input = value(0);
      const pattern = value(1);
      if (typeof input !== 'string' || typeof pattern !== 'string') return false;
      const regexp = iRegexp(pattern, call.name === 'match');
      return regexp === undefined ? false : regexp.test(input);
    }
  }
}

const regexpCache = new Map<string, RegExp | undefined>();

/**
 * Translates an I-Regexp to a JavaScript regular expression: `.` matches any character but line
 * feed and carriage return (JavaScript also excludes U+2028 and U+2029). Invalid patterns yield
 * `undefined`, and the function then returns false as RFC 9535 requires.
 */
function iRegexp(pattern: string, anchored: boolean): RegExp | undefined {
  const key = `${anchored ? 'm' : 's'}:${pattern}`;
  if (regexpCache.has(key)) return regexpCache.get(key);
  let source = '';
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i] ?? '';
    if (char === '\\') {
      source += char + (pattern[i + 1] ?? '');
      i++;
    } else if (inClass) {
      if (char === ']') inClass = false;
      source += char;
    } else if (char === '[') {
      inClass = true;
      source += char;
    } else {
      source += char === '.' ? '[^\\n\\r]' : char;
    }
  }
  let regexp: RegExp | undefined;
  try {
    regexp = new RegExp(anchored ? `^(?:${source})$` : source, 'u');
  } catch {
    regexp = undefined;
  }
  regexpCache.set(key, regexp);
  return regexp;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]))
    );
  }
  return false;
}

/** Orders strings by Unicode scalar values, which UTF-16 comparison does not for astral characters. */
function lessByCodePoint(a: string, b: string): boolean {
  const left = codePoints(a);
  const right = codePoints(b);
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const x = left[i]?.codePointAt(0) ?? 0;
    const y = right[i]?.codePointAt(0) ?? 0;
    if (x !== y) return x < y;
  }
  return left.length < right.length;
}

function compare(op: ComparisonOp, left: Value, right: Value): boolean {
  const equal = (): boolean =>
    left === NOTHING || right === NOTHING ? left === right : deepEqual(left, right);
  const less = (a: Value, b: Value): boolean => {
    if (typeof a === 'number' && typeof b === 'number') return a < b;
    if (typeof a === 'string' && typeof b === 'string') return lessByCodePoint(a, b);
    return false;
  };
  switch (op) {
    case '==':
      return equal();
    case '!=':
      return !equal();
    case '<':
      return less(left, right);
    case '<=':
      return less(left, right) || equal();
    case '>':
      return less(right, left);
    case '>=':
      return less(right, left) || equal();
  }
}

/** Selects the nodes of `root` that a JSONPath query designates, in document order. */
export function queryJsonPath(root: unknown, expression: string | Query): JsonPathNode[] {
  const query = typeof expression === 'string' ? parseJsonPath(expression) : expression;
  return evaluate(query, root, root);
}

/** The normalized path of a node (RFC 9535, section 2.7), e.g. `$['paths']['/pets'][0]`. */
export function normalizedPath(path: readonly (string | number)[]): string {
  const escapes: Readonly<Record<string, string>> = {
    '\b': '\\b',
    '\f': '\\f',
    '\n': '\\n',
    '\r': '\\r',
    '\t': '\\t',
    "'": "\\'",
    '\\': '\\\\',
  };
  const name = (segment: string): string =>
    codePoints(segment)
      .map(
        (char) =>
          escapes[char] ??
          (char < ' ' ? `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}` : char),
      )
      .join('');
  return `$${path.map((segment) => (typeof segment === 'number' ? `[${segment}]` : `['${name(segment)}']`)).join('')}`;
}
