import { describe, expect, it } from 'vitest';
import { DiagnosticBag } from '../../../src/diagnostics/bag.ts';
import { SwaggerzError } from '../../../src/diagnostics/bag.ts';
import { enrichLocations } from '../../../src/loader/locate.ts';
import { parseSpecification } from '../../../src/spec/parse.ts';
import { codes, fixture, makeConfig, parseFixture } from '../../helpers.ts';

describe('multi-file specifications', () => {
  it('loads external documents, path item refs and nested refs', async () => {
    const parsed = await parseFixture('external/openapi.yaml', '3.0');
    expect(parsed.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(parsed.ir.sources).toEqual([
      'openapi.yaml',
      'common.yaml',
      'paths/person.yaml',
      'schemas/person.yaml',
      'schemas/team.yaml',
    ]);
    expect(parsed.ir.operations.map((o) => o.operationId)).toEqual(['getPerson', 'listTeams']);
  });

  it('names external schemas and keeps root component names', async () => {
    const parsed = await parseFixture('external/openapi.yaml', '3.0');
    const ids = parsed.ir.schemas.map((s) => [s.id, s.name]);
    expect(ids).toEqual([
      ['#/components/schemas/Error', 'Error'],
      ['common.yaml#/components/schemas/Error', 'Error'],
      ['schemas/person.yaml#', 'Person'],
      ['schemas/team.yaml#', 'team'],
    ]);
  });

  it('resolves recursive references across files', async () => {
    const parsed = await parseFixture('external/openapi.yaml', '3.0');
    const person = parsed.schema('Person').schema;
    expect(person.kind === 'object' && person.properties.map((p) => [p.name, p.schema])).toEqual([
      ['id', { kind: 'string' }],
      ['name', { kind: 'string' }],
      ['team', { kind: 'ref', target: 'schemas/team.yaml#' }],
      ['manager', { kind: 'ref', target: 'schemas/person.yaml#' }],
    ]);
  });
});

describe('schema resources ($id)', () => {
  it('resolves references against the nearest $id, including nested relative ids', async () => {
    const parsed = await parseFixture('ids-3.1.yaml', '3.1');
    expect(parsed.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const properties = (name: string): [string, unknown][] => {
      const schema = parsed.schema(name).schema;
      return schema.kind === 'object' ? schema.properties.map((p) => [p.name, p.schema]) : [];
    };
    const target = (schema: unknown): string | undefined =>
      typeof schema === 'object' && schema !== null && 'target' in schema
        ? String(schema.target)
        : undefined;
    const order = Object.fromEntries(properties('Order'));
    expect(target(order.item)).toBe('#/components/schemas/Item');
    expect(target(order.customer)).toBe('#/components/schemas/Order/$defs/Customer');
    const customer = Object.fromEntries(properties('Customer'));
    expect(target(customer.address)).toBe(
      '#/components/schemas/Order/$defs/Customer/$defs/Address',
    );
    const item = parsed.schema('Item').schema;
    expect(
      item.kind === 'object' && item.properties.find((p) => p.name === 'variants')?.schema,
    ).toMatchObject({
      kind: 'array',
      items: { target: '#/components/schemas/Item/$defs/Variant' },
    });
  });
});

describe('invalid specifications', () => {
  it('reports missing targets, missing files and circular aliases with locations', async () => {
    const diagnostics = new DiagnosticBag();
    const config = makeConfig({
      spec: { version: '3.0', input: fixture('invalid/broken-refs.yaml') },
    });
    const { ir, store } = await parseSpecification({ config, diagnostics });
    expect(ir).toBeDefined();
    const errors = enrichLocations(diagnostics.toArray(), store).filter(
      (d) => d.severity === 'error',
    );
    expect(codes(errors).sort()).toEqual([
      'ref/circular',
      'ref/external-load-failed',
      'ref/missing-target',
    ]);
    const missing = errors.find((d) => d.code === 'ref/missing-target');
    expect(missing?.location).toMatchObject({
      pointer: '/paths/~1things/get/responses/200/content/application~1json/schema',
      line: 14,
    });
  });

  it('does not follow $ref-looking values inside examples', async () => {
    const diagnostics = new DiagnosticBag();
    const config = makeConfig({
      spec: { version: '3.0', input: fixture('invalid/broken-refs.yaml') },
    });
    await parseSpecification({ config, diagnostics });
    expect(diagnostics.toArray().some((d) => d.message.includes('this is example data'))).toBe(
      false,
    );
  });

  it('blocks remote and out-of-root references by default', async () => {
    const diagnostics = new DiagnosticBag();
    const config = makeConfig({
      spec: { version: '3.1', input: fixture('invalid/blocked-ref.yaml') },
    });
    await parseSpecification({ config, diagnostics });
    const blocked = diagnostics.toArray().filter((d) => d.code === 'ref/external-blocked');
    expect(blocked).toHaveLength(2);
    expect(blocked[0]?.message).toContain('evil.example.com');
    expect(blocked[0]?.hint).toContain('allowedHosts');
    expect(blocked[1]?.message).toContain('outside the allowed directories');
  });

  it('reports YAML syntax errors with a line number', async () => {
    const config = makeConfig({
      spec: { version: '3.0', input: fixture('invalid/malformed.yaml') },
    });
    const error = await parseSpecification({ config, diagnostics: new DiagnosticBag() }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(SwaggerzError);
    const [diagnostic] = (error as SwaggerzError).diagnostics;
    expect(diagnostic?.code).toBe('spec/parse-error');
    expect(diagnostic?.location?.line).toBeGreaterThan(0);
  });

  it('rejects documents that are not Swagger/OpenAPI', async () => {
    const diagnostics = new DiagnosticBag();
    const config = makeConfig({
      spec: { version: 'auto', input: fixture('invalid/not-openapi.json') },
    });
    const { ir } = await parseSpecification({ config, diagnostics });
    expect(ir).toBeUndefined();
    expect(codes(diagnostics.toArray())).toEqual(['spec/unknown-format']);
  });

  it('never reinterprets a document as a different configured version', async () => {
    const diagnostics = new DiagnosticBag();
    const config = makeConfig({ spec: { version: '3.1', input: fixture('petstore-3.0.yaml') } });
    const { ir } = await parseSpecification({ config, diagnostics });
    expect(ir).toBeUndefined();
    const [mismatch] = diagnostics.toArray();
    expect(mismatch?.code).toBe('spec/version-mismatch');
    expect(mismatch?.message).toContain("OpenAPI 3.1 (spec.version: '3.1')");
    expect(mismatch?.hint).toContain("'3.0'");
  });

  it('reports missing files clearly', async () => {
    const config = makeConfig({ spec: { version: '3.0', input: fixture('nope.yaml') } });
    const error = await parseSpecification({ config, diagnostics: new DiagnosticBag() }).catch(
      (e: unknown) => e,
    );
    expect((error as SwaggerzError).diagnostics[0]?.message).toMatch(/File not found/);
  });
});
