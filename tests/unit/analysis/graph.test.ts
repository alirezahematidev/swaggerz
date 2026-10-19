import { describe, expect, it } from 'vitest';
import { DependencyGraph, findDuplicateSchemas } from '../../../src/analysis/graph.ts';
import { parseFixture } from '../../helpers.ts';

describe('DependencyGraph', () => {
  it('finds self and mutual recursion with strongly connected components', async () => {
    const features = await parseFixture('features-3.1.yaml', '3.1');
    expect([...DependencyGraph.build(features.ir).recursiveSchemas()].sort()).toEqual([
      '#/components/schemas/TreeNode',
    ]);
    const external = await parseFixture('external/openapi.yaml', '3.0');
    expect([...DependencyGraph.build(external.ir).recursiveSchemas()].sort()).toEqual([
      'schemas/person.yaml#',
      'schemas/team.yaml#',
    ]);
  });

  it('computes closures, used schemas and reverse usage', async () => {
    const { ir } = await parseFixture('petstore-3.0.yaml', '3.0');
    const graph = DependencyGraph.build(ir);
    expect([...graph.operationClosure('get /pet/{petId}')].sort()).toEqual(
      ['Category', 'Error', 'NewPet', 'Pet', 'Tag'].map((n) => `#/components/schemas/${n}`),
    );
    expect(graph.operationsUsing('#/components/schemas/Tag')).toEqual([
      'get /pet/findByStatus',
      'get /pet/findByTags',
      'get /pet/{petId}',
      'post /pet',
      'put /pet',
    ]);
    expect(graph.usedSchemas().size).toBe(9);
    expect(graph.explain('get /pet/{petId}', '#/components/schemas/Tag')).toEqual([
      '#/components/schemas/Pet',
      '#/components/schemas/NewPet',
      '#/components/schemas/Tag',
    ]);
    expect(graph.explain('get /store/inventory', '#/components/schemas/Tag')).toBeUndefined();
  });

  it('reports unused schemas and structural duplicates', async () => {
    const features = await parseFixture('features-3.1.yaml', '3.1');
    const graph = DependencyGraph.build(features.ir);
    expect(graph.usedSchemas().has('#/components/schemas/Unused')).toBe(false);
    const petstore = await parseFixture('petstore-3.0.yaml', '3.0');
    expect(findDuplicateSchemas(petstore.ir)).toEqual([
      ['#/components/schemas/Category', '#/components/schemas/Tag'],
    ]);
  });
});
