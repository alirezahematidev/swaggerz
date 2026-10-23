export type NamingStyle = 'camelCase' | 'PascalCase' | 'snake_case' | 'kebab-case' | 'preserve';

/** JavaScript reserved words plus TypeScript type keywords that cannot name a type or binding. */
export const RESERVED_WORDS: ReadonlySet<string> = new Set([
  'abstract',
  'any',
  'arguments',
  'as',
  'asserts',
  'async',
  'await',
  'bigint',
  'boolean',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'constructor',
  'continue',
  'debugger',
  'declare',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'eval',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'function',
  'get',
  'if',
  'implements',
  'import',
  'in',
  'infer',
  'instanceof',
  'interface',
  'is',
  'keyof',
  'let',
  'module',
  'namespace',
  'never',
  'new',
  'null',
  'number',
  'object',
  'of',
  'package',
  'private',
  'protected',
  'public',
  'readonly',
  'require',
  'return',
  'satisfies',
  'set',
  'static',
  'string',
  'super',
  'switch',
  'symbol',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'typeof',
  'undefined',
  'unique',
  'unknown',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

/**
 * Global types and values referenced by generated code. A model with one of these names is
 * imported under an alias inside generated modules, so it never shadows the global.
 */
export const GLOBAL_NAMES: ReadonlySet<string> = new Set([
  'AbortSignal',
  'Array',
  'ArrayBuffer',
  'ArrayBufferView',
  'Awaited',
  'Blob',
  'Boolean',
  'Date',
  'Error',
  'Exclude',
  'Extract',
  'FormData',
  'Function',
  'Headers',
  'Map',
  'NonNullable',
  'Number',
  'Object',
  'Omit',
  'Parameters',
  'Partial',
  'Pick',
  'Promise',
  'Readonly',
  'ReadonlyArray',
  'Record',
  'Required',
  'Response',
  'ReturnType',
  'Set',
  'String',
  'Symbol',
  'Uint8Array',
  'URLSearchParams',
]);

/**
 * Splits a name into words on separators and camelCase boundaries, keeping acronyms intact:
 * `getPetByID` → `get Pet By ID`, `HTTPServer` → `HTTP Server`, `list_pets` → `list pets`.
 */
export function splitWords(input: string): string[] {
  const normalized = input
    // Strip diacritics so `café` becomes `cafe` rather than losing the letter.
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return normalized.split(/[^A-Za-z\d]+/).filter((word) => word !== '');
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Applies a case style. Acronyms are preserved unless the whole input is uppercase. */
export function applyCase(input: string, style: NamingStyle): string {
  if (style === 'preserve') return input;
  const shouting = input === input.toUpperCase() && /[A-Z]/.test(input);
  const words = splitWords(shouting ? input.toLowerCase() : input);
  if (words.length === 0) return '';
  switch (style) {
    case 'camelCase':
      return words.map((w, i) => (i === 0 ? lowerFirstWord(w) : capitalize(w))).join('');
    case 'PascalCase':
      return words.map(capitalize).join('');
    case 'snake_case':
      return words.map((w) => w.toLowerCase()).join('_');
    case 'kebab-case':
      return words.map((w) => w.toLowerCase()).join('-');
  }
}

/** Lowercases a leading word; a leading acronym (`URL`) is fully lowercased (`url`). */
function lowerFirstWord(word: string): string {
  if (word === word.toUpperCase()) return word.toLowerCase();
  return word.charAt(0).toLowerCase() + word.slice(1);
}

/** Converts arbitrary text into a valid, non-reserved identifier in the given style. */
export function toIdentifier(input: string, style: NamingStyle): string {
  let name = applyCase(input, style);
  name = name.replace(/[^A-Za-z\d_$]/g, '');
  if (name === '') name = style === 'PascalCase' ? 'Unnamed' : 'unnamed';
  if (/^\d/.test(name)) name = `_${name}`;
  if (RESERVED_WORDS.has(name)) name = `${name}_`;
  return name;
}

/**
 * Converts text into an identifier-like property name. Unlike {@link toIdentifier}, reserved
 * words are kept: they are valid property names (`params.default`).
 */
export function toPropertyName(input: string, style: NamingStyle): string {
  let name = applyCase(input, style).replace(/[^A-Za-z\d_$]/g, '');
  if (name === '') name = 'value';
  return /^\d/.test(name) ? `_${name}` : name;
}

/**
 * Device names Windows reserves in every directory, whatever the extension: `con.ts` or a
 * directory `aux` cannot be created there.
 */
const WINDOWS_DEVICE_NAMES = /^(?:con|prn|aux|nul|com\d|lpt\d)$/i;

/**
 * File or directory name (without extension) for an identifier. Names Windows reserves get a `_`
 * on every platform (`con_`), so the output is the same everywhere.
 */
export function toFileName(
  input: string,
  style: 'kebab-case' | 'camelCase' | 'PascalCase' | 'snake_case',
): string {
  const name = applyCase(input, style).replace(/[^A-Za-z\d_-]/g, '');
  if (name === '') return 'unnamed';
  return WINDOWS_DEVICE_NAMES.test(name) ? `${name}_` : name;
}

export function isIdentifier(name: string): boolean {
  return /^[A-Za-z_$][A-Za-z\d_$]*$/.test(name) && !RESERVED_WORDS.has(name);
}

/** Valid as a property name without quotes (reserved words are allowed as property names). */
export function isPropertyIdentifier(name: string): boolean {
  return /^[A-Za-z_$][A-Za-z\d_$]*$/.test(name);
}

/**
 * Allocates unique names. Names are compared case-sensitively by default; file paths use
 * case-insensitive comparison so output is safe on macOS and Windows file systems.
 */
export class NameRegistry {
  readonly #taken = new Set<string>();
  readonly #caseInsensitive: boolean;

  constructor(options: { caseInsensitive?: boolean } = {}) {
    this.#caseInsensitive = options.caseInsensitive ?? false;
  }

  #key(name: string): string {
    return this.#caseInsensitive ? name.toLowerCase() : name;
  }

  reserve(name: string): void {
    this.#taken.add(this.#key(name));
  }

  has(name: string): boolean {
    return this.#taken.has(this.#key(name));
  }

  /** Returns `preferred`, or `preferred` + the smallest free numeric suffix. */
  claim(preferred: string, separator = ''): string {
    let candidate = preferred;
    for (let index = 2; this.has(candidate); index++)
      candidate = `${preferred}${separator}${index}`;
    this.reserve(candidate);
    return candidate;
  }
}

/** Derives an operation name from method and path, e.g. `GET /pets/{id}` → `getPetsById`. */
export function nameFromPath(method: string, path: string): string {
  const parts = path
    .split('/')
    .filter((segment) => segment !== '')
    .map((segment) => {
      const match = /^\{(.+)\}$/.exec(segment);
      return match?.[1] === undefined
        ? applyCase(segment, 'PascalCase')
        : `By${applyCase(match[1], 'PascalCase')}`;
    });
  return `${method.toLowerCase()}${parts.join('')}`;
}
