import type { WebhookSymbol } from '../../analysis/types.ts';
import {
  wireMethod,
  type ObjectSchema,
  type ParameterLocation,
  type PropertyIR,
} from '../../ir/types.ts';
import { renderAll, type EmitContext, type ModuleOutput } from '../context.ts';
import { dateShape } from '../dates.ts';
import { bodyKind, isStringSchema, preferredMedia } from '../operation-plan.ts';
import { quote, renderJsDoc } from '../printer.ts';
import type { GeneratedExport, JsDocBlock } from '../types.ts';
import { isXml } from './encodings.ts';
import { FAKE, printValue, printRoot, type PrintContext } from './fixtures.ts';
import { isObjectRecipe, usesFake, type MockSampler, type MockValue } from './sampler.ts';

const SUPPORT = 'mocks/support';

/** Where each kind of parameter sits in a webhook's request type. */
const LOCATIONS: readonly { location: ParameterLocation; field: string }[] = [
  { location: 'path', field: 'path' },
  { location: 'query', field: 'query' },
  { location: 'header', field: 'headers' },
  { location: 'cookie', field: 'cookies' },
];

/**
 * The request a webhook or callback sends, as a schema of its request type: `body`, the declared
 * parameters by location, and the parsed `querystring`.
 */
function requestValue(symbol: WebhookSymbol, sampler: MockSampler): MockValue {
  const { operation } = symbol;
  const media =
    operation.requestBody === undefined
      ? undefined
      : preferredMedia(operation.requestBody.contents, 'request');
  const properties: PropertyIR[] = [];
  // Bodies the runtime cannot serialize are typed as text: XML is written as XML.
  const raw = media !== undefined && bodyKind(media) === 'raw';
  if (media !== undefined && !raw) {
    const example = media.examples.find((e) => e.value !== undefined)?.value;
    properties.push({
      name: 'body',
      required: operation.requestBody?.required === true,
      schema:
        example === undefined || media.schema.examples !== undefined
          ? media.schema
          : { ...media.schema, examples: [example] },
    });
  }
  for (const { location, field } of LOCATIONS) {
    const parameters = operation.parameters.filter((p) => p.in === location);
    if (parameters.length === 0) continue;
    const object: ObjectSchema = {
      kind: 'object',
      properties: parameters.map((parameter) => ({
        name: location === 'header' ? parameter.name.toLowerCase() : parameter.name,
        required: parameter.required,
        schema: parameter.schema,
      })),
    };
    properties.push({ name: field, required: true, schema: object });
  }
  const querystring = operation.parameters.find((p) => p.in === 'querystring');
  if (querystring !== undefined)
    properties.push({
      name: 'querystring',
      required: querystring.required,
      schema: querystring.schema,
    });
  const label = symbol.typeNames.request;
  const value = sampler.value(
    { kind: 'object', properties },
    label,
    operation.source,
    symbol.webhook.name,
  );
  if (!raw || value.kind !== 'object') return value;
  const body: MockValue =
    isXml(media.mediaType) && !isStringSchema(media.schema)
      ? {
          kind: 'encoded',
          encoding: 'xml',
          mediaType: media.mediaType,
          value: sampler.value(
            media.schema,
            `${label} body`,
            operation.source,
            symbol.webhook.name,
          ),
          shape: sampler.xmlShape(media.schema),
        }
      : {
          kind: 'text',
          key: 'body',
          value: 'Payload of the webhook.',
          text: 'paragraph',
          min: 0,
          max: Infinity,
        };
  return { ...value, entries: [['body', body], ...value.entries] };
}

/**
 * The `mocks/webhooks/<webhook>` (or `mocks/callbacks/…`) module: for each operation, a request
 * the API could send (`make…Request()`), to call your handler with in tests, and a function that
 * sends it to a URL (`send…()`), to test your route end to end.
 */
export function generateWebhookMockModule(
  symbols: readonly WebhookSymbol[],
  sampler: MockSampler,
  ctx: EmitContext,
): ModuleOutput | undefined {
  const module = symbols[0]?.mock?.module;
  if (module === undefined) return undefined;
  const exports: GeneratedExport[] = symbols.flatMap((symbol) =>
    symbol.mock === undefined
      ? []
      : [
          { name: symbol.mock.make, kind: 'fixture' as const, typeOnly: false },
          { name: symbol.mock.send, kind: 'mock' as const, typeOnly: false },
        ],
  );
  const values = new Map(symbols.map((symbol) => [symbol, requestValue(symbol, sampler)]));
  const outputs = renderAll(module, ctx, (imports, lang) => {
    for (const entry of exports) imports.declare(entry.name);
    const p: PrintContext = { imports, ctx, sampler };
    return symbols
      .map((symbol) => {
        const mock = symbol.mock;
        const value = values.get(symbol);
        if (mock === undefined || value === undefined) return '';
        const { operation } = symbol;
        const method = wireMethod(operation.method);
        const what =
          symbol.kind === 'webhook'
            ? `the \`${symbol.webhook.name}\` webhook`
            : `the \`${symbol.webhook.name}\` callback`;
        const request = imports.add(symbol.module, symbol.typeNames.request, { typeOnly: true });
        const options = imports.add(FAKE, 'FixtureOptions', { typeOnly: true });
        const sendOptions = imports.add(SUPPORT, 'SendWebhookOptions', { typeOnly: true });
        const overrides =
          isObjectRecipe(value) && value.kind === 'object' && value.entries.length > 0;
        const used = usesFake(value);
        const optionsName = used ? 'options' : '_options';
        const partial = `${imports.global('Partial')}<${request}>`;
        const makeDoc: JsDocBlock = {
          summary: `A request the API could send for ${what} (\`${method}\`), to call your handler with in tests. Without a seed it is made of the specification's examples; other seeds make other realistic requests.`,
          tags: [
            ...(overrides
              ? [
                  {
                    tag: 'param',
                    text: `${lang === 'js' ? `{${partial}} [overrides]` : 'overrides'} - Parts of the request that replace the generated ones.`,
                  },
                ]
              : []),
            {
              tag: 'param',
              text: `${lang === 'js' ? `{${options}} [${optionsName}]` : optionsName} - \`seed\` picks another request (\`0\`, the default, is the examples').`,
            },
            ...(lang === 'js' ? [{ tag: 'returns', text: `{${request}}` }] : []),
          ],
        };
        const response = `${imports.global('Promise')}<${imports.global('Response')}>`;
        const sendDoc: JsDocBlock = {
          summary: `Sends the \`${method}\` request the API sends for ${what} to \`url\` (by default a generated request), and resolves with your route's response.`,
          tags: [
            {
              tag: 'param',
              text: `${lang === 'js' ? '{string | URL} url' : 'url'} - Where your route listens.`,
            },
            {
              tag: 'param',
              text: `${lang === 'js' ? `{${request}} [request]` : 'request'} - The request to send; \`${mock.make}()\` by default.`,
            },
            {
              tag: 'param',
              text: `${lang === 'js' ? `{${sendOptions}} [options]` : 'options'} - The \`fetch\` to send with, and extra headers.`,
            },
            ...(lang === 'js' ? [{ tag: 'returns', text: `{${response}}` }] : []),
          ],
        };
        const makeParams =
          lang === 'js'
            ? overrides
              ? `overrides, ${optionsName}`
              : optionsName
            : `${overrides ? `overrides?: ${partial}, ` : ''}${optionsName}?: ${options}`;
        const sendParams =
          lang === 'js'
            ? 'url, request, options'
            : `url: string | URL, request?: ${request}, options?: ${sendOptions}`;
        if (lang === 'dts')
          return [
            `${renderJsDoc(makeDoc)}export declare function ${mock.make}(${makeParams}): ${request};\n`,
            `${renderJsDoc(sendDoc)}export declare function ${mock.send}(${sendParams}): ${response};\n`,
          ].join('\n');
        let body = overrides ? printRoot(value, p) : printValue(value, p, '  ');
        // A request that cannot match its schema (reported) is cast, so the module still compiles.
        if (!sampler.fits(value))
          body =
            lang === 'ts'
              ? `${body} as unknown as ${request}`
              : `/** @type {${request}} */ (/** @type {unknown} */ (${body}))`;
        const fake = used
          ? `  const f = ${imports.add(FAKE, 'fake', { typeOnly: false })}(options);\n`
          : '';
        const media =
          operation.requestBody === undefined
            ? undefined
            : preferredMedia(operation.requestBody.contents, 'request');
        const fields = [`method: ${quote(method)}`];
        if (media !== undefined) fields.push(`mediaType: ${quote(media.mediaType)}`);
        if (
          ctx.config.types.dates === 'Date' &&
          media !== undefined &&
          bodyKind(media) === 'json'
        ) {
          const shape = dateShape(media.schema, ctx.project, imports, '    ');
          if (shape !== undefined)
            fields.push(
              `encode: (body) => ${imports.add('runtime/dates', 'encodeDates', { typeOnly: false })}(body, ${shape})`,
            );
        }
        const send = imports.add(SUPPORT, 'sendWebhook', { typeOnly: false });
        return [
          `${renderJsDoc(makeDoc)}export function ${mock.make}(${makeParams})${lang === 'ts' ? `: ${request}` : ''} {\n${fake}  return ${body};\n}\n`,
          `${renderJsDoc(sendDoc)}export function ${mock.send}(${sendParams})${lang === 'ts' ? `: ${response}` : ''} {\n  return ${send}(\n    url,\n    { ${fields.join(', ')} },\n    request ?? ${mock.make}(),\n    options,\n  );\n}\n`,
        ].join('\n');
      })
      .join('\n');
  });
  return {
    module,
    origin: 'core:mocks',
    ...outputs,
    exports,
    sources: { operations: symbols.map((symbol) => symbol.key) },
  };
}
