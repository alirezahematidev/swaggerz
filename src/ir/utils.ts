import type { ApiDocument, OperationIR, SchemaIR, SchemaMeta } from './types.ts';

const META_KEYS: readonly (keyof SchemaMeta)[] = [
  'nullable',
  'title',
  'description',
  'deprecated',
  'readOnly',
  'writeOnly',
  'default',
  'examples',
  'format',
  'assertions',
  'extensions',
  'source',
];

/** Copies the metadata fields of a schema node. */
export function pickMeta(schema: SchemaMeta): SchemaMeta {
  const result: Record<string, unknown> = {};
  for (const key of META_KEYS) if (schema[key] !== undefined) result[key] = schema[key];
  return result;
}

/** Calls `visit` for every direct child schema. */
export function forEachChild(schema: SchemaIR, visit: (child: SchemaIR) => void): void {
  switch (schema.kind) {
    case 'array':
      schema.prefixItems?.forEach(visit);
      visit(schema.items);
      break;
    case 'object':
      for (const property of schema.properties) visit(property.schema);
      if (schema.additionalProperties !== undefined && schema.additionalProperties !== false) {
        visit(schema.additionalProperties);
      }
      break;
    case 'union':
      schema.variants.forEach(visit);
      break;
    case 'intersection':
      schema.members.forEach(visit);
      break;
    default:
      break;
  }
}

/**
 * Collects referenced definition ids (direct references only; does not follow them). Subtypes
 * listed by an allOf-polymorphism discriminator are included unless `subtypes` is false: they are
 * possible values of the schema but not part of its structure.
 */
export function collectRefs(
  schema: SchemaIR,
  into: Set<string> = new Set(),
  options: { subtypes?: boolean } = {},
): Set<string> {
  const stack: SchemaIR[] = [schema];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    if (current.kind === 'ref') into.add(current.target);
    if (current.kind === 'object' && options.subtypes !== false) {
      current.discriminator?.mapping.forEach((m) => into.add(m.target));
    }
    if (current.kind === 'union') current.discriminator?.mapping.forEach((m) => into.add(m.target));
    forEachChild(current, (child) => stack.push(child));
    forEachAssertion(current, (child) => stack.push(child));
  }
  return into;
}

/** Calls `visit` for every schema inside the assertions (`not`, `if`, …) of a node. */
export function forEachAssertion(schema: SchemaIR, visit: (child: SchemaIR) => void): void {
  const assertions = schema.assertions;
  if (assertions === undefined) return;
  const conditional = assertions.conditional;
  for (const child of [
    assertions.not,
    conditional?.condition,
    conditional?.whenTrue,
    conditional?.whenFalse,
  ])
    if (child !== undefined) visit(child);
  for (const child of Object.values(assertions.dependentSchemas ?? {})) visit(child);
}

/** Every top-level schema used by an operation. */
export function operationSchemas(operation: OperationIR): SchemaIR[] {
  return [
    ...operation.parameters.map((p) => p.schema),
    ...(operation.requestBody?.contents.map((c) => c.schema) ?? []),
    ...operation.responses.flatMap((r) => [
      ...r.contents.map((c) => c.schema),
      ...r.headers.map((h) => h.schema),
    ]),
  ];
}

/** Operations of every webhook and of every callback of every operation. */
export function webhookOperations(ir: ApiDocument): OperationIR[] {
  return [
    ...ir.webhooks.flatMap((webhook) => webhook.operations),
    ...ir.operations.flatMap((operation) =>
      (operation.callbacks ?? []).flatMap((callback) => callback.operations),
    ),
  ];
}

/** Whether `schema` (or any nested node, not following refs) satisfies `predicate`. */
export function someSchema(schema: SchemaIR, predicate: (node: SchemaIR) => boolean): boolean {
  if (predicate(schema)) return true;
  let found = false;
  forEachChild(schema, (child) => {
    if (!found && someSchema(child, predicate)) found = true;
  });
  return found;
}
