import type { SchemaIR } from '../ir/types.ts';
import type { ProjectModel } from './types.ts';

/** Short human description of a schema's shape. */
export function describeSchema(schema: SchemaIR): string {
  const nullable = schema.nullable === true ? ' | null' : '';
  switch (schema.kind) {
    case 'object':
      return `object (${schema.properties.length} properties)${nullable}`;
    case 'union':
      return `${schema.combinator === 'type' ? 'union' : schema.combinator} of ${schema.variants.length}${schema.discriminator === undefined ? '' : `, discriminated by ${schema.discriminator.propertyName}`}${nullable}`;
    case 'intersection':
      return `allOf of ${schema.members.length}${nullable}`;
    case 'enum':
      return `enum (${schema.values.length} values)${nullable}`;
    case 'array':
      return `array${nullable}`;
    case 'ref':
      return `alias${nullable}`;
    default:
      return `${schema.kind}${nullable}`;
  }
}

export function inspectData(project: ProjectModel): {
  operations: Record<string, unknown>[];
  models: Record<string, unknown>[];
} {
  const { graph } = project;
  return {
    operations: project.operations.map((op) => ({
      name: op.name,
      method: op.operation.method.toUpperCase(),
      path: op.operation.path,
      operationId: op.operation.operationId ?? null,
      tags: op.operation.tags,
      summary: op.operation.summary ?? null,
      deprecated: op.operation.deprecated,
      module: op.module,
      models: [...graph.operationClosure(op.key)]
        .map((id) => project.modelById.get(id)?.name)
        .filter((name): name is string => name !== undefined)
        .sort(),
    })),
    models: project.models.map((model) => ({
      name: model.name,
      id: model.id,
      kind: describeSchema(model.definition.schema),
      module: model.module,
      used: model.used,
      usedBy: graph
        .operationsUsing(model.id)
        .map((key) => project.operationByKey.get(key)?.name ?? key),
      references: [...(graph.schemaDeps.get(model.id) ?? [])]
        .map((id) => project.modelById.get(id)?.name)
        .filter((name): name is string => name !== undefined)
        .sort(),
    })),
  };
}
