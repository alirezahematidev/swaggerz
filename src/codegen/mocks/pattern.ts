import type { Random } from './random.ts';

/**
 * Strings matching a `pattern`. Patterns are parsed, never executed: specifications are untrusted
 * input, and running their regular expressions risks catastrophic backtracking. Lookarounds,
 * backreferences and Unicode property escapes are not supported.
 */

type Range = readonly [from: number, to: number];

type Node =
  | { readonly kind: 'set'; readonly ranges: readonly Range[]; readonly negated: boolean }
  | { readonly kind: 'sequence'; readonly items: readonly Node[] }
  | { readonly kind: 'alternation'; readonly options: readonly Node[] }
  | { readonly kind: 'repeat'; readonly item: Node; readonly min: number; readonly max: number }
  | { readonly kind: 'empty' };

class Unsupported extends Error {}

const DIGITS: readonly Range[] = [[0x30, 0x39]];
const WORD: readonly Range[] = [
  [0x61, 0x7a],
  [0x41, 0x5a],
  [0x30, 0x39],
  [0x5f, 0x5f],
];
const SPACE: readonly Range[] = [[0x20, 0x20]];
/** Characters negated sets choose from: letters and digits first, then punctuation. */
const POOL = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.~ !@#$%&*+=:;,?/';

const MAX_PATTERN = 1000;
const MAX_DEPTH = 32;
const MAX_REPEAT = 1000;
const MAX_LENGTH = 10_000;

class Parser {
  readonly #source: string;
  #index = 0;
  #depth = 0;

  constructor(source: string) {
    this.#source = source;
  }

  parse(): Node {
    const node = this.#alternation();
    if (this.#index < this.#source.length) throw new Unsupported('unbalanced parenthesis');
    return node;
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
        return { kind: 'set', ranges: [[0x0a, 0x0a]], negated: true };
      case '^':
      case '$':
        return { kind: 'empty' };
      case '\\':
        return this.#escape();
      default: {
        const code = this.#codePoint();
        return { kind: 'set', ranges: [[code, code]], negated: false };
      }
    }
  }

  #group(): Node {
    if (this.#peek() === '?') {
      const next = this.#peek(1);
      if (next === ':') this.#index += 2;
      else if (next === '<' && this.#peek(2) !== '=' && this.#peek(2) !== '!') {
        const end = this.#source.indexOf('>', this.#index);
        if (end === -1) throw new Unsupported('group name');
        this.#index = end + 1;
      } else throw new Unsupported('lookaround');
    }
    if (++this.#depth > MAX_DEPTH) throw new Unsupported('nesting');
    const node = this.#alternation();
    this.#depth--;
    if (this.#peek() !== ')') throw new Unsupported('unbalanced parenthesis');
    this.#index++;
    return node;
  }

  /** An escape outside a class. */
  #escape(): Node {
    const char = this.#peek();
    if (char === 'b' || char === 'B') {
      this.#index++;
      return { kind: 'empty' };
    }
    const classEscape = this.#classEscape();
    if (classEscape !== undefined) return classEscape;
    const code = this.#characterEscape();
    return { kind: 'set', ranges: [[code, code]], negated: false };
  }

  /** `\d`, `\w`, `\s` and their negations. */
  #classEscape(): Extract<Node, { kind: 'set' }> | undefined {
    const char = this.#peek();
    const ranges =
      char === 'd' || char === 'D'
        ? DIGITS
        : char === 'w' || char === 'W'
          ? WORD
          : char === 's' || char === 'S'
            ? SPACE
            : undefined;
    if (ranges === undefined || char === undefined) return undefined;
    this.#index++;
    return { kind: 'set', ranges, negated: char === char.toUpperCase() };
  }

  /** The character of an escape such as `\n`, `\x41`, `\u{41}` or `\.`. */
  #characterEscape(): number {
    const char = this.#peek();
    if (char === undefined) throw new Unsupported('trailing backslash');
    this.#index++;
    const simple: Record<string, number> = { t: 9, n: 10, v: 11, f: 12, r: 13, '0': 0 };
    if (Object.prototype.hasOwnProperty.call(simple, char)) return simple[char] ?? 0;
    const hex = (length: number): number => {
      const digits = this.#source.slice(this.#index, this.#index + length);
      if (!new RegExp(`^[0-9a-fA-F]{${length}}$`).test(digits)) throw new Unsupported('escape');
      this.#index += length;
      return Number.parseInt(digits, 16);
    };
    if (char === 'x') return hex(2);
    if (char === 'u') {
      if (this.#peek() !== '{') return hex(4);
      const end = this.#source.indexOf('}', this.#index);
      const digits = this.#source.slice(this.#index + 1, end);
      if (end === -1 || !/^[0-9a-fA-F]{1,6}$/.test(digits)) throw new Unsupported('escape');
      this.#index = end + 1;
      return Number.parseInt(digits, 16);
    }
    // Backreferences, named references, Unicode properties and control characters.
    if (/[1-9kpPc]/.test(char)) throw new Unsupported(`\\${char}`);
    return char.codePointAt(0) ?? 0;
  }

  #class(): Node {
    const negated = this.#peek() === '^';
    if (negated) this.#index++;
    const ranges: Range[] = [];
    for (;;) {
      const char = this.#peek();
      if (char === undefined) throw new Unsupported('unterminated class');
      // In JavaScript, `]` ends a class even right after `[` or `[^`.
      if (char === ']') {
        this.#index++;
        break;
      }
      const from = this.#classAtom(ranges);
      if (from === undefined) continue;
      if (this.#peek() === '-' && this.#peek(1) !== ']' && this.#peek(1) !== undefined) {
        this.#index++;
        const to = this.#classAtom(ranges);
        if (to === undefined || to < from) throw new Unsupported('class range');
        ranges.push([from, to]);
      } else {
        ranges.push([from, from]);
      }
    }
    return { kind: 'set', ranges, negated };
  }

  /** One character of a class; class escapes (`\d`) are added to `ranges` directly. */
  #classAtom(ranges: Range[]): number | undefined {
    const char = this.#peek() ?? '';
    this.#index++;
    if (char !== '\\') return this.#codePoint();
    if (this.#peek() === 'b') {
      this.#index++;
      return 8;
    }
    const classEscape = this.#classEscape();
    if (classEscape === undefined) return this.#characterEscape();
    if (!classEscape.negated) ranges.push(...classEscape.ranges);
    // `\S` inside a class (`[\s\S]`): the characters of the pool it does not exclude.
    else
      for (const pooled of POOL) {
        const code = pooled.codePointAt(0) ?? 0;
        if (!inRanges(code, classEscape.ranges)) ranges.push([code, code]);
      }
    return undefined;
  }
}

function inRanges(code: number, ranges: readonly Range[]): boolean {
  return ranges.some(([from, to]) => code >= from && code <= to);
}

function character(node: Extract<Node, { kind: 'set' }>, random: Random): string {
  if (node.negated) {
    const [first, ...rest] = POOL.split('').filter(
      (char) => !inRanges(char.codePointAt(0) ?? 0, node.ranges),
    );
    if (first === undefined) throw new Unsupported('empty class');
    return random.pick([first, ...rest]);
  }
  // The printable ASCII part of the ranges, when they have one, keeps fixtures readable.
  const printable = node.ranges.flatMap(([from, to]): Range[] => {
    const low = Math.max(from, 0x20);
    const high = Math.min(to, 0x7e);
    return low <= high ? [[low, high]] : [];
  });
  const [first, ...rest] = printable.length > 0 ? printable : node.ranges;
  if (first === undefined) throw new Unsupported('empty class');
  const [from, to] = random.pick([first, ...rest]);
  return String.fromCodePoint(random.int(from, to));
}

function generate(node: Node, random: Random, extra: number): string {
  switch (node.kind) {
    case 'empty':
      return '';
    case 'set':
      return character(node, random);
    case 'sequence': {
      let result = '';
      for (const item of node.items) {
        result += generate(item, random, extra);
        if (result.length > MAX_LENGTH) throw new Unsupported('too long');
      }
      return result;
    }
    case 'alternation': {
      const [first, ...rest] = node.options;
      return first === undefined ? '' : generate(random.pick([first, ...rest]), random, extra);
    }
    case 'repeat': {
      const count = Math.min(node.max, node.min + extra);
      let result = '';
      for (let index = 0; index < count; index++) {
        result += generate(node.item, random, extra);
        if (result.length > MAX_LENGTH) throw new Unsupported('too long');
      }
      return result;
    }
  }
}

/**
 * A string matching `pattern` whose length is within `[minLength, maxLength]`, or `undefined` when
 * the pattern uses unsupported syntax or no such string was found.
 */
export function samplePattern(
  pattern: string,
  random: Random,
  minLength = 0,
  maxLength = Infinity,
): string | undefined {
  if (pattern.length > MAX_PATTERN) return undefined;
  try {
    const node = new Parser(pattern).parse();
    // More repetitions of unbounded quantifiers until the string is long enough.
    for (const extra of [0, 1, 2, 4, 8, 16, 32, 64]) {
      const text = generate(node, random, extra);
      if (text.length > maxLength) return undefined;
      if (text.length >= minLength) return text;
    }
    return undefined;
  } catch (error) {
    if (error instanceof Unsupported) return undefined;
    throw error;
  }
}
