import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DiagnosticBag } from '../../../src/diagnostics/bag.ts';
import type { Diagnostic } from '../../../src/diagnostics/types.ts';
import { applyOverlays } from '../../../src/loader/overlay.ts';
import { parseSpecification } from '../../../src/spec/parse.ts';
import { fixture, makeConfig, REPO_ROOT, withTempDir } from '../../helpers.ts';

const overlay = (name: string): string => path.join(REPO_ROOT, 'fixtures', 'overlays', name);

async function parse(spec: string, version: '2.0' | '3.0', overlays: string[]) {
  const diagnostics = new DiagnosticBag();
  const config = makeConfig({ spec: { version, input: fixture(spec), overlays } });
  const { ir } = await parseSpecification({ config, diagnostics });
  return { ir, diagnostics: diagnostics.toArray() };
}

/** Applies an overlay given as text to a document and returns the result and diagnostics. */
async function apply(
  document: unknown,
  text: string,
): Promise<{ result: unknown; diagnostics: Diagnostic[] }> {
  return withTempDir(async (dir) => {
    const file = path.join(dir, 'fixes.overlay.yaml');
    await writeFile(file, text);
    const diagnostics = new DiagnosticBag();
    const result = await applyOverlays(document, {
      overlays: [file],
      fetch: { headers: {}, timeout: 1000, maxBytes: 1_000_000 },
      diagnostics,
    });
    return { result, diagnostics: diagnostics.toArray() };
  });
}

const errors = (diagnostics: readonly Diagnostic[]): Diagnostic[] =>
  diagnostics.filter((d) => d.severity !== 'info');

describe('OpenAPI Overlays', () => {
  it('applies every action kind of an Overlay 1.1 document to OpenAPI 3.0', async () => {
    const { ir, diagnostics } = await parse('petstore-3.0.yaml', '3.0', [
      overlay('petstore-3.0.overlay.yaml'),
    ]);
    expect(errors(diagnostics)).toEqual([]);
    expect(diagnostics.find((d) => d.code === 'overlay/applied')?.message).toBe(
      'Applied 8 of 8 overlay actions from petstore-3.0.overlay.yaml.',
    );
    expect(ir?.info.description).toBe('Patched by an overlay.');
    const operations = ir?.operations ?? [];
    expect(operations.some((op) => op.path === '/store/inventory')).toBe(false);
    expect(operations.find((op) => op.path === '/user/logout')?.operationId).toBe('signOut');
    const getPet = operations.find((op) => op.operationId === 'getPetById');
    expect(getPet?.parameters[0]?.description).toBe('The identifier of the pet.');
    expect(operations.find((op) => op.operationId === 'deletePet')?.tags).toEqual(['pet', 'admin']);
    expect(operations.find((op) => op.operationId === 'findPetsByTags')?.deprecated).toBe(false);
    const summary = ir?.schemas.find((s) => s.name === 'PetSummary')?.schema;
    expect(summary?.kind === 'object' ? summary.properties.map((p) => p.name) : []).toEqual([
      'id',
      'name',
    ]);
  });

  it('applies Overlay 1.2 reusable actions', async () => {
    const { ir, diagnostics } = await parse('petstore-3.0.yaml', '3.0', [
      overlay('petstore-3.0-reusable.overlay.yaml'),
    ]);
    expect(errors(diagnostics)).toEqual([]);
    for (const route of ['/user/login', '/user/logout']) {
      const operation = ir?.operations.find((op) => op.path === route);
      expect(operation?.tags).toEqual(['user', 'internal']);
      expect(operation?.extensions['x-internal']).toBe(true);
    }
  });

  it('applies Overlay 1.0 JSON documents to Swagger 2.0', async () => {
    const { ir, diagnostics } = await parse('petstore-2.0.json', '2.0', [
      overlay('petstore-2.0.overlay.json'),
    ]);
    expect(errors(diagnostics)).toEqual([]);
    expect(
      ir?.operations.find((op) => op.path === '/pet' && op.method === 'post')?.operationId,
    ).toBe('createPet');
    expect(ir?.operations.some((op) => op.path === '/store/inventory')).toBe(false);
  });

  it('applies several overlays in order', async () => {
    const { ir, diagnostics } = await parse('petstore-3.0.yaml', '3.0', [
      overlay('petstore-3.0.overlay.yaml'),
      overlay('petstore-3.0-reusable.overlay.yaml'),
    ]);
    expect(errors(diagnostics)).toEqual([]);
    expect(ir?.operations.find((op) => op.path === '/user/logout')).toMatchObject({
      operationId: 'signOut',
      tags: ['user', 'internal'],
    });
  });

  it('warns about targets that match nothing and points into the overlay', async () => {
    const { result, diagnostics } = await apply(
      { info: { title: 'A' } },
      'overlay: 1.1.0\ninfo: { title: t, version: "1" }\nactions:\n  - target: $.paths\n    remove: true\n',
    );
    expect(result).toEqual({ info: { title: 'A' } });
    expect(errors(diagnostics)).toMatchObject([
      {
        code: 'overlay/no-match',
        severity: 'warning',
        location: { pointer: '/actions/0/target', line: 4, column: 5 },
      },
    ]);
  });

  it.each([
    ['actions:\n  - target: $.paths./pets\n    remove: true', 'overlay/invalid-target'],
    ['actions:\n  - target: $.info\n    update: text', 'overlay/incompatible-update'],
    ['actions:\n  - target: $.info.title\n    update: { a: 1 }', 'overlay/incompatible-update'],
    ['actions:\n  - target: $.info\n    copy: $.missing', 'overlay/invalid-copy'],
    ['actions:\n  - $ref: "#/components/actions/none"\n    target: $', 'overlay/invalid-reference'],
    ['actions:\n  - target: $\n    remove: true', 'overlay/invalid'],
    ['actions: []', 'overlay/invalid'],
  ])('reports %j as %s', async (actions, code) => {
    const { diagnostics } = await apply(
      { info: { title: 'A' } },
      `overlay: 1.1.0\ninfo: { title: t, version: "1" }\n${actions}\n`,
    );
    expect(errors(diagnostics).map((d) => [d.code, d.severity])).toEqual([[code, 'error']]);
  });

  it('rejects other major versions and warns about newer minor versions', async () => {
    const actions = 'actions:\n  - target: $.info\n    update: { x: 1 }\n';
    const major = await apply(
      { info: {} },
      `overlay: 2.0.0\ninfo: { title: t, version: "1" }\n${actions}`,
    );
    expect(errors(major.diagnostics)).toMatchObject([
      { code: 'overlay/unsupported-version', severity: 'error' },
    ]);
    expect(major.result).toEqual({ info: {} });
    const minor = await apply(
      { info: {} },
      `overlay: 1.9.0\ninfo: { title: t, version: "1" }\n${actions}`,
    );
    expect(errors(minor.diagnostics)).toMatchObject([
      { code: 'overlay/unsupported-version', severity: 'warning' },
    ]);
    expect(minor.result).toEqual({ info: { x: 1 } });
  });

  it('merges recursively, concatenates arrays and never touches prototypes', async () => {
    const { result } = await apply(
      { a: { b: [1], c: { d: 1 } }, list: [{ id: 1 }, { id: 2 }, { id: 3 }] },
      [
        'overlay: 1.1.0',
        'info: { title: t, version: "1" }',
        'actions:',
        '  - target: $.a',
        '    update: { b: [2], c: { e: 2 }, "__proto__": { polluted: true } }',
        '  - target: $.list[?@.id != 2]',
        '    remove: true',
      ].join('\n'),
    );
    expect(result).toEqual({
      a: { b: [1, 2], c: { d: 1, e: 2 }, ['__proto__']: { polluted: true } },
      list: [{ id: 2 }],
    });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('reports missing overlay files', async () => {
    const diagnostics = new DiagnosticBag();
    await applyOverlays(
      {},
      {
        overlays: [path.join(REPO_ROOT, 'missing.overlay.yaml')],
        fetch: { headers: {}, timeout: 1000, maxBytes: 1000 },
        diagnostics,
      },
    );
    expect(diagnostics.toArray()).toMatchObject([
      { code: 'overlay/load-failed', severity: 'error' },
    ]);
  });
});
