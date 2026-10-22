import { writeFile } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DiagnosticBag, SwaggerzError } from '../../../src/diagnostics/bag.ts';
import type { Diagnostic } from '../../../src/diagnostics/types.ts';
import type { ApiDocument } from '../../../src/ir/types.ts';
import { queryJsonPath } from '../../../src/loader/jsonpath.ts';
import { applyOverlays } from '../../../src/loader/overlay.ts';
import { DocumentParseError, parseDocumentText } from '../../../src/loader/parse.ts';
import { compile } from '../../../src/pipeline/compile.ts';
import { parseSpecification } from '../../../src/spec/parse.ts';
import { codes, makeConfig, withTempDir } from '../../helpers.ts';

/**
 * Untrusted documents that once crashed the loader, leaked credentials, resolved references to
 * the wrong node or were not patched by overlays.
 */

interface Parsed {
  readonly ir: ApiDocument | undefined;
  readonly diagnostics: Diagnostic[];
}

/** Parses a specification given as text (the file name sets the format). */
async function parseText(
  text: string,
  file = 'openapi.yaml',
  files: Record<string, string> = {},
): Promise<Parsed> {
  return withTempDir(async (dir) => {
    for (const [name, content] of Object.entries(files))
      await writeFile(path.join(dir, name), content);
    const input = path.join(dir, file);
    await writeFile(input, text);
    const diagnostics = new DiagnosticBag();
    const config = makeConfig({ spec: { version: 'auto', input } }, dir);
    const { ir } = await parseSpecification({ config, diagnostics });
    return { ir, diagnostics: diagnostics.toArray() };
  });
}

const errors = (diagnostics: readonly Diagnostic[]): string[] =>
  codes(diagnostics.filter((d) => d.severity === 'error'));

function listen(handler: http.RequestListener): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: (server.address() as AddressInfo).port });
    });
  });
}

describe('overlays', () => {
  it('reach the generated client through the compiler', async () => {
    await withTempDir(async (dir) => {
      await writeFile(
        path.join(dir, 'openapi.yaml'),
        `openapi: 3.0.3
info: { title: T, version: '1' }
paths:
  /pets:
    get:
      responses:
        '200': { description: ok }
`,
      );
      await writeFile(
        path.join(dir, 'fix.overlay.yaml'),
        `overlay: 1.1.0
info: { title: Fix, version: '1' }
actions:
  - target: $.paths['/pets'].get
    update: { operationId: listPetsPatched }
`,
      );
      const config = makeConfig(
        {
          spec: {
            version: '3.0',
            input: path.join(dir, 'openapi.yaml'),
            overlays: [path.join(dir, 'fix.overlay.yaml')],
          },
          output: { directory: path.join(dir, 'out') },
        },
        dir,
      );
      // The compiler always passes a `beforeParse` hook, even without plugins.
      const result = await compile({ config });
      expect(result.project?.operations.map((op) => op.name)).toEqual(['listPetsPatched']);
    });
  });

  it('patch nodes that YAML aliases share once per place they appear', async () => {
    const document = parseDocumentText(
      `paths:
  /a:
    get:
      parameters: &common
        - { name: page }
        - { name: debug }
        - { name: size }
        - { name: sort }
  /b:
    get:
      parameters: *common
`,
      'yaml',
    );
    await withTempDir(async (dir) => {
      const file = path.join(dir, 'fix.overlay.yaml');
      await writeFile(
        file,
        `overlay: 1.1.0
info: { title: Fix, version: '1' }
actions:
  - target: $.paths.*.get.parameters[?@.name == 'debug']
    remove: true
  - target: $.paths.*.get.parameters
    update: { name: X-Trace }
`,
      );
      const diagnostics = new DiagnosticBag();
      const result = (await applyOverlays(document, {
        overlays: [file],
        fetch: { headers: {}, timeout: 1000, maxBytes: 1_000_000 },
        diagnostics,
      })) as { paths: Record<string, { get: { parameters: { name: string }[] } }> };
      for (const item of Object.values(result.paths))
        expect(item.get.parameters.map((p) => p.name)).toEqual(['page', 'size', 'sort', 'X-Trace']);
    });
  });

  it('do not resolve reusable actions through Object.prototype', async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, 'fix.overlay.yaml');
      await writeFile(
        file,
        `overlay: 1.2.0
info: { title: Fix, version: '1' }
components:
  actions: {}
actions:
  - $ref: '#/components/actions/__proto__'
    target: $.info
`,
      );
      const diagnostics = new DiagnosticBag();
      await applyOverlays(
        { info: { title: 'T' } },
        {
          overlays: [file],
          fetch: { headers: {}, timeout: 1000, maxBytes: 1_000_000 },
          diagnostics,
        },
      );
      expect(codes(diagnostics.toArray())).toContain('overlay/invalid-reference');
    });
  });
});

describe('remote documents', () => {
  it('send configured headers only to the configured origin, also after a redirect', async () => {
    const seen: string[] = [];
    const other = await listen((req, res) => {
      seen.push(`other ${req.url ?? ''} ${req.headers.authorization ?? '-'}`);
      res.setHeader('content-type', 'application/json');
      res.end(
        req.url === '/openapi.json'
          ? JSON.stringify({
              openapi: '3.0.3',
              info: { title: 'T', version: '1' },
              paths: {
                '/p': {
                  get: {
                    responses: {
                      '200': {
                        description: 'ok',
                        content: { 'application/json': { schema: { $ref: 'schemas.json#/S' } } },
                      },
                    },
                  },
                },
              },
            })
          : JSON.stringify({ S: { type: 'string' } }),
      );
    });
    const configured = await listen((req, res) => {
      seen.push(`configured ${req.url ?? ''} ${req.headers.authorization ?? '-'}`);
      res.statusCode = 302;
      res.setHeader('location', `http://localhost:${other.port}/openapi.json`);
      res.end();
    });
    try {
      const diagnostics = new DiagnosticBag();
      const config = makeConfig({
        spec: {
          version: '3.0',
          input: `http://127.0.0.1:${configured.port}/openapi.json`,
          fetch: { headers: { authorization: 'Bearer SECRET' } },
          refs: { external: 'remote', allowedHosts: ['localhost'] },
        },
      });
      const { ir } = await parseSpecification({ config, diagnostics });
      expect(ir?.operations).toHaveLength(1);
      expect(seen).toContain('configured /openapi.json Bearer SECRET');
      expect(seen.filter((line) => line.startsWith('other'))).toEqual([
        'other /openapi.json -',
        'other /schemas.json -',
      ]);
    } finally {
      configured.server.close();
      other.server.close();
    }
  });
});

describe('YAML', () => {
  it('rejects aliases that contain themselves instead of looping', () => {
    expect(() =>
      parseDocumentText(
        `components:
  schemas:
    Node: &node { type: object, properties: { child: *node } }
`,
        'yaml',
      ),
    ).toThrow(/refers to a node that contains it/);
    expect(() => parseDocumentText('x-meta: &m { self: *m }\n', 'yaml')).toThrow(
      DocumentParseError,
    );
  });

  it('bounds what aliases add to a document', () => {
    const keys = Array.from({ length: 2000 }, (_, i) => `  k${i}: v`).join('\n');
    const aliases = Array.from({ length: 999 }, (_, i) => `  a${i}: *big`).join('\n');
    const text = `x-big: &big\n${keys}\nrefs:\n${aliases}\n`;
    const started = performance.now();
    expect(() => parseDocumentText(text, 'yaml')).toThrow(/aliases and merge keys add more than/);
    // Bounded: this document once took over a minute and exhausted the heap.
    expect(performance.now() - started).toBeLessThan(20_000);
  }, 30_000);

  it('copies aliased nodes, so no two places share one', () => {
    const data = parseDocumentText('a: &x { b: 1 }\nc: *x\n', 'yaml') as Record<string, object>;
    expect(data.c).toEqual(data.a);
    expect(data.c).not.toBe(data.a);
  });

  it('finds duplicate keys in linear time', () => {
    const keys = Array.from({ length: 60_000 }, (_, i) => `k${i}: v`).join('\n');
    const started = performance.now();
    parseDocumentText(keys, 'yaml');
    // Quadratic checking took about 20 s.
    expect(performance.now() - started).toBeLessThan(10_000);
    expect(() => parseDocumentText('a: 1\nb: 2\na: 3\n', 'yaml')).toThrow(/"a" is repeated/);
  }, 30_000);

  it('keeps __proto__ keys as data', () => {
    const data = parseDocumentText('default: { __proto__: { injected: true } }\n', 'yaml') as {
      default: object;
    };
    expect(Object.keys(data.default)).toEqual(['__proto__']);
    expect(Object.getPrototypeOf(data.default)).toBe(Object.prototype);
  });
});

describe('nesting', () => {
  it('reports documents nested too deeply instead of exhausting the stack', async () => {
    const deep = '['.repeat(20_000) + ']'.repeat(20_000);
    const json = `{"openapi":"3.1.0","info":{"title":"T","version":"1"},"paths":{},"x-deep":${deep}}`;
    // A root document that cannot be parsed stops the run with its diagnostics.
    const error = await parseText(json, 'openapi.json').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SwaggerzError);
    const diagnostics = (error as SwaggerzError).diagnostics;
    expect(errors(diagnostics)).toEqual(['spec/parse-error']);
    expect(diagnostics[0]?.message).toMatch(/more than 1000 levels deep/);
  });
});

describe('references', () => {
  it('reports a malformed percent-escape in a fragment', async () => {
    const { diagnostics } = await parseText(`openapi: 3.1.0
info: { title: T, version: '1' }
paths:
  /pets:
    get:
      responses:
        '200':
          description: ok
          content: { application/json: { schema: { $ref: '#%zz' } } }
`);
    expect(errors(diagnostics)).toContain('ref/invalid');
  });

  it('decodes the fragment of a $ref once', async () => {
    const { ir, diagnostics } = await parseText(
      JSON.stringify({
        swagger: '2.0',
        info: { title: 'T', version: '1' },
        paths: { '/rate': { get: { responses: { '200': { $ref: '#/responses/Rate%25' } } } } },
        responses: { 'Rate%': { description: 'percent', schema: { type: 'number' } } },
      }),
      'openapi.json',
    );
    expect(errors(diagnostics)).toEqual([]);
    const response = ir?.operations[0]?.responses[0];
    expect(response?.description).toBe('percent');
    expect(response?.contents[0]?.schema.kind).toBe('number');
  });

  it('scopes anchors to their schema resource', async () => {
    const { ir, diagnostics } = await parseText(`openapi: 3.1.0
info: { title: T, version: '1' }
paths:
  /a:
    get:
      responses:
        '200':
          description: ok
          content: { application/json: { schema: { $ref: 'https://example.com/a.json#item' } } }
  /b:
    get:
      responses:
        '200':
          description: ok
          content: { application/json: { schema: { $ref: 'https://example.com/b.json#item' } } }
components:
  schemas:
    A:
      $id: https://example.com/a.json
      $defs:
        ItemA: { $anchor: item, type: string }
    B:
      $id: https://example.com/b.json
      $defs:
        ItemB: { $anchor: item, type: integer }
`);
    expect(errors(diagnostics)).toEqual([]);
    const targets = ir?.operations.map((op) => {
      const schema = op.responses[0]?.contents[0]?.schema;
      return schema?.kind === 'ref' ? schema.target : undefined;
    });
    expect(targets).toEqual([
      '#/components/schemas/A/$defs/ItemA',
      '#/components/schemas/B/$defs/ItemB',
    ]);
  });

  it('does not follow $ref inside example data', async () => {
    const v32 = await parseText(`openapi: 3.2.0
info: { title: T, version: '1' }
paths:
  /schemas:
    get:
      responses:
        '200':
          description: ok
          content:
            application/json:
              schema: { type: object }
              examples:
                withValue: { value: { $ref: 'https://json-schema.org/draft/2020-12/schema' } }
                withDataValue: { dataValue: { $ref: 'https://json-schema.org/draft/2020-12/schema' } }
`);
    expect(errors(v32.diagnostics)).toEqual([]);
    const v2 = await parseText(`swagger: '2.0'
info: { title: T, version: '1' }
paths:
  /docs:
    get:
      produces: [application/json]
      responses:
        '200':
          description: ok
          schema: { type: object }
          examples:
            application/json:
              definitions:
                Pet: { $ref: '#/definitions/Animal' }
`);
    expect(errors(v2.diagnostics)).toEqual([]);
  });

  it('indexes the root once when it declares no $id', async () => {
    const paths = Object.fromEntries(
      Array.from({ length: 2000 }, (_, i) => [
        `/p${i}`,
        {
          get: {
            responses: {
              '200': {
                description: 'ok',
                content: { 'application/json': { schema: { $ref: 'common.json#/S' } } },
              },
            },
          },
        },
      ]),
    );
    const started = performance.now();
    const { diagnostics } = await parseText(
      JSON.stringify({ openapi: '3.0.3', info: { title: 'T', version: '1' }, paths }),
      'openapi.json',
      { 'common.json': JSON.stringify({ S: { type: 'string' } }) },
    );
    expect(errors(diagnostics)).toEqual([]);
    // Re-walking the root for every reference took about 10 s.
    expect(performance.now() - started).toBeLessThan(10_000);
  }, 30_000);
});

describe('documents', () => {
  it('allows specification extensions in the Paths Object', async () => {
    const { ir, diagnostics } = await parseText(`openapi: 3.0.3
info: { title: T, version: '1' }
paths:
  x-internal-note: hello
  /pets:
    get:
      responses:
        '200': { description: ok }
`);
    expect(errors(diagnostics)).toEqual([]);
    expect(ir?.operations.map((op) => op.path)).toEqual(['/pets']);
  });

  it('reads an unquoted YAML info.version as text, with a warning', async () => {
    const { ir, diagnostics } = await parseText(`openapi: 3.0.3
info: { title: T, version: 2 }
paths: {}
`);
    expect(ir?.info.version).toBe('2');
    expect(codes(diagnostics)).toContain('spec/unquoted-version');
    expect(codes(diagnostics)).not.toContain('spec/missing-field');
  });

  it('keeps __proto__ keys of data and extensions as own properties', async () => {
    const { ir } = await parseText(
      JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'T', version: '1' },
        paths: {},
        components: {
          schemas: {
            Obj: {
              type: 'object',
              default: JSON.parse('{"__proto__":{"injected":true},"constructor":1}') as unknown,
              'x-meta': JSON.parse('{"__proto__":{"polluted":"yes"}}') as unknown,
            },
          },
        },
      }),
      'openapi.json',
    );
    const schema = ir?.schemas.find((s) => s.name === 'Obj')?.schema;
    const value = schema?.default as Record<string, unknown> | undefined;
    expect(Object.keys(value ?? {})).toEqual(['__proto__', 'constructor']);
    expect(value?.injected).toBeUndefined();
    const meta = schema?.extensions?.['x-meta'] as Record<string, unknown> | undefined;
    expect(Object.keys(meta ?? {})).toEqual(['__proto__']);
    expect(meta?.polluted).toBeUndefined();
  });
});

describe('JSONPath match() and search()', () => {
  const items = { items: [{ name: 'admin-users' }, { name: 'admin' }, { name: 'x' }] };
  const names = (query: string): unknown[] =>
    queryJsonPath(items, query).map((node) => (node.value as { name: string }).name);

  it('treat patterns that are not I-Regexps as not matching', () => {
    // `admin)|(x` would otherwise escape match()'s anchoring.
    expect(names(`$.items[?match(@.name, 'admin)|(x')]`)).toEqual([]);
    expect(names(`$.items[?search(@.name, 'a(?=d)')]`)).toEqual([]);
    expect(names(`$.items[?search(@.name, '(a)\\\\1')]`)).toEqual([]);
    expect(names(`$.items[?search(@.name, 'a*?')]`)).toEqual([]);
  });

  it('still anchor match() and accept I-Regexps', () => {
    expect(names(`$.items[?match(@.name, 'admin')]`)).toEqual(['admin']);
    expect(names(`$.items[?search(@.name, 'admin')]`)).toEqual(['admin-users', 'admin']);
    expect(names(`$.items[?match(@.name, '[a-z]+(-[a-z]+)?')]`)).toEqual([
      'admin-users',
      'admin',
      'x',
    ]);
  });
});
