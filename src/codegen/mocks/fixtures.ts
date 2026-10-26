import type { ModelSymbol } from '../../analysis/types.ts';
import type { JsonValue } from '../../ir/types.ts';
import { renderAll, type EmitContext, type ModuleOutput } from '../context.ts';
import type { ImportManager } from '../imports.ts';
import { literal, propertyKey, quote, renderJsDoc } from '../printer.ts';
import type { JsDocBlock } from '../types.ts';
import { usesFake, type MockSampler, type MockValue } from './sampler.ts';

/** The runtime module fixtures make their values with. */
export const FAKE = 'mocks/fake';

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

/** A number as JavaScript: `Infinity` is not JSON. */
function number(value: number): string {
  if (Number.isFinite(value)) return literal(value);
  return value > 0 ? 'Infinity' : '-Infinity';
}

/** What printing a recipe needs. */
export interface PrintContext {
  readonly imports: ImportManager;
  readonly ctx: EmitContext;
  readonly sampler: MockSampler;
}

/** `value` as an arrow function's body: object literals need parentheses. */
function arrowBody(value: string): string {
  return value.startsWith('{') ? `(${value})` : value;
}

/**
 * A recipe as a JavaScript expression over the fixture's `Fake`, `f`. Objects and arrays that do
 * not fit on one line are spread over several, indented from `indent`.
 */
export function printValue(value: MockValue, p: PrintContext, indent = ''): string {
  const inner = `${indent}  `;
  const call = (method: string, args: readonly string[]): string =>
    `f.${method}(${args.join(', ')})`;
  /** `min` and `max` arguments, left out when they are the defaults. */
  const bounds = (min: number, max: number): string[] =>
    max === Infinity ? (min === 0 ? [] : [number(min)]) : [number(min), number(max)];
  switch (value.kind) {
    case 'json': {
      const printed = printJson(value.value, indent);
      if (value.literal !== true) return printed;
      // A literal type survives where TypeScript has no type to compare the value with.
      return p.imports.lang === 'js' ? `/** @type {const} */ (${printed})` : `${printed} as const`;
    }
    case 'date':
      return `new ${p.imports.global('Date')}(${quote(value.value)})`;
    case 'file':
      return call('file', [quote(value.key), quote(value.mediaType)]);
    case 'fixture': {
      const model = p.ctx.project.modelById.get(value.model);
      if (model?.fixtureName === undefined || model.fixtureModule === undefined) return 'null';
      const make = p.imports.add(model.fixtureModule, model.fixtureName, { typeOnly: false });
      return `${make}(${p.sampler.takesOverrides(model) ? 'undefined, ' : ''}f.at(${quote(value.key)}))`;
    }
    case 'never':
      return p.imports.lang === 'js' ? '/** @type {never} */ (undefined)' : '(undefined as never)';
    case 'array':
      return block(
        '[',
        value.items.map((item) => printValue(item, p, inner)),
        indent,
      );
    case 'object':
      return printObject(value, p, indent);
    case 'text':
      return call('text', [
        quote(value.key),
        quote(value.value),
        quote(value.text),
        ...bounds(value.min, value.max),
      ]);
    case 'pattern':
      return call('pattern', [
        quote(value.key),
        quote(value.value),
        quote(value.pattern),
        ...(value.text === undefined
          ? bounds(value.min, value.max)
          : [number(value.min), number(value.max), quote(value.text)]),
      ]);
    case 'int':
      return call('int', [
        quote(value.key),
        number(value.value),
        number(value.min),
        number(value.max),
      ]);
    case 'number':
      return call('number', [
        quote(value.key),
        number(value.value),
        number(value.min),
        number(value.max),
        ...(value.exclusive === 'none'
          ? value.digits === 2
            ? []
            : [String(value.digits)]
          : [String(value.digits), quote(value.exclusive)]),
      ]);
    case 'multiple':
      return call('multiple', [
        quote(value.key),
        number(value.value),
        number(value.first),
        number(value.last),
        number(value.step),
        String(value.digits),
      ]);
    case 'bool':
      return call('bool', [
        quote(value.key),
        String(value.value),
        ...(value.rate === 0.5 ? [] : [number(value.rate)]),
      ]);
    case 'when': {
      const made = call('date', [
        quote(value.key),
        quote(value.value),
        quote(value.format),
        quote(value.when),
      ]);
      return value.asDate ? `new ${p.imports.global('Date')}(${made})` : made;
    }
    case 'pick': {
      const values = printJson([...value.values], indent);
      return call('pick', [
        quote(value.key),
        p.imports.lang === 'js' ? `/** @type {const} */ (${values})` : `${values} as const`,
      ]);
    }
    case 'oneOf': {
      const branches = value.options.map((option) => printValue(option, p, `${inner}  `));
      const last = branches.length - 1;
      const choice = branches
        .map((branch, index) => (index === last ? branch : `index === ${index} ? ${branch} :`))
        .join(`\n${inner}  `);
      return call('oneOf', [
        quote(value.key),
        String(value.options.length),
        `(index) =>\n${inner}  ${choice}`,
      ]);
    }
    case 'nullable':
      return call('nullable', [
        quote(value.key),
        `() => ${arrowBody(printValue(value.value, p, indent))}`,
      ]);
    case 'list': {
      const item = arrowBody(printValue(value.item, p, indent));
      return call('array', [
        quote(value.key),
        String(value.count),
        String(value.min),
        String(value.max),
        `${usesFake(value.item) ? '(f)' : '()'} => ${item}`,
        ...(value.unique ? ['true'] : []),
      ]);
    }
    case 'record': {
      const item = arrowBody(printValue(value.value, p, indent));
      return call('record', [
        quote(value.key),
        String(value.count),
        String(value.min),
        String(value.max),
        `${usesFake(value.value) ? '(f)' : '()'} => ${item}`,
      ]);
    }
    case 'encoded': {
      const encode = p.imports.add(FAKE, value.encoding, { typeOnly: false });
      const printed = printValue(value.value, p, indent);
      return value.encoding === 'xml'
        ? `${encode}(${printed}, ${literal(value.shape ?? {})})`
        : `${encode}(${printed}, ${quote(value.mediaType)})`;
    }
    case 'example':
      return call('example', [
        `(examples) =>\n${inner}examples\n${inner}  ? ${printValue(value.value, p, `${inner}  `)}\n${inner}  : ${printValue(value.make, p, `${inner}  `)}`,
      ]);
  }
}

/**
 * An object value, with `extra` entries (such as `...overrides`) after its own. Its optional
 * properties are left out by some seeds, never those of `keep`.
 */
function printObject(
  value: Extract<MockValue, { kind: 'object' }>,
  p: PrintContext,
  indent: string,
  extra: readonly string[] = [],
  keep?: string,
): string {
  const inner = `${indent}  `;
  const object = block(
    '{',
    [
      ...value.spreads.map((spread) => `...${printValue(spread, p, inner)}`),
      ...value.entries.map(([key, item]) => {
        const printed = printValue(item, p, inner);
        return `${propertyKey(key)}: ${key === value.id ? `f.id(${printed})` : printed}`;
      }),
      ...extra,
    ],
    indent,
  );
  if (value.optional === undefined) return object;
  return `f.optional(${quote(value.path ?? '')}, ${object}, ${printJson([...value.optional], indent)}${keep === undefined ? '' : `, ${keep}`})`;
}

/** A fixture's object value with its overrides, which some seeds never leave out. */
export function printRoot(value: Extract<MockValue, { kind: 'object' }>, p: PrintContext): string {
  return printObject(value, p, '  ', ['...overrides'], 'overrides');
}

/**
 * The `mocks/models/<model>` module: `make<Model>()`, which returns a new value of the model on
 * every call: the specification's examples, or another realistic value for another seed.
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
  const overrides = sampler.takesOverrides(model);
  const nullable = model.definition.schema.nullable === true;
  const used = usesFake(value);
  const optionsName = used ? 'options' : '_options';
  const outputs = renderAll(module, ctx, (imports, lang) => {
    imports.declare(name);
    const p: PrintContext = { imports, ctx, sampler };
    const type = imports.add(model.module, model.name, { typeOnly: true });
    const options = imports.add(FAKE, 'FixtureOptions', { typeOnly: true });
    const partial = `${imports.global('Partial')}<${nullable ? `${imports.global('NonNullable')}<${type}>` : type}>`;
    const doc: JsDocBlock = {
      ...(ctx.config.features.jsdoc
        ? {
            summary: `A new {@link ${model.name}} for tests and mocks. Without a seed it is made of the specification's examples, and every call returns an equal value; other seeds make other realistic values.`,
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
        {
          tag: 'param',
          text: `${lang === 'js' ? `{${options}} [${optionsName}]` : optionsName} - \`seed\` picks another value (\`0\`, the default, is the examples'); \`empty\` makes arrays as short as allowed.`,
        },
        ...(lang === 'js' ? [{ tag: 'returns', text: `{${type}}` }] : []),
      ],
    };
    const params =
      lang === 'js'
        ? overrides
          ? `overrides, ${optionsName}`
          : optionsName
        : `${overrides ? `overrides?: ${partial}, ` : ''}${optionsName}?: ${options}`;
    if (lang === 'dts')
      return `${renderJsDoc(doc)}export declare function ${name}(${params}): ${type};\n`;
    let body: string;
    if (overrides && value.kind === 'object') {
      body = printObject(value, p, '  ', ['...overrides'], 'overrides');
    } else if (
      overrides &&
      value.kind === 'example' &&
      value.value.kind === 'object' &&
      value.make.kind === 'object'
    ) {
      body = `f.example((examples) =>\n    examples\n      ? ${printObject(value.value, p, '      ', ['...overrides'])}\n      : ${printObject(value.make, p, '      ', ['...overrides'], 'overrides')})`;
    } else {
      body = printValue(value, p, '  ');
    }
    // A fixture that cannot match its schema (reported) is cast, so the module still compiles.
    if (!sampler.fits(value))
      body =
        lang === 'ts'
          ? `${body} as unknown as ${type}`
          : `/** @type {${type}} */ (/** @type {unknown} */ (${body}))`;
    const fake = used
      ? `  const f = ${imports.add(FAKE, 'fake', { typeOnly: false })}(options);\n`
      : '';
    return `${renderJsDoc(doc)}export function ${name}(${params})${lang === 'ts' ? `: ${type}` : ''} {\n${fake}  return ${body};\n}\n`;
  });
  return {
    module,
    origin: 'core:mocks',
    ...outputs,
    exports: [{ name, kind: 'fixture', typeOnly: false }],
    sources: { schemas: [model.id] },
  };
}
