import { describe, expect, it } from 'vitest';
import {
  interpolatePath,
  joinUrl,
  serializeBody,
  serializeCookies,
  serializeHeader,
  serializePathParam,
  serializeQuery,
  serializeQuerystring,
  toFormData,
  toSearchParams,
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

  it('joins non-exploded objects with the delimiter of their style', () => {
    const color = { R: 1, G: 2 };
    expect(serializeQuery({ c: color }, { c: { style: 'spaceDelimited', explode: false } })).toBe(
      'c=R%201%20G%202',
    );
    expect(serializeQuery({ c: color }, { c: { style: 'pipeDelimited', explode: false } })).toBe(
      'c=R%7C1%7CG%7C2',
    );
  });

  it('keeps reserved characters with allowReserved but never a lone percent sign', () => {
    const styles = { q: { allowReserved: true } };
    expect(serializeQuery({ q: 'a/b?c=%20d' }, styles)).toBe('q=a/b?c=%20d');
    expect(serializeQuery({ q: '100% sure' }, styles)).toBe('q=100%25%20sure');
    expect(serializeQuery({ q: 'smile 😀' }, styles)).toBe('q=smile%20%F0%9F%98%80');
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

  it('builds multipart bodies of strings and files as FormData (the transport adds the boundary)', async () => {
    const { body, contentType } = serializeBody(
      {
        file: new Blob(['hi'], { type: 'text/plain' }),
        tags: ['a', 'b'],
        bytes: new Uint8Array([65]),
      },
      'multipart/form-data',
    );
    expect(contentType).toBeUndefined();
    const form = body as FormData;
    expect(form.getAll('tags')).toEqual(['a', 'b']);
    expect(await (form.get('file') as Blob).text()).toBe('hi');
    expect(await (form.get('bytes') as Blob).text()).toBe('A');
    expect(toFormData({ csv: [1, 2] }, { csv: { explode: false } }).get('csv')).toBe('1,2');
  });

  it('labels JSON and typed parts with a Content-Type, without making them files', async () => {
    const { body, contentType } = serializeBody(
      {
        meta: { x: 1 },
        note: 'hello',
        csv: 'a,b',
        file: new File(['png'], 'photo "1".png', { type: 'image/png' }),
        bytes: new Uint8Array([65]),
        'line\nbreak': 'v',
      },
      'multipart/form-data',
      { csv: { contentType: 'text/csv' }, bytes: { contentType: 'image/png, image/jpeg' } },
    );
    expect(contentType).toMatch(/^multipart\/form-data; boundary=----swaggerz[\da-f]{24}$/);
    const boundary = contentType?.split('boundary=')[1] ?? '';
    const text = await (body as Blob).text();
    expect(text.split(`--${boundary}`)).toEqual([
      '',
      '\r\nContent-Disposition: form-data; name="meta"\r\nContent-Type: application/json\r\n\r\n{"x":1}\r\n',
      '\r\nContent-Disposition: form-data; name="note"\r\n\r\nhello\r\n',
      '\r\nContent-Disposition: form-data; name="csv"\r\nContent-Type: text/csv\r\n\r\na,b\r\n',
      '\r\nContent-Disposition: form-data; name="file"; filename="photo %221%22.png"\r\nContent-Type: image/png\r\n\r\npng\r\n',
      // A list of allowed types names no single one: bytes are sent as such.
      '\r\nContent-Disposition: form-data; name="bytes"; filename="blob"\r\nContent-Type: application/octet-stream\r\n\r\nA\r\n',
      '\r\nContent-Disposition: form-data; name="line%0D%0Abreak"\r\n\r\nv\r\n',
      '--\r\n',
    ]);
    // A standard multipart parser reads it back: the JSON part is a field, not an upload.
    const form = await new Response(body as Blob, {
      headers: { 'content-type': contentType ?? '' },
    }).formData();
    expect(form.get('meta')).toBe('{"x":1}');
    expect((form.get('file') as File).name).toBe('photo "1".png');
  });

  it('applies the encoding style of object properties in urlencoded bodies', () => {
    const body = { amount: 5, metadata: { order_id: '6735', tags: ['a', 'b'] } };
    // Without style or explode, nested objects are JSON (OpenAPI's default content type).
    expect(decodeURIComponent(toSearchParams(body).toString())).toBe(
      'amount=5&metadata={"order_id":"6735","tags":["a","b"]}',
    );
    const deep = toSearchParams(body, { metadata: { style: 'deepObject', explode: true } });
    expect(decodeURIComponent(deep.toString())).toBe(
      'amount=5&metadata[order_id]=6735&metadata[tags][0]=a&metadata[tags][1]=b',
    );
    expect(String(toSearchParams({ m: { a: 1, b: 2 } }, { m: { style: 'form' } }))).toBe('a=1&b=2');
    expect(String(toSearchParams({ m: { a: 1, b: 2 } }, { m: { explode: false } }))).toBe(
      'm=a%2C1%2Cb%2C2',
    );
    // The serialized body of a request descriptor carrying the encoding.
    const { body: serialized } = serializeBody(
      { metadata: { order_id: '6735' } },
      'application/x-www-form-urlencoded',
      { metadata: { style: 'deepObject', explode: true } },
    );
    expect(String(serialized)).toBe('metadata%5Border_id%5D=6735');
    expect(
      serializeQuerystring({ f: { a: 1 } }, 'application/x-www-form-urlencoded', {
        f: { style: 'deepObject' },
      }),
    ).toBe('f%5Ba%5D=1');
  });

  it('never sends a wildcard media type as Content-Type', () => {
    expect(serializeBody({ a: 1 }, '*/*')).toEqual({
      body: '{"a":1}',
      contentType: 'application/json',
    });
    const blob = new Blob(['x'], { type: 'image/png' });
    expect(serializeBody(blob, '*/*')).toEqual({ body: blob, contentType: undefined });
    expect(serializeBody('text', 'application/*')).toEqual({
      body: 'text',
      contentType: undefined,
    });
    expect(serializeBody(42, 'text/*')).toEqual({ body: '42', contentType: undefined });
  });
});

describe('urls', () => {
  it('joins base URLs and query strings', () => {
    expect(joinUrl('https://api.test/v1/', '/pets', 'a=1')).toBe('https://api.test/v1/pets?a=1');
    expect(joinUrl('', '/pets', '')).toBe('/pets');
  });

  it('keeps a query string of the base URL after the path', () => {
    expect(joinUrl('https://api.test/v1?key=k', '/pets', 'a=1')).toBe(
      'https://api.test/v1/pets?key=k&a=1',
    );
    expect(joinUrl('https://api.test/v1/?key=k', '/pets', '')).toBe(
      'https://api.test/v1/pets?key=k',
    );
    expect(joinUrl('https://api.test', '/search?type=a', 'q=1')).toBe(
      'https://api.test/search?type=a&q=1',
    );
  });
});
