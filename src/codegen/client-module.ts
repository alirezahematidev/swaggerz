import type { SecuritySchemeIR, ServerIR } from '../ir/types.ts';
import { renderAll, type EmitContext, type ModuleOutput } from './context.ts';
import { literal, quote, renderJsDoc } from './printer.ts';

/** Resolves the default base URL: config, then the first server with variable defaults applied. */
export function defaultBaseUrl(
  servers: readonly ServerIR[],
  configured: string | undefined,
): string {
  if (configured !== undefined) return configured;
  const server = servers[0];
  if (server === undefined) return '';
  return server.url.replace(
    /\{([^}]+)\}/g,
    (match, name: string) => server.variables[name]?.default ?? match,
  );
}

function securitySchemes(schemes: readonly SecuritySchemeIR[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const scheme of schemes) {
    switch (scheme.type) {
      case 'apiKey':
        result[scheme.key] = { type: 'apiKey', in: scheme.in, name: scheme.name };
        break;
      case 'http':
        result[scheme.key] = { type: 'http', scheme: scheme.scheme };
        break;
      case 'oauth2':
      case 'openIdConnect':
        result[scheme.key] = { type: scheme.type };
        break;
      case 'mutualTLS':
        break;
    }
  }
  return result;
}

/** The `client` module: the default client instance and the specialized `RequestOptions` type. */
export function generateClientModule(ctx: EmitContext): ModuleOutput {
  const { config, project } = ctx;
  const axios = config.client.adapter === 'axios';
  const adapterModule = `runtime/${config.client.adapter}`;
  const optionsType = axios ? 'AxiosTransportOptions' : 'FetchTransportOptions';
  const fields: string[] = [
    `baseUrl: ${quote(defaultBaseUrl(project.ir.servers, config.client.baseUrl))}`,
  ];
  const schemes = securitySchemes(project.ir.securitySchemes);
  if (Object.keys(config.client.headers).length > 0)
    fields.push(`headers: ${literal(config.client.headers)}`);
  if (config.client.timeout !== undefined) fields.push(`timeout: ${config.client.timeout}`);
  if (config.client.includeCredentials) fields.push(`credentials: 'include'`);
  if (!config.client.operationServers) fields.push('operationServers: false');
  if (Object.keys(schemes).length > 0) fields.push(`securitySchemes: ${literal(schemes)}`);

  const clientDoc = renderJsDoc({
    summary: 'The client used by generated operations.',
    description:
      "Configure it once at startup, for example:\n\n```ts\nclient.setConfig({ baseUrl: 'https://api.example.com', auth: { bearerAuth: () => getToken() } });\n```\n\nPass `{ client }` in the per-call options to use another instance created with `createClient()`.",
    tags: [],
  });
  const optionsDoc = {
    summary: 'Per-call options accepted by every generated operation.',
    tags: [],
  };

  const outputs = renderAll('client', ctx, (imports, lang) => {
    imports.declare('client');
    imports.declare('RequestOptions');
    const transportOptions = imports.add(adapterModule, optionsType, { typeOnly: true });
    const runtimeOptions = imports.add('runtime/types', 'RequestOptions', {
      typeOnly: true,
      alias: 'RuntimeRequestOptions',
    });
    const clientType = imports.add('runtime/types', 'Client', { typeOnly: true });
    const optionsAlias = `${runtimeOptions}<${transportOptions}>`;
    if (lang === 'dts') {
      return [
        `${renderJsDoc(optionsDoc)}export type RequestOptions = ${optionsAlias};\n`,
        `${clientDoc}export declare const client: ${clientType}<${transportOptions}>;\n`,
      ].join('\n');
    }
    const createClient = imports.add('runtime/client', 'createClient', { typeOnly: false });
    const transport = axios
      ? `/* @__PURE__ */ ${imports.add(adapterModule, 'createAxiosTransport', { typeOnly: false })}()`
      : imports.add(adapterModule, 'fetchTransport', { typeOnly: false });
    const clientConfig = `{\n${[...fields.slice(0, 1), `transport: ${transport}`, ...fields.slice(1)].map((f) => `  ${f},`).join('\n')}\n}`;
    if (lang === 'ts') {
      return [
        `${renderJsDoc(optionsDoc)}export type RequestOptions = ${optionsAlias};\n`,
        `${clientDoc}export const client: ${clientType}<${transportOptions}> = /* @__PURE__ */ ${createClient}<${transportOptions}>(${clientConfig});\n`,
      ].join('\n');
    }
    return [
      renderJsDoc({
        ...optionsDoc,
        tags: [{ tag: 'typedef', text: `{${optionsAlias}} RequestOptions` }],
      }),
      `${renderJsDoc({
        summary: 'The client used by generated operations.',
        description: 'Configure it once at startup with `client.setConfig()`.',
        tags: [{ tag: 'type', text: `{${clientType}<${transportOptions}>}` }],
      })}export const client = /* @__PURE__ */ ${createClient}(${clientConfig});\n`,
    ].join('\n');
  });

  return {
    module: 'client',
    origin: 'core:client',
    ...outputs,
    exports: [
      { name: 'client', kind: 'client', typeOnly: false },
      { name: 'RequestOptions', kind: 'runtime', typeOnly: true },
    ],
  };
}
