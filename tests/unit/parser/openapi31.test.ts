import { describe, expect, it } from 'vitest';
import type { OperationIR, SchemaIR } from '../../../src/ir/types.ts';
import { parseFixture } from '../../helpers.ts';

const parsed = await parseFixture('features-3.1.yaml', '3.1');
const op = (id: string): OperationIR => {
  const found = parsed.ir.operations.find((o) => o.operationId === id);
  if (found === undefined) throw new Error(`operation ${id} not found`);
  return found;
};
const property = (schema: SchemaIR, name: string): SchemaIR | undefined =>
  schema.kind === 'object' ? schema.properties.find((p) => p.name === name)?.schema : undefined;

describe('OpenAPI 3.1 features', () => {
  it('parses webhooks into the IR', () => {
    expect(parsed.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(parsed.ir.webhooks).toHaveLength(1);
    const [webhook] = parsed.ir.webhooks;
    expect(webhook?.name).toBe('shapeCreated');
    expect(webhook?.operations.map((o) => [o.key, o.method, o.path])).toEqual([
      ['webhook:shapeCreated post', 'post', ''],
    ]);
    expect(webhook?.operations[0]?.requestBody?.contents[0]?.schema).toMatchObject({
      kind: 'ref',
      target: '#/components/schemas/Shape',
    });
  });

  it('reads servers with variables and global security', () => {
    expect(parsed.ir.servers[0]).toEqual({
      url: 'https://{region}.api.example.com/v1',
      variables: { region: { default: 'eu', enum: ['eu', 'us'] } },
    });
    expect(parsed.ir.security).toEqual([{ bearerAuth: [] }]);
    expect(op('deleteShape').security).toEqual([]);
  });

  it('maps type arrays with null to nullable types', () => {
    const cursor = op('listShapes').parameters.find((p) => p.name === 'cursor');
    expect(cursor?.schema).toEqual({ kind: 'string', nullable: true });
    expect(property(parsed.schema('ShapePage').schema, 'nextCursor')).toEqual({
      kind: 'string',
      nullable: true,
    });
  });

  it('keeps parameter styles and locations', () => {
    const params = op('listShapes').parameters;
    expect(params.map((p) => [p.name, p.in, p.style, p.explode])).toEqual([
      ['filter', 'query', 'deepObject', true],
      ['ids', 'query', 'pipeDelimited', false],
      ['cursor', 'query', 'form', true],
      ['limit', 'query', 'form', true],
      ['X-Request-ID', 'header', 'simple', false],
      ['session', 'cookie', 'form', true],
    ]);
  });

  it('merges path-level parameters from components', () => {
    const [shapeId] = op('getShape').parameters;
    expect(shapeId).toMatchObject({
      name: 'shapeId',
      in: 'path',
      required: true,
      description: 'Shape identifier.',
    });
    expect(op('getShape').extensions).toEqual({ 'x-codegen-cache': 60 });
  });

  it('resolves response references and range statuses', () => {
    const statuses = op('listShapes').responses.map((r) => r.status);
    expect(statuses).toEqual(['200', '4XX']);
    expect(op('listShapes').responses[1]?.contents[0]).toMatchObject({
      mediaType: 'application/problem+json',
      schema: { kind: 'ref', target: '#/components/schemas/Problem' },
    });
  });

  it('builds a discriminated union with explicit mapping', () => {
    expect(parsed.schema('Shape').schema).toMatchObject({
      kind: 'union',
      combinator: 'oneOf',
      discriminator: {
        propertyName: 'kind',
        mapping: [
          { value: 'circle', target: '#/components/schemas/Circle' },
          { value: 'rect', target: '#/components/schemas/Rectangle' },
        ],
      },
    });
  });

  it('adds implicit mappings for allOf-based polymorphism', () => {
    expect(parsed.schema('Pet').schema).toMatchObject({
      kind: 'object',
      discriminator: {
        propertyName: 'petType',
        mapping: [
          { value: 'Cat', target: '#/components/schemas/Cat' },
          { value: 'Dog', target: '#/components/schemas/Dog' },
        ],
      },
    });
  });

  it('keeps $ref sibling keywords in 3.1', () => {
    expect(property(parsed.schema('ShapeBase').schema, 'color')).toEqual({
      kind: 'ref',
      target: '#/components/schemas/Color',
      description: 'Ref with a sibling description (allowed in 3.1).',
    });
  });

  it('handles recursion and oneOf-with-null', () => {
    const tree = parsed.schema('TreeNode').schema;
    expect(property(tree, 'children')).toEqual({
      kind: 'array',
      items: { kind: 'ref', target: '#/components/schemas/TreeNode' },
    });
    expect(property(tree, 'parent')).toEqual({
      kind: 'ref',
      target: '#/components/schemas/TreeNode',
      nullable: true,
    });
  });

  it('supports const, tuples and anyOf', () => {
    expect(property(parsed.schema('ClickEvent').schema, 'type')).toEqual({
      kind: 'enum',
      values: ['click'],
      isConst: true,
    });
    expect(property(parsed.schema('ViewEvent').schema, 'coordinates')).toEqual({
      kind: 'array',
      items: { kind: 'never' },
      prefixItems: [{ kind: 'number' }, { kind: 'number' }],
    });
    expect(parsed.schema('Event').schema).toMatchObject({ kind: 'union', combinator: 'anyOf' });
  });

  it('treats octet-stream bodies without schema as binary', () => {
    expect(op('uploadDocument').requestBody?.contents[0]).toMatchObject({
      mediaType: 'application/octet-stream',
      schema: { kind: 'binary' },
    });
    expect(op('downloadDocument').responses[0]?.contents[0]?.schema.kind).toBe('binary');
  });

  it('collapses pure $ref components into aliases', () => {
    const pet = parsed.schema('Pet');
    expect(pet.aliases).toEqual(['LegacyName']);
    expect(parsed.ir.schemas.some((s) => s.name === 'LegacyName')).toBe(false);
  });

  it('marks deprecated properties and operations', () => {
    expect(op('patchShape').deprecated).toBe(true);
    expect(property(parsed.schema('Unused').schema, 'deprecatedField')).toMatchObject({
      deprecated: true,
    });
  });
});
