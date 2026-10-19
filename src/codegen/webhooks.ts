import type { WebhookSymbol } from '../analysis/types.ts';
import type { ParameterLocation } from '../ir/types.ts';
import { renderAll, type EmitContext, type ModuleOutput } from './context.ts';
import type { Lang } from './imports.ts';
import { splitSummary } from './jsdoc.ts';
import { isSuccessStatus, preferredMedia } from './operation-plan.ts';
import { mediaBodyType } from './operations.ts';
import { propertyKey, renderJsDoc } from './printer.ts';
import { printType, type TypeContext } from './type-printer.ts';
import type { GeneratedExport, JsDocBlock } from './types.ts';

const LOCATIONS: readonly { location: ParameterLocation; field: string }[] = [
  { location: 'path', field: 'path' },
  { location: 'query', field: 'query' },
  { location: 'header', field: 'headers' },
  { location: 'cookie', field: 'cookies' },
];

/**
 * A module of types for one webhook or callback: what the API sends (`…Payload`, `…Request`),
 * what it expects back (`…Response`) and the signature of a handler (`…Handler`). Type-only, so
 * it costs nothing at runtime; validate payloads with the generated Zod schemas if needed.
 */
export function generateWebhookModule(
  symbols: readonly WebhookSymbol[],
  ctx: EmitContext,
): ModuleOutput {
  const first = symbols[0];
  if (first === undefined) throw new Error('A webhook module needs at least one operation.');
  const module = first.module;
  const exports: GeneratedExport[] = symbols.flatMap((symbol) =>
    Object.values(symbol.typeNames).map((name) => ({
      name,
      kind: 'type' as const,
      typeOnly: true,
    })),
  );
  const outputs = renderAll(module, ctx, (imports, lang) => {
    for (const entry of exports) imports.declare(entry.name);
    // The API produces the payload (like a response) and consumes our response (like a request).
    const incoming: TypeContext = {
      imports,
      project: ctx.project,
      config: ctx.config,
      direction: 'output',
    };
    const outgoing: TypeContext = { ...incoming, direction: 'input' };
    return symbols.map((symbol) => renderWebhook(symbol, lang, incoming, outgoing, ctx)).join('\n');
  });
  return {
    module,
    origin: first.kind === 'webhook' ? 'core:webhook' : 'core:callback',
    ...outputs,
    exports,
    sources: { operations: symbols.map((symbol) => symbol.key) },
  };
}

function renderWebhook(
  symbol: WebhookSymbol,
  lang: Lang,
  incoming: TypeContext,
  outgoing: TypeContext,
  ctx: EmitContext,
): string {
  const { operation, typeNames: names } = symbol;
  const method = operation.method.toUpperCase();
  const what =
    symbol.kind === 'webhook'
      ? `the \`${symbol.webhook.name}\` webhook`
      : `the \`${symbol.webhook.name}\` callback (\`${method} ${symbol.webhook.expression ?? ''}\`)`;
  const typedef = (name: string, type: string, doc: JsDocBlock): string =>
    lang === 'js'
      ? renderJsDoc({ ...doc, tags: [...doc.tags, { tag: 'typedef', text: `{${type}} ${name}` }] })
      : `${renderJsDoc(doc)}export type ${name} = ${type};\n`;
  const docs = ctx.config.features.jsdoc;
  const parts: string[] = [];

  const media =
    operation.requestBody === undefined
      ? undefined
      : preferredMedia(operation.requestBody.contents, 'request');
  const payload = media === undefined ? 'undefined' : mediaBodyType(media, incoming);
  const description = splitSummary(operation.summary ?? operation.description);
  parts.push(
    typedef(names.payload, payload, {
      summary:
        description.summary ??
        `Body of the \`${method}\` request the API sends for ${what}${media === undefined ? '' : ` (\`${media.mediaType}\`)`}.`,
      ...(description.description === undefined ? {} : { description: description.description }),
      tags: operation.deprecated ? [{ tag: 'deprecated' }] : [],
    }),
  );

  const members: string[] = [];
  const bodyOptional = operation.requestBody?.required !== true;
  if (media !== undefined)
    members.push(member('body', names.payload, bodyOptional, 'Request body.', lang, docs));
  for (const { location, field } of LOCATIONS) {
    const parameters = operation.parameters.filter((p) => p.in === location);
    if (parameters.length === 0) continue;
    const entries = parameters.map(
      (parameter) =>
        `${propertyKey(location === 'header' ? parameter.name.toLowerCase() : parameter.name)}${parameter.required ? '' : '?'}: ${printType(parameter.schema, incoming)}${parameter.required ? '' : ' | undefined'}`,
    );
    members.push(
      member(
        field,
        `{ ${entries.join('; ')} }`,
        false,
        location === 'header'
          ? 'Declared headers (names in lowercase).'
          : `Declared ${location} parameters.`,
        lang,
        docs,
      ),
    );
  }
  parts.push(
    typedef(
      names.request,
      lang === 'js'
        ? `{ ${members.join(' ')} }`
        : members.length === 0
          ? 'Record<string, never>'
          : `{\n${members.join('\n')}\n}`,
      { summary: `The request the API sends for ${what}.`, tags: [] },
    ),
  );

  const success = operation.responses.filter((response) => isSuccessStatus(response.status));
  const responseTypes = [
    ...new Set(
      success.map((response) => {
        const body = preferredMedia(response.contents, 'response');
        return body === undefined ? 'void' : mediaBodyType(body, outgoing);
      }),
    ),
  ];
  const statuses = success.map((response) => `\`${response.status}\``).join(', ');
  parts.push(
    typedef(names.response, responseTypes.length === 0 ? 'void' : responseTypes.join(' | '), {
      summary: `Response body the API expects from ${what}${statuses === '' ? '' : ` (${statuses})`}.`,
      tags: [],
    }),
  );

  const handlerType = `(request: ${names.request}) => ${names.response} | Promise<${names.response}>`;
  parts.push(
    typedef(names.handler, handlerType, {
      summary: `Handles ${what}.`,
      description:
        'Implement it in your server and call it with the received request. Payloads are not validated; use the generated Zod schemas to validate untrusted input.',
      tags: [],
    }),
  );
  return parts.join('\n');
}

function member(
  key: string,
  type: string,
  optional: boolean,
  summary: string,
  lang: Lang,
  docs: boolean,
): string {
  const text = `${propertyKey(key)}${optional ? '?' : ''}: ${type}${optional ? ' | undefined' : ''};`;
  if (lang === 'js') return text;
  return `${docs ? renderJsDoc({ summary, tags: [] }, '  ') : ''}  ${text}`;
}

/** Groups webhook symbols by module, in module order. */
export function webhookModules(symbols: readonly WebhookSymbol[]): WebhookSymbol[][] {
  const byModule = new Map<string, WebhookSymbol[]>();
  for (const symbol of symbols) {
    const list = byModule.get(symbol.module);
    if (list === undefined) byModule.set(symbol.module, [symbol]);
    else list.push(symbol);
  }
  return [...byModule.values()];
}
