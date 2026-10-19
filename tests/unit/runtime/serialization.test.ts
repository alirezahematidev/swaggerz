import { describe, expect, it } from 'vitest';
import {
  interpolatePath,
  joinUrl,
  serializeBody,
  serializeCookies,
  serializeHeader,
  serializePathParam,
  serializeQuery,
  toFormData,
} from '../../../src/templates/runtime/serialization.ts';

describe('path parameters', () => {
  it('encodes reserved characters and supports styles', () => {
    expect(interpolatePath('/users/{name}', { name: 'a b/c?' }, undefined)).toBe(
      '/users/a%20b%2Fc%3F',
    );
    expect(serializePathParam('id', [1, 2])).toBe('1,2');
    expect(serializePathParam('id', [1, 2], { style: 'label' })).toBe('.1,2');
    expect(serializePathParam('id', [1, 2], { style: 'label', explode: true })).toBe('.1.2');
    expect(serializePathParam('id', [1, 2], { style: 'matrix', explode: true })).toBe(';id=1;id=2');
    expect(serializePathParam('id', { a: 1, b: 2 })).toBe('a,1,b,2');
    expect(serializePathParam('id', { a: 1, b: 2 }, { explode: true })).toBe('a=1,b=2');
    expect(serializePathParam('id', 'x y', { allowReserved: true })).toBe('x%20y');
  });

  it('rejects missing path parameters', () => {
    expect(() => interpolatePath('/pets/{id}', {}, undefined)).toThrow(
      'Missing required path parameter "id"',
    );
  });
});

describe('query parameters', () => {
  it('uses form/explode by default and skips undefined and null', () => {
    expect(serializeQuery({ a: 1, b: undefined, c: null, d: [1, 2], e: true }, undefined)).toBe(
      'a=1&d=1&d=2&e=true',
    );
  });

  it('supports non-exploded arrays and delimited styles', () => {
    const styles = {
      csv: { explode: false },
      pipes: { style: 'pipeDelimited' as const },
      spaces: { style: 'spaceDelimited' as const },
      tabs: { style: 'tabDelimited' as const },
    };
    expect(
      serializeQuery({ csv: ['a', 'b'], pipes: [1, 2], spaces: [1, 2], tabs: [1, 2] }, styles),
    ).toBe('csv=a,b&pipes=1%7C2&spaces=1%202&tabs=1%092');
  });

  it('supports exploded objects and deepObject', () => {
    expect(serializeQuery({ filter: { color: 'red', size: 2 } }, undefined)).toBe(
      'color=red&size=2',
    );
    expect(
      serializeQuery(
        { filter: { color: 'red', nested: { a: [1] } } },
        { filter: { style: 'deepObject' } },
      ),
    ).toBe('filter[color]=red&filter[nested][a][0]=1');
    expect(serializeQuery({ filter: { a: 1 } }, { filter: { explode: false } })).toBe('filter=a,1');
  });

  it('serializes JSON content parameters and dates', () => {
    expect(serializeQuery({ q: { a: 1 } }, { q: { json: true } })).toBe('q=%7B%22a%22%3A1%7D');
    expect(serializeQuery({ at: new Date('2024-01-02T03:04:05.000Z') }, undefined)).toBe(
      'at=2024-01-02T03%3A04%3A05.000Z',
    );
  });

  it('encodes keys and values strictly', () => {
    expect(serializeQuery({ "a b'": 'c&d=e!' }, undefined)).toBe('a%20b%27=c%26d%3De%21');
  });
});

describe('headers and cookies', () => {
  it('serializes header values with the simple style', () => {
    expect(serializeHeader([1, 2])).toBe('1,2');
    expect(serializeHeader({ a: 1, b: 2 })).toBe('a,1,b,2');
    expect(serializeHeader({ a: 1, b: 2 }, { explode: true })).toBe('a=1,b=2');
  });

  it('builds cookie headers', () => {
    expect(serializeCookies({ session: 'a b', ids: [1, 2], none: undefined }, undefined)).toBe(
      'session=a%20b; ids=1%2C2',
    );
  });
});

describe('bodies', () => {
  it('serializes JSON, text, urlencoded and binary bodies', () => {
    expect(serializeBody({ a: 1 }, 'application/json')).toEqual({
      body: '{"a":1}',
      contentType: 'application/json',
    });
    expect(serializeBody({ a: 1 }, 'application/merge-patch+json').body).toBe('{"a":1}');
    expect(serializeBody(42, 'text/plain')).toEqual({ body: '42', contentType: 'text/plain' });
    const form = serializeBody(
      { a: 1, list: ['x', 'y'], nested: { b: 2 }, skip: undefined },
      'application/x-www-form-urlencoded',
    );
    expect(String(form.body)).toBe('a=1&list=x&list=y&nested=%7B%22b%22%3A2%7D');
    const bytes = new Uint8Array([1, 2]);
    expect(serializeBody(bytes, 'application/octet-stream')).toEqual({
      body: bytes,
      contentType: 'application/octet-stream',
    });
    expect(serializeBody(undefined, 'application/json')).toEqual({
      body: undefined,
      contentType: undefined,
    });
  });

  it('builds multipart bodies without a content type (the transport adds the boundary)', async () => {
    const { body, contentType } = serializeBody(
      {
        file: new Blob(['hi'], { type: 'text/plain' }),
        tags: ['a', 'b'],
        meta: { x: 1 },
        bytes: new Uint8Array([65]),
      },
      'multipart/form-data',
    );
    expect(contentType).toBeUndefined();
    const form = body as FormData;
    expect(form.getAll('tags')).toEqual(['a', 'b']);
    expect(form.get('meta')).toBe('{"x":1}');
    expect(await (form.get('file') as Blob).text()).toBe('hi');
    expect(await (form.get('bytes') as Blob).text()).toBe('A');
    expect(toFormData({ csv: [1, 2] }, { csv: { explode: false } }).get('csv')).toBe('1,2');
  });
});

describe('urls', () => {
  it('joins base URLs and query strings', () => {
    expect(joinUrl('https://api.test/v1/', '/pets', 'a=1')).toBe('https://api.test/v1/pets?a=1');
    expect(joinUrl('', '/pets', '')).toBe('/pets');
  });
});
