import { describe, expect, it } from 'vitest';
import type { OperationIR } from '../../../src/ir/types.ts';
import { parseFixture } from '../../helpers.ts';

const parsed = await parseFixture('petstore-3.0.yaml', '3.0');
const op = (id: string): OperationIR => {
  const found = parsed.ir.operations.find((o) => o.operationId === id);
  if (found === undefined) throw new Error(`operation ${id} not found`);
  return found;
};

describe('OpenAPI 3.0 petstore', () => {
  it('reads document metadata', () => {
    expect(parsed.ir.specVersion).toBe('3.0');
    expect(parsed.ir.specVersionRaw).toBe('3.0.3');
    expect(parsed.ir.info.title).toBe('Swagger Petstore - OpenAPI 3.0');
    expect(parsed.ir.servers[0]?.url).toBe('https://petstore3.swagger.io/api/v3');
    expect(parsed.ir.tags.map((t) => t.name)).toEqual(['pet', 'store', 'user']);
  });

  it('produces no error diagnostics', () => {
    expect(parsed.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('sorts operations by path then method', () => {
    expect(parsed.ir.operations.map((o) => o.key)).toEqual([
      'put /pet',
      'post /pet',
      'get /pet/findByStatus',
      'get /pet/findByTags',
      'get /pet/{petId}',
      'delete /pet/{petId}',
      'get /pet/{petId}/photo',
      'post /pet/{petId}/uploadImage',
      'get /store/inventory',
      'post /store/order',
      'get /store/order/{orderId}',
      'delete /store/order/{orderId}',
      'get /user/login',
      'get /user/logout',
      'get /user/{username}',
    ]);
  });

  it('normalizes parameters with OpenAPI 3 serialization defaults', () => {
    const [status] = op('findPetsByStatus').parameters;
    expect(status).toMatchObject({
      name: 'status',
      in: 'query',
      required: false,
      style: 'form',
      explode: true,
    });
    expect(status?.schema).toMatchObject({
      kind: 'enum',
      values: ['available', 'pending', 'sold'],
      default: 'available',
    });

    const [tags] = op('findPetsByTags').parameters;
    expect(tags).toMatchObject({ style: 'form', explode: false, required: true });
    expect(tags?.schema).toMatchObject({ kind: 'array', items: { kind: 'string' } });

    const petId = op('getPetById').parameters[0];
    expect(petId).toMatchObject({ in: 'path', style: 'simple', explode: false, required: true });
    expect(petId?.schema).toMatchObject({
      kind: 'integer',
      format: 'int64',
      constraints: { minimum: 1 },
    });
    expect(petId?.examples).toEqual([{ value: 10 }]);
  });

  it('keeps deprecation and security metadata', () => {
    expect(op('findPetsByTags').deprecated).toBe(true);
    expect(op('getPetById').security).toEqual([
      { api_key: [] },
      { petstore_auth: ['write:pets', 'read:pets'] },
    ]);
    expect(op('getUserByName').security).toBeUndefined();
    expect(parsed.ir.securitySchemes).toEqual([
      expect.objectContaining({ key: 'api_key', type: 'apiKey', in: 'header', name: 'api_key' }),
      expect.objectContaining({ key: 'petstore_auth', type: 'oauth2' }),
    ]);
  });

  it('converts request bodies with multiple media types', () => {
    const body = op('updatePet').requestBody;
    expect(body?.required).toBe(true);
    expect(body?.contents.map((c) => c.mediaType)).toEqual(['application/json', 'application/xml']);
    expect(body?.contents[0]?.schema).toEqual({ kind: 'ref', target: '#/components/schemas/Pet' });
  });

  it('detects multipart file uploads and binary responses', () => {
    const multipart = op('uploadFile').requestBody?.contents[0];
    expect(multipart?.mediaType).toBe('multipart/form-data');
    expect(multipart?.schema).toMatchObject({
      kind: 'object',
      properties: [
        { name: 'file', required: true, schema: { kind: 'binary' } },
        { name: 'description', required: false, schema: { kind: 'string' } },
        { name: 'tags', required: false, schema: { kind: 'array' } },
      ],
    });
    expect(op('downloadPhoto').responses[0]?.contents[0]).toMatchObject({
      mediaType: 'image/png',
      schema: { kind: 'binary' },
    });
  });

  it('orders responses by status with default last', () => {
    expect(op('updatePet').responses.map((r) => r.status)).toEqual([
      '200',
      '400',
      '404',
      '422',
      'default',
    ]);
    expect(op('loginUser').responses[0]?.headers.map((h) => h.name)).toEqual([
      'X-Rate-Limit',
      'X-Expires-After',
    ]);
  });

  it('models composition, nullability, dictionaries and readOnly', () => {
    expect(parsed.schema('Pet').schema).toMatchObject({
      kind: 'intersection',
      members: [
        { kind: 'ref', target: '#/components/schemas/NewPet' },
        {
          kind: 'object',
          properties: [{ name: 'id', required: true, schema: { kind: 'integer', readOnly: true } }],
        },
      ],
    });
    const user = parsed.schema('User').schema;
    expect(
      user.kind === 'object' && user.properties.find((p) => p.name === 'phone')?.schema,
    ).toMatchObject({
      kind: 'string',
      nullable: true,
    });
    const inventory = op('getInventory').responses[0]?.contents[0]?.schema;
    expect(inventory).toMatchObject({
      kind: 'object',
      properties: [],
      additionalProperties: { kind: 'integer' },
    });
    const order = parsed.schema('Order').schema;
    expect(order.kind === 'object' && order.properties[0]?.schema.readOnly).toBe(true);
  });

  it('registers every component schema, sorted by id', () => {
    expect(parsed.ir.schemas.map((s) => s.name)).toEqual([
      'ApiResponse',
      'Category',
      'Error',
      'NewPet',
      'Order',
      'Pet',
      'Tag',
      'User',
      'ValidationError',
    ]);
    expect(parsed.schema('Pet').source).toEqual({
      file: 'petstore-3.0.yaml',
      pointer: '/components/schemas/Pet',
    });
  });
});
