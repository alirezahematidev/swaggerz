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

  it('uses a single line when possible and nothing when empty', () => {
    expect(renderJsDoc({ summary: 'Short.', tags: [] }, '  ')).toBe('  /** Short. */\n');
    expect(renderJsDoc({ tags: [] })).toBe('');
  });
});
