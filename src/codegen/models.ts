import { applyCase, isPropertyIdentifier, NameRegistry, toIdentifier } from '../analysis/naming.ts';
import type { ModelSymbol } from '../analysis/types.ts';
import type { DiscriminatorIR, JsonValue, SchemaIR } from '../ir/types.ts';
import { applyJsDocHook, renderAll, type EmitContext, type ModuleOutput } from './context.ts';
import type { ImportManager, Lang } from './imports.ts';
import { schemaDoc } from './jsdoc.ts';
import { literal, propertyKey, quote, renderJsDoc } from './printer.ts';
import { printType, printTypeNode, wrapType, type TypeContext } from './type-printer.ts';
import type { GeneratedExport, JsDocBlock, JsDocTag } from './types.ts';

function discriminatorOf(schema: SchemaIR | undefined): DiscriminatorIR | undefined {
  if (schema?.kind === 'object') return schema.discriminator;
  if (schema?.kind === 'intersection') {
    for (const member of schema.members)
      if (member.kind === 'object' && member.discriminator !== undefined)
        return member.discriminator;
  }
  return undefined;
}

/** Discriminator values a child model must carry because it `allOf`-extends a polymorphic base. */
export function inheritedDiscriminators(
  model: ModelSymbol,
  ctx: EmitContext,
): { property: string; values: string[] }[] {
  const schema = model.definition.schema;
  if (schema.kind !== 'intersection') return [];
  const result: { property: string; values: string[] }[] = [];
  for (const member of schema.members) {
    if (member.kind !== 'ref') continue;
    const discriminator = discriminatorOf(
      ctx.project.modelById.get(member.target)?.definition.schema,
    );
    if (discriminator === undefined) continue;
    const values = discriminator.mapping.filter((m) => m.target === model.id).map((m) => m.value);
    if (values.length > 0) result.push({ property: discriminator.propertyName, values });
  }
  return result;
}

/** Member names for `const` enum objects. */
function enumMemberNames(schema: Extract<SchemaIR, { kind: 'enum' }>): string[] {
  const extension = schema.extensions?.['x-enum-varnames'] ?? schema.extensions?.['x-enumNames'];
  const fromExtension =
    Array.isArray(extension) &&
    extension.length === schema.values.length &&
    extension.every((v) => typeof v === 'string')
      ? extension
      : undefined;
  const registry = new NameRegistry();
  return schema.values.map((value, index) => {
    const preferred = fromExtension?.[index] ?? defaultMemberName(value);
    return registry.claim(toIdentifier(preferred, 'PascalCase'));
  });
}

function defaultMemberName(value: JsonValue): string {
  if (typeof value === 'string')
    return value === '' ? 'Empty' : applyCase(value, 'PascalCase') || `Value ${value}`;
  if (typeof value === 'number')
    return `Value ${value < 0 ? `Minus ${-value}` : String(value)}`.replace('.', ' ');
  return JSON.stringify(value);
}

function isConstEnum(
  schema: SchemaIR,
  ctx: EmitContext,
): schema is Extract<SchemaIR, { kind: 'enum' }> {
  return (
    ctx.config.types.enums === 'const' &&
    schema.kind === 'enum' &&
    schema.values.every((v) => typeof v === 'string' || typeof v === 'number')
  );
}

function modelDoc(model: ModelSymbol, ctx: EmitContext): JsDocBlock {
  return applyJsDocHook(ctx, schemaDoc(model.definition.schema), {
    kind: 'model',
    definition: model.definition,
  });
}

/** Renders a JSDoc typedef for JavaScript output. */
export function jsTypedef(
  name: string,
  schema: SchemaIR,
  doc: JsDocBlock,
  typeCtx: TypeContext,
  extraType?: string,
): string {
  const tags: JsDocTag[] = doc.tags.filter((t) => t.tag === 'deprecated');
  const canUseProperties =
    extraType === undefined &&
    schema.kind === 'object' &&
    schema.nullable !== true &&
    schema.additionalProperties === undefined &&
    schema.properties.length > 0 &&
    schema.properties.every((p) => isPropertyIdentifier(p.name));
  if (canUseProperties) {
    tags.push({ tag: 'typedef', text: `{object} ${name}` });
    for (const property of schema.properties) {
      const description = (property.schema.description ?? '').split('\n')[0] ?? '';
      const label = property.required ? property.name : `[${property.name}]`;
      tags.push({
        tag: 'property',
        text: `{${printType(property.schema, typeCtx)}} ${label}${description === '' ? '' : ` - ${description}`}`,
      });
    }
  } else {
    const type = printTypeNode(schema, typeCtx);
    tags.push({
      tag: 'typedef',
      text: `{${extraType === undefined ? type.text : `${wrapType(type, 'intersection')} & ${extraType}`}} ${name}`,
    });
  }
  return renderJsDoc({ ...doc, tags });
}

/**
 * A type context that moves top-level array types into the model's helper typedefs
 * (`ModelSymbol.arrayTypedefs`): `@typedef {string | JsonValue[]} JsonValue` is a circularity
 * error, `@typedef {JsonValue[]} JsonValueArray` with `@typedef {string | JsonValueArray}
 * JsonValue` is not. Returns the context and a function rendering the helper typedefs.
 */
function hoistingContext(
  model: ModelSymbol,
  typeCtx: TypeContext,
  ctx: EmitContext,
): { typeCtx: TypeContext; helpers: () => string } {
  const names = model.arrayTypedefs ?? [];
  if (names.length === 0) return { typeCtx, helpers: () => '' };
  const hoisted = new Map<string, string>();
  const hoistArray = (type: string): string => {
    const existing = hoisted.get(type);
    if (existing !== undefined) return existing;
    const name = names[hoisted.size];
    if (name === undefined) return type;
    hoisted.set(type, name);
    return name;
  };
  const helpers = (): string =>
    [...hoisted]
      .map(([type, name]) =>
        renderJsDoc({
          ...(ctx.config.features.jsdoc
            ? { summary: `An array type of {@link ${model.name}}.` }
            : {}),
          tags: [{ tag: 'typedef', text: `{${type}} ${name}` }],
        }),
      )
      .join('\n');
  return { typeCtx: { ...typeCtx, hoistArray }, helpers };
}

export function generateModel(model: ModelSymbol, ctx: EmitContext): ModuleOutput {
  const { definition } = model;
  const schema = definition.schema;
  const doc = modelDoc(model, ctx);
  const constEnum = isConstEnum(schema, ctx);
  const exports: GeneratedExport[] = [
    { name: model.name, kind: 'model', typeOnly: !constEnum },
    ...model.aliases.map((alias) => ({ name: alias, kind: 'model' as const, typeOnly: true })),
  ];

  const body = (imports: ImportManager, lang: Lang): string => {
    for (const name of [model.name, ...model.aliases, ...(model.arrayTypedefs ?? [])])
      imports.declare(name);
    const typeCtx: TypeContext = {
      imports,
      project: ctx.project,
      config: ctx.config,
      local: new Map([[model.id, model.name]]),
      direction: 'output',
    };
    const tags = inheritedDiscriminators(model, ctx).map(
      ({ property, values }) => `{ ${propertyKey(property)}: ${values.map(quote).join(' | ')} }`,
    );
    const extra = tags.length === 0 ? undefined : tags.join(' & ');
    const parts: string[] = [];

    if (constEnum) {
      const names = enumMemberNames(schema);
      const entries = schema.values.map(
        (value, index) => `${names[index] ?? 'Value'}: ${literal(value)}`,
      );
      const typeExpression = `(typeof ${model.name})[keyof typeof ${model.name}]`;
      if (lang === 'ts') {
        parts.push(
          `${renderJsDoc(doc)}export const ${model.name} = {\n${entries.map((e) => `  ${e},`).join('\n')}\n} as const;\n`,
        );
        parts.push(`${renderJsDoc(doc)}export type ${model.name} = ${typeExpression};\n`);
      } else if (lang === 'dts') {
        const members = schema.values.map(
          (value, index) => `  readonly ${names[index] ?? 'Value'}: ${literal(value)};`,
        );
        parts.push(
          `${renderJsDoc(doc)}export declare const ${model.name}: {\n${members.join('\n')}\n};\n`,
        );
        parts.push(`${renderJsDoc(doc)}export type ${model.name} = ${typeExpression};\n`);
      } else {
        parts.push(
          `${renderJsDoc(doc)}export const ${model.name} = /* @__PURE__ */ Object.freeze({\n${entries.map((e) => `  ${e},`).join('\n')}\n});\n`,
        );
        parts.push(
          renderJsDoc({
            ...doc,
            tags: [{ tag: 'typedef', text: `{${typeExpression}} ${model.name}` }],
          }),
        );
      }
    } else if (lang === 'js') {
      const hoisting = hoistingContext(model, typeCtx, ctx);
      const typedef = jsTypedef(model.name, schema, doc, hoisting.typeCtx, extra);
      const helpers = hoisting.helpers();
      if (helpers !== '') parts.push(helpers);
      parts.push(typedef);
    } else {
      const type = printTypeNode(schema, typeCtx);
      const full = extra === undefined ? type.text : `${wrapType(type, 'intersection')} & ${extra}`;
      parts.push(`${renderJsDoc(doc)}export type ${model.name} = ${full};\n`);
    }

    for (const alias of model.aliases) {
      const aliasDoc: JsDocBlock = { summary: `Alias of {@link ${model.name}}.`, tags: [] };
      parts.push(
        lang === 'js'
          ? renderJsDoc({
              ...aliasDoc,
              tags: [{ tag: 'typedef', text: `{${model.name}} ${alias}` }],
            })
          : `${renderJsDoc(aliasDoc)}export type ${alias} = ${model.name};\n`,
      );
    }
    return parts.join('\n');
  };

  return {
    module: model.module,
    origin: 'core:model',
    ...renderAll(model.module, ctx, body),
    exports,
    sources: { schemas: [model.id] },
  };
}
