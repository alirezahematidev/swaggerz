import type { SchemaDefinition, SchemaIR } from '../../ir/types.ts';
import type { XmlShape } from '../../templates/mocks/fake.ts';

/** Nested schemas followed for an XML shape; deeper values use their property names. */
const MAX_DEPTH = 8;

/** Whether a media type is XML (`application/xml`, `text/xml`, `application/atom+xml`…). */
export function isXml(mediaType: string): boolean {
  const type = mediaType.split(';')[0]?.trim().toLowerCase() ?? '';
  return type === 'application/xml' || type === 'text/xml' || type.endsWith('+xml');
}

/**
 * How values of `schema` are written in XML, from the XML Objects of the schema and of what it
 * contains. The root element is named by its XML Object, then by the referenced component.
 */
export function xmlShape(
  schema: SchemaIR,
  definitions: ReadonlyMap<string, SchemaDefinition>,
  names: ReadonlyMap<string, string>,
): XmlShape {
  const root = schema.kind === 'ref' ? names.get(schema.target) : undefined;
  const shape = shapeOf(schema, definitions, 0);
  return shape.name === undefined && root !== undefined ? { ...shape, name: root } : shape;
}

function shapeOf(
  schema: SchemaIR,
  definitions: ReadonlyMap<string, SchemaDefinition>,
  depth: number,
): XmlShape {
  const own = ownShape(schema);
  if (depth > MAX_DEPTH) return own;
  switch (schema.kind) {
    case 'ref': {
      const target = definitions.get(schema.target)?.schema;
      // The reference's own XML Object wins over the component's.
      return target === undefined ? own : { ...shapeOf(target, definitions, depth + 1), ...own };
    }
    case 'array': {
      const items = shapeOf(schema.items, definitions, depth + 1);
      return Object.keys(items).length === 0 ? own : { ...own, items };
    }
    case 'object':
    case 'intersection':
    case 'union': {
      const properties: Record<string, XmlShape> = {};
      for (const [name, property] of propertiesOf(schema, definitions, depth)) {
        const shape = shapeOf(property, definitions, depth + 1);
        if (Object.keys(shape).length > 0) properties[name] = shape;
      }
      return Object.keys(properties).length === 0 ? own : { ...own, properties };
    }
    default:
      return own;
  }
}

/** The properties of object schemas, through `allOf`, `oneOf` and references. */
function propertiesOf(
  schema: SchemaIR,
  definitions: ReadonlyMap<string, SchemaDefinition>,
  depth: number,
): Map<string, SchemaIR> {
  const found = new Map<string, SchemaIR>();
  const visit = (node: SchemaIR, level: number): void => {
    if (level > MAX_DEPTH) return;
    if (node.kind === 'object') {
      for (const property of node.properties)
        if (!found.has(property.name)) found.set(property.name, property.schema);
    } else if (node.kind === 'intersection') {
      for (const member of node.members) visit(member, level + 1);
    } else if (node.kind === 'union') {
      for (const variant of node.variants) visit(variant, level + 1);
    } else if (node.kind === 'ref') {
      const target = definitions.get(node.target)?.schema;
      if (target !== undefined) visit(target, level + 1);
    }
  };
  visit(schema, depth);
  return found;
}

function ownShape(schema: SchemaIR): XmlShape {
  const xml = schema.xml;
  if (xml === undefined) return {};
  const content =
    xml.nodeType === 'text' || xml.nodeType === 'cdata' || xml.nodeType === 'none'
      ? xml.nodeType
      : undefined;
  return {
    ...(xml.name === undefined ? {} : { name: xml.name }),
    ...(xml.namespace === undefined ? {} : { namespace: xml.namespace }),
    ...(xml.prefix === undefined ? {} : { prefix: xml.prefix }),
    ...(xml.attribute === true || xml.nodeType === 'attribute' ? { attribute: true } : {}),
    ...(xml.wrapped === true ? { wrapped: true } : {}),
    ...(content === undefined ? {} : { content }),
  };
}
