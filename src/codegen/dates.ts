import { dateFormat } from '../analysis/dates.ts';
import type { ModelSymbol, ProjectModel } from '../analysis/types.ts';
import type { SchemaIR } from '../ir/types.ts';
import { renderAll, type EmitContext, type ModuleOutput } from './context.ts';
import type { ImportManager } from './imports.ts';
import { propertyKey, quote, renderJsDoc } from './printer.ts';

/** A `DateShape` (see `runtime/dates`) before printing. */
type ShapeNode =
  | { readonly kind: 'leaf'; readonly format: 'date' | 'date-time' }
  | { readonly kind: 'ref'; readonly name: string }
  | { readonly kind: 'array'; readonly item: ShapeNode }
  | {
      readonly kind: 'tuple';
      readonly items: readonly (ShapeNode | undefined)[];
      readonly rest?: ShapeNode;
    }
  | {
      readonly kind: 'object';
      readonly fields: readonly (readonly [string, ShapeNode])[];
      readonly rest?: ShapeNode;
    }
  | { readonly kind: 'anyOf'; readonly items: readonly ShapeNode[] }
  | {
      readonly kind: 'discriminator';
      readonly property: string;
      readonly mapping: readonly (readonly [string, ShapeNode])[];
    };

/**
 * Where dates sit in values of `schema`, or `undefined` when there are none. References to
 * models become lazy functions so recursive and mutually dependent shapes resolve at runtime.
 */
function shapeOf(
  schema: SchemaIR,
  project: ProjectModel,
  imports: ImportManager,
): ShapeNode | undefined {
  const format = dateFormat(schema);
  if (format !== undefined) return { kind: 'leaf', format };
  switch (schema.kind) {
    case 'ref': {
      const model = project.modelById.get(schema.target);
      if (model?.datesName === undefined || model.datesModule === undefined) return undefined;
      return {
        kind: 'ref',
        name: imports.add(model.datesModule, model.datesName, { typeOnly: false }),
      };
    }
    case 'array': {
      const item =
        schema.items.kind === 'never' ? undefined : shapeOf(schema.items, project, imports);
      if (schema.prefixItems === undefined)
        return item === undefined ? undefined : { kind: 'array', item };
      const items = schema.prefixItems.map((prefix) => shapeOf(prefix, project, imports));
      if (item === undefined && items.every((entry) => entry === undefined)) return undefined;
      return { kind: 'tuple', items, ...(item === undefined ? {} : { rest: item }) };
    }
    case 'object': {
      const fields: (readonly [string, ShapeNode])[] = [];
      for (const property of schema.properties) {
        const shape = shapeOf(property.schema, project, imports);
        if (shape !== undefined) fields.push([property.name, shape]);
      }
      const rest =
        schema.additionalProperties === undefined || schema.additionalProperties === false
          ? undefined
          : shapeOf(schema.additionalProperties, project, imports);
      if (fields.length === 0 && rest === undefined) return undefined;
      return { kind: 'object', fields, ...(rest === undefined ? {} : { rest }) };
    }
    case 'union': {
      if (schema.discriminator !== undefined) {
        const mapping: (readonly [string, ShapeNode])[] = [];
        for (const entry of schema.discriminator.mapping) {
          const shape = shapeOf({ kind: 'ref', target: entry.target }, project, imports);
          if (shape !== undefined) mapping.push([entry.value, shape]);
        }
        if (mapping.length > 0)
          return { kind: 'discriminator', property: schema.discriminator.propertyName, mapping };
      }
      return anyOf(schema.variants.map((variant) => shapeOf(variant, project, imports)));
    }
    case 'intersection':
      return anyOf(schema.members.map((member) => shapeOf(member, project, imports)));
    default:
      return undefined;
  }
}

function anyOf(shapes: readonly (ShapeNode | undefined)[]): ShapeNode | undefined {
  const present: ShapeNode[] = [];
  const seen = new Set<string>();
  for (const shape of shapes) {
    if (shape === undefined) continue;
    const key = print(shape, '');
    if (seen.has(key)) continue;
    seen.add(key);
    present.push(shape);
  }
  if (present.length <= 1) return present[0];
  return { kind: 'anyOf', items: present };
}

const MAX_INLINE = 72;

/** Prints a shape; objects that do not fit on one line are spread over several lines. */
function print(node: ShapeNode, indent: string): string {
  const inner = `${indent}  `;
  const block = (open: string, entries: readonly string[], close: string): string => {
    const inline = `${open} ${entries.join(', ')} ${close}`;
    if (entries.length === 0) return `${open}${close}`;
    if (inline.length <= MAX_INLINE && !inline.includes('\n')) return inline;
    return `${open}\n${entries.map((entry) => `${inner}${entry},`).join('\n')}\n${indent}${close}`;
  };
  switch (node.kind) {
    case 'leaf':
      return quote(node.format);
    case 'ref':
      return `() => ${node.name}`;
    case 'array':
      return block('{', [`array: ${print(node.item, inner)}`], '}');
    case 'tuple': {
      const items = node.items.map((item) => (item === undefined ? 'null' : print(item, inner)));
      return block(
        '{',
        [
          `tuple: [${items.join(', ')}]`,
          ...(node.rest === undefined ? [] : [`rest: ${print(node.rest, inner)}`]),
        ],
        '}',
      );
    }
    case 'object': {
      const fields = node.fields.map(
        ([key, value]) => `${propertyKey(key)}: ${print(value, `${inner}  `)}`,
      );
      return block(
        '{',
        [
          `object: ${block('{', fields, '}').replace(/\n/g, `\n  `)}`,
          ...(node.rest === undefined ? [] : [`rest: ${print(node.rest, inner)}`]),
        ],
        '}',
      );
    }
    case 'anyOf':
      return block(
        '{',
        [`anyOf: [${node.items.map((item) => print(item, inner)).join(', ')}]`],
        '}',
      );
    case 'discriminator': {
      const mapping = node.mapping.map(
        ([value, shape]) => `${propertyKey(value)}: ${print(shape, `${inner}  `)}`,
      );
      return block(
        '{',
        [
          `discriminator: ${quote(node.property)}`,
          `mapping: ${block('{', mapping, '}').replace(/\n/g, `\n  `)}`,
        ],
        '}',
      );
    }
  }
}

/** The printed `DateShape` of a schema, or `undefined` when it contains no dates. */
export function dateShape(
  schema: SchemaIR,
  project: ProjectModel,
  imports: ImportManager,
  indent = '',
): string | undefined {
  const shape = shapeOf(schema, project, imports);
  return shape === undefined ? undefined : print(shape, indent);
}

/** One shape covering several schemas (each one's dates are converted), or `undefined`. */
export function combinedDateShape(
  schemas: readonly SchemaIR[],
  project: ProjectModel,
  imports: ImportManager,
  indent = '',
): string | undefined {
  const shape = anyOf(schemas.map((schema) => shapeOf(schema, project, imports)));
  return shape === undefined ? undefined : print(shape, indent);
}

/** The `dates/<model>` module: the date shape of one model. */
export function generateDatesModule(
  model: ModelSymbol,
  ctx: EmitContext,
): ModuleOutput | undefined {
  const { datesName: name, datesModule: module } = model;
  if (name === undefined || module === undefined) return undefined;
  const outputs = renderAll(module, ctx, (imports, lang) => {
    imports.declare(name);
    const shape = dateShape(model.definition.schema, ctx.project, imports) ?? '{ object: {} }';
    const type = imports.add('runtime/dates', 'DateShape', { typeOnly: true });
    const doc = renderJsDoc({
      summary: `Where \`Date\` values sit in \`${model.name}\`; converts responses and requests.`,
      tags: lang === 'js' ? [{ tag: 'type', text: `{${type}}` }] : [],
    });
    if (lang === 'dts') return `${doc}export declare const ${name}: ${type};\n`;
    return `${doc}export const ${name}${lang === 'ts' ? `: ${type}` : ''} = ${shape};\n`;
  });
  return {
    module,
    origin: 'core:dates',
    ...outputs,
    exports: [{ name, kind: 'runtime', typeOnly: false }],
    sources: { schemas: [model.id] },
  };
}
