import { HTTP_METHODS, wireMethod, type SchemaIR } from '../../ir/types.ts';
import { compareStrings } from '../../utils/strings.ts';
import { combinedDateShape, dateShape } from '../dates.ts';
import { renderAll, type EmitContext, type ModuleOutput } from '../context.ts';
import type { ImportManager, Lang } from '../imports.ts';
import {
  bodyKind,
  isStringSchema,
  responseKind,
  type OperationPlan,
  type PlannedResponse,
  type ResponseKind,
} from '../operation-plan.ts';
import { responseBodyType, StatusTypes } from '../operations.ts';
import { literal, propertyKey, quote, renderJsDoc } from '../printer.ts';
import type { TypeContext } from '../type-printer.ts';
import type { GeneratedExport, JsDocBlock, JsDocTag } from '../types.ts';
import { FAKE, printValue, type PrintContext } from './fixtures.ts';
import { usesFake, type MockSampler, type MockValue } from './sampler.ts';
import { isXml } from './encodings.ts';
import { isCollection } from './semantics.ts';

const SUPPORT = 'mocks/support';

/** An HTTP header name (an RFC 9110 token). */
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
/** A header value the `Headers` API accepts: Latin-1 text without line breaks. */
const HEADER_VALUE = /^[\t\x20-\x7e\x80-\xff]*$/;

/** A documented response with its default body and headers, computed once per operation. */
interface MockedResponse {
  readonly planned: PlannedResponse;
  readonly success: boolean;
  readonly kind: ResponseKind | undefined;
  readonly body: MockValue | undefined;
  readonly headers: readonly (readonly [string, string])[];
}

/** The status a handler responds with by default: its first success response's. */
function defaultStatus(plan: OperationPlan): number {
  const status = plan.success[0]?.response.status ?? '200';
  if (/^\d{3}$/.test(status)) return Number(status);
  const range = /^([1-5])XX$/i.exec(status)?.[1];
  return range === undefined ? 200 : Number(`${range}00`);
}

/** The status `error: true` responds with: the first documented error, or `500`. */
function errorStatus(plan: OperationPlan): number {
  for (const { response } of plan.errors) {
    if (/^\d{3}$/.test(response.status)) return Number(response.status);
    const range = /^([45])XX$/i.exec(response.status)?.[1];
    if (range !== undefined) return Number(`${range}00`);
  }
  return 500;
}

/** Where path parameters reappear in the default body, and which one names its entity. */
interface Bindings {
  /** `[path, parameter, numeric]`: `'id'`, `'[].projectId'`, `'items.[].projectId'`. */
  readonly fill: readonly (readonly [string, string, boolean])[];
  /** The parameter whose value is the `id` of the response's entity (`taskId` for a `Task`). */
  readonly entity?: string;
}

const normalize = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Binds path parameters to the default body: `GET /projects/{projectId}/tasks` lists tasks of
 * that project, and `GET /tasks/{taskId}` returns a task with that `id`, the same task a list
 * returned when one did.
 */
function bindings(plan: OperationPlan, sampler: MockSampler, ctx: EmitContext): Bindings {
  const params = plan.parameters
    .filter((p) => p.parameter.in === 'path')
    .map((p) => p.parameter.name);
  const media = plan.success[0]?.media;
  if (params.length === 0 || media === undefined) return { fill: [] };
  // The value of JSON bodies, of XML documents, and of the items of sequential media types.
  const kind = responseKind(media, plan.parseAs);
  const written =
    kind === 'json'
      ? media.schema
      : kind !== 'text'
        ? undefined
        : media.itemSchema !== undefined
          ? ({ kind: 'array', items: media.itemSchema } satisfies SchemaIR)
          : isXml(media.mediaType) && !isStringSchema(media.schema)
            ? media.schema
            : undefined;
  if (written === undefined) return { fill: [] };
  const fill: (readonly [string, string, boolean])[] = [];
  /** Properties named like a parameter, with a string or number value. */
  const named = (properties: ReadonlyMap<string, SchemaIR>, prefix: string): void => {
    for (const param of params) {
      const scalar = properties.get(param);
      const type = scalar === undefined ? undefined : sampler.scalarType(scalar);
      if (type !== undefined) fill.push([`${prefix}${param}`, param, type === 'number']);
    }
  };
  const schema = written;
  const items = sampler.arrayItemsOf(schema);
  if (items !== undefined) {
    named(sampler.objectProperties(items), '[].');
    return { fill };
  }
  const properties = sampler.objectProperties(schema);
  named(properties, '');
  for (const [name, property] of properties) {
    const listed = isCollection(name) ? sampler.arrayItemsOf(property) : undefined;
    if (listed !== undefined) named(sampler.objectProperties(listed), `${name}.[].`);
  }
  // `{taskId}` names the `Task` the operation returns.
  const last = params.at(-1);
  const model = schema.kind === 'ref' ? ctx.project.modelById.get(schema.target) : undefined;
  const id = properties.get('id');
  const type = id === undefined ? undefined : sampler.scalarType(id);
  if (last !== undefined && model !== undefined && type !== undefined) {
    const base = normalize(last.replace(/[-_]?id$/i, ''));
    if (last === 'id' || (base !== '' && normalize(model.name).startsWith(base))) {
      if (last !== 'id') fill.push(['id', last, type === 'number']);
      return { fill, entity: last };
    }
  }
  return { fill };
}

/** The body type `MockRequest.body()` resolves with. */
function requestBodyType(plan: OperationPlan, imports: ImportManager): string {
  const body = plan.body;
  if (body === undefined) return 'undefined';
  if (body.alternatives.length > 0) return 'unknown';
  switch (bodyKind(body.media)) {
    case 'json':
      return imports.add(plan.symbol.module, plan.symbol.typeNames.body, { typeOnly: true });
    case 'multipart':
      return imports.global('FormData');
    case 'urlencoded':
      return imports.global('URLSearchParams');
    case 'text':
      return 'string';
    case 'binary':
    case 'raw':
      return imports.global('Blob');
  }
}

function requestReader(plan: OperationPlan): string | undefined {
  const body = plan.body;
  if (body === undefined || body.alternatives.length > 0) return undefined;
  const kind = bodyKind(body.media);
  return kind === 'raw' ? 'binary' : kind;
}

/** The `mocks/<tag>/<operation>` module: the operation's handler factory and its types. */
export function generateHandlerModule(
  plan: OperationPlan,
  sampler: MockSampler,
  ctx: EmitContext,
): ModuleOutput | undefined {
  const { symbol } = plan;
  const mock = symbol.mock;
  if (mock === undefined) return undefined;
  const op = symbol.operation;
  const responses: MockedResponse[] = [...plan.success, ...plan.errors].map((planned) => {
    const success = plan.success.includes(planned);
    const media = planned.media;
    const kind =
      media === undefined ? undefined : responseKind(media, success ? plan.parseAs : undefined);
    const label = `${symbol.name} ${planned.response.status}`;
    const source = planned.response.source;
    const headers = planned.response.headers.flatMap((header): (readonly [string, string])[] => {
      if (!header.required || !HEADER_NAME.test(header.name)) return [];
      if (header.name.toLowerCase() === 'content-type') return [];
      const value = sampler.headerValue(
        header.schema,
        `${label} ${header.name}`,
        source,
        header.name,
      );
      // `Headers` rejects values that are not byte strings, or that span lines.
      return value === undefined || !HEADER_VALUE.test(value) ? [] : [[header.name, value]];
    });
    return {
      planned,
      success,
      kind,
      body:
        media === undefined || kind === undefined
          ? undefined
          : sampler.responseBody(media, kind, label, source),
      headers,
    };
  });
  const status = defaultStatus(plan);
  const route = `${wireMethod(op.method)} ${op.path}`;
  const exports: GeneratedExport[] = [
    { name: mock.name, kind: 'mock', typeOnly: false },
    { name: mock.options, kind: 'type', typeOnly: true },
    { name: mock.request, kind: 'type', typeOnly: true },
  ];

  const body = (imports: ImportManager, lang: Lang): string => {
    for (const name of [mock.name, mock.options, mock.request]) imports.declare(name);
    const typeCtx: TypeContext = {
      imports,
      project: ctx.project,
      config: ctx.config,
      direction: 'output',
    };
    const support = (name: string, typeOnly: boolean): string =>
      imports.add(SUPPORT, name, { typeOnly });
    const statuses = new StatusTypes(plan, () =>
      imports.add('runtime/types', 'HttpStatus', { typeOnly: true }),
    );
    const parts: string[] = [];

    // Types --------------------------------------------------------------------------------------
    const pathParams = plan.parameters.filter((p) => p.parameter.in === 'path');
    const params =
      pathParams.length === 0
        ? `${imports.global('Record')}<string, never>`
        : `{ ${pathParams.map((p) => `${propertyKey(p.parameter.name)}: string`).join('; ')} }`;
    // `generated()` is typed as the default status's body. One request type for every status keeps
    // the parameters of a response function typed without a `status`.
    const defaultBody = (() => {
      const first = responses[0];
      if (first === undefined || !first.success) return 'unknown';
      const media = first.planned.media;
      return media === undefined
        ? 'undefined'
        : responseBodyType(media, plan.parseAs, typeCtx, '  ');
    })();
    const requestType = `${support('MockRequest', true)}<${params}, ${requestBodyType(plan, imports)}, ${defaultBody}>`;
    const requestDoc: JsDocBlock = {
      summary: `What a response function of {@link ${mock.name}} receives: the request, its path parameters, its body and the body generated for it.`,
      tags: [],
    };
    const mockBody = (type: string): string =>
      `${support('MockBody', true)}<${type}, ${mock.request}>`;
    const members: string[] = [];
    const bodyTypes = new Map<MockedResponse, string>();
    for (const response of responses) {
      const media = response.planned.media;
      const type = statuses.of(response.planned.response.status, response.success);
      if (type === 'never') continue;
      const optional = response === responses[0] && response.success ? '?' : '';
      if (media === undefined) {
        // A function can still apply side effects, or return a `Response`.
        members.push(`{ status${optional}: ${type}; body?: ${mockBody('undefined')} }`);
        continue;
      }
      const parseAs = response.success ? plan.parseAs : undefined;
      members.push(
        `{ status${optional}: ${type}; body?: ${mockBody(responseBodyType(media, parseAs, typeCtx, '    '))} }`,
      );
      bodyTypes.set(response, responseBodyType(media, parseAs, typeCtx, '      '));
    }
    // Without a documented success response, any 2xx status resolves (with no body by default).
    if (plan.success.length === 0)
      members.unshift(
        `{ status?: ${imports.add('runtime/types', 'HttpStatus', { typeOnly: true })}<2>; body?: ${mockBody('unknown')} }`,
      );
    const undeclared = statuses.undeclaredSuccess(plan);
    if (undeclared !== undefined)
      members.push(`{ status: ${undeclared}; body?: ${mockBody('unknown')} }`);
    const rest = statuses.rest();
    if (rest !== undefined && !plan.errors.some((r) => r.response.status === 'default'))
      members.push(`{ status: ${rest}; body?: ${mockBody('unknown')} }`);
    const settings = support('MockSettings', true);
    const optionsDoc: JsDocBlock = {
      summary: `Options of {@link ${mock.name}}: \`status\` selects a documented response (default \`${status}\`) and types \`body\`, which replaces the generated body or computes one from the request.`,
      tags: [],
    };
    if (lang === 'js') {
      parts.push(
        renderJsDoc({
          ...requestDoc,
          tags: [{ tag: 'typedef', text: `{${requestType}} ${mock.request}` }],
        }),
        renderJsDoc({
          ...optionsDoc,
          tags: [
            { tag: 'typedef', text: `{${settings} & (${members.join(' | ')})} ${mock.options}` },
          ],
        }),
      );
    } else {
      parts.push(
        `${renderJsDoc(requestDoc)}export type ${mock.request} = ${requestType};\n`,
        `${renderJsDoc(optionsDoc)}export type ${mock.options} = ${settings} &\n  (\n${members.map((m) => `    | ${m}`).join('\n')}\n  );\n`,
      );
    }

    // Function -----------------------------------------------------------------------------------
    const handlerType = imports.add('msw', 'HttpHandler', { typeOnly: true, external: true });
    const example = responses.find((r) => !r.success && /^\d{3}$/.test(r.planned.response.status));
    const tags: JsDocTag[] = [
      {
        tag: 'param',
        text: `${lang === 'js' ? `{${mock.options}} [options]` : 'options'} - The status and body to respond with, and settings such as \`delay\`, \`seed\`, \`empty\` and \`error\`.`,
      },
      ...(lang === 'js' ? [{ tag: 'returns', text: `{${handlerType}}` }] : []),
      ...(ctx.config.features.jsdoc
        ? [
            {
              tag: 'example',
              text: `server.use(${mock.name}(${example === undefined ? '{ delay: 300 }' : `{ status: ${example.planned.response.status} }`}));`,
            },
          ]
        : []),
    ];
    const doc: JsDocBlock = {
      ...(ctx.config.features.jsdoc
        ? {
            summary: `Mocks \`${route}\` (\`${symbol.name}\`) with Mock Service Worker. Without options it responds with \`${status}\` ${responses[0]?.body === undefined ? 'without a body' : 'and a body generated for the request'}.`,
          }
        : {}),
      tags,
    };
    if (lang === 'dts') {
      parts.push(
        `${renderJsDoc(doc)}export declare function ${mock.name}(options?: ${mock.options}): ${handlerType};\n`,
      );
      return parts.join('\n');
    }
    const fields: string[] = [
      `client: ${imports.add('client', 'client', { typeOnly: false })}`,
      `method: ${quote(wireMethod(op.method))}`,
      `path: ${quote(op.path)}`,
    ];
    if (plan.server !== undefined) fields.push(`server: ${quote(plan.server)}`);
    const styles = Object.fromEntries(
      pathParams.flatMap(({ parameter }) =>
        parameter.style === 'label' || parameter.style === 'matrix'
          ? [[parameter.name, parameter.style]]
          : [],
      ),
    );
    if (Object.keys(styles).length > 0) fields.push(`styles: ${literal(styles)}`);
    fields.push(`status: ${status}`);
    const error = errorStatus(plan);
    if (error !== 500) fields.push(`error: ${error}`);
    const bound = bindings(plan, sampler, ctx);
    if (bound.entity !== undefined) fields.push(`entity: ${quote(bound.entity)}`);
    if (bound.fill.length > 0)
      fields.push(`fill: ${literal(bound.fill.map((entry) => [...entry]))}`);
    // A path with an `OPTIONS` operation answers plain `OPTIONS` requests itself.
    const options = ctx.project.operations.some(
      (other) => other.operation.path === op.path && other.operation.method === 'options',
    );
    if (options && op.method !== 'options') fields.push('preflight: false');
    const reader = requestReader(plan);
    if (reader !== undefined) fields.push(`request: ${quote(reader)}`);
    const dates = ctx.config.types.dates === 'Date';
    const runtimeDates = (name: string): string =>
      imports.add('runtime/dates', name, { typeOnly: false });
    if (dates && plan.body !== undefined) {
      const shape = combinedDateShape(
        [plan.body.media, ...plan.body.alternatives].map((media) => media.schema),
        ctx.project,
        imports,
        '    ',
      );
      if (shape !== undefined)
        fields.push(`decode: (body) => ${runtimeDates('reviveDates')}(body, ${shape})`);
    }
    const entries = responses.map((response) => {
      const media = response.planned.media;
      const items: string[] = [];
      if (media !== undefined) items.push(`mediaType: ${quote(media.mediaType)}`);
      if (response.body !== undefined) {
        // An XML document or a sequence: the body is the value (where path parameters are
        // copied), which `write` turns into text.
        const encoded = response.body.kind === 'encoded' ? response.body : undefined;
        const type = encoded === undefined ? bodyTypes.get(response) : undefined;
        const annotation = lang === 'ts' && type !== undefined ? `: ${type}` : '';
        const made = encoded?.value ?? response.body;
        if (encoded !== undefined) {
          const write = imports.add(FAKE, encoded.encoding, { typeOnly: false });
          items.push(
            encoded.encoding === 'xml'
              ? `write: (body) => ${write}(body, ${literal(encoded.shape ?? {})})`
              : `write: (body) => ${write}(body, ${quote(encoded.mediaType)})`,
          );
        }
        const p: PrintContext = { imports, ctx, sampler };
        // A body that cannot match its schema (reported) is cast, so the module still compiles.
        const cast = (value: string): string =>
          lang === 'ts' && type !== undefined && !sampler.fits(made)
            ? `${value} as unknown as ${type}`
            : value;
        const model = made.kind === 'fixture' ? ctx.project.modelById.get(made.model) : undefined;
        if (
          made.kind === 'fixture' &&
          made.key === '' &&
          model?.fixtureName !== undefined &&
          model.fixtureModule !== undefined
        ) {
          // The fixture itself, with the request's seed: the same value a list returned for its id.
          const make = imports.add(model.fixtureModule, model.fixtureName, { typeOnly: false });
          items.push(
            `body: (options)${annotation} => ${cast(`${make}(${sampler.takesOverrides(model) ? 'undefined, ' : ''}options)`)}`,
          );
        } else if (usesFake(made)) {
          const fake = imports.add(FAKE, 'fake', { typeOnly: false });
          items.push(
            `body: (options)${annotation} => {\n        const f = ${fake}(options);\n        return ${cast(printValue(made, p, '        '))};\n      }`,
          );
        } else {
          const value = cast(printValue(made, p, '      '));
          items.push(`body: ()${annotation} => ${value.startsWith('{') ? `(${value})` : value}`);
        }
      }
      if (response.headers.length > 0)
        items.push(`headers: ${literal(Object.fromEntries(response.headers))}`);
      if (dates && media !== undefined && response.kind === 'json') {
        const shape = dateShape(media.schema, ctx.project, imports, '      ');
        if (shape !== undefined)
          items.push(`encode: (body) => ${runtimeDates('encodeDates')}(body, ${shape})`);
      }
      const key = quote(response.planned.response.status);
      return items.length === 0
        ? `${key}: {}`
        : `${key}: {\n${items.map((item) => `      ${item},`).join('\n')}\n    }`;
    });
    fields.push(
      entries.length === 0
        ? 'responses: {}'
        : `responses: {\n${entries.map((entry) => `    ${entry},`).join('\n')}\n  }`,
    );
    const signature = lang === 'ts' ? `options?: ${mock.options}): ${handlerType}` : 'options)';
    parts.push(
      `${renderJsDoc(doc)}export function ${mock.name}(${signature} {\n` +
        `  return ${support('mockHandler', false)}(\n    {\n${fields.map((field) => `      ${field.replace(/\n/g, '\n    ')},`).join('\n')}\n    },\n    options,\n  );\n}\n`,
    );
    return parts.join('\n');
  };

  return {
    module: mock.module,
    origin: 'core:mocks',
    ...renderAll(mock.module, ctx, body),
    exports,
    sources: { operations: [symbol.key] },
  };
}

/**
 * Orders routes so that a handler never shadows a more specific one: at the first segment where
 * they differ in kind, literal segments come before parameters (`/pets/mine` before
 * `/pets/{id}`). Ties are broken by path and method.
 */
function compareRoutes(a: OperationPlan, b: OperationPlan): number {
  const left = a.symbol.operation.path.split('/');
  const right = b.symbol.operation.path.split('/');
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    const literalLeft = !(left[index] ?? '').includes('{');
    const literalRight = !(right[index] ?? '').includes('{');
    if (literalLeft !== literalRight) return literalLeft ? -1 : 1;
  }
  const order = (plan: OperationPlan): number => {
    const index = (HTTP_METHODS as readonly string[]).indexOf(plan.symbol.operation.method);
    return index === -1 ? HTTP_METHODS.length : index;
  };
  return (
    compareStrings(a.symbol.operation.path, b.symbol.operation.path) ||
    order(a) - order(b) ||
    compareStrings(a.symbol.operation.method, b.symbol.operation.method)
  );
}

/** The `mocks/handlers` module: `mockHandlers()`, a handler for every operation. */
export function generateHandlersModule(
  plans: readonly OperationPlan[],
  ctx: EmitContext,
): ModuleOutput | undefined {
  const name = ctx.project.mockHandlers;
  if (name === undefined) return undefined;
  const module = 'mocks/handlers';
  const ordered = plans.filter((plan) => plan.symbol.mock !== undefined).sort(compareRoutes);
  // Without operations the settings are unused (`noUnusedParameters` ignores `_` names).
  const param = ordered.length === 0 ? '_options' : 'options';
  const outputs = renderAll(module, ctx, (imports, lang) => {
    imports.declare(name);
    const handlerType = imports.add('msw', 'HttpHandler', { typeOnly: true, external: true });
    const settings = imports.add(SUPPORT, 'MockSettings', { typeOnly: true });
    const doc = renderJsDoc({
      ...(ctx.config.features.jsdoc
        ? {
            summary:
              'A mock handler for every operation, responding with its default status and a body generated for the request: pass them to `setupWorker()` or `setupServer()`. More specific paths come first (`/pets/mine` before `/pets/{id}`).',
          }
        : {}),
      tags: [
        {
          tag: 'param',
          text: `${lang === 'js' ? `{${settings}} [${param}]` : param} - Settings applied to every handler, such as \`delay\`, \`seed\`, \`empty\` and \`error\`.`,
        },
        ...(lang === 'js' ? [{ tag: 'returns', text: `{${handlerType}[]}` }] : []),
      ],
    });
    if (lang === 'dts')
      return `${doc}export declare function ${name}(${param}?: ${settings}): ${handlerType}[];\n`;
    const calls = ordered.flatMap((plan) => {
      const mock = plan.symbol.mock;
      return mock === undefined
        ? []
        : [`${imports.add(mock.module, mock.name, { typeOnly: false })}(options)`];
    });
    const list =
      calls.length === 0 ? '[]' : `[\n${calls.map((call) => `    ${call},`).join('\n')}\n  ]`;
    const signature = lang === 'ts' ? `${param}?: ${settings}): ${handlerType}[]` : `${param})`;
    return `${doc}export function ${name}(${signature} {\n  return ${list};\n}\n`;
  });
  return {
    module,
    origin: 'core:mocks',
    ...outputs,
    exports: [{ name, kind: 'mock', typeOnly: false }],
  };
}

/** The types of the support module that the barrel re-exports. */
const SUPPORT_TYPES = ['MockBody', 'MockClient', 'MockRequest', 'MockSettings'] as const;

/** The `mocks/index` barrel, separate from the main one so `msw` stays out of production code. */
export function generateMocksBarrel(
  ctx: EmitContext,
  modules: readonly ModuleOutput[],
): ModuleOutput {
  const module = 'mocks/index';
  // `mockFetch` is claimed like every export: with an operation named `fetch`, the operation's
  // handler is `mockFetch2`.
  const fetchName = ctx.project.mockFetch ?? 'mockFetch';
  const fetchExport = fetchName === 'mockFetch' ? 'mockFetch' : `mockFetch as ${fetchName}`;
  const outputs = renderAll(module, ctx, (imports, lang) => {
    const support = imports.specifier(SUPPORT);
    const lines = [
      `export { ${fetchExport} } from '${support}';`,
      ...modules.map((m) => `export * from '${imports.specifier(m.module)}';`),
    ];
    if (lang !== 'js')
      lines.unshift(
        `export type { ${SUPPORT_TYPES.join(', ')} } from '${support}';`,
        `export type { FixtureOptions } from '${imports.specifier(FAKE)}';`,
      );
    return `${lines.join('\n')}\n`;
  });
  return {
    module,
    origin: 'core:mocks-barrel',
    ...outputs,
    exports: [
      ...[...SUPPORT_TYPES, 'FixtureOptions'].map((name) => ({
        name,
        kind: 'type' as const,
        typeOnly: true,
      })),
      { name: fetchName, kind: 'mock', typeOnly: false },
      ...modules.flatMap((m) => m.exports),
    ],
  };
}
