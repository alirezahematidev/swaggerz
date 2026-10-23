import { isPropertyIdentifier } from '../analysis/naming.ts';
import {
  wireMethod,
  type MediaTypeIR,
  type ParameterIR,
  type ParameterLocation,
  type SchemaIR,
} from '../ir/types.ts';
import { applyJsDocHook, renderAll, type EmitContext, type ModuleOutput } from './context.ts';
import type { ImportManager, Lang } from './imports.ts';
import { schemaTags, splitSummary } from './jsdoc.ts';
import { jsTypedef } from './models.ts';
import {
  bodyKind,
  responseKind,
  type OperationPlan,
  type ParseAsHint,
  type PlannedBody,
  type PlannedResponse,
} from './operation-plan.ts';
import { literal, propertyAccess, propertyKey, quote, renderJsDoc } from './printer.ts';
import { binaryType, printType, type TypeContext } from './type-printer.ts';
import type { GeneratedExport, JsDocBlock, JsDocTag } from './types.ts';
import { combinedDateShape, dateShape } from './dates.ts';
import { requestValidation, responseValidation, validatorFor } from './validation/index.ts';

/** The body type of one media type, for request (input) types. */
export function mediaBodyType(media: MediaTypeIR, ctx: TypeContext, indent = ''): string {
  // Bodies of media types the runtime cannot serialize are passed already encoded.
  return bodyKind(media) === 'raw'
    ? `string | ${binaryType({ ...ctx, direction: 'input' }).text}`
    : printType(media.schema, ctx, indent);
}

/** Whether a schema describes strings only, so a text response can keep its exact type. */
function isStringSchema(schema: SchemaIR): boolean {
  if (schema.kind === 'string') return true;
  return schema.kind === 'enum' && schema.values.every((value) => typeof value === 'string');
}

/**
 * The type of a response body as the runtime returns it: the schema's type for JSON, `string` for
 * text media types (XML, CSV, …) whose schema describes a structure the runtime does not parse,
 * and `Blob` for binary and other media types.
 */
export function responseBodyType(
  media: MediaTypeIR,
  parseAs: ParseAsHint,
  ctx: TypeContext,
): string {
  switch (responseKind(media, parseAs)) {
    case 'json':
      return printType(media.schema, ctx);
    case 'text':
      return isStringSchema(media.schema) ? printType(media.schema, ctx) : 'string';
    case 'binary':
      return binaryType({ ...ctx, direction: 'output' }).text;
  }
}

/** Media types of a body grouped by identical body types, the default media type first. */
export function bodyVariants(
  body: PlannedBody,
  typeOf: (media: MediaTypeIR) => string,
): {
  readonly mediaTypes: readonly string[];
  readonly type: string;
  readonly media: MediaTypeIR;
}[] {
  const variants: { mediaTypes: string[]; type: string; media: MediaTypeIR }[] = [];
  for (const media of [body.media, ...body.alternatives]) {
    const type = typeOf(media);
    const existing = variants.find((variant) => variant.type === type);
    if (existing === undefined) variants.push({ mediaTypes: [media.mediaType], type, media });
    else existing.mediaTypes.push(media.mediaType);
  }
  return variants;
}

const LOCATION_FIELDS: Record<Exclude<ParameterLocation, 'querystring'>, string> = {
  path: 'pathParams',
  query: 'query',
  header: 'headers',
  cookie: 'cookies',
};

/** Serialization that differs from the runtime defaults, or `undefined`. */
export function nonDefaultSerialization(
  parameter: ParameterIR,
): Record<string, unknown> | undefined {
  const defaultStyle = parameter.in === 'query' || parameter.in === 'cookie' ? 'form' : 'simple';
  const result: Record<string, unknown> = {};
  if (parameter.style !== defaultStyle) result.style = parameter.style;
  if (parameter.explode !== (parameter.style === 'form' || parameter.style === 'cookie'))
    result.explode = parameter.explode;
  if (parameter.allowReserved) result.allowReserved = true;
  if (parameter.contentType !== undefined && /json/i.test(parameter.contentType))
    result.json = true;
  return Object.keys(result).length === 0 ? undefined : result;
}

const EXPLICIT_STATUS = /^\d{3}$/;
const STATUS_RANGE = /^([1-5])XX$/i;

/**
 * Status type expressions for an operation's responses. `httpStatus` imports the runtime's
 * `HttpStatus` type (literal unions of status codes, optionally of one class).
 */
export class StatusTypes {
  /** Explicitly declared codes, e.g. `404`, sorted. */
  readonly #codes: number[];
  /** Classes declared as ranges (`4XX`) or always resolved (2xx), sorted. */
  readonly #classes: number[];
  readonly #httpStatus: () => string;

  constructor(plan: OperationPlan, httpStatus: () => string) {
    const statuses = [...plan.success, ...plan.errors].map((r) => r.response.status);
    this.#codes = [...new Set(statuses.filter((s) => EXPLICIT_STATUS.test(s)).map(Number))].sort(
      (a, b) => a - b,
    );
    const ranges = statuses.flatMap((s) => {
      const match = STATUS_RANGE.exec(s);
      return match?.[1] === undefined ? [] : [Number(match[1])];
    });
    this.#classes = [...new Set([2, ...ranges])].sort((a, b) => a - b);
    this.#httpStatus = httpStatus;
  }

  /** The status type of one declared response. */
  of(status: string, success: boolean): string {
    if (EXPLICIT_STATUS.test(status)) return status;
    const range = STATUS_RANGE.exec(status)?.[1];
    if (range !== undefined) return this.#range(Number(range));
    // `default` as the success response (no 2xx declared) resolves for every 2xx status.
    return success ? this.#range(2) : (this.rest() ?? 'never');
  }

  /**
   * The 2xx statuses no success response declares, which resolve too (every 2xx does), e.g.
   * `Exclude<HttpStatus<2>, 200>`; `undefined` when a `2XX` range or a `default` success response
   * covers them.
   */
  undeclaredSuccess(plan: OperationPlan): string | undefined {
    const declared = plan.success.map((r) => r.response.status.toUpperCase());
    if (declared.length === 0 || declared.some((s) => s === '2XX' || s === 'DEFAULT'))
      return undefined;
    return this.#range(2);
  }

  /**
   * Statuses no response declares and that do not resolve, e.g. `Exclude<HttpStatus<1 | 3 | 4 | 5>,
   * 404>`; `undefined` when there are none.
   */
  rest(): string | undefined {
    const remaining = [1, 2, 3, 4, 5].filter((digit) => !this.#classes.includes(digit));
    if (remaining.length === 0) return undefined;
    const codes = this.#codes.filter((code) => remaining.includes(Math.floor(code / 100)));
    const classes = `${this.#httpStatus()}<${remaining.join(' | ')}>`;
    return codes.length === 0 ? classes : `Exclude<${classes}, ${codes.join(' | ')}>`;
  }

  #range(digit: number): string {
    const codes = this.#codes.filter((code) => Math.floor(code / 100) === digit);
    const range = `${this.#httpStatus()}<${digit}>`;
    return codes.length === 0 ? range : `Exclude<${range}, ${codes.join(' | ')}>`;
  }
}

function uniqueUnion(types: readonly string[]): string {
  const unique = [...new Set(types)];
  if (unique.includes('unknown')) return 'unknown';
  // Keep `undefined` (bodiless responses) last for readability.
  return [
    ...unique.filter((t) => t !== 'undefined'),
    ...unique.filter((t) => t === 'undefined'),
  ].join(' | ');
}

/** Type expressions for an operation's responses and errors. */
export function responseTypes(
  plan: OperationPlan,
  typeCtx: TypeContext,
  full: boolean,
  runtimeType: (module: 'runtime/types' | 'runtime/errors', name: string) => string,
): { response: string; errorBody: string; apiErrors: readonly string[] } {
  const successes = new Set(plan.success);
  const bodyType = (r: PlannedResponse): string =>
    r.media === undefined
      ? 'undefined'
      : responseBodyType(r.media, successes.has(r) ? plan.parseAs : undefined, typeCtx);
  const statuses = new StatusTypes(plan, () => runtimeType('runtime/types', 'HttpStatus'));
  let response: string;
  if (full) {
    const apiResponse = runtimeType('runtime/types', 'ApiResponse');
    const variants = plan.success.map(
      (r) => `${apiResponse}<${bodyType(r)}, ${statuses.of(r.response.status, true)}>`,
    );
    // Undeclared 2xx statuses resolve as well; nothing describes their bodies.
    const undeclared = statuses.undeclaredSuccess(plan);
    if (undeclared !== undefined) variants.push(`${apiResponse}<unknown, ${undeclared}>`);
    response = variants.length === 0 ? `${apiResponse}<undefined>` : uniqueUnion(variants);
  } else {
    const types = plan.success.map(bodyType);
    response = types.every((t) => t === 'undefined') ? 'void' : uniqueUnion(types);
  }
  const errorTypes = plan.errors.map(bodyType);
  // One ApiError per documented error status, and one for statuses nothing documents.
  const apiError = (): string => runtimeType('runtime/errors', 'ApiError');
  const apiErrors = plan.errors.map(
    (r) => `${apiError()}<${bodyType(r)}, ${statuses.of(r.response.status, false)}>`,
  );
  const rest = statuses.rest();
  if (rest !== undefined && !plan.errors.some((r) => r.response.status === 'default'))
    apiErrors.push(`${apiError()}<unknown, ${rest}>`);
  return {
    response,
    errorBody: errorTypes.length === 0 ? 'unknown' : uniqueUnion(errorTypes),
    apiErrors,
  };
}

function describeResponses(responses: readonly PlannedResponse[]): string {
  return responses
    .map(({ response }) => {
      // The first line, without its final period: entries are joined with `;`.
      const summary = response.description?.split('\n')[0]?.replace(/[\s.]+$/, '') ?? '';
      return `\`${response.status}\`${summary === '' ? '' : ` ${summary}`}`;
    })
    .join('; ');
}

interface DocTypes {
  readonly params: string;
  readonly response: string;
  readonly options: string;
  /** Type expressions for the error classes (JavaScript output needs real JSDoc types). */
  readonly apiError: string;
  readonly requestError: string;
}

function operationDoc(plan: OperationPlan, lang: Lang, types: DocTypes): JsDocBlock {
  const op = plan.symbol.operation;
  const route = `${wireMethod(op.method)} ${op.path}`;
  const text =
    op.summary !== undefined
      ? {
          summary: op.summary,
          ...(op.description === undefined ? {} : { description: op.description }),
        }
      : splitSummary(op.description ?? `Calls \`${route}\`.`);
  const js = lang === 'js';
  const tags: JsDocTag[] = [
    {
      tag: 'remarks',
      text: `\`${route}\`${op.operationId === undefined ? '' : ` (operationId \`${op.operationId}\`)`}`,
    },
  ];
  if (plan.hasParams) {
    const name = plan.paramsRequired ? 'params' : '[params]';
    const what =
      plan.parameters.length === 0
        ? 'Request body'
        : plan.body === undefined
          ? 'Request parameters'
          : 'Request parameters and body';
    tags.push({ tag: 'param', text: `${js ? `{${types.params}} ${name}` : 'params'} - ${what}.` });
  }
  tags.push({
    tag: 'param',
    text: `${js ? `{${types.options}} [options]` : 'options'} - Per-request options: \`signal\`, \`timeout\`, \`headers\`, \`client\`.`,
  });
  const returns =
    plan.success.length === 0
      ? 'Resolves when the request succeeds.'
      : describeResponses(plan.success);
  tags.push({ tag: 'returns', text: `${js ? `{Promise<${types.response}>} ` : ''}${returns}` });
  tags.push({
    tag: 'throws',
    text: `${js ? `{${types.apiError}}` : '{@link ApiError}'} ${plan.errors.length === 0 ? 'When the server responds with a non-2xx status' : describeResponses(plan.errors)}; narrow it with {@link ${plan.symbol.errorGuard}}.`,
  });
  tags.push({
    tag: 'throws',
    text: `${js ? `{${types.requestError}}` : '{@link RequestError}'} When no usable response is received (network failure, timeout or invalid body).`,
  });
  if (op.externalDocs !== undefined) {
    tags.push({
      tag: 'see',
      text: `${op.externalDocs.url}${op.externalDocs.description === undefined ? '' : ` ${op.externalDocs.description}`}`,
    });
  }
  if (op.deprecated) tags.push({ tag: 'deprecated' });
  return { ...text, tags };
}

function parameterDoc(parameter: ParameterIR): JsDocBlock {
  const tags = schemaTags(parameter.schema).filter(
    (t) => t.tag !== 'deprecated' && t.tag !== 'example',
  );
  if (parameter.deprecated || parameter.schema.deprecated === true)
    tags.unshift({ tag: 'deprecated' });
  const example = parameter.examples[0]?.value ?? parameter.schema.examples?.[0];
  if (example !== undefined) tags.push({ tag: 'example', text: JSON.stringify(example) });
  return { ...splitSummary(parameter.description ?? parameter.schema.description), tags };
}

function typedefOrAlias(lang: Lang, name: string, type: string, doc: JsDocBlock): string {
  return lang === 'js'
    ? renderJsDoc({ ...doc, tags: [...doc.tags, { tag: 'typedef', text: `{${type}} ${name}` }] })
    : `${renderJsDoc(doc)}export type ${name} = ${type};\n`;
}

export function generateOperation(plan: OperationPlan, ctx: EmitContext): ModuleOutput {
  const { symbol } = plan;
  const op = symbol.operation;
  const names = symbol.typeNames;
  const full = ctx.config.client.responseStyle === 'full';
  const exports: GeneratedExport[] = [
    { name: symbol.name, kind: 'operation', typeOnly: false },
    ...(plan.hasParams ? [{ name: names.params, kind: 'type' as const, typeOnly: true }] : []),
    ...(plan.body === undefined
      ? []
      : [{ name: names.body, kind: 'type' as const, typeOnly: true }]),
    ...(names.bodies === undefined || plan.body === undefined
      ? []
      : [{ name: names.bodies, kind: 'type' as const, typeOnly: true }]),
    { name: names.response, kind: 'type', typeOnly: true },
    { name: names.errorBody, kind: 'type', typeOnly: true },
    { name: names.apiError, kind: 'type', typeOnly: true },
    { name: names.error, kind: 'type', typeOnly: true },
    { name: symbol.errorGuard, kind: 'error-guard', typeOnly: false },
  ];

  const body = (imports: ImportManager, lang: Lang): string => {
    for (const name of [
      symbol.name,
      names.params,
      names.body,
      names.response,
      names.error,
      names.apiError,
      names.errorBody,
      symbol.errorGuard,
      ...(names.bodies === undefined ? [] : [names.bodies]),
    ])
      imports.declare(name);
    const output: TypeContext = {
      imports,
      project: ctx.project,
      config: ctx.config,
      direction: 'output',
    };
    const input: TypeContext = { ...output, direction: 'input' };
    const requestOptions = imports.add('client', 'RequestOptions', { typeOnly: true });
    const runtimeType = (module: string, name: string): string =>
      imports.add(module, name, { typeOnly: true });
    const parts: string[] = [];

    // Request body types -------------------------------------------------------------------
    const alternatives = plan.body !== undefined && plan.body.alternatives.length > 0;
    if (plan.body !== undefined) {
      const bodyType = mediaBodyType(plan.body.media, input);
      const doc: JsDocBlock = {
        summary:
          op.requestBody?.description ??
          `Request body of {@link ${symbol.name}} (\`${plan.body.media.mediaType}\`).`,
        tags: [],
      };
      parts.push(
        lang === 'js' && bodyKind(plan.body.media) !== 'raw'
          ? jsTypedef(names.body, plan.body.media.schema, doc, input)
          : typedefOrAlias(lang, names.body, bodyType, doc),
      );
      if (alternatives && names.bodies !== undefined) {
        const entries = [plan.body.media, ...plan.body.alternatives].map(
          (media) => `${quote(media.mediaType)}: ${mediaBodyType(media, input, '  ')};`,
        );
        const bodiesDoc: JsDocBlock = {
          summary: `Request bodies of {@link ${symbol.name}} by media type. Select one with \`${plan.body.contentTypeProperty}\`.`,
          tags: [],
        };
        parts.push(
          lang === 'js'
            ? typedefOrAlias(lang, names.bodies, `{ ${entries.join(' ')} }`, bodiesDoc)
            : `${renderJsDoc(bodiesDoc)}export type ${names.bodies} = {\n${entries.map((e) => `  ${e}`).join('\n')}\n};\n`,
        );
      }
    }

    // Params type ---------------------------------------------------------------------------
    if (plan.hasParams) {
      const members = plan.parameters.map(({ property, parameter }) => ({
        key: property,
        optional: !parameter.required,
        type: printType(parameter.schema, input, '  '),
        doc: parameterDoc(parameter),
      }));
      const bodyMember =
        plan.body === undefined
          ? undefined
          : {
              key: plan.body.property,
              optional: !plan.body.required,
              type: names.body,
              doc: { summary: 'Request body.', tags: [] } as JsDocBlock,
            };
      // Several media types: a union discriminated by the content type property.
      const planned = plan.body;
      const bodies = names.bodies;
      const unionVariants =
        planned !== undefined && alternatives && bodies !== undefined
          ? bodyVariants(planned, (media) => mediaBodyType(media, input)).map((variant, index) => {
              const first = index === 0;
              const contentTypeDoc: JsDocBlock = {
                summary: first
                  ? `Media type of the request body. Default \`${planned.media.mediaType}\`.`
                  : 'Media type of the request body.',
                tags: [],
              };
              const bodyDoc: JsDocBlock = { summary: 'Request body.', tags: [] };
              return [
                {
                  key: planned.contentTypeProperty,
                  optional: first,
                  type: variant.mediaTypes.map(quote).join(' | '),
                  doc: contentTypeDoc,
                },
                {
                  key: planned.property,
                  optional: !planned.required,
                  type: first ? names.body : `${bodies}[${quote(variant.mediaTypes[0] ?? '')}]`,
                  doc: bodyDoc,
                },
              ];
            })
          : undefined;
      if (bodyMember !== undefined && unionVariants === undefined) members.push(bodyMember);
      const doc: JsDocBlock = { summary: `Parameters of {@link ${symbol.name}}.`, tags: [] };
      const inline = (list: readonly (typeof members)[number][]): string =>
        `{ ${list.map((m) => `${propertyKey(m.key)}${m.optional ? '?' : ''}: ${m.type}${m.optional ? ' | undefined' : ''};`).join(' ')} }`;
      const block = (list: readonly (typeof members)[number][], indent: string): string => {
        const lines = list.map((m) => {
          const memberDoc = ctx.config.features.jsdoc ? renderJsDoc(m.doc, `${indent}  `) : '';
          return `${memberDoc}${indent}  ${propertyKey(m.key)}${m.optional ? '?' : ''}: ${m.type}${m.optional ? ' | undefined' : ''};`;
        });
        return `{\n${lines.join('\n')}\n${indent}}`;
      };
      if (lang === 'js') {
        const tags: JsDocTag[] = [];
        if (unionVariants !== undefined) {
          const union = unionVariants.map((variant) => inline(variant)).join(' | ');
          const type = members.length === 0 ? union : `${inline(members)} & (${union})`;
          tags.push({ tag: 'typedef', text: `{${type}} ${names.params}` });
        } else if (members.every((m) => isPropertyIdentifier(m.key))) {
          tags.push({ tag: 'typedef', text: `{object} ${names.params}` });
          for (const member of members) {
            const description = member.doc.summary ?? '';
            // Optional members accept `undefined`, as in TypeScript output
            // (`exactOptionalPropertyTypes`).
            const type = member.optional ? `${member.type} | undefined` : member.type;
            tags.push({
              tag: 'property',
              text: `{${type}} ${member.optional ? `[${member.key}]` : member.key}${description === '' ? '' : ` - ${description}`}`,
            });
          }
        } else {
          tags.push({ tag: 'typedef', text: `{${inline(members)}} ${names.params}` });
        }
        parts.push(renderJsDoc({ ...doc, tags }));
      } else if (unionVariants !== undefined) {
        const union = unionVariants.map((variant) => `  | ${block(variant, '    ')}`).join('\n');
        const type =
          members.length === 0 ? `\n${union}` : ` ${block(members, '')} & (\n${union}\n)`;
        parts.push(`${renderJsDoc(doc)}export type ${names.params} =${type};\n`);
      } else {
        parts.push(`${renderJsDoc(doc)}export type ${names.params} = ${block(members, '')};\n`);
      }
    }

    // Response and error types ------------------------------------------------------------------
    const types = responseTypes(plan, output, full, runtimeType);
    const typedef = (name: string, type: string, doc: JsDocBlock): string =>
      lang === 'js'
        ? renderJsDoc({ ...doc, tags: [{ tag: 'typedef', text: `{${type}} ${name}` }] })
        : `${renderJsDoc(doc)}export type ${name} = ${type};\n`;
    parts.push(
      typedef(names.response, types.response, {
        summary: `${full ? 'Response' : 'Response data'} of {@link ${symbol.name}}.`,
        tags: [],
      }),
    );
    parts.push(
      typedef(names.errorBody, types.errorBody, {
        summary: `Body of an error response of {@link ${symbol.name}}.`,
        tags: [],
      }),
    );
    const apiErrorDoc: JsDocBlock = {
      summary: `The \`ApiError\`s {@link ${symbol.name}} rejects with: one per documented status, so checking \`status\` narrows \`body\`.`,
      ...(types.apiErrors.length > plan.errors.length
        ? { description: 'The last member covers statuses the specification does not document.' }
        : {}),
      tags: [],
    };
    parts.push(
      lang === 'js' || types.apiErrors.length === 1
        ? typedef(names.apiError, types.apiErrors.join(' | '), apiErrorDoc)
        : `${renderJsDoc(apiErrorDoc)}export type ${names.apiError} =\n${types.apiErrors.map((member) => `  | ${member}`).join('\n')};\n`,
    );
    parts.push(
      typedef(names.error, `${names.apiError} | ${runtimeType('runtime/errors', 'RequestError')}`, {
        summary: `Everything {@link ${symbol.name}} rejects with: an \`ApiError\` for an error status, or a \`RequestError\` when no usable response arrived.`,
        tags: [],
      }),
    );

    // Function ----------------------------------------------------------------------------------
    const errorType = (name: string): string =>
      lang === 'js' ? imports.add('runtime/errors', name, { typeOnly: true }) : name;
    const docTypes: DocTypes = {
      params: names.params,
      response: names.response,
      options: requestOptions,
      apiError: errorType('ApiError'),
      requestError: errorType('RequestError'),
    };
    const doc = applyJsDocHook(ctx, operationDoc(plan, lang, docTypes), {
      kind: 'operation',
      operation: op,
    });
    const paramsArg = plan.hasParams
      ? plan.paramsRequired
        ? `params: ${names.params}`
        : `params?: ${names.params}`
      : undefined;
    const signatureArgs = [
      ...(paramsArg === undefined ? [] : [paramsArg]),
      `options?: ${requestOptions}`,
    ].join(', ');
    const returnType = `Promise<${names.response}>`;
    if (lang === 'dts') {
      parts.push(
        `${renderJsDoc(doc)}export declare function ${symbol.name}(${signatureArgs}): ${returnType};\n`,
      );
    } else {
      const clientRef = imports.add('client', 'client', { typeOnly: false });
      const args =
        lang === 'ts'
          ? signatureArgs
          : [...(plan.hasParams ? ['params'] : []), 'options'].join(', ');
      const annotation = lang === 'ts' ? `: ${returnType}` : '';
      const method = full ? 'send' : 'request';
      const typeArg = lang === 'ts' ? `<${names.response}>` : '';
      const validation = ctx.config.features.validation;
      const validator = validatorFor(ctx);
      const validators: string[] = [];
      if (validator !== undefined && validation !== false) {
        if (validation.request && plan.body !== undefined) {
          const optionalParams = plan.hasParams && !plan.paramsRequired;
          const selected = selectedMediaType(plan.body, (property) =>
            propertyAccess('params', property, optionalParams),
          );
          const validate = requestValidation(plan, imports, ctx, validator, selected);
          if (validate !== undefined) validators.push(`validateBody: ${validate}`);
        }
        if (validation.response)
          validators.push(`validateResponse: ${responseValidation(plan, imports, ctx, validator)}`);
      }
      const conversions: string[] = [];
      const parameterShapes = new Map<ParameterIR, string>();
      if (ctx.config.types.dates === 'Date') {
        const project = ctx.project;
        const runtimeDates = (name: string): string =>
          imports.add('runtime/dates', name, { typeOnly: false });
        const bodyShape =
          plan.body === undefined
            ? undefined
            : combinedDateShape(
                [plan.body.media, ...plan.body.alternatives].map((media) => media.schema),
                project,
                imports,
                '      ',
              );
        if (bodyShape !== undefined)
          conversions.push(
            `encodeBody: (body) => ${runtimeDates('encodeDates')}(body, ${bodyShape})`,
          );
        const responseShape = combinedDateShape(
          plan.success.flatMap((response) =>
            response.media === undefined ? [] : [response.media.schema],
          ),
          project,
          imports,
          '      ',
        );
        if (responseShape !== undefined)
          conversions.push(
            `transformResponse: (data) => ${runtimeDates('reviveDates')}(data, ${responseShape})`,
          );
        for (const { parameter } of plan.parameters) {
          const shape = dateShape(parameter.schema, project, imports);
          if (shape !== undefined)
            parameterShapes.set(parameter, `${runtimeDates('encodeDates')}(%s, ${shape})`);
        }
      }
      const descriptor = requestDescriptor(plan, {
        extra: [...validators, ...conversions],
        parameter: (parameter, expression) =>
          parameterShapes.get(parameter)?.replace('%s', expression) ?? expression,
      });
      parts.push(
        `${renderJsDoc(doc)}export function ${symbol.name}(${args})${annotation} {\n` +
          `  return (options?.client ?? ${clientRef}).${method}${typeArg}(\n` +
          `    {\n${descriptor.map((line) => `      ${line},`).join('\n')}\n    },\n` +
          `    options,\n  );\n}\n`,
      );
    }

    // Error guard -------------------------------------------------------------------------------
    // JavaScript needs the `@param`/`@returns` tags for its types, even without documentation.
    const guardDoc: JsDocBlock = {
      ...(ctx.config.features.jsdoc
        ? {
            summary: `Whether \`error\` is an \`ApiError\` rejected by {@link ${symbol.name}}. It narrows to {@link ${names.apiError}}, so checking \`status\` afterwards narrows \`body\` too.`,
          }
        : {}),
      tags:
        lang === 'js'
          ? [
              { tag: 'param', text: '{unknown} error' },
              { tag: 'returns', text: `{error is ${names.apiError}}` },
            ]
          : [],
    };
    const guardSignature = `${symbol.errorGuard}(error${lang === 'js' ? '' : ': unknown'})`;
    if (lang === 'dts') {
      parts.push(
        `${renderJsDoc(guardDoc)}export declare function ${guardSignature}: error is ${names.apiError};\n`,
      );
    } else {
      const isApiError = imports.add('runtime/errors', 'isApiError', { typeOnly: false });
      parts.push(
        `${renderJsDoc(guardDoc)}export function ${guardSignature}${lang === 'ts' ? `: error is ${names.apiError}` : ''} {\n` +
          `  return (\n    ${isApiError}(error) &&\n    error.operationId === ${quote(op.operationId ?? symbol.name)} &&\n    error.method === ${quote(wireMethod(op.method))}\n  );\n}\n`,
      );
    }
    return parts.join('\n');
  };

  return {
    module: symbol.module,
    origin: 'core:operation',
    ...renderAll(symbol.module, ctx, body),
    exports,
    sources: { operations: [symbol.key] },
  };
}

/** Expression for the media type a call sends: the content type property or the default. */
export function selectedMediaType(body: PlannedBody, access: (property: string) => string): string {
  return `(${access(body.contentTypeProperty)} ?? ${quote(body.media.mediaType)})`;
}

/**
 * Lines of the request descriptor object passed to the client. `body` can wrap the body expression
 * (e.g. with request validation) and `extra` lines (e.g. a response validator) are appended.
 */
export function requestDescriptor(
  plan: OperationPlan,
  options: {
    readonly extra?: readonly string[];
    readonly body?: (expression: string) => string;
    /** Wraps the value expression of a parameter (e.g. to encode dates). */
    readonly parameter?: (parameter: ParameterIR, expression: string) => string;
  } = {},
): string[] {
  const op = plan.symbol.operation;
  const optionalParams = plan.hasParams && !plan.paramsRequired;
  const access = (property: string): string => propertyAccess('params', property, optionalParams);
  const lines = [
    `operationId: ${quote(op.operationId ?? plan.symbol.name)}`,
    `method: ${quote(wireMethod(op.method))}`,
    `path: ${quote(op.path)}`,
  ];
  const styles: Partial<Record<ParameterLocation, Record<string, unknown>>> = {};
  for (const location of ['path', 'query', 'header', 'cookie'] as const) {
    const entries = plan.parameters.filter((p) => p.parameter.in === location);
    if (entries.length === 0) continue;
    lines.push(
      `${LOCATION_FIELDS[location]}: { ${entries.map((e) => `${propertyKey(e.parameter.name)}: ${options.parameter?.(e.parameter, access(e.property)) ?? access(e.property)}`).join(', ')} }`,
    );
    for (const { parameter } of entries) {
      const serialization = nonDefaultSerialization(parameter);
      if (serialization !== undefined) (styles[location] ??= {})[parameter.name] = serialization;
    }
  }
  if (Object.keys(styles).length > 0) lines.push(`styles: ${literal(styles)}`);
  const querystring = plan.parameters.find((p) => p.parameter.in === 'querystring');
  if (querystring !== undefined) {
    const { parameter } = querystring;
    const value =
      options.parameter?.(parameter, access(querystring.property)) ?? access(querystring.property);
    const fields = [
      `value: ${value}`,
      `mediaType: ${quote(parameter.contentType ?? 'application/x-www-form-urlencoded')}`,
      ...(parameter.encoding === undefined ? [] : [`encoding: ${literal(parameter.encoding)}`]),
    ];
    lines.push(`querystring: { ${fields.join(', ')} }`);
  }
  if (plan.body !== undefined) {
    const body = access(plan.body.property);
    lines.push(`body: ${options.body === undefined ? body : options.body(body)}`);
    if (plan.body.alternatives.length === 0) {
      lines.push(`mediaType: ${quote(plan.body.media.mediaType)}`);
      if (plan.body.media.encoding !== undefined)
        lines.push(`encoding: ${literal(plan.body.media.encoding)}`);
    } else {
      const selected = selectedMediaType(plan.body, access);
      lines.push(`mediaType: ${selected}`);
      for (const media of [plan.body.media, ...plan.body.alternatives]) {
        if (media.encoding === undefined) continue;
        lines.push(
          `...(${selected} === ${quote(media.mediaType)} ? { encoding: ${literal(media.encoding)} } : {})`,
        );
      }
    }
  }
  if (plan.server !== undefined) lines.push(`server: ${quote(plan.server)}`);
  if (plan.successStatuses.length > 0)
    lines.push(`successStatuses: ${literal(plan.successStatuses)}`);
  if (plan.accept !== undefined) lines.push(`accept: ${quote(plan.accept)}`);
  if (plan.security !== undefined) lines.push(`security: ${literal(plan.security)}`);
  if (plan.parseAs !== undefined) lines.push(`parseAs: ${quote(plan.parseAs)}`);
  return [...lines, ...(options.extra ?? [])];
}
