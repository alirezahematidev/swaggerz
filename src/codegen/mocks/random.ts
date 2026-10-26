/**
 * Deterministic sample values. Every value comes from a pseudo-random sequence seeded by the path
 * of the schema it is generated for, so the same specification produces the same fixtures on
 * every run and on every machine, and unrelated changes elsewhere do not shift them.
 */

/** FNV-1a (32 bits). */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

/** A pseudo-random sequence (mulberry32) seeded by a string. */
export class Random {
  #state: number;

  constructor(seed: string) {
    this.#state = hash(seed);
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

  /** One of `items`, which must not be empty. */
  pick<T>(items: readonly [T, ...T[]]): T {
    return items[this.int(0, items.length - 1)] ?? items[0];
  }
}

const WORDS = [
  'lorem',
  'ipsum',
  'dolor',
  'sit',
  'amet',
  'consectetur',
  'adipiscing',
  'elit',
  'sed',
  'eiusmod',
  'tempor',
  'incididunt',
  'labore',
  'dolore',
  'magna',
  'aliqua',
  'enim',
  'minim',
  'veniam',
  'nostrud',
  'ullamco',
  'laboris',
  'aliquip',
  'commodo',
  'consequat',
  'aute',
  'irure',
  'velit',
  'esse',
  'cillum',
  'fugiat',
  'nulla',
] as const;

/** A lowercase placeholder word. */
export function word(random: Random): string {
  return random.pick(WORDS);
}

/** Two placeholder words, e.g. `dolor magna`. */
export function words(random: Random): string {
  return `${word(random)} ${word(random)}`;
}

const pad = (value: number, length = 2): string => String(value).padStart(length, '0');

/** A date between 2020 and 2026 as `YYYY-MM-DD` (day 1–28, so every month has it). */
function date(random: Random): string {
  return `${random.int(2020, 2026)}-${pad(random.int(1, 12))}-${pad(random.int(1, 28))}`;
}

function time(random: Random): string {
  return `${pad(random.int(0, 23))}:${pad(random.int(0, 59))}:${pad(random.int(0, 59))}`;
}

/** An RFC 9562 version 4 UUID. */
function uuid(random: Random): string {
  const hex = Array.from({ length: 32 }, (_, index) => {
    if (index === 12) return '4';
    if (index === 16) return (8 + random.int(0, 3)).toString(16);
    return random.int(0, 15).toString(16);
  }).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A string in a JSON Schema / OpenAPI `format`, or `undefined` for unknown formats. */
export function formatted(format: string, random: Random): string | undefined {
  switch (format) {
    case 'date-time':
      return `${date(random)}T${time(random)}Z`;
    case 'date':
      return date(random);
    case 'time':
      return `${time(random)}Z`;
    case 'duration':
      return `P${random.int(1, 30)}D`;
    case 'email':
    case 'idn-email':
      return `${word(random)}.${word(random)}@example.com`;
    case 'hostname':
    case 'idn-hostname':
      return `${word(random)}.example.com`;
    case 'ipv4':
      // 192.0.2.0/24 is reserved for documentation (RFC 5737).
      return `192.0.2.${random.int(1, 254)}`;
    case 'ipv6':
      return `2001:db8::${random.int(1, 0xffff).toString(16)}`;
    case 'uri':
    case 'url':
    case 'iri':
      return `https://example.com/${word(random)}`;
    case 'uri-reference':
    case 'iri-reference':
      return `/${word(random)}`;
    case 'uri-template':
      return `https://example.com/${word(random)}/{id}`;
    case 'uuid':
      return uuid(random);
    case 'byte':
      return btoa(words(random));
    case 'password':
      return `${word(random)}-${random.int(1000, 9999)}`;
    case 'json-pointer':
      return `/${word(random)}`;
    case 'relative-json-pointer':
      return `0/${word(random)}`;
    case 'regex':
      return '^[a-z]+$';
    case 'int32':
    case 'int64':
    case 'integer':
      return String(random.int(1, 100_000));
    case 'number':
    case 'decimal':
    case 'double':
    case 'float':
      return (random.int(100, 99_999) / 100).toFixed(2);
    default:
      return undefined;
  }
}

/** A string suggested by a property name (`email`, `website`), for strings without a format. */
export function byName(name: string, random: Random): string | undefined {
  if (/(?:^|[^a-z])e-?mail$|^e-?mail/i.test(name)) return formatted('email', random);
  if (/(?:url|uri|href|link|website)$/i.test(name)) return formatted('uri', random);
  if (/^(?:id|ID)$|_(?:id|ID)$|[a-z\d](?:Id|ID)$/.test(name))
    return `${word(random)}-${random.int(100, 999)}`;
  return undefined;
}

/** `text` padded with words or cut to fit `[minLength, maxLength]`. */
export function fit(text: string, random: Random, minLength = 0, maxLength = Infinity): string {
  let result = text;
  while (result.length < minLength) result += result === '' ? word(random) : ` ${word(random)}`;
  if (result.length > maxLength) result = result.slice(0, maxLength);
  // A cut can leave a trailing space; replacing it keeps the length.
  return result.endsWith(' ') ? `${result.slice(0, -1)}x` : result;
}
