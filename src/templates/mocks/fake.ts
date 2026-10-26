/**
 * Fake data for the generated fixtures (`features.mocks`). Values are realistic (names, emails,
 * task titles, colors, files…) and seeded: the same seed always makes the same value, on every run
 * and every machine, without a dependency. Seed `0` makes the specification's examples; other
 * seeds vary every value within its schema and cover every enum value, union member, `null` and
 * absent property in turn.
 */
/** Options of a fixture factory (`makePet(overrides, options)`). */
export interface FixtureOptions {
  /**
   * Which value to make: `0` (the default) makes the specification's examples, any other number
   * another value, the same on every call.
   */
  readonly seed?: number;
  /** Make arrays as short as their schema allows, to see empty states. */
  readonly empty?: boolean;
}

/** FNV-1a (32 bits). */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

/** A seed for `key` below `seed`: never `0`, which stands for the examples. */
function mix(seed: number, key: string): number {
  return hash(`${seed}:${key}`) || 1;
}

/** A pseudo-random sequence (mulberry32). */
export class Random {
  #state: number;

  constructor(seed: number) {
    this.#state = seed >>> 0;
  }

  /** A sequence seeded by a string. */
  static of(text: string): Random {
    return new Random(hash(text));
  }

  /** A number in `[0, 1)`. */
  next(): number {
    this.#state = (this.#state + 0x6d2b79f5) | 0;
    let value = this.#state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  /** An integer in `[min, max]`. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** One of `items`. */
  pick<T>(items: readonly [T, ...T[]]): T {
    return items[this.int(0, items.length - 1)] ?? items[0];
  }

  /** `true` with probability `rate`. */
  chance(rate: number): boolean {
    return this.next() < rate;
  }
}

// Patterns ------------------------------------------------------------------------------------
//
// Patterns are parsed, never executed: specifications are untrusted input, and running their
// regular expressions risks catastrophic backtracking. Generated strings are checked by a matcher
// of the parsed pattern with a step budget, which is how lookarounds, backreferences, anchors and
// word boundaries are honored. Unicode property escapes (`\p{L}`) are tested one character at a
// time, which cannot backtrack.

/** A source of pseudo-random numbers. */
export interface PatternRandom {
  /** A number in `[0, 1)`. */
  next(): number;
}

type Range = readonly [from: number, to: number];

/** One part of a character class: code point ranges or a Unicode property, possibly negated. */
type Component =
  | { readonly kind: 'ranges'; readonly ranges: readonly Range[]; readonly negated: boolean }
  | { readonly kind: 'property'; readonly name: string; readonly negated: boolean };

type Node =
  | { readonly kind: 'set'; readonly parts: readonly Component[]; readonly negated: boolean }
  | { readonly kind: 'sequence'; readonly items: readonly Node[] }
  | { readonly kind: 'alternation'; readonly options: readonly Node[] }
  | { readonly kind: 'repeat'; readonly item: Node; readonly min: number; readonly max: number }
  | { readonly kind: 'group'; readonly index: number | undefined; readonly item: Node }
  | { readonly kind: 'reference'; index: number; readonly name?: string }
  | {
      readonly kind: 'look';
      readonly ahead: boolean;
      readonly negated: boolean;
      readonly item: Node;
    }
  | { readonly kind: 'assert'; readonly which: 'start' | 'end' | 'boundary' | 'inside' }
  | { readonly kind: 'empty' };

interface Parsed {
  readonly root: Node;
  readonly groups: number;
  /** Whether strings must be checked against the pattern: lookarounds, references, assertions. */
  readonly checked: boolean;
  /** Characters positive lookaheads ask for, which the generator prefers. */
  readonly preferred: readonly string[];
}

class Unsupported extends Error {}

const DIGITS: readonly Range[] = [[0x30, 0x39]];
const WORD: readonly Range[] = [
  [0x61, 0x7a],
  [0x41, 0x5a],
  [0x30, 0x39],
  [0x5f, 0x5f],
];
const SPACE: readonly Range[] = [
  [0x20, 0x20],
  [0x09, 0x0d],
  [0xa0, 0xa0],
  [0x1680, 0x1680],
  [0x2000, 0x200a],
  [0x2028, 0x2029],
  [0x202f, 0x202f],
  [0x205f, 0x205f],
  [0x3000, 0x3000],
  [0xfeff, 0xfeff],
];
const LINE_TERMINATORS: readonly Range[] = [
  [0x0a, 0x0a],
  [0x0d, 0x0d],
  [0x2028, 0x2029],
];
/**
 * Characters that negated classes and Unicode properties choose from: ASCII first, then letters,
 * digits and symbols of the major scripts, so that any property has members to pick.
 */
const POOL = [
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  '-_.~ !@#$%&*+=:;,?/\'"()[]{}<>^|`\\',
  'àéîõüñçßøåæÀÉÑǅʰ',
  'αβγδεζηθλμπσωΔΣΩ',
  'абвгдежзиклмнопАБВГД',
  'אבגדהוזחט',
  'ابتثجحخدذر٠١٢',
  'अआइईउकखगघ०१',
  'กขคงจฉ๑',
  '中文字日本語人',
  'あいうえおかき',
  'アイウエオカキ',
  '한국어사람',
  '€£¥©®™±×÷§¶°',
  '  ​́ःⅠ½',
  '😀🚀🎉✨',
].join('');

const MAX_PATTERN = 1000;
const MAX_DEPTH = 32;
const MAX_REPEAT = 1000;
const MAX_LENGTH = 10_000;
const MAX_STEPS = 200_000;

class Parser {
  readonly #source: string;
  #index = 0;
  #depth = 0;
  #groups = 0;
  readonly #names = new Map<string, number>();
  readonly #references: Extract<Node, { kind: 'reference' }>[] = [];
  #checked = false;
  readonly #lookaheads: Node[] = [];

  constructor(source: string) {
    this.#source = source;
  }

  parse(): Parsed {
    const root = this.#alternation();
    if (this.#index < this.#source.length) throw new Unsupported('unbalanced parenthesis');
    for (const reference of this.#references) {
      if (reference.name !== undefined) {
        const index = this.#names.get(reference.name);
        if (index === undefined) throw new Unsupported('unknown group name');
        reference.index = index;
      } else if (reference.index > this.#groups) {
        throw new Unsupported('reference to a missing group');
      }
    }
    return {
      root,
      groups: this.#groups,
      checked: this.#checked,
      preferred: this.#lookaheads.flatMap((node) => preferredOf(node)),
    };
  }

  #peek(offset = 0): string | undefined {
    return this.#source[this.#index + offset];
  }

  /** The code point of the character just consumed, consuming its low surrogate too. */
  #codePoint(): number {
    const code = this.#source.codePointAt(this.#index - 1) ?? 0;
    if (code > 0xffff) this.#index++;
    return code;
  }

  #alternation(): Node {
    const options = [this.#sequence()];
    while (this.#peek() === '|') {
      this.#index++;
      options.push(this.#sequence());
    }
    return options.length === 1
      ? (options[0] ?? { kind: 'empty' })
      : { kind: 'alternation', options };
  }

  #sequence(): Node {
    const items: Node[] = [];
    for (
      let char = this.#peek();
      char !== undefined && char !== '|' && char !== ')';
      char = this.#peek()
    ) {
      const atom = this.#atom();
      items.push(this.#quantified(atom));
    }
    return { kind: 'sequence', items };
  }

  #quantified(atom: Node): Node {
    const char = this.#peek();
    let bounds: readonly [number, number] | undefined;
    if (char === '*') bounds = [0, Infinity];
    else if (char === '+') bounds = [1, Infinity];
    else if (char === '?') bounds = [0, 1];
    if (bounds !== undefined) this.#index++;
    else if (char === '{') {
      const match = /^\{(\d+)(,(\d*))?\}/.exec(this.#source.slice(this.#index));
      // Without a valid quantifier, `{` is a literal character.
      if (match === null) return atom;
      const min = Number(match[1]);
      const max = match[2] === undefined ? min : match[3] === '' ? Infinity : Number(match[3]);
      if (min > MAX_REPEAT || max < min) throw new Unsupported('quantifier');
      bounds = [min, max];
      this.#index += match[0].length;
    } else {
      return atom;
    }
    // Lazy quantifiers match the same strings.
    if (this.#peek() === '?') this.#index++;
    if (atom.kind === 'assert' || atom.kind === 'look') return atom;
    return { kind: 'repeat', item: atom, min: bounds[0], max: bounds[1] };
  }

  #atom(): Node {
    const char = this.#peek() ?? '';
    this.#index++;
    switch (char) {
      case '(':
        return this.#group();
      case '[':
        return this.#class();
      case '.':
        return {
          kind: 'set',
          parts: [{ kind: 'ranges', ranges: LINE_TERMINATORS, negated: false }],
          negated: true,
        };
      case '^':
        this.#checked = true;
        return { kind: 'assert', which: 'start' };
      case '$':
        this.#checked = true;
        return { kind: 'assert', which: 'end' };
      case '\\':
        return this.#escape();
      default: {
        const code = this.#codePoint();
        return literal(code);
      }
    }
  }

  #group(): Node {
    let index: number | undefined;
    let look: { ahead: boolean; negated: boolean } | undefined;
    if (this.#peek() === '?') {
      const next = this.#peek(1);
      const after = this.#peek(2);
      if (next === ':') this.#index += 2;
      else if (next === '=' || next === '!') {
        look = { ahead: true, negated: next === '!' };
        this.#index += 2;
      } else if (next === '<' && (after === '=' || after === '!')) {
        look = { ahead: false, negated: after === '!' };
        this.#index += 3;
      } else if (next === '<') {
        const end = this.#source.indexOf('>', this.#index);
        if (end === -1) throw new Unsupported('group name');
        const name = this.#source.slice(this.#index + 2, end);
        index = ++this.#groups;
        this.#names.set(name, index);
        this.#index = end + 1;
      } else {
        // Modifiers such as `(?i:…)`: the generated strings match the pattern as written.
        const match = /^\?[ims]*(?:-[ims]+)?:/.exec(this.#source.slice(this.#index));
        if (match === null) throw new Unsupported('group syntax');
        this.#index += match[0].length;
      }
    } else {
      index = ++this.#groups;
    }
    if (++this.#depth > MAX_DEPTH) throw new Unsupported('nesting');
    const item = this.#alternation();
    this.#depth--;
    if (this.#peek() !== ')') throw new Unsupported('unbalanced parenthesis');
    this.#index++;
    if (look !== undefined) {
      this.#checked = true;
      const node: Node = { kind: 'look', ...look, item };
      if (look.ahead && !look.negated) this.#lookaheads.push(item);
      return node;
    }
    return { kind: 'group', index, item };
  }

  /** An escape outside a class. */
  #escape(): Node {
    const char = this.#peek();
    if (char === 'b' || char === 'B') {
      this.#index++;
      this.#checked = true;
      return { kind: 'assert', which: char === 'b' ? 'boundary' : 'inside' };
    }
    if (char === 'k' && this.#peek(1) === '<') {
      const end = this.#source.indexOf('>', this.#index);
      if (end === -1) throw new Unsupported('group name');
      const node: Extract<Node, { kind: 'reference' }> = {
        kind: 'reference',
        index: 0,
        name: this.#source.slice(this.#index + 2, end),
      };
      this.#index = end + 1;
      this.#references.push(node);
      this.#checked = true;
      return node;
    }
    if (char !== undefined && /[1-9]/.test(char)) {
      const digits = /^\d+/.exec(this.#source.slice(this.#index))?.[0] ?? char;
      this.#index += digits.length;
      const node: Extract<Node, { kind: 'reference' }> = {
        kind: 'reference',
        index: Number(digits),
      };
      this.#references.push(node);
      this.#checked = true;
      return node;
    }
    const component = this.#classEscape();
    if (component !== undefined) return { kind: 'set', parts: [component], negated: false };
    return literal(this.#characterEscape());
  }

  /** `\d`, `\w`, `\s`, `\p{…}` and their negations. */
  #classEscape(): Component | undefined {
    const char = this.#peek();
    if (char === undefined) return undefined;
    const lower = char.toLowerCase();
    const negated = char !== lower;
    if (lower === 'p' && this.#peek(1) === '{') {
      const end = this.#source.indexOf('}', this.#index);
      const name = end === -1 ? '' : this.#source.slice(this.#index + 2, end);
      if (!/^[A-Za-z_]+(?:=[A-Za-z_]+)?$/.test(name) || propertyTest(name) === undefined)
        throw new Unsupported('Unicode property');
      this.#index = end + 1;
      return { kind: 'property', name, negated };
    }
    const ranges =
      lower === 'd' ? DIGITS : lower === 'w' ? WORD : lower === 's' ? SPACE : undefined;
    if (ranges === undefined) return undefined;
    this.#index++;
    return { kind: 'ranges', ranges, negated };
  }

  /** The character of an escape such as `\n`, `\x41`, `\u{41}`, `\cJ` or `\.`. */
  #characterEscape(): number {
    const char = this.#peek();
    if (char === undefined) throw new Unsupported('trailing backslash');
    this.#index++;
    const simple: Readonly<Record<string, number>> = { t: 9, n: 10, v: 11, f: 12, r: 13 };
    if (Object.prototype.hasOwnProperty.call(simple, char)) return simple[char] ?? 0;
    if (char === '0' && !/\d/.test(this.#peek() ?? '')) return 0;
    if (char === 'c') {
      const letter = this.#peek();
      if (letter === undefined || !/[A-Za-z]/.test(letter)) return 0x5c;
      this.#index++;
      return (letter.codePointAt(0) ?? 0) % 32;
    }
    const hexCode = (length: number): number => {
      const digits = this.#source.slice(this.#index, this.#index + length);
      if (digits.length !== length || !/^[0-9a-fA-F]+$/.test(digits))
        throw new Unsupported('escape');
      this.#index += length;
      return Number.parseInt(digits, 16);
    };
    if (char === 'x') return hexCode(2);
    if (char === 'u') {
      if (this.#peek() !== '{') return hexCode(4);
      const end = this.#source.indexOf('}', this.#index);
      const digits = this.#source.slice(this.#index + 1, end);
      if (end === -1 || !/^[0-9a-fA-F]{1,6}$/.test(digits)) throw new Unsupported('escape');
      this.#index = end + 1;
      return Number.parseInt(digits, 16);
    }
    // An identity escape (`\.`, `\/`): the character itself.
    return this.#codePoint();
  }

  #class(): Node {
    const negated = this.#peek() === '^';
    if (negated) this.#index++;
    const ranges: Range[] = [];
    const parts: Component[] = [];
    for (;;) {
      const char = this.#peek();
      if (char === undefined) throw new Unsupported('unterminated class');
      // In JavaScript, `]` ends a class even right after `[` or `[^`.
      if (char === ']') {
        this.#index++;
        break;
      }
      const from = this.#classAtom(parts);
      if (from === undefined) continue;
      if (this.#peek() === '-' && this.#peek(1) !== ']' && this.#peek(1) !== undefined) {
        this.#index++;
        const to = this.#classAtom(parts);
        if (to === undefined || to < from) throw new Unsupported('class range');
        ranges.push([from, to]);
      } else {
        ranges.push([from, from]);
      }
    }
    if (ranges.length > 0) parts.unshift({ kind: 'ranges', ranges, negated: false });
    return { kind: 'set', parts, negated };
  }

  /** One character of a class; class escapes (`\d`, `\p{L}`) are added to `parts` instead. */
  #classAtom(parts: Component[]): number | undefined {
    const char = this.#peek() ?? '';
    this.#index++;
    if (char !== '\\') return this.#codePoint();
    if (this.#peek() === 'b') {
      this.#index++;
      return 8;
    }
    if (this.#peek() === '-') {
      this.#index++;
      return 0x2d;
    }
    const component = this.#classEscape();
    if (component === undefined) return this.#characterEscape();
    parts.push(component);
    return undefined;
  }
}

function literal(code: number): Node {
  return {
    kind: 'set',
    parts: [{ kind: 'ranges', ranges: [[code, code]], negated: false }],
    negated: false,
  };
}

const propertyTests = new Map<string, RegExp | undefined>();

/** A test of one character against a Unicode property, or `undefined` if there is no such property. */
function propertyTest(name: string): RegExp | undefined {
  if (propertyTests.has(name)) return propertyTests.get(name);
  let test: RegExp | undefined;
  try {
    // The name was checked to be a property name: the expression is one character class.
    test = new RegExp(`^\\p{${name}}$`, 'u');
  } catch {
    test = undefined;
  }
  propertyTests.set(name, test);
  return test;
}

function inRanges(code: number, ranges: readonly Range[]): boolean {
  return ranges.some(([from, to]) => code >= from && code <= to);
}

function member(code: number, node: Extract<Node, { kind: 'set' }>): boolean {
  const hit = node.parts.some((part) => {
    const inside =
      part.kind === 'ranges'
        ? inRanges(code, part.ranges)
        : (propertyTest(part.name)?.test(String.fromCodePoint(code)) ?? false);
    return inside !== part.negated;
  });
  return hit !== node.negated;
}

/** Characters a positive lookahead's literal parts and simple classes require. */
function preferredOf(node: Node): string[] {
  switch (node.kind) {
    case 'set':
      return node.negated || node.parts.length !== 1 || node.parts[0]?.kind !== 'ranges'
        ? []
        : [setSample(node)];
    case 'sequence':
      return node.items.flatMap(preferredOf);
    case 'alternation':
      return node.options.flatMap(preferredOf);
    case 'repeat':
      return node.min > 0 ? preferredOf(node.item) : [];
    case 'group':
      return preferredOf(node.item);
    default:
      return [];
  }
}

/** Every character of a small class, for lookahead preferences. */
function setSample(node: Extract<Node, { kind: 'set' }>): string {
  const part = node.parts[0];
  if (part?.kind !== 'ranges') return '';
  let result = '';
  for (const [from, to] of part.ranges)
    for (let code = from; code <= to && result.length < 64; code++)
      result += String.fromCodePoint(code);
  return result;
}

function int(random: PatternRandom, min: number, max: number): number {
  return min + Math.floor(random.next() * (max - min + 1));
}

interface Generation {
  readonly random: PatternRandom;
  readonly extra: number;
  readonly captures: (string | undefined)[];
  readonly preferred: string;
  /** Whether positive lookbehinds write what they look for (tried on every other attempt). */
  readonly behind: boolean;
}

function character(node: Extract<Node, { kind: 'set' }>, context: Generation): string {
  const { random } = context;
  // Characters a lookahead asks for, half of the time when the class allows them.
  if (context.preferred !== '' && random.next() < 0.5) {
    const wanted = Array.from(context.preferred).filter((c) => member(c.codePointAt(0) ?? 0, node));
    if (wanted.length > 0) return wanted[int(random, 0, wanted.length - 1)] ?? '';
  }
  const simple =
    !node.negated && node.parts.every((part) => part.kind === 'ranges' && !part.negated);
  if (simple) {
    const ranges = node.parts.flatMap((part) => (part.kind === 'ranges' ? part.ranges : []));
    // The printable ASCII part of the ranges, when they have one, keeps fixtures readable.
    const printable = ranges.flatMap(([from, to]): Range[] => {
      const low = Math.max(from, 0x20);
      const high = Math.min(to, 0x7e);
      return low <= high ? [[low, high]] : [];
    });
    const choices = printable.length > 0 ? printable : ranges;
    const range = choices[int(random, 0, choices.length - 1)];
    if (range === undefined) throw new Unsupported('empty class');
    return String.fromCodePoint(int(random, range[0], range[1]));
  }
  const candidates = Array.from(POOL).filter((c) => member(c.codePointAt(0) ?? 0, node));
  if (candidates.length === 0) throw new Unsupported('empty class');
  // Prefer the ASCII members of the pool when there are some.
  const plain = candidates.filter((c) => (c.codePointAt(0) ?? 0) < 0x80);
  const from = plain.length > 0 && random.next() < 0.8 ? plain : candidates;
  return from[int(random, 0, from.length - 1)] ?? '';
}

function generate(node: Node, context: Generation): string {
  switch (node.kind) {
    case 'empty':
    case 'assert':
      return '';
    case 'look':
      return !node.ahead && !node.negated && context.behind ? generate(node.item, context) : '';
    case 'set':
      return character(node, context);
    case 'sequence': {
      let result = '';
      for (const item of node.items) {
        result += generate(item, context);
        if (result.length > MAX_LENGTH) throw new Unsupported('too long');
      }
      return result;
    }
    case 'alternation': {
      const option = node.options[int(context.random, 0, node.options.length - 1)];
      return option === undefined ? '' : generate(option, context);
    }
    case 'repeat': {
      const room = Math.min(node.max - node.min, context.extra);
      const count = node.min + (room > 0 ? int(context.random, 0, room) : 0);
      let result = '';
      for (let index = 0; index < count; index++) {
        result += generate(node.item, context);
        if (result.length > MAX_LENGTH) throw new Unsupported('too long');
      }
      return result;
    }
    case 'group': {
      const text = generate(node.item, context);
      if (node.index !== undefined) context.captures[node.index] = text;
      return text;
    }
    case 'reference':
      return context.captures[node.index] ?? '';
  }
}

type Captures = readonly (string | undefined)[];
type Continuation = (position: number, captures: Captures) => boolean;

class Budget extends Error {}

/** Whether `text` contains a match of the pattern, as `RegExp.prototype.test` would answer. */
function matches(parsed: Parsed, text: string): boolean {
  let steps = 0;
  const isWord = (position: number): boolean => {
    const code = text.charCodeAt(position);
    return Number.isFinite(code) && inRanges(code, WORD);
  };
  const match = (node: Node, position: number, captures: Captures, next: Continuation): boolean => {
    if (++steps > MAX_STEPS) throw new Budget();
    switch (node.kind) {
      case 'empty':
        return next(position, captures);
      case 'set': {
        if (position >= text.length) return false;
        const code = text.codePointAt(position) ?? 0;
        if (!member(code, node)) return false;
        return next(position + (code > 0xffff ? 2 : 1), captures);
      }
      case 'sequence': {
        const step = (index: number, at: number, current: Captures): boolean => {
          const item = node.items[index];
          return item === undefined
            ? next(at, current)
            : match(item, at, current, (after, updated) => step(index + 1, after, updated));
        };
        return step(0, position, captures);
      }
      case 'alternation':
        return node.options.some((option) => match(option, position, captures, next));
      case 'group':
        return match(node.item, position, captures, (after, updated) => {
          if (node.index === undefined) return next(after, updated);
          const copy = [...updated];
          copy[node.index] = text.slice(position, after);
          return next(after, copy);
        });
      case 'reference': {
        const captured = captures[node.index];
        if (captured === undefined) return next(position, captures);
        return text.startsWith(captured, position)
          ? next(position + captured.length, captures)
          : false;
      }
      case 'assert': {
        const ok =
          node.which === 'start'
            ? position === 0
            : node.which === 'end'
              ? position === text.length
              : (isWord(position - 1) !== isWord(position)) === (node.which === 'boundary');
        return ok && next(position, captures);
      }
      case 'look': {
        let found: Captures | undefined;
        if (node.ahead) {
          match(node.item, position, captures, (_after, updated) => {
            found = updated;
            return true;
          });
        } else {
          for (let start = position; start >= 0; start--) {
            const ended = match(node.item, start, captures, (after, updated) => {
              if (after !== position) return false;
              found = updated;
              return true;
            });
            if (ended) break;
          }
        }
        if (node.negated) return found === undefined && next(position, captures);
        return found !== undefined && next(position, found);
      }
      case 'repeat': {
        const loop = (count: number, at: number, current: Captures): boolean => {
          if (
            count < node.max &&
            match(node.item, at, current, (after, updated) =>
              // An iteration that matched nothing would repeat forever.
              after === at ? false : loop(count + 1, after, updated),
            )
          )
            return true;
          return count >= node.min && next(at, current);
        };
        return loop(0, position, captures);
      }
    }
  };
  try {
    for (let start = 0; start <= text.length; start++)
      if (match(parsed.root, start, [], () => true)) return true;
    return false;
  } catch (error) {
    if (error instanceof Budget) return false;
    throw error;
  }
}

const parsedPatterns = new Map<string, Parsed | undefined>();

function parse(pattern: string): Parsed | undefined {
  if (parsedPatterns.has(pattern)) return parsedPatterns.get(pattern);
  let parsed: Parsed | undefined;
  if (pattern.length <= MAX_PATTERN) {
    try {
      parsed = new Parser(pattern).parse();
    } catch (error) {
      if (!(error instanceof Unsupported)) throw error;
    }
  }
  parsedPatterns.set(pattern, parsed);
  return parsed;
}

/** Characters as JSON Schema counts them (code points) and as the validators do (UTF-16 units). */
function fitsLength(text: string, minLength: number, maxLength: number): boolean {
  const points = Array.from(text).length;
  return Math.min(points, text.length) >= minLength && Math.max(points, text.length) <= maxLength;
}

/** How many repetitions unbounded quantifiers may add, in the order they are tried. */
const EXTRAS = [3, 1, 0, 6, 12, 24, 48, 96];

/**
 * A string matching `pattern` whose length is within `[minLength, maxLength]`, or `undefined` when
 * the pattern is not valid or no such string was found.
 */
export function samplePattern(
  pattern: string,
  random: PatternRandom,
  minLength = 0,
  maxLength = Infinity,
): string | undefined {
  const parsed = parse(pattern);
  if (parsed === undefined) return undefined;
  const preferred = parsed.preferred.join('');
  for (const extra of EXTRAS) {
    for (let attempt = 0; attempt < 8; attempt++) {
      let text: string;
      try {
        text = generate(parsed.root, {
          random,
          extra,
          captures: Array.from({ length: parsed.groups + 1 }, () => undefined),
          preferred,
          behind: attempt % 2 === 0,
        });
      } catch (error) {
        if (error instanceof Unsupported) return undefined;
        throw error;
      }
      if (!fitsLength(text, minLength, maxLength)) break;
      if (!parsed.checked || matches(parsed, text)) return text;
    }
  }
  return undefined;
}

/** Whether `text` matches `pattern` (`undefined` when the pattern is not valid). */
export function matchesPattern(pattern: string, text: string): boolean | undefined {
  const parsed = parse(pattern);
  return parsed === undefined ? undefined : matches(parsed, text);
}

// Vocabulary ----------------------------------------------------------------------------------

/** A non-empty list of the `|`-separated entries of `entries`. */
function list(entries: string): readonly [string, ...string[]] {
  const [first = '', ...rest] = entries.split('|');
  return [first, ...rest];
}

/** A non-empty list of `name:value` pairs. */
function pairs(
  entries: string,
): readonly [readonly [string, string], ...(readonly [string, string])[]] {
  const split = (entry: string): readonly [string, string] => {
    const [name = '', value = ''] = entry.split(':');
    return [name, value];
  };
  const [first, ...rest] = list(entries);
  return [split(first), ...rest.map(split)];
}

const FIRST_NAMES = list(
  'Ada|Grace|Alan|Linus|Margaret|Katherine|Dennis|Barbara|Ken|Radia|Tim|Hedy|Frances|Edsger|' +
    'Donald|Shafi|Leslie|Sophie|Priya|Mateo|Amara|Yuki|Lena|Omar|Chen|Sofia|Noah|Aisha|Lucas|Mia|' +
    'Ethan|Zara|Hiro|Ingrid|Diego|Fatima|Liam|Elena|Kwame|Nadia|Oscar|Ravi|Sara|Tomás|Viktor|Wen|' +
    'Ximena|Yusuf|Zoe|Alex|Jordan|Taylor|Morgan|Riley|Casey|Jamie|Avery|Quinn|Rowan|Maya',
);
const LAST_NAMES = list(
  'Lovelace|Hopper|Turing|Torvalds|Hamilton|Johnson|Ritchie|Liskov|Thompson|Perlman|Lamarr|' +
    'Allen|Dijkstra|Knuth|Goldwasser|Lamport|Wilson|Patel|García|Okafor|Tanaka|Müller|Haddad|Wang|' +
    'Rossi|Smith|Khan|Silva|Nguyen|Kim|Ali|Cohen|Larsen|Fernández|Mensah|Novak|Kowalski|Ivanova|' +
    'Schmidt|Dubois|Andersson|Moreau|Costa|Yilmaz|Park|Singh|Brown|Martin|Lee|Clark|Lewis|Walker|' +
    'Young|King|Wright|Scott|Green|Baker|Hill',
);
const LOREM = list(
  'lorem|ipsum|dolor|sit|amet|consectetur|adipiscing|elit|sed|eiusmod|tempor|incididunt|labore|' +
    'dolore|magna|aliqua|enim|minim|veniam|nostrud|ullamco|laboris|aliquip|commodo|consequat|aute|' +
    'irure|velit|esse|cillum|fugiat|nulla',
);
const SENTENCES = list(
  'The new layout is ready for review.|' +
    'Customers reported that the page loads slowly on mobile.|' +
    'Let’s align on the scope before we start.|' +
    'This blocks the next release.|' +
    'Add tests for the edge cases we found last week.|' +
    'The copy should match the latest designs.|' +
    'We agreed to ship the first version behind a feature flag.|' +
    'Numbers look good after the last deploy.|' +
    'Can someone double-check the translations?|' +
    'The integration works in staging but not in production yet.|' +
    'Follow-up from the planning meeting on Tuesday.|' +
    'Most of the work is done; the docs still need an update.|' +
    'Error rates dropped by half since the fix went out.|' +
    'Please keep the old endpoint until every client has migrated.|' +
    'The design team shared feedback in the review thread.|' +
    'This needs a decision from product before we continue.|' +
    'Performance is within budget on every page we measured.|' +
    'I left a few comments on the pull request.|' +
    'Support received three tickets about this today.|' +
    'We can reuse the components from the settings page.|' +
    'The import fails for files larger than 10 MB.|' +
    'Accessibility checks pass in both themes.|' +
    'Moving this to the next sprint to make room for the hotfix.|' +
    'The data migration finished without errors.|' +
    'Thanks for the quick turnaround on this!|' +
    'We should measure the impact before rolling it out to everyone.|' +
    'Looks great on desktop; tablet still needs some work.|' +
    'Security review is scheduled for Thursday.|' +
    'The onboarding flow now takes two steps instead of five.|' +
    'Let’s pair on this tomorrow morning.',
);
const JOB_LEVELS = list('Senior|Staff|Principal|Lead|Junior||||');
const JOB_AREAS = list(
  'Frontend|Backend|Product|Platform|Data|Mobile|Security|Growth|Design|Infrastructure|QA|DevOps',
);
const JOB_ROLES = list(
  'Engineer|Designer|Manager|Analyst|Scientist|Architect|Developer|Researcher|Writer',
);
const DEPARTMENTS = list(
  'Engineering|Design|Marketing|Sales|Support|Finance|Operations|Legal|People|Product|Research|Security',
);
const COMPANY_SUFFIXES = list(
  'Labs|Systems|Group|Studio|Works|Technologies|& Co.|Industries|Partners|Ventures|Analytics|Cloud',
);
const COMPANY_FIRST = list('Blue|Bright|North|Swift|Silver|Green|Clear|Bold|Prime|Nova');
const COMPANY_SECOND = list('Harbor|Peak|Wave|Leaf|Stone|Field|Bridge|Forge|Pixel|Orbit');
const PRODUCT_ADJECTIVES = list(
  'Ergonomic|Wireless|Compact|Smart|Classic|Premium|Portable|Organic|Handmade|Recycled',
);
const PRODUCT_MATERIALS = list('Steel|Wooden|Cotton|Leather|Bamboo|Ceramic|Glass|Wool');
const PRODUCT_NOUNS = list(
  'Chair|Lamp|Backpack|Keyboard|Mug|Notebook|Headphones|Bottle|Desk|Jacket|Watch|Speaker',
);
const PROJECT_AREAS = list(
  'Mobile|Billing|Data|Marketing|Analytics|Customer|Payments|Search|Onboarding|Platform|Identity|' +
    'Checkout|Design system|Infrastructure|Support|Growth|Security|Reporting|Notifications|Admin',
);
const PROJECT_NOUNS = list(
  'app|revamp|migration|relaunch|portal|redesign|platform|pipeline|dashboard|API|integration|' +
    'rollout|cleanup|audit|launch',
);
const TASK_VERBS = list(
  'Design|Fix|Write|Add|Update|Refactor|Review|Migrate|Remove|Investigate|Document|Test|Improve|' +
    'Optimize|Implement|Set up|Ship|Prototype',
);
const TASK_OBJECTS = list(
  'the pricing page|the login redirect|release notes|rate limiting|the onboarding flow|' +
    'the search index|billing webhooks|dark mode|CSV export|error messages|the mobile layout|' +
    'the API docs|user settings|password reset|notification emails|the audit log|the caching layer|' +
    'analytics events|the checkout form|image uploads',
);
const HEADLINE_TEMPLATES = list(
  'A Guide to %|% in Practice|Why % Matters|The Future of %|Getting Started with %|' +
    '%: Lessons Learned|Building Better %|Ten Tips for %',
);
const HEADLINE_TOPICS = list(
  'Remote Work|Open Source|Design Systems|Data Privacy|Cloud Costs|Team Rituals|Accessibility|' +
    'Performance|Testing|Onboarding',
);
const TAGS = list(
  'bug|feature|frontend|backend|design|docs|performance|security|ux|infra|mobile|api|testing|' +
    'research|urgent|refactor|accessibility|analytics',
);
const STREET_NAMES = list(
  'Main|Oak|Maple|Cedar|Elm|Pine|Lake|Hill|Park|Sunset|River|Church|Market|Mill|Spring',
);
const STREET_SUFFIXES = list('Street|Avenue|Road|Lane|Drive|Way|Boulevard|Court');
const CITIES = list(
  'San Francisco|New York|London|Berlin|Paris|Tokyo|Toronto|Sydney|Amsterdam|Barcelona|Lisbon|' +
    'Dublin|Stockholm|Copenhagen|Zurich|Vienna|Prague|Warsaw|Seoul|Singapore|Bangalore|Lagos|' +
    'Nairobi|Cape Town|São Paulo|Buenos Aires|Mexico City|Austin|Seattle|Chicago',
);
const STATES = list(
  'California|New York|Texas|Washington|Illinois|Ontario|Bavaria|Catalonia|Victoria|Queensland|' +
    'Lombardy|Île-de-France',
);
const COUNTRIES = pairs(
  'United States:US|United Kingdom:GB|Germany:DE|France:FR|Japan:JP|Canada:CA|Australia:AU|' +
    'Netherlands:NL|Spain:ES|Portugal:PT|Ireland:IE|Sweden:SE|Denmark:DK|Switzerland:CH|Austria:AT|' +
    'Poland:PL|South Korea:KR|Singapore:SG|India:IN|Nigeria:NG|Kenya:KE|South Africa:ZA|Brazil:BR|' +
    'Argentina:AR|Mexico:MX|Italy:IT|Norway:NO|Finland:FI|New Zealand:NZ',
);
const TIMEZONES = list(
  'America/New_York|America/Los_Angeles|America/Chicago|America/Sao_Paulo|Europe/London|' +
    'Europe/Berlin|Europe/Paris|Europe/Madrid|Asia/Tokyo|Asia/Singapore|Asia/Kolkata|' +
    'Australia/Sydney|Africa/Lagos|UTC',
);
const LOCALES = list('en-US|en-GB|de-DE|fr-FR|es-ES|pt-BR|ja-JP|ko-KR|zh-CN|it-IT|nl-NL|sv-SE');
const LANGUAGES = list('en|de|fr|es|pt|ja|ko|zh|it|nl|sv|hi');
const CURRENCIES = list('USD|EUR|GBP|JPY|CAD|AUD|CHF|SEK|INR|BRL|MXN|SGD');
const FILE_TYPES = pairs(
  'image/png:png|image/jpeg:jpg|application/pdf:pdf|text/plain:txt|text/csv:csv|' +
    'application/json:json|image/svg+xml:svg|application/zip:zip|image/gif:gif|text/markdown:md',
);
const FILE_STEMS = list(
  'report|invoice|wireframe|screenshot|notes|budget|roadmap|contract|photo|logo|presentation|' +
    'summary|draft|export|diagram|receipt',
);
const USER_AGENTS = list(
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15|' +
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36|' +
    'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0|' +
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
);
const EMOJI = list('🚀|✨|🎉|👍|🔥|✅|💡|📦|🐛|🎨');
const COLORS = list(
  '#ef4444|#f97316|#f59e0b|#eab308|#84cc16|#22c55e|#10b981|#14b8a6|#06b6d4|#0ea5e9|#3b82f6|' +
    '#6366f1|#8b5cf6|#a855f7|#d946ef|#ec4899|#f43f5e|#64748b',
);
const RECORD_KEYS = list(
  'source|plan|region|channel|team|priority|campaign|version|theme|segment|tier|origin',
);
/** Domains reserved for documentation (RFC 2606). */
const DOMAINS = list('example.com|example.org|example.net');
const DOCUMENTATION_NETWORKS = list('192.0.2|198.51.100|203.0.113');

// Generators ----------------------------------------------------------------------------------

/** Lowercase ASCII for identifiers: `Tomás Müller` → `tomas.muller`. */
function ascii(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

const pad = (value: number, length = 2): string => String(value).padStart(length, '0');

function hex(random: Random, length: number): string {
  let result = '';
  for (let index = 0; index < length; index++) result += random.int(0, 15).toString(16);
  return result;
}

function alphanumeric(random: Random, length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let index = 0; index < length; index++) result += chars.charAt(random.int(0, 35));
  return result;
}

function base64Url(random: Random, length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  for (let index = 0; index < length; index++) result += chars.charAt(random.int(0, 63));
  return result;
}

/** An RFC 9562 version 4 UUID. */
function uuid(random: Random): string {
  const digits = Array.from({ length: 32 }, (_, index) => {
    if (index === 12) return '4';
    if (index === 16) return (8 + random.int(0, 3)).toString(16);
    return random.int(0, 15).toString(16);
  }).join('');
  return `${digits.slice(0, 8)}-${digits.slice(8, 12)}-${digits.slice(12, 16)}-${digits.slice(16, 20)}-${digits.slice(20)}`;
}

function sentences(random: Random, count: number): string {
  const result: string[] = [];
  for (let index = 0; index < count; index++) {
    const sentence = random.pick(SENTENCES);
    if (!result.includes(sentence)) result.push(sentence);
  }
  return result.join(' ');
}

function luhn(digits: string): string {
  let sum = 0;
  for (let index = 0; index < digits.length; index++) {
    let digit = Number(digits.charAt(digits.length - 1 - index));
    if (index % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return `${digits}${(10 - (sum % 10)) % 10}`;
}

function isbn(random: Random): string {
  const body = `978${Array.from({ length: 9 }, () => random.int(0, 9)).join('')}`;
  let sum = 0;
  for (let index = 0; index < 12; index++)
    sum += Number(body.charAt(index)) * (index % 2 === 0 ? 1 : 3);
  return `${body}${(10 - (sum % 10)) % 10}`;
}

/** A British IBAN with valid check digits. */
function iban(random: Random): string {
  const bank = Array.from({ length: 4 }, () => String.fromCharCode(random.int(65, 90))).join('');
  const bban = `${bank}${Array.from({ length: 14 }, () => random.int(0, 9)).join('')}`;
  const numeric = `${bban}GB00`.replace(/[A-Z]/g, (letter) => String(letter.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97;
  return `GB${pad(98 - remainder)}${bban}`;
}

function personName(random: Random): readonly [string, string] {
  return [random.pick(FIRST_NAMES), random.pick(LAST_NAMES)];
}

/** The domain of an example email address, or a documentation domain. */
function domainOf(example: string, random: Random): string {
  const domain = /@([\w.-]+\.[a-z]{2,})$/i.exec(example)?.[1];
  return domain ?? random.pick(DOMAINS);
}

/** The origin of an example URL, or a documentation domain's. */
function originOf(example: string, random: Random): string {
  return /^(https?:\/\/[^/?#]+)/i.exec(example)?.[1] ?? `https://${random.pick(DOMAINS)}`;
}

/** A colorful SVG picture as a `data:` URL: it renders anywhere, without the network. */
function picture(random: Random, width: number, height: number): string {
  const [background, accent, detail] = [
    random.pick(COLORS),
    random.pick(COLORS),
    random.pick(COLORS),
  ];
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'>` +
    `<rect width='${width}' height='${height}' fill='${background}'/>` +
    `<circle cx='${random.int(0, width)}' cy='${random.int(0, height)}' r='${random.int(width / 6, width / 2)}' fill='${accent}' fill-opacity='.7'/>` +
    `<rect x='${random.int(0, width / 2)}' y='${random.int(0, height / 2)}' width='${random.int(width / 6, width / 2)}' height='${random.int(height / 6, height / 2)}' fill='${detail}' fill-opacity='.6'/></svg>`;
  return `data:image/svg+xml,${svg.replace(/[<>#'"]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}

/** What a text generator makes: realistic text of a kind. */
export type TextKind =
  | 'words'
  | 'word'
  | 'sentence'
  | 'paragraph'
  | 'like'
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'username'
  | 'email'
  | 'phone'
  | 'jobTitle'
  | 'company'
  | 'department'
  | 'product'
  | 'project'
  | 'task'
  | 'headline'
  | 'tag'
  | 'slug'
  | 'code'
  | 'street'
  | 'city'
  | 'state'
  | 'country'
  | 'countryCode'
  | 'postalCode'
  | 'address'
  | 'url'
  | 'imageUrl'
  | 'avatarUrl'
  | 'domain'
  | 'ipv4'
  | 'ipv6'
  | 'mac'
  | 'userAgent'
  | 'token'
  | 'jwt'
  | 'password'
  | 'hash'
  | 'uuid'
  | 'color'
  | 'mimeType'
  | 'fileName'
  | 'fileExtension'
  | 'filePath'
  | 'semver'
  | 'emoji'
  | 'currency'
  | 'locale'
  | 'language'
  | 'timezone'
  | 'sku'
  | 'isbn'
  | 'iban'
  | 'creditCard'
  | 'base64'
  | 'json'
  | 'duration'
  | 'regex'
  | 'pointer'
  | 'relativePointer'
  | 'uriReference'
  | 'uriTemplate'
  | 'integer'
  | 'decimal';

const TEXT: { readonly [K in TextKind]: (random: Random, example: string) => string } = {
  words: (random) => `${random.pick(LOREM)} ${random.pick(LOREM)}`,
  word: (random) => random.pick(LOREM),
  sentence: (random) => random.pick(SENTENCES),
  paragraph: (random) => sentences(random, random.int(2, 4)),
  like: (random, example) => like(example, random),
  firstName: (random) => random.pick(FIRST_NAMES),
  lastName: (random) => random.pick(LAST_NAMES),
  fullName: (random) => personName(random).join(' '),
  username: (random) => {
    const [first, last] = personName(random);
    return `${ascii(first)}.${ascii(last)}${random.int(1, 99)}`;
  },
  email: (random, example) => {
    const [first, last] = personName(random);
    return `${ascii(first)}.${ascii(last)}@${domainOf(example, random)}`;
  },
  phone: (random) =>
    random.chance(0.5)
      ? `+1 555-01${pad(random.int(0, 99))}`
      : `+44 20 7946 0${pad(random.int(0, 999), 3)}`,
  jobTitle: (random) => {
    if (random.chance(0.1)) return `Head of ${random.pick(DEPARTMENTS)}`;
    const level = random.pick(JOB_LEVELS);
    return `${level === '' ? '' : `${level} `}${random.pick(JOB_AREAS)} ${random.pick(JOB_ROLES)}`;
  },
  company: (random) =>
    random.chance(0.5)
      ? `${random.pick(LAST_NAMES)} ${random.pick(COMPANY_SUFFIXES)}`
      : `${random.pick(COMPANY_FIRST)}${random.pick(COMPANY_SECOND)}`,
  department: (random) => random.pick(DEPARTMENTS),
  product: (random) =>
    `${random.pick(PRODUCT_ADJECTIVES)} ${random.pick(PRODUCT_MATERIALS)} ${random.pick(PRODUCT_NOUNS)}`,
  project: (random) => `${random.pick(PROJECT_AREAS)} ${random.pick(PROJECT_NOUNS)}`,
  task: (random) => `${random.pick(TASK_VERBS)} ${random.pick(TASK_OBJECTS)}`,
  headline: (random) => random.pick(HEADLINE_TEMPLATES).replace(/%/g, random.pick(HEADLINE_TOPICS)),
  tag: (random) => random.pick(TAGS),
  slug: (random) => `${random.pick(TAGS)}-${random.pick(LOREM)}-${random.int(1, 99)}`,
  code: (random) => alphanumeric(random, 6).toUpperCase(),
  street: (random) =>
    `${random.int(1, 9999)} ${random.pick(STREET_NAMES)} ${random.pick(STREET_SUFFIXES)}`,
  city: (random) => random.pick(CITIES),
  state: (random) => random.pick(STATES),
  country: (random) => random.pick(COUNTRIES)[0],
  countryCode: (random) => random.pick(COUNTRIES)[1],
  postalCode: (random) => pad(random.int(10000, 99999), 5),
  address: (random) =>
    `${random.int(1, 9999)} ${random.pick(STREET_NAMES)} ${random.pick(STREET_SUFFIXES)}, ${random.pick(CITIES)}`,
  url: (random, example) =>
    `${originOf(example, random)}/${random.pick(TAGS)}/${random.int(1, 999)}`,
  imageUrl: (random) => picture(random, 400, 300),
  avatarUrl: (random) => picture(random, 128, 128),
  domain: (random) => `${random.pick(TAGS)}.${random.pick(DOMAINS)}`,
  // Ranges reserved for documentation (RFC 5737, RFC 3849).
  ipv4: (random) => `${random.pick(DOCUMENTATION_NETWORKS)}.${random.int(1, 254)}`,
  ipv6: (random) => `2001:db8::${random.int(1, 0xffff).toString(16)}:${hex(random, 4)}`,
  mac: (random) => `02:${Array.from({ length: 5 }, () => hex(random, 2)).join(':')}`,
  userAgent: (random) => random.pick(USER_AGENTS),
  token: (random) => base64Url(random, 40),
  jwt: (random) =>
    `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${base64Url(random, 48)}.${base64Url(random, 43)}`,
  password: (random) => `${base64Url(random, 6)}!${random.int(10, 99)}${base64Url(random, 4)}`,
  hash: (random) => hex(random, 64),
  uuid,
  color: (random) => random.pick(COLORS),
  mimeType: (random) => random.pick(FILE_TYPES)[0],
  fileName: (random) =>
    `${random.pick(FILE_STEMS)}-${random.int(1, 99)}.${random.pick(FILE_TYPES)[1]}`,
  fileExtension: (random) => random.pick(FILE_TYPES)[1],
  filePath: (random) =>
    `/files/${random.pick(TAGS)}/${random.pick(FILE_STEMS)}.${random.pick(FILE_TYPES)[1]}`,
  semver: (random) => `${random.int(1, 4)}.${random.int(0, 12)}.${random.int(0, 20)}`,
  emoji: (random) => random.pick(EMOJI),
  currency: (random) => random.pick(CURRENCIES),
  locale: (random) => random.pick(LOCALES),
  language: (random) => random.pick(LANGUAGES),
  timezone: (random) => random.pick(TIMEZONES),
  sku: (random) => `SKU-${random.int(10000, 99999)}`,
  isbn,
  iban,
  // Test card numbers: Luhn-valid, accepted by no network.
  creditCard: (random) =>
    luhn(`4242${Array.from({ length: 11 }, () => random.int(0, 9)).join('')}`),
  base64: (random) => btoa(random.pick(SENTENCES).replace(/[^\x20-\x7e]/g, "'")),
  json: (random) => JSON.stringify({ id: random.int(1, 999), name: random.pick(TAGS) }),
  duration: (random) =>
    random.chance(0.5) ? `PT${random.int(5, 120)}M` : `P${random.int(1, 30)}D`,
  regex: (random) => `^${random.pick(TAGS)}-[0-9]+$`,
  pointer: (random) => `/${random.pick(TAGS)}/${random.int(0, 9)}`,
  relativePointer: (random) => `${random.int(0, 3)}/${random.pick(TAGS)}`,
  uriReference: (random) => `/${random.pick(TAGS)}/${random.int(1, 999)}`,
  uriTemplate: (random) => `https://${random.pick(DOMAINS)}/${random.pick(TAGS)}/{id}`,
  integer: (random) => String(random.int(1, 100_000)),
  decimal: (random) => (random.int(100, 99_999) / 100).toFixed(2),
};

/**
 * A variation of an example that keeps its shape: digits and identifier characters change, words
 * and separators stay (`usr_3k9f2a7d1b` → `usr_8q2m5x0c7e`, `WEB-12` → `QAP-48`).
 */
function like(example: string, random: Random): string {
  const upper = (): string => String.fromCharCode(random.int(65, 90));
  const lower = (): string => String.fromCharCode(random.int(97, 122));
  return example.replace(/[A-Za-z0-9]+/g, (chunk) => {
    const letters = /[A-Za-z]/.test(chunk);
    const digits = /\d/.test(chunk);
    // Words stay; short codes in capitals vary.
    if (letters && !digits) return /^[A-Z]{2,6}$/.test(chunk) ? chunk.replace(/./g, upper) : chunk;
    const isHex = letters && /^[0-9a-f]+$/.test(chunk);
    let index = 0;
    return chunk.replace(/./g, (char) => {
      const first = index++ === 0 && chunk.length > 1 && char !== '0';
      if (/\d/.test(char)) return String(first ? random.int(1, 9) : random.int(0, 9));
      if (isHex) return random.int(0, 15).toString(16);
      return char === char.toUpperCase() ? upper() : lower();
    });
  });
}

/** `text` padded with words or cut to fit `[minLength, maxLength]`. */
export function fit(text: string, random: Random, minLength = 0, maxLength = Infinity): string {
  let result = text;
  while (result.length < minLength)
    result += result === '' ? random.pick(LOREM) : ` ${random.pick(LOREM)}`;
  if (result.length > maxLength) result = result.slice(0, maxLength);
  // A cut can leave a trailing space or half a surrogate pair; replacing keeps the length.
  return result.replace(/ $|[\uD800-\uDBFF]$/, 'x');
}

/** Generated text of a kind, fitted to a length. */
export function generateText(
  kind: TextKind,
  random: Random,
  example = '',
  minLength = 0,
  maxLength = Infinity,
): string {
  return fit(TEXT[kind](random, example), random, minLength, maxLength);
}

// Dates ---------------------------------------------------------------------------------------

/** When a date usually lies: `createdAt` in the past, `dueDate` soon, `birthDate` years ago. */
export type DateWhen = 'past' | 'future' | 'soon' | 'birth' | 'any';

/** The date generated values without an example are placed around. */
const REFERENCE = Date.UTC(2026, 0, 1);
const DAY = 86_400_000;

/**
 * A date, date-time or time near `example` (or the reference date): earlier for `past`, later for
 * `future`, within weeks for `soon`, decades earlier for `birth`. Keeps the example's precision.
 */
export function dateNear(
  example: string | undefined,
  format: 'date' | 'date-time' | 'time',
  when: DateWhen,
  random: Random,
): string {
  const time = (): string =>
    `${pad(random.int(0, 23))}:${pad(random.int(0, 59))}:${pad(random.int(0, 59))}`;
  if (format === 'time') {
    const suffix =
      example === undefined ? 'Z' : (/^\d{2}:\d{2}:\d{2}(.*)$/.exec(example)?.[1] ?? '');
    return `${time()}${suffix.replace(/^\.\d+/, '')}`;
  }
  const parsed =
    example === undefined
      ? Number.NaN
      : Date.parse(format === 'date' ? `${example}T00:00:00Z` : example);
  const base = Number.isNaN(parsed) ? REFERENCE : parsed;
  const days =
    when === 'past'
      ? -random.int(1, 180)
      : when === 'future'
        ? random.int(1, 90)
        : when === 'soon'
          ? random.int(-14, 45)
          : when === 'birth'
            ? -random.int(18 * 365, 75 * 365)
            : random.int(-365, 365);
  const value = new Date(Math.floor(base / DAY) * DAY + days * DAY);
  if (format === 'date') return value.toISOString().slice(0, 10);
  const iso = `${value.toISOString().slice(0, 10)}T${time()}`;
  // The example's precision: `2026-10-20T09:30:00Z` or `…00.000Z`.
  return example !== undefined && !/\.\d+/.test(example) ? `${iso}Z` : `${iso}.000Z`;
}

// Files ---------------------------------------------------------------------------------------

/** What `new Blob()` accepts, in browsers and in Node.js. */
type BlobContent = NonNullable<ConstructorParameters<typeof Blob>[0]>[number];

let crcTable: Uint32Array | undefined;

function crc32(bytes: Uint8Array): number {
  if (crcTable === undefined) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts: readonly Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

const u32 = (value: number) =>
  new Uint8Array([value >>> 24, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
const latin1 = (text: string) => Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff);

/** A 64×64 PNG picture in two colors, valid for every decoder (stored, uncompressed blocks). */
function png(random: Random) {
  const size = 64;
  const color = (value: string): readonly number[] =>
    [1, 3, 5].map((i) => Number.parseInt(value.slice(i, i + 2), 16));
  const [background, accent] = [color(random.pick(COLORS)), color(random.pick(COLORS))];
  const cx = random.int(16, 48);
  const cy = random.int(16, 48);
  const radius = random.int(10, 28);
  const raw = new Uint8Array(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const inside = (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
      const rgb = inside ? accent : background;
      raw.set(rgb, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  // zlib: one stored deflate block per 65,535 bytes, then the Adler-32 checksum.
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  for (let offset = 0; offset < raw.length; offset += 65_535) {
    const chunk = raw.subarray(offset, offset + 65_535);
    const last = offset + 65_535 >= raw.length ? 1 : 0;
    blocks.push(
      new Uint8Array([
        last,
        chunk.length & 0xff,
        chunk.length >>> 8,
        ~chunk.length & 0xff,
        (~chunk.length >>> 8) & 0xff,
      ]),
      chunk,
    );
  }
  let a = 1;
  let b = 0;
  for (const byte of raw) {
    a = (a + byte) % 65_521;
    b = (b + a) % 65_521;
  }
  blocks.push(u32(((b << 16) | a) >>> 0));
  const chunk = (type: string, data: Uint8Array): Uint8Array => {
    const body = concat([latin1(type), data]);
    return concat([u32(data.length), body, u32(crc32(body))]);
  };
  return concat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', concat([u32(size), u32(size), new Uint8Array([8, 2, 0, 0, 0])])),
    chunk('IDAT', concat(blocks)),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/** A one-page PDF with a line of text. */
function pdf(random: Random) {
  const line = random
    .pick(SENTENCES)
    .replace(/[^\x20-\x7e]/g, "'")
    .replace(/[()\\]/g, '');
  const stream = `BT /F1 18 Tf 72 720 Td (${line}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${pad(offset, 10)} 00000 n \n`).join('')}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return latin1(body);
}

/** A short WAV file: a quiet tone. */
function wav(random: Random) {
  const rate = 8000;
  const samples = rate / 4;
  const frequency = random.pick([262, 330, 392, 440, 523]);
  const le = (value: number, bytes: number): number[] =>
    Array.from({ length: bytes }, (_, index) => (value >>> (index * 8)) & 0xff);
  const header = [
    ...latin1('RIFF'),
    ...le(36 + samples, 4),
    ...latin1('WAVEfmt '),
    ...le(16, 4),
    ...le(1, 2),
    ...le(1, 2),
    ...le(rate, 4),
    ...le(rate, 4),
    ...le(1, 2),
    ...le(8, 2),
    ...latin1('data'),
    ...le(samples, 4),
  ];
  const data = Array.from({ length: samples }, (_, index) =>
    Math.round(128 + 24 * Math.sin((2 * Math.PI * frequency * index) / rate)),
  );
  return new Uint8Array([...header, ...data]);
}

const decode64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

/** Tiny valid pictures in formats that cannot be generated in a few lines. */
const GIF = 'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const JPEG =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const WEBP = 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

/** The media type a file property's name suggests (`avatar` → PNG, `invoice` → PDF). */
function mediaTypeOfName(name: string): string {
  if (/image|photo|picture|avatar|logo|icon|thumbnail|banner|cover|screenshot/i.test(name))
    return 'image/png';
  if (/pdf|invoice|receipt|document|contract|report/i.test(name)) return 'application/pdf';
  if (/csv|export|spreadsheet/i.test(name)) return 'text/csv';
  if (/audio|sound|voice|recording/i.test(name)) return 'audio/wav';
  if (/text|note|log/i.test(name)) return 'text/plain';
  return 'application/octet-stream';
}

/** File content of a media type: a real picture, PDF, sound, archive or text. */
export function fileContent(mediaType: string, random: Random, name = ''): Blob {
  let type = mediaType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (type === '' || type.includes('*') || type === 'application/octet-stream') {
    const guessed = mediaTypeOfName(name);
    if (type === '' || type.includes('*') || guessed !== 'application/octet-stream') type = guessed;
  }
  const blob = (part: BlobContent): Blob => new Blob([part], { type });
  switch (type) {
    case 'image/png':
      return blob(png(random));
    case 'image/gif':
      return blob(decode64(GIF));
    case 'image/jpeg':
    case 'image/jpg':
      return blob(decode64(JPEG));
    case 'image/webp':
      return blob(decode64(WEBP));
    case 'image/svg+xml':
      return blob(
        decodeURIComponent(picture(random, 400, 300).slice('data:image/svg+xml,'.length)),
      );
    case 'application/pdf':
      return blob(pdf(random));
    case 'audio/wav':
    case 'audio/x-wav':
    case 'audio/wave':
      return blob(wav(random));
    case 'application/zip':
      return blob(new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...Array.from({ length: 18 }, () => 0)]));
    case 'text/csv':
      return blob(
        `id,name,email\n${Array.from({ length: 3 }, (_, index) => {
          const [first, last] = personName(random);
          return `${index + 1},${first} ${last},${ascii(first)}.${ascii(last)}@example.com`;
        }).join('\n')}\n`,
      );
    case 'application/json':
      return blob(JSON.stringify({ id: random.int(1, 999), name: random.pick(TAGS) }));
    case 'text/html':
      return blob(
        `<!doctype html><title>${random.pick(TAGS)}</title><p>${random.pick(SENTENCES)}</p>`,
      );
    case 'application/xml':
    case 'text/xml':
      return blob(
        `<?xml version="1.0" encoding="UTF-8"?><note><text>${random.pick(SENTENCES)}</text></note>`,
      );
    default:
      if (type.startsWith('text/')) return blob(sentences(random, 3));
      return blob(Uint8Array.from({ length: 256 }, () => random.int(0, 255)));
  }
}

/** The `index`th key of generated maps: `source`, `plan`, …, then `source2`, `plan2`, …. */
export function recordKey(index: number): string {
  const word = RECORD_KEYS[index % RECORD_KEYS.length] ?? 'key';
  return index < RECORD_KEYS.length ? word : `${word}${Math.floor(index / RECORD_KEYS.length) + 1}`;
}

/** A seed derived from text (never `0`), e.g. from a request. */
export function seedOf(text: string): number {
  return hash(text) || 1;
}

// Encodings -----------------------------------------------------------------------------------

/** How a value is written in XML (the XML Object): names, attributes, wrapping, namespaces. */
export interface XmlShape {
  readonly name?: string;
  readonly namespace?: string;
  readonly prefix?: string;
  readonly attribute?: boolean;
  readonly wrapped?: boolean;
  /** The value is its parent's text or CDATA content, or is written without an element. */
  readonly content?: 'text' | 'cdata' | 'none';
  readonly properties?: Readonly<Record<string, XmlShape>>;
  readonly items?: XmlShape;
}

const XML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

const escapeXml = (text: string): string =>
  text.replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char);

/** A valid XML name for a property name. */
const xmlName = (name: string): string =>
  name.replace(/[^\w.:-]/g, '_').replace(/^(?=[\d.:-]|$)/, '_');

function scalarText(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

function qualified(name: string, shape: XmlShape): string {
  return shape.prefix === undefined ? name : `${xmlName(shape.prefix)}:${name}`;
}

function xmlElement(value: unknown, shape: XmlShape, name: string): string {
  const tag = qualified(xmlName(name), shape);
  const namespace =
    shape.namespace === undefined
      ? ''
      : ` xmlns${shape.prefix === undefined ? '' : `:${xmlName(shape.prefix)}`}="${escapeXml(shape.namespace)}"`;
  if (value === null || value === undefined) return `<${tag}${namespace}/>`;
  if (Array.isArray(value)) {
    const items = shape.items ?? {};
    const inner = (value as unknown[])
      .map((item) => xmlElement(item, items, items.name ?? name))
      .join('');
    return `<${tag}${namespace}>${inner}</${tag}>`;
  }
  if (typeof value !== 'object' || value instanceof Date || value instanceof Blob)
    return `<${tag}${namespace}>${escapeXml(scalarText(value))}</${tag}>`;
  let attributes = '';
  let content = '';
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item === undefined) continue;
    const property = shape.properties?.[key] ?? {};
    const childName = property.name ?? key;
    if (property.attribute === true) {
      attributes += ` ${qualified(xmlName(childName), property)}="${escapeXml(scalarText(item))}"`;
    } else if (property.content === 'text') {
      content += escapeXml(scalarText(item));
    } else if (property.content === 'cdata') {
      content += `<![CDATA[${scalarText(item).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
    } else if (Array.isArray(item)) {
      // Items are named after the array unless they name themselves; `wrapped` adds an element.
      const items = property.items ?? {};
      const inner = (item as unknown[])
        .map((entry) => xmlElement(entry, items, items.name ?? childName))
        .join('');
      const wrapper = qualified(xmlName(childName), property);
      content += property.wrapped === true ? `<${wrapper}>${inner}</${wrapper}>` : inner;
    } else if (property.content === 'none' && typeof item === 'object' && item !== null) {
      content += xmlElement(item, property, childName).replace(/^<[^>]*>|<\/[^>]*>$/g, '');
    } else {
      content += xmlElement(item, property, childName);
    }
  }
  return `<${tag}${namespace}${attributes}>${content}</${tag}>`;
}

/** A value as an XML document, as its schema's XML Object describes it. */
export function xml(value: unknown, shape: XmlShape): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlElement(value, shape, shape.name ?? 'root')}\n`;
}

/** A server-sent event: `event`, `id` and `retry` fields, and `data` (JSON unless a string). */
function serverSentEvent(item: unknown): string {
  if (typeof item !== 'object' || item === null || Array.isArray(item))
    return `data: ${JSON.stringify(item)}\n\n`;
  const record = item as Record<string, unknown>;
  const lines: string[] = [];
  for (const field of ['event', 'id', 'retry'])
    if (record[field] !== undefined) lines.push(`${field}: ${scalarText(record[field])}`);
  const data = record['data'];
  const text = data === undefined ? '' : typeof data === 'string' ? data : JSON.stringify(data);
  for (const line of text.split('\n')) lines.push(`data: ${line}`);
  return `${lines.join('\n')}\n\n`;
}

/**
 * Items as a sequential media type writes them: JSON Lines and NDJSON (one JSON value per line),
 * JSON text sequences (RFC 7464) or server-sent events.
 */
export function sequence(items: unknown, mediaType: string): string {
  const values: readonly unknown[] = Array.isArray(items) ? items : [items];
  const type = mediaType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (type === 'text/event-stream') return values.map(serverSentEvent).join('');
  if (type === 'application/json-seq' || type.endsWith('+json-seq'))
    return values.map((item) => `\u001e${JSON.stringify(item)}\n`).join('');
  return values.map((item) => `${JSON.stringify(item)}\n`).join('');
}

// Entities ------------------------------------------------------------------------------------

/** The seeds that made the `id`s fixtures returned, so a later request for one gets the same value. */
const entities = new Map<string, number>();
const MAX_ENTITIES = 50_000;

/** The seed of the fixture that made an `id`, if one did. */
export function seedOfEntity(id: string): number | undefined {
  return entities.get(id);
}

// Fixtures ------------------------------------------------------------------------------------

/**
 * What generated fixtures make values with. Keys name the value within the fixture (`'owner.name'`,
 * `'tags'`), so that adding a property to a schema does not change the others.
 */
export class Fake {
  readonly #seed: number;
  readonly #path: string;
  readonly #empty: boolean;
  /** Whether this makes a fixture's own value, not an item of one of its arrays. */
  readonly #root: boolean;

  constructor(options: FixtureOptions = {}, path = '', root = true) {
    this.#seed = Number.isFinite(options.seed) ? Math.trunc(options.seed ?? 0) >>> 0 : 0;
    this.#path = path;
    this.#empty = options.empty === true;
    this.#root = root;
  }

  /** Whether this makes the specification's examples (seed `0`). */
  get canonical(): boolean {
    return this.#seed === 0;
  }

  #random(key: string): Random {
    return new Random(mix(this.#seed, `${this.#path}${key}`));
  }

  #options(seed: number): FixtureOptions {
    return this.#empty ? { seed, empty: true } : { seed };
  }

  /** The options of the fixture nested at `key`: examples within examples, otherwise its own seed. */
  at(key = ''): FixtureOptions {
    return this.#options(this.canonical ? 0 : mix(this.#seed, `${this.#path}${key}/`));
  }

  /**
   * What `make` returns: it is told whether to make the specification's example (seed `0`, not
   * an empty state) or another value. One callback lets TypeScript type both from the context.
   */
  example<T>(make: (examples: boolean) => T): T {
    return make(this.canonical && !this.#empty);
  }

  /** Text of a kind (a name, a sentence…), or `example` for the examples. */
  text(key: string, example: string, kind: TextKind, minLength = 0, maxLength = Infinity): string {
    if (this.canonical) return example;
    const random = this.#random(key);
    // Longer text keeps the example's wording a third of the time.
    const long =
      kind === 'sentence' || kind === 'paragraph' || kind === 'task' || kind === 'headline';
    const made =
      long && example.includes(' ') && random.chance(1 / 3)
        ? like(example, random)
        : TEXT[kind](random, example);
    return fit(made, random, minLength, maxLength);
  }

  /** A string matching `pattern`, or `example` for the examples. */
  pattern(
    key: string,
    example: string,
    pattern: string,
    minLength = 0,
    maxLength = Infinity,
    kind?: TextKind,
  ): string {
    if (this.canonical) return example;
    const random = this.#random(key);
    // Realistic text of the property's kind when it matches (a color from the palette).
    if (kind !== undefined)
      for (let attempt = 0; attempt < 3; attempt++) {
        const made = generateText(kind, random, example, minLength, maxLength);
        if (matchesPattern(pattern, made) === true) return made;
      }
    return samplePattern(pattern, random, minLength, maxLength) ?? example;
  }

  /** An integer in `[min, max]`. */
  int(key: string, example: number, min: number, max: number): number {
    return this.canonical ? example : this.#random(key).int(min, max);
  }

  /** A number in `[min, max]` with up to `digits` decimals, excluding open bounds. */
  number(
    key: string,
    example: number,
    min: number,
    max: number,
    digits = 2,
    exclusive: 'none' | 'min' | 'max' | 'both' = 'none',
  ): number {
    if (this.canonical) return example;
    const value = Number((min + this.#random(key).next() * (max - min)).toFixed(digits));
    const low = exclusive === 'min' || exclusive === 'both' ? value > min : value >= min;
    const high = exclusive === 'max' || exclusive === 'both' ? value < max : value <= max;
    return low && high ? value : example;
  }

  /** A multiple of `step` between `first * step` and `last * step`. */
  multiple(
    key: string,
    example: number,
    first: number,
    last: number,
    step: number,
    digits: number,
  ): number {
    return this.canonical
      ? example
      : Number((this.#random(key).int(first, last) * step).toFixed(digits));
  }

  /** `true` with probability `rate`. */
  bool(key: string, example: boolean, rate = 0.5): boolean {
    return this.canonical ? example : this.#random(key).chance(rate);
  }

  /** A date, date-time or time near the example. */
  date(
    key: string,
    example: string,
    format: 'date' | 'date-time' | 'time',
    when: DateWhen,
  ): string {
    return this.canonical ? example : dateNear(example, format, when, this.#random(key));
  }

  /** One of `values`: the first for the examples. */
  pick<T>(key: string, values: readonly [T, ...T[]]): T {
    return this.canonical ? values[0] : this.#random(key).pick(values);
  }

  /** The value `make` returns for one of `count` alternatives: the first for the examples. */
  oneOf<T>(key: string, count: number, make: (index: number) => T): T {
    return make(this.canonical ? 0 : this.#random(`${key}#`).int(0, count - 1));
  }

  /** `null` sometimes (never for the examples), otherwise the value `make` returns. */
  nullable<T>(key: string, make: () => T, rate = 0.2): T | null {
    return !this.canonical && this.#random(`${key}?`).chance(rate) ? null : make();
  }

  /**
   * An array of `count` items for the examples, otherwise of `min` to `max` items (`min` in empty
   * states). Item 0 of the examples is made of examples too. With `unique`, equal items are left out.
   */
  array<T>(
    key: string,
    count: number,
    min: number,
    max: number,
    make: (item: Fake, index: number) => T,
    unique = false,
  ): T[] {
    const length = this.#empty
      ? min
      : this.canonical
        ? count
        : this.#random(`${key}[]`).int(min, max);
    const items: T[] = [];
    const seen = new Set<string>();
    for (let index = 0; items.length < length && index < length * 3; index++) {
      const seed =
        this.canonical && index === 0 ? 0 : mix(this.#seed, `${this.#path}${key}[${index}]`);
      const item = make(new Fake(this.#options(seed), '', false), index);
      if (unique) {
        const identity = JSON.stringify(item);
        if (seen.has(identity)) continue;
        seen.add(identity);
      }
      items.push(item);
    }
    return items;
  }

  /** An object with `count` (or `min` to `max`) generated keys, for maps (`additionalProperties`). */
  record<T>(
    key: string,
    count: number,
    min: number,
    max: number,
    make: (item: Fake, name: string) => T,
  ): Record<string, T> {
    const random = this.#random(`${key}{}`);
    const length = this.#empty ? min : this.canonical ? count : random.int(min, max);
    const result: Record<string, T> = {};
    for (let index = 0; index < length; index++) {
      const name = recordKey(index);
      const seed =
        this.canonical && index === 0 ? 0 : mix(this.#seed, `${this.#path}${key}{${name}}`);
      result[name] = make(new Fake(this.#options(seed), '', false), name);
    }
    return result;
  }

  /**
   * `value` with some of its optional properties left out (none for the examples); properties of
   * `keep` (the overrides) always stay.
   */
  optional<T>(path: string, value: T, keys: readonly string[], keep?: object): T {
    if (this.canonical) return value;
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (keep !== undefined && Object.prototype.hasOwnProperty.call(keep, key)) continue;
      if (this.#random(`${path}${path === '' ? '' : '.'}${key}~`).chance(0.25)) delete record[key];
    }
    return value;
  }

  /** File content of a media type (a picture, a PDF…), named after the property that holds it. */
  file(key: string, mediaType: string): Blob {
    return fileContent(mediaType, this.#random(key), key);
  }

  /** Remembers which seed made a fixture's `id`, so that a request for it gets the same fixture. */
  id<T>(value: T): T {
    if (this.#root && (typeof value === 'string' || typeof value === 'number')) {
      if (entities.size >= MAX_ENTITIES) entities.clear();
      entities.set(String(value), this.#seed);
    }
    return value;
  }
}

/** What a generated fixture makes its value with. */
export function fake(options?: FixtureOptions): Fake {
  return new Fake(options);
}
