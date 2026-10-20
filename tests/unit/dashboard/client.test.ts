import { describe, expect, it } from 'vitest';
import type { ModelSummary, OperationSummary } from '../../../src/dashboard/api-types.ts';
import { filterModels, filterOperations, tokenize } from '../../../src/dashboard/client/filters.ts';
import { href, parseRoute } from '../../../src/dashboard/client/routes.ts';

const op = (overrides: Partial<OperationSummary>): OperationSummary => ({
  key: 'get /x',
  name: 'getX',
  method: 'GET',
  path: '/x',
  tags: [],
  deprecated: false,
  module: 'default/get-x',
  auth: [],
  models: [],
  ...overrides,
});

const operations = [
  op({
    key: 'get /pets',
    name: 'listPets',
    path: '/pets',
    tags: ['pets'],
    models: ['Pet'],
    summary: 'List all pets',
  }),
  op({
    key: 'post /pets',
    name: 'createPet',
    method: 'POST',
    path: '/pets',
    tags: ['pets'],
    models: ['NewPet', 'Pet'],
  }),
  op({
    key: 'get /orders',
    name: 'listOrders',
    path: '/orders',
    tags: ['store'],
    deprecated: true,
    operationId: 'list_orders',
    description: 'Legacy endpoint',
  }),
  op({ key: 'get /health', name: 'health', path: '/health' }),
];

describe('operation filtering', () => {
  const base = { query: '', methods: [], tag: '', deprecated: 'all' } as const;
  const names = (filter: Parameters<typeof filterOperations>[1]): string[] =>
    filterOperations(operations, filter).map((o) => o.name);

  it('searches names, ids, paths, tags, descriptions and models (all terms must match)', () => {
    expect(names({ ...base, query: 'pets' })).toEqual(['listPets', 'createPet']);
    expect(names({ ...base, query: 'list_orders' })).toEqual(['listOrders']);
    expect(names({ ...base, query: 'legacy' })).toEqual(['listOrders']);
    expect(names({ ...base, query: 'newpet' })).toEqual(['createPet']);
    expect(names({ ...base, query: 'pet list' })).toEqual(['listPets']);
  });

  it('filters by method, tag (with a default tag) and deprecation', () => {
    expect(names({ ...base, methods: ['POST'] })).toEqual(['createPet']);
    expect(names({ ...base, tag: 'default' })).toEqual(['health']);
    expect(names({ ...base, deprecated: 'only' })).toEqual(['listOrders']);
    expect(names({ ...base, deprecated: 'hide' })).not.toContain('listOrders');
  });
});

describe('model filtering', () => {
  const model = (name: string, used: boolean, recursive = false): ModelSummary => ({
    id: `#/${name}`,
    name,
    kind: 'object (1 properties)',
    module: `models/${name}`,
    used,
    usedBy: used ? 1 : 0,
    recursive,
    deprecated: false,
  });
  const models = [model('Pet', true), model('Orphan', false), model('Tree', true, true)];

  it('filters by usage, recursion and name', () => {
    expect(filterModels(models, { query: '', show: 'unused' }).map((m) => m.name)).toEqual([
      'Orphan',
    ]);
    expect(filterModels(models, { query: '', show: 'recursive' }).map((m) => m.name)).toEqual([
      'Tree',
    ]);
    expect(filterModels(models, { query: 'pet', show: 'all' }).map((m) => m.name)).toEqual(['Pet']);
  });
});

describe('routing', () => {
  it('round-trips routes with encoded keys', () => {
    const routes = [
      { page: 'overview' },
      { page: 'operations', key: 'get /pets/{id}' },
      { page: 'models', id: '#/components/schemas/Pet' },
      { page: 'graph', key: 'post /a/b' },
      { page: 'usage' },
      { page: 'generate' },
    ] as const;
    for (const route of routes) expect(parseRoute(href(route))).toEqual(route);
    expect(parseRoute('#/unknown')).toEqual({ page: 'overview' });
  });
});

describe('syntax highlighting', () => {
  it('tokenizes without losing or interpreting text', () => {
    const code = "export const a: Pet = 'x</script>'; // done";
    const tokens = tokenize(code);
    expect(tokens.map((t) => t.text).join('')).toBe(code);
    expect(tokens.filter((t) => t.kind !== 'text').map((t) => [t.kind, t.text])).toEqual([
      ['keyword', 'export'],
      ['keyword', 'const'],
      ['type', 'Pet'],
      ['string', "'x</script>'"],
      ['comment', '// done'],
    ]);
  });
});
