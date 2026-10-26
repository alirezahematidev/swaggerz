import type { ModelSymbol } from '../../analysis/types.ts';
import type { JsonValue } from '../../ir/types.ts';
import { renderAll, type EmitContext, type ModuleOutput } from '../context.ts';
import type { ImportManager } from '../imports.ts';
import { literal, propertyKey, quote, renderJsDoc } from '../printer.ts';
import type { JsDocBlock } from '../types.ts';
import type { MockSampler, MockValue } from './sampler.ts';

const MAX_INLINE = 80;

function block(open: '{' | '[', entries: readonly string[], indent: string): string {
  const close = open === '{' ? '}' : ']';
  if (entries.length === 0) return `${open}${close}`;
  const inline = open === '{' ? `{ ${entries.join(', ')} }` : `[${entries.join(', ')}]`;
  if (indent.length + inline.length <= MAX_INLINE && !inline.includes('\n')) return inline;
  return `${open}\n${entries.map((entry) => `${indent}  ${entry},`).join('\n')}\n${indent}${close}`;
}

function printJson(value: JsonValue, indent: string): string {
  if (Array.isArray(value))
    return block(
      '[',
      value.map((item) => printJson(item, `${indent}  `)),
      indent,
    );
  if (typeof value === 'object' && value !== null)
    return block(
      '{',
      Object.entries(value).map(
        ([key, item]) => `${propertyKey(key)}: ${printJson(item, `${indent}  `)}`,
      ),
      indent,
    );
  return literal(value);
}

/**
 * A fixture value as a JavaScript expression. Objects and arrays that do not fit on one line are
 * spread over several, indented from `indent`.
 */
export function printValue(
  value: MockValue,
  imports: ImportManager,
  ctx: EmitContext,
  indent = '',
): string {
  const inner = `${indent}  `;
  switch (value.kind) {
    case 'json':
      return printJson(value.value, indent);
    case 'date':
      return `new ${imports.global('Date')}(${quote(value.value)})`;
    case 'blob':
      return `new ${imports.global('Blob')}([${quote(value.text)}]${value.type === undefined ? '' : `, { type: ${quote(value.type)} }`})`;
    case 'fixture': {
      const model = ctx.project.modelById.get(value.model);
      if (model?.fixtureName === undefined || model.fixtureModule === undefined) return 'null';
      return `${imports.add(model.fixtureModule, model.fixtureName, { typeOnly: false })}()`;
    }
    case 'never':
      return imports.lang === 'js' ? '/** @type {never} */ (undefined)' : '(undefined as never)';
    case 'array':
      return block(
        '[',
        value.items.map((item) => printValue(item, imports, ctx, inner)),
        indent,
      );
    case 'object':
      return printObject(value, imports, ctx, indent);
  }
}

/** An object value, with `extra` entries (such as `...overrides`) after its own. */
function printObject(
  value: Extract<MockValue, { kind: 'object' }>,
  imports: ImportManager,
  ctx: EmitContext,
  indent: string,
  extra: readonly string[] = [],
): string {
  const inner = `${indent}  `;
  return block(
    '{',
    [
      ...value.spreads.map((spread) => `...${printValue(spread, imports, ctx, inner)}`),
      ...value.entries.map(
        ([key, item]) => `${propertyKey(key)}: ${printValue(item, imports, ctx, inner)}`,
      ),
      ...extra,
    ],
    indent,
  );
}

/**
 * The `mocks/models/<model>` module: `make<Model>()`, which returns a new value of the model on
 * every call, made of the specification's examples or of generated values.
 */
export function generateFixtureModule(
  model: ModelSymbol,
  sampler: MockSampler,
  ctx: EmitContext,
): ModuleOutput | undefined {
  const { fixtureName: name, fixtureModule: module } = model;
  if (name === undefined || module === undefined) return undefined;
  const value = sampler.fixture(model);
  // Object literals of object types take overrides; other values are returned as they are.
  const overrides = value.kind === 'object' && sampler.overridable(model.definition.schema);
  const nullable = model.definition.schema.nullable === true;
  const outputs = renderAll(module, ctx, (imports, lang) => {
    imports.declare(name);
    const type = imports.add(model.module, model.name, { typeOnly: true });
    const partial = `${imports.global('Partial')}<${nullable ? `${imports.global('NonNullable')}<${type}>` : type}>`;
    const doc: JsDocBlock = {
      ...(ctx.config.features.jsdoc
        ? {
            summary: `A new {@link ${model.name}} for tests and mocks, made of the specification's examples or of generated values. Every call returns an equal value.`,
          }
        : {}),
      tags: [
        ...(overrides
          ? [
              {
                tag: 'param',
                text: `${lang === 'js' ? `{${partial}} [overrides]` : 'overrides'} - Properties that replace the generated ones.`,
              },
            ]
          : []),
        ...(lang === 'js' ? [{ tag: 'returns', text: `{${type}}` }] : []),
      ],
    };
    const params = overrides ? (lang === 'js' ? 'overrides' : `overrides?: ${partial}`) : '';
    if (lang === 'dts')
      return `${renderJsDoc(doc)}export declare function ${name}(${params}): ${type};\n`;
    let body = overrides
      ? printObject(value, imports, ctx, '  ', ['...overrides'])
      : printValue(value, imports, ctx, '  ');
    // A fixture that cannot match its schema (reported) is cast, so the module still compiles.
    if (!sampler.fits(value))
      body =
        lang === 'ts'
          ? `${body} as unknown as ${type}`
          : `/** @type {${type}} */ (/** @type {unknown} */ (${body}))`;
    return `${renderJsDoc(doc)}export function ${name}(${params})${lang === 'ts' ? `: ${type}` : ''} {\n  return ${body};\n}\n`;
  });
  return {
    module,
    origin: 'core:mocks',
    ...outputs,
    exports: [{ name, kind: 'fixture', typeOnly: false }],
    sources: { schemas: [model.id] },
  };
}
