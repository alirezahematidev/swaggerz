import { describe, expect, it } from 'vitest';
import {
  literal,
  propertyAccess,
  propertyKey,
  quote,
  renderJsDoc,
} from '../../../src/codegen/printer.ts';

describe('quote', () => {
  it('escapes quotes, backslashes, control and line-separator characters', () => {
    expect(quote("it's")).toBe("'it\\'s'");
    expect(quote('a\\b')).toBe("'a\\\\b'");
    expect(quote('line\nbreak ')).toBe("'line\\nbreak\\u2028'");
    expect(quote('\u0000')).toBe("'\\u0000'");
  });
});

describe('property keys', () => {
  it('quotes keys that are not identifiers', () => {
    expect(propertyKey('name')).toBe('name');
    expect(propertyKey('default')).toBe('default');
    expect(propertyKey('x-rate-limit')).toBe("'x-rate-limit'");
    expect(propertyAccess('params', 'page[size]')).toBe("params['page[size]']");
    expect(propertyAccess('params', 'id', true)).toBe('params?.id');
    expect(propertyAccess('params', 'a-b', true)).toBe("params?.['a-b']");
  });

  it('renders __proto__ as a computed key, which creates a property instead of a prototype', () => {
    expect(propertyKey('__proto__')).toBe("['__proto__']");
    expect(literal(JSON.parse('{"__proto__":1,"a":2}'))).toBe("{ ['__proto__']: 1, a: 2 }");
  });

  it('renders JSON literals', () => {
    expect(literal({ a: [1, 'x', null, true], 'b-c': {} })).toBe(
      "{ a: [1, 'x', null, true], 'b-c': {} }",
    );
  });
});

describe('renderJsDoc', () => {
  it('escapes comment terminators and accidental tags', () => {
    const doc = renderJsDoc({
      summary: 'Ends */ here',
      description: '@internal is text\nnormal line',
      tags: [{ tag: 'deprecated' }],
    });
    expect(doc).toBe(
      [
        '/**',
        ' * Ends *\\/ here',
        ' *',
        ' * \\@internal is text',
        ' * normal line',
        ' *',
        ' * @deprecated',
        ' */',
        '',
      ].join('\n'),
    );
  });

  it('escapes tags in the middle of lines and in every line of tag text', () => {
    const doc = renderJsDoc({
      summary: 'Use the @deprecated endpoint; mail admin@example.com',
      tags: [
        { tag: 'property', text: '{number} [limit] - Max items @property {number} evil' },
        { tag: 'see', text: 'https://example.com docs\n@returns {Promise<number>} x' },
        { tag: 'returns', text: 'See {@link Pet}.' },
      ],
    });
    expect(doc).toBe(
      [
        '/**',
        ' * Use the \\@deprecated endpoint; mail admin@example.com',
        ' *',
        ' * @property {number} [limit] - Max items \\@property {number} evil',
        ' * @see https://example.com docs',
        ' * \\@returns {Promise<number>} x',
        ' * @returns See {@link Pet}.',
        ' */',
        '',
      ].join('\n'),
    );
  });

  it('uses a single line when possible and nothing when empty', () => {
    expect(renderJsDoc({ summary: 'Short.', tags: [] }, '  ')).toBe('  /** Short. */\n');
    expect(renderJsDoc({ tags: [] })).toBe('');
  });
});
