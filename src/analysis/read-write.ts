import type {
  ApiDocument,
  DiscriminatorIR,
  MediaTypeIR,
  OperationIR,
  PropertyIR,
  SchemaDefinition,
  SchemaIR,
  WebhookIR,
} from '../ir/types.ts';
import { mediaSchemas, webhookOperations } from '../ir/utils.ts';
import { compareStrings } from '../utils/strings.ts';

/** Appended to a definition id to form the id of its request-side variant. */
export const INPUT_ID_SUFFIX = '~input';

type View = 'read' | 'write';

/**
 * Splits models by direction (OpenAPI `readOnly`/`writeOnly`): response data never contains
 * `writeOnly` properties and request bodies never contain `readOnly` ones.
 *
 * Definitions keep their id and become the response ("read") shape. Every definition whose
 * shape differs between directions — directly, or through the models it references — gets a
 * request ("write") variant with the id `<id>~input` and the name `<name><suffix>`. Request
 * bodies reference the write variants. Webhooks and callbacks are requests the API sends, so
 * their payloads use the read shape and their responses the write shape. Returns `ir` itself
 * when no schema uses `readOnly` or `writeOnly`.
 */
export function splitReadWrite(ir: ApiDocument, suffix: string): ApiDocument {
  const byId = new Map(ir.schemas.map((definition) => [definition.id, definition]));
  const marks = (schema: SchemaIR, flag: 'readOnly' | 'writeOnly'): boolean => {
    if (schema[flag] === true) return true;
    return schema.kind === 'ref' && byId.get(schema.target)?.schema[flag] === true;
  };

  // Definitions that declare readOnly/writeOnly properties themselves, and reference edges.
  const direct = new Set<string>();
  const dependents = new Map<string, Set<string>>();
  for (const definition of ir.schemas) {
    walk(definition.schema, (node) => {
      if (node.kind === 'object') {
        if (
          node.properties.some((p) => marks(p.schema, 'readOnly') || marks(p.schema, 'writeOnly'))
        )
          direct.add(definition.id);
        for (const entry of node.discriminator?.mapping ?? []) edge(entry.target, definition.id);
      }
      if (node.kind === 'union')
        for (const entry of node.discriminator?.mapping ?? []) edge(entry.target, definition.id);
      if (node.kind === 'ref') edge(node.target, definition.id);
    });
  }
  function edge(target: string, from: string): void {
    let set = dependents.get(target);
    if (set === undefined) {
      set = new Set();
      dependents.set(target, set);
    }
    set.add(from);
  }

  const incoming = webhookOperations(ir);
  const operationsUse = [...ir.operations, ...incoming].some((operation) =>
    operationSchemas(operation).some((schema) =>
      someNode(
        schema,
        (node) =>
          node.kind === 'object' &&
          node.properties.some((p) => marks(p.schema, 'readOnly') || marks(p.schema, 'writeOnly')),
      ),
    ),
  );
  if (direct.size === 0 && !operationsUse) return ir;

  // Everything that references an affected definition is affected (reverse BFS).
  const affected = new Set(direct);
  const queue = [...direct];
  for (let index = 0; index < queue.length; index++) {
    for (const dependent of dependents.get(queue[index] ?? '') ?? []) {
      if (!affected.has(dependent)) {
        affected.add(dependent);
        queue.push(dependent);
      }
    }
  }

  // Only models that request bodies can reach need a request-side variant.
  const references = (schema: SchemaIR): string[] => {
    const targets: string[] = [];
    walk(schema, (node) => {
      if (node.kind === 'ref') targets.push(node.target);
      if (node.kind === 'object' || node.kind === 'union')
        for (const entry of node.discriminator?.mapping ?? []) targets.push(entry.target);
    });
    return targets;
  };
  const writable = new Set<string>();
  const pending = [
    ...ir.operations.flatMap((operation) =>
      (operation.requestBody?.contents ?? [])
        .flatMap(mediaSchemas)
        .flatMap((schema) => references(schema)),
    ),
    ...incoming.flatMap((operation) =>
      operation.responses.flatMap((response) =>
        response.contents.flatMap(mediaSchemas).flatMap((schema) => references(schema)),
      ),
    ),
  ];
  for (let index = 0; index < pending.length; index++) {
    const id = pending[index] ?? '';
    if (writable.has(id)) continue;
    writable.add(id);
    const definition = byId.get(id);
    if (definition !== undefined) pending.push(...references(definition.schema));
  }
  const variants = new Set([...affected].filter((id) => writable.has(id)));

  const inputId = (id: string): string => (variants.has(id) ? `${id}${INPUT_ID_SUFFIX}` : id);

  function mapDiscriminator(discriminator: DiscriminatorIR, direction: View): DiscriminatorIR {
    if (direction === 'read') return discriminator;
    const mapping = discriminator.mapping.map((entry) => ({
      ...entry,
      target: inputId(entry.target),
    }));
    return mapping.every((entry, i) => entry.target === discriminator.mapping[i]?.target)
      ? discriminator
      : { ...discriminator, mapping };
  }

  /** Returns the schema as seen in one direction; unchanged subtrees are returned as-is. */
  function view(schema: SchemaIR, direction: View): SchemaIR {
    switch (schema.kind) {
      case 'ref': {
        if (direction === 'read') return schema;
        const target = inputId(schema.target);
        return target === schema.target ? schema : { ...schema, target };
      }
      case 'array': {
        const items = view(schema.items, direction);
        const prefixItems = schema.prefixItems?.map((item) => view(item, direction));
        const prefixChanged = prefixItems?.some((item, i) => item !== schema.prefixItems?.[i]);
        if (items === schema.items && prefixChanged !== true) return schema;
        return { ...schema, items, ...(prefixItems === undefined ? {} : { prefixItems }) };
      }
      case 'object': {
        const hidden = direction === 'read' ? 'writeOnly' : 'readOnly';
        let changed = false;
        const properties: PropertyIR[] = [];
        for (const property of schema.properties) {
          if (marks(property.schema, hidden)) {
            changed = true;
            continue;
          }
          const next = view(property.schema, direction);
          if (next !== property.schema) changed = true;
          properties.push(next === property.schema ? property : { ...property, schema: next });
        }
        const additional =
          schema.additionalProperties === undefined || schema.additionalProperties === false
            ? schema.additionalProperties
            : view(schema.additionalProperties, direction);
        const discriminator =
          schema.discriminator === undefined
            ? undefined
            : mapDiscriminator(schema.discriminator, direction);
        if (
          !changed &&
          additional === schema.additionalProperties &&
          discriminator === schema.discriminator
        )
          return schema;
        // Every property was hidden: the object accepts nothing (not "any object").
        const emptied =
          properties.length === 0 && schema.properties.length > 0 && additional === undefined;
        return {
          ...schema,
          properties,
          ...(emptied ? { additionalProperties: false } : {}),
          ...(additional === undefined ? {} : { additionalProperties: additional }),
          ...(discriminator === undefined ? {} : { discriminator }),
        };
      }
      case 'union': {
        const mapped = schema.variants.map((variant) => view(variant, direction));
        const discriminator =
          schema.discriminator === undefined
            ? undefined
            : mapDiscriminator(schema.discriminator, direction);
        if (
          mapped.every((variant, i) => variant === schema.variants[i]) &&
          discriminator === schema.discriminator
        )
          return schema;
        return {
          ...schema,
          variants: mapped,
          ...(discriminator === undefined ? {} : { discriminator }),
        };
      }
      case 'intersection': {
        const mapped = schema.members.map((member) => view(member, direction));
        if (mapped.every((member, i) => member === schema.members[i])) return schema;
        // allOf members whose properties were all hidden contribute nothing.
        const members = mapped.filter(
          (member, i) => !(member !== schema.members[i] && isEmptied(member)),
        );
        return { ...schema, members: members.length === 0 ? mapped : members };
      }
      default:
        return schema;
    }
  }

  const contents = (list: readonly MediaTypeIR[], direction: View): readonly MediaTypeIR[] => {
    const next = list.map((media) => {
      const schema = view(media.schema, direction);
      const itemSchema =
        media.itemSchema === undefined ? undefined : view(media.itemSchema, direction);
      return schema === media.schema && itemSchema === media.itemSchema
        ? media
        : { ...media, schema, ...(itemSchema === undefined ? {} : { itemSchema }) };
    });
    return next.every((media, i) => media === list[i]) ? list : next;
  };

  /** `outgoing`: a request we send. Webhooks and callbacks are requests the API sends us. */
  const mapOperation = (operation: OperationIR, outgoing: boolean): OperationIR => ({
    ...operation,
    ...(operation.requestBody === undefined
      ? {}
      : {
          requestBody: {
            ...operation.requestBody,
            contents: contents(operation.requestBody.contents, outgoing ? 'write' : 'read'),
          },
        }),
    responses: operation.responses.map((response) => ({
      ...response,
      contents: contents(response.contents, outgoing ? 'read' : 'write'),
    })),
    ...(operation.callbacks === undefined
      ? {}
      : { callbacks: operation.callbacks.map((callback) => mapWebhook(callback)) }),
  });
  const mapWebhook = (webhook: WebhookIR): WebhookIR => ({
    ...webhook,
    operations: webhook.operations.map((operation) => mapOperation(operation, false)),
  });
  const operations = ir.operations.map((operation) => mapOperation(operation, true));
  const webhooks = ir.webhooks.map(mapWebhook);

  const schemas: SchemaDefinition[] = [];
  for (const definition of ir.schemas) {
    const read = view(definition.schema, 'read');
    schemas.push(read === definition.schema ? definition : { ...definition, schema: read });
    if (variants.has(definition.id)) {
      schemas.push({
        id: `${definition.id}${INPUT_ID_SUFFIX}`,
        name: `${definition.name}${suffix}`,
        aliases: [],
        schema: view(definition.schema, 'write'),
        source: definition.source,
      });
    }
  }
  schemas.sort((a, b) => compareStrings(a.id, b.id));
  return { ...ir, schemas, operations, webhooks };
}

function isEmptied(schema: SchemaIR): boolean {
  return (
    schema.kind === 'object' &&
    schema.properties.length === 0 &&
    schema.additionalProperties === false &&
    schema.discriminator === undefined
  );
}

/** Schemas of an operation's bodies (request and responses). */
function operationSchemas(operation: OperationIR): SchemaIR[] {
  return [
    ...(operation.requestBody?.contents ?? []).flatMap(mediaSchemas),
    ...operation.responses.flatMap((response) => response.contents.flatMap(mediaSchemas)),
  ];
}

/** Visits a schema and its nested inline schemas (references are not followed). */
function walk(schema: SchemaIR, visit: (node: SchemaIR) => void): void {
  visit(schema);
  switch (schema.kind) {
    case 'array':
      walk(schema.items, visit);
      for (const item of schema.prefixItems ?? []) walk(item, visit);
      break;
    case 'object':
      for (const property of schema.properties) walk(property.schema, visit);
      if (schema.additionalProperties !== undefined && schema.additionalProperties !== false)
        walk(schema.additionalProperties, visit);
      break;
    case 'union':
      for (const variant of schema.variants) walk(variant, visit);
      break;
    case 'intersection':
      for (const member of schema.members) walk(member, visit);
      break;
    default:
      break;
  }
}

function someNode(schema: SchemaIR, predicate: (node: SchemaIR) => boolean): boolean {
  let found = false;
  walk(schema, (node) => {
    if (!found && predicate(node)) found = true;
  });
  return found;
}
