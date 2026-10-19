import type { ApiDocument, SchemaIR } from '../ir/types.ts';
import { forEachChild } from '../ir/utils.ts';

/** `date` or `date-time` for string schemas with those formats. */
export function dateFormat(schema: SchemaIR): 'date' | 'date-time' | undefined {
  return schema.kind === 'string' && (schema.format === 'date' || schema.format === 'date-time')
    ? schema.format
    : undefined;
}

/** References of a schema, including discriminator mapping targets (not following refs). */
function references(schema: SchemaIR, into: string[] = []): string[] {
  if (schema.kind === 'ref') into.push(schema.target);
  if (schema.kind === 'object' || schema.kind === 'union')
    for (const entry of schema.discriminator?.mapping ?? []) into.push(entry.target);
  forEachChild(schema, (child) => {
    references(child, into);
  });
  return into;
}

/** Whether a schema contains a date string (not following refs). */
function hasDateLeaf(schema: SchemaIR): boolean {
  if (dateFormat(schema) !== undefined) return true;
  let found = false;
  forEachChild(schema, (child) => {
    if (!found && hasDateLeaf(child)) found = true;
  });
  return found;
}

/** Ids of definitions whose values contain dates, directly or through referenced models. */
export function definitionsWithDates(ir: ApiDocument): Set<string> {
  const dependents = new Map<string, string[]>();
  const result = new Set<string>();
  for (const definition of ir.schemas) {
    if (hasDateLeaf(definition.schema)) result.add(definition.id);
    for (const target of references(definition.schema)) {
      const list = dependents.get(target);
      if (list === undefined) dependents.set(target, [definition.id]);
      else list.push(definition.id);
    }
  }
  const queue = [...result];
  for (let index = 0; index < queue.length; index++) {
    for (const dependent of dependents.get(queue[index] ?? '') ?? []) {
      if (!result.has(dependent)) {
        result.add(dependent);
        queue.push(dependent);
      }
    }
  }
  return result;
}
