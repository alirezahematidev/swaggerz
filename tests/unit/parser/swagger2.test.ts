import { describe, expect, it } from 'vitest';
import type { OperationIR } from '../../../src/ir/types.ts';
import { parseFixture } from '../../helpers.ts';

const parsed = await parseFixture('petstore-2.0.json', '2.0');
const op = (id: string): OperationIR => {
  const found = parsed.ir.operations.find((o) => o.operationId === id);
  if (found === undefined) throw new Error(`operation ${id} not found`);
  return found;
};

describe('Swagger 2.0 petstore', () => {
  it('has no errors', () => {
    expect(parsed.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(parsed.ir.specVersion).toBe('2.0');
  });

  it('derives servers from schemes, host and basePath (https first)', () => {
    expect(parsed.ir.servers.map((s) => s.url)).toEqual([
      'https://petstore.swagger.io/v2',
      'http://petstore.swagger.io/v2',
    ]);
  });

  it('converts body parameters into request bodies using consumes', () => {
    const body = op('addPet').requestBody;
    expect(body?.required).toBe(true);
    expect(body?.contents.map((c) => c.mediaType)).toEqual(['application/json', 'application/xml']);
    expect(body?.contents[0]?.schema).toEqual({ kind: 'ref', target: '#/definitions/Pet' });
  });

  it('maps collectionFormat to styles (Swagger 2 query arrays default to csv)', () => {
    const [status, sort] = op('findPetsByStatus').parameters;
    expect(status).toMatchObject({ style: 'form', explode: true, required: true });
    expect(status?.schema).toMatchObject({
      kind: 'array',
      items: { kind: 'enum', values: ['available', 'pending', 'sold'] },
    });
    expect(sort).toMatchObject({ style: 'pipeDelimited', explode: false });
  });

  it('merges path-level parameters', () => {
    expect(op('getPetById').parameters).toMatchObject([
      { name: 'petId', in: 'path', required: true, schema: { kind: 'integer' } },
    ]);
  });

  it('builds urlencoded and multipart bodies from formData parameters', () => {
    const form = op('updatePetWithForm').requestBody?.contents[0];
    expect(form?.mediaType).toBe('application/x-www-form-urlencoded');
    expect(form?.schema).toMatchObject({
      kind: 'object',
      properties: [{ name: 'name', required: false }, { name: 'status' }],
    });

    const upload = op('uploadFile').requestBody;
    expect(upload?.required).toBe(true);
    expect(upload?.contents[0]?.mediaType).toBe('multipart/form-data');
    expect(upload?.contents[0]?.schema).toMatchObject({
      kind: 'object',
      properties: [
        { name: 'additionalMetadata', required: false },
        { name: 'file', required: true, schema: { kind: 'binary' } },
      ],
    });
  });

  it('resolves response references and produces media types', () => {
    const notFound = op('getPetById').responses.find((r) => r.status === '404');
    expect(notFound?.description).toBe('Entity not found.');
    expect(notFound?.contents[0]).toMatchObject({
      mediaType: 'application/json',
      schema: { kind: 'ref', target: '#/definitions/ApiResponse' },
    });
  });

  it('converts securityDefinitions', () => {
    expect(parsed.ir.securitySchemes.map((s) => [s.key, s.type])).toEqual([
      ['api_key', 'apiKey'],
      ['basic', 'http'],
      ['petstore_auth', 'oauth2'],
    ]);
    const oauth = parsed.ir.securitySchemes.find((s) => s.key === 'petstore_auth');
    expect(oauth?.type === 'oauth2' && oauth.flows.implicit?.authorizationUrl).toBe(
      'https://petstore.swagger.io/oauth/authorize',
    );
  });

  it('honors x-nullable, boolean exclusiveMinimum and discriminators', () => {
    const order = parsed.schema('Order').schema;
    expect(
      order.kind === 'object' && order.properties.find((p) => p.name === 'note')?.schema,
    ).toMatchObject({ nullable: true });
    expect(op('getOrderById').parameters[0]?.schema).toMatchObject({
      constraints: { exclusiveMinimum: 1, maximum: 10 },
    });
    expect(parsed.schema('Pet').schema).toMatchObject({
      kind: 'object',
      discriminator: {
        propertyName: 'petType',
        mapping: [{ value: 'Cat', target: '#/definitions/Cat' }],
      },
    });
  });
});
