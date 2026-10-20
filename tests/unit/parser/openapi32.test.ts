import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DiagnosticBag } from '../../../src/diagnostics/bag.ts';
import type { Diagnostic } from '../../../src/diagnostics/types.ts';
import { wireMethod, type ApiDocument, type OperationIR } from '../../../src/ir/types.ts';
import { parseSpecification } from '../../../src/spec/parse.ts';
import { codes, makeConfig, parseFixture, withTempDir } from '../../helpers.ts';

const parsed = await parseFixture('features-3.2.yaml', '3.2');
const op = (id: string, ir: ApiDocument = parsed.ir): OperationIR => {
  const found = ir.operations.find((o) => o.operationId === id);
  if (found === undefined) throw new Error(`operation ${id} not found`);
  return found;
};

/** Parses an inline document; `paths` and the rest are appended to a 3.2 header. */
async function parseInline(
  body: string,
  version = '3.2.0',
): Promise<{ ir: ApiDocument | undefined; diagnostics: Diagnostic[] }> {
  return withTempDir(async (dir) => {
    const input = path.join(dir, 'openapi.yaml');
    await writeFile(input, `openapi: ${version}\ninfo: { title: t, version: '1' }\n${body}`);
    const diagnostics = new DiagnosticBag();
    const { ir } = await parseSpecification({
      config: makeConfig({ spec: { version: 'auto', input } }, dir),
      diagnostics,
    });
    return { ir, diagnostics: diagnostics.toArray() };
  });
}

describe('OpenAPI 3.2', () => {
  it('parses the feature fixture without errors', () => {
    expect(parsed.ir.specVersion).toBe('3.2');
    expect(parsed.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(codes(parsed.diagnostics).sort()).toEqual([
      'operation/item-schema',
      'operation/item-schema',
      'spec/invalid-tag-parent',
    ]);
  });

  it('reads QUERY operations and additionalOperations with their spelling', () => {
    expect(op('searchPets')).toMatchObject({ method: 'query', key: 'query /pets' });
    expect(op('searchPets').requestBody?.required).toBe(true);
    expect(op('copyDocument')).toMatchObject({
      method: 'COPY',
      key: 'COPY /documents/{documentId}',
    });
    expect(wireMethod('query')).toBe('QUERY');
    expect(wireMethod('COPY')).toBe('COPY');
    // Standard methods first, in spec order, then additional ones.
    expect(
      parsed.ir.operations
        .filter((o) => o.path === '/documents/{documentId}' || o.path === '/pets')
        .map((o) => o.key),
    ).toEqual([
      'get /documents/{documentId}',
      'COPY /documents/{documentId}',
      'get /pets',
      'query /pets',
    ]);
  });

  it('reads querystring parameters with their media type and encoding', () => {
    const [filter] = op('listPets').parameters;
    expect(filter).toMatchObject({
      name: 'filter',
      in: 'querystring',
      contentType: 'application/x-www-form-urlencoded',
      encoding: { tags: { explode: false } },
      schema: { kind: 'ref', target: '#/components/schemas/PetFilter' },
      examples: [
        {
          name: 'byName',
          value: { name: 'Tom', tags: ['a', 'b'] },
          serializedValue: 'name=Tom&tags=a,b',
        },
      ],
    });
    expect(op('searchDocuments').parameters[0]).toMatchObject({
      in: 'querystring',
      required: true,
      contentType: 'application/json',
    });
  });

  it('reads the cookie style, which explodes by default', () => {
    const session = op('getPet').parameters.find((p) => p.name === 'session');
    expect(session).toMatchObject({ in: 'cookie', style: 'cookie', explode: true });
  });

  it('keeps itemSchema and types sequential content as text', () => {
    const [media] = op('exportAudit').responses[0]?.contents ?? [];
    expect(media).toMatchObject({
      mediaType: 'application/jsonl',
      schema: { kind: 'string' },
      itemSchema: { kind: 'ref', target: '#/components/schemas/AuditEntry' },
    });
  });

  it('resolves media type references, response summaries and server names', () => {
    const problem = op('searchPets').responses.find((r) => r.status === '422');
    expect(problem).toMatchObject({
      summary: 'Invalid query',
      contents: [
        {
          mediaType: 'application/problem+json',
          schema: { kind: 'ref', target: '#/components/schemas/Problem' },
        },
      ],
    });
    expect(parsed.ir.servers[0]).toMatchObject({ name: 'production' });
  });

  it('reads nested tags and drops undeclared parents', () => {
    expect(parsed.ir.tags.map((tag) => [tag.name, tag.parent, tag.kind, tag.summary])).toEqual([
      ['pets', undefined, 'nav', 'Pets'],
      ['cats', 'pets', 'nav', 'Cats'],
      ['documents', undefined, 'nav', undefined],
      ['admin', undefined, 'audience', undefined],
      ['stray', undefined, undefined, undefined],
    ]);
  });

  it('resolves references against $self and reads them next to the document', () => {
    expect(parsed.ir.sources).toEqual(['features-3.2.yaml', 'features-3.2-shared.yaml']);
    const document = parsed.schema('Document').schema;
    expect(document.kind === 'object' && document.properties.map((p) => p.schema)).toEqual([
      { kind: 'string' },
      { kind: 'string' },
      { kind: 'ref', target: 'features-3.2-shared.yaml#/components/schemas/Owner' },
      { kind: 'ref', target: '#/components/schemas/PetQuery' },
    ]);
  });

  it('reads security schemes and requirements by URI', () => {
    expect(op('streamEvents').security).toEqual([{ deviceAuth: ['events:read'] }]);
    const schemes = new Map(parsed.ir.securitySchemes.map((scheme) => [scheme.key, scheme]));
    expect(schemes.get('deviceAuth')).toMatchObject({
      type: 'oauth2',
      oauth2MetadataUrl: 'https://auth.example.com/.well-known/oauth-authorization-server',
      flows: {
        deviceAuthorization: {
          deviceAuthorizationUrl: 'https://auth.example.com/device',
          tokenUrl: 'https://auth.example.com/token',
        },
      },
    });
    expect(schemes.get('legacyKey')).toMatchObject({ deprecated: true });
  });

  it('maps discriminator defaultMapping to a default variant without a value', () => {
    expect(parsed.schema('Pet').schema).toMatchObject({
      kind: 'union',
      discriminator: {
        propertyName: 'kind',
        mapping: [
          { value: 'cat', target: '#/components/schemas/Cat' },
          { value: 'dog', target: '#/components/schemas/Dog' },
        ],
        defaultTarget: '#/components/schemas/OtherPet',
      },
    });
  });

  it('reports invalid querystring parameters and additional operations', async () => {
    const { diagnostics } = await parseInline(`paths:
  /a:
    get:
      parameters:
        - { name: q, in: querystring, schema: { type: string } }
      responses: { '200': { description: ok } }
    post:
      parameters:
        - { name: q, in: querystring, content: { application/json: { schema: { type: object } } } }
        - { name: page, in: query, schema: { type: integer } }
      responses: { '200': { description: ok } }
    put:
      parameters:
        - { name: a, in: querystring, content: { text/plain: {} } }
        - { name: b, in: querystring, content: { text/plain: {} } }
      responses: { '200': { description: ok } }
    additionalOperations:
      GET: { responses: { '200': { description: ok } } }
      'BAD METHOD': { responses: { '200': { description: ok } } }
`);
    expect(codes(diagnostics).sort()).toEqual([
      'operation/invalid-method',
      'operation/invalid-querystring',
      'operation/invalid-querystring',
      'operation/reserved-method',
      'spec/invalid-parameter',
    ]);
  });

  it('warns when query API keys cannot be added to a JSON query string', async () => {
    const { diagnostics } = await parseInline(`security:
  - queryKey: []
paths:
  /search:
    get:
      parameters:
        - { name: q, in: querystring, content: { application/json: { schema: { type: object } } } }
      responses: { '200': { description: ok } }
  /list:
    get:
      parameters:
        - { name: q, in: querystring, content: { application/x-www-form-urlencoded: { schema: { type: object } } } }
      responses: { '200': { description: ok } }
components:
  securitySchemes:
    queryKey: { type: apiKey, in: query, name: key }
`);
    expect(diagnostics.map((d) => [d.code, d.operation])).toEqual([
      ['operation/querystring-credentials', 'GET /search'],
    ]);
    expect(diagnostics[0]?.message).toContain('Requests are sent without these credentials.');
  });

  it('breaks tag cycles', async () => {
    const { ir, diagnostics } = await parseInline(`tags:
  - { name: a, parent: b }
  - { name: b, parent: a }
paths: {}
`);
    expect(codes(diagnostics)).toEqual(['spec/invalid-tag-parent']);
    expect(ir?.tags.map((tag) => [tag.name, tag.parent])).toEqual([
      ['a', undefined],
      ['b', 'a'],
    ]);
  });

  it('does not read 3.2 fields in 3.1 documents', async () => {
    const { ir } = await parseInline(
      `tags:
  - { name: a, parent: b }
  - { name: b }
paths:
  /a:
    query: { operationId: q, responses: { '200': { description: ok } } }
    get: { operationId: g, responses: { '200': { description: ok } } }
`,
      '3.1.1',
    );
    expect(ir?.operations.map((o) => o.key)).toEqual(['get /a']);
    expect(ir?.tags[0]?.parent).toBeUndefined();
  });
});
