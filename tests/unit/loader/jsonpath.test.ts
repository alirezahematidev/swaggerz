import { describe, expect, it } from 'vitest';
import {
  JsonPathError,
  normalizedPath,
  parseJsonPath,
  queryJsonPath,
} from '../../../src/loader/jsonpath.ts';

/**
 * A sample of RFC 9535. The implementation was also checked against the full JSONPath Compliance
 * Test Suite (github.com/jsonpath-standard/jsonpath-compliance-test-suite): every value and every
 * normalized path matches.
 */
const document = {
  store: {
    book: [
      { category: 'reference', author: 'Nigel Rees', title: 'Sayings', price: 8.95 },
      { category: 'fiction', author: 'Evelyn Waugh', title: 'Sword', price: 12.99 },
      {
        category: 'fiction',
        author: 'Herman Melville',
        title: 'Moby Dick',
        isbn: '0-553',
        price: 8.99,
      },
      {
        category: 'fiction',
        author: 'J. R. R. Tolkien',
        title: 'Rings',
        isbn: '0-395',
        price: 22.99,
      },
    ],
    bicycle: { color: 'red', price: 399 },
  },
  paths: { '/pets': { get: { operationId: 'listPets' } }, "it's": 1 },
};

const values = (expression: string): unknown[] =>
  queryJsonPath(document, expression).map((node) => node.value);
const paths = (expression: string): string[] =>
  queryJsonPath(document, expression).map((node) => normalizedPath(node.path));

describe('JSONPath (RFC 9535)', () => {
  it('selects by name, index, wildcard and slice', () => {
    expect(values('$.store.bicycle.color')).toEqual(['red']);
    expect(values("$['store']['book'][-1].title")).toEqual(['Rings']);
    expect(values('$.store.book[1:3].title')).toEqual(['Sword', 'Moby Dick']);
    expect(values('$.store.book[::-2].title')).toEqual(['Rings', 'Sword']);
    expect(values('$.store.book[0, 2].author')).toEqual(['Nigel Rees', 'Herman Melville']);
    expect(values('$.store.*').length).toBe(2);
  });

  it('descends recursively in document order', () => {
    expect(values('$..price')).toEqual([8.95, 12.99, 8.99, 22.99, 399]);
    expect(values('$..book[?@.isbn].title')).toEqual(['Moby Dick', 'Rings']);
  });

  it('filters with comparisons, logic and functions', () => {
    expect(values('$.store.book[?@.price < 10].title')).toEqual(['Sayings', 'Moby Dick']);
    expect(values('$.store.book[?@.price < 10 && @.category == "fiction"].title')).toEqual([
      'Moby Dick',
    ]);
    expect(values('$.store.book[?!(@.price < 10)].title')).toEqual(['Sword', 'Rings']);
    expect(values('$.store.book[?length(@.title) == 5].title')).toEqual(['Sword', 'Rings']);
    expect(values('$.store.book[?match(@.author, "J.*")].title')).toEqual(['Rings']);
    expect(values('$.store.book[?search(@.author, "Mel")].title')).toEqual(['Moby Dick']);
    expect(values('$.store[?count(@.*) == 2].color')).toEqual(['red']);
    expect(values('$.store.book[?value(@..isbn) == "0-395"].title')).toEqual(['Rings']);
    // A query comparing nothing with nothing is true; with a value, false.
    expect(values('$.store.book[?@.missing == @.other].title')).toHaveLength(4);
    expect(values('$.store.book[?@.missing == 1].title')).toEqual([]);
  });

  it('reads names that need quoting', () => {
    expect(values("$.paths['/pets'].get.operationId")).toEqual(['listPets']);
    expect(values('$.paths["it\'s"]')).toEqual([1]);
    expect(paths('$.paths.*')).toEqual(["$['paths']['/pets']", "$['paths']['it\\'s']"]);
  });

  it.each([
    ['$.paths./pets', /member name/],
    ['store', /starts with `\$`/],
    ['$[?@.price]+', /Unexpected/],
    ['$[?length(@.*) == 1]', /must be a value/],
    ['$[?count(@) == 1 && unknown(@)]', /Unknown function/],
    ['$[?@..a == 1]', /singular queries/],
    ['$[?match(@.a, "b")== true]', /cannot be compared/],
    ['$[01]', /Expected "\]"/],
    ["$['\\x']", /Invalid escape/],
  ])('rejects %s', (expression, message) => {
    expect(() => parseJsonPath(expression)).toThrow(JsonPathError);
    expect(() => parseJsonPath(expression)).toThrow(message);
  });

  it('escapes normalized paths', () => {
    expect(normalizedPath(['a\nb', 0, "c'd"])).toBe("$['a\\nb'][0]['c\\'d']");
  });
});
