(function(){function e(e){let t=e.startsWith(`/`),n=[];for(let r of e.split(`/`))r===``||r===`.`||(r===`..`?n.length>0&&n.at(-1)!==`..`?n.pop():t||n.push(`..`):n.push(r));let r=n.join(`/`);return t?`/${r}`:r===``?`.`:r}var t=`/`,n=`:`;function r(t){let n=t.endsWith(`/`)&&t.length>1,r=e(t);return n&&r!==`/`?`${r}/`:r}function i(...t){let n=t.filter(e=>e!==``);return n.length===0?`.`:e(n.join(`/`))}function a(...t){let n=``;for(let e=t.length-1;e>=0&&!n.startsWith(`/`);e--){let r=t[e];r!==void 0&&r!==``&&(n=n===``?r:`${r}/${n}`)}return e(n.startsWith(`/`)?n:`/${n}`)}function o(e){return e.startsWith(`/`)}function s(t){let n=e(t),r=n.lastIndexOf(`/`);return r===-1?`.`:r===0?`/`:n.slice(0,r)}function c(e,t){let n=e.replace(/\/+$/,``).split(`/`).at(-1)??``;return t!==void 0&&n.endsWith(t)?n.slice(0,-t.length):n}function l(e){let t=c(e),n=t.lastIndexOf(`.`);return n<=0?``:t.slice(n)}function u(e,t){let n=a(e).split(`/`).filter(Boolean),r=a(t).split(`/`).filter(Boolean),i=0;for(;i<n.length&&i<r.length&&n[i]===r[i];)i++;return[...n.slice(i).map(()=>`..`),...r.slice(i)].join(`/`)}function d(e){let t=c(e),n=l(e);return{root:e.startsWith(`/`)?`/`:``,dir:s(e),base:t,ext:n,name:t.slice(0,t.length-n.length)}}function f(e){return e}var p={sep:t,delimiter:n,normalize:r,join:i,resolve:a,isAbsolute:o,dirname:s,basename:c,extname:l,relative:u,parse:d,toNamespacedPath:f},m={...p,posix:p,win32:p},h=`./src/generated/api`,g=4400;function _(e){return/^https?:\/\//i.test(e)}var v=2e3,y=5e3;function b(e){return e===void 0?{hosts:`loopback`,interval:v}:typeof e==`number`?{hosts:`all`,interval:e}:{hosts:e?`all`:`none`,interval:v}}function x(e,t){let{root:n}=t,r=_(e.spec.input)?e.spec.input:m.resolve(n,e.spec.input),i=_(r)?void 0:m.dirname(r),a=(e.spec.refs?.allowedDirectories??[n,...i===void 0?[]:[i]]).map(e=>m.resolve(n,e)),o=e.features?.reactQuery??!1,s=e.features?.query??(o===!1?!1:o===!0||{...o,framework:`react`}),c=e.features?.swr??!1,l=e.features?.validation??!1,u=e.features?.mocks??!1,d=e=>({queryMethods:(e===!0?void 0:e.queryMethods)??[`get`,`query`],infinite:(e===!0?void 0:e.infinite)??{},invalidates:(e===!0?void 0:e.invalidates)??{}});return{root:n,...t.configFile===void 0?{}:{configFile:t.configFile},spec:{version:e.spec.version,input:r,refs:{external:e.spec.refs?.external??`local`,allowedDirectories:[...new Set(a)],allowedHosts:e.spec.refs?.allowedHosts??[],maxDocuments:e.spec.refs?.maxDocuments??y},fetch:{headers:e.spec.fetch?.headers??{},timeout:e.spec.fetch?.timeout??3e4,maxBytes:e.spec.fetch?.maxBytes??52428800,poll:b(e.spec.fetch?.poll)},overlays:(e.spec.overlays??[]).map(e=>_(e)?e:m.resolve(n,e))},output:{directory:m.resolve(n,e.output?.directory??h),language:e.output?.language??`typescript`,moduleFormat:`esm`,clean:e.output?.clean??!0,declarations:e.output?.declarations??!0,importExtension:e.output?.importExtension??`.js`,barrel:e.output?.barrel??!0,groupBy:e.output?.groupBy??`tag`,models:e.output?.models??`all`,webhooks:e.output?.webhooks??!0,...e.output?.banner===void 0?{}:{banner:e.output.banner}},client:{adapter:e.client?.adapter??`fetch`,...e.client?.baseUrl===void 0?{}:{baseUrl:e.client.baseUrl},operationServers:e.client?.operationServers??!0,includeCredentials:e.client?.includeCredentials??!1,headers:e.client?.headers??{},...e.client?.timeout===void 0?{}:{timeout:e.client.timeout},responseStyle:e.client?.responseStyle??`data`},features:{jsdoc:e.features?.jsdoc??!0,query:s!==!1&&{framework:(s===!0?void 0:s.framework)??`react`,...d(s)},swr:c!==!1&&d(c),validation:l===!1?!1:typeof l==`string`?{library:l,response:!0,request:!1}:{library:l.library,response:l.response??!0,request:l.request??!1},mocks:u!==!1&&{library:u}},naming:{operations:e.naming?.operations??`camelCase`,models:e.naming?.models??`PascalCase`,files:e.naming?.files??`kebab-case`,parameters:e.naming?.parameters??`preserve`,inputSuffix:e.naming?.inputSuffix??`Input`},types:{enums:e.types?.enums??`union`,readonlyProperties:e.types?.readonlyProperties??!0,readWrite:e.types?.readWrite??`split`,dates:e.types?.dates??`string`},dashboard:{host:e.dashboard?.host??`127.0.0.1`,port:e.dashboard?.port??g,allowNetworkAccess:e.dashboard?.allowNetworkAccess??!1,usage:{include:e.dashboard?.usage?.include??[`src`],exclude:e.dashboard?.usage?.exclude??[]}},lint:{rules:e.lint?.rules??{}}}}var S=[`get`,`put`,`post`,`delete`,`options`,`head`,`patch`,`trace`,`query`];function C(e){return S.includes(e)}function ee(e){return C(e)?e.toUpperCase():e}var te=[{name:`operation-id`,severity:`warning`,summary:`An operation has no operationId: its function name is derived from the method and path and changes when the path does.`},{name:`operation-id-style`,severity:`info`,summary:`An operationId is not a valid identifier in the configured naming style, so the generated function has another name (searching for the operationId does not find it).`},{name:`operation-tags`,severity:`info`,summary:"An operation has no tags: it is generated into the `default` group."},{name:`undeclared-tag`,severity:`info`,summary:"A tag used by operations is not declared in the top-level `tags`, so it has no description for the group documentation."},{name:`operation-summary`,severity:`info`,summary:`An operation has neither a summary nor a description: its JSDoc only says which endpoint it calls.`},{name:`success-response`,severity:`warning`,summary:"An operation documents no 2xx (or default) response: the generated function resolves with `void` whatever the server returns."},{name:`response-schema`,severity:`warning`,summary:"A success response declares a media type without a schema: the generated function resolves with `unknown`."},{name:`inline-schema`,severity:`info`,summary:"A JSON request or response body is an inline object schema: its type is named after the operation (`AddPetBody`) and cannot be reused by other operations."},{name:`untyped-schema`,severity:`info`,summary:"A named schema has no type, properties or composition: it is generated as `unknown`."},{name:`duplicate-schema`,severity:`info`,summary:`Named schemas are structurally identical: the client contains duplicate types.`},{name:`unused-model`,severity:`info`,summary:"A named schema is not used by any operation: it is still generated unless `output.models` is `used`."},{name:`missing-servers`,severity:`info`,summary:"The specification declares no server: the generated client has no default base URL and needs `client.baseUrl` or `client.setConfig({ baseUrl })`."}],ne={"/assets/runtime/axios.d.ts":`import { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type { Transport } from './types.js';
/** Extra axios options accepted per request (\`transportOptions\`) and as client defaults. */
export type AxiosTransportOptions = Omit<AxiosRequestConfig, 'url' | 'method' | 'headers' | 'data' | 'signal'>;
/**
 * Creates a transport backed by axios. Pass your own instance to reuse its interceptors, base
 * URL and defaults. HTTP error responses become \`ApiError\`s with the \`AxiosError\` as \`cause\`.
 */
export declare function createAxiosTransport(instance?: AxiosInstance): Transport<AxiosTransportOptions>;
`,"/assets/runtime/axios.js":`import axios, {} from 'axios';
import { RequestError } from './errors.js';
import { isJsonMediaType, isTextMediaType, responseParseAs } from './serialization.js';
function toHeaders(source) {
    const headers = new Headers();
    if (typeof source !== 'object' || source === null)
        return headers;
    for (const [name, value] of Object.entries(source)) {
        if (value === undefined || value === null || typeof value === 'function')
            continue;
        try {
            if (Array.isArray(value))
                for (const item of value)
                    headers.append(name, String(item));
            else
                headers.set(name, String(value));
        }
        catch {
            // Skip header names that the Headers class rejects.
        }
    }
    return headers;
}
function toBytes(data) {
    if (data instanceof ArrayBuffer)
        return new Uint8Array(data);
    if (ArrayBuffer.isView(data))
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return undefined;
}
// The return type is inferred so the file also compiles on TypeScript versions before 5.7.
function copyBytes(bytes) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy;
}
/**
 * Reads a body requested as \`arraybuffer\` like the fetch transport reads a \`Response\`: by
 * \`parseAs\` for successful statuses, otherwise by \`Content-Type\` (JSON, text, or a \`Blob\`). Bytes
 * are decoded here because axios decodes \`blob\` responses as text in Node.js and would decode
 * binary \`auto\` responses as UTF-8 text.
 */
function readData(response, request, headers) {
    const { status, data } = response;
    const parseAs = responseParseAs(request.parseAs, status);
    if (parseAs === 'stream')
        return data;
    if (request.method === 'HEAD' || status === 204 || status === 205 || status === 304)
        return undefined;
    const bytes = toBytes(data);
    // Already decoded, e.g. by a \`responseType\` passed in \`transportOptions\`.
    if (bytes === undefined)
        return data;
    const contentType = headers.get('content-type');
    const blob = () => new Blob([copyBytes(bytes)], contentType === null ? {} : { type: contentType });
    if (parseAs === 'blob')
        return blob();
    if (parseAs === 'arrayBuffer')
        return copyBytes(bytes).buffer;
    const text = new TextDecoder().decode(bytes);
    if (parseAs === 'text')
        return text;
    if (parseAs === 'json' || isJsonMediaType(contentType)) {
        if (text.trim() === '')
            return undefined;
        try {
            return JSON.parse(text);
        }
        catch (error) {
            // Error bodies are best-effort: keep the text so ApiError still carries it.
            if (status < 200 || status >= 300)
                return text;
            throw new RequestError('parse', 'The response body is not valid JSON.', { operationId: request.operationId, method: request.method, url: request.url }, error);
        }
    }
    if (contentType === null || isTextMediaType(contentType))
        return text === '' && contentType === null ? undefined : text;
    return blob();
}
function fromAxiosResponse(response, request, error) {
    const headers = toHeaders(response.headers);
    const result = {
        status: response.status,
        statusText: response.statusText,
        headers,
        data: readData(response, request, headers),
        raw: response,
    };
    return error === undefined ? result : { ...result, error };
}
/**
 * Creates a transport backed by axios. Pass your own instance to reuse its interceptors, base
 * URL and defaults. HTTP error responses become \`ApiError\`s with the \`AxiosError\` as \`cause\`.
 */
export function createAxiosTransport(instance = axios) {
    return async (request) => {
        const entries = [];
        request.headers.forEach((value, name) => {
            entries.push([name, value]);
        });
        // Own properties for every name, including \`__proto__\`.
        const headers = Object.fromEntries(entries);
        const config = {
            url: request.url,
            method: request.method,
            headers,
            data: request.body,
        };
        // Bodies are read as bytes and decoded by \`readData\`; streams are passed through.
        config.responseType = request.parseAs === 'stream' ? 'stream' : 'arraybuffer';
        Object.assign(config, request.transportOptions);
        if (request.signal !== undefined)
            config.signal = request.signal;
        if (request.credentials === 'include')
            config.withCredentials = true;
        try {
            const response = await instance.request(config);
            return fromAxiosResponse(response, request);
        }
        catch (error) {
            // \`axios.isAxiosError\` (rather than the named export) works with every axios 1.x release.
            if (axios.isAxiosError(error)) {
                if (error.response !== undefined)
                    return fromAxiosResponse(error.response, request, error);
                if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                    throw new RequestError('timeout', error.message, { operationId: request.operationId, method: request.method, url: request.url }, error);
                }
            }
            throw error;
        }
    };
}
`,"/assets/runtime/axios.ts":`import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { RequestError } from './errors.js';
import { isJsonMediaType, isTextMediaType, responseParseAs } from './serialization.js';
import type { Transport, TransportRequest, TransportResponse } from './types.js';

/** Extra axios options accepted per request (\`transportOptions\`) and as client defaults. */
export type AxiosTransportOptions = Omit<
  AxiosRequestConfig,
  'url' | 'method' | 'headers' | 'data' | 'signal'
>;

function toHeaders(source: unknown): Headers {
  const headers = new Headers();
  if (typeof source !== 'object' || source === null) return headers;
  for (const [name, value] of Object.entries(source)) {
    if (value === undefined || value === null || typeof value === 'function') continue;
    try {
      if (Array.isArray(value)) for (const item of value) headers.append(name, String(item));
      else headers.set(name, String(value));
    } catch {
      // Skip header names that the Headers class rejects.
    }
  }
  return headers;
}

function toBytes(data: unknown): Uint8Array | undefined {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data))
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return undefined;
}

// The return type is inferred so the file also compiles on TypeScript versions before 5.7.
function copyBytes(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

/**
 * Reads a body requested as \`arraybuffer\` like the fetch transport reads a \`Response\`: by
 * \`parseAs\` for successful statuses, otherwise by \`Content-Type\` (JSON, text, or a \`Blob\`). Bytes
 * are decoded here because axios decodes \`blob\` responses as text in Node.js and would decode
 * binary \`auto\` responses as UTF-8 text.
 */
function readData(
  response: AxiosResponse<unknown>,
  request: TransportRequest<AxiosTransportOptions>,
  headers: Headers,
): unknown {
  const { status, data } = response;
  const parseAs = responseParseAs(request.parseAs, status);
  if (parseAs === 'stream') return data;
  if (request.method === 'HEAD' || status === 204 || status === 205 || status === 304)
    return undefined;
  const bytes = toBytes(data);
  // Already decoded, e.g. by a \`responseType\` passed in \`transportOptions\`.
  if (bytes === undefined) return data;
  const contentType = headers.get('content-type');
  const blob = (): Blob =>
    new Blob([copyBytes(bytes)], contentType === null ? {} : { type: contentType });
  if (parseAs === 'blob') return blob();
  if (parseAs === 'arrayBuffer') return copyBytes(bytes).buffer;
  const text = new TextDecoder().decode(bytes);
  if (parseAs === 'text') return text;
  if (parseAs === 'json' || isJsonMediaType(contentType)) {
    if (text.trim() === '') return undefined;
    try {
      return JSON.parse(text) as unknown;
    } catch (error) {
      // Error bodies are best-effort: keep the text so ApiError still carries it.
      if (status < 200 || status >= 300) return text;
      throw new RequestError(
        'parse',
        'The response body is not valid JSON.',
        { operationId: request.operationId, method: request.method, url: request.url },
        error,
      );
    }
  }
  if (contentType === null || isTextMediaType(contentType))
    return text === '' && contentType === null ? undefined : text;
  return blob();
}

function fromAxiosResponse(
  response: AxiosResponse<unknown>,
  request: TransportRequest<AxiosTransportOptions>,
  error?: unknown,
): TransportResponse {
  const headers = toHeaders(response.headers);
  const result = {
    status: response.status,
    statusText: response.statusText,
    headers,
    data: readData(response, request, headers),
    raw: response,
  };
  return error === undefined ? result : { ...result, error };
}

/**
 * Creates a transport backed by axios. Pass your own instance to reuse its interceptors, base
 * URL and defaults. HTTP error responses become \`ApiError\`s with the \`AxiosError\` as \`cause\`.
 */
export function createAxiosTransport(
  instance: AxiosInstance = axios,
): Transport<AxiosTransportOptions> {
  return async (request: TransportRequest<AxiosTransportOptions>) => {
    const entries: [string, string][] = [];
    request.headers.forEach((value, name) => {
      entries.push([name, value]);
    });
    // Own properties for every name, including \`__proto__\`.
    const headers: Record<string, string> = Object.fromEntries(entries);
    const config: AxiosRequestConfig = {
      url: request.url,
      method: request.method,
      headers,
      data: request.body,
    };
    // Bodies are read as bytes and decoded by \`readData\`; streams are passed through.
    config.responseType = request.parseAs === 'stream' ? 'stream' : 'arraybuffer';
    Object.assign(config, request.transportOptions);
    if (request.signal !== undefined) config.signal = request.signal;
    if (request.credentials === 'include') config.withCredentials = true;
    try {
      const response = await instance.request<unknown>(config);
      return fromAxiosResponse(response, request);
    } catch (error) {
      // \`axios.isAxiosError\` (rather than the named export) works with every axios 1.x release.
      if (axios.isAxiosError(error)) {
        if (error.response !== undefined) return fromAxiosResponse(error.response, request, error);
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          throw new RequestError(
            'timeout',
            error.message,
            { operationId: request.operationId, method: request.method, url: request.url },
            error,
          );
        }
      }
      throw error;
    }
  };
}
`,"/assets/runtime/client.d.ts":`import type { Client, ClientConfig } from './types.js';
/** Creates a client. Generated code creates one default client; create more for multi-tenant use. */
export declare function createClient<TTransportOptions = unknown>(initialConfig: ClientConfig<TTransportOptions>): Client<TTransportOptions>;
`,"/assets/runtime/client.js":`import { ApiError, RequestError } from './errors.js';
import { interpolatePath, joinUrl, serializeBody, serializeCookies, serializeHeader, serializeQuery, serializeQuerystring, } from './serialization.js';
import { linkSignal } from './signal.js';
function setHeaders(headers, values) {
    if (values === undefined)
        return;
    for (const name of Object.keys(values)) {
        const value = values[name];
        if (value === undefined)
            headers.delete(name);
        else
            headers.set(name, value);
    }
}
function appendCookie(headers, cookie) {
    if (cookie === '')
        return;
    const existing = headers.get('cookie');
    headers.set('cookie', existing === null || existing === '' ? cookie : \`\${existing}; \${cookie}\`);
}
function base64(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (const byte of bytes)
        binary += String.fromCharCode(byte);
    return btoa(binary);
}
async function resolveAuth(value) {
    return typeof value === 'function' ? await value() : value;
}
function applyScheme(scheme, value, headers, query) {
    if (scheme === undefined)
        return;
    switch (scheme.type) {
        case 'apiKey':
            if (scheme.in === 'header')
                headers.set(scheme.name, value);
            else if (scheme.in === 'query')
                query[scheme.name] = value;
            else
                appendCookie(headers, \`\${scheme.name}=\${encodeURIComponent(value)}\`);
            return;
        case 'http': {
            const name = scheme.scheme.toLowerCase();
            if (name === 'basic') {
                headers.set('authorization', /^basic /i.test(value) ? value : \`Basic \${base64(value)}\`);
            }
            else if (name === 'bearer') {
                headers.set('authorization', /^bearer /i.test(value) ? value : \`Bearer \${value}\`);
            }
            else {
                headers.set('authorization', \`\${scheme.scheme.charAt(0).toUpperCase()}\${scheme.scheme.slice(1)} \${value}\`);
            }
            return;
        }
        case 'oauth2':
        case 'openIdConnect':
            headers.set('authorization', /^bearer /i.test(value) ? value : \`Bearer \${value}\`);
            return;
    }
}
/**
 * Applies the first security requirement whose credentials are all configured. Requirements are
 * alternatives; schemes inside one requirement are applied together. Without \`queryAllowed\` (the
 * query string is a JSON or text document), requirements with query API keys are skipped.
 */
async function applySecurity(security, config, headers, query, queryAllowed) {
    if (security === undefined || config.auth === undefined)
        return;
    const auth = config.auth;
    const inQuery = (key) => {
        const scheme = config.securitySchemes?.[key];
        return scheme?.type === 'apiKey' && scheme.in === 'query';
    };
    for (const requirement of security) {
        if (requirement.length === 0 || (!queryAllowed && requirement.some(inQuery)))
            continue;
        const values = await Promise.all(requirement.map((key) => resolveAuth(auth[key])));
        if (values.every((value) => value !== undefined && value !== '')) {
            requirement.forEach((key, index) => {
                applyScheme(config.securitySchemes?.[key], values[index] ?? '', headers, query);
            });
            return;
        }
    }
}
/** 2xx statuses, plus declared statuses (\`304\`) and ranges (\`3XX\`) the operation resolves with. */
/**
 * A copy of the plain objects in a request body (also inside arrays) without the properties whose
 * value is \`undefined\`: \`JSON.stringify\` drops them, so validation sees what is sent and an optional
 * property set to \`undefined\` is accepted. Other objects (\`Date\`, \`Blob\`, …) are kept as they are.
 */
function withoutUndefined(value) {
    if (Array.isArray(value))
        return value.map(withoutUndefined);
    if (typeof value !== 'object' || value === null)
        return value;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
        return value;
    const result = {};
    for (const [key, entry] of Object.entries(value)) {
        if (entry === undefined)
            continue;
        // \`defineProperty\`, so a key named \`__proto__\` stays a property.
        Object.defineProperty(result, key, {
            value: withoutUndefined(entry),
            writable: true,
            enumerable: true,
            configurable: true,
        });
    }
    return result;
}
function isSuccess(status, declared) {
    if (status >= 200 && status < 300)
        return true;
    if (declared === undefined)
        return false;
    const code = String(status);
    return declared.some((entry) => entry.endsWith('XX') ? entry.charAt(0) === code.charAt(0) : entry === code);
}
function mergeTransportOptions(base, override) {
    if (base === undefined)
        return override;
    if (override === undefined)
        return base;
    if (typeof base === 'object' &&
        base !== null &&
        typeof override === 'object' &&
        override !== null) {
        return { ...base, ...override };
    }
    return override;
}
/** The value \`context.retry()\` returns; only its identity matters. */
const RETRY = {};
const retry = () => RETRY;
const isRetry = (value) => value === RETRY;
/** Creates a client. Generated code creates one default client; create more for multi-tenant use. */
export function createClient(initialConfig) {
    let config = { ...initialConfig };
    const middleware = [];
    async function send(operation, options = {}) {
        // One object per call: middleware may key per-call state on it across retries.
        const info = {
            operationId: operation.operationId,
            method: operation.method,
            path: operation.path,
            ...(operation.security === undefined ? {} : { security: operation.security }),
        };
        const context = {
            operationId: operation.operationId,
            method: operation.method,
            url: operation.path,
        };
        let bodyValue = operation.body;
        // Encode first (e.g. \`Date\` values to strings) so validation sees the wire format.
        if (operation.encodeBody !== undefined && bodyValue !== undefined)
            bodyValue = operation.encodeBody(bodyValue);
        if (operation.validateBody !== undefined && bodyValue !== undefined) {
            try {
                bodyValue = operation.validateBody(withoutUndefined(bodyValue));
            }
            catch (error) {
                throw new RequestError('validation', \`Request body validation failed: \${error instanceof Error ? error.message : String(error)}\`, context, error);
            }
        }
        const serialize = (build) => {
            try {
                return build();
            }
            catch (error) {
                throw new RequestError('serialization', \`Could not serialize the request: \${error instanceof Error ? error.message : String(error)}\`, context, error);
            }
        };
        const serialized = serialize(() => serializeBody(bodyValue, operation.mediaType, operation.encoding));
        const path = serialize(() => interpolatePath(operation.path, operation.pathParams, operation.styles?.path));
        // The timeout covers the whole call, including retries and the waits between them.
        const timeout = options.timeout ?? config.timeout;
        const linked = linkSignal(options.signal, timeout);
        /** URL of the latest attempt, for errors raised between attempts. */
        let lastUrl = operation.path;
        /** Builds the request of one attempt from the current config (credentials may change). */
        const prepare = async (attempt) => {
            const current = config;
            const query = { ...operation.query };
            const headers = new Headers();
            setHeaders(headers, typeof current.headers === 'function' ? await current.headers() : current.headers);
            if (operation.accept !== undefined && !headers.has('accept'))
                headers.set('accept', operation.accept);
            // \`Headers\` rejects values that are not byte strings (e.g. \`naïve ✓\`).
            serialize(() => {
                const headerParams = operation.headers ?? {};
                for (const name of Object.keys(headerParams)) {
                    const value = headerParams[name];
                    if (value !== undefined && value !== null)
                        headers.set(name, serializeHeader(value, operation.styles?.header?.[name]));
                }
                appendCookie(headers, serializeCookies(operation.cookies, operation.styles?.cookie));
            });
            // A JSON or text query string has no room for \`name=value\` credentials.
            const querystringType = operation.querystring?.mediaType.split(';')[0]?.trim().toLowerCase();
            const queryAllowed = querystringType === undefined || querystringType === 'application/x-www-form-urlencoded';
            await applySecurity(operation.security, current, headers, query, queryAllowed);
            if (serialized.contentType !== undefined)
                headers.set('content-type', serialized.contentType);
            const baseUrl = options.baseUrl ??
                (operation.server !== undefined && current.operationServers !== false
                    ? operation.server
                    : current.baseUrl);
            const url = serialize(() => {
                const querystring = operation.querystring === undefined
                    ? ''
                    : serializeQuerystring(operation.querystring.value, operation.querystring.mediaType, operation.querystring.encoding);
                const rest = serializeQuery(query, operation.styles?.query);
                return joinUrl(baseUrl, path, [querystring, rest].filter((part) => part !== '').join('&'));
            });
            setHeaders(headers, options.headers);
            let request = {
                operationId: operation.operationId,
                method: operation.method,
                url,
                headers,
                body: serialized.body,
                signal: linked.signal,
                credentials: current.credentials,
                parseAs: options.parseAs ?? operation.parseAs ?? 'auto',
                transportOptions: mergeTransportOptions(current.transportOptions, options.transportOptions),
            };
            for (const item of middleware.slice()) {
                const replaced = await item.onRequest?.({ request, operation: info, attempt, client });
                if (replaced !== undefined)
                    request = replaced;
            }
            return request;
        };
        /** Sends one attempt: the response after middleware, or \`RETRY\`. */
        const attemptOnce = async (attempt) => {
            const request = await prepare(attempt);
            lastUrl = request.url;
            const errorContext = { ...context, url: request.url };
            const base = { request, operation: info, attempt, client, retry };
            let response;
            try {
                response = await config.transport(request);
            }
            catch (error) {
                let recovered = undefined;
                for (const item of middleware.slice()) {
                    recovered = await item.onError?.({ ...base, error });
                    if (recovered !== undefined)
                        break;
                }
                if (isRetry(recovered))
                    return { request, response: RETRY };
                if (recovered === undefined) {
                    if (error instanceof ApiError || error instanceof RequestError)
                        throw error;
                    if (linked.timedOut()) {
                        throw new RequestError('timeout', \`Request timed out after \${String(timeout)} ms\`, errorContext, error);
                    }
                    if (options.signal?.aborted === true)
                        throw error;
                    throw new RequestError('network', \`Request failed: \${error instanceof Error ? error.message : String(error)}\`, errorContext, error);
                }
                response = recovered;
            }
            for (const item of middleware.slice()) {
                const replaced = await item.onResponse?.({ ...base, response });
                if (isRetry(replaced))
                    return { request, response: RETRY };
                if (replaced !== undefined)
                    response = replaced;
            }
            return { request, response };
        };
        try {
            let request;
            let response;
            for (let attempt = 1;; attempt++) {
                let outcome;
                try {
                    outcome = await attemptOnce(attempt);
                }
                catch (error) {
                    // Middleware waiting between attempts rejects with the abort reason.
                    if (linked.timedOut() && !(error instanceof RequestError)) {
                        throw new RequestError('timeout', \`Request timed out after \${String(timeout)} ms\`, { ...context, url: lastUrl }, error);
                    }
                    throw error;
                }
                if (!isRetry(outcome.response)) {
                    request = outcome.request;
                    response = outcome.response;
                    break;
                }
            }
            const errorContext = { ...context, url: request.url };
            if (!isSuccess(response.status, operation.successStatuses)) {
                throw new ApiError({
                    ...errorContext,
                    status: response.status,
                    statusText: response.statusText,
                    body: response.data,
                    headers: response.headers,
                    response: response.raw,
                    cause: response.error,
                });
            }
            let data = response.data;
            if (operation.validateResponse !== undefined) {
                try {
                    data = operation.validateResponse(data);
                }
                catch (error) {
                    throw new RequestError('validation', \`Response validation failed: \${error instanceof Error ? error.message : String(error)}\`, errorContext, error);
                }
            }
            if (operation.transformResponse !== undefined)
                data = operation.transformResponse(data);
            const result = {
                data,
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                raw: response.raw,
            };
            // The response shape is asserted from the API description; it is validated only when
            // runtime validation is generated.
            return result;
        }
        finally {
            linked.dispose();
        }
    }
    const client = {
        getConfig: () => ({ ...config }),
        setConfig(patch) {
            config = { ...config, ...patch };
        },
        use(item) {
            middleware.push(item);
            return () => {
                const index = middleware.indexOf(item);
                if (index !== -1)
                    middleware.splice(index, 1);
            };
        },
        send,
        async request(operation, options) {
            const response = await send(operation, options);
            return response.data;
        },
    };
    return client;
}
`,"/assets/runtime/client.ts":`import { ApiError, RequestError } from './errors.js';
import {
  interpolatePath,
  joinUrl,
  serializeBody,
  serializeCookies,
  serializeHeader,
  serializeQuery,
  serializeQuerystring,
} from './serialization.js';
import { linkSignal } from './signal.js';
import type {
  ApiResponse,
  AuthValue,
  Client,
  ClientConfig,
  HeaderValues,
  Middleware,
  OperationInfo,
  OperationRequest,
  RequestOptions,
  RetryDirective,
  SecurityScheme,
  TransportRequest,
  TransportResponse,
} from './types.js';

function setHeaders(headers: Headers, values: HeaderValues | undefined): void {
  if (values === undefined) return;
  for (const name of Object.keys(values)) {
    const value = values[name];
    if (value === undefined) headers.delete(name);
    else headers.set(name, value);
  }
}

function appendCookie(headers: Headers, cookie: string): void {
  if (cookie === '') return;
  const existing = headers.get('cookie');
  headers.set('cookie', existing === null || existing === '' ? cookie : \`\${existing}; \${cookie}\`);
}

function base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function resolveAuth(value: AuthValue): Promise<string | undefined> {
  return typeof value === 'function' ? await value() : value;
}

function applyScheme(
  scheme: SecurityScheme | undefined,
  value: string,
  headers: Headers,
  query: Record<string, unknown>,
): void {
  if (scheme === undefined) return;
  switch (scheme.type) {
    case 'apiKey':
      if (scheme.in === 'header') headers.set(scheme.name, value);
      else if (scheme.in === 'query') query[scheme.name] = value;
      else appendCookie(headers, \`\${scheme.name}=\${encodeURIComponent(value)}\`);
      return;
    case 'http': {
      const name = scheme.scheme.toLowerCase();
      if (name === 'basic') {
        headers.set('authorization', /^basic /i.test(value) ? value : \`Basic \${base64(value)}\`);
      } else if (name === 'bearer') {
        headers.set('authorization', /^bearer /i.test(value) ? value : \`Bearer \${value}\`);
      } else {
        headers.set(
          'authorization',
          \`\${scheme.scheme.charAt(0).toUpperCase()}\${scheme.scheme.slice(1)} \${value}\`,
        );
      }
      return;
    }
    case 'oauth2':
    case 'openIdConnect':
      headers.set('authorization', /^bearer /i.test(value) ? value : \`Bearer \${value}\`);
      return;
  }
}

/**
 * Applies the first security requirement whose credentials are all configured. Requirements are
 * alternatives; schemes inside one requirement are applied together. Without \`queryAllowed\` (the
 * query string is a JSON or text document), requirements with query API keys are skipped.
 */
async function applySecurity<T>(
  security: OperationRequest['security'],
  config: ClientConfig<T>,
  headers: Headers,
  query: Record<string, unknown>,
  queryAllowed: boolean,
): Promise<void> {
  if (security === undefined || config.auth === undefined) return;
  const auth = config.auth;
  const inQuery = (key: string): boolean => {
    const scheme = config.securitySchemes?.[key];
    return scheme?.type === 'apiKey' && scheme.in === 'query';
  };
  for (const requirement of security) {
    if (requirement.length === 0 || (!queryAllowed && requirement.some(inQuery))) continue;
    const values = await Promise.all(requirement.map((key) => resolveAuth(auth[key])));
    if (values.every((value) => value !== undefined && value !== '')) {
      requirement.forEach((key, index) => {
        applyScheme(config.securitySchemes?.[key], values[index] ?? '', headers, query);
      });
      return;
    }
  }
}

/** 2xx statuses, plus declared statuses (\`304\`) and ranges (\`3XX\`) the operation resolves with. */
/**
 * A copy of the plain objects in a request body (also inside arrays) without the properties whose
 * value is \`undefined\`: \`JSON.stringify\` drops them, so validation sees what is sent and an optional
 * property set to \`undefined\` is accepted. Other objects (\`Date\`, \`Blob\`, …) are kept as they are.
 */
function withoutUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutUndefined);
  if (typeof value !== 'object' || value === null) return value;
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    // \`defineProperty\`, so a key named \`__proto__\` stays a property.
    Object.defineProperty(result, key, {
      value: withoutUndefined(entry),
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  return result;
}

function isSuccess(status: number, declared: readonly string[] | undefined): boolean {
  if (status >= 200 && status < 300) return true;
  if (declared === undefined) return false;
  const code = String(status);
  return declared.some((entry) =>
    entry.endsWith('XX') ? entry.charAt(0) === code.charAt(0) : entry === code,
  );
}

function mergeTransportOptions<T>(base: T | undefined, override: T | undefined): T | undefined {
  if (base === undefined) return override;
  if (override === undefined) return base;
  if (
    typeof base === 'object' &&
    base !== null &&
    typeof override === 'object' &&
    override !== null
  ) {
    return { ...base, ...override };
  }
  return override;
}

/** The value \`context.retry()\` returns; only its identity matters. */
const RETRY = {} as RetryDirective;
const retry = (): RetryDirective => RETRY;
const isRetry = (value: unknown): value is RetryDirective => value === RETRY;

/** Creates a client. Generated code creates one default client; create more for multi-tenant use. */
export function createClient<TTransportOptions = unknown>(
  initialConfig: ClientConfig<TTransportOptions>,
): Client<TTransportOptions> {
  let config: ClientConfig<TTransportOptions> = { ...initialConfig };
  const middleware: Middleware<TTransportOptions>[] = [];

  async function send<TResponse extends ApiResponse<unknown>>(
    operation: OperationRequest,
    options: RequestOptions<TTransportOptions> = {},
  ): Promise<TResponse> {
    // One object per call: middleware may key per-call state on it across retries.
    const info: OperationInfo = {
      operationId: operation.operationId,
      method: operation.method,
      path: operation.path,
      ...(operation.security === undefined ? {} : { security: operation.security }),
    };
    const context = {
      operationId: operation.operationId,
      method: operation.method,
      url: operation.path,
    };

    let bodyValue = operation.body;
    // Encode first (e.g. \`Date\` values to strings) so validation sees the wire format.
    if (operation.encodeBody !== undefined && bodyValue !== undefined)
      bodyValue = operation.encodeBody(bodyValue);
    if (operation.validateBody !== undefined && bodyValue !== undefined) {
      try {
        bodyValue = operation.validateBody(withoutUndefined(bodyValue));
      } catch (error) {
        throw new RequestError(
          'validation',
          \`Request body validation failed: \${error instanceof Error ? error.message : String(error)}\`,
          context,
          error,
        );
      }
    }
    const serialize = <T>(build: () => T): T => {
      try {
        return build();
      } catch (error) {
        throw new RequestError(
          'serialization',
          \`Could not serialize the request: \${error instanceof Error ? error.message : String(error)}\`,
          context,
          error,
        );
      }
    };
    const serialized = serialize(() =>
      serializeBody(bodyValue, operation.mediaType, operation.encoding),
    );
    const path = serialize(() =>
      interpolatePath(operation.path, operation.pathParams, operation.styles?.path),
    );

    // The timeout covers the whole call, including retries and the waits between them.
    const timeout = options.timeout ?? config.timeout;
    const linked = linkSignal(options.signal, timeout);
    /** URL of the latest attempt, for errors raised between attempts. */
    let lastUrl = operation.path;

    /** Builds the request of one attempt from the current config (credentials may change). */
    const prepare = async (attempt: number): Promise<TransportRequest<TTransportOptions>> => {
      const current = config;
      const query: Record<string, unknown> = { ...operation.query };
      const headers = new Headers();
      setHeaders(
        headers,
        typeof current.headers === 'function' ? await current.headers() : current.headers,
      );
      if (operation.accept !== undefined && !headers.has('accept'))
        headers.set('accept', operation.accept);
      // \`Headers\` rejects values that are not byte strings (e.g. \`naïve ✓\`).
      serialize(() => {
        const headerParams = operation.headers ?? {};
        for (const name of Object.keys(headerParams)) {
          const value = headerParams[name];
          if (value !== undefined && value !== null)
            headers.set(name, serializeHeader(value, operation.styles?.header?.[name]));
        }
        appendCookie(headers, serializeCookies(operation.cookies, operation.styles?.cookie));
      });
      // A JSON or text query string has no room for \`name=value\` credentials.
      const querystringType = operation.querystring?.mediaType.split(';')[0]?.trim().toLowerCase();
      const queryAllowed =
        querystringType === undefined || querystringType === 'application/x-www-form-urlencoded';
      await applySecurity(operation.security, current, headers, query, queryAllowed);
      if (serialized.contentType !== undefined) headers.set('content-type', serialized.contentType);
      const baseUrl =
        options.baseUrl ??
        (operation.server !== undefined && current.operationServers !== false
          ? operation.server
          : current.baseUrl);
      const url = serialize(() => {
        const querystring =
          operation.querystring === undefined
            ? ''
            : serializeQuerystring(
                operation.querystring.value,
                operation.querystring.mediaType,
                operation.querystring.encoding,
              );
        const rest = serializeQuery(query, operation.styles?.query);
        return joinUrl(baseUrl, path, [querystring, rest].filter((part) => part !== '').join('&'));
      });
      setHeaders(headers, options.headers);
      let request: TransportRequest<TTransportOptions> = {
        operationId: operation.operationId,
        method: operation.method,
        url,
        headers,
        body: serialized.body,
        signal: linked.signal,
        credentials: current.credentials,
        parseAs: options.parseAs ?? operation.parseAs ?? 'auto',
        transportOptions: mergeTransportOptions(current.transportOptions, options.transportOptions),
      };
      for (const item of middleware.slice()) {
        const replaced = await item.onRequest?.({ request, operation: info, attempt, client });
        if (replaced !== undefined) request = replaced;
      }
      return request;
    };

    /** Sends one attempt: the response after middleware, or \`RETRY\`. */
    const attemptOnce = async (
      attempt: number,
    ): Promise<{
      request: TransportRequest<TTransportOptions>;
      response: TransportResponse | RetryDirective;
    }> => {
      const request = await prepare(attempt);
      lastUrl = request.url;
      const errorContext = { ...context, url: request.url };
      const base = { request, operation: info, attempt, client, retry };
      let response: TransportResponse;
      try {
        response = await config.transport(request);
      } catch (error) {
        let recovered: TransportResponse | RetryDirective | void = undefined;
        for (const item of middleware.slice()) {
          recovered = await item.onError?.({ ...base, error });
          if (recovered !== undefined) break;
        }
        if (isRetry(recovered)) return { request, response: RETRY };
        if (recovered === undefined) {
          if (error instanceof ApiError || error instanceof RequestError) throw error;
          if (linked.timedOut()) {
            throw new RequestError(
              'timeout',
              \`Request timed out after \${String(timeout)} ms\`,
              errorContext,
              error,
            );
          }
          if (options.signal?.aborted === true) throw error;
          throw new RequestError(
            'network',
            \`Request failed: \${error instanceof Error ? error.message : String(error)}\`,
            errorContext,
            error,
          );
        }
        response = recovered;
      }
      for (const item of middleware.slice()) {
        const replaced = await item.onResponse?.({ ...base, response });
        if (isRetry(replaced)) return { request, response: RETRY };
        if (replaced !== undefined) response = replaced;
      }
      return { request, response };
    };

    try {
      let request: TransportRequest<TTransportOptions>;
      let response: TransportResponse;
      for (let attempt = 1; ; attempt++) {
        let outcome: Awaited<ReturnType<typeof attemptOnce>>;
        try {
          outcome = await attemptOnce(attempt);
        } catch (error) {
          // Middleware waiting between attempts rejects with the abort reason.
          if (linked.timedOut() && !(error instanceof RequestError)) {
            throw new RequestError(
              'timeout',
              \`Request timed out after \${String(timeout)} ms\`,
              { ...context, url: lastUrl },
              error,
            );
          }
          throw error;
        }
        if (!isRetry(outcome.response)) {
          request = outcome.request;
          response = outcome.response;
          break;
        }
      }
      const errorContext = { ...context, url: request.url };

      if (!isSuccess(response.status, operation.successStatuses)) {
        throw new ApiError({
          ...errorContext,
          status: response.status,
          statusText: response.statusText,
          body: response.data,
          headers: response.headers,
          response: response.raw,
          cause: response.error,
        });
      }

      let data = response.data;
      if (operation.validateResponse !== undefined) {
        try {
          data = operation.validateResponse(data);
        } catch (error) {
          throw new RequestError(
            'validation',
            \`Response validation failed: \${error instanceof Error ? error.message : String(error)}\`,
            errorContext,
            error,
          );
        }
      }
      if (operation.transformResponse !== undefined) data = operation.transformResponse(data);
      const result: ApiResponse<unknown> = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        raw: response.raw,
      };
      // The response shape is asserted from the API description; it is validated only when
      // runtime validation is generated.
      return result as TResponse;
    } finally {
      linked.dispose();
    }
  }

  const client: Client<TTransportOptions> = {
    getConfig: () => ({ ...config }),
    setConfig(patch) {
      config = { ...config, ...patch };
    },
    use(item) {
      middleware.push(item);
      return () => {
        const index = middleware.indexOf(item);
        if (index !== -1) middleware.splice(index, 1);
      };
    },
    send,
    async request<TData>(
      operation: OperationRequest,
      options?: RequestOptions<TTransportOptions>,
    ): Promise<TData> {
      const response = await send<ApiResponse<TData>>(operation, options);
      return response.data;
    },
  };
  return client;
}
`,"/assets/runtime/dates.d.ts":`/**
 * Where \`date\` and \`date-time\` values sit inside a value. Generated per model (only for models
 * that contain dates); references to other models are functions so recursive and mutually
 * dependent models resolve lazily.
 */
export type DateShape = 'date' | 'date-time' | (() => DateShape) | {
    readonly array: DateShape;
} | {
    readonly tuple: readonly (DateShape | null)[];
    readonly rest?: DateShape;
} | {
    readonly object: Readonly<Record<string, DateShape>>;
    readonly rest?: DateShape;
} | {
    readonly anyOf: readonly DateShape[];
} | {
    readonly discriminator: string;
    readonly mapping: Readonly<Record<string, DateShape>>;
};
/** Converts \`date\`/\`date-time\` strings of response data to \`Date\` objects (in place). */
export declare function reviveDates(value: unknown, shape: DateShape): unknown;
/**
 * Converts \`Date\` values to their wire form: \`YYYY-MM-DD\` for \`date\` and ISO 8601 for
 * \`date-time\`. Returns a copy; the input is not modified.
 */
export declare function encodeDates(value: unknown, shape: DateShape): unknown;
`,"/assets/runtime/dates.js":`function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function leaf(value, format, mode) {
    if (mode === 'revive') {
        if (typeof value !== 'string')
            return value;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? value : date;
    }
    if (!(value instanceof Date) || Number.isNaN(value.getTime()))
        return value;
    const iso = value.toISOString();
    // Dates are calendar days at UTC midnight (as \`new Date('2026-01-31')\` creates them).
    return format === 'date' ? iso.slice(0, 10) : iso;
}
function walk(value, shape, mode) {
    if (value === null || value === undefined)
        return value;
    if (typeof shape === 'function')
        return walk(value, shape(), mode);
    if (shape === 'date' || shape === 'date-time')
        return leaf(value, shape, mode);
    if ('array' in shape) {
        if (!Array.isArray(value))
            return value;
        const items = value;
        return items.map((item) => walk(item, shape.array, mode));
    }
    if ('tuple' in shape) {
        if (!Array.isArray(value))
            return value;
        const items = value;
        return items.map((item, index) => {
            const itemShape = index < shape.tuple.length ? shape.tuple[index] : shape.rest;
            return itemShape === null || itemShape === undefined ? item : walk(item, itemShape, mode);
        });
    }
    if ('object' in shape) {
        if (!isObject(value))
            return value;
        // Revive mutates freshly parsed data; encode copies so callers' objects stay untouched.
        const target = mode === 'revive' ? value : { ...value };
        for (const key of Object.keys(target)) {
            const fieldShape = Object.prototype.hasOwnProperty.call(shape.object, key)
                ? shape.object[key]
                : shape.rest;
            if (fieldShape !== undefined)
                target[key] = walk(target[key], fieldShape, mode);
        }
        return target;
    }
    if ('discriminator' in shape) {
        if (!isObject(value))
            return value;
        const tag = value[shape.discriminator];
        // Own properties only: a tag such as \`__proto__\` must not reach \`Object.prototype\`.
        const variant = typeof tag === 'string' && Object.prototype.hasOwnProperty.call(shape.mapping, tag)
            ? shape.mapping[tag]
            : undefined;
        return variant === undefined ? value : walk(value, variant, mode);
    }
    // Without a discriminator, every variant's dates are converted.
    let result = value;
    for (const variant of shape.anyOf)
        result = walk(result, variant, mode);
    return result;
}
/** Converts \`date\`/\`date-time\` strings of response data to \`Date\` objects (in place). */
export function reviveDates(value, shape) {
    return walk(value, shape, 'revive');
}
/**
 * Converts \`Date\` values to their wire form: \`YYYY-MM-DD\` for \`date\` and ISO 8601 for
 * \`date-time\`. Returns a copy; the input is not modified.
 */
export function encodeDates(value, shape) {
    return walk(value, shape, 'encode');
}
`,"/assets/runtime/dates.ts":`/**
 * Where \`date\` and \`date-time\` values sit inside a value. Generated per model (only for models
 * that contain dates); references to other models are functions so recursive and mutually
 * dependent models resolve lazily.
 */
export type DateShape =
  | 'date'
  | 'date-time'
  | (() => DateShape)
  | { readonly array: DateShape }
  | { readonly tuple: readonly (DateShape | null)[]; readonly rest?: DateShape }
  | { readonly object: Readonly<Record<string, DateShape>>; readonly rest?: DateShape }
  | { readonly anyOf: readonly DateShape[] }
  | { readonly discriminator: string; readonly mapping: Readonly<Record<string, DateShape>> };

type Mode = 'revive' | 'encode';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function leaf(value: unknown, format: 'date' | 'date-time', mode: Mode): unknown {
  if (mode === 'revive') {
    if (typeof value !== 'string') return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date;
  }
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return value;
  const iso = value.toISOString();
  // Dates are calendar days at UTC midnight (as \`new Date('2026-01-31')\` creates them).
  return format === 'date' ? iso.slice(0, 10) : iso;
}

function walk(value: unknown, shape: DateShape, mode: Mode): unknown {
  if (value === null || value === undefined) return value;
  if (typeof shape === 'function') return walk(value, shape(), mode);
  if (shape === 'date' || shape === 'date-time') return leaf(value, shape, mode);
  if ('array' in shape) {
    if (!Array.isArray(value)) return value;
    const items: readonly unknown[] = value;
    return items.map((item) => walk(item, shape.array, mode));
  }
  if ('tuple' in shape) {
    if (!Array.isArray(value)) return value;
    const items: readonly unknown[] = value;
    return items.map((item, index) => {
      const itemShape = index < shape.tuple.length ? shape.tuple[index] : shape.rest;
      return itemShape === null || itemShape === undefined ? item : walk(item, itemShape, mode);
    });
  }
  if ('object' in shape) {
    if (!isObject(value)) return value;
    // Revive mutates freshly parsed data; encode copies so callers' objects stay untouched.
    const target = mode === 'revive' ? value : { ...value };
    for (const key of Object.keys(target)) {
      const fieldShape = Object.prototype.hasOwnProperty.call(shape.object, key)
        ? shape.object[key]
        : shape.rest;
      if (fieldShape !== undefined) target[key] = walk(target[key], fieldShape, mode);
    }
    return target;
  }
  if ('discriminator' in shape) {
    if (!isObject(value)) return value;
    const tag = value[shape.discriminator];
    // Own properties only: a tag such as \`__proto__\` must not reach \`Object.prototype\`.
    const variant =
      typeof tag === 'string' && Object.prototype.hasOwnProperty.call(shape.mapping, tag)
        ? shape.mapping[tag]
        : undefined;
    return variant === undefined ? value : walk(value, variant, mode);
  }
  // Without a discriminator, every variant's dates are converted.
  let result: unknown = value;
  for (const variant of shape.anyOf) result = walk(result, variant, mode);
  return result;
}

/** Converts \`date\`/\`date-time\` strings of response data to \`Date\` objects (in place). */
export function reviveDates(value: unknown, shape: DateShape): unknown {
  return walk(value, shape, 'revive');
}

/**
 * Converts \`Date\` values to their wire form: \`YYYY-MM-DD\` for \`date\` and ISO 8601 for
 * \`date-time\`. Returns a copy; the input is not modified.
 */
export function encodeDates(value: unknown, shape: DateShape): unknown {
  return walk(value, shape, 'encode');
}
`,"/assets/runtime/errors.d.ts":`import type { HttpMethod } from './types.js';
interface ErrorContext {
    readonly operationId: string;
    readonly method: HttpMethod;
    readonly url: string;
}
/**
 * Thrown when the server responds with a status the operation does not resolve with (non-2xx).
 * Generated operations reject with a union of \`ApiError\`s, one per documented status, so checking
 * \`status\` also narrows \`body\`.
 */
export declare class ApiError<TBody = unknown, TStatus extends number = number> extends Error {
    /** HTTP status code. */
    readonly status: TStatus;
    readonly statusText: string;
    /** Parsed response body (JSON when possible, otherwise text or binary). */
    readonly body: TBody;
    readonly headers: Headers;
    readonly operationId: string;
    readonly method: HttpMethod;
    readonly url: string;
    /** The underlying response object (\`Response\` for fetch, \`AxiosResponse\` for axios). */
    readonly response: unknown;
    constructor(init: ErrorContext & {
        readonly status: TStatus;
        readonly statusText: string;
        readonly body: TBody;
        readonly headers: Headers;
        readonly response: unknown;
        readonly cause?: unknown;
    });
}
export type RequestErrorKind = 'network' | 'timeout' | 'parse' | 'serialization' | 'validation';
/**
 * Thrown when a request does not produce a usable response: network failures, timeouts,
 * malformed response bodies, serialization or validation failures. User cancellation via an
 * \`AbortSignal\` rethrows the original abort error instead.
 */
export declare class RequestError extends Error {
    readonly kind: RequestErrorKind;
    readonly operationId: string;
    readonly method: HttpMethod;
    readonly url: string;
    constructor(kind: RequestErrorKind, message: string, context: ErrorContext, cause?: unknown);
}
/** Errors an operation can reject with, when only the union of its error bodies is known. */
export type OperationError<TBody = unknown> = ApiError<TBody> | RequestError;
/**
 * Whether \`error\` is an {@link ApiError} of any operation. Each generated operation also exports
 * a guard (\`isGetPetByIdApiError\`) that narrows to that operation's errors by status.
 */
export declare function isApiError(error: unknown): error is ApiError;
export declare function isRequestError(error: unknown): error is RequestError;
export {};
`,"/assets/runtime/errors.js":`function setCause(error, cause) {
    if (cause !== undefined) {
        Object.defineProperty(error, 'cause', {
            value: cause,
            configurable: true,
            writable: true,
            enumerable: false,
        });
    }
}
/**
 * Thrown when the server responds with a status the operation does not resolve with (non-2xx).
 * Generated operations reject with a union of \`ApiError\`s, one per documented status, so checking
 * \`status\` also narrows \`body\`.
 */
export class ApiError extends Error {
    constructor(init) {
        super(\`\${init.method} \${init.url} failed with status \${init.status}\${init.statusText === '' ? '' : \` \${init.statusText}\`}\`);
        this.name = 'ApiError';
        this.status = init.status;
        this.statusText = init.statusText;
        this.body = init.body;
        this.headers = init.headers;
        this.operationId = init.operationId;
        this.method = init.method;
        this.url = init.url;
        this.response = init.response;
        setCause(this, init.cause);
    }
}
/**
 * Thrown when a request does not produce a usable response: network failures, timeouts,
 * malformed response bodies, serialization or validation failures. User cancellation via an
 * \`AbortSignal\` rethrows the original abort error instead.
 */
export class RequestError extends Error {
    constructor(kind, message, context, cause) {
        super(message);
        this.name = 'RequestError';
        this.kind = kind;
        this.operationId = context.operationId;
        this.method = context.method;
        this.url = context.url;
        setCause(this, cause);
    }
}
/**
 * Whether \`error\` is an {@link ApiError} of any operation. Each generated operation also exports
 * a guard (\`isGetPetByIdApiError\`) that narrows to that operation's errors by status.
 */
export function isApiError(error) {
    return error instanceof ApiError;
}
export function isRequestError(error) {
    return error instanceof RequestError;
}
`,"/assets/runtime/errors.ts":`import type { HttpMethod } from './types.js';

interface ErrorContext {
  readonly operationId: string;
  readonly method: HttpMethod;
  readonly url: string;
}

function setCause(error: Error, cause: unknown): void {
  if (cause !== undefined) {
    Object.defineProperty(error, 'cause', {
      value: cause,
      configurable: true,
      writable: true,
      enumerable: false,
    });
  }
}

/**
 * Thrown when the server responds with a status the operation does not resolve with (non-2xx).
 * Generated operations reject with a union of \`ApiError\`s, one per documented status, so checking
 * \`status\` also narrows \`body\`.
 */
export class ApiError<TBody = unknown, TStatus extends number = number> extends Error {
  /** HTTP status code. */
  readonly status: TStatus;
  readonly statusText: string;
  /** Parsed response body (JSON when possible, otherwise text or binary). */
  readonly body: TBody;
  readonly headers: Headers;
  readonly operationId: string;
  readonly method: HttpMethod;
  readonly url: string;
  /** The underlying response object (\`Response\` for fetch, \`AxiosResponse\` for axios). */
  readonly response: unknown;

  constructor(
    init: ErrorContext & {
      readonly status: TStatus;
      readonly statusText: string;
      readonly body: TBody;
      readonly headers: Headers;
      readonly response: unknown;
      readonly cause?: unknown;
    },
  ) {
    super(
      \`\${init.method} \${init.url} failed with status \${init.status}\${init.statusText === '' ? '' : \` \${init.statusText}\`}\`,
    );
    this.name = 'ApiError';
    this.status = init.status;
    this.statusText = init.statusText;
    this.body = init.body;
    this.headers = init.headers;
    this.operationId = init.operationId;
    this.method = init.method;
    this.url = init.url;
    this.response = init.response;
    setCause(this, init.cause);
  }
}

export type RequestErrorKind = 'network' | 'timeout' | 'parse' | 'serialization' | 'validation';

/**
 * Thrown when a request does not produce a usable response: network failures, timeouts,
 * malformed response bodies, serialization or validation failures. User cancellation via an
 * \`AbortSignal\` rethrows the original abort error instead.
 */
export class RequestError extends Error {
  readonly kind: RequestErrorKind;
  readonly operationId: string;
  readonly method: HttpMethod;
  readonly url: string;

  constructor(kind: RequestErrorKind, message: string, context: ErrorContext, cause?: unknown) {
    super(message);
    this.name = 'RequestError';
    this.kind = kind;
    this.operationId = context.operationId;
    this.method = context.method;
    this.url = context.url;
    setCause(this, cause);
  }
}

/** Errors an operation can reject with, when only the union of its error bodies is known. */
export type OperationError<TBody = unknown> = ApiError<TBody> | RequestError;

/**
 * Whether \`error\` is an {@link ApiError} of any operation. Each generated operation also exports
 * a guard (\`isGetPetByIdApiError\`) that narrows to that operation's errors by status.
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isRequestError(error: unknown): error is RequestError {
  return error instanceof RequestError;
}
`,"/assets/runtime/fetch.d.ts":`import type { Transport } from './types.js';
/** Extra \`fetch\` options accepted per request (\`transportOptions\`) and as client defaults. */
export type FetchTransportOptions = Omit<RequestInit, 'method' | 'headers' | 'body' | 'signal'>;
export interface FetchTransportConfig {
    /** Custom \`fetch\` implementation. Defaults to \`globalThis.fetch\` at request time. */
    readonly fetch?: typeof fetch;
}
/** Creates a transport backed by the Fetch API. */
export declare function createFetchTransport(config?: FetchTransportConfig): Transport<FetchTransportOptions>;
/** The default Fetch transport. */
export declare const fetchTransport: Transport<FetchTransportOptions>;
`,"/assets/runtime/fetch.js":`import { RequestError } from './errors.js';
import { isJsonMediaType, isTextMediaType, responseParseAs } from './serialization.js';
async function readBody(response, request) {
    const parseAs = responseParseAs(request.parseAs, response.status);
    if (parseAs === 'stream')
        return response.body;
    if (request.method === 'HEAD' ||
        response.status === 204 ||
        response.status === 205 ||
        response.status === 304) {
        return undefined;
    }
    if (parseAs === 'blob')
        return response.blob();
    if (parseAs === 'arrayBuffer')
        return response.arrayBuffer();
    if (parseAs === 'text')
        return response.text();
    const contentType = response.headers.get('content-type');
    if (parseAs === 'json' || isJsonMediaType(contentType)) {
        const text = await response.text();
        if (text.trim() === '')
            return undefined;
        try {
            return JSON.parse(text);
        }
        catch (error) {
            // Error bodies are best-effort: keep the text so ApiError still carries it.
            if (!response.ok)
                return text;
            throw new RequestError('parse', 'The response body is not valid JSON.', { operationId: request.operationId, method: request.method, url: request.url }, error);
        }
    }
    if (contentType === null || isTextMediaType(contentType)) {
        const text = await response.text();
        return text === '' && contentType === null ? undefined : text;
    }
    return response.blob();
}
/** Creates a transport backed by the Fetch API. */
export function createFetchTransport(config = {}) {
    return async (request) => {
        const init = {
            ...request.transportOptions,
            method: request.method,
            headers: request.headers,
        };
        if (request.body !== undefined)
            init.body = request.body;
        if (request.signal !== undefined)
            init.signal = request.signal;
        if (request.credentials !== undefined)
            init.credentials = request.credentials;
        const fetchImpl = config.fetch ?? globalThis.fetch;
        const response = await fetchImpl(request.url, init);
        const data = await readBody(response, request);
        return {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data,
            raw: response,
        };
    };
}
/** The default Fetch transport. */
export const fetchTransport = 
/* @__PURE__ */ createFetchTransport();
`,"/assets/runtime/fetch.ts":`import { RequestError } from './errors.js';
import { isJsonMediaType, isTextMediaType, responseParseAs } from './serialization.js';
import type { Transport, TransportRequest } from './types.js';

/** Extra \`fetch\` options accepted per request (\`transportOptions\`) and as client defaults. */
export type FetchTransportOptions = Omit<RequestInit, 'method' | 'headers' | 'body' | 'signal'>;

export interface FetchTransportConfig {
  /** Custom \`fetch\` implementation. Defaults to \`globalThis.fetch\` at request time. */
  readonly fetch?: typeof fetch;
}

async function readBody(
  response: Response,
  request: TransportRequest<FetchTransportOptions>,
): Promise<unknown> {
  const parseAs = responseParseAs(request.parseAs, response.status);
  if (parseAs === 'stream') return response.body;
  if (
    request.method === 'HEAD' ||
    response.status === 204 ||
    response.status === 205 ||
    response.status === 304
  ) {
    return undefined;
  }
  if (parseAs === 'blob') return response.blob();
  if (parseAs === 'arrayBuffer') return response.arrayBuffer();
  if (parseAs === 'text') return response.text();
  const contentType = response.headers.get('content-type');
  if (parseAs === 'json' || isJsonMediaType(contentType)) {
    const text = await response.text();
    if (text.trim() === '') return undefined;
    try {
      return JSON.parse(text) as unknown;
    } catch (error) {
      // Error bodies are best-effort: keep the text so ApiError still carries it.
      if (!response.ok) return text;
      throw new RequestError(
        'parse',
        'The response body is not valid JSON.',
        { operationId: request.operationId, method: request.method, url: request.url },
        error,
      );
    }
  }
  if (contentType === null || isTextMediaType(contentType)) {
    const text = await response.text();
    return text === '' && contentType === null ? undefined : text;
  }
  return response.blob();
}

/** Creates a transport backed by the Fetch API. */
export function createFetchTransport(
  config: FetchTransportConfig = {},
): Transport<FetchTransportOptions> {
  return async (request) => {
    const init: RequestInit = {
      ...request.transportOptions,
      method: request.method,
      headers: request.headers,
    };
    if (request.body !== undefined) init.body = request.body as NonNullable<RequestInit['body']>;
    if (request.signal !== undefined) init.signal = request.signal;
    if (request.credentials !== undefined) init.credentials = request.credentials;
    const fetchImpl = config.fetch ?? globalThis.fetch;
    const response = await fetchImpl(request.url, init);
    const data = await readBody(response, request);
    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data,
      raw: response,
    };
  };
}

/** The default Fetch transport. */
export const fetchTransport: Transport<FetchTransportOptions> =
  /* @__PURE__ */ createFetchTransport();
`,"/assets/runtime/middleware.d.ts":`import type { Middleware, OperationInfo, TransportRequest, TransportResponse } from './types.js';
export interface RetryOptions {
    /** Attempts per call, including the first. Default \`3\`. */
    readonly attempts?: number;
    /**
     * Methods that are retried. Default: the idempotent \`GET\`, \`HEAD\`, \`OPTIONS\`, \`PUT\`, \`DELETE\`,
     * \`TRACE\` and \`QUERY\`. Requests with an \`Idempotency-Key\` header are retried whatever the method.
     */
    readonly methods?: readonly string[];
    /** Response statuses that are retried. Default \`[408, 429, 500, 502, 503, 504]\`. */
    readonly statuses?: readonly number[];
    /** Retry when no response arrives (network failures). Default \`true\`. */
    readonly networkErrors?: boolean;
    /** Base delay in milliseconds; it doubles with every retry. Default \`300\`. */
    readonly delay?: number;
    /** Upper bound of the computed delay in milliseconds. Default \`10000\`. */
    readonly maxDelay?: number;
    /** Wait as long as a \`Retry-After\` response header asks instead. Default \`true\`. */
    readonly respectRetryAfter?: boolean;
    /**
     * When \`Retry-After\` asks for longer than this (milliseconds), the response is returned instead
     * of waiting. Default \`60000\`.
     */
    readonly maxRetryAfter?: number;
    /** Decides last, after the other options allowed a retry. */
    readonly shouldRetry?: (context: {
        readonly request: TransportRequest;
        readonly operation: OperationInfo;
        readonly attempt: number;
        readonly response?: TransportResponse;
        readonly error?: unknown;
    }) => boolean | Promise<boolean>;
}
/**
 * Retries failed requests with jittered exponential backoff: the n-th retry waits between half
 * and all of \`min(maxDelay, delay × 2^(n−1))\`, or what \`Retry-After\` asks. Only idempotent
 * methods are retried by default. A wait ends early when the call is aborted or times out.
 *
 * \`\`\`ts
 * client.use(retry({ attempts: 3, statuses: [429, 502, 503, 504] }));
 * \`\`\`
 */
export declare function retry<TTransportOptions = unknown>(options?: RetryOptions): Middleware<TTransportOptions>;
interface RefreshAuthBase {
    /** Response statuses that mean "the credentials expired". Default \`[401]\`. */
    readonly statuses?: readonly number[];
    /** Called when \`refresh\` fails; the call then rejects with the original response. */
    readonly onFailure?: (error: unknown) => void;
}
export type RefreshAuthOptions = (RefreshAuthBase & {
    /** Security scheme whose credential \`refresh\` returns. */
    readonly scheme: string;
    /** Obtains a new credential; it is stored as \`auth[scheme]\` in the client config. */
    readonly refresh: () => string | Promise<string>;
}) | (RefreshAuthBase & {
    readonly scheme?: undefined;
    /** Refreshes credentials that the client's \`auth\` functions read (e.g. from a store). */
    readonly refresh: () => void | Promise<void>;
});
/**
 * Refreshes expired credentials once and replays the request. Concurrent requests that fail
 * while a refresh is running wait for it instead of refreshing again, and requests sent with
 * credentials that were refreshed meanwhile are replayed without another refresh. Operations
 * without security requirements (such as a login endpoint) are never refreshed; with \`scheme\`,
 * only operations that use that scheme are.
 *
 * \`\`\`ts
 * client.use(
 *   refreshAuth({
 *     scheme: 'bearerAuth',
 *     refresh: async () => (await fetch('/token', { method: 'POST' })).text(),
 *   }),
 * );
 * \`\`\`
 */
export declare function refreshAuth<TTransportOptions = unknown>(options: RefreshAuthOptions): Middleware<TTransportOptions>;
export {};
`,"/assets/runtime/middleware.js":`import { RequestError } from './errors.js';
/** Waits \`ms\` milliseconds; rejects with the signal's reason when it aborts first. */
function wait(ms, signal) {
    return new Promise((resolve, reject) => {
        const onAbort = () => {
            clearTimeout(timer);
            // The abort reason is what an aborted request rejects with, whatever its type.
            reject(signal?.reason);
        };
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        if (signal?.aborted === true)
            onAbort();
        else
            signal?.addEventListener('abort', onAbort, { once: true });
    });
}
/** Milliseconds a \`Retry-After\` header asks for (seconds or an HTTP date), if valid. */
function retryAfter(value) {
    if (value === null)
        return undefined;
    const text = value.trim();
    if (/^\\d+$/.test(text))
        return Number(text) * 1000;
    const date = Date.parse(text);
    return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}
const IDEMPOTENT = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE', 'TRACE', 'QUERY'];
/** Bodies that can only be read once cannot be sent again. */
function replayable(request) {
    return typeof ReadableStream === 'undefined' || !(request.body instanceof ReadableStream);
}
/**
 * Retries failed requests with jittered exponential backoff: the n-th retry waits between half
 * and all of \`min(maxDelay, delay × 2^(n−1))\`, or what \`Retry-After\` asks. Only idempotent
 * methods are retried by default. A wait ends early when the call is aborted or times out.
 *
 * \`\`\`ts
 * client.use(retry({ attempts: 3, statuses: [429, 502, 503, 504] }));
 * \`\`\`
 */
export function retry(options = {}) {
    const attempts = Math.max(1, options.attempts ?? 3);
    const methods = new Set((options.methods ?? IDEMPOTENT).map((method) => method.toUpperCase()));
    const statuses = options.statuses ?? [408, 429, 500, 502, 503, 504];
    const delay = options.delay ?? 300;
    const maxDelay = options.maxDelay ?? 10000;
    const maxRetryAfter = options.maxRetryAfter ?? 60000;
    const retries = new WeakMap();
    /** Milliseconds to wait before the next attempt, or \`undefined\` not to retry. */
    const plan = async (context, outcome) => {
        const { request, operation } = context;
        const done = retries.get(operation) ?? 0;
        if (done + 1 >= attempts || request.signal?.aborted === true || !replayable(request))
            return undefined;
        const idempotent = methods.has(request.method.toUpperCase()) || request.headers.has('idempotency-key');
        if (!idempotent)
            return undefined;
        let requested;
        if (outcome.response !== undefined) {
            if (!statuses.includes(outcome.response.status))
                return undefined;
            if (options.respectRetryAfter !== false) {
                requested = retryAfter(outcome.response.headers.get('retry-after'));
                if (requested !== undefined && requested > maxRetryAfter)
                    return undefined;
            }
        }
        else {
            const error = outcome.error;
            const failed = !(error instanceof RequestError) || error.kind === 'network' || error.kind === 'timeout';
            if (options.networkErrors === false || !failed)
                return undefined;
        }
        if (options.shouldRetry !== undefined) {
            const allowed = await options.shouldRetry({
                request,
                operation,
                attempt: context.attempt,
                ...outcome,
            });
            if (!allowed)
                return undefined;
        }
        retries.set(operation, done + 1);
        if (requested !== undefined)
            return requested;
        const backoff = Math.min(maxDelay, delay * 2 ** done);
        return backoff / 2 + Math.random() * (backoff / 2);
    };
    return {
        async onResponse(context) {
            const ms = await plan(context, { response: context.response });
            if (ms === undefined)
                return undefined;
            await wait(ms, context.request.signal);
            return context.retry();
        },
        async onError(context) {
            const ms = await plan(context, { error: context.error });
            if (ms === undefined)
                return undefined;
            await wait(ms, context.request.signal);
            return context.retry();
        },
    };
}
/**
 * Refreshes expired credentials once and replays the request. Concurrent requests that fail
 * while a refresh is running wait for it instead of refreshing again, and requests sent with
 * credentials that were refreshed meanwhile are replayed without another refresh. Operations
 * without security requirements (such as a login endpoint) are never refreshed; with \`scheme\`,
 * only operations that use that scheme are.
 *
 * \`\`\`ts
 * client.use(
 *   refreshAuth({
 *     scheme: 'bearerAuth',
 *     refresh: async () => (await fetch('/token', { method: 'POST' })).text(),
 *   }),
 * );
 * \`\`\`
 */
export function refreshAuth(options) {
    const statuses = options.statuses ?? [401];
    /** Incremented by every successful refresh. */
    let generation = 0;
    let pending;
    /** Per call: the generation its latest attempt was sent with, and whether it was replayed. */
    const sent = new WeakMap();
    const replayed = new WeakSet();
    const applies = (operation) => {
        const security = operation.security ?? [];
        const scheme = options.scheme;
        return scheme === undefined
            ? security.some((requirement) => requirement.length > 0)
            : security.some((requirement) => requirement.includes(scheme));
    };
    /** Refreshes once; resolves with whether it succeeded. Never rejects. */
    const run = async (context) => {
        try {
            const credential = await options.refresh();
            if (options.scheme !== undefined && typeof credential === 'string') {
                const { auth } = context.client.getConfig();
                context.client.setConfig({ auth: { ...auth, [options.scheme]: credential } });
            }
            generation++;
            return true;
        }
        catch (error) {
            options.onFailure?.(error);
            return false;
        }
    };
    // Concurrent failures share one refresh.
    const refresh = (context) => (pending ?? (pending = run(context).finally(() => {
        pending = undefined;
    })));
    return {
        onRequest(context) {
            sent.set(context.operation, generation);
        },
        async onResponse(context) {
            const { operation, response } = context;
            if (!statuses.includes(response.status) || !applies(operation) || replayed.has(operation))
                return undefined;
            replayed.add(operation);
            // Credentials refreshed since this attempt was sent: replay with them, without refreshing.
            if ((sent.get(operation) ?? generation) < generation)
                return context.retry();
            return (await refresh(context)) ? context.retry() : undefined;
        },
    };
}
`,"/assets/runtime/middleware.ts":`import { RequestError } from './errors.js';
import type {
  Middleware,
  MiddlewareContext,
  OperationInfo,
  TransportRequest,
  TransportResponse,
} from './types.js';

/** Waits \`ms\` milliseconds; rejects with the signal's reason when it aborts first. */
function wait(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer);
      // The abort reason is what an aborted request rejects with, whatever its type.
      reject(signal?.reason as Error);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    if (signal?.aborted === true) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Milliseconds a \`Retry-After\` header asks for (seconds or an HTTP date), if valid. */
function retryAfter(value: string | null): number | undefined {
  if (value === null) return undefined;
  const text = value.trim();
  if (/^\\d+$/.test(text)) return Number(text) * 1000;
  const date = Date.parse(text);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

export interface RetryOptions {
  /** Attempts per call, including the first. Default \`3\`. */
  readonly attempts?: number;
  /**
   * Methods that are retried. Default: the idempotent \`GET\`, \`HEAD\`, \`OPTIONS\`, \`PUT\`, \`DELETE\`,
   * \`TRACE\` and \`QUERY\`. Requests with an \`Idempotency-Key\` header are retried whatever the method.
   */
  readonly methods?: readonly string[];
  /** Response statuses that are retried. Default \`[408, 429, 500, 502, 503, 504]\`. */
  readonly statuses?: readonly number[];
  /** Retry when no response arrives (network failures). Default \`true\`. */
  readonly networkErrors?: boolean;
  /** Base delay in milliseconds; it doubles with every retry. Default \`300\`. */
  readonly delay?: number;
  /** Upper bound of the computed delay in milliseconds. Default \`10000\`. */
  readonly maxDelay?: number;
  /** Wait as long as a \`Retry-After\` response header asks instead. Default \`true\`. */
  readonly respectRetryAfter?: boolean;
  /**
   * When \`Retry-After\` asks for longer than this (milliseconds), the response is returned instead
   * of waiting. Default \`60000\`.
   */
  readonly maxRetryAfter?: number;
  /** Decides last, after the other options allowed a retry. */
  readonly shouldRetry?: (context: {
    readonly request: TransportRequest;
    readonly operation: OperationInfo;
    readonly attempt: number;
    readonly response?: TransportResponse;
    readonly error?: unknown;
  }) => boolean | Promise<boolean>;
}

const IDEMPOTENT: readonly string[] = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE', 'TRACE', 'QUERY'];

/** Bodies that can only be read once cannot be sent again. */
function replayable(request: TransportRequest): boolean {
  return typeof ReadableStream === 'undefined' || !(request.body instanceof ReadableStream);
}

/**
 * Retries failed requests with jittered exponential backoff: the n-th retry waits between half
 * and all of \`min(maxDelay, delay × 2^(n−1))\`, or what \`Retry-After\` asks. Only idempotent
 * methods are retried by default. A wait ends early when the call is aborted or times out.
 *
 * \`\`\`ts
 * client.use(retry({ attempts: 3, statuses: [429, 502, 503, 504] }));
 * \`\`\`
 */
export function retry<TTransportOptions = unknown>(
  options: RetryOptions = {},
): Middleware<TTransportOptions> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const methods = new Set((options.methods ?? IDEMPOTENT).map((method) => method.toUpperCase()));
  const statuses = options.statuses ?? [408, 429, 500, 502, 503, 504];
  const delay = options.delay ?? 300;
  const maxDelay = options.maxDelay ?? 10_000;
  const maxRetryAfter = options.maxRetryAfter ?? 60_000;
  const retries = new WeakMap<OperationInfo, number>();

  /** Milliseconds to wait before the next attempt, or \`undefined\` not to retry. */
  const plan = async (
    context: MiddlewareContext<TTransportOptions>,
    outcome: { readonly response?: TransportResponse; readonly error?: unknown },
  ): Promise<number | undefined> => {
    const { request, operation } = context;
    const done = retries.get(operation) ?? 0;
    if (done + 1 >= attempts || request.signal?.aborted === true || !replayable(request))
      return undefined;
    const idempotent =
      methods.has(request.method.toUpperCase()) || request.headers.has('idempotency-key');
    if (!idempotent) return undefined;
    let requested: number | undefined;
    if (outcome.response !== undefined) {
      if (!statuses.includes(outcome.response.status)) return undefined;
      if (options.respectRetryAfter !== false) {
        requested = retryAfter(outcome.response.headers.get('retry-after'));
        if (requested !== undefined && requested > maxRetryAfter) return undefined;
      }
    } else {
      const error = outcome.error;
      const failed =
        !(error instanceof RequestError) || error.kind === 'network' || error.kind === 'timeout';
      if (options.networkErrors === false || !failed) return undefined;
    }
    if (options.shouldRetry !== undefined) {
      const allowed = await options.shouldRetry({
        request,
        operation,
        attempt: context.attempt,
        ...outcome,
      });
      if (!allowed) return undefined;
    }
    retries.set(operation, done + 1);
    if (requested !== undefined) return requested;
    const backoff = Math.min(maxDelay, delay * 2 ** done);
    return backoff / 2 + Math.random() * (backoff / 2);
  };

  return {
    async onResponse(context) {
      const ms = await plan(context, { response: context.response });
      if (ms === undefined) return undefined;
      await wait(ms, context.request.signal);
      return context.retry();
    },
    async onError(context) {
      const ms = await plan(context, { error: context.error });
      if (ms === undefined) return undefined;
      await wait(ms, context.request.signal);
      return context.retry();
    },
  };
}

interface RefreshAuthBase {
  /** Response statuses that mean "the credentials expired". Default \`[401]\`. */
  readonly statuses?: readonly number[];
  /** Called when \`refresh\` fails; the call then rejects with the original response. */
  readonly onFailure?: (error: unknown) => void;
}

export type RefreshAuthOptions =
  | (RefreshAuthBase & {
      /** Security scheme whose credential \`refresh\` returns. */
      readonly scheme: string;
      /** Obtains a new credential; it is stored as \`auth[scheme]\` in the client config. */
      readonly refresh: () => string | Promise<string>;
    })
  | (RefreshAuthBase & {
      readonly scheme?: undefined;
      /** Refreshes credentials that the client's \`auth\` functions read (e.g. from a store). */
      readonly refresh: () => void | Promise<void>;
    });

/**
 * Refreshes expired credentials once and replays the request. Concurrent requests that fail
 * while a refresh is running wait for it instead of refreshing again, and requests sent with
 * credentials that were refreshed meanwhile are replayed without another refresh. Operations
 * without security requirements (such as a login endpoint) are never refreshed; with \`scheme\`,
 * only operations that use that scheme are.
 *
 * \`\`\`ts
 * client.use(
 *   refreshAuth({
 *     scheme: 'bearerAuth',
 *     refresh: async () => (await fetch('/token', { method: 'POST' })).text(),
 *   }),
 * );
 * \`\`\`
 */
export function refreshAuth<TTransportOptions = unknown>(
  options: RefreshAuthOptions,
): Middleware<TTransportOptions> {
  const statuses = options.statuses ?? [401];
  /** Incremented by every successful refresh. */
  let generation = 0;
  let pending: Promise<boolean> | undefined;
  /** Per call: the generation its latest attempt was sent with, and whether it was replayed. */
  const sent = new WeakMap<OperationInfo, number>();
  const replayed = new WeakSet<OperationInfo>();

  const applies = (operation: OperationInfo): boolean => {
    const security = operation.security ?? [];
    const scheme = options.scheme;
    return scheme === undefined
      ? security.some((requirement) => requirement.length > 0)
      : security.some((requirement) => requirement.includes(scheme));
  };

  /** Refreshes once; resolves with whether it succeeded. Never rejects. */
  const run = async (context: MiddlewareContext<TTransportOptions>): Promise<boolean> => {
    try {
      const credential = await options.refresh();
      if (options.scheme !== undefined && typeof credential === 'string') {
        const { auth } = context.client.getConfig();
        context.client.setConfig({ auth: { ...auth, [options.scheme]: credential } });
      }
      generation++;
      return true;
    } catch (error) {
      options.onFailure?.(error);
      return false;
    }
  };
  // Concurrent failures share one refresh.
  const refresh = (context: MiddlewareContext<TTransportOptions>): Promise<boolean> =>
    (pending ??= run(context).finally(() => {
      pending = undefined;
    }));

  return {
    onRequest(context) {
      sent.set(context.operation, generation);
    },
    async onResponse(context) {
      const { operation, response } = context;
      if (!statuses.includes(response.status) || !applies(operation) || replayed.has(operation))
        return undefined;
      replayed.add(operation);
      // Credentials refreshed since this attempt was sent: replay with them, without refreshing.
      if ((sent.get(operation) ?? generation) < generation) return context.retry();
      return (await refresh(context)) ? context.retry() : undefined;
    },
  };
}
`,"/assets/runtime/serialization.d.ts":"import type { ParamSerialization, ParseAs, PropertyEncoding } from './types.js';\n/** Converts a primitive (or Date) to its string form. */\nexport declare function primitiveToString(value: unknown): string;\n/** Serializes one path parameter value (`simple`, `label` or `matrix` style). */\nexport declare function serializePathParam(name: string, value: unknown, serialization?: ParamSerialization): string;\n/** Replaces `{name}` segments in a path template. Throws when a value is missing. */\nexport declare function interpolatePath(path: string, values: Readonly<Record<string, unknown>> | undefined, styles: Readonly<Record<string, ParamSerialization>> | undefined): string;\n/** Serializes query parameters into a query string without the leading `?`. */\nexport declare function serializeQuery(values: Readonly<Record<string, unknown>> | undefined, styles: Readonly<Record<string, ParamSerialization>> | undefined): string;\n/** Serializes a header parameter (`simple` style). */\nexport declare function serializeHeader(value: unknown, serialization?: ParamSerialization): string;\n/** Builds a `Cookie` header value. Browsers ignore this header; cookies are sent by the browser. */\nexport declare function serializeCookies(values: Readonly<Record<string, unknown>> | undefined, styles: Readonly<Record<string, ParamSerialization>> | undefined): string;\n/**\n * Serializes an OpenAPI 3.2 `querystring` parameter: the whole query string, without `?`. Form\n * content uses `application/x-www-form-urlencoded` rules; other media types are serialized (JSON\n * as JSON text, anything else as a string) and percent-encoded.\n */\nexport declare function serializeQuerystring(value: unknown, mediaType: string, encoding?: Readonly<Record<string, PropertyEncoding>>): string;\n/** Whether a media type carries JSON (`application/json`, `application/problem+json`, ...). */\nexport declare function isJsonMediaType(mediaType: string | null | undefined): boolean;\n/**\n * How a transport reads a response body: `parseAs` applies to successful and redirect statuses;\n * error bodies (other statuses) are read by their `Content-Type` (`auto`), so `ApiError.body`\n * matches the error response's declared type. `stream` keeps every body unread.\n */\nexport declare function responseParseAs(parseAs: ParseAs, status: number): ParseAs;\n/** Whether a response of this (non-JSON) media type is read as text rather than as a `Blob`. */\nexport declare function isTextMediaType(mediaType: string): boolean;\nexport interface SerializedBody {\n    readonly body: unknown;\n    /** Content-Type to send; `undefined` lets the transport choose (e.g. multipart boundaries). */\n    readonly contentType: string | undefined;\n}\n/** Serializes a request body for its media type. */\nexport declare function serializeBody(body: unknown, mediaType: string | undefined, encoding?: Readonly<Record<string, PropertyEncoding>>): SerializedBody;\n/**\n * Encodes a `multipart/form-data` body by hand, so parts that are not files carry their\n * Content-Type without a filename. Files keep theirs (a `File`'s name, otherwise `blob`).\n */\nexport declare function toMultipartBody(body: unknown, encoding?: Readonly<Record<string, PropertyEncoding>>): {\n    body: Blob;\n    contentType: string;\n};\n/** Converts an object into `FormData`. Arrays are sent as repeated fields unless `explode: false`. */\nexport declare function toFormData(body: unknown, encoding?: Readonly<Record<string, PropertyEncoding>>): FormData;\n/**\n * Converts an object into `URLSearchParams` (`form` style). Nested objects are sent as JSON unless\n * their `encoding` declares a `style` or `explode` (`deepObject` sends `name[key]=value`).\n */\nexport declare function toSearchParams(body: unknown, encoding?: Readonly<Record<string, PropertyEncoding>>): URLSearchParams;\n/**\n * Joins a base URL and a path without duplicating slashes. A query string in the base URL is kept\n * after the path and combined with `query`.\n */\nexport declare function joinUrl(baseUrl: string, path: string, query: string): string;\n","/assets/runtime/serialization.js":`const DEFAULT_STYLE = {
    path: 'simple',
    query: 'form',
    header: 'simple',
    cookie: 'form',
};
const DELIMITERS = {
    spaceDelimited: ' ',
    pipeDelimited: '|',
    tabDelimited: '\\t',
};
const encodeStrict = (value) => encodeURIComponent(value).replace(/[!'()*]/g, (c) => \`%\${c.charCodeAt(0).toString(16).toUpperCase()}\`);
/**
 * Keeps RFC 3986 reserved characters, as requested by \`allowReserved\`. Percent signs are kept only
 * when they start a percent-encoded octet, so the result is always valid percent-encoding.
 */
const encodeReserved = (value) => value.replace(/%(?![0-9A-Fa-f]{2})|[^A-Za-z0-9\\-._~:/?#[\\]@!$&'()*+,;=%]/gu, (c) => encodeURIComponent(c));
function isObject(value) {
    return (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date));
}
/** Converts a primitive (or Date) to its string form. */
export function primitiveToString(value) {
    if (value instanceof Date)
        return value.toISOString();
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
        return String(value);
    // JSON.stringify returns undefined for undefined, functions and symbols.
    const json = JSON.stringify(value);
    return typeof json === 'string' ? json : '';
}
function entriesOf(value) {
    return Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, value[key]]);
}
function settings(location, serialization) {
    const style = serialization?.style ?? DEFAULT_STYLE[location];
    return {
        style,
        explode: serialization?.explode ?? (style === 'form' || style === 'cookie'),
        encode: serialization?.allowReserved === true ? encodeReserved : encodeStrict,
        json: serialization?.json === true,
    };
}
/** Serializes one path parameter value (\`simple\`, \`label\` or \`matrix\` style). */
export function serializePathParam(name, value, serialization) {
    const { style, explode, encode, json } = settings('path', serialization);
    if (json)
        return encode(JSON.stringify(value));
    const prefix = style === 'label' ? '.' : style === 'matrix' ? \`;\${name}=\` : '';
    if (Array.isArray(value)) {
        const items = value.map((item) => encode(primitiveToString(item)));
        if (style === 'matrix' && explode)
            return items.map((item) => \`;\${name}=\${item}\`).join('');
        const separator = style === 'label' && explode ? '.' : (DELIMITERS[style] ?? ',');
        return prefix + items.join(separator === ' ' ? '%20' : separator === '\\t' ? '%09' : separator);
    }
    if (isObject(value)) {
        const pairs = entriesOf(value);
        if (explode) {
            const separator = style === 'label' ? '.' : style === 'matrix' ? ';' : ',';
            const body = pairs
                .map(([key, item]) => \`\${encode(key)}=\${encode(primitiveToString(item))}\`)
                .join(separator);
            return style === 'matrix' ? \`;\${body}\` : style === 'label' ? \`.\${body}\` : body;
        }
        return (prefix +
            pairs.flatMap(([key, item]) => [encode(key), encode(primitiveToString(item))]).join(','));
    }
    if (style === 'matrix' && value === '')
        return \`;\${name}\`;
    return prefix + encode(primitiveToString(value));
}
/** Replaces \`{name}\` segments in a path template. Throws when a value is missing. */
export function interpolatePath(path, values, styles) {
    return path.replace(/\\{([^}]+)\\}/g, (_match, name) => {
        const value = values?.[name];
        if (value === undefined || value === null) {
            throw new TypeError(\`Missing required path parameter "\${name}"\`);
        }
        return serializePathParam(name, value, styles?.[name]);
    });
}
/** Serializes query parameters into a query string without the leading \`?\`. */
export function serializeQuery(values, styles) {
    if (values === undefined)
        return '';
    const parts = [];
    for (const name of Object.keys(values)) {
        const value = values[name];
        if (value === undefined || value === null)
            continue;
        const { style, explode, encode, json } = settings('query', styles?.[name]);
        const key = encodeStrict(name);
        if (json) {
            parts.push(\`\${key}=\${encode(JSON.stringify(value))}\`);
        }
        else if (Array.isArray(value)) {
            const items = value
                .filter((item) => item !== undefined && item !== null)
                .map((item) => encode(primitiveToString(item)));
            if (items.length === 0)
                continue;
            const delimiter = DELIMITERS[style];
            if (style === 'form' && explode)
                parts.push(...items.map((item) => \`\${key}=\${item}\`));
            else if (delimiter !== undefined)
                parts.push(\`\${key}=\${items.join(encodeStrict(delimiter))}\`);
            else
                parts.push(\`\${key}=\${items.join(',')}\`);
        }
        else if (isObject(value)) {
            if (style === 'deepObject') {
                for (const [path, item] of deepObjectPairs(key, value, encodeStrict))
                    parts.push(\`\${path}=\${encode(primitiveToString(item))}\`);
            }
            else if (explode) {
                for (const [property, item] of entriesOf(value)) {
                    parts.push(\`\${encodeStrict(property)}=\${encode(primitiveToString(item))}\`);
                }
            }
            else {
                const flat = entriesOf(value).flatMap(([property, item]) => [
                    encode(property),
                    encode(primitiveToString(item)),
                ]);
                const delimiter = DELIMITERS[style];
                parts.push(\`\${key}=\${flat.join(delimiter === undefined ? ',' : encodeStrict(delimiter))}\`);
            }
        }
        else {
            parts.push(\`\${key}=\${encode(primitiveToString(value))}\`);
        }
    }
    return parts.join('&');
}
/**
 * \`deepObject\` pairs: bracketed key paths (\`filter[a][0]\`, property names passed through
 * \`encodeKey\`) and the primitive values at their ends.
 */
function deepObjectPairs(prefix, value, encodeKey) {
    if (Array.isArray(value)) {
        return value.flatMap((item, index) => deepObjectPairs(\`\${prefix}[\${index}]\`, item, encodeKey));
    }
    if (isObject(value)) {
        return entriesOf(value).flatMap(([key, item]) => deepObjectPairs(\`\${prefix}[\${encodeKey(key)}]\`, item, encodeKey));
    }
    if (value === undefined || value === null)
        return [];
    return [[prefix, value]];
}
/** Serializes a header parameter (\`simple\` style). */
export function serializeHeader(value, serialization) {
    if (serialization?.json === true)
        return JSON.stringify(value);
    const explode = serialization?.explode ?? false;
    if (Array.isArray(value))
        return value.map(primitiveToString).join(',');
    if (isObject(value)) {
        const pairs = entriesOf(value);
        return explode
            ? pairs.map(([key, item]) => \`\${key}=\${primitiveToString(item)}\`).join(',')
            : pairs.flatMap(([key, item]) => [key, primitiveToString(item)]).join(',');
    }
    return primitiveToString(value);
}
/** Builds a \`Cookie\` header value. Browsers ignore this header; cookies are sent by the browser. */
export function serializeCookies(values, styles) {
    if (values === undefined)
        return '';
    const parts = [];
    for (const name of Object.keys(values)) {
        const value = values[name];
        if (value === undefined || value === null)
            continue;
        const serialization = styles?.[name];
        if (serialization?.style === 'cookie') {
            parts.push(cookieStyle(name, value, serialization.explode ?? true));
            continue;
        }
        const text = serialization?.json === true
            ? JSON.stringify(value)
            : Array.isArray(value)
                ? value.map(primitiveToString).join(',')
                : isObject(value)
                    ? entriesOf(value)
                        .flatMap(([key, item]) => [key, primitiveToString(item)])
                        .join(',')
                    : primitiveToString(value);
        parts.push(\`\${name}=\${encodeStrict(text)}\`);
    }
    return parts.join('; ');
}
/**
 * OpenAPI 3.2 \`style: cookie\`: like \`form\`, but pairs are separated by \`; \` and nothing is
 * percent-encoded (values must already be escaped as the cookie requires).
 */
function cookieStyle(name, value, explode) {
    if (Array.isArray(value)) {
        const items = value.map(primitiveToString);
        return explode
            ? items.map((item) => \`\${name}=\${item}\`).join('; ')
            : \`\${name}=\${items.join(',')}\`;
    }
    if (isObject(value)) {
        const pairs = entriesOf(value);
        return explode
            ? pairs.map(([key, item]) => \`\${key}=\${primitiveToString(item)}\`).join('; ')
            : \`\${name}=\${pairs.flatMap(([key, item]) => [key, primitiveToString(item)]).join(',')}\`;
    }
    return \`\${name}=\${primitiveToString(value)}\`;
}
/**
 * Serializes an OpenAPI 3.2 \`querystring\` parameter: the whole query string, without \`?\`. Form
 * content uses \`application/x-www-form-urlencoded\` rules; other media types are serialized (JSON
 * as JSON text, anything else as a string) and percent-encoded.
 */
export function serializeQuerystring(value, mediaType, encoding) {
    if (value === undefined || value === null)
        return '';
    const type = (mediaType.split(';')[0] ?? '').trim().toLowerCase();
    if (type === 'application/x-www-form-urlencoded') {
        const params = typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams
            ? value
            : toSearchParams(value, encoding);
        return params.toString();
    }
    const text = isJsonMediaType(type) ? JSON.stringify(value) : primitiveToString(value);
    return encodeURIComponent(text);
}
/** Whether a media type carries JSON (\`application/json\`, \`application/problem+json\`, ...). */
export function isJsonMediaType(mediaType) {
    if (mediaType === null || mediaType === undefined)
        return false;
    const type = (mediaType.split(';')[0] ?? '').trim().toLowerCase();
    return type === 'application/json' || type.endsWith('+json') || type === 'text/json';
}
/**
 * How a transport reads a response body: \`parseAs\` applies to successful and redirect statuses;
 * error bodies (other statuses) are read by their \`Content-Type\` (\`auto\`), so \`ApiError.body\`
 * matches the error response's declared type. \`stream\` keeps every body unread.
 */
export function responseParseAs(parseAs, status) {
    return parseAs === 'stream' || (status >= 200 && status < 400) ? parseAs : 'auto';
}
/** Whether a response of this (non-JSON) media type is read as text rather than as a \`Blob\`. */
export function isTextMediaType(mediaType) {
    const type = (mediaType.split(';')[0] ?? '').trim().toLowerCase();
    return (type.startsWith('text/') ||
        type === 'application/xml' ||
        type.endsWith('+xml') ||
        type === 'application/x-www-form-urlencoded' ||
        type === 'application/javascript' ||
        // Sequences of JSON values (JSON Lines, NDJSON, JSON text sequences) are read as text.
        type === 'application/jsonl' ||
        type === 'application/x-ndjson' ||
        type === 'application/json-seq' ||
        type.endsWith('+json-seq'));
}
function isBinaryLike(value) {
    return ((typeof Blob !== 'undefined' && value instanceof Blob) ||
        value instanceof ArrayBuffer ||
        ArrayBuffer.isView(value) ||
        (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream));
}
function isNativeBody(value) {
    return (typeof value === 'string' ||
        isBinaryLike(value) ||
        (typeof FormData !== 'undefined' && value instanceof FormData) ||
        (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams));
}
/** Serializes a request body for its media type. */
export function serializeBody(body, mediaType, encoding) {
    if (body === undefined)
        return { body: undefined, contentType: undefined };
    const type = (mediaType?.split(';')[0] ?? '').trim().toLowerCase();
    if (type === 'multipart/form-data') {
        if (typeof FormData !== 'undefined' && body instanceof FormData)
            return { body, contentType: undefined };
        // \`FormData\` can only label a part with a Content-Type by sending it as a file (a \`Blob\`, with
        // a filename), which servers then treat as an upload: such bodies are encoded here instead.
        if (needsPartHeaders(body, encoding))
            return toMultipartBody(body, encoding);
        return { body: toFormData(body, encoding), contentType: undefined };
    }
    if (type === 'application/x-www-form-urlencoded') {
        const isParams = typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams;
        return { body: isParams ? body : toSearchParams(body, encoding), contentType: mediaType };
    }
    // A wildcard (\`*/*\`, \`text/*\`) is not a Content-Type: JSON is labeled as such, and native bodies
    // get the transport's default (e.g. a Blob's own type).
    const wildcard = type.endsWith('*');
    if (type === '' || wildcard || isJsonMediaType(type)) {
        if ((type === '' || wildcard) && isNativeBody(body))
            return { body, contentType: undefined };
        if (wildcard && type.startsWith('text/'))
            return { body: primitiveToString(body), contentType: undefined };
        return {
            body: JSON.stringify(body),
            contentType: mediaType === undefined || wildcard ? 'application/json' : mediaType,
        };
    }
    if (type.startsWith('text/'))
        return { body: isNativeBody(body) ? body : primitiveToString(body), contentType: mediaType };
    if (isNativeBody(body))
        return { body, contentType: mediaType };
    return { body: JSON.stringify(body), contentType: mediaType };
}
function appendFormValue(form, name, value, contentType) {
    if (value === undefined || value === null)
        return;
    if (typeof Blob !== 'undefined' && value instanceof Blob) {
        form.append(name, value);
    }
    else if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
        form.append(name, bytesToBlob(value, contentType));
    }
    else if (isObject(value) || Array.isArray(value)) {
        const json = JSON.stringify(value);
        form.append(name, contentType === undefined ? json : new Blob([json], { type: contentType }));
    }
    else {
        form.append(name, primitiveToString(value));
    }
}
/** Copies bytes into an \`ArrayBuffer\`-backed view, which every \`Blob\` implementation accepts. */
function bytesToBlob(value, contentType) {
    const source = value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    const copy = new Uint8Array(source.byteLength);
    copy.set(source);
    return new Blob([copy], contentType === undefined ? {} : { type: contentType });
}
/** A part's declared Content-Type, when it names one type (not a list or a range like \`image/*\`). */
function concreteType(contentType) {
    if (contentType === undefined || contentType.includes(',') || contentType.includes('*'))
        return undefined;
    return contentType.trim();
}
/** The parts of a form body: each array item is a part unless \`explode: false\` joins them. */
function formParts(body, encoding) {
    const parts = [];
    if (!isObject(body))
        return parts;
    for (const [name, value] of entriesOf(body)) {
        const propertyEncoding = encoding?.[name];
        if (Array.isArray(value) && propertyEncoding?.explode !== false) {
            for (const item of value)
                parts.push([name, item, propertyEncoding?.contentType]);
        }
        else if (Array.isArray(value)) {
            const joined = value
                .map(primitiveToString)
                .join(DELIMITERS[propertyEncoding?.style ?? 'form'] ?? ',');
            parts.push([name, joined, undefined]);
        }
        else {
            parts.push([name, value, propertyEncoding?.contentType]);
        }
    }
    return parts;
}
const isBlob = (value) => typeof Blob !== 'undefined' && value instanceof Blob;
/**
 * Whether a part that is not a file needs a Content-Type: objects (JSON, OpenAPI's default for
 * them) and values whose encoding declares one.
 */
function needsPartHeaders(body, encoding) {
    return formParts(body, encoding).some(([, value, contentType]) => {
        if (value === undefined || value === null || isBlob(value))
            return false;
        if (value instanceof ArrayBuffer || ArrayBuffer.isView(value))
            return false;
        return isObject(value) || Array.isArray(value) || concreteType(contentType) !== undefined;
    });
}
/** Escapes a part name or filename as browsers do in \`FormData\` bodies (line breaks, quotes). */
function dispositionValue(value) {
    return value.replace(/\\r\\n|\\r|\\n/g, '%0D%0A').replace(/"/g, '%22');
}
/**
 * Encodes a \`multipart/form-data\` body by hand, so parts that are not files carry their
 * Content-Type without a filename. Files keep theirs (a \`File\`'s name, otherwise \`blob\`).
 */
export function toMultipartBody(body, encoding) {
    const random = () => Math.random().toString(16).slice(2, 14).padEnd(12, '0');
    const boundary = \`----swaggerz\${random()}\${random()}\`;
    const chunks = [];
    for (const [name, value, declared] of formParts(body, encoding)) {
        if (value === undefined || value === null)
            continue;
        const contentType = concreteType(declared);
        let headers = \`Content-Disposition: form-data; name="\${dispositionValue(name)}"\`;
        let content;
        if (isBlob(value) || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
            const blob = isBlob(value) ? value : bytesToBlob(value, undefined);
            const filename = typeof File !== 'undefined' && value instanceof File ? value.name : 'blob';
            const type = blob.type === '' ? (contentType ?? 'application/octet-stream') : blob.type;
            headers += \`; filename="\${dispositionValue(filename)}"\\r\\nContent-Type: \${type}\`;
            content = blob;
        }
        else if (isObject(value) || Array.isArray(value)) {
            headers += \`\\r\\nContent-Type: \${contentType ?? 'application/json'}\`;
            content = JSON.stringify(value);
        }
        else {
            if (contentType !== undefined)
                headers += \`\\r\\nContent-Type: \${contentType}\`;
            content = primitiveToString(value);
        }
        chunks.push(\`--\${boundary}\\r\\n\${headers}\\r\\n\\r\\n\`, content, '\\r\\n');
    }
    chunks.push(\`--\${boundary}--\\r\\n\`);
    const contentType = \`multipart/form-data; boundary=\${boundary}\`;
    // The Blob carries the type too: axios (Node.js) sends a Blob's own type as Content-Type.
    return { body: new Blob(chunks, { type: contentType }), contentType };
}
/** Converts an object into \`FormData\`. Arrays are sent as repeated fields unless \`explode: false\`. */
export function toFormData(body, encoding) {
    const form = new FormData();
    if (!isObject(body))
        return form;
    for (const [name, value] of entriesOf(body)) {
        const propertyEncoding = encoding?.[name];
        if (Array.isArray(value) && propertyEncoding?.explode !== false) {
            for (const item of value)
                appendFormValue(form, name, item, propertyEncoding?.contentType);
        }
        else if (Array.isArray(value)) {
            form.append(name, value.map(primitiveToString).join(DELIMITERS[propertyEncoding?.style ?? 'form'] ?? ','));
        }
        else {
            appendFormValue(form, name, value, propertyEncoding?.contentType);
        }
    }
    return form;
}
/** Appends an object property of a form body that declares \`style\` or \`explode\`. */
function appendStyledObject(params, name, value, encoding) {
    const style = encoding.style ?? 'form';
    if (style === 'deepObject') {
        for (const [path, item] of deepObjectPairs(name, value, (key) => key))
            params.append(path, primitiveToString(item));
    }
    else if (style === 'form' && encoding.explode !== false) {
        for (const [property, item] of entriesOf(value))
            params.append(property, primitiveToString(item));
    }
    else {
        const flat = entriesOf(value).flatMap(([property, item]) => [
            property,
            primitiveToString(item),
        ]);
        params.append(name, flat.join(DELIMITERS[style] ?? ','));
    }
}
/**
 * Converts an object into \`URLSearchParams\` (\`form\` style). Nested objects are sent as JSON unless
 * their \`encoding\` declares a \`style\` or \`explode\` (\`deepObject\` sends \`name[key]=value\`).
 */
export function toSearchParams(body, encoding) {
    const params = new URLSearchParams();
    if (!isObject(body))
        return params;
    for (const [name, value] of entriesOf(body)) {
        if (value === null)
            continue;
        const propertyEncoding = encoding?.[name];
        if (Array.isArray(value)) {
            if (propertyEncoding?.explode === false) {
                params.append(name, value.map(primitiveToString).join(DELIMITERS[propertyEncoding.style ?? 'form'] ?? ','));
            }
            else {
                for (const item of value)
                    params.append(name, primitiveToString(item));
            }
        }
        else if (isObject(value)) {
            if (propertyEncoding?.style !== undefined || propertyEncoding?.explode !== undefined)
                appendStyledObject(params, name, value, propertyEncoding);
            else
                params.append(name, JSON.stringify(value));
        }
        else {
            params.append(name, primitiveToString(value));
        }
    }
    return params;
}
/**
 * Joins a base URL and a path without duplicating slashes. A query string in the base URL is kept
 * after the path and combined with \`query\`.
 */
export function joinUrl(baseUrl, path, query) {
    const queryStart = baseUrl.indexOf('?');
    const basePath = queryStart === -1 ? baseUrl : baseUrl.slice(0, queryStart);
    const baseQuery = queryStart === -1 ? '' : baseUrl.slice(queryStart + 1);
    const url = (basePath.endsWith('/') ? basePath.slice(0, -1) : basePath) + path;
    const search = [baseQuery, query].filter((part) => part !== '').join('&');
    if (search === '')
        return url;
    return url + (url.includes('?') ? '&' : '?') + search;
}
`,"/assets/runtime/serialization.ts":`import type {
  ParamLocation,
  ParamSerialization,
  ParamStyle,
  ParseAs,
  PropertyEncoding,
} from './types.js';

const DEFAULT_STYLE: Readonly<Record<ParamLocation, ParamStyle>> = {
  path: 'simple',
  query: 'form',
  header: 'simple',
  cookie: 'form',
};

const DELIMITERS: Readonly<Partial<Record<ParamStyle, string>>> = {
  spaceDelimited: ' ',
  pipeDelimited: '|',
  tabDelimited: '\\t',
};

type Encoder = (value: string) => string;

const encodeStrict: Encoder = (value) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => \`%\${c.charCodeAt(0).toString(16).toUpperCase()}\`,
  );

/**
 * Keeps RFC 3986 reserved characters, as requested by \`allowReserved\`. Percent signs are kept only
 * when they start a percent-encoded octet, so the result is always valid percent-encoding.
 */
const encodeReserved: Encoder = (value) =>
  value.replace(/%(?![0-9A-Fa-f]{2})|[^A-Za-z0-9\\-._~:/?#[\\]@!$&'()*+,;=%]/gu, (c) =>
    encodeURIComponent(c),
  );

function isObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)
  );
}

/** Converts a primitive (or Date) to its string form. */
export function primitiveToString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
    return String(value);
  // JSON.stringify returns undefined for undefined, functions and symbols.
  const json: unknown = JSON.stringify(value);
  return typeof json === 'string' ? json : '';
}

function entriesOf(value: Record<string, unknown>): [string, unknown][] {
  return Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .map((key) => [key, value[key]]);
}

function settings(
  location: ParamLocation,
  serialization: ParamSerialization | undefined,
): {
  style: ParamStyle;
  explode: boolean;
  encode: Encoder;
  json: boolean;
} {
  const style = serialization?.style ?? DEFAULT_STYLE[location];
  return {
    style,
    explode: serialization?.explode ?? (style === 'form' || style === 'cookie'),
    encode: serialization?.allowReserved === true ? encodeReserved : encodeStrict,
    json: serialization?.json === true,
  };
}

/** Serializes one path parameter value (\`simple\`, \`label\` or \`matrix\` style). */
export function serializePathParam(
  name: string,
  value: unknown,
  serialization?: ParamSerialization,
): string {
  const { style, explode, encode, json } = settings('path', serialization);
  if (json) return encode(JSON.stringify(value));
  const prefix = style === 'label' ? '.' : style === 'matrix' ? \`;\${name}=\` : '';
  if (Array.isArray(value)) {
    const items = value.map((item) => encode(primitiveToString(item)));
    if (style === 'matrix' && explode) return items.map((item) => \`;\${name}=\${item}\`).join('');
    const separator = style === 'label' && explode ? '.' : (DELIMITERS[style] ?? ',');
    return prefix + items.join(separator === ' ' ? '%20' : separator === '\\t' ? '%09' : separator);
  }
  if (isObject(value)) {
    const pairs = entriesOf(value);
    if (explode) {
      const separator = style === 'label' ? '.' : style === 'matrix' ? ';' : ',';
      const body = pairs
        .map(([key, item]) => \`\${encode(key)}=\${encode(primitiveToString(item))}\`)
        .join(separator);
      return style === 'matrix' ? \`;\${body}\` : style === 'label' ? \`.\${body}\` : body;
    }
    return (
      prefix +
      pairs.flatMap(([key, item]) => [encode(key), encode(primitiveToString(item))]).join(',')
    );
  }
  if (style === 'matrix' && value === '') return \`;\${name}\`;
  return prefix + encode(primitiveToString(value));
}

/** Replaces \`{name}\` segments in a path template. Throws when a value is missing. */
export function interpolatePath(
  path: string,
  values: Readonly<Record<string, unknown>> | undefined,
  styles: Readonly<Record<string, ParamSerialization>> | undefined,
): string {
  return path.replace(/\\{([^}]+)\\}/g, (_match, name: string) => {
    const value = values?.[name];
    if (value === undefined || value === null) {
      throw new TypeError(\`Missing required path parameter "\${name}"\`);
    }
    return serializePathParam(name, value, styles?.[name]);
  });
}

/** Serializes query parameters into a query string without the leading \`?\`. */
export function serializeQuery(
  values: Readonly<Record<string, unknown>> | undefined,
  styles: Readonly<Record<string, ParamSerialization>> | undefined,
): string {
  if (values === undefined) return '';
  const parts: string[] = [];
  for (const name of Object.keys(values)) {
    const value = values[name];
    if (value === undefined || value === null) continue;
    const { style, explode, encode, json } = settings('query', styles?.[name]);
    const key = encodeStrict(name);
    if (json) {
      parts.push(\`\${key}=\${encode(JSON.stringify(value))}\`);
    } else if (Array.isArray(value)) {
      const items = value
        .filter((item) => item !== undefined && item !== null)
        .map((item) => encode(primitiveToString(item)));
      if (items.length === 0) continue;
      const delimiter = DELIMITERS[style];
      if (style === 'form' && explode) parts.push(...items.map((item) => \`\${key}=\${item}\`));
      else if (delimiter !== undefined) parts.push(\`\${key}=\${items.join(encodeStrict(delimiter))}\`);
      else parts.push(\`\${key}=\${items.join(',')}\`);
    } else if (isObject(value)) {
      if (style === 'deepObject') {
        for (const [path, item] of deepObjectPairs(key, value, encodeStrict))
          parts.push(\`\${path}=\${encode(primitiveToString(item))}\`);
      } else if (explode) {
        for (const [property, item] of entriesOf(value)) {
          parts.push(\`\${encodeStrict(property)}=\${encode(primitiveToString(item))}\`);
        }
      } else {
        const flat = entriesOf(value).flatMap(([property, item]) => [
          encode(property),
          encode(primitiveToString(item)),
        ]);
        const delimiter = DELIMITERS[style];
        parts.push(\`\${key}=\${flat.join(delimiter === undefined ? ',' : encodeStrict(delimiter))}\`);
      }
    } else {
      parts.push(\`\${key}=\${encode(primitiveToString(value))}\`);
    }
  }
  return parts.join('&');
}

/**
 * \`deepObject\` pairs: bracketed key paths (\`filter[a][0]\`, property names passed through
 * \`encodeKey\`) and the primitive values at their ends.
 */
function deepObjectPairs(
  prefix: string,
  value: unknown,
  encodeKey: Encoder,
): [path: string, value: unknown][] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => deepObjectPairs(\`\${prefix}[\${index}]\`, item, encodeKey));
  }
  if (isObject(value)) {
    return entriesOf(value).flatMap(([key, item]) =>
      deepObjectPairs(\`\${prefix}[\${encodeKey(key)}]\`, item, encodeKey),
    );
  }
  if (value === undefined || value === null) return [];
  return [[prefix, value]];
}

/** Serializes a header parameter (\`simple\` style). */
export function serializeHeader(value: unknown, serialization?: ParamSerialization): string {
  if (serialization?.json === true) return JSON.stringify(value);
  const explode = serialization?.explode ?? false;
  if (Array.isArray(value)) return value.map(primitiveToString).join(',');
  if (isObject(value)) {
    const pairs = entriesOf(value);
    return explode
      ? pairs.map(([key, item]) => \`\${key}=\${primitiveToString(item)}\`).join(',')
      : pairs.flatMap(([key, item]) => [key, primitiveToString(item)]).join(',');
  }
  return primitiveToString(value);
}

/** Builds a \`Cookie\` header value. Browsers ignore this header; cookies are sent by the browser. */
export function serializeCookies(
  values: Readonly<Record<string, unknown>> | undefined,
  styles: Readonly<Record<string, ParamSerialization>> | undefined,
): string {
  if (values === undefined) return '';
  const parts: string[] = [];
  for (const name of Object.keys(values)) {
    const value = values[name];
    if (value === undefined || value === null) continue;
    const serialization = styles?.[name];
    if (serialization?.style === 'cookie') {
      parts.push(cookieStyle(name, value, serialization.explode ?? true));
      continue;
    }
    const text =
      serialization?.json === true
        ? JSON.stringify(value)
        : Array.isArray(value)
          ? value.map(primitiveToString).join(',')
          : isObject(value)
            ? entriesOf(value)
                .flatMap(([key, item]) => [key, primitiveToString(item)])
                .join(',')
            : primitiveToString(value);
    parts.push(\`\${name}=\${encodeStrict(text)}\`);
  }
  return parts.join('; ');
}

/**
 * OpenAPI 3.2 \`style: cookie\`: like \`form\`, but pairs are separated by \`; \` and nothing is
 * percent-encoded (values must already be escaped as the cookie requires).
 */
function cookieStyle(name: string, value: unknown, explode: boolean): string {
  if (Array.isArray(value)) {
    const items = value.map(primitiveToString);
    return explode
      ? items.map((item) => \`\${name}=\${item}\`).join('; ')
      : \`\${name}=\${items.join(',')}\`;
  }
  if (isObject(value)) {
    const pairs = entriesOf(value);
    return explode
      ? pairs.map(([key, item]) => \`\${key}=\${primitiveToString(item)}\`).join('; ')
      : \`\${name}=\${pairs.flatMap(([key, item]) => [key, primitiveToString(item)]).join(',')}\`;
  }
  return \`\${name}=\${primitiveToString(value)}\`;
}

/**
 * Serializes an OpenAPI 3.2 \`querystring\` parameter: the whole query string, without \`?\`. Form
 * content uses \`application/x-www-form-urlencoded\` rules; other media types are serialized (JSON
 * as JSON text, anything else as a string) and percent-encoded.
 */
export function serializeQuerystring(
  value: unknown,
  mediaType: string,
  encoding?: Readonly<Record<string, PropertyEncoding>>,
): string {
  if (value === undefined || value === null) return '';
  const type = (mediaType.split(';')[0] ?? '').trim().toLowerCase();
  if (type === 'application/x-www-form-urlencoded') {
    const params =
      typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams
        ? value
        : toSearchParams(value, encoding);
    return params.toString();
  }
  const text = isJsonMediaType(type) ? JSON.stringify(value) : primitiveToString(value);
  return encodeURIComponent(text);
}

/** Whether a media type carries JSON (\`application/json\`, \`application/problem+json\`, ...). */
export function isJsonMediaType(mediaType: string | null | undefined): boolean {
  if (mediaType === null || mediaType === undefined) return false;
  const type = (mediaType.split(';')[0] ?? '').trim().toLowerCase();
  return type === 'application/json' || type.endsWith('+json') || type === 'text/json';
}

/**
 * How a transport reads a response body: \`parseAs\` applies to successful and redirect statuses;
 * error bodies (other statuses) are read by their \`Content-Type\` (\`auto\`), so \`ApiError.body\`
 * matches the error response's declared type. \`stream\` keeps every body unread.
 */
export function responseParseAs(parseAs: ParseAs, status: number): ParseAs {
  return parseAs === 'stream' || (status >= 200 && status < 400) ? parseAs : 'auto';
}

/** Whether a response of this (non-JSON) media type is read as text rather than as a \`Blob\`. */
export function isTextMediaType(mediaType: string): boolean {
  const type = (mediaType.split(';')[0] ?? '').trim().toLowerCase();
  return (
    type.startsWith('text/') ||
    type === 'application/xml' ||
    type.endsWith('+xml') ||
    type === 'application/x-www-form-urlencoded' ||
    type === 'application/javascript' ||
    // Sequences of JSON values (JSON Lines, NDJSON, JSON text sequences) are read as text.
    type === 'application/jsonl' ||
    type === 'application/x-ndjson' ||
    type === 'application/json-seq' ||
    type.endsWith('+json-seq')
  );
}

function isBinaryLike(value: unknown): boolean {
  return (
    (typeof Blob !== 'undefined' && value instanceof Blob) ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream)
  );
}

function isNativeBody(value: unknown): boolean {
  return (
    typeof value === 'string' ||
    isBinaryLike(value) ||
    (typeof FormData !== 'undefined' && value instanceof FormData) ||
    (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams)
  );
}

export interface SerializedBody {
  readonly body: unknown;
  /** Content-Type to send; \`undefined\` lets the transport choose (e.g. multipart boundaries). */
  readonly contentType: string | undefined;
}

/** Serializes a request body for its media type. */
export function serializeBody(
  body: unknown,
  mediaType: string | undefined,
  encoding?: Readonly<Record<string, PropertyEncoding>>,
): SerializedBody {
  if (body === undefined) return { body: undefined, contentType: undefined };
  const type = (mediaType?.split(';')[0] ?? '').trim().toLowerCase();
  if (type === 'multipart/form-data') {
    if (typeof FormData !== 'undefined' && body instanceof FormData)
      return { body, contentType: undefined };
    // \`FormData\` can only label a part with a Content-Type by sending it as a file (a \`Blob\`, with
    // a filename), which servers then treat as an upload: such bodies are encoded here instead.
    if (needsPartHeaders(body, encoding)) return toMultipartBody(body, encoding);
    return { body: toFormData(body, encoding), contentType: undefined };
  }
  if (type === 'application/x-www-form-urlencoded') {
    const isParams = typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams;
    return { body: isParams ? body : toSearchParams(body, encoding), contentType: mediaType };
  }
  // A wildcard (\`*/*\`, \`text/*\`) is not a Content-Type: JSON is labeled as such, and native bodies
  // get the transport's default (e.g. a Blob's own type).
  const wildcard = type.endsWith('*');
  if (type === '' || wildcard || isJsonMediaType(type)) {
    if ((type === '' || wildcard) && isNativeBody(body)) return { body, contentType: undefined };
    if (wildcard && type.startsWith('text/'))
      return { body: primitiveToString(body), contentType: undefined };
    return {
      body: JSON.stringify(body),
      contentType: mediaType === undefined || wildcard ? 'application/json' : mediaType,
    };
  }
  if (type.startsWith('text/'))
    return { body: isNativeBody(body) ? body : primitiveToString(body), contentType: mediaType };
  if (isNativeBody(body)) return { body, contentType: mediaType };
  return { body: JSON.stringify(body), contentType: mediaType };
}

function appendFormValue(
  form: FormData,
  name: string,
  value: unknown,
  contentType: string | undefined,
): void {
  if (value === undefined || value === null) return;
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    form.append(name, value);
  } else if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    form.append(name, bytesToBlob(value, contentType));
  } else if (isObject(value) || Array.isArray(value)) {
    const json = JSON.stringify(value);
    form.append(name, contentType === undefined ? json : new Blob([json], { type: contentType }));
  } else {
    form.append(name, primitiveToString(value));
  }
}

/** Copies bytes into an \`ArrayBuffer\`-backed view, which every \`Blob\` implementation accepts. */
function bytesToBlob(value: ArrayBuffer | ArrayBufferView, contentType: string | undefined): Blob {
  const source =
    value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  return new Blob([copy], contentType === undefined ? {} : { type: contentType });
}

/** A part's declared Content-Type, when it names one type (not a list or a range like \`image/*\`). */
function concreteType(contentType: string | undefined): string | undefined {
  if (contentType === undefined || contentType.includes(',') || contentType.includes('*'))
    return undefined;
  return contentType.trim();
}

/** The parts of a form body: each array item is a part unless \`explode: false\` joins them. */
function formParts(
  body: unknown,
  encoding: Readonly<Record<string, PropertyEncoding>> | undefined,
): [name: string, value: unknown, contentType: string | undefined][] {
  const parts: [string, unknown, string | undefined][] = [];
  if (!isObject(body)) return parts;
  for (const [name, value] of entriesOf(body)) {
    const propertyEncoding = encoding?.[name];
    if (Array.isArray(value) && propertyEncoding?.explode !== false) {
      for (const item of value) parts.push([name, item, propertyEncoding?.contentType]);
    } else if (Array.isArray(value)) {
      const joined = value
        .map(primitiveToString)
        .join(DELIMITERS[propertyEncoding?.style ?? 'form'] ?? ',');
      parts.push([name, joined, undefined]);
    } else {
      parts.push([name, value, propertyEncoding?.contentType]);
    }
  }
  return parts;
}

const isBlob = (value: unknown): value is Blob =>
  typeof Blob !== 'undefined' && value instanceof Blob;

/**
 * Whether a part that is not a file needs a Content-Type: objects (JSON, OpenAPI's default for
 * them) and values whose encoding declares one.
 */
function needsPartHeaders(
  body: unknown,
  encoding: Readonly<Record<string, PropertyEncoding>> | undefined,
): boolean {
  return formParts(body, encoding).some(([, value, contentType]) => {
    if (value === undefined || value === null || isBlob(value)) return false;
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return false;
    return isObject(value) || Array.isArray(value) || concreteType(contentType) !== undefined;
  });
}

/** Escapes a part name or filename as browsers do in \`FormData\` bodies (line breaks, quotes). */
function dispositionValue(value: string): string {
  return value.replace(/\\r\\n|\\r|\\n/g, '%0D%0A').replace(/"/g, '%22');
}

/**
 * Encodes a \`multipart/form-data\` body by hand, so parts that are not files carry their
 * Content-Type without a filename. Files keep theirs (a \`File\`'s name, otherwise \`blob\`).
 */
export function toMultipartBody(
  body: unknown,
  encoding?: Readonly<Record<string, PropertyEncoding>>,
): { body: Blob; contentType: string } {
  const random = (): string => Math.random().toString(16).slice(2, 14).padEnd(12, '0');
  const boundary = \`----swaggerz\${random()}\${random()}\`;
  const chunks: (string | Blob)[] = [];
  for (const [name, value, declared] of formParts(body, encoding)) {
    if (value === undefined || value === null) continue;
    const contentType = concreteType(declared);
    let headers = \`Content-Disposition: form-data; name="\${dispositionValue(name)}"\`;
    let content: string | Blob;
    if (isBlob(value) || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      const blob = isBlob(value) ? value : bytesToBlob(value, undefined);
      const filename = typeof File !== 'undefined' && value instanceof File ? value.name : 'blob';
      const type = blob.type === '' ? (contentType ?? 'application/octet-stream') : blob.type;
      headers += \`; filename="\${dispositionValue(filename)}"\\r\\nContent-Type: \${type}\`;
      content = blob;
    } else if (isObject(value) || Array.isArray(value)) {
      headers += \`\\r\\nContent-Type: \${contentType ?? 'application/json'}\`;
      content = JSON.stringify(value);
    } else {
      if (contentType !== undefined) headers += \`\\r\\nContent-Type: \${contentType}\`;
      content = primitiveToString(value);
    }
    chunks.push(\`--\${boundary}\\r\\n\${headers}\\r\\n\\r\\n\`, content, '\\r\\n');
  }
  chunks.push(\`--\${boundary}--\\r\\n\`);
  const contentType = \`multipart/form-data; boundary=\${boundary}\`;
  // The Blob carries the type too: axios (Node.js) sends a Blob's own type as Content-Type.
  return { body: new Blob(chunks, { type: contentType }), contentType };
}

/** Converts an object into \`FormData\`. Arrays are sent as repeated fields unless \`explode: false\`. */
export function toFormData(
  body: unknown,
  encoding?: Readonly<Record<string, PropertyEncoding>>,
): FormData {
  const form = new FormData();
  if (!isObject(body)) return form;
  for (const [name, value] of entriesOf(body)) {
    const propertyEncoding = encoding?.[name];
    if (Array.isArray(value) && propertyEncoding?.explode !== false) {
      for (const item of value) appendFormValue(form, name, item, propertyEncoding?.contentType);
    } else if (Array.isArray(value)) {
      form.append(
        name,
        value.map(primitiveToString).join(DELIMITERS[propertyEncoding?.style ?? 'form'] ?? ','),
      );
    } else {
      appendFormValue(form, name, value, propertyEncoding?.contentType);
    }
  }
  return form;
}

/** Appends an object property of a form body that declares \`style\` or \`explode\`. */
function appendStyledObject(
  params: URLSearchParams,
  name: string,
  value: Record<string, unknown>,
  encoding: PropertyEncoding,
): void {
  const style = encoding.style ?? 'form';
  if (style === 'deepObject') {
    for (const [path, item] of deepObjectPairs(name, value, (key) => key))
      params.append(path, primitiveToString(item));
  } else if (style === 'form' && encoding.explode !== false) {
    for (const [property, item] of entriesOf(value))
      params.append(property, primitiveToString(item));
  } else {
    const flat = entriesOf(value).flatMap(([property, item]) => [
      property,
      primitiveToString(item),
    ]);
    params.append(name, flat.join(DELIMITERS[style] ?? ','));
  }
}

/**
 * Converts an object into \`URLSearchParams\` (\`form\` style). Nested objects are sent as JSON unless
 * their \`encoding\` declares a \`style\` or \`explode\` (\`deepObject\` sends \`name[key]=value\`).
 */
export function toSearchParams(
  body: unknown,
  encoding?: Readonly<Record<string, PropertyEncoding>>,
): URLSearchParams {
  const params = new URLSearchParams();
  if (!isObject(body)) return params;
  for (const [name, value] of entriesOf(body)) {
    if (value === null) continue;
    const propertyEncoding = encoding?.[name];
    if (Array.isArray(value)) {
      if (propertyEncoding?.explode === false) {
        params.append(
          name,
          value.map(primitiveToString).join(DELIMITERS[propertyEncoding.style ?? 'form'] ?? ','),
        );
      } else {
        for (const item of value) params.append(name, primitiveToString(item));
      }
    } else if (isObject(value)) {
      if (propertyEncoding?.style !== undefined || propertyEncoding?.explode !== undefined)
        appendStyledObject(params, name, value, propertyEncoding);
      else params.append(name, JSON.stringify(value));
    } else {
      params.append(name, primitiveToString(value));
    }
  }
  return params;
}

/**
 * Joins a base URL and a path without duplicating slashes. A query string in the base URL is kept
 * after the path and combined with \`query\`.
 */
export function joinUrl(baseUrl: string, path: string, query: string): string {
  const queryStart = baseUrl.indexOf('?');
  const basePath = queryStart === -1 ? baseUrl : baseUrl.slice(0, queryStart);
  const baseQuery = queryStart === -1 ? '' : baseUrl.slice(queryStart + 1);
  const url = (basePath.endsWith('/') ? basePath.slice(0, -1) : basePath) + path;
  const search = [baseQuery, query].filter((part) => part !== '').join('&');
  if (search === '') return url;
  return url + (url.includes('?') ? '&' : '?') + search;
}
`,"/assets/runtime/signal.d.ts":`export interface LinkedSignal {
    /** Aborts when the caller's signal aborts or the timeout elapses. */
    readonly signal: AbortSignal | undefined;
    /** Whether the timeout (not the caller) caused the abort. */
    timedOut(): boolean;
    /** Clears the timer and listeners. */
    dispose(): void;
}
/** Combines an optional caller signal with an optional timeout in milliseconds. */
export declare function linkSignal(signal: AbortSignal | undefined, timeout: number | undefined): LinkedSignal;
/** Returns a signal that aborts when any of the given signals aborts. */
export declare function anySignal(...signals: readonly (AbortSignal | undefined)[]): AbortSignal | undefined;
`,"/assets/runtime/signal.js":`/** Combines an optional caller signal with an optional timeout in milliseconds. */
export function linkSignal(signal, timeout) {
    if (timeout === undefined || timeout <= 0) {
        return { signal, timedOut: () => false, dispose: () => undefined };
    }
    const controller = new AbortController();
    let didTimeout = false;
    const onAbort = () => {
        controller.abort(signal?.reason);
    };
    if (signal?.aborted === true)
        controller.abort(signal.reason);
    else
        signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => {
        didTimeout = true;
        controller.abort(new Error(\`Timed out after \${timeout} ms\`));
    }, timeout);
    return {
        signal: controller.signal,
        timedOut: () => didTimeout,
        dispose: () => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
        },
    };
}
/** Returns a signal that aborts when any of the given signals aborts. */
export function anySignal(...signals) {
    const active = signals.filter((signal) => signal !== undefined);
    if (active.length <= 1)
        return active[0];
    const controller = new AbortController();
    const cleanups = [];
    const abort = (reason) => {
        for (const cleanup of cleanups)
            cleanup();
        controller.abort(reason);
    };
    for (const signal of active) {
        if (signal.aborted) {
            abort(signal.reason);
            return controller.signal;
        }
        const listener = () => {
            abort(signal.reason);
        };
        signal.addEventListener('abort', listener, { once: true });
        cleanups.push(() => {
            signal.removeEventListener('abort', listener);
        });
    }
    return controller.signal;
}
`,"/assets/runtime/signal.ts":`export interface LinkedSignal {
  /** Aborts when the caller's signal aborts or the timeout elapses. */
  readonly signal: AbortSignal | undefined;
  /** Whether the timeout (not the caller) caused the abort. */
  timedOut(): boolean;
  /** Clears the timer and listeners. */
  dispose(): void;
}

/** Combines an optional caller signal with an optional timeout in milliseconds. */
export function linkSignal(
  signal: AbortSignal | undefined,
  timeout: number | undefined,
): LinkedSignal {
  if (timeout === undefined || timeout <= 0) {
    return { signal, timedOut: () => false, dispose: () => undefined };
  }
  const controller = new AbortController();
  let didTimeout = false;
  const onAbort = (): void => {
    controller.abort(signal?.reason);
  };
  if (signal?.aborted === true) controller.abort(signal.reason);
  else signal?.addEventListener('abort', onAbort, { once: true });
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
    didTimeout = true;
    controller.abort(new Error(\`Timed out after \${timeout} ms\`));
  }, timeout);
  return {
    signal: controller.signal,
    timedOut: () => didTimeout,
    dispose: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

/** Returns a signal that aborts when any of the given signals aborts. */
export function anySignal(
  ...signals: readonly (AbortSignal | undefined)[]
): AbortSignal | undefined {
  const active = signals.filter((signal): signal is AbortSignal => signal !== undefined);
  if (active.length <= 1) return active[0];
  const controller = new AbortController();
  const cleanups: (() => void)[] = [];
  const abort = (reason: unknown): void => {
    for (const cleanup of cleanups) cleanup();
    controller.abort(reason);
  };
  for (const signal of active) {
    if (signal.aborted) {
      abort(signal.reason);
      return controller.signal;
    }
    const listener = (): void => {
      abort(signal.reason);
    };
    signal.addEventListener('abort', listener, { once: true });
    cleanups.push(() => {
      signal.removeEventListener('abort', listener);
    });
  }
  return controller.signal;
}
`,"/assets/runtime/types.d.ts":`/**
 * HTTP methods used by generated operations: the standard ones, \`QUERY\`, and any other method an
 * OpenAPI 3.2 description declares (sent exactly as declared).
 */
export type HttpMethod = 'GET' | 'PUT' | 'POST' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'PATCH' | 'TRACE' | 'QUERY' | (string & {});
type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type ToNumber<T> = T extends \`\${infer N extends number}\` ? N : never;
/**
 * HTTP status codes from 100 to 599 as literal types, optionally of some classes only:
 * \`HttpStatus<4>\` is 400–499 and \`HttpStatus<4 | 5>\` 400–599. Generated error types use it to
 * describe the statuses a response does not declare, so that \`error.status === 404\` narrows.
 */
export type HttpStatus<TClass extends 1 | 2 | 3 | 4 | 5 = 1 | 2 | 3 | 4 | 5> = ToNumber<\`\${TClass}\${Digit}\${Digit}\`>;
/** How a response body is read. \`auto\` decides from the \`Content-Type\` header. */
export type ParseAs = 'auto' | 'json' | 'text' | 'blob' | 'arrayBuffer' | 'stream';
/**
 * Parameter serialization styles (OpenAPI 3 \`style\`, \`tabDelimited\` for Swagger 2.0, and
 * OpenAPI 3.2's \`cookie\`).
 */
export type ParamStyle = 'form' | 'simple' | 'label' | 'matrix' | 'spaceDelimited' | 'pipeDelimited' | 'tabDelimited' | 'deepObject' | 'cookie';
export type ParamLocation = 'path' | 'query' | 'header' | 'cookie';
/** Non-default serialization of one parameter. */
export interface ParamSerialization {
    readonly style?: ParamStyle;
    readonly explode?: boolean;
    readonly allowReserved?: boolean;
    /** Serialize the value as JSON (parameters declared with \`content\`). */
    readonly json?: boolean;
}
/** Serialization of one property of a form or multipart body. */
export interface PropertyEncoding {
    readonly contentType?: string;
    readonly style?: ParamStyle;
    readonly explode?: boolean;
}
/** Credentials as a value or a (possibly async) function evaluated per request. */
export type AuthValue = string | undefined | (() => string | undefined | Promise<string | undefined>);
/**
 * A security scheme declared by the API. \`apiKey\` values are sent as-is; \`http\` bearer, \`oauth2\`
 * and \`openIdConnect\` values are sent as \`Authorization: Bearer <token>\`; \`http\` basic values
 * must be \`username:password\` and are base64-encoded.
 */
export type SecurityScheme = {
    readonly type: 'apiKey';
    readonly in: 'header' | 'query' | 'cookie';
    readonly name: string;
} | {
    readonly type: 'http';
    readonly scheme: string;
} | {
    readonly type: 'oauth2';
} | {
    readonly type: 'openIdConnect';
};
/** Request description produced by a generated operation function. */
export interface OperationRequest {
    readonly operationId: string;
    readonly method: HttpMethod;
    /** Path template, e.g. \`/pets/{petId}\`. */
    readonly path: string;
    readonly pathParams?: Readonly<Record<string, unknown>>;
    readonly query?: Readonly<Record<string, unknown>>;
    readonly headers?: Readonly<Record<string, unknown>>;
    readonly cookies?: Readonly<Record<string, unknown>>;
    /**
     * OpenAPI 3.2 \`in: querystring\`: the whole query string as one value, serialized by its media
     * type (form-urlencoded, JSON, or text).
     */
    readonly querystring?: {
        readonly value: unknown;
        readonly mediaType: string;
        readonly encoding?: Readonly<Record<string, PropertyEncoding>>;
    };
    /** Non-default parameter serialization, by location and wire name. */
    readonly styles?: Readonly<Partial<Record<ParamLocation, Readonly<Record<string, ParamSerialization>>>>>;
    readonly body?: unknown;
    /** Request media type, e.g. \`application/json\` or \`multipart/form-data\`. */
    readonly mediaType?: string;
    readonly encoding?: Readonly<Record<string, PropertyEncoding>>;
    /** Base URL of a server declared by the operation or its path; see \`ClientConfig.operationServers\`. */
    readonly server?: string;
    /** Declared non-2xx statuses that resolve instead of rejecting, e.g. \`304\` or \`3XX\`. */
    readonly successStatuses?: readonly string[];
    /** Preferred response media type for the \`Accept\` header. */
    readonly accept?: string;
    /** Alternative security requirements (scheme keys that must be applied together). */
    readonly security?: readonly (readonly string[])[];
    readonly parseAs?: ParseAs;
    /** Validates the request body before it is serialized (generated when request validation is enabled). */
    readonly validateBody?: (body: unknown) => unknown;
    /** Validates/transforms successful response data (generated when runtime validation is enabled). */
    readonly validateResponse?: (data: unknown) => unknown;
    /** Converts the request body to its wire form (e.g. \`Date\` values to strings) before validation. */
    readonly encodeBody?: (body: unknown) => unknown;
    /** Converts successful response data from its wire form, e.g. date strings to \`Date\`. */
    readonly transformResponse?: (data: unknown) => unknown;
}
/** Normalized request passed to a transport after serialization and middleware. */
export interface TransportRequest<TTransportOptions = unknown> {
    readonly operationId: string;
    readonly method: HttpMethod;
    /** Fully resolved URL including the query string. May be relative when \`baseUrl\` is empty. */
    url: string;
    readonly headers: Headers;
    body: unknown;
    signal: AbortSignal | undefined;
    credentials: 'omit' | 'same-origin' | 'include' | undefined;
    parseAs: ParseAs;
    /** Transport-specific per-request options. */
    transportOptions: TTransportOptions | undefined;
}
/** Response returned by a transport, with the body already read according to \`parseAs\`. */
export interface TransportResponse {
    readonly status: number;
    readonly statusText: string;
    readonly headers: Headers;
    readonly data: unknown;
    /** The underlying response object (\`Response\` for fetch, \`AxiosResponse\` for axios). */
    readonly raw: unknown;
    /** The underlying error, when the transport reported the response as a failure (axios). */
    readonly error?: unknown;
}
/** A transport sends a request and returns the response. It must not throw for HTTP errors. */
export type Transport<TTransportOptions = unknown> = (request: TransportRequest<TTransportOptions>) => Promise<TransportResponse>;
/** Successful response with metadata, returned when the client uses \`responseStyle: 'full'\`. */
export interface ApiResponse<TData, TStatus extends number = number> {
    readonly data: TData;
    readonly status: TStatus;
    readonly statusText: string;
    readonly headers: Headers;
    readonly raw: unknown;
}
/**
 * The operation a request belongs to. The same object is passed for every attempt of one call, so
 * middleware can key per-call state on it (for example in a \`WeakMap\`).
 */
export interface OperationInfo {
    readonly operationId: string;
    readonly method: HttpMethod;
    readonly path: string;
    /** Alternative security requirements (scheme names) of the operation; absent without auth. */
    readonly security?: readonly (readonly string[])[];
}
declare const retryDirective: unique symbol;
/** Returned from \`onResponse\` or \`onError\` (via \`context.retry()\`) to send the request again. */
export interface RetryDirective {
    readonly [retryDirective]: true;
}
/** What every middleware hook receives. */
export interface MiddlewareContext<TTransportOptions = unknown> {
    readonly request: TransportRequest<TTransportOptions>;
    readonly operation: OperationInfo;
    /** 1 for the first attempt of a call; each retry starts the next attempt. */
    readonly attempt: number;
    /** The client sending the request, e.g. to store a refreshed token with \`setConfig\`. */
    readonly client: Client<TTransportOptions>;
}
/** Context of \`onResponse\` and \`onError\`, which may ask for the request to be sent again. */
export interface RetryableContext<TTransportOptions = unknown> extends MiddlewareContext<TTransportOptions> {
    /**
     * Discards this attempt and sends the request again: return the result from the hook. The
     * request is built anew (headers and \`auth\` from the current config, then every \`onRequest\`),
     * and the call's timeout and signal still apply.
     */
    retry(): RetryDirective;
}
/** Hooks that run around every request. Registered with \`client.use()\`; run in order. */
export interface Middleware<TTransportOptions = unknown> {
    /** Inspect or replace the outgoing request. Runs again for every retry. */
    onRequest?(context: MiddlewareContext<TTransportOptions>): void | TransportRequest<TTransportOptions> | Promise<void | TransportRequest<TTransportOptions>>;
    /**
     * Inspect or replace the response (also called for HTTP error statuses), or return
     * \`context.retry()\` to send the request again.
     */
    onResponse?(context: RetryableContext<TTransportOptions> & {
        readonly response: TransportResponse;
    }): void | TransportResponse | RetryDirective | Promise<void | TransportResponse | RetryDirective>;
    /**
     * Called when the transport fails: return a response to recover, or \`context.retry()\` to send
     * the request again.
     */
    onError?(context: RetryableContext<TTransportOptions> & {
        readonly error: unknown;
    }): void | TransportResponse | RetryDirective | Promise<void | TransportResponse | RetryDirective>;
}
export type HeaderValues = Readonly<Record<string, string | undefined>>;
export interface ClientConfig<TTransportOptions = unknown> {
    /** Prefix for every request path. Empty for same-origin relative requests. */
    baseUrl: string;
    /**
     * Send operations that declare their own \`servers\` to that server instead of \`baseUrl\`
     * (default \`true\`). A per-call \`baseUrl\` option always wins.
     */
    operationServers?: boolean | undefined;
    transport: Transport<TTransportOptions>;
    /** Default headers, or a function computing them per request. */
    headers?: HeaderValues | (() => HeaderValues | Promise<HeaderValues>) | undefined;
    /** Credentials keyed by security scheme name. */
    auth?: Readonly<Record<string, AuthValue>> | undefined;
    securitySchemes?: Readonly<Record<string, SecurityScheme>> | undefined;
    /** Default timeout in milliseconds. */
    timeout?: number | undefined;
    credentials?: 'omit' | 'same-origin' | 'include' | undefined;
    /** Default transport-specific options merged into every request. */
    transportOptions?: TTransportOptions | undefined;
}
/** Per-call options accepted by every generated operation. */
export interface RequestOptions<TTransportOptions = unknown> {
    /** Cancels the request. */
    signal?: AbortSignal | undefined;
    /** Timeout in milliseconds; overrides the client default. */
    timeout?: number | undefined;
    /** Extra headers; \`undefined\` values remove a header. */
    headers?: HeaderValues | undefined;
    /** Overrides the client's base URL for this call. */
    baseUrl?: string | undefined;
    /** Use a different client instance (e.g. per-tenant or per-request on the server). */
    client?: Client<TTransportOptions> | undefined;
    /** Overrides how the response body is read. */
    parseAs?: ParseAs | undefined;
    /** Transport-specific options (fetch \`RequestInit\` fields or an axios request config). */
    transportOptions?: TTransportOptions | undefined;
}
export interface Client<TTransportOptions = unknown> {
    /** Returns a copy of the current configuration. */
    getConfig(): ClientConfig<TTransportOptions>;
    /** Shallow-merges configuration into the client. */
    setConfig(config: Partial<ClientConfig<TTransportOptions>>): void;
    /** Registers middleware; returns a function that removes it. */
    use(middleware: Middleware<TTransportOptions>): () => void;
    /** Sends a request and resolves with the parsed body. Throws \`ApiError\` for non-2xx statuses. */
    request<TData>(operation: OperationRequest, options?: RequestOptions<TTransportOptions>): Promise<TData>;
    /** Sends a request and resolves with data, status and headers. Throws \`ApiError\` for non-2xx statuses. */
    send<TResponse extends ApiResponse<unknown>>(operation: OperationRequest, options?: RequestOptions<TTransportOptions>): Promise<TResponse>;
}
export {};
`,"/assets/runtime/types.js":`export {};
`,"/assets/runtime/types.ts":`/**
 * HTTP methods used by generated operations: the standard ones, \`QUERY\`, and any other method an
 * OpenAPI 3.2 description declares (sent exactly as declared).
 */
export type HttpMethod =
  | 'GET'
  | 'PUT'
  | 'POST'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD'
  | 'PATCH'
  | 'TRACE'
  | 'QUERY'
  // Keeps completion for the methods above while accepting others.
  | (string & {});

type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type ToNumber<T> = T extends \`\${infer N extends number}\` ? N : never;

/**
 * HTTP status codes from 100 to 599 as literal types, optionally of some classes only:
 * \`HttpStatus<4>\` is 400–499 and \`HttpStatus<4 | 5>\` 400–599. Generated error types use it to
 * describe the statuses a response does not declare, so that \`error.status === 404\` narrows.
 */
export type HttpStatus<TClass extends 1 | 2 | 3 | 4 | 5 = 1 | 2 | 3 | 4 | 5> =
  ToNumber<\`\${TClass}\${Digit}\${Digit}\`>;

/** How a response body is read. \`auto\` decides from the \`Content-Type\` header. */
export type ParseAs = 'auto' | 'json' | 'text' | 'blob' | 'arrayBuffer' | 'stream';

/**
 * Parameter serialization styles (OpenAPI 3 \`style\`, \`tabDelimited\` for Swagger 2.0, and
 * OpenAPI 3.2's \`cookie\`).
 */
export type ParamStyle =
  | 'form'
  | 'simple'
  | 'label'
  | 'matrix'
  | 'spaceDelimited'
  | 'pipeDelimited'
  | 'tabDelimited'
  | 'deepObject'
  | 'cookie';

export type ParamLocation = 'path' | 'query' | 'header' | 'cookie';

/** Non-default serialization of one parameter. */
export interface ParamSerialization {
  readonly style?: ParamStyle;
  readonly explode?: boolean;
  readonly allowReserved?: boolean;
  /** Serialize the value as JSON (parameters declared with \`content\`). */
  readonly json?: boolean;
}

/** Serialization of one property of a form or multipart body. */
export interface PropertyEncoding {
  readonly contentType?: string;
  readonly style?: ParamStyle;
  readonly explode?: boolean;
}

/** Credentials as a value or a (possibly async) function evaluated per request. */
export type AuthValue =
  | string
  | undefined
  | (() => string | undefined | Promise<string | undefined>);

/**
 * A security scheme declared by the API. \`apiKey\` values are sent as-is; \`http\` bearer, \`oauth2\`
 * and \`openIdConnect\` values are sent as \`Authorization: Bearer <token>\`; \`http\` basic values
 * must be \`username:password\` and are base64-encoded.
 */
export type SecurityScheme =
  | { readonly type: 'apiKey'; readonly in: 'header' | 'query' | 'cookie'; readonly name: string }
  | { readonly type: 'http'; readonly scheme: string }
  | { readonly type: 'oauth2' }
  | { readonly type: 'openIdConnect' };

/** Request description produced by a generated operation function. */
export interface OperationRequest {
  readonly operationId: string;
  readonly method: HttpMethod;
  /** Path template, e.g. \`/pets/{petId}\`. */
  readonly path: string;
  readonly pathParams?: Readonly<Record<string, unknown>>;
  readonly query?: Readonly<Record<string, unknown>>;
  readonly headers?: Readonly<Record<string, unknown>>;
  readonly cookies?: Readonly<Record<string, unknown>>;
  /**
   * OpenAPI 3.2 \`in: querystring\`: the whole query string as one value, serialized by its media
   * type (form-urlencoded, JSON, or text).
   */
  readonly querystring?: {
    readonly value: unknown;
    readonly mediaType: string;
    readonly encoding?: Readonly<Record<string, PropertyEncoding>>;
  };
  /** Non-default parameter serialization, by location and wire name. */
  readonly styles?: Readonly<
    Partial<Record<ParamLocation, Readonly<Record<string, ParamSerialization>>>>
  >;
  readonly body?: unknown;
  /** Request media type, e.g. \`application/json\` or \`multipart/form-data\`. */
  readonly mediaType?: string;
  readonly encoding?: Readonly<Record<string, PropertyEncoding>>;
  /** Base URL of a server declared by the operation or its path; see \`ClientConfig.operationServers\`. */
  readonly server?: string;
  /** Declared non-2xx statuses that resolve instead of rejecting, e.g. \`304\` or \`3XX\`. */
  readonly successStatuses?: readonly string[];
  /** Preferred response media type for the \`Accept\` header. */
  readonly accept?: string;
  /** Alternative security requirements (scheme keys that must be applied together). */
  readonly security?: readonly (readonly string[])[];
  readonly parseAs?: ParseAs;
  /** Validates the request body before it is serialized (generated when request validation is enabled). */
  readonly validateBody?: (body: unknown) => unknown;
  /** Validates/transforms successful response data (generated when runtime validation is enabled). */
  readonly validateResponse?: (data: unknown) => unknown;
  /** Converts the request body to its wire form (e.g. \`Date\` values to strings) before validation. */
  readonly encodeBody?: (body: unknown) => unknown;
  /** Converts successful response data from its wire form, e.g. date strings to \`Date\`. */
  readonly transformResponse?: (data: unknown) => unknown;
}

/** Normalized request passed to a transport after serialization and middleware. */
export interface TransportRequest<TTransportOptions = unknown> {
  readonly operationId: string;
  readonly method: HttpMethod;
  /** Fully resolved URL including the query string. May be relative when \`baseUrl\` is empty. */
  url: string;
  readonly headers: Headers;
  body: unknown;
  signal: AbortSignal | undefined;
  credentials: 'omit' | 'same-origin' | 'include' | undefined;
  parseAs: ParseAs;
  /** Transport-specific per-request options. */
  transportOptions: TTransportOptions | undefined;
}

/** Response returned by a transport, with the body already read according to \`parseAs\`. */
export interface TransportResponse {
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  readonly data: unknown;
  /** The underlying response object (\`Response\` for fetch, \`AxiosResponse\` for axios). */
  readonly raw: unknown;
  /** The underlying error, when the transport reported the response as a failure (axios). */
  readonly error?: unknown;
}

/** A transport sends a request and returns the response. It must not throw for HTTP errors. */
export type Transport<TTransportOptions = unknown> = (
  request: TransportRequest<TTransportOptions>,
) => Promise<TransportResponse>;

/** Successful response with metadata, returned when the client uses \`responseStyle: 'full'\`. */
export interface ApiResponse<TData, TStatus extends number = number> {
  readonly data: TData;
  readonly status: TStatus;
  readonly statusText: string;
  readonly headers: Headers;
  readonly raw: unknown;
}

/**
 * The operation a request belongs to. The same object is passed for every attempt of one call, so
 * middleware can key per-call state on it (for example in a \`WeakMap\`).
 */
export interface OperationInfo {
  readonly operationId: string;
  readonly method: HttpMethod;
  readonly path: string;
  /** Alternative security requirements (scheme names) of the operation; absent without auth. */
  readonly security?: readonly (readonly string[])[];
}

declare const retryDirective: unique symbol;

/** Returned from \`onResponse\` or \`onError\` (via \`context.retry()\`) to send the request again. */
export interface RetryDirective {
  readonly [retryDirective]: true;
}

/** What every middleware hook receives. */
export interface MiddlewareContext<TTransportOptions = unknown> {
  readonly request: TransportRequest<TTransportOptions>;
  readonly operation: OperationInfo;
  /** 1 for the first attempt of a call; each retry starts the next attempt. */
  readonly attempt: number;
  /** The client sending the request, e.g. to store a refreshed token with \`setConfig\`. */
  readonly client: Client<TTransportOptions>;
}

/** Context of \`onResponse\` and \`onError\`, which may ask for the request to be sent again. */
export interface RetryableContext<
  TTransportOptions = unknown,
> extends MiddlewareContext<TTransportOptions> {
  /**
   * Discards this attempt and sends the request again: return the result from the hook. The
   * request is built anew (headers and \`auth\` from the current config, then every \`onRequest\`),
   * and the call's timeout and signal still apply.
   */
  retry(): RetryDirective;
}

/** Hooks that run around every request. Registered with \`client.use()\`; run in order. */
export interface Middleware<TTransportOptions = unknown> {
  /** Inspect or replace the outgoing request. Runs again for every retry. */
  onRequest?(
    context: MiddlewareContext<TTransportOptions>,
  ):
    | void
    | TransportRequest<TTransportOptions>
    | Promise<void | TransportRequest<TTransportOptions>>;
  /**
   * Inspect or replace the response (also called for HTTP error statuses), or return
   * \`context.retry()\` to send the request again.
   */
  onResponse?(
    context: RetryableContext<TTransportOptions> & { readonly response: TransportResponse },
  ): void | TransportResponse | RetryDirective | Promise<void | TransportResponse | RetryDirective>;
  /**
   * Called when the transport fails: return a response to recover, or \`context.retry()\` to send
   * the request again.
   */
  onError?(
    context: RetryableContext<TTransportOptions> & { readonly error: unknown },
  ): void | TransportResponse | RetryDirective | Promise<void | TransportResponse | RetryDirective>;
}

export type HeaderValues = Readonly<Record<string, string | undefined>>;

export interface ClientConfig<TTransportOptions = unknown> {
  /** Prefix for every request path. Empty for same-origin relative requests. */
  baseUrl: string;
  /**
   * Send operations that declare their own \`servers\` to that server instead of \`baseUrl\`
   * (default \`true\`). A per-call \`baseUrl\` option always wins.
   */
  operationServers?: boolean | undefined;
  transport: Transport<TTransportOptions>;
  /** Default headers, or a function computing them per request. */
  headers?: HeaderValues | (() => HeaderValues | Promise<HeaderValues>) | undefined;
  /** Credentials keyed by security scheme name. */
  auth?: Readonly<Record<string, AuthValue>> | undefined;
  securitySchemes?: Readonly<Record<string, SecurityScheme>> | undefined;
  /** Default timeout in milliseconds. */
  timeout?: number | undefined;
  credentials?: 'omit' | 'same-origin' | 'include' | undefined;
  /** Default transport-specific options merged into every request. */
  transportOptions?: TTransportOptions | undefined;
}

/** Per-call options accepted by every generated operation. */
export interface RequestOptions<TTransportOptions = unknown> {
  /** Cancels the request. */
  signal?: AbortSignal | undefined;
  /** Timeout in milliseconds; overrides the client default. */
  timeout?: number | undefined;
  /** Extra headers; \`undefined\` values remove a header. */
  headers?: HeaderValues | undefined;
  /** Overrides the client's base URL for this call. */
  baseUrl?: string | undefined;
  /** Use a different client instance (e.g. per-tenant or per-request on the server). */
  client?: Client<TTransportOptions> | undefined;
  /** Overrides how the response body is read. */
  parseAs?: ParseAs | undefined;
  /** Transport-specific options (fetch \`RequestInit\` fields or an axios request config). */
  transportOptions?: TTransportOptions | undefined;
}

export interface Client<TTransportOptions = unknown> {
  /** Returns a copy of the current configuration. */
  getConfig(): ClientConfig<TTransportOptions>;
  /** Shallow-merges configuration into the client. */
  setConfig(config: Partial<ClientConfig<TTransportOptions>>): void;
  /** Registers middleware; returns a function that removes it. */
  use(middleware: Middleware<TTransportOptions>): () => void;
  /** Sends a request and resolves with the parsed body. Throws \`ApiError\` for non-2xx statuses. */
  request<TData>(
    operation: OperationRequest,
    options?: RequestOptions<TTransportOptions>,
  ): Promise<TData>;
  /** Sends a request and resolves with data, status and headers. Throws \`ApiError\` for non-2xx statuses. */
  send<TResponse extends ApiResponse<unknown>>(
    operation: OperationRequest,
    options?: RequestOptions<TTransportOptions>,
  ): Promise<TResponse>;
}
`,"/assets/mocks/fake.d.ts":"/**\n * Fake data for the generated fixtures (`features.mocks`). Values are realistic (names, emails,\n * task titles, colors, files…) and seeded: the same seed always makes the same value, on every run\n * and every machine, without a dependency. Seed `0` makes the specification's examples; other\n * seeds vary every value within its schema and cover every enum value, union member, `null` and\n * absent property in turn.\n */\n/** Options of a fixture factory (`makePet(overrides, options)`). */\nexport interface FixtureOptions {\n    /**\n     * Which value to make: `0` (the default) makes the specification's examples, any other number\n     * another value, the same on every call.\n     */\n    readonly seed?: number;\n    /** Make arrays as short as their schema allows, to see empty states. */\n    readonly empty?: boolean;\n    /**\n     * The HTTP status the value is the body of (handlers pass the status they respond with). Error\n     * models follow an error status (`4XX`, `5XX`): their `status` repeats it, and their `title`,\n     * `detail` or `message`, `code` and `type` describe it.\n     */\n    readonly status?: number;\n}\n/** A pseudo-random sequence (mulberry32). */\nexport declare class Random {\n    #private;\n    constructor(seed: number);\n    /** A sequence seeded by a string. */\n    static of(text: string): Random;\n    /** A number in `[0, 1)`. */\n    next(): number;\n    /** An integer in `[min, max]`. */\n    int(min: number, max: number): number;\n    /** One of `items`. */\n    pick<T>(items: readonly [T, ...T[]]): T;\n    /** `true` with probability `rate`. */\n    chance(rate: number): boolean;\n}\n/** A source of pseudo-random numbers. */\nexport interface PatternRandom {\n    /** A number in `[0, 1)`. */\n    next(): number;\n}\n/**\n * A string matching `pattern` whose length is within `[minLength, maxLength]`, or `undefined` when\n * the pattern is not valid or no such string was found.\n */\nexport declare function samplePattern(pattern: string, random: PatternRandom, minLength?: number, maxLength?: number): string | undefined;\n/** Whether `text` matches `pattern` (`undefined` when the pattern is not valid). */\nexport declare function matchesPattern(pattern: string, text: string): boolean | undefined;\n/** A person's first and last name. */\nexport declare function personName(random: Random): readonly [string, string];\n/**\n * Text of a kind that names a person, for `person`, or `undefined` for other kinds: the `name`,\n * `email` and `username` of one object belong to the same person.\n */\nexport declare function personText(kind: TextKind, person: readonly [string, string], random: Random, example: string): string | undefined;\n/** What a text generator makes: realistic text of a kind. */\nexport type TextKind = 'words' | 'word' | 'sentence' | 'paragraph' | 'like' | 'firstName' | 'lastName' | 'fullName' | 'username' | 'email' | 'phone' | 'jobTitle' | 'company' | 'department' | 'product' | 'project' | 'task' | 'headline' | 'tag' | 'slug' | 'code' | 'street' | 'city' | 'state' | 'country' | 'countryCode' | 'postalCode' | 'address' | 'url' | 'imageUrl' | 'avatarUrl' | 'domain' | 'ipv4' | 'ipv6' | 'mac' | 'userAgent' | 'token' | 'jwt' | 'password' | 'hash' | 'uuid' | 'color' | 'mimeType' | 'fileName' | 'fileExtension' | 'filePath' | 'semver' | 'emoji' | 'currency' | 'locale' | 'language' | 'timezone' | 'sku' | 'isbn' | 'iban' | 'creditCard' | 'base64' | 'json' | 'duration' | 'regex' | 'pointer' | 'relativePointer' | 'uriReference' | 'uriTemplate' | 'integer' | 'decimal';\n/** `text` padded with words or cut to fit `[minLength, maxLength]`. */\nexport declare function fit(text: string, random: Random, minLength?: number, maxLength?: number): string;\n/** Generated text of a kind, fitted to a length. */\nexport declare function generateText(kind: TextKind, random: Random, example?: string, minLength?: number, maxLength?: number): string;\n/**\n * What a property of an error model (RFC 9457 Problem Details and the like) says about the error:\n * its reason phrase, an explanation, a code, a problem type URI, the occurrence's URI, or, in the\n * errors of single fields, the field (by name or JSON Pointer) and what is wrong with it.\n */\nexport type ErrorPart = 'title' | 'detail' | 'code' | 'type' | 'instance' | 'field' | 'pointer' | 'fieldMessage';\n/** The status the examples of error models describe, when the status is not known. */\nexport declare const DEFAULT_ERROR_STATUS = 404;\n/** What a property of an error model says about an error of `status`. */\nexport declare function errorText(part: ErrorPart, status: number, random: Random, example?: string): string;\n/** When a date usually lies: `createdAt` in the past, `dueDate` soon, `birthDate` years ago. */\nexport type DateWhen = 'past' | 'future' | 'soon' | 'birth' | 'any';\n/**\n * A date, date-time or time near `example` (or the reference date): earlier for `past`, later for\n * `future`, within weeks for `soon`, decades earlier for `birth`. Keeps the example's precision.\n */\nexport declare function dateNear(example: string | undefined, format: 'date' | 'date-time' | 'time', when: DateWhen, random: Random): string;\n/** File content of a media type: a real picture, PDF, sound, archive or text. */\nexport declare function fileContent(mediaType: string, random: Random, name?: string): Blob;\n/** The `index`th key of generated maps: `source`, `plan`, …, then `source2`, `plan2`, …. */\nexport declare function recordKey(index: number): string;\n/** A seed derived from text (never `0`), e.g. from a request. */\nexport declare function seedOf(text: string): number;\n/** How a value is written in XML (the XML Object): names, attributes, wrapping, namespaces. */\nexport interface XmlShape {\n    readonly name?: string;\n    readonly namespace?: string;\n    readonly prefix?: string;\n    readonly attribute?: boolean;\n    readonly wrapped?: boolean;\n    /** The value is its parent's text or CDATA content, or is written without an element. */\n    readonly content?: 'text' | 'cdata' | 'none';\n    readonly properties?: Readonly<Record<string, XmlShape>>;\n    readonly items?: XmlShape;\n}\n/** A value as an XML document, as its schema's XML Object describes it. */\nexport declare function xml(value: unknown, shape: XmlShape): string;\n/**\n * Items as a sequential media type writes them: JSON Lines and NDJSON (one JSON value per line),\n * JSON text sequences (RFC 7464) or server-sent events.\n */\nexport declare function sequence(items: unknown, mediaType: string): string;\n/** The seed of the fixture that made an `id`, if one did. */\nexport declare function seedOfEntity(id: string): number | undefined;\n/**\n * What generated fixtures make values with. Keys name the value within the fixture (`'owner.name'`,\n * `'tags'`), so that adding a property to a schema does not change the others.\n */\nexport declare class Fake {\n    #private;\n    constructor(options?: FixtureOptions, path?: string, root?: boolean);\n    /** Whether this makes the specification's examples (seed `0`). */\n    get canonical(): boolean;\n    /** The options of the fixture nested at `key`: examples within examples, otherwise its own seed. */\n    at(key?: string): FixtureOptions;\n    /**\n     * What `make` returns: it is told whether to make the specification's example (seed `0`, not\n     * an empty state) or another value. One callback lets TypeScript type both from the context.\n     * The examples of an error model describe one `status`; a body sent with another describes it.\n     */\n    example<T>(make: (examples: boolean) => T, status?: number): T;\n    /** Text of a kind (a name, a sentence…), or `example` for the examples. */\n    text(key: string, example: string, kind: TextKind, minLength?: number, maxLength?: number): string;\n    /** The `status` of an error model: the status the body is sent with, or `example`. */\n    errorStatus(key: string, example: number): number;\n    /**\n     * What a property of an error model says about the error (`title`, `detail`, `code`…): it\n     * describes the status the body is sent with. For the examples, `example`, which describes\n     * `examples`: a body sent with another status describes that one instead.\n     */\n    errorText(key: string, example: string, part: ErrorPart, examples?: number, minLength?: number, maxLength?: number): string;\n    /** A string matching `pattern`, or `example` for the examples. */\n    pattern(key: string, example: string, pattern: string, minLength?: number, maxLength?: number, kind?: TextKind): string;\n    /** An integer in `[min, max]`. */\n    int(key: string, example: number, min: number, max: number): number;\n    /** A number in `[min, max]` with up to `digits` decimals, excluding open bounds. */\n    number(key: string, example: number, min: number, max: number, digits?: number, exclusive?: 'none' | 'min' | 'max' | 'both'): number;\n    /** A multiple of `step` between `first * step` and `last * step`. */\n    multiple(key: string, example: number, first: number, last: number, step: number, digits: number): number;\n    /** `true` with probability `rate`. */\n    bool(key: string, example: boolean, rate?: number): boolean;\n    /** A date, date-time or time near the example. */\n    date(key: string, example: string, format: 'date' | 'date-time' | 'time', when: DateWhen): string;\n    /** One of `values`: the first for the examples. */\n    pick<T>(key: string, values: readonly [T, ...T[]]): T;\n    /** The value `make` returns for one of `count` alternatives: the first for the examples. */\n    oneOf<T>(key: string, count: number, make: (index: number) => T): T;\n    /** `null` sometimes (never for the examples), otherwise the value `make` returns. */\n    nullable<T>(key: string, make: () => T, rate?: number): T | null;\n    /**\n     * An array of `count` items for the examples, otherwise of `least` (by default `min`) to `max`\n     * items, and `min` in empty states: lists have `least` 1, so they are only empty when asked to\n     * be. Item 0 of the examples is made of examples too. With `unique`, equal items are left out.\n     */\n    array<T>(key: string, count: number, min: number, max: number, make: (item: Fake, index: number) => T, unique?: boolean, least?: number): T[];\n    /** An object with `count` (or `min` to `max`) generated keys, for maps (`additionalProperties`). */\n    record<T>(key: string, count: number, min: number, max: number, make: (item: Fake, name: string) => T): Record<string, T>;\n    /**\n     * `value` with some of its optional properties left out (none for the examples); properties of\n     * `keep` (the overrides) always stay.\n     */\n    optional<T>(path: string, value: T, keys: readonly string[], keep?: object): T;\n    /** File content of a media type (a picture, a PDF…), named after the property that holds it. */\n    file(key: string, mediaType: string): Blob;\n    /** Remembers which seed made a fixture's `id`, so that a request for it gets the same fixture. */\n    id<T>(value: T): T;\n}\n/** What a generated fixture makes its value with. */\nexport declare function fake(options?: FixtureOptions): Fake;\n","/assets/mocks/fake.js":`var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _Random_state, _Parser_instances, _Parser_source, _Parser_index, _Parser_depth, _Parser_groups, _Parser_names, _Parser_references, _Parser_checked, _Parser_lookaheads, _Parser_peek, _Parser_codePoint, _Parser_alternation, _Parser_sequence, _Parser_quantified, _Parser_atom, _Parser_group, _Parser_escape, _Parser_classEscape, _Parser_characterEscape, _Parser_class, _Parser_classAtom, _Fake_instances, _Fake_seed, _Fake_path, _Fake_empty, _Fake_status, _Fake_root, _Fake_random, _Fake_options, _Fake_person, _Fake_error;
/** FNV-1a (32 bits). */
function hash(text) {
    let value = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
        value ^= text.charCodeAt(index);
        value = Math.imul(value, 0x01000193);
    }
    return value >>> 0;
}
/** A seed for \`key\` below \`seed\`: never \`0\`, which stands for the examples. */
function mix(seed, key) {
    return hash(\`\${seed}:\${key}\`) || 1;
}
/** A pseudo-random sequence (mulberry32). */
export class Random {
    constructor(seed) {
        _Random_state.set(this, void 0);
        __classPrivateFieldSet(this, _Random_state, seed >>> 0, "f");
    }
    /** A sequence seeded by a string. */
    static of(text) {
        return new Random(hash(text));
    }
    /** A number in \`[0, 1)\`. */
    next() {
        __classPrivateFieldSet(this, _Random_state, (__classPrivateFieldGet(this, _Random_state, "f") + 0x6d2b79f5) | 0, "f");
        let value = __classPrivateFieldGet(this, _Random_state, "f");
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    }
    /** An integer in \`[min, max]\`. */
    int(min, max) {
        return min + Math.floor(this.next() * (max - min + 1));
    }
    /** One of \`items\`. */
    pick(items) {
        return items[this.int(0, items.length - 1)] ?? items[0];
    }
    /** \`true\` with probability \`rate\`. */
    chance(rate) {
        return this.next() < rate;
    }
}
_Random_state = new WeakMap();
class Unsupported extends Error {
}
const DIGITS = [[0x30, 0x39]];
const WORD = [
    [0x61, 0x7a],
    [0x41, 0x5a],
    [0x30, 0x39],
    [0x5f, 0x5f],
];
const SPACE = [
    [0x20, 0x20],
    [0x09, 0x0d],
    [0xa0, 0xa0],
    [0x1680, 0x1680],
    [0x2000, 0x200a],
    [0x2028, 0x2029],
    [0x202f, 0x202f],
    [0x205f, 0x205f],
    [0x3000, 0x3000],
    [0xfeff, 0xfeff],
];
const LINE_TERMINATORS = [
    [0x0a, 0x0a],
    [0x0d, 0x0d],
    [0x2028, 0x2029],
];
/**
 * Characters that negated classes and Unicode properties choose from: ASCII first, then letters,
 * digits and symbols of the major scripts, so that any property has members to pick.
 */
const POOL = [
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    '-_.~ !@#$%&*+=:;,?/\\'"()[]{}<>^|\`\\\\',
    'àéîõüñçßøåæÀÉÑǅʰ',
    'αβγδεζηθλμπσωΔΣΩ',
    'абвгдежзиклмнопАБВГД',
    'אבגדהוזחט',
    'ابتثجحخدذر٠١٢',
    'अआइईउकखगघ०१',
    'กขคงจฉ๑',
    '中文字日本語人',
    'あいうえおかき',
    'アイウエオカキ',
    '한국어사람',
    '€£¥©®™±×÷§¶°',
    '\xA0 ​́ःⅠ½',
    '😀🚀🎉✨',
].join('');
const MAX_PATTERN = 1000;
const MAX_DEPTH = 32;
const MAX_REPEAT = 1000;
const MAX_LENGTH = 10000;
const MAX_STEPS = 200000;
class Parser {
    constructor(source) {
        _Parser_instances.add(this);
        _Parser_source.set(this, void 0);
        _Parser_index.set(this, 0);
        _Parser_depth.set(this, 0);
        _Parser_groups.set(this, 0);
        _Parser_names.set(this, new Map());
        _Parser_references.set(this, []);
        _Parser_checked.set(this, false);
        _Parser_lookaheads.set(this, []);
        __classPrivateFieldSet(this, _Parser_source, source, "f");
    }
    parse() {
        const root = __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_alternation).call(this);
        if (__classPrivateFieldGet(this, _Parser_index, "f") < __classPrivateFieldGet(this, _Parser_source, "f").length)
            throw new Unsupported('unbalanced parenthesis');
        for (const reference of __classPrivateFieldGet(this, _Parser_references, "f")) {
            if (reference.name !== undefined) {
                const index = __classPrivateFieldGet(this, _Parser_names, "f").get(reference.name);
                if (index === undefined)
                    throw new Unsupported('unknown group name');
                reference.index = index;
            }
            else if (reference.index > __classPrivateFieldGet(this, _Parser_groups, "f")) {
                throw new Unsupported('reference to a missing group');
            }
        }
        return {
            root,
            groups: __classPrivateFieldGet(this, _Parser_groups, "f"),
            checked: __classPrivateFieldGet(this, _Parser_checked, "f"),
            preferred: __classPrivateFieldGet(this, _Parser_lookaheads, "f").flatMap((node) => preferredOf(node)),
        };
    }
}
_Parser_source = new WeakMap(), _Parser_index = new WeakMap(), _Parser_depth = new WeakMap(), _Parser_groups = new WeakMap(), _Parser_names = new WeakMap(), _Parser_references = new WeakMap(), _Parser_checked = new WeakMap(), _Parser_lookaheads = new WeakMap(), _Parser_instances = new WeakSet(), _Parser_peek = function _Parser_peek(offset = 0) {
    return __classPrivateFieldGet(this, _Parser_source, "f")[__classPrivateFieldGet(this, _Parser_index, "f") + offset];
}, _Parser_codePoint = function _Parser_codePoint() {
    var _a;
    const code = __classPrivateFieldGet(this, _Parser_source, "f").codePointAt(__classPrivateFieldGet(this, _Parser_index, "f") - 1) ?? 0;
    if (code > 0xffff)
        __classPrivateFieldSet(this, _Parser_index, (_a = __classPrivateFieldGet(this, _Parser_index, "f"), _a++, _a), "f");
    return code;
}, _Parser_alternation = function _Parser_alternation() {
    var _a;
    const options = [__classPrivateFieldGet(this, _Parser_instances, "m", _Parser_sequence).call(this)];
    while (__classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this) === '|') {
        __classPrivateFieldSet(this, _Parser_index, (_a = __classPrivateFieldGet(this, _Parser_index, "f"), _a++, _a), "f");
        options.push(__classPrivateFieldGet(this, _Parser_instances, "m", _Parser_sequence).call(this));
    }
    return options.length === 1
        ? (options[0] ?? { kind: 'empty' })
        : { kind: 'alternation', options };
}, _Parser_sequence = function _Parser_sequence() {
    const items = [];
    for (let char = __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this); char !== undefined && char !== '|' && char !== ')'; char = __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this)) {
        const atom = __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_atom).call(this);
        items.push(__classPrivateFieldGet(this, _Parser_instances, "m", _Parser_quantified).call(this, atom));
    }
    return { kind: 'sequence', items };
}, _Parser_quantified = function _Parser_quantified(atom) {
    var _a, _b;
    const char = __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this);
    let bounds;
    if (char === '*')
        bounds = [0, Infinity];
    else if (char === '+')
        bounds = [1, Infinity];
    else if (char === '?')
        bounds = [0, 1];
    if (bounds !== undefined)
        __classPrivateFieldSet(this, _Parser_index, (_a = __classPrivateFieldGet(this, _Parser_index, "f"), _a++, _a), "f");
    else if (char === '{') {
        const match = /^\\{(\\d+)(,(\\d*))?\\}/.exec(__classPrivateFieldGet(this, _Parser_source, "f").slice(__classPrivateFieldGet(this, _Parser_index, "f")));
        // Without a valid quantifier, \`{\` is a literal character.
        if (match === null)
            return atom;
        const min = Number(match[1]);
        const max = match[2] === undefined ? min : match[3] === '' ? Infinity : Number(match[3]);
        if (min > MAX_REPEAT || max < min)
            throw new Unsupported('quantifier');
        bounds = [min, max];
        __classPrivateFieldSet(this, _Parser_index, __classPrivateFieldGet(this, _Parser_index, "f") + match[0].length, "f");
    }
    else {
        return atom;
    }
    // Lazy quantifiers match the same strings.
    if (__classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this) === '?')
        __classPrivateFieldSet(this, _Parser_index, (_b = __classPrivateFieldGet(this, _Parser_index, "f"), _b++, _b), "f");
    if (atom.kind === 'assert' || atom.kind === 'look')
        return atom;
    return { kind: 'repeat', item: atom, min: bounds[0], max: bounds[1] };
}, _Parser_atom = function _Parser_atom() {
    var _a;
    const char = __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this) ?? '';
    __classPrivateFieldSet(this, _Parser_index, (_a = __classPrivateFieldGet(this, _Parser_index, "f"), _a++, _a), "f");
    switch (char) {
        case '(':
            return __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_group).call(this);
        case '[':
            return __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_class).call(this);
        case '.':
            return {
                kind: 'set',
                parts: [{ kind: 'ranges', ranges: LINE_TERMINATORS, negated: false }],
                negated: true,
            };
        case '^':
            __classPrivateFieldSet(this, _Parser_checked, true, "f");
            return { kind: 'assert', which: 'start' };
        case '$':
            __classPrivateFieldSet(this, _Parser_checked, true, "f");
            return { kind: 'assert', which: 'end' };
        case '\\\\':
            return __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_escape).call(this);
        default: {
            const code = __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_codePoint).call(this);
            return literal(code);
        }
    }
}, _Parser_group = function _Parser_group() {
    var _a, _b, _c, _d, _e;
    let index;
    let look;
    if (__classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this) === '?') {
        const next = __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this, 1);
        const after = __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this, 2);
        if (next === ':')
            __classPrivateFieldSet(this, _Parser_index, __classPrivateFieldGet(this, _Parser_index, "f") + 2, "f");
        else if (next === '=' || next === '!') {
            look = { ahead: true, negated: next === '!' };
            __classPrivateFieldSet(this, _Parser_index, __classPrivateFieldGet(this, _Parser_index, "f") + 2, "f");
        }
        else if (next === '<' && (after === '=' || after === '!')) {
            look = { ahead: false, negated: after === '!' };
            __classPrivateFieldSet(this, _Parser_index, __classPrivateFieldGet(this, _Parser_index, "f") + 3, "f");
        }
        else if (next === '<') {
            const end = __classPrivateFieldGet(this, _Parser_source, "f").indexOf('>', __classPrivateFieldGet(this, _Parser_index, "f"));
            if (end === -1)
                throw new Unsupported('group name');
            const name = __classPrivateFieldGet(this, _Parser_source, "f").slice(__classPrivateFieldGet(this, _Parser_index, "f") + 2, end);
            index = __classPrivateFieldSet(this, _Parser_groups, (_a = __classPrivateFieldGet(this, _Parser_groups, "f"), ++_a), "f");
            __classPrivateFieldGet(this, _Parser_names, "f").set(name, index);
            __classPrivateFieldSet(this, _Parser_index, end + 1, "f");
        }
        else {
            // Modifiers such as \`(?i:…)\`: the generated strings match the pattern as written.
            const match = /^\\?[ims]*(?:-[ims]+)?:/.exec(__classPrivateFieldGet(this, _Parser_source, "f").slice(__classPrivateFieldGet(this, _Parser_index, "f")));
            if (match === null)
                throw new Unsupported('group syntax');
            __classPrivateFieldSet(this, _Parser_index, __classPrivateFieldGet(this, _Parser_index, "f") + match[0].length, "f");
        }
    }
    else {
        index = __classPrivateFieldSet(this, _Parser_groups, (_b = __classPrivateFieldGet(this, _Parser_groups, "f"), ++_b), "f");
    }
    if (__classPrivateFieldSet(this, _Parser_depth, (_c = __classPrivateFieldGet(this, _Parser_depth, "f"), ++_c), "f") > MAX_DEPTH)
        throw new Unsupported('nesting');
    const item = __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_alternation).call(this);
    __classPrivateFieldSet(this, _Parser_depth, (_d = __classPrivateFieldGet(this, _Parser_depth, "f"), _d--, _d), "f");
    if (__classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this) !== ')')
        throw new Unsupported('unbalanced parenthesis');
    __classPrivateFieldSet(this, _Parser_index, (_e = __classPrivateFieldGet(this, _Parser_index, "f"), _e++, _e), "f");
    if (look !== undefined) {
        __classPrivateFieldSet(this, _Parser_checked, true, "f");
        const node = { kind: 'look', ...look, item };
        if (look.ahead && !look.negated)
            __classPrivateFieldGet(this, _Parser_lookaheads, "f").push(item);
        return node;
    }
    return { kind: 'group', index, item };
}, _Parser_escape = function _Parser_escape() {
    var _a;
    const char = __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this);
    if (char === 'b' || char === 'B') {
        __classPrivateFieldSet(this, _Parser_index, (_a = __classPrivateFieldGet(this, _Parser_index, "f"), _a++, _a), "f");
        __classPrivateFieldSet(this, _Parser_checked, true, "f");
        return { kind: 'assert', which: char === 'b' ? 'boundary' : 'inside' };
    }
    if (char === 'k' && __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this, 1) === '<') {
        const end = __classPrivateFieldGet(this, _Parser_source, "f").indexOf('>', __classPrivateFieldGet(this, _Parser_index, "f"));
        if (end === -1)
            throw new Unsupported('group name');
        const node = {
            kind: 'reference',
            index: 0,
            name: __classPrivateFieldGet(this, _Parser_source, "f").slice(__classPrivateFieldGet(this, _Parser_index, "f") + 2, end),
        };
        __classPrivateFieldSet(this, _Parser_index, end + 1, "f");
        __classPrivateFieldGet(this, _Parser_references, "f").push(node);
        __classPrivateFieldSet(this, _Parser_checked, true, "f");
        return node;
    }
    if (char !== undefined && /[1-9]/.test(char)) {
        const digits = /^\\d+/.exec(__classPrivateFieldGet(this, _Parser_source, "f").slice(__classPrivateFieldGet(this, _Parser_index, "f")))?.[0] ?? char;
        __classPrivateFieldSet(this, _Parser_index, __classPrivateFieldGet(this, _Parser_index, "f") + digits.length, "f");
        const node = {
            kind: 'reference',
            index: Number(digits),
        };
        __classPrivateFieldGet(this, _Parser_references, "f").push(node);
        __classPrivateFieldSet(this, _Parser_checked, true, "f");
        return node;
    }
    const component = __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_classEscape).call(this);
    if (component !== undefined)
        return { kind: 'set', parts: [component], negated: false };
    return literal(__classPrivateFieldGet(this, _Parser_instances, "m", _Parser_characterEscape).call(this));
}, _Parser_classEscape = function _Parser_classEscape() {
    var _a;
    const char = __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this);
    if (char === undefined)
        return undefined;
    const lower = char.toLowerCase();
    const negated = char !== lower;
    if (lower === 'p' && __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this, 1) === '{') {
        const end = __classPrivateFieldGet(this, _Parser_source, "f").indexOf('}', __classPrivateFieldGet(this, _Parser_index, "f"));
        const name = end === -1 ? '' : __classPrivateFieldGet(this, _Parser_source, "f").slice(__classPrivateFieldGet(this, _Parser_index, "f") + 2, end);
        if (!/^[A-Za-z_]+(?:=[A-Za-z_]+)?$/.test(name) || propertyTest(name) === undefined)
            throw new Unsupported('Unicode property');
        __classPrivateFieldSet(this, _Parser_index, end + 1, "f");
        return { kind: 'property', name, negated };
    }
    const ranges = lower === 'd' ? DIGITS : lower === 'w' ? WORD : lower === 's' ? SPACE : undefined;
    if (ranges === undefined)
        return undefined;
    __classPrivateFieldSet(this, _Parser_index, (_a = __classPrivateFieldGet(this, _Parser_index, "f"), _a++, _a), "f");
    return { kind: 'ranges', ranges, negated };
}, _Parser_characterEscape = function _Parser_characterEscape() {
    var _a, _b;
    const char = __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this);
    if (char === undefined)
        throw new Unsupported('trailing backslash');
    __classPrivateFieldSet(this, _Parser_index, (_a = __classPrivateFieldGet(this, _Parser_index, "f"), _a++, _a), "f");
    const simple = { t: 9, n: 10, v: 11, f: 12, r: 13 };
    if (Object.prototype.hasOwnProperty.call(simple, char))
        return simple[char] ?? 0;
    if (char === '0' && !/\\d/.test(__classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this) ?? ''))
        return 0;
    if (char === 'c') {
        const letter = __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this);
        if (letter === undefined || !/[A-Za-z]/.test(letter))
            return 0x5c;
        __classPrivateFieldSet(this, _Parser_index, (_b = __classPrivateFieldGet(this, _Parser_index, "f"), _b++, _b), "f");
        return (letter.codePointAt(0) ?? 0) % 32;
    }
    const hexCode = (length) => {
        const digits = __classPrivateFieldGet(this, _Parser_source, "f").slice(__classPrivateFieldGet(this, _Parser_index, "f"), __classPrivateFieldGet(this, _Parser_index, "f") + length);
        if (digits.length !== length || !/^[0-9a-fA-F]+$/.test(digits))
            throw new Unsupported('escape');
        __classPrivateFieldSet(this, _Parser_index, __classPrivateFieldGet(this, _Parser_index, "f") + length, "f");
        return Number.parseInt(digits, 16);
    };
    if (char === 'x')
        return hexCode(2);
    if (char === 'u') {
        if (__classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this) !== '{')
            return hexCode(4);
        const end = __classPrivateFieldGet(this, _Parser_source, "f").indexOf('}', __classPrivateFieldGet(this, _Parser_index, "f"));
        const digits = __classPrivateFieldGet(this, _Parser_source, "f").slice(__classPrivateFieldGet(this, _Parser_index, "f") + 1, end);
        if (end === -1 || !/^[0-9a-fA-F]{1,6}$/.test(digits))
            throw new Unsupported('escape');
        __classPrivateFieldSet(this, _Parser_index, end + 1, "f");
        return Number.parseInt(digits, 16);
    }
    // An identity escape (\`\\.\`, \`\\/\`): the character itself.
    return __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_codePoint).call(this);
}, _Parser_class = function _Parser_class() {
    var _a, _b, _c;
    const negated = __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this) === '^';
    if (negated)
        __classPrivateFieldSet(this, _Parser_index, (_a = __classPrivateFieldGet(this, _Parser_index, "f"), _a++, _a), "f");
    const ranges = [];
    const parts = [];
    for (;;) {
        const char = __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this);
        if (char === undefined)
            throw new Unsupported('unterminated class');
        // In JavaScript, \`]\` ends a class even right after \`[\` or \`[^\`.
        if (char === ']') {
            __classPrivateFieldSet(this, _Parser_index, (_b = __classPrivateFieldGet(this, _Parser_index, "f"), _b++, _b), "f");
            break;
        }
        const from = __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_classAtom).call(this, parts);
        if (from === undefined)
            continue;
        if (__classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this) === '-' && __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this, 1) !== ']' && __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this, 1) !== undefined) {
            __classPrivateFieldSet(this, _Parser_index, (_c = __classPrivateFieldGet(this, _Parser_index, "f"), _c++, _c), "f");
            const to = __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_classAtom).call(this, parts);
            if (to === undefined || to < from)
                throw new Unsupported('class range');
            ranges.push([from, to]);
        }
        else {
            ranges.push([from, from]);
        }
    }
    if (ranges.length > 0)
        parts.unshift({ kind: 'ranges', ranges, negated: false });
    return { kind: 'set', parts, negated };
}, _Parser_classAtom = function _Parser_classAtom(parts) {
    var _a, _b, _c;
    const char = __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this) ?? '';
    __classPrivateFieldSet(this, _Parser_index, (_a = __classPrivateFieldGet(this, _Parser_index, "f"), _a++, _a), "f");
    if (char !== '\\\\')
        return __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_codePoint).call(this);
    if (__classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this) === 'b') {
        __classPrivateFieldSet(this, _Parser_index, (_b = __classPrivateFieldGet(this, _Parser_index, "f"), _b++, _b), "f");
        return 8;
    }
    if (__classPrivateFieldGet(this, _Parser_instances, "m", _Parser_peek).call(this) === '-') {
        __classPrivateFieldSet(this, _Parser_index, (_c = __classPrivateFieldGet(this, _Parser_index, "f"), _c++, _c), "f");
        return 0x2d;
    }
    const component = __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_classEscape).call(this);
    if (component === undefined)
        return __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_characterEscape).call(this);
    parts.push(component);
    return undefined;
};
function literal(code) {
    return {
        kind: 'set',
        parts: [{ kind: 'ranges', ranges: [[code, code]], negated: false }],
        negated: false,
    };
}
const propertyTests = new Map();
/** A test of one character against a Unicode property, or \`undefined\` if there is no such property. */
function propertyTest(name) {
    if (propertyTests.has(name))
        return propertyTests.get(name);
    let test;
    try {
        // The name was checked to be a property name: the expression is one character class.
        test = new RegExp(\`^\\\\p{\${name}}$\`, 'u');
    }
    catch {
        test = undefined;
    }
    propertyTests.set(name, test);
    return test;
}
function inRanges(code, ranges) {
    return ranges.some(([from, to]) => code >= from && code <= to);
}
function member(code, node) {
    const hit = node.parts.some((part) => {
        const inside = part.kind === 'ranges'
            ? inRanges(code, part.ranges)
            : (propertyTest(part.name)?.test(String.fromCodePoint(code)) ?? false);
        return inside !== part.negated;
    });
    return hit !== node.negated;
}
/** Characters a positive lookahead's literal parts and simple classes require. */
function preferredOf(node) {
    switch (node.kind) {
        case 'set':
            return node.negated || node.parts.length !== 1 || node.parts[0]?.kind !== 'ranges'
                ? []
                : [setSample(node)];
        case 'sequence':
            return node.items.flatMap(preferredOf);
        case 'alternation':
            return node.options.flatMap(preferredOf);
        case 'repeat':
            return node.min > 0 ? preferredOf(node.item) : [];
        case 'group':
            return preferredOf(node.item);
        default:
            return [];
    }
}
/** Every character of a small class, for lookahead preferences. */
function setSample(node) {
    const part = node.parts[0];
    if (part?.kind !== 'ranges')
        return '';
    let result = '';
    for (const [from, to] of part.ranges)
        for (let code = from; code <= to && result.length < 64; code++)
            result += String.fromCodePoint(code);
    return result;
}
function int(random, min, max) {
    return min + Math.floor(random.next() * (max - min + 1));
}
function character(node, context) {
    const { random } = context;
    // Characters a lookahead asks for, half of the time when the class allows them.
    if (context.preferred !== '' && random.next() < 0.5) {
        const wanted = Array.from(context.preferred).filter((c) => member(c.codePointAt(0) ?? 0, node));
        if (wanted.length > 0)
            return wanted[int(random, 0, wanted.length - 1)] ?? '';
    }
    const simple = !node.negated && node.parts.every((part) => part.kind === 'ranges' && !part.negated);
    if (simple) {
        const ranges = node.parts.flatMap((part) => (part.kind === 'ranges' ? part.ranges : []));
        // The printable ASCII part of the ranges, when they have one, keeps fixtures readable.
        const printable = ranges.flatMap(([from, to]) => {
            const low = Math.max(from, 0x20);
            const high = Math.min(to, 0x7e);
            return low <= high ? [[low, high]] : [];
        });
        const choices = printable.length > 0 ? printable : ranges;
        const range = choices[int(random, 0, choices.length - 1)];
        if (range === undefined)
            throw new Unsupported('empty class');
        return String.fromCodePoint(int(random, range[0], range[1]));
    }
    const candidates = Array.from(POOL).filter((c) => member(c.codePointAt(0) ?? 0, node));
    if (candidates.length === 0)
        throw new Unsupported('empty class');
    // Prefer the ASCII members of the pool when there are some.
    const plain = candidates.filter((c) => (c.codePointAt(0) ?? 0) < 0x80);
    const from = plain.length > 0 && random.next() < 0.8 ? plain : candidates;
    return from[int(random, 0, from.length - 1)] ?? '';
}
function generate(node, context) {
    switch (node.kind) {
        case 'empty':
        case 'assert':
            return '';
        case 'look':
            return !node.ahead && !node.negated && context.behind ? generate(node.item, context) : '';
        case 'set':
            return character(node, context);
        case 'sequence': {
            let result = '';
            for (const item of node.items) {
                result += generate(item, context);
                if (result.length > MAX_LENGTH)
                    throw new Unsupported('too long');
            }
            return result;
        }
        case 'alternation': {
            const option = node.options[int(context.random, 0, node.options.length - 1)];
            return option === undefined ? '' : generate(option, context);
        }
        case 'repeat': {
            const room = Math.min(node.max - node.min, context.extra);
            const count = node.min + (room > 0 ? int(context.random, 0, room) : 0);
            let result = '';
            for (let index = 0; index < count; index++) {
                result += generate(node.item, context);
                if (result.length > MAX_LENGTH)
                    throw new Unsupported('too long');
            }
            return result;
        }
        case 'group': {
            const text = generate(node.item, context);
            if (node.index !== undefined)
                context.captures[node.index] = text;
            return text;
        }
        case 'reference':
            return context.captures[node.index] ?? '';
    }
}
class Budget extends Error {
}
/** Whether \`text\` contains a match of the pattern, as \`RegExp.prototype.test\` would answer. */
function matches(parsed, text) {
    let steps = 0;
    const isWord = (position) => {
        const code = text.charCodeAt(position);
        return Number.isFinite(code) && inRanges(code, WORD);
    };
    const match = (node, position, captures, next) => {
        if (++steps > MAX_STEPS)
            throw new Budget();
        switch (node.kind) {
            case 'empty':
                return next(position, captures);
            case 'set': {
                if (position >= text.length)
                    return false;
                const code = text.codePointAt(position) ?? 0;
                if (!member(code, node))
                    return false;
                return next(position + (code > 0xffff ? 2 : 1), captures);
            }
            case 'sequence': {
                const step = (index, at, current) => {
                    const item = node.items[index];
                    return item === undefined
                        ? next(at, current)
                        : match(item, at, current, (after, updated) => step(index + 1, after, updated));
                };
                return step(0, position, captures);
            }
            case 'alternation':
                return node.options.some((option) => match(option, position, captures, next));
            case 'group':
                return match(node.item, position, captures, (after, updated) => {
                    if (node.index === undefined)
                        return next(after, updated);
                    const copy = [...updated];
                    copy[node.index] = text.slice(position, after);
                    return next(after, copy);
                });
            case 'reference': {
                const captured = captures[node.index];
                if (captured === undefined)
                    return next(position, captures);
                return text.startsWith(captured, position)
                    ? next(position + captured.length, captures)
                    : false;
            }
            case 'assert': {
                const ok = node.which === 'start'
                    ? position === 0
                    : node.which === 'end'
                        ? position === text.length
                        : (isWord(position - 1) !== isWord(position)) === (node.which === 'boundary');
                return ok && next(position, captures);
            }
            case 'look': {
                let found;
                if (node.ahead) {
                    match(node.item, position, captures, (_after, updated) => {
                        found = updated;
                        return true;
                    });
                }
                else {
                    for (let start = position; start >= 0; start--) {
                        const ended = match(node.item, start, captures, (after, updated) => {
                            if (after !== position)
                                return false;
                            found = updated;
                            return true;
                        });
                        if (ended)
                            break;
                    }
                }
                if (node.negated)
                    return found === undefined && next(position, captures);
                return found !== undefined && next(position, found);
            }
            case 'repeat': {
                const loop = (count, at, current) => {
                    if (count < node.max &&
                        match(node.item, at, current, (after, updated) => 
                        // An iteration that matched nothing would repeat forever.
                        after === at ? false : loop(count + 1, after, updated)))
                        return true;
                    return count >= node.min && next(at, current);
                };
                return loop(0, position, captures);
            }
        }
    };
    try {
        for (let start = 0; start <= text.length; start++)
            if (match(parsed.root, start, [], () => true))
                return true;
        return false;
    }
    catch (error) {
        if (error instanceof Budget)
            return false;
        throw error;
    }
}
const parsedPatterns = new Map();
function parse(pattern) {
    if (parsedPatterns.has(pattern))
        return parsedPatterns.get(pattern);
    let parsed;
    if (pattern.length <= MAX_PATTERN) {
        try {
            parsed = new Parser(pattern).parse();
        }
        catch (error) {
            if (!(error instanceof Unsupported))
                throw error;
        }
    }
    parsedPatterns.set(pattern, parsed);
    return parsed;
}
/** Characters as JSON Schema counts them (code points) and as the validators do (UTF-16 units). */
function fitsLength(text, minLength, maxLength) {
    const points = Array.from(text).length;
    return Math.min(points, text.length) >= minLength && Math.max(points, text.length) <= maxLength;
}
/** How many repetitions unbounded quantifiers may add, in the order they are tried. */
const EXTRAS = [3, 1, 0, 6, 12, 24, 48, 96];
/**
 * A string matching \`pattern\` whose length is within \`[minLength, maxLength]\`, or \`undefined\` when
 * the pattern is not valid or no such string was found.
 */
export function samplePattern(pattern, random, minLength = 0, maxLength = Infinity) {
    const parsed = parse(pattern);
    if (parsed === undefined)
        return undefined;
    const preferred = parsed.preferred.join('');
    for (const extra of EXTRAS) {
        for (let attempt = 0; attempt < 8; attempt++) {
            let text;
            try {
                text = generate(parsed.root, {
                    random,
                    extra,
                    captures: Array.from({ length: parsed.groups + 1 }, () => undefined),
                    preferred,
                    behind: attempt % 2 === 0,
                });
            }
            catch (error) {
                if (error instanceof Unsupported)
                    return undefined;
                throw error;
            }
            if (!fitsLength(text, minLength, maxLength))
                break;
            if (!parsed.checked || matches(parsed, text))
                return text;
        }
    }
    return undefined;
}
/** Whether \`text\` matches \`pattern\` (\`undefined\` when the pattern is not valid). */
export function matchesPattern(pattern, text) {
    const parsed = parse(pattern);
    return parsed === undefined ? undefined : matches(parsed, text);
}
// Vocabulary ----------------------------------------------------------------------------------
/** A non-empty list of the \`|\`-separated entries of \`entries\`. */
function list(entries) {
    const [first = '', ...rest] = entries.split('|');
    return [first, ...rest];
}
/** A non-empty list of \`name:value\` pairs. */
function pairs(entries) {
    const split = (entry) => {
        const [name = '', value = ''] = entry.split(':');
        return [name, value];
    };
    const [first, ...rest] = list(entries);
    return [split(first), ...rest.map(split)];
}
const FIRST_NAMES = list('Ada|Grace|Alan|Linus|Margaret|Katherine|Dennis|Barbara|Ken|Radia|Tim|Hedy|Frances|Edsger|' +
    'Donald|Shafi|Leslie|Sophie|Priya|Mateo|Amara|Yuki|Lena|Omar|Chen|Sofia|Noah|Aisha|Lucas|Mia|' +
    'Ethan|Zara|Hiro|Ingrid|Diego|Fatima|Liam|Elena|Kwame|Nadia|Oscar|Ravi|Sara|Tomás|Viktor|Wen|' +
    'Ximena|Yusuf|Zoe|Alex|Jordan|Taylor|Morgan|Riley|Casey|Jamie|Avery|Quinn|Rowan|Maya');
const LAST_NAMES = list('Lovelace|Hopper|Turing|Torvalds|Hamilton|Johnson|Ritchie|Liskov|Thompson|Perlman|Lamarr|' +
    'Allen|Dijkstra|Knuth|Goldwasser|Lamport|Wilson|Patel|García|Okafor|Tanaka|Müller|Haddad|Wang|' +
    'Rossi|Smith|Khan|Silva|Nguyen|Kim|Ali|Cohen|Larsen|Fernández|Mensah|Novak|Kowalski|Ivanova|' +
    'Schmidt|Dubois|Andersson|Moreau|Costa|Yilmaz|Park|Singh|Brown|Martin|Lee|Clark|Lewis|Walker|' +
    'Young|King|Wright|Scott|Green|Baker|Hill');
const LOREM = list('lorem|ipsum|dolor|sit|amet|consectetur|adipiscing|elit|sed|eiusmod|tempor|incididunt|labore|' +
    'dolore|magna|aliqua|enim|minim|veniam|nostrud|ullamco|laboris|aliquip|commodo|consequat|aute|' +
    'irure|velit|esse|cillum|fugiat|nulla');
const SENTENCES = list('The new layout is ready for review.|' +
    'Customers reported that the page loads slowly on mobile.|' +
    'Let’s align on the scope before we start.|' +
    'This blocks the next release.|' +
    'Add tests for the edge cases we found last week.|' +
    'The copy should match the latest designs.|' +
    'We agreed to ship the first version behind a feature flag.|' +
    'Numbers look good after the last deploy.|' +
    'Can someone double-check the translations?|' +
    'The integration works in staging but not in production yet.|' +
    'Follow-up from the planning meeting on Tuesday.|' +
    'Most of the work is done; the docs still need an update.|' +
    'Error rates dropped by half since the fix went out.|' +
    'Please keep the old endpoint until every client has migrated.|' +
    'The design team shared feedback in the review thread.|' +
    'This needs a decision from product before we continue.|' +
    'Performance is within budget on every page we measured.|' +
    'I left a few comments on the pull request.|' +
    'Support received three tickets about this today.|' +
    'We can reuse the components from the settings page.|' +
    'The import fails for files larger than 10 MB.|' +
    'Accessibility checks pass in both themes.|' +
    'Moving this to the next sprint to make room for the hotfix.|' +
    'The data migration finished without errors.|' +
    'Thanks for the quick turnaround on this!|' +
    'We should measure the impact before rolling it out to everyone.|' +
    'Looks great on desktop; tablet still needs some work.|' +
    'Security review is scheduled for Thursday.|' +
    'The onboarding flow now takes two steps instead of five.|' +
    'Let’s pair on this tomorrow morning.');
const JOB_LEVELS = list('Senior|Staff|Principal|Lead|Junior||||');
const JOB_AREAS = list('Frontend|Backend|Product|Platform|Data|Mobile|Security|Growth|Design|Infrastructure|QA|DevOps');
const JOB_ROLES = list('Engineer|Designer|Manager|Analyst|Scientist|Architect|Developer|Researcher|Writer');
const DEPARTMENTS = list('Engineering|Design|Marketing|Sales|Support|Finance|Operations|Legal|People|Product|Research|Security');
const COMPANY_SUFFIXES = list('Labs|Systems|Group|Studio|Works|Technologies|& Co.|Industries|Partners|Ventures|Analytics|Cloud');
const COMPANY_FIRST = list('Blue|Bright|North|Swift|Silver|Green|Clear|Bold|Prime|Nova');
const COMPANY_SECOND = list('Harbor|Peak|Wave|Leaf|Stone|Field|Bridge|Forge|Pixel|Orbit');
const PRODUCT_ADJECTIVES = list('Ergonomic|Wireless|Compact|Smart|Classic|Premium|Portable|Organic|Handmade|Recycled');
const PRODUCT_MATERIALS = list('Steel|Wooden|Cotton|Leather|Bamboo|Ceramic|Glass|Wool');
const PRODUCT_NOUNS = list('Chair|Lamp|Backpack|Keyboard|Mug|Notebook|Headphones|Bottle|Desk|Jacket|Watch|Speaker');
const PROJECT_AREAS = list('Mobile|Billing|Data|Marketing|Analytics|Customer|Payments|Search|Onboarding|Platform|Identity|' +
    'Checkout|Design system|Infrastructure|Support|Growth|Security|Reporting|Notifications|Admin');
const PROJECT_NOUNS = list('app|revamp|migration|relaunch|portal|redesign|platform|pipeline|dashboard|API|integration|' +
    'rollout|cleanup|audit|launch');
const TASK_VERBS = list('Design|Fix|Write|Add|Update|Refactor|Review|Migrate|Remove|Investigate|Document|Test|Improve|' +
    'Optimize|Implement|Set up|Ship|Prototype');
const TASK_OBJECTS = list('the pricing page|the login redirect|release notes|rate limiting|the onboarding flow|' +
    'the search index|billing webhooks|dark mode|CSV export|error messages|the mobile layout|' +
    'the API docs|user settings|password reset|notification emails|the audit log|the caching layer|' +
    'analytics events|the checkout form|image uploads');
const HEADLINE_TEMPLATES = list('A Guide to %|% in Practice|Why % Matters|The Future of %|Getting Started with %|' +
    '%: Lessons Learned|Building Better %|Ten Tips for %');
const HEADLINE_TOPICS = list('Remote Work|Open Source|Design Systems|Data Privacy|Cloud Costs|Team Rituals|Accessibility|' +
    'Performance|Testing|Onboarding');
const TAGS = list('bug|feature|frontend|backend|design|docs|performance|security|ux|infra|mobile|api|testing|' +
    'research|urgent|refactor|accessibility|analytics');
const STREET_NAMES = list('Main|Oak|Maple|Cedar|Elm|Pine|Lake|Hill|Park|Sunset|River|Church|Market|Mill|Spring');
const STREET_SUFFIXES = list('Street|Avenue|Road|Lane|Drive|Way|Boulevard|Court');
const CITIES = list('San Francisco|New York|London|Berlin|Paris|Tokyo|Toronto|Sydney|Amsterdam|Barcelona|Lisbon|' +
    'Dublin|Stockholm|Copenhagen|Zurich|Vienna|Prague|Warsaw|Seoul|Singapore|Bangalore|Lagos|' +
    'Nairobi|Cape Town|São Paulo|Buenos Aires|Mexico City|Austin|Seattle|Chicago');
const STATES = list('California|New York|Texas|Washington|Illinois|Ontario|Bavaria|Catalonia|Victoria|Queensland|' +
    'Lombardy|Île-de-France');
const COUNTRIES = pairs('United States:US|United Kingdom:GB|Germany:DE|France:FR|Japan:JP|Canada:CA|Australia:AU|' +
    'Netherlands:NL|Spain:ES|Portugal:PT|Ireland:IE|Sweden:SE|Denmark:DK|Switzerland:CH|Austria:AT|' +
    'Poland:PL|South Korea:KR|Singapore:SG|India:IN|Nigeria:NG|Kenya:KE|South Africa:ZA|Brazil:BR|' +
    'Argentina:AR|Mexico:MX|Italy:IT|Norway:NO|Finland:FI|New Zealand:NZ');
const TIMEZONES = list('America/New_York|America/Los_Angeles|America/Chicago|America/Sao_Paulo|Europe/London|' +
    'Europe/Berlin|Europe/Paris|Europe/Madrid|Asia/Tokyo|Asia/Singapore|Asia/Kolkata|' +
    'Australia/Sydney|Africa/Lagos|UTC');
const LOCALES = list('en-US|en-GB|de-DE|fr-FR|es-ES|pt-BR|ja-JP|ko-KR|zh-CN|it-IT|nl-NL|sv-SE');
const LANGUAGES = list('en|de|fr|es|pt|ja|ko|zh|it|nl|sv|hi');
const CURRENCIES = list('USD|EUR|GBP|JPY|CAD|AUD|CHF|SEK|INR|BRL|MXN|SGD');
const FILE_TYPES = pairs('image/png:png|image/jpeg:jpg|application/pdf:pdf|text/plain:txt|text/csv:csv|' +
    'application/json:json|image/svg+xml:svg|application/zip:zip|image/gif:gif|text/markdown:md');
const FILE_STEMS = list('report|invoice|wireframe|screenshot|notes|budget|roadmap|contract|photo|logo|presentation|' +
    'summary|draft|export|diagram|receipt');
const USER_AGENTS = list('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15|' +
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36|' +
    'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0|' +
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148');
const EMOJI = list('🚀|✨|🎉|👍|🔥|✅|💡|📦|🐛|🎨');
const COLORS = list('#ef4444|#f97316|#f59e0b|#eab308|#84cc16|#22c55e|#10b981|#14b8a6|#06b6d4|#0ea5e9|#3b82f6|' +
    '#6366f1|#8b5cf6|#a855f7|#d946ef|#ec4899|#f43f5e|#64748b');
const RECORD_KEYS = list('source|plan|region|channel|team|priority|campaign|version|theme|segment|tier|origin');
/** Domains reserved for documentation (RFC 2606). */
const DOMAINS = list('example.com|example.org|example.net');
const DOCUMENTATION_NETWORKS = list('192.0.2|198.51.100|203.0.113');
// Generators ----------------------------------------------------------------------------------
/** Lowercase ASCII for identifiers: \`Tomás Müller\` → \`tomas.muller\`. */
function ascii(text) {
    return text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
}
const pad = (value, length = 2) => String(value).padStart(length, '0');
function hex(random, length) {
    let result = '';
    for (let index = 0; index < length; index++)
        result += random.int(0, 15).toString(16);
    return result;
}
function alphanumeric(random, length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let index = 0; index < length; index++)
        result += chars.charAt(random.int(0, 35));
    return result;
}
function base64Url(random, length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    for (let index = 0; index < length; index++)
        result += chars.charAt(random.int(0, 63));
    return result;
}
/** An RFC 9562 version 4 UUID. */
function uuid(random) {
    const digits = Array.from({ length: 32 }, (_, index) => {
        if (index === 12)
            return '4';
        if (index === 16)
            return (8 + random.int(0, 3)).toString(16);
        return random.int(0, 15).toString(16);
    }).join('');
    return \`\${digits.slice(0, 8)}-\${digits.slice(8, 12)}-\${digits.slice(12, 16)}-\${digits.slice(16, 20)}-\${digits.slice(20)}\`;
}
function sentences(random, count) {
    const result = [];
    for (let index = 0; index < count; index++) {
        const sentence = random.pick(SENTENCES);
        if (!result.includes(sentence))
            result.push(sentence);
    }
    return result.join(' ');
}
function luhn(digits) {
    let sum = 0;
    for (let index = 0; index < digits.length; index++) {
        let digit = Number(digits.charAt(digits.length - 1 - index));
        if (index % 2 === 0) {
            digit *= 2;
            if (digit > 9)
                digit -= 9;
        }
        sum += digit;
    }
    return \`\${digits}\${(10 - (sum % 10)) % 10}\`;
}
function isbn(random) {
    const body = \`978\${Array.from({ length: 9 }, () => random.int(0, 9)).join('')}\`;
    let sum = 0;
    for (let index = 0; index < 12; index++)
        sum += Number(body.charAt(index)) * (index % 2 === 0 ? 1 : 3);
    return \`\${body}\${(10 - (sum % 10)) % 10}\`;
}
/** A British IBAN with valid check digits. */
function iban(random) {
    const bank = Array.from({ length: 4 }, () => String.fromCharCode(random.int(65, 90))).join('');
    const bban = \`\${bank}\${Array.from({ length: 14 }, () => random.int(0, 9)).join('')}\`;
    const numeric = \`\${bban}GB00\`.replace(/[A-Z]/g, (letter) => String(letter.charCodeAt(0) - 55));
    let remainder = 0;
    for (const digit of numeric)
        remainder = (remainder * 10 + Number(digit)) % 97;
    return \`GB\${pad(98 - remainder)}\${bban}\`;
}
/** A person's first and last name. */
export function personName(random) {
    return [random.pick(FIRST_NAMES), random.pick(LAST_NAMES)];
}
/**
 * Text of a kind that names a person, for \`person\`, or \`undefined\` for other kinds: the \`name\`,
 * \`email\` and \`username\` of one object belong to the same person.
 */
export function personText(kind, person, random, example) {
    const [first, last] = person;
    switch (kind) {
        case 'firstName':
            return first;
        case 'lastName':
            return last;
        case 'fullName':
            return \`\${first} \${last}\`;
        case 'username':
            return \`\${ascii(first)}.\${ascii(last)}\${random.int(1, 99)}\`;
        case 'email':
            return \`\${ascii(first)}.\${ascii(last)}@\${domainOf(example, random)}\`;
        default:
            return undefined;
    }
}
/** The domain of an example email address, or a documentation domain. */
function domainOf(example, random) {
    const domain = /@([\\w.-]+\\.[a-z]{2,})$/i.exec(example)?.[1];
    return domain ?? random.pick(DOMAINS);
}
/** The origin of an example URL, or a documentation domain's. */
function originOf(example, random) {
    return /^(https?:\\/\\/[^/?#]+)/i.exec(example)?.[1] ?? \`https://\${random.pick(DOMAINS)}\`;
}
/** A colorful SVG picture as a \`data:\` URL: it renders anywhere, without the network. */
function picture(random, width, height) {
    const [background, accent, detail] = [
        random.pick(COLORS),
        random.pick(COLORS),
        random.pick(COLORS),
    ];
    const svg = \`<svg xmlns='http://www.w3.org/2000/svg' width='\${width}' height='\${height}' viewBox='0 0 \${width} \${height}'>\` +
        \`<rect width='\${width}' height='\${height}' fill='\${background}'/>\` +
        \`<circle cx='\${random.int(0, width)}' cy='\${random.int(0, height)}' r='\${random.int(width / 6, width / 2)}' fill='\${accent}' fill-opacity='.7'/>\` +
        \`<rect x='\${random.int(0, width / 2)}' y='\${random.int(0, height / 2)}' width='\${random.int(width / 6, width / 2)}' height='\${random.int(height / 6, height / 2)}' fill='\${detail}' fill-opacity='.6'/></svg>\`;
    return \`data:image/svg+xml,\${svg.replace(/[<>#'"]/g, (char) => \`%\${char.charCodeAt(0).toString(16).toUpperCase()}\`)}\`;
}
const TEXT = {
    words: (random) => \`\${random.pick(LOREM)} \${random.pick(LOREM)}\`,
    word: (random) => random.pick(LOREM),
    sentence: (random) => random.pick(SENTENCES),
    paragraph: (random) => sentences(random, random.int(2, 4)),
    like: (random, example) => like(example, random),
    firstName: (random) => random.pick(FIRST_NAMES),
    lastName: (random) => random.pick(LAST_NAMES),
    fullName: (random) => personName(random).join(' '),
    username: (random) => {
        const [first, last] = personName(random);
        return \`\${ascii(first)}.\${ascii(last)}\${random.int(1, 99)}\`;
    },
    email: (random, example) => {
        const [first, last] = personName(random);
        return \`\${ascii(first)}.\${ascii(last)}@\${domainOf(example, random)}\`;
    },
    phone: (random) => random.chance(0.5)
        ? \`+1 555-01\${pad(random.int(0, 99))}\`
        : \`+44 20 7946 0\${pad(random.int(0, 999), 3)}\`,
    jobTitle: (random) => {
        if (random.chance(0.1))
            return \`Head of \${random.pick(DEPARTMENTS)}\`;
        const level = random.pick(JOB_LEVELS);
        return \`\${level === '' ? '' : \`\${level} \`}\${random.pick(JOB_AREAS)} \${random.pick(JOB_ROLES)}\`;
    },
    company: (random) => random.chance(0.5)
        ? \`\${random.pick(LAST_NAMES)} \${random.pick(COMPANY_SUFFIXES)}\`
        : \`\${random.pick(COMPANY_FIRST)}\${random.pick(COMPANY_SECOND)}\`,
    department: (random) => random.pick(DEPARTMENTS),
    product: (random) => \`\${random.pick(PRODUCT_ADJECTIVES)} \${random.pick(PRODUCT_MATERIALS)} \${random.pick(PRODUCT_NOUNS)}\`,
    project: (random) => \`\${random.pick(PROJECT_AREAS)} \${random.pick(PROJECT_NOUNS)}\`,
    task: (random) => \`\${random.pick(TASK_VERBS)} \${random.pick(TASK_OBJECTS)}\`,
    headline: (random) => random.pick(HEADLINE_TEMPLATES).replace(/%/g, random.pick(HEADLINE_TOPICS)),
    tag: (random) => random.pick(TAGS),
    slug: (random) => \`\${random.pick(TAGS)}-\${random.pick(LOREM)}-\${random.int(1, 99)}\`,
    code: (random) => alphanumeric(random, 6).toUpperCase(),
    street: (random) => \`\${random.int(1, 9999)} \${random.pick(STREET_NAMES)} \${random.pick(STREET_SUFFIXES)}\`,
    city: (random) => random.pick(CITIES),
    state: (random) => random.pick(STATES),
    country: (random) => random.pick(COUNTRIES)[0],
    countryCode: (random) => random.pick(COUNTRIES)[1],
    postalCode: (random) => pad(random.int(10000, 99999), 5),
    address: (random) => \`\${random.int(1, 9999)} \${random.pick(STREET_NAMES)} \${random.pick(STREET_SUFFIXES)}, \${random.pick(CITIES)}\`,
    url: (random, example) => \`\${originOf(example, random)}/\${random.pick(TAGS)}/\${random.int(1, 999)}\`,
    imageUrl: (random) => picture(random, 400, 300),
    avatarUrl: (random) => picture(random, 128, 128),
    domain: (random) => \`\${random.pick(TAGS)}.\${random.pick(DOMAINS)}\`,
    // Ranges reserved for documentation (RFC 5737, RFC 3849).
    ipv4: (random) => \`\${random.pick(DOCUMENTATION_NETWORKS)}.\${random.int(1, 254)}\`,
    ipv6: (random) => \`2001:db8::\${random.int(1, 0xffff).toString(16)}:\${hex(random, 4)}\`,
    mac: (random) => \`02:\${Array.from({ length: 5 }, () => hex(random, 2)).join(':')}\`,
    userAgent: (random) => random.pick(USER_AGENTS),
    token: (random) => base64Url(random, 40),
    jwt: (random) => \`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.\${base64Url(random, 48)}.\${base64Url(random, 43)}\`,
    password: (random) => \`\${base64Url(random, 6)}!\${random.int(10, 99)}\${base64Url(random, 4)}\`,
    hash: (random) => hex(random, 64),
    uuid,
    color: (random) => random.pick(COLORS),
    mimeType: (random) => random.pick(FILE_TYPES)[0],
    fileName: (random) => \`\${random.pick(FILE_STEMS)}-\${random.int(1, 99)}.\${random.pick(FILE_TYPES)[1]}\`,
    fileExtension: (random) => random.pick(FILE_TYPES)[1],
    filePath: (random) => \`/files/\${random.pick(TAGS)}/\${random.pick(FILE_STEMS)}.\${random.pick(FILE_TYPES)[1]}\`,
    semver: (random) => \`\${random.int(1, 4)}.\${random.int(0, 12)}.\${random.int(0, 20)}\`,
    emoji: (random) => random.pick(EMOJI),
    currency: (random) => random.pick(CURRENCIES),
    locale: (random) => random.pick(LOCALES),
    language: (random) => random.pick(LANGUAGES),
    timezone: (random) => random.pick(TIMEZONES),
    sku: (random) => \`SKU-\${random.int(10000, 99999)}\`,
    isbn,
    iban,
    // Test card numbers: Luhn-valid, accepted by no network.
    creditCard: (random) => luhn(\`4242\${Array.from({ length: 11 }, () => random.int(0, 9)).join('')}\`),
    base64: (random) => btoa(random.pick(SENTENCES).replace(/[^\\x20-\\x7e]/g, "'")),
    json: (random) => JSON.stringify({ id: random.int(1, 999), name: random.pick(TAGS) }),
    duration: (random) => random.chance(0.5) ? \`PT\${random.int(5, 120)}M\` : \`P\${random.int(1, 30)}D\`,
    regex: (random) => \`^\${random.pick(TAGS)}-[0-9]+$\`,
    pointer: (random) => \`/\${random.pick(TAGS)}/\${random.int(0, 9)}\`,
    relativePointer: (random) => \`\${random.int(0, 3)}/\${random.pick(TAGS)}\`,
    uriReference: (random) => \`/\${random.pick(TAGS)}/\${random.int(1, 999)}\`,
    uriTemplate: (random) => \`https://\${random.pick(DOMAINS)}/\${random.pick(TAGS)}/{id}\`,
    integer: (random) => String(random.int(1, 100000)),
    decimal: (random) => (random.int(100, 99999) / 100).toFixed(2),
};
/**
 * A variation of an example that keeps its shape: digits and identifier characters change, words
 * and separators stay (\`usr_3k9f2a7d1b\` → \`usr_8q2m5x0c7e\`, \`WEB-12\` → \`QAP-48\`).
 */
function like(example, random) {
    const upper = () => String.fromCharCode(random.int(65, 90));
    const lower = () => String.fromCharCode(random.int(97, 122));
    return example.replace(/[A-Za-z0-9]+/g, (chunk) => {
        const letters = /[A-Za-z]/.test(chunk);
        const digits = /\\d/.test(chunk);
        // Words stay; short codes in capitals vary.
        if (letters && !digits)
            return /^[A-Z]{2,6}$/.test(chunk) ? chunk.replace(/./g, upper) : chunk;
        const isHex = letters && /^[0-9a-f]+$/.test(chunk);
        let index = 0;
        return chunk.replace(/./g, (char) => {
            const first = index++ === 0 && chunk.length > 1 && char !== '0';
            if (/\\d/.test(char))
                return String(first ? random.int(1, 9) : random.int(0, 9));
            if (isHex)
                return random.int(0, 15).toString(16);
            return char === char.toUpperCase() ? upper() : lower();
        });
    });
}
/** \`text\` padded with words or cut to fit \`[minLength, maxLength]\`. */
export function fit(text, random, minLength = 0, maxLength = Infinity) {
    let result = text;
    while (result.length < minLength)
        result += result === '' ? random.pick(LOREM) : \` \${random.pick(LOREM)}\`;
    if (result.length > maxLength)
        result = result.slice(0, maxLength);
    // A cut can leave a trailing space or half a surrogate pair; replacing keeps the length.
    return result.replace(/ $|[\\uD800-\\uDBFF]$/, 'x');
}
/** Generated text of a kind, fitted to a length. */
export function generateText(kind, random, example = '', minLength = 0, maxLength = Infinity) {
    return fit(TEXT[kind](random, example), random, minLength, maxLength);
}
/** The status the examples of error models describe, when the status is not known. */
export const DEFAULT_ERROR_STATUS = 404;
/** The statuses errors describe when the status is not known (a fixture called on its own). */
const ERROR_STATUSES = [400, 401, 403, 404, 409, 422, 429, 500, 503];
/** Reason phrases (RFC 9110). */
const REASONS = {
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    411: 'Length Required',
    412: 'Precondition Failed',
    413: 'Content Too Large',
    414: 'URI Too Long',
    415: 'Unsupported Media Type',
    416: 'Range Not Satisfiable',
    417: 'Expectation Failed',
    421: 'Misdirected Request',
    422: 'Unprocessable Content',
    423: 'Locked',
    424: 'Failed Dependency',
    425: 'Too Early',
    426: 'Upgrade Required',
    428: 'Precondition Required',
    429: 'Too Many Requests',
    431: 'Request Header Fields Too Large',
    451: 'Unavailable For Legal Reasons',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
    505: 'HTTP Version Not Supported',
    507: 'Insufficient Storage',
    508: 'Loop Detected',
    511: 'Network Authentication Required',
};
/** What went wrong, by status; other statuses get their class's explanation. */
const ERROR_DETAILS = {
    400: list('The request body is not valid JSON.|The cursor parameter is malformed.|The limit parameter must be between 1 and 100.'),
    401: list('The access token is missing or has expired.|Sign in to continue.|The API key is not valid.'),
    403: list('You do not have permission to perform this action.|Only workspace admins can change this setting.|Your plan does not include this feature.'),
    404: list('The requested resource does not exist.|No resource matches this ID.|The resource may have been deleted or moved.'),
    405: list('This endpoint does not support this method.'),
    408: list('The request took too long to arrive. Try again.'),
    409: list('The resource was changed by someone else. Reload it and try again.|A resource with this name already exists.'),
    410: list('This resource was permanently deleted.'),
    412: list('The resource changed since you last read it. Reload it and try again.'),
    413: list('The request body is larger than 10 MB.'),
    415: list('Send the request body as application/json.'),
    422: list('Some fields are invalid. Check them and try again.|The request contains invalid values.|A required field is missing.'),
    423: list('The resource is locked while another change is in progress.'),
    429: list('Too many requests. Try again in 30 seconds.|You reached the limit of 100 requests per minute.'),
    500: list('Something went wrong on our side. Try again later.|An unexpected error occurred. Our team has been notified.'),
    501: list('This feature is not available yet.'),
    502: list('An upstream service returned an invalid response.'),
    503: list('The service is temporarily unavailable. Try again in a few minutes.|Scheduled maintenance is in progress. Try again later.'),
    504: list('An upstream service did not respond in time.'),
};
const CLIENT_ERROR_DETAILS = list('The request could not be processed.|Check the request and try again.');
const SERVER_ERROR_DETAILS = list('The server could not complete the request.|Something went wrong on our side. Try again later.');
/** Fields named in the errors of single fields, and what is wrong with them. */
const ERROR_FIELDS = list('email|title|name|password|dueDate|quantity|phone|startDate|amount|url');
const FIELD_ERRORS = list('This field is required.|Must be at most 80 characters.|Must be a valid email address.|Must be a date in the future.|Must be greater than 0.|Must be at least 12 characters.|This value is already taken.|Must be a valid URL.');
/** The reason phrase of a status. */
function reasonOf(status) {
    return REASONS[status] ?? (status >= 500 ? 'Server Error' : 'Client Error');
}
/**
 * A status's reason phrase as a code, written the way \`example\` writes codes (\`not_found\`,
 * \`NOT_FOUND\`, \`not-found\`, \`NotFound\`).
 */
function errorCode(status, example) {
    const parts = reasonOf(status)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((part) => part !== '');
    if (/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(example) && example.length > 1)
        return parts.join('_').toUpperCase();
    if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(example))
        return parts.join('-');
    if (/^([A-Z][a-z0-9]+){2,}$/.test(example))
        return parts.map((part) => \`\${part.charAt(0).toUpperCase()}\${part.slice(1)}\`).join('');
    return parts.join('_');
}
/** What a property of an error model says about an error of \`status\`. */
export function errorText(part, status, random, example = '') {
    switch (part) {
        case 'title':
            return reasonOf(status);
        case 'detail':
            return random.pick(ERROR_DETAILS[status] ?? (status >= 500 ? SERVER_ERROR_DETAILS : CLIENT_ERROR_DETAILS));
        case 'code':
            return errorCode(status, example);
        case 'type':
            // \`about:blank\` says the type is the status itself.
            return example.startsWith('about:')
                ? example
                : \`\${originOf(example, random)}/problems/\${errorCode(status, 'not-found')}\`;
        case 'instance':
            return \`urn:uuid:\${uuid(random)}\`;
        case 'field':
            return random.pick(ERROR_FIELDS);
        case 'pointer':
            return \`/\${random.pick(ERROR_FIELDS)}\`;
        case 'fieldMessage':
            return random.pick(FIELD_ERRORS);
    }
}
/** The key of the object a value's key belongs to (\`owner.email\` → \`owner\`, \`email\` → \`''\`). */
function parentOf(key) {
    return key.slice(0, Math.max(0, key.lastIndexOf('.')));
}
/** The date generated values without an example are placed around. */
const REFERENCE = Date.UTC(2026, 0, 1);
const DAY = 86400000;
/**
 * A date, date-time or time near \`example\` (or the reference date): earlier for \`past\`, later for
 * \`future\`, within weeks for \`soon\`, decades earlier for \`birth\`. Keeps the example's precision.
 */
export function dateNear(example, format, when, random) {
    const time = () => \`\${pad(random.int(0, 23))}:\${pad(random.int(0, 59))}:\${pad(random.int(0, 59))}\`;
    if (format === 'time') {
        const suffix = example === undefined ? 'Z' : (/^\\d{2}:\\d{2}:\\d{2}(.*)$/.exec(example)?.[1] ?? '');
        return \`\${time()}\${suffix.replace(/^\\.\\d+/, '')}\`;
    }
    const parsed = example === undefined
        ? Number.NaN
        : Date.parse(format === 'date' ? \`\${example}T00:00:00Z\` : example);
    const base = Number.isNaN(parsed) ? REFERENCE : parsed;
    const days = when === 'past'
        ? -random.int(1, 180)
        : when === 'future'
            ? random.int(1, 90)
            : when === 'soon'
                ? random.int(-14, 45)
                : when === 'birth'
                    ? -random.int(18 * 365, 75 * 365)
                    : random.int(-365, 365);
    const value = new Date(Math.floor(base / DAY) * DAY + days * DAY);
    if (format === 'date')
        return value.toISOString().slice(0, 10);
    const iso = \`\${value.toISOString().slice(0, 10)}T\${time()}\`;
    // The example's precision: \`2026-10-20T09:30:00Z\` or \`…00.000Z\`.
    return example !== undefined && !/\\.\\d+/.test(example) ? \`\${iso}Z\` : \`\${iso}.000Z\`;
}
let crcTable;
function crc32(bytes) {
    if (crcTable === undefined) {
        crcTable = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++)
                c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            crcTable[n] = c >>> 0;
        }
    }
    let crc = 0xffffffff;
    for (const byte of bytes)
        crc = (crcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}
function concat(parts) {
    const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
    let offset = 0;
    for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
    }
    return result;
}
const u32 = (value) => new Uint8Array([value >>> 24, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
const latin1 = (text) => Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff);
/** A 64×64 PNG picture in two colors, valid for every decoder (stored, uncompressed blocks). */
function png(random) {
    const size = 64;
    const color = (value) => [1, 3, 5].map((i) => Number.parseInt(value.slice(i, i + 2), 16));
    const [background, accent] = [color(random.pick(COLORS)), color(random.pick(COLORS))];
    const cx = random.int(16, 48);
    const cy = random.int(16, 48);
    const radius = random.int(10, 28);
    const raw = new Uint8Array(size * (size * 3 + 1));
    for (let y = 0; y < size; y++) {
        raw[y * (size * 3 + 1)] = 0;
        for (let x = 0; x < size; x++) {
            const inside = (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
            const rgb = inside ? accent : background;
            raw.set(rgb, y * (size * 3 + 1) + 1 + x * 3);
        }
    }
    // zlib: one stored deflate block per 65,535 bytes, then the Adler-32 checksum.
    const blocks = [new Uint8Array([0x78, 0x01])];
    for (let offset = 0; offset < raw.length; offset += 65535) {
        const chunk = raw.subarray(offset, offset + 65535);
        const last = offset + 65535 >= raw.length ? 1 : 0;
        blocks.push(new Uint8Array([
            last,
            chunk.length & 0xff,
            chunk.length >>> 8,
            ~chunk.length & 0xff,
            (~chunk.length >>> 8) & 0xff,
        ]), chunk);
    }
    let a = 1;
    let b = 0;
    for (const byte of raw) {
        a = (a + byte) % 65521;
        b = (b + a) % 65521;
    }
    blocks.push(u32(((b << 16) | a) >>> 0));
    const chunk = (type, data) => {
        const body = concat([latin1(type), data]);
        return concat([u32(data.length), body, u32(crc32(body))]);
    };
    return concat([
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', concat([u32(size), u32(size), new Uint8Array([8, 2, 0, 0, 0])])),
        chunk('IDAT', concat(blocks)),
        chunk('IEND', new Uint8Array(0)),
    ]);
}
/** A one-page PDF with a line of text. */
function pdf(random) {
    const line = random
        .pick(SENTENCES)
        .replace(/[^\\x20-\\x7e]/g, "'")
        .replace(/[()\\\\]/g, '');
    const stream = \`BT /F1 18 Tf 72 720 Td (\${line}) Tj ET\`;
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        \`<< /Length \${stream.length} >>\\nstream\\n\${stream}\\nendstream\`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let body = '%PDF-1.4\\n';
    const offsets = [];
    objects.forEach((object, index) => {
        offsets.push(body.length);
        body += \`\${index + 1} 0 obj\\n\${object}\\nendobj\\n\`;
    });
    const xref = body.length;
    body += \`xref\\n0 \${objects.length + 1}\\n0000000000 65535 f \\n\${offsets.map((offset) => \`\${pad(offset, 10)} 00000 n \\n\`).join('')}\`;
    body += \`trailer\\n<< /Size \${objects.length + 1} /Root 1 0 R >>\\nstartxref\\n\${xref}\\n%%EOF\\n\`;
    return latin1(body);
}
/** A short WAV file: a quiet tone. */
function wav(random) {
    const rate = 8000;
    const samples = rate / 4;
    const frequency = random.pick([262, 330, 392, 440, 523]);
    const le = (value, bytes) => Array.from({ length: bytes }, (_, index) => (value >>> (index * 8)) & 0xff);
    const header = [
        ...latin1('RIFF'),
        ...le(36 + samples, 4),
        ...latin1('WAVEfmt '),
        ...le(16, 4),
        ...le(1, 2),
        ...le(1, 2),
        ...le(rate, 4),
        ...le(rate, 4),
        ...le(1, 2),
        ...le(8, 2),
        ...latin1('data'),
        ...le(samples, 4),
    ];
    const data = Array.from({ length: samples }, (_, index) => Math.round(128 + 24 * Math.sin((2 * Math.PI * frequency * index) / rate)));
    return new Uint8Array([...header, ...data]);
}
const decode64 = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
/** Tiny valid pictures in formats that cannot be generated in a few lines. */
const GIF = 'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const JPEG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const WEBP = 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
/** The media type a file property's name suggests (\`avatar\` → PNG, \`invoice\` → PDF). */
function mediaTypeOfName(name) {
    if (/image|photo|picture|avatar|logo|icon|thumbnail|banner|cover|screenshot/i.test(name))
        return 'image/png';
    if (/pdf|invoice|receipt|document|contract|report/i.test(name))
        return 'application/pdf';
    if (/csv|export|spreadsheet/i.test(name))
        return 'text/csv';
    if (/audio|sound|voice|recording/i.test(name))
        return 'audio/wav';
    if (/text|note|log/i.test(name))
        return 'text/plain';
    return 'application/octet-stream';
}
/** File content of a media type: a real picture, PDF, sound, archive or text. */
export function fileContent(mediaType, random, name = '') {
    let type = mediaType.split(';')[0]?.trim().toLowerCase() ?? '';
    if (type === '' || type.includes('*') || type === 'application/octet-stream') {
        const guessed = mediaTypeOfName(name);
        if (type === '' || type.includes('*') || guessed !== 'application/octet-stream')
            type = guessed;
    }
    const blob = (part) => new Blob([part], { type });
    switch (type) {
        case 'image/png':
            return blob(png(random));
        case 'image/gif':
            return blob(decode64(GIF));
        case 'image/jpeg':
        case 'image/jpg':
            return blob(decode64(JPEG));
        case 'image/webp':
            return blob(decode64(WEBP));
        case 'image/svg+xml':
            return blob(decodeURIComponent(picture(random, 400, 300).slice('data:image/svg+xml,'.length)));
        case 'application/pdf':
            return blob(pdf(random));
        case 'audio/wav':
        case 'audio/x-wav':
        case 'audio/wave':
            return blob(wav(random));
        case 'application/zip':
            return blob(new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...Array.from({ length: 18 }, () => 0)]));
        case 'text/csv':
            return blob(\`id,name,email\\n\${Array.from({ length: 3 }, (_, index) => {
                const [first, last] = personName(random);
                return \`\${index + 1},\${first} \${last},\${ascii(first)}.\${ascii(last)}@example.com\`;
            }).join('\\n')}\\n\`);
        case 'application/json':
            return blob(JSON.stringify({ id: random.int(1, 999), name: random.pick(TAGS) }));
        case 'text/html':
            return blob(\`<!doctype html><title>\${random.pick(TAGS)}</title><p>\${random.pick(SENTENCES)}</p>\`);
        case 'application/xml':
        case 'text/xml':
            return blob(\`<?xml version="1.0" encoding="UTF-8"?><note><text>\${random.pick(SENTENCES)}</text></note>\`);
        default:
            if (type.startsWith('text/'))
                return blob(sentences(random, 3));
            return blob(Uint8Array.from({ length: 256 }, () => random.int(0, 255)));
    }
}
/** The \`index\`th key of generated maps: \`source\`, \`plan\`, …, then \`source2\`, \`plan2\`, …. */
export function recordKey(index) {
    const word = RECORD_KEYS[index % RECORD_KEYS.length] ?? 'key';
    return index < RECORD_KEYS.length ? word : \`\${word}\${Math.floor(index / RECORD_KEYS.length) + 1}\`;
}
/** A seed derived from text (never \`0\`), e.g. from a request. */
export function seedOf(text) {
    return hash(text) || 1;
}
const XML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
};
const escapeXml = (text) => text.replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char);
/** A valid XML name for a property name. */
const xmlName = (name) => name.replace(/[^\\w.:-]/g, '_').replace(/^(?=[\\d.:-]|$)/, '_');
function scalarText(value) {
    if (value instanceof Date)
        return value.toISOString();
    if (typeof value === 'object' && value !== null)
        return JSON.stringify(value);
    return String(value);
}
function qualified(name, shape) {
    return shape.prefix === undefined ? name : \`\${xmlName(shape.prefix)}:\${name}\`;
}
function xmlElement(value, shape, name) {
    const tag = qualified(xmlName(name), shape);
    const namespace = shape.namespace === undefined
        ? ''
        : \` xmlns\${shape.prefix === undefined ? '' : \`:\${xmlName(shape.prefix)}\`}="\${escapeXml(shape.namespace)}"\`;
    if (value === null || value === undefined)
        return \`<\${tag}\${namespace}/>\`;
    if (Array.isArray(value)) {
        const items = shape.items ?? {};
        const inner = value
            .map((item) => xmlElement(item, items, items.name ?? name))
            .join('');
        return \`<\${tag}\${namespace}>\${inner}</\${tag}>\`;
    }
    if (typeof value !== 'object' || value instanceof Date || value instanceof Blob)
        return \`<\${tag}\${namespace}>\${escapeXml(scalarText(value))}</\${tag}>\`;
    let attributes = '';
    let content = '';
    for (const [key, item] of Object.entries(value)) {
        if (item === undefined)
            continue;
        const property = shape.properties?.[key] ?? {};
        const childName = property.name ?? key;
        if (property.attribute === true) {
            attributes += \` \${qualified(xmlName(childName), property)}="\${escapeXml(scalarText(item))}"\`;
        }
        else if (property.content === 'text') {
            content += escapeXml(scalarText(item));
        }
        else if (property.content === 'cdata') {
            content += \`<![CDATA[\${scalarText(item).replace(/]]>/g, ']]]]><![CDATA[>')}]]>\`;
        }
        else if (Array.isArray(item)) {
            // Items are named after the array unless they name themselves; \`wrapped\` adds an element.
            const items = property.items ?? {};
            const inner = item
                .map((entry) => xmlElement(entry, items, items.name ?? childName))
                .join('');
            const wrapper = qualified(xmlName(childName), property);
            content += property.wrapped === true ? \`<\${wrapper}>\${inner}</\${wrapper}>\` : inner;
        }
        else if (property.content === 'none' && typeof item === 'object' && item !== null) {
            content += xmlElement(item, property, childName).replace(/^<[^>]*>|<\\/[^>]*>$/g, '');
        }
        else {
            content += xmlElement(item, property, childName);
        }
    }
    return \`<\${tag}\${namespace}\${attributes}>\${content}</\${tag}>\`;
}
/** A value as an XML document, as its schema's XML Object describes it. */
export function xml(value, shape) {
    return \`<?xml version="1.0" encoding="UTF-8"?>\\n\${xmlElement(value, shape, shape.name ?? 'root')}\\n\`;
}
/** A server-sent event: \`event\`, \`id\` and \`retry\` fields, and \`data\` (JSON unless a string). */
function serverSentEvent(item) {
    if (typeof item !== 'object' || item === null || Array.isArray(item))
        return \`data: \${JSON.stringify(item)}\\n\\n\`;
    const record = item;
    const lines = [];
    for (const field of ['event', 'id', 'retry'])
        if (record[field] !== undefined)
            lines.push(\`\${field}: \${scalarText(record[field])}\`);
    const data = record['data'];
    const text = data === undefined ? '' : typeof data === 'string' ? data : JSON.stringify(data);
    for (const line of text.split('\\n'))
        lines.push(\`data: \${line}\`);
    return \`\${lines.join('\\n')}\\n\\n\`;
}
/**
 * Items as a sequential media type writes them: JSON Lines and NDJSON (one JSON value per line),
 * JSON text sequences (RFC 7464) or server-sent events.
 */
export function sequence(items, mediaType) {
    const values = Array.isArray(items) ? items : [items];
    const type = mediaType.split(';')[0]?.trim().toLowerCase() ?? '';
    if (type === 'text/event-stream')
        return values.map(serverSentEvent).join('');
    if (type === 'application/json-seq' || type.endsWith('+json-seq'))
        return values.map((item) => \`\\u001e\${JSON.stringify(item)}\\n\`).join('');
    return values.map((item) => \`\${JSON.stringify(item)}\\n\`).join('');
}
// Entities ------------------------------------------------------------------------------------
/** The seeds that made the \`id\`s fixtures returned, so a later request for one gets the same value. */
const entities = new Map();
const MAX_ENTITIES = 50000;
/** The seed of the fixture that made an \`id\`, if one did. */
export function seedOfEntity(id) {
    return entities.get(id);
}
// Fixtures ------------------------------------------------------------------------------------
/**
 * What generated fixtures make values with. Keys name the value within the fixture (\`'owner.name'\`,
 * \`'tags'\`), so that adding a property to a schema does not change the others.
 */
export class Fake {
    constructor(options = {}, path = '', root = true) {
        _Fake_instances.add(this);
        _Fake_seed.set(this, void 0);
        _Fake_path.set(this, void 0);
        _Fake_empty.set(this, void 0);
        /** The error status the value is the body of, which error models describe. */
        _Fake_status.set(this, void 0);
        /** Whether this makes a fixture's own value, not an item of one of its arrays. */
        _Fake_root.set(this, void 0);
        __classPrivateFieldSet(this, _Fake_seed, Number.isFinite(options.seed) ? Math.trunc(options.seed ?? 0) >>> 0 : 0, "f");
        __classPrivateFieldSet(this, _Fake_path, path, "f");
        __classPrivateFieldSet(this, _Fake_empty, options.empty === true, "f");
        const status = options.status;
        __classPrivateFieldSet(this, _Fake_status, status !== undefined && Number.isInteger(status) && status >= 400 && status <= 599
            ? status
            : undefined, "f");
        __classPrivateFieldSet(this, _Fake_root, root, "f");
    }
    /** Whether this makes the specification's examples (seed \`0\`). */
    get canonical() {
        return __classPrivateFieldGet(this, _Fake_seed, "f") === 0;
    }
    /** The options of the fixture nested at \`key\`: examples within examples, otherwise its own seed. */
    at(key = '') {
        return __classPrivateFieldGet(this, _Fake_instances, "m", _Fake_options).call(this, this.canonical ? 0 : mix(__classPrivateFieldGet(this, _Fake_seed, "f"), \`\${__classPrivateFieldGet(this, _Fake_path, "f")}\${key}/\`));
    }
    /**
     * What \`make\` returns: it is told whether to make the specification's example (seed \`0\`, not
     * an empty state) or another value. One callback lets TypeScript type both from the context.
     * The examples of an error model describe one \`status\`; a body sent with another describes it.
     */
    example(make, status) {
        const other = status !== undefined && __classPrivateFieldGet(this, _Fake_status, "f") !== undefined && status !== __classPrivateFieldGet(this, _Fake_status, "f");
        return make(this.canonical && !__classPrivateFieldGet(this, _Fake_empty, "f") && !other);
    }
    /** Text of a kind (a name, a sentence…), or \`example\` for the examples. */
    text(key, example, kind, minLength = 0, maxLength = Infinity) {
        if (this.canonical)
            return example;
        const random = __classPrivateFieldGet(this, _Fake_instances, "m", _Fake_random).call(this, key);
        const named = personText(kind, __classPrivateFieldGet(this, _Fake_instances, "m", _Fake_person).call(this, key), random, example);
        if (named !== undefined)
            return fit(named, random, minLength, maxLength);
        // Longer text keeps the example's wording a third of the time, where its numbers and codes
        // vary: an example repeated word for word would show twice in a list.
        const long = kind === 'sentence' || kind === 'paragraph' || kind === 'task' || kind === 'headline';
        const varied = long && example.includes(' ') && random.chance(1 / 3) ? like(example, random) : example;
        return fit(varied === example ? TEXT[kind](random, example) : varied, random, minLength, maxLength);
    }
    /** The \`status\` of an error model: the status the body is sent with, or \`example\`. */
    errorStatus(key, example) {
        if (__classPrivateFieldGet(this, _Fake_status, "f") !== undefined)
            return __classPrivateFieldGet(this, _Fake_status, "f");
        return this.canonical ? example : __classPrivateFieldGet(this, _Fake_instances, "m", _Fake_error).call(this, key);
    }
    /**
     * What a property of an error model says about the error (\`title\`, \`detail\`, \`code\`…): it
     * describes the status the body is sent with. For the examples, \`example\`, which describes
     * \`examples\`: a body sent with another status describes that one instead.
     */
    errorText(key, example, part, examples = DEFAULT_ERROR_STATUS, minLength = 0, maxLength = Infinity) {
        const describes = part === 'title' || part === 'detail' || part === 'code' || part === 'type';
        const other = __classPrivateFieldGet(this, _Fake_status, "f") !== undefined && __classPrivateFieldGet(this, _Fake_status, "f") !== examples;
        if (this.canonical && !(describes && other))
            return example;
        const random = __classPrivateFieldGet(this, _Fake_instances, "m", _Fake_random).call(this, key);
        return fit(errorText(part, __classPrivateFieldGet(this, _Fake_instances, "m", _Fake_error).call(this, key), random, example), random, minLength, maxLength);
    }
    /** A string matching \`pattern\`, or \`example\` for the examples. */
    pattern(key, example, pattern, minLength = 0, maxLength = Infinity, kind) {
        if (this.canonical)
            return example;
        const random = __classPrivateFieldGet(this, _Fake_instances, "m", _Fake_random).call(this, key);
        // Realistic text of the property's kind when it matches (a color from the palette).
        if (kind !== undefined)
            for (let attempt = 0; attempt < 3; attempt++) {
                const made = generateText(kind, random, example, minLength, maxLength);
                if (matchesPattern(pattern, made) === true)
                    return made;
            }
        return samplePattern(pattern, random, minLength, maxLength) ?? example;
    }
    /** An integer in \`[min, max]\`. */
    int(key, example, min, max) {
        return this.canonical ? example : __classPrivateFieldGet(this, _Fake_instances, "m", _Fake_random).call(this, key).int(min, max);
    }
    /** A number in \`[min, max]\` with up to \`digits\` decimals, excluding open bounds. */
    number(key, example, min, max, digits = 2, exclusive = 'none') {
        if (this.canonical)
            return example;
        const value = Number((min + __classPrivateFieldGet(this, _Fake_instances, "m", _Fake_random).call(this, key).next() * (max - min)).toFixed(digits));
        const low = exclusive === 'min' || exclusive === 'both' ? value > min : value >= min;
        const high = exclusive === 'max' || exclusive === 'both' ? value < max : value <= max;
        return low && high ? value : example;
    }
    /** A multiple of \`step\` between \`first * step\` and \`last * step\`. */
    multiple(key, example, first, last, step, digits) {
        return this.canonical
            ? example
            : Number((__classPrivateFieldGet(this, _Fake_instances, "m", _Fake_random).call(this, key).int(first, last) * step).toFixed(digits));
    }
    /** \`true\` with probability \`rate\`. */
    bool(key, example, rate = 0.5) {
        return this.canonical ? example : __classPrivateFieldGet(this, _Fake_instances, "m", _Fake_random).call(this, key).chance(rate);
    }
    /** A date, date-time or time near the example. */
    date(key, example, format, when) {
        return this.canonical ? example : dateNear(example, format, when, __classPrivateFieldGet(this, _Fake_instances, "m", _Fake_random).call(this, key));
    }
    /** One of \`values\`: the first for the examples. */
    pick(key, values) {
        return this.canonical ? values[0] : __classPrivateFieldGet(this, _Fake_instances, "m", _Fake_random).call(this, key).pick(values);
    }
    /** The value \`make\` returns for one of \`count\` alternatives: the first for the examples. */
    oneOf(key, count, make) {
        return make(this.canonical ? 0 : __classPrivateFieldGet(this, _Fake_instances, "m", _Fake_random).call(this, \`\${key}#\`).int(0, count - 1));
    }
    /** \`null\` sometimes (never for the examples), otherwise the value \`make\` returns. */
    nullable(key, make, rate = 0.2) {
        return !this.canonical && __classPrivateFieldGet(this, _Fake_instances, "m", _Fake_random).call(this, \`\${key}?\`).chance(rate) ? null : make();
    }
    /**
     * An array of \`count\` items for the examples, otherwise of \`least\` (by default \`min\`) to \`max\`
     * items, and \`min\` in empty states: lists have \`least\` 1, so they are only empty when asked to
     * be. Item 0 of the examples is made of examples too. With \`unique\`, equal items are left out.
     */
    array(key, count, min, max, make, unique = false, least = min) {
        const length = __classPrivateFieldGet(this, _Fake_empty, "f")
            ? min
            : this.canonical
                ? count
                : __classPrivateFieldGet(this, _Fake_instances, "m", _Fake_random).call(this, \`\${key}[]\`).int(least, max);
        const items = [];
        const seen = new Set();
        for (let index = 0; items.length < length && index < length * 3; index++) {
            const seed = this.canonical && index === 0 ? 0 : mix(__classPrivateFieldGet(this, _Fake_seed, "f"), \`\${__classPrivateFieldGet(this, _Fake_path, "f")}\${key}[\${index}]\`);
            const item = make(new Fake(__classPrivateFieldGet(this, _Fake_instances, "m", _Fake_options).call(this, seed), '', false), index);
            if (unique) {
                const identity = JSON.stringify(item);
                if (seen.has(identity))
                    continue;
                seen.add(identity);
            }
            items.push(item);
        }
        return items;
    }
    /** An object with \`count\` (or \`min\` to \`max\`) generated keys, for maps (\`additionalProperties\`). */
    record(key, count, min, max, make) {
        const random = __classPrivateFieldGet(this, _Fake_instances, "m", _Fake_random).call(this, \`\${key}{}\`);
        const length = __classPrivateFieldGet(this, _Fake_empty, "f") ? min : this.canonical ? count : random.int(min, max);
        const result = {};
        for (let index = 0; index < length; index++) {
            const name = recordKey(index);
            const seed = this.canonical && index === 0 ? 0 : mix(__classPrivateFieldGet(this, _Fake_seed, "f"), \`\${__classPrivateFieldGet(this, _Fake_path, "f")}\${key}{\${name}}\`);
            result[name] = make(new Fake(__classPrivateFieldGet(this, _Fake_instances, "m", _Fake_options).call(this, seed), '', false), name);
        }
        return result;
    }
    /**
     * \`value\` with some of its optional properties left out (none for the examples); properties of
     * \`keep\` (the overrides) always stay.
     */
    optional(path, value, keys, keep) {
        if (this.canonical)
            return value;
        const record = value;
        for (const key of keys) {
            if (keep !== undefined && Object.prototype.hasOwnProperty.call(keep, key))
                continue;
            if (__classPrivateFieldGet(this, _Fake_instances, "m", _Fake_random).call(this, \`\${path}\${path === '' ? '' : '.'}\${key}~\`).chance(0.25))
                delete record[key];
        }
        return value;
    }
    /** File content of a media type (a picture, a PDF…), named after the property that holds it. */
    file(key, mediaType) {
        return fileContent(mediaType, __classPrivateFieldGet(this, _Fake_instances, "m", _Fake_random).call(this, key), key);
    }
    /** Remembers which seed made a fixture's \`id\`, so that a request for it gets the same fixture. */
    id(value) {
        if (__classPrivateFieldGet(this, _Fake_root, "f") && (typeof value === 'string' || typeof value === 'number')) {
            if (entities.size >= MAX_ENTITIES)
                entities.clear();
            entities.set(String(value), __classPrivateFieldGet(this, _Fake_seed, "f"));
        }
        return value;
    }
}
_Fake_seed = new WeakMap(), _Fake_path = new WeakMap(), _Fake_empty = new WeakMap(), _Fake_status = new WeakMap(), _Fake_root = new WeakMap(), _Fake_instances = new WeakSet(), _Fake_random = function _Fake_random(key) {
    return new Random(mix(__classPrivateFieldGet(this, _Fake_seed, "f"), \`\${__classPrivateFieldGet(this, _Fake_path, "f")}\${key}\`));
}, _Fake_options = function _Fake_options(seed) {
    return {
        seed,
        ...(__classPrivateFieldGet(this, _Fake_empty, "f") ? { empty: true } : {}),
        ...(__classPrivateFieldGet(this, _Fake_status, "f") === undefined ? {} : { status: __classPrivateFieldGet(this, _Fake_status, "f") }),
    };
}, _Fake_person = function _Fake_person(key) {
    return personName(__classPrivateFieldGet(this, _Fake_instances, "m", _Fake_random).call(this, \`\${parentOf(key)}#person\`));
}, _Fake_error = function _Fake_error(key) {
    return __classPrivateFieldGet(this, _Fake_status, "f") ?? __classPrivateFieldGet(this, _Fake_instances, "m", _Fake_random).call(this, \`\${parentOf(key)}#status\`).pick(ERROR_STATUSES);
};
/** What a generated fixture makes its value with. */
export function fake(options) {
    return new Fake(options);
}
`,"/assets/mocks/fake.ts":`/**
 * Fake data for the generated fixtures (\`features.mocks\`). Values are realistic (names, emails,
 * task titles, colors, files…) and seeded: the same seed always makes the same value, on every run
 * and every machine, without a dependency. Seed \`0\` makes the specification's examples; other
 * seeds vary every value within its schema and cover every enum value, union member, \`null\` and
 * absent property in turn.
 */
/** Options of a fixture factory (\`makePet(overrides, options)\`). */
export interface FixtureOptions {
  /**
   * Which value to make: \`0\` (the default) makes the specification's examples, any other number
   * another value, the same on every call.
   */
  readonly seed?: number;
  /** Make arrays as short as their schema allows, to see empty states. */
  readonly empty?: boolean;
  /**
   * The HTTP status the value is the body of (handlers pass the status they respond with). Error
   * models follow an error status (\`4XX\`, \`5XX\`): their \`status\` repeats it, and their \`title\`,
   * \`detail\` or \`message\`, \`code\` and \`type\` describe it.
   */
  readonly status?: number;
}

/** FNV-1a (32 bits). */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

/** A seed for \`key\` below \`seed\`: never \`0\`, which stands for the examples. */
function mix(seed: number, key: string): number {
  return hash(\`\${seed}:\${key}\`) || 1;
}

/** A pseudo-random sequence (mulberry32). */
export class Random {
  #state: number;

  constructor(seed: number) {
    this.#state = seed >>> 0;
  }

  /** A sequence seeded by a string. */
  static of(text: string): Random {
    return new Random(hash(text));
  }

  /** A number in \`[0, 1)\`. */
  next(): number {
    this.#state = (this.#state + 0x6d2b79f5) | 0;
    let value = this.#state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  /** An integer in \`[min, max]\`. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** One of \`items\`. */
  pick<T>(items: readonly [T, ...T[]]): T {
    return items[this.int(0, items.length - 1)] ?? items[0];
  }

  /** \`true\` with probability \`rate\`. */
  chance(rate: number): boolean {
    return this.next() < rate;
  }
}

// Patterns ------------------------------------------------------------------------------------
//
// Patterns are parsed, never executed: specifications are untrusted input, and running their
// regular expressions risks catastrophic backtracking. Generated strings are checked by a matcher
// of the parsed pattern with a step budget, which is how lookarounds, backreferences, anchors and
// word boundaries are honored. Unicode property escapes (\`\\p{L}\`) are tested one character at a
// time, which cannot backtrack.

/** A source of pseudo-random numbers. */
export interface PatternRandom {
  /** A number in \`[0, 1)\`. */
  next(): number;
}

type Range = readonly [from: number, to: number];

/** One part of a character class: code point ranges or a Unicode property, possibly negated. */
type Component =
  | { readonly kind: 'ranges'; readonly ranges: readonly Range[]; readonly negated: boolean }
  | { readonly kind: 'property'; readonly name: string; readonly negated: boolean };

type Node =
  | { readonly kind: 'set'; readonly parts: readonly Component[]; readonly negated: boolean }
  | { readonly kind: 'sequence'; readonly items: readonly Node[] }
  | { readonly kind: 'alternation'; readonly options: readonly Node[] }
  | { readonly kind: 'repeat'; readonly item: Node; readonly min: number; readonly max: number }
  | { readonly kind: 'group'; readonly index: number | undefined; readonly item: Node }
  | { readonly kind: 'reference'; index: number; readonly name?: string }
  | {
      readonly kind: 'look';
      readonly ahead: boolean;
      readonly negated: boolean;
      readonly item: Node;
    }
  | { readonly kind: 'assert'; readonly which: 'start' | 'end' | 'boundary' | 'inside' }
  | { readonly kind: 'empty' };

interface Parsed {
  readonly root: Node;
  readonly groups: number;
  /** Whether strings must be checked against the pattern: lookarounds, references, assertions. */
  readonly checked: boolean;
  /** Characters positive lookaheads ask for, which the generator prefers. */
  readonly preferred: readonly string[];
}

class Unsupported extends Error {}

const DIGITS: readonly Range[] = [[0x30, 0x39]];
const WORD: readonly Range[] = [
  [0x61, 0x7a],
  [0x41, 0x5a],
  [0x30, 0x39],
  [0x5f, 0x5f],
];
const SPACE: readonly Range[] = [
  [0x20, 0x20],
  [0x09, 0x0d],
  [0xa0, 0xa0],
  [0x1680, 0x1680],
  [0x2000, 0x200a],
  [0x2028, 0x2029],
  [0x202f, 0x202f],
  [0x205f, 0x205f],
  [0x3000, 0x3000],
  [0xfeff, 0xfeff],
];
const LINE_TERMINATORS: readonly Range[] = [
  [0x0a, 0x0a],
  [0x0d, 0x0d],
  [0x2028, 0x2029],
];
/**
 * Characters that negated classes and Unicode properties choose from: ASCII first, then letters,
 * digits and symbols of the major scripts, so that any property has members to pick.
 */
const POOL = [
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  '-_.~ !@#$%&*+=:;,?/\\'"()[]{}<>^|\`\\\\',
  'àéîõüñçßøåæÀÉÑǅʰ',
  'αβγδεζηθλμπσωΔΣΩ',
  'абвгдежзиклмнопАБВГД',
  'אבגדהוזחט',
  'ابتثجحخدذر٠١٢',
  'अआइईउकखगघ०१',
  'กขคงจฉ๑',
  '中文字日本語人',
  'あいうえおかき',
  'アイウエオカキ',
  '한국어사람',
  '€£¥©®™±×÷§¶°',
  '\xA0 ​́ःⅠ½',
  '😀🚀🎉✨',
].join('');

const MAX_PATTERN = 1000;
const MAX_DEPTH = 32;
const MAX_REPEAT = 1000;
const MAX_LENGTH = 10_000;
const MAX_STEPS = 200_000;

class Parser {
  readonly #source: string;
  #index = 0;
  #depth = 0;
  #groups = 0;
  readonly #names = new Map<string, number>();
  readonly #references: Extract<Node, { kind: 'reference' }>[] = [];
  #checked = false;
  readonly #lookaheads: Node[] = [];

  constructor(source: string) {
    this.#source = source;
  }

  parse(): Parsed {
    const root = this.#alternation();
    if (this.#index < this.#source.length) throw new Unsupported('unbalanced parenthesis');
    for (const reference of this.#references) {
      if (reference.name !== undefined) {
        const index = this.#names.get(reference.name);
        if (index === undefined) throw new Unsupported('unknown group name');
        reference.index = index;
      } else if (reference.index > this.#groups) {
        throw new Unsupported('reference to a missing group');
      }
    }
    return {
      root,
      groups: this.#groups,
      checked: this.#checked,
      preferred: this.#lookaheads.flatMap((node) => preferredOf(node)),
    };
  }

  #peek(offset = 0): string | undefined {
    return this.#source[this.#index + offset];
  }

  /** The code point of the character just consumed, consuming its low surrogate too. */
  #codePoint(): number {
    const code = this.#source.codePointAt(this.#index - 1) ?? 0;
    if (code > 0xffff) this.#index++;
    return code;
  }

  #alternation(): Node {
    const options = [this.#sequence()];
    while (this.#peek() === '|') {
      this.#index++;
      options.push(this.#sequence());
    }
    return options.length === 1
      ? (options[0] ?? { kind: 'empty' })
      : { kind: 'alternation', options };
  }

  #sequence(): Node {
    const items: Node[] = [];
    for (
      let char = this.#peek();
      char !== undefined && char !== '|' && char !== ')';
      char = this.#peek()
    ) {
      const atom = this.#atom();
      items.push(this.#quantified(atom));
    }
    return { kind: 'sequence', items };
  }

  #quantified(atom: Node): Node {
    const char = this.#peek();
    let bounds: readonly [number, number] | undefined;
    if (char === '*') bounds = [0, Infinity];
    else if (char === '+') bounds = [1, Infinity];
    else if (char === '?') bounds = [0, 1];
    if (bounds !== undefined) this.#index++;
    else if (char === '{') {
      const match = /^\\{(\\d+)(,(\\d*))?\\}/.exec(this.#source.slice(this.#index));
      // Without a valid quantifier, \`{\` is a literal character.
      if (match === null) return atom;
      const min = Number(match[1]);
      const max = match[2] === undefined ? min : match[3] === '' ? Infinity : Number(match[3]);
      if (min > MAX_REPEAT || max < min) throw new Unsupported('quantifier');
      bounds = [min, max];
      this.#index += match[0].length;
    } else {
      return atom;
    }
    // Lazy quantifiers match the same strings.
    if (this.#peek() === '?') this.#index++;
    if (atom.kind === 'assert' || atom.kind === 'look') return atom;
    return { kind: 'repeat', item: atom, min: bounds[0], max: bounds[1] };
  }

  #atom(): Node {
    const char = this.#peek() ?? '';
    this.#index++;
    switch (char) {
      case '(':
        return this.#group();
      case '[':
        return this.#class();
      case '.':
        return {
          kind: 'set',
          parts: [{ kind: 'ranges', ranges: LINE_TERMINATORS, negated: false }],
          negated: true,
        };
      case '^':
        this.#checked = true;
        return { kind: 'assert', which: 'start' };
      case '$':
        this.#checked = true;
        return { kind: 'assert', which: 'end' };
      case '\\\\':
        return this.#escape();
      default: {
        const code = this.#codePoint();
        return literal(code);
      }
    }
  }

  #group(): Node {
    let index: number | undefined;
    let look: { ahead: boolean; negated: boolean } | undefined;
    if (this.#peek() === '?') {
      const next = this.#peek(1);
      const after = this.#peek(2);
      if (next === ':') this.#index += 2;
      else if (next === '=' || next === '!') {
        look = { ahead: true, negated: next === '!' };
        this.#index += 2;
      } else if (next === '<' && (after === '=' || after === '!')) {
        look = { ahead: false, negated: after === '!' };
        this.#index += 3;
      } else if (next === '<') {
        const end = this.#source.indexOf('>', this.#index);
        if (end === -1) throw new Unsupported('group name');
        const name = this.#source.slice(this.#index + 2, end);
        index = ++this.#groups;
        this.#names.set(name, index);
        this.#index = end + 1;
      } else {
        // Modifiers such as \`(?i:…)\`: the generated strings match the pattern as written.
        const match = /^\\?[ims]*(?:-[ims]+)?:/.exec(this.#source.slice(this.#index));
        if (match === null) throw new Unsupported('group syntax');
        this.#index += match[0].length;
      }
    } else {
      index = ++this.#groups;
    }
    if (++this.#depth > MAX_DEPTH) throw new Unsupported('nesting');
    const item = this.#alternation();
    this.#depth--;
    if (this.#peek() !== ')') throw new Unsupported('unbalanced parenthesis');
    this.#index++;
    if (look !== undefined) {
      this.#checked = true;
      const node: Node = { kind: 'look', ...look, item };
      if (look.ahead && !look.negated) this.#lookaheads.push(item);
      return node;
    }
    return { kind: 'group', index, item };
  }

  /** An escape outside a class. */
  #escape(): Node {
    const char = this.#peek();
    if (char === 'b' || char === 'B') {
      this.#index++;
      this.#checked = true;
      return { kind: 'assert', which: char === 'b' ? 'boundary' : 'inside' };
    }
    if (char === 'k' && this.#peek(1) === '<') {
      const end = this.#source.indexOf('>', this.#index);
      if (end === -1) throw new Unsupported('group name');
      const node: Extract<Node, { kind: 'reference' }> = {
        kind: 'reference',
        index: 0,
        name: this.#source.slice(this.#index + 2, end),
      };
      this.#index = end + 1;
      this.#references.push(node);
      this.#checked = true;
      return node;
    }
    if (char !== undefined && /[1-9]/.test(char)) {
      const digits = /^\\d+/.exec(this.#source.slice(this.#index))?.[0] ?? char;
      this.#index += digits.length;
      const node: Extract<Node, { kind: 'reference' }> = {
        kind: 'reference',
        index: Number(digits),
      };
      this.#references.push(node);
      this.#checked = true;
      return node;
    }
    const component = this.#classEscape();
    if (component !== undefined) return { kind: 'set', parts: [component], negated: false };
    return literal(this.#characterEscape());
  }

  /** \`\\d\`, \`\\w\`, \`\\s\`, \`\\p{…}\` and their negations. */
  #classEscape(): Component | undefined {
    const char = this.#peek();
    if (char === undefined) return undefined;
    const lower = char.toLowerCase();
    const negated = char !== lower;
    if (lower === 'p' && this.#peek(1) === '{') {
      const end = this.#source.indexOf('}', this.#index);
      const name = end === -1 ? '' : this.#source.slice(this.#index + 2, end);
      if (!/^[A-Za-z_]+(?:=[A-Za-z_]+)?$/.test(name) || propertyTest(name) === undefined)
        throw new Unsupported('Unicode property');
      this.#index = end + 1;
      return { kind: 'property', name, negated };
    }
    const ranges =
      lower === 'd' ? DIGITS : lower === 'w' ? WORD : lower === 's' ? SPACE : undefined;
    if (ranges === undefined) return undefined;
    this.#index++;
    return { kind: 'ranges', ranges, negated };
  }

  /** The character of an escape such as \`\\n\`, \`\\x41\`, \`\\u{41}\`, \`\\cJ\` or \`\\.\`. */
  #characterEscape(): number {
    const char = this.#peek();
    if (char === undefined) throw new Unsupported('trailing backslash');
    this.#index++;
    const simple: Readonly<Record<string, number>> = { t: 9, n: 10, v: 11, f: 12, r: 13 };
    if (Object.prototype.hasOwnProperty.call(simple, char)) return simple[char] ?? 0;
    if (char === '0' && !/\\d/.test(this.#peek() ?? '')) return 0;
    if (char === 'c') {
      const letter = this.#peek();
      if (letter === undefined || !/[A-Za-z]/.test(letter)) return 0x5c;
      this.#index++;
      return (letter.codePointAt(0) ?? 0) % 32;
    }
    const hexCode = (length: number): number => {
      const digits = this.#source.slice(this.#index, this.#index + length);
      if (digits.length !== length || !/^[0-9a-fA-F]+$/.test(digits))
        throw new Unsupported('escape');
      this.#index += length;
      return Number.parseInt(digits, 16);
    };
    if (char === 'x') return hexCode(2);
    if (char === 'u') {
      if (this.#peek() !== '{') return hexCode(4);
      const end = this.#source.indexOf('}', this.#index);
      const digits = this.#source.slice(this.#index + 1, end);
      if (end === -1 || !/^[0-9a-fA-F]{1,6}$/.test(digits)) throw new Unsupported('escape');
      this.#index = end + 1;
      return Number.parseInt(digits, 16);
    }
    // An identity escape (\`\\.\`, \`\\/\`): the character itself.
    return this.#codePoint();
  }

  #class(): Node {
    const negated = this.#peek() === '^';
    if (negated) this.#index++;
    const ranges: Range[] = [];
    const parts: Component[] = [];
    for (;;) {
      const char = this.#peek();
      if (char === undefined) throw new Unsupported('unterminated class');
      // In JavaScript, \`]\` ends a class even right after \`[\` or \`[^\`.
      if (char === ']') {
        this.#index++;
        break;
      }
      const from = this.#classAtom(parts);
      if (from === undefined) continue;
      if (this.#peek() === '-' && this.#peek(1) !== ']' && this.#peek(1) !== undefined) {
        this.#index++;
        const to = this.#classAtom(parts);
        if (to === undefined || to < from) throw new Unsupported('class range');
        ranges.push([from, to]);
      } else {
        ranges.push([from, from]);
      }
    }
    if (ranges.length > 0) parts.unshift({ kind: 'ranges', ranges, negated: false });
    return { kind: 'set', parts, negated };
  }

  /** One character of a class; class escapes (\`\\d\`, \`\\p{L}\`) are added to \`parts\` instead. */
  #classAtom(parts: Component[]): number | undefined {
    const char = this.#peek() ?? '';
    this.#index++;
    if (char !== '\\\\') return this.#codePoint();
    if (this.#peek() === 'b') {
      this.#index++;
      return 8;
    }
    if (this.#peek() === '-') {
      this.#index++;
      return 0x2d;
    }
    const component = this.#classEscape();
    if (component === undefined) return this.#characterEscape();
    parts.push(component);
    return undefined;
  }
}

function literal(code: number): Node {
  return {
    kind: 'set',
    parts: [{ kind: 'ranges', ranges: [[code, code]], negated: false }],
    negated: false,
  };
}

const propertyTests = new Map<string, RegExp | undefined>();

/** A test of one character against a Unicode property, or \`undefined\` if there is no such property. */
function propertyTest(name: string): RegExp | undefined {
  if (propertyTests.has(name)) return propertyTests.get(name);
  let test: RegExp | undefined;
  try {
    // The name was checked to be a property name: the expression is one character class.
    test = new RegExp(\`^\\\\p{\${name}}$\`, 'u');
  } catch {
    test = undefined;
  }
  propertyTests.set(name, test);
  return test;
}

function inRanges(code: number, ranges: readonly Range[]): boolean {
  return ranges.some(([from, to]) => code >= from && code <= to);
}

function member(code: number, node: Extract<Node, { kind: 'set' }>): boolean {
  const hit = node.parts.some((part) => {
    const inside =
      part.kind === 'ranges'
        ? inRanges(code, part.ranges)
        : (propertyTest(part.name)?.test(String.fromCodePoint(code)) ?? false);
    return inside !== part.negated;
  });
  return hit !== node.negated;
}

/** Characters a positive lookahead's literal parts and simple classes require. */
function preferredOf(node: Node): string[] {
  switch (node.kind) {
    case 'set':
      return node.negated || node.parts.length !== 1 || node.parts[0]?.kind !== 'ranges'
        ? []
        : [setSample(node)];
    case 'sequence':
      return node.items.flatMap(preferredOf);
    case 'alternation':
      return node.options.flatMap(preferredOf);
    case 'repeat':
      return node.min > 0 ? preferredOf(node.item) : [];
    case 'group':
      return preferredOf(node.item);
    default:
      return [];
  }
}

/** Every character of a small class, for lookahead preferences. */
function setSample(node: Extract<Node, { kind: 'set' }>): string {
  const part = node.parts[0];
  if (part?.kind !== 'ranges') return '';
  let result = '';
  for (const [from, to] of part.ranges)
    for (let code = from; code <= to && result.length < 64; code++)
      result += String.fromCodePoint(code);
  return result;
}

function int(random: PatternRandom, min: number, max: number): number {
  return min + Math.floor(random.next() * (max - min + 1));
}

interface Generation {
  readonly random: PatternRandom;
  readonly extra: number;
  readonly captures: (string | undefined)[];
  readonly preferred: string;
  /** Whether positive lookbehinds write what they look for (tried on every other attempt). */
  readonly behind: boolean;
}

function character(node: Extract<Node, { kind: 'set' }>, context: Generation): string {
  const { random } = context;
  // Characters a lookahead asks for, half of the time when the class allows them.
  if (context.preferred !== '' && random.next() < 0.5) {
    const wanted = Array.from(context.preferred).filter((c) => member(c.codePointAt(0) ?? 0, node));
    if (wanted.length > 0) return wanted[int(random, 0, wanted.length - 1)] ?? '';
  }
  const simple =
    !node.negated && node.parts.every((part) => part.kind === 'ranges' && !part.negated);
  if (simple) {
    const ranges = node.parts.flatMap((part) => (part.kind === 'ranges' ? part.ranges : []));
    // The printable ASCII part of the ranges, when they have one, keeps fixtures readable.
    const printable = ranges.flatMap(([from, to]): Range[] => {
      const low = Math.max(from, 0x20);
      const high = Math.min(to, 0x7e);
      return low <= high ? [[low, high]] : [];
    });
    const choices = printable.length > 0 ? printable : ranges;
    const range = choices[int(random, 0, choices.length - 1)];
    if (range === undefined) throw new Unsupported('empty class');
    return String.fromCodePoint(int(random, range[0], range[1]));
  }
  const candidates = Array.from(POOL).filter((c) => member(c.codePointAt(0) ?? 0, node));
  if (candidates.length === 0) throw new Unsupported('empty class');
  // Prefer the ASCII members of the pool when there are some.
  const plain = candidates.filter((c) => (c.codePointAt(0) ?? 0) < 0x80);
  const from = plain.length > 0 && random.next() < 0.8 ? plain : candidates;
  return from[int(random, 0, from.length - 1)] ?? '';
}

function generate(node: Node, context: Generation): string {
  switch (node.kind) {
    case 'empty':
    case 'assert':
      return '';
    case 'look':
      return !node.ahead && !node.negated && context.behind ? generate(node.item, context) : '';
    case 'set':
      return character(node, context);
    case 'sequence': {
      let result = '';
      for (const item of node.items) {
        result += generate(item, context);
        if (result.length > MAX_LENGTH) throw new Unsupported('too long');
      }
      return result;
    }
    case 'alternation': {
      const option = node.options[int(context.random, 0, node.options.length - 1)];
      return option === undefined ? '' : generate(option, context);
    }
    case 'repeat': {
      const room = Math.min(node.max - node.min, context.extra);
      const count = node.min + (room > 0 ? int(context.random, 0, room) : 0);
      let result = '';
      for (let index = 0; index < count; index++) {
        result += generate(node.item, context);
        if (result.length > MAX_LENGTH) throw new Unsupported('too long');
      }
      return result;
    }
    case 'group': {
      const text = generate(node.item, context);
      if (node.index !== undefined) context.captures[node.index] = text;
      return text;
    }
    case 'reference':
      return context.captures[node.index] ?? '';
  }
}

type Captures = readonly (string | undefined)[];
type Continuation = (position: number, captures: Captures) => boolean;

class Budget extends Error {}

/** Whether \`text\` contains a match of the pattern, as \`RegExp.prototype.test\` would answer. */
function matches(parsed: Parsed, text: string): boolean {
  let steps = 0;
  const isWord = (position: number): boolean => {
    const code = text.charCodeAt(position);
    return Number.isFinite(code) && inRanges(code, WORD);
  };
  const match = (node: Node, position: number, captures: Captures, next: Continuation): boolean => {
    if (++steps > MAX_STEPS) throw new Budget();
    switch (node.kind) {
      case 'empty':
        return next(position, captures);
      case 'set': {
        if (position >= text.length) return false;
        const code = text.codePointAt(position) ?? 0;
        if (!member(code, node)) return false;
        return next(position + (code > 0xffff ? 2 : 1), captures);
      }
      case 'sequence': {
        const step = (index: number, at: number, current: Captures): boolean => {
          const item = node.items[index];
          return item === undefined
            ? next(at, current)
            : match(item, at, current, (after, updated) => step(index + 1, after, updated));
        };
        return step(0, position, captures);
      }
      case 'alternation':
        return node.options.some((option) => match(option, position, captures, next));
      case 'group':
        return match(node.item, position, captures, (after, updated) => {
          if (node.index === undefined) return next(after, updated);
          const copy = [...updated];
          copy[node.index] = text.slice(position, after);
          return next(after, copy);
        });
      case 'reference': {
        const captured = captures[node.index];
        if (captured === undefined) return next(position, captures);
        return text.startsWith(captured, position)
          ? next(position + captured.length, captures)
          : false;
      }
      case 'assert': {
        const ok =
          node.which === 'start'
            ? position === 0
            : node.which === 'end'
              ? position === text.length
              : (isWord(position - 1) !== isWord(position)) === (node.which === 'boundary');
        return ok && next(position, captures);
      }
      case 'look': {
        let found: Captures | undefined;
        if (node.ahead) {
          match(node.item, position, captures, (_after, updated) => {
            found = updated;
            return true;
          });
        } else {
          for (let start = position; start >= 0; start--) {
            const ended = match(node.item, start, captures, (after, updated) => {
              if (after !== position) return false;
              found = updated;
              return true;
            });
            if (ended) break;
          }
        }
        if (node.negated) return found === undefined && next(position, captures);
        return found !== undefined && next(position, found);
      }
      case 'repeat': {
        const loop = (count: number, at: number, current: Captures): boolean => {
          if (
            count < node.max &&
            match(node.item, at, current, (after, updated) =>
              // An iteration that matched nothing would repeat forever.
              after === at ? false : loop(count + 1, after, updated),
            )
          )
            return true;
          return count >= node.min && next(at, current);
        };
        return loop(0, position, captures);
      }
    }
  };
  try {
    for (let start = 0; start <= text.length; start++)
      if (match(parsed.root, start, [], () => true)) return true;
    return false;
  } catch (error) {
    if (error instanceof Budget) return false;
    throw error;
  }
}

const parsedPatterns = new Map<string, Parsed | undefined>();

function parse(pattern: string): Parsed | undefined {
  if (parsedPatterns.has(pattern)) return parsedPatterns.get(pattern);
  let parsed: Parsed | undefined;
  if (pattern.length <= MAX_PATTERN) {
    try {
      parsed = new Parser(pattern).parse();
    } catch (error) {
      if (!(error instanceof Unsupported)) throw error;
    }
  }
  parsedPatterns.set(pattern, parsed);
  return parsed;
}

/** Characters as JSON Schema counts them (code points) and as the validators do (UTF-16 units). */
function fitsLength(text: string, minLength: number, maxLength: number): boolean {
  const points = Array.from(text).length;
  return Math.min(points, text.length) >= minLength && Math.max(points, text.length) <= maxLength;
}

/** How many repetitions unbounded quantifiers may add, in the order they are tried. */
const EXTRAS = [3, 1, 0, 6, 12, 24, 48, 96];

/**
 * A string matching \`pattern\` whose length is within \`[minLength, maxLength]\`, or \`undefined\` when
 * the pattern is not valid or no such string was found.
 */
export function samplePattern(
  pattern: string,
  random: PatternRandom,
  minLength = 0,
  maxLength = Infinity,
): string | undefined {
  const parsed = parse(pattern);
  if (parsed === undefined) return undefined;
  const preferred = parsed.preferred.join('');
  for (const extra of EXTRAS) {
    for (let attempt = 0; attempt < 8; attempt++) {
      let text: string;
      try {
        text = generate(parsed.root, {
          random,
          extra,
          captures: Array.from({ length: parsed.groups + 1 }, () => undefined),
          preferred,
          behind: attempt % 2 === 0,
        });
      } catch (error) {
        if (error instanceof Unsupported) return undefined;
        throw error;
      }
      if (!fitsLength(text, minLength, maxLength)) break;
      if (!parsed.checked || matches(parsed, text)) return text;
    }
  }
  return undefined;
}

/** Whether \`text\` matches \`pattern\` (\`undefined\` when the pattern is not valid). */
export function matchesPattern(pattern: string, text: string): boolean | undefined {
  const parsed = parse(pattern);
  return parsed === undefined ? undefined : matches(parsed, text);
}

// Vocabulary ----------------------------------------------------------------------------------

/** A non-empty list of the \`|\`-separated entries of \`entries\`. */
function list(entries: string): readonly [string, ...string[]] {
  const [first = '', ...rest] = entries.split('|');
  return [first, ...rest];
}

/** A non-empty list of \`name:value\` pairs. */
function pairs(
  entries: string,
): readonly [readonly [string, string], ...(readonly [string, string])[]] {
  const split = (entry: string): readonly [string, string] => {
    const [name = '', value = ''] = entry.split(':');
    return [name, value];
  };
  const [first, ...rest] = list(entries);
  return [split(first), ...rest.map(split)];
}

const FIRST_NAMES = list(
  'Ada|Grace|Alan|Linus|Margaret|Katherine|Dennis|Barbara|Ken|Radia|Tim|Hedy|Frances|Edsger|' +
    'Donald|Shafi|Leslie|Sophie|Priya|Mateo|Amara|Yuki|Lena|Omar|Chen|Sofia|Noah|Aisha|Lucas|Mia|' +
    'Ethan|Zara|Hiro|Ingrid|Diego|Fatima|Liam|Elena|Kwame|Nadia|Oscar|Ravi|Sara|Tomás|Viktor|Wen|' +
    'Ximena|Yusuf|Zoe|Alex|Jordan|Taylor|Morgan|Riley|Casey|Jamie|Avery|Quinn|Rowan|Maya',
);
const LAST_NAMES = list(
  'Lovelace|Hopper|Turing|Torvalds|Hamilton|Johnson|Ritchie|Liskov|Thompson|Perlman|Lamarr|' +
    'Allen|Dijkstra|Knuth|Goldwasser|Lamport|Wilson|Patel|García|Okafor|Tanaka|Müller|Haddad|Wang|' +
    'Rossi|Smith|Khan|Silva|Nguyen|Kim|Ali|Cohen|Larsen|Fernández|Mensah|Novak|Kowalski|Ivanova|' +
    'Schmidt|Dubois|Andersson|Moreau|Costa|Yilmaz|Park|Singh|Brown|Martin|Lee|Clark|Lewis|Walker|' +
    'Young|King|Wright|Scott|Green|Baker|Hill',
);
const LOREM = list(
  'lorem|ipsum|dolor|sit|amet|consectetur|adipiscing|elit|sed|eiusmod|tempor|incididunt|labore|' +
    'dolore|magna|aliqua|enim|minim|veniam|nostrud|ullamco|laboris|aliquip|commodo|consequat|aute|' +
    'irure|velit|esse|cillum|fugiat|nulla',
);
const SENTENCES = list(
  'The new layout is ready for review.|' +
    'Customers reported that the page loads slowly on mobile.|' +
    'Let’s align on the scope before we start.|' +
    'This blocks the next release.|' +
    'Add tests for the edge cases we found last week.|' +
    'The copy should match the latest designs.|' +
    'We agreed to ship the first version behind a feature flag.|' +
    'Numbers look good after the last deploy.|' +
    'Can someone double-check the translations?|' +
    'The integration works in staging but not in production yet.|' +
    'Follow-up from the planning meeting on Tuesday.|' +
    'Most of the work is done; the docs still need an update.|' +
    'Error rates dropped by half since the fix went out.|' +
    'Please keep the old endpoint until every client has migrated.|' +
    'The design team shared feedback in the review thread.|' +
    'This needs a decision from product before we continue.|' +
    'Performance is within budget on every page we measured.|' +
    'I left a few comments on the pull request.|' +
    'Support received three tickets about this today.|' +
    'We can reuse the components from the settings page.|' +
    'The import fails for files larger than 10 MB.|' +
    'Accessibility checks pass in both themes.|' +
    'Moving this to the next sprint to make room for the hotfix.|' +
    'The data migration finished without errors.|' +
    'Thanks for the quick turnaround on this!|' +
    'We should measure the impact before rolling it out to everyone.|' +
    'Looks great on desktop; tablet still needs some work.|' +
    'Security review is scheduled for Thursday.|' +
    'The onboarding flow now takes two steps instead of five.|' +
    'Let’s pair on this tomorrow morning.',
);
const JOB_LEVELS = list('Senior|Staff|Principal|Lead|Junior||||');
const JOB_AREAS = list(
  'Frontend|Backend|Product|Platform|Data|Mobile|Security|Growth|Design|Infrastructure|QA|DevOps',
);
const JOB_ROLES = list(
  'Engineer|Designer|Manager|Analyst|Scientist|Architect|Developer|Researcher|Writer',
);
const DEPARTMENTS = list(
  'Engineering|Design|Marketing|Sales|Support|Finance|Operations|Legal|People|Product|Research|Security',
);
const COMPANY_SUFFIXES = list(
  'Labs|Systems|Group|Studio|Works|Technologies|& Co.|Industries|Partners|Ventures|Analytics|Cloud',
);
const COMPANY_FIRST = list('Blue|Bright|North|Swift|Silver|Green|Clear|Bold|Prime|Nova');
const COMPANY_SECOND = list('Harbor|Peak|Wave|Leaf|Stone|Field|Bridge|Forge|Pixel|Orbit');
const PRODUCT_ADJECTIVES = list(
  'Ergonomic|Wireless|Compact|Smart|Classic|Premium|Portable|Organic|Handmade|Recycled',
);
const PRODUCT_MATERIALS = list('Steel|Wooden|Cotton|Leather|Bamboo|Ceramic|Glass|Wool');
const PRODUCT_NOUNS = list(
  'Chair|Lamp|Backpack|Keyboard|Mug|Notebook|Headphones|Bottle|Desk|Jacket|Watch|Speaker',
);
const PROJECT_AREAS = list(
  'Mobile|Billing|Data|Marketing|Analytics|Customer|Payments|Search|Onboarding|Platform|Identity|' +
    'Checkout|Design system|Infrastructure|Support|Growth|Security|Reporting|Notifications|Admin',
);
const PROJECT_NOUNS = list(
  'app|revamp|migration|relaunch|portal|redesign|platform|pipeline|dashboard|API|integration|' +
    'rollout|cleanup|audit|launch',
);
const TASK_VERBS = list(
  'Design|Fix|Write|Add|Update|Refactor|Review|Migrate|Remove|Investigate|Document|Test|Improve|' +
    'Optimize|Implement|Set up|Ship|Prototype',
);
const TASK_OBJECTS = list(
  'the pricing page|the login redirect|release notes|rate limiting|the onboarding flow|' +
    'the search index|billing webhooks|dark mode|CSV export|error messages|the mobile layout|' +
    'the API docs|user settings|password reset|notification emails|the audit log|the caching layer|' +
    'analytics events|the checkout form|image uploads',
);
const HEADLINE_TEMPLATES = list(
  'A Guide to %|% in Practice|Why % Matters|The Future of %|Getting Started with %|' +
    '%: Lessons Learned|Building Better %|Ten Tips for %',
);
const HEADLINE_TOPICS = list(
  'Remote Work|Open Source|Design Systems|Data Privacy|Cloud Costs|Team Rituals|Accessibility|' +
    'Performance|Testing|Onboarding',
);
const TAGS = list(
  'bug|feature|frontend|backend|design|docs|performance|security|ux|infra|mobile|api|testing|' +
    'research|urgent|refactor|accessibility|analytics',
);
const STREET_NAMES = list(
  'Main|Oak|Maple|Cedar|Elm|Pine|Lake|Hill|Park|Sunset|River|Church|Market|Mill|Spring',
);
const STREET_SUFFIXES = list('Street|Avenue|Road|Lane|Drive|Way|Boulevard|Court');
const CITIES = list(
  'San Francisco|New York|London|Berlin|Paris|Tokyo|Toronto|Sydney|Amsterdam|Barcelona|Lisbon|' +
    'Dublin|Stockholm|Copenhagen|Zurich|Vienna|Prague|Warsaw|Seoul|Singapore|Bangalore|Lagos|' +
    'Nairobi|Cape Town|São Paulo|Buenos Aires|Mexico City|Austin|Seattle|Chicago',
);
const STATES = list(
  'California|New York|Texas|Washington|Illinois|Ontario|Bavaria|Catalonia|Victoria|Queensland|' +
    'Lombardy|Île-de-France',
);
const COUNTRIES = pairs(
  'United States:US|United Kingdom:GB|Germany:DE|France:FR|Japan:JP|Canada:CA|Australia:AU|' +
    'Netherlands:NL|Spain:ES|Portugal:PT|Ireland:IE|Sweden:SE|Denmark:DK|Switzerland:CH|Austria:AT|' +
    'Poland:PL|South Korea:KR|Singapore:SG|India:IN|Nigeria:NG|Kenya:KE|South Africa:ZA|Brazil:BR|' +
    'Argentina:AR|Mexico:MX|Italy:IT|Norway:NO|Finland:FI|New Zealand:NZ',
);
const TIMEZONES = list(
  'America/New_York|America/Los_Angeles|America/Chicago|America/Sao_Paulo|Europe/London|' +
    'Europe/Berlin|Europe/Paris|Europe/Madrid|Asia/Tokyo|Asia/Singapore|Asia/Kolkata|' +
    'Australia/Sydney|Africa/Lagos|UTC',
);
const LOCALES = list('en-US|en-GB|de-DE|fr-FR|es-ES|pt-BR|ja-JP|ko-KR|zh-CN|it-IT|nl-NL|sv-SE');
const LANGUAGES = list('en|de|fr|es|pt|ja|ko|zh|it|nl|sv|hi');
const CURRENCIES = list('USD|EUR|GBP|JPY|CAD|AUD|CHF|SEK|INR|BRL|MXN|SGD');
const FILE_TYPES = pairs(
  'image/png:png|image/jpeg:jpg|application/pdf:pdf|text/plain:txt|text/csv:csv|' +
    'application/json:json|image/svg+xml:svg|application/zip:zip|image/gif:gif|text/markdown:md',
);
const FILE_STEMS = list(
  'report|invoice|wireframe|screenshot|notes|budget|roadmap|contract|photo|logo|presentation|' +
    'summary|draft|export|diagram|receipt',
);
const USER_AGENTS = list(
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15|' +
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36|' +
    'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0|' +
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
);
const EMOJI = list('🚀|✨|🎉|👍|🔥|✅|💡|📦|🐛|🎨');
const COLORS = list(
  '#ef4444|#f97316|#f59e0b|#eab308|#84cc16|#22c55e|#10b981|#14b8a6|#06b6d4|#0ea5e9|#3b82f6|' +
    '#6366f1|#8b5cf6|#a855f7|#d946ef|#ec4899|#f43f5e|#64748b',
);
const RECORD_KEYS = list(
  'source|plan|region|channel|team|priority|campaign|version|theme|segment|tier|origin',
);
/** Domains reserved for documentation (RFC 2606). */
const DOMAINS = list('example.com|example.org|example.net');
const DOCUMENTATION_NETWORKS = list('192.0.2|198.51.100|203.0.113');

// Generators ----------------------------------------------------------------------------------

/** Lowercase ASCII for identifiers: \`Tomás Müller\` → \`tomas.muller\`. */
function ascii(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

const pad = (value: number, length = 2): string => String(value).padStart(length, '0');

function hex(random: Random, length: number): string {
  let result = '';
  for (let index = 0; index < length; index++) result += random.int(0, 15).toString(16);
  return result;
}

function alphanumeric(random: Random, length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let index = 0; index < length; index++) result += chars.charAt(random.int(0, 35));
  return result;
}

function base64Url(random: Random, length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  for (let index = 0; index < length; index++) result += chars.charAt(random.int(0, 63));
  return result;
}

/** An RFC 9562 version 4 UUID. */
function uuid(random: Random): string {
  const digits = Array.from({ length: 32 }, (_, index) => {
    if (index === 12) return '4';
    if (index === 16) return (8 + random.int(0, 3)).toString(16);
    return random.int(0, 15).toString(16);
  }).join('');
  return \`\${digits.slice(0, 8)}-\${digits.slice(8, 12)}-\${digits.slice(12, 16)}-\${digits.slice(16, 20)}-\${digits.slice(20)}\`;
}

function sentences(random: Random, count: number): string {
  const result: string[] = [];
  for (let index = 0; index < count; index++) {
    const sentence = random.pick(SENTENCES);
    if (!result.includes(sentence)) result.push(sentence);
  }
  return result.join(' ');
}

function luhn(digits: string): string {
  let sum = 0;
  for (let index = 0; index < digits.length; index++) {
    let digit = Number(digits.charAt(digits.length - 1 - index));
    if (index % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return \`\${digits}\${(10 - (sum % 10)) % 10}\`;
}

function isbn(random: Random): string {
  const body = \`978\${Array.from({ length: 9 }, () => random.int(0, 9)).join('')}\`;
  let sum = 0;
  for (let index = 0; index < 12; index++)
    sum += Number(body.charAt(index)) * (index % 2 === 0 ? 1 : 3);
  return \`\${body}\${(10 - (sum % 10)) % 10}\`;
}

/** A British IBAN with valid check digits. */
function iban(random: Random): string {
  const bank = Array.from({ length: 4 }, () => String.fromCharCode(random.int(65, 90))).join('');
  const bban = \`\${bank}\${Array.from({ length: 14 }, () => random.int(0, 9)).join('')}\`;
  const numeric = \`\${bban}GB00\`.replace(/[A-Z]/g, (letter) => String(letter.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97;
  return \`GB\${pad(98 - remainder)}\${bban}\`;
}

/** A person's first and last name. */
export function personName(random: Random): readonly [string, string] {
  return [random.pick(FIRST_NAMES), random.pick(LAST_NAMES)];
}

/**
 * Text of a kind that names a person, for \`person\`, or \`undefined\` for other kinds: the \`name\`,
 * \`email\` and \`username\` of one object belong to the same person.
 */
export function personText(
  kind: TextKind,
  person: readonly [string, string],
  random: Random,
  example: string,
): string | undefined {
  const [first, last] = person;
  switch (kind) {
    case 'firstName':
      return first;
    case 'lastName':
      return last;
    case 'fullName':
      return \`\${first} \${last}\`;
    case 'username':
      return \`\${ascii(first)}.\${ascii(last)}\${random.int(1, 99)}\`;
    case 'email':
      return \`\${ascii(first)}.\${ascii(last)}@\${domainOf(example, random)}\`;
    default:
      return undefined;
  }
}

/** The domain of an example email address, or a documentation domain. */
function domainOf(example: string, random: Random): string {
  const domain = /@([\\w.-]+\\.[a-z]{2,})$/i.exec(example)?.[1];
  return domain ?? random.pick(DOMAINS);
}

/** The origin of an example URL, or a documentation domain's. */
function originOf(example: string, random: Random): string {
  return /^(https?:\\/\\/[^/?#]+)/i.exec(example)?.[1] ?? \`https://\${random.pick(DOMAINS)}\`;
}

/** A colorful SVG picture as a \`data:\` URL: it renders anywhere, without the network. */
function picture(random: Random, width: number, height: number): string {
  const [background, accent, detail] = [
    random.pick(COLORS),
    random.pick(COLORS),
    random.pick(COLORS),
  ];
  const svg =
    \`<svg xmlns='http://www.w3.org/2000/svg' width='\${width}' height='\${height}' viewBox='0 0 \${width} \${height}'>\` +
    \`<rect width='\${width}' height='\${height}' fill='\${background}'/>\` +
    \`<circle cx='\${random.int(0, width)}' cy='\${random.int(0, height)}' r='\${random.int(width / 6, width / 2)}' fill='\${accent}' fill-opacity='.7'/>\` +
    \`<rect x='\${random.int(0, width / 2)}' y='\${random.int(0, height / 2)}' width='\${random.int(width / 6, width / 2)}' height='\${random.int(height / 6, height / 2)}' fill='\${detail}' fill-opacity='.6'/></svg>\`;
  return \`data:image/svg+xml,\${svg.replace(/[<>#'"]/g, (char) => \`%\${char.charCodeAt(0).toString(16).toUpperCase()}\`)}\`;
}

/** What a text generator makes: realistic text of a kind. */
export type TextKind =
  | 'words'
  | 'word'
  | 'sentence'
  | 'paragraph'
  | 'like'
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'username'
  | 'email'
  | 'phone'
  | 'jobTitle'
  | 'company'
  | 'department'
  | 'product'
  | 'project'
  | 'task'
  | 'headline'
  | 'tag'
  | 'slug'
  | 'code'
  | 'street'
  | 'city'
  | 'state'
  | 'country'
  | 'countryCode'
  | 'postalCode'
  | 'address'
  | 'url'
  | 'imageUrl'
  | 'avatarUrl'
  | 'domain'
  | 'ipv4'
  | 'ipv6'
  | 'mac'
  | 'userAgent'
  | 'token'
  | 'jwt'
  | 'password'
  | 'hash'
  | 'uuid'
  | 'color'
  | 'mimeType'
  | 'fileName'
  | 'fileExtension'
  | 'filePath'
  | 'semver'
  | 'emoji'
  | 'currency'
  | 'locale'
  | 'language'
  | 'timezone'
  | 'sku'
  | 'isbn'
  | 'iban'
  | 'creditCard'
  | 'base64'
  | 'json'
  | 'duration'
  | 'regex'
  | 'pointer'
  | 'relativePointer'
  | 'uriReference'
  | 'uriTemplate'
  | 'integer'
  | 'decimal';

const TEXT: { readonly [K in TextKind]: (random: Random, example: string) => string } = {
  words: (random) => \`\${random.pick(LOREM)} \${random.pick(LOREM)}\`,
  word: (random) => random.pick(LOREM),
  sentence: (random) => random.pick(SENTENCES),
  paragraph: (random) => sentences(random, random.int(2, 4)),
  like: (random, example) => like(example, random),
  firstName: (random) => random.pick(FIRST_NAMES),
  lastName: (random) => random.pick(LAST_NAMES),
  fullName: (random) => personName(random).join(' '),
  username: (random) => {
    const [first, last] = personName(random);
    return \`\${ascii(first)}.\${ascii(last)}\${random.int(1, 99)}\`;
  },
  email: (random, example) => {
    const [first, last] = personName(random);
    return \`\${ascii(first)}.\${ascii(last)}@\${domainOf(example, random)}\`;
  },
  phone: (random) =>
    random.chance(0.5)
      ? \`+1 555-01\${pad(random.int(0, 99))}\`
      : \`+44 20 7946 0\${pad(random.int(0, 999), 3)}\`,
  jobTitle: (random) => {
    if (random.chance(0.1)) return \`Head of \${random.pick(DEPARTMENTS)}\`;
    const level = random.pick(JOB_LEVELS);
    return \`\${level === '' ? '' : \`\${level} \`}\${random.pick(JOB_AREAS)} \${random.pick(JOB_ROLES)}\`;
  },
  company: (random) =>
    random.chance(0.5)
      ? \`\${random.pick(LAST_NAMES)} \${random.pick(COMPANY_SUFFIXES)}\`
      : \`\${random.pick(COMPANY_FIRST)}\${random.pick(COMPANY_SECOND)}\`,
  department: (random) => random.pick(DEPARTMENTS),
  product: (random) =>
    \`\${random.pick(PRODUCT_ADJECTIVES)} \${random.pick(PRODUCT_MATERIALS)} \${random.pick(PRODUCT_NOUNS)}\`,
  project: (random) => \`\${random.pick(PROJECT_AREAS)} \${random.pick(PROJECT_NOUNS)}\`,
  task: (random) => \`\${random.pick(TASK_VERBS)} \${random.pick(TASK_OBJECTS)}\`,
  headline: (random) => random.pick(HEADLINE_TEMPLATES).replace(/%/g, random.pick(HEADLINE_TOPICS)),
  tag: (random) => random.pick(TAGS),
  slug: (random) => \`\${random.pick(TAGS)}-\${random.pick(LOREM)}-\${random.int(1, 99)}\`,
  code: (random) => alphanumeric(random, 6).toUpperCase(),
  street: (random) =>
    \`\${random.int(1, 9999)} \${random.pick(STREET_NAMES)} \${random.pick(STREET_SUFFIXES)}\`,
  city: (random) => random.pick(CITIES),
  state: (random) => random.pick(STATES),
  country: (random) => random.pick(COUNTRIES)[0],
  countryCode: (random) => random.pick(COUNTRIES)[1],
  postalCode: (random) => pad(random.int(10000, 99999), 5),
  address: (random) =>
    \`\${random.int(1, 9999)} \${random.pick(STREET_NAMES)} \${random.pick(STREET_SUFFIXES)}, \${random.pick(CITIES)}\`,
  url: (random, example) =>
    \`\${originOf(example, random)}/\${random.pick(TAGS)}/\${random.int(1, 999)}\`,
  imageUrl: (random) => picture(random, 400, 300),
  avatarUrl: (random) => picture(random, 128, 128),
  domain: (random) => \`\${random.pick(TAGS)}.\${random.pick(DOMAINS)}\`,
  // Ranges reserved for documentation (RFC 5737, RFC 3849).
  ipv4: (random) => \`\${random.pick(DOCUMENTATION_NETWORKS)}.\${random.int(1, 254)}\`,
  ipv6: (random) => \`2001:db8::\${random.int(1, 0xffff).toString(16)}:\${hex(random, 4)}\`,
  mac: (random) => \`02:\${Array.from({ length: 5 }, () => hex(random, 2)).join(':')}\`,
  userAgent: (random) => random.pick(USER_AGENTS),
  token: (random) => base64Url(random, 40),
  jwt: (random) =>
    \`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.\${base64Url(random, 48)}.\${base64Url(random, 43)}\`,
  password: (random) => \`\${base64Url(random, 6)}!\${random.int(10, 99)}\${base64Url(random, 4)}\`,
  hash: (random) => hex(random, 64),
  uuid,
  color: (random) => random.pick(COLORS),
  mimeType: (random) => random.pick(FILE_TYPES)[0],
  fileName: (random) =>
    \`\${random.pick(FILE_STEMS)}-\${random.int(1, 99)}.\${random.pick(FILE_TYPES)[1]}\`,
  fileExtension: (random) => random.pick(FILE_TYPES)[1],
  filePath: (random) =>
    \`/files/\${random.pick(TAGS)}/\${random.pick(FILE_STEMS)}.\${random.pick(FILE_TYPES)[1]}\`,
  semver: (random) => \`\${random.int(1, 4)}.\${random.int(0, 12)}.\${random.int(0, 20)}\`,
  emoji: (random) => random.pick(EMOJI),
  currency: (random) => random.pick(CURRENCIES),
  locale: (random) => random.pick(LOCALES),
  language: (random) => random.pick(LANGUAGES),
  timezone: (random) => random.pick(TIMEZONES),
  sku: (random) => \`SKU-\${random.int(10000, 99999)}\`,
  isbn,
  iban,
  // Test card numbers: Luhn-valid, accepted by no network.
  creditCard: (random) =>
    luhn(\`4242\${Array.from({ length: 11 }, () => random.int(0, 9)).join('')}\`),
  base64: (random) => btoa(random.pick(SENTENCES).replace(/[^\\x20-\\x7e]/g, "'")),
  json: (random) => JSON.stringify({ id: random.int(1, 999), name: random.pick(TAGS) }),
  duration: (random) =>
    random.chance(0.5) ? \`PT\${random.int(5, 120)}M\` : \`P\${random.int(1, 30)}D\`,
  regex: (random) => \`^\${random.pick(TAGS)}-[0-9]+$\`,
  pointer: (random) => \`/\${random.pick(TAGS)}/\${random.int(0, 9)}\`,
  relativePointer: (random) => \`\${random.int(0, 3)}/\${random.pick(TAGS)}\`,
  uriReference: (random) => \`/\${random.pick(TAGS)}/\${random.int(1, 999)}\`,
  uriTemplate: (random) => \`https://\${random.pick(DOMAINS)}/\${random.pick(TAGS)}/{id}\`,
  integer: (random) => String(random.int(1, 100_000)),
  decimal: (random) => (random.int(100, 99_999) / 100).toFixed(2),
};

/**
 * A variation of an example that keeps its shape: digits and identifier characters change, words
 * and separators stay (\`usr_3k9f2a7d1b\` → \`usr_8q2m5x0c7e\`, \`WEB-12\` → \`QAP-48\`).
 */
function like(example: string, random: Random): string {
  const upper = (): string => String.fromCharCode(random.int(65, 90));
  const lower = (): string => String.fromCharCode(random.int(97, 122));
  return example.replace(/[A-Za-z0-9]+/g, (chunk) => {
    const letters = /[A-Za-z]/.test(chunk);
    const digits = /\\d/.test(chunk);
    // Words stay; short codes in capitals vary.
    if (letters && !digits) return /^[A-Z]{2,6}$/.test(chunk) ? chunk.replace(/./g, upper) : chunk;
    const isHex = letters && /^[0-9a-f]+$/.test(chunk);
    let index = 0;
    return chunk.replace(/./g, (char) => {
      const first = index++ === 0 && chunk.length > 1 && char !== '0';
      if (/\\d/.test(char)) return String(first ? random.int(1, 9) : random.int(0, 9));
      if (isHex) return random.int(0, 15).toString(16);
      return char === char.toUpperCase() ? upper() : lower();
    });
  });
}

/** \`text\` padded with words or cut to fit \`[minLength, maxLength]\`. */
export function fit(text: string, random: Random, minLength = 0, maxLength = Infinity): string {
  let result = text;
  while (result.length < minLength)
    result += result === '' ? random.pick(LOREM) : \` \${random.pick(LOREM)}\`;
  if (result.length > maxLength) result = result.slice(0, maxLength);
  // A cut can leave a trailing space or half a surrogate pair; replacing keeps the length.
  return result.replace(/ $|[\\uD800-\\uDBFF]$/, 'x');
}

/** Generated text of a kind, fitted to a length. */
export function generateText(
  kind: TextKind,
  random: Random,
  example = '',
  minLength = 0,
  maxLength = Infinity,
): string {
  return fit(TEXT[kind](random, example), random, minLength, maxLength);
}

// Errors --------------------------------------------------------------------------------------

/**
 * What a property of an error model (RFC 9457 Problem Details and the like) says about the error:
 * its reason phrase, an explanation, a code, a problem type URI, the occurrence's URI, or, in the
 * errors of single fields, the field (by name or JSON Pointer) and what is wrong with it.
 */
export type ErrorPart =
  | 'title'
  | 'detail'
  | 'code'
  | 'type'
  | 'instance'
  | 'field'
  | 'pointer'
  | 'fieldMessage';

/** The status the examples of error models describe, when the status is not known. */
export const DEFAULT_ERROR_STATUS = 404;

/** The statuses errors describe when the status is not known (a fixture called on its own). */
const ERROR_STATUSES = [400, 401, 403, 404, 409, 422, 429, 500, 503] as const;

/** Reason phrases (RFC 9110). */
const REASONS: Readonly<Record<number, string>> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Failed',
  413: 'Content Too Large',
  414: 'URI Too Long',
  415: 'Unsupported Media Type',
  416: 'Range Not Satisfiable',
  417: 'Expectation Failed',
  421: 'Misdirected Request',
  422: 'Unprocessable Content',
  423: 'Locked',
  424: 'Failed Dependency',
  425: 'Too Early',
  426: 'Upgrade Required',
  428: 'Precondition Required',
  429: 'Too Many Requests',
  431: 'Request Header Fields Too Large',
  451: 'Unavailable For Legal Reasons',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported',
  507: 'Insufficient Storage',
  508: 'Loop Detected',
  511: 'Network Authentication Required',
};

/** What went wrong, by status; other statuses get their class's explanation. */
const ERROR_DETAILS: Readonly<Record<number, readonly [string, ...string[]]>> = {
  400: list(
    'The request body is not valid JSON.|The cursor parameter is malformed.|The limit parameter must be between 1 and 100.',
  ),
  401: list(
    'The access token is missing or has expired.|Sign in to continue.|The API key is not valid.',
  ),
  403: list(
    'You do not have permission to perform this action.|Only workspace admins can change this setting.|Your plan does not include this feature.',
  ),
  404: list(
    'The requested resource does not exist.|No resource matches this ID.|The resource may have been deleted or moved.',
  ),
  405: list('This endpoint does not support this method.'),
  408: list('The request took too long to arrive. Try again.'),
  409: list(
    'The resource was changed by someone else. Reload it and try again.|A resource with this name already exists.',
  ),
  410: list('This resource was permanently deleted.'),
  412: list('The resource changed since you last read it. Reload it and try again.'),
  413: list('The request body is larger than 10 MB.'),
  415: list('Send the request body as application/json.'),
  422: list(
    'Some fields are invalid. Check them and try again.|The request contains invalid values.|A required field is missing.',
  ),
  423: list('The resource is locked while another change is in progress.'),
  429: list(
    'Too many requests. Try again in 30 seconds.|You reached the limit of 100 requests per minute.',
  ),
  500: list(
    'Something went wrong on our side. Try again later.|An unexpected error occurred. Our team has been notified.',
  ),
  501: list('This feature is not available yet.'),
  502: list('An upstream service returned an invalid response.'),
  503: list(
    'The service is temporarily unavailable. Try again in a few minutes.|Scheduled maintenance is in progress. Try again later.',
  ),
  504: list('An upstream service did not respond in time.'),
};
const CLIENT_ERROR_DETAILS = list(
  'The request could not be processed.|Check the request and try again.',
);
const SERVER_ERROR_DETAILS = list(
  'The server could not complete the request.|Something went wrong on our side. Try again later.',
);

/** Fields named in the errors of single fields, and what is wrong with them. */
const ERROR_FIELDS = list('email|title|name|password|dueDate|quantity|phone|startDate|amount|url');
const FIELD_ERRORS = list(
  'This field is required.|Must be at most 80 characters.|Must be a valid email address.|Must be a date in the future.|Must be greater than 0.|Must be at least 12 characters.|This value is already taken.|Must be a valid URL.',
);

/** The reason phrase of a status. */
function reasonOf(status: number): string {
  return REASONS[status] ?? (status >= 500 ? 'Server Error' : 'Client Error');
}

/**
 * A status's reason phrase as a code, written the way \`example\` writes codes (\`not_found\`,
 * \`NOT_FOUND\`, \`not-found\`, \`NotFound\`).
 */
function errorCode(status: number, example: string): string {
  const parts = reasonOf(status)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part !== '');
  if (/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(example) && example.length > 1)
    return parts.join('_').toUpperCase();
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(example)) return parts.join('-');
  if (/^([A-Z][a-z0-9]+){2,}$/.test(example))
    return parts.map((part) => \`\${part.charAt(0).toUpperCase()}\${part.slice(1)}\`).join('');
  return parts.join('_');
}

/** What a property of an error model says about an error of \`status\`. */
export function errorText(part: ErrorPart, status: number, random: Random, example = ''): string {
  switch (part) {
    case 'title':
      return reasonOf(status);
    case 'detail':
      return random.pick(
        ERROR_DETAILS[status] ?? (status >= 500 ? SERVER_ERROR_DETAILS : CLIENT_ERROR_DETAILS),
      );
    case 'code':
      return errorCode(status, example);
    case 'type':
      // \`about:blank\` says the type is the status itself.
      return example.startsWith('about:')
        ? example
        : \`\${originOf(example, random)}/problems/\${errorCode(status, 'not-found')}\`;
    case 'instance':
      return \`urn:uuid:\${uuid(random)}\`;
    case 'field':
      return random.pick(ERROR_FIELDS);
    case 'pointer':
      return \`/\${random.pick(ERROR_FIELDS)}\`;
    case 'fieldMessage':
      return random.pick(FIELD_ERRORS);
  }
}

/** The key of the object a value's key belongs to (\`owner.email\` → \`owner\`, \`email\` → \`''\`). */
function parentOf(key: string): string {
  return key.slice(0, Math.max(0, key.lastIndexOf('.')));
}

// Dates ---------------------------------------------------------------------------------------

/** When a date usually lies: \`createdAt\` in the past, \`dueDate\` soon, \`birthDate\` years ago. */
export type DateWhen = 'past' | 'future' | 'soon' | 'birth' | 'any';

/** The date generated values without an example are placed around. */
const REFERENCE = Date.UTC(2026, 0, 1);
const DAY = 86_400_000;

/**
 * A date, date-time or time near \`example\` (or the reference date): earlier for \`past\`, later for
 * \`future\`, within weeks for \`soon\`, decades earlier for \`birth\`. Keeps the example's precision.
 */
export function dateNear(
  example: string | undefined,
  format: 'date' | 'date-time' | 'time',
  when: DateWhen,
  random: Random,
): string {
  const time = (): string =>
    \`\${pad(random.int(0, 23))}:\${pad(random.int(0, 59))}:\${pad(random.int(0, 59))}\`;
  if (format === 'time') {
    const suffix =
      example === undefined ? 'Z' : (/^\\d{2}:\\d{2}:\\d{2}(.*)$/.exec(example)?.[1] ?? '');
    return \`\${time()}\${suffix.replace(/^\\.\\d+/, '')}\`;
  }
  const parsed =
    example === undefined
      ? Number.NaN
      : Date.parse(format === 'date' ? \`\${example}T00:00:00Z\` : example);
  const base = Number.isNaN(parsed) ? REFERENCE : parsed;
  const days =
    when === 'past'
      ? -random.int(1, 180)
      : when === 'future'
        ? random.int(1, 90)
        : when === 'soon'
          ? random.int(-14, 45)
          : when === 'birth'
            ? -random.int(18 * 365, 75 * 365)
            : random.int(-365, 365);
  const value = new Date(Math.floor(base / DAY) * DAY + days * DAY);
  if (format === 'date') return value.toISOString().slice(0, 10);
  const iso = \`\${value.toISOString().slice(0, 10)}T\${time()}\`;
  // The example's precision: \`2026-10-20T09:30:00Z\` or \`…00.000Z\`.
  return example !== undefined && !/\\.\\d+/.test(example) ? \`\${iso}Z\` : \`\${iso}.000Z\`;
}

// Files ---------------------------------------------------------------------------------------

/** What \`new Blob()\` accepts, in browsers and in Node.js. */
type BlobContent = NonNullable<ConstructorParameters<typeof Blob>[0]>[number];

let crcTable: Uint32Array | undefined;

function crc32(bytes: Uint8Array): number {
  if (crcTable === undefined) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts: readonly Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

const u32 = (value: number) =>
  new Uint8Array([value >>> 24, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
const latin1 = (text: string) => Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff);

/** A 64×64 PNG picture in two colors, valid for every decoder (stored, uncompressed blocks). */
function png(random: Random) {
  const size = 64;
  const color = (value: string): readonly number[] =>
    [1, 3, 5].map((i) => Number.parseInt(value.slice(i, i + 2), 16));
  const [background, accent] = [color(random.pick(COLORS)), color(random.pick(COLORS))];
  const cx = random.int(16, 48);
  const cy = random.int(16, 48);
  const radius = random.int(10, 28);
  const raw = new Uint8Array(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const inside = (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
      const rgb = inside ? accent : background;
      raw.set(rgb, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  // zlib: one stored deflate block per 65,535 bytes, then the Adler-32 checksum.
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  for (let offset = 0; offset < raw.length; offset += 65_535) {
    const chunk = raw.subarray(offset, offset + 65_535);
    const last = offset + 65_535 >= raw.length ? 1 : 0;
    blocks.push(
      new Uint8Array([
        last,
        chunk.length & 0xff,
        chunk.length >>> 8,
        ~chunk.length & 0xff,
        (~chunk.length >>> 8) & 0xff,
      ]),
      chunk,
    );
  }
  let a = 1;
  let b = 0;
  for (const byte of raw) {
    a = (a + byte) % 65_521;
    b = (b + a) % 65_521;
  }
  blocks.push(u32(((b << 16) | a) >>> 0));
  const chunk = (type: string, data: Uint8Array): Uint8Array => {
    const body = concat([latin1(type), data]);
    return concat([u32(data.length), body, u32(crc32(body))]);
  };
  return concat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', concat([u32(size), u32(size), new Uint8Array([8, 2, 0, 0, 0])])),
    chunk('IDAT', concat(blocks)),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/** A one-page PDF with a line of text. */
function pdf(random: Random) {
  const line = random
    .pick(SENTENCES)
    .replace(/[^\\x20-\\x7e]/g, "'")
    .replace(/[()\\\\]/g, '');
  const stream = \`BT /F1 18 Tf 72 720 Td (\${line}) Tj ET\`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    \`<< /Length \${stream.length} >>\\nstream\\n\${stream}\\nendstream\`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += \`\${index + 1} 0 obj\\n\${object}\\nendobj\\n\`;
  });
  const xref = body.length;
  body += \`xref\\n0 \${objects.length + 1}\\n0000000000 65535 f \\n\${offsets.map((offset) => \`\${pad(offset, 10)} 00000 n \\n\`).join('')}\`;
  body += \`trailer\\n<< /Size \${objects.length + 1} /Root 1 0 R >>\\nstartxref\\n\${xref}\\n%%EOF\\n\`;
  return latin1(body);
}

/** A short WAV file: a quiet tone. */
function wav(random: Random) {
  const rate = 8000;
  const samples = rate / 4;
  const frequency = random.pick([262, 330, 392, 440, 523]);
  const le = (value: number, bytes: number): number[] =>
    Array.from({ length: bytes }, (_, index) => (value >>> (index * 8)) & 0xff);
  const header = [
    ...latin1('RIFF'),
    ...le(36 + samples, 4),
    ...latin1('WAVEfmt '),
    ...le(16, 4),
    ...le(1, 2),
    ...le(1, 2),
    ...le(rate, 4),
    ...le(rate, 4),
    ...le(1, 2),
    ...le(8, 2),
    ...latin1('data'),
    ...le(samples, 4),
  ];
  const data = Array.from({ length: samples }, (_, index) =>
    Math.round(128 + 24 * Math.sin((2 * Math.PI * frequency * index) / rate)),
  );
  return new Uint8Array([...header, ...data]);
}

const decode64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

/** Tiny valid pictures in formats that cannot be generated in a few lines. */
const GIF = 'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const JPEG =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const WEBP = 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

/** The media type a file property's name suggests (\`avatar\` → PNG, \`invoice\` → PDF). */
function mediaTypeOfName(name: string): string {
  if (/image|photo|picture|avatar|logo|icon|thumbnail|banner|cover|screenshot/i.test(name))
    return 'image/png';
  if (/pdf|invoice|receipt|document|contract|report/i.test(name)) return 'application/pdf';
  if (/csv|export|spreadsheet/i.test(name)) return 'text/csv';
  if (/audio|sound|voice|recording/i.test(name)) return 'audio/wav';
  if (/text|note|log/i.test(name)) return 'text/plain';
  return 'application/octet-stream';
}

/** File content of a media type: a real picture, PDF, sound, archive or text. */
export function fileContent(mediaType: string, random: Random, name = ''): Blob {
  let type = mediaType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (type === '' || type.includes('*') || type === 'application/octet-stream') {
    const guessed = mediaTypeOfName(name);
    if (type === '' || type.includes('*') || guessed !== 'application/octet-stream') type = guessed;
  }
  const blob = (part: BlobContent): Blob => new Blob([part], { type });
  switch (type) {
    case 'image/png':
      return blob(png(random));
    case 'image/gif':
      return blob(decode64(GIF));
    case 'image/jpeg':
    case 'image/jpg':
      return blob(decode64(JPEG));
    case 'image/webp':
      return blob(decode64(WEBP));
    case 'image/svg+xml':
      return blob(
        decodeURIComponent(picture(random, 400, 300).slice('data:image/svg+xml,'.length)),
      );
    case 'application/pdf':
      return blob(pdf(random));
    case 'audio/wav':
    case 'audio/x-wav':
    case 'audio/wave':
      return blob(wav(random));
    case 'application/zip':
      return blob(new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...Array.from({ length: 18 }, () => 0)]));
    case 'text/csv':
      return blob(
        \`id,name,email\\n\${Array.from({ length: 3 }, (_, index) => {
          const [first, last] = personName(random);
          return \`\${index + 1},\${first} \${last},\${ascii(first)}.\${ascii(last)}@example.com\`;
        }).join('\\n')}\\n\`,
      );
    case 'application/json':
      return blob(JSON.stringify({ id: random.int(1, 999), name: random.pick(TAGS) }));
    case 'text/html':
      return blob(
        \`<!doctype html><title>\${random.pick(TAGS)}</title><p>\${random.pick(SENTENCES)}</p>\`,
      );
    case 'application/xml':
    case 'text/xml':
      return blob(
        \`<?xml version="1.0" encoding="UTF-8"?><note><text>\${random.pick(SENTENCES)}</text></note>\`,
      );
    default:
      if (type.startsWith('text/')) return blob(sentences(random, 3));
      return blob(Uint8Array.from({ length: 256 }, () => random.int(0, 255)));
  }
}

/** The \`index\`th key of generated maps: \`source\`, \`plan\`, …, then \`source2\`, \`plan2\`, …. */
export function recordKey(index: number): string {
  const word = RECORD_KEYS[index % RECORD_KEYS.length] ?? 'key';
  return index < RECORD_KEYS.length ? word : \`\${word}\${Math.floor(index / RECORD_KEYS.length) + 1}\`;
}

/** A seed derived from text (never \`0\`), e.g. from a request. */
export function seedOf(text: string): number {
  return hash(text) || 1;
}

// Encodings -----------------------------------------------------------------------------------

/** How a value is written in XML (the XML Object): names, attributes, wrapping, namespaces. */
export interface XmlShape {
  readonly name?: string;
  readonly namespace?: string;
  readonly prefix?: string;
  readonly attribute?: boolean;
  readonly wrapped?: boolean;
  /** The value is its parent's text or CDATA content, or is written without an element. */
  readonly content?: 'text' | 'cdata' | 'none';
  readonly properties?: Readonly<Record<string, XmlShape>>;
  readonly items?: XmlShape;
}

const XML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

const escapeXml = (text: string): string =>
  text.replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char);

/** A valid XML name for a property name. */
const xmlName = (name: string): string =>
  name.replace(/[^\\w.:-]/g, '_').replace(/^(?=[\\d.:-]|$)/, '_');

function scalarText(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

function qualified(name: string, shape: XmlShape): string {
  return shape.prefix === undefined ? name : \`\${xmlName(shape.prefix)}:\${name}\`;
}

function xmlElement(value: unknown, shape: XmlShape, name: string): string {
  const tag = qualified(xmlName(name), shape);
  const namespace =
    shape.namespace === undefined
      ? ''
      : \` xmlns\${shape.prefix === undefined ? '' : \`:\${xmlName(shape.prefix)}\`}="\${escapeXml(shape.namespace)}"\`;
  if (value === null || value === undefined) return \`<\${tag}\${namespace}/>\`;
  if (Array.isArray(value)) {
    const items = shape.items ?? {};
    const inner = (value as unknown[])
      .map((item) => xmlElement(item, items, items.name ?? name))
      .join('');
    return \`<\${tag}\${namespace}>\${inner}</\${tag}>\`;
  }
  if (typeof value !== 'object' || value instanceof Date || value instanceof Blob)
    return \`<\${tag}\${namespace}>\${escapeXml(scalarText(value))}</\${tag}>\`;
  let attributes = '';
  let content = '';
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item === undefined) continue;
    const property = shape.properties?.[key] ?? {};
    const childName = property.name ?? key;
    if (property.attribute === true) {
      attributes += \` \${qualified(xmlName(childName), property)}="\${escapeXml(scalarText(item))}"\`;
    } else if (property.content === 'text') {
      content += escapeXml(scalarText(item));
    } else if (property.content === 'cdata') {
      content += \`<![CDATA[\${scalarText(item).replace(/]]>/g, ']]]]><![CDATA[>')}]]>\`;
    } else if (Array.isArray(item)) {
      // Items are named after the array unless they name themselves; \`wrapped\` adds an element.
      const items = property.items ?? {};
      const inner = (item as unknown[])
        .map((entry) => xmlElement(entry, items, items.name ?? childName))
        .join('');
      const wrapper = qualified(xmlName(childName), property);
      content += property.wrapped === true ? \`<\${wrapper}>\${inner}</\${wrapper}>\` : inner;
    } else if (property.content === 'none' && typeof item === 'object' && item !== null) {
      content += xmlElement(item, property, childName).replace(/^<[^>]*>|<\\/[^>]*>$/g, '');
    } else {
      content += xmlElement(item, property, childName);
    }
  }
  return \`<\${tag}\${namespace}\${attributes}>\${content}</\${tag}>\`;
}

/** A value as an XML document, as its schema's XML Object describes it. */
export function xml(value: unknown, shape: XmlShape): string {
  return \`<?xml version="1.0" encoding="UTF-8"?>\\n\${xmlElement(value, shape, shape.name ?? 'root')}\\n\`;
}

/** A server-sent event: \`event\`, \`id\` and \`retry\` fields, and \`data\` (JSON unless a string). */
function serverSentEvent(item: unknown): string {
  if (typeof item !== 'object' || item === null || Array.isArray(item))
    return \`data: \${JSON.stringify(item)}\\n\\n\`;
  const record = item as Record<string, unknown>;
  const lines: string[] = [];
  for (const field of ['event', 'id', 'retry'])
    if (record[field] !== undefined) lines.push(\`\${field}: \${scalarText(record[field])}\`);
  const data = record['data'];
  const text = data === undefined ? '' : typeof data === 'string' ? data : JSON.stringify(data);
  for (const line of text.split('\\n')) lines.push(\`data: \${line}\`);
  return \`\${lines.join('\\n')}\\n\\n\`;
}

/**
 * Items as a sequential media type writes them: JSON Lines and NDJSON (one JSON value per line),
 * JSON text sequences (RFC 7464) or server-sent events.
 */
export function sequence(items: unknown, mediaType: string): string {
  const values: readonly unknown[] = Array.isArray(items) ? items : [items];
  const type = mediaType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (type === 'text/event-stream') return values.map(serverSentEvent).join('');
  if (type === 'application/json-seq' || type.endsWith('+json-seq'))
    return values.map((item) => \`\\u001e\${JSON.stringify(item)}\\n\`).join('');
  return values.map((item) => \`\${JSON.stringify(item)}\\n\`).join('');
}

// Entities ------------------------------------------------------------------------------------

/** The seeds that made the \`id\`s fixtures returned, so a later request for one gets the same value. */
const entities = new Map<string, number>();
const MAX_ENTITIES = 50_000;

/** The seed of the fixture that made an \`id\`, if one did. */
export function seedOfEntity(id: string): number | undefined {
  return entities.get(id);
}

// Fixtures ------------------------------------------------------------------------------------

/**
 * What generated fixtures make values with. Keys name the value within the fixture (\`'owner.name'\`,
 * \`'tags'\`), so that adding a property to a schema does not change the others.
 */
export class Fake {
  readonly #seed: number;
  readonly #path: string;
  readonly #empty: boolean;
  /** The error status the value is the body of, which error models describe. */
  readonly #status: number | undefined;
  /** Whether this makes a fixture's own value, not an item of one of its arrays. */
  readonly #root: boolean;

  constructor(options: FixtureOptions = {}, path = '', root = true) {
    this.#seed = Number.isFinite(options.seed) ? Math.trunc(options.seed ?? 0) >>> 0 : 0;
    this.#path = path;
    this.#empty = options.empty === true;
    const status = options.status;
    this.#status =
      status !== undefined && Number.isInteger(status) && status >= 400 && status <= 599
        ? status
        : undefined;
    this.#root = root;
  }

  /** Whether this makes the specification's examples (seed \`0\`). */
  get canonical(): boolean {
    return this.#seed === 0;
  }

  #random(key: string): Random {
    return new Random(mix(this.#seed, \`\${this.#path}\${key}\`));
  }

  #options(seed: number): FixtureOptions {
    return {
      seed,
      ...(this.#empty ? { empty: true } : {}),
      ...(this.#status === undefined ? {} : { status: this.#status }),
    };
  }

  /** The person the object at \`key\` names: its \`name\`, \`email\` and \`username\` agree. */
  #person(key: string): readonly [string, string] {
    return personName(this.#random(\`\${parentOf(key)}#person\`));
  }

  /** The error status the object at \`key\` describes: the body's, or one of its own. */
  #error(key: string): number {
    return this.#status ?? this.#random(\`\${parentOf(key)}#status\`).pick(ERROR_STATUSES);
  }

  /** The options of the fixture nested at \`key\`: examples within examples, otherwise its own seed. */
  at(key = ''): FixtureOptions {
    return this.#options(this.canonical ? 0 : mix(this.#seed, \`\${this.#path}\${key}/\`));
  }

  /**
   * What \`make\` returns: it is told whether to make the specification's example (seed \`0\`, not
   * an empty state) or another value. One callback lets TypeScript type both from the context.
   * The examples of an error model describe one \`status\`; a body sent with another describes it.
   */
  example<T>(make: (examples: boolean) => T, status?: number): T {
    const other = status !== undefined && this.#status !== undefined && status !== this.#status;
    return make(this.canonical && !this.#empty && !other);
  }

  /** Text of a kind (a name, a sentence…), or \`example\` for the examples. */
  text(key: string, example: string, kind: TextKind, minLength = 0, maxLength = Infinity): string {
    if (this.canonical) return example;
    const random = this.#random(key);
    const named = personText(kind, this.#person(key), random, example);
    if (named !== undefined) return fit(named, random, minLength, maxLength);
    // Longer text keeps the example's wording a third of the time, where its numbers and codes
    // vary: an example repeated word for word would show twice in a list.
    const long =
      kind === 'sentence' || kind === 'paragraph' || kind === 'task' || kind === 'headline';
    const varied =
      long && example.includes(' ') && random.chance(1 / 3) ? like(example, random) : example;
    return fit(
      varied === example ? TEXT[kind](random, example) : varied,
      random,
      minLength,
      maxLength,
    );
  }

  /** The \`status\` of an error model: the status the body is sent with, or \`example\`. */
  errorStatus(key: string, example: number): number {
    if (this.#status !== undefined) return this.#status;
    return this.canonical ? example : this.#error(key);
  }

  /**
   * What a property of an error model says about the error (\`title\`, \`detail\`, \`code\`…): it
   * describes the status the body is sent with. For the examples, \`example\`, which describes
   * \`examples\`: a body sent with another status describes that one instead.
   */
  errorText(
    key: string,
    example: string,
    part: ErrorPart,
    examples = DEFAULT_ERROR_STATUS,
    minLength = 0,
    maxLength = Infinity,
  ): string {
    const describes = part === 'title' || part === 'detail' || part === 'code' || part === 'type';
    const other = this.#status !== undefined && this.#status !== examples;
    if (this.canonical && !(describes && other)) return example;
    const random = this.#random(key);
    return fit(errorText(part, this.#error(key), random, example), random, minLength, maxLength);
  }

  /** A string matching \`pattern\`, or \`example\` for the examples. */
  pattern(
    key: string,
    example: string,
    pattern: string,
    minLength = 0,
    maxLength = Infinity,
    kind?: TextKind,
  ): string {
    if (this.canonical) return example;
    const random = this.#random(key);
    // Realistic text of the property's kind when it matches (a color from the palette).
    if (kind !== undefined)
      for (let attempt = 0; attempt < 3; attempt++) {
        const made = generateText(kind, random, example, minLength, maxLength);
        if (matchesPattern(pattern, made) === true) return made;
      }
    return samplePattern(pattern, random, minLength, maxLength) ?? example;
  }

  /** An integer in \`[min, max]\`. */
  int(key: string, example: number, min: number, max: number): number {
    return this.canonical ? example : this.#random(key).int(min, max);
  }

  /** A number in \`[min, max]\` with up to \`digits\` decimals, excluding open bounds. */
  number(
    key: string,
    example: number,
    min: number,
    max: number,
    digits = 2,
    exclusive: 'none' | 'min' | 'max' | 'both' = 'none',
  ): number {
    if (this.canonical) return example;
    const value = Number((min + this.#random(key).next() * (max - min)).toFixed(digits));
    const low = exclusive === 'min' || exclusive === 'both' ? value > min : value >= min;
    const high = exclusive === 'max' || exclusive === 'both' ? value < max : value <= max;
    return low && high ? value : example;
  }

  /** A multiple of \`step\` between \`first * step\` and \`last * step\`. */
  multiple(
    key: string,
    example: number,
    first: number,
    last: number,
    step: number,
    digits: number,
  ): number {
    return this.canonical
      ? example
      : Number((this.#random(key).int(first, last) * step).toFixed(digits));
  }

  /** \`true\` with probability \`rate\`. */
  bool(key: string, example: boolean, rate = 0.5): boolean {
    return this.canonical ? example : this.#random(key).chance(rate);
  }

  /** A date, date-time or time near the example. */
  date(
    key: string,
    example: string,
    format: 'date' | 'date-time' | 'time',
    when: DateWhen,
  ): string {
    return this.canonical ? example : dateNear(example, format, when, this.#random(key));
  }

  /** One of \`values\`: the first for the examples. */
  pick<T>(key: string, values: readonly [T, ...T[]]): T {
    return this.canonical ? values[0] : this.#random(key).pick(values);
  }

  /** The value \`make\` returns for one of \`count\` alternatives: the first for the examples. */
  oneOf<T>(key: string, count: number, make: (index: number) => T): T {
    return make(this.canonical ? 0 : this.#random(\`\${key}#\`).int(0, count - 1));
  }

  /** \`null\` sometimes (never for the examples), otherwise the value \`make\` returns. */
  nullable<T>(key: string, make: () => T, rate = 0.2): T | null {
    return !this.canonical && this.#random(\`\${key}?\`).chance(rate) ? null : make();
  }

  /**
   * An array of \`count\` items for the examples, otherwise of \`least\` (by default \`min\`) to \`max\`
   * items, and \`min\` in empty states: lists have \`least\` 1, so they are only empty when asked to
   * be. Item 0 of the examples is made of examples too. With \`unique\`, equal items are left out.
   */
  array<T>(
    key: string,
    count: number,
    min: number,
    max: number,
    make: (item: Fake, index: number) => T,
    unique = false,
    least = min,
  ): T[] {
    const length = this.#empty
      ? min
      : this.canonical
        ? count
        : this.#random(\`\${key}[]\`).int(least, max);
    const items: T[] = [];
    const seen = new Set<string>();
    for (let index = 0; items.length < length && index < length * 3; index++) {
      const seed =
        this.canonical && index === 0 ? 0 : mix(this.#seed, \`\${this.#path}\${key}[\${index}]\`);
      const item = make(new Fake(this.#options(seed), '', false), index);
      if (unique) {
        const identity = JSON.stringify(item);
        if (seen.has(identity)) continue;
        seen.add(identity);
      }
      items.push(item);
    }
    return items;
  }

  /** An object with \`count\` (or \`min\` to \`max\`) generated keys, for maps (\`additionalProperties\`). */
  record<T>(
    key: string,
    count: number,
    min: number,
    max: number,
    make: (item: Fake, name: string) => T,
  ): Record<string, T> {
    const random = this.#random(\`\${key}{}\`);
    const length = this.#empty ? min : this.canonical ? count : random.int(min, max);
    const result: Record<string, T> = {};
    for (let index = 0; index < length; index++) {
      const name = recordKey(index);
      const seed =
        this.canonical && index === 0 ? 0 : mix(this.#seed, \`\${this.#path}\${key}{\${name}}\`);
      result[name] = make(new Fake(this.#options(seed), '', false), name);
    }
    return result;
  }

  /**
   * \`value\` with some of its optional properties left out (none for the examples); properties of
   * \`keep\` (the overrides) always stay.
   */
  optional<T>(path: string, value: T, keys: readonly string[], keep?: object): T {
    if (this.canonical) return value;
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (keep !== undefined && Object.prototype.hasOwnProperty.call(keep, key)) continue;
      if (this.#random(\`\${path}\${path === '' ? '' : '.'}\${key}~\`).chance(0.25)) delete record[key];
    }
    return value;
  }

  /** File content of a media type (a picture, a PDF…), named after the property that holds it. */
  file(key: string, mediaType: string): Blob {
    return fileContent(mediaType, this.#random(key), key);
  }

  /** Remembers which seed made a fixture's \`id\`, so that a request for it gets the same fixture. */
  id<T>(value: T): T {
    if (this.#root && (typeof value === 'string' || typeof value === 'number')) {
      if (entities.size >= MAX_ENTITIES) entities.clear();
      entities.set(String(value), this.#seed);
    }
    return value;
  }
}

/** What a generated fixture makes its value with. */
export function fake(options?: FixtureOptions): Fake {
  return new Fake(options);
}
`,"/assets/mocks/support.d.ts":`/**
 * Support for the generated Mock Service Worker handlers (\`features.mocks: 'msw'\`): matching
 * requests against the client's base URL, typed access to the request, building responses, and
 * \`mockFetch()\`, which answers a client from the handlers without intercepting anything.
 * Works with MSW 2.11 and later 2.x releases, and with MSW 3.
 */
import { type HttpHandler } from 'msw';
import { type FixtureOptions } from './fake.js';
/** A client whose configuration decides the base URL requests are matched against. */
export interface MockClient {
    getConfig(): {
        readonly baseUrl: string;
        readonly operationServers?: boolean | undefined;
    };
}
/** Settings every mock handler accepts; \`mockHandlers()\` passes them on to each handler. */
export interface MockSettings {
    /**
     * The base URL requests are matched against. By default the one the client sends them to: its
     * current \`baseUrl\`, or the operation's own server when it declares one (and
     * \`operationServers\` is on). A relative URL matches any origin unless the page has one.
     */
    readonly baseUrl?: string;
    /** Match the base URL of this client (e.g. one made with \`createClient()\`) instead. */
    readonly client?: MockClient;
    /**
     * Wait before responding: milliseconds, \`'real'\` (a realistic, random server time in browsers)
     * or \`'infinite'\` (never respond, to see loading states).
     */
    readonly delay?: number | 'real' | 'infinite';
    /** Headers added to the response. */
    readonly headers?: Readonly<Record<string, string>>;
    /** Fail like a network error instead of responding. */
    readonly networkError?: boolean;
    /** Respond to the first matching request only. */
    readonly once?: boolean;
    /**
     * Which values default bodies have: \`'request'\` (the default) generates them for each request,
     * the same for the same request (the examples for a request without parameters, the entity a
     * list returned for a request for its \`id\`); a number makes every body with that seed (\`0\` for
     * the examples).
     */
    readonly seed?: number | 'request';
    /** Make the arrays of default bodies as short as their schema allows, to see empty states. */
    readonly empty?: boolean;
    /** Respond with the operation's first documented error status (or \`500\`) instead. */
    readonly error?: boolean;
}
/** What a response function receives. */
export interface MockRequest<TParams, TBody, TResponse = unknown> {
    /** The intercepted request. */
    readonly request: Request;
    /** Path parameters by name, percent-decoded. */
    readonly params: TParams;
    /** The query string of the request. */
    readonly query: URLSearchParams;
    /** Cookies sent with the request. */
    readonly cookies: Readonly<Record<string, string>>;
    /**
     * Reads the request body by its media type: parsed JSON (with dates revived), \`FormData\`,
     * \`URLSearchParams\`, text or a \`Blob\`; \`undefined\` without a body. Can be called more than once.
     */
    body(): Promise<TBody>;
    /**
     * The body the handler would respond with by default: generated for this request (with the
     * handler's \`seed\` and \`empty\` settings), for a function that only changes or completes it.
     * Typed as the default status's body: with another \`status\`, it is that status's body.
     */
    generated(): TResponse;
}
/**
 * A response body, or a function of the request that returns one. The function may also return
 * a \`Response\`, which is sent as it is: another status, or \`Response.error()\` for a network error.
 */
export type MockBody<T, TRequest> = T | ((request: TRequest) => T | Response | Promise<T | Response>);
/** How \`MockRequest.body()\` reads a request body. */
export type MockRequestBody = 'json' | 'multipart' | 'urlencoded' | 'text' | 'binary';
/** A documented response of an operation. */
export interface MockResponse {
    /** Media type of the body; absent for responses without one. */
    readonly mediaType?: string;
    /** Creates the default body (a fixture) for the request's seed, once per request. */
    readonly body?: (options: FixtureOptions) => unknown;
    /** The headers the response documents as required, with example values. */
    readonly headers?: Readonly<Record<string, string>>;
    /** Converts a body to its wire form, e.g. \`Date\` values to strings. */
    readonly encode?: (body: unknown) => unknown;
    /** Writes a value (not already text) in the media type: an XML document, JSON Lines… */
    readonly write?: (body: unknown) => string;
}
/** An operation as its generated mock handler describes it. */
export interface MockOperation {
    /** The client whose configuration decides the base URL. */
    readonly client: MockClient;
    /** The request method, as the client sends it. */
    readonly method: string;
    /** The path template, e.g. \`/pets/{petId}\`. */
    readonly path: string;
    /** The operation's own server, if it declares one. */
    readonly server?: string;
    /** Path parameters serialized with the \`label\` or \`matrix\` style. */
    readonly styles?: Readonly<Record<string, 'label' | 'matrix'>>;
    /** The status to respond with when the options name none. */
    readonly status: number;
    /** How \`body()\` reads the request body; by its \`Content-Type\` when absent. */
    readonly request?: MockRequestBody;
    /** Converts a parsed JSON request body, e.g. date strings to \`Date\` values. */
    readonly decode?: (body: unknown) => unknown;
    /** Documented responses by status: \`'200'\`, \`'4XX'\` or \`'default'\`. */
    readonly responses: Readonly<Record<string, MockResponse>>;
    /** \`false\` when the path has an \`OPTIONS\` operation, which answers plain \`OPTIONS\` requests. */
    readonly preflight?: boolean;
    /** The status \`error: true\` responds with (\`500\` when absent). */
    readonly error?: number;
    /** The path parameter that holds the \`id\` of the response's entity. */
    readonly entity?: string;
    /**
     * Path parameters that reappear in default bodies, as \`[path, parameter, numeric]\`: \`'id'\`,
     * \`'[].projectId'\` (in every item) or \`'items.[].projectId'\`.
     */
    readonly fill?: readonly (readonly [string, string, boolean])[];
}
/** The options of a generated handler, without their per-status types. */
interface MockOptions extends MockSettings {
    readonly status?: number;
    readonly body?: unknown;
}
/**
 * A request handler for one operation: it matches the method and the path below the base URL,
 * and responds with \`options.status\` (or the operation's default status) and \`options.body\` (or
 * the documented response's fixture).
 */
export declare function mockHandler(operation: MockOperation, options?: MockOptions): HttpHandler;
/** Options of the generated \`send…Webhook()\` functions. */
export interface SendWebhookOptions {
    /** The \`fetch\` that sends the request (by default the global one). */
    readonly fetch?: typeof fetch;
    /** Headers added to the request, e.g. a signature your route checks. */
    readonly headers?: Readonly<Record<string, string>>;
}
/** A webhook or callback request as its generated types describe it. */
export interface WebhookRequestLike {
    readonly body?: unknown;
    readonly headers?: Readonly<Record<string, unknown>>;
    readonly query?: Readonly<Record<string, unknown>>;
    readonly cookies?: Readonly<Record<string, unknown>>;
    readonly querystring?: unknown;
}
/** How the API sends a webhook or callback request. */
export interface WebhookOperation {
    readonly method: string;
    /** Media type of the body. */
    readonly mediaType?: string;
    /** Converts a JSON body to its wire form, e.g. \`Date\` values to strings. */
    readonly encode?: (body: unknown) => unknown;
}
/**
 * Sends a webhook or callback request to \`url\` as the API would: the method, query, headers,
 * cookies and the body in its media type. Resolves with your route's response.
 */
export declare function sendWebhook(url: string | URL, operation: WebhookOperation, request: WebhookRequestLike, options?: SendWebhookOptions): Promise<Response>;
/**
 * A \`fetch\` answered by mock handlers instead of the network, without intercepting anything:
 * give it to the client's fetch transport. It works wherever \`Request\` and \`Response\` exist
 * (Node.js, browsers, Deno, Bun, edge runtimes), leaves the global \`fetch\` alone,
 * and lets tests that run in parallel use handlers of their own. Relative URLs resolve against
 * the page, or \`http://localhost\` outside browsers. A request no handler answers rejects like a
 * network error, or goes to \`fallback\`.
 *
 * @example
 * client.setConfig({ transport: createFetchTransport({ fetch: mockFetch(mockHandlers()) }) });
 */
export declare function mockFetch(handlers: readonly HttpHandler[], options?: {
    readonly fallback?: typeof fetch;
}): typeof fetch;
export {};
`,"/assets/mocks/support.js":`/**
 * Support for the generated Mock Service Worker handlers (\`features.mocks: 'msw'\`): matching
 * requests against the client's base URL, typed access to the request, building responses, and
 * \`mockFetch()\`, which answers a client from the handlers without intercepting anything.
 * Works with MSW 2.11 and later 2.x releases, and with MSW 3.
 */
import { delay, getResponse, http, HttpResponse } from 'msw';
import { seedOf, seedOfEntity } from './fake.js';
/** Statuses whose responses have no body. */
const NULL_BODY = new Set([101, 103, 204, 205, 304]);
/** The page's URL in browsers (and DOM environments such as happy-dom), otherwise \`undefined\`. */
function pageUrl() {
    return globalThis.location?.href;
}
/**
 * A request handler for one operation: it matches the method and the path below the base URL,
 * and responds with \`options.status\` (or the operation's default status) and \`options.body\` (or
 * the documented response's fixture).
 */
export function mockHandler(operation, options = {}) {
    const segments = compilePath(operation.path);
    const method = operation.method.toUpperCase();
    // \`once\` is counted here rather than by MSW, so that CORS preflights do not use it up.
    let used = false;
    return http.all(({ request }) => {
        const preflight = isPreflight(request, method, operation);
        // Methods compare like MSW compares them: \`fetch\` sends \`Patch\` as it is spelled.
        if (!preflight && (request.method.toUpperCase() !== method || used))
            return false;
        const params = matchUrl(request.url, baseUrlOf(operation, options), segments, operation);
        return params === undefined ? false : { matches: true, params };
    }, async ({ request, params, cookies }) => {
        if (isPreflight(request, method, operation))
            return preflightResponse(request);
        if (options.once === true)
            used = true;
        if (options.delay !== undefined)
            await delay(options.delay);
        if (options.networkError === true)
            return HttpResponse.error();
        const status = options.status ?? (options.error === true ? (operation.error ?? 500) : operation.status);
        const response = own(operation.responses, String(status)) ??
            own(operation.responses, \`\${String(status).charAt(0)}XX\`) ??
            own(operation.responses, 'default');
        let body;
        const generated = () => {
            if (response?.body === undefined)
                return undefined;
            const seed = seedFor(request, params, operation, options);
            // Error bodies describe the status they are sent with.
            return fill(response.body(options.empty === true ? { seed, status, empty: true } : { seed, status }), params, operation.fill);
        };
        if (typeof options.body === 'function') {
            const info = {
                request,
                params,
                query: new URL(request.url).searchParams,
                cookies,
                body: () => readBody(request, operation),
                generated,
            };
            body = await options.body(info);
            if (isResponse(body))
                return body;
        }
        else {
            body = options.body === undefined ? generated() : options.body;
        }
        return respond(request, status, body, response, options.headers);
    });
}
/**
 * The seed of a request's default body: the one in the settings; the seed of the entity a list
 * returned, for a request for its \`id\`; the examples' (\`0\`) for a request without parameters;
 * otherwise one derived from the request, so that pages and items differ.
 */
function seedFor(request, params, operation, options) {
    if (typeof options.seed === 'number')
        return options.seed;
    const entity = operation.entity === undefined ? undefined : params[operation.entity];
    const known = entity === undefined ? undefined : seedOfEntity(entity);
    if (known !== undefined)
        return known;
    const { search } = new URL(request.url);
    if (Object.keys(params).length === 0 && search === '')
        return 0;
    return seedOf(\`\${operation.method} \${operation.path} \${JSON.stringify(params)} \${search}\`);
}
/** Path parameters copied into the default body where it repeats them (\`projectId\`, \`id\`). */
function fill(body, params, entries) {
    for (const [path, param, numeric] of entries ?? []) {
        const raw = params[param];
        const value = numeric ? Number(raw) : raw;
        if (raw !== undefined && !(typeof value === 'number' && !Number.isFinite(value)))
            assign(body, path.split('.'), value);
    }
    return body;
}
function assign(target, segments, value) {
    const [head, ...rest] = segments;
    if (head === undefined)
        return;
    if (head === '[]') {
        if (Array.isArray(target))
            for (const item of target)
                assign(item, rest, value);
        return;
    }
    if (typeof target !== 'object' || target === null || Array.isArray(target))
        return;
    const record = target;
    if (!Object.prototype.hasOwnProperty.call(record, head))
        return;
    if (rest.length === 0)
        record[head] = value;
    else
        assign(record[head], rest, value);
}
/**
 * A CORS preflight for the method: DOM test environments (happy-dom) send them before
 * cross-origin requests, as browsers do. Browsers do not send them to a service worker.
 */
function isPreflight(request, method, operation) {
    if (request.method.toUpperCase() !== 'OPTIONS' || method === 'OPTIONS')
        return false;
    const requested = request.headers.get('access-control-request-method');
    // happy-dom's preflights have lost their CORS headers by the time they are intercepted.
    return requested === null ? operation.preflight !== false : requested.toUpperCase() === method;
}
/** Allows the request a preflight asks about. */
function preflightResponse(request) {
    const origin = request.headers.get('origin');
    const headers = new Headers({
        'access-control-allow-origin': origin ?? '*',
        'access-control-allow-methods': request.headers.get('access-control-request-method') ?? '*',
        'access-control-allow-headers': request.headers.get('access-control-request-headers') ?? '*',
        'access-control-max-age': '600',
    });
    if (origin !== null)
        headers.set('access-control-allow-credentials', 'true');
    return created(null, { status: 204, headers });
}
/** CORS headers for a request from a page, so that environments that check them let it through. */
function allowOrigin(request, headers) {
    const origin = request.headers.get('origin');
    if (origin === null)
        return;
    const exposed = [];
    headers.forEach((_, name) => {
        if (!name.startsWith('access-control-'))
            exposed.push(name);
    });
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-credentials', 'true');
    if (exposed.length > 0)
        headers.set('access-control-expose-headers', exposed.join(', '));
}
const asText = (value) => typeof value === 'string'
    ? value
    : value instanceof Date
        ? value.toISOString()
        : JSON.stringify(value);
function appendAll(target, name, value) {
    if (value === undefined)
        return;
    if (Array.isArray(value)) {
        for (const item of value)
            appendAll(target, name, item);
    }
    else if (target instanceof FormData && isBlob(value)) {
        target.append(name, value);
    }
    else {
        target.append(name, asText(value));
    }
}
/**
 * Sends a webhook or callback request to \`url\` as the API would: the method, query, headers,
 * cookies and the body in its media type. Resolves with your route's response.
 */
export async function sendWebhook(url, operation, request, options = {}) {
    const target = new URL(url, pageUrl() ?? 'http://localhost');
    const querystring = request.querystring;
    if (typeof querystring === 'string')
        target.search = querystring;
    else if (typeof querystring === 'object' && querystring !== null)
        for (const [name, value] of Object.entries(querystring))
            appendAll(target.searchParams, name, value);
    for (const [name, value] of Object.entries(request.query ?? {}))
        appendAll(target.searchParams, name, value);
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers ?? {}))
        if (value !== undefined)
            headers.set(name, asText(value));
    const cookies = Object.entries(request.cookies ?? {})
        .filter(([, value]) => value !== undefined)
        .map(([name, value]) => \`\${name}=\${encodeURIComponent(asText(value))}\`);
    if (cookies.length > 0)
        headers.set('cookie', cookies.join('; '));
    for (const [name, value] of Object.entries(options.headers ?? {}))
        headers.set(name, value);
    const type = operation.mediaType;
    let body;
    const value = request.body;
    if (value !== undefined && type !== undefined) {
        if (type === 'multipart/form-data') {
            const form = new FormData();
            for (const [name, item] of Object.entries(value))
                appendAll(form, name, item);
            body = form;
        }
        else {
            if (!headers.has('content-type'))
                headers.set('content-type', type);
            if (type === 'application/x-www-form-urlencoded') {
                const form = new URLSearchParams();
                for (const [name, item] of Object.entries(value))
                    appendAll(form, name, item);
                body = form;
            }
            else if (isJson(type)) {
                body = JSON.stringify(operation.encode === undefined ? value : operation.encode(value));
            }
            else if (isBlob(value) || typeof value === 'string') {
                body = value;
            }
            else {
                body = asText(value);
            }
        }
    }
    return (options.fetch ?? fetch)(target, {
        method: operation.method,
        headers,
        ...(body === undefined ? {} : { body }),
    });
}
/**
 * A \`fetch\` answered by mock handlers instead of the network, without intercepting anything:
 * give it to the client's fetch transport. It works wherever \`Request\` and \`Response\` exist
 * (Node.js, browsers, Deno, Bun, edge runtimes), leaves the global \`fetch\` alone,
 * and lets tests that run in parallel use handlers of their own. Relative URLs resolve against
 * the page, or \`http://localhost\` outside browsers. A request no handler answers rejects like a
 * network error, or goes to \`fallback\`.
 *
 * @example
 * client.setConfig({ transport: createFetchTransport({ fetch: mockFetch(mockHandlers()) }) });
 */
export function mockFetch(handlers, options = {}) {
    const mocked = async (...args) => {
        const [input, init] = args;
        const request = typeof input === 'string' || input instanceof URL
            ? new Request(new URL(input, pageUrl() ?? 'http://localhost'), init)
            : new Request(input, init);
        const response = await getResponse([...handlers], request);
        if (response === undefined) {
            if (options.fallback !== undefined)
                return options.fallback(request);
            throw new TypeError(\`No mock handler answers \${request.method} \${request.url}.\`);
        }
        // \`Response.error()\` is a network error, which \`fetch\` reports by rejecting.
        if (response.type === 'error')
            throw new TypeError('Failed to fetch (mocked network error).');
        return response;
    };
    return mocked;
}
function own(record, key) {
    return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}
function baseUrlOf(operation, options) {
    if (options.baseUrl !== undefined)
        return options.baseUrl;
    const config = (options.client ?? operation.client).getConfig();
    return operation.server !== undefined && config.operationServers !== false
        ? operation.server
        : config.baseUrl;
}
function escapeRegExp(text) {
    return text.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
}
function decode(text) {
    try {
        return decodeURIComponent(text);
    }
    catch {
        return text;
    }
}
/** The segments of a path template after its leading \`/\`: literal text, or a pattern. */
function compilePath(path) {
    return path
        .split('/')
        .slice(1)
        .map((segment) => {
        if (!/\\{[^}]+\\}/.test(segment))
            return decode(segment);
        const names = [];
        let source = '';
        let last = 0;
        const parameter = /\\{([^}]+)\\}/g;
        for (let match = parameter.exec(segment); match !== null; match = parameter.exec(segment)) {
            source += \`\${escapeRegExp(decode(segment.slice(last, match.index)))}([\\\\s\\\\S]+?)\`;
            names.push(match[1] ?? '');
            last = match.index + match[0].length;
        }
        source += escapeRegExp(decode(segment.slice(last)));
        return { pattern: new RegExp(\`^\${source}$\`), names };
    });
}
/**
 * The path parameters of \`url\` when it is the base URL followed by the path template, compared
 * segment by segment after percent-decoding; \`undefined\` when it is not.
 */
function matchUrl(url, base, segments, operation) {
    const target = new URL(url);
    const queryStart = base.indexOf('?');
    const basePath = queryStart === -1 ? base : base.slice(0, queryStart);
    // Relative base URLs are resolved like the client's requests: against the page, if there is one.
    const page = pageUrl();
    const root = new URL(basePath === '' ? '/' : basePath, page ?? target.href);
    const absolute = /^[a-z][a-z\\d+.-]*:/i.test(basePath);
    if ((absolute || page !== undefined) && root.origin !== target.origin)
        return undefined;
    const prefix = root.pathname.split('/').slice(1).map(decode);
    if (prefix[prefix.length - 1] === '')
        prefix.pop();
    const actual = target.pathname.split('/').slice(1).map(decode);
    const expected = [...prefix, ...segments];
    if (actual.length !== expected.length)
        return undefined;
    const params = {};
    for (const [index, segment] of expected.entries()) {
        const value = actual[index] ?? '';
        if (typeof segment === 'string') {
            if (segment !== value)
                return undefined;
            continue;
        }
        const match = segment.pattern.exec(value);
        if (match === null)
            return undefined;
        segment.names.forEach((name, position) => {
            let param = match[position + 1] ?? '';
            const style = operation.styles?.[name];
            if (style === 'label' && param.startsWith('.'))
                param = param.slice(1);
            else if (style === 'matrix' && param.startsWith(\`;\${name}=\`))
                param = param.slice(name.length + 2);
            // \`defineProperty\`, so a parameter named \`__proto__\` stays a property.
            Object.defineProperty(params, name, {
                value: param,
                writable: true,
                enumerable: true,
                configurable: true,
            });
        });
    }
    return params;
}
function mediaTypeOf(contentType) {
    return (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
}
function isJson(mediaType) {
    const type = mediaTypeOf(mediaType);
    return type === 'application/json' || type.endsWith('+json') || type === '*/*';
}
async function readBody(request, operation) {
    const copy = request.clone();
    // \`GET\` requests (and others sent without one) have no body.
    if (copy.body === null)
        return undefined;
    const type = mediaTypeOf(copy.headers.get('content-type'));
    let kind;
    if (operation.request !== undefined)
        kind = operation.request;
    else if (isJson(type))
        kind = 'json';
    else if (type === 'multipart/form-data')
        kind = 'multipart';
    else if (type === 'application/x-www-form-urlencoded')
        kind = 'urlencoded';
    else
        kind = type.startsWith('text/') ? 'text' : 'binary';
    switch (kind) {
        case 'json': {
            const text = await copy.text();
            if (text === '')
                return undefined;
            const value = JSON.parse(text);
            return operation.decode === undefined ? value : operation.decode(value);
        }
        case 'multipart':
            return copy.formData();
        case 'urlencoded':
            return new URLSearchParams(await copy.text());
        case 'text':
            return copy.text();
        case 'binary':
            return copy.blob();
    }
}
/**
 * Whether a value is a \`Response\`, also one from another realm (a DOM test environment's) or
 * another copy of MSW.
 */
function isResponse(value) {
    if (value instanceof Response)
        return true;
    return (typeof value === 'object' &&
        value !== null &&
        'status' in value &&
        'headers' in value &&
        'clone' in value &&
        typeof value.clone === 'function' &&
        'arrayBuffer' in value &&
        typeof value.arrayBuffer === 'function');
}
/** A \`Blob\` (also from another realm), whose bytes are sent. */
function isBlob(value) {
    if (value instanceof Blob)
        return true;
    return (typeof value === 'object' &&
        value !== null &&
        'arrayBuffer' in value &&
        typeof value.arrayBuffer === 'function' &&
        'size' in value &&
        typeof value.size === 'number' &&
        'type' in value &&
        typeof value.type === 'string');
}
/** Bodies sent as they are rather than as JSON. */
function isNative(body) {
    return (body instanceof ArrayBuffer ||
        ArrayBuffer.isView(body) ||
        body instanceof FormData ||
        body instanceof URLSearchParams);
}
/**
 * The response for a body: \`HttpResponse\`, which also mocks \`Set-Cookie\` headers in browsers
 * and allows every status.
 */
function created(body, init) {
    return new HttpResponse(body, init);
}
async function respond(request, status, body, response, extra) {
    const headers = new Headers();
    for (const [name, value] of Object.entries({ ...response?.headers, ...extra }))
        headers.set(name, value);
    allowOrigin(request, headers);
    const init = { status, headers };
    if (body === undefined || NULL_BODY.has(status) || request.method.toUpperCase() === 'HEAD')
        return created(null, init);
    if (response?.write !== undefined && typeof body !== 'string' && !isBlob(body) && !isNative(body))
        body = response.write(body);
    const mediaType = response?.mediaType;
    const declared = mediaType !== undefined && !mediaType.includes('*') ? mediaType : undefined;
    if (isBlob(body)) {
        const type = declared ?? (body.type === '' ? undefined : body.type);
        if (type !== undefined && !headers.has('content-type'))
            headers.set('content-type', type);
        return created(new Uint8Array(await body.arrayBuffer()), init);
    }
    if (isNative(body) || (typeof body === 'string' && declared !== undefined && !isJson(declared))) {
        if (declared !== undefined && !headers.has('content-type'))
            headers.set('content-type', declared);
        return created(body, init);
    }
    if (!headers.has('content-type'))
        headers.set('content-type', declared !== undefined && isJson(declared) ? declared : 'application/json');
    return created(JSON.stringify(response?.encode === undefined ? body : response.encode(body)), init);
}
`,"/assets/mocks/support.ts":`/**
 * Support for the generated Mock Service Worker handlers (\`features.mocks: 'msw'\`): matching
 * requests against the client's base URL, typed access to the request, building responses, and
 * \`mockFetch()\`, which answers a client from the handlers without intercepting anything.
 * Works with MSW 2.11 and later 2.x releases, and with MSW 3.
 */
import { delay, getResponse, http, HttpResponse, type HttpHandler } from 'msw';
import { seedOf, seedOfEntity, type FixtureOptions } from './fake.js';

/** A client whose configuration decides the base URL requests are matched against. */
export interface MockClient {
  getConfig(): { readonly baseUrl: string; readonly operationServers?: boolean | undefined };
}

/** Settings every mock handler accepts; \`mockHandlers()\` passes them on to each handler. */
export interface MockSettings {
  /**
   * The base URL requests are matched against. By default the one the client sends them to: its
   * current \`baseUrl\`, or the operation's own server when it declares one (and
   * \`operationServers\` is on). A relative URL matches any origin unless the page has one.
   */
  readonly baseUrl?: string;
  /** Match the base URL of this client (e.g. one made with \`createClient()\`) instead. */
  readonly client?: MockClient;
  /**
   * Wait before responding: milliseconds, \`'real'\` (a realistic, random server time in browsers)
   * or \`'infinite'\` (never respond, to see loading states).
   */
  readonly delay?: number | 'real' | 'infinite';
  /** Headers added to the response. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Fail like a network error instead of responding. */
  readonly networkError?: boolean;
  /** Respond to the first matching request only. */
  readonly once?: boolean;
  /**
   * Which values default bodies have: \`'request'\` (the default) generates them for each request,
   * the same for the same request (the examples for a request without parameters, the entity a
   * list returned for a request for its \`id\`); a number makes every body with that seed (\`0\` for
   * the examples).
   */
  readonly seed?: number | 'request';
  /** Make the arrays of default bodies as short as their schema allows, to see empty states. */
  readonly empty?: boolean;
  /** Respond with the operation's first documented error status (or \`500\`) instead. */
  readonly error?: boolean;
}

/** What a response function receives. */
export interface MockRequest<TParams, TBody, TResponse = unknown> {
  /** The intercepted request. */
  readonly request: Request;
  /** Path parameters by name, percent-decoded. */
  readonly params: TParams;
  /** The query string of the request. */
  readonly query: URLSearchParams;
  /** Cookies sent with the request. */
  readonly cookies: Readonly<Record<string, string>>;
  /**
   * Reads the request body by its media type: parsed JSON (with dates revived), \`FormData\`,
   * \`URLSearchParams\`, text or a \`Blob\`; \`undefined\` without a body. Can be called more than once.
   */
  body(): Promise<TBody>;
  /**
   * The body the handler would respond with by default: generated for this request (with the
   * handler's \`seed\` and \`empty\` settings), for a function that only changes or completes it.
   * Typed as the default status's body: with another \`status\`, it is that status's body.
   */
  generated(): TResponse;
}

/**
 * A response body, or a function of the request that returns one. The function may also return
 * a \`Response\`, which is sent as it is: another status, or \`Response.error()\` for a network error.
 */
export type MockBody<T, TRequest> =
  | T
  | ((request: TRequest) => T | Response | Promise<T | Response>);

/** How \`MockRequest.body()\` reads a request body. */
export type MockRequestBody = 'json' | 'multipart' | 'urlencoded' | 'text' | 'binary';

/** A documented response of an operation. */
export interface MockResponse {
  /** Media type of the body; absent for responses without one. */
  readonly mediaType?: string;
  /** Creates the default body (a fixture) for the request's seed, once per request. */
  readonly body?: (options: FixtureOptions) => unknown;
  /** The headers the response documents as required, with example values. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Converts a body to its wire form, e.g. \`Date\` values to strings. */
  readonly encode?: (body: unknown) => unknown;
  /** Writes a value (not already text) in the media type: an XML document, JSON Lines… */
  readonly write?: (body: unknown) => string;
}

/** An operation as its generated mock handler describes it. */
export interface MockOperation {
  /** The client whose configuration decides the base URL. */
  readonly client: MockClient;
  /** The request method, as the client sends it. */
  readonly method: string;
  /** The path template, e.g. \`/pets/{petId}\`. */
  readonly path: string;
  /** The operation's own server, if it declares one. */
  readonly server?: string;
  /** Path parameters serialized with the \`label\` or \`matrix\` style. */
  readonly styles?: Readonly<Record<string, 'label' | 'matrix'>>;
  /** The status to respond with when the options name none. */
  readonly status: number;
  /** How \`body()\` reads the request body; by its \`Content-Type\` when absent. */
  readonly request?: MockRequestBody;
  /** Converts a parsed JSON request body, e.g. date strings to \`Date\` values. */
  readonly decode?: (body: unknown) => unknown;
  /** Documented responses by status: \`'200'\`, \`'4XX'\` or \`'default'\`. */
  readonly responses: Readonly<Record<string, MockResponse>>;
  /** \`false\` when the path has an \`OPTIONS\` operation, which answers plain \`OPTIONS\` requests. */
  readonly preflight?: boolean;
  /** The status \`error: true\` responds with (\`500\` when absent). */
  readonly error?: number;
  /** The path parameter that holds the \`id\` of the response's entity. */
  readonly entity?: string;
  /**
   * Path parameters that reappear in default bodies, as \`[path, parameter, numeric]\`: \`'id'\`,
   * \`'[].projectId'\` (in every item) or \`'items.[].projectId'\`.
   */
  readonly fill?: readonly (readonly [string, string, boolean])[];
}

/** The options of a generated handler, without their per-status types. */
interface MockOptions extends MockSettings {
  readonly status?: number;
  readonly body?: unknown;
}

type Segment = string | { readonly pattern: RegExp; readonly names: readonly string[] };

/** Statuses whose responses have no body. */
const NULL_BODY: ReadonlySet<number> = new Set([101, 103, 204, 205, 304]);

/** The page's URL in browsers (and DOM environments such as happy-dom), otherwise \`undefined\`. */
function pageUrl(): string | undefined {
  return (globalThis as { location?: { href?: string } }).location?.href;
}

/**
 * A request handler for one operation: it matches the method and the path below the base URL,
 * and responds with \`options.status\` (or the operation's default status) and \`options.body\` (or
 * the documented response's fixture).
 */
export function mockHandler(operation: MockOperation, options: MockOptions = {}): HttpHandler {
  const segments = compilePath(operation.path);
  const method = operation.method.toUpperCase();
  // \`once\` is counted here rather than by MSW, so that CORS preflights do not use it up.
  let used = false;
  return http.all(
    ({ request }): false | { matches: true; params: Record<string, string> } => {
      const preflight = isPreflight(request, method, operation);
      // Methods compare like MSW compares them: \`fetch\` sends \`Patch\` as it is spelled.
      if (!preflight && (request.method.toUpperCase() !== method || used)) return false;
      const params = matchUrl(request.url, baseUrlOf(operation, options), segments, operation);
      return params === undefined ? false : { matches: true, params };
    },
    async ({ request, params, cookies }): Promise<Response> => {
      if (isPreflight(request, method, operation)) return preflightResponse(request);
      if (options.once === true) used = true;
      if (options.delay !== undefined) await delay(options.delay);
      if (options.networkError === true) return HttpResponse.error();
      const status =
        options.status ?? (options.error === true ? (operation.error ?? 500) : operation.status);
      const response =
        own(operation.responses, String(status)) ??
        own(operation.responses, \`\${String(status).charAt(0)}XX\`) ??
        own(operation.responses, 'default');
      let body: unknown;
      const generated = (): unknown => {
        if (response?.body === undefined) return undefined;
        const seed = seedFor(request, params, operation, options);
        // Error bodies describe the status they are sent with.
        return fill(
          response.body(options.empty === true ? { seed, status, empty: true } : { seed, status }),
          params,
          operation.fill,
        );
      };
      if (typeof options.body === 'function') {
        const info: MockRequest<Readonly<Record<string, string>>, unknown> = {
          request,
          params,
          query: new URL(request.url).searchParams,
          cookies,
          body: () => readBody(request, operation),
          generated,
        };
        body = await (options.body as (request: typeof info) => unknown)(info);
        if (isResponse(body)) return body;
      } else {
        body = options.body === undefined ? generated() : options.body;
      }
      return respond(request, status, body, response, options.headers);
    },
  );
}

/**
 * The seed of a request's default body: the one in the settings; the seed of the entity a list
 * returned, for a request for its \`id\`; the examples' (\`0\`) for a request without parameters;
 * otherwise one derived from the request, so that pages and items differ.
 */
function seedFor(
  request: Request,
  params: Readonly<Record<string, string>>,
  operation: MockOperation,
  options: MockOptions,
): number {
  if (typeof options.seed === 'number') return options.seed;
  const entity = operation.entity === undefined ? undefined : params[operation.entity];
  const known = entity === undefined ? undefined : seedOfEntity(entity);
  if (known !== undefined) return known;
  const { search } = new URL(request.url);
  if (Object.keys(params).length === 0 && search === '') return 0;
  return seedOf(\`\${operation.method} \${operation.path} \${JSON.stringify(params)} \${search}\`);
}

/** Path parameters copied into the default body where it repeats them (\`projectId\`, \`id\`). */
function fill(
  body: unknown,
  params: Readonly<Record<string, string>>,
  entries: MockOperation['fill'],
): unknown {
  for (const [path, param, numeric] of entries ?? []) {
    const raw = params[param];
    const value = numeric ? Number(raw) : raw;
    if (raw !== undefined && !(typeof value === 'number' && !Number.isFinite(value)))
      assign(body, path.split('.'), value);
  }
  return body;
}

function assign(target: unknown, segments: readonly string[], value: unknown): void {
  const [head, ...rest] = segments;
  if (head === undefined) return;
  if (head === '[]') {
    if (Array.isArray(target)) for (const item of target as unknown[]) assign(item, rest, value);
    return;
  }
  if (typeof target !== 'object' || target === null || Array.isArray(target)) return;
  const record = target as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, head)) return;
  if (rest.length === 0) record[head] = value;
  else assign(record[head], rest, value);
}

/**
 * A CORS preflight for the method: DOM test environments (happy-dom) send them before
 * cross-origin requests, as browsers do. Browsers do not send them to a service worker.
 */
function isPreflight(request: Request, method: string, operation: MockOperation): boolean {
  if (request.method.toUpperCase() !== 'OPTIONS' || method === 'OPTIONS') return false;
  const requested = request.headers.get('access-control-request-method');
  // happy-dom's preflights have lost their CORS headers by the time they are intercepted.
  return requested === null ? operation.preflight !== false : requested.toUpperCase() === method;
}

/** Allows the request a preflight asks about. */
function preflightResponse(request: Request): Response {
  const origin = request.headers.get('origin');
  const headers = new Headers({
    'access-control-allow-origin': origin ?? '*',
    'access-control-allow-methods': request.headers.get('access-control-request-method') ?? '*',
    'access-control-allow-headers': request.headers.get('access-control-request-headers') ?? '*',
    'access-control-max-age': '600',
  });
  if (origin !== null) headers.set('access-control-allow-credentials', 'true');
  return created(null, { status: 204, headers });
}

/** CORS headers for a request from a page, so that environments that check them let it through. */
function allowOrigin(request: Request, headers: Headers): void {
  const origin = request.headers.get('origin');
  if (origin === null) return;
  const exposed: string[] = [];
  headers.forEach((_, name) => {
    if (!name.startsWith('access-control-')) exposed.push(name);
  });
  headers.set('access-control-allow-origin', origin);
  headers.set('access-control-allow-credentials', 'true');
  if (exposed.length > 0) headers.set('access-control-expose-headers', exposed.join(', '));
}

/** Options of the generated \`send…Webhook()\` functions. */
export interface SendWebhookOptions {
  /** The \`fetch\` that sends the request (by default the global one). */
  readonly fetch?: typeof fetch;
  /** Headers added to the request, e.g. a signature your route checks. */
  readonly headers?: Readonly<Record<string, string>>;
}

/** A webhook or callback request as its generated types describe it. */
export interface WebhookRequestLike {
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, unknown>>;
  readonly query?: Readonly<Record<string, unknown>>;
  readonly cookies?: Readonly<Record<string, unknown>>;
  readonly querystring?: unknown;
}

/** How the API sends a webhook or callback request. */
export interface WebhookOperation {
  readonly method: string;
  /** Media type of the body. */
  readonly mediaType?: string;
  /** Converts a JSON body to its wire form, e.g. \`Date\` values to strings. */
  readonly encode?: (body: unknown) => unknown;
}

const asText = (value: unknown): string =>
  typeof value === 'string'
    ? value
    : value instanceof Date
      ? value.toISOString()
      : JSON.stringify(value);

function appendAll(target: URLSearchParams | FormData, name: string, value: unknown): void {
  if (value === undefined) return;
  if (Array.isArray(value)) {
    for (const item of value as unknown[]) appendAll(target, name, item);
  } else if (target instanceof FormData && isBlob(value)) {
    target.append(name, value);
  } else {
    target.append(name, asText(value));
  }
}

/**
 * Sends a webhook or callback request to \`url\` as the API would: the method, query, headers,
 * cookies and the body in its media type. Resolves with your route's response.
 */
export async function sendWebhook(
  url: string | URL,
  operation: WebhookOperation,
  request: WebhookRequestLike,
  options: SendWebhookOptions = {},
): Promise<Response> {
  const target = new URL(url, pageUrl() ?? 'http://localhost');
  const querystring = request.querystring;
  if (typeof querystring === 'string') target.search = querystring;
  else if (typeof querystring === 'object' && querystring !== null)
    for (const [name, value] of Object.entries(querystring))
      appendAll(target.searchParams, name, value);
  for (const [name, value] of Object.entries(request.query ?? {}))
    appendAll(target.searchParams, name, value);
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers ?? {}))
    if (value !== undefined) headers.set(name, asText(value));
  const cookies = Object.entries(request.cookies ?? {})
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => \`\${name}=\${encodeURIComponent(asText(value))}\`);
  if (cookies.length > 0) headers.set('cookie', cookies.join('; '));
  for (const [name, value] of Object.entries(options.headers ?? {})) headers.set(name, value);
  const type = operation.mediaType;
  let body: RequestInit['body'];
  const value = request.body;
  if (value !== undefined && type !== undefined) {
    if (type === 'multipart/form-data') {
      const form = new FormData();
      for (const [name, item] of Object.entries(value as Record<string, unknown>))
        appendAll(form, name, item);
      body = form;
    } else {
      if (!headers.has('content-type')) headers.set('content-type', type);
      if (type === 'application/x-www-form-urlencoded') {
        const form = new URLSearchParams();
        for (const [name, item] of Object.entries(value as Record<string, unknown>))
          appendAll(form, name, item);
        body = form;
      } else if (isJson(type)) {
        body = JSON.stringify(operation.encode === undefined ? value : operation.encode(value));
      } else if (isBlob(value) || typeof value === 'string') {
        body = value;
      } else {
        body = asText(value);
      }
    }
  }
  return (options.fetch ?? fetch)(target, {
    method: operation.method,
    headers,
    ...(body === undefined ? {} : { body }),
  });
}

/**
 * A \`fetch\` answered by mock handlers instead of the network, without intercepting anything:
 * give it to the client's fetch transport. It works wherever \`Request\` and \`Response\` exist
 * (Node.js, browsers, Deno, Bun, edge runtimes), leaves the global \`fetch\` alone,
 * and lets tests that run in parallel use handlers of their own. Relative URLs resolve against
 * the page, or \`http://localhost\` outside browsers. A request no handler answers rejects like a
 * network error, or goes to \`fallback\`.
 *
 * @example
 * client.setConfig({ transport: createFetchTransport({ fetch: mockFetch(mockHandlers()) }) });
 */
export function mockFetch(
  handlers: readonly HttpHandler[],
  options: { readonly fallback?: typeof fetch } = {},
): typeof fetch {
  const mocked = async (...args: ConstructorParameters<typeof Request>): Promise<Response> => {
    const [input, init] = args;
    const request =
      typeof input === 'string' || input instanceof URL
        ? new Request(new URL(input, pageUrl() ?? 'http://localhost'), init)
        : new Request(input, init);
    const response = await getResponse([...handlers], request);
    if (response === undefined) {
      if (options.fallback !== undefined) return options.fallback(request);
      throw new TypeError(\`No mock handler answers \${request.method} \${request.url}.\`);
    }
    // \`Response.error()\` is a network error, which \`fetch\` reports by rejecting.
    if (response.type === 'error') throw new TypeError('Failed to fetch (mocked network error).');
    return response;
  };
  // oxlint-disable-next-line typescript/no-unnecessary-type-assertion -- Some environments type \`fetch\` with members of their own (Bun's \`fetch.preconnect\`).
  return mocked as typeof fetch;
}

function own(
  record: Readonly<Record<string, MockResponse>>,
  key: string,
): MockResponse | undefined {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

function baseUrlOf(operation: MockOperation, options: MockSettings): string {
  if (options.baseUrl !== undefined) return options.baseUrl;
  const config = (options.client ?? operation.client).getConfig();
  return operation.server !== undefined && config.operationServers !== false
    ? operation.server
    : config.baseUrl;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
}

function decode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** The segments of a path template after its leading \`/\`: literal text, or a pattern. */
function compilePath(path: string): Segment[] {
  return path
    .split('/')
    .slice(1)
    .map((segment) => {
      if (!/\\{[^}]+\\}/.test(segment)) return decode(segment);
      const names: string[] = [];
      let source = '';
      let last = 0;
      const parameter = /\\{([^}]+)\\}/g;
      for (let match = parameter.exec(segment); match !== null; match = parameter.exec(segment)) {
        source += \`\${escapeRegExp(decode(segment.slice(last, match.index)))}([\\\\s\\\\S]+?)\`;
        names.push(match[1] ?? '');
        last = match.index + match[0].length;
      }
      source += escapeRegExp(decode(segment.slice(last)));
      return { pattern: new RegExp(\`^\${source}$\`), names };
    });
}

/**
 * The path parameters of \`url\` when it is the base URL followed by the path template, compared
 * segment by segment after percent-decoding; \`undefined\` when it is not.
 */
function matchUrl(
  url: string,
  base: string,
  segments: readonly Segment[],
  operation: MockOperation,
): Record<string, string> | undefined {
  const target = new URL(url);
  const queryStart = base.indexOf('?');
  const basePath = queryStart === -1 ? base : base.slice(0, queryStart);
  // Relative base URLs are resolved like the client's requests: against the page, if there is one.
  const page = pageUrl();
  const root = new URL(basePath === '' ? '/' : basePath, page ?? target.href);
  const absolute = /^[a-z][a-z\\d+.-]*:/i.test(basePath);
  if ((absolute || page !== undefined) && root.origin !== target.origin) return undefined;
  const prefix = root.pathname.split('/').slice(1).map(decode);
  if (prefix[prefix.length - 1] === '') prefix.pop();
  const actual = target.pathname.split('/').slice(1).map(decode);
  const expected = [...prefix, ...segments];
  if (actual.length !== expected.length) return undefined;
  const params: Record<string, string> = {};
  for (const [index, segment] of expected.entries()) {
    const value = actual[index] ?? '';
    if (typeof segment === 'string') {
      if (segment !== value) return undefined;
      continue;
    }
    const match = segment.pattern.exec(value);
    if (match === null) return undefined;
    segment.names.forEach((name, position) => {
      let param = match[position + 1] ?? '';
      const style = operation.styles?.[name];
      if (style === 'label' && param.startsWith('.')) param = param.slice(1);
      else if (style === 'matrix' && param.startsWith(\`;\${name}=\`))
        param = param.slice(name.length + 2);
      // \`defineProperty\`, so a parameter named \`__proto__\` stays a property.
      Object.defineProperty(params, name, {
        value: param,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    });
  }
  return params;
}

function mediaTypeOf(contentType: string | null | undefined): string {
  return (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
}

function isJson(mediaType: string): boolean {
  const type = mediaTypeOf(mediaType);
  return type === 'application/json' || type.endsWith('+json') || type === '*/*';
}

async function readBody(request: Request, operation: MockOperation): Promise<unknown> {
  const copy = request.clone();
  // \`GET\` requests (and others sent without one) have no body.
  if (copy.body === null) return undefined;
  const type = mediaTypeOf(copy.headers.get('content-type'));
  let kind: MockRequestBody;
  if (operation.request !== undefined) kind = operation.request;
  else if (isJson(type)) kind = 'json';
  else if (type === 'multipart/form-data') kind = 'multipart';
  else if (type === 'application/x-www-form-urlencoded') kind = 'urlencoded';
  else kind = type.startsWith('text/') ? 'text' : 'binary';
  switch (kind) {
    case 'json': {
      const text = await copy.text();
      if (text === '') return undefined;
      const value: unknown = JSON.parse(text);
      return operation.decode === undefined ? value : operation.decode(value);
    }
    case 'multipart':
      return copy.formData();
    case 'urlencoded':
      return new URLSearchParams(await copy.text());
    case 'text':
      return copy.text();
    case 'binary':
      return copy.blob();
  }
}

/**
 * Whether a value is a \`Response\`, also one from another realm (a DOM test environment's) or
 * another copy of MSW.
 */
function isResponse(value: unknown): value is Response {
  if (value instanceof Response) return true;
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'headers' in value &&
    'clone' in value &&
    typeof value.clone === 'function' &&
    'arrayBuffer' in value &&
    typeof value.arrayBuffer === 'function'
  );
}

/** A \`Blob\` (also from another realm), whose bytes are sent. */
function isBlob(value: unknown): value is Blob {
  if (value instanceof Blob) return true;
  return (
    typeof value === 'object' &&
    value !== null &&
    'arrayBuffer' in value &&
    typeof value.arrayBuffer === 'function' &&
    'size' in value &&
    typeof value.size === 'number' &&
    'type' in value &&
    typeof value.type === 'string'
  );
}

/** Bodies sent as they are rather than as JSON. */
function isNative(body: unknown): boolean {
  return (
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||
    body instanceof FormData ||
    body instanceof URLSearchParams
  );
}

/**
 * The response for a body: \`HttpResponse\`, which also mocks \`Set-Cookie\` headers in browsers
 * and allows every status.
 */
function created(body: unknown, init: { status: number; headers: Headers }): Response {
  return new HttpResponse(body as string | null, init);
}

async function respond(
  request: Request,
  status: number,
  body: unknown,
  response: MockResponse | undefined,
  extra: Readonly<Record<string, string>> | undefined,
): Promise<Response> {
  const headers = new Headers();
  for (const [name, value] of Object.entries({ ...response?.headers, ...extra }))
    headers.set(name, value);
  allowOrigin(request, headers);
  const init = { status, headers };
  if (body === undefined || NULL_BODY.has(status) || request.method.toUpperCase() === 'HEAD')
    return created(null, init);
  if (response?.write !== undefined && typeof body !== 'string' && !isBlob(body) && !isNative(body))
    body = response.write(body);
  const mediaType = response?.mediaType;
  const declared = mediaType !== undefined && !mediaType.includes('*') ? mediaType : undefined;
  if (isBlob(body)) {
    const type = declared ?? (body.type === '' ? undefined : body.type);
    if (type !== undefined && !headers.has('content-type')) headers.set('content-type', type);
    return created(new Uint8Array(await body.arrayBuffer()), init);
  }
  if (isNative(body) || (typeof body === 'string' && declared !== undefined && !isJson(declared))) {
    if (declared !== undefined && !headers.has('content-type'))
      headers.set('content-type', declared);
    return created(body, init);
  }
  if (!headers.has('content-type'))
    headers.set(
      'content-type',
      declared !== undefined && isJson(declared) ? declared : 'application/json',
    );
  return created(
    JSON.stringify(response?.encode === undefined ? body : response.encode(body)),
    init,
  );
}
`,"/package.json":`{"name":"swaggerz","version":"0.2.2","bin":{"swaggerz":"./dist/cli/bin.js","sz":"./dist/cli/bin.js"}}`};function re(e){let t=e instanceof URL?decodeURIComponent(e.pathname):e;for(let[e,n]of Object.entries(ne))if(t.endsWith(e))return n;throw Error(`ENOENT: ${t} is not embedded in the browser compiler.`)}function w(e){let t=typeof e==`string`?new URL(e):e;return decodeURIComponent(t.pathname)}function ie(e){return new URL(`file://${encodeURI(e).replace(/[?#]/g,encodeURIComponent)}`)}function ae(){let e=JSON.parse(re(m.join(m.dirname(w(self.location.href)),`..`,`package.json`),`utf8`));if(typeof e!=`object`||!e)throw Error(`Unable to read package.json`);let t=`name`in e&&typeof e.name==`string`?e.name:void 0,n=`version`in e&&typeof e.version==`string`?e.version:void 0,r=`bin`in e?e.bin:void 0,i=typeof r==`object`&&r?Object.keys(r):[],a=i[0];if(t===void 0||n===void 0)throw Error(`package.json is missing "name" or "version"`);return{name:t,version:n,bin:a??t.split(`/`).at(-1)??t,aliases:i.slice(1)}}var oe=ae();oe.name,oe.version;var T=oe.bin;oe.aliases,`${T}`;var se=`.${T}-manifest.json`;`${T.toUpperCase().replace(/[^A-Z0-9]+/g,`_`)}`;function E(e){return typeof e==`object`&&!!e&&!Array.isArray(e)}function D(e,t,n){t===`__proto__`?Object.defineProperty(e,t,{value:n,writable:!0,enumerable:!0,configurable:!0}):e[t]=n}function ce(e,t){return Object.hasOwn(e,t)?e[t]:void 0}function le(e){if(Array.isArray(e))return e.map(le);if(!E(e))return e;let t={};for(let n of Object.keys(e).sort())D(t,n,le(e[n]));return t}function ue(e){return JSON.stringify(le(e))}function de(e,t){let n=Array.from({length:t.length+1},(e,t)=>t);for(let r=1;r<=e.length;r++){let i=n[0]??0;n[0]=r;for(let a=1;a<=t.length;a++){let o=n[a]??0,s=n[a-1]??0,c=e[r-1]===t[a-1]?0:1;n[a]=Math.min(o+1,s+1,i+c),i=o}}return n[t.length]??0}function fe(e,t){let n,r=1/0,i=e.toLowerCase();for(let e of t){let t=de(i,e.toLowerCase());t<r&&(n=e,r=t)}let a=Math.max(2,Math.floor(e.length/3));return r<=a?n:void 0}function O(e,t){return e<t?-1:+(e>t)}function pe(e,t,n=`${t}s`){return`${e} ${e===1?t:n}`}function me(e,t,n=!1){return Object.assign(e,{schema:t,...n?{codeOnly:n}:{}})}var he=e=>e===null?`null`:Array.isArray(e)?`an array`:`a ${typeof e}`,k={string(e={}){return me((t,n,r)=>{typeof t==`string`?e.nonEmpty===!0&&t.trim()===``&&r.push({path:n,message:`Expected a non-empty string.`}):r.push({path:n,message:`Expected a string but received ${he(t)}.`})},{type:`string`,...e.nonEmpty===!0?{minLength:1}:{}})},boolean(){return me((e,t,n)=>{typeof e!=`boolean`&&n.push({path:t,message:`Expected a boolean but received ${he(e)}.`})},{type:`boolean`})},number(e={}){return me((t,n,r)=>{typeof t!=`number`||Number.isNaN(t)?r.push({path:n,message:`Expected a number but received ${he(t)}.`}):(e.integer===!0&&!Number.isInteger(t)&&r.push({path:n,message:`Expected an integer.`}),e.min!==void 0&&t<e.min&&r.push({path:n,message:`Expected a value >= ${e.min}.`}),e.max!==void 0&&t>e.max&&r.push({path:n,message:`Expected a value <= ${e.max}.`}))},{type:e.integer===!0?`integer`:`number`,...e.min===void 0?{}:{minimum:e.min},...e.max===void 0?{}:{maximum:e.max}})},literal(...e){return me((t,n,r)=>{if(!e.includes(t)){let i=e.map(e=>JSON.stringify(e)).join(`, `),a=typeof t==`string`?fe(t,e.map(String)):void 0,o=typeof t==`number`?e.find(e=>typeof e==`string`&&e.trim()!==``&&Number(e)===t):void 0,s=o===void 0?a===void 0?void 0:`Did you mean "${a}"?`:`Quote the value: ${JSON.stringify(o)} is a string option, but an unquoted ${String(o)} is read as a number.`;r.push({path:n,message:`Expected one of ${i} but received ${t===void 0?`undefined`:typeof t==`function`?he(t):typeof t==`number`?`the number ${JSON.stringify(t)}`:JSON.stringify(t)}.`,...s===void 0?{}:{hint:s}})}},e.length===1?{const:e[0]}:{enum:e})},func(){return me((e,t,n)=>{typeof e!=`function`&&n.push({path:t,message:`Expected a function but received ${he(e)}.`})},{},!0)},array(e){return me((t,n,r)=>{Array.isArray(t)?t.forEach((t,i)=>{e(t,`${n}[${i}]`,r)}):r.push({path:n,message:`Expected an array but received ${he(t)}.`})},{type:`array`,items:e.schema},e.codeOnly)},tuple(e,t={}){let n=t.minItems??e.length;return me((t,r,i)=>{!Array.isArray(t)||t.length<n||t.length>e.length?i.push({path:r,message:`Expected an array of ${n===e.length?e.length:`${n} to ${e.length}`} items but received ${he(t)}.`}):t.forEach((t,n)=>{e[n]?.(t,`${r}[${n}]`,i)})},{type:`array`,prefixItems:e.map(e=>e.schema),minItems:n,maxItems:e.length})},unknown(){return me(()=>{},{})},record(e){return me((t,n,r)=>{if(!E(t))r.push({path:n,message:`Expected an object but received ${he(t)}.`});else for(let[i,a]of Object.entries(t))e(a,`${n}.${i}`,r)},{type:`object`,additionalProperties:e.schema},e.codeOnly)},object(e,t={}){let n=Object.fromEntries(Object.entries(e).filter(([,e])=>e.codeOnly!==!0).map(([e,t])=>[e,t.schema]));return me((n,r,i)=>{if(!E(n))i.push({path:r,message:`Expected an object but received ${he(n)}.`});else{for(let e of t.required??[])n[e]===void 0&&i.push({path:ge(r,e),message:`This option is required.`});for(let[t,a]of Object.entries(n)){let n=Object.hasOwn(e,t)?e[t]:void 0;if(n===void 0){let n=fe(t,Object.keys(e));i.push({path:ge(r,t),message:`Unknown option.`,hint:n===void 0?`Supported options: ${Object.keys(e).join(`, `)}.`:`Did you mean "${n}"?`})}else a!==void 0&&n(a,ge(r,t),i)}}},{type:`object`,properties:n,...t.required===void 0||t.required.length===0?{}:{required:t.required},additionalProperties:!1},Object.keys(n).length===0&&Object.keys(e).length>0)},union(e,t){let n=e.filter(e=>e.codeOnly!==!0).map(e=>e.schema);return me((n,r,i)=>{let a=e.map(e=>{let t=[];return e(n,r,t),t});if(a.some(e=>e.length===0))return;let o=a.find(e=>e.every(e=>e.path!==r));o===void 0?i.push({path:r,message:`Expected ${t} but received ${he(n)}.`}):i.push(...o)},n.length===1?n[0]??{}:{anyOf:n},n.length===0)},codeOnly(e){return me((t,n,r)=>{e(t,n,r)},e.schema,!0)},doc(e,t,n={}){return me((t,n,r)=>{e(t,n,r)},{...e.schema,description:t,markdownDescription:t,...n},e.codeOnly)}};function ge(e,t){return e===``?t:`${e}.${t}`}var _e=[`camelCase`,`PascalCase`,`snake_case`,`preserve`],ve=Object.fromEntries([`beforeParse`,`afterNormalize`,`operationName`,`modelName`,`jsdoc`,`queryKey`,`resolveImport`,`beforeGenerate`,`generate`,`transformFile`,`afterGenerate`,`beforeWrite`,`afterWrite`].map(e=>[e,k.func()])),ye=k.codeOnly(k.object({name:k.string({nonEmpty:!0}),enforce:k.literal(`pre`,`post`),...ve},{required:[`name`]})),be=k.doc(k.string({nonEmpty:!0}),`Module that exports a plugin (or a function returning one) as its default export: a path relative to the config file, or a package name.`),xe=k.union([ye,be,k.doc(k.tuple([be,k.unknown()],{minItems:1}),"`[module, options]`: the module default-exports a function that receives `options` and returns a plugin.")],`a plugin object, a module path or [module path, options]`),Se={queryMethods:k.doc(k.array(k.literal(...S)),`HTTP methods that produce query hooks; all others produce mutation hooks.`,{default:[`get`,`query`]}),infinite:k.doc(k.record(k.object({pageParam:k.doc(k.string({nonEmpty:!0}),`The query parameter that receives the page parameter.`)},{required:[`pageParam`]})),"Infinite query hooks, keyed by operation name or `operationId`."),invalidates:k.doc(k.record(k.array(k.string({nonEmpty:!0}))),"Queries to invalidate after a successful mutation, keyed by mutation name or `operationId`. Values are operation names, `operationId`s or tags.")},Ce=k.object(Se),we=k.object({framework:k.doc(k.literal(`react`,`vue`,`svelte`,`solid`),`TanStack Query adapter: 'react' (@tanstack/react-query 5), 'vue' (@tanstack/vue-query 5), 'svelte' (@tanstack/svelte-query 6) or 'solid' (@tanstack/solid-query 5).`,{default:`react`}),...Se}),Te=[`zod`,`valibot`,`arktype`],Ee=k.record(k.literal(`off`,`info`,`warning`,`error`)),De=k.object({$schema:k.doc(k.string(),`JSON Schema used by editors for completion and validation.`),spec:k.doc(k.object({version:k.doc(k.literal(`2.0`,`3.0`,`3.1`,`3.2`,`auto`),`Specification version the input must declare: '2.0' (Swagger), '3.0', '3.1', '3.2', or 'auto' for any supported version.`),input:k.doc(k.string({nonEmpty:!0}),`Path (relative to the config file) or http(s) URL of a JSON or YAML document.`),refs:k.doc(k.object({external:k.doc(k.literal(`none`,`local`,`remote`),`Which external $refs may be followed: 'none', 'local' files inside allowedDirectories, or 'remote' URLs on allowedHosts as well.`,{default:`local`}),allowedDirectories:k.doc(k.array(k.string({nonEmpty:!0})),`Directories local references may read. Defaults to the project root and the directory of the specification.`),allowedHosts:k.doc(k.array(k.string({nonEmpty:!0})),`Hosts remote references may be fetched from, e.g. 'schemas.example.com' or '*.example.com'.`),maxDocuments:k.doc(k.number({min:1,integer:!0}),`Maximum number of documents a description may consist of.`,{default:5e3})}),`External reference policy.`),fetch:k.doc(k.object({headers:k.doc(k.record(k.string()),`Headers sent with remote documents (only to the origin of spec.input).`),timeout:k.doc(k.number({min:1,integer:!0}),`Timeout in milliseconds.`,{default:3e4}),maxBytes:k.doc(k.number({min:1,integer:!0}),`Maximum document size in bytes.`,{default:52428800}),poll:k.doc(k.union([k.boolean(),k.number({min:500,integer:!0})],`a boolean or an interval in milliseconds (at least 500)`),"Poll remote documents for changes in `generate --watch` and the dashboard: true (every 2000 ms), an interval in milliseconds, or false. By default only documents on loopback hosts (localhost, 127.0.0.1, [::1]) are polled.")}),`Options for fetching remote documents.`),overlays:k.doc(k.array(k.string({nonEmpty:!0})),`OpenAPI Overlay documents (1.0, 1.1 or 1.2) applied in order to the specification before it is parsed: paths relative to the config file, or http(s) URLs.`)},{required:[`version`,`input`]}),`The specification to generate from.`),output:k.doc(k.object({directory:k.doc(k.string({nonEmpty:!0}),`Output directory, relative to the config file.`,{default:`./src/generated/api`}),language:k.doc(k.literal(`typescript`,`javascript`),`Generate TypeScript, or JavaScript with JSDoc and .d.ts declarations.`,{default:`typescript`}),moduleFormat:k.doc(k.literal(`esm`),`Only ES modules are generated.`,{default:`esm`}),clean:k.doc(k.boolean(),`Remove generated files that are no longer produced (only files recorded in the manifest).`,{default:!0}),declarations:k.doc(k.boolean(),`JavaScript output: emit .d.ts declarations next to each module.`,{default:!0}),importExtension:k.doc(k.literal(`.js`,`.ts`,`none`),`Extension used in relative imports between generated modules.`,{default:`.js`}),barrel:k.doc(k.boolean(),`Emit index barrels.`,{default:!0}),groupBy:k.doc(k.literal(`tag`,`none`),`Group operation modules in directories by their first tag.`,{default:`tag`}),models:k.doc(k.literal(`all`,`used`),`Emit every named schema ('all') or only those operations use ('used').`,{default:`all`}),webhooks:k.doc(k.boolean(),`Generate payload types and handler signatures for webhooks and callbacks.`,{default:!0}),banner:k.doc(k.string(),`Extra text for the header comment of every generated file.`)}),`Where and how generated files are written.`),client:k.doc(k.object({adapter:k.doc(k.literal(`fetch`,`axios`),`HTTP transport: 'fetch' (no dependencies) or 'axios'.`,{default:`fetch`}),baseUrl:k.doc(k.string(),`Base URL compiled into the client. Defaults to the first server of the specification.`),operationServers:k.doc(k.boolean(),"Send operations that declare their own `servers` to that server instead of the base URL.",{default:!0}),includeCredentials:k.doc(k.boolean(),`Send cookies with cross-origin requests.`,{default:!1}),headers:k.doc(k.record(k.string()),`Static headers sent with every request.`),timeout:k.doc(k.number({min:0,integer:!0}),`Default request timeout in milliseconds (0 disables it).`),responseStyle:k.doc(k.literal(`data`,`full`),`'data' resolves with the body; 'full' resolves with { data, status, headers }.`,{default:`data`})}),`Defaults of the generated HTTP client.`),features:k.doc(k.object({query:k.doc(k.union([k.boolean(),we],`a boolean or TanStack Query options`),`Generate TanStack Query v5 hooks and option factories for React, Vue, Svelte or Solid (true: React).`,{default:!1}),reactQuery:k.doc(k.union([k.boolean(),Ce],`a boolean or React Query options`),"Alias of `query` with framework 'react'. Use one or the other.",{default:!1}),swr:k.doc(k.union([k.boolean(),k.object(Se)],`a boolean or SWR options`),`Generate SWR hooks (useSWR, useSWRMutation, useSWRInfinite).`,{default:!1}),jsdoc:k.doc(k.boolean(),`Generate documentation comments.`,{default:!0}),validation:k.doc(k.union([k.literal(!1,...Te),k.object({library:k.doc(k.literal(...Te),`Schema library: 'zod' (4), 'valibot' (1) or 'arktype' (2).`),response:k.doc(k.boolean(),`Validate response bodies.`,{default:!0}),request:k.doc(k.boolean(),`Validate request bodies before sending.`,{default:!1})},{required:[`library`]})],`false, 'zod', 'valibot', 'arktype' or validation options`),`Generate schemas with Zod 4, Valibot 1 or ArkType 2 and validate at runtime.`,{default:!1}),mocks:k.doc(k.literal(!1,`msw`),`Generate a Mock Service Worker handler per operation and a fixture factory per model: false or 'msw' (MSW 2.11 or 3).`,{default:!1})}),`Optional generators.`),naming:k.doc(k.object({operations:k.doc(k.literal(..._e),`Operation function names.`,{default:`camelCase`}),models:k.doc(k.literal(..._e),`Model type names.`,{default:`PascalCase`}),files:k.doc(k.literal(`kebab-case`,`camelCase`,`PascalCase`,`snake_case`),`File names.`,{default:`kebab-case`}),parameters:k.doc(k.literal(`preserve`,`camelCase`),`Parameter property names: wire names ('preserve') or camelCase identifiers.`,{default:`preserve`}),inputSuffix:k.doc(k.string({nonEmpty:!0}),`Suffix of request-side model variants created when models have readOnly or writeOnly properties.`,{default:`Input`})}),`Naming conventions.`),types:k.doc(k.object({enums:k.doc(k.literal(`union`,`const`),`'union' emits literal unions; 'const' also emits a frozen object per named enum.`,{default:`union`}),readonlyProperties:k.doc(k.boolean(),`Mark readOnly properties with the readonly modifier.`,{default:!0}),readWrite:k.doc(k.literal(`split`,`merged`),`'split' leaves readOnly properties out of request types and writeOnly properties out of response types; 'merged' uses one type for both.`,{default:`split`}),dates:k.doc(k.literal(`string`,`Date`),"Type `date` and `date-time` strings as 'string', or as 'Date' with responses converted at runtime.",{default:`string`})}),`How schemas map to types.`),dashboard:k.doc(k.object({host:k.doc(k.string({nonEmpty:!0}),`Interface to listen on.`,{default:`127.0.0.1`}),port:k.doc(k.number({min:0,max:65535,integer:!0}),`Port (0 picks one).`,{default:4400}),allowNetworkAccess:k.doc(k.boolean(),`Required to listen on a non-loopback interface.`,{default:!1}),usage:k.doc(k.object({include:k.doc(k.array(k.string({nonEmpty:!0})),`Files or directories to scan.`,{default:[`src`]}),exclude:k.doc(k.array(k.string({nonEmpty:!0})),`Path segments to skip.`)}),`Usage scanning of your source code.`)}),`Options of \`${T} dashboard\`.`),lint:k.doc(k.object({rules:k.doc(Ee,`Severity per lint rule ('off', 'info', 'warning' or 'error'), e.g. { 'operation-id': 'error' }.`)}),`Options of \`${T} lint\`.`),plugins:k.doc(k.array(xe),`Plugins, run in order within their enforce group. In JSON and YAML configs, reference modules by path or package name.`),hooks:k.object(ve)},{required:[`spec`]});function Oe(e){let t=[];return De(e,``,t),t.length===0&&E(e)&&t.push(...ke(e)),t}function ke(e){let t=[],n=E(e.features)?e.features:{},r=e=>n[e]!==void 0&&n[e]!==!1;n.query!==void 0&&n.reactQuery!==void 0&&t.push({path:`features.reactQuery`,message:`features.reactQuery is an alias of features.query; set only one of them.`,hint:`Move its options to features.query (with framework: 'react').`}),r(`swr`)&&(r(`query`)||r(`reactQuery`))&&t.push({path:`features.swr`,message:`SWR and TanStack Query hooks cannot be generated together (their hooks would share names).`,hint:`Enable one of features.swr and features.query.`});let i=E(e.lint)?e.lint:{},a=E(i.rules)?i.rules:{};for(let e of Object.keys(a)){if(te.some(t=>t.name===e))continue;let n=fe(e,te.map(e=>e.name));t.push({path:`lint.rules.${e}`,message:`Unknown lint rule.`,hint:n===void 0?`Rules: ${te.map(e=>e.name).join(`, `)}.`:`Did you mean "${n}"?`})}return t}function Ae(e,t){return t}var je={error:`red`,warning:`yellow`,info:`cyan`};function Me(e){return e<32&&e!==9&&e!==10||e>=127&&e<=159}function Ne(e){let t=``,n=0;for(let r=0;r<e.length;r++){let i=e.charCodeAt(r);Me(i)&&(t+=`${e.slice(n,r)}\\x${i.toString(16).padStart(2,`0`)}`,n=r+1)}return n===0?e:t+e.slice(n)}function Pe(e,t,n){return n?Ae(t,e,{validateStream:!1}):e}function Fe(e,t){if(t===void 0||/^[a-z]+:\/\//i.test(e))return e;let n=m.relative(t,e);return n===``||n.startsWith(`..`)&&m.isAbsolute(e)?e:n}function Ie(e,t={}){let n=t.color===!0,r=[`${Pe(e.severity,je[e.severity],n)} ${Pe(Ne(e.code),`dim`,n)} ${Ne(e.message)}`],i=e.location;if(i!==void 0){let e=Ne(Fe(i.file,t.cwd));i.line!==void 0&&(e+=`:${i.line}${i.column===void 0?``:`:${i.column}`}`),i.pointer!==void 0&&i.pointer!==``&&(e+=` (#${Ne(i.pointer)})`),r.push(`  ${Pe(`at`,`dim`,n)} ${e}`)}if(e.operation!==void 0&&r.push(`  ${Pe(`in`,`dim`,n)} ${Ne(e.operation)}`),e.plugin!==void 0&&r.push(`  ${Pe(`plugin`,`dim`,n)} ${Ne(e.plugin)}`),e.hint!==void 0){let[t=``,...i]=Ne(e.hint).split(`
`);r.push(`  ${Pe(`hint`,`green`,n)} ${t}`,...i.map(e=>`       ${e}`))}return r.join(`
`)}var Le=new Uint32Array([1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298]);function Re(e){let t=e.length,n=new Uint8Array(t+9+63>>6<<6);n.set(e),n[t]=128;let r=new DataView(n.buffer);r.setUint32(n.length-8,Math.floor(t*8/2**32)),r.setUint32(n.length-4,t*8>>>0);let i=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225],a=/* @__PURE__ */ new Uint32Array(64),o=(e,t)=>e>>>t|e<<32-t,s=e=>a[e]??0;for(let e=0;e<n.length;e+=64){for(let t=0;t<16;t++)a[t]=r.getUint32(e+t*4);for(let e=16;e<64;e++){let t=s(e-15),n=s(e-2),r=o(t,7)^o(t,18)^t>>>3,i=o(n,17)^o(n,19)^n>>>10;a[e]=s(e-16)+r+s(e-7)+i>>>0}let[t=0,n=0,c=0,l=0,u=0,d=0,f=0,p=0]=i;for(let e=0;e<64;e++){let r=o(u,6)^o(u,11)^o(u,25),i=u&d^~u&f,a=p+r+i+(Le[e]??0)+s(e)>>>0,m=(o(t,2)^o(t,13)^o(t,22))+(t&n^t&c^n&c)>>>0;p=f,f=d,d=u,u=l+a>>>0,l=c,c=n,n=t,t=a+m>>>0}[t,n,c,l,u,d,f,p].forEach((e,t)=>{i[t]=(i[t]??0)+e>>>0})}let c=/* @__PURE__ */ new Uint8Array(32),l=new DataView(c.buffer);for(let e=0;e<8;e++)l.setUint32(e*4,i[e]??0);return c}function ze(e){if(e!==`sha256`)throw Error(`Only sha256 is available in the browser (${e}).`);let t=[],n={update(e){return t.push(typeof e==`string`?new TextEncoder().encode(e):e),n},digest(e){let n=new Uint8Array(t.reduce((e,t)=>e+t.length,0)),r=0;for(let e of t)n.set(e,r),r+=e.length;return[...Re(n)].map(e=>e.toString(16).padStart(2,`0`)).join(``)}};return n}var Be=[`nullable`,`title`,`description`,`deprecated`,`readOnly`,`writeOnly`,`default`,`examples`,`format`,`assertions`,`extensions`,`source`];function Ve(e){let t={};for(let n of Be)e[n]!==void 0&&(t[n]=e[n]);return t}function He(e,t){switch(e.kind){case`array`:e.prefixItems?.forEach(t),t(e.items);break;case`object`:for(let n of e.properties)t(n.schema);e.additionalProperties!==void 0&&e.additionalProperties!==!1&&t(e.additionalProperties);break;case`union`:e.variants.forEach(t);break;case`intersection`:e.members.forEach(t)}}function Ue(e,t=/* @__PURE__ */ new Set,n={}){let r=[e];for(;r.length>0;){let e=r.pop();if(e===void 0)break;e.kind===`ref`&&t.add(e.target),e.kind===`object`&&n.subtypes!==!1&&e.discriminator?.mapping.forEach(e=>t.add(e.target)),e.kind===`union`&&e.discriminator?.mapping.forEach(e=>t.add(e.target)),He(e,e=>r.push(e)),We(e,e=>r.push(e))}return t}function We(e,t){let n=e.assertions;if(n===void 0)return;let r=n.conditional;for(let e of[n.not,r?.condition,r?.whenTrue,r?.whenFalse])e!==void 0&&t(e);for(let e of Object.values(n.dependentSchemas??{}))t(e)}function Ge(e){return e.itemSchema===void 0?[e.schema]:[e.schema,e.itemSchema]}function Ke(e){return[...e.parameters.map(e=>e.schema),...e.requestBody?.contents.flatMap(Ge)??[],...e.responses.flatMap(e=>[...e.contents.flatMap(Ge),...e.headers.map(e=>e.schema)])]}function qe(e){return[...e.webhooks.flatMap(e=>e.operations),...e.operations.flatMap(e=>(e.callbacks??[]).flatMap(e=>e.operations))]}function Je(e,t){if(t(e))return!0;let n=!1;return He(e,e=>{!n&&Je(e,t)&&(n=!0)}),n}var Ye=/* @__PURE__ */ new Set,Xe=class e{schemaDeps;schemaDependents;structuralDeps;operationDeps;schemaOperations;webhookDeps;#e=/* @__PURE__ */ new Map;#t;#n;#r=/* @__PURE__ */ new Map;constructor(e){this.schemaDeps=e.schemaDeps,this.structuralDeps=e.structuralDeps,this.schemaDependents=e.schemaDependents,this.operationDeps=e.operationDeps,this.schemaOperations=e.schemaOperations,this.webhookDeps=e.webhookDeps}static build(t){let n=/* @__PURE__ */ new Map,r=/* @__PURE__ */ new Map,i=/* @__PURE__ */ new Map,a=/* @__PURE__ */ new Map,o=/* @__PURE__ */ new Map;for(let e of t.schemas)n.set(e.id,Ue(e.schema)),r.set(e.id,Ue(e.schema,/* @__PURE__ */ new Set,{subtypes:!1})),i.set(e.id,/* @__PURE__ */ new Set),o.set(e.id,/* @__PURE__ */ new Set);for(let[e,t]of n)for(let n of t)i.get(n)?.add(e);for(let e of t.operations){let t=/* @__PURE__ */ new Set;for(let n of Ke(e))Ue(n,t);a.set(e.key,t);for(let n of t)o.get(n)?.add(e.key)}let s=/* @__PURE__ */ new Set;for(let e of qe(t))for(let t of Ke(e))Ue(t,s);return new e({schemaDeps:n,structuralDeps:r,schemaDependents:i,operationDeps:a,schemaOperations:o,webhookDeps:s})}#i(e){let t=/* @__PURE__ */ new Set,n=[...e];for(let e=0;e<n.length;e++){let r=n[e];if(!(r===void 0||t.has(r))){t.add(r);for(let e of this.schemaDeps.get(r)??[])t.has(e)||n.push(e)}}return t}schemaClosure(e){return this.#i(this.schemaDeps.get(e)??[])}operationClosure(e){return this.#i(this.operationDeps.get(e)??[])}operationsUsing(e){let t=this.#e.get(e);if(t!==void 0)return t;let n=/* @__PURE__ */ new Set,r=[e];for(let e=0;e<r.length;e++){let t=r[e];if(!(t===void 0||n.has(t))){n.add(t);for(let e of this.schemaDependents.get(t)??[])n.has(e)||r.push(e)}}let i=/* @__PURE__ */ new Set;for(let e of n)for(let t of this.schemaOperations.get(e)??[])i.add(t);let a=[...i].sort(O);return this.#e.set(e,a),a}usedSchemas(){return this.#t??=this.#i([...[...this.operationDeps.values()].flatMap(e=>[...e]),...this.webhookDeps]),this.#t}recursiveSchemas(){if(this.#n!==void 0)return this.#n;let e=/* @__PURE__ */ new Set,t=/* @__PURE__ */ new Map,n=/* @__PURE__ */ new Map,r=/* @__PURE__ */ new Set,i=[],a=0;for(let o of this.schemaDeps.keys()){if(t.has(o))continue;let s=[],c=e=>{t.set(e,a),n.set(e,a),a++,i.push(e),r.add(e),s.push({node:e,successors:[...this.structuralDeps.get(e)??[]]})};for(c(o);s.length>0;){let a=s[s.length-1];if(a===void 0)break;let o=a.successors.pop();if(o!==void 0){if(!this.schemaDeps.has(o))continue;t.has(o)?r.has(o)&&n.set(a.node,Math.min(n.get(a.node)??0,t.get(o)??0)):c(o);continue}s.pop();let l=s[s.length-1];if(l!==void 0&&n.set(l.node,Math.min(n.get(l.node)??0,n.get(a.node)??0)),n.get(a.node)===t.get(a.node)){let t=[];for(let e=i.pop();e!==void 0&&(r.delete(e),t.push(e),e!==a.node);e=i.pop());let n=this.structuralDeps.get(a.node)?.has(a.node)===!0;if(t.length>1||n){let n=new Set(t);for(let r of t)e.add(r),this.#r.set(r,n)}}}}return this.#n=e,e}cycleOf(e){return this.recursiveSchemas(),this.#r.get(e)??Ye}explain(e,t){let n=this.operationDeps.get(e);if(n===void 0)return;let r=/* @__PURE__ */ new Map,i=[];for(let e of[...n].sort(O))r.set(e,null),i.push(e);for(;i.length>0;){let e=i.shift();if(e===void 0)break;if(e===t){let t=[];for(let n=e;n!=null;n=r.get(n))t.unshift(n);return t}for(let t of[...this.schemaDeps.get(e)??[]].sort(O))r.has(t)||(r.set(t,e),i.push(t))}}};function Ze(e){let t=/* @__PURE__ */ new Map;for(let n of e.schemas){if(!Qe(n.schema))continue;let e=ze(`sha256`).update(ue($e(n.schema))).digest(`hex`),r=t.get(e)??[];r.push(n.id),t.set(e,r)}return[...t.values()].filter(e=>e.length>1).map(e=>e.sort(O))}function Qe(e){return e.kind===`object`&&e.properties.length>0||e.kind===`enum`&&e.values.length>1}function $e(e){let{description:t,title:n,examples:r,source:i,extensions:a,default:o,...s}=e,c={...s};return e.kind===`object`?(c.properties=e.properties.map(e=>({name:e.name,required:e.required,schema:$e(e.schema)})),e.additionalProperties!==void 0&&e.additionalProperties!==!1&&(c.additionalProperties=$e(e.additionalProperties))):(e.kind===`array`&&(c.items=$e(e.items)),e.kind===`union`&&(c.variants=e.variants.map($e)),e.kind===`intersection`&&(c.members=e.members.map($e))),c}var et=/* @__PURE__ */ new Set(/* @__PURE__ */ `abstract.any.arguments.as.asserts.async.await.bigint.boolean.break.case.catch.class.const.constructor.continue.debugger.declare.default.delete.do.else.enum.eval.export.extends.false.finally.for.from.function.get.if.implements.import.in.infer.instanceof.interface.is.keyof.let.module.namespace.never.new.null.number.object.of.package.private.protected.public.readonly.require.return.satisfies.set.static.string.super.switch.symbol.this.throw.true.try.type.typeof.undefined.unique.unknown.var.void.while.with.yield`.split(`.`)),tt=/* @__PURE__ */ new Set(/* @__PURE__ */ `AbortSignal.Array.ArrayBuffer.ArrayBufferView.Awaited.Blob.Boolean.Date.Error.Exclude.Extract.FormData.Function.Headers.Map.NonNullable.Number.Object.Omit.Parameters.Partial.Pick.Promise.Readonly.ReadonlyArray.Record.Required.Response.ReturnType.Set.String.Symbol.Uint8Array.URLSearchParams`.split(`.`));function nt(e){return e.normalize(`NFD`).replace(/[\u0300-\u036f]/g,``).replace(/([a-z\d])([A-Z])/g,`$1 $2`).replace(/([A-Z]+)([A-Z][a-z])/g,`$1 $2`).split(/[^A-Za-z\d]+/).filter(e=>e!==``)}function rt(e){return e.charAt(0).toUpperCase()+e.slice(1)}function it(e,t){if(t===`preserve`)return e;let n=nt(e===e.toUpperCase()&&/[A-Z]/.test(e)?e.toLowerCase():e);if(n.length===0)return``;switch(t){case`camelCase`:return n.map((e,t)=>t===0?at(e):rt(e)).join(``);case`PascalCase`:return n.map(rt).join(``);case`snake_case`:return n.map(e=>e.toLowerCase()).join(`_`);case`kebab-case`:return n.map(e=>e.toLowerCase()).join(`-`)}}function at(e){return e===e.toUpperCase()?e.toLowerCase():e.charAt(0).toLowerCase()+e.slice(1)}function ot(e,t){let n=it(e,t);return n=n.replace(/[^A-Za-z\d_$]/g,``),n===``&&(n=t===`PascalCase`?`Unnamed`:`unnamed`),/^\d/.test(n)&&(n=`_${n}`),et.has(n)&&(n=`${n}_`),n}function st(e,t){let n=it(e,t).replace(/[^A-Za-z\d_$]/g,``);return n===``&&(n=`value`),/^\d/.test(n)?`_${n}`:n}var ct=/^(?:con|prn|aux|nul|com\d|lpt\d)$/i;function lt(e,t){let n=it(e,t).replace(/[^A-Za-z\d_-]/g,``);return n===``?`unnamed`:ct.test(n)?`${n}_`:n}function ut(e){return/^[A-Za-z_$][A-Za-z\d_$]*$/.test(e)&&!et.has(e)}function dt(e){return/^[A-Za-z_$][A-Za-z\d_$]*$/.test(e)}var ft=class{#e=/* @__PURE__ */ new Set;#t;constructor(e={}){this.#t=e.caseInsensitive??!1}#n(e){return this.#t?e.toLowerCase():e}reserve(e){this.#e.add(this.#n(e))}has(e){return this.#e.has(this.#n(e))}claim(e,t=``){let n=e;for(let r=2;this.has(n);r++)n=`${e}${t}${r}`;return this.reserve(n),n}};function pt(e,t){let n=t.split(`/`).filter(e=>e!==``).map(e=>{let t=/^\{(.+)\}$/.exec(e);return t?.[1]===void 0?it(e,`PascalCase`):`By${it(t[1],`PascalCase`)}`});return`${e.toLowerCase()}${n.join(``)}`}var mt=`~input`;function ht(e,t){let n=new Map(e.schemas.map(e=>[e.id,e])),r=(e,t)=>e[t]===!0||e.kind===`ref`&&n.get(e.target)?.schema[t]===!0,i=/* @__PURE__ */ new Set,a=/* @__PURE__ */ new Map;for(let t of e.schemas)vt(t.schema,e=>{if(e.kind===`object`){e.properties.some(e=>r(e.schema,`readOnly`)||r(e.schema,`writeOnly`))&&i.add(t.id);for(let n of e.discriminator?.mapping??[])o(n.target,t.id)}if(e.kind===`union`)for(let n of e.discriminator?.mapping??[])o(n.target,t.id);e.kind===`ref`&&o(e.target,t.id)});function o(e,t){let n=a.get(e);n===void 0&&(n=/* @__PURE__ */ new Set,a.set(e,n)),n.add(t)}let s=qe(e),c=[...e.operations,...s].some(e=>_t(e).some(e=>yt(e,e=>e.kind===`object`&&e.properties.some(e=>r(e.schema,`readOnly`)||r(e.schema,`writeOnly`)))));if(i.size===0&&!c)return e;let l=new Set(i),u=[...i];for(let e=0;e<u.length;e++)for(let t of a.get(u[e]??``)??[])l.has(t)||(l.add(t),u.push(t));let d=e=>{let t=[];return vt(e,e=>{if(e.kind===`ref`&&t.push(e.target),e.kind===`object`||e.kind===`union`)for(let n of e.discriminator?.mapping??[])t.push(n.target)}),t},f=/* @__PURE__ */ new Set,p=[...e.operations.flatMap(e=>[...e.parameters.map(e=>e.schema),...(e.requestBody?.contents??[]).flatMap(Ge)].flatMap(e=>d(e))),...s.flatMap(e=>e.responses.flatMap(e=>e.contents.flatMap(Ge).flatMap(e=>d(e))))];for(let e=0;e<p.length;e++){let t=p[e]??``;if(f.has(t))continue;f.add(t);let r=n.get(t);r!==void 0&&p.push(...d(r.schema))}let m=new Set([...l].filter(e=>f.has(e))),h=e=>m.has(e)?`${e}${mt}`:e;function g(e,t){if(t===`read`)return e;let n=e.mapping.map(e=>({...e,target:h(e.target)}));return n.every((t,n)=>t.target===e.mapping[n]?.target)?e:{...e,mapping:n}}function _(e,t){switch(e.kind){case`ref`:{if(t===`read`)return e;let n=h(e.target);return n===e.target?e:{...e,target:n}}case`array`:{let n=_(e.items,t),r=e.prefixItems?.map(e=>_(e,t)),i=r?.some((t,n)=>t!==e.prefixItems?.[n]);return n===e.items&&i!==!0?e:{...e,items:n,...r===void 0?{}:{prefixItems:r}}}case`object`:{let n=t===`read`?`writeOnly`:`readOnly`,i=!1,a=[];for(let o of e.properties){if(r(o.schema,n)){i=!0;continue}let e=_(o.schema,t);e!==o.schema&&(i=!0),a.push(e===o.schema?o:{...o,schema:e})}let o=e.additionalProperties===void 0||e.additionalProperties===!1?e.additionalProperties:_(e.additionalProperties,t),s=e.discriminator===void 0?void 0:g(e.discriminator,t);if(!i&&o===e.additionalProperties&&s===e.discriminator)return e;let c=a.length===0&&e.properties.length>0&&o===void 0;return{...e,properties:a,...c?{additionalProperties:!1}:{},...o===void 0?{}:{additionalProperties:o},...s===void 0?{}:{discriminator:s}}}case`union`:{let n=e.variants.map(e=>_(e,t)),r=e.discriminator===void 0?void 0:g(e.discriminator,t);return n.every((t,n)=>t===e.variants[n])&&r===e.discriminator?e:{...e,variants:n,...r===void 0?{}:{discriminator:r}}}case`intersection`:{let n=e.members.map(e=>_(e,t));if(n.every((t,n)=>t===e.members[n]))return e;let r=n.filter((t,n)=>!(t!==e.members[n]&&gt(t)));return{...e,members:r.length===0?n:r}}default:return e}}let v=(e,t)=>{let n=e.map(e=>{let n=_(e.schema,t),r=e.itemSchema===void 0?void 0:_(e.itemSchema,t);return n===e.schema&&r===e.itemSchema?e:{...e,schema:n,...r===void 0?{}:{itemSchema:r}}});return n.every((t,n)=>t===e[n])?e:n},y=(e,t)=>({...e,...t?{parameters:e.parameters.map(e=>{let t=_(e.schema,`write`);return t===e.schema?e:{...e,schema:t}})}:{},...e.requestBody===void 0?{}:{requestBody:{...e.requestBody,contents:v(e.requestBody.contents,t?`write`:`read`)}},responses:e.responses.map(e=>({...e,contents:v(e.contents,t?`read`:`write`)})),...e.callbacks===void 0?{}:{callbacks:e.callbacks.map(e=>b(e))}}),b=e=>({...e,operations:e.operations.map(e=>y(e,!1))}),x=e.operations.map(e=>y(e,!0)),S=e.webhooks.map(b),C=[];for(let n of e.schemas){let e=_(n.schema,`read`);C.push(e===n.schema?n:{...n,schema:e}),m.has(n.id)&&C.push({id:`${n.id}${mt}`,name:`${n.name}${t}`,aliases:[],schema:_(n.schema,`write`),source:n.source})}return C.sort((e,t)=>O(e.id,t.id)),{...e,schemas:C,operations:x,webhooks:S}}function gt(e){return e.kind===`object`&&e.properties.length===0&&e.additionalProperties===!1&&e.discriminator===void 0}function _t(e){return[...e.parameters.map(e=>e.schema),...(e.requestBody?.contents??[]).flatMap(Ge),...e.responses.flatMap(e=>e.contents.flatMap(Ge))]}function vt(e,t){switch(t(e),e.kind){case`array`:vt(e.items,t);for(let n of e.prefixItems??[])vt(n,t);break;case`object`:for(let n of e.properties)vt(n.schema,t);e.additionalProperties!==void 0&&e.additionalProperties!==!1&&vt(e.additionalProperties,t);break;case`union`:for(let n of e.variants)vt(n,t);break;case`intersection`:for(let n of e.members)vt(n,t)}}function yt(e,t){let n=!1;return vt(e,e=>{!n&&t(e)&&(n=!0)}),n}var bt=Symbol.for(`yaml.alias`),xt=Symbol.for(`yaml.document`),St=Symbol.for(`yaml.map`),Ct=Symbol.for(`yaml.pair`),wt=Symbol.for(`yaml.scalar`),Tt=Symbol.for(`yaml.seq`),Et=Symbol.for(`yaml.node.type`),Dt=e=>!!e&&typeof e==`object`&&e[Et]===bt,Ot=e=>!!e&&typeof e==`object`&&e[Et]===xt,kt=e=>!!e&&typeof e==`object`&&e[Et]===St,A=e=>!!e&&typeof e==`object`&&e[Et]===Ct,j=e=>!!e&&typeof e==`object`&&e[Et]===wt,At=e=>!!e&&typeof e==`object`&&e[Et]===Tt;function M(e){if(e&&typeof e==`object`)switch(e[Et]){case St:case Tt:return!0}return!1}function N(e){if(e&&typeof e==`object`)switch(e[Et]){case bt:case St:case wt:case Tt:return!0}return!1}var jt=e=>(j(e)||M(e))&&!!e.anchor,Mt=Symbol(`break visit`),Nt=Symbol(`skip children`),Pt=Symbol(`remove node`);function Ft(e,t){let n=Lt(t);Ot(e)?It(null,e.contents,n,Object.freeze([e]))===Pt&&(e.contents=null):It(null,e,n,Object.freeze([]))}Ft.BREAK=Mt,Ft.SKIP=Nt,Ft.REMOVE=Pt;function It(e,t,n,r){let i=Rt(e,t,n,r);if(N(i)||A(i))return zt(e,r,i),It(e,i,n,r);if(typeof i!=`symbol`){if(M(t)){r=Object.freeze(r.concat(t));for(let e=0;e<t.items.length;++e){let i=It(e,t.items[e],n,r);if(typeof i==`number`)e=i-1;else{if(i===Mt)return Mt;i===Pt&&(t.items.splice(e,1),--e)}}}else if(A(t)){r=Object.freeze(r.concat(t));let e=It(`key`,t.key,n,r);if(e===Mt)return Mt;e===Pt&&(t.key=null);let i=It(`value`,t.value,n,r);if(i===Mt)return Mt;i===Pt&&(t.value=null)}}return i}function Lt(e){return typeof e==`object`&&(e.Collection||e.Node||e.Value)?Object.assign({Alias:e.Node,Map:e.Node,Scalar:e.Node,Seq:e.Node},e.Value&&{Map:e.Value,Scalar:e.Value,Seq:e.Value},e.Collection&&{Map:e.Collection,Seq:e.Collection},e):e}function Rt(e,t,n,r){if(typeof n==`function`)return n(e,t,r);if(kt(t))return n.Map?.(e,t,r);if(At(t))return n.Seq?.(e,t,r);if(A(t))return n.Pair?.(e,t,r);if(j(t))return n.Scalar?.(e,t,r);if(Dt(t))return n.Alias?.(e,t,r)}function zt(e,t,n){let r=t[t.length-1];if(M(r))r.items[e]=n;else if(A(r))e===`key`?r.key=n:r.value=n;else if(Ot(r))r.contents=n;else{let e=Dt(r)?`alias`:`scalar`;throw Error(`Cannot replace node with ${e} parent`)}}var Bt={"!":`%21`,",":`%2C`,"[":`%5B`,"]":`%5D`,"{":`%7B`,"}":`%7D`},Vt=e=>e.replace(/[!,[\]{}]/g,e=>Bt[e]),Ht=class e{constructor(t,n){this.docStart=null,this.docEnd=!1,this.yaml=Object.assign({},e.defaultYaml,t),this.tags=Object.assign({},e.defaultTags,n)}clone(){let t=new e(this.yaml,this.tags);return t.docStart=this.docStart,t}atDocument(){let t=new e(this.yaml,this.tags);switch(this.yaml.version){case`1.1`:this.atNextDocument=!0;break;case`1.2`:this.atNextDocument=!1,this.yaml={explicit:e.defaultYaml.explicit,version:`1.2`},this.tags=Object.assign({},e.defaultTags)}return t}add(t,n){this.atNextDocument&&=(this.yaml={explicit:e.defaultYaml.explicit,version:`1.1`},this.tags=Object.assign({},e.defaultTags),!1);let r=t.trim().split(/[ \t]+/),i=r.shift();switch(i){case`%TAG`:{if(r.length!==2&&(n(0,`%TAG directive should contain exactly two parts`),r.length<2))return!1;let[e,t]=r;return this.tags[e]=t,!0}case`%YAML`:{if(this.yaml.explicit=!0,r.length!==1)return n(0,`%YAML directive should contain exactly one part`),!1;let[e]=r;if(e===`1.1`||e===`1.2`)return this.yaml.version=e,!0;{let t=/^\d+\.\d+$/.test(e);return n(6,`Unsupported YAML version ${e}`,t),!1}}default:return n(0,`Unknown directive ${i}`,!0),!1}}tagName(e,t){if(e===`!`)return`!`;if(e[0]!==`!`)return t(`Not a valid tag: ${e}`),null;if(e[1]===`<`){let n=e.slice(2,-1);return n===`!`||n===`!!`?(t(`Verbatim tags aren't resolved, so ${e} is invalid.`),null):(e[e.length-1]!==`>`&&t(`Verbatim tags must end with a >`),n)}let[,n,r]=e.match(/^(.*!)([^!]*)$/s);r||t(`The ${e} tag has no suffix`);let i=this.tags[n];if(i)try{return i+decodeURIComponent(r)}catch(e){return t(String(e)),null}return n===`!`?e:(t(`Could not resolve tag: ${e}`),null)}tagString(e){for(let[t,n]of Object.entries(this.tags))if(e.startsWith(n))return t+Vt(e.substring(n.length));return e[0]===`!`?e:`!<${e}>`}toString(e){let t=this.yaml.explicit?[`%YAML ${this.yaml.version||`1.2`}`]:[],n=Object.entries(this.tags),r;if(e&&n.length>0&&N(e.contents)){let t={};Ft(e.contents,(e,n)=>{N(n)&&n.tag&&(t[n.tag]=!0)}),r=Object.keys(t)}else r=[];for(let[i,a]of n)i===`!!`&&a===`tag:yaml.org,2002:`||(!e||r.some(e=>e.startsWith(a)))&&t.push(`%TAG ${i} ${a}`);return t.join(`
`)}};Ht.defaultYaml={explicit:!1,version:`1.2`},Ht.defaultTags={"!!":`tag:yaml.org,2002:`};function Ut(e){if(/[\x00-\x19\s,[\]{}]/.test(e)){let t=`Anchor must not contain whitespace or control characters: ${JSON.stringify(e)}`;throw Error(t)}return!0}function Wt(e){let t=/* @__PURE__ */ new Set;return Ft(e,{Value(e,n){n.anchor&&t.add(n.anchor)}}),t}function Gt(e,t){for(let n=1;;++n){let r=`${e}${n}`;if(!t.has(r))return r}}function Kt(e,t){let n=[],r=/* @__PURE__ */ new Map,i=null;return{onAnchor:r=>{n.push(r),i??=Wt(e);let a=Gt(t,i);return i.add(a),a},setAnchors:()=>{for(let e of n){let t=r.get(e);if(typeof t==`object`&&t.anchor&&(j(t.node)||M(t.node)))t.node.anchor=t.anchor;else{let t=/* @__PURE__ */ Error(`Failed to resolve repeated object (this should not happen)`);throw t.source=e,t}}},sourceObjects:r}}function qt(e,t,n,r){if(r&&typeof r==`object`){if(Array.isArray(r))for(let t=0,n=r.length;t<n;++t){let n=r[t],i=qt(e,r,String(t),n);i===void 0?delete r[t]:i!==n&&(r[t]=i)}else if(r instanceof Map)for(let t of Array.from(r.keys())){let n=r.get(t),i=qt(e,r,t,n);i===void 0?r.delete(t):i!==n&&r.set(t,i)}else if(r instanceof Set)for(let t of Array.from(r)){let n=qt(e,r,t,t);n===void 0?r.delete(t):n!==t&&(r.delete(t),r.add(n))}else for(let[t,n]of Object.entries(r)){let i=qt(e,r,t,n);i===void 0?delete r[t]:i!==n&&(r[t]=i)}}return e.call(t,n,r)}function Jt(e,t,n){if(Array.isArray(e))return e.map((e,t)=>Jt(e,String(t),n));if(e&&typeof e.toJSON==`function`){if(!n||!jt(e))return e.toJSON(t,n);let r={aliasCount:0,count:1,res:void 0};n.anchors.set(e,r),n.onCreate=e=>{r.res=e,delete n.onCreate};let i=e.toJSON(t,n);return n.onCreate&&n.onCreate(i),i}return typeof e==`bigint`&&!n?.keep?Number(e):e}var Yt=class{constructor(e){Object.defineProperty(this,Et,{value:e})}clone(){let e=Object.create(Object.getPrototypeOf(this),Object.getOwnPropertyDescriptors(this));return this.range&&(e.range=this.range.slice()),e}toJS(e,{mapAsMap:t,maxAliasCount:n,onAnchor:r,reviver:i}={}){if(!Ot(e))throw TypeError(`A document argument is required`);let a={anchors:/* @__PURE__ */ new Map,doc:e,keep:!0,mapAsMap:t===!0,mapKeyWarned:!1,maxAliasCount:typeof n==`number`?n:100},o=Jt(this,``,a);if(typeof r==`function`)for(let{count:e,res:t}of a.anchors.values())r(t,e);return typeof i==`function`?qt(i,{"":o},``,o):o}},Xt=class extends Yt{constructor(e){super(bt),this.source=e,Object.defineProperty(this,"tag",{set(){throw Error(`Alias nodes cannot have tags`)}})}resolve(e,t){if(t?.maxAliasCount===0)throw ReferenceError(`Alias resolution is disabled`);let n;t?.aliasResolveCache?n=t.aliasResolveCache:(n=[],Ft(e,{Node:(e,t)=>{(Dt(t)||jt(t))&&n.push(t)}}),t&&(t.aliasResolveCache=n));let r;for(let e of n){if(e===this)break;e.anchor===this.source&&(r=e)}if(r&&t){let{anchors:e,doc:n,maxAliasCount:i}=t,a=e.get(r);if(a||=(Jt(r,null,t),e.get(r)),a?.res===void 0)throw ReferenceError(`This should not happen: Alias anchor was not resolved?`);if(i>=0&&(a.count+=1,a.aliasCount===0&&(a.aliasCount=Zt(n,r,e)),a.count*a.aliasCount>i))throw ReferenceError(`Excessive alias count indicates a resource exhaustion attack`)}return r}toJSON(e,t){if(!t)return{source:this.source};let n=this.resolve(t.doc,t);if(!n){let e=`Unresolved alias (the anchor must be set before the alias): ${this.source}`;throw ReferenceError(e)}return t.anchors.get(n).res}toString(e,t,n){let r=`*${this.source}`;if(e){if(Ut(this.source),e.options.verifyAliasOrder&&!e.anchors.has(this.source)){let e=`Unresolved alias (the anchor must be set before the alias): ${this.source}`;throw Error(e)}if(e.implicitKey)return`${r} `}return r}};function Zt(e,t,n){if(Dt(t)){let r=t.resolve(e),i=n&&r&&n.get(r);return i?i.count*i.aliasCount:0}if(M(t)){let r=0;for(let i of t.items){let t=Zt(e,i,n);t>r&&(r=t)}return r}if(A(t)){let r=Zt(e,t.key,n),i=Zt(e,t.value,n);return Math.max(r,i)}return 1}var Qt=e=>!e||typeof e!=`function`&&typeof e!=`object`,P=class extends Yt{constructor(e){super(wt),this.value=e}toJSON(e,t){return t?.keep?this.value:Jt(this.value,e,t)}toString(){return String(this.value)}};P.BLOCK_FOLDED=`BLOCK_FOLDED`,P.BLOCK_LITERAL=`BLOCK_LITERAL`,P.PLAIN=`PLAIN`,P.QUOTE_DOUBLE=`QUOTE_DOUBLE`,P.QUOTE_SINGLE=`QUOTE_SINGLE`;var $t=`tag:yaml.org,2002:`;function en(e,t,n){if(t){let e=n.filter(e=>e.tag===t),r=e.find(e=>!e.format)??e[0];if(!r)throw Error(`Tag ${t} not found`);return r}return n.find(t=>t.identify?.(e)&&!t.format)}function tn(e,t,n){if(Ot(e)&&(e=e.contents),N(e))return e;if(A(e)){let t=n.schema[St].createNode?.(n.schema,null,n);return t.items.push(e),t}(e instanceof String||e instanceof Number||e instanceof Boolean||typeof BigInt<`u`&&e instanceof BigInt)&&(e=e.valueOf());let{aliasDuplicateObjects:r,onAnchor:i,onTagObj:a,schema:o,sourceObjects:s}=n,c;if(r&&e&&typeof e==`object`){if(c=s.get(e),c)return c.anchor??(c.anchor=i(e)),new Xt(c.anchor);c={anchor:null,node:null},s.set(e,c)}t?.startsWith(`!!`)&&(t=$t+t.slice(2));let l=en(e,t,o.tags);if(!l){if(e&&typeof e.toJSON==`function`&&(e=e.toJSON()),!e||typeof e!=`object`){let t=new P(e);return c&&(c.node=t),t}l=e instanceof Map?o[St]:Symbol.iterator in Object(e)?o[Tt]:o[St]}a&&(a(l),delete n.onTagObj);let u=l?.createNode?l.createNode(n.schema,e,n):typeof l?.nodeClass?.from==`function`?l.nodeClass.from(n.schema,e,n):new P(e);return t?u.tag=t:l.default||(u.tag=l.tag),c&&(c.node=u),u}function nn(e,t,n){let r=n;for(let e=t.length-1;e>=0;--e){let n=t[e];if(typeof n==`number`&&Number.isInteger(n)&&n>=0){let e=[];e[n]=r,r=e}else r=/* @__PURE__ */ new Map([[n,r]])}return tn(r,void 0,{aliasDuplicateObjects:!1,keepUndefined:!1,onAnchor:()=>{throw Error(`This should not happen, please report a bug.`)},schema:e,sourceObjects:/* @__PURE__ */ new Map})}var rn=e=>e==null||typeof e==`object`&&!!e[Symbol.iterator]().next().done,an=class extends Yt{constructor(e,t){super(e),Object.defineProperty(this,"schema",{value:t,configurable:!0,enumerable:!1,writable:!0})}clone(e){let t=Object.create(Object.getPrototypeOf(this),Object.getOwnPropertyDescriptors(this));return e&&(t.schema=e),t.items=t.items.map(t=>N(t)||A(t)?t.clone(e):t),this.range&&(t.range=this.range.slice()),t}addIn(e,t){if(rn(e))this.add(t);else{let[n,...r]=e,i=this.get(n,!0);if(M(i))i.addIn(r,t);else if(i===void 0&&this.schema)this.set(n,nn(this.schema,r,t));else throw Error(`Expected YAML collection at ${n}. Remaining path: ${r}`)}}deleteIn(e){let[t,...n]=e;if(n.length===0)return this.delete(t);let r=this.get(t,!0);if(M(r))return r.deleteIn(n);throw Error(`Expected YAML collection at ${t}. Remaining path: ${n}`)}getIn(e,t){let[n,...r]=e,i=this.get(n,!0);return r.length===0?!t&&j(i)?i.value:i:M(i)?i.getIn(r,t):void 0}hasAllNullValues(e){return this.items.every(t=>{if(!A(t))return!1;let n=t.value;return n==null||e&&j(n)&&n.value==null&&!n.commentBefore&&!n.comment&&!n.tag})}hasIn(e){let[t,...n]=e;if(n.length===0)return this.has(t);let r=this.get(t,!0);return M(r)?r.hasIn(n):!1}setIn(e,t){let[n,...r]=e;if(r.length===0)this.set(n,t);else{let e=this.get(n,!0);if(M(e))e.setIn(r,t);else if(e===void 0&&this.schema)this.set(n,nn(this.schema,r,t));else throw Error(`Expected YAML collection at ${n}. Remaining path: ${r}`)}}},on=e=>e.replace(/^(?!$)(?: $)?/gm,`#`);function sn(e,t){return/^\n+$/.test(e)?e.substring(1):t?e.replace(/^(?! *$)/gm,t):e}var cn=(e,t,n)=>e.endsWith(`
`)?sn(n,t):n.includes(`
`)?`
`+sn(n,t):(e.endsWith(` `)?``:` `)+n,ln=`flow`,un=`block`,dn=`quoted`;function fn(e,t,n=`flow`,{indentAtStart:r,lineWidth:i=80,minContentWidth:a=20,onFold:o,onOverflow:s}={}){if(!i||i<0)return e;i<a&&(a=0);let c=Math.max(1+a,1+i-t.length);if(e.length<=c)return e;let l=[],u={},d=i-t.length;typeof r==`number`&&(r>i-Math.max(2,a)?l.push(0):d=i-r);let f,p,m=!1,h=-1,g=-1,_=-1;n===un&&(h=pn(e,h,t.length),h!==-1&&(d=h+c));for(let r;r=e[h+=1];){if(n===dn&&r===`\\`){switch(g=h,e[h+1]){case`x`:h+=3;break;case`u`:h+=5;break;case`U`:h+=9;break;default:h+=1}_=h}if(r===`
`)n===un&&(h=pn(e,h,t.length)),d=h+t.length+c,f=void 0;else{if(r===` `&&p&&p!==` `&&p!==`
`&&p!==`	`){let t=e[h+1];t&&t!==` `&&t!==`
`&&t!==`	`&&(f=h)}if(h>=d){if(f)l.push(f),d=f+c,f=void 0;else if(n===dn){for(;p===` `||p===`	`;)p=r,r=e[h+=1],m=!0;let t=h>_+1?h-2:g-1;if(u[t])return e;l.push(t),u[t]=!0,d=t+c,f=void 0}else m=!0}}p=r}if(m&&s&&s(),l.length===0)return e;o&&o();let v=e.slice(0,l[0]);for(let r=0;r<l.length;++r){let i=l[r],a=l[r+1]||e.length;i===0?v=`
${t}${e.slice(0,a)}`:(n===dn&&u[i]&&(v+=`${e[i]}\\`),v+=`
${t}${e.slice(i+1,a)}`)}return v}function pn(e,t,n){let r=t,i=t+1,a=e[i];for(;a===` `||a===`	`;)if(t<i+n)a=e[++t];else{do a=e[++t];while(a&&a!==`
`);r=t,i=t+1,a=e[i]}return r}var mn=(e,t)=>({indentAtStart:t?e.indent.length:e.indentAtStart,lineWidth:e.options.lineWidth,minContentWidth:e.options.minContentWidth}),hn=e=>/^(%|---|\.\.\.)/m.test(e);function gn(e,t,n){if(!t||t<0)return!1;let r=t-n,i=e.length;if(i<=r)return!1;for(let t=0,n=0;t<i;++t)if(e[t]===`
`){if(t-n>r)return!0;if(n=t+1,i-n<=r)return!1}return!0}function _n(e,t){let n=JSON.stringify(e);if(t.options.doubleQuotedAsJSON)return n;let{implicitKey:r}=t,i=t.options.doubleQuotedMinMultiLineLength,a=t.indent||(hn(e)?`  `:``),o=``,s=0;for(let e=0,t=n[e];t;t=n[++e])if(t===` `&&n[e+1]===`\\`&&n[e+2]===`n`&&(o+=n.slice(s,e)+`\\ `,e+=1,s=e,t=`\\`),t===`\\`)switch(n[e+1]){case`u`:{o+=n.slice(s,e);let t=n.substr(e+2,4);switch(t){case`0000`:o+=`\\0`;break;case`0007`:o+=`\\a`;break;case`000b`:o+=`\\v`;break;case`001b`:o+=`\\e`;break;case`0085`:o+=`\\N`;break;case`00a0`:o+=`\\_`;break;case`2028`:o+=`\\L`;break;case`2029`:o+=`\\P`;break;default:t.substr(0,2)===`00`?o+=`\\x`+t.substr(2):o+=n.substr(e,6)}e+=5,s=e+1}break;case`n`:if(r||n[e+2]===`"`||n.length<i)e+=1;else{for(o+=n.slice(s,e)+`

`;n[e+2]===`\\`&&n[e+3]===`n`&&n[e+4]!==`"`;)o+=`
`,e+=2;o+=a,n[e+2]===` `&&(o+=`\\`),e+=1,s=e+1}break;default:e+=1}return o=s?o+n.slice(s):n,r?o:fn(o,a,dn,mn(t,!1))}function vn(e,t){if(t.options.singleQuote===!1||t.implicitKey&&e.includes(`
`)||/[ \t]\n|\n[ \t]/.test(e))return _n(e,t);let n=t.indent||(hn(e)?`  `:``),r=`'`+e.replace(/'/g,`''`).replace(/\n+/g,`$&
${n}`)+`'`;return t.implicitKey?r:fn(r,n,ln,mn(t,!1))}function yn(e,t){let{singleQuote:n}=t.options,r;if(n===!1)r=_n;else{let t=e.includes(`"`),i=e.includes(`'`);r=t&&!i?vn:i&&!t?_n:n?vn:_n}return r(e,t)}var bn;try{bn=/* @__PURE__ */ RegExp(`(^|(?<!
))
+(?!
|$)`,`g`)}catch{bn=/\n+(?!\n|$)/g}function xn({comment:e,type:t,value:n},r,i,a){let{blockQuote:o,commentString:s,lineWidth:c}=r.options;if(!o||/\n[\t ]+$/.test(n))return yn(n,r);let l=r.indent||(r.forceBlockIndent||hn(n)?`  `:``),u=o===`literal`?!0:o===`folded`||t===P.BLOCK_FOLDED?!1:t===P.BLOCK_LITERAL||!gn(n,c,l.length);if(!n)return u?`|
`:`>
`;let d,f;for(f=n.length;f>0;--f){let e=n[f-1];if(e!==`
`&&e!==`	`&&e!==` `)break}let p=n.substring(f),m=p.indexOf(`
`);m===-1?d=`-`:n===p||m!==p.length-1?(d=`+`,a&&a()):d=``,p&&=(n=n.slice(0,-p.length),p[p.length-1]===`
`&&(p=p.slice(0,-1)),p.replace(bn,`$&${l}`));let h=!1,g,_=-1;for(g=0;g<n.length;++g){let e=n[g];if(e===` `)h=!0;else if(e===`
`)_=g;else break}let v=n.substring(0,_<g?_+1:g);v&&=(n=n.substring(v.length),v.replace(/\n+/g,`$&${l}`));let y=(h?l?`2`:`1`:``)+d;if(e&&(y+=` `+s(e.replace(/ ?[\r\n]+/g,` `)),i&&i()),!u){let e=n.replace(/\n+/g,`
$&`).replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g,`$1$2`).replace(/\n+/g,`$&${l}`),i=!1,a=mn(r,!0);o!==`folded`&&t!==P.BLOCK_FOLDED&&(a.onOverflow=()=>{i=!0});let s=fn(`${v}${e}${p}`,l,un,a);if(!i)return`>${y}
${l}${s}`}return n=n.replace(/\n+/g,`$&${l}`),`|${y}
${l}${v}${n}${p}`}function Sn(e,t,n,r){let{type:i,value:a}=e,{actualString:o,implicitKey:s,indent:c,indentStep:l,inFlow:u}=t;if(s&&a.includes(`
`)||u&&/[[\]{},]/.test(a))return yn(a,t);if(/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(a))return s||u||!a.includes(`
`)?yn(a,t):xn(e,t,n,r);if(!s&&!u&&i!==P.PLAIN&&a.includes(`
`))return xn(e,t,n,r);if(hn(a)){if(c===``)return t.forceBlockIndent=!0,xn(e,t,n,r);if(s&&c===l)return yn(a,t)}let d=a.replace(/\n+/g,`$&
${c}`);if(o){let e=e=>e.default&&e.tag!==`tag:yaml.org,2002:str`&&e.test?.test(d),{compat:n,tags:r}=t.doc.schema;if(r.some(e)||n?.some(e))return yn(a,t)}return s?d:fn(d,c,ln,mn(t,!1))}function Cn(e,t,n,r){let{implicitKey:i,inFlow:a}=t,o=typeof e.value==`string`?e:Object.assign({},e,{value:String(e.value)}),{type:s}=e;s!==P.QUOTE_DOUBLE&&/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(o.value)&&(s=P.QUOTE_DOUBLE);let c=e=>{switch(e){case P.BLOCK_FOLDED:case P.BLOCK_LITERAL:return i||a?yn(o.value,t):xn(o,t,n,r);case P.QUOTE_DOUBLE:return _n(o.value,t);case P.QUOTE_SINGLE:return vn(o.value,t);case P.PLAIN:return Sn(o,t,n,r);default:return null}},l=c(s);if(l===null){let{defaultKeyType:e,defaultStringType:n}=t.options,r=i&&e||n;if(l=c(r),l===null)throw Error(`Unsupported default string type ${r}`)}return l}function wn(e,t){let n=Object.assign({blockQuote:!0,commentString:on,defaultKeyType:null,defaultStringType:`PLAIN`,directives:null,doubleQuotedAsJSON:!1,doubleQuotedMinMultiLineLength:40,falseStr:`false`,flowCollectionPadding:!0,indentSeq:!0,lineWidth:80,minContentWidth:20,nullStr:`null`,simpleKeys:!1,singleQuote:null,trailingComma:!1,trueStr:`true`,verifyAliasOrder:!0},e.schema.toStringOptions,t),r;switch(n.collectionStyle){case`block`:r=!1;break;case`flow`:r=!0;break;default:r=null}return{anchors:/* @__PURE__ */ new Set,doc:e,flowCollectionPadding:n.flowCollectionPadding?` `:``,indent:``,indentStep:typeof n.indent==`number`?` `.repeat(n.indent):`  `,inFlow:r,options:n}}function Tn(e,t){if(t.tag){let n=e.filter(e=>e.tag===t.tag);if(n.length>0)return n.find(e=>e.format===t.format)??n[0]}let n,r;if(j(t)){r=t.value;let i=e.filter(e=>e.identify?.(r));if(i.length>1){let e=i.filter(e=>e.test);e.length>0&&(i=e)}n=i.find(e=>e.format===t.format)??i.find(e=>!e.format)}else r=t,n=e.find(e=>e.nodeClass&&r instanceof e.nodeClass);if(!n){let e=r?.constructor?.name??(r===null?`null`:typeof r);throw Error(`Tag not resolved for ${e} value`)}return n}function En(e,t,{anchors:n,doc:r}){if(!r.directives)return``;let i=[],a=(j(e)||M(e))&&e.anchor;a&&Ut(a)&&(n.add(a),i.push(`&${a}`));let o=e.tag??(t.default?null:t.tag);return o&&i.push(r.directives.tagString(o)),i.join(` `)}function Dn(e,t,n,r){if(A(e))return e.toString(t,n,r);if(Dt(e)){if(t.doc.directives)return e.toString(t);if(t.resolvedAliases?.has(e))throw TypeError(`Cannot stringify circular structure without alias nodes`);t.resolvedAliases?t.resolvedAliases.add(e):t.resolvedAliases=/* @__PURE__ */ new Set([e]),e=e.resolve(t.doc)}let i,a=N(e)?e:t.doc.createNode(e,{onTagObj:e=>i=e});i??=Tn(t.doc.schema.tags,a);let o=En(a,i,t);o.length>0&&(t.indentAtStart=(t.indentAtStart??0)+o.length+1);let s=typeof i.stringify==`function`?i.stringify(a,t,n,r):j(a)?Cn(a,t,n,r):a.toString(t,n,r);return o?j(a)||s[0]===`{`||s[0]===`[`?`${o} ${s}`:`${o}
${t.indent}${s}`:s}function On({key:e,value:t},n,r,i){let{allNullValues:a,doc:o,indent:s,indentStep:c,options:{commentString:l,indentSeq:u,simpleKeys:d}}=n,f=N(e)&&e.comment||null;if(d){if(f)throw Error(`With simple keys, key nodes cannot have comments`);if(M(e)||!N(e)&&typeof e==`object`)throw Error(`With simple keys, collection cannot be used as a key value`)}let p=!d&&(!e||f&&t==null&&!n.inFlow||M(e)||(j(e)?e.type===P.BLOCK_FOLDED||e.type===P.BLOCK_LITERAL:typeof e==`object`));n=Object.assign({},n,{allNullValues:!1,implicitKey:!p&&(d||!a),indent:s+c});let m=!1,h=!1,g=Dn(e,n,()=>m=!0,()=>h=!0);if(!p&&!n.inFlow&&g.length>1024){if(d)throw Error(`With simple keys, single line scalar must not span more than 1024 characters`);p=!0}if(n.inFlow){if(a||t==null)return m&&r&&r(),g===``?`?`:p?`? ${g}`:g}else if(a&&!d||t==null&&p)return g=`? ${g}`,f&&!m?g+=cn(g,n.indent,l(f)):h&&i&&i(),g;m&&(f=null),p?(f&&(g+=cn(g,n.indent,l(f))),g=`? ${g}
${s}:`):(g=`${g}:`,f&&(g+=cn(g,n.indent,l(f))));let _,v,y;N(t)?(_=!!t.spaceBefore,v=t.commentBefore,y=t.comment):(_=!1,v=null,y=null,t&&typeof t==`object`&&(t=o.createNode(t))),n.implicitKey=!1,!p&&!f&&j(t)&&(n.indentAtStart=g.length+1),h=!1,!u&&c.length>=2&&!n.inFlow&&!p&&At(t)&&!t.flow&&!t.tag&&!t.anchor&&(n.indent=n.indent.substring(2));let b=!1,x=Dn(t,n,()=>b=!0,()=>h=!0),S=` `;if(f||_||v){if(S=_?`
`:``,v){let e=l(v);S+=`
${sn(e,n.indent)}`}x===``&&!n.inFlow?S===`
`&&y&&(S=`

`):S+=`
${n.indent}`}else if(!p&&M(t)){let e=x[0],r=x.indexOf(`
`),i=r!==-1,a=n.inFlow??t.flow??t.items.length===0;if(i||!a){let t=!1;if(i&&(e===`&`||e===`!`)){let n=x.indexOf(` `);e===`&`&&n!==-1&&n<r&&x[n+1]===`!`&&(n=x.indexOf(` `,n+1)),(n===-1||r<n)&&(t=!0)}t||(S=`
${n.indent}`)}}else(x===``||x[0]===`
`)&&(S=``);return g+=S+x,n.inFlow?b&&r&&r():y&&!b?g+=cn(g,n.indent,l(y)):h&&i&&i(),g}function kn(e,t){(e===`debug`||e===`warn`)&&console.warn(t)}var An=`<<`,jn={identify:e=>e===An||typeof e==`symbol`&&e.description===An,default:`key`,tag:`tag:yaml.org,2002:merge`,test:/^<<$/,resolve:()=>Object.assign(new P(Symbol(An)),{addToJSMap:Nn}),stringify:()=>An},Mn=(e,t)=>(jn.identify(t)||j(t)&&(!t.type||t.type===P.PLAIN)&&jn.identify(t.value))&&e?.doc.schema.tags.some(e=>e.tag===jn.tag&&e.default);function Nn(e,t,n){let r=Fn(e,n);if(At(r))for(let n of r.items)Pn(e,t,n);else if(Array.isArray(r))for(let n of r)Pn(e,t,n);else Pn(e,t,r)}function Pn(e,t,n){let r=Fn(e,n);if(!kt(r))throw Error(`Merge sources must be maps or map aliases`);let i=r.toJSON(null,e,Map);for(let[e,n]of i)t instanceof Map?t.has(e)||t.set(e,n):t instanceof Set?t.add(e):Object.prototype.hasOwnProperty.call(t,e)||Object.defineProperty(t,e,{value:n,writable:!0,enumerable:!0,configurable:!0});return t}function Fn(e,t){return e&&Dt(t)?t.resolve(e.doc,e):t}function In(e,t,{key:n,value:r}){if(N(n)&&n.addToJSMap)n.addToJSMap(e,t,r);else if(Mn(e,n))Nn(e,t,r);else{let i=Jt(n,``,e);if(t instanceof Map)t.set(i,Jt(r,i,e));else if(t instanceof Set)t.add(i);else{let a=Ln(n,i,e),o=Jt(r,a,e);a in t?Object.defineProperty(t,a,{value:o,writable:!0,enumerable:!0,configurable:!0}):t[a]=o}}return t}function Ln(e,t,n){if(t===null)return``;if(typeof t!=`object`)return String(t);if(N(e)&&n?.doc){let t=wn(n.doc,{});t.anchors=/* @__PURE__ */ new Set;for(let e of n.anchors.keys())t.anchors.add(e.anchor);t.inFlow=!0,t.inStringifyKey=!0;let r=e.toString(t);if(!n.mapKeyWarned){let e=JSON.stringify(r);e.length>40&&(e=e.substring(0,36)+`..."`),kn(n.doc.options.logLevel,`Keys with collection values will be stringified due to JS Object restrictions: ${e}. Set mapAsMap: true to use object keys.`),n.mapKeyWarned=!0}return r}return JSON.stringify(t)}function Rn(e,t,n){return new zn(tn(e,void 0,n),tn(t,void 0,n))}var zn=class e{constructor(e,t=null){Object.defineProperty(this,Et,{value:Ct}),this.key=e,this.value=t}clone(t){let{key:n,value:r}=this;return N(n)&&(n=n.clone(t)),N(r)&&(r=r.clone(t)),new e(n,r)}toJSON(e,t){return In(t,t?.mapAsMap?/* @__PURE__ */ new Map:{},this)}toString(e,t,n){return e?.doc?On(this,e,t,n):JSON.stringify(this)}};function Bn(e,t,n){return(t.inFlow??e.flow?Hn:Vn)(e,t,n)}function Vn({comment:e,items:t},n,{blockItemPrefix:r,flowChars:i,itemIndent:a,onChompKeep:o,onComment:s}){let{indent:c,options:{commentString:l}}=n,u=Object.assign({},n,{indent:a,type:null}),d=!1,f=[];for(let e=0;e<t.length;++e){let i=t[e],o=null;if(N(i))!d&&i.spaceBefore&&f.push(``),Un(n,f,i.commentBefore,d),i.comment&&(o=i.comment);else if(A(i)){let e=N(i.key)?i.key:null;e&&(!d&&e.spaceBefore&&f.push(``),Un(n,f,e.commentBefore,d))}d=!1;let s=Dn(i,u,()=>o=null,()=>d=!0);o&&(s+=cn(s,a,l(o))),d&&o&&(d=!1),f.push(r+s)}let p;if(f.length===0)p=i.start+i.end;else{p=f[0];for(let e=1;e<f.length;++e){let t=f[e];p+=t?`
${c}${t}`:`
`}}return e?(p+=`
`+sn(l(e),c),s&&s()):d&&o&&o(),p}function Hn({items:e},t,{flowChars:n,itemIndent:r}){let{indent:i,indentStep:a,flowCollectionPadding:o,options:{commentString:s}}=t;r+=a;let c=Object.assign({},t,{indent:r,inFlow:!0,type:null}),l=!1,u=0,d=[];for(let n=0;n<e.length;++n){let i=e[n],a=null;if(N(i))i.spaceBefore&&d.push(``),Un(t,d,i.commentBefore,!1),i.comment&&(a=i.comment);else if(A(i)){let e=N(i.key)?i.key:null;e&&(e.spaceBefore&&d.push(``),Un(t,d,e.commentBefore,!1),e.comment&&(l=!0));let n=N(i.value)?i.value:null;n?(n.comment&&(a=n.comment),n.commentBefore&&(l=!0)):i.value==null&&e?.comment&&(a=e.comment)}a&&(l=!0);let o=Dn(i,c,()=>a=null);l||=d.length>u||o.includes(`
`),n<e.length-1?o+=`,`:t.options.trailingComma&&(t.options.lineWidth>0&&(l||=d.reduce((e,t)=>e+t.length+2,2)+(o.length+2)>t.options.lineWidth),l&&(o+=`,`)),a&&(o+=cn(o,r,s(a))),d.push(o),u=d.length}let{start:f,end:p}=n;if(d.length===0)return f+p;if(!l){let e=d.reduce((e,t)=>e+t.length+2,2);l=t.options.lineWidth>0&&e>t.options.lineWidth}if(l){let e=f;for(let t of d)e+=t?`
${a}${i}${t}`:`
`;return`${e}
${i}${p}`}return`${f}${o}${d.join(` `)}${o}${p}`}function Un({indent:e,options:{commentString:t}},n,r,i){if(r&&i&&(r=r.replace(/^\n+/,``)),r){let i=sn(t(r),e);n.push(i.trimStart())}}function Wn(e,t){let n=j(t)?t.value:t;for(let r of e)if(A(r)&&(r.key===t||r.key===n||j(r.key)&&r.key.value===n))return r}var Gn=class extends an{static get tagName(){return`tag:yaml.org,2002:map`}constructor(e){super(St,e),this.items=[]}static from(e,t,n){let{keepUndefined:r,replacer:i}=n,a=new this(e),o=(e,o)=>{if(typeof i==`function`)o=i.call(t,e,o);else if(Array.isArray(i)&&!i.includes(e))return;(o!==void 0||r)&&a.items.push(Rn(e,o,n))};if(t instanceof Map)for(let[e,n]of t)o(e,n);else if(t&&typeof t==`object`)for(let e of Object.keys(t))o(e,t[e]);return typeof e.sortMapEntries==`function`&&a.items.sort(e.sortMapEntries),a}add(e,t){let n;n=A(e)?e:!e||typeof e!=`object`||!(`key`in e)?new zn(e,e?.value):new zn(e.key,e.value);let r=Wn(this.items,n.key),i=this.schema?.sortMapEntries;if(r){if(!t)throw Error(`Key ${n.key} already set`);j(r.value)&&Qt(n.value)?r.value.value=n.value:r.value=n.value}else if(i){let e=this.items.findIndex(e=>i(n,e)<0);e===-1?this.items.push(n):this.items.splice(e,0,n)}else this.items.push(n)}delete(e){let t=Wn(this.items,e);return t?this.items.splice(this.items.indexOf(t),1).length>0:!1}get(e,t){let n=Wn(this.items,e)?.value;return(!t&&j(n)?n.value:n)??void 0}has(e){return!!Wn(this.items,e)}set(e,t){this.add(new zn(e,t),!0)}toJSON(e,t,n){let r=n?new n:t?.mapAsMap?/* @__PURE__ */ new Map:{};t?.onCreate&&t.onCreate(r);for(let e of this.items)In(t,r,e);return r}toString(e,t,n){if(!e)return JSON.stringify(this);for(let e of this.items)if(!A(e))throw Error(`Map items must all be pairs; found ${JSON.stringify(e)} instead`);return!e.allNullValues&&this.hasAllNullValues(!1)&&(e=Object.assign({},e,{allNullValues:!0})),Bn(this,e,{blockItemPrefix:``,flowChars:{start:`{`,end:`}`},itemIndent:e.indent||``,onChompKeep:n,onComment:t})}},Kn={collection:`map`,default:!0,nodeClass:Gn,tag:`tag:yaml.org,2002:map`,resolve(e,t){return kt(e)||t(`Expected a mapping for this tag`),e},createNode:(e,t,n)=>Gn.from(e,t,n)},qn=class extends an{static get tagName(){return`tag:yaml.org,2002:seq`}constructor(e){super(Tt,e),this.items=[]}add(e){this.items.push(e)}delete(e){let t=Jn(e);return typeof t==`number`&&this.items.splice(t,1).length>0}get(e,t){let n=Jn(e);if(typeof n!=`number`)return;let r=this.items[n];return!t&&j(r)?r.value:r}has(e){let t=Jn(e);return typeof t==`number`&&t<this.items.length}set(e,t){let n=Jn(e);if(typeof n!=`number`)throw Error(`Expected a valid index, not ${e}.`);let r=this.items[n];j(r)&&Qt(t)?r.value=t:this.items[n]=t}toJSON(e,t){let n=[];t?.onCreate&&t.onCreate(n);let r=0;for(let e of this.items)n.push(Jt(e,String(r++),t));return n}toString(e,t,n){return e?Bn(this,e,{blockItemPrefix:`- `,flowChars:{start:`[`,end:`]`},itemIndent:(e.indent||``)+`  `,onChompKeep:n,onComment:t}):JSON.stringify(this)}static from(e,t,n){let{replacer:r}=n,i=new this(e);if(t&&Symbol.iterator in Object(t)){let e=0;for(let a of t){if(typeof r==`function`){let n=t instanceof Set?a:String(e++);a=r.call(t,n,a)}i.items.push(tn(a,void 0,n))}}return i}};function Jn(e){let t=j(e)?e.value:e;return t&&typeof t==`string`&&(t=Number(t)),typeof t==`number`&&Number.isInteger(t)&&t>=0?t:null}var Yn={collection:`seq`,default:!0,nodeClass:qn,tag:`tag:yaml.org,2002:seq`,resolve(e,t){return At(e)||t(`Expected a sequence for this tag`),e},createNode:(e,t,n)=>qn.from(e,t,n)},Xn={identify:e=>typeof e==`string`,default:!0,tag:`tag:yaml.org,2002:str`,resolve:e=>e,stringify(e,t,n,r){return t=Object.assign({actualString:!0},t),Cn(e,t,n,r)}},Zn={identify:e=>e==null,createNode:()=>new P(null),default:!0,tag:`tag:yaml.org,2002:null`,test:/^(?:~|[Nn]ull|NULL)?$/,resolve:()=>new P(null),stringify:({source:e},t)=>typeof e==`string`&&Zn.test.test(e)?e:t.options.nullStr},Qn={identify:e=>typeof e==`boolean`,default:!0,tag:`tag:yaml.org,2002:bool`,test:/^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,resolve:e=>new P(e[0]===`t`||e[0]===`T`),stringify({source:e,value:t},n){return e&&Qn.test.test(e)&&t===(e[0]===`t`||e[0]===`T`)?e:t?n.options.trueStr:n.options.falseStr}};function $n({format:e,minFractionDigits:t,tag:n,value:r}){if(typeof r==`bigint`)return String(r);let i=typeof r==`number`?r:Number(r);if(!isFinite(i))return isNaN(i)?`.nan`:i<0?`-.inf`:`.inf`;let a=Object.is(r,-0)?`-0`:JSON.stringify(r);if(!e&&t&&(!n||n===`tag:yaml.org,2002:float`)&&/^-?\d/.test(a)&&!a.includes(`e`)){let e=a.indexOf(`.`);e<0&&(e=a.length,a+=`.`);let n=t-(a.length-e-1);for(;n-->0;)a+=`0`}return a}var er={identify:e=>typeof e==`number`,default:!0,tag:`tag:yaml.org,2002:float`,test:/^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,resolve:e=>e.slice(-3).toLowerCase()===`nan`?NaN:e[0]===`-`?-1/0:1/0,stringify:$n},tr={identify:e=>typeof e==`number`,default:!0,tag:`tag:yaml.org,2002:float`,format:`EXP`,test:/^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,resolve:e=>parseFloat(e),stringify(e){let t=Number(e.value);return isFinite(t)?t.toExponential():$n(e)}},nr={identify:e=>typeof e==`number`,default:!0,tag:`tag:yaml.org,2002:float`,test:/^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,resolve(e){let t=new P(parseFloat(e)),n=e.indexOf(`.`);return n!==-1&&e[e.length-1]===`0`&&(t.minFractionDigits=e.length-n-1),t},stringify:$n},rr=e=>typeof e==`bigint`||Number.isInteger(e),ir=(e,t,n,{intAsBigInt:r})=>r?BigInt(e):parseInt(e.substring(t),n);function ar(e,t,n){let{value:r}=e;return rr(r)&&r>=0?n+r.toString(t):$n(e)}var or={identify:e=>rr(e)&&e>=0,default:!0,tag:`tag:yaml.org,2002:int`,format:`OCT`,test:/^0o[0-7]+$/,resolve:(e,t,n)=>ir(e,2,8,n),stringify:e=>ar(e,8,`0o`)},sr={identify:rr,default:!0,tag:`tag:yaml.org,2002:int`,test:/^[-+]?[0-9]+$/,resolve:(e,t,n)=>ir(e,0,10,n),stringify:$n},cr={identify:e=>rr(e)&&e>=0,default:!0,tag:`tag:yaml.org,2002:int`,format:`HEX`,test:/^0x[0-9a-fA-F]+$/,resolve:(e,t,n)=>ir(e,2,16,n),stringify:e=>ar(e,16,`0x`)},lr=[Kn,Yn,Xn,Zn,Qn,or,sr,cr,er,tr,nr];function ur(e){return typeof e==`bigint`||Number.isInteger(e)}var dr=({value:e})=>JSON.stringify(e),fr=[{identify:e=>typeof e==`string`,default:!0,tag:`tag:yaml.org,2002:str`,resolve:e=>e,stringify:dr},{identify:e=>e==null,createNode:()=>new P(null),default:!0,tag:`tag:yaml.org,2002:null`,test:/^null$/,resolve:()=>null,stringify:dr},{identify:e=>typeof e==`boolean`,default:!0,tag:`tag:yaml.org,2002:bool`,test:/^true$|^false$/,resolve:e=>e===`true`,stringify:dr},{identify:ur,default:!0,tag:`tag:yaml.org,2002:int`,test:/^-?(?:0|[1-9][0-9]*)$/,resolve:(e,t,{intAsBigInt:n})=>n?BigInt(e):parseInt(e,10),stringify:({value:e})=>ur(e)?e.toString():JSON.stringify(e)},{identify:e=>typeof e==`number`,default:!0,tag:`tag:yaml.org,2002:float`,test:/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,resolve:e=>parseFloat(e),stringify:dr}],pr=[Kn,Yn].concat(fr,{default:!0,tag:``,test:/^/,resolve(e,t){return t(`Unresolved plain scalar ${JSON.stringify(e)}`),e}}),mr={identify:e=>e instanceof Uint8Array,default:!1,tag:`tag:yaml.org,2002:binary`,resolve(e,t){if(typeof atob==`function`){let t=atob(e.replace(/[\n\r]/g,``)),n=new Uint8Array(t.length);for(let e=0;e<t.length;++e)n[e]=t.charCodeAt(e);return n}return t(`This environment does not support reading binary tags; either Buffer or atob is required`),e},stringify({comment:e,type:t,value:n},r,i,a){if(!n)return``;let o=n,s;if(typeof btoa==`function`){let e=``;for(let t=0;t<o.length;++t)e+=String.fromCharCode(o[t]);s=btoa(e)}else throw Error(`This environment does not support writing binary tags; either Buffer or btoa is required`);if(t??=P.BLOCK_LITERAL,t!==P.QUOTE_DOUBLE){let e=Math.max(r.options.lineWidth-r.indent.length,r.options.minContentWidth),n=Math.ceil(s.length/e),i=Array(n);for(let t=0,r=0;t<n;++t,r+=e)i[t]=s.substr(r,e);s=i.join(t===P.BLOCK_LITERAL?`
`:` `)}return Cn({comment:e,type:t,value:s},r,i,a)}};function hr(e,t){if(At(e))for(let n=0;n<e.items.length;++n){let r=e.items[n];if(!A(r)){if(kt(r)){r.items.length>1&&t(`Each pair must have its own sequence indicator`);let e=r.items[0]||new zn(new P(null));if(r.commentBefore&&(e.key.commentBefore=e.key.commentBefore?`${r.commentBefore}
${e.key.commentBefore}`:r.commentBefore),r.comment){let t=e.value??e.key;t.comment=t.comment?`${r.comment}
${t.comment}`:r.comment}r=e}e.items[n]=A(r)?r:new zn(r)}}else t(`Expected a sequence for this tag`);return e}function gr(e,t,n){let{replacer:r}=n,i=new qn(e);i.tag=`tag:yaml.org,2002:pairs`;let a=0;if(t&&Symbol.iterator in Object(t))for(let e of t){typeof r==`function`&&(e=r.call(t,String(a++),e));let o,s;if(Array.isArray(e)){if(e.length===2)o=e[0],s=e[1];else throw TypeError(`Expected [key, value] tuple: ${e}`)}else if(e&&e instanceof Object){let t=Object.keys(e);if(t.length===1)o=t[0],s=e[o];else throw TypeError(`Expected tuple with one key, not ${t.length} keys`)}else o=e;i.items.push(Rn(o,s,n))}return i}var _r={collection:`seq`,default:!1,tag:`tag:yaml.org,2002:pairs`,resolve:hr,createNode:gr},vr=class e extends qn{constructor(){super(),this.add=Gn.prototype.add.bind(this),this.delete=Gn.prototype.delete.bind(this),this.get=Gn.prototype.get.bind(this),this.has=Gn.prototype.has.bind(this),this.set=Gn.prototype.set.bind(this),this.tag=e.tag}toJSON(e,t){if(!t)return super.toJSON(e);let n=/* @__PURE__ */ new Map;t?.onCreate&&t.onCreate(n);for(let e of this.items){let r,i;if(A(e)?(r=Jt(e.key,``,t),i=Jt(e.value,r,t)):r=Jt(e,``,t),n.has(r))throw Error(`Ordered maps must not include duplicate keys`);n.set(r,i)}return n}static from(e,t,n){let r=gr(e,t,n),i=new this;return i.items=r.items,i}};vr.tag=`tag:yaml.org,2002:omap`;var yr={collection:`seq`,identify:e=>e instanceof Map,nodeClass:vr,default:!1,tag:`tag:yaml.org,2002:omap`,resolve(e,t){let n=hr(e,t),r=[];for(let{key:e}of n.items)j(e)&&(r.includes(e.value)?t(`Ordered maps must not include duplicate keys: ${e.value}`):r.push(e.value));return Object.assign(new vr,n)},createNode:(e,t,n)=>vr.from(e,t,n)};function br({value:e,source:t},n){return t&&(e?xr:Sr).test.test(t)?t:e?n.options.trueStr:n.options.falseStr}var xr={identify:e=>e===!0,default:!0,tag:`tag:yaml.org,2002:bool`,test:/^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,resolve:()=>new P(!0),stringify:br},Sr={identify:e=>e===!1,default:!0,tag:`tag:yaml.org,2002:bool`,test:/^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,resolve:()=>new P(!1),stringify:br},Cr={identify:e=>typeof e==`number`,default:!0,tag:`tag:yaml.org,2002:float`,test:/^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,resolve:e=>e.slice(-3).toLowerCase()===`nan`?NaN:e[0]===`-`?-1/0:1/0,stringify:$n},wr={identify:e=>typeof e==`number`,default:!0,tag:`tag:yaml.org,2002:float`,format:`EXP`,test:/^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,resolve:e=>parseFloat(e.replace(/_/g,``)),stringify(e){let t=Number(e.value);return isFinite(t)?t.toExponential():$n(e)}},Tr={identify:e=>typeof e==`number`,default:!0,tag:`tag:yaml.org,2002:float`,test:/^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,resolve(e){let t=new P(parseFloat(e.replace(/_/g,``))),n=e.indexOf(`.`);if(n!==-1){let r=e.substring(n+1).replace(/_/g,``);r[r.length-1]===`0`&&(t.minFractionDigits=r.length)}return t},stringify:$n},Er=e=>typeof e==`bigint`||Number.isInteger(e);function Dr(e,t,n,{intAsBigInt:r}){let i=e[0];if((i===`-`||i===`+`)&&(t+=1),e=e.substring(t).replace(/_/g,``),r){switch(n){case 2:e=`0b${e}`;break;case 8:e=`0o${e}`;break;case 16:e=`0x${e}`}let t=BigInt(e);return i===`-`?BigInt(-1)*t:t}let a=parseInt(e,n);return i===`-`?-1*a:a}function Or(e,t,n){let{value:r}=e;if(Er(r)){let e=r.toString(t);return r<0?`-`+n+e.substr(1):n+e}return $n(e)}var kr={identify:Er,default:!0,tag:`tag:yaml.org,2002:int`,format:`BIN`,test:/^[-+]?0b[0-1_]+$/,resolve:(e,t,n)=>Dr(e,2,2,n),stringify:e=>Or(e,2,`0b`)},Ar={identify:Er,default:!0,tag:`tag:yaml.org,2002:int`,format:`OCT`,test:/^[-+]?0[0-7_]+$/,resolve:(e,t,n)=>Dr(e,1,8,n),stringify:e=>Or(e,8,`0`)},jr={identify:Er,default:!0,tag:`tag:yaml.org,2002:int`,test:/^[-+]?[0-9][0-9_]*$/,resolve:(e,t,n)=>Dr(e,0,10,n),stringify:$n},Mr={identify:Er,default:!0,tag:`tag:yaml.org,2002:int`,format:`HEX`,test:/^[-+]?0x[0-9a-fA-F_]+$/,resolve:(e,t,n)=>Dr(e,2,16,n),stringify:e=>Or(e,16,`0x`)},Nr=class e extends Gn{constructor(t){super(t),this.tag=e.tag}add(e){let t;t=A(e)?e:e&&typeof e==`object`&&`key`in e&&`value`in e&&e.value===null?new zn(e.key,null):new zn(e,null),Wn(this.items,t.key)||this.items.push(t)}get(e,t){let n=Wn(this.items,e);return!t&&A(n)?j(n.key)?n.key.value:n.key:n}set(e,t){if(typeof t!=`boolean`)throw Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof t}`);let n=Wn(this.items,e);n&&!t?this.items.splice(this.items.indexOf(n),1):!n&&t&&this.items.push(new zn(e))}toJSON(e,t){return super.toJSON(e,t,Set)}toString(e,t,n){if(!e)return JSON.stringify(this);if(this.hasAllNullValues(!0))return super.toString(Object.assign({},e,{allNullValues:!0}),t,n);throw Error(`Set items must all have null values`)}static from(e,t,n){let{replacer:r}=n,i=new this(e);if(t&&Symbol.iterator in Object(t))for(let e of t)typeof r==`function`&&(e=r.call(t,e,e)),i.items.push(Rn(e,null,n));return i}};Nr.tag=`tag:yaml.org,2002:set`;var Pr={collection:`map`,identify:e=>e instanceof Set,nodeClass:Nr,default:!1,tag:`tag:yaml.org,2002:set`,createNode:(e,t,n)=>Nr.from(e,t,n),resolve(e,t){if(kt(e)){if(e.hasAllNullValues(!0))return Object.assign(new Nr,e);t(`Set items must all have null values`)}else t(`Expected a mapping for this tag`);return e}};function Fr(e,t){let n=e[0],r=n===`-`||n===`+`?e.substring(1):e,i=e=>t?BigInt(e):Number(e),a=r.replace(/_/g,``).split(`:`).reduce((e,t)=>e*i(60)+i(t),i(0));return n===`-`?i(-1)*a:a}function Ir(e){let{value:t}=e,n=e=>e;if(typeof t==`bigint`)n=e=>BigInt(e);else if(isNaN(t)||!isFinite(t))return $n(e);let r=``;t<0&&(r=`-`,t*=n(-1));let i=n(60),a=[t%i];return t<60?a.unshift(0):(t=(t-a[0])/i,a.unshift(t%i),t>=60&&(t=(t-a[0])/i,a.unshift(t))),r+a.map(e=>String(e).padStart(2,`0`)).join(`:`).replace(/000000\d*$/,``)}var Lr={identify:e=>typeof e==`bigint`||Number.isInteger(e),default:!0,tag:`tag:yaml.org,2002:int`,format:`TIME`,test:/^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,resolve:(e,t,{intAsBigInt:n})=>Fr(e,n),stringify:Ir},Rr={identify:e=>typeof e==`number`,default:!0,tag:`tag:yaml.org,2002:float`,format:`TIME`,test:/^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,resolve:e=>Fr(e,!1),stringify:Ir},zr={identify:e=>e instanceof Date,default:!0,tag:`tag:yaml.org,2002:timestamp`,test:RegExp(`^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$`),resolve(e){let t=e.match(zr.test);if(!t)throw Error(`!!timestamp expects a date, starting with yyyy-mm-dd`);let[,n,r,i,a,o,s]=t.map(Number),c=t[7]?Number((t[7]+`00`).substr(1,3)):0,l=Date.UTC(n,r-1,i,a||0,o||0,s||0,c),u=t[8];if(u&&u!==`Z`){let e=Fr(u,!1);Math.abs(e)<30&&(e*=60),l-=6e4*e}return new Date(l)},stringify:({value:e})=>e?.toISOString().replace(/(T00:00:00)?\.000Z$/,``)??``},Br=[Kn,Yn,Xn,Zn,xr,Sr,kr,Ar,jr,Mr,Cr,wr,Tr,mr,jn,yr,_r,Pr,Lr,Rr,zr],Vr=/* @__PURE__ */ new Map([[`core`,lr],[`failsafe`,[Kn,Yn,Xn]],[`json`,pr],[`yaml11`,Br],[`yaml-1.1`,Br]]),Hr={binary:mr,bool:Qn,float:nr,floatExp:tr,floatNaN:er,floatTime:Rr,int:sr,intHex:cr,intOct:or,intTime:Lr,map:Kn,merge:jn,null:Zn,omap:yr,pairs:_r,seq:Yn,set:Pr,timestamp:zr},Ur={"tag:yaml.org,2002:binary":mr,"tag:yaml.org,2002:merge":jn,"tag:yaml.org,2002:omap":yr,"tag:yaml.org,2002:pairs":_r,"tag:yaml.org,2002:set":Pr,"tag:yaml.org,2002:timestamp":zr};function Wr(e,t,n){let r=Vr.get(t);if(r&&!e)return n&&!r.includes(jn)?r.concat(jn):r.slice();let i=r;if(!i){if(Array.isArray(e))i=[];else{let e=Array.from(Vr.keys()).filter(e=>e!==`yaml11`).map(e=>JSON.stringify(e)).join(`, `);throw Error(`Unknown schema "${t}"; use one of ${e} or define customTags array`)}}if(Array.isArray(e))for(let t of e)i=i.concat(t);else typeof e==`function`&&(i=e(i.slice()));return n&&(i=i.concat(jn)),i.reduce((e,t)=>{let n=typeof t==`string`?Hr[t]:t;if(!n){let e=JSON.stringify(t),n=Object.keys(Hr).map(e=>JSON.stringify(e)).join(`, `);throw Error(`Unknown custom tag ${e}; use one of ${n}`)}return e.includes(n)||e.push(n),e},[])}var Gr=(e,t)=>e.key<t.key?-1:+(e.key>t.key),Kr=class e{constructor({compat:e,customTags:t,merge:n,resolveKnownTags:r,schema:i,sortMapEntries:a,toStringDefaults:o}){this.compat=Array.isArray(e)?Wr(e,`compat`):e?Wr(null,e):null,this.name=typeof i==`string`&&i||`core`,this.knownTags=r?Ur:{},this.tags=Wr(t,this.name,n),this.toStringOptions=o??null,Object.defineProperty(this,St,{value:Kn}),Object.defineProperty(this,wt,{value:Xn}),Object.defineProperty(this,Tt,{value:Yn}),this.sortMapEntries=typeof a==`function`?a:a===!0?Gr:null}clone(){let t=Object.create(e.prototype,Object.getOwnPropertyDescriptors(this));return t.tags=this.tags.slice(),t}};function qr(e,t){let n=[],r=t.directives===!0;if(t.directives!==!1&&e.directives){let t=e.directives.toString(e);t?(n.push(t),r=!0):e.directives.docStart&&(r=!0)}r&&n.push(`---`);let i=wn(e,t),{commentString:a}=i.options;if(e.commentBefore){n.length!==1&&n.unshift(``);let t=a(e.commentBefore);n.unshift(sn(t,``))}let o=!1,s=null;if(e.contents){if(N(e.contents)){if(e.contents.spaceBefore&&r&&n.push(``),e.contents.commentBefore){let t=a(e.contents.commentBefore);n.push(sn(t,``))}i.forceBlockIndent=!!e.comment,s=e.contents.comment}let t=s?void 0:()=>o=!0,c=Dn(e.contents,i,()=>s=null,t);s&&(c+=cn(c,``,a(s))),(c[0]===`|`||c[0]===`>`)&&n[n.length-1]===`---`?n[n.length-1]=`--- ${c}`:n.push(c)}else n.push(Dn(e.contents,i));if(e.directives?.docEnd){if(e.comment){let t=a(e.comment);t.includes(`
`)?(n.push(`...`),n.push(sn(t,``))):n.push(`... ${t}`)}else n.push(`...`)}else{let t=e.comment;t&&o&&(t=t.replace(/^\n+/,``)),t&&((!o||s)&&n[n.length-1]!==``&&n.push(``),n.push(sn(a(t),``)))}return n.join(`
`)+`
`}var Jr=class e{constructor(e,t,n){this.commentBefore=null,this.comment=null,this.errors=[],this.warnings=[],Object.defineProperty(this,Et,{value:xt});let r=null;typeof t==`function`||Array.isArray(t)?r=t:n===void 0&&t&&(n=t,t=void 0);let i=Object.assign({intAsBigInt:!1,keepSourceTokens:!1,logLevel:`warn`,prettyErrors:!0,strict:!0,stringKeys:!1,uniqueKeys:!0,version:`1.2`},n);this.options=i;let{version:a}=i;n?._directives?(this.directives=n._directives.atDocument(),this.directives.yaml.explicit&&(a=this.directives.yaml.version)):this.directives=new Ht({version:a}),this.setSchema(a,n),this.contents=e===void 0?null:this.createNode(e,r,n)}clone(){let t=Object.create(e.prototype,{[Et]:{value:xt}});return t.commentBefore=this.commentBefore,t.comment=this.comment,t.errors=this.errors.slice(),t.warnings=this.warnings.slice(),t.options=Object.assign({},this.options),this.directives&&(t.directives=this.directives.clone()),t.schema=this.schema.clone(),t.contents=N(this.contents)?this.contents.clone(t.schema):this.contents,this.range&&(t.range=this.range.slice()),t}add(e){Yr(this.contents)&&this.contents.add(e)}addIn(e,t){Yr(this.contents)&&this.contents.addIn(e,t)}createAlias(e,t){if(!e.anchor){let n=Wt(this);e.anchor=!t||n.has(t)?Gt(t||`a`,n):t}return new Xt(e.anchor)}createNode(e,t,n){let r;if(typeof t==`function`)e=t.call({"":e},``,e),r=t;else if(Array.isArray(t)){let e=t.filter(e=>typeof e==`number`||e instanceof String||e instanceof Number).map(String);e.length>0&&(t=t.concat(e)),r=t}else n===void 0&&t&&(n=t,t=void 0);let{aliasDuplicateObjects:i,anchorPrefix:a,flow:o,keepUndefined:s,onTagObj:c,tag:l}=n??{},{onAnchor:u,setAnchors:d,sourceObjects:f}=Kt(this,a||`a`),p={aliasDuplicateObjects:i??!0,keepUndefined:s??!1,onAnchor:u,onTagObj:c,replacer:r,schema:this.schema,sourceObjects:f},m=tn(e,l,p);return o&&M(m)&&(m.flow=!0),d(),m}createPair(e,t,n={}){return new zn(this.createNode(e,null,n),this.createNode(t,null,n))}delete(e){return Yr(this.contents)?this.contents.delete(e):!1}deleteIn(e){return rn(e)?this.contents!=null&&(this.contents=null,!0):Yr(this.contents)?this.contents.deleteIn(e):!1}get(e,t){return M(this.contents)?this.contents.get(e,t):void 0}getIn(e,t){return rn(e)?!t&&j(this.contents)?this.contents.value:this.contents:M(this.contents)?this.contents.getIn(e,t):void 0}has(e){return M(this.contents)?this.contents.has(e):!1}hasIn(e){return rn(e)?this.contents!==void 0:M(this.contents)?this.contents.hasIn(e):!1}set(e,t){this.contents==null?this.contents=nn(this.schema,[e],t):Yr(this.contents)&&this.contents.set(e,t)}setIn(e,t){rn(e)?this.contents=t:this.contents==null?this.contents=nn(this.schema,Array.from(e),t):Yr(this.contents)&&this.contents.setIn(e,t)}setSchema(e,t={}){typeof e==`number`&&(e=String(e));let n;switch(e){case`1.1`:this.directives?this.directives.yaml.version=`1.1`:this.directives=new Ht({version:`1.1`}),n={resolveKnownTags:!1,schema:`yaml-1.1`};break;case`1.2`:case`next`:this.directives?this.directives.yaml.version=e:this.directives=new Ht({version:e}),n={resolveKnownTags:!0,schema:`core`};break;case null:this.directives&&delete this.directives,n=null;break;default:{let t=JSON.stringify(e);throw Error(`Expected '1.1', '1.2' or null as first argument, but found: ${t}`)}}if(t.schema instanceof Object)this.schema=t.schema;else if(n)this.schema=new Kr(Object.assign(n,t));else throw Error(`With a null YAML version, the { schema: Schema } option is required`)}toJS({json:e,jsonArg:t,mapAsMap:n,maxAliasCount:r,onAnchor:i,reviver:a}={}){let o={anchors:/* @__PURE__ */ new Map,doc:this,keep:!e,mapAsMap:n===!0,mapKeyWarned:!1,maxAliasCount:typeof r==`number`?r:100},s=Jt(this.contents,t??``,o);if(typeof i==`function`)for(let{count:e,res:t}of o.anchors.values())i(t,e);return typeof a==`function`?qt(a,{"":s},``,s):s}toJSON(e,t){return this.toJS({json:!0,jsonArg:e,mapAsMap:!1,onAnchor:t})}toString(e={}){if(this.errors.length>0)throw Error(`Document with errors cannot be stringified`);if(`indent`in e&&(!Number.isInteger(e.indent)||Number(e.indent)<=0)){let t=JSON.stringify(e.indent);throw Error(`"indent" option must be a positive integer, not ${t}`)}return qr(this,e)}};function Yr(e){if(M(e))return!0;throw Error(`Expected a YAML collection as document contents`)}var Xr=class extends Error{constructor(e,t,n,r){super(),this.name=e,this.code=n,this.message=r,this.pos=t}},Zr=class extends Xr{constructor(e,t,n){super(`YAMLParseError`,e,t,n)}},Qr=class extends Xr{constructor(e,t,n){super(`YAMLWarning`,e,t,n)}},$r=(e,t)=>n=>{if(n.pos[0]===-1)return;n.linePos=n.pos.map(e=>t.linePos(e));let{line:r,col:i}=n.linePos[0];n.message+=` at line ${r}, column ${i}`;let a=i-1,o=e.substring(t.lineStarts[r-1],t.lineStarts[r]).replace(/[\n\r]+$/,``);if(a>=60&&o.length>80){let e=Math.min(a-39,o.length-79);o=`…`+o.substring(e),a-=e-1}if(o.length>80&&(o=o.substring(0,79)+`…`),r>1&&/^ *$/.test(o.substring(0,a))){let n=e.substring(t.lineStarts[r-2],t.lineStarts[r-1]);n.length>80&&(n=n.substring(0,79)+`…
`),o=n+o}if(/[^ ]/.test(o)){let e=1,t=n.linePos[1];t?.line===r&&t.col>i&&(e=Math.max(1,Math.min(t.col-i,80-a)));let s=` `.repeat(a)+`^`.repeat(e);n.message+=`:

${o}
${s}
`}};function ei(e,{flow:t,indicator:n,next:r,offset:i,onError:a,parentIndent:o,startOnNewline:s}){let c=!1,l=s,u=s,d=``,f=``,p=!1,m=!1,h=null,g=null,_=null,v=null,y=null,b=null,x=null;for(let i of e)switch(m&&=(i.type!==`space`&&i.type!==`newline`&&i.type!==`comma`&&a(i.offset,`MISSING_CHAR`,`Tags and anchors must be separated from the next token by white space`),!1),h&&=(l&&i.type!==`comment`&&i.type!==`newline`&&a(h,`TAB_AS_INDENT`,`Tabs are not allowed as indentation`),null),i.type){case`space`:!t&&(n!==`doc-start`||r?.type!==`flow-collection`)&&i.source.includes(`	`)&&(h=i),u=!0;break;case`comment`:{u||a(i,`MISSING_CHAR`,`Comments must be separated from other tokens by white space characters`);let e=i.source.substring(1)||` `;d?d+=f+e:d=e,f=``,l=!1;break}case`newline`:l?d?d+=i.source:(!b||n!==`seq-item-ind`)&&(c=!0):f+=i.source,l=!0,p=!0,(g||_)&&(v=i),u=!0;break;case`anchor`:g&&a(i,`MULTIPLE_ANCHORS`,`A node can have at most one anchor`),i.source.endsWith(`:`)&&a(i.offset+i.source.length-1,`BAD_ALIAS`,`Anchor ending in : is ambiguous`,!0),g=i,x??=i.offset,l=!1,u=!1,m=!0;break;case`tag`:_&&a(i,`MULTIPLE_TAGS`,`A node can have at most one tag`),_=i,x??=i.offset,l=!1,u=!1,m=!0;break;case n:(g||_)&&a(i,`BAD_PROP_ORDER`,`Anchors and tags must be after the ${i.source} indicator`),b&&a(i,`UNEXPECTED_TOKEN`,`Unexpected ${i.source} in ${t??`collection`}`),b=i,l=n===`seq-item-ind`||n===`explicit-key-ind`,u=!1;break;case`comma`:if(t){y&&a(i,`UNEXPECTED_TOKEN`,`Unexpected , in ${t}`),y=i,l=!1,u=!1;break}default:a(i,`UNEXPECTED_TOKEN`,`Unexpected ${i.type} token`),l=!1,u=!1}let S=e[e.length-1],C=S?S.offset+S.source.length:i;return m&&r&&r.type!==`space`&&r.type!==`newline`&&r.type!==`comma`&&(r.type!==`scalar`||r.source!==``)&&a(r.offset,`MISSING_CHAR`,`Tags and anchors must be separated from the next token by white space`),h&&(l&&h.indent<=o||r?.type===`block-map`||r?.type===`block-seq`)&&a(h,`TAB_AS_INDENT`,`Tabs are not allowed as indentation`),{comma:y,found:b,spaceBefore:c,comment:d,hasNewline:p,anchor:g,tag:_,newlineAfterProp:v,end:C,start:x??C}}function ti(e){if(!e)return null;switch(e.type){case`alias`:case`scalar`:case`double-quoted-scalar`:case`single-quoted-scalar`:if(e.source.includes(`
`))return!0;if(e.end){for(let t of e.end)if(t.type===`newline`)return!0}return!1;case`flow-collection`:for(let t of e.items){for(let e of t.start)if(e.type===`newline`)return!0;if(t.sep){for(let e of t.sep)if(e.type===`newline`)return!0}if(ti(t.key)||ti(t.value))return!0}return!1;default:return!0}}function ni(e,t,n){if(t?.type===`flow-collection`){let r=t.end[0];r.indent===e&&(r.source===`]`||r.source===`}`)&&ti(t)&&n(r,`BAD_INDENT`,`Flow end indicator should be more indented than parent`,!0)}}function ri(e,t,n){let{uniqueKeys:r}=e.options;if(r===!1)return!1;let i=typeof r==`function`?r:(e,t)=>e===t||j(e)&&j(t)&&e.value===t.value;return t.some(e=>i(e.key,n))}var ii=`All mapping items must start at the same column`;function ai({composeNode:e,composeEmptyNode:t},n,r,i,a){let o=new((a?.nodeClass)??Gn)(n.schema);n.atRoot&&=!1;let s=r.offset,c=null;for(let a of r.items){let{start:l,key:u,sep:d,value:f}=a,p=ei(l,{indicator:`explicit-key-ind`,next:u??d?.[0],offset:s,onError:i,parentIndent:r.indent,startOnNewline:!0}),m=!p.found;if(m){if(u&&(u.type===`block-seq`?i(s,`BLOCK_AS_IMPLICIT_KEY`,`A block sequence may not be used as an implicit map key`):`indent`in u&&u.indent!==r.indent&&i(s,`BAD_INDENT`,ii)),!p.anchor&&!p.tag&&!d){c=p.end,p.comment&&(o.comment?o.comment+=`
`+p.comment:o.comment=p.comment);continue}(p.newlineAfterProp||ti(u))&&i(u??l[l.length-1],`MULTILINE_IMPLICIT_KEY`,`Implicit keys need to be on a single line`)}else p.found?.indent!==r.indent&&i(s,`BAD_INDENT`,ii);n.atKey=!0;let h=p.end,g=u?e(n,u,p,i):t(n,h,l,null,p,i);n.schema.compat&&ni(r.indent,u,i),n.atKey=!1,ri(n,o.items,g)&&i(h,`DUPLICATE_KEY`,`Map keys must be unique`);let _=ei(d??[],{indicator:`map-value-ind`,next:f,offset:g.range[2],onError:i,parentIndent:r.indent,startOnNewline:!u||u.type===`block-scalar`});if(s=_.end,_.found){m&&(f?.type===`block-map`&&!_.hasNewline&&i(s,`BLOCK_AS_IMPLICIT_KEY`,`Nested mappings are not allowed in compact mappings`),n.options.strict&&p.start<_.found.offset-1024&&i(g.range,`KEY_OVER_1024_CHARS`,`The : indicator must be at most 1024 chars after the start of an implicit block mapping key`));let c=f?e(n,f,_,i):t(n,s,d,null,_,i);n.schema.compat&&ni(r.indent,f,i),s=c.range[2];let l=new zn(g,c);n.options.keepSourceTokens&&(l.srcToken=a),o.items.push(l)}else{m&&i(g.range,`MISSING_CHAR`,`Implicit map keys need to be followed by map values`),_.comment&&(g.comment?g.comment+=`
`+_.comment:g.comment=_.comment);let e=new zn(g);n.options.keepSourceTokens&&(e.srcToken=a),o.items.push(e)}}return c&&c<s&&i(c,`IMPOSSIBLE`,`Map comment with trailing content`),o.range=[r.offset,s,c??s],o}function oi({composeNode:e,composeEmptyNode:t},n,r,i,a){let o=new((a?.nodeClass)??qn)(n.schema);n.atRoot&&=!1,n.atKey&&=!1;let s=r.offset,c=null;for(let{start:a,value:l}of r.items){let u=ei(a,{indicator:`seq-item-ind`,next:l,offset:s,onError:i,parentIndent:r.indent,startOnNewline:!0});if(!u.found){if(u.anchor||u.tag||l)l?.type===`block-seq`?i(u.end,`BAD_INDENT`,`All sequence items must start at the same column`):i(s,`MISSING_CHAR`,`Sequence item without - indicator`);else{c=u.end,u.comment&&(o.comment=u.comment);continue}}let d=l?e(n,l,u,i):t(n,u.end,a,null,u,i);n.schema.compat&&ni(r.indent,l,i),s=d.range[2],o.items.push(d)}return o.range=[r.offset,s,c??s],o}function si(e,t,n,r){let i=``;if(e){let a=!1,o=``;for(let s of e){let{source:e,type:c}=s;switch(c){case`space`:a=!0;break;case`comment`:{n&&!a&&r(s,`MISSING_CHAR`,`Comments must be separated from other tokens by white space characters`);let t=e.substring(1)||` `;i?i+=o+t:i=t,o=``;break}case`newline`:i&&(o+=e),a=!0;break;default:r(s,`UNEXPECTED_TOKEN`,`Unexpected ${c} at node end`)}t+=e.length}}return{comment:i,offset:t}}var ci=`Block collections are not allowed within flow collections`,li=e=>e&&(e.type===`block-map`||e.type===`block-seq`);function ui({composeNode:e,composeEmptyNode:t},n,r,i,a){let o=r.start.source===`{`,s=o?`flow map`:`flow sequence`,c=new((a?.nodeClass)??(o?Gn:qn))(n.schema);c.flow=!0;let l=n.atRoot;l&&(n.atRoot=!1),n.atKey&&=!1;let u=r.offset+r.start.source.length;for(let a=0;a<r.items.length;++a){let l=r.items[a],{start:d,key:f,sep:p,value:m}=l,h=ei(d,{flow:s,indicator:`explicit-key-ind`,next:f??p?.[0],offset:u,onError:i,parentIndent:r.indent,startOnNewline:!1});if(!h.found){if(!h.anchor&&!h.tag&&!p&&!m){a===0&&h.comma?i(h.comma,`UNEXPECTED_TOKEN`,`Unexpected , in ${s}`):a<r.items.length-1&&i(h.start,`UNEXPECTED_TOKEN`,`Unexpected empty item in ${s}`),h.comment&&(c.comment?c.comment+=`
`+h.comment:c.comment=h.comment),u=h.end;continue}!o&&n.options.strict&&ti(f)&&i(f,`MULTILINE_IMPLICIT_KEY`,`Implicit keys of flow sequence pairs need to be on a single line`)}if(a===0)h.comma&&i(h.comma,`UNEXPECTED_TOKEN`,`Unexpected , in ${s}`);else if(h.comma||i(h.start,`MISSING_CHAR`,`Missing , between ${s} items`),h.comment){let e=``;e:for(let t of d)switch(t.type){case`comma`:case`space`:break;case`comment`:e=t.source.substring(1);break e;default:break e}if(e){let t=c.items[c.items.length-1];A(t)&&(t=t.value??t.key),t.comment?t.comment+=`
`+e:t.comment=e,h.comment=h.comment.substring(e.length+1)}}if(!o&&!p&&!h.found){let r=m?e(n,m,h,i):t(n,h.end,p,null,h,i);c.items.push(r),u=r.range[2],li(m)&&i(r.range,`BLOCK_IN_FLOW`,ci)}else{n.atKey=!0;let a=h.end,g=f?e(n,f,h,i):t(n,a,d,null,h,i);li(f)&&i(g.range,`BLOCK_IN_FLOW`,ci),n.atKey=!1;let _=ei(p??[],{flow:s,indicator:`map-value-ind`,next:m,offset:g.range[2],onError:i,parentIndent:r.indent,startOnNewline:!1});if(_.found){if(!o&&!h.found&&n.options.strict){if(p)for(let e of p){if(e===_.found)break;if(e.type===`newline`){i(e,`MULTILINE_IMPLICIT_KEY`,`Implicit keys of flow sequence pairs need to be on a single line`);break}}h.start<_.found.offset-1024&&i(_.found,`KEY_OVER_1024_CHARS`,`The : indicator must be at most 1024 chars after the start of an implicit flow sequence key`)}}else m&&(`source`in m&&m.source?.[0]===`:`?i(m,`MISSING_CHAR`,`Missing space after : in ${s}`):i(_.start,`MISSING_CHAR`,`Missing , or : between ${s} items`));let v=m?e(n,m,_,i):_.found?t(n,_.end,p,null,_,i):null;v?li(m)&&i(v.range,`BLOCK_IN_FLOW`,ci):_.comment&&(g.comment?g.comment+=`
`+_.comment:g.comment=_.comment);let y=new zn(g,v);if(n.options.keepSourceTokens&&(y.srcToken=l),o){let e=c;ri(n,e.items,g)&&i(a,`DUPLICATE_KEY`,`Map keys must be unique`),e.items.push(y)}else{let e=new Gn(n.schema);e.flow=!0,e.items.push(y);let t=(v??g).range;e.range=[g.range[0],t[1],t[2]],c.items.push(e)}u=v?v.range[2]:_.end}}let d=o?`}`:`]`,[f,...p]=r.end,m=u;if(f?.source===d)m=f.offset+f.source.length;else{let e=s[0].toUpperCase()+s.substring(1),t=l?`${e} must end with a ${d}`:`${e} in block collection must be sufficiently indented and end with a ${d}`;i(u,l?`MISSING_CHAR`:`BAD_INDENT`,t),f&&f.source.length!==1&&p.unshift(f)}if(p.length>0){let e=si(p,m,n.options.strict,i);e.comment&&(c.comment?c.comment+=`
`+e.comment:c.comment=e.comment),c.range=[r.offset,m,e.offset]}else c.range=[r.offset,m,m];return c}function di(e,t,n,r,i,a){let o=n.type===`block-map`?ai(e,t,n,r,a):n.type===`block-seq`?oi(e,t,n,r,a):ui(e,t,n,r,a),s=o.constructor;return i===`!`||i===s.tagName?(o.tag=s.tagName,o):(i&&(o.tag=i),o)}function fi(e,t,n,r,i){let a=r.tag,o=a?t.directives.tagName(a.source,e=>i(a,`TAG_RESOLVE_FAILED`,e)):null;if(n.type===`block-seq`){let{anchor:e,newlineAfterProp:t}=r,n=e&&a?e.offset>a.offset?e:a:e??a;n&&(!t||t.offset<n.offset)&&i(n,`MISSING_CHAR`,`Missing newline after block sequence props`)}let s=n.type===`block-map`?`map`:n.type===`block-seq`?`seq`:n.start.source===`{`?`map`:`seq`;if(!a||!o||o===`!`||o===Gn.tagName&&s===`map`||o===qn.tagName&&s===`seq`)return di(e,t,n,i,o);let c=t.schema.tags.find(e=>e.tag===o&&e.collection===s);if(!c){let r=t.schema.knownTags[o];if(r?.collection===s)t.schema.tags.push(Object.assign({},r,{default:!1})),c=r;else return r?i(a,`BAD_COLLECTION_TYPE`,`${r.tag} used for ${s} collection, but expects ${r.collection??`scalar`}`,!0):i(a,`TAG_RESOLVE_FAILED`,`Unresolved tag: ${o}`,!0),di(e,t,n,i,o)}let l=di(e,t,n,i,o,c),u=c.resolve?.(l,e=>i(a,`TAG_RESOLVE_FAILED`,e),t.options)??l,d=N(u)?u:new P(u);return d.range=l.range,d.tag=o,c?.format&&(d.format=c.format),d}function pi(e,t,n){let r=t.offset,i=mi(t,e.options.strict,n);if(!i)return{value:``,type:null,comment:``,range:[r,r,r]};let a=i.mode===`>`?P.BLOCK_FOLDED:P.BLOCK_LITERAL,o=t.source?hi(t.source):[],s=o.length;for(let e=o.length-1;e>=0;--e){let t=o[e][1];if(t===``||t===`\r`)s=e;else break}if(s===0){let e=i.chomp===`+`&&o.length>0?`
`.repeat(Math.max(1,o.length-1)):``,n=r+i.length;return t.source&&(n+=t.source.length),{value:e,type:a,comment:i.comment,range:[r,n,n]}}let c=t.indent+i.indent,l=t.offset+i.length,u=0;for(let t=0;t<s;++t){let[r,a]=o[t];if(a===``||a===`\r`)i.indent===0&&r.length>c&&(c=r.length);else{r.length<c&&n(l+r.length,`MISSING_CHAR`,`Block scalars with more-indented leading empty lines must use an explicit indentation indicator`),i.indent===0&&(c=r.length),u=t,c===0&&!e.atRoot&&n(l,`BAD_INDENT`,`Block scalar values in collections must be indented`);break}l+=r.length+a.length+1}for(let e=o.length-1;e>=s;--e)o[e][0].length>c&&(s=e+1);let d=``,f=``,p=!1;for(let e=0;e<u;++e)d+=o[e][0].slice(c)+`
`;for(let e=u;e<s;++e){let[t,r]=o[e];l+=t.length+r.length+1;let s=r[r.length-1]===`\r`;if(s&&(r=r.slice(0,-1)),r&&t.length<c){let e=`Block scalar lines must not be less indented than their ${i.indent?`explicit indentation indicator`:`first line`}`;n(l-r.length-(s?2:1),`BAD_INDENT`,e),t=``}a===P.BLOCK_LITERAL?(d+=f+t.slice(c)+r,f=`
`):t.length>c||r[0]===`	`?(f===` `?f=`
`:!p&&f===`
`&&(f=`

`),d+=f+t.slice(c)+r,f=`
`,p=!0):r===``?f===`
`?d+=`
`:f=`
`:(d+=f+r,f=` `,p=!1)}switch(i.chomp){case`-`:break;case`+`:for(let e=s;e<o.length;++e)d+=`
`+o[e][0].slice(c);d[d.length-1]!==`
`&&(d+=`
`);break;default:d+=`
`}let m=r+i.length+t.source.length;return{value:d,type:a,comment:i.comment,range:[r,m,m]}}function mi({offset:e,props:t},n,r){if(t[0].type!==`block-scalar-header`)return r(t[0],`IMPOSSIBLE`,`Block scalar header not found`),null;let{source:i}=t[0],a=i[0],o=0,s=``,c=-1;for(let t=1;t<i.length;++t){let n=i[t];if(!s&&(n===`-`||n===`+`))s=n;else{let r=Number(n);!o&&r?o=r:c===-1&&(c=e+t)}}c!==-1&&r(c,`UNEXPECTED_TOKEN`,`Block scalar header includes extra characters: ${i}`);let l=!1,u=``,d=i.length;for(let e=1;e<t.length;++e){let i=t[e];switch(i.type){case`space`:l=!0;case`newline`:d+=i.source.length;break;case`comment`:n&&!l&&r(i,`MISSING_CHAR`,`Comments must be separated from other tokens by white space characters`),d+=i.source.length,u=i.source.substring(1);break;case`error`:r(i,`UNEXPECTED_TOKEN`,i.message),d+=i.source.length;break;default:{r(i,`UNEXPECTED_TOKEN`,`Unexpected token in block scalar header: ${i.type}`);let e=i.source;e&&typeof e==`string`&&(d+=e.length)}}}return{mode:a,indent:o,chomp:s,comment:u,length:d}}function hi(e){let t=e.split(/\n( *)/),n=t[0],r=n.match(/^( *)/),i=[r?.[1]?[r[1],n.slice(r[1].length)]:[``,n]];for(let e=1;e<t.length;e+=2)i.push([t[e],t[e+1]]);return i}function gi(e,t,n){let{offset:r,type:i,source:a,end:o}=e,s,c,l=(e,t,i)=>n(r+e,t,i);switch(i){case`scalar`:s=P.PLAIN,c=_i(a,l);break;case`single-quoted-scalar`:s=P.QUOTE_SINGLE,c=vi(a,l);break;case`double-quoted-scalar`:s=P.QUOTE_DOUBLE,c=bi(a,l);break;default:return n(e,`UNEXPECTED_TOKEN`,`Expected a flow scalar value, but found: ${i}`),{value:``,type:null,comment:``,range:[r,r+a.length,r+a.length]}}let u=r+a.length,d=si(o,u,t,n);return{value:c,type:s,comment:d.comment,range:[r,u,d.offset]}}function _i(e,t){let n=``;switch(e[0]){case`	`:n=`a tab character`;break;case`,`:n=`flow indicator character ,`;break;case`%`:n=`directive indicator character %`;break;case`|`:case`>`:n=`block scalar indicator ${e[0]}`;break;case`@`:case"`":n=`reserved character ${e[0]}`}return n&&t(0,`BAD_SCALAR_START`,`Plain value cannot start with ${n}`),yi(e)}function vi(e,t){return(e[e.length-1]!==`'`||e.length===1)&&t(e.length,`MISSING_CHAR`,`Missing closing 'quote`),yi(e.slice(1,-1)).replace(/''/g,`'`)}function yi(e){let t=/(.*?)\r?\n/sy,n=t.exec(e);if(!n)return e;let r,i;try{r=/* @__PURE__ */ RegExp(`(?<![ 	])[ 	]+$`),i=/* @__PURE__ */ RegExp(`^[ 	]+|(?<![ 	])[ 	]+$`,`g`)}catch{r=/[ \t]+$/,i=/^[ \t]+|[ \t]+$/g}let a=n[1].replace(r,``),o=` `,s=t.lastIndex;for(;n=t.exec(e);){let e=n[1].replace(i,``);e===``?o===`
`?a+=o:o=`
`:(a+=o+e,o=` `),s=t.lastIndex}let c=/[ \t]*(.*)/sy;return c.lastIndex=s,n=c.exec(e),a+o+(n?.[1]??``)}function bi(e,t){let n=``;for(let r=1;r<e.length-1;++r){let i=e[r];if(i!==`\r`||e[r+1]!==`
`){if(i===`
`){let{fold:t,offset:i}=xi(e,r);n+=t,r=i}else if(i===`\\`){let i=e[++r],a=Si[i];if(a)n+=a;else if(i===`
`)for(i=e[r+1];i===` `||i===`	`;)i=e[++r+1];else if(i===`\r`&&e[r+1]===`
`)for(i=e[++r+1];i===` `||i===`	`;)i=e[++r+1];else if(i===`x`||i===`u`||i===`U`){let a=i===`x`?2:i===`u`?4:8;n+=Ci(e,r+1,a,t),r+=a}else{let i=e.substr(r-1,2);t(r-1,`BAD_DQ_ESCAPE`,`Invalid escape sequence ${i}`),n+=i}}else if(i===` `||i===`	`){let t=r,a=e[r+1];for(;a===` `||a===`	`;)a=e[++r+1];a!==`
`&&(a!==`\r`||e[r+2]!==`
`)&&(n+=r>t?e.slice(t,r+1):i)}else n+=i}}return(e[e.length-1]!==`"`||e.length===1)&&t(e.length,`MISSING_CHAR`,`Missing closing "quote`),n}function xi(e,t){let n=``,r=e[t+1];for(;(r===` `||r===`	`||r===`
`||r===`\r`)&&(r!==`\r`||e[t+2]===`
`);)r===`
`&&(n+=`
`),t+=1,r=e[t+1];return n||=` `,{fold:n,offset:t}}var Si={0:`\0`,a:`\x07`,b:`\b`,e:`\x1B`,f:`\f`,n:`
`,r:`\r`,t:`	`,v:`\v`,N:``,_:`\xA0`,L:`\u2028`,P:`\u2029`," ":` `,'"':`"`,"/":`/`,"\\":`\\`,"	":`	`};function Ci(e,t,n,r){let i=e.substr(t,n),a=i.length===n&&/^[0-9a-fA-F]+$/.test(i)?parseInt(i,16):NaN;try{return String.fromCodePoint(a)}catch{let i=e.substr(t-2,n+2);return r(t-2,`BAD_DQ_ESCAPE`,`Invalid escape sequence ${i}`),i}}function wi(e,t,n,r){let{value:i,type:a,comment:o,range:s}=t.type===`block-scalar`?pi(e,t,r):gi(t,e.options.strict,r),c=n?e.directives.tagName(n.source,e=>r(n,`TAG_RESOLVE_FAILED`,e)):null,l;l=e.options.stringKeys&&e.atKey?e.schema[wt]:c?Ti(e.schema,i,c,n,r):t.type===`scalar`?Ei(e,i,t,r):e.schema[wt];let u;try{let a=l.resolve(i,e=>r(n??t,`TAG_RESOLVE_FAILED`,e),e.options);u=j(a)?a:new P(a)}catch(e){let a=e instanceof Error?e.message:String(e);r(n??t,`TAG_RESOLVE_FAILED`,a),u=new P(i)}return u.range=s,u.source=i,a&&(u.type=a),c&&(u.tag=c),l.format&&(u.format=l.format),o&&(u.comment=o),u}function Ti(e,t,n,r,i){if(n===`!`)return e[wt];let a=[];for(let t of e.tags)if(!t.collection&&t.tag===n){if(t.default&&t.test)a.push(t);else return t}for(let e of a)if(e.test?.test(t))return e;let o=e.knownTags[n];return o&&!o.collection?(e.tags.push(Object.assign({},o,{default:!1,test:void 0})),o):(i(r,`TAG_RESOLVE_FAILED`,`Unresolved tag: ${n}`,n!==`tag:yaml.org,2002:str`),e[wt])}function Ei({atKey:e,directives:t,schema:n},r,i,a){let o=n.tags.find(t=>(t.default===!0||e&&t.default===`key`)&&t.test?.test(r))||n[wt];if(n.compat){let e=n.compat.find(e=>e.default&&e.test?.test(r))??n[wt];o.tag!==e.tag&&a(i,`TAG_RESOLVE_FAILED`,`Value may be parsed as either ${t.tagString(o.tag)} or ${t.tagString(e.tag)}`,!0)}return o}function Di(e,t,n){if(t){n??=t.length;for(let r=n-1;r>=0;--r){let n=t[r];switch(n.type){case`space`:case`comment`:case`newline`:e-=n.source.length;continue}for(n=t[++r];n?.type===`space`;)e+=n.source.length,n=t[++r];break}}return e}var Oi={composeNode:ki,composeEmptyNode:Ai};function ki(e,t,n,r){let i=e.atKey,{spaceBefore:a,comment:o,anchor:s,tag:c}=n,l,u=!0;switch(t.type){case`alias`:l=ji(e,t,r),(s||c)&&r(t,`ALIAS_PROPS`,`An alias node must not specify any properties`);break;case`scalar`:case`single-quoted-scalar`:case`double-quoted-scalar`:case`block-scalar`:l=wi(e,t,c,r),s&&(l.anchor=s.source.substring(1));break;case`block-map`:case`block-seq`:case`flow-collection`:try{l=fi(Oi,e,t,n,r),s&&(l.anchor=s.source.substring(1))}catch(e){r(t,`RESOURCE_EXHAUSTION`,e instanceof Error?e.message:String(e))}break;default:r(t,`UNEXPECTED_TOKEN`,t.type===`error`?t.message:`Unsupported token (type: ${t.type})`),u=!1}return l??=Ai(e,t.offset,void 0,null,n,r),s&&l.anchor===``&&r(s,`BAD_ALIAS`,`Anchor cannot be an empty string`),i&&e.options.stringKeys&&(!j(l)||typeof l.value!=`string`||l.tag&&l.tag!==`tag:yaml.org,2002:str`)&&r(c??t,`NON_STRING_KEY`,`With stringKeys, all keys must be strings`),a&&(l.spaceBefore=!0),o&&(t.type===`scalar`&&t.source===``?l.comment=o:l.commentBefore=o),e.options.keepSourceTokens&&u&&(l.srcToken=t),l}function Ai(e,t,n,r,{spaceBefore:i,comment:a,anchor:o,tag:s,end:c},l){let u=wi(e,{type:`scalar`,offset:Di(t,n,r),indent:-1,source:``},s,l);return o&&(u.anchor=o.source.substring(1),u.anchor===``&&l(o,`BAD_ALIAS`,`Anchor cannot be an empty string`)),i&&(u.spaceBefore=!0),a&&(u.comment=a,u.range[2]=c),u}function ji({options:e},{offset:t,source:n,end:r},i){let a=new Xt(n.substring(1));a.source===``&&i(t,`BAD_ALIAS`,`Alias cannot be an empty string`),a.source.endsWith(`:`)&&i(t+n.length-1,`BAD_ALIAS`,`Alias ending in : is ambiguous`,!0);let o=t+n.length,s=si(r,o,e.strict,i);return a.range=[t,o,s.offset],s.comment&&(a.comment=s.comment),a}function Mi(e,t,{offset:n,start:r,value:i,end:a},o){let s=new Jr(void 0,Object.assign({_directives:t},e)),c={atKey:!1,atRoot:!0,directives:s.directives,options:s.options,schema:s.schema},l=ei(r,{indicator:`doc-start`,next:i??a?.[0],offset:n,onError:o,parentIndent:0,startOnNewline:!0});l.found&&(s.directives.docStart=!0,i&&(i.type===`block-map`||i.type===`block-seq`)&&!l.hasNewline&&o(l.end,`MISSING_CHAR`,`Block collection cannot start on same line with directives-end marker`)),s.contents=i?ki(c,i,l,o):Ai(c,l.end,r,null,l,o);let u=s.contents.range[2],d=si(a,u,!1,o);return d.comment&&(s.comment=d.comment),s.range=[n,u,d.offset],s}function Ni(e){if(typeof e==`number`)return[e,e+1];if(Array.isArray(e))return e.length===2?e:[e[0],e[1]];let{offset:t,source:n}=e;return[t,t+(typeof n==`string`?n.length:1)]}function Pi(e){let t=``,n=!1,r=!1;for(let i=0;i<e.length;++i){let a=e[i];switch(a[0]){case`#`:t+=(t===``?``:r?`

`:`
`)+(a.substring(1)||` `),n=!0,r=!1;break;case`%`:e[i+1]?.[0]!==`#`&&(i+=1),n=!1;break;default:n||(r=!0),n=!1}}return{comment:t,afterEmptyLine:r}}var Fi=class{constructor(e={}){this.doc=null,this.atDirectives=!1,this.prelude=[],this.errors=[],this.warnings=[],this.onError=(e,t,n,r)=>{let i=Ni(e);r?this.warnings.push(new Qr(i,t,n)):this.errors.push(new Zr(i,t,n))},this.directives=new Ht({version:e.version||`1.2`}),this.options=e}decorate(e,t){let{comment:n,afterEmptyLine:r}=Pi(this.prelude);if(n){let i=e.contents;if(t)e.comment=e.comment?`${e.comment}
${n}`:n;else if(r||e.directives.docStart||!i)e.commentBefore=n;else if(M(i)&&!i.flow&&i.items.length>0){let e=i.items[0];A(e)&&(e=e.key);let t=e.commentBefore;e.commentBefore=t?`${n}
${t}`:n}else{let e=i.commentBefore;i.commentBefore=e?`${n}
${e}`:n}}if(t){for(let t=0;t<this.errors.length;++t)e.errors.push(this.errors[t]);for(let t=0;t<this.warnings.length;++t)e.warnings.push(this.warnings[t])}else e.errors=this.errors,e.warnings=this.warnings;this.prelude=[],this.errors=[],this.warnings=[]}streamInfo(){return{comment:Pi(this.prelude).comment,directives:this.directives,errors:this.errors,warnings:this.warnings}}*compose(e,t=!1,n=-1){for(let t of e)yield*this.next(t);yield*this.end(t,n)}*next(e){switch(e.type){case`directive`:this.directives.add(e.source,(t,n,r)=>{let i=Ni(e);i[0]+=t,this.onError(i,`BAD_DIRECTIVE`,n,r)}),this.prelude.push(e.source),this.atDirectives=!0;break;case`document`:{let t=Mi(this.options,this.directives,e,this.onError);this.atDirectives&&!t.directives.docStart&&this.onError(e,`MISSING_CHAR`,`Missing directives-end/doc-start indicator line`),this.decorate(t,!1),this.doc&&(yield this.doc),this.doc=t,this.atDirectives=!1;break}case`byte-order-mark`:case`space`:break;case`comment`:case`newline`:this.prelude.push(e.source);break;case`error`:{let t=e.source?`${e.message}: ${JSON.stringify(e.source)}`:e.message,n=new Zr(Ni(e),`UNEXPECTED_TOKEN`,t);this.atDirectives||!this.doc?this.errors.push(n):this.doc.errors.push(n);break}case`doc-end`:{if(!this.doc){this.errors.push(new Zr(Ni(e),`UNEXPECTED_TOKEN`,`Unexpected doc-end without preceding document`));break}this.doc.directives.docEnd=!0;let t=si(e.end,e.offset+e.source.length,this.doc.options.strict,this.onError);if(this.decorate(this.doc,!0),t.comment){let e=this.doc.comment;this.doc.comment=e?`${e}
${t.comment}`:t.comment}this.doc.range[2]=t.offset;break}default:this.errors.push(new Zr(Ni(e),`UNEXPECTED_TOKEN`,`Unsupported token ${e.type}`))}}*end(e=!1,t=-1){if(this.doc)this.decorate(this.doc,!0),yield this.doc,this.doc=null;else if(e){let e=new Jr(void 0,Object.assign({_directives:this.directives},this.options));this.atDirectives&&this.onError(t,`MISSING_CHAR`,`Missing directives-end indicator line`),e.range=[0,t,t],this.decorate(e,!1),yield e}}},Ii=Symbol(`break visit`),Li=Symbol(`skip children`),Ri=Symbol(`remove item`);function zi(e,t){`type`in e&&e.type===`document`&&(e={start:e.start,value:e.value}),Bi(Object.freeze([]),e,t)}zi.BREAK=Ii,zi.SKIP=Li,zi.REMOVE=Ri,zi.itemAtPath=(e,t)=>{let n=e;for(let[e,r]of t){let t=n?.[e];if(t&&`items`in t)n=t.items[r];else return}return n},zi.parentCollection=(e,t)=>{let n=zi.itemAtPath(e,t.slice(0,-1)),r=t[t.length-1][0],i=n?.[r];if(i&&`items`in i)return i;throw Error(`Parent collection not found`)};function Bi(e,t,n){let r=n(t,e);if(typeof r==`symbol`)return r;for(let i of[`key`,`value`]){let a=t[i];if(a&&`items`in a){for(let t=0;t<a.items.length;++t){let r=Bi(Object.freeze(e.concat([[i,t]])),a.items[t],n);if(typeof r==`number`)t=r-1;else{if(r===Ii)return Ii;r===Ri&&(a.items.splice(t,1),--t)}}typeof r==`function`&&i===`key`&&(r=r(t,e))}}return typeof r==`function`?r(t,e):r}var Vi=`﻿`,Hi=``,Ui=``,Wi=``;function Gi(e){switch(e){case Vi:return`byte-order-mark`;case Hi:return`doc-mode`;case Ui:return`flow-error-end`;case Wi:return`scalar`;case`---`:return`doc-start`;case`...`:return`doc-end`;case``:case`
`:case`\r
`:return`newline`;case`-`:return`seq-item-ind`;case`?`:return`explicit-key-ind`;case`:`:return`map-value-ind`;case`{`:return`flow-map-start`;case`}`:return`flow-map-end`;case`[`:return`flow-seq-start`;case`]`:return`flow-seq-end`;case`,`:return`comma`}switch(e[0]){case` `:case`	`:return`space`;case`#`:return`comment`;case`%`:return`directive-line`;case`*`:return`alias`;case`&`:return`anchor`;case`!`:return`tag`;case`'`:return`single-quoted-scalar`;case`"`:return`double-quoted-scalar`;case`|`:case`>`:return`block-scalar-header`}return null}function Ki(e){switch(e){case void 0:case` `:case`
`:case`\r`:case`	`:return!0;default:return!1}}var qi=/* @__PURE__ */ new Set(`0123456789ABCDEFabcdef`),Ji=/* @__PURE__ */ new Set(`0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()`),Yi=/* @__PURE__ */ new Set(`,[]{}`),Xi=/* @__PURE__ */ new Set(` ,[]{}
\r	`),Zi=e=>!e||Xi.has(e),Qi=class{constructor(){this.atEnd=!1,this.blockScalarIndent=-1,this.blockScalarKeep=!1,this.buffer=``,this.flowKey=!1,this.flowLevel=0,this.indentNext=0,this.indentValue=0,this.lineEndPos=null,this.next=null,this.pos=0}*lex(e,t=!1){if(e){if(typeof e!=`string`)throw TypeError(`source is not a string`);this.buffer=this.buffer?this.buffer+e:e,this.lineEndPos=null}this.atEnd=!t;let n=this.next??`stream`;for(;n&&(t||this.hasChars(1));)n=yield*this.parseNext(n)}atLineEnd(){let e=this.pos,t=this.buffer[e];for(;t===` `||t===`	`;)t=this.buffer[++e];return!t||t===`#`||t===`
`||t===`\r`&&this.buffer[e+1]===`
`}charAt(e){return this.buffer[this.pos+e]}continueScalar(e){let t=this.buffer[e];if(this.indentNext>0){let n=0;for(;t===` `;)t=this.buffer[++n+e];if(t===`\r`){let t=this.buffer[n+e+1];if(t===`
`||!t&&!this.atEnd)return e+n+1}return t===`
`||n>=this.indentNext||!t&&!this.atEnd?e+n:-1}if(t===`-`||t===`.`){let t=this.buffer.substr(e,3);if((t===`---`||t===`...`)&&Ki(this.buffer[e+3]))return-1}return e}getLine(){let e=this.lineEndPos;return(typeof e!=`number`||e!==-1&&e<this.pos)&&(e=this.buffer.indexOf(`
`,this.pos),this.lineEndPos=e),e===-1?this.atEnd?this.buffer.substring(this.pos):null:(this.buffer[e-1]===`\r`&&--e,this.buffer.substring(this.pos,e))}hasChars(e){return this.pos+e<=this.buffer.length}setNext(e){return this.buffer=this.buffer.substring(this.pos),this.pos=0,this.lineEndPos=null,this.next=e,null}peek(e){return this.buffer.substr(this.pos,e)}*parseNext(e){switch(e){case`stream`:return yield*this.parseStream();case`line-start`:return yield*this.parseLineStart();case`block-start`:return yield*this.parseBlockStart();case`doc`:return yield*this.parseDocument();case`flow`:return yield*this.parseFlowCollection();case`quoted-scalar`:return yield*this.parseQuotedScalar();case`block-scalar`:return yield*this.parseBlockScalar();case`plain-scalar`:return yield*this.parsePlainScalar()}}*parseStream(){let e=this.getLine();if(e===null)return this.setNext(`stream`);if(e[0]===Vi&&(yield*this.pushCount(1),e=e.substring(1)),e[0]===`%`){let t=e.length,n=e.indexOf(`#`);for(;n!==-1;){let r=e[n-1];if(r===` `||r===`	`){t=n-1;break}n=e.indexOf(`#`,n+1)}for(;;){let n=e[t-1];if(n===` `||n===`	`)--t;else break}let r=(yield*this.pushCount(t))+(yield*this.pushSpaces(!0));return yield*this.pushCount(e.length-r),this.pushNewline(),`stream`}if(this.atLineEnd()){let t=yield*this.pushSpaces(!0);return yield*this.pushCount(e.length-t),yield*this.pushNewline(),`stream`}return yield Hi,yield*this.parseLineStart()}*parseLineStart(){let e=this.charAt(0);if(!e&&!this.atEnd)return this.setNext(`line-start`);if(e===`-`||e===`.`){if(!this.atEnd&&!this.hasChars(4))return this.setNext(`line-start`);let e=this.peek(3);if((e===`---`||e===`...`)&&Ki(this.charAt(3)))return yield*this.pushCount(3),this.indentValue=0,this.indentNext=0,e===`---`?`doc`:`stream`}return this.indentValue=yield*this.pushSpaces(!1),this.indentNext>this.indentValue&&!Ki(this.charAt(1))&&(this.indentNext=this.indentValue),yield*this.parseBlockStart()}*parseBlockStart(){let[e,t]=this.peek(2);if(!t&&!this.atEnd)return this.setNext(`block-start`);if((e===`-`||e===`?`||e===`:`)&&Ki(t)){let e=(yield*this.pushCount(1))+(yield*this.pushSpaces(!0));return this.indentNext=this.indentValue+1,this.indentValue+=e,`block-start`}return`doc`}*parseDocument(){yield*this.pushSpaces(!0);let e=this.getLine();if(e===null)return this.setNext(`doc`);let t=yield*this.pushIndicators();switch(e[t]){case`#`:yield*this.pushCount(e.length-t);case void 0:return yield*this.pushNewline(),yield*this.parseLineStart();case`{`:case`[`:return yield*this.pushCount(1),this.flowKey=!1,this.flowLevel=1,`flow`;case`}`:case`]`:return yield*this.pushCount(1),`doc`;case`*`:return yield*this.pushUntil(Zi),`doc`;case`"`:case`'`:return yield*this.parseQuotedScalar();case`|`:case`>`:return t+=yield*this.parseBlockScalarHeader(),t+=yield*this.pushSpaces(!0),yield*this.pushCount(e.length-t),yield*this.pushNewline(),yield*this.parseBlockScalar();default:return yield*this.parsePlainScalar()}}*parseFlowCollection(){let e,t,n=-1;do e=yield*this.pushNewline(),e>0?(t=yield*this.pushSpaces(!1),this.indentValue=n=t):t=0,t+=yield*this.pushSpaces(!0);while(e+t>0);let r=this.getLine();if(r===null)return this.setNext(`flow`);if((n!==-1&&n<this.indentNext&&r[0]!==`#`||n===0&&(r.startsWith(`---`)||r.startsWith(`...`))&&Ki(r[3]))&&(n!==this.indentNext-1||this.flowLevel!==1||r[0]!==`]`&&r[0]!==`}`))return this.flowLevel=0,yield Ui,yield*this.parseLineStart();let i=0;for(;r[i]===`,`;)i+=yield*this.pushCount(1),i+=yield*this.pushSpaces(!0),this.flowKey=!1;switch(i+=yield*this.pushIndicators(),r[i]){case void 0:return`flow`;case`#`:return yield*this.pushCount(r.length-i),`flow`;case`{`:case`[`:return yield*this.pushCount(1),this.flowKey=!1,this.flowLevel+=1,`flow`;case`}`:case`]`:return yield*this.pushCount(1),this.flowKey=!0,--this.flowLevel,this.flowLevel?`flow`:`doc`;case`*`:return yield*this.pushUntil(Zi),`flow`;case`"`:case`'`:return this.flowKey=!0,yield*this.parseQuotedScalar();case`:`:{let e=this.charAt(1);if(this.flowKey||Ki(e)||e===`,`)return this.flowKey=!1,yield*this.pushCount(1),yield*this.pushSpaces(!0),`flow`}default:return this.flowKey=!1,yield*this.parsePlainScalar()}}*parseQuotedScalar(){let e=this.charAt(0),t=this.buffer.indexOf(e,this.pos+1);if(e===`'`)for(;t!==-1&&this.buffer[t+1]===`'`;)t=this.buffer.indexOf(`'`,t+2);else for(;t!==-1;){let e=0;for(;this.buffer[t-1-e]===`\\`;)e+=1;if(e%2==0)break;t=this.buffer.indexOf(`"`,t+1)}let n=this.buffer.substring(0,t),r=n.indexOf(`
`,this.pos);if(r!==-1){for(;r!==-1;){let e=this.continueScalar(r+1);if(e===-1)break;r=n.indexOf(`
`,e)}r!==-1&&(t=r-(n[r-1]===`\r`?2:1))}if(t===-1){if(!this.atEnd)return this.setNext(`quoted-scalar`);t=this.buffer.length}return yield*this.pushToIndex(t+1,!1),this.flowLevel?`flow`:`doc`}*parseBlockScalarHeader(){this.blockScalarIndent=-1,this.blockScalarKeep=!1;let e=this.pos;for(;;){let t=this.buffer[++e];if(t===`+`)this.blockScalarKeep=!0;else if(t>`0`&&t<=`9`)this.blockScalarIndent=Number(t)-1;else if(t!==`-`)break}return yield*this.pushUntil(e=>Ki(e)||e===`#`)}*parseBlockScalar(){let e=this.pos-1,t=0,n;e:for(let r=this.pos;n=this.buffer[r];++r)switch(n){case` `:t+=1;break;case`
`:e=r,t=0;break;case`\r`:{let e=this.buffer[r+1];if(!e&&!this.atEnd)return this.setNext(`block-scalar`);if(e===`
`)break}default:break e}if(!n&&!this.atEnd)return this.setNext(`block-scalar`);if(t>=this.indentNext){this.indentNext=this.blockScalarIndent===-1?t:this.blockScalarIndent+(this.indentNext===0?1:this.indentNext);do{let t=this.continueScalar(e+1);if(t===-1)break;e=this.buffer.indexOf(`
`,t)}while(e!==-1);if(e===-1){if(!this.atEnd)return this.setNext(`block-scalar`);e=this.buffer.length}}let r=e+1;for(n=this.buffer[r];n===` `;)n=this.buffer[++r];if(n===`	`){for(;n===`	`||n===` `||n===`\r`||n===`
`;)n=this.buffer[++r];e=r-1}else if(!this.blockScalarKeep)do{let n=e-1,r=this.buffer[n];r===`\r`&&(r=this.buffer[--n]);let i=n;for(;r===` `;)r=this.buffer[--n];if(r===`
`&&n>=this.pos&&n+1+t>i)e=n;else break}while(1);return yield Wi,yield*this.pushToIndex(e+1,!0),yield*this.parseLineStart()}*parsePlainScalar(){let e=this.flowLevel>0,t=this.pos-1,n=this.pos-1,r;for(;r=this.buffer[++n];)if(r===`:`){let r=this.buffer[n+1];if(Ki(r)||e&&Yi.has(r))break;t=n}else if(Ki(r)){let i=this.buffer[n+1];if(r===`\r`&&(i===`
`?(n+=1,r=`
`,i=this.buffer[n+1]):t=n),i===`#`||e&&Yi.has(i))break;if(r===`
`){let e=this.continueScalar(n+1);if(e===-1)break;n=Math.max(n,e-2)}}else{if(e&&Yi.has(r))break;t=n}return!r&&!this.atEnd?this.setNext(`plain-scalar`):(yield Wi,yield*this.pushToIndex(t+1,!0),e?`flow`:`doc`)}*pushCount(e){return e>0?(yield this.buffer.substr(this.pos,e),this.pos+=e,e):0}*pushToIndex(e,t){let n=this.buffer.slice(this.pos,e);return n?(yield n,this.pos+=n.length,n.length):(t&&(yield``),0)}*pushIndicators(){let e=0;e:for(;;){switch(this.charAt(0)){case`!`:e+=yield*this.pushTag(),e+=yield*this.pushSpaces(!0);continue e;case`&`:e+=yield*this.pushUntil(Zi),e+=yield*this.pushSpaces(!0);continue e;case`-`:case`?`:case`:`:{let t=this.flowLevel>0,n=this.charAt(1);if(Ki(n)||t&&Yi.has(n)){t?this.flowKey&&=!1:this.indentNext=this.indentValue+1,e+=yield*this.pushCount(1),e+=yield*this.pushSpaces(!0);continue e}}}break e}return e}*pushTag(){if(this.charAt(1)===`<`){let e=this.pos+2,t=this.buffer[e];for(;!Ki(t)&&t!==`>`;)t=this.buffer[++e];return yield*this.pushToIndex(t===`>`?e+1:e,!1)}{let e=this.pos+1,t=this.buffer[e];for(;t;)if(Ji.has(t))t=this.buffer[++e];else if(t===`%`&&qi.has(this.buffer[e+1])&&qi.has(this.buffer[e+2]))t=this.buffer[e+=3];else break;return yield*this.pushToIndex(e,!1)}}*pushNewline(){let e=this.buffer[this.pos];return e===`
`?yield*this.pushCount(1):e===`\r`&&this.charAt(1)===`
`?yield*this.pushCount(2):0}*pushSpaces(e){let t=this.pos-1,n;do n=this.buffer[++t];while(n===` `||e&&n===`	`);let r=t-this.pos;return r>0&&(yield this.buffer.substr(this.pos,r),this.pos=t),r}*pushUntil(e){let t=this.pos,n=this.buffer[t];for(;!e(n);)n=this.buffer[++t];return yield*this.pushToIndex(t,!1)}},$i=class{constructor(){this.lineStarts=[],this.addNewLine=e=>this.lineStarts.push(e),this.linePos=e=>{let t=0,n=this.lineStarts.length;for(;t<n;){let r=t+n>>1;this.lineStarts[r]<e?t=r+1:n=r}if(this.lineStarts[t]===e)return{line:t+1,col:1};if(t===0)return{line:0,col:e};let r=this.lineStarts[t-1];return{line:t,col:e-r+1}}}};function ea(e,t){for(let n=0;n<e.length;++n)if(e[n].type===t)return!0;return!1}function ta(e){for(let t=0;t<e.length;++t)switch(e[t].type){case`space`:case`comment`:case`newline`:break;default:return t}return-1}function na(e){switch(e?.type){case`alias`:case`scalar`:case`single-quoted-scalar`:case`double-quoted-scalar`:case`flow-collection`:return!0;default:return!1}}function ra(e){switch(e.type){case`document`:return e.start;case`block-map`:{let t=e.items[e.items.length-1];return t.sep??t.start}case`block-seq`:return e.items[e.items.length-1].start;default:return[]}}function ia(e){if(e.length===0)return[];let t=e.length;e:for(;--t>=0;)switch(e[t].type){case`doc-start`:case`explicit-key-ind`:case`map-value-ind`:case`seq-item-ind`:case`newline`:break e}for(;e[++t]?.type===`space`;);return e.splice(t,e.length)}function aa(e,t){if(t.length<1e5)Array.prototype.push.apply(e,t);else for(let n=0;n<t.length;++n)e.push(t[n])}function oa(e){if(e.start.type===`flow-seq-start`)for(let t of e.items)t.sep&&!t.value&&!ea(t.start,`explicit-key-ind`)&&!ea(t.sep,`map-value-ind`)&&(t.key&&(t.value=t.key),delete t.key,na(t.value)?t.value.end?aa(t.value.end,t.sep):t.value.end=t.sep:aa(t.start,t.sep),delete t.sep)}var sa=class{constructor(e){this.atNewLine=!0,this.atScalar=!1,this.indent=0,this.offset=0,this.onKeyLine=!1,this.stack=[],this.source=``,this.type=``,this.lexer=new Qi,this.onNewLine=e}*parse(e,t=!1){this.onNewLine&&this.offset===0&&this.onNewLine(0);for(let n of this.lexer.lex(e,t))yield*this.next(n);t||(yield*this.end())}*next(e){if(this.source=e,this.atScalar){this.atScalar=!1,yield*this.step(),this.offset+=e.length;return}let t=Gi(e);if(t){if(t===`scalar`)this.atNewLine=!1,this.atScalar=!0,this.type=`scalar`;else{switch(this.type=t,yield*this.step(),t){case`newline`:this.atNewLine=!0,this.indent=0,this.onNewLine&&this.onNewLine(this.offset+e.length);break;case`space`:this.atNewLine&&e[0]===` `&&(this.indent+=e.length);break;case`explicit-key-ind`:case`map-value-ind`:case`seq-item-ind`:this.atNewLine&&(this.indent+=e.length);break;case`doc-mode`:case`flow-error-end`:return;default:this.atNewLine=!1}this.offset+=e.length}}else{let t=`Not a YAML token: ${e}`;yield*this.pop({type:`error`,offset:this.offset,message:t,source:e}),this.offset+=e.length}}*end(){for(;this.stack.length>0;)yield*this.pop()}get sourceToken(){return{type:this.type,offset:this.offset,indent:this.indent,source:this.source}}*step(){let e=this.peek(1);if(this.type===`doc-end`&&e?.type!==`doc-end`){for(;this.stack.length>0;)yield*this.pop();this.stack.push({type:`doc-end`,offset:this.offset,source:this.source})}else{if(!e)return yield*this.stream();switch(e.type){case`document`:return yield*this.document(e);case`alias`:case`scalar`:case`single-quoted-scalar`:case`double-quoted-scalar`:return yield*this.scalar(e);case`block-scalar`:return yield*this.blockScalar(e);case`block-map`:return yield*this.blockMap(e);case`block-seq`:return yield*this.blockSequence(e);case`flow-collection`:return yield*this.flowCollection(e);case`doc-end`:return yield*this.documentEnd(e)}yield*this.pop()}}peek(e){return this.stack[this.stack.length-e]}*pop(e){let t=e??this.stack.pop();if(!t)yield{type:`error`,offset:this.offset,source:``,message:`Tried to pop an empty stack`};else if(this.stack.length===0)yield t;else{let e=this.peek(1);switch(t.type===`block-scalar`?t.indent=`indent`in e?e.indent:0:t.type===`flow-collection`&&e.type===`document`&&(t.indent=0),t.type===`flow-collection`&&oa(t),e.type){case`document`:e.value=t;break;case`block-scalar`:e.props.push(t);break;case`block-map`:{let n=e.items[e.items.length-1];if(n.value){e.items.push({start:[],key:t,sep:[]}),this.onKeyLine=!0;return}if(n.sep)n.value=t;else{Object.assign(n,{key:t,sep:[]}),this.onKeyLine=!n.explicitKey;return}break}case`block-seq`:{let n=e.items[e.items.length-1];n.value?e.items.push({start:[],value:t}):n.value=t;break}case`flow-collection`:{let n=e.items[e.items.length-1];!n||n.value?e.items.push({start:[],key:t,sep:[]}):n.sep?n.value=t:Object.assign(n,{key:t,sep:[]});return}default:yield*this.pop(),yield*this.pop(t)}if((e.type===`document`||e.type===`block-map`||e.type===`block-seq`)&&(t.type===`block-map`||t.type===`block-seq`)){let n=t.items[t.items.length-1];n&&!n.sep&&!n.value&&n.start.length>0&&ta(n.start)===-1&&(t.indent===0||n.start.every(e=>e.type!==`comment`||e.indent<t.indent))&&(e.type===`document`?e.end=n.start:e.items.push({start:n.start}),t.items.splice(-1,1))}}}*stream(){switch(this.type){case`directive-line`:yield{type:`directive`,offset:this.offset,source:this.source};return;case`byte-order-mark`:case`space`:case`comment`:case`newline`:yield this.sourceToken;return;case`doc-mode`:case`doc-start`:{let e={type:`document`,offset:this.offset,start:[]};this.type===`doc-start`&&e.start.push(this.sourceToken),this.stack.push(e);return}}yield{type:`error`,offset:this.offset,message:`Unexpected ${this.type} token in YAML stream`,source:this.source}}*document(e){if(e.value)return yield*this.lineEnd(e);switch(this.type){case`doc-start`:ta(e.start)===-1?e.start.push(this.sourceToken):(yield*this.pop(),yield*this.step());return;case`anchor`:case`tag`:case`space`:case`comment`:case`newline`:e.start.push(this.sourceToken);return}let t=this.startBlockValue(e);t?this.stack.push(t):yield{type:`error`,offset:this.offset,message:`Unexpected ${this.type} token in YAML document`,source:this.source}}*scalar(e){if(this.type===`map-value-ind`){let t=ia(ra(this.peek(2))),n;e.end?(n=e.end,n.push(this.sourceToken),delete e.end):n=[this.sourceToken];let r={type:`block-map`,offset:e.offset,indent:e.indent,items:[{start:t,key:e,sep:n}]};this.onKeyLine=!0,this.stack[this.stack.length-1]=r}else yield*this.lineEnd(e)}*blockScalar(e){switch(this.type){case`space`:case`comment`:case`newline`:e.props.push(this.sourceToken);return;case`scalar`:if(e.source=this.source,this.atNewLine=!0,this.indent=0,this.onNewLine){let e=this.source.indexOf(`
`)+1;for(;e!==0;)this.onNewLine(this.offset+e),e=this.source.indexOf(`
`,e)+1}yield*this.pop();break;default:yield*this.pop(),yield*this.step()}}*blockMap(e){let t=e.items[e.items.length-1];switch(this.type){case`newline`:if(this.onKeyLine=!1,t.value){let n=`end`in t.value?t.value.end:void 0;(Array.isArray(n)?n[n.length-1]:void 0)?.type===`comment`?n?.push(this.sourceToken):e.items.push({start:[this.sourceToken]})}else t.sep?t.sep.push(this.sourceToken):t.start.push(this.sourceToken);return;case`space`:case`comment`:if(t.value)e.items.push({start:[this.sourceToken]});else if(t.sep)t.sep.push(this.sourceToken);else{if(this.atIndentedComment(t.start,e.indent)){let n=e.items[e.items.length-2]?.value?.end;if(Array.isArray(n)){aa(n,t.start),n.push(this.sourceToken),e.items.pop();return}}t.start.push(this.sourceToken)}return}if(this.indent>=e.indent){let n=!this.onKeyLine&&this.indent===e.indent,r=n&&(t.sep||t.explicitKey)&&this.type!==`seq-item-ind`,i=[];if(r&&t.sep&&!t.value){let n=[];for(let r=0;r<t.sep.length;++r){let i=t.sep[r];switch(i.type){case`newline`:n.push(r);break;case`space`:break;case`comment`:i.indent>e.indent&&(n.length=0);break;default:n.length=0}}n.length>=2&&(i=t.sep.splice(n[1]))}switch(this.type){case`anchor`:case`tag`:r||t.value?(i.push(this.sourceToken),e.items.push({start:i}),this.onKeyLine=!0):t.sep?t.sep.push(this.sourceToken):t.start.push(this.sourceToken);return;case`explicit-key-ind`:!t.sep&&!t.explicitKey?(t.start.push(this.sourceToken),t.explicitKey=!0):r||t.value?(i.push(this.sourceToken),e.items.push({start:i,explicitKey:!0})):this.stack.push({type:`block-map`,offset:this.offset,indent:this.indent,items:[{start:[this.sourceToken],explicitKey:!0}]}),this.onKeyLine=!0;return;case`map-value-ind`:if(t.explicitKey){if(t.sep){if(t.value)e.items.push({start:[],key:null,sep:[this.sourceToken]});else if(ea(t.sep,`map-value-ind`))this.stack.push({type:`block-map`,offset:this.offset,indent:this.indent,items:[{start:i,key:null,sep:[this.sourceToken]}]});else if(na(t.key)&&!ea(t.sep,`newline`)){let e=ia(t.start),n=t.key,r=t.sep;r.push(this.sourceToken),delete t.key,delete t.sep,this.stack.push({type:`block-map`,offset:this.offset,indent:this.indent,items:[{start:e,key:n,sep:r}]})}else i.length>0?t.sep=t.sep.concat(i,this.sourceToken):t.sep.push(this.sourceToken)}else if(ea(t.start,`newline`))Object.assign(t,{key:null,sep:[this.sourceToken]});else{let e=ia(t.start);this.stack.push({type:`block-map`,offset:this.offset,indent:this.indent,items:[{start:e,key:null,sep:[this.sourceToken]}]})}}else t.sep?t.value||r?e.items.push({start:i,key:null,sep:[this.sourceToken]}):ea(t.sep,`map-value-ind`)?this.stack.push({type:`block-map`,offset:this.offset,indent:this.indent,items:[{start:[],key:null,sep:[this.sourceToken]}]}):t.sep.push(this.sourceToken):Object.assign(t,{key:null,sep:[this.sourceToken]});this.onKeyLine=!0;return;case`alias`:case`scalar`:case`single-quoted-scalar`:case`double-quoted-scalar`:{let n=this.flowScalar(this.type);r||t.value?(e.items.push({start:i,key:n,sep:[]}),this.onKeyLine=!0):t.sep?this.stack.push(n):(Object.assign(t,{key:n,sep:[]}),this.onKeyLine=!0);return}default:{let r=this.startBlockValue(e);if(r){if(r.type===`block-seq`){if(!t.explicitKey&&t.sep&&!ea(t.sep,`newline`)){yield*this.pop({type:`error`,offset:this.offset,message:`Unexpected block-seq-ind on same line with key`,source:this.source});return}}else n&&e.items.push({start:i});this.stack.push(r);return}}}}yield*this.pop(),yield*this.step()}*blockSequence(e){let t=e.items[e.items.length-1];switch(this.type){case`newline`:if(t.value){let n=`end`in t.value?t.value.end:void 0;(Array.isArray(n)?n[n.length-1]:void 0)?.type===`comment`?n?.push(this.sourceToken):e.items.push({start:[this.sourceToken]})}else t.start.push(this.sourceToken);return;case`space`:case`comment`:if(t.value)e.items.push({start:[this.sourceToken]});else{if(this.atIndentedComment(t.start,e.indent)){let n=e.items[e.items.length-2]?.value?.end;if(Array.isArray(n)){aa(n,t.start),n.push(this.sourceToken),e.items.pop();return}}t.start.push(this.sourceToken)}return;case`anchor`:case`tag`:if(t.value||this.indent<=e.indent)break;t.start.push(this.sourceToken);return;case`seq-item-ind`:if(this.indent!==e.indent)break;t.value||ea(t.start,`seq-item-ind`)?e.items.push({start:[this.sourceToken]}):t.start.push(this.sourceToken);return}if(this.indent>e.indent){let t=this.startBlockValue(e);if(t){this.stack.push(t);return}}yield*this.pop(),yield*this.step()}*flowCollection(e){let t=e.items[e.items.length-1];if(this.type===`flow-error-end`){let e;do yield*this.pop(),e=this.peek(1);while(e?.type===`flow-collection`)}else if(e.end.length===0){switch(this.type){case`comma`:case`explicit-key-ind`:!t||t.sep?e.items.push({start:[this.sourceToken]}):t.start.push(this.sourceToken);return;case`map-value-ind`:!t||t.value?e.items.push({start:[],key:null,sep:[this.sourceToken]}):t.sep?t.sep.push(this.sourceToken):Object.assign(t,{key:null,sep:[this.sourceToken]});return;case`space`:case`comment`:case`newline`:case`anchor`:case`tag`:!t||t.value?e.items.push({start:[this.sourceToken]}):t.sep?t.sep.push(this.sourceToken):t.start.push(this.sourceToken);return;case`alias`:case`scalar`:case`single-quoted-scalar`:case`double-quoted-scalar`:{let n=this.flowScalar(this.type);!t||t.value?e.items.push({start:[],key:n,sep:[]}):t.sep?this.stack.push(n):Object.assign(t,{key:n,sep:[]});return}case`flow-map-end`:case`flow-seq-end`:e.end.push(this.sourceToken);return}let n=this.startBlockValue(e);n?this.stack.push(n):(yield*this.pop(),yield*this.step())}else{let t=this.peek(2);if(t.type===`block-map`&&(this.type===`map-value-ind`&&t.indent===e.indent||this.type===`newline`&&!t.items[t.items.length-1].sep))yield*this.pop(),yield*this.step();else if(this.type===`map-value-ind`&&t.type!==`flow-collection`){let n=ia(ra(t));oa(e);let r=e.end.splice(1,e.end.length);r.push(this.sourceToken);let i={type:`block-map`,offset:e.offset,indent:e.indent,items:[{start:n,key:e,sep:r}]};this.onKeyLine=!0,this.stack[this.stack.length-1]=i}else yield*this.lineEnd(e)}}flowScalar(e){if(this.onNewLine){let e=this.source.indexOf(`
`)+1;for(;e!==0;)this.onNewLine(this.offset+e),e=this.source.indexOf(`
`,e)+1}return{type:e,offset:this.offset,indent:this.indent,source:this.source}}startBlockValue(e){switch(this.type){case`alias`:case`scalar`:case`single-quoted-scalar`:case`double-quoted-scalar`:return this.flowScalar(this.type);case`block-scalar-header`:return{type:`block-scalar`,offset:this.offset,indent:this.indent,props:[this.sourceToken],source:``};case`flow-map-start`:case`flow-seq-start`:return{type:`flow-collection`,offset:this.offset,indent:this.indent,start:this.sourceToken,items:[],end:[]};case`seq-item-ind`:return{type:`block-seq`,offset:this.offset,indent:this.indent,items:[{start:[this.sourceToken]}]};case`explicit-key-ind`:{this.onKeyLine=!0;let t=ia(ra(e));return t.push(this.sourceToken),{type:`block-map`,offset:this.offset,indent:this.indent,items:[{start:t,explicitKey:!0}]}}case`map-value-ind`:{this.onKeyLine=!0;let t=ia(ra(e));return{type:`block-map`,offset:this.offset,indent:this.indent,items:[{start:t,key:null,sep:[this.sourceToken]}]}}}return null}atIndentedComment(e,t){return this.type!==`comment`||this.indent<=t?!1:e.every(e=>e.type===`newline`||e.type===`space`)}*documentEnd(e){this.type!==`doc-mode`&&(e.end?e.end.push(this.sourceToken):e.end=[this.sourceToken],this.type===`newline`&&(yield*this.pop()))}*lineEnd(e){switch(this.type){case`comma`:case`doc-start`:case`doc-end`:case`flow-seq-end`:case`flow-map-end`:case`map-value-ind`:yield*this.pop(),yield*this.step();break;case`newline`:this.onKeyLine=!1;default:e.end?e.end.push(this.sourceToken):e.end=[this.sourceToken],this.type===`newline`&&(yield*this.pop())}}};function ca(e){let t=e.prettyErrors!==!1;return{lineCounter:e.lineCounter||t&&new $i||null,prettyErrors:t}}function la(e,t={}){let{lineCounter:n,prettyErrors:r}=ca(t),i=new sa(n?.addNewLine),a=new Fi(t),o=null;for(let t of a.compose(i.parse(e),!0,e.length))if(!o)o=t;else if(o.options.logLevel!==`silent`){o.errors.push(new Zr(t.range.slice(0,2),`MULTIPLE_DOCS`,`Source contains multiple documents; please use YAML.parseAllDocuments()`));break}return r&&n&&(o.errors.forEach($r(e,n)),o.warnings.forEach($r(e,n))),o}function ua(e){return e.replaceAll(`~`,`~0`).replaceAll(`/`,`~1`)}function da(e){return e.replaceAll(`~1`,`/`).replaceAll(`~0`,`~`)}function F(e,...t){return t.reduce((e,t)=>`${e}/${ua(String(t))}`,e)}function fa(e){if(e===``)return[];if(e.startsWith(`/`))return e.slice(1).split(`/`).map(da)}function pa(e){try{return decodeURIComponent(e)}catch{return}}function ma(e){let t=pa(e.startsWith(`#`)?e.slice(1):e);return t===void 0?void 0:fa(t)}function ha(e,t){let n=e;for(let e of t)if(Array.isArray(n)){if(!/^(0|[1-9]\d*)$/.test(e))return{found:!1};let t=Number(e);if(t>=n.length)return{found:!1};n=n[t]}else if(E(n)&&Object.hasOwn(n,e))n=n[e];else return{found:!1};return{found:!0,value:n}}function ga(e){return fa(e)?.at(-1)}var _a=26214400,va=/* @__PURE__ */ new WeakMap;function ya(e){let t=va.get(e);if(t===void 0){if(e.text.length>_a)t=null;else{let n=new $i;t={contents:la(e.text,{lineCounter:n,keepSourceTokens:!1,uniqueKeys:!1}).contents,lines:n}}va.set(e,t)}return t}function ba(e,t){let n=ya(e),r=fa(t);if(n===null||r===void 0)return;let i=n.contents,a=n.contents??void 0;for(let e of r)if(kt(i)){let t=i.items.find(t=>j(t.key)&&String(t.key.value)===e);if(t===void 0)break;a=j(t.key)?t.key:a,i=t.value}else if(At(i)){let t=i.items[Number(e)];if(t===void 0)break;i=t,(kt(t)||At(t)||j(t))&&(a=t)}else break;let o=a?.range?.[0];if(o===void 0)return;let{line:s,col:c}=n.lines.linePos(o);return{line:s,column:c}}function xa(e,t){return e.map(e=>{let n=e.location;if(n?.pointer===void 0||n.line!==void 0)return e;let r=t.byLocation(n.file);if(r===void 0)return e;let i=ba(r,n.pointer);return i===void 0?e:{...e,location:{...n,...i}}})}var Sa=e=>/^2(\d\d|XX)$/i.test(e)||e==="default",Ca=e=>/[/+]json(;|$)/i.test(e);function wa(e){return e.kind===`object`?e.properties.length>0:e.kind===`array`&&wa(e.items)}function Ta(e){return`${ee(e.method)} ${e.path}`}var Ea={"operation-id":({project:e})=>e.operations.filter(e=>e.operation.operationId===void 0).map(e=>({message:`${Ta(e.operation)} has no operationId: its function is named "${e.name}" after the method and path.`,source:e.operation.source,operation:e.operation,hint:`Add an operationId (an overlay can add it to a specification you do not own).`})),"operation-id-style":({project:e,config:t})=>e.operations.flatMap(e=>{let n=e.operation.operationId;if(n===void 0)return[];let r=ot(n,t.naming.operations);if(r===n)return[];let i=t.naming.operations;return[{message:ut(n)?`operationId "${n}" does not follow naming.operations ('${i}'): the function is exported as "${e.name}".`:`operationId "${n}" is not a JavaScript identifier; the function is exported as "${e.name}".`,source:e.operation.source,operation:e.operation,hint:ut(n)?`Rename the operationId to "${r}", or set naming.operations: 'preserve' to keep operationIds as they are.`:`Rename the operationId to "${r}".`}]}),"operation-tags":({project:e,config:t})=>t.output.groupBy===`none`?[]:e.operations.filter(e=>e.operation.tags.length===0).map(e=>({message:`${Ta(e.operation)} has no tags: it is generated into the "${e.group}" group.`,source:e.operation.source,operation:e.operation})),"undeclared-tag":({project:e})=>{let t=new Set(e.ir.tags.map(e=>e.name)),n=/* @__PURE__ */ new Map;for(let r of e.operations)for(let e of r.operation.tags)!t.has(e)&&!n.has(e)&&n.set(e,r.operation);return[...n].sort(([e],[t])=>O(e,t)).map(([e,t])=>({message:`Tag "${e}" is used by operations but not declared in the top-level tags.`,source:t.source,operation:t,hint:`Declare it with a description to document the group.`}))},"operation-summary":({project:e})=>e.operations.filter(e=>e.operation.summary===void 0&&e.operation.description===void 0).map(e=>({message:`${Ta(e.operation)} has no summary or description for the JSDoc of "${e.name}".`,source:e.operation.source,operation:e.operation})),"success-response":({project:e})=>e.operations.filter(e=>!e.operation.responses.some(e=>Sa(e.status))).map(e=>({message:`${Ta(e.operation)} documents no 2xx or default response: "${e.name}" resolves with void.`,source:e.operation.source,operation:e.operation})),"response-schema":({project:e})=>e.operations.flatMap(e=>e.operation.responses.filter(e=>Sa(e.status)).flatMap(t=>t.contents.filter(e=>Ca(e.mediaType)&&e.schema.kind===`unknown`).map(n=>({message:`The ${t.status} response of ${Ta(e.operation)} (${n.mediaType}) has no schema: "${e.name}" resolves with unknown.`,source:t.source,operation:e.operation})))),"inline-schema":({project:e})=>e.operations.flatMap(e=>{let t=e.operation;return[...(t.requestBody?.contents??[]).map(e=>({media:e,what:`request body`,source:t.requestBody?.source??t.source})),...t.responses.filter(e=>Sa(e.status)).flatMap(e=>e.contents.map(t=>({media:t,what:`${e.status} response`,source:e.source})))].filter(({media:e})=>Ca(e.mediaType)&&wa(e.schema)).map(({media:n,what:r,source:i})=>({message:`The ${r} of ${Ta(t)} (${n.mediaType}) is an inline object schema: its type is named after "${e.name}" and cannot be reused.`,source:i,operation:t,hint:`Move it to components/schemas and reference it.`}))}),"untyped-schema":({project:e})=>e.ir.schemas.filter(e=>e.schema.kind===`unknown`).map(e=>({message:`Schema ${e.name} has no type, properties or composition: it is generated as unknown.`,source:e.source})),"duplicate-schema":({project:e})=>Ze(e.ir).flatMap(t=>{let n=t.flatMap(t=>{let n=e.ir.schemas.find(e=>e.id===t);return n===void 0?[]:[n]}),[r,...i]=n;return r===void 0||i.length===0?[]:[{message:`Schemas ${n.map(e=>e.name).join(`, `)} are structurally identical: the client contains ${pe(n.length,`duplicate type`)}.`,source:r.source,hint:`Reference one schema from the others.`}]}),"unused-model":({project:e,config:t})=>{if(t.output.models===`used`)return[];let n=e.graph.usedSchemas();return e.models.filter(e=>!e.id.endsWith(mt)&&!n.has(e.id)&&!n.has(`${e.id}${mt}`)).map(e=>({message:`Schema ${e.definition.name} is not used by any operation but is generated as ${e.name}.`,source:e.definition.source,hint:`Set output.models: 'used' to generate only the models operations use, or remove the schema if nothing else references it (including references the generator does not follow, such as contentSchema).`}))},"missing-servers":({project:e,config:t})=>e.ir.servers.length>0||t.client.baseUrl!==void 0?[]:[{message:`The specification declares no server: the client has no default base URL.`,hint:`Add a server, set client.baseUrl, or call client.setConfig({ baseUrl }) at runtime.`}]};function Da(e){let t=/* @__PURE__ */ new Map;for(let n of te){let r=e.lint.rules[n.name];t.set(n.name,r===`off`?void 0:r??n.severity)}return t}function Oa(e,t,n){let r=Da(t),i=[];for(let a of te){let o=r.get(a.name);if(o!==void 0)for(let r of Ea[a.name]({project:e,config:t})){let e=r.source===void 0?t.spec.input:n?.byDisplay(r.source.file)?.location??r.source.file;i.push({code:`lint/${a.name}`,severity:o,message:r.message,location:{file:e,...r.source===void 0?{}:{pointer:r.source.pointer}},...r.operation===void 0?{}:{operation:`${Ta(r.operation)}${r.operation.operationId===void 0?``:` (${r.operation.operationId})`}`},...r.hint===void 0?{}:{hint:r.hint}})}}return n===void 0?i:xa(i,n)}function ka(e,t){return t.length<=e.length&&t.every((t,n)=>e[n]===t)}function Aa(e){let[t=[],...n]=e,r=t.length;for(let e of n){let n=0;for(;n<r&&e[n]===t[n];)n+=1;r=n}return t.slice(0,r)}function ja(e,t){if(t.every(t=>ka(t.key,e)))return e;let n=t.map(e=>e.key.length>=e.base.length&&e.base.every((t,n)=>e.key[e.key.length-e.base.length+n]===t)?e.key.slice(0,e.key.length-e.base.length):void 0),[r]=n;return r!==void 0&&n.every(e=>e!==void 0&&e.join(`\0`)===r.join(`\0`))?[...r,...e]:Aa(t.map(e=>e.key))}function Ma(e,t){let n=[e];for(let r=t.get(e);r!==void 0&&!n.includes(r);r=t.get(r))n.push(r);return n}function Na(e){return e.filter((t,n)=>!e.some((e,r)=>r!==n&&ka(t,e)&&(e.length<t.length||r<n)))}function Pa(e){let{operations:t,groups:n,parents:r,options:i,option:a,diagnostics:o}=e,s=e=>t.find(t=>t.name===e)??t.find(t=>t.operation.operationId===e),c=e=>e.query?.queryKey!==void 0,l=t.filter(c),u=[...new Set(t.flatMap(e=>[e.name,e.operation.operationId??e.name]))].sort(O),d=e=>`${ee(e.operation.method)} ${e.operation.path}`,f=e=>{let t=fe(e,u);return t===void 0?`Keys are generated operation names or operationIds.`:`Did you mean "${t}"?`},p=new Map(t.map(e=>{let t=e.operation.tags.length===0?[`default`]:e.operation.tags;return[e,new Set(t.flatMap(e=>Ma(e,r)))]})),m=/* @__PURE__ */ new Set([...e.tags,...[...p.values()].flatMap(e=>[...e])]),h=[.../* @__PURE__ */ new Set([...l.flatMap(e=>[e.name,e.operation.operationId??e.name]),...m,...n.map(e=>e.group)])].sort(O);for(let e of Object.keys(i.infinite).sort(O)){let t=s(e);t===void 0?o.warning({code:`query/unknown-operation`,message:`${a}.infinite: "${e}" is not an operation; no infinite query is generated for it.`,hint:f(e)}):c(t)||o.warning({code:`query/unknown-operation`,message:`${a}.infinite: "${e}" (${d(t)}) is not a query; infinite queries are generated for queries only.`,hint:"Queries are the operations whose method is listed in `queryMethods`."})}for(let e of Object.keys(i.invalidates).sort(O)){let t=s(e);t===void 0?o.warning({code:`query/unknown-operation`,message:`${a}.invalidates: "${e}" is not an operation; its targets are ignored.`,hint:f(e)}):c(t)&&o.warning({code:`query/unknown-operation`,message:`${a}.invalidates: "${e}" (${d(t)}) is a query; only mutations invalidate queries.`})}let g=(e,t)=>{let r=s(e);if(r?.query!==void 0&&c(r))return[r.query.keyPrefix];let i=m.has(e)?e:n.find(t=>t.group===e)?.tags.at(-1);if(i!==void 0){let r=l.filter(e=>p.get(e)?.has(i)===!0);if(r.length===0)return o.warning({code:`query/unknown-target`,message:`${t}: the tag "${e}" has no query operations; nothing is invalidated for it.`}),[];let a=r.map(e=>e.query?.keyPrefix??[]),s=n.find(e=>e.tags.at(-1)===i)?.prefix;return s!==void 0&&s.length>0&&l.every(e=>r.includes(e)||!ka(e.query?.keyPrefix??[],s))?[s,...a.filter(e=>!ka(e,s))]:a}let a=fe(e,h);return o.warning({code:`query/unknown-target`,message:r===void 0?`${t}: "${e}" is neither a query operation nor a tag; it is ignored.`:`${t}: "${e}" (${d(r)}) is not a query; only queries are invalidated.`,hint:a===void 0||a===e?`Targets are names or operationIds of queries, or tags.`:`Did you mean "${a}"?`}),[]};t.forEach((e,n)=>{let r=e.query;if(r===void 0||c(e))return;let o=ce(i.invalidates,e.name)===void 0?e.operation.operationId:e.name,s=o===void 0?void 0:ce(i.invalidates,o);if(o===void 0||s===void 0)return;let l=`${a}.invalidates.${o}`,u=Na(s.flatMap(e=>g(e,l)));t[n]={...e,query:{...r,invalidates:u.map(e=>[...e])}}})}function Fa(e){return e.kind===`string`&&(e.format===`date`||e.format===`date-time`)?e.format:void 0}function Ia(e,t=[]){if(e.kind===`ref`&&t.push(e.target),e.kind===`object`||e.kind===`union`)for(let n of e.discriminator?.mapping??[])t.push(n.target);return He(e,e=>{Ia(e,t)}),t}function La(e){if(Fa(e)!==void 0)return!0;let t=!1;return He(e,e=>{!t&&La(e)&&(t=!0)}),t}function Ra(e){let t=/* @__PURE__ */ new Map,n=/* @__PURE__ */ new Set;for(let r of e.schemas){La(r.schema)&&n.add(r.id);for(let e of Ia(r.schema)){let n=t.get(e);n===void 0?t.set(e,[r.id]):n.push(r.id)}}let r=[...n];for(let e=0;e<r.length;e++)for(let i of t.get(r[e]??``)??[])n.has(i)||(n.add(i),r.push(i));return n}var za=[`client`,`RequestOptions`],Ba=[`index`,`client`,`runtime`,`models`,`react-query`,`vue-query`,`svelte-query`,`solid-query`,`swr`,`zod`,`valibot`,`arktype`,`webhooks`,`callbacks`,`dates`,`mocks`];function Va(e){let{query:t,swr:n}=e.features;if(t!==!1)return{library:`${t.framework}-query`,options:t};if(n!==!1)return{library:`swr`,options:n}}function Ha(e){let{ir:t,config:n,diagnostics:r,hooks:i}=e,a=Xe.build(t),o=new ft,s=new ft({caseInsensitive:!0});za.forEach(e=>{o.reserve(e)}),Ba.forEach(e=>{s.reserve(e)});let c=n.naming.files,l=new Map(t.tags.flatMap(e=>e.parent===void 0?[]:[[e.name,e.parent]])),u=Ja(t.operations,n,l),d=a.usedSchemas(),f=n.types.dates===`Date`?Ra(t):/* @__PURE__ */ new Set,p=(n.output.models===`used`?t.schemas.filter(e=>d.has(e.id)):t.schemas).map(e=>{let t=ot(e.name,n.naming.models),r=i?.modelName?.(e,t);return{definition:e,preferred:r===void 0?t:ot(r,`preserve`)}}).sort((e,t)=>O(e.preferred,t.preferred)||O(e.definition.id,t.definition.id)),m=[];for(let{definition:e,preferred:t}of p){let i=o.claim(t);i!==t&&r.warning({code:`naming/collision`,message:`Model name "${t}" (from ${e.id}) is already taken; it is exported as "${i}".`});let a=s.claim(`models/${lt(i,c)}`,`-`),l=e.aliases.map(e=>o.claim(ot(e,n.naming.models))),u=n.features.validation,p=u===!1?void 0:o.claim(`${i}Schema`),h=u===!1?void 0:s.claim(`${u.library}/${lt(i,c)}`,`-`),g=f.has(e.id)?{datesName:o.claim(`${i}Dates`),datesModule:s.claim(`dates/${lt(i,c)}`,`-`)}:{};m.push({id:e.id,definition:e,name:i,module:a,aliases:l,used:d.has(e.id),...p===void 0?{}:{schemaName:p},...h===void 0?{}:{schemaModule:h},...g})}m.sort((e,t)=>O(e.name,t.name));let h=[],g=Va(n),_=g?.library===`svelte-query`||g?.library===`solid-query`,v=g!==void 0&&g.library!==`swr`;for(let e of t.operations){let t=ot(e.operationId??pt(e.method,e.path),n.naming.operations),a=i?.operationName?.(e,t),d=a===void 0?t:ot(a,`preserve`),f=o.claim(d);f!==d&&r.warning({code:`naming/collision`,message:`Operation name "${d}" (${ee(e.method)} ${e.path}) is already taken; it is exported as "${f}".`});let p=Xa(e,n,l,u),m=lt(f,c),y=s.claim(`${p}/${m}`,`-`),b=Ua(f,`PascalCase`),x=Ua(f,`camelCase`),S={params:o.claim(`${b}Params`),body:o.claim(`${b}Body`),response:o.claim(`${b}Response`),error:o.claim(`${b}Error`),apiError:o.claim(`${b}ApiError`),errorBody:o.claim(`${b}ErrorBody`),...(e.requestBody?.contents.length??0)>1?{bodies:o.claim(`${b}Bodies`)}:{}},C=o.claim(`is${b}ApiError`),{properties:te,body:ne,contentType:re}=Qa(e,n.naming.parameters),w;if(g!==void 0){let t=g.options,a=t.queryMethods.includes(e.method),c=ce(t.infinite,f)??(e.operationId===void 0?void 0:ce(t.infinite,e.operationId)),u=a?Ya(e,c?.pageParam,r):void 0,d=Ka(e,n,l),h=i?.queryKey?.(e,[...d,f])??[...d,f],y=_?`create${b}${a?`Query`:`Mutation`}`:`use${b}`;w={library:g.library,module:s.claim(`${g.library}/${p}/${m}`,`-`),hook:o.claim(y),keyPrefix:h,...a?{queryKey:o.claim(`${x}QueryKey`),queryKeyType:o.claim(`${b}QueryKey`),...v?{queryOptions:o.claim(`${x}QueryOptions`)}:{}}:v?{mutationOptions:o.claim(`${x}MutationOptions`)}:{},...u===void 0?{}:{pageParam:u,infiniteHook:o.claim(_?`create${b}InfiniteQuery`:`use${b}Infinite`),infiniteQueryKey:o.claim(`${x}InfiniteQueryKey`),infiniteQueryKeyType:o.claim(`${b}InfiniteQueryKey`),...v?{infiniteQueryOptions:o.claim(`${x}InfiniteQueryOptions`)}:{},pageParamType:o.claim(`${b}PageParam`)}}}h.push({key:e.key,operation:e,name:f,group:p,module:y,typeNames:S,errorGuard:C,parameterProperties:te,bodyProperty:ne,contentTypeProperty:re,...w===void 0?{}:{query:w}})}h.sort((e,t)=>O(e.group,t.group)||O(e.name,t.name));let y=[];if(g!==void 0&&n.output.groupBy===`tag`){let e=/* @__PURE__ */ new Map,t=/* @__PURE__ */ new Map;for(let n of h){let r=Ga(n.operation.tags[0]??`default`,l),i={key:n.query?.keyPrefix??[],base:[...r,n.name]};r.forEach((n,a)=>{let o=r.slice(0,a+1),s=u(o);e.has(s)||e.set(s,o),t.set(s,[...t.get(s)??[],i])})}for(let[n,r]of[...e].sort(([e],[t])=>O(e,t)))y.push({group:n,module:s.claim(`${g.library}/${n}/keys`,`-`),name:o.claim(ot(`${n} keys`,`camelCase`)),tags:r,prefix:ja(r,t.get(n)??[])})}g!==void 0&&Pa({operations:h,groups:y,tags:t.tags.map(e=>e.name),parents:l,options:g.options,option:g.library===`swr`?`features.swr`:`features.query`,diagnostics:r});let b=[];if(n.output.webhooks){let e=(e,t,n,r,i)=>{for(let a of t.operations){let s=`${n}${t.operations.length>1?it(a.method,`PascalCase`):``}${e===`webhook`?`Webhook`:`Callback`}`;b.push({kind:e,key:a.key,operation:a,webhook:t,...i===void 0?{}:{owner:i},module:r,typeNames:{payload:o.claim(`${s}Payload`),request:o.claim(`${s}Request`),response:o.claim(`${s}Response`),handler:o.claim(`${s}Handler`)}})}};for(let n of t.webhooks){let t=ot(n.name,`PascalCase`);e(`webhook`,n,t,s.claim(`webhooks/${lt(t,c)}`,`-`))}for(let t of h)for(let n of t.operation.callbacks??[]){let r=`${Ua(t.name,`PascalCase`)}${ot(n.name,`PascalCase`)}`;e(`callback`,n,r,s.claim(`callbacks/${lt(r,c)}`,`-`),t.key)}}let x,S,C;if(n.features.mocks!==!1){x=o.claim(`mockHandlers`),S=o.claim(`mockFetch`),C={name:o.claim(`startMocks`),options:o.claim(`StartMocksOptions`)};for(let e of[`mocks/fake`,`mocks/support`,`mocks/handlers`,`mocks/start`,`mocks/index`])s.reserve(e);m.forEach((e,t)=>{m[t]={...e,fixtureName:o.claim(`make${Ua(e.name,`PascalCase`)}`),fixtureModule:s.claim(`mocks/models/${lt(e.name,c)}`,`-`)}}),b.forEach((e,t)=>{let n=e.typeNames.request;b[t]={...e,mock:{module:s.claim(`mocks/${e.module}`,`-`),make:o.claim(`make${n}`),send:o.claim(`send${n.replace(/Request(\d*)$/,`$1`)}`)}}}),h.forEach((e,t)=>{let n=Ua(e.name,`PascalCase`);h[t]={...e,mock:{module:s.claim(`mocks/${e.module}`,`-`),name:o.claim(`mock${n}`),options:o.claim(`${n}MockOptions`),request:o.claim(`${n}MockRequest`)}}})}if(n.output.language===`javascript`){let e=a.recursiveSchemas();m.forEach((t,n)=>{let r=e.has(t.id)?Wa(t.definition.schema):0;r!==0&&(m[n]={...t,arrayTypedefs:Array.from({length:r},()=>o.claim(`${t.name}Array`))})})}return{queryGroups:y,webhooks:b,ir:t,graph:a,operations:h,models:m,operationByKey:new Map(h.map(e=>[e.key,e])),modelById:new Map(m.map(e=>[e.id,e])),...x===void 0?{}:{mockHandlers:x},...S===void 0?{}:{mockFetch:S},...C===void 0?{}:{mockStart:C}}}function Ua(e,t){let n=it(e,t);return n===``?t===`PascalCase`?`Unnamed`:`unnamed`:/^\d/.test(n)?`_${n}`:n}function Wa(e){switch(e.kind){case`array`:return 1;case`union`:return e.variants.some(e=>e.kind===`unknown`)?0:e.variants.reduce((e,t)=>e+Wa(t),0);case`intersection`:return e.members.reduce((e,t)=>e+Wa(t),0);default:return 0}}function Ga(e,t){let n=[e];for(let r=t.get(e);r!==void 0&&!n.includes(r);r=t.get(r))n.unshift(r);return n}function Ka(e,t,n){return t.output.groupBy===`tag`?Ga(e.tags[0]??`default`,n):[]}function qa(e,t){let n=e.map(e=>lt(e,t.naming.files)),r=n[0]??`default`;return Ba.includes(r.toLowerCase())&&(n[0]=`${r}-api`),n.join(`/`)}function Ja(e,t,n){let r=/* @__PURE__ */ new Map,i=e=>{let t=``;for(let n of e.split(`/`)){let e=t===``?n:`${t}/${n}`,i=e.toLowerCase(),a=r.get(i);a===void 0&&r.set(i,e),t=a??e}return t},a=e.flatMap(e=>{let r=Ga(e.tags[0]??`default`,n);return r.map((e,n)=>qa(r.slice(0,n+1),t))});for(let e of[...new Set(a)].sort(O))i(e);return e=>i(qa(e,t))}function Ya(e,t,n){if(t!==void 0){if(!e.parameters.some(e=>e.in===`query`&&e.name===t)){n.error({code:`query/invalid-page-param`,message:`Infinite query for ${ee(e.method)} ${e.path}: "${t}" is not a query parameter of the operation.`,hint:`Use one of: ${e.parameters.filter(e=>e.in===`query`).map(e=>e.name).join(`, `)||`(no query parameters)`}.`});return}return t}}function Xa(e,t,n,r){return t.output.groupBy===`none`?`operations`:r(Ga(e.tags[0]??`default`,n))}var Za={path:0,query:1,querystring:2,header:3,cookie:4};function Qa(e,t){let n=new ft,r=Array.from({length:e.parameters.length},()=>``),i=e.parameters.map((e,t)=>({parameter:e,index:t})).sort((e,t)=>Za[e.parameter.in]-Za[t.parameter.in]||e.index-t.index);for(let{parameter:e,index:a}of i){let i=t===`camelCase`?st(e.name,`camelCase`):e.name;r[a]=n.has(i)?n.claim(`${e.in}${it(e.name,`PascalCase`)}`):n.claim(i)}return{properties:r,body:e.requestBody===void 0?`body`:n.has(`body`)?n.claim(`requestBody`):n.claim(`body`),contentType:(e.requestBody?.contents.length??0)>1?n.has(`contentType`)?n.claim(`requestContentType`):n.claim(`contentType`):`contentType`}}var $a=class{#e;#t;#n;#r=/* @__PURE__ */ new Map;#i=/* @__PURE__ */ new Map;#a=/* @__PURE__ */ new Set;constructor(e,t,n){this.#e=e,this.#t=t,this.#n=n}get lang(){return this.#t}declare(e){this.#a.add(e)}global(e){return this.#a.has(e)?`globalThis.${e}`:e}specifier(e){let t=m.posix.relative(m.posix.dirname(this.#e),e);t.startsWith(`.`)||(t=`./${t}`);let n=`${t}${this.#n.extension}`;return this.#n.resolve?.({from:this.#e,to:e,specifier:n})??n}add(e,t,n){if(n.external!==!0&&e===this.#e)return t;let r=n.external===!0?e:this.specifier(e);if(n.typeOnly&&this.#t===`js`)return`import('${r}').${t}`;let i=this.#r.get(r);i===void 0&&(i=/* @__PURE__ */ new Map,this.#r.set(r,i));let a=i.get(t);if(a!==void 0)return n.typeOnly||(a.typeOnly=!1),a.local;let o=t=>this.#a.has(t)||tt.has(t)&&this.#o(e),s=n.local??t;if(o(s)){let r=n.alias??(this.#o(e)?`${t}Model`:`${t}_`);s=r;for(let e=2;o(s);e++)s=`${r}${e}`}return this.#a.add(s),i.set(t,{imported:t,local:s,typeOnly:n.typeOnly}),s}namespace(e,t,n){if(n.typeOnly&&this.#t===`js`)return`import('${e}')`;let r=this.#i.get(e);if(r!==void 0)return n.typeOnly||(r.typeOnly=!1),r.local;let i=t;for(let e=2;this.#a.has(i);e++)i=`${t}${e}`;return this.#a.add(i),this.#i.set(e,{imported:`*`,local:i,typeOnly:n.typeOnly}),i}#o(e){return e.startsWith(`models/`)}render(){let e=[],t=[.../* @__PURE__ */ new Set([...this.#r.keys(),...this.#i.keys()])].sort((e,t)=>{let n=!e.startsWith(`.`);return n===!t.startsWith(`.`)?O(e,t):n?-1:1});for(let n of t){let t=this.#i.get(n);if(t!==void 0&&(this.#t!==`js`||!t.typeOnly)){let r=t.typeOnly||this.#t===`dts`;e.push(`import ${r?`type `:``}* as ${t.local} from '${n}';`)}let r=[...this.#r.get(n)?.values()??[]].sort((e,t)=>O(e.imported,t.imported)),i=this.#t===`js`?r.filter(e=>!e.typeOnly):r;if(i.length===0)continue;let a=i.every(e=>e.typeOnly)||this.#t===`dts`,o=a?void 0:i.find(e=>e.imported==="default"),s=i.filter(e=>e!==o).map(e=>{let t=e.imported===e.local?e.imported:`${e.imported} as ${e.local}`;return!a&&e.typeOnly&&this.#t===`ts`?`type ${t}`:t}),c=a&&this.#t!==`js`?`import type`:`import`,l=[...o===void 0?[]:[o.local],...s.length===0?[]:[`{ ${s.join(`, `)} }`]];e.push(`${c} ${l.join(`, `)} from '${n}';`)}return e.length===0?``:`${e.join(`
`)}
`}},eo=`@generated by ${T}`;function to(e){let t=[`/* eslint-disable */`,`// ${eo}. Do not edit: this file is overwritten on the next generation.`];if(e.output.banner!==void 0)for(let n of e.output.banner.replace(/[\u2028\u2029\r]/g,`
`).split(`
`))t.push(`// ${n}`.trimEnd());return`${t.join(`
`)}
`}function no(e){let t=e.output.importExtension;return t===`none`?``:t===`.ts`&&e.output.language===`typescript`?`.ts`:`.js`}function ro(e,t,n,r){let i=n.hooks.resolveImport,a=new $a(e,t,{extension:no(n.config),...i===void 0?{}:{resolve:i}}),o=r(a).replace(/\n{3,}/g,`

`).trimEnd(),s=a.render(),c=s!==``||/^export /m.test(o);return`${[to(n.config),s,o,c?``:`export {};`].filter(e=>e!==``).join(`
`)}
`}function I(e,t,n){return{ts:ro(e,`ts`,t,e=>n(e,`ts`)),js:ro(e,`js`,t,e=>n(e,`js`)),dts:ro(e,`dts`,t,e=>n(e,`dts`))}}var io=/* @__PURE__ */ new Set([`param`,`returns`,`typedef`,`property`,`template`,`type`]),ao=e=>io.has(e.tag)&&e.text!==void 0&&e.text.startsWith(`{`)&&!e.text.startsWith(`{@`);function oo(e,t,n){return e.config.features.jsdoc?e.hooks.jsdoc?.(t,n)??t:{tags:t.tags.filter(e=>e.tag===`deprecated`||ao(e))}}function so(e){let t=e=>({name:e,typeOnly:!1}),n=e=>({name:e,typeOnly:!0});return[{module:`runtime/client`,names:[t(`createClient`)]},{module:`runtime/errors`,names:[t(`ApiError`),t(`RequestError`),t(`isApiError`),t(`isRequestError`),n(`OperationError`),n(`RequestErrorKind`)]},{module:`runtime/middleware`,names:[t(`retry`),t(`refreshAuth`),n(`RetryOptions`),n(`RefreshAuthOptions`)]},{module:`runtime/${e}`,names:e===`axios`?[t(`createAxiosTransport`),n(`AxiosTransportOptions`)]:[t(`createFetchTransport`),t(`fetchTransport`),n(`FetchTransportOptions`),n(`FetchTransportConfig`)]},{module:`runtime/types`,names:[`ApiResponse`,`AuthValue`,`Client`,`ClientConfig`,`HeaderValues`,`HttpMethod`,`HttpStatus`,`Middleware`,`MiddlewareContext`,`OperationInfo`,`OperationRequest`,`ParseAs`,`RetryableContext`,`RetryDirective`,`SecurityScheme`,`Transport`,`TransportRequest`,`TransportResponse`].map(n)}]}function co(e){let t=/* @__PURE__ */ new Set;for(let n of e.models)t.add(n.name),n.aliases.forEach(e=>t.add(e));for(let n of e.operations)t.add(n.name),t.add(n.errorGuard),Object.values(n.typeNames).forEach(e=>t.add(e));for(let n of e.webhooks)Object.values(n.typeNames).forEach(e=>t.add(e));return t}function lo(e,t){let n=t.filter(e=>[`core:model`,`core:operation`,`core:webhook`,`core:callback`].includes(e.origin)),r=co(e.project),i=so(e.config.client.adapter).map(e=>({module:e.module,names:e.names.filter(e=>!r.has(e.name))})),a=I(`index`,e,(e,t)=>{let r=t=>e.specifier(t),a=[`export * from '${r(`client`)}';`];for(let e of i){let n=e.names.filter(e=>!e.typeOnly).map(e=>e.name),i=e.names.filter(e=>e.typeOnly).map(e=>e.name);n.length>0&&a.push(`export { ${n.join(`, `)} } from '${r(e.module)}';`),i.length>0&&t!==`js`&&a.push(`export type { ${i.join(`, `)} } from '${r(e.module)}';`)}for(let e of n)a.push(`export * from '${r(e.module)}';`);return`${a.join(`
`)}
`}),o=[{name:`client`,kind:`client`,typeOnly:!1},{name:`RequestOptions`,kind:`runtime`,typeOnly:!0},...i.flatMap(e=>e.names.map(e=>({name:e.name,kind:`runtime`,typeOnly:e.typeOnly}))),...n.flatMap(e=>e.exports)];return{module:`index`,origin:`core:barrel`,...a,exports:o}}function L(e){let t=`'`;for(let n of e){let e=n.codePointAt(0)??0;switch(n){case`\\`:t+=`\\\\`;break;case`'`:t+=`\\'`;break;case`
`:t+=`\\n`;break;case`\r`:t+=`\\r`;break;case`	`:t+=`\\t`;break;case`\u2028`:t+=`\\u2028`;break;case`\u2029`:t+=`\\u2029`;break;default:t+=e<32||e===127?`\\u${e.toString(16).padStart(4,`0`)}`:n}}return`${t}'`}function R(e){return e===`__proto__`?`[${L(e)}]`:dt(e)?e:L(e)}function uo(e,t,n=!1){return dt(t)?`${e}${n?`?.`:`.`}${t}`:`${e}${n?`?.`:``}[${L(t)}]`}function z(e){if(typeof e==`string`)return L(e);if(typeof e==`number`)return Number.isFinite(e)?String(e):`null`;if(typeof e==`boolean`||e===null)return String(e);if(Array.isArray(e))return`[${e.map(z).join(`, `)}]`;if(typeof e==`object`){let t=Object.entries(e).map(([e,t])=>`${R(e)}: ${z(t)}`);return t.length===0?`{}`:`{ ${t.join(`, `)} }`}return`undefined`}function fo(e){return e.replace(/\*\//g,`*\\/`).replace(/\r\n?/g,`
`).replace(/[\u2028\u2029]/g,`
`)}function po(e){return fo(e).split(`
`).map(e=>e.replace(/(^|\s)@/g,`$1\\@`).trimEnd()).join(`
`)}function B(e,t=``){if(e===void 0)return``;let n=[],r=e=>{for(let t of po(e.trim()).split(`
`))n.push(t)};e.summary!==void 0&&e.summary.trim()!==``&&r(e.summary),e.description!==void 0&&e.description.trim()!==``&&(n.length>0&&n.push(``),r(e.description)),e.tags.length>0&&n.length>0&&n.push(``);for(let t of e.tags){let[e=``,...r]=(t.text===void 0?``:po(t.text.trim())).split(`
`);n.push(`@${t.tag}${e===``?``:` ${e}`}`.trimEnd());for(let e of r)n.push(e)}let i=n.filter((e,t)=>e!==``||n[t-1]!==``);for(;i.at(-1)===``;)i.pop();return i.length===0?``:i.length===1?`${t}/** ${i[0]??``} */
`:`${t}/**
${i.map(e=>`${t} *${e===``?``:` ${e}`}`).join(`
`)}
${t} */
`}function mo(e,t){if(t!==void 0)return t;let n=e[0];return n===void 0?``:n.url.replace(/\{([^}]+)\}/g,(e,t)=>n.variables[t]?.default??e)}function ho(e){let t={};for(let n of e)switch(n.type){case`apiKey`:t[n.key]={type:`apiKey`,in:n.in,name:n.name};break;case`http`:t[n.key]={type:`http`,scheme:n.scheme};break;case`oauth2`:case`openIdConnect`:t[n.key]={type:n.type}}return t}function go(e){let{config:t,project:n}=e,r=t.client.adapter===`axios`,i=`runtime/${t.client.adapter}`,a=r?`AxiosTransportOptions`:`FetchTransportOptions`,o=[`baseUrl: ${L(mo(n.ir.servers,t.client.baseUrl))}`],s=ho(n.ir.securitySchemes);Object.keys(t.client.headers).length>0&&o.push(`headers: ${z(t.client.headers)}`),t.client.timeout!==void 0&&o.push(`timeout: ${t.client.timeout}`),t.client.includeCredentials&&o.push(`credentials: 'include'`),t.client.operationServers||o.push(`operationServers: false`),Object.keys(s).length>0&&o.push(`securitySchemes: ${z(s)}`);let c=B({summary:`The client used by generated operations.`,description:"Configure it once at startup, for example:\n\n```ts\nclient.setConfig({ baseUrl: 'https://api.example.com', auth: { bearerAuth: () => getToken() } });\n```\n\nPass `{ client }` in the per-call options to use another instance created with `createClient()`.",tags:[]}),l={summary:`Per-call options accepted by every generated operation.`,tags:[]};return{module:`client`,origin:`core:client`,...I(`client`,e,(e,t)=>{e.declare(`client`),e.declare(`RequestOptions`);let n=e.add(i,a,{typeOnly:!0}),s=e.add(`runtime/types`,`RequestOptions`,{typeOnly:!0,alias:`RuntimeRequestOptions`}),u=e.add(`runtime/types`,`Client`,{typeOnly:!0}),d=`${s}<${n}>`;if(t===`dts`)return[`${B(l)}export type RequestOptions = ${d};
`,`${c}export declare const client: ${u}<${n}>;
`].join(`
`);let f=e.add(`runtime/client`,`createClient`,{typeOnly:!1}),p=r?`/* @__PURE__ */ ${e.add(i,`createAxiosTransport`,{typeOnly:!1})}()`:e.add(i,`fetchTransport`,{typeOnly:!1}),m=`{
${[...o.slice(0,1),`transport: ${p}`,...o.slice(1)].map(e=>`  ${e},`).join(`
`)}
}`;return t===`ts`?[`${B(l)}export type RequestOptions = ${d};
`,`${c}export const client: ${u}<${n}> = /* @__PURE__ */ ${f}<${n}>(${m});
`].join(`
`):[B({...l,tags:[{tag:`typedef`,text:`{${d}} RequestOptions`}]}),`${B({summary:`The client used by generated operations.`,description:"Configure it once at startup with `client.setConfig()`.",tags:[{tag:`type`,text:`{${u}<${n}>}`}]})}export const client = /* @__PURE__ */ ${f}(${m});
`].join(`
`)}),exports:[{name:`client`,kind:`client`,typeOnly:!1},{name:`RequestOptions`,kind:`runtime`,typeOnly:!0}]}}function _o(e){let t=JSON.stringify(e);return t.length>500?void 0:t}function vo(e){if(e===void 0||e.trim()===``)return{};let t=e.trim(),n=t.search(/\n\s*\n/);return n===-1?{summary:t}:{summary:t.slice(0,n).trim(),description:t.slice(n).trim()}}function yo(e){let t=[];e.deprecated===!0&&t.push({tag:`deprecated`}),e.format!==void 0&&e.format!==`binary`&&t.push({tag:`format`,text:e.format});let n=`constraints`in e?{...e.constraints}:{};for(let[e,r]of Object.entries(n))e===`contentEncoding`||e===`contentMediaType`||(typeof r==`number`||typeof r==`string`||typeof r==`boolean`)&&t.push({tag:e,text:String(r)});if(e.default!==void 0){let n=_o(e.default);n!==void 0&&t.push({tag:`default`,text:n})}let r=e.examples?.[0];if(r!==void 0){let e=_o(r);e!==void 0&&t.push({tag:`example`,text:e})}return t}function bo(e,t){return{...vo(e.description??e.title??t),tags:yo(e)}}var xo={text:`unknown`,operator:void 0},So={text:`null`,operator:void 0},V=e=>({text:e,operator:void 0});function Co(e,t){return e.operator!==void 0&&(t===`array`||e.operator!==t)?`(${e.text})`:e.text}function wo(e){if(e===null)return`null`;if(typeof e==`string`)return L(e);if(typeof e==`number`)return Number.isFinite(e)?String(e):void 0;if(typeof e==`boolean`)return String(e)}function To(e,t){let n=e.filter((t,n)=>e.findIndex(e=>e.text===t.text)===n),r=n.map(e=>Co(e,t)),i=n[0];return n.length===1&&i!==void 0?r[0]===i.text?i:V(r[0]??i.text):{text:r.join(t===`union`?` | `:` & `),operator:t}}function Eo(e){if(e.some(e=>e.text===`unknown`))return xo;let t=e.length>1?e.filter(e=>e.text!==`never`):e;return To(t.length===0?e:t,`union`)}function Do(e,t,n=``){return Oo(e,t,n).text}function Oo(e,t,n=``){let r=jo(e,t,n);return e.nullable!==!0||r.text===`unknown`||r.text===`null`?r:Eo([r,So])}function ko(e,t){let n=t.local?.get(e);if(n!==void 0)return n;let r=t.project.modelById.get(e);return r===void 0?`unknown`:t.imports.add(r.module,r.name,{typeOnly:!0})}function Ao(e){let t=t=>e.imports.global(t);return e.direction===`input`?{text:`${t(`Blob`)} | ${t(`ArrayBuffer`)} | ${t(`ArrayBufferView`)}`,operator:`union`}:V(t(`Blob`))}function jo(e,t,n){switch(e.kind){case`ref`:return V(ko(e.target,t));case`string`:return V(t.config.types.dates===`Date`&&Fa(e)!==void 0?t.imports.global(`Date`):`string`);case`number`:case`integer`:return V(`number`);case`boolean`:return V(`boolean`);case`null`:return So;case`binary`:return Ao(t);case`unknown`:return xo;case`never`:return V(`never`);case`enum`:{let t=e.values.map(wo);return t.some(e=>e===void 0)?xo:Eo(t.filter(e=>e!==void 0).map(V))}case`array`:{let r={...t,hoistArray:void 0},i=Oo(e.items,r,n),a;if(e.prefixItems!==void 0){let t=e.prefixItems.map(e=>Do(e,r,n)),o=e.items.kind===`never`?[]:[`...${Co(i,`array`)}[]`];a=`[${[...t,...o].join(`, `)}]`}else a=`${Co(i,`array`)}[]`;return V(t.hoistArray===void 0?a:t.hoistArray(a))}case`object`:return No(e,{...t,hoistArray:void 0},n);case`union`:return e.variants.some(e=>e.kind===`unknown`)?xo:Eo(e.variants.map(r=>{let i=Oo(r,t,n),a=Mo(e.discriminator,r);if(a.length===0||e.discriminator===void 0)return i;let o=`{ ${R(e.discriminator.propertyName)}: ${a.map(L).join(` | `)} }`;return{text:`${Co(i,`intersection`)} & ${o}`,operator:`intersection`}}));case`intersection`:{let r=e.members.map(e=>Oo(e,t,n)).filter(e=>e.text!==`unknown`);return r.length===0?xo:To(r,`intersection`)}}}function Mo(e,t){return e===void 0||t.kind!==`ref`?[]:e.mapping.filter(e=>e.target===t.target).map(e=>e.value)}function No(e,t,n){let{properties:r,additionalProperties:i}=e,a=t.imports.global(`Record`),o=i===void 0||i===!1?void 0:Oo(i,t,n);if(r.length===0){if(i===!1)return V(`${a}<string, never>`);let e=t.project.graph.recursiveSchemas();return i!==void 0&&Je(i,t=>t.kind===`ref`&&e.has(t.target))?V(`{ [key: string]: ${o?.text??`unknown`} }`):V(`${a}<string, ${o?.text??`unknown`}>`)}let s=t.imports.lang===`js`,c=!s&&t.config.features.jsdoc,l=t.config.types.readonlyProperties&&t.direction!==`input`,u=`${n}  `,d=r.map(e=>Oo(e.schema,t,u)),f=r.map((e,t)=>{let n=l&&e.schema.readOnly===!0?`readonly `:``,r=e.required?``:`?`,i=`${n}${R(e.name)}${r}: ${d[t]?.text??`unknown`};`;return{doc:c?B(bo(e.schema),u):``,member:i}});if(o!==void 0){let e=[o,...d];r.some(e=>!e.required)&&e.push(V(`undefined`)),f.push({doc:``,member:`[key: string]: ${Eo(e).text};`})}return V(s?`{ ${f.map(e=>e.member).join(` `)} }`:`{
${f.map(e=>`${e.doc}${u}${e.member}`).join(`
`)}
${n}}`)}function Po(e){if(e?.kind===`object`)return e.discriminator;if(e?.kind===`intersection`){for(let t of e.members)if(t.kind===`object`&&t.discriminator!==void 0)return t.discriminator}}function Fo(e,t){let n=e.definition.schema;if(n.kind!==`intersection`)return[];let r=[];for(let i of n.members){if(i.kind!==`ref`)continue;let n=Po(t.project.modelById.get(i.target)?.definition.schema);if(n===void 0)continue;let a=n.mapping.filter(t=>t.target===e.id).map(e=>e.value);a.length>0&&r.push({property:n.propertyName,values:a})}return r}function Io(e){let t=e.extensions?.[`x-enum-varnames`]??e.extensions?.[`x-enumNames`],n=Array.isArray(t)&&t.length===e.values.length&&t.every(e=>typeof e==`string`)?t:void 0,r=new ft;return e.values.map((e,t)=>{let i=n?.[t]??Lo(e);return r.claim(ot(i,`PascalCase`))})}function Lo(e){return typeof e==`string`?e===``?`Empty`:it(e,`PascalCase`)||`Value ${e}`:typeof e==`number`?`Value ${e<0?`Minus ${-e}`:String(e)}`.replace(`.`,` `):JSON.stringify(e)}function Ro(e,t){return t.config.types.enums===`const`&&e.kind===`enum`&&e.values.every(e=>typeof e==`string`||typeof e==`number`)}function zo(e,t){return oo(t,bo(e.definition.schema),{kind:`model`,definition:e.definition})}function Bo(e,t,n,r,i){let a=n.tags.filter(e=>e.tag===`deprecated`);if(i===void 0&&t.kind===`object`&&t.nullable!==!0&&t.additionalProperties===void 0&&t.properties.length>0&&t.properties.every(e=>dt(e.name))){a.push({tag:`typedef`,text:`{object} ${e}`});for(let e of t.properties){let t=(e.schema.description??``).split(`
`)[0]??``,n=e.required?e.name:`[${e.name}]`;a.push({tag:`property`,text:`{${Do(e.schema,r)}} ${n}${t===``?``:` - ${t}`}`})}}else{let n=Oo(t,r);a.push({tag:`typedef`,text:`{${i===void 0?n.text:`${Co(n,`intersection`)} & ${i}`}} ${e}`})}return B({...n,tags:a})}function Vo(e,t,n){let r=e.arrayTypedefs??[];if(r.length===0)return{typeCtx:t,helpers:()=>``};let i=/* @__PURE__ */ new Map,a=e=>{let t=i.get(e);if(t!==void 0)return t;let n=r[i.size];return n===void 0?e:(i.set(e,n),n)},o=()=>[...i].map(([t,r])=>B({...n.config.features.jsdoc?{summary:`An array type of {@link ${e.name}}.`}:{},tags:[{tag:`typedef`,text:`{${t}} ${r}`}]})).join(`
`);return{typeCtx:{...t,hoistArray:a},helpers:o}}function Ho(e,t){let{definition:n}=e,r=n.schema,i=zo(e,t),a=Ro(r,t),o=[{name:e.name,kind:`model`,typeOnly:!a},...e.aliases.map(e=>({name:e,kind:`model`,typeOnly:!0}))];return{module:e.module,origin:`core:model`,...I(e.module,t,(n,o)=>{for(let t of[e.name,...e.aliases,...e.arrayTypedefs??[]])n.declare(t);let s={imports:n,project:t.project,config:t.config,local:/* @__PURE__ */ new Map([[e.id,e.name]]),direction:`output`},c=Fo(e,t).map(({property:e,values:t})=>`{ ${R(e)}: ${t.map(L).join(` | `)} }`),l=c.length===0?void 0:c.join(` & `),u=[];if(a){let t=Io(r),n=r.values.map((e,n)=>`${t[n]??`Value`}: ${z(e)}`),a=`(typeof ${e.name})[keyof typeof ${e.name}]`;if(o===`ts`)u.push(`${B(i)}export const ${e.name} = {
${n.map(e=>`  ${e},`).join(`
`)}
} as const;
`),u.push(`${B(i)}export type ${e.name} = ${a};
`);else if(o===`dts`){let n=r.values.map((e,n)=>`  readonly ${t[n]??`Value`}: ${z(e)};`);u.push(`${B(i)}export declare const ${e.name}: {
${n.join(`
`)}
};
`),u.push(`${B(i)}export type ${e.name} = ${a};
`)}else u.push(`${B(i)}export const ${e.name} = /* @__PURE__ */ Object.freeze({
${n.map(e=>`  ${e},`).join(`
`)}
});
`),u.push(B({...i,tags:[{tag:`typedef`,text:`{${a}} ${e.name}`}]}))}else if(o===`js`){let n=Vo(e,s,t),a=Bo(e.name,r,i,n.typeCtx,l),o=n.helpers();o!==``&&u.push(o),u.push(a)}else{let t=Oo(r,s),n=l===void 0?t.text:`${Co(t,`intersection`)} & ${l}`;u.push(`${B(i)}export type ${e.name} = ${n};
`)}for(let t of e.aliases){let n={summary:`Alias of {@link ${e.name}}.`,tags:[]};u.push(o===`js`?B({...n,tags:[{tag:`typedef`,text:`{${e.name}} ${t}`}]}):`${B(n)}export type ${t} = ${e.name};
`)}return u.join(`
`)}),exports:o,sources:{schemas:[e.id]}}}var Uo=e=>{let t=(e.split(`;`)[0]??``).trim().toLowerCase();return t===`application/json`||t.endsWith(`+json`)||t===`*/*`};function Wo(e,t){let n=e.mediaType.toLowerCase();return Uo(n)?0:t===`request`&&n.startsWith(`multipart/form-data`)?1:t===`request`&&n.startsWith(`application/x-www-form-urlencoded`)?2:n.startsWith(`text/`)?3:e.schema.kind===`binary`?4:5}function Go(e,t){let n,r=1/0;for(let i of e){let e=Wo(i,t);e<r&&(n=i,r=e)}return n}function Ko(e){let t=(e.mediaType.split(`;`)[0]??``).trim().toLowerCase();return Uo(t)?`json`:t===`multipart/form-data`?`multipart`:t===`application/x-www-form-urlencoded`?`urlencoded`:e.schema.kind===`binary`?`binary`:t.startsWith(`text/`)||e.schema.kind===`string`?`text`:`raw`}function qo(e){return e.kind===`string`||e.kind===`enum`&&e.values.every(e=>typeof e==`string`)}function Jo(e){return e.startsWith(`text/`)||e===`application/xml`||e.endsWith(`+xml`)||e===`application/x-www-form-urlencoded`||e===`application/javascript`||e===`application/jsonl`||e===`application/x-ndjson`||e===`application/json-seq`||e.endsWith(`+json-seq`)}function Yo(e,t){if(t===`blob`)return`binary`;if(t===`text`)return`text`;let n=(e.mediaType.split(`;`)[0]??``).trim().toLowerCase();return Uo(n)||n===`text/json`?`json`:e.schema.kind===`binary`?`binary`:Jo(n)?`text`:`binary`}function Xo(e){return/^[23](\d\d|XX)$/i.test(e)}function Zo(e,t){let n=e.operation,r=n.parameters.map((t,n)=>({property:e.parameterProperties[n]??t.name,parameter:t})),i=n.requestBody===void 0?void 0:Go(n.requestBody.contents,`request`),a=n.requestBody===void 0||i===void 0?void 0:{property:e.bodyProperty,contentTypeProperty:e.contentTypeProperty,media:i,alternatives:n.requestBody.contents.filter(e=>e!==i),required:n.requestBody.required},o=n.responses.some(e=>/^2(\d\d|XX)$/i.test(e.status)),s=e=>o?Xo(e.status):e.status==="default",c=n.method===`head`,l=e=>({response:e,media:c?void 0:Go(e.contents,`response`)}),u=n.responses.filter(s).map(l),d=n.responses.filter(e=>!s(e)).map(l),f=u.map(e=>e.media).filter(e=>e!==void 0),p=f[0]?.mediaType,m;f.length>0&&f.every(e=>e.schema.kind===`binary`)?m=`blob`:f.length>0&&f.every(e=>e.mediaType.toLowerCase().startsWith(`text/`)||e.itemSchema!==void 0)&&(m=`text`);let h=n.security??t.security,g=h.length===0?void 0:h.map(e=>Object.keys(e).sort());return{symbol:e,parameters:r,body:a,hasParams:r.length>0||a!==void 0,paramsRequired:r.some(e=>e.parameter.required)||a?.required===!0,success:u,errors:d,successStatuses:u.map(e=>e.response.status.toUpperCase()).filter(e=>e.startsWith(`3`)),server:n.servers===void 0||n.servers.length===0?void 0:mo(n.servers,void 0),accept:p===`*/*`?void 0:p,parseAs:m,security:g}}function Qo(e,t,n){let r=Fa(e);if(r!==void 0)return{kind:`leaf`,format:r};switch(e.kind){case`ref`:{let r=t.modelById.get(e.target);return r?.datesName===void 0||r.datesModule===void 0?void 0:{kind:`ref`,name:n.add(r.datesModule,r.datesName,{typeOnly:!1})}}case`array`:{let r=e.items.kind===`never`?void 0:Qo(e.items,t,n);if(e.prefixItems===void 0)return r===void 0?void 0:{kind:`array`,item:r};let i=e.prefixItems.map(e=>Qo(e,t,n));return r===void 0&&i.every(e=>e===void 0)?void 0:{kind:`tuple`,items:i,...r===void 0?{}:{rest:r}}}case`object`:{let r=[];for(let i of e.properties){let e=Qo(i.schema,t,n);e!==void 0&&r.push([i.name,e])}let i=e.additionalProperties===void 0||e.additionalProperties===!1?void 0:Qo(e.additionalProperties,t,n);return r.length===0&&i===void 0?void 0:{kind:`object`,fields:r,...i===void 0?{}:{rest:i}}}case`union`:if(e.discriminator!==void 0){let r=[];for(let i of e.discriminator.mapping){let e=Qo({kind:`ref`,target:i.target},t,n);e!==void 0&&r.push([i.value,e])}if(r.length>0)return{kind:`discriminator`,property:e.discriminator.propertyName,mapping:r}}return $o(e.variants.map(e=>Qo(e,t,n)));case`intersection`:return $o(e.members.map(e=>Qo(e,t,n)));default:return}}function $o(e){let t=[],n=/* @__PURE__ */ new Set;for(let r of e){if(r===void 0)continue;let e=ts(r,``);n.has(e)||(n.add(e),t.push(r))}return t.length<=1?t[0]:{kind:`anyOf`,items:t}}var es=72;function ts(e,t){let n=`${t}  `,r=(e,r,i)=>{let a=`${e} ${r.join(`, `)} ${i}`;return r.length===0?`${e}${i}`:a.length<=es&&!a.includes(`
`)?a:`${e}
${r.map(e=>`${n}${e},`).join(`
`)}
${t}${i}`};switch(e.kind){case`leaf`:return L(e.format);case`ref`:return`() => ${e.name}`;case`array`:return r(`{`,[`array: ${ts(e.item,n)}`],`}`);case`tuple`:return r(`{`,[`tuple: [${e.items.map(e=>e===void 0?`null`:ts(e,n)).join(`, `)}]`,...e.rest===void 0?[]:[`rest: ${ts(e.rest,n)}`]],`}`);case`object`:return r(`{`,[`object: ${r(`{`,e.fields.map(([e,t])=>`${R(e)}: ${ts(t,`${n}  `)}`),`}`).replace(/\n/g,`
  `)}`,...e.rest===void 0?[]:[`rest: ${ts(e.rest,n)}`]],`}`);case`anyOf`:return r(`{`,[`anyOf: [${e.items.map(e=>ts(e,n)).join(`, `)}]`],`}`);case`discriminator`:{let t=e.mapping.map(([e,t])=>`${R(e)}: ${ts(t,`${n}  `)}`);return r(`{`,[`discriminator: ${L(e.property)}`,`mapping: ${r(`{`,t,`}`).replace(/\n/g,`
  `)}`],`}`)}}}function ns(e,t,n,r=``){let i=Qo(e,t,n);return i===void 0?void 0:ts(i,r)}function rs(e,t,n,r=``){let i=$o(e.map(e=>Qo(e,t,n)));return i===void 0?void 0:ts(i,r)}function is(e,t){let{datesName:n,datesModule:r}=e;if(n!==void 0&&r!==void 0)return{module:r,origin:`core:dates`,...I(r,t,(r,i)=>{r.declare(n);let a=ns(e.definition.schema,t.project,r)??`{ object: {} }`,o=r.add(`runtime/dates`,`DateShape`,{typeOnly:!0}),s=B({summary:`Where \`Date\` values sit in \`${e.name}\`; converts responses and requests.`,tags:i===`js`?[{tag:`type`,text:`{${o}}`}]:[]});return i===`dts`?`${s}export declare const ${n}: ${o};
`:`${s}export const ${n}${i===`ts`?`: ${o}`:``} = ${a};
`}),exports:[{name:n,kind:`runtime`,typeOnly:!1}],sources:{schemas:[e.id]}}}function as(e,t){return e.datesName===void 0?t.add(e.module,e.name,{typeOnly:!0}):`unknown`}var os=`/^\\d{4}-\\d{2}-\\d{2}[Tt]\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:[Zz]|[+-]\\d{2}:\\d{2})$/`,ss=`(value) => !Number.isNaN(Date.parse(value))`,cs=/* @__PURE__ */ new Set([`__defineGetter__`,`__defineSetter__`,`__lookupGetter__`,`__lookupSetter__`,`__proto__`,`constructor`,`hasOwnProperty`,`isPrototypeOf`,`propertyIsEnumerable`,`toLocaleString`,`toString`,`valueOf`]);function ls(e){return!e.required&&cs.has(e.name)}function us(e){return`${e===`js`?`/** @param {unknown} value */ (value)`:`(value: unknown)`} =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.assign(${e===`js`?`/** @type {object} */ (Object.create(null))`:`(Object.create(null) as object)`}, value)
    : value`}function ds(e){return e.assertions===void 0?e.kind===`unknown`||e.kind===`union`&&e.variants.some(ds):!1}function fs(e,t){if(e.kind===`object`)return e;if(e.kind!==`ref`)return;let n=t.project.modelById.get(e.target)?.definition.schema;return n?.kind===`object`&&e.nullable!==!0?n:void 0}function ps(e,t,n=/* @__PURE__ */ new Set){let r=e.map(e=>e.kind===`ref`&&n.has(e.target)?void 0:fs(e,t)),i=e=>e?.additionalProperties===!1&&e.properties.length>0;if(e.length<2||!r.some(i))return{relaxed:e,inlined:n};let a=new Set(n),o=e.map((e,t)=>{let n=r[t];if(!i(n))return e;e.kind===`ref`&&a.add(e.target);let{additionalProperties:o,...s}=n;return s});return r.every(i)?{relaxed:o,closedKeys:[...new Set(r.flatMap(e=>e.properties.map(e=>e.name)))],inlined:a}:{relaxed:o,inlined:a}}var ms=`arktype/support`,hs=e=>e.add(`arktype`,`type`,{typeOnly:!1,external:!0}),gs=(e,t)=>`${e.add(`arktype`,`Type`,{typeOnly:!0,external:!0})}<${t}>`,_s=(e,t)=>e.add(ms,t,{typeOnly:!1});function vs(e,t){let n=/^(\[|\.\.\.|\+)/.test(e)?`\\${e}`:e;return n.endsWith(`?`)&&(n=`${n.slice(0,-1)}\\?`),R(t?`${n}?`:n)}function ys(e,t){let n=t.ctx.project.modelById.get(e);if(n?.schemaName===void 0||n.schemaModule===void 0)return`${hs(t.imports)}.unknown`;let r=t.imports.add(n.schemaModule,n.schemaName,{typeOnly:!1});if(t.deferred)return r;let i=gs(t.imports,as(n,t.imports)),a=_s(t.imports,`lazy`);return t.imports.lang===`js`?`${a}(/** @returns {${i}} */ () => ${r})`:`${a}((): ${i} => ${r})`}function bs(e,t){let[n,...r]=t;return n===void 0?`${e()}.never`:r.reduce((e,t)=>`${e}.or(${t})`,n)}function xs(e,t){let n=e.kind===`ref`?ys(e.target,t):`${Cs(e,t)}${Ss(e.assertions,t)}`;return e.nullable===!0&&e.kind!==`null`?`${n}.or(${hs(t.imports)}.null)`:n}function Ss(e,t){if(e===void 0)return``;let n={...t,deferred:!0},r=e=>`${xs(e,n)}.allows(value)`,i=(e,t)=>`.narrow((value, ctx) => ${e} || ctx.mustBe(${L(t)}))`,a=[];e.not!==void 0&&a.push(i(`!${r(e.not)}`,"a value that does not match `not`"));let o=e.conditional;if(o!==void 0){let e=o.whenTrue===void 0?`true`:r(o.whenTrue),t=o.whenFalse===void 0?`true`:r(o.whenFalse);a.push(i(`(${r(o.condition)} ? ${e} : ${t})`,"a value matching the `then`/`else` schema selected by `if`"))}for(let[t,n]of Object.entries(e.dependentSchemas??{}))a.push(i(`!(${L(t)} in Object(value)) || ${r(n)}`,`an object matching the dependent schema of \`${t}\``));for(let[t,n]of Object.entries(e.dependentRequired??{}))n.length!==0&&a.push(i(`!(${L(t)} in Object(value)) || [${n.map(L).join(`, `)}].every((key) => key in Object(value))`,`an object with ${n.map(e=>`\`${e}\``).join(`, `)} when it has \`${t}\``));return a.join(``)}function Cs(e,t){let n=()=>hs(t.imports);switch(e.kind){case`string`:{let r=t.ctx.config.types.dates===`Date`?Fa(e):void 0;if(r===`date`)return`${n()}('string.date.iso').and(/^\\d{4}-\\d{2}-\\d{2}$/)`;if(r===`date-time`)return`${n()}(${os}).narrow((value, ctx) => !Number.isNaN(Date.parse(value)) || ctx.mustBe('a valid date-time'))`;let i=`${n()}.string`,a=e.constraints?.minLength,o=e.constraints?.maxLength;return a!==void 0&&(i+=`.narrow((value, ctx) => value.length >= ${2*a} || [...value].length >= ${a} || ctx.mustBe(${L(`at least ${a} characters long`)}))`),o!==void 0&&(i+=`.narrow((value, ctx) => value.length <= ${o} || [...value].length <= ${o} || ctx.mustBe(${L(`at most ${o} characters long`)}))`),i}case`number`:case`integer`:{let t=e.kind===`integer`?`${n()}('number.integer')`:`${n()}.number`,r=e.constraints;return r?.minimum!==void 0&&(t+=`.atLeast(${r.minimum})`),r?.maximum!==void 0&&(t+=`.atMost(${r.maximum})`),r?.exclusiveMinimum!==void 0&&(t+=`.moreThan(${r.exclusiveMinimum})`),r?.exclusiveMaximum!==void 0&&(t+=`.lessThan(${r.exclusiveMaximum})`),r?.multipleOf!==void 0&&(t+=Number.isInteger(r.multipleOf)?`.divisibleBy(${r.multipleOf})`:`.narrow((value, ctx) => Math.abs(value / ${r.multipleOf} - Math.round(value / ${r.multipleOf})) < 1e-9 || ctx.mustBe(${L(`a multiple of ${r.multipleOf}`)}))`),t}case`boolean`:return`${n()}.boolean`;case`null`:return`${n()}.null`;case`binary`:return`${n()}.instanceOf(Blob)`;case`unknown`:return`${n()}.unknown`;case`never`:return`${n()}.never`;case`enum`:{let t=e.values.filter(e=>typeof e!=`object`||!e);return t.length===e.values.length?t.length===0?`${n()}.never`:`${n()}.enumerated(${t.map(e=>z(e)).join(`, `)})`:`${n()}.unknown`}case`array`:{let r=xs(e.items,t);if(e.prefixItems!==void 0){let i=e.prefixItems.map(e=>xs(e,t)),a=e.items.kind===`never`?[]:[`'...'`,`${r}.array()`];return`${n()}([${[...i,...a].join(`, `)}])`}let i=`${r}.array()`;return e.constraints?.minItems!==void 0&&(i+=`.atLeastLength(${e.constraints.minItems})`),e.constraints?.maxItems!==void 0&&(i+=`.atMostLength(${e.constraints.maxItems})`),i}case`object`:return ws(e,t);case`union`:{let r=e.discriminator;return bs(n,e.variants.map(e=>{let i=xs(e,t),a=r===void 0||e.kind!==`ref`?[]:r.mapping.filter(t=>t.target===e.target).map(e=>e.value);return a.length===0||r===void 0?i:`${i}.and(${n()}({ ${vs(r.propertyName,!1)}: ${n()}.enumerated(${a.map(L).join(`, `)}) }))`}))}case`intersection`:{let{relaxed:r,closedKeys:i,inlined:a}=ps(e.members,t.ctx,t.inlined),o=r.map(e=>xs(e,{...t,inlined:a}));return i!==void 0&&o.push(`${n()}.unknown.narrow((value, ctx) => Object.keys(Object(value)).every((key) => [${i.map(L).join(`, `)}].includes(key)) || ctx.mustBe('an object without properties that no member of allOf declares'))`),o.length===1?o[0]??`${n()}.unknown`:`${_s(t.imports,`allOf`)}(${o.join(`, `)})`}}}function ws(e,t){let n=()=>hs(t.imports),r=e.additionalProperties,i=r!==!1&&r!==void 0&&ds(r)?void 0:r;if(e.properties.length===0)return i===!1?`${n()}({}).onUndeclaredKey('reject')`:`${n()}.Record(${n()}.string, ${i===void 0?`${n()}.unknown`:xs(i,t)})`;let a=e.properties.filter(ls),o=e.properties.filter(e=>!ls(e)).map(e=>`${vs(e.name,!e.required)}: ${xs(e.schema,t)}`),s=`${n()}({
${o.map(e=>`  ${e.replace(/\n/g,`
  `)},`).join(`
`)}
})`,c=e.properties.map(e=>L(e.name)).join(`, `);i===!1?s=a.length===0?`${s}.onUndeclaredKey('reject')`:`${s}.and(${n()}.unknown.narrow((value, ctx) => Object.keys(Object(value)).every((key) => [${c}].includes(key)) || ctx.mustBe('an object without undeclared properties')))`:i!==void 0&&(s=`${_s(t.imports,`rest`)}(${s}, [${c}], ${xs(i,t)})`);let l={...t,deferred:!0};for(let e of a){let r=L(e.name),i=t.imports.lang===`js`?`/** @type {Record<string, unknown>} */ (value)[${r}]`:`(value as Record<string, unknown>)[${r}]`;s+=`.and(${n()}.unknown.narrow((value, ctx) => !Object.prototype.hasOwnProperty.call(value, ${r}) || ${i} === undefined || ${xs(e.schema,l)}.allows(${i}) || ctx.mustBe(${L(`an object whose \`${e.name}\` matches its schema`)})))`}return s}function Ts(e,t){if(e.schemaName===void 0||e.schemaModule===void 0)return;let n=e.schemaName,r=e.schemaModule;return{module:r,origin:`core:validation`,...I(r,t,(r,i)=>{r.declare(n);let a=B({summary:`ArkType schema for {@link ${e.name}}.`,tags:[]}),o=as(e,r);if(i===`dts`)return`${a}export declare const ${n}: ${gs(r,o)};
`;let s={imports:r,ctx:t,deferred:!1},c=xs(e.definition.schema,s);for(let{property:n,values:i}of Fo(e,t)){let e=hs(r);c=`${c}.and(${e}({ ${vs(n,!1)}: ${e}.enumerated(${i.map(L).join(`, `)}) }))`}return i===`js`?`${a}export const ${n} = /** @type {${gs(r,o)}} */ (/** @type {unknown} */ (${c}));
`:`${a}export const ${n} = ${c}.as<${o}>();
`}),exports:[{name:n,kind:`schema`,typeOnly:!1}],sources:{schemas:[e.id]}}}function Es(e){let t=ms;return[{module:t,origin:`core:validation`,...I(t,e,(e,t)=>{for(let t of[`lazy`,`allOf`,`rest`])e.declare(t);let n=t=>gs(e,t),r=t===`ts`,i=(e,n)=>B({summary:e,tags:t===`js`?n.map(e=>({tag:e.split(` `)[0]??``,text:e.slice(e.indexOf(` `)+1)})):[]}),a=i(`A reference resolved when data is validated, so schemas can refer to each other in any order and to themselves. Errors keep their paths.`,[`template T`,`param {() => ${n(`T`)}} get`,`returns {${n(`T`)}}`]),o=i(`The intersection of schemas. ArkType rejects contradictory intersections when they are defined; those are checked when data is validated instead, so the module still loads.`,[`param {...${n(`unknown`)}} types`,`returns {${n(`unknown`)}}`]),s=i("An object schema whose properties other than `known` must match `additional` (JSON Schema `additionalProperties`).",[`template T`,`param {${n(`T`)}} object`,`param {readonly string[]} known`,`param {${n(`unknown`)}} additional`,`returns {${n(`T`)}}`]);if(t===`dts`)return[`${a}export declare function lazy<T>(get: () => ${n(`T`)}): ${n(`T`)};
`,`${o}export declare function allOf(...types: ${n(`unknown`)}[]): ${n(`unknown`)};
`,`${s}export declare function rest<T>(object: ${n(`T`)}, known: readonly string[], additional: ${n(`unknown`)}): ${n(`T`)};
`].join(`
`);let c=hs(e),l=(e,t)=>r?`(${t} as unknown as ${n(e)})`:`/** @type {${n(e)}} */ (/** @type {unknown} */ (${t}))`,u=e=>r?`: ${n(e)}`:``,d=e=>`for (const error of result)
      ctx.error({
        expected: error.expected,
        actual: error.actual,
        problem: error.problem,
        relativePath: ${e},
      });`;return[`${a}export function lazy${r?`<T>(get: () => ${n(`T`)}): ${n(`T`)}`:`(get)`} {
  const reference${u(`unknown`)} = ${c}.unknown.narrow((data, ctx) => {
    // ArkType may already ask while reducing the definition that contains the reference,
    // possibly before the target is initialized; answering no only keeps branches apart.
    let target${r?`: ${n(`unknown`)}`:``};
    try {
      target = ${l(`unknown`,`get()`)};
    } catch {
      return false;
    }
    const result = target(data);
    if (!(result instanceof ${c}.errors)) return true;
    ${d(`[...error.path]`)}
    return false;
  });
  return ${l(`T`,`reference`)};
}
`,`${o}export function allOf${r?`(...types: ${n(`unknown`)}[]): ${n(`unknown`)}`:`(...types)`} {
  try {
    let result${u(`unknown`)} = types[0] ?? ${c}.unknown;
    for (const member of types.slice(1)) result = result.and(member);
    return result;
  } catch {
    return ${c}.unknown.narrow(
      (data, ctx) =>
        types.every((member) => member.allows(data)) || ctx.mustBe('a value matching every member of allOf'),
    );
  }
}
`,`${s}export function rest${r?`<T>(object: ${n(`T`)}, known: readonly string[], additional: ${n(`unknown`)}): ${n(`T`)}`:`(object, known, additional)`} {
  const others${u(`unknown`)} = ${c}.unknown.narrow((data, ctx) => {
    if (typeof data !== 'object' || data === null) return true;
    let valid = true;
    for (const [key, value] of Object.entries(data)) {
      if (known.includes(key)) continue;
      const result = additional(value);
      if (!(result instanceof ${c}.errors)) continue;
      valid = false;
      ${d(`[key, ...error.path]`).replace(/\n/g,`
  `)}
    }
    return valid;
  });
  return ${l(`T`,`${l(`unknown`,`object`)}.and(others)`)};
}
`].join(`
`)}),exports:[{name:`lazy`,kind:`runtime`,typeOnly:!1},{name:`allOf`,kind:`runtime`,typeOnly:!1},{name:`rest`,kind:`runtime`,typeOnly:!1}]}]}var Ds={library:`arktype`,label:`ArkType`,inline:(e,t,n)=>xs(e,{imports:t,ctx:n,deferred:!0}),union:(e,t)=>bs(()=>hs(t),e),unknown:e=>`${hs(e)}.unknown`,undefined:e=>`${hs(e)}.undefined`,blob:e=>`${hs(e)}.instanceOf(Blob)`,parse:(e,t)=>`${e}.assert(${t})`,model:Ts,support:Es},Os=e=>e.namespace(`valibot`,`v`,{typeOnly:!1});function ks(e,t){return`${e.namespace(`valibot`,`v`,{typeOnly:!0})}.GenericSchema<${t}>`}function As(e,t){return t===null?`${e}.null()`:`${e}.literal(${z(t)})`}function js(e,t){return t.length===0?`${e}.never()`:t.length===1?t[0]??`${e}.never()`:`${e}.union([${t.join(`, `)}])`}function Ms(e,t,n){return n.length===0?t:`${e}.pipe(${t}, ${n.join(`, `)})`}function Ns(e,t){let n=t.ctx.project.modelById.get(e),r=Os(t.imports);if(n?.schemaName===void 0||n.schemaModule===void 0)return`${r}.unknown()`;let i=t.imports.add(n.schemaModule,n.schemaName,{typeOnly:!1});if(t.deferred)return i;let a=ks(t.imports,as(n,t.imports));return t.imports.lang===`js`?`${r}.lazy(/** @returns {${a}} */ () => ${i})`:`${r}.lazy((): ${a} => ${i})`}function Ps(e,t){let n=Os(t.imports),r=e.kind===`ref`?Ns(e.target,t):Ms(n,Is(e,t,n),Fs(e.assertions,t,n));return e.nullable===!0&&e.kind!==`null`?`${n}.nullable(${r})`:r}function Fs(e,t,n){if(e===void 0)return[];let r={...t,deferred:!0},i=e=>`${n}.is(${Ps(e,r)}, value)`,a=(e,t)=>`${n}.check((value) => ${e}, ${L(t)})`,o=[];e.not!==void 0&&o.push(a(`!${i(e.not)}`,"Must not match the `not` schema."));let s=e.conditional;if(s!==void 0){let e=s.whenTrue===void 0?`true`:i(s.whenTrue),t=s.whenFalse===void 0?`true`:i(s.whenFalse);o.push(a(`(${i(s.condition)} ? ${e} : ${t})`,"Must match the `then`/`else` schema selected by `if`."))}for(let[t,n]of Object.entries(e.dependentSchemas??{}))o.push(a(`!(${L(t)} in Object(value)) || ${i(n)}`,`Objects with \`${t}\` must match its dependent schema.`));for(let[t,n]of Object.entries(e.dependentRequired??{}))n.length!==0&&o.push(a(`!(${L(t)} in Object(value)) || [${n.map(L).join(`, `)}].every((key) => key in Object(value))`,`Objects with \`${t}\` must also have ${n.map(e=>`\`${e}\``).join(`, `)}.`));return o}function Is(e,t,n){switch(e.kind){case`string`:{let r=t.ctx.config.types.dates===`Date`?Fa(e):void 0;if(r===`date`)return`${n}.pipe(${n}.string(), ${n}.isoDate())`;if(r===`date-time`)return`${n}.pipe(${n}.string(), ${n}.regex(${os}), ${n}.check(${ss}, 'Invalid date-time.'))`;let i=[],a=e.constraints?.minLength,o=e.constraints?.maxLength;return a!==void 0&&i.push(`${n}.check((value) => value.length >= ${2*a} || [...value].length >= ${a}, ${L(`Must have at least ${a} characters.`)})`),o!==void 0&&i.push(`${n}.check((value) => value.length <= ${o} || [...value].length <= ${o}, ${L(`Must have at most ${o} characters.`)})`),Ms(n,`${n}.string()`,i)}case`number`:case`integer`:{let t=e.kind===`integer`?[`${n}.integer()`]:[],r=e.constraints;if(r?.minimum!==void 0&&t.push(`${n}.minValue(${r.minimum})`),r?.maximum!==void 0&&t.push(`${n}.maxValue(${r.maximum})`),r?.exclusiveMinimum!==void 0&&t.push(`${n}.gtValue(${r.exclusiveMinimum})`),r?.exclusiveMaximum!==void 0&&t.push(`${n}.ltValue(${r.exclusiveMaximum})`),r?.multipleOf!==void 0){let e=r.multipleOf;t.push(Number.isInteger(e)?`${n}.multipleOf(${e})`:`${n}.check((value) => Math.abs(value / ${e} - Math.round(value / ${e})) < 1e-9, ${L(`Must be a multiple of ${e}.`)})`)}return Ms(n,`${n}.number()`,t)}case`boolean`:return`${n}.boolean()`;case`null`:return`${n}.null()`;case`binary`:return`${n}.instance(Blob)`;case`unknown`:return`${n}.unknown()`;case`never`:return`${n}.never()`;case`enum`:{if(e.values.length>0&&e.values.every(e=>typeof e==`string`))return`${n}.picklist([${e.values.map(e=>z(e)).join(`, `)}])`;let t=e.values.filter(e=>typeof e!=`object`||!e);return t.length===e.values.length?js(n,t.map(e=>As(n,e))):`${n}.unknown()`}case`array`:{let r=Ps(e.items,t);if(e.prefixItems!==void 0){let i=e.prefixItems.map(e=>Ps(e,t)).join(`, `);return e.items.kind===`never`?`${n}.strictTuple([${i}])`:`${n}.tupleWithRest([${i}], ${r})`}let i=[];return e.constraints?.minItems!==void 0&&i.push(`${n}.minLength(${e.constraints.minItems})`),e.constraints?.maxItems!==void 0&&i.push(`${n}.maxLength(${e.constraints.maxItems})`),Ms(n,`${n}.array(${r})`,i)}case`object`:return Ls(e,t,n);case`union`:{let r=e.discriminator;return js(n,e.variants.map(e=>{let i=Ps(e,t),a=r===void 0||e.kind!==`ref`?[]:r.mapping.filter(t=>t.target===e.target).map(e=>e.value);return a.length===0||r===void 0?i:`${n}.intersect([${i}, ${n}.looseObject({ ${R(r.propertyName)}: ${n}.picklist([${a.map(L).join(`, `)}]) })])`}))}case`intersection`:{let{relaxed:r,closedKeys:i,inlined:a}=ps(e.members,t.ctx,t.inlined),o=r.map(e=>Ps(e,{...t,inlined:a}));if(o.length===1)return o[0]??`${n}.unknown()`;let s=`${n}.intersect([${o.join(`, `)}])`;return i===void 0?s:`${n}.pipe(${s}, ${n}.check((value) => Object.keys(Object(value)).every((key) => [${i.map(L).join(`, `)}].includes(key)), 'Must not have properties that no member of allOf declares.'))`}}}function Ls(e,t,n){let r=e.additionalProperties,i=r!==!1&&r!==void 0&&ds(r)?void 0:r;if(e.properties.length===0)return i===!1?`${n}.strictObject({})`:`${n}.record(${n}.string(), ${i===void 0?`${n}.unknown()`:Ps(i,t)})`;let a=`{
${e.properties.map(e=>{let r=Ps(e.schema,t);return`${R(e.name)}: ${e.required?r:`${n}.exactOptional(${r})`}`}).map(e=>`  ${e.replace(/\n/g,`
  `)},`).join(`
`)}
}`,o=i===!1?`${n}.strictObject(${a})`:i===void 0?`${n}.looseObject(${a})`:`${n}.objectWithRest(${a}, ${Ps(i,t)})`;return e.properties.some(ls)?`${n}.pipe(
  ${n}.unknown(),
  ${n}.transform(${us(t.imports.lang).replace(/\n/g,`
  `)}),
  ${o.replace(/\n/g,`
  `)},
)`:o}function Rs(e,t){if(e.schemaName===void 0||e.schemaModule===void 0)return;let n=e.schemaName,r=e.schemaModule;return{module:r,origin:`core:validation`,...I(r,t,(r,i)=>{r.declare(n);let a=B({summary:`Valibot schema for {@link ${e.name}}.`,tags:[]}),o=ks(r,as(e,r));if(i===`dts`)return`${a}export declare const ${n}: ${o};
`;let s={imports:r,ctx:t,deferred:!1},c=Os(r),l=Ps(e.definition.schema,s),u=Fo(e,t).map(({property:e,values:t})=>`${c}.looseObject({ ${R(e)}: ${c}.picklist([${t.map(L).join(`, `)}]) })`);return u.length>0&&(l=`${c}.intersect([${[l,...u].join(`, `)}])`),i===`js`?`${a}export const ${n} = /** @type {${o}} */ (${l});
`:`${a}export const ${n} = ${l} as ${o};
`}),exports:[{name:n,kind:`schema`,typeOnly:!1}],sources:{schemas:[e.id]}}}var zs={library:`valibot`,label:`Valibot`,inline:(e,t,n)=>Ps(e,{imports:t,ctx:n,deferred:!0}),union:(e,t)=>js(Os(t),e),unknown:e=>`${Os(e)}.unknown()`,undefined:e=>`${Os(e)}.undefined()`,blob:e=>`${Os(e)}.instance(Blob)`,parse:(e,t,n)=>`${Os(n)}.parse(${e}, ${t})`,model:Rs};function Bs(e){switch(e.kind){case`ref`:return!0;case`array`:return Bs(e.items)||(e.prefixItems??[]).some(Bs);case`object`:return e.properties.some(e=>Bs(e.schema))||e.additionalProperties!==void 0&&e.additionalProperties!==!1&&Bs(e.additionalProperties);case`union`:return e.variants.some(Bs);case`intersection`:return e.members.some(Bs);default:return!1}}function Vs(e,t){if(t.self?.id===e)return t.self.name;let n=t.ctx.project.modelById.get(e);if(n?.schemaName!==void 0&&n.schemaModule!==void 0)return t.imports.add(n.schemaModule,n.schemaName,{typeOnly:!1})}function Hs(e,t){return t===null?`${e}.null()`:`${e}.literal(${z(t)})`}function Us(e,t){return t.length===0?`${e}.never()`:t.length===1?t[0]??`${e}.never()`:`${e}.union([${t.join(`, `)}])`}function Ws(e,t){return t.reduce((t,n)=>`${e}.intersection(${t}, ${n})`)}function Gs(e){return e.add(`zod`,`z`,{typeOnly:!1,external:!0})}function Ks(e,t,n=!1){if(e.kind===`ref`){let r=Vs(e.target,t),i=r===void 0?`${Gs(t.imports)}.unknown()`:n?r:`${Gs(t.imports)}.lazy(() => ${r})`;return e.nullable===!0?`${i}.nullable()`:i}let r=`${Js(e,t,Gs(t.imports),n)}${qs(e.assertions,t)}`;return e.nullable===!0&&e.kind!==`null`?`${r}.nullable()`:r}function qs(e,t){if(e===void 0)return``;let n=e=>`${Ks(e,t,!0)}.safeParse(value).success`,r=(e,t)=>`.refine((value) => ${e}, { message: ${L(t)} })`,i=[];e.not!==void 0&&i.push(r(`!${n(e.not)}`,"Must not match the `not` schema."));let a=e.conditional;if(a!==void 0){let e=a.whenTrue===void 0?`true`:n(a.whenTrue),t=a.whenFalse===void 0?`true`:n(a.whenFalse);i.push(r(`(${n(a.condition)} ? ${e} : ${t})`,"Must match the `then`/`else` schema selected by `if`."))}for(let[t,a]of Object.entries(e.dependentSchemas??{}))i.push(r(`!(${L(t)} in Object(value)) || ${n(a)}`,`Objects with \`${t}\` must match its dependent schema.`));for(let[t,n]of Object.entries(e.dependentRequired??{}))n.length!==0&&i.push(r(`!(${L(t)} in Object(value)) || [${n.map(L).join(`, `)}].every((key) => key in Object(value))`,`Objects with \`${t}\` must also have ${n.map(e=>`\`${e}\``).join(`, `)}.`));return i.join(``)}function Js(e,t,n,r){switch(e.kind){case`string`:{let r=t.ctx.config.types.dates===`Date`?Fa(e):void 0;if(r===`date`)return`${n}.iso.date()`;if(r===`date-time`)return`${n}.string().regex(${os}).refine(${ss}, 'Invalid date-time')`;let i=`${n}.string()`;return e.constraints?.minLength!==void 0&&(i+=`.min(${e.constraints.minLength})`),e.constraints?.maxLength!==void 0&&(i+=`.max(${e.constraints.maxLength})`),i}case`number`:case`integer`:{let t=e.kind===`integer`?`${n}.number().multipleOf(1)`:`${n}.number()`,r=e.constraints;return r?.minimum!==void 0&&(t+=`.min(${r.minimum})`),r?.maximum!==void 0&&(t+=`.max(${r.maximum})`),r?.exclusiveMinimum!==void 0&&(t+=`.gt(${r.exclusiveMinimum})`),r?.exclusiveMaximum!==void 0&&(t+=`.lt(${r.exclusiveMaximum})`),r?.multipleOf!==void 0&&(t+=`.multipleOf(${r.multipleOf})`),t}case`boolean`:return`${n}.boolean()`;case`null`:return`${n}.null()`;case`binary`:return`${n}.instanceof(Blob)`;case`unknown`:return`${n}.unknown()`;case`never`:return`${n}.never()`;case`enum`:{if(e.values.length>0&&e.values.every(e=>typeof e==`string`))return`${n}.enum([${e.values.map(e=>z(e)).join(`, `)}])`;let t=e.values.filter(e=>typeof e!=`object`||!e);return t.length===e.values.length?Us(n,t.map(e=>Hs(n,e))):`${n}.unknown()`}case`array`:{let i=Ks(e.items,t,r),a=e.prefixItems===void 0?`${n}.array(${i})`:`${n}.tuple([${e.prefixItems.map(e=>Ks(e,t,r)).join(`, `)}]${e.items.kind===`never`?``:`, ${i}`})`;return e.prefixItems===void 0&&(e.constraints?.minItems!==void 0&&(a+=`.min(${e.constraints.minItems})`),e.constraints?.maxItems!==void 0&&(a+=`.max(${e.constraints.maxItems})`)),a}case`object`:return Ys(e,t,n,r);case`union`:{let i=e.discriminator;return Us(n,e.variants.map(e=>{let a=Ks(e,t,r),o=i===void 0||e.kind!==`ref`?[]:i.mapping.filter(t=>t.target===e.target).map(e=>e.value);if(o.length===0||i===void 0)return a;let s=Us(n,o.map(e=>Hs(n,e)));return`${n}.intersection(${a}, ${n}.looseObject({ ${R(i.propertyName)}: ${s} }))`}))}case`intersection`:return Ws(n,e.members.map(e=>Ks(e,t,r)))}}function Ys(e,t,n,r){let i=e.additionalProperties,a=i!==!1&&i!==void 0&&ds(i)?void 0:i;if(e.properties.length===0)return a===!1?`${n}.strictObject({})`:`${n}.record(${n}.string(), ${a===void 0?`${n}.unknown()`:Ks(a,t,r)})`;let o=e.properties.map(e=>{let n=Bs(e.schema),r=Ks(e.schema,t,n);e.required||(r+=`.optional()`);let i=R(e.name);return n?`get ${i}() {
  return ${r};
}`:`${i}: ${r}`}),s=`${n}.${a===!1?`strictObject`:`looseObject`}({
${o.map(e=>`  ${e.replace(/\n/g,`
  `)},`).join(`
`)}
})`;return a!==void 0&&a!==!1&&(s+=`.catchall(${Ks(a,t)})`),e.properties.some(ls)&&(s=`${n}.preprocess(
  ${us(t.imports.lang).replace(/\n/g,`
  `)},
  ${s.replace(/\n/g,`
  `)},
)`),s}function Xs(e,t){if(e.schemaName===void 0||e.schemaModule===void 0)return;let n=e.schemaName,r=e.schemaModule;return{module:r,origin:`core:validation`,...I(r,t,(r,i)=>{r.declare(n);let a=`Zod schema for {@link ${e.name}}.`;if(i===`dts`){let t=r.add(`zod`,`z`,{typeOnly:!0,external:!0});return`${B({summary:a,tags:[]})}export declare const ${n}: ${t}.ZodType<${as(e,r)}>;
`}let o={imports:r,ctx:t,self:{id:e.id,name:n}},s=Ks(e.definition.schema,o,!1),c=r.add(`zod`,`z`,{typeOnly:!1,external:!0});for(let{property:n,values:r}of Fo(e,t)){let e=Us(c,r.map(e=>Hs(c,e)));s=`${c}.intersection(${s}, ${c}.looseObject({ ${R(n)}: ${e} }))`}let l=B({summary:a,tags:[]});if(!t.project.graph.recursiveSchemas().has(e.id))return`${l}export const ${n} = ${s};
`;let u=`${r.add(`zod`,`z`,{typeOnly:!0,external:!0})}.ZodType<${as(e,r)}>`;return i===`js`?`${l}export const ${n} = /** @type {${u}} */ (${s});
`:`${l}export const ${n} = ${s} as ${u};
`}),exports:[{name:n,kind:`schema`,typeOnly:!1}],sources:{schemas:[e.id]}}}var Zs={zod:{library:`zod`,label:`Zod`,inline:(e,t,n)=>Ks(e,{imports:t,ctx:n},!0),union:(e,t)=>Us(Gs(t),e),unknown:e=>`${Gs(e)}.unknown()`,undefined:e=>`${Gs(e)}.undefined()`,blob:e=>`${Gs(e)}.instanceof(Blob)`,parse:(e,t)=>`${e}.parse(${t})`,model:Xs},valibot:zs,arktype:Ds};function Qs(e){let t=e.config.features.validation;return t===!1?void 0:Zs[t.library]}function $s(e,t,n,r){let i=[...new Set(e.success.map(i=>{let a=i.media;if(a===void 0)return r.undefined(t);let o=Yo(a,e.parseAs);return o===`binary`?r.blob(t):o===`text`&&!qo(a.schema)?r.inline({kind:`string`},t,n):r.inline(a.schema,t,n)}))],a=i.length===0?r.unknown(t):i.length===1?i[0]??``:r.union(i,t);return`(data) => ${r.parse(a,`data`,t)}`}function ec(e,t,n,r,i){if(e.body===void 0)return;let a=e=>{let i=Ko(e);return i===`raw`||i===`binary`?r.unknown(t):r.inline(e.schema,t,n)},o=a(e.body.media),s=o;if(e.body.alternatives.length>0&&i!==void 0){for(let t of[...e.body.alternatives].reverse()){let e=a(t);e!==o&&(s=`${i} === ${L(t.mediaType)} ? ${e} : ${s}`)}s!==o&&(s=`(${s})`)}return`(body) => ${r.parse(s,`body`,t)}`}function tc(e){let t=Qs(e);if(t===void 0)return[];let n=e.project.models.map(n=>t.model(n,e)).filter(e=>e!==void 0),r=[...t.support?.(e)??[],...n];return e.config.output.barrel&&r.push(nc(t,e,n)),r}function nc(e,t,n){let r=`${e.library}/index`,i=I(r,t,e=>`${n.map(t=>`export * from '${e.specifier(t.module)}';`).join(`
`)}
`),a=n.flatMap(e=>e.exports);return{module:r,origin:`core:validation-barrel`,...i,exports:a}}function rc(e,t,n=``){return Ko(e)===`raw`?`string | ${Ao({...t,direction:`input`}).text}`:Do(e.schema,t,n)}function ic(e,t,n,r=``){switch(Yo(e,t)){case`json`:return Do(e.schema,n,r);case`text`:return qo(e.schema)?Do(e.schema,n,r):`string`;case`binary`:return Ao({...n,direction:`output`}).text}}function ac(e,t){let n=[];for(let r of[e.media,...e.alternatives]){let e=t(r),i=n.find(t=>t.type===e);i===void 0?n.push({mediaTypes:[r.mediaType],type:e,media:r}):i.mediaTypes.push(r.mediaType)}return n}var oc={path:`pathParams`,query:`query`,header:`headers`,cookie:`cookies`};function sc(e){let t=e.in===`query`||e.in===`cookie`?`form`:`simple`,n={};return e.style!==t&&(n.style=e.style),e.explode!==(e.style===`form`||e.style===`cookie`)&&(n.explode=e.explode),e.allowReserved&&(n.allowReserved=!0),e.contentType!==void 0&&/json/i.test(e.contentType)&&(n.json=!0),Object.keys(n).length===0?void 0:n}var cc=/^\d{3}$/,lc=/^([1-5])XX$/i,uc=class{#e;#t;#n;constructor(e,t){let n=[...e.success,...e.errors].map(e=>e.response.status);this.#e=[...new Set(n.filter(e=>cc.test(e)).map(Number))].sort((e,t)=>e-t);let r=n.flatMap(e=>{let t=lc.exec(e);return t?.[1]===void 0?[]:[Number(t[1])]});this.#t=[.../* @__PURE__ */ new Set([2,...r])].sort((e,t)=>e-t),this.#n=t}of(e,t){if(cc.test(e))return e;let n=lc.exec(e)?.[1];return n===void 0?t?this.#r(2):this.rest()??`never`:this.#r(Number(n))}undeclaredSuccess(e){let t=e.success.map(e=>e.response.status.toUpperCase());if(!(t.length===0||t.some(e=>e===`2XX`||e===`DEFAULT`)))return this.#r(2)}rest(){let e=[1,2,3,4,5].filter(e=>!this.#t.includes(e));if(e.length===0)return;let t=this.#e.filter(t=>e.includes(Math.floor(t/100))),n=`${this.#n()}<${e.join(` | `)}>`;return t.length===0?n:`Exclude<${n}, ${t.join(` | `)}>`}#r(e){let t=this.#e.filter(t=>Math.floor(t/100)===e),n=`${this.#n()}<${e}>`;return t.length===0?n:`Exclude<${n}, ${t.join(` | `)}>`}};function dc(e){let t=[...new Set(e)];return t.includes(`unknown`)?`unknown`:[...t.filter(e=>e!==`undefined`),...t.filter(e=>e===`undefined`)].join(` | `)}function fc(e,t,n,r){let i=new Set(e.success),a=n=>n.media===void 0?`undefined`:ic(n.media,i.has(n)?e.parseAs:void 0,t),o=new uc(e,()=>r(`runtime/types`,`HttpStatus`)),s;if(n){let t=r(`runtime/types`,`ApiResponse`),n=e.success.map(e=>`${t}<${a(e)}, ${o.of(e.response.status,!0)}>`),i=o.undeclaredSuccess(e);i!==void 0&&n.push(`${t}<unknown, ${i}>`),s=n.length===0?`${t}<undefined>`:dc(n)}else{let t=e.success.map(a);s=t.every(e=>e===`undefined`)?`void`:dc(t)}let c=e.errors.map(a),l=()=>r(`runtime/errors`,`ApiError`),u=e.errors.map(e=>`${l()}<${a(e)}, ${o.of(e.response.status,!1)}>`),d=o.rest();return d!==void 0&&!e.errors.some(e=>e.response.status==="default")&&u.push(`${l()}<unknown, ${d}>`),{response:s,errorBody:c.length===0?`unknown`:dc(c),apiErrors:u}}function pc(e){return e.map(({response:e})=>{let t=e.description?.split(`
`)[0]?.replace(/[\s.]+$/,``)??``;return`\`${e.status}\`${t===``?``:` ${t}`}`}).join(`; `)}function mc(e,t,n){let r=e.symbol.operation,i=`${ee(r.method)} ${r.path}`,a=r.summary===void 0?vo(r.description??`Calls \`${i}\`.`):{summary:r.summary,...r.description===void 0?{}:{description:r.description}},o=t===`js`,s=[{tag:`remarks`,text:`\`${i}\`${r.operationId===void 0?``:` (operationId \`${r.operationId}\`)`}`}];if(e.hasParams){let t=e.paramsRequired?`params`:`[params]`,r=e.parameters.length===0?`Request body`:e.body===void 0?`Request parameters`:`Request parameters and body`;s.push({tag:`param`,text:`${o?`{${n.params}} ${t}`:`params`} - ${r}.`})}s.push({tag:`param`,text:`${o?`{${n.options}} [options]`:`options`} - Per-request options: \`signal\`, \`timeout\`, \`headers\`, \`client\`.`});let c=e.success.length===0?`Resolves when the request succeeds.`:pc(e.success);return s.push({tag:`returns`,text:`${o?`{Promise<${n.response}>} `:``}${c}`}),s.push({tag:`throws`,text:`${o?`{${n.apiError}}`:`{@link ApiError}`} ${e.errors.length===0?`When the server responds with a non-2xx status`:pc(e.errors)}; narrow it with {@link ${e.symbol.errorGuard}}.`}),s.push({tag:`throws`,text:`${o?`{${n.requestError}}`:`{@link RequestError}`} When no usable response is received (network failure, timeout or invalid body).`}),r.externalDocs!==void 0&&s.push({tag:`see`,text:`${r.externalDocs.url}${r.externalDocs.description===void 0?``:` ${r.externalDocs.description}`}`}),r.deprecated&&s.push({tag:`deprecated`}),{...a,tags:s}}function hc(e){let t=yo(e.schema).filter(e=>e.tag!==`deprecated`&&e.tag!==`example`);(e.deprecated||e.schema.deprecated===!0)&&t.unshift({tag:`deprecated`});let n=e.examples[0]?.value??e.schema.examples?.[0];return n!==void 0&&t.push({tag:`example`,text:JSON.stringify(n)}),{...vo(e.description??e.schema.description),tags:t}}function gc(e,t,n,r){return e===`js`?B({...r,tags:[...r.tags,{tag:`typedef`,text:`{${n}} ${t}`}]}):`${B(r)}export type ${t} = ${n};
`}function _c(e,t){let{symbol:n}=e,r=n.operation,i=n.typeNames,a=t.config.client.responseStyle===`full`,o=[{name:n.name,kind:`operation`,typeOnly:!1},...e.hasParams?[{name:i.params,kind:`type`,typeOnly:!0}]:[],...e.body===void 0?[]:[{name:i.body,kind:`type`,typeOnly:!0}],...i.bodies===void 0||e.body===void 0?[]:[{name:i.bodies,kind:`type`,typeOnly:!0}],{name:i.response,kind:`type`,typeOnly:!0},{name:i.errorBody,kind:`type`,typeOnly:!0},{name:i.apiError,kind:`type`,typeOnly:!0},{name:i.error,kind:`type`,typeOnly:!0},{name:n.errorGuard,kind:`error-guard`,typeOnly:!1}];return{module:n.module,origin:`core:operation`,...I(n.module,t,(o,s)=>{for(let e of[n.name,i.params,i.body,i.response,i.error,i.apiError,i.errorBody,n.errorGuard,...i.bodies===void 0?[]:[i.bodies]])o.declare(e);let c={imports:o,project:t.project,config:t.config,direction:`output`},l={...c,direction:`input`},u=o.add(`client`,`RequestOptions`,{typeOnly:!0}),d=(e,t)=>o.add(e,t,{typeOnly:!0}),f=[],p=e.body!==void 0&&e.body.alternatives.length>0;if(e.body!==void 0){let t=rc(e.body.media,l),a={summary:r.requestBody?.description??`Request body of {@link ${n.name}} (\`${e.body.media.mediaType}\`).`,tags:[]};if(f.push(s===`js`&&Ko(e.body.media)!==`raw`?Bo(i.body,e.body.media.schema,a,l):gc(s,i.body,t,a)),p&&i.bodies!==void 0){let t=[e.body.media,...e.body.alternatives].map(e=>`${L(e.mediaType)}: ${rc(e,l,`  `)};`),r={summary:`Request bodies of {@link ${n.name}} by media type. Select one with \`${e.body.contentTypeProperty}\`.`,tags:[]};f.push(s===`js`?gc(s,i.bodies,`{ ${t.join(` `)} }`,r):`${B(r)}export type ${i.bodies} = {
${t.map(e=>`  ${e}`).join(`
`)}
};
`)}}if(e.hasParams){let r=e.parameters.map(({property:e,parameter:t})=>({key:e,optional:!t.required,type:Do(t.schema,l,`  `),doc:hc(t)})),a=e.body===void 0?void 0:{key:e.body.property,optional:!e.body.required,type:i.body,doc:{summary:`Request body.`,tags:[]}},o=e.body,c=i.bodies,u=o!==void 0&&p&&c!==void 0?ac(o,e=>rc(e,l)).map((e,t)=>{let n=t===0,r={summary:n?`Media type of the request body. Default \`${o.media.mediaType}\`.`:`Media type of the request body.`,tags:[]};return[{key:o.contentTypeProperty,optional:n,type:e.mediaTypes.map(L).join(` | `),doc:r},{key:o.property,optional:!o.required,type:n?i.body:`${c}[${L(e.mediaTypes[0]??``)}]`,doc:{summary:`Request body.`,tags:[]}}]}):void 0;a!==void 0&&u===void 0&&r.push(a);let d={summary:`Parameters of {@link ${n.name}}.`,tags:[]},m=e=>`{ ${e.map(e=>`${R(e.key)}${e.optional?`?`:``}: ${e.type}${e.optional?` | undefined`:``};`).join(` `)} }`,h=(e,n)=>`{
${e.map(e=>`${t.config.features.jsdoc?B(e.doc,`${n}  `):``}${n}  ${R(e.key)}${e.optional?`?`:``}: ${e.type}${e.optional?` | undefined`:``};`).join(`
`)}
${n}}`;if(s===`js`){let e=[];if(u!==void 0){let t=u.map(e=>m(e)).join(` | `),n=r.length===0?t:`${m(r)} & (${t})`;e.push({tag:`typedef`,text:`{${n}} ${i.params}`})}else if(r.every(e=>dt(e.key))){e.push({tag:`typedef`,text:`{object} ${i.params}`});for(let t of r){let n=t.doc.summary??``,r=t.optional?`${t.type} | undefined`:t.type;e.push({tag:`property`,text:`{${r}} ${t.optional?`[${t.key}]`:t.key}${n===``?``:` - ${n}`}`})}}else e.push({tag:`typedef`,text:`{${m(r)}} ${i.params}`});f.push(B({...d,tags:e}))}else if(u!==void 0){let e=u.map(e=>`  | ${h(e,`    `)}`).join(`
`),t=r.length===0?`
${e}`:` ${h(r,``)} & (
${e}
)`;f.push(`${B(d)}export type ${i.params} =${t};
`)}else f.push(`${B(d)}export type ${i.params} = ${h(r,``)};
`)}let m=fc(e,c,a,d),h=(e,t,n)=>s===`js`?B({...n,tags:[{tag:`typedef`,text:`{${t}} ${e}`}]}):`${B(n)}export type ${e} = ${t};
`;f.push(h(i.response,m.response,{summary:`${a?`Response`:`Response data`} of {@link ${n.name}}.`,tags:[]})),f.push(h(i.errorBody,m.errorBody,{summary:`Body of an error response of {@link ${n.name}}.`,tags:[]}));let g={summary:`The \`ApiError\`s {@link ${n.name}} rejects with: one per documented status, so checking \`status\` narrows \`body\`.`,...m.apiErrors.length>e.errors.length?{description:`The last member covers statuses the specification does not document.`}:{},tags:[]};f.push(s===`js`||m.apiErrors.length===1?h(i.apiError,m.apiErrors.join(` | `),g):`${B(g)}export type ${i.apiError} =
${m.apiErrors.map(e=>`  | ${e}`).join(`
`)};
`),f.push(h(i.error,`${i.apiError} | ${d(`runtime/errors`,`RequestError`)}`,{summary:`Everything {@link ${n.name}} rejects with: an \`ApiError\` for an error status, or a \`RequestError\` when no usable response arrived.`,tags:[]}));let _=e=>s===`js`?o.add(`runtime/errors`,e,{typeOnly:!0}):e,v=oo(t,mc(e,s,{params:i.params,response:i.response,options:u,apiError:_(`ApiError`),requestError:_(`RequestError`)}),{kind:`operation`,operation:r}),y=e.hasParams?e.paramsRequired?`params: ${i.params}`:`params?: ${i.params}`:void 0,b=[...y===void 0?[]:[y],`options?: ${u}`].join(`, `),x=`Promise<${i.response}>`;if(s===`dts`)f.push(`${B(v)}export declare function ${n.name}(${b}): ${x};
`);else{let r=o.add(`client`,`client`,{typeOnly:!1}),c=s===`ts`?b:[...e.hasParams?[`params`]:[],`options`].join(`, `),l=s===`ts`?`: ${x}`:``,u=a?`send`:`request`,d=s===`ts`?`<${i.response}>`:``,p=t.config.features.validation,m=Qs(t),h=[];if(m!==void 0&&p!==!1){if(p.request&&e.body!==void 0){let n=e.hasParams&&!e.paramsRequired,r=ec(e,o,t,m,vc(e.body,e=>uo(`params`,e,n)));r!==void 0&&h.push(`validateBody: ${r}`)}p.response&&h.push(`validateResponse: ${$s(e,o,t,m)}`)}let g=[],_=/* @__PURE__ */ new Map;if(t.config.types.dates===`Date`){let n=t.project,r=e=>o.add(`runtime/dates`,e,{typeOnly:!1}),i=e.body===void 0?void 0:rs([e.body.media,...e.body.alternatives].map(e=>e.schema),n,o,`      `);i!==void 0&&g.push(`encodeBody: (body) => ${r(`encodeDates`)}(body, ${i})`);let a=rs(e.success.flatMap(e=>e.media===void 0?[]:[e.media.schema]),n,o,`      `);a!==void 0&&g.push(`transformResponse: (data) => ${r(`reviveDates`)}(data, ${a})`);for(let{parameter:t}of e.parameters){let e=ns(t.schema,n,o);e!==void 0&&_.set(t,`${r(`encodeDates`)}(%s, ${e})`)}}let y=yc(e,{extra:[...h,...g],parameter:(e,t)=>_.get(e)?.replace(`%s`,t)??t});f.push(`${B(v)}export function ${n.name}(${c})${l} {
  return (options?.client ?? ${r}).${u}${d}(
    {
${y.map(e=>`      ${e},`).join(`
`)}
    },
    options,
  );
}
`)}let S={...t.config.features.jsdoc?{summary:`Whether \`error\` is an \`ApiError\` rejected by {@link ${n.name}}. It narrows to {@link ${i.apiError}}, so checking \`status\` afterwards narrows \`body\` too.`}:{},tags:s===`js`?[{tag:`param`,text:`{unknown} error`},{tag:`returns`,text:`{error is ${i.apiError}}`}]:[]},C=`${n.errorGuard}(error${s===`js`?``:`: unknown`})`;if(s===`dts`)f.push(`${B(S)}export declare function ${C}: error is ${i.apiError};
`);else{let e=o.add(`runtime/errors`,`isApiError`,{typeOnly:!1});f.push(`${B(S)}export function ${C}${s===`ts`?`: error is ${i.apiError}`:``} {
  return (
    ${e}(error) &&
    error.operationId === ${L(r.operationId??n.name)} &&
    error.method === ${L(ee(r.method))}
  );
}
`)}return f.join(`
`)}),exports:o,sources:{operations:[n.key]}}}function vc(e,t){return`(${t(e.contentTypeProperty)} ?? ${L(e.media.mediaType)})`}function yc(e,t={}){let n=e.symbol.operation,r=e.hasParams&&!e.paramsRequired,i=e=>uo(`params`,e,r),a=[`operationId: ${L(n.operationId??e.symbol.name)}`,`method: ${L(ee(n.method))}`,`path: ${L(n.path)}`],o={};for(let n of[`path`,`query`,`header`,`cookie`]){let r=e.parameters.filter(e=>e.parameter.in===n);if(r.length!==0){a.push(`${oc[n]}: { ${r.map(e=>`${R(e.parameter.name)}: ${t.parameter?.(e.parameter,i(e.property))??i(e.property)}`).join(`, `)} }`);for(let{parameter:e}of r){let t=sc(e);t!==void 0&&((o[n]??={})[e.name]=t)}}}Object.keys(o).length>0&&a.push(`styles: ${z(o)}`);let s=e.parameters.find(e=>e.parameter.in===`querystring`);if(s!==void 0){let{parameter:e}=s,n=[`value: ${t.parameter?.(e,i(s.property))??i(s.property)}`,`mediaType: ${L(e.contentType??`application/x-www-form-urlencoded`)}`,...e.encoding===void 0?[]:[`encoding: ${z(e.encoding)}`]];a.push(`querystring: { ${n.join(`, `)} }`)}if(e.body!==void 0){let n=i(e.body.property);if(a.push(`body: ${t.body===void 0?n:t.body(n)}`),e.body.alternatives.length===0)a.push(`mediaType: ${L(e.body.media.mediaType)}`),e.body.media.encoding!==void 0&&a.push(`encoding: ${z(e.body.media.encoding)}`);else{let t=vc(e.body,i);a.push(`mediaType: ${t}`);for(let n of[e.body.media,...e.body.alternatives])n.encoding!==void 0&&a.push(`...(${t} === ${L(n.mediaType)} ? { encoding: ${z(n.encoding)} } : {})`)}}return e.server!==void 0&&a.push(`server: ${L(e.server)}`),e.successStatuses.length>0&&a.push(`successStatuses: ${z(e.successStatuses)}`),e.accept!==void 0&&a.push(`accept: ${L(e.accept)}`),e.security!==void 0&&a.push(`security: ${z(e.security)}`),e.parseAs!==void 0&&a.push(`parseAs: ${L(e.parseAs)}`),[...a,...t.extra??[]]}var bc={"react-query":`@tanstack/react-query`,"vue-query":`@tanstack/vue-query`,"svelte-query":`@tanstack/svelte-query`,"solid-query":`@tanstack/solid-query`,swr:`swr`},xc={"react-query":`React Query`,"vue-query":`Vue Query`,"svelte-query":`Svelte Query`,"solid-query":`Solid Query`,swr:`SWR`},Sc=class{imports;lang;op;params;#e;#t;#n;queryData;nullable;error;options;constructor(e,t,n,r,i){this.imports=e,this.lang=t,this.#n=i;let a=n.symbol,o=t=>e.add(a.module,t,{typeOnly:!0});this.op=t===`dts`?a.name:e.add(a.module,a.name,{typeOnly:!1}),this.params=n.hasParams?o(a.typeNames.params):`never`,this.#t=a.module,this.#e=a.typeNames.response;let s=r.config.client.responseStyle===`data`,c=n.success.every(e=>e.media===void 0);this.nullable=s&&(c||n.success.some(e=>e.media===void 0)),this.queryData=this.nullable?c?`null`:`Exclude<${this.response}, undefined> | null`:this.response,this.error=o(a.typeNames.error),this.options=e.add(`client`,`RequestOptions`,{typeOnly:!0})}get response(){return this.imports.add(this.#t,this.#e,{typeOnly:!0})}value(e,t=this.#n){return this.lang===`dts`?``:this.imports.add(t,e,{typeOnly:!1,external:!0})}type(e,t=this.#n){return this.imports.add(t,e,{typeOnly:!0,external:!0})}typeofValue(e,t=this.#n){return this.lang===`ts`?this.imports.add(t,e,{typeOnly:!1,external:!0}):this.type(e,t)}typeArgs(e){return this.lang===`js`?``:`<${e.join(`, `)}>`}cast(e,t){return this.lang===`js`?`/** @type {${e}} */ (${t})`:t}assert(e,t){return this.lang===`js`?`/** @type {${e}} */ (${t})`:`${t} as ${e}`}queryCall(e){return this.nullable?`${e}.then((data) => data ?? null)`:e}signal(e,t=`signal`){return`{ ...${e}, signal: ${this.imports.add(`runtime/signal`,`anySignal`,{typeOnly:!1})}(${e}?.signal, ${t}) }`}};function Cc(e,t){return`[${[...e.map(e=>z(e)),...t].join(`, `)}]`}function wc(e,t){return`readonly [${[...e.map(e=>z(e)),...t].join(`, `)}]`}function Tc(e){return`${e.includes(`=>`)?`(${e})`:e} | undefined`}function Ec(e){return/\||=>/.test(e)?`(${e})[]`:`${e}[]`}function H(e,t,n){let r=n.typeParams??[],i=e=>e.optional===!0||e.defaultValue!==void 0,a=n.params.map((e,t)=>n.params.slice(t).every(i));if(e.lang===`js`){let e=[...r.map(e=>({tag:`template`,text:`[${e.name}=${e.default}]`})),...n.params.map((e,t)=>({tag:`param`,text:a[t]===!0?`{${e.type}} [${e.name}] - ${e.description}`:`{${i(e)?Tc(e.type):e.type}} ${e.name} - ${e.description}`})),...n.returns===void 0?[]:[{tag:`returns`,text:`{${n.returns}}`}]],o=n.params.map(e=>e.defaultValue===void 0?e.name:`${e.name} = ${e.defaultValue}`);return`${B({...t,tags:[...t.tags,...e]})}export function ${n.name}(${o.join(`, `)}) {
${n.body}}
`}let o=r.length===0?``:`<${r.map(e=>`${e.name} = ${e.default}`).join(`, `)}>`,s=n.params.map((t,n)=>e.lang===`ts`&&t.defaultValue!==void 0?`${t.name}: ${t.type} = ${t.defaultValue}`:i(t)?a[n]===!0?`${t.name}?: ${t.type}`:`${t.name}: ${Tc(t.type)}`:`${t.name}: ${t.type}`),c=n.returns===void 0?``:`: ${n.returns}`,l=e.lang===`dts`?`export declare function`:`export function`,u=`${l} ${n.name}${o}(${s.join(`, `)})${c}`,d=u.length<=100?u:`${l} ${n.name}${o}(
${s.map(e=>`  ${e},`).join(`
`)}
)${c}`,f=n.params.map(e=>({tag:`param`,text:`${e.name} - ${e.description}`})),p=B({...t,tags:[...t.tags,...f]});return e.lang===`dts`?`${p}${d};
`:`${p}${d} {
${n.body}}
`}function Dc(e,t,n,r){return e.lang===`js`?B({...r,tags:[...r.tags,{tag:`typedef`,text:`{${n}} ${t}`}]}):`${B(r)}export type ${t} = ${n};
`}function Oc(e,t,n,r){return`${e.op}(${(t.hasParams?[n,r]:[r]).join(`, `)})`}function kc(e,t,n,r){return oo(e,{summary:n,description:r,tags:t.symbol.operation.deprecated?[{tag:`deprecated`}]:[]},{kind:`hook`,operation:t.symbol.operation})}function Ac(e,t,n=`Request parameters (part of the query key).`,r=t.params){return e.hasParams?[{name:`params`,type:r,optional:!e.paramsRequired,description:n}]:[]}function jc(e,t,n){let r=e.symbol.name,i=t.queryKeyType??``,a=e.hasParams&&!e.paramsRequired;return[Dc(n,i,wc(t.keyPrefix,e.hasParams?[n.params]:[]),{summary:`Query key of {@link ${r}}: a static prefix followed by every request parameter.`,tags:[]}),H(n,{summary:`Builds the query key of {@link ${r}}.`,tags:[]},{name:t.queryKey??``,params:Ac(e,n),returns:i,body:`  return ${Cc(t.keyPrefix,e.hasParams?[a?`params ?? {}`:`params`]:[])};
`})]}function Mc(e,t,n){let r=t.pageParam??``,i=e.parameters.find(e=>e.parameter.in===`query`&&e.parameter.name===r)?.property??r;return{property:i,paramsType:`Omit<${n.params}, ${z(i)}>`,required:e.parameters.some(e=>e.parameter.required&&e.property!==i)||e.body?.required===!0,pageType:t.pageParamType??``,keyName:t.infiniteQueryKeyType??``,keyFn:t.infiniteQueryKey??``}}function Nc(e,t,n,r){let i=e.symbol.name;return[Dc(n,r.pageType,`${n.params}[${z(r.property)}]`,{summary:`Page parameter of {@link ${t.infiniteHook??i}}: the \`${t.pageParam??``}\` query parameter.`,tags:[]}),Dc(n,r.keyName,wc(t.keyPrefix,[`'infinite'`,r.paramsType]),{summary:`Query key of the infinite query of {@link ${i}}.`,tags:[]}),H(n,{summary:`Builds the infinite query key of {@link ${i}}.`,tags:[]},{name:r.keyFn,params:[Pc(t,r)],returns:r.keyName,body:`  return ${Cc(t.keyPrefix,[`'infinite'`,`params`])};
`})]}function Pc(e,t,n=t.paramsType){return{name:`params`,type:n,...t.required?{}:{defaultValue:`{}`},description:`Request parameters without \`${e.pageParam??``}\` (part of the query key).`}}function Fc(e,t){let n=`(lastPage: ${e.queryData}, allPages: ${Ec(e.queryData)}, lastPageParam: ${t}, allPageParams: ${Ec(t)}) => ${t} | undefined | null`;return`{ initialPageParam: ${t}; getNextPageParam: ${n}; getPreviousPageParam?: ${n} }`}function Ic(e,t){return e.hasParams?e.paramsRequired?t.params:`${t.params} | void`:`void`}function Lc(e,t,n){return e.hasParams?e.paramsRequired?`(variables) => ${t.op}(variables, ${n})`:`(variables) => ${t.op}(variables || undefined, ${n})`:`() => ${t.op}(${n})`}function Rc(e){return(e.symbol.query?.invalidates??[]).map(e=>[...e])}function zc(e,t){let n=(e,t,n=!1)=>e===void 0?[]:[{name:e,kind:t,typeOnly:n}];return t?[...n(e.queryKeyType,`type`,!0),...n(e.queryKey,`query-key`),...n(e.queryOptions,`query-options`),...n(e.hook,`hook`),...n(e.pageParamType,`type`,!0),...n(e.infiniteQueryKeyType,`type`,!0),...n(e.infiniteQueryKey,`query-key`),...n(e.infiniteQueryOptions,`query-options`),...n(e.infiniteHook,`hook`)]:[...n(e.mutationOptions,`mutation-options`),...n(e.hook,`hook`)]}function Bc(e,t,n,r){let i=t.filter(t=>t.symbol.group===e.group&&t.symbol.query?.queryKey!==void 0),a=I(e.module,n,(t,n)=>{t.declare(e.name);let a={summary:`${r} keys of the \`${e.tags.join(`/`)}\` operations.`,description:r===`SWR`?"`all` is the prefix of every key of the group, e.g. to revalidate them with `mutate((key) => Array.isArray(key) && keys.all.every((part, index) => key[index] === part))`.":"`all` matches every query of the group, e.g. `queryClient.invalidateQueries({ queryKey: keys.all })`.",tags:[]},o=i.map(e=>({name:e.symbol.name,keyFn:t.add(e.symbol.query?.module??``,e.symbol.query?.queryKey??``,{typeOnly:n===`dts`})})),s=Cc(e.prefix,[]);if(n===`dts`){let t=[`  readonly all: readonly ${s};`,...o.map(e=>`  readonly ${R(e.name)}: typeof ${e.keyFn};`)];return`${B(a)}export declare const ${e.name}: {
${t.join(`
`)}
};
`}let c=[`  all: ${n===`ts`?`${s} as const`:`/** @type {const} */ (${s})`},`,...o.map(e=>`  ${R(e.name)}: ${e.keyFn},`)];return`${B(a)}export const ${e.name} = {
${c.join(`
`)}
};
`});return{module:e.module,origin:`core:query`,...a,exports:[{name:e.name,kind:`query-key`,typeOnly:!1}]}}function Vc(e,t,n){let r=`${e}/index`;return{module:r,origin:`core:query-barrel`,...I(r,t,e=>`${n.map(t=>`export * from '${e.specifier(t.module)}';`).join(`
`)}
`),exports:n.flatMap(e=>e.exports)}}function Hc(e,t,n){let r=e.symbol.name,i=t.queryKeyType??``,a=`${n.type(`DataTag`)}<${i}, ${n.queryData}>`,o=e.hasParams?`params`:``;return H(n,{summary:`Query options of {@link ${r}} for \`queryClient.fetchQuery\`, prefetching and the query hooks.`,tags:[]},{name:t.queryOptions??``,params:[...Ac(e,n),{name:`options`,type:n.options,optional:!0,description:`Per-request options.`}],returns:`{ queryKey: ${a}; queryFn: (context: { signal: AbortSignal }) => Promise<${n.queryData}> }`,body:`  return {
    queryKey: ${n.assert(a,`${t.queryKey??``}(${o})`)},
    queryFn: ({ signal }) => ${n.queryCall(Oc(n,e,`params`,n.signal(`options`)))},
  };
`})}function Uc(e,t,n,r){let i=e.symbol.name,a=`${n.type(`InfiniteData`)}<${n.queryData}, ${r.pageType}>`,o=`${n.type(`DataTag`)}<${r.keyName}, ${a}>`,s=Fc(n,r.pageType);return H(n,{summary:`Infinite query options of {@link ${i}} for \`queryClient.fetchInfiniteQuery\` and the infinite query hooks.`,tags:[]},{name:t.infiniteQueryOptions??``,params:[Pc(t,r),{name:`pagination`,type:s,description:"How pages are requested: `initialPageParam` and `getNextPageParam`."},{name:`options`,type:n.options,optional:!0,description:`Per-request options.`}],returns:`${s} & { queryKey: ${o}; queryFn: (context: { pageParam: ${r.pageType}; signal: AbortSignal }) => Promise<${n.queryData}> }`,body:`  return {
    ...pagination,
    queryKey: ${n.assert(o,`${r.keyFn}(params)`)},
    queryFn: ({ pageParam, signal }) => ${n.queryCall(`${n.op}({ ...params, ${R(r.property)}: pageParam }, ${n.signal(`options`)})`)},
  };
`})}function Wc(e,t,n){let r=e.symbol.name,i=Ic(e,n);return H(n,{summary:`Mutation options of {@link ${r}} for the mutation hooks.`,tags:[]},{name:t.mutationOptions??``,params:[{name:`options`,type:n.options,optional:!0,description:`Per-request options.`}],returns:`{ mutationKey: readonly ${Cc(t.keyPrefix,[])}; mutationFn: (variables: ${i}) => Promise<${n.response}> }`,body:`  return {
    mutationKey: ${Cc(t.keyPrefix,[])},
    mutationFn: ${Lc(e,n,`options`)},
  };
`})}function Gc(e,t,n,r){return e.length===0?``:`${r}onSuccess: async (...args) => {
${r}  await Promise.all([
${e.map(e=>`${r}    ${t}.invalidateQueries({ queryKey: ${Cc(e,[])} }),`).join(`
`)}
${r}  ]);
${r}  return ${n}.onSuccess?.(...args);
${r}},
`}function Kc(e,t,n,r){let i=e.symbol.name,a=t.queryKeyType??``,o=t.queryKey??``,s=Ac(e,n),c=e.hasParams?`params`:``,l=[n.queryData,n.error,n.queryData,a],u=`${n.type(`UseQueryOptions`)}<${l.join(`, `)}>`,d=jc(e,t,n),f=`{
    queryKey: ${o}(${c}),
    queryFn: ({ signal }) => ${n.queryCall(Oc(n,e,`params`,n.signal(`options`)))},
  }`;d.push(H(n,{summary:`Query options of {@link ${i}} for \`useQuery\`, \`queryClient.fetchQuery\`, prefetching and server rendering.`,tags:[]},{name:t.queryOptions??``,params:[...s,{name:`options`,type:n.options,optional:!0,description:`Per-request options.`}],...n.lang===`dts`?{returns:`${u} & { queryKey: ${n.type(`DataTag`)}<${a}, ${n.queryData}> }`}:{},body:`  return ${n.value(`queryOptions`)}${n.typeArgs(l)}(${n.cast(u,f)});
`}));let p=[n.queryData,n.error,`TData`,a],m=`${n.type(`UseQueryOptions`)}<${p.join(`, `)}>`,h=`{
      ...reactQueryOptions,
      queryKey: ${o}(${c}),
      queryFn: ({ signal }) => ${n.queryCall(Oc(n,e,`params`,n.signal(`request`)))},
    }`;return d.push(H(n,kc(r,e,`React Query hook for {@link ${i}}.`,"Cancellation is wired to the query signal. `TData` is inferred from `select`."),{name:t.hook,typeParams:[{name:`TData`,default:n.queryData}],params:[...s,{name:`options`,type:`Omit<${m}, 'queryKey' | 'queryFn'> & { request?: ${n.options} | undefined }`,defaultValue:`{}`,description:"React Query options plus `request` options for the HTTP call."},{name:`queryClient`,type:n.type(`QueryClient`),optional:!0,description:`Use this QueryClient instead of the one from context.`}],returns:`${n.type(`UseQueryResult`)}<TData, ${n.error}>`,body:`  const { request, ...reactQueryOptions } = options;
  return ${n.value(`useQuery`)}${n.typeArgs(p)}(
    ${n.cast(m,h)},
    queryClient,
  );
`})),t.infiniteHook!==void 0&&d.push(...qc(e,t,n,r)),d}function qc(e,t,n,r){let i=e.symbol.name,a=Mc(e,t,n),{pageType:o,keyName:s,keyFn:c,property:l}=a,u=Pc(t,a),d=`${n.type(`InfiniteData`)}<${n.queryData}, ${o}>`,f=e=>[n.queryData,n.error,e,s,o],p=e=>`Parameters<typeof ${n.typeofValue(`useInfiniteQuery`)}<${f(e).join(`, `)}>>[0]`,m=e=>`({ pageParam, signal }) => ${n.queryCall(`${n.op}({ ...params, ${R(l)}: pageParam }, ${n.signal(e)})`)}`;return[...Nc(e,t,n,a),H(n,{summary:`Infinite query options of {@link ${i}} for \`useInfiniteQuery\` and \`queryClient.fetchInfiniteQuery\`.`,tags:[]},{name:t.infiniteQueryOptions??``,params:[u,{name:`pagination`,type:Fc(n,o),description:"How pages are requested: `initialPageParam` and `getNextPageParam`."},{name:`options`,type:n.options,optional:!0,description:`Per-request options.`}],...n.lang===`dts`?{returns:`${p(d)} & { queryKey: ${n.type(`DataTag`)}<${s}, ${d}> }`}:{},body:`  return ${n.value(`infiniteQueryOptions`)}${n.typeArgs(f(d))}(
    ${n.cast(p(d),`{
      ...pagination,
      queryKey: ${c}(params),
      queryFn: ${m(`options`)},
    }`)},
  );
`}),H(n,kc(r,e,`Infinite query hook for {@link ${i}}, paginating with the \`${t.pageParam??``}\` query parameter.`,"Provide `initialPageParam` and `getNextPageParam` to describe how pages are requested."),{name:t.infiniteHook??``,typeParams:[{name:`TData`,default:d}],params:[u,{name:`options`,type:`Omit<${p(`TData`)}, 'queryKey' | 'queryFn'> & { request?: ${n.options} | undefined }`,description:"React Query options, including pagination, plus `request` options."},{name:`queryClient`,type:n.type(`QueryClient`),optional:!0,description:`Use this QueryClient instead of the one from context.`}],returns:`${n.type(`UseInfiniteQueryResult`)}<TData, ${n.error}>`,body:`  const { request, ...reactQueryOptions } = options;
  return ${n.value(`useInfiniteQuery`)}${n.typeArgs(f(`TData`))}(
    ${n.cast(p(`TData`),`{
      ...reactQueryOptions,
      queryKey: ${c}(params),
      queryFn: ${m(`request`)},
    }`)},
    queryClient,
  );
`})]}function Jc(e,t,n,r,i){let a=e.symbol.name,o=Ic(e,n),s=Cc(t.keyPrefix,[]),c=e=>`${n.type(`UseMutationOptions`)}<${[n.response,n.error,o,...e===void 0?[]:[e]].join(`, `)}>`,l=i.length===0?``:`      onSuccess: async (...args) => {
        await Promise.all([
${i.map(e=>`          client.invalidateQueries({ queryKey: ${Cc(e,[])} }),`).join(`
`)}
        ]);
        return reactQueryOptions.onSuccess?.(...args);
      },
`,u=i.length===0?``:`  const client = ${n.value(`useQueryClient`)}(queryClient);
`,d=[n.response,n.error,o,`TContext`];return[H(n,{summary:`Mutation options of {@link ${a}} for \`useMutation\`.`,tags:[]},{name:t.mutationOptions??``,params:[{name:`options`,type:n.options,optional:!0,description:`Per-request options.`}],returns:c(),body:`  return {
    mutationKey: ${s},
    mutationFn: ${Lc(e,n,`options`)},
  };
`}),H(n,kc(r,e,`React Query mutation hook for {@link ${a}}.`,Yc(i)),{name:t.hook,typeParams:[{name:`TContext`,default:`unknown`}],params:[{name:`options`,type:`Omit<${c(`TContext`)}, 'mutationKey' | 'mutationFn'> & { request?: ${n.options} | undefined }`,defaultValue:`{}`,description:"React Query options plus `request` options for the HTTP call."},{name:`queryClient`,type:n.type(`QueryClient`),optional:!0,description:`Use this QueryClient instead of the one from context.`}],returns:`${n.type(`UseMutationResult`)}<${d.join(`, `)}>`,body:`  const { request, ...reactQueryOptions } = options;
${u}  return ${n.value(`useMutation`)}${n.typeArgs(d)}(
    ${n.cast(c(`TContext`),`{
      ...reactQueryOptions,
      mutationKey: ${s},
      mutationFn: ${Lc(e,n,`request`)},
${l}    }`)},
    queryClient,
  );
`})]}function Yc(e){return e.length===0?"Pass `onSuccess` to react to results, for example to invalidate queries.":`On success it invalidates ${e.map(e=>`\`${JSON.stringify(e)}\``).join(`, `)} before calling your \`onSuccess\`.`}var Xc={name:`Svelte`,plain:e=>e},Zc={name:`Solid`,plain:e=>`Omit<ReturnType<${e}>, 'initialData'>`},Qc=e=>`() => ${e}`;function $c(e){return{name:`queryClient`,type:Qc(e.type(`QueryClient`)),optional:!0,description:`Use this QueryClient instead of the one from context.`}}function el(e,t,n,r,i){let a=t.symbol.name,o=n.queryKeyType??``,s=[r.queryData,r.error,`TData`,o],c=e.plain(`${r.type(`CreateQueryOptions`)}<${s.join(`, `)}>`),l=`{
      ...queryOptions,
      queryKey: ${n.queryKey??``}(${t.hasParams?`values`:``}),
      queryFn: ({ signal }) => ${r.queryCall(Oc(r,t,`values`,r.signal(`request`)))},
    }`,u=t.hasParams?[{name:`params`,type:Qc(t.paramsRequired?r.params:`${r.params} | undefined`),...t.paramsRequired?{}:{defaultValue:`() => undefined`},description:`Returns the request parameters (part of the query key); read reactively.`}]:[];return[...jc(t,n,r),Hc(t,n,r),H(r,kc(i,t,`${e.name} Query for {@link ${a}}.`,"Parameters and options are accessors, read reactively: the query refetches when they change. Cancellation is wired to the query signal. `TData` is inferred from `select`."),{name:n.hook,typeParams:[{name:`TData`,default:r.queryData}],params:[...u,{name:`options`,type:Qc(`Omit<${c}, 'queryKey' | 'queryFn'> & { request?: ${r.options} | undefined }`),defaultValue:`() => ({})`,description:`Returns ${e.name} Query options plus \`request\` options for the HTTP call.`},$c(r)],returns:`${r.type(`CreateQueryResult`)}<TData, ${r.error}>`,body:`  return ${r.value(`createQuery`)}${r.typeArgs(s)}(() => {
    const { request, ...queryOptions } = options();
`+(t.hasParams?`    const values = params();
`:``)+`    return ${r.cast(c,l)};
  }, queryClient);
`}),...n.infiniteHook===void 0?[]:tl(e,t,n,r,i)]}function tl(e,t,n,r,i){let a=t.symbol.name,o=Mc(t,n,r),s=`${r.type(`InfiniteData`)}<${r.queryData}, ${o.pageType}>`,c=[r.queryData,r.error,`TData`,o.keyName,o.pageType],l=e.plain(`${r.type(`CreateInfiniteQueryOptions`)}<${c.join(`, `)}>`),u=`{
      ...queryOptions,
      queryKey: ${o.keyFn}(values),
      queryFn: ({ pageParam, signal }) => ${r.queryCall(`${r.op}({ ...values, ${R(o.property)}: pageParam }, ${r.signal(`request`)})`)},
    }`;return[...Nc(t,n,r,o),Uc(t,n,r,o),H(r,kc(i,t,`${e.name} infinite query for {@link ${a}}, paginating with the \`${n.pageParam??``}\` query parameter.`,"Provide `initialPageParam` and `getNextPageParam` to describe how pages are requested. Parameters and options are accessors, read reactively."),{name:n.infiniteHook??``,typeParams:[{name:`TData`,default:s}],params:[{name:`params`,type:Qc(o.paramsType),...o.required?{}:{defaultValue:`() => ({})`},description:`Returns the request parameters without \`${n.pageParam??``}\` (part of the query key).`},{name:`options`,type:Qc(`Omit<${l}, 'queryKey' | 'queryFn'> & { request?: ${r.options} | undefined }`),description:`Returns ${e.name} Query options, including pagination, plus \`request\` options.`},$c(r)],returns:`${r.type(`CreateInfiniteQueryResult`)}<TData, ${r.error}>`,body:`  return ${r.value(`createInfiniteQuery`)}${r.typeArgs(c)}(() => {
    const { request, ...queryOptions } = options();
    const values = params();
    return ${r.cast(l,u)};
  }, queryClient);
`})]}function nl(e,t,n,r,i,a){let o=t.symbol.name,s=Ic(t,r),c=[r.response,r.error,s,`TContext`],l=e.plain(`${r.type(`CreateMutationOptions`)}<${c.join(`, `)}>`),u=a.length===0?``:`  const client = ${r.value(`useQueryClient`)}(queryClient?.());
`,d=`{
      ...mutationOptions,
      mutationKey: ${Cc(n.keyPrefix,[])},
      mutationFn: ${Lc(t,r,`request`)},
${Gc(a,`client`,`mutationOptions`,`      `)}    }`;return[Wc(t,n,r),H(r,kc(i,t,`${e.name} Query mutation for {@link ${o}}.`,Yc(a)),{name:n.hook,typeParams:[{name:`TContext`,default:`unknown`}],params:[{name:`options`,type:Qc(`Omit<${l}, 'mutationKey' | 'mutationFn'> & { request?: ${r.options} | undefined }`),defaultValue:`() => ({})`,description:`Returns ${e.name} Query options plus \`request\` options for the HTTP call.`},$c(r)],returns:`${r.type(`CreateMutationResult`)}<${c.join(`, `)}>`,body:u+`  return ${r.value(`createMutation`)}${r.typeArgs(c)}(() => {
    const { request, ...mutationOptions } = options();
    return ${r.cast(l,d)};
  }, queryClient);
`})]}var rl=`swr/mutation`,il=`swr/infinite`;function al(e,t,n){return e.lang===`dts`?``:e.imports.add(t,`default`,{typeOnly:!1,external:!0,local:n})}function ol(e,t,n,r){let i=e.symbol.name,a=n.response,o=jc(e,t,n),s=e.hasParams?`params`:``;return o.push(H(n,kc(r,e,`SWR hook for {@link ${i}}.`,"Requests are deduplicated and revalidated by the query key. Set `enabled: false` to skip fetching (the key becomes `null`)."),{name:t.hook,params:[...Ac(e,n),{name:`options`,type:`${n.type(`SWRConfiguration`,`swr`)}<${a}, ${n.error}> & { request?: ${n.options} | undefined; enabled?: boolean | undefined }`,defaultValue:`{}`,description:"SWR options, `enabled`, and `request` options for the HTTP call."}],returns:`${n.type(`SWRResponse`,`swr`)}<${a}, ${n.error}>`,body:`  const { request, enabled = true, ...swrOptions } = options;
  return ${al(n,`swr`,`useSWR`)}(
    enabled ? ${t.queryKey??``}(${s}) : null,
    () => ${Oc(n,e,`params`,`request`)},
    swrOptions,
  );
`})),t.infiniteHook!==void 0&&o.push(...sl(e,t,n,r)),o}function sl(e,t,n,r){let i=e.symbol.name,a=Mc(e,t,n),o=n.response,s=wc(t.keyPrefix,[`'infinite'`,a.paramsType,a.pageType]),c=t.keyPrefix.length+1,l=`(lastPage: ${o}, pageIndex: number) => ${a.pageType} | undefined | null`;return[...Nc(e,t,n,a),H(n,kc(r,e,`SWR infinite hook for {@link ${i}}, paginating with the \`${t.pageParam??``}\` query parameter.`,"Provide `initialPageParam` and `getNextPageParam`; returning `undefined` or `null` from `getNextPageParam` ends the list."),{name:t.infiniteHook??``,params:[Pc(t,a),{name:`options`,type:`Omit<${n.type(`SWRInfiniteConfiguration`,il)}<${o}, ${n.error}>, 'parallel'> & { initialPageParam: ${a.pageType}; getNextPageParam: ${l}; request?: ${n.options} | undefined; enabled?: boolean | undefined }`,description:"SWR options with pagination, `enabled`, and `request` options."}],returns:`${n.type(`SWRInfiniteResponse`,il)}<${o}, ${n.error}>`,body:`  const { request, enabled = true, initialPageParam, getNextPageParam, ...swrOptions } = options;
  return ${al(n,il,`useSWRInfinite`)}(
    (pageIndex${n.lang===`ts`?`: number`:``}, previousPage${n.lang===`ts`?`: ${o} | null`:``})${n.lang===`ts`?`: ${s} | null`:``} => {
      if (!enabled) return null;
      // The first page is always requested (its page parameter may be undefined); later
      // pages end the list when getNextPageParam returns undefined or null, or when the
      // previous page has no data to compute it from (a \`null\` body).
      if (pageIndex === 0) return ${n.assert(s,`[...${a.keyFn}(params), initialPageParam]`)};
      if (previousPage === null) return null;
      const page = getNextPageParam(previousPage, pageIndex - 1);
      return page === undefined || page === null ? null : ${n.assert(s,`[...${a.keyFn}(params), page]`)};
    },
    (key${n.lang===`ts`?`: ${s}`:``}) => ${n.op}({ ...key[${c}], ${R(a.property)}: key[${c+1}] }, request),
    swrOptions,
  );
`})]}function cl(e){return e.map((e,t)=>`key[${t}] === ${z(e)}`).join(` && `)}function ll(e,t,n,r,i){let a=e.symbol.name,o=Ic(e,n),s=Cc(t.keyPrefix,[]),c=`readonly ${s}`,l=[n.response,n.error,c,o],u=e.hasParams?`(_key${n.lang===`ts`?`: ${c}`:``}, { arg }${n.lang===`ts`?`: { arg: ${o} }`:``}) => ${n.op}(${e.paramsRequired?`arg`:`arg || undefined`}, request)`:`() => ${n.op}(request)`,d=e=>`(key) => Array.isArray(key) && ${cl(e)}`,f=ul(i,r),p=i.length===0?``:`  const { mutate } = ${n.value(`useSWRConfig`,`swr`)}();
`,m=i.length===0?``:`      onSuccess: (...args) => {
        // Revalidates the cached queries whose keys start with each prefix.
`+i.map(e=>`        void mutate(${d(e)});
`).join(``)+(f.length===0?``:dl(n,f))+`        swrOptions.onSuccess?.(...args);
      },
`,h=i.length===0?"Call `trigger(params)` to send the request.":`Call \`trigger(params)\` to send the request. On success it revalidates the queries under ${i.map(e=>`\`${JSON.stringify(e)}\``).join(`, `)}${f.length===0?``:` (infinite lists with every loaded page)`}, then calls your \`onSuccess\`.`,g=`${n.type(`SWRMutationConfiguration`,rl)}<${l.join(`, `)}>`;return[H(n,kc(r,e,`SWR mutation hook for {@link ${a}}.`,h),{name:t.hook,params:[{name:`options`,type:`${g} & { request?: ${n.options} | undefined }`,defaultValue:`{}`,description:"SWR mutation options plus `request` options for the HTTP call."}],returns:`${n.type(`SWRMutationResponse`,rl)}<${l.join(`, `)}>`,body:`  const { request, ...swrOptions } = options;
${p}  return ${al(n,rl,`useSWRMutation`)}(
    ${n.assert(c,s)},
    ${u},
`+(m===``?`    swrOptions,
  );
`:`    ${n.cast(g,`{
      ...swrOptions,
${m}    }`)},
  );
`)})]}function ul(e,t){let n=[];for(let r of t.project.operations){let t=r.query;if(t?.infiniteHook===void 0)continue;let i=[...t.keyPrefix,`infinite`];e.some(e=>e.length<=i.length&&e.every((e,t)=>i[t]===e))&&n.push(i)}return n}function dl(e,t){let n=e.type(`Arguments`,`swr`),r=e.value(`unstable_serialize`,il),i=t.map(e=>`key.length === ${e.length+2} && ${cl(e)}`).map(e=>t.length===1?e:`(${e})`).join(` || `);return`        // The filter skips infinite lists: clear their loaded pages without a request, then
        // revalidate each list by its first page's key, which refetches every page.
        ${e.lang===`ts`?`const pages: ${n}[] = [];`:`const pages = /** @type {${n}[]} */ ([]);`}
        void mutate(
          (key) => {
            if (!Array.isArray(key) || !(${i})) return false;
            pages.push(key);
            return true;
          },
          undefined,
          { revalidate: false },
        ).then(() => Promise.all(pages.map((page) => mutate(${r}(() => page)))));
`}var fl=`vue`;function pl(e,t){return`${e.type(`MaybeRefOrGetter`,fl)}<${t}>`}function ml(e,t,n,r){let i=e.symbol.name,a=t.queryKeyType??``,o=[n.queryData,n.error,`TData`,a],s=`Exclude<${n.type(`UseQueryOptions`)}<${n.queryData}, ${n.error}, TData, ${n.queryData}, ${a}>, ${n.type(`Ref`,fl)}<unknown>>`,c=n.value(`toValue`,fl),l=[...jc(e,t,n),Hc(e,t,n)],u=`{
        ...vueQueryOptions,
        queryKey: ${t.queryKey??``}(${e.hasParams?`values`:``}),
        queryFn: ({ signal }) => ${n.queryCall(Oc(n,e,`values`,n.signal(`request`)))},
      }`;return l.push(H(n,kc(r,e,`Vue Query composable for {@link ${i}}.`,"Parameters and options may be refs or getters: the query refetches when they change. Cancellation is wired to the query signal. `TData` is inferred from `select`."),{name:t.hook,typeParams:[{name:`TData`,default:n.queryData}],params:[...Ac(e,n,`Request parameters (part of the query key); a ref or getter keeps them reactive.`,pl(n,e.paramsRequired?n.params:`${n.params} | undefined`)),{name:`options`,type:pl(n,`Omit<${s}, 'queryKey' | 'queryFn'> & { request?: ${n.options} | undefined }`),defaultValue:`{}`,description:"Vue Query options plus `request` options for the HTTP call."},{name:`queryClient`,type:n.type(`QueryClient`),optional:!0,description:"Use this QueryClient instead of the one provided by `VueQueryPlugin`."}],returns:`${n.type(`UseQueryReturnType`)}<TData, ${n.error}>`,body:`  return ${n.value(`useQuery`)}${n.typeArgs(o)}(
    ${n.value(`computed`,fl)}(() => {
      const { request, ...vueQueryOptions } = ${c}(options);
`+(e.hasParams?`      const values = ${c}(params);
`:``)+`      return ${n.cast(s,u)};
    }),
    queryClient,
  );
`})),t.infiniteHook!==void 0&&l.push(...hl(e,t,n,r)),l}function hl(e,t,n,r){let i=e.symbol.name,a=Mc(e,t,n),o=`${n.type(`InfiniteData`)}<${n.queryData}, ${a.pageType}>`,s=[n.queryData,n.error,`TData`,a.keyName,a.pageType],c=`Exclude<Parameters<typeof ${n.typeofValue(`useInfiniteQuery`)}<${s.join(`, `)}>>[0], ${n.type(`Ref`,fl)}<unknown> | ((...args: never[]) => unknown)>`,l=n.value(`toValue`,fl),u=t.keyPrefix.length+1,d=`{
      ...vueQueryOptions,
      queryKey: ${n.value(`computed`,fl)}(() => ${a.keyFn}(${l}(params))),
      queryFn: ({ pageParam, signal, queryKey }) => ${n.queryCall(`${n.op}({ ...queryKey[${u}], ${R(a.property)}: pageParam }, ${n.signal(`request`)})`)},
    }`;return[...Nc(e,t,n,a),Uc(e,t,n,a),H(n,kc(r,e,`Vue Query infinite query composable for {@link ${i}}, paginating with the \`${t.pageParam??``}\` query parameter.`,"Provide `initialPageParam` and `getNextPageParam` to describe how pages are requested. Parameters may be refs or getters; options are read once, so pass refs for options that change (such as `enabled`)."),{name:t.infiniteHook??``,typeParams:[{name:`TData`,default:o}],params:[Pc(t,a,pl(n,a.paramsType)),{name:`options`,type:`Omit<${c}, 'queryKey' | 'queryFn'> & { request?: ${n.options} | undefined }`,description:"Vue Query options, including pagination, plus `request` options."},{name:`queryClient`,type:n.type(`QueryClient`),optional:!0,description:"Use this QueryClient instead of the one provided by `VueQueryPlugin`."}],returns:`${n.type(`UseInfiniteQueryReturnType`)}<TData, ${n.error}>`,body:`  const { request, ...vueQueryOptions } = options;
  return ${n.value(`useInfiniteQuery`)}${n.typeArgs(s)}(
    ${n.cast(c,d)},
    queryClient,
  );
`})]}function gl(e,t,n,r,i){let a=e.symbol.name,o=Ic(e,n),s=[n.response,n.error,o,`TContext`],c=`${n.type(`MutationObserverOptions`)}<${s.join(`, `)}>`,l=i.length===0?``:`  const client = queryClient ?? ${n.value(`useQueryClient`)}();
`,u=`{
        ...vueQueryOptions,
        mutationKey: ${Cc(t.keyPrefix,[])},
        mutationFn: ${Lc(e,n,`request`)},
${Gc(i,`client`,`vueQueryOptions`,`        `)}      }`;return[Wc(e,t,n),H(n,kc(r,e,`Vue Query mutation composable for {@link ${a}}.`,Yc(i)),{name:t.hook,typeParams:[{name:`TContext`,default:`unknown`}],params:[{name:`options`,type:pl(n,`Omit<${c}, 'mutationKey' | 'mutationFn'> & { request?: ${n.options} | undefined }`),defaultValue:`{}`,description:"Vue Query options plus `request` options for the HTTP call."},{name:`queryClient`,type:n.type(`QueryClient`),optional:!0,description:"Use this QueryClient instead of the one provided by `VueQueryPlugin`."}],returns:`${n.type(`UseMutationReturnType`)}<${s.join(`, `)}>`,body:l+`  return ${n.value(`useMutation`)}${n.typeArgs(s)}(
    ${n.value(`computed`,fl)}(() => {
      const { request, ...vueQueryOptions } = ${n.value(`toValue`,fl)}(options);
      return ${n.cast(c,u)};
    }),
    queryClient,
  );
`})]}function _l(e,t){let n=e.symbol.query;if(n===void 0)return;let r=n.queryKey!==void 0,i=r?[]:Rc(e),a=zc(n,r),o=I(n.module,t,(o,s)=>{for(let e of a)o.declare(e.name);let c=new Sc(o,s,e,t,bc[n.library]);return(()=>{switch(n.library){case`react-query`:return r?Kc(e,n,c,t):Jc(e,n,c,t,i);case`vue-query`:return r?ml(e,n,c,t):gl(e,n,c,t,i);case`svelte-query`:case`solid-query`:{let a=n.library===`svelte-query`?Xc:Zc;return r?el(a,e,n,c,t):nl(a,e,n,c,t,i)}case`swr`:return r?ol(e,n,c,t):ll(e,n,c,t,i)}})().join(`
`)});return{module:n.module,origin:`core:query`,...o,exports:a,sources:{operations:[e.symbol.key]}}}function vl(e,t){let n=Va(t.config)?.library;if(n===void 0)return[];let r=[];for(let n of e){let e=_l(n,t);e!==void 0&&r.push(e)}for(let i of t.project.queryGroups)r.push(Bc(i,e,t,xc[n]));return t.config.output.barrel&&r.push(Vc(n,t,r)),r}var yl=[`types`,`errors`,`serialization`,`signal`,`client`,`middleware`],bl=m.join(m.dirname(w(self.location.href)),`..`,`..`,`assets`),xl=/* @__PURE__ */ new Map;function Sl(e){let t=xl.get(e);if(t===void 0){try{t=re(m.join(bl,e),`utf8`)}catch(t){throw Error(`Runtime template ${e} is missing. Run \`node scripts/build-assets.ts runtime\` (or reinstall the package).`,{cause:t})}xl.set(e,t)}return t}function Cl(e){return[...yl,...e.types.dates===`Date`?[`dates`]:[],e.client.adapter]}function wl(e){let t=no(e),n=e=>e.replace(/(from\s+['"])\.\/([\w-]+)\.js(['"])/g,(e,n,r,i)=>`${n}./${r}${t}${i}`),r=Cl(e).map(e=>({name:`runtime/${e}`,origin:`core:runtime`}));e.features.mocks!==!1&&r.push({name:`mocks/fake`,origin:`core:mocks`},{name:`mocks/support`,origin:`core:mocks`});let i=[];for(let{name:t,origin:a}of r){let r=e.output.language===`typescript`?[[`ts`,`${t}.ts`]]:[[`js`,`${t}.js`],[`d.ts`,`${t}.d.ts`]];for(let[o,s]of r){let r=o===`js`?`// @ts-nocheck
`:``;i.push({path:`${t}.${o}`,content:to(e)+r+n(Sl(s)),origin:a})}}return i}function Tl(e){let t=2166136261;for(let n=0;n<e.length;n++)t^=e.charCodeAt(n),t=Math.imul(t,16777619);return t>>>0}function El(e,t){return Tl(`${e}:${t}`)||1}var Dl=class e{#e;constructor(e){this.#e=e>>>0}static of(t){return new e(Tl(t))}next(){this.#e=this.#e+1831565813|0;let e=this.#e;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}int(e,t){return e+Math.floor(this.next()*(t-e+1))}pick(e){return e[this.int(0,e.length-1)]??e[0]}chance(e){return this.next()<e}},U=class extends Error{},Ol=[[48,57]],kl=[[97,122],[65,90],[48,57],[95,95]],Al=[[32,32],[9,13],[160,160],[5760,5760],[8192,8202],[8232,8233],[8239,8239],[8287,8287],[12288,12288],[65279,65279]],jl=[[10,10],[13,13],[8232,8233]],Ml=[`abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`,`-_.~ !@#$%&*+=:;,?/'"()[]{}<>^|\`\\`,`àéîõüñçßøåæÀÉÑǅʰ`,`αβγδεζηθλμπσωΔΣΩ`,`абвгдежзиклмнопАБВГД`,`אבגדהוזחט`,`ابتثجحخدذر٠١٢`,`अआइईउकखगघ०१`,`กขคงจฉ๑`,`中文字日本語人`,`あいうえおかき`,`アイウエオカキ`,`한국어사람`,`€£¥©®™±×÷§¶°`,`\xA0 ​́ःⅠ½`,`😀🚀🎉✨`].join(``),Nl=1e3,Pl=32,Fl=1e3,Il=1e4,Ll=2e5,Rl=class{#e;#t=0;#n=0;#r=0;#i=/* @__PURE__ */ new Map;#a=[];#o=!1;#s=[];constructor(e){this.#e=e}parse(){let e=this.#u();if(this.#t<this.#e.length)throw new U(`unbalanced parenthesis`);for(let e of this.#a)if(e.name!==void 0){let t=this.#i.get(e.name);if(t===void 0)throw new U(`unknown group name`);e.index=t}else if(e.index>this.#r)throw new U(`reference to a missing group`);return{root:e,groups:this.#r,checked:this.#o,preferred:this.#s.flatMap(e=>Wl(e))}}#c(e=0){return this.#e[this.#t+e]}#l(){let e=this.#e.codePointAt(this.#t-1)??0;return e>65535&&this.#t++,e}#u(){let e=[this.#d()];for(;this.#c()===`|`;)this.#t++,e.push(this.#d());return e.length===1?e[0]??{kind:`empty`}:{kind:`alternation`,options:e}}#d(){let e=[];for(let t=this.#c();t!==void 0&&t!==`|`&&t!==`)`;t=this.#c()){let t=this.#p();e.push(this.#f(t))}return{kind:`sequence`,items:e}}#f(e){let t=this.#c(),n;if(t===`*`?n=[0,1/0]:t===`+`?n=[1,1/0]:t===`?`&&(n=[0,1]),n!==void 0)this.#t++;else if(t===`{`){let t=/^\{(\d+)(,(\d*))?\}/.exec(this.#e.slice(this.#t));if(t===null)return e;let r=Number(t[1]),i=t[2]===void 0?r:t[3]===``?1/0:Number(t[3]);if(r>Fl||i<r)throw new U(`quantifier`);n=[r,i],this.#t+=t[0].length}else return e;return this.#c()===`?`&&this.#t++,e.kind===`assert`||e.kind===`look`?e:{kind:`repeat`,item:e,min:n[0],max:n[1]}}#p(){let e=this.#c()??``;switch(this.#t++,e){case`(`:return this.#m();case`[`:return this.#v();case`.`:return{kind:`set`,parts:[{kind:`ranges`,ranges:jl,negated:!1}],negated:!0};case`^`:return this.#o=!0,{kind:`assert`,which:`start`};case`$`:return this.#o=!0,{kind:`assert`,which:`end`};case`\\`:return this.#h();default:return zl(this.#l())}}#m(){let e,t;if(this.#c()===`?`){let n=this.#c(1),r=this.#c(2);if(n===`:`)this.#t+=2;else if(n===`=`||n===`!`)t={ahead:!0,negated:n===`!`},this.#t+=2;else if(n===`<`&&(r===`=`||r===`!`))t={ahead:!1,negated:r===`!`},this.#t+=3;else if(n===`<`){let t=this.#e.indexOf(`>`,this.#t);if(t===-1)throw new U(`group name`);let n=this.#e.slice(this.#t+2,t);e=++this.#r,this.#i.set(n,e),this.#t=t+1}else{let e=/^\?[ims]*(?:-[ims]+)?:/.exec(this.#e.slice(this.#t));if(e===null)throw new U(`group syntax`);this.#t+=e[0].length}}else e=++this.#r;if(++this.#n>Pl)throw new U(`nesting`);let n=this.#u();if(this.#n--,this.#c()!==`)`)throw new U(`unbalanced parenthesis`);if(this.#t++,t!==void 0){this.#o=!0;let e={kind:`look`,...t,item:n};return t.ahead&&!t.negated&&this.#s.push(n),e}return{kind:`group`,index:e,item:n}}#h(){let e=this.#c();if(e===`b`||e===`B`)return this.#t++,this.#o=!0,{kind:`assert`,which:e===`b`?`boundary`:`inside`};if(e===`k`&&this.#c(1)===`<`){let e=this.#e.indexOf(`>`,this.#t);if(e===-1)throw new U(`group name`);let t={kind:`reference`,index:0,name:this.#e.slice(this.#t+2,e)};return this.#t=e+1,this.#a.push(t),this.#o=!0,t}if(e!==void 0&&/[1-9]/.test(e)){let t=/^\d+/.exec(this.#e.slice(this.#t))?.[0]??e;this.#t+=t.length;let n={kind:`reference`,index:Number(t)};return this.#a.push(n),this.#o=!0,n}let t=this.#g();return t===void 0?zl(this.#_()):{kind:`set`,parts:[t],negated:!1}}#g(){let e=this.#c();if(e===void 0)return;let t=e.toLowerCase(),n=e!==t;if(t===`p`&&this.#c(1)===`{`){let e=this.#e.indexOf(`}`,this.#t),t=e===-1?``:this.#e.slice(this.#t+2,e);if(!/^[A-Za-z_]+(?:=[A-Za-z_]+)?$/.test(t)||Vl(t)===void 0)throw new U(`Unicode property`);return this.#t=e+1,{kind:`property`,name:t,negated:n}}let r=t===`d`?Ol:t===`w`?kl:t===`s`?Al:void 0;if(r!==void 0)return this.#t++,{kind:`ranges`,ranges:r,negated:n}}#_(){let e=this.#c();if(e===void 0)throw new U(`trailing backslash`);this.#t++;let t={t:9,n:10,v:11,f:12,r:13};if(Object.prototype.hasOwnProperty.call(t,e))return t[e]??0;if(e===`0`&&!/\d/.test(this.#c()??``))return 0;if(e===`c`){let e=this.#c();return e===void 0||!/[A-Za-z]/.test(e)?92:(this.#t++,(e.codePointAt(0)??0)%32)}let n=e=>{let t=this.#e.slice(this.#t,this.#t+e);if(t.length!==e||!/^[0-9a-fA-F]+$/.test(t))throw new U(`escape`);return this.#t+=e,Number.parseInt(t,16)};if(e===`x`)return n(2);if(e===`u`){if(this.#c()!==`{`)return n(4);let e=this.#e.indexOf(`}`,this.#t),t=this.#e.slice(this.#t+1,e);if(e===-1||!/^[0-9a-fA-F]{1,6}$/.test(t))throw new U(`escape`);return this.#t=e+1,Number.parseInt(t,16)}return this.#l()}#v(){let e=this.#c()===`^`;e&&this.#t++;let t=[],n=[];for(;;){let e=this.#c();if(e===void 0)throw new U(`unterminated class`);if(e===`]`){this.#t++;break}let r=this.#y(n);if(r!==void 0){if(this.#c()===`-`&&this.#c(1)!==`]`&&this.#c(1)!==void 0){this.#t++;let e=this.#y(n);if(e===void 0||e<r)throw new U(`class range`);t.push([r,e])}else t.push([r,r])}}return t.length>0&&n.unshift({kind:`ranges`,ranges:t,negated:!1}),{kind:`set`,parts:n,negated:e}}#y(e){let t=this.#c()??``;if(this.#t++,t!==`\\`)return this.#l();if(this.#c()===`b`)return this.#t++,8;if(this.#c()===`-`)return this.#t++,45;let n=this.#g();if(n===void 0)return this.#_();e.push(n)}};function zl(e){return{kind:`set`,parts:[{kind:`ranges`,ranges:[[e,e]],negated:!1}],negated:!1}}var Bl=/* @__PURE__ */ new Map;function Vl(e){if(Bl.has(e))return Bl.get(e);let t;try{t=RegExp(`^\\p{${e}}$`,`u`)}catch{t=void 0}return Bl.set(e,t),t}function Hl(e,t){return t.some(([t,n])=>e>=t&&e<=n)}function Ul(e,t){return t.parts.some(t=>(t.kind===`ranges`?Hl(e,t.ranges):Vl(t.name)?.test(String.fromCodePoint(e))??!1)!==t.negated)!==t.negated}function Wl(e){switch(e.kind){case`set`:return e.negated||e.parts.length!==1||e.parts[0]?.kind!==`ranges`?[]:[Gl(e)];case`sequence`:return e.items.flatMap(Wl);case`alternation`:return e.options.flatMap(Wl);case`repeat`:return e.min>0?Wl(e.item):[];case`group`:return Wl(e.item);default:return[]}}function Gl(e){let t=e.parts[0];if(t?.kind!==`ranges`)return``;let n=``;for(let[e,r]of t.ranges)for(let t=e;t<=r&&n.length<64;t++)n+=String.fromCodePoint(t);return n}function Kl(e,t,n){return t+Math.floor(e.next()*(n-t+1))}function ql(e,t){let{random:n}=t;if(t.preferred!==``&&n.next()<.5){let r=Array.from(t.preferred).filter(t=>Ul(t.codePointAt(0)??0,e));if(r.length>0)return r[Kl(n,0,r.length-1)]??``}if(!e.negated&&e.parts.every(e=>e.kind===`ranges`&&!e.negated)){let t=e.parts.flatMap(e=>e.kind===`ranges`?e.ranges:[]),r=t.flatMap(([e,t])=>{let n=Math.max(e,32),r=Math.min(t,126);return n<=r?[[n,r]]:[]}),i=r.length>0?r:t,a=i[Kl(n,0,i.length-1)];if(a===void 0)throw new U(`empty class`);return String.fromCodePoint(Kl(n,a[0],a[1]))}let r=Array.from(Ml).filter(t=>Ul(t.codePointAt(0)??0,e));if(r.length===0)throw new U(`empty class`);let i=r.filter(e=>(e.codePointAt(0)??0)<128),a=i.length>0&&n.next()<.8?i:r;return a[Kl(n,0,a.length-1)]??``}function Jl(e,t){switch(e.kind){case`empty`:case`assert`:return``;case`look`:return!e.ahead&&!e.negated&&t.behind?Jl(e.item,t):``;case`set`:return ql(e,t);case`sequence`:{let n=``;for(let r of e.items)if(n+=Jl(r,t),n.length>Il)throw new U(`too long`);return n}case`alternation`:{let n=e.options[Kl(t.random,0,e.options.length-1)];return n===void 0?``:Jl(n,t)}case`repeat`:{let n=Math.min(e.max-e.min,t.extra),r=e.min+(n>0?Kl(t.random,0,n):0),i=``;for(let n=0;n<r;n++)if(i+=Jl(e.item,t),i.length>Il)throw new U(`too long`);return i}case`group`:{let n=Jl(e.item,t);return e.index!==void 0&&(t.captures[e.index]=n),n}case`reference`:return t.captures[e.index]??``}}var Yl=class extends Error{};function Xl(e,t){let n=0,r=e=>{let n=t.charCodeAt(e);return Number.isFinite(n)&&Hl(n,kl)},i=(e,a,o,s)=>{if(++n>Ll)throw new Yl;switch(e.kind){case`empty`:return s(a,o);case`set`:{if(a>=t.length)return!1;let n=t.codePointAt(a)??0;return Ul(n,e)?s(a+(n>65535?2:1),o):!1}case`sequence`:{let t=(n,r,a)=>{let o=e.items[n];return o===void 0?s(r,a):i(o,r,a,(e,r)=>t(n+1,e,r))};return t(0,a,o)}case`alternation`:return e.options.some(e=>i(e,a,o,s));case`group`:return i(e.item,a,o,(n,r)=>{if(e.index===void 0)return s(n,r);let i=[...r];return i[e.index]=t.slice(a,n),s(n,i)});case`reference`:{let n=o[e.index];return n===void 0?s(a,o):t.startsWith(n,a)?s(a+n.length,o):!1}case`assert`:return(e.which===`start`?a===0:e.which===`end`?a===t.length:r(a-1)!==r(a)==(e.which===`boundary`))&&s(a,o);case`look`:{let t;if(e.ahead)i(e.item,a,o,(e,n)=>(t=n,!0));else for(let n=a;n>=0&&!i(e.item,n,o,(e,n)=>e===a&&(t=n,!0));n--);return e.negated?t===void 0&&s(a,o):t!==void 0&&s(a,t)}case`repeat`:{let t=(n,r,a)=>n<e.max&&i(e.item,r,a,(e,i)=>e!==r&&t(n+1,e,i))?!0:n>=e.min&&s(r,a);return t(0,a,o)}}};try{for(let n=0;n<=t.length;n++)if(i(e.root,n,[],()=>!0))return!0;return!1}catch(e){if(e instanceof Yl)return!1;throw e}}var Zl=/* @__PURE__ */ new Map;function Ql(e){if(Zl.has(e))return Zl.get(e);let t;if(e.length<=Nl)try{t=new Rl(e).parse()}catch(e){if(!(e instanceof U))throw e}return Zl.set(e,t),t}function $l(e,t,n){let r=Array.from(e).length;return Math.min(r,e.length)>=t&&Math.max(r,e.length)<=n}var eu=[3,1,0,6,12,24,48,96];function tu(e,t,n=0,r=1/0){let i=Ql(e);if(i===void 0)return;let a=i.preferred.join(``);for(let e of eu)for(let o=0;o<8;o++){let s;try{s=Jl(i.root,{random:t,extra:e,captures:Array.from({length:i.groups+1},()=>{}),preferred:a,behind:o%2==0})}catch(e){if(e instanceof U)return;throw e}if(!$l(s,n,r))break;if(!i.checked||Xl(i,s))return s}}function nu(e,t){let n=Ql(e);return n===void 0?void 0:Xl(n,t)}function W(e){let[t=``,...n]=e.split(`|`);return[t,...n]}function ru(e){let t=e=>{let[t=``,n=``]=e.split(`:`);return[t,n]},[n,...r]=W(e);return[t(n),...r.map(t)]}var iu=W(`Ada|Grace|Alan|Linus|Margaret|Katherine|Dennis|Barbara|Ken|Radia|Tim|Hedy|Frances|Edsger|Donald|Shafi|Leslie|Sophie|Priya|Mateo|Amara|Yuki|Lena|Omar|Chen|Sofia|Noah|Aisha|Lucas|Mia|Ethan|Zara|Hiro|Ingrid|Diego|Fatima|Liam|Elena|Kwame|Nadia|Oscar|Ravi|Sara|Tomás|Viktor|Wen|Ximena|Yusuf|Zoe|Alex|Jordan|Taylor|Morgan|Riley|Casey|Jamie|Avery|Quinn|Rowan|Maya`),au=W(`Lovelace|Hopper|Turing|Torvalds|Hamilton|Johnson|Ritchie|Liskov|Thompson|Perlman|Lamarr|Allen|Dijkstra|Knuth|Goldwasser|Lamport|Wilson|Patel|García|Okafor|Tanaka|Müller|Haddad|Wang|Rossi|Smith|Khan|Silva|Nguyen|Kim|Ali|Cohen|Larsen|Fernández|Mensah|Novak|Kowalski|Ivanova|Schmidt|Dubois|Andersson|Moreau|Costa|Yilmaz|Park|Singh|Brown|Martin|Lee|Clark|Lewis|Walker|Young|King|Wright|Scott|Green|Baker|Hill`),ou=W(`lorem|ipsum|dolor|sit|amet|consectetur|adipiscing|elit|sed|eiusmod|tempor|incididunt|labore|dolore|magna|aliqua|enim|minim|veniam|nostrud|ullamco|laboris|aliquip|commodo|consequat|aute|irure|velit|esse|cillum|fugiat|nulla`),su=W(`The new layout is ready for review.|Customers reported that the page loads slowly on mobile.|Let’s align on the scope before we start.|This blocks the next release.|Add tests for the edge cases we found last week.|The copy should match the latest designs.|We agreed to ship the first version behind a feature flag.|Numbers look good after the last deploy.|Can someone double-check the translations?|The integration works in staging but not in production yet.|Follow-up from the planning meeting on Tuesday.|Most of the work is done; the docs still need an update.|Error rates dropped by half since the fix went out.|Please keep the old endpoint until every client has migrated.|The design team shared feedback in the review thread.|This needs a decision from product before we continue.|Performance is within budget on every page we measured.|I left a few comments on the pull request.|Support received three tickets about this today.|We can reuse the components from the settings page.|The import fails for files larger than 10 MB.|Accessibility checks pass in both themes.|Moving this to the next sprint to make room for the hotfix.|The data migration finished without errors.|Thanks for the quick turnaround on this!|We should measure the impact before rolling it out to everyone.|Looks great on desktop; tablet still needs some work.|Security review is scheduled for Thursday.|The onboarding flow now takes two steps instead of five.|Let’s pair on this tomorrow morning.`),cu=W(`Senior|Staff|Principal|Lead|Junior||||`),lu=W(`Frontend|Backend|Product|Platform|Data|Mobile|Security|Growth|Design|Infrastructure|QA|DevOps`),uu=W(`Engineer|Designer|Manager|Analyst|Scientist|Architect|Developer|Researcher|Writer`),du=W(`Engineering|Design|Marketing|Sales|Support|Finance|Operations|Legal|People|Product|Research|Security`),fu=W(`Labs|Systems|Group|Studio|Works|Technologies|& Co.|Industries|Partners|Ventures|Analytics|Cloud`),pu=W(`Blue|Bright|North|Swift|Silver|Green|Clear|Bold|Prime|Nova`),mu=W(`Harbor|Peak|Wave|Leaf|Stone|Field|Bridge|Forge|Pixel|Orbit`),hu=W(`Ergonomic|Wireless|Compact|Smart|Classic|Premium|Portable|Organic|Handmade|Recycled`),gu=W(`Steel|Wooden|Cotton|Leather|Bamboo|Ceramic|Glass|Wool`),_u=W(`Chair|Lamp|Backpack|Keyboard|Mug|Notebook|Headphones|Bottle|Desk|Jacket|Watch|Speaker`),vu=W(`Mobile|Billing|Data|Marketing|Analytics|Customer|Payments|Search|Onboarding|Platform|Identity|Checkout|Design system|Infrastructure|Support|Growth|Security|Reporting|Notifications|Admin`),yu=W(`app|revamp|migration|relaunch|portal|redesign|platform|pipeline|dashboard|API|integration|rollout|cleanup|audit|launch`),bu=W(`Design|Fix|Write|Add|Update|Refactor|Review|Migrate|Remove|Investigate|Document|Test|Improve|Optimize|Implement|Set up|Ship|Prototype`),xu=W(`the pricing page|the login redirect|release notes|rate limiting|the onboarding flow|the search index|billing webhooks|dark mode|CSV export|error messages|the mobile layout|the API docs|user settings|password reset|notification emails|the audit log|the caching layer|analytics events|the checkout form|image uploads`),Su=W(`A Guide to %|% in Practice|Why % Matters|The Future of %|Getting Started with %|%: Lessons Learned|Building Better %|Ten Tips for %`),Cu=W(`Remote Work|Open Source|Design Systems|Data Privacy|Cloud Costs|Team Rituals|Accessibility|Performance|Testing|Onboarding`),wu=W(`bug|feature|frontend|backend|design|docs|performance|security|ux|infra|mobile|api|testing|research|urgent|refactor|accessibility|analytics`),Tu=W(`Main|Oak|Maple|Cedar|Elm|Pine|Lake|Hill|Park|Sunset|River|Church|Market|Mill|Spring`),Eu=W(`Street|Avenue|Road|Lane|Drive|Way|Boulevard|Court`),Du=W(`San Francisco|New York|London|Berlin|Paris|Tokyo|Toronto|Sydney|Amsterdam|Barcelona|Lisbon|Dublin|Stockholm|Copenhagen|Zurich|Vienna|Prague|Warsaw|Seoul|Singapore|Bangalore|Lagos|Nairobi|Cape Town|São Paulo|Buenos Aires|Mexico City|Austin|Seattle|Chicago`),Ou=W(`California|New York|Texas|Washington|Illinois|Ontario|Bavaria|Catalonia|Victoria|Queensland|Lombardy|Île-de-France`),ku=ru(`United States:US|United Kingdom:GB|Germany:DE|France:FR|Japan:JP|Canada:CA|Australia:AU|Netherlands:NL|Spain:ES|Portugal:PT|Ireland:IE|Sweden:SE|Denmark:DK|Switzerland:CH|Austria:AT|Poland:PL|South Korea:KR|Singapore:SG|India:IN|Nigeria:NG|Kenya:KE|South Africa:ZA|Brazil:BR|Argentina:AR|Mexico:MX|Italy:IT|Norway:NO|Finland:FI|New Zealand:NZ`),Au=W(`America/New_York|America/Los_Angeles|America/Chicago|America/Sao_Paulo|Europe/London|Europe/Berlin|Europe/Paris|Europe/Madrid|Asia/Tokyo|Asia/Singapore|Asia/Kolkata|Australia/Sydney|Africa/Lagos|UTC`),ju=W(`en-US|en-GB|de-DE|fr-FR|es-ES|pt-BR|ja-JP|ko-KR|zh-CN|it-IT|nl-NL|sv-SE`),Mu=W(`en|de|fr|es|pt|ja|ko|zh|it|nl|sv|hi`),Nu=W(`USD|EUR|GBP|JPY|CAD|AUD|CHF|SEK|INR|BRL|MXN|SGD`),Pu=ru(`image/png:png|image/jpeg:jpg|application/pdf:pdf|text/plain:txt|text/csv:csv|application/json:json|image/svg+xml:svg|application/zip:zip|image/gif:gif|text/markdown:md`),Fu=W(`report|invoice|wireframe|screenshot|notes|budget|roadmap|contract|photo|logo|presentation|summary|draft|export|diagram|receipt`),Iu=W(`Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15|Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36|Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0|Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148`),Lu=W(`🚀|✨|🎉|👍|🔥|✅|💡|📦|🐛|🎨`),Ru=W(`#ef4444|#f97316|#f59e0b|#eab308|#84cc16|#22c55e|#10b981|#14b8a6|#06b6d4|#0ea5e9|#3b82f6|#6366f1|#8b5cf6|#a855f7|#d946ef|#ec4899|#f43f5e|#64748b`),zu=W(`source|plan|region|channel|team|priority|campaign|version|theme|segment|tier|origin`),Bu=W(`example.com|example.org|example.net`),Vu=W(`192.0.2|198.51.100|203.0.113`);function Hu(e){return e.normalize(`NFD`).replace(/[̀-ͯ]/g,``).toLowerCase().replace(/[^a-z0-9]+/g,``)}var Uu=(e,t=2)=>String(e).padStart(t,`0`);function Wu(e,t){let n=``;for(let r=0;r<t;r++)n+=e.int(0,15).toString(16);return n}function Gu(e,t){let n=``;for(let r=0;r<t;r++)n+=`abcdefghijklmnopqrstuvwxyz0123456789`.charAt(e.int(0,35));return n}function Ku(e,t){let n=``;for(let r=0;r<t;r++)n+=`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_`.charAt(e.int(0,63));return n}function qu(e){let t=Array.from({length:32},(t,n)=>n===12?`4`:n===16?(8+e.int(0,3)).toString(16):e.int(0,15).toString(16)).join(``);return`${t.slice(0,8)}-${t.slice(8,12)}-${t.slice(12,16)}-${t.slice(16,20)}-${t.slice(20)}`}function Ju(e,t){let n=[];for(let r=0;r<t;r++){let t=e.pick(su);n.includes(t)||n.push(t)}return n.join(` `)}function Yu(e){let t=0;for(let n=0;n<e.length;n++){let r=Number(e.charAt(e.length-1-n));n%2==0&&(r*=2,r>9&&(r-=9)),t+=r}return`${e}${(10-t%10)%10}`}function Xu(e){let t=`978${Array.from({length:9},()=>e.int(0,9)).join(``)}`,n=0;for(let e=0;e<12;e++)n+=Number(t.charAt(e))*(e%2==0?1:3);return`${t}${(10-n%10)%10}`}function Zu(e){let t=`${Array.from({length:4},()=>String.fromCharCode(e.int(65,90))).join(``)}${Array.from({length:14},()=>e.int(0,9)).join(``)}`,n=`${t}GB00`.replace(/[A-Z]/g,e=>String(e.charCodeAt(0)-55)),r=0;for(let e of n)r=(r*10+Number(e))%97;return`GB${Uu(98-r)}${t}`}function Qu(e){return[e.pick(iu),e.pick(au)]}function $u(e,t,n,r){let[i,a]=t;switch(e){case`firstName`:return i;case`lastName`:return a;case`fullName`:return`${i} ${a}`;case`username`:return`${Hu(i)}.${Hu(a)}${n.int(1,99)}`;case`email`:return`${Hu(i)}.${Hu(a)}@${ed(r,n)}`;default:return}}function ed(e,t){return/@([\w.-]+\.[a-z]{2,})$/i.exec(e)?.[1]??t.pick(Bu)}function td(e,t){return/^(https?:\/\/[^/?#]+)/i.exec(e)?.[1]??`https://${t.pick(Bu)}`}function nd(e,t,n){let[r,i,a]=[e.pick(Ru),e.pick(Ru),e.pick(Ru)];return`data:image/svg+xml,${`<svg xmlns='http://www.w3.org/2000/svg' width='${t}' height='${n}' viewBox='0 0 ${t} ${n}'><rect width='${t}' height='${n}' fill='${r}'/><circle cx='${e.int(0,t)}' cy='${e.int(0,n)}' r='${e.int(t/6,t/2)}' fill='${i}' fill-opacity='.7'/><rect x='${e.int(0,t/2)}' y='${e.int(0,n/2)}' width='${e.int(t/6,t/2)}' height='${e.int(n/6,n/2)}' fill='${a}' fill-opacity='.6'/></svg>`.replace(/[<>#'"]/g,e=>`%${e.charCodeAt(0).toString(16).toUpperCase()}`)}`}var rd={words:e=>`${e.pick(ou)} ${e.pick(ou)}`,word:e=>e.pick(ou),sentence:e=>e.pick(su),paragraph:e=>Ju(e,e.int(2,4)),like:(e,t)=>id(t,e),firstName:e=>e.pick(iu),lastName:e=>e.pick(au),fullName:e=>Qu(e).join(` `),username:e=>{let[t,n]=Qu(e);return`${Hu(t)}.${Hu(n)}${e.int(1,99)}`},email:(e,t)=>{let[n,r]=Qu(e);return`${Hu(n)}.${Hu(r)}@${ed(t,e)}`},phone:e=>e.chance(.5)?`+1 555-01${Uu(e.int(0,99))}`:`+44 20 7946 0${Uu(e.int(0,999),3)}`,jobTitle:e=>{if(e.chance(.1))return`Head of ${e.pick(du)}`;let t=e.pick(cu);return`${t===``?``:`${t} `}${e.pick(lu)} ${e.pick(uu)}`},company:e=>e.chance(.5)?`${e.pick(au)} ${e.pick(fu)}`:`${e.pick(pu)}${e.pick(mu)}`,department:e=>e.pick(du),product:e=>`${e.pick(hu)} ${e.pick(gu)} ${e.pick(_u)}`,project:e=>`${e.pick(vu)} ${e.pick(yu)}`,task:e=>`${e.pick(bu)} ${e.pick(xu)}`,headline:e=>e.pick(Su).replace(/%/g,e.pick(Cu)),tag:e=>e.pick(wu),slug:e=>`${e.pick(wu)}-${e.pick(ou)}-${e.int(1,99)}`,code:e=>Gu(e,6).toUpperCase(),street:e=>`${e.int(1,9999)} ${e.pick(Tu)} ${e.pick(Eu)}`,city:e=>e.pick(Du),state:e=>e.pick(Ou),country:e=>e.pick(ku)[0],countryCode:e=>e.pick(ku)[1],postalCode:e=>Uu(e.int(1e4,99999),5),address:e=>`${e.int(1,9999)} ${e.pick(Tu)} ${e.pick(Eu)}, ${e.pick(Du)}`,url:(e,t)=>`${td(t,e)}/${e.pick(wu)}/${e.int(1,999)}`,imageUrl:e=>nd(e,400,300),avatarUrl:e=>nd(e,128,128),domain:e=>`${e.pick(wu)}.${e.pick(Bu)}`,ipv4:e=>`${e.pick(Vu)}.${e.int(1,254)}`,ipv6:e=>`2001:db8::${e.int(1,65535).toString(16)}:${Wu(e,4)}`,mac:e=>`02:${Array.from({length:5},()=>Wu(e,2)).join(`:`)}`,userAgent:e=>e.pick(Iu),token:e=>Ku(e,40),jwt:e=>`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Ku(e,48)}.${Ku(e,43)}`,password:e=>`${Ku(e,6)}!${e.int(10,99)}${Ku(e,4)}`,hash:e=>Wu(e,64),uuid:qu,color:e=>e.pick(Ru),mimeType:e=>e.pick(Pu)[0],fileName:e=>`${e.pick(Fu)}-${e.int(1,99)}.${e.pick(Pu)[1]}`,fileExtension:e=>e.pick(Pu)[1],filePath:e=>`/files/${e.pick(wu)}/${e.pick(Fu)}.${e.pick(Pu)[1]}`,semver:e=>`${e.int(1,4)}.${e.int(0,12)}.${e.int(0,20)}`,emoji:e=>e.pick(Lu),currency:e=>e.pick(Nu),locale:e=>e.pick(ju),language:e=>e.pick(Mu),timezone:e=>e.pick(Au),sku:e=>`SKU-${e.int(1e4,99999)}`,isbn:Xu,iban:Zu,creditCard:e=>Yu(`4242${Array.from({length:11},()=>e.int(0,9)).join(``)}`),base64:e=>btoa(e.pick(su).replace(/[^\x20-\x7e]/g,`'`)),json:e=>JSON.stringify({id:e.int(1,999),name:e.pick(wu)}),duration:e=>e.chance(.5)?`PT${e.int(5,120)}M`:`P${e.int(1,30)}D`,regex:e=>`^${e.pick(wu)}-[0-9]+$`,pointer:e=>`/${e.pick(wu)}/${e.int(0,9)}`,relativePointer:e=>`${e.int(0,3)}/${e.pick(wu)}`,uriReference:e=>`/${e.pick(wu)}/${e.int(1,999)}`,uriTemplate:e=>`https://${e.pick(Bu)}/${e.pick(wu)}/{id}`,integer:e=>String(e.int(1,1e5)),decimal:e=>(e.int(100,99999)/100).toFixed(2)};function id(e,t){let n=()=>String.fromCharCode(t.int(65,90)),r=()=>String.fromCharCode(t.int(97,122));return e.replace(/[A-Za-z0-9]+/g,e=>{let i=/[A-Za-z]/.test(e),a=/\d/.test(e);if(i&&!a)return/^[A-Z]{2,6}$/.test(e)?e.replace(/./g,n):e;let o=i&&/^[0-9a-f]+$/.test(e),s=0;return e.replace(/./g,i=>{let a=s++===0&&e.length>1&&i!==`0`;return/\d/.test(i)?String(a?t.int(1,9):t.int(0,9)):o?t.int(0,15).toString(16):i===i.toUpperCase()?n():r()})})}function ad(e,t,n=0,r=1/0){let i=e;for(;i.length<n;)i+=i===``?t.pick(ou):` ${t.pick(ou)}`;return i.length>r&&(i=i.slice(0,r)),i.replace(/ $|[\uD800-\uDBFF]$/,`x`)}function od(e,t,n=``,r=0,i=1/0){return ad(rd[e](t,n),t,r,i)}var sd=404,cd=[400,401,403,404,409,422,429,500,503],ld={400:`Bad Request`,401:`Unauthorized`,402:`Payment Required`,403:`Forbidden`,404:`Not Found`,405:`Method Not Allowed`,406:`Not Acceptable`,407:`Proxy Authentication Required`,408:`Request Timeout`,409:`Conflict`,410:`Gone`,411:`Length Required`,412:`Precondition Failed`,413:`Content Too Large`,414:`URI Too Long`,415:`Unsupported Media Type`,416:`Range Not Satisfiable`,417:`Expectation Failed`,421:`Misdirected Request`,422:`Unprocessable Content`,423:`Locked`,424:`Failed Dependency`,425:`Too Early`,426:`Upgrade Required`,428:`Precondition Required`,429:`Too Many Requests`,431:`Request Header Fields Too Large`,451:`Unavailable For Legal Reasons`,500:`Internal Server Error`,501:`Not Implemented`,502:`Bad Gateway`,503:`Service Unavailable`,504:`Gateway Timeout`,505:`HTTP Version Not Supported`,507:`Insufficient Storage`,508:`Loop Detected`,511:`Network Authentication Required`},ud={400:W(`The request body is not valid JSON.|The cursor parameter is malformed.|The limit parameter must be between 1 and 100.`),401:W(`The access token is missing or has expired.|Sign in to continue.|The API key is not valid.`),403:W(`You do not have permission to perform this action.|Only workspace admins can change this setting.|Your plan does not include this feature.`),404:W(`The requested resource does not exist.|No resource matches this ID.|The resource may have been deleted or moved.`),405:W(`This endpoint does not support this method.`),408:W(`The request took too long to arrive. Try again.`),409:W(`The resource was changed by someone else. Reload it and try again.|A resource with this name already exists.`),410:W(`This resource was permanently deleted.`),412:W(`The resource changed since you last read it. Reload it and try again.`),413:W(`The request body is larger than 10 MB.`),415:W(`Send the request body as application/json.`),422:W(`Some fields are invalid. Check them and try again.|The request contains invalid values.|A required field is missing.`),423:W(`The resource is locked while another change is in progress.`),429:W(`Too many requests. Try again in 30 seconds.|You reached the limit of 100 requests per minute.`),500:W(`Something went wrong on our side. Try again later.|An unexpected error occurred. Our team has been notified.`),501:W(`This feature is not available yet.`),502:W(`An upstream service returned an invalid response.`),503:W(`The service is temporarily unavailable. Try again in a few minutes.|Scheduled maintenance is in progress. Try again later.`),504:W(`An upstream service did not respond in time.`)},dd=W(`The request could not be processed.|Check the request and try again.`),fd=W(`The server could not complete the request.|Something went wrong on our side. Try again later.`),pd=W(`email|title|name|password|dueDate|quantity|phone|startDate|amount|url`),md=W(`This field is required.|Must be at most 80 characters.|Must be a valid email address.|Must be a date in the future.|Must be greater than 0.|Must be at least 12 characters.|This value is already taken.|Must be a valid URL.`);function hd(e){return ld[e]??(e>=500?`Server Error`:`Client Error`)}function gd(e,t){let n=hd(e).toLowerCase().split(/[^a-z0-9]+/).filter(e=>e!==``);return/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(t)&&t.length>1?n.join(`_`).toUpperCase():/^[a-z0-9]+(-[a-z0-9]+)+$/.test(t)?n.join(`-`):/^([A-Z][a-z0-9]+){2,}$/.test(t)?n.map(e=>`${e.charAt(0).toUpperCase()}${e.slice(1)}`).join(``):n.join(`_`)}function _d(e,t,n,r=``){switch(e){case`title`:return hd(t);case`detail`:return n.pick(ud[t]??(t>=500?fd:dd));case`code`:return gd(t,r);case`type`:return r.startsWith(`about:`)?r:`${td(r,n)}/problems/${gd(t,`not-found`)}`;case`instance`:return`urn:uuid:${qu(n)}`;case`field`:return n.pick(pd);case`pointer`:return`/${n.pick(pd)}`;case`fieldMessage`:return n.pick(md)}}function vd(e){return e.slice(0,Math.max(0,e.lastIndexOf(`.`)))}var yd=Date.UTC(2026,0,1),bd=864e5;function xd(e,t,n,r){let i=()=>`${Uu(r.int(0,23))}:${Uu(r.int(0,59))}:${Uu(r.int(0,59))}`;if(t===`time`){let t=e===void 0?`Z`:/^\d{2}:\d{2}:\d{2}(.*)$/.exec(e)?.[1]??``;return`${i()}${t.replace(/^\.\d+/,``)}`}let a=e===void 0?NaN:Date.parse(t===`date`?`${e}T00:00:00Z`:e),o=Number.isNaN(a)?yd:a,s=n===`past`?-r.int(1,180):n===`future`?r.int(1,90):n===`soon`?r.int(-14,45):n===`birth`?-r.int(6570,27375):r.int(-365,365),c=new Date(Math.floor(o/bd)*bd+s*bd);if(t===`date`)return c.toISOString().slice(0,10);let l=`${c.toISOString().slice(0,10)}T${i()}`;return e!==void 0&&!/\.\d+/.test(e)?`${l}Z`:`${l}.000Z`}var Sd;function Cd(e){if(Sd===void 0){Sd=/* @__PURE__ */ new Uint32Array(256);for(let e=0;e<256;e++){let t=e;for(let e=0;e<8;e++)t=t&1?3988292384^t>>>1:t>>>1;Sd[e]=t>>>0}}let t=4294967295;for(let n of e)t=(Sd[(t^n)&255]??0)^t>>>8;return(t^4294967295)>>>0}function wd(e){let t=new Uint8Array(e.reduce((e,t)=>e+t.length,0)),n=0;for(let r of e)t.set(r,n),n+=r.length;return t}var Td=e=>new Uint8Array([e>>>24,e>>>16&255,e>>>8&255,e&255]),Ed=e=>Uint8Array.from(e,e=>e.charCodeAt(0)&255);function Dd(e){let t=e=>[1,3,5].map(t=>Number.parseInt(e.slice(t,t+2),16)),[n,r]=[t(e.pick(Ru)),t(e.pick(Ru))],i=e.int(16,48),a=e.int(16,48),o=e.int(10,28),s=/* @__PURE__ */ new Uint8Array(12352);for(let e=0;e<64;e++){s[e*193]=0;for(let t=0;t<64;t++){let c=(t-i)**2+(e-a)**2<=o**2?r:n;s.set(c,e*193+1+t*3)}}let c=[new Uint8Array([120,1])];for(let e=0;e<s.length;e+=65535){let t=s.subarray(e,e+65535),n=+(e+65535>=s.length);c.push(new Uint8Array([n,t.length&255,t.length>>>8,~t.length&255,~t.length>>>8&255]),t)}let l=1,u=0;for(let e of s)l=(l+e)%65521,u=(u+l)%65521;c.push(Td((u<<16|l)>>>0));let d=(e,t)=>{let n=wd([Ed(e),t]);return wd([Td(t.length),n,Td(Cd(n))])};return wd([new Uint8Array([137,80,78,71,13,10,26,10]),d(`IHDR`,wd([Td(64),Td(64),new Uint8Array([8,2,0,0,0])])),d(`IDAT`,wd(c)),d(`IEND`,/* @__PURE__ */ new Uint8Array)])}function Od(e){let t=`BT /F1 18 Tf 72 720 Td (${e.pick(su).replace(/[^\x20-\x7e]/g,`'`).replace(/[()\\]/g,``)}) Tj ET`,n=[`<< /Type /Catalog /Pages 2 0 R >>`,`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,`<< /Length ${t.length} >>
stream
${t}
endstream`,`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`],r=`%PDF-1.4
`,i=[];n.forEach((e,t)=>{i.push(r.length),r+=`${t+1} 0 obj
${e}
endobj
`});let a=r.length;return r+=`xref
0 ${n.length+1}
0000000000 65535 f 
${i.map(e=>`${Uu(e,10)} 00000 n 
`).join(``)}`,r+=`trailer
<< /Size ${n.length+1} /Root 1 0 R >>
startxref
${a}
%%EOF
`,Ed(r)}function kd(e){let t=e.pick([262,330,392,440,523]),n=(e,t)=>Array.from({length:t},(t,n)=>e>>>n*8&255),r=[...Ed(`RIFF`),...n(2036,4),...Ed(`WAVEfmt `),...n(16,4),...n(1,2),...n(1,2),...n(8e3,4),...n(8e3,4),...n(1,2),...n(8,2),...Ed(`data`),...n(2e3,4)],i=Array.from({length:2e3},(e,n)=>Math.round(128+24*Math.sin(2*Math.PI*t*n/8e3)));return new Uint8Array([...r,...i])}var Ad=e=>Uint8Array.from(atob(e),e=>e.charCodeAt(0)),jd=`R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==`,Md=`/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=`,Nd=`UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==`;function Pd(e){return/image|photo|picture|avatar|logo|icon|thumbnail|banner|cover|screenshot/i.test(e)?`image/png`:/pdf|invoice|receipt|document|contract|report/i.test(e)?`application/pdf`:/csv|export|spreadsheet/i.test(e)?`text/csv`:/audio|sound|voice|recording/i.test(e)?`audio/wav`:/text|note|log/i.test(e)?`text/plain`:`application/octet-stream`}function Fd(e,t,n=``){let r=e.split(`;`)[0]?.trim().toLowerCase()??``;if(r===``||r.includes(`*`)||r===`application/octet-stream`){let e=Pd(n);(r===``||r.includes(`*`)||e!==`application/octet-stream`)&&(r=e)}let i=e=>new Blob([e],{type:r});switch(r){case`image/png`:return i(Dd(t));case`image/gif`:return i(Ad(jd));case`image/jpeg`:case`image/jpg`:return i(Ad(Md));case`image/webp`:return i(Ad(Nd));case`image/svg+xml`:return i(decodeURIComponent(nd(t,400,300).slice(19)));case`application/pdf`:return i(Od(t));case`audio/wav`:case`audio/x-wav`:case`audio/wave`:return i(kd(t));case`application/zip`:return i(new Uint8Array([80,75,5,6,...Array.from({length:18},()=>0)]));case`text/csv`:return i(`id,name,email
${Array.from({length:3},(e,n)=>{let[r,i]=Qu(t);return`${n+1},${r} ${i},${Hu(r)}.${Hu(i)}@example.com`}).join(`
`)}
`);case`application/json`:return i(JSON.stringify({id:t.int(1,999),name:t.pick(wu)}));case`text/html`:return i(`<!doctype html><title>${t.pick(wu)}</title><p>${t.pick(su)}</p>`);case`application/xml`:case`text/xml`:return i(`<?xml version="1.0" encoding="UTF-8"?><note><text>${t.pick(su)}</text></note>`);default:return r.startsWith(`text/`)?i(Ju(t,3)):i(Uint8Array.from({length:256},()=>t.int(0,255)))}}function Id(e){let t=zu[e%zu.length]??`key`;return e<zu.length?t:`${t}${Math.floor(e/zu.length)+1}`}var Ld=/* @__PURE__ */ new Map,Rd=5e4,zd=class e{#e;#t;#n;#r;#i;constructor(e={},t=``,n=!0){this.#e=Number.isFinite(e.seed)?Math.trunc(e.seed??0)>>>0:0,this.#t=t,this.#n=e.empty===!0;let r=e.status;this.#r=r!==void 0&&Number.isInteger(r)&&r>=400&&r<=599?r:void 0,this.#i=n}get canonical(){return this.#e===0}#a(e){return new Dl(El(this.#e,`${this.#t}${e}`))}#o(e){return{seed:e,...this.#n?{empty:!0}:{},...this.#r===void 0?{}:{status:this.#r}}}#s(e){return Qu(this.#a(`${vd(e)}#person`))}#c(e){return this.#r??this.#a(`${vd(e)}#status`).pick(cd)}at(e=``){return this.#o(this.canonical?0:El(this.#e,`${this.#t}${e}/`))}example(e,t){let n=t!==void 0&&this.#r!==void 0&&t!==this.#r;return e(this.canonical&&!this.#n&&!n)}text(e,t,n,r=0,i=1/0){if(this.canonical)return t;let a=this.#a(e),o=$u(n,this.#s(e),a,t);if(o!==void 0)return ad(o,a,r,i);let s=(n===`sentence`||n===`paragraph`||n===`task`||n===`headline`)&&t.includes(` `)&&a.chance(1/3)?id(t,a):t;return ad(s===t?rd[n](a,t):s,a,r,i)}errorStatus(e,t){return this.#r===void 0?this.canonical?t:this.#c(e):this.#r}errorText(e,t,n,r=sd,i=0,a=1/0){let o=n===`title`||n===`detail`||n===`code`||n===`type`,s=this.#r!==void 0&&this.#r!==r;if(this.canonical&&!(o&&s))return t;let c=this.#a(e);return ad(_d(n,this.#c(e),c,t),c,i,a)}pattern(e,t,n,r=0,i=1/0,a){if(this.canonical)return t;let o=this.#a(e);if(a!==void 0)for(let e=0;e<3;e++){let e=od(a,o,t,r,i);if(nu(n,e)===!0)return e}return tu(n,o,r,i)??t}int(e,t,n,r){return this.canonical?t:this.#a(e).int(n,r)}number(e,t,n,r,i=2,a=`none`){if(this.canonical)return t;let o=Number((n+this.#a(e).next()*(r-n)).toFixed(i));return(a===`min`||a===`both`?o>n:o>=n)&&(a===`max`||a===`both`?o<r:o<=r)?o:t}multiple(e,t,n,r,i,a){return this.canonical?t:Number((this.#a(e).int(n,r)*i).toFixed(a))}bool(e,t,n=.5){return this.canonical?t:this.#a(e).chance(n)}date(e,t,n,r){return this.canonical?t:xd(t,n,r,this.#a(e))}pick(e,t){return this.canonical?t[0]:this.#a(e).pick(t)}oneOf(e,t,n){return n(this.canonical?0:this.#a(`${e}#`).int(0,t-1))}nullable(e,t,n=.2){return!this.canonical&&this.#a(`${e}?`).chance(n)?null:t()}array(t,n,r,i,a,o=!1,s=r){let c=this.#n?r:this.canonical?n:this.#a(`${t}[]`).int(s,i),l=[],u=/* @__PURE__ */ new Set;for(let n=0;l.length<c&&n<c*3;n++){let r=this.canonical&&n===0?0:El(this.#e,`${this.#t}${t}[${n}]`),i=a(new e(this.#o(r),``,!1),n);if(o){let e=JSON.stringify(i);if(u.has(e))continue;u.add(e)}l.push(i)}return l}record(t,n,r,i,a){let o=this.#a(`${t}{}`),s=this.#n?r:this.canonical?n:o.int(r,i),c={};for(let n=0;n<s;n++){let r=Id(n),i=this.canonical&&n===0?0:El(this.#e,`${this.#t}${t}{${r}}`);c[r]=a(new e(this.#o(i),``,!1),r)}return c}optional(e,t,n,r){if(this.canonical)return t;let i=t;for(let t of n)r!==void 0&&Object.prototype.hasOwnProperty.call(r,t)||this.#a(`${e}${e===``?``:`.`}${t}~`).chance(.25)&&delete i[t];return t}file(e,t){return Fd(t,this.#a(e),e)}id(e){return this.#i&&(typeof e==`string`||typeof e==`number`)&&(Ld.size>=Rd&&Ld.clear(),Ld.set(String(e),this.#e)),e}};function Bd(e){let t=e.split(`;`)[0]?.trim().toLowerCase()??``;return t===`application/xml`||t===`text/xml`||t.endsWith(`+xml`)}function Vd(e,t,n){let r=e.kind===`ref`?n.get(e.target):void 0,i=Hd(e,t,0);return i.name===void 0&&r!==void 0?{...i,name:r}:i}function Hd(e,t,n){let r=Wd(e);if(n>8)return r;switch(e.kind){case`ref`:{let i=t.get(e.target)?.schema;return i===void 0?r:{...Hd(i,t,n+1),...r}}case`array`:{let i=Hd(e.items,t,n+1);return Object.keys(i).length===0?r:{...r,items:i}}case`object`:case`intersection`:case`union`:{let i={};for(let[r,a]of Ud(e,t,n)){let e=Hd(a,t,n+1);Object.keys(e).length>0&&(i[r]=e)}return Object.keys(i).length===0?r:{...r,properties:i}}default:return r}}function Ud(e,t,n){let r=/* @__PURE__ */ new Map,i=(e,n)=>{if(!(n>8)){if(e.kind===`object`)for(let t of e.properties)r.has(t.name)||r.set(t.name,t.schema);else if(e.kind===`intersection`)for(let t of e.members)i(t,n+1);else if(e.kind===`union`)for(let t of e.variants)i(t,n+1);else if(e.kind===`ref`){let r=t.get(e.target)?.schema;r!==void 0&&i(r,n+1)}}};return i(e,n),r}function Wd(e){let t=e.xml;if(t===void 0)return{};let n=t.nodeType===`text`||t.nodeType===`cdata`||t.nodeType===`none`?t.nodeType:void 0;return{...t.name===void 0?{}:{name:t.name},...t.namespace===void 0?{}:{namespace:t.namespace},...t.prefix===void 0?{}:{prefix:t.prefix},...t.attribute===!0||t.nodeType===`attribute`?{attribute:!0}:{},...t.wrapped===!0?{wrapped:!0}:{},...n===void 0?{}:{content:n}}}function Gd(e){return e.replace(/([a-z0-9])([A-Z])/g,`$1 $2`).replace(/([A-Z]+)([A-Z][a-z])/g,`$1 $2`).toLowerCase().split(/[^a-z0-9]+/).filter(e=>e!==``)}function Kd(e){return e.endsWith(`ies`)?`${e.slice(0,-3)}y`:/(ss|us|is)$/.test(e)?e:/(x|ch|sh|ses)es$/.test(e)?e.slice(0,-2):e.endsWith(`s`)?e.slice(0,-1):e}var qd=/user|person|people|member|author|owner|customer|client|contact|employee|staff|account|profile|assignee|reporter|actor|agent|admin|player|student|teacher|patient|driver|guest|participant|attendee|recipient|sender|creator|editor|reviewer|subscriber|buyer|seller|candidate|applicant|speaker|host|manager|lead|uploader|commenter|follower|friend/i,Jd=/company|organi[sz]ation|^org$|business|vendor|supplier|merchant|brand|employer|tenant|workspace|partner/i,Yd=/product|item|good|offer|plan|service|sku|variant|book|course/i,Xd=/project|repo|repository|app|application|board|campaign|initiative|program/i,Zd=/tag|label|category|topic|genre|keyword|group|role|skill|badge/i,Qd=/file|attachment|document|asset|upload|media|image|photo|picture|video|audio/i,$d=/task|issue|ticket|todo|story|bug|card|job|step|milestone|goal|todo|incident/i,ef=/city|place|location|venue|store|shop|restaurant|hotel|office|branch|warehouse|site/i,tf=/pet|animal|dog|cat|horse|bird/i,nf=/team|department|division|unit|squad/i,rf={email:`email`,"idn-email":`email`,hostname:`domain`,"idn-hostname":`domain`,ipv4:`ipv4`,ipv6:`ipv6`,uri:`url`,url:`url`,iri:`url`,"uri-reference":`uriReference`,"iri-reference":`uriReference`,"uri-template":`uriTemplate`,uuid:`uuid`,guid:`uuid`,byte:`base64`,base64:`base64`,base64url:`token`,password:`password`,"json-pointer":`pointer`,"relative-json-pointer":`relativePointer`,regex:`regex`,int8:`integer`,int16:`integer`,int32:`integer`,int64:`integer`,uint8:`integer`,uint16:`integer`,uint32:`integer`,uint64:`integer`,integer:`integer`,number:`decimal`,decimal:`decimal`,double:`decimal`,float:`decimal`,duration:`duration`,phone:`phone`,tel:`phone`,color:`color`,"hex-color":`color`,mac:`mac`,semver:`semver`,"iso-country":`countryCode`,"country-code":`countryCode`,currency:`currency`,"iso-currency":`currency`,language:`language`,bcp47:`locale`,locale:`locale`,timezone:`timezone`,"mime-type":`mimeType`,"media-type":`mimeType`,isbn:`isbn`,iban:`iban`,"credit-card":`creditCard`,jwt:`jwt`,ulid:`code`,cuid:`token`,nanoid:`token`},af=[`avatar`,`photo`,`picture`,`image`,`img`,`thumbnail`,`logo`,`icon`,`banner`,`cover`];function of(e,t,n,r){let i=Gd(e??``),a=(...e)=>e.some(e=>i.includes(e)),o=n===void 0?void 0:rf[n.toLowerCase()];if(o===`url`&&a(...af))return a(`avatar`,`logo`,`icon`)?`avatarUrl`:`imageUrl`;if(o!==void 0)return o;let s=cf(i,t);return r!==void 0&&s!==void 0&&sf.has(s)?void 0:s}var sf=/* @__PURE__ */ new Set([`uuid`,`code`,`token`,`hash`,`slug`,`sku`]);function cf(e,t){let n=e.at(-1)??``,r=e.join(``),i=(...t)=>t.some(t=>e.includes(t));if(r!==``){if(n===`email`||n===`mail`||r.endsWith(`email`))return`email`;if([`phone`,`mobile`,`tel`,`telephone`,`fax`,`cell`,`phonenumber`].includes(n)||r.endsWith(`phonenumber`))return`phone`;if([`url`,`uri`,`href`,`link`,`website`,`homepage`,`site`].includes(n)||i(...af)&&[`src`,`source`].includes(n))return i(...af)?i(`avatar`,`logo`,`icon`)?`avatarUrl`:`imageUrl`:`url`;if([`avatar`,`photo`,`picture`,`image`,`thumbnail`,`logo`].includes(r))return r===`avatar`||r===`logo`?`avatarUrl`:`imageUrl`;if([`firstname`,`givenname`,`forename`,`middlename`].includes(r))return`firstName`;if([`lastname`,`surname`,`familyname`].includes(r))return`lastName`;if([`fullname`,`displayname`,`realname`,`contactname`,`authorname`].includes(r))return`fullName`;if([`username`,`login`,`handle`,`nickname`,`screenname`,`userhandle`].includes(r))return`username`;if(n===`name`){let n=e.length>1?e.slice(0,-1).join(``):t??``;return/^(company|organi[sz]ation|business|vendor|brand)/.test(n)?`company`:Qd.test(n)?`fileName`:qd.test(n)?`fullName`:tf.test(n)?`firstName`:Jd.test(n)?`company`:nf.test(n)?`department`:Zd.test(n)?`tag`:Yd.test(n)?`product`:ef.test(n)?`city`:(Xd.test(n),`project`)}if(n===`title`||r===`heading`||r===`headline`||r===`subject`)return qd.test(t??``)||i(`job`)?`jobTitle`:$d.test(t??``)?`task`:`headline`;if([`description`,`body`,`content`,`details`,`bio`,`about`,`overview`,`biography`].includes(n))return`paragraph`;if([`summary`,`note`,`notes`,`comment`,`message`,`caption`,`excerpt`,`reason`,`remark`,`remarks`,`feedback`,`text`,`tagline`,`instructions`,`answer`,`question`,`review`,`quote`,`motto`].includes(n))return`sentence`;if([`street`,`address1`,`addressline1`,`line1`,`streetaddress`,`address2`,`addressline2`,`line2`].includes(r))return`street`;if([`city`,`town`,`locality`,`municipality`].includes(n))return`city`;if([`state`,`province`,`region`,`county`,`prefecture`].includes(n))return`state`;if(r===`country`||r===`countryname`||r===`nationality`)return`country`;if([`countrycode`,`countryiso`,`iso2`,`alpha2`].includes(r))return`countryCode`;if([`zip`,`zipcode`,`postalcode`,`postcode`,`postal`].includes(r))return`postalCode`;if(n===`address`&&!i(`email`,`ip`,`mac`,`wallet`))return`address`;if([`company`,`companyname`,`organization`,`organisation`,`org`,`employer`,`business`,`vendor`,`brand`,`publisher`,`manufacturer`].includes(r))return`company`;if([`department`,`division`,`team`].includes(n))return`department`;if([`jobtitle`,`occupation`,`profession`,`position`,`role`].includes(r))return`jobTitle`;if([`color`,`colour`,`hex`,`background`,`foreground`,`tint`].includes(n))return`color`;if(n===`currency`||r===`currencycode`)return`currency`;if(n===`locale`)return`locale`;if([`language`,`lang`,`languagecode`].includes(r))return`language`;if([`timezone`,`tz`,`timezonename`].includes(r))return`timezone`;if([`ip`,`ipaddress`,`ipv4`,`clientip`,`remoteip`,`remoteaddr`].includes(r))return`ipv4`;if(r===`ipv6`)return`ipv6`;if(r===`mac`||r===`macaddress`)return`mac`;if(r===`useragent`)return`userAgent`;if([`domain`,`hostname`,`host`,`domainname`].includes(r))return`domain`;if(i(`jwt`)||r===`accesstoken`||r===`idtoken`)return`jwt`;if([`token`,`apikey`,`secret`,`clientsecret`,`nonce`,`csrf`,`signature`,`key`].includes(n)&&r!==`key`)return`token`;if([`password`,`passwd`,`pwd`,`passphrase`].includes(n))return`password`;if([`hash`,`checksum`,`sha`,`sha1`,`sha256`,`md5`,`etag`,`digest`,`fingerprint`].includes(n))return`hash`;if(r===`uuid`||r===`guid`||n===`uuid`||n===`guid`)return`uuid`;if(r===`slug`||r===`permalink`)return`slug`;if(n===`cursor`)return`token`;if(r===`sku`)return`sku`;if(r===`isbn`)return`isbn`;if(r===`iban`)return`iban`;if([`creditcard`,`cardnumber`,`ccnumber`,`pan`].includes(r))return`creditCard`;if([`version`,`semver`,`appversion`,`release`].includes(r))return`semver`;if(r===`emoji`||r===`reaction`)return`emoji`;if([`mimetype`,`contenttype`,`mediatype`,`filetype`,`mime`].includes(r))return`mimeType`;if([`filename`,`file`,`attachmentname`,`originalname`,`basename`].includes(r))return`fileName`;if([`extension`,`ext`,`fileextension`].includes(r))return`fileExtension`;if([`path`,`filepath`,`directory`,`folder`].includes(r))return`filePath`;if([`tag`,`label`,`keyword`,`category`,`topic`,`genre`,`hashtag`].includes(r))return`tag`;if([`code`,`key`,`reference`,`ref`,`shortcode`,`coupon`,`promocode`].includes(r))return`code`;if(n===`id`||r===`id`||n===`ids`&&e.length>1)return`uuid`}}var lf=/* @__PURE__ */ new Set([`problem`,`error`,`errors`,`fault`,`exception`,`failure`,`violation`,`violations`]);function uf(e,t){if(Gd(e??``).some(e=>lf.has(e)))return!0;let n=new Set(t);return n.has(`title`)&&n.has(`status`)&&(n.has(`detail`)||n.has(`type`)||n.has(`instance`))}var df=/* @__PURE__ */ new Set([`field`,`fieldname`,`param`,`parameter`,`property`,`attribute`]),ff=/* @__PURE__ */ new Set([`path`,`pointer`,`jsonpointer`,`loc`,`location`]);function pf(e){return e.some(e=>{let t=Gd(e).join(``);return df.has(t)||ff.has(t)})}function mf(e,t,n,r){let i=Gd(e??``).join(``),a=[`detail`,`details`,`message`,`msg`,`description`,`errordescription`,`errormessage`,`errordetail`,`errordetails`];if(n){if(df.has(i))return`field`;if(ff.has(i))return`pointer`;if([...a,`error`,`reason`].includes(i))return`fieldMessage`}if([`title`,`error`,`errortitle`,`statustext`,`reasonphrase`,`reason`].includes(i))return`title`;if(a.includes(i))return`detail`;if(i===`type`||i===`errortype`)return t!==void 0&&/^(uri|url|iri)/i.test(t)||/^(https?:|about:|urn:)/i.test(r??``)?`type`:`code`;if([`code`,`errorcode`,`kind`,`errorkey`].includes(i))return`code`;if(i===`instance`)return`instance`}function hf(e){return[`status`,`statuscode`,`httpstatus`,`httpstatuscode`,`httpcode`,`code`].includes(Gd(e??``).join(``))}function gf(e,t){let n=Gd(e??``),r=n.at(-1)??``,i=n.join(``);if(i===``)return;let a=(...e)=>e.some(e=>n.includes(e));if(r===`id`||i===`id`)return{min:1,max:1e5};if(i===`age`)return{min:18,max:80};if(r===`year`)return{min:1990,max:2030};if(r===`month`)return{min:1,max:12};if(r===`day`)return{min:1,max:28};if(r===`hour`)return{min:0,max:23};if(r===`minute`||r===`second`)return{min:0,max:59};if([`lat`,`latitude`].includes(r))return{min:-90,max:90,digits:6};if([`lng`,`lon`,`long`,`longitude`].includes(r))return{min:-180,max:180,digits:6};if(a(`price`,`amount`,`cost`,`subtotal`,`fee`,`balance`,`salary`,`revenue`,`budget`,`payment`,`charge`,`tax`,`income`,`spend`,`value`)||i===`total`&&!t)return t?{min:100,max:99999}:{min:1,max:999,digits:2};if([`rating`,`stars`].includes(r))return t?{min:1,max:5}:{min:1,max:5,digits:1};if(r===`score`||[`percent`,`percentage`,`progress`].includes(r))return{min:0,max:100};if(!t&&[`ratio`,`rate`,`probability`,`share`,`fraction`,`confidence`].includes(r))return{min:0,max:1,digits:2};if(r===`port`)return{min:1024,max:65535};if([`bytes`,`filesize`,`size`].includes(i)||a(`bytes`))return{min:1e3,max:5e6};if([`width`,`height`].includes(r))return{min:100,max:2e3};if([`ms`,`millis`,`milliseconds`,`latency`].includes(r))return{min:100,max:6e4};if([`duration`,`timeout`,`ttl`,`delay`,`interval`,`seconds`,`in`].includes(r)||i.startsWith(`expires`))return{min:60,max:86400};if([`likes`,`views`,`followers`,`downloads`,`stars`,`visits`,`impressions`,`clicks`].includes(r))return{min:0,max:5e3};if(r===`count`||[`quantity`,`qty`,`num`,`number`,`stock`,`inventory`,`votes`,`attempts`,`retries`,`items`,`total`].includes(r))return{min:0,max:50};if([`position`,`order`,`index`,`rank`,`sort`,`sequence`,`ordinal`].includes(r))return{min:0,max:100};if(r===`page`)return{min:1,max:10};if([`limit`,`pagesize`,`perpage`,`take`].includes(i))return{min:10,max:50};if([`offset`,`skip`].includes(i))return{min:0,max:100};if(r===`version`||r===`revision`)return{min:1,max:10};if(r===`priority`||r===`level`)return{min:1,max:5};if(r===`weight`)return t?{min:1,max:100}:{min:1,max:100,digits:1};if(r===`temperature`)return{min:-10,max:40,digits:1}}function _f(e){let t=Gd(e??``),n=(...e)=>e.some(e=>t.includes(e));return n(`archived`,`deleted`,`disabled`,`banned`,`blocked`,`locked`,`hidden`,`spam`,`flagged`,`failed`,`expired`,`suspended`,`draft`,`deprecated`,`muted`,`error`,`test`,`internal`)?.15:n(`enabled`,`active`,`verified`,`visible`,`available`,`published`,`confirmed`,`approved`,`valid`,`success`,`online`,`public`,`paid`,`complete`,`completed`,`ok`)?.85:.5}function vf(e){let t=Gd(e??``),n=(...e)=>e.some(e=>t.includes(e));return n(`birth`,`dob`,`born`,`birthday`)?`birth`:n(`due`,`deadline`,`start`,`starts`,`begins`,`scheduled`,`eta`)?`soon`:n(`expires`,`expiry`,`expiration`,`ends`,`end`,`until`,`renew`,`renews`,`next`,`valid`)?`future`:n(`created`,`updated`,`modified`,`deleted`,`published`,`posted`,`sent`,`received`,`joined`,`registered`,`signed`,`last`,`completed`,`finished`,`closed`,`resolved`,`archived`,`uploaded`,`edited`,`seen`,`visited`,`logged`,`login`,`accessed`,`occurred`,`happened`,`timestamp`,`issued`,`paid`,`shipped`,`delivered`,`verified`,`cancelled`,`canceled`)?`past`:`any`}function yf(e){return/^(items|data|results|records|entries|rows|nodes|edges|content|list|elements|hits|objects|values|docs|documents)$/i.test(e??``)}function bf(e){return/^(next|prev|previous|cursor|nextcursor|prevcursor|total|totalcount|count|page|pages|pagesize|limit|offset|hasmore|hasnext|nextpage|nexttoken|nextpagetoken|totalpages|totalitems|links)$/i.test(e.replace(/[_-]/g,``))}var xf=Symbol(`blob`),Sf=Symbol(`any`),Cf=64,wf=100,Tf=8,Ef=[...Array.from({length:8},(e,t)=>({seed:t+1})),{seed:0,empty:!0},{seed:5,empty:!0}],Df=new zd,G=e=>({kind:`json`,value:e}),Of=e=>e===null||typeof e==`object`?G(e):{kind:`json`,value:e,literal:!0};function kf(e){let{assertions:t,examples:n,default:r,...i}=e;return i}function Af(e){return[e.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g,`_`).length,e.length]}function jf(e){let t=String(e),n=/e-(\d+)$/.exec(t);return n===null?t.includes(`.`)?t.split(`.`)[1]?.length??0:0:Number(n[1])}function Mf(e,t){return Number(e.toFixed(Math.min(t,20)))}var Nf=/^\d{4}-\d{2}-\d{2}$/,Pf=/^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/,Ff=/* @__PURE__ */ new Set([`id`,`_id`,`uuid`]),If=class{#e;#t;#n=/* @__PURE__ */ new Map;#r=/* @__PURE__ */ new Set;#i=/* @__PURE__ */ new WeakSet;constructor(e){this.#e=e,this.#t=new Map(e.project.ir.schemas.map(e=>[e.id,e]))}fixture(e){let t=this.#n.get(e.id);if(t!==void 0)return t;this.#r.add(e.id);let n={label:e.name,root:e.id,source:e.definition.source,cycle:this.#e.project.graph.cycleOf(e.id),flags:{risky:!1},inline:{depth:0}},r=this.#l(e.definition.schema,e.id,n,{key:``,owner:e.name,root:!0});r===void 0&&(this.#L(n,`mock/unsatisfiable`,`\`${e.name}\` has no finite value: it requires itself, so its fixture cannot be generated.`),r={kind:`never`});for(let{property:t,values:n}of Fo(e,this.#e)){let e=n[0];e!==void 0&&(r=Uf(r,t,Of(e)))}return r=this.#s(r,e.definition.schema,n),this.#r.delete(e.id),this.#n.set(e.id,r),r}takesOverrides(e){return this.overridable(e.definition.schema)&&zf(this.fixture(e))}responseBody(e,t,n,r){let i={label:n,root:n,source:r,cycle:/* @__PURE__ */ new Set,flags:{risky:!1},inline:{depth:0}},a=Dl.of(n);if(t===`binary`)return{kind:`file`,key:``,mediaType:e.mediaType};let o=e.examples.find(e=>e.value!==void 0)?.value;if(t===`text`){if(typeof o==`string`)return G(o);if(e.itemSchema!==void 0){let t={kind:`array`,items:e.itemSchema},r=this.#l(t,n,i,{key:``,collection:!0});if(r!==void 0)return{kind:`encoded`,encoding:`sequence`,mediaType:e.mediaType,value:this.#s(r,t,i)}}let t=e.schema;if(t.kind===`string`||t.kind===`enum`&&t.values.every(e=>typeof e==`string`))return this.#l(t,n,i,{key:``})??G(``);if(Bd(e.mediaType)){let r=this.#l(t,n,i,{key:``,collection:!0});if(r!==void 0)return{kind:`encoded`,encoding:`xml`,mediaType:e.mediaType,value:this.#s(r,t,i),shape:this.xmlShape(t)}}return G(od(`paragraph`,a))}let s={key:``,collection:!0};if(o!==void 0){if(this.#E(o,e.schema)){let t=this.#O(o,e.schema),r=this.#l(e.schema,n,i,s);return r===void 0?t:this.#s({kind:`example`,value:t,make:r},e.schema,i)}this.#F(i,n,`example`)}let c=this.#l(e.schema,n,i,s)??{kind:`never`};return this.#s(c,e.schema,i)}value(e,t,n,r){let i={label:t,root:t,source:n,cycle:/* @__PURE__ */ new Set,flags:{risky:!1},inline:{depth:0}},a=this.#l(e,t,i,{key:``,owner:r})??{kind:`never`};return this.#s(a,e,i)}headerValue(e,t,n,r){let i={label:t,root:t,source:n,cycle:/* @__PURE__ */ new Set,flags:{risky:!1},inline:{depth:0}},a=this.#l(e,t,i,{key:``,name:r}),o=a===void 0?void 0:this.#M(a,Df,!0);if(typeof o==`string`||typeof o==`number`||typeof o==`boolean`)return String(o);if(Array.isArray(o)&&o.every(e=>typeof e!=`object`||!e))return o.map(String).join(`,`)}#a;#o(){return this.#a??=new Map(this.#e.project.models.map(e=>[e.id,e.name])),this.#a}xmlShape(e){return Vd(e,this.#t,this.#o())}objectProperties(e){return this.#j(e,0).properties}arrayItemsOf(e,t=0){if(t>Cf)return;if(e.kind===`array`)return e.prefixItems===void 0?e.items:void 0;if(e.kind!==`ref`)return;let n=this.#t.get(e.target)?.schema;return n===void 0?void 0:this.arrayItemsOf(n,t+1)}scalarType(e,t=0){if(t>Cf)return;if(e.kind===`string`)return Fa(e)===void 0?`string`:void 0;if(e.kind===`number`||e.kind===`integer`)return`number`;if(e.kind!==`ref`)return;let n=this.#t.get(e.target)?.schema;return n===void 0?void 0:this.scalarType(n,t+1)}#s(e,t,n){this.#P(e,t,n);let r=n.flags.risky||this.#i.has(e);if(!r&&(!Bf(e)||this.#c(e,t)))return e;let i=this.#N(e,Df);return r&&this.#i.add(i),i}#c(e,t){return Ef.every(n=>{let r=this.#M(e,new zd(n),!1);return r===void 0||this.#E(r,t)})}#l(e,t,n,r){let i,a=e.examples?.[0];a!==void 0&&(this.#E(a,e)?i=a:this.#F(n,t,`example`));let o=e.kind===`string`||e.kind===`number`||e.kind===`integer`||e.kind===`boolean`||e.kind===`enum`;if(i===void 0&&o&&e.default!==void 0&&(this.#E(e.default,e)?i=e.default:this.#F(n,t,`default value`)),i!==void 0&&(!o||i===null)){let a=this.#O(i,e),o=this.#u(e,t,n,r);if(o!==void 0&&e.assertions!==void 0&&(o=this.#w(e,o,t,n,r)),o===void 0||!Bf(o))return a;let s=this.#g(e,r,i);return{kind:`example`,value:a,make:o,...s===void 0?{}:{status:s}}}let s=this.#u(e,t,n,r,i);if(s===void 0)return;let c=e.assertions===void 0?s:this.#w(e,s,t,n,r);return e.nullable===!0&&e.kind!==`union`&&e.kind!==`null`&&(c.kind!==`json`||c.value!==null)?{kind:`nullable`,key:r.key,value:c}:c}#u(e,t,n,r,i){switch(e.kind){case`ref`:{if(n.cycle.has(e.target))return e.nullable===!0?G(null):void 0;let t=this.#e.project.modelById.get(e.target);return t?.fixtureName===void 0?G(null):{kind:`fixture`,model:t.id,key:r.key}}case`string`:return this.#d(e,t,n,r,i);case`number`:case`integer`:return this.#f(e,t,n,r,i);case`boolean`:{let e=_f(r.name),n=typeof i==`boolean`?i:e===.5?Dl.of(t).next()<.5:e>.5;return{kind:`bool`,key:r.key,value:n,rate:e}}case`null`:return G(null);case`enum`:return this.#p(e,t,n,r,i);case`binary`:return{kind:`file`,key:r.key,mediaType:r.mediaType??``};case`unknown`:return G({});case`never`:return this.#L(n,`mock/unsatisfiable`,`${this.#I(n,t)} accepts no value.`),{kind:`never`};case`array`:return this.#m(e,t,n,r);case`object`:return this.#v(e,t,n,r);case`union`:return this.#y(e,t,n,r);case`intersection`:return this.#b(e,t,n,r)}}#d(e,t,n,r,i){let a=Dl.of(t),o=typeof i==`string`?i:void 0,s=Fa(e)??(e.format===`time`?`time`:void 0);if(s!==void 0){let e=vf(r.name);return{kind:`when`,key:r.key,value:o??xd(void 0,s,e,a),format:s,when:e,asDate:s!==`time`&&this.#e.config.types.dates===`Date`}}let c=e.constraints??{},l=c.minLength??0,u=c.maxLength??1/0,d=of(r.name,r.owner,e.format,o);c.contentEncoding===`base64`||c.contentEncoding===`base64url`?d=`base64`:c.contentMediaType!==void 0&&/json/i.test(c.contentMediaType)&&(d=`json`);let f=c.pattern;if(f!==void 0){let e=o;if(d!==void 0)for(let t=0;e===void 0&&t<5;t++){let t=od(d,a,``,l,u);nu(f,t)===!0&&(e=t)}if(e??=tu(f,a,l,u),e!==void 0)return{kind:`pattern`,key:r.key,value:e,pattern:f,min:l,max:u,...d===void 0?{}:{text:d}};this.#L(n,`mock/unsupported-pattern`,`No string matching the pattern of ${this.#I(n,t)} could be generated; the fixture does not match it.`,"Add an `example` that matches the pattern.",`info`)}let p=r.error,m=p===void 0?void 0:mf(r.name,e.format,p.kind===`field`,o);if(p!==void 0&&m!==void 0)return{kind:`error`,key:r.key,value:o??ad(_d(m,p.status,a),a,l,u),part:m,status:p.status,min:l,max:u};let h=d??(o===void 0?`words`:`like`),g=o===void 0?$u(h,Qu(Dl.of(`${t.slice(0,t.lastIndexOf(`/`))}#person`)),a,``):void 0;return{kind:`text`,key:r.key,value:o??(g===void 0?od(h,a,``,l,u):ad(g,a,l,u)),text:h,min:l,max:u}}#f(e,t,n,r,i){let a=Dl.of(t),o=e.kind===`integer`,s=typeof i==`number`?i:void 0,c=e.constraints??{},l=c.minimum??-1/0,u=c.maximum??1/0,d=!1,f=!1;c.exclusiveMinimum!==void 0&&c.exclusiveMinimum>=l&&(l=c.exclusiveMinimum,d=!0),c.exclusiveMaximum!==void 0&&c.exclusiveMaximum<=u&&(u=c.exclusiveMaximum,f=!0);let p=(d?l<400:l<=400)&&(f?u>599:u>=599);if(o&&r.error?.kind===`model`&&hf(r.name)&&c.multipleOf===void 0&&p)return{kind:`status`,key:r.key,value:s??r.error.status};let m=gf(r.name,o);if(m!==void 0&&Math.max(l,m.min)<=Math.min(u,m.max))m.min>l&&([l,d]=[m.min,!1]),m.max<u&&([u,f]=[m.max,!1]);else if(l===-1/0&&u===1/0&&s!==void 0){let e=Math.max(Math.abs(s),10);[l,u]=s>=0?[Math.max(0,s-e),s+e]:[s-e,s+e]}l===-1/0&&u===1/0?[l,u]=[1,o?100:1e3]:l===-1/0?l=u>0?0:u-1e3:u===1/0&&(u=l+(o?100:1e3));let h=e=>(d?e>l:e>=l)&&(f?e<u:e<=u)&&(!o||Number.isInteger(e)),g=c.multipleOf??(o?1:void 0);if(g!==void 0&&g>0){if(o&&!Number.isInteger(g)){let e=g,t=Array.from({length:1e3},(e,t)=>t+1).find(t=>Number.isInteger(Mf(t*e,10)));g=t===void 0?e:Mf(t*e,10)}let e=jf(g),t=Math.ceil(l/g),n=Math.floor(u/g);if(h(Mf(t*g,e))||t++,h(Mf(n*g,e))||n--,t<=n){let i=s??Mf(a.int(t,n)*g,e);return g===1&&c.multipleOf===void 0?{kind:`int`,key:r.key,value:i,min:t,max:n}:{kind:`multiple`,key:r.key,value:i,first:t,last:n,step:g,digits:e}}}else{let e=m?.digits??2,t=d?f?`both`:`min`:f?`max`:`none`,n=s??Mf(l+a.next()*(u-l),e);if(h(n)||(n=(l+u)/2),h(n))return{kind:`number`,key:r.key,value:n,min:l,max:u,digits:e,exclusive:t}}return this.#L(n,`mock/unsatisfiable`,`No number satisfies the bounds of ${this.#I(n,t)}.`),G(s??(Number.isFinite(l)?l:0))}#p(e,t,n,r,i){let a=[...e.values.filter(e=>e!==null),...e.values.filter(e=>e===null)];if(i!==void 0){let e=ue(i),t=a.findIndex(t=>ue(t)===e);t>0&&a.unshift(...a.splice(t,1))}let[o,...s]=a;return o===void 0?(this.#L(n,`mock/unsatisfiable`,`${this.#I(n,t)} has an empty enum.`),{kind:`never`}):s.length===0||a.some(e=>typeof e==`object`&&!!e)?Of(o):{kind:`pick`,key:r.key,values:[o,...s]}}#m(e,t,n,r){let i=e.prefixItems??[],a=e.constraints?.minItems??0,o=e.constraints?.maxItems??1/0;a>wf&&this.#L(n,`mock/unsatisfiable`,`${this.#I(n,t)} requires more than ${wf} items.`);let s=r.name===void 0?void 0:Kd(r.name),c=e=>({key:e,name:s,owner:r.owner});if(i.length>0){let s=Math.min(Math.max(i.length,a),Math.max(o,i.length),wf),l=[];for(let o=0;o<s;o++){let s=this.#l(i[o]??e.items,`${t}/${o}`,n,c(`${r.key}[${o}]`));if(s===void 0){if(o<Math.max(a,i.length))return;break}if(s.kind===`never`&&o>=Math.max(a,i.length))break;l.push(s)}return{kind:`array`,items:l}}if(e.items.kind===`never`)return G([]);let l=this.#l(e.items,`${t}/items`,n,c(``));if(l===void 0)return a>0?void 0:G([]);if(l.kind===`never`&&a===0)return G([]);let u=r.collection===!0||yf(r.name),d=this.#C(e.items,0),[f,p]=u?[6,12]:d?[2,4]:[1,3],m=e.constraints?.uniqueItems===!0,h=m?this.#h(e.items):1/0,g=Math.min(a,wf),_=Math.max(g,Math.min(o,Math.max(p,g),h,wf)),v=Math.min(Math.max(f,g),_),y=u?Math.min(_,Math.max(g,1)):g;return{kind:`list`,key:r.key,count:v,min:g,max:_,least:y,item:l,unique:m}}#h(e,t=0){if(t>Cf)return 1/0;if(e.kind===`enum`)return e.values.length;if(e.kind===`boolean`)return e.nullable===!0?3:2;if(e.kind===`ref`){let n=this.#t.get(e.target)?.schema;return n===void 0?1/0:this.#h(n,t+1)}return 1/0}#g(e,t,n){if(e.kind!==`object`||!E(n))return;let r=this.#_(e,t);if(r===void 0)return;let i=Lf(e)?.name,a=i===void 0?void 0:ce(n,i);return typeof a==`number`?a:r.status}#_(e,t){let n=e.properties.map(e=>e.name);if(!uf(t.root===!0?t.owner:t.name??t.owner,n))return;let r=Lf(e),i=r?.schema.examples?.[0]??r?.schema.default,a=typeof i==`number`&&Number.isInteger(i)?i:sd;return{kind:pf(n)?`field`:`model`,status:a}}#v(e,t,n,r){let i=e.constraints?.maxProperties??1/0,a=e.constraints?.minProperties??0,o=a===0&&i===1/0,s=i-e.properties.filter(e=>e.required).length,c=e.properties.some(e=>bf(e.name)),l=this.#_(e,r),u=[],d=[];for(let i of e.properties){if(!i.required&&(s<=0||i.schema.kind===`never`))continue;let e=this.#l(i.schema,`${t}/${i.name}`,n,{...Rf(r,i.name),...c?{collection:!0}:{},...l===void 0?{}:{error:l}});if(e===void 0){if(i.required)return}else e.kind===`never`&&!i.required||(i.required||(s--,o&&d.push(i.name)),u.push([i.name,e]))}let f=[],p=e.additionalProperties;if(p!==void 0&&p!==!1){let o=Math.max(0,a-u.length),s=this.#l(p,`${t}/*`,n,{key:``,owner:r.name??r.owner});if(e.properties.length===0&&s!==void 0&&s.kind!==`never`){let e=Math.max(o,Math.min(i,3));f.push({kind:`record`,key:r.key,count:Math.min(Math.max(o,2),e),min:o,max:e,value:s})}else for(let i=1;u.length<a&&i<=wf;i++){let a=`property${i}`;if(e.properties.some(e=>e.name===a))continue;let o=this.#l(p,`${t}/${a}`,n,Rf(r,a));if(o===void 0)break;u.push([a,o])}}let m=r.root===!0?u.find(([e])=>Ff.has(e))?.[0]:void 0;return{kind:`object`,spreads:f,entries:u,...d.length===0?{}:{optional:d,path:r.key},...m===void 0?{}:{id:m}}}#y(e,t,n,r){let i=e.discriminator,a=!1,o=[];for(let s of e.variants.filter(e=>e.kind!==`null`)){let e=i===void 0||s.kind!==`ref`?void 0:i.mapping.find(e=>e.target===s.target)?.value;if(e!==void 0&&i!==void 0){let t=this.#j(s,0).properties.get(i.propertyName);if(t!==void 0&&!this.#E(e,t)){a=!0;continue}}let c=this.#l(s,t,n,r);c!==void 0&&(e===void 0||i===void 0?o.push(c):this.#S(c)?o.push(Uf(c,i.propertyName,Of(e))):(n.flags.risky=!0,o.push(c)))}let s=e.nullable===!0||e.variants.some(e=>e.kind===`null`),[c]=o;if(c===void 0)return s?G(null):a?(this.#L(n,`mock/unsatisfiable`,`No variant of ${this.#I(n,t)} can have its discriminator value: each one's \`${i?.propertyName??``}\` excludes the value the mapping gives it.`,`Correct the discriminator mapping, or the values the variants allow.`),{kind:`never`}):void 0;let l=o.length===1?c:{kind:`oneOf`,key:r.key,options:o};return s?{kind:`nullable`,key:r.key,value:l}:l}#b(e,t,n,r){let i=this.#x(e,0);if(i!==void 0){if(i.risky&&(n.flags.risky=!0),n.inline.depth>=Tf)return;i.closed&&i.properties.length>0&&(n.flags.risky=!0,this.#L(n,`mock/unsatisfiable`,`${this.#I(n,t)} combines an object that allows no properties with objects that declare some, so its type has no value.`)),n.inline.depth++;try{return this.#v({kind:`object`,properties:i.properties,...i.additional===void 0?{}:{additionalProperties:i.additional}},t,n,r)}finally{n.inline.depth--}}let a=[];for(let i of e.members){let e=this.#l(i,t,n,r);if(e===void 0)return;a.push(e)}let o=a.filter(e=>!qf(e)),[s=a[0]]=o;if(o.length<=1)return a.length>1&&(n.flags.risky=!0),s;if(o.every(e=>this.#S(e))){n.flags.risky=!0;let e={kind:`object`,spreads:[],entries:[]};for(let t of o)e=Wf(e,t);return e}let c=o.find(t=>{let n=this.#M(t,Df,!0);return n!==void 0&&this.#E(n,e)});return(c===void 0||o.some(e=>Hf(e)!==Hf(c)))&&(n.flags.risky=!0),this.#N(c??s??{kind:`never`},Df)}overridable(e){let t=this.#x(e,0);return t!==void 0&&t.properties.length>0&&!t.closed&&t.additional===void 0}#x(e,t){if(!(t>Cf))switch(e.kind){case`object`:{let t=e.additionalProperties===!1?void 0:e.additionalProperties;return{properties:e.properties,additional:t,closed:e.additionalProperties===!1&&e.properties.length===0,risky:!1}}case`unknown`:return e.assertions===void 0?{properties:[],additional:void 0,closed:!1,risky:!1}:void 0;case`ref`:{let n=this.#t.get(e.target)?.schema;return n===void 0?void 0:this.#x(n,t+1)}case`intersection`:{let n=[];for(let r of e.members){let e=this.#x(r,t+1);if(e===void 0)return;n.push(e)}let r=[],i=n.some(e=>e.risky),a=this.#e.config.types.dates===`Date`;for(let e of n.flatMap(e=>e.properties)){let t=r.findIndex(t=>t.name===e.name),n=r[t];n===void 0?r.push(e):(a&&n.schema.kind===`string`&&e.schema.kind===`string`&&Fa(n.schema)===void 0!=(Fa(e.schema)===void 0)&&(i=!0),r[t]={name:e.name,required:n.required||e.required,schema:this.#T(n.schema,e.schema,0)})}return{properties:r,additional:n.find(e=>e.additional!==void 0)?.additional,closed:n.some(e=>e.closed),risky:i}}default:return}}#S(e){switch(e.kind){case`object`:return!0;case`json`:return E(e.value);case`example`:return this.#S(e.value)&&this.#S(e.make);case`fixture`:{let t=this.#t.get(e.model)?.schema;return t!==void 0&&t.nullable!==!0&&this.#C(t,0)}default:return!1}}#C(e,t){if(t>Cf)return!1;switch(e.kind){case`object`:return!0;case`ref`:{let n=this.#t.get(e.target)?.schema;return n!==void 0&&this.#C(n,t+1)}case`intersection`:return e.members.every(e=>this.#C(e,t+1));case`union`:return e.variants.every(e=>this.#C(e,t+1));default:return!1}}#w(e,t,n,r,i){let a=e.assertions;if(a===void 0)return t;let o=kf(e),s=o,c=t,l=this.#M(c,Df,!0);if(l!==void 0){let e=a.conditional;if(e!==void 0){let t=this.#E(l,e.condition)?e.whenTrue:e.whenFalse;t!==void 0&&(s=this.#T(s,t,0))}if(E(l)){for(let[e,t]of Object.entries(a.dependentSchemas??{}))Object.hasOwn(l,e)&&(s=this.#T(s,t,0));for(let[e,t]of Object.entries(a.dependentRequired??{}))Object.hasOwn(l,e)&&(s=this.#T(s,Jf(t),0))}s!==o&&(c=this.#u(s,n,r,i)??c)}let u=a.not;if(u!==void 0)for(let e=1;e<=5;e++){let t=this.#M(c,Df,!0);if(t===void 0||!this.#E(t,u))break;c=this.#u(s,`${n}#${e}`,r,i)??c}return this.#N(c,Df)}#T(e,t,n){if(t.kind===`unknown`||n>Cf)return e;if(t.kind===`ref`){if(e.kind===`ref`&&e.target===t.target)return e;let r=this.#t.get(t.target)?.schema;return r===void 0?e:this.#T(e,r,n+1)}if(e.kind===`unknown`)return kf(t);if(e.kind===`ref`){let r=this.#t.get(e.target)?.schema;return r===void 0?e:this.#T(r,t,n+1)}if(e.kind===`enum`){let n=e.values.filter(e=>this.#E(e,t));return n.length===0?e:{...e,values:n}}if(t.kind===`enum`){let n=t.values.filter(t=>this.#E(t,e));return n.length===0?e:{kind:`enum`,values:n,...e.nullable===!0?{nullable:!0}:{}}}if(e.kind===`string`&&t.kind===`string`){let n=e.constraints??{},r=t.constraints??{},i=Math.max(n.minLength??0,r.minLength??0),a=Math.min(n.maxLength??1/0,r.maxLength??1/0),o=r.pattern??n.pattern;return{...e,...e.format===void 0&&t.format!==void 0?{format:t.format}:{},constraints:{...i>0?{minLength:i}:{},...a<1/0?{maxLength:a}:{},...o===void 0?{}:{pattern:o}}}}if((e.kind===`number`||e.kind===`integer`)&&(t.kind===`number`||t.kind===`integer`)){let n=e.constraints??{},r=t.constraints??{},i=(e,t,n)=>e===void 0?t:t===void 0?e:n(e,t),a=i(n.minimum,r.minimum,Math.max),o=i(n.maximum,r.maximum,Math.min),s=i(n.exclusiveMinimum,r.exclusiveMinimum,Math.max),c=i(n.exclusiveMaximum,r.exclusiveMaximum,Math.min),l=n.multipleOf??r.multipleOf;return{...e,kind:e.kind===`integer`||t.kind===`integer`?`integer`:`number`,constraints:{...a===void 0?{}:{minimum:a},...o===void 0?{}:{maximum:o},...s===void 0?{}:{exclusiveMinimum:s},...c===void 0?{}:{exclusiveMaximum:c},...l===void 0?{}:{multipleOf:l}}}}if(e.kind===`object`&&t.kind===`object`){let r=e.properties.map(e=>{let r=t.properties.find(t=>t.name===e.name);return r===void 0?e:{name:e.name,required:e.required||r.required,schema:this.#T(e.schema,r.schema,n+1)}}),i=t.properties.filter(t=>!e.properties.some(e=>e.name===t.name));return e.additionalProperties===!1?{...e,properties:r}:{...e,properties:[...r,...i]}}if(e.kind===`array`&&t.kind===`array`&&e.prefixItems===void 0){let r=e.constraints??{},i=t.constraints??{},a=Math.max(r.minItems??0,i.minItems??0),o=Math.min(r.maxItems??1/0,i.maxItems??1/0),s=r.uniqueItems===!0||i.uniqueItems===!0;return{...e,items:this.#T(e.items,t.items,n+1),constraints:{...a>0?{minItems:a}:{},...o<1/0?{maxItems:o}:{},...s?{uniqueItems:s}:{}}}}return e.kind===`intersection`?{...e,members:[...e.members,t]}:{kind:`intersection`,members:[e,kf(t)]}}#E(e,t,n=0,r=!1){if(e===Sf||e===null&&t.nullable===!0)return!0;if(!this.#D(e,t,n,r))return!1;let i=t.assertions;if(i===void 0)return!0;if(i.not!==void 0&&this.#E(e,i.not,n))return!1;let a=i.conditional;if(a!==void 0){let t=this.#E(e,a.condition,n)?a.whenTrue:a.whenFalse;if(t!==void 0&&!this.#E(e,t,n))return!1}if(!E(e))return!0;for(let[t,r]of Object.entries(i.dependentSchemas??{}))if(Object.hasOwn(e,t)&&!this.#E(e,r,n))return!1;for(let[t,n]of Object.entries(i.dependentRequired??{}))if(Object.hasOwn(e,t)&&!n.every(t=>Object.hasOwn(e,t)))return!1;return!0}#D(e,t,n,r){switch(t.kind){case`ref`:{if(n>Cf)return!0;let i=this.#t.get(t.target)?.schema;return i===void 0||this.#E(e,i,n+1,r)}case`string`:{if(typeof e!=`string`)return!1;let[n,r]=Af(e),i=t.constraints??{};if(Math.min(n,r)<(i.minLength??0)||Math.max(n,r)>(i.maxLength??1/0))return!1;let a=this.#e.config.types.dates===`Date`?Fa(t):void 0;return a===`date`?Nf.test(e)&&!Number.isNaN(Date.parse(e)):a!==`date-time`||Pf.test(e)&&!Number.isNaN(Date.parse(e))}case`number`:case`integer`:{if(typeof e!=`number`||!Number.isFinite(e)||t.kind===`integer`&&!Number.isInteger(e))return!1;let n=t.constraints??{};if(n.minimum!==void 0&&e<n.minimum||n.maximum!==void 0&&e>n.maximum||n.exclusiveMinimum!==void 0&&e<=n.exclusiveMinimum||n.exclusiveMaximum!==void 0&&e>=n.exclusiveMaximum)return!1;if(n.multipleOf!==void 0){let t=e/n.multipleOf;if(Math.abs(t-Math.round(t))>1e-9)return!1}return!0}case`boolean`:return typeof e==`boolean`;case`null`:return e===null;case`binary`:return e===xf;case`unknown`:return!0;case`never`:return!1;case`enum`:{let n=ue(e);return t.values.some(e=>ue(e)===n)}case`array`:{if(!Array.isArray(e))return!1;let r=e,i=t.constraints??{},a=t.prefixItems??[];if(r.length<Math.max(i.minItems??0,a.length)||r.length>(i.maxItems??1/0))return!1;if(i.uniqueItems===!0&&!r.includes(Sf)){let e=r.map(e=>ue(e));if(new Set(e).size!==e.length)return!1}return r.every((e,r)=>this.#E(e,a[r]??t.items,n))}case`object`:{if(!E(e))return!1;for(let r of t.properties)if(!Object.hasOwn(e,r.name)){if(r.required)return!1}else if(!this.#E(e[r.name],r.schema,n))return!1;let i=t.constraints??{},a=Object.keys(e).length;if(a<(i.minProperties??0)||a>(i.maxProperties??1/0))return!1;let o=t.additionalProperties;if(o===void 0||o===!1&&r)return!0;for(let r of Object.keys(e))if(!t.properties.some(e=>e.name===r)&&(o===!1||!this.#E(e[r],o,n)))return!1;return!0}case`union`:{let r=t.discriminator;return t.variants.some(t=>{let i=r===void 0||t.kind!==`ref`?[]:r.mapping.filter(e=>e.target===t.target).map(e=>e.value);if(i.length>0&&r!==void 0){let t=E(e)?ce(e,r.propertyName):void 0;if(typeof t!=`string`||!i.includes(t))return!1}return this.#E(e,t,n)})}case`intersection`:return t.members.every(t=>this.#E(e,t,n,!0))}}#O(e,t,n=0){if(e===null||n>Cf)return G(e);switch(t.kind){case`ref`:{let r=this.#t.get(t.target)?.schema;return r===void 0?G(e):this.#O(e,r,n+1)}case`string`:return typeof e==`string`&&Fa(t)!==void 0&&this.#e.config.types.dates===`Date`?{kind:`date`,value:e}:G(e);case`array`:{if(!Array.isArray(e))return G(e);let r=t.prefixItems??[];return{kind:`array`,items:e.map((e,i)=>this.#O(e,r[i]??t.items,n))}}case`union`:{let r=t.variants.find(t=>this.#E(e,t,n));return r===void 0?G(e):this.#O(e,r,n)}case`intersection`:{if(Array.isArray(e)){let r=this.#A(t,n);return r===void 0?G(e):{kind:`array`,items:e.map(e=>this.#O(e,r,n))}}if(E(e))return this.#k(e,t,n);let r=t.members.find(e=>!Kf(e));return r===void 0?G(e):this.#O(e,r,n+1)}case`object`:return E(e)?this.#k(e,t,n):G(e);case`enum`:return Of(e);default:return G(e)}}#k(e,t,n){let r=this.#j(t,n),i=[];for(let[t,a]of Object.entries(e)){let e=r.properties.get(t)??r.rest;e!==void 0&&i.push([t,this.#O(a,e,n)])}return{kind:`object`,spreads:[],entries:i}}#A(e,t){let n=[],r=(e,t)=>{if(!(t>Cf)){if(e.kind===`ref`){let n=this.#t.get(e.target)?.schema;n!==void 0&&r(n,t+1)}else if(e.kind===`intersection`)for(let n of e.members)r(n,t+1);else e.kind===`array`&&n.push(e.items)}};return r(e,t),Gf(n)}#j(e,t){let n=/* @__PURE__ */ new Map,r,i=(e,t)=>{if(!(t>Cf)){if(e.kind===`ref`){let n=this.#t.get(e.target)?.schema;n!==void 0&&i(n,t+1)}else if(e.kind===`intersection`)for(let n of e.members)Kf(n)||i(n,t+1);else if(e.kind===`object`){for(let t of e.properties)n.set(t.name,[...n.get(t.name)??[],t.schema]);e.additionalProperties!==void 0&&e.additionalProperties!==!1?r??=e.additionalProperties:e.properties.length===0&&e.additionalProperties===void 0&&(r??={kind:`unknown`})}else(e.kind===`unknown`||e.kind===`union`)&&(r??={kind:`unknown`})}};i(e,t);let a=/* @__PURE__ */ new Map;for(let[e,t]of n){let n=Gf(t);n!==void 0&&a.set(e,n)}return{properties:a,rest:r}}#M(e,t,n){let r=e=>e.includes(void 0)?void 0:e;switch(e.kind){case`json`:case`date`:return e.value;case`file`:return xf;case`never`:return;case`fixture`:{if(!n)return Sf;let r=this.#e.project.modelById.get(e.model);return r===void 0||this.#r.has(r.id)?void 0:this.#M(this.fixture(r),new zd(t.at(e.key)),n)}case`array`:return r(e.items.map(e=>this.#M(e,t,n)));case`object`:{let r={};for(let i of e.spreads){let e=this.#M(i,t,!0);if(e===void 0)return n?void 0:Sf;if(E(e))for(let[t,n]of Object.entries(e))D(r,t,n)}for(let[i,a]of e.entries){let e=this.#M(a,t,n);if(e===void 0)return;D(r,i,e)}return e.optional===void 0?r:t.optional(e.path??``,r,e.optional)}case`text`:return t.text(e.key,e.value,e.text,e.min,e.max);case`status`:return t.errorStatus(e.key,e.value);case`error`:return t.errorText(e.key,e.value,e.part,e.status,e.min,e.max);case`pattern`:return t.pattern(e.key,e.value,e.pattern,e.min,e.max,e.text);case`int`:return t.int(e.key,e.value,e.min,e.max);case`number`:return t.number(e.key,e.value,e.min,e.max,e.digits,e.exclusive);case`multiple`:return t.multiple(e.key,e.value,e.first,e.last,e.step,e.digits);case`bool`:return t.bool(e.key,e.value,e.rate);case`when`:return t.date(e.key,e.value,e.format,e.when);case`pick`:return t.pick(e.key,e.values);case`oneOf`:return t.oneOf(e.key,e.options.length,r=>{let i=e.options[r];return i===void 0?void 0:this.#M(i,t,n)});case`nullable`:return t.nullable(e.key,()=>this.#M(e.value,t,n));case`list`:return r(t.array(e.key,e.count,e.min,e.max,t=>this.#M(e.item,t,n),e.unique,e.least));case`record`:{let r=t.record(e.key,e.count,e.min,e.max,t=>this.#M(e.value,t,n));return Object.values(r).includes(void 0)?void 0:r}case`example`:return t.example(r=>this.#M(r?e.value:e.make,t,n),e.status);case`encoded`:return``}}#N(e,t,n=``){let r=e=>`${n}${e}`;switch(e.kind){case`json`:case`date`:case`never`:return e;case`fixture`:return{...e,key:r(e.key)};case`file`:return{...e,key:r(e.key)};case`text`:case`pattern`:case`int`:case`number`:case`multiple`:case`bool`:case`status`:case`error`:return G(this.#M(e,t,!1));case`pick`:return Of(t.pick(e.key,e.values));case`when`:{let n=t.date(e.key,e.value,e.format,e.when);return e.asDate?{kind:`date`,value:n}:G(n)}case`oneOf`:return t.oneOf(e.key,e.options.length,r=>this.#N(e.options[r]??{kind:`never`},t,n));case`nullable`:return t.nullable(e.key,()=>this.#N(e.value,t,n))??G(null);case`list`:return{kind:`array`,items:t.array(e.key,e.count,e.min,e.max,(t,r)=>this.#N(e.item,t,`${n}${e.key}[${r}].`),e.unique,e.least)};case`record`:return{kind:`object`,spreads:[],entries:Object.entries(t.record(e.key,e.count,e.min,e.max,(t,r)=>this.#N(e.value,t,`${n}${e.key}{${r}}.`)))};case`object`:{let r=e.entries.map(([e,r])=>[e,this.#N(r,t,n)]),i=new Set(Object.keys(e.optional===void 0?Object.fromEntries(r):t.optional(e.path??``,Object.fromEntries(r),e.optional)));return{kind:`object`,spreads:e.spreads.map(e=>this.#N(e,t,n)),entries:r.filter(([e])=>i.has(e)),...e.id===void 0?{}:{id:e.id}}}case`array`:return{kind:`array`,items:e.items.map(e=>this.#N(e,t,n))};case`example`:return t.example(r=>r?e.value:this.#N(e.make,t,n),e.status);case`encoded`:return{...e,value:this.#N(e.value,t,n)}}}fits(e){return!this.#i.has(e)}#P(e,t,n){let r=this.#M(e,Df,!1);r===void 0||this.#E(r,t)||(this.#i.add(e),this.#L(n,`mock/unsatisfiable`,`The generated fixture of \`${n.label}\` does not match its schema: its constraints contradict each other or cannot be combined.`,"Add an `example` that matches the schema."))}#F(e,t,n){this.#L(e,`mock/invalid-example`,`The ${n} of ${this.#I(e,t)} does not match its schema; the fixture uses a generated value instead.`,`Correct the ${n}.`)}#I(e,t){let n=(t.startsWith(e.root)?t.slice(e.root.length):``).split(`/`).filter(e=>e!==``).map(e=>/^\d+$/.test(e)?`[${e}]`:e===`items`?`[0]`:`.${e}`);return`\`${e.label}${n.join(``)}\``}#L(e,t,n,r,i=`warning`){this.#e.report?.({code:t,severity:i,message:n,...e.source===void 0?{}:{source:e.source},...r===void 0?{}:{hint:r}})}};function Lf(e){return e.properties.find(e=>e.schema.kind===`integer`&&hf(e.name))}function Rf(e,t){return{key:e.key===``?t:`${e.key}.${t}`,name:t,owner:e.root===!0?e.owner:e.name??e.owner}}function zf(e){return e.kind===`object`||e.kind===`example`&&e.value.kind===`object`&&e.make.kind===`object`}function Bf(e){switch(e.kind){case`json`:case`date`:case`never`:case`fixture`:case`file`:return!1;case`object`:return e.optional!==void 0||[...e.spreads,...e.entries.map(([,e])=>e)].some(Bf);case`array`:return e.items.some(Bf);case`encoded`:return Bf(e.value);default:return!0}}function Vf(e){switch(e.kind){case`json`:case`date`:case`never`:return!1;case`object`:return e.optional!==void 0||e.id!==void 0||[...e.spreads,...e.entries.map(([,e])=>e)].some(Vf);case`array`:return e.items.some(Vf);case`example`:return!0;default:return!0}}function Hf(e){return e.kind===`date`||e.kind===`when`&&e.asDate?`date`:`other`}function Uf(e,t,n){if(e.kind===`object`){let r=e.optional?.filter(e=>e!==t),{optional:i,path:a,...o}=e;return{...o,entries:[...e.entries.filter(([e])=>e!==t),[t,n]],...r===void 0||r.length===0?{}:{optional:r,path:e.path??``}}}return e.kind===`example`?{kind:`example`,value:Uf(e.value,t,n),make:Uf(e.make,t,n),...e.status===void 0?{}:{status:e.status}}:{kind:`object`,spreads:[e],entries:[[t,n]]}}function Wf(e,t){if(e.kind!==`object`)return e;if(t.kind===`object`){let n=new Set(t.entries.map(([e])=>e));return{kind:`object`,spreads:[...e.spreads,...t.spreads],entries:[...e.entries.filter(([e])=>!n.has(e)),...t.entries]}}if(t.kind===`json`&&E(t.value)){let n=e;for(let[e,r]of Object.entries(t.value))n=Uf(n,e,G(r));return n}return{...e,spreads:[...e.spreads,t]}}function Gf(e){let t=e.filter(e=>!Kf(e)),[n,...r]=t;return n===void 0?e[0]:r.length===0?n:{kind:`intersection`,members:t}}function Kf(e){return e.kind===`unknown`&&e.assertions===void 0&&e.nullable!==!0}function qf(e){return e.kind===`object`?e.spreads.length===0&&e.entries.length===0:e.kind===`json`&&E(e.value)&&Object.keys(e.value).length===0}function Jf(e){return{kind:`object`,properties:e.map(e=>({name:e,required:!0,schema:{kind:`unknown`}}))}}var Yf=`mocks/fake`,Xf=80;function Zf(e,t,n){let r=e===`{`?`}`:`]`;if(t.length===0)return`${e}${r}`;let i=e===`{`?`{ ${t.join(`, `)} }`:`[${t.join(`, `)}]`;return n.length+i.length<=Xf&&!i.includes(`
`)?i:`${e}
${t.map(e=>`${n}  ${e},`).join(`
`)}
${n}${r}`}function Qf(e,t){return Array.isArray(e)?Zf(`[`,e.map(e=>Qf(e,`${t}  `)),t):typeof e==`object`&&e?Zf(`{`,Object.entries(e).map(([e,n])=>`${R(e)}: ${Qf(n,`${t}  `)}`),t):z(e)}function K(e){return Number.isFinite(e)?z(e):e>0?`Infinity`:`-Infinity`}function $f(e){return e.startsWith(`{`)?`(${e})`:e}function q(e,t,n=``){let r=`${n}  `,i=(e,t)=>`f.${e}(${t.join(`, `)})`,a=(e,t)=>t===1/0?e===0?[]:[K(e)]:[K(e),K(t)];switch(e.kind){case`json`:{let r=Qf(e.value,n);return e.literal===!0?t.imports.lang===`js`?`/** @type {const} */ (${r})`:`${r} as const`:r}case`date`:return`new ${t.imports.global(`Date`)}(${L(e.value)})`;case`file`:return i(`file`,[L(e.key),L(e.mediaType)]);case`fixture`:{let n=t.ctx.project.modelById.get(e.model);return n?.fixtureName===void 0||n.fixtureModule===void 0?`null`:`${t.imports.add(n.fixtureModule,n.fixtureName,{typeOnly:!1})}(${t.sampler.takesOverrides(n)?`undefined, `:``}f.at(${L(e.key)}))`}case`never`:return t.imports.lang===`js`?`/** @type {never} */ (undefined)`:`(undefined as never)`;case`array`:return Zf(`[`,e.items.map(e=>q(e,t,r)),n);case`object`:return ep(e,t,n);case`text`:return i(`text`,[L(e.key),L(e.value),L(e.text),...a(e.min,e.max)]);case`status`:return i(`errorStatus`,[L(e.key),K(e.value)]);case`error`:{let t=a(e.min,e.max);return i(`errorText`,[L(e.key),L(e.value),L(e.part),...e.status===sd&&t.length===0?[]:[K(e.status),...t]])}case`pattern`:return i(`pattern`,[L(e.key),L(e.value),L(e.pattern),...e.text===void 0?a(e.min,e.max):[K(e.min),K(e.max),L(e.text)]]);case`int`:return i(`int`,[L(e.key),K(e.value),K(e.min),K(e.max)]);case`number`:return i(`number`,[L(e.key),K(e.value),K(e.min),K(e.max),...e.exclusive===`none`?e.digits===2?[]:[String(e.digits)]:[String(e.digits),L(e.exclusive)]]);case`multiple`:return i(`multiple`,[L(e.key),K(e.value),K(e.first),K(e.last),K(e.step),String(e.digits)]);case`bool`:return i(`bool`,[L(e.key),String(e.value),...e.rate===.5?[]:[K(e.rate)]]);case`when`:{let n=i(`date`,[L(e.key),L(e.value),L(e.format),L(e.when)]);return e.asDate?`new ${t.imports.global(`Date`)}(${n})`:n}case`pick`:{let r=Qf([...e.values],n);return i(`pick`,[L(e.key),t.imports.lang===`js`?`/** @type {const} */ (${r})`:`${r} as const`])}case`oneOf`:{let n=e.options.map(e=>q(e,t,`${r}  `)),a=n.length-1,o=n.map((e,t)=>t===a?e:`index === ${t} ? ${e} :`).join(`
${r}  `);return i(`oneOf`,[L(e.key),String(e.options.length),`(index) =>
${r}  ${o}`])}case`nullable`:return i(`nullable`,[L(e.key),`() => ${$f(q(e.value,t,n))}`]);case`list`:{let r=$f(q(e.item,t,n));return i(`array`,[L(e.key),String(e.count),String(e.min),String(e.max),`${Vf(e.item)?`(f)`:`()`} => ${r}`,...e.least===e.min?e.unique?[`true`]:[]:[String(e.unique),String(e.least)]])}case`record`:{let r=$f(q(e.value,t,n));return i(`record`,[L(e.key),String(e.count),String(e.min),String(e.max),`${Vf(e.value)?`(f)`:`()`} => ${r}`])}case`encoded`:{let r=t.imports.add(Yf,e.encoding,{typeOnly:!1}),i=q(e.value,t,n);return e.encoding===`xml`?`${r}(${i}, ${z(e.shape??{})})`:`${r}(${i}, ${L(e.mediaType)})`}case`example`:return i(`example`,[`(examples) =>
${r}examples
${r}  ? ${q(e.value,t,`${r}  `)}
${r}  : ${q(e.make,t,`${r}  `)}`,...e.status===void 0?[]:[K(e.status)]])}}function ep(e,t,n,r=[],i){let a=`${n}  `,o=Zf(`{`,[...e.spreads.map(e=>`...${q(e,t,a)}`),...e.entries.map(([n,r])=>{let i=q(r,t,a);return`${R(n)}: ${n===e.id?`f.id(${i})`:i}`}),...r],n);return e.optional===void 0?o:`f.optional(${L(e.path??``)}, ${o}, ${Qf([...e.optional],n)}${i===void 0?``:`, ${i}`})`}function tp(e,t){return ep(e,t,`  `,[`...overrides`],`overrides`)}function np(e,t,n){let{fixtureName:r,fixtureModule:i}=e;if(r===void 0||i===void 0)return;let a=t.fixture(e),o=t.takesOverrides(e),s=e.definition.schema.nullable===!0,c=Vf(a),l=c?`options`:`_options`;return{module:i,origin:`core:mocks`,...I(i,n,(i,u)=>{i.declare(r);let d={imports:i,ctx:n,sampler:t},f=i.add(e.module,e.name,{typeOnly:!0}),p=i.add(Yf,`FixtureOptions`,{typeOnly:!0}),m=`${i.global(`Partial`)}<${s?`${i.global(`NonNullable`)}<${f}>`:f}>`,h={...n.config.features.jsdoc?{summary:`A new {@link ${e.name}} for tests and mocks. Without a seed it is made of the specification's examples, and every call returns an equal value; other seeds make other realistic values.`}:{},tags:[...o?[{tag:`param`,text:`${u===`js`?`{${m}} [overrides]`:`overrides`} - Properties that replace the generated ones.`}]:[],{tag:`param`,text:`${u===`js`?`{${p}} [${l}]`:l} - \`seed\` picks another value (\`0\`, the default, is the examples'); \`empty\` makes arrays as short as allowed.`},...u===`js`?[{tag:`returns`,text:`{${f}}`}]:[]]},g=u===`js`?o?`overrides, ${l}`:l:`${o?`overrides?: ${m}, `:``}${l}?: ${p}`;if(u===`dts`)return`${B(h)}export declare function ${r}(${g}): ${f};
`;let _;if(o&&a.kind===`object`)_=ep(a,d,`  `,[`...overrides`],`overrides`);else if(o&&a.kind===`example`&&a.value.kind===`object`&&a.make.kind===`object`){let e=a.status===void 0?``:`, ${K(a.status)}`;_=`f.example((examples) =>
    examples
      ? ${ep(a.value,d,`      `,[`...overrides`])}
      : ${ep(a.make,d,`      `,[`...overrides`],`overrides`)}${e})`}else _=q(a,d,`  `);t.fits(a)||(_=u===`ts`?`${_} as unknown as ${f}`:`/** @type {${f}} */ (/** @type {unknown} */ (${_}))`);let v=c?`  const f = ${i.add(Yf,`fake`,{typeOnly:!1})}(options);
`:``;return`${B(h)}export function ${r}(${g})${u===`ts`?`: ${f}`:``} {
${v}  return ${_};
}
`}),exports:[{name:r,kind:`fixture`,typeOnly:!1}],sources:{schemas:[e.id]}}}var rp=`mocks/support`,ip=/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/,ap=/^[\t\x20-\x7e\x80-\xff]*$/;function op(e){let t=e.success[0]?.response.status??`200`;if(/^\d{3}$/.test(t))return Number(t);let n=/^([1-5])XX$/i.exec(t)?.[1];return n===void 0?200:+`${n}00`}function sp(e){for(let{response:t}of e.errors){if(/^\d{3}$/.test(t.status))return Number(t.status);let e=/^([45])XX$/i.exec(t.status)?.[1];if(e!==void 0)return+`${e}00`}return 500}var cp=e=>e.toLowerCase().replace(/[^a-z0-9]/g,``);function lp(e,t,n){let r=e.parameters.filter(e=>e.parameter.in===`path`).map(e=>e.parameter.name),i=e.success[0]?.media;if(r.length===0||i===void 0)return{fill:[]};let a=Yo(i,e.parseAs),o=a===`json`?i.schema:a===`text`?i.itemSchema===void 0?Bd(i.mediaType)&&!qo(i.schema)?i.schema:void 0:{kind:`array`,items:i.itemSchema}:void 0;if(o===void 0)return{fill:[]};let s=[],c=(e,n)=>{for(let i of r){let r=e.get(i),a=r===void 0?void 0:t.scalarType(r);a!==void 0&&s.push([`${n}${i}`,i,a===`number`])}},l=o,u=t.arrayItemsOf(l);if(u!==void 0)return c(t.objectProperties(u),`[].`),{fill:s};let d=t.objectProperties(l);c(d,``);for(let[e,n]of d){let r=yf(e)?t.arrayItemsOf(n):void 0;r!==void 0&&c(t.objectProperties(r),`${e}.[].`)}let f=r.at(-1),p=l.kind===`ref`?n.project.modelById.get(l.target):void 0,m=d.get(`id`),h=m===void 0?void 0:t.scalarType(m);if(f!==void 0&&p!==void 0&&h!==void 0){let e=cp(f.replace(/[-_]?id$/i,``));if(f===`id`||e!==``&&cp(p.name).startsWith(e))return f!==`id`&&s.push([`id`,f,h===`number`]),{fill:s,entity:f}}return{fill:s}}function up(e,t){let n=e.body;if(n===void 0)return`undefined`;if(n.alternatives.length>0)return`unknown`;switch(Ko(n.media)){case`json`:return t.add(e.symbol.module,e.symbol.typeNames.body,{typeOnly:!0});case`multipart`:return t.global(`FormData`);case`urlencoded`:return t.global(`URLSearchParams`);case`text`:return`string`;case`binary`:case`raw`:return t.global(`Blob`)}}function dp(e){let t=e.body;if(t===void 0||t.alternatives.length>0)return;let n=Ko(t.media);return n===`raw`?`binary`:n}function fp(e,t,n){let{symbol:r}=e,i=r.mock;if(i===void 0)return;let a=r.operation,o=[...e.success,...e.errors].map(n=>{let i=e.success.includes(n),a=n.media,o=a===void 0?void 0:Yo(a,i?e.parseAs:void 0),s=`${r.name} ${n.response.status}`,c=n.response.source,l=n.response.headers.flatMap(e=>{if(!e.required||!ip.test(e.name)||e.name.toLowerCase()===`content-type`)return[];let n=t.headerValue(e.schema,`${s} ${e.name}`,c,e.name);return n===void 0||!ap.test(n)?[]:[[e.name,n]]});return{planned:n,success:i,kind:o,body:a===void 0||o===void 0?void 0:t.responseBody(a,o,s,c),headers:l}}),s=op(e),c=`${ee(a.method)} ${a.path}`,l=[{name:i.name,kind:`mock`,typeOnly:!1},{name:i.options,kind:`type`,typeOnly:!0},{name:i.request,kind:`type`,typeOnly:!0}];return{module:i.module,origin:`core:mocks`,...I(i.module,n,(l,u)=>{for(let e of[i.name,i.options,i.request])l.declare(e);let d={imports:l,project:n.project,config:n.config,direction:`output`},f=(e,t)=>l.add(rp,e,{typeOnly:t}),p=new uc(e,()=>l.add(`runtime/types`,`HttpStatus`,{typeOnly:!0})),m=[],h=e.parameters.filter(e=>e.parameter.in===`path`),g=h.length===0?`${l.global(`Record`)}<string, never>`:`{ ${h.map(e=>`${R(e.parameter.name)}: string`).join(`; `)} }`,_=(()=>{let t=o[0];if(t===void 0||!t.success)return`unknown`;let n=t.planned.media;return n===void 0?`undefined`:ic(n,e.parseAs,d,`  `)})(),v=`${f(`MockRequest`,!0)}<${g}, ${up(e,l)}, ${_}>`,y={summary:`What a response function of {@link ${i.name}} receives: the request, its path parameters, its body and the body generated for it.`,tags:[]},b=e=>`${f(`MockBody`,!0)}<${e}, ${i.request}>`,x=[],S=/* @__PURE__ */ new Map;for(let t of o){let n=t.planned.media,r=p.of(t.planned.response.status,t.success);if(r===`never`)continue;let i=t===o[0]&&t.success?`?`:``;if(n===void 0){x.push(`{ status${i}: ${r}; body?: ${b(`undefined`)} }`);continue}let a=t.success?e.parseAs:void 0;x.push(`{ status${i}: ${r}; body?: ${b(ic(n,a,d,`    `))} }`),S.set(t,ic(n,a,d,`      `))}e.success.length===0&&x.unshift(`{ status?: ${l.add(`runtime/types`,`HttpStatus`,{typeOnly:!0})}<2>; body?: ${b(`unknown`)} }`);let C=p.undeclaredSuccess(e);C!==void 0&&x.push(`{ status: ${C}; body?: ${b(`unknown`)} }`);let te=p.rest();te!==void 0&&!e.errors.some(e=>e.response.status==="default")&&x.push(`{ status: ${te}; body?: ${b(`unknown`)} }`);let ne=f(`MockSettings`,!0),re={summary:`Options of {@link ${i.name}}: \`status\` selects a documented response (default \`${s}\`) and types \`body\`, which replaces the generated body or computes one from the request.`,tags:[]};u===`js`?m.push(B({...y,tags:[{tag:`typedef`,text:`{${v}} ${i.request}`}]}),B({...re,tags:[{tag:`typedef`,text:`{${ne} & (${x.join(` | `)})} ${i.options}`}]})):m.push(`${B(y)}export type ${i.request} = ${v};
`,`${B(re)}export type ${i.options} = ${ne} &
  (
${x.map(e=>`    | ${e}`).join(`
`)}
  );
`);let w=l.add(`msw`,`HttpHandler`,{typeOnly:!0,external:!0}),ie=o.find(e=>!e.success&&/^\d{3}$/.test(e.planned.response.status)),ae=[{tag:`param`,text:`${u===`js`?`{${i.options}} [options]`:`options`} - The status and body to respond with, and settings such as \`delay\`, \`seed\`, \`empty\` and \`error\`.`},...u===`js`?[{tag:`returns`,text:`{${w}}`}]:[],...n.config.features.jsdoc?[{tag:`example`,text:`server.use(${i.name}(${ie===void 0?`{ delay: 300 }`:`{ status: ${ie.planned.response.status} }`}));`}]:[]],oe={...n.config.features.jsdoc?{summary:`Mocks \`${c}\` (\`${r.name}\`) with Mock Service Worker. Without options it responds with \`${s}\` ${o[0]?.body===void 0?`without a body`:`and a body generated for the request`}.`}:{},tags:ae};if(u===`dts`)return m.push(`${B(oe)}export declare function ${i.name}(options?: ${i.options}): ${w};
`),m.join(`
`);let T=[`client: ${l.add(`client`,`client`,{typeOnly:!1})}`,`method: ${L(ee(a.method))}`,`path: ${L(a.path)}`];e.server!==void 0&&T.push(`server: ${L(e.server)}`);let se=Object.fromEntries(h.flatMap(({parameter:e})=>e.style===`label`||e.style===`matrix`?[[e.name,e.style]]:[]));Object.keys(se).length>0&&T.push(`styles: ${z(se)}`),T.push(`status: ${s}`);let E=sp(e);E!==500&&T.push(`error: ${E}`);let D=lp(e,t,n);D.entity!==void 0&&T.push(`entity: ${L(D.entity)}`),D.fill.length>0&&T.push(`fill: ${z(D.fill.map(e=>[...e]))}`),n.project.operations.some(e=>e.operation.path===a.path&&e.operation.method===`options`)&&a.method!==`options`&&T.push(`preflight: false`);let ce=dp(e);ce!==void 0&&T.push(`request: ${L(ce)}`);let le=n.config.types.dates===`Date`,ue=e=>l.add(`runtime/dates`,e,{typeOnly:!1});if(le&&e.body!==void 0){let t=rs([e.body.media,...e.body.alternatives].map(e=>e.schema),n.project,l,`    `);t!==void 0&&T.push(`decode: (body) => ${ue(`reviveDates`)}(body, ${t})`)}let de=o.map(e=>{let r=e.planned.media,i=[];if(r!==void 0&&i.push(`mediaType: ${L(r.mediaType)}`),e.body!==void 0){let r=e.body.kind===`encoded`?e.body:void 0,a=r===void 0?S.get(e):void 0,o=u===`ts`&&a!==void 0?`: ${a}`:``,s=r?.value??e.body;if(r!==void 0){let e=l.add(Yf,r.encoding,{typeOnly:!1});i.push(r.encoding===`xml`?`write: (body) => ${e}(body, ${z(r.shape??{})})`:`write: (body) => ${e}(body, ${L(r.mediaType)})`)}let c={imports:l,ctx:n,sampler:t},d=e=>u===`ts`&&a!==void 0&&!t.fits(s)?`${e} as unknown as ${a}`:e,f=s.kind===`fixture`?n.project.modelById.get(s.model):void 0;if(s.kind===`fixture`&&s.key===``&&f?.fixtureName!==void 0&&f.fixtureModule!==void 0){let e=l.add(f.fixtureModule,f.fixtureName,{typeOnly:!1});i.push(`body: (options)${o} => ${d(`${e}(${t.takesOverrides(f)?`undefined, `:``}options)`)}`)}else if(Vf(s)){let e=l.add(Yf,`fake`,{typeOnly:!1});i.push(`body: (options)${o} => {
        const f = ${e}(options);
        return ${d(q(s,c,`        `))};
      }`)}else{let e=d(q(s,c,`      `));i.push(`body: ()${o} => ${e.startsWith(`{`)?`(${e})`:e}`)}}if(e.headers.length>0&&i.push(`headers: ${z(Object.fromEntries(e.headers))}`),le&&r!==void 0&&e.kind===`json`){let e=ns(r.schema,n.project,l,`      `);e!==void 0&&i.push(`encode: (body) => ${ue(`encodeDates`)}(body, ${e})`)}let a=L(e.planned.response.status);return i.length===0?`${a}: {}`:`${a}: {
${i.map(e=>`      ${e},`).join(`
`)}
    }`});T.push(de.length===0?`responses: {}`:`responses: {
${de.map(e=>`    ${e},`).join(`
`)}
  }`);let fe=u===`ts`?`options?: ${i.options}): ${w}`:`options)`;return m.push(`${B(oe)}export function ${i.name}(${fe} {
  return ${f(`mockHandler`,!1)}(
    {
${T.map(e=>`      ${e.replace(/\n/g,`
    `)},`).join(`
`)}
    },
    options,
  );
}
`),m.join(`
`)}),exports:l,sources:{operations:[r.key]}}}function pp(e,t){let n=e.symbol.operation.path.split(`/`),r=t.symbol.operation.path.split(`/`);for(let e=0;e<Math.min(n.length,r.length);e++){let t=!(n[e]??``).includes(`{`);if(t!==!(r[e]??``).includes(`{`))return t?-1:1}let i=e=>{let t=S.indexOf(e.symbol.operation.method);return t===-1?S.length:t};return O(e.symbol.operation.path,t.symbol.operation.path)||i(e)-i(t)||O(e.symbol.operation.method,t.symbol.operation.method)}function mp(e,t){let n=t.project.mockHandlers;if(n===void 0)return;let r=`mocks/handlers`,i=e.filter(e=>e.symbol.mock!==void 0).sort(pp),a=i.length===0?`_options`:`options`;return{module:r,origin:`core:mocks`,...I(r,t,(e,r)=>{e.declare(n);let o=e.add(`msw`,`HttpHandler`,{typeOnly:!0,external:!0}),s=e.add(rp,`MockSettings`,{typeOnly:!0}),c=B({...t.config.features.jsdoc?{summary:"A mock handler for every operation, responding with its default status and a body generated for the request: pass them to `setupWorker()` or `setupServer()`. More specific paths come first (`/pets/mine` before `/pets/{id}`)."}:{},tags:[{tag:`param`,text:`${r===`js`?`{${s}} [${a}]`:a} - Settings applied to every handler, such as \`delay\`, \`seed\`, \`empty\` and \`error\`.`},...r===`js`?[{tag:`returns`,text:`{${o}[]}`}]:[]]});if(r===`dts`)return`${c}export declare function ${n}(${a}?: ${s}): ${o}[];
`;let l=i.flatMap(t=>{let n=t.symbol.mock;return n===void 0?[]:[`${e.add(n.module,n.name,{typeOnly:!1})}(options)`]}),u=l.length===0?`[]`:`[
${l.map(e=>`    ${e},`).join(`
`)}
  ]`,d=r===`ts`?`${a}?: ${s}): ${o}[]`:`${a})`;return`${c}export function ${n}(${d} {
  return ${u};
}
`}),exports:[{name:n,kind:`mock`,typeOnly:!1}]}}var hp=[`MockBody`,`MockClient`,`MockRequest`,`MockSettings`];function gp(e,t){let n=`mocks/index`,r=e.project.mockFetch??`mockFetch`,i=r===`mockFetch`?`mockFetch`:`mockFetch as ${r}`;return{module:n,origin:`core:mocks-barrel`,...I(n,e,(e,n)=>{let r=e.specifier(rp),a=[`export { ${i} } from '${r}';`,...t.map(t=>`export * from '${e.specifier(t.module)}';`)];return n!==`js`&&a.unshift(`export type { ${hp.join(`, `)} } from '${r}';`,`export type { FixtureOptions } from '${e.specifier(Yf)}';`),`${a.join(`
`)}
`}),exports:[...[...hp,`FixtureOptions`].map(e=>({name:e,kind:`type`,typeOnly:!0})),{name:r,kind:`mock`,typeOnly:!1},...t.flatMap(e=>e.exports)]}}var _p=[{location:`path`,field:`path`},{location:`query`,field:`query`},{location:`header`,field:`headers`},{location:`cookie`,field:`cookies`}];function vp(e,t){let n=e[0];if(n===void 0)throw Error(`A webhook module needs at least one operation.`);let r=n.module,i=e.flatMap(e=>Object.values(e.typeNames).map(e=>({name:e,kind:`type`,typeOnly:!0}))),a=I(r,t,(n,r)=>{for(let e of i)n.declare(e.name);let a={imports:n,project:t.project,config:t.config,direction:`output`},o={...a,direction:`input`};return e.map(e=>yp(e,r,a,o,t)).join(`
`)});return{module:r,origin:n.kind===`webhook`?`core:webhook`:`core:callback`,...a,exports:i,sources:{operations:e.map(e=>e.key)}}}function yp(e,t,n,r,i){let{operation:a,typeNames:o}=e,s=ee(a.method),c=e.kind===`webhook`?`the \`${e.webhook.name}\` webhook`:`the \`${e.webhook.name}\` callback (\`${s} ${e.webhook.expression??``}\`)`,l=(e,n,r)=>t===`js`?B({...r,tags:[...r.tags,{tag:`typedef`,text:`{${n}} ${e}`}]}):`${B(r)}export type ${e} = ${n};
`,u=i.config.features.jsdoc,d=[],f=a.requestBody===void 0?void 0:Go(a.requestBody.contents,`request`),p=f===void 0?`undefined`:rc(f,n),m=vo(a.summary??a.description);d.push(l(o.payload,p,{summary:m.summary??`Body of the \`${s}\` request the API sends for ${c}${f===void 0?``:` (\`${f.mediaType}\`)`}.`,...m.description===void 0?{}:{description:m.description},tags:a.deprecated?[{tag:`deprecated`}]:[]}));let h=[],g=a.requestBody?.required!==!0;f!==void 0&&h.push(bp(`body`,o.payload,g,`Request body.`,t,u));for(let{location:e,field:r}of _p){let i=a.parameters.filter(t=>t.in===e);if(i.length===0)continue;let o=i.map(t=>`${R(e===`header`?t.name.toLowerCase():t.name)}${t.required?``:`?`}: ${Do(t.schema,n)}${t.required?``:` | undefined`}`);h.push(bp(r,`{ ${o.join(`; `)} }`,!1,e===`header`?`Declared headers (names in lowercase).`:`Declared ${e} parameters.`,t,u))}let _=a.parameters.find(e=>e.in===`querystring`);_!==void 0&&h.push(bp(`querystring`,Do(_.schema,n),!_.required,`The whole query string (\`${_.contentType??`application/x-www-form-urlencoded`}\`), parsed.`,t,u)),d.push(l(o.request,t===`js`?`{ ${h.join(` `)} }`:h.length===0?`Record<string, never>`:`{
${h.join(`
`)}
}`,{summary:`The request the API sends for ${c}.`,tags:[]}));let v=a.responses.filter(e=>Xo(e.status)),y=[...new Set(v.map(e=>{let t=Go(e.contents,`response`);return t===void 0?`void`:rc(t,r)}))],b=v.map(e=>`\`${e.status}\``).join(`, `);d.push(l(o.response,y.length===0?`void`:y.join(` | `),{summary:`Response body the API expects from ${c}${b===``?``:` (${b})`}.`,tags:[]}));let x=`(request: ${o.request}) => ${o.response} | Promise<${o.response}>`;return d.push(l(o.handler,x,{summary:`Handles ${c}.`,description:`Implement it in your server and call it with the received request. Payloads are not validated; use the generated Zod schemas to validate untrusted input.`,tags:[]})),d.join(`
`)}function bp(e,t,n,r,i,a){let o=`${R(e)}${n?`?`:``}: ${t}${n?` | undefined`:``};`;return i===`js`?o:`${a?B({summary:r,tags:[]},`  `):``}  ${o}`}function xp(e){let t=/* @__PURE__ */ new Map;for(let n of e){let e=t.get(n.module);e===void 0?t.set(n.module,[n]):e.push(n)}return[...t.values()]}var Sp=`mocks/start`;function Cp(e){let t=e.project.mockStart,n=e.project.mockHandlers;if(t===void 0||n===void 0)return;let r=e.project.mockFetch??`mockFetch`;return{module:Sp,origin:`core:mocks`,...I(Sp,e,(e,i)=>{e.declare(t.name),e.declare(t.options);let a=e.add(`msw`,`HttpHandler`,{typeOnly:!0,external:!0}),o=e.add(`msw/browser`,`SetupWorker`,{typeOnly:!0,external:!0}),s=e.add(`mocks/support`,`MockSettings`,{typeOnly:!0}),c=e.global(`Promise`),l=`readonly ${a}[]`,u={handlers:{type:`${l} | (() => ${l} | ${c}<${l}>)`,doc:"Handlers of your own, which take precedence over the generated ones: a list, or a function that loads one (`() => import('./mocks').then((m) => m.handlers)`), which keeps them out of production builds too."},onUnhandled:{type:`'bypass' | 'warn' | 'error'`,doc:"Requests no handler answers: `'bypass'` (the default) sends them to the network, `'warn'` logs them, `'error'` fails them."},log:{type:`boolean`,doc:`Log every mocked request in the console.`},serviceWorkerUrl:{type:`string`,doc:"Where the worker script is served (`/mockServiceWorker.js` by default)."}},d={summary:`Options of {@link ${t.name}}: the settings every generated handler takes, and how to start.`},f=i===`js`?B({...d,tags:[{tag:`typedef`,text:`{${s} & { ${Object.entries(u).map(([e,t])=>`${e}?: ${t.type}`).join(`; `)} }} ${t.options}`}]}):`${B({...d,tags:[]})}export interface ${t.options} extends ${s} {
${Object.entries(u).map(([e,t])=>`${B({summary:t.doc,tags:[]},`  `)}  readonly ${e}?: ${t.type};`).join(`
`)}
}
`,p=`${c}<${o}>`,m=B({summary:"Starts the mocks in the browser: Mock Service Worker answers the API, with your `handlers` first, then the generated ones. Resolves when the worker is ready, so render the app after it.",description:"This module imports nothing until it is called: behind your bundler's development check, production builds contain neither MSW nor the mocks. The worker script must be served from the site's root (`msw/vite`, or `npx msw init public`).",tags:[{tag:`param`,text:`${i===`js`?`{${t.options}} [options]`:`options`} - Your handlers, the settings of the generated ones (\`delay\`, \`seed\`\u2026) and how to start.`},...i===`js`?[{tag:`returns`,text:`{${p}}`}]:[],{tag:`example`,text:`if (import.meta.env.DEV) await ${t.name}({ delay: 'real' });`}]});if(i===`dts`)return`${f}
${m}export declare function ${t.name}(options?: ${t.options}): ${p};
`;let h=i===`ts`?`options: ${t.options} = {}): ${p}`:`options = {})`;return`${f}
${m}export async function ${t.name}(${h} {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator))
    throw new Error(
      '${t.name}() needs service workers: a browser page served over HTTPS or from localhost. In Node.js, use setupServer(...${n}()) from msw/node, or ${r}().',
    );
  const { handlers = [], onUnhandled = 'bypass', log = false, serviceWorkerUrl, ...settings } =
    options;
  const [{ setupWorker }, { ${n} }, own] = await ${c}.all([
    import('msw/browser'),
    import('${e.specifier(`mocks/handlers`)}'),
    typeof handlers === 'function' ? handlers() : handlers,
  ]);
  const worker = setupWorker(...own, ...${n}(settings));
  // MSW 3 reads \`onUnhandledFrame\`, MSW 2 \`onUnhandledRequest\`; each ignores the other.
  const startOptions = {
    quiet: !log,
    onUnhandledFrame: onUnhandled,
    onUnhandledRequest: onUnhandled,
    ...(serviceWorkerUrl === undefined ? {} : { serviceWorker: { url: serviceWorkerUrl } }),
  };
  await worker.start(startOptions);
  return worker;
}
`}),exports:[{name:t.name,kind:`mock`,typeOnly:!1},{name:t.options,kind:`type`,typeOnly:!0}]}}var wp=`mocks/support`,Tp=[{location:`path`,field:`path`},{location:`query`,field:`query`},{location:`header`,field:`headers`},{location:`cookie`,field:`cookies`}];function Ep(e,t){let{operation:n}=e,r=n.requestBody===void 0?void 0:Go(n.requestBody.contents,`request`),i=[],a=r!==void 0&&Ko(r)===`raw`;if(r!==void 0&&!a){let e=r.examples.find(e=>e.value!==void 0)?.value;i.push({name:`body`,required:n.requestBody?.required===!0,schema:e===void 0||r.schema.examples!==void 0?r.schema:{...r.schema,examples:[e]}})}for(let{location:e,field:t}of Tp){let r=n.parameters.filter(t=>t.in===e);if(r.length===0)continue;let a={kind:`object`,properties:r.map(t=>({name:e===`header`?t.name.toLowerCase():t.name,required:t.required,schema:t.schema}))};i.push({name:t,required:!0,schema:a})}let o=n.parameters.find(e=>e.in===`querystring`);o!==void 0&&i.push({name:`querystring`,required:o.required,schema:o.schema});let s=e.typeNames.request,c=t.value({kind:`object`,properties:i},s,n.source,e.webhook.name);if(!a||c.kind!==`object`)return c;let l=Bd(r.mediaType)&&!qo(r.schema)?{kind:`encoded`,encoding:`xml`,mediaType:r.mediaType,value:t.value(r.schema,`${s} body`,n.source,e.webhook.name),shape:t.xmlShape(r.schema)}:{kind:`text`,key:`body`,value:`Payload of the webhook.`,text:`paragraph`,min:0,max:1/0};return{...c,entries:[[`body`,l],...c.entries]}}function Dp(e,t,n){let r=e[0]?.mock?.module;if(r===void 0)return;let i=e.flatMap(e=>e.mock===void 0?[]:[{name:e.mock.make,kind:`fixture`,typeOnly:!1},{name:e.mock.send,kind:`mock`,typeOnly:!1}]),a=new Map(e.map(e=>[e,Ep(e,t)]));return{module:r,origin:`core:mocks`,...I(r,n,(r,o)=>{for(let e of i)r.declare(e.name);let s={imports:r,ctx:n,sampler:t};return e.map(e=>{let i=e.mock,c=a.get(e);if(i===void 0||c===void 0)return``;let{operation:l}=e,u=ee(l.method),d=e.kind===`webhook`?`the \`${e.webhook.name}\` webhook`:`the \`${e.webhook.name}\` callback`,f=r.add(e.module,e.typeNames.request,{typeOnly:!0}),p=r.add(Yf,`FixtureOptions`,{typeOnly:!0}),m=r.add(wp,`SendWebhookOptions`,{typeOnly:!0}),h=zf(c)&&c.kind===`object`&&c.entries.length>0,g=Vf(c),_=g?`options`:`_options`,v=`${r.global(`Partial`)}<${f}>`,y={summary:`A request the API could send for ${d} (\`${u}\`), to call your handler with in tests. Without a seed it is made of the specification's examples; other seeds make other realistic requests.`,tags:[...h?[{tag:`param`,text:`${o===`js`?`{${v}} [overrides]`:`overrides`} - Parts of the request that replace the generated ones.`}]:[],{tag:`param`,text:`${o===`js`?`{${p}} [${_}]`:_} - \`seed\` picks another request (\`0\`, the default, is the examples').`},...o===`js`?[{tag:`returns`,text:`{${f}}`}]:[]]},b=`${r.global(`Promise`)}<${r.global(`Response`)}>`,x={summary:`Sends the \`${u}\` request the API sends for ${d} to \`url\` (by default a generated request), and resolves with your route's response.`,tags:[{tag:`param`,text:`${o===`js`?`{string | URL} url`:`url`} - Where your route listens.`},{tag:`param`,text:`${o===`js`?`{${f}} [request]`:`request`} - The request to send; \`${i.make}()\` by default.`},{tag:`param`,text:`${o===`js`?`{${m}} [options]`:`options`} - The \`fetch\` to send with, and extra headers.`},...o===`js`?[{tag:`returns`,text:`{${b}}`}]:[]]},S=o===`js`?h?`overrides, ${_}`:_:`${h?`overrides?: ${v}, `:``}${_}?: ${p}`,C=o===`js`?`url, request, options`:`url: string | URL, request?: ${f}, options?: ${m}`;if(o===`dts`)return[`${B(y)}export declare function ${i.make}(${S}): ${f};
`,`${B(x)}export declare function ${i.send}(${C}): ${b};
`].join(`
`);let te=h?tp(c,s):q(c,s,`  `);t.fits(c)||(te=o===`ts`?`${te} as unknown as ${f}`:`/** @type {${f}} */ (/** @type {unknown} */ (${te}))`);let ne=g?`  const f = ${r.add(Yf,`fake`,{typeOnly:!1})}(options);
`:``,re=l.requestBody===void 0?void 0:Go(l.requestBody.contents,`request`),w=[`method: ${L(u)}`];if(re!==void 0&&w.push(`mediaType: ${L(re.mediaType)}`),n.config.types.dates===`Date`&&re!==void 0&&Ko(re)===`json`){let e=ns(re.schema,n.project,r,`    `);e!==void 0&&w.push(`encode: (body) => ${r.add(`runtime/dates`,`encodeDates`,{typeOnly:!1})}(body, ${e})`)}let ie=r.add(wp,`sendWebhook`,{typeOnly:!1});return[`${B(y)}export function ${i.make}(${S})${o===`ts`?`: ${f}`:``} {
${ne}  return ${te};
}
`,`${B(x)}export function ${i.send}(${C})${o===`ts`?`: ${b}`:``} {
  return ${ie}(
    url,
    { ${w.join(`, `)} },
    request ?? ${i.make}(),
    options,
  );
}
`].join(`
`)}).join(`
`)}),exports:i,sources:{operations:e.map(e=>e.key)}}}function Op(e,t){if(t.config.features.mocks===!1)return[];let n=new If(t),r=[];for(let e of t.project.models){let i=np(e,n,t);i!==void 0&&r.push(i)}for(let i of e){let e=fp(i,n,t);e!==void 0&&r.push(e)}for(let e of xp(t.project.webhooks)){let i=Dp(e,n,t);i!==void 0&&r.push(i)}let i=mp(e,t);i!==void 0&&r.push(i);let a=Cp(t);return a!==void 0&&r.push(a),t.config.output.barrel&&r.push(gp(t,r)),r}function kp(e){return e.project.operations.map(t=>Zo(t,e.project.ir))}function Ap(e){let t=kp(e),n=[go(e)];for(let t of e.project.models)n.push(Ho(t,e));for(let r of t)n.push(_c(r,e));for(let t of xp(e.project.webhooks))n.push(vp(t,e));for(let t of e.project.models){let r=is(t,e);r!==void 0&&n.push(r)}return e.config.output.barrel&&n.push(lo(e,n)),n.push(...tc(e)),n.push(...vl(t,e)),n.push(...Op(t,e)),n}function jp(e,t){let n=[],r=t.config.output.language===`typescript`;for(let i of e){let e={origin:i.origin,exports:i.exports,...i.sources===void 0?{}:{sources:i.sources}};r?n.push({path:`${i.module}.ts`,content:i.ts,...e}):(n.push({path:`${i.module}.js`,content:i.js,...e}),t.config.output.declarations&&n.push({path:`${i.module}.d.ts`,content:i.dts,...e}))}return n}function Mp(e){return[...wl(e.config),...jp(Ap(e),e)]}var Np=class{#e=[];#t=/* @__PURE__ */ new Set;add(e){let t=`${e.severity}|${e.code}|${e.message}|${e.location?.file??``}|${e.location?.pointer??``}|${e.operation??``}`;this.#t.has(t)||(this.#t.add(t),this.#e.push(e))}error(e){this.add({...e,severity:`error`})}warning(e){this.add({...e,severity:`warning`})}info(e){this.add({...e,severity:`info`})}addAll(e){for(let t of e)this.add(t)}get hasErrors(){return this.#e.some(e=>e.severity===`error`)}count(e){return this.#e.filter(t=>t.severity===e).length}toArray(){return[...this.#e]}},Pp=class extends Error{diagnostics;constructor(e,t=[]){super(e),this.name=`SwaggerzError`,this.diagnostics=t}},Fp=/* @__PURE__ */ new Map;function Ip(e){Fp.clear();for(let[t,n]of Object.entries(e))Fp.set(t,n)}function Lp(e){let t=Fp.get(e);if(t===void 0){let t=/* @__PURE__ */ Error(`ENOENT: no such file, open '${e}'`);throw t.code=`ENOENT`,t}return t}var Rp=e=>e instanceof URL?decodeURIComponent(e.pathname):e;async function zp(e){return Lp(Rp(e))}async function Bp(e){return e}function Vp(e){return e.toLowerCase()}function Hp(e){return e===``||/[\\:\0]/.test(e)||m.posix.isAbsolute(e)||m.win32.isAbsolute(e)||Vp(e)===Vp(se)?!1:e.split(`/`).every(e=>e!==``&&e!==`.`&&e!==`..`)}var Up=class{#e;#t;#n;constructor(e,t,n){let r=e=>e.enforce===`pre`?0:e.enforce===`post`?2:1;this.#e=[...e].sort((e,t)=>r(e)-r(t)),this.#t=t,this.#n=n}get plugins(){return this.#e}context(e){return{config:this.#n,report:t=>{this.#t.add({...t,plugin:e.name})}}}#r(e,t,n){if(n instanceof Pp)throw n;let r=n instanceof Error?n.message:String(n);throw new Pp(`Plugin "${e.name}" failed in ${t}`,[{code:`plugin/hook-failed`,severity:`error`,message:`Plugin "${e.name}" threw in the ${t} hook: ${r}`,plugin:e.name,...n instanceof Error&&n.stack!==void 0?{hint:n.stack.split(`
`).slice(0,4).join(`
`)}:{}}])}#i(e,t,n){try{return n()}catch(n){this.#r(e,t,n)}}async#a(e,t,n){try{return await n()}catch(n){this.#r(e,t,n)}}async beforeParse(e,t){let n=e;for(let e of this.#e){let r=e.beforeParse;if(r===void 0)continue;let i=await this.#a(e,`beforeParse`,()=>r.call(e,n,{...this.context(e),source:t}));i!==void 0&&(n=i)}return n}async afterNormalize(e){let t=e;for(let e of this.#e){let n=e.afterNormalize;if(n===void 0)continue;let r=await this.#a(e,`afterNormalize`,()=>n.call(e,t,this.context(e)));r!==void 0&&(t=r)}return t}namingHooks(){let e=(e,t,n)=>{let r;for(let i of this.#e){let a=i[e];if(a===void 0)continue;let o=this.#i(i,e,()=>a.call(i,t,r??n));o!==void 0&&o.trim()!==``&&(r=o)}return r},t={operationName:(t,n)=>e(`operationName`,t,n),modelName:(t,n)=>e(`modelName`,t,n)};return this.#e.some(e=>e.queryKey!==void 0)&&(t.queryKey=(e,t)=>{let n=t;for(let t of this.#e){let r=t.queryKey;if(r===void 0)continue;let i=this.#i(t,`queryKey`,()=>r.call(t,e,n));i!==void 0&&(n=i)}return n}),t}codegenHooks(){let e={};return this.#e.some(e=>e.jsdoc!==void 0)&&(e.jsdoc=(e,t)=>{let n=e;for(let e of this.#e){let r=e.jsdoc;if(r===void 0)continue;let i=this.#i(e,`jsdoc`,()=>r.call(e,n,t));i!==void 0&&(n=i)}return n}),this.#e.some(e=>e.resolveImport!==void 0)&&(e.resolveImport=e=>{let t;for(let n of this.#e){let r=n.resolveImport;if(r===void 0)continue;let i=this.#i(n,`resolveImport`,()=>r.call(n,{...e,specifier:t??e.specifier}));i!==void 0&&(t=i)}return t}),e}generateContext(e,t){return{...this.context(e),...t}}async beforeGenerate(e){for(let t of this.#e){let n=t.beforeGenerate;n!==void 0&&await this.#a(t,`beforeGenerate`,()=>n.call(t,this.generateContext(t,e)))}}async generate(e,t){let n=[...e];for(let e of this.#e){let r=e.generate;if(r===void 0)continue;let i={...this.generateContext(e,t),files:[...n]},a=await this.#a(e,`generate`,()=>r.call(e,i));a!==void 0&&n.push(...a.map(t=>({...t,origin:`plugin:${e.name}`})))}return n}async transformFiles(e,t){let n=[...e];for(let e of this.#e){let r=e.transformFile;if(r===void 0)continue;let i=[];for(let a of n){let o={...this.generateContext(e,t),files:n},s=await this.#a(e,`transformFile`,()=>r.call(e,a,o));s!==null&&i.push(s??a)}n=i}return n}async afterGenerate(e,t){for(let n of this.#e){let r=n.afterGenerate;r!==void 0&&await this.#a(n,`afterGenerate`,()=>r.call(n,e,this.generateContext(n,t)))}}async beforeWrite(e,t){for(let n of this.#e){let r=n.beforeWrite;r!==void 0&&await this.#a(n,`beforeWrite`,()=>r.call(n,e,this.generateContext(n,t)))}}async afterWrite(e,t){for(let n of this.#e){let r=n.afterWrite;r!==void 0&&await this.#a(n,`afterWrite`,()=>r.call(n,e,this.generateContext(n,t)))}}};async function Wp(e,t){let n=await Gp(e,t,{});if(n===void 0)throw Error(`Unexpected 304 Not Modified response.`);return n}async function Gp(e,t,n,r){let i=e;for(let e=0;e<=5;e++){let e={accept:`application/json, application/yaml, text/yaml, */*;q=0.5`,...n.etag===void 0?{}:{"if-none-match":n.etag},...n.lastModified===void 0?{}:{"if-modified-since":n.lastModified}};t.credentialOrigin!==void 0&&t.credentialOrigin===i.origin&&Object.assign(e,t.headers);let a=await fetch(i,{headers:e,redirect:`manual`,signal:r===void 0?AbortSignal.timeout(t.timeout):AbortSignal.any([AbortSignal.timeout(t.timeout),r])});if(a.status===304){await a.body?.cancel();return}if(a.status>=300&&a.status<400&&a.headers.has(`location`)){await a.body?.cancel();let e=new URL(a.headers.get(`location`)??``,i),n=t.checkRedirect(e);if(n!==void 0)throw Error(`Redirect to ${e.href} refused: ${n}`);i=e;continue}if(!a.ok)throw await a.body?.cancel(),Error(`HTTP ${a.status} ${a.statusText}`.trim());let o=Number(a.headers.get(`content-length`)??`0`);if(o>t.maxBytes)throw await a.body?.cancel(),/* @__PURE__ */ Error(`Document exceeds the ${t.maxBytes} byte limit (${o} bytes).`);let s=await Kp(a,t.maxBytes),c=a.headers.get(`etag`),l=a.headers.get(`last-modified`);return{text:s,contentType:a.headers.get(`content-type`)??``,url:i,validators:{...c===null?{}:{etag:c},...l===null?{}:{lastModified:l}}}}throw Error(`Too many redirects (more than 5).`)}async function Kp(e,t){if(e.body===null)return``;let n=e.body.getReader(),r=[],i=0;for(;;){let{done:e,value:a}=await n.read();if(e)break;if(i+=a.byteLength,i>t)throw await n.cancel(),/* @__PURE__ */ Error(`Document exceeds the ${t} byte limit.`);r.push(a)}return new TextDecoder(`utf-8`).decode(Buffer.concat(r))}var qp=class extends Error{offset;constructor(e,t){super(`${e} (at character ${t+1})`),this.name=`JsonPathError`,this.offset=t}},Jp={length:`value`,count:`value`,match:`logical`,search:`logical`,value:`value`},Yp={length:[`value`],count:[`nodes`],match:[`value`,`value`],search:[`value`,`value`],value:[`nodes`]},Xp=2**53-1,Zp=100,Qp=class{#e;#t=0;#n=0;constructor(e){this.#e=e}parse(){if(this.#r()!==`$`)throw new qp("A JSONPath query starts with `$`",this.#t);let e=this.#c();if(this.#t<this.#e.length)throw new qp(`Unexpected "${this.#r()}"`,this.#t);return e}#r(e=0){return this.#e[this.#t+e]??``}#i(e){return this.#e.startsWith(e,this.#t)}#a(e){throw new qp(e,this.#t)}#o(e){this.#i(e)||this.#a(`Expected "${e}"`),this.#t+=e.length}#s(){for(;/[ \t\n\r]/.test(this.#r());)this.#t++}#c(){let e=this.#r();this.#t++;let t=[];for(;;){let n=this.#t;if(this.#s(),this.#i(`..`))this.#t+=2,t.push({descendant:!0,selectors:this.#l()});else if(this.#r()===`.`)this.#t++,t.push({descendant:!1,selectors:[this.#u()]});else if(this.#r()===`[`)t.push({descendant:!1,selectors:this.#d()});else return this.#t=n,{root:e,segments:t}}}#l(){return this.#r()===`[`?this.#d():[this.#u()]}#u(){if(this.#r()===`*`)return this.#t++,{kind:`wildcard`};let e=/^[A-Za-z_\u{80}-\u{D7FF}\u{E000}-\u{10FFFF}][\w\u{80}-\u{D7FF}\u{E000}-\u{10FFFF}]*/u.exec(this.#e.slice(this.#t));return e===null&&this.#a("Expected a member name or `*`"),this.#t+=e[0].length,{kind:`name`,name:e[0]}}#d(){this.#o(`[`);let e=[];for(;;)if(this.#s(),e.push(this.#f()),this.#s(),this.#r()===`,`)this.#t++;else return this.#o(`]`),e}#f(){let e=this.#r();if(e===`'`||e===`"`)return{kind:`name`,name:this.#m()};if(e===`*`)return this.#t++,{kind:`wildcard`};if(e===`?`)return this.#t++,this.#s(),{kind:`filter`,expression:this.#_()};let t=this.#r()===`:`?void 0:this.#p();if(this.#s(),this.#r()!==`:`)return t===void 0&&this.#a(`Expected a selector`),{kind:`index`,index:t};this.#t++,this.#s();let n=/[-0-9]/.test(this.#r())?this.#p():void 0;this.#s();let r;return this.#r()===`:`&&(this.#t++,this.#s(),r=/[-0-9]/.test(this.#r())?this.#p():void 0),{kind:`slice`,...t===void 0?{}:{start:t},...n===void 0?{}:{end:n},...r===void 0?{}:{step:r}}}#p(){let e=/^(0|-?[1-9][0-9]*)/.exec(this.#e.slice(this.#t));e===null&&this.#a(`Expected an integer`);let t=Number(e[0]);return Math.abs(t)>Xp&&this.#a(`Integer out of range`),this.#t+=e[0].length,t}#m(){let e=this.#r();this.#t++;let t=``;for(;;){let n=this.#r();if(n===``&&this.#a(`Unterminated string`),this.#t++,n===e)return t;n===`\\`?t+=this.#h(e):(n.charCodeAt(0)<32&&this.#a(`Control characters must be escaped in strings`),t+=n)}}#h(e){let t=this.#r();this.#t++;let n={b:`\b`,f:`\f`,n:`
`,r:`\r`,t:`	`,"/":`/`,"\\":`\\`};if(t===e)return e;let r=n[t];if(r!==void 0)return r;t!==`u`&&this.#a(`Invalid escape "\\${t}"`);let i=()=>{let e=this.#e.slice(this.#t,this.#t+4);return/^[0-9A-Fa-f]{4}$/.test(e)||this.#a(`Invalid \\u escape`),this.#t+=4,Number.parseInt(e,16)},a=i();if(a>=56320&&a<=57343&&this.#a(`Unpaired low surrogate`),a>=55296&&a<=56319){this.#i(`\\u`)||this.#a(`Unpaired high surrogate`),this.#t+=2;let e=i();return(e<56320||e>57343)&&this.#a(`Invalid low surrogate`),String.fromCharCode(a,e)}return String.fromCharCode(a)}#g(e){this.#n>=Zp&&this.#a(`Nested more than ${Zp} levels deep`),this.#n++;try{return e()}finally{this.#n--}}#_(){return this.#g(()=>this.#v())}#v(){let e=[this.#y()];for(;this.#s(),this.#i(`||`);)this.#t+=2,this.#s(),e.push(this.#y());return e.length===1?e[0]:{kind:`or`,operands:e}}#y(){let e=[this.#b()];for(;this.#s(),this.#i(`&&`);)this.#t+=2,this.#s(),e.push(this.#b());return e.length===1?e[0]:{kind:`and`,operands:e}}#b(){if(this.#r()===`!`&&!this.#i(`!=`))return this.#t++,this.#s(),this.#r()===`(`?{kind:`not`,operand:this.#x()}:{kind:`not`,operand:this.#S(!0)};if(this.#r()===`(`)return this.#x();let e=this.#t,t=this.#w();this.#s();let n=[`==`,`!=`,`<=`,`>=`,`<`,`>`].find(e=>this.#i(e));if(n===void 0){if(t.kind===`query`)return{kind:`exists`,query:t.query};if(t.kind===`function`){if(Jp[t.name]!==`logical`)throw new qp(`${t.name}() returns a value; compare it instead of testing it`,e);return{kind:`test`,call:t}}throw new qp(`A literal is not a test; compare it with something`,e)}this.#t+=n.length,this.#s();let r=this.#w();for(let n of[t,r])this.#C(n,e);return{kind:`compare`,op:n,left:t,right:r}}#x(){this.#o(`(`),this.#s();let e=this.#_();return this.#s(),this.#o(`)`),e}#S(e){let t=this.#t,n=this.#w();if(n.kind===`query`)return{kind:`exists`,query:n.query};if(n.kind===`function`&&Jp[n.name]===`logical`)return{kind:`test`,call:n};throw new qp(e?"`!` applies to a filter query or a logical function":`Expected a test`,t)}#C(e,t){if(e.kind===`query`&&!$p(e.query))throw new qp(`Only singular queries (names and indices) can be compared; use count() or length() for others`,t);if(e.kind===`function`&&Jp[e.name]!==`value`)throw new qp(`${e.name}() returns a logical value and cannot be compared`,t)}#w(){let e=this.#r();if(e===`$`||e===`@`)return{kind:`query`,query:this.#c()};if(e===`'`||e===`"`)return{kind:`literal`,value:this.#m()};if(/[-0-9]/.test(e))return{kind:`literal`,value:this.#T()};for(let[e,t]of[[`true`,!0],[`false`,!1],[`null`,null]])if(this.#i(e)&&!/[a-z0-9_]/.test(this.#r(e.length)))return this.#t+=e.length,{kind:`literal`,value:t};let t=/^[a-z][a-z0-9_]*/.exec(this.#e.slice(this.#t))?.[0];if(t!==void 0&&this.#r(t.length)===`(`)return this.#g(()=>this.#E(t));this.#a(`Expected a query, a literal or a function`)}#T(){let e=/^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][-+]?[0-9]+)?/.exec(this.#e.slice(this.#t));return e===null&&this.#a(`Expected a number`),this.#t+=e[0].length,Number(e[0])}#E(e){let t=this.#t;if(!Object.hasOwn(Jp,e))throw new qp(`Unknown function ${e}()`,t);let n=e;this.#t+=e.length,this.#o(`(`),this.#s();let r=[];if(this.#r()!==`)`)for(;r.push(this.#D()),this.#s(),this.#r()===`,`;)this.#t++,this.#s();this.#o(`)`);let i=Yp[n];if(r.length!==i.length)throw new qp(`${n}() takes ${i.length} argument(s)`,t);return r.forEach((e,r)=>{let a=i[r];if(!(a===`nodes`?e.kind===`query`:e.kind===`literal`||e.kind===`query`&&$p(e.query)||e.kind===`function`&&Jp[e.name]===`value`))throw new qp(`Argument ${r+1} of ${n}() must be ${a===`nodes`?`a query`:`a value (a literal, a singular query or a value function)`}`,t)}),{kind:`function`,name:n,args:r}}#D(){let e=this.#t,t=this.#r();if(t===`!`||t===`(`)return{kind:`logical`,expression:this.#_()};let n=this.#w();return this.#s(),/^(==|!=|<=|>=|<|>|&&|\|\|)/.test(this.#e.slice(this.#t))?(this.#t=e,{kind:`logical`,expression:this.#_()}):n}};function $p(e){return e.segments.every(e=>!e.descendant&&e.selectors.length===1&&(e.selectors[0]?.kind===`name`||e.selectors[0]?.kind===`index`))}function em(e){return new Qp(e).parse()}var tm=Symbol(`Nothing`);function nm(e){let t=[];for(let n of e)t.push(n);return t}function rm(e){let{value:t,path:n}=e;return Array.isArray(t)?t.map((e,t)=>({value:e,path:[...n,t]})):E(t)?Object.keys(t).map(e=>({value:t[e],path:[...n,e]})):[]}function im(e){let t=[],n=[e];for(let e=n.pop();e!==void 0;e=n.pop()){t.push(e);let r=rm(e);for(let e=r.length-1;e>=0;e--){let t=r[e];t!==void 0&&n.push(t)}}return t}function am(e,t){return e>=0?e:t+e}function om(e,t,n){let{value:r,path:i}=t;switch(e.kind){case`name`:return E(r)&&Object.hasOwn(r,e.name)?[{value:r[e.name],path:[...i,e.name]}]:[];case`wildcard`:return rm(t);case`index`:{if(!Array.isArray(r))return[];let t=am(e.index,r.length);return t>=0&&t<r.length?[{value:r[t],path:[...i,t]}]:[]}case`slice`:{if(!Array.isArray(r))return[];let t=r.length,n=e.step??1;if(n===0)return[];let a=am(e.start??(n>0?0:t-1),t),o=am(e.end??(n>0?t:-t-1),t),s=(e,t,n)=>Math.min(Math.max(e,t),n),c=[];if(n>0){let e=s(o,0,t);for(let o=s(a,0,t);o<e;o+=n)c.push({value:r[o],path:[...i,o]})}else{let e=s(o,-1,t-1);for(let o=s(a,-1,t-1);e<o;o+=n)c.push({value:r[o],path:[...i,o]})}return c}case`filter`:return rm(t).filter(t=>cm(e.expression,t.value,n))}}function sm(e,t,n){let r=[{value:e.root===`$`?n:t,path:[]}];for(let t of e.segments)r=(t.descendant?r.flatMap(im):r).flatMap(e=>t.selectors.flatMap(t=>om(t,e,n)));return r}function cm(e,t,n){switch(e.kind){case`or`:return e.operands.some(e=>cm(e,t,n));case`and`:return e.operands.every(e=>cm(e,t,n));case`not`:return!cm(e.operand,t,n);case`exists`:return sm(e.query,t,n).length>0;case`test`:return dm(e.call,t,n)===!0;case`compare`:return wm(e.op,lm(e.left,t,n),lm(e.right,t,n))}}function lm(e,t,n){if(e.kind===`literal`)return e.value;if(e.kind===`function`)return dm(e,t,n);let r=sm(e.query,t,n);return r.length===1?r[0]?.value:tm}function um(e,t,n){switch(e.kind){case`literal`:return e.value;case`function`:return dm(e,t,n);case`logical`:return cm(e.expression,t,n);case`query`:{let r=sm(e.query,t,n);return r.length===1?r[0]?.value:tm}}}function dm(e,t,n){let r=r=>{let i=e.args[r];return i?.kind===`query`?sm(i.query,t,n):[]},i=r=>{let i=e.args[r];return i===void 0?tm:um(i,t,n)};switch(e.name){case`length`:{let e=i(0);return typeof e==`string`?nm(e).length:Array.isArray(e)?e.length:E(e)?Object.keys(e).length:tm}case`count`:return r(0).length;case`value`:{let e=r(0);return e.length===1?e[0]?.value:tm}case`match`:case`search`:{let t=i(0),n=i(1);if(typeof t!=`string`||typeof n!=`string`)return!1;let r=mm(n,e.name===`match`);return r!==void 0&&r.test(t)}}}var fm=/* @__PURE__ */ new Map,pm=1e3;function mm(e,t){let n=`${t?`m`:`s`}:${e}`;if(fm.has(n))return fm.get(n);let r=ym(e),i;try{i=r===void 0?void 0:new RegExp(t?`^(?:${r})$`:r,`u`)}catch{i=void 0}return fm.size>=pm&&fm.clear(),fm.set(n,i),i}var hm=/* @__PURE__ */ new Set(`()*+-.?[\\]^nrt{|}`),gm=/^\\[pP]\{(?:L[lmotu]?|M[cen]?|N[dlo]?|P[c-fios]?|Z[lps]?|S[ckmo]?|C[cfno]?)\}/,_m=/^\{[0-9]+(?:,[0-9]*)?\}/,vm=/* @__PURE__ */ new Set(`()*+.?[\\]{|}`);function ym(e){let t=``,n=0,r=!1,i=0;for(;i<e.length;){let a=e[i]??``,o=e.codePointAt(i)??0;if(o>=55296&&o<=57343)return;if(a===`(`)n++,t+=`(`,r=!1,i++;else if(a===`)`){if(n===0)return;n--,t+=`)`,r=!0,i++}else if(a===`|`)t+=`|`,r=!1,i++;else if(a===`*`||a===`+`||a===`?`){if(!r)return;t+=a,r=!1,i++}else if(a===`{`){let n=_m.exec(e.slice(i))?.[0];if(!r||n===void 0)return;t+=n,r=!1,i+=n.length}else if(a===`.`)t+=`[^\\n\\r]`,r=!0,i++;else if(a===`\\`){let n=bm(e,i);if(n===void 0)return;t+=n.text===`\\-`?`-`:n.text,r=!0,i+=n.length}else if(a===`[`){let n=xm(e,i);if(n===void 0)return;t+=n.text,r=!0,i+=n.length}else{if(vm.has(a))return;{let e=String.fromCodePoint(o);t+=e,r=!0,i+=e.length}}}return n===0?t:void 0}function bm(e,t){let n=e[t+1]??``;if(n===`p`||n===`P`){let n=gm.exec(e.slice(t))?.[0];return n===void 0?void 0:{text:n,length:n.length}}return hm.has(n)?{text:`\\${n}`,length:2}:void 0}function xm(e,t){let n=t+1,r=`[`;e[n]===`^`&&(r+=`^`,n++);let i=()=>{let t=e[n]??``;if(t===`\\`){let t=bm(e,n);return t===void 0||t.text.length!==2?void 0:(n+=2,t.text)}let r=e.codePointAt(n);if(r===void 0||t===`-`||t===`[`||t===`]`||r>=55296&&r<=57343)return;let i=String.fromCodePoint(r);return n+=i.length,i},a=0;for(;;){let o=e[n];if(o===void 0)return;if(o===`]`)return a===0?void 0:{text:`${r}]`,length:n+1-t};if(o===`-`){if(a>0&&e[n+1]!==`]`)return;r+=`\\-`,n++}else if(o===`\\`&&(e[n+1]===`p`||e[n+1]===`P`)){let t=bm(e,n);if(t===void 0)return;r+=t.text,n+=t.length}else{let t=i();if(t===void 0)return;if(r+=t,e[n]===`-`&&e[n+1]!==`]`){n++;let e=i();if(e===void 0)return;r+=`-${e}`}}a++}}function Sm(e,t){if(e===t)return!0;if(Array.isArray(e)&&Array.isArray(t))return e.length===t.length&&e.every((e,n)=>Sm(e,t[n]));if(E(e)&&E(t)){let n=Object.keys(e);return n.length===Object.keys(t).length&&n.every(n=>Object.hasOwn(t,n)&&Sm(e[n],t[n]))}return!1}function Cm(e,t){let n=nm(e),r=nm(t);for(let e=0;e<Math.min(n.length,r.length);e++){let t=n[e]?.codePointAt(0)??0,i=r[e]?.codePointAt(0)??0;if(t!==i)return t<i}return n.length<r.length}function wm(e,t,n){let r=()=>t===tm||n===tm?t===n:Sm(t,n),i=(e,t)=>typeof e==`number`&&typeof t==`number`?e<t:typeof e==`string`&&typeof t==`string`&&Cm(e,t);switch(e){case`==`:return r();case`!=`:return!r();case`<`:return i(t,n);case`<=`:return i(t,n)||r();case`>`:return i(n,t);case`>=`:return i(n,t)||r()}}function Tm(e,t){return sm(typeof t==`string`?em(t):t,e,e)}function Em(e){let t={"\b":`\\b`,"\f":`\\f`,"\n":`\\n`,"\r":`\\r`,"	":`\\t`,"'":`\\'`,"\\":`\\\\`},n=e=>nm(e).map(e=>t[e]??(e<` `?`\\u${e.charCodeAt(0).toString(16).padStart(4,`0`)}`:e)).join(``);return`$${e.map(e=>typeof e==`number`?`[${e}]`:`['${n(e)}']`).join(``)}`}var Dm=class extends Error{line;column;constructor(e,t){super(e),this.name=`DocumentParseError`,t!==void 0&&(this.line=t.line,this.column=t.column)}},Om=1e3,km=1e6;function Am(e,t){let n=t?.toLowerCase()??``;if(n.endsWith(`.json`)||n.includes(`application/json`))return`json`;if(/\.ya?ml$/.test(n)||n.includes(`yaml`))return`yaml`;let r=e.trimStart()[0];return r===`{`||r===`[`?`json`:`yaml`}function jm(e,t){let n=1,r=0;for(let i=0;i<t&&i<e.length;i++)e.charCodeAt(i)===10&&(n++,r=i+1);return{line:n,column:t-r+1}}var Mm=`the document nests arrays and objects more than ${Om} levels deep.`;function Nm(e,t){if(t===`json`){let t;try{t=JSON.parse(e)}catch(t){let n=t instanceof Error?t.message:String(t),r=/position (\d+)/.exec(n),i=r?.[1]===void 0?void 0:jm(e,Number(r[1]));throw new Dm(`Invalid JSON: ${n}`,i)}if(Pm(t))throw new Dm(`Invalid JSON: ${Mm}`);return t}return Fm(e)}function Pm(e){let t=[[e,1]];for(let e=t.pop();e!==void 0;e=t.pop()){let[n,r]=e;if(typeof n==`object`&&n){if(r>Om)return!0;for(let e of Array.isArray(n)?n:Object.values(n))typeof e==`object`&&e&&t.push([e,r+1])}}return!1}function Fm(e){let t=new $i,n;try{n=la(e,{schema:`core`,merge:!0,uniqueKeys:!1,prettyErrors:!0,lineCounter:t})}catch(e){throw new Dm(`Invalid YAML: ${e instanceof RangeError?Mm:e instanceof Error?e.message:String(e)}`)}let[r]=n.errors;if(r!==void 0){let e=r.linePos?.[0];throw new Dm(`Invalid YAML: ${r.message.startsWith(`Maximum call stack size exceeded`)?Mm:r.message.split(`
`)[0]??r.message}`,e===void 0?void 0:{line:e.line,column:e.col})}return new Im(t,Math.max(km,e.length)).convert(n.contents)}var Im=class{#e;#t=/* @__PURE__ */ new Map;#n=/* @__PURE__ */ new WeakMap;#r=/* @__PURE__ */ new Set;#i=[];#a;#o;constructor(e,t){this.#e=e,this.#a=t,this.#o=t}convert(e){let t=null;this.#u({node:e,expanded:!1},0,e=>{t=e});for(let e=this.#i.at(-1);e!==void 0;e=this.#i.at(-1))e.kind===`seq`?this.#f(e):this.#p(e);return t}#s(e,t){let n=zm(t),r=n===void 0?void 0:this.#e.linePos(n);throw new Dm(`Invalid YAML: ${e}`,r===void 0?void 0:{line:r.line,column:r.col})}#c(e){let{node:t,expanded:n}=e;if(!Dt(t))return!n&&Rm(t)&&this.#t.set(t.anchor,t),e;let r=this.#n.get(t);return r===void 0&&(r=this.#t.get(t.source),r===void 0&&this.#s(`unresolved alias *${t.source}.`,t),this.#n.set(t,r)),typeof r==`object`&&r&&this.#r.has(r)&&this.#s(`the alias *${t.source} refers to a node that contains it.`,t),{node:r,expanded:!0}}#l(e,t){e.expanded&&(this.#o--,this.#o<0&&this.#s(`aliases and merge keys add more than ${this.#a} values to the document.`,t))}#u(e,t,n){let r=this.#c(e);this.#l(r,e.node);let{node:i,expanded:a}=r;if(i==null){n(null);return}if(j(i)){n(Lm(i.value,i.source));return}let o=t+1;o>Om&&this.#s(Mm,i),kt(i)||A(i)?(this.#r.add(i),this.#i.push({kind:`map`,node:i,pairs:A(i)?[i]:i.items,target:{},keys:/* @__PURE__ */ new Set,sources:[],depth:o,expanded:a,assign:n,index:0})):At(i)?(this.#r.add(i),this.#i.push({kind:`seq`,node:i,items:i.items,target:[],depth:o,expanded:a,assign:n,index:0})):this.#s(`unsupported node.`,e.node)}#d(e){this.#i.pop(),this.#r.delete(e.node),e.assign(e.target)}#f(e){if(e.index>=e.items.length){this.#d(e);return}let t=e.items[e.index++],n=e.target.push(null)-1;this.#u({node:t,expanded:e.expanded},e.depth,t=>{e.target[n]=t})}#p(e){let t=e.sources.shift();if(t!==void 0){this.#m(e,t);return}if(e.index>=e.pairs.length){this.#d(e);return}let n=e.pairs[e.index++];A(n)||this.#s(`unsupported map entry.`,e.node);let r={node:n.key,expanded:e.expanded};if(j(n.key)&&typeof n.key.value==`symbol`){let t=this.#c({node:n.value,expanded:e.expanded});this.#l(t,n.value),e.sources=At(t.node)?t.node.items.map(e=>({node:e,expanded:t.expanded})):[{node:n.value,expanded:e.expanded}];return}let i=this.#h(r);e.keys.has(i)&&this.#s(`map keys must be unique; "${i}" is repeated.`,n.key),e.keys.add(i),D(e.target,i,null),this.#u({node:n.value,expanded:e.expanded},e.depth,t=>{D(e.target,i,t)})}#m(e,t){kt(this.#c(t).node)||this.#s(`merge keys (<<) take a map, an alias of a map or a sequence of them.`,t.node),this.#u(t,e.depth-1,t=>{if(typeof t==`object`&&t)for(let[n,r]of Object.entries(t))Object.hasOwn(e.target,n)||D(e.target,n,r)})}#h(e){if(e.node===null||e.node===void 0)return``;let{node:t}=this.#c(e);j(t)||this.#s(`map keys must be strings, numbers, booleans or null.`,e.node);let n=Lm(t.value,t.source);return n===null?``:String(n)}};function Lm(e,t){return e===null||typeof e==`string`||typeof e==`number`||typeof e==`boolean`?e:typeof e==`bigint`?Number(e):t??``}function Rm(e){return typeof e==`object`&&!!e&&`anchor`in e&&typeof e.anchor==`string`&&e.anchor!==``}function zm(e){if(Dt(e)||j(e)||kt(e)||At(e))return e.range?.[0]}var Bm=2;async function Vm(e,t){let n=structuredClone(e),r=t.shifted??/* @__PURE__ */ new WeakSet;for(let e of t.overlays){let i=await Hm(e,t);i!==void 0&&(n=new Gm(i,t.diagnostics,r).apply(n))}return n}async function Hm(e,t){let n=/^https?:\/\//i.test(e);try{let r,i;if(n){let n=await Wp(new URL(e),{...t.fetch,credentialOrigin:t.credentialOrigin,checkRedirect:e=>e.protocol===`https:`||e.protocol===`http:`?void 0:`unsupported protocol`});r=n.text,i=`${n.contentType} ${n.url.pathname}`}else r=await zp(e,`utf8`),i=e;r.charCodeAt(0)===65279&&(r=r.slice(1));let a=Am(r,i),o=Nm(r,a);return{url:n?e:ie(e).href,display:n?e:m.basename(e),location:e,format:a,text:r,data:o}}catch(n){t.diagnostics.add(Um(n,e));return}}function Um(e,t){return e instanceof Dm?{code:`overlay/load-failed`,severity:`error`,message:`Overlay ${t} could not be parsed: ${e.message}`,location:{file:t,...e.line===void 0?{}:{line:e.line},...e.column===void 0?{}:{column:e.column}}}:{code:`overlay/load-failed`,severity:`error`,message:E(e)&&e.code===`ENOENT`?`Overlay not found: ${t}`:`Overlay ${t} could not be read: ${e instanceof Error?e.message:String(e)}`,location:{file:t},hint:`spec.overlays paths are relative to the config file.`}}var Wm=class extends Error{},Gm=class{#e;#t;#n;constructor(e,t,n){this.#e=e,this.#t=t,this.#n=n}#r(e,t,n,r,i){let a=ba(this.#e,r);this.#t.add({code:t,severity:e,message:n,location:{file:this.#e.location,pointer:r,...a===void 0?{}:a},...i===void 0?{}:{hint:i}})}apply(e){let t=this.#e.data,n=this.#e.display;if(!E(t))return this.#r(`error`,`overlay/invalid`,`Overlay ${n} is not an object.`,``),e;let r=typeof t.overlay==`string`?/^(\d+)\.(\d+)\.\d+/.exec(t.overlay):null;if(r===null)return this.#r(`error`,`overlay/unsupported-version`,`Overlay ${n} has no valid \`overlay\` version (e.g. "1.1.0").`,`/overlay`),e;if(r[1]!==`1`)return this.#r(`error`,`overlay/unsupported-version`,`Overlay ${n} uses Overlay Specification ${String(t.overlay)}; versions 1.0 to 1.${Bm} are supported.`,`/overlay`),e;Number(r[2])>Bm&&this.#r(`warning`,`overlay/unsupported-version`,`Overlay ${n} uses Overlay Specification ${String(t.overlay)}, newer than the supported 1.${Bm}; it is applied with the 1.${Bm} rules.`,`/overlay`),(!E(t.info)||typeof t.info.title!=`string`)&&this.#r(`warning`,`overlay/invalid`,`Overlay ${n} has no \`info\` object with a \`title\` and \`version\`.`,`/info`);let i=t.actions;if(!Array.isArray(i)||i.length===0)return this.#r(`error`,`overlay/invalid`,`Overlay ${n} needs a non-empty \`actions\` array.`,`/actions`),e;let a=E(t.components)&&E(t.components.actions)?t.components.actions:{},o={root:e},s=0;return i.forEach((e,t)=>{this.#i(e,`/actions/${t}`,o,a)&&s++}),this.#r(`info`,`overlay/applied`,`Applied ${s} of ${i.length} overlay action${i.length===1?``:`s`} from ${n}.`,`/actions`),o.root}#i(e,t,n,r){if(!E(e))return this.#r(`error`,`overlay/invalid`,`An overlay action must be an object.`,t),!1;let i=this.#o(e,t,r);if(i===void 0)return!1;if(typeof i.target!=`string`)return this.#r(`error`,`overlay/invalid`,"An overlay action needs a `target` JSONPath.",`${t}/target`),!1;let a=this.#s(n.root,i.target,`${t}/target`);if(a===void 0)return!1;if(a.length===0)return this.#r(`warning`,`overlay/no-match`,`Overlay target ${i.target} matches nothing; the action changes nothing.`,`${t}/target`,`The specification may have changed since the overlay was written.`),!1;if(i.remove===!0)return a.some(e=>e.path.length===0)?(this.#r(`error`,`overlay/invalid`,"An overlay action cannot remove the whole document (`$`).",`${t}/target`),!1):(this.#a(n,a),!0);let o,s;if(i.update!==void 0)o=i.update,s=`${t}/update`;else if(typeof i.copy==`string`){let e=this.#s(n.root,i.copy,`${t}/copy`);if(e===void 0)return!1;if(e.length!==1)return this.#r(`error`,`overlay/invalid-copy`,`Overlay copy source ${i.copy} must select exactly one node; it selects ${e.length}.`,`${t}/copy`),!1;o=e[0]?.value,s=`${t}/copy`}else return this.#r(`warning`,`overlay/invalid`,"This overlay action has no `update`, `copy` or `remove: true`; it changes nothing.",t),!1;try{for(let e of Km(n,a))Zm(n,e,structuredClone(o))}catch(e){if(!(e instanceof Wm))throw e;return this.#r(`error`,`overlay/incompatible-update`,e.message,s),!1}return!0}#a(e,t){let n=/* @__PURE__ */ new Map;for(let r of t){let{parent:t,key:i}=Ym(e,r.path);if(!Array.isArray(t)&&!E(t))continue;let a=n.get(t)??/* @__PURE__ */ new Set;a.add(i),n.set(t,a)}for(let[e,t]of n)if(Array.isArray(e)){let n=[...t].filter(e=>typeof e==`number`).sort((e,t)=>t-e);for(let t of n)e.splice(t,1);n.length>0&&this.#n.add(e)}else if(E(e))for(let n of t)typeof n==`string`&&delete e[n]}#o(e,t,n){if(e.$ref===void 0)return e;let r=typeof e.$ref==`string`&&e.$ref.startsWith(`#`)?ma(e.$ref):void 0,i=r?.length===3&&r[0]===`components`&&r[1]===`actions`?r[2]:void 0,a=i===void 0||!Object.hasOwn(n,i)?void 0:n[i];if(!E(a)){this.#r(`error`,`overlay/invalid-reference`,`Overlay action reference ${JSON.stringify(e.$ref)} does not point to an entry of components.actions.`,`${t}/$ref`);return}let o=E(a.fields)?a.fields:{},s=Object.fromEntries(Object.entries(e).filter(([e])=>e!==`$ref`));return{...o,...s}}#s(e,t,n){try{let n=Tm(e,em(t)),r=/* @__PURE__ */ new Set;return n.filter(e=>{let t=Em(e.path);return!r.has(t)&&(r.add(t),!0)})}catch(e){if(!(e instanceof qp))throw e;this.#r(`error`,`overlay/invalid-target`,`Invalid JSONPath ${t}: ${e.message}`,n,`Overlays use RFC 9535 JSONPath: member names with special characters need brackets, e.g. $.paths['/pets'].`);return}}};function Km(e,t){let n=/* @__PURE__ */ new Set,r=/* @__PURE__ */ new Map;return t.filter(t=>{if(typeof t.value==`object`&&t.value!==null)return!n.has(t.value)&&(n.add(t.value),!0);let{parent:i,key:a}=Ym(e,t.path),o=r.get(i)??/* @__PURE__ */ new Set;return!o.has(a)&&(o.add(a),r.set(i,o),!0)})}var qm=e=>typeof e!=`object`||!e;function Jm(e,t,n){Object.defineProperty(e,t,{value:n,writable:!0,enumerable:!0,configurable:!0})}function Ym(e,t){let n=e,r=`root`;for(let e of t)n=Array.isArray(n)||E(n)?n[r]:void 0,r=e;return{parent:n,key:r}}function Xm(e){return e===null?`null`:Array.isArray(e)?`an array`:typeof e==`object`?`an object`:`a ${typeof e}`}function Zm(e,t,n){let r=t.value,i=Em(t.path);if(Array.isArray(r)){Array.isArray(n)?r.push(...n):r.push(n);return}if(E(r)){if(!E(n))throw new Wm(`${i} is an object; the update must be an object, not ${Xm(n)}.`);Qm(r,n,i);return}if(!qm(n))throw new Wm(`${i} is ${Xm(r)}; the update must be a primitive value, not ${Xm(n)}.`);let{parent:a,key:o}=Ym(e,t.path);Array.isArray(a)&&typeof o==`number`?a[o]=n:E(a)&&typeof o==`string`&&Jm(a,o,n)}function Qm(e,t,n){for(let[r,i]of Object.entries(t)){if(!Object.hasOwn(e,r)){Jm(e,r,i);continue}let t=e[r],a=`${n}${Em([r]).slice(1)}`;if(qm(t)&&qm(i))Jm(e,r,i);else if(Array.isArray(t)&&Array.isArray(i))t.push(...i);else if(E(t)&&E(i))Qm(t,i,a);else throw new Wm(`${a} is ${Xm(t)} and cannot be merged with ${Xm(i)}; remove it in an earlier action first.`)}}var $m=/* @__PURE__ */ new Set([`properties`,`patternProperties`,`dependentSchemas`,`$defs`,`definitions`,`schemas`,`responses`,`securitySchemes`,`securityDefinitions`,`paths`,`webhooks`,`callbacks`,`content`,`headers`,`encoding`,`links`,`requestBodies`,`pathItems`,`variables`,`mediaTypes`,`additionalOperations`,`parameters`]),eh=/* @__PURE__ */ new Set([`example`,`default`,`enum`,`const`]);function th(e,t={}){let n=[],r=[{node:e,pointer:``,mode:`keywords`}];for(;r.length>0;){let e=r.pop();if(e===void 0)break;let{node:i,pointer:a,mode:o}=e;if(Array.isArray(i)){if(o===`examples`)continue;i.forEach((e,t)=>{r.push({node:e,pointer:F(a,t),mode:o===`names`?`keywords`:o})})}else if(E(i)){if(o===`names`){for(let[e,t]of Object.entries(i))r.push({node:t,pointer:F(a,e),mode:`keywords`});continue}if(typeof i.$ref==`string`&&n.push({ref:i.$ref,pointer:a}),o!==`examples`)for(let[e,o]of Object.entries(i)){if(e===`$ref`||e.startsWith(`x-`)||eh.has(e))continue;let i=F(a,e);if(e===`examples`){if(E(o)&&t.swagger2!==!0)for(let[e,t]of Object.entries(o))r.push({node:t,pointer:F(i,e),mode:`examples`})}else if(e===`discriminator`&&E(o)){for(let[e,t]of Object.entries(E(o.mapping)?o.mapping:{}))typeof t==`string`&&nh(t)&&n.push({ref:t,pointer:F(i,`mapping`,e),mapping:!0});let e=o.defaultMapping;typeof e==`string`&&nh(e)&&n.push({ref:e,pointer:F(i,`defaultMapping`),mapping:!0})}else r.push({node:o,pointer:i,mode:$m.has(e)?`names`:`keywords`})}}}return n.reverse()}function nh(e){return e.includes(`#`)||e.includes(`/`)||/\.(ya?ml|json)$/i.test(e)}function rh(e,t,n){return{...e.fetch,credentialOrigin:n.isRoot&&!(`origin`in n)?t.origin:n.origin,checkRedirect:r=>{if(r.protocol!==`https:`&&r.protocol!==`http:`)return`unsupported protocol`;if(!(n.isRoot||r.origin===t.origin))return lh(r.hostname,e.policy.allowedHosts)?void 0:`host not allowed`}}}var ih=32;async function ah(e,t,n){let r=[],i=0;return await Promise.all(Array.from({length:Math.min(t,e.length)},async()=>{for(;i<e.length;){let t=i++;r[t]=await n(e[t])}})),r}var oh=e=>{let t=new URL(e.href);return t.hash=``,t.href},sh=class{#e;#t=/* @__PURE__ */ new Map;#n=/* @__PURE__ */ new Set;#r=/* @__PURE__ */ new Map;#i=/* @__PURE__ */ new Map;#a=!1;#o=/* @__PURE__ */ new Map;#s=/* @__PURE__ */ new Map;#c=/* @__PURE__ */ new Map;#l=!1;#u=!1;#d=!1;#f;#p=``;#m;#h;constructor(e){this.#e=e}get root(){if(this.#f===void 0)throw Error(`Root document not loaded`);return this.#f}get documents(){return[...this.#t.values()]}byDisplay(e){return this.documents.find(t=>t.display===e)}byLocation(e){return this.documents.find(t=>t.location===e)}async loadRoot(e){let t=/^https?:\/\//i.test(e)?new URL(e):ie(m.resolve(e));this.#p=t.protocol===`file:`?m.dirname(w(t)):t.href,this.#m=t.protocol===`file:`?void 0:t.origin;try{let e=await this.#T(t,!0);return this.#f=e,this.#t.set(e.url,e),e}catch(n){throw new Pp(`Unable to load specification ${e}`,[fh(n,t.protocol===`file:`?w(t):t.href)])}}enableSchemaIds(){this.#l=!0,this.#i.clear(),this.#a=!1,this.#o.clear(),this.#r.clear()}enableSwagger2(){this.#d=!0}enableSelf(){this.#u=!0;for(let e of this.documents)this.#g(e)}#g(e){if(this.#u&&E(e.data)&&typeof e.data.$self==`string`)try{let t=oh(new URL(e.data.$self,e.url));this.#s.set(e.url,t),this.#c.has(t)||this.#c.set(t,e)}catch{}}#_(e){return this.#s.get(e.url)??e.url}#v(e){return this.#t.get(e)??this.#c.get(e)}#y(e,t){let n=this.#s.get(t.url);if(n===void 0)return e;let r=new URL(`.`,n).href;return e.href.startsWith(r)?new URL(e.href.slice(r.length),new URL(`.`,t.url)):e}replaceRootData(e,t){let n=this.root,r={...n,data:e,...t===void 0?{}:{shifted:t}};this.#f=r,this.#t.set(n.url,r),this.#r.delete(n.url),this.#o.delete(n.url),this.#i.clear(),this.#a=!1}async loadReferencedDocuments(){let e=this.#e.maxDocuments,t=[this.root],n=!1;for(;t.length>0;){let r=/* @__PURE__ */ new Map;for(let e of t)for(let t of th(e.data,{swagger2:this.#d})){let n=this.#b(t.ref,e,t.pointer);if(n===void 0)continue;let i=oh(n);i===e.url||this.#v(i)!==void 0||this.#n.has(i)||this.#j(i)===void 0&&(r.has(i)||r.set(i,{from:e,pointer:t.pointer,target:n}))}let i=[...r.entries()].sort(([e],[t])=>e<t?-1:+(e>t)),a=Math.max(0,e-this.#t.size);for(let[t,r]of i.slice(a))this.#n.add(t),!n&&(n=!0,this.#e.diagnostics.error({code:`ref/too-many-documents`,message:`Reference resolution stopped after loading ${e} documents; ${i.length-a} more ${i.length-a===1?`is`:`are`} referenced at this depth alone.`,location:{file:r.from.location,pointer:r.pointer},hint:`Raise spec.refs.maxDocuments if the description really consists of that many files.`}));let o=await ah(i.slice(0,a),ih,async([e,t])=>{let n=await this.#S(t.target,t.from,t.pointer);return n===void 0?void 0:{docUrl:e,document:n}}),s=[];for(let e of o){if(e===void 0)continue;let{docUrl:t,document:n}=e,r=this.#t.get(n.url);r===void 0?(this.#t.set(n.url,n),t!==n.url&&this.#c.set(t,n),this.#g(n),this.#A(n),s.push(n)):this.#c.set(t,r)}t=s}for(let e of this.documents)for(let t of th(e.data,{swagger2:this.#d}))t.mapping!==!0&&this.resolve(t.ref,e,t.pointer)}resolve(e,t,n){let r=this.#b(e,t,n);if(r===void 0)return;let i=oh(r),a=i===t.url?t:this.#v(i),o=``;if(a===void 0){let e=this.#j(i);e!==void 0&&(a=e.doc,o=e.pointer)}if(a===void 0){this.#n.has(i)||this.#e.diagnostics.error({code:`ref/unresolved`,message:`Cannot resolve $ref "${e}": document ${i} was not loaded.`,location:{file:t.location,pointer:n}});return}let s=r.hash.startsWith(`#`)?r.hash.slice(1):r.hash,c;if(s===``||s.startsWith(`/`)||s.startsWith(`%2F`)){let r=ma(s);if(r===void 0){this.#x(e,t,n,`the fragment is not a valid JSON pointer`);return}c=F(o,...r)}else{let r=pa(s);if(r===void 0){this.#x(e,t,n,`the fragment has a malformed percent-escape`);return}if(c=this.#D(a).get(`${o}#${r}`),c===void 0){this.#e.diagnostics.error({code:`ref/missing-target`,message:`$ref "${e}" points to anchor "${r}", which does not exist in ${o===``?a.display:`the schema resource at ${o} of ${a.display}`}.`,location:{file:t.location,pointer:n}});return}}let l=fa(c),u=l===void 0?{found:!1}:ha(a.data,l);if(!u.found)this.#e.diagnostics.error({code:`ref/missing-target`,message:`$ref "${e}" points to "${c||`/`}", which does not exist in ${a.display}.`,location:{file:t.location,pointer:n}});else return{doc:a,pointer:c,value:u.value}}documentKey(e){return e.url===this.root.url?``:e.display}#b(e,t,n){if(e.trim()===``)this.#x(e,t,n,`the reference is empty`);else try{return new URL(e,this.#k(t,n))}catch{this.#x(e,t,n,`the reference is not a valid URI`);return}}#x(e,t,n,r){this.#e.diagnostics.error({code:`ref/invalid`,message:`Invalid $ref "${e}": ${r}.`,location:{file:t.location,pointer:n}})}async#S(e,t,n){let r=this.#y(e,t),i=oh(r),a=await this.#C(r,t);if(a!==void 0)this.#n.add(i),this.#e.diagnostics.error({code:`ref/external-blocked`,message:`External reference to ${i} was blocked: ${a.reason}`,location:{file:t.location,pointer:n},hint:a.hint});else try{return await this.#T(new URL(i),!1)}catch(e){this.#n.add(i);let a=fh(e,r.protocol===`file:`?w(r):i);this.#e.diagnostics.add({...a,code:`ref/external-load-failed`,message:`Failed to load referenced document: ${a.message}`,location:a.location?.line===void 0?{file:t.location,pointer:n}:a.location});return}}async#C(e,t){let{policy:n}=this.#e;if(e.protocol!==`file:`&&e.protocol!==`http:`&&e.protocol!==`https:`)return{reason:`the ${e.protocol} protocol is not supported.`,hint:`Use a relative path or an http(s) URL.`};if(n.external===`none`)return{reason:`external references are disabled (spec.refs.external = "none").`,hint:`Set spec.refs.external to "local" or "remote" to allow external documents.`};let r=!t.url.startsWith(`file:`);if(e.protocol===`file:`){if(r)return{reason:`a remote document may not reference local files.`,hint:`Download the documents locally if they are trusted.`};let t=w(e),n;try{n=await Bp(t)}catch{n=m.resolve(t)}let i=await this.#w();return i.some(e=>n===e||n.startsWith(e+m.sep))?void 0:{reason:`${t} is outside the allowed directories.`,hint:`Add its directory to spec.refs.allowedDirectories (currently: ${i.join(`, `)}).`}}if(e.origin!==this.#m&&e.origin!==ch(this.root)){if(n.external!==`remote`)return{reason:`remote references are disabled (spec.refs.external = "local").`,hint:`Set spec.refs.external to "remote" and add "${e.host}" to spec.refs.allowedHosts.`};if(!lh(e.hostname,n.allowedHosts))return{reason:`host "${e.hostname}" is not in spec.refs.allowedHosts.`,hint:`Add "${e.hostname}" to spec.refs.allowedHosts if it is trusted.`}}}async#w(){return this.#h===void 0&&(this.#h=await Promise.all(this.#e.policy.allowedDirectories.map(async e=>{try{return await Bp(e)}catch{return m.resolve(e)}}))),this.#h}async#T(e,t){let n,r,i=e,a;if(e.protocol===`file:`){let t=w(e);n=await zp(t,`utf8`),r=t}else{let o=await Wp(e,this.fetchOptions(e,t));n=o.text,r=`${o.contentType} ${o.url.pathname}`,i=o.url,a=o.validators}n.charCodeAt(0)===65279&&(n=n.slice(1));let o=Am(n,r),s=Nm(n,o),c=oh(i),l=i.protocol===`file:`?w(i):c;return{url:c,display:this.#E(i),location:l,format:o,text:n,data:s,...a===void 0?{}:{validators:a}}}fetchOptions(e,t=this.#f===void 0||oh(e)===this.#f.url){let n=this.#m;return rh(this.#e,e,t?{isRoot:!0,origin:n}:{isRoot:!1,origin:n})}#E(e){return e.protocol===`file:`&&!this.#p.includes(`://`)?m.relative(this.#p,w(e)).split(m.sep).join(`/`):oh(e)}#D(e){let t=this.#r.get(e.url);if(t!==void 0)return t;let n=/* @__PURE__ */ new Map,r=/* @__PURE__ */ new Map,i=this.#l?this.#O(e):void 0;dh(e.data,``,(t,a,o)=>{let s=(i===void 0?typeof t.$id==`string`&&URL.canParse(t.$id,e.url):i.has(a))?a:o;return typeof t.$anchor==`string`&&n.set(`${s}#${t.$anchor}`,a),typeof t.$dynamicAnchor==`string`&&r.set(`${s}#${t.$dynamicAnchor}`,a),s});for(let[e,t]of r)n.has(e)||n.set(e,t);return t=n,this.#r.set(e.url,t),t}#O(e){let t=this.#o.get(e.url);if(t!==void 0)return t;let n=/* @__PURE__ */ new Map;return dh(e.data,this.#_(e),(e,t,r)=>{if(typeof e.$id!=`string`)return r;try{let i=new URL(e.$id,r).href;return n.set(t,i),i}catch{return r}}),t=n,this.#o.set(e.url,t),t}#k(e,t){if(!this.#l)return this.#_(e);let n=this.#O(e);for(let r=t;;r=r.slice(0,r.lastIndexOf(`/`))){let t=n.get(r);if(t!==void 0)return t;if(r===``)return this.#_(e)}}#A(e){if(this.#l)for(let[t,n]of this.#O(e)){let r=oh(new URL(n));this.#i.has(r)||this.#i.set(r,{doc:e,pointer:t})}else dh(e.data,void 0,(t,n)=>{if(typeof t.$id==`string`)try{let r=oh(new URL(t.$id,e.url));this.#i.has(r)||this.#i.set(r,{doc:e,pointer:n})}catch{}})}#j(e){return!this.#a&&this.#f!==void 0&&(this.#a=!0,this.#A(this.#f)),this.#i.get(e)}};function ch(e){return e.url.startsWith(`file:`)?void 0:new URL(e.url).origin}function lh(e,t){return t.some(t=>t.startsWith(`*.`)?e.endsWith(t.slice(1)):e===t)}var uh=/* @__PURE__ */ new Set([`example`,`examples`,`default`,`enum`,`const`]);function dh(e,t,n){let r=[{node:e,pointer:``,state:t}];for(let e=r.pop();e!==void 0;e=r.pop()){let{node:t,pointer:i,state:a}=e,o=[],s=a;if(Array.isArray(t))t.forEach((e,t)=>o.push([t,e]));else if(E(t)){s=n(t,i,a);for(let[e,n]of Object.entries(t))uh.has(e)||o.push([e,n])}for(let e=o.length-1;e>=0;e--){let[t,n]=o[e]??[0,void 0];typeof n==`object`&&n&&r.push({node:n,pointer:F(i,t),state:s})}}}function fh(e,t){return e instanceof Dm?{code:`spec/parse-error`,severity:`error`,message:e.message,location:{file:t,...e.line===void 0?{}:{line:e.line},...e.column===void 0?{}:{column:e.column}}}:{code:`spec/load-failed`,severity:`error`,message:(E(e)&&typeof e.code==`string`?e.code:void 0)===`ENOENT`?`File not found: ${t}`:`Could not read ${t}: ${e instanceof Error?e.message:String(e)}`,location:{file:t}}}function J(e,...t){let n=e.value;for(let e of t)n=Array.isArray(n)&&typeof e==`number`?n[e]:E(n)&&Object.hasOwn(n,String(e))?n[String(e)]:void 0;return{doc:e.doc,pointer:F(e.pointer,...t),value:n}}function Y(e){return E(e.value)?Object.keys(e.value).map(t=>[t,J(e,t)]):[]}function ph(e){return E(e.value)?Object.keys(e.value):[]}function mh(e){return Array.isArray(e.value)?e.value.map((t,n)=>J(e,n)):[]}function X(e,t){let n=E(e.value)?e.value[t]:void 0;return typeof n==`string`?n:void 0}function Z(e,t){let n=E(e.value)?e.value[t]:void 0;return typeof n==`boolean`?n:void 0}function hh(e,t){let n=E(e.value)?e.value[t]:void 0;return typeof n==`number`&&Number.isFinite(n)?n:void 0}function Q(e,t){return E(e.value)&&Object.hasOwn(e.value,t)&&e.value[t]!==void 0}function gh(e){if(e===null||typeof e==`string`||typeof e==`boolean`)return e;if(typeof e==`number`)return Number.isFinite(e)?e:void 0;if(Array.isArray(e))return e.map(e=>gh(e)??null);if(E(e)){let t={};for(let[n,r]of Object.entries(e)){let e=gh(r);e!==void 0&&D(t,n,e)}return t}}function _h(e){if(!E(e.value))return{};let t={};for(let[n,r]of Object.entries(e.value)){if(!n.startsWith(`x-`))continue;let e=gh(r);e!==void 0&&D(t,n,e)}return t}var vh=64,yh=class{store;diagnostics;constructor(e,t){this.store=e,this.diagnostics=t}get root(){return{doc:this.store.root,pointer:``,value:this.store.root.data}}sources(){let e=this.store.root.display;return[e,...this.store.documents.map(e=>e.display).filter(t=>t!==e).sort()]}sourceRef(e){return{file:e.doc.display,pointer:e.pointer}}location(e){return{file:e.doc.location,pointer:e.pointer}}error(e,t,n,r={}){this.diagnostics.error({code:e,message:t,location:this.location(n),...r})}warning(e,t,n,r={}){this.diagnostics.warning({code:e,message:t,location:this.location(n),...r})}info(e,t,n,r={}){this.diagnostics.info({code:e,message:t,location:this.location(n),...r})}derefNonStandard(e,t){return!E(e.value)||typeof e.value.$ref!=`string`?e:(this.info(`spec/non-standard-ref`,`${t} cannot be a $ref according to the specification; the reference is followed.`,e),this.deref(e))}deref(e){let t=e,n=/* @__PURE__ */ new Set;for(let e=0;e<vh;e++){let e=t.value;if(!E(e)||typeof e.$ref!=`string`)return t;let r=`${t.doc.url}#${t.pointer}`;if(n.has(r)){this.error(`ref/circular`,`Circular $ref chain detected at "${e.$ref}".`,t);return}n.add(r);let i=this.store.resolve(e.$ref,t.doc,t.pointer);if(i===void 0)return;t={doc:i.doc,pointer:i.pointer,value:i.value}}this.error(`ref/too-deep`,`Reference chain is too deep.`,e)}};function bh(e,t){if(e===``||!/^https?:/i.test(t)||/^[a-z][a-z\d+.-]*:/i.test(e)||e.startsWith(`{`))return e;let n=[],r=e.replace(/\{[^{}]*\}/g,e=>`swaggerz${n.push(e)-1}var`),i;try{i=new URL(r,t).href}catch{return e}return i.replace(/swaggerz(\d+)var/g,(e,t)=>n[Number(t)]??``)}function xh(e,t,n){return`${e.toUpperCase()} ${t}${n===void 0?``:` (${n})`}`}function Sh(e,t){if(!E(t.value))return e.error(`spec/missing-field`,"The required `info` object is missing.",t),{title:`API`,version:`0.0.0`};let n=X(t,`title`),r=X(t,`version`);n===void 0&&e.warning(`spec/missing-field`,"`info.title` is required.",t);let i=r===void 0?hh(t,`version`):void 0;i===void 0?r===void 0&&e.warning(`spec/missing-field`,"`info.version` is required.",t):(r=String(i),e.warning(`spec/unquoted-version`,`\`info.version\` is the number ${r}; quote it to keep its exact text (for example '${r}').`,J(t,`version`)));let a=J(t,`contact`),o=J(t,`license`),s=E(a.value)?$({name:X(a,`name`),url:X(a,`url`),email:X(a,`email`)}):void 0,c=X(o,`name`),l=c===void 0?void 0:{name:c,...$({url:X(o,`url`),identifier:X(o,`identifier`)})};return{title:n??`API`,version:r??`0.0.0`,...$({summary:X(t,`summary`),description:X(t,`description`),termsOfService:X(t,`termsOfService`)}),...s===void 0?{}:{contact:s},...l===void 0?{}:{license:l}}}function Ch(e){let t=X(e,`url`);if(t===void 0)return;let n=X(e,`description`);return n===void 0?{url:t}:{url:t,description:n}}function wh(e,t=!1){return mh(e).map(e=>{let n=X(e,`name`);if(n===void 0)return;let r=Ch(J(e,`externalDocs`));return{name:n,...$({summary:t?X(e,`summary`):void 0,description:X(e,`description`)}),...r===void 0?{}:{externalDocs:r},...$({parent:t?X(e,`parent`):void 0,kind:t?X(e,`kind`):void 0})}}).filter(e=>e!==void 0)}function Th(e,t,n){let r=/* @__PURE__ */ new Map;for(let e of n)e.parent!==void 0&&r.set(e.name,e.parent);let i=new Set(n.map(e=>e.name)),a=e=>mh(t).find(t=>X(t,`name`)===e)??t;for(let t of n){let n=r.get(t.name);if(n===void 0)continue;if(!i.has(n)){e.warning(`spec/invalid-tag-parent`,`Tag "${t.name}" names parent "${n}", which is not declared; it is treated as a top-level tag.`,a(t.name)),r.delete(t.name);continue}let o=/* @__PURE__ */ new Set([t.name]);for(let n=r.get(t.name);n!==void 0;n=r.get(n)){if(o.has(n)){e.warning(`spec/invalid-tag-parent`,`Tag "${t.name}" is its own ancestor (${[...o,n].join(` → `)}); its parent is ignored.`,a(t.name)),r.delete(t.name);break}o.add(n)}}return n.map(e=>{if(e.parent===void 0||r.has(e.name))return e;let{parent:t,...n}=e;return n})}function Eh(e){return Array.isArray(e.value)?e.value.filter(e=>typeof e==`string`):[]}function Dh(e,t,n,r){if(t.value===void 0)return;if(!Array.isArray(t.value)){e.error(`spec/invalid-security`,"`security` must be an array of requirement objects.",t);return}let i=[];for(let a of mh(t)){if(!E(a.value))continue;let t={};for(let[i,o]of Y(a)){let a=n.has(i)?i:r?.(i,o)??i;n.has(a)?D(t,a,Eh(o)):e.warning(`security/unknown-scheme`,`Security requirement references unknown scheme "${a}"; it is ignored.`,o)}(Object.keys(t).length>0||Object.keys(a.value).length===0)&&i.push(t)}return i}function Oh(e,t){let n=[];for(let[r,i]of Y(t)){let t=e.deref(i);if(t===void 0||!E(t.value))continue;let a=gh(`dataValue`in t.value?t.value.dataValue:`value`in t.value?t.value.value:void 0);n.push({name:r,...$({summary:X(t,`summary`),description:X(t,`description`),serializedValue:X(t,`serializedValue`),externalValue:X(t,`externalValue`)}),...a===void 0?{}:{value:a}})}return n}function kh(e,t=`example`){if(!E(e.value)||!(t in e.value))return[];let n=gh(e.value[t]);return n===void 0?[]:[{value:n}]}var Ah=new Map(S.map((e,t)=>[e,t]));function jh(e){return Ah.has(e)}function Mh(e){let t=e=>Ah.get(e)??S.length;return e.sort((e,n)=>O(e.path,n.path)||t(e.method)-t(n.method)||O(e.method,n.method))}function Nh(e){return e==="default"||/^[1-5](\d\d|XX)$/i.test(e)}function Ph(e){return e==="default"?1e6:/^[1-5]XX$/i.test(e)?Number(e[0])*1e3+999:Number(e)*10}function Fh(e){return e.sort((e,t)=>Ph(e.status)-Ph(t.status))}function Ih(e){let t=e.split(`;`)[0]?.trim().toLowerCase()??``;return t===`application/octet-stream`||t===`application/pdf`||t===`application/zip`||t===`application/gzip`||/^(image|audio|video|font)\//.test(t)}function Lh(e){return[...e.matchAll(/\{([^}]+)\}/g)].map(e=>e[1]??``)}function $(e){let t={};for(let[n,r]of Object.entries(e))r!==void 0&&(t[n]=r);return t}var Rh=/* @__PURE__ */ new Set([`string`,`number`,`integer`,`boolean`,`array`,`object`,`null`]);function zh(e,t,n,r){if(!E(e.value)||!Q(e,`type`))return;let i=e.value.type,a=typeof i==`string`?[i]:Array.isArray(i)?i:void 0;if(a===void 0||!a.every(e=>typeof e==`string`))t.error(`schema/invalid-type`,"`type` must be a string or an array of strings.",e);else return Array.isArray(i)&&!r&&t.warning(`schema/type-array`,`Type arrays (${JSON.stringify(i)}) are not part of ${n}; they are interpreted as a union.`,e,{hint:`Use oneOf, or declare the document as OpenAPI 3.1.`}),a}function Bh(e,t,n,r){let i=E(e.value)?e.value:{},a={},o=!1;for(let[t,n]of[[`minimum`,`exclusiveMinimum`],[`maximum`,`exclusiveMaximum`]]){let s=hh(e,t),c=i[n];if(typeof c==`boolean`){o||=r===`number`,s!==void 0&&(a[c?n:t]=s);continue}s!==void 0&&(a[t]=s);let l=hh(e,n);l!==void 0&&(o||=r===`boolean`,a[n]=l)}let s=hh(e,`multipleOf`);return s!==void 0&&(a.multipleOf=s),o&&r===`number`?t.warning(`schema/exclusive-boolean`,`Boolean exclusiveMinimum/exclusiveMaximum are OpenAPI 3.0 syntax; in ${n} they are numbers.`,e):o&&t.warning(`schema/foreign-keyword`,`Numeric exclusiveMinimum/exclusiveMaximum are OpenAPI 3.1 syntax; in ${n} they are booleans. The number is used as an exclusive bound.`,e),Object.keys(a).length===0?void 0:a}function Vh(e){if(!Q(e,`example`))return;let t=gh(E(e.value)?e.value.example:void 0);return t===void 0?void 0:[t]}function Hh(e,t,n=!1){if(!E(e.value)||!Q(e,`discriminator`))return;let r={...e,pointer:F(e.pointer,`discriminator`),value:e.value.discriminator},i=X(r,`propertyName`);if(i===void 0){t.error(`schema/invalid-discriminator`,`discriminator.propertyName must be a string.`,r);return}let a=[],o=E(r.value)?r.value.mapping:void 0;if(E(o))for(let[e,t]of Object.entries(o))typeof t==`string`&&a.push({value:e,target:t,at:{doc:r.doc,pointer:F(r.pointer,`mapping`,e),value:t}});let s=n?X(r,`defaultMapping`):void 0;return{propertyName:i,mapping:a,...s===void 0?{}:{defaultMapping:{target:s,at:{doc:r.doc,pointer:F(r.pointer,`defaultMapping`),value:s}}},at:r}}var Uh=e=>/^text\//i.test(e)||/[/+]json$/i.test(e)||/[/+]xml$/i.test(e),Wh={name:`swagger2`,label:`Swagger 2.0`,refSiblings:`ignore`,booleanSchemas:!1,componentsPointer:`/definitions`,readTypes(e,t){return{types:zh(e,t,`Swagger 2.0`,!1),nullable:Z(e,`x-nullable`)===!0||Z(e,`nullable`)===!0}},readNumberConstraints:(e,t)=>Bh(e,t,`Swagger 2.0`,`boolean`),readExamples:Vh,isBinaryString:e=>X(e,`format`)===`binary`,readDiscriminator(e,t){if(!E(e.value)||!Q(e,`discriminator`))return;let n=e.value.discriminator,r={...e,pointer:F(e.pointer,`discriminator`),value:n};if(typeof n!=`string`)t.error(`schema/invalid-discriminator`,`In Swagger 2.0, discriminator must be a property name.`,r);else return{propertyName:n,mapping:[],at:r}},foreignKeywords:/* @__PURE__ */ new Set([`oneOf`,`anyOf`,`not`,`nullable`,`writeOnly`,`deprecated`,`const`])},Gh={name:`oas30`,label:`OpenAPI 3.0`,refSiblings:`ignore`,booleanSchemas:!1,componentsPointer:`/components/schemas`,readTypes(e,t){let n=zh(e,t,`OpenAPI 3.0`,!1);return n?.includes(`null`)===!0&&t.warning(`schema/null-type`,'The "null" type is not part of OpenAPI 3.0; use `nullable: true`.',e),{types:n,nullable:Z(e,`nullable`)===!0}},readNumberConstraints:(e,t)=>Bh(e,t,`OpenAPI 3.0`,`boolean`),readExamples:Vh,isBinaryString:e=>X(e,`format`)===`binary`,readDiscriminator:Hh,foreignKeywords:/* @__PURE__ */ new Set([`const`,`prefixItems`])};function Kh(e,t){return{name:`oas31`,label:e,refSiblings:`apply`,booleanSchemas:!0,componentsPointer:`/components/schemas`,readTypes(t,n){let r=zh(t,n,e,!0);if(Q(t,`nullable`)&&n.warning(`schema/nullable-31`,`\`nullable\` is not part of ${e} and is ignored.`,t,{hint:'Use `type: [<type>, "null"]` or `oneOf` with `{ type: "null" }`.'}),r===void 0)return{types:r,nullable:!1};let i=r.filter(e=>e!==`null`);return i.length===0?{types:[`null`],nullable:!1}:{types:i,nullable:i.length!==r.length}},readNumberConstraints:(t,n)=>Bh(t,n,e,`number`),readExamples(e){let t=E(e.value)?e.value.examples:void 0,n=Array.isArray(t)?t.map(e=>gh(e)??null):[],r=Vh(e)??[],i=[...n,...r];return i.length===0?void 0:i},isBinaryString(e){if(X(e,`format`)===`binary`)return!0;let t=X(e,`contentMediaType`);return t!==void 0&&X(e,`contentEncoding`)===void 0&&!Uh(t)},readDiscriminator:(e,n)=>Hh(e,n,t),foreignKeywords:/* @__PURE__ */ new Set}}var qh=Kh(`OpenAPI 3.1`,!1),Jh=Kh(`OpenAPI 3.2`,!0);function Yh(e){return Rh.has(e)}var Xh=[`propertyNames`,`contains`,`minContains`,`maxContains`,`unevaluatedItems`,`unevaluatedProperties`],Zh=[`$dynamicRef`,`$recursiveRef`],Qh=[`if`,`then`,`else`,`dependentSchemas`,`dependentRequired`],$h=[`minimum`,`maximum`,`exclusiveMinimum`,`exclusiveMaximum`,`multipleOf`],eg=[`minLength`,`maxLength`,`pattern`],tg=/* @__PURE__ */ new Set([`$ref`,`description`,`summary`,`title`,`deprecated`,`readOnly`,`writeOnly`,`example`,`examples`,`default`,`xml`,`$comment`,`$id`,`$anchor`,`$schema`]),ng=64,rg=512,ig=class{#e;#t;#n=/* @__PURE__ */ new Map;#r=[];#i=0;#a=0;#o=/* @__PURE__ */ new Set;#s=/* @__PURE__ */ new Set;constructor(e,t){this.#e=e,this.#t=t}get dialect(){return this.#t}registerComponent(e){this.#f(e)}convert(e){if(this.#i>=rg)return this.#i===rg&&this.#e.error(`schema/too-deep`,`Schema nesting exceeds ${rg} levels; deeper schemas are typed as unknown.`,e),{kind:`unknown`};this.#i++;try{return this.#c(e)}finally{this.#i--}}#c(e){let t=e.value;return typeof t==`boolean`?this.#t.booleanSchemas?t?{kind:`unknown`}:{kind:`never`}:(this.#e.error(`schema/invalid`,`Boolean schemas are not allowed in ${this.#t.label}.`,e),{kind:`unknown`}):E(t)?typeof t.$ref==`string`?this.#h(e,t.$ref):this.#v(e):(this.#e.error(`schema/invalid`,`Expected a schema object.`,e),{kind:`unknown`})}definitionForRef(e,t){let n=this.#e.store.resolve(e,t.doc,t.pointer);if(n!==void 0)return this.#f({doc:n.doc,pointer:n.pointer,value:n.value})}finalize(){this.#l(),this.#k();let e=[];for(let t of this.#n.values()){let n=[...t.names].sort((e,t)=>e.priority-t.priority||O(e.name,t.name)),r=n[0]?.name??`Schema`,i=[...new Set(n.filter(e=>e.priority<=1&&e.name!==r).map(e=>e.name))].sort(O);e.push({id:t.id,name:r,aliases:i,schema:t.schema??{kind:`unknown`},source:this.#e.sourceRef(t.cursor)})}return e.sort((e,t)=>O(e.id,t.id))}#l(){for(let e=0;e<this.#r.length;e++){let t=this.#r[e];if(t===void 0)continue;let{cursor:n}=t;t.schema={...this.convert(n),source:this.#e.sourceRef(n)};let r=E(n.value)&&!Q(n,`oneOf`)&&!Q(n,`anyOf`)?this.#t.readDiscriminator(n,this.#e):void 0;r!==void 0&&(t.baseDiscriminator=r)}this.#r.length=0}#u(e){return`${this.#e.store.documentKey(e.doc)}#${e.pointer}`}#d(e){return!E(e)||typeof e.$ref!=`string`?!1:Object.keys(e).every(e=>e===`$ref`||e===`description`||e===`summary`||e.startsWith(`x-`))}#f(e){let t=e,n=[],r=/* @__PURE__ */ new Set;for(let e=0;this.#d(t.value);e++){let i=this.#u(t);if(r.has(i)||e>ng){[...r].some(e=>this.#s.has(e))||this.#e.error(`ref/circular`,`Circular $ref chain: these schemas only refer to each other.`,t);for(let e of r)this.#s.add(e);return}r.add(i);let a=this.#p(t);a!==void 0&&n.push(a.priority===0?{...a,priority:1,alias:!0}:a);let o=this.#e.store.resolve(t.value.$ref,t.doc,t.pointer);if(o===void 0)return;t={doc:o.doc,pointer:o.pointer,value:o.value}}let i=this.#u(t),a=this.#n.get(i),o=a===void 0;if(a===void 0){a={id:i,cursor:t,names:[],schema:void 0},this.#n.set(i,a);let e=this.#p(t);e!==void 0&&a.names.push(e);let n=X(t,`title`);n!==void 0&&n.trim()!==``&&a.names.push({name:n,priority:4,alias:!1}),a.names.length===0&&a.names.push({name:this.#m(t),priority:5,alias:!1})}return a.names.push(...n),o&&this.#r.push(a),i}#p(e){let t=fa(e.pointer)??[],n=e.doc.url===this.#e.store.root.url,[r,i,a]=t;if(t.length===3&&r===`components`&&i===`schemas`&&a!==void 0)return{name:a,priority:n?0:2,alias:!1};if(t.length===2&&r===`definitions`&&i!==void 0)return{name:i,priority:n?0:2,alias:!1};if(t.length>=2&&t.at(-2)===`$defs`){let e=t.at(-1);if(e!==void 0)return{name:e,priority:3,alias:!1}}if(t.length===0&&!n){let t=X(e,`title`),n=m.basename(e.doc.display).replace(/\.(ya?ml|json)$/i,``);return{name:t??n,priority:t===void 0?4:3,alias:!1}}}#m(e){let t=/* @__PURE__ */ new Set([`components`,`schemas`,`definitions`,`$defs`,`properties`,`items`,`allOf`,`oneOf`,`anyOf`,`not`,`paths`,`content`,`schema`,`responses`,`parameters`,`requestBody`,`additionalProperties`]),n=(fa(e.pointer)??[]).filter(e=>!t.has(e)&&!/^\d+$/.test(e)),r=[...e.doc.url===this.#e.store.root.url?[]:[m.basename(e.doc.display).replace(/\.(ya?ml|json)$/i,``)],...n].join(` `);return r.trim()===``?`Schema`:r}#h(e,t){let n=this.definitionForRef(t,e),r=e.value,i=Object.keys(r).filter(e=>!tg.has(e)&&!e.startsWith(`x-`)),a;if(this.#t.refSiblings===`apply`)a=this.#g(e);else{let t=X(e,`description`);a=t===void 0?{}:{description:t},i.length>0&&this.#e.warning(`schema/ref-siblings-ignored`,`Keywords next to $ref are ignored in ${this.#t.label}: ${i.join(`, `)}.`,e,{hint:`Wrap the reference in allOf to combine it with other keywords.`})}let o=n===void 0?{kind:`unknown`}:{kind:`ref`,target:n};if(this.#t.refSiblings===`apply`&&i.length>0){let t=this.#v(e,{ignoreMeta:!0}),{nullable:n,...r}=t;return t.kind===`null`?{...o,...a,nullable:!0}:t.kind===`unknown`?{...o,...a,...n===!0?{nullable:n}:{}}:{kind:`intersection`,members:[o,r],...a,...n===!0?{nullable:n}:{}}}return{...o,...a}}#g(e){let t={},n=X(e,`title`);n!==void 0&&(t.title=n);let r=X(e,`description`);if(r!==void 0&&(t.description=r),(Z(e,`deprecated`)??Z(e,`x-deprecated`))===!0&&(t.deprecated=!0),Z(e,`readOnly`)===!0&&(t.readOnly=!0),Z(e,`writeOnly`)===!0&&(t.writeOnly=!0),Q(e,`default`)){let n=gh(e.value.default);n!==void 0&&(t.default=n)}let i=this.#t.readExamples(e);i!==void 0&&(t.examples=i);let a=X(e,`format`);a!==void 0&&(t.format=a);let o=ug(J(e,`xml`));o!==void 0&&(t.xml=o);let s=_h(e);return Object.keys(s).length>0&&(t.extensions=s),t}#_(e){if(!E(e.value))return;for(let t of this.#t.foreignKeywords)Q(e,t)&&this.#e.warning(`schema/foreign-keyword`,`\`${t}\` is not part of ${this.#t.label}; it is interpreted with its OpenAPI 3.x meaning.`,e);let t=this.#t.name===`oas31`,n=t?Zh:[...Zh,...Qh];for(let t of n)Q(e,t)&&this.#e.warning(`schema/unsupported-keyword`,`\`${t}\` is not supported and is ignored; the generated type may be wider than the schema.`,e);for(let n of[`not`,...t?Qh:[]])Q(e,n)&&this.#e.info(`schema/assertion-keyword`,`\`${n}\` cannot be expressed in TypeScript types (they may be wider than the schema); generated Zod schemas enforce it.`,e);for(let t of Xh)Q(e,t)&&this.#e.info(`schema/validation-only-keyword`,`\`${t}\` only affects validation and is not reflected in types.`,e)}#v(e,t={}){this.#_(e);let n=t.ignoreMeta===!0?{}:this.#g(e),{types:r,nullable:i}=this.#t.readTypes(e,this.#e),a=e.value,o;if(Q(e,`const`)){let e=gh(a.const);o={kind:`enum`,values:e===void 0?[]:[e],isConst:!0}}else if(Array.isArray(a.enum))o=this.#x(J(e,`enum`),r);else if(r===void 0){if(Q(e,`properties`)||Q(e,`additionalProperties`)||Q(e,`patternProperties`)||Q(e,`required`))o=this.#S(e,`object`);else if(Q(e,`items`)||Q(e,`prefixItems`))o=this.#S(e,`array`);else if(this.#t.name===`oas31`&&this.#t.isBinaryString(e))o={kind:`binary`};else if(this.#a>0){let t=$h.some(t=>Q(e,t));t!==eg.some(t=>Q(e,t))&&(o=this.#S(e,t?`number`:`string`))}}else o=r.length===1&&r[0]!==void 0?this.#S(e,r[0]):{kind:`union`,combinator:`type`,variants:r.map(t=>this.#S(e,t))};let s=[];Array.isArray(a.allOf)&&(a.allOf.length===0&&this.#e.warning(`schema/empty-composition`,"`allOf` is empty.",e),s.push(...mh(J(e,`allOf`)).map(e=>this.convert(e))));for(let t of[`oneOf`,`anyOf`]){let n=a[t];if(!Array.isArray(n))continue;if(n.length===0){this.#e.warning(`schema/empty-composition`,`\`${t}\` is empty.`,e);continue}let r=mh(J(e,t)).map(e=>this.convert(e)),i=r.filter(e=>e.kind===`null`),o=!1;i.length>0&&i.length<r.length&&(r=r.filter(e=>!i.includes(e)),o=!0);let c=this.#T(e,r),l=r.length===1&&r[0]!==void 0&&c===void 0?{...r[0],...o?{nullable:!0}:{}}:{kind:`union`,combinator:t,variants:r,...c===void 0?{}:{discriminator:c},...o?{nullable:!0}:{}};s.push(l)}let c;if(s.length===0)c=o??{kind:`unknown`};else{let e=o!==void 0&&!og(o)?[o,...s]:s;c=e.length===1&&e[0]!==void 0?e[0]:{kind:`intersection`,members:e}}let l=this.#y(e),u={...c,...n,...l===void 0?{}:{assertions:l}};return i?{...u,nullable:!0}:u}#y(e){this.#a++;try{return this.#b(e)}finally{this.#a--}}#b(e){let t={};if(Q(e,`not`)&&(t.not=this.convert(J(e,`not`))),this.#t.name===`oas31`){Q(e,`if`)&&(Q(e,`then`)||Q(e,`else`))&&(t.conditional={condition:this.convert(J(e,`if`)),...Q(e,`then`)?{whenTrue:this.convert(J(e,`then`))}:{},...Q(e,`else`)?{whenFalse:this.convert(J(e,`else`))}:{}});let n=Y(J(e,`dependentSchemas`));n.length>0&&(t.dependentSchemas=Object.fromEntries(n.map(([e,t])=>[e,this.convert(t)])));let r=Y(J(e,`dependentRequired`));r.length>0&&(t.dependentRequired=Object.fromEntries(r.map(([e,t])=>[e,Eh(t)])))}return Object.keys(t).length>0?t:void 0}#x(e,t){let n=e.value.map(e=>gh(e)).filter(e=>e!==void 0);if(n.length===0)return this.#e.warning(`schema/empty-enum`,"Empty `enum`: no value is valid.",e),{kind:`never`};if(t!==void 0&&t.length===1){let r=t[0],i=n.filter(e=>e!==null&&!sg(e,r??``));i.length>0&&this.#e.warning(`schema/enum-type-mismatch`,`Enum values ${i.map(e=>JSON.stringify(e)).join(`, `)} do not match type "${r??``}".`,e)}return{kind:`enum`,values:n}}#S(e,t){switch(t){case`string`:{if(this.#t.isBinaryString(e))return{kind:`binary`};let t=cg(e);return t===void 0?{kind:`string`}:{kind:`string`,constraints:t}}case`number`:case`integer`:{let n=this.#t.readNumberConstraints(e,this.#e);return n===void 0?{kind:t}:{kind:t,constraints:n}}case`boolean`:return{kind:`boolean`};case`null`:return{kind:`null`};case`object`:return this.#C(e);case`array`:return this.#w(e);case`file`:if(this.#t.name===`swagger2`)return{kind:`binary`}}return Yh(t)||this.#e.error(`schema/invalid-type`,`Unknown type "${t}".`,J(e,`type`)),{kind:`unknown`}}#C(e){let t=e.value,n=new Set(Array.isArray(t.required)?t.required.filter(e=>typeof e==`string`):[]),r=[],i=/* @__PURE__ */ new Set;for(let[t,a]of Y(J(e,`properties`)))i.add(t),r.push({name:t,required:n.has(t),schema:this.convert(a)});for(let e of n)i.has(e)||r.push({name:e,required:!0,schema:{kind:`unknown`}});let a;if(t.additionalProperties===!1?a=!1:t.additionalProperties===!0?a={kind:`unknown`}:E(t.additionalProperties)&&(a=this.convert(J(e,`additionalProperties`))),E(t.patternProperties)){let t=Y(J(e,`patternProperties`)).map(([,e])=>this.convert(e)),n=[...a===!1?[]:[a??{kind:`unknown`}],...t];a=n.length===1&&n[0]!==void 0?n[0]:{kind:`union`,combinator:`anyOf`,variants:n}}let o=hh(e,`minProperties`),s=hh(e,`maxProperties`),c={...o===void 0?{}:{minProperties:o},...s===void 0?{}:{maxProperties:s}};return{kind:`object`,properties:r,...a===void 0?{}:{additionalProperties:a},...Object.keys(c).length===0?{}:{constraints:c}}}#w(e){let t=e.value,n={kind:`unknown`},r;Array.isArray(t.items)?(this.#e.warning(`schema/tuple-items`,`Array-form \`items\` is not supported in ${this.#t.label}; it is interpreted as a tuple.`,e,{hint:this.#t.name===`oas31`?`Use prefixItems.`:`Use a single items schema.`}),r=mh(J(e,`items`)).map(e=>this.convert(e)),n=E(t.additionalItems)?this.convert(J(e,`additionalItems`)):{kind:`unknown`}):Q(e,`items`)?n=this.convert(J(e,`items`)):this.#t.name!==`oas31`&&!Q(e,`prefixItems`)&&this.#e.info(`schema/array-without-items`,"Array schema without `items`; elements are typed as unknown.",e),Array.isArray(t.prefixItems)&&(r=mh(J(e,`prefixItems`)).map(e=>this.convert(e)),t.items===!1?n={kind:`never`}:Q(e,`items`)||(n={kind:`unknown`}));let i=hh(e,`minItems`),a=hh(e,`maxItems`),o=Z(e,`uniqueItems`),s={...i===void 0?{}:{minItems:i},...a===void 0?{}:{maxItems:a},...o===!0?{uniqueItems:o}:{}};return{kind:`array`,items:n,...r===void 0?{}:{prefixItems:r},...Object.keys(s).length===0?{}:{constraints:s}}}#T(e,t){let n=this.#t.readDiscriminator(e,this.#e);if(n===void 0)return;let r=this.#E(n),i=n.defaultMapping===void 0?void 0:this.#D(n.defaultMapping),a=new Set(r.map(e=>e.target));for(let e of t){if(e.kind!==`ref`||a.has(e.target)||e.target===i)continue;let t=this.#O(e.target);t!==void 0&&r.push({value:t,target:e.target})}return{propertyName:n.propertyName,mapping:r,...i===void 0?{}:{defaultTarget:i}}}#E(e){let t=[];for(let n of e.mapping){let e=this.#D(n);e!==void 0&&t.push({value:n.value,target:e})}return t}#D(e){let t=nh(e.target)?e.target:`#${F(this.#t.componentsPointer,e.target)}`,n=nh(e.target)?e.at.doc:this.#e.store.root,r=this.#e.store.resolve(t,n,e.at.pointer);if(r!==void 0)return this.#f({doc:r.doc,pointer:r.pointer,value:r.value})}#O(e){let t=this.#n.get(e);if(t===void 0)return;let n=X(t.cursor,`x-discriminator-value`);return n===void 0?this.#p(t.cursor)?.name??ga(t.cursor.pointer):n}#k(){for(let e of[...this.#n.values()].sort((e,t)=>O(e.id,t.id))){let t=e.baseDiscriminator;if(t===void 0||e.schema===void 0)continue;let n=this.#E(t),r=new Set(n.map(e=>e.target)),i=[...this.#n.values()].filter(t=>ag(t.schema).includes(e.id)).sort((e,t)=>O(e.id,t.id));for(let e of i){if(r.has(e.id))continue;let t=this.#O(e.id);t!==void 0&&n.push({value:t,target:e.id})}let a={propertyName:t.propertyName,mapping:n},o=e.schema;if(o.kind===`object`)e.schema={...o,discriminator:a};else if(o.kind===`intersection`){let t=o.members.findIndex(e=>e.kind===`object`),n=o.members[t];if(n?.kind===`object`){let r=[...o.members];r[t]={...n,discriminator:a},e.schema={...o,members:r}}}else{let n=`${e.id}:discriminator`;this.#o.has(n)||(this.#o.add(n),this.#e.warning(`schema/discriminator-ignored`,`A discriminator without oneOf/anyOf is only supported on object schemas.`,t.at))}}}};function ag(e){return e?.kind===`intersection`?e.members.flatMap(e=>e.kind===`ref`?[e.target]:[]):[]}function og(e){return e.kind===`object`&&e.properties.length===0&&e.additionalProperties===void 0&&e.discriminator===void 0}function sg(e,t){switch(t){case`string`:return typeof e==`string`;case`integer`:return typeof e==`number`&&Number.isInteger(e);case`number`:return typeof e==`number`;case`boolean`:return typeof e==`boolean`;case`array`:return Array.isArray(e);case`object`:return typeof e==`object`&&!!e&&!Array.isArray(e);default:return!0}}function cg(e){let t={},n=hh(e,`minLength`);n!==void 0&&(t.minLength=n);let r=hh(e,`maxLength`);r!==void 0&&(t.maxLength=r);let i=X(e,`pattern`);i!==void 0&&(t.pattern=i);let a=X(e,`contentMediaType`);a!==void 0&&(t.contentMediaType=a);let o=X(e,`contentEncoding`);return o!==void 0&&(t.contentEncoding=o),Object.keys(t).length===0?void 0:t}var lg=/* @__PURE__ */ new Set([`element`,`attribute`,`text`,`cdata`,`none`]);function ug(e){if(!E(e.value))return;let t={};for(let n of[`name`,`namespace`,`prefix`]){let r=X(e,n);r!==void 0&&(t[n]=r)}for(let n of[`attribute`,`wrapped`]){let r=Z(e,n);r!==void 0&&(t[n]=r)}let n=X(e,`nodeType`);return n!==void 0&&lg.has(n)&&(t.nodeType=n),Object.keys(t).length===0?void 0:t}var dg=/* @__PURE__ */ new Set([`path`,`query`,`header`,`cookie`]),fg=/* @__PURE__ */ new Set([`matrix`,`label`,`form`,`simple`,`spaceDelimited`,`pipeDelimited`,`deepObject`]),pg=/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;function mg(e){return(t,n)=>{if(!nh(t))return;let r=e.store.resolve(t,n.doc,n.pointer);if(r===void 0||r.doc.url!==e.store.root.url)return;let i=fa(r.pointer)??[];return i.length===3&&i[0]===`components`&&i[1]===`securitySchemes`?i[2]:void 0}}var hg=/* @__PURE__ */ new Set([`accept`,`content-type`,`authorization`]);function gg(e,t,n,r){let i=e.root,a=new ig(e,t),o=n===`3.2`?{version:n,v32:!0,resolveSchemeUri:mg(e)}:{version:n,v32:!1};_g(e,n);for(let[,e]of vg(J(i,`components`,`schemas`)))a.registerComponent(e);let s=jg(e,J(i,`components`,`securitySchemes`)),c=new Set(s.map(e=>e.key)),l=[],u=J(i,`paths`);for(let[t,n]of Y(u)){if(t.startsWith(`x-`))continue;if(!t.startsWith(`/`)){e.error(`spec/invalid-path`,`Path "${t}" must start with "/".`,n);continue}let r=e.deref(n);if(r===void 0||!E(r.value))continue;let i=J(r,`parameters`),s=yg(J(r,`servers`));for(let[n,u]of bg(e,r,o)){let d=Cg(e,a,o,{cursor:u,method:n,path:t,pathParameters:i,pathServers:s,schemeNames:c,pathItem:r});d!==void 0&&l.push(d)}}let d=[];if(n!==`3.0`)for(let[t,n]of vg(J(i,`webhooks`))){let r=xg(e,a,o,n,c,{kind:`webhook`,path:``,keyPrefix:`webhook:${t}`});r.length>0&&d.push({name:t,operations:r})}Ng(e,l);let f=Dh(e,J(i,`security`),c,o.resolveSchemeUri)??[];Mg(e,l,s,f);let p=Ch(J(i,`externalDocs`));return{irVersion:4,specVersion:n,specVersionRaw:r,info:Sh(e,J(i,`info`)),servers:yg(J(i,`servers`)),operations:Mh(l),schemas:a.finalize(),webhooks:d,securitySchemes:s,security:f,tags:o.v32?Th(e,J(i,`tags`),wh(J(i,`tags`),!0)):wh(J(i,`tags`)),...p===void 0?{}:{externalDocs:p},extensions:_h(i),sources:e.sources()}}function _g(e,t){let n=e.root;t===`3.0`&&!E(J(n,`paths`).value)&&e.error(`spec/missing-field`,"OpenAPI 3.0 documents require a `paths` object.",n),t!==`3.0`&&!Q(n,`paths`)&&!Q(n,`components`)&&!Q(n,`webhooks`)&&e.error(`spec/missing-field`,`OpenAPI ${t} documents require at least one of \`paths\`, \`components\` or \`webhooks\`.`,n);let r=X(n,`jsonSchemaDialect`);t!==`3.0`&&r!==void 0&&r!==`https://spec.openapis.org/oas/3.1/dialect/base`&&!(t===`3.2`&&r.startsWith(`https://spec.openapis.org/oas/3.2/dialect/`))&&r!==`https://json-schema.org/draft/2020-12/schema`&&e.warning(`spec/unsupported-dialect`,`jsonSchemaDialect "${r}" is not supported; schemas are interpreted as the OpenAPI ${t} base dialect.`,J(n,`jsonSchemaDialect`))}function vg(e){return Y(e).sort(([e],[t])=>O(e,t))}function yg(e){if(!Array.isArray(e.value))return[];let t=[];return e.value.forEach((n,r)=>{let i=J(e,r),a=X(i,`url`);if(a===void 0)return;let o={};for(let[e,t]of Y(J(i,`variables`))){let n=X(t,`default`);if(n===void 0)continue;let r=Eh(J(t,`enum`));D(o,e,{default:n,...r.length>0?{enum:r}:{},...$({description:X(t,`description`)})})}t.push({url:bh(a,e.doc.url),variables:o,...$({name:X(i,`name`),description:X(i,`description`)})})}),t}function bg(e,t,n){let r=[];for(let e of ph(t))!jh(e)||e===`query`&&!n.v32||r.push([e,J(t,e)]);if(!n.v32)return r;for(let[n,i]of Y(J(t,`additionalOperations`)))C(n.toLowerCase())?e.error(`operation/reserved-method`,`additionalOperations must not define "${n}"; use the path item's \`${n.toLowerCase()}\` field.`,i):pg.test(n)?r.push([n,i]):e.error(`operation/invalid-method`,`"${n}" is not a valid HTTP method.`,i);return r}function xg(e,t,n,r,i,a){let o=e.deref(r);if(o===void 0||!E(o.value))return[];let s=[];for(let[r,c]of bg(e,o,n)){let l=Cg(e,t,n,{cursor:c,method:r,path:a.path,pathParameters:J(o,`parameters`),pathServers:yg(J(o,`servers`)),schemeNames:i,pathItem:o,kind:a.kind,keyPrefix:a.keyPrefix});l!==void 0&&s.push(l)}return Mh(s)}function Sg(e,t,n,r,i,a){let o=[];for(let[s,c]of vg(r)){let r=e.deref(c);if(r!==void 0&&E(r.value))for(let[c,l]of vg(r)){if(c.startsWith(`x-`))continue;let r=xg(e,t,n,l,i,{kind:`callback`,path:c,keyPrefix:`${a} callback:${s} ${c}`});r.length>0&&o.push({name:s,expression:c,operations:r})}}return o}function Cg(e,t,n,r){let{method:i,path:a}=r,o=e.derefNonStandard(r.cursor,`The ${i.toUpperCase()} ${a} operation`);if(o===void 0)return;if(!E(o.value)){e.error(`spec/invalid-operation`,`${i.toUpperCase()} ${a}: the operation must be an object.`,o);return}let s=X(o,`operationId`),c=r.kind??`operation`,l=c===`operation`?xh(i,a,s):`${c} ${r.keyPrefix??``} ${i.toUpperCase()}`,u=r.keyPrefix===void 0?`${i} ${a}`:`${r.keyPrefix} ${i}`,d=wg(e,t,n,r.pathParameters,J(o,`parameters`),l);c===`operation`&&Eg(e,a,d,o,l);let f=Q(o,`requestBody`)?kg(e,t,n,J(o,`requestBody`),l):void 0;f!==void 0&&c===`operation`&&(i===`get`||i===`head`)&&e.warning(`operation/body-on-get`,`${i.toUpperCase()} requests with a body are not portable; browsers' fetch rejects them.`,J(o,`requestBody`),{operation:l});let p=[],m=J(o,`responses`);!E(m.value)&&n.version===`3.0`&&e.warning(`spec/missing-field`,"Operation has no `responses` object.",o,{operation:l});for(let[r,i]of Y(m)){if(r.startsWith(`x-`))continue;if(!Nh(r)){e.warning(`operation/invalid-status`,`Invalid response status "${r}"; it is ignored.`,i,{operation:l});continue}let a=Ag(e,t,n,i,/^[1-5]xx$/i.test(r)?r.toUpperCase():r,l);a!==void 0&&p.push(a)}let h=c===`operation`&&Q(o,`callbacks`)?Sg(e,t,n,J(o,`callbacks`),r.schemeNames,u):[],g=Dh(e,J(o,`security`),r.schemeNames,n.resolveSchemeUri),_=yg(J(o,`servers`)),v=_.length>0?_:r.pathServers,y=Ch(J(o,`externalDocs`)),b=X(o,`summary`)??X(r.pathItem,`summary`),x=X(o,`description`)??X(r.pathItem,`description`);return{key:u,...s===void 0?{}:{operationId:s},method:i,path:a,...$({summary:b,description:x}),tags:Eh(J(o,`tags`)),deprecated:Z(o,`deprecated`)===!0,parameters:d,...f===void 0?{}:{requestBody:f},responses:Fh(p),...g===void 0?{}:{security:g},...v.length>0?{servers:v}:{},...y===void 0?{}:{externalDocs:y},...h.length>0?{callbacks:h}:{},extensions:_h(o),source:e.sourceRef(o)}}function wg(e,t,n,r,i,a){let o=/* @__PURE__ */ new Map;for(let s of[r,i]){if(s.value===void 0)continue;if(!Array.isArray(s.value)){e.error(`spec/invalid-parameters`,"`parameters` must be an array.",s,{operation:a});continue}let r=/* @__PURE__ */ new Set;s.value.forEach((i,c)=>{let l=Tg(e,t,n,J(s,c),a);if(l===void 0)return;let u=`${l.in}:${l.in===`header`?l.name.toLowerCase():l.name}`;r.has(u)?e.error(`operation/duplicate-parameter`,`Parameter "${l.name}" in ${l.in} is declared twice.`,J(s,c),{operation:a}):(r.add(u),o.set(u,l))})}let s=[...o.values()],c=s.filter(e=>e.in===`querystring`),l=i.value===void 0?r:i;return c.length>1?e.error(`operation/invalid-querystring`,`Only one querystring parameter is allowed; found ${c.map(e=>`"${e.name}"`).join(`, `)}.`,l,{operation:a}):c.length===1&&s.some(e=>e.in===`query`)&&e.error(`operation/invalid-querystring`,`The querystring parameter "${c[0]?.name??``}" describes the whole query string; it cannot be combined with query parameters.`,l,{operation:a}),s}function Tg(e,t,n,r,i){let a=e.deref(r);if(a===void 0)return;if(!E(a.value)){e.error(`spec/invalid-parameter`,`Parameter must be an object.`,a,{operation:i});return}let o=X(a,`name`),s=X(a,`in`);if(o===void 0||s===void 0){e.error(`spec/invalid-parameter`,"Parameter requires `name` and `in`.",a,{operation:i});return}if(!dg.has(s)&&!(n.v32&&s===`querystring`)){e.error(`spec/invalid-parameter`,`Parameter "${o}" has invalid location "${s}".`,J(a,`in`),{operation:i});return}let c=s;if(c===`header`&&hg.has(o.toLowerCase())){e.info(`operation/ignored-header`,`Header parameter "${o}" is ignored; it is controlled by the request content or authentication.`,a,{operation:i});return}let l=Z(a,`required`)===!0;c===`path`&&!l&&(e.warning(`operation/optional-path-parameter`,`Path parameter "${o}" must be required; it is treated as required.`,a,{operation:i}),l=!0);let u,d,f;if(c===`querystring`&&Q(a,`schema`)){e.error(`spec/invalid-parameter`,`The querystring parameter "${o}" must describe its media type with \`content\`, not \`schema\`.`,a,{operation:i});return}if(Q(a,`schema`))u=t.convert(J(a,`schema`));else if(E(J(a,`content`).value)){let[n,r]=Y(J(a,`content`))[0]??[],i=r===void 0?void 0:e.deref(r);d=n,u=i!==void 0&&Q(i,`schema`)?t.convert(J(i,`schema`)):{kind:`unknown`},c===`querystring`&&i!==void 0&&(f=Dg(i))}else e.warning(`spec/invalid-parameter`,`Parameter "${o}" has neither \`schema\` nor \`content\`; it is typed as unknown.`,a,{operation:i}),u={kind:`unknown`};let p=c===`query`||c===`querystring`||c===`cookie`?`form`:`simple`,m=X(a,`style`),h=p;m!==void 0&&(fg.has(m)||n.v32&&m===`cookie`&&c===`cookie`?h=m:e.warning(`operation/invalid-style`,`Unknown parameter style "${m}"; "${p}" is used.`,J(a,`style`),{operation:i}));let g=Z(a,`explode`)??(h===`form`||h===`cookie`),_=[...kh(a),...Oh(e,J(a,`examples`))];if(_.length===0&&d!==void 0){let t=e.deref(J(a,`content`,d));t!==void 0&&_.push(...kh(t),...Oh(e,J(t,`examples`)))}return{name:o,in:c,required:l,deprecated:Z(a,`deprecated`)===!0,...$({description:X(a,`description`),contentType:d}),...f===void 0||Object.keys(f).length===0?{}:{encoding:f},schema:u,style:h,explode:g,allowReserved:Z(a,`allowReserved`)===!0,examples:_,extensions:_h(a),source:e.sourceRef(a)}}function Eg(e,t,n,r,i){let a=Lh(t),o=new Set(n.filter(e=>e.in===`path`).map(e=>e.name));for(let t of a)o.has(t)||(e.warning(`operation/missing-path-parameter`,`Path parameter "${t}" is used in the path but not declared; it is typed as string.`,r,{operation:i}),n.unshift({name:t,in:`path`,required:!0,deprecated:!1,schema:{kind:`string`},style:`simple`,explode:!1,allowReserved:!1,examples:[],extensions:{},source:e.sourceRef(r)}));for(let t of o)a.includes(t)||e.warning(`operation/unused-path-parameter`,`Path parameter "${t}" is declared but does not appear in the path.`,r,{operation:i})}function Dg(e){let t={};for(let[n,r]of Y(J(e,`encoding`))){let e=X(r,`style`),i=Z(r,`explode`);t[n]={...$({contentType:X(r,`contentType`)}),...e!==void 0&&fg.has(e)?{style:e}:{},...i===void 0?{}:{explode:i}}}return t}function Og(e,t,n,r){let i=[];for(let[a,o]of Y(r)){let r=e.deref(o);if(r===void 0)continue;let s=n.v32&&Q(r,`itemSchema`)?t.convert(J(r,`itemSchema`)):void 0,c;Q(r,`schema`)?c=t.convert(J(r,`schema`)):s===void 0?c={kind:`unknown`}:(e.info(`operation/item-schema`,`${a} is only described by \`itemSchema\`; the whole content is typed as text (streaming is not generated yet).`,J(r,`itemSchema`)),c={kind:`string`}),Ih(a)&&(c.kind===`unknown`||c.kind===`string`&&c.format===void 0&&c.constraints?.contentEncoding===void 0)&&(c={...Ve(c),kind:`binary`});let l=Dg(r);i.push({mediaType:a,schema:c,...s===void 0?{}:{itemSchema:s},examples:[...kh(r),...Oh(e,J(r,`examples`))],...Object.keys(l).length>0?{encoding:l}:{}})}return i}function kg(e,t,n,r,i){let a=e.deref(r);if(a===void 0||!E(a.value))return;let o=Og(e,t,n,J(a,`content`));if(o.length===0)e.warning(`operation/empty-request-body`,`Request body declares no content types; it is ignored.`,a,{operation:i});else return{required:Z(a,`required`)===!0,...$({description:X(a,`description`)}),contents:o,extensions:_h(a),source:e.sourceRef(a)}}function Ag(e,t,n,r,i,a){let o=e.deref(r);if(o===void 0)return;if(!E(o.value)){e.error(`spec/invalid-response`,`Response ${i} must be an object.`,o,{operation:a});return}let s=[];for(let[n,r]of Y(J(o,`headers`))){let i=e.deref(r);if(i===void 0||n.toLowerCase()===`content-type`)continue;let a={kind:`unknown`};if(Q(i,`schema`))a=t.convert(J(i,`schema`));else if(E(J(i,`content`).value)){let[,n]=Y(J(i,`content`))[0]??[],r=n===void 0?void 0:e.deref(n);r!==void 0&&Q(r,`schema`)&&(a=t.convert(J(r,`schema`)))}s.push({name:n,required:Z(i,`required`)===!0,deprecated:Z(i,`deprecated`)===!0,...$({description:X(i,`description`)}),schema:a})}return{status:i,...$({summary:n.v32?X(o,`summary`):void 0,description:X(o,`description`)}),contents:Og(e,t,n,J(o,`content`)),headers:s,extensions:_h(o),source:e.sourceRef(o)}}function jg(e,t){let n=[];for(let[r,i]of vg(t)){let t=e.deref(i);if(t===void 0||!E(t.value))continue;let a={key:r,...$({description:X(t,`description`)}),...Z(t,`deprecated`)===!0?{deprecated:!0}:{},extensions:_h(t),source:e.sourceRef(t)},o=X(t,`type`);switch(o){case`apiKey`:{let i=X(t,`name`),o=X(t,`in`);if(i===void 0||o!==`header`&&o!==`query`&&o!==`cookie`){e.error(`security/invalid-scheme`,`apiKey scheme "${r}" requires \`name\` and \`in\` (header, query or cookie).`,t);continue}n.push({...a,type:`apiKey`,name:i,in:o});break}case`http`:{let i=X(t,`scheme`);if(i===void 0){e.error(`security/invalid-scheme`,`http scheme "${r}" requires \`scheme\`.`,t);continue}n.push({...a,type:`http`,scheme:i.toLowerCase(),...$({bearerFormat:X(t,`bearerFormat`)})});break}case`oauth2`:{let e=J(t,`flows`),r=t=>{let n=J(e,t);if(!E(n.value))return;let r={};for(let[e,t]of Y(J(n,`scopes`)))r[e]=typeof t.value==`string`?t.value:``;return{scopes:r,...$({authorizationUrl:X(n,`authorizationUrl`),deviceAuthorizationUrl:X(n,`deviceAuthorizationUrl`),tokenUrl:X(n,`tokenUrl`),refreshUrl:X(n,`refreshUrl`)})}},i=[`implicit`,`password`,`clientCredentials`,`authorizationCode`,`deviceAuthorization`].map(e=>[e,r(e)]).filter(e=>e[1]!==void 0);n.push({...a,type:`oauth2`,flows:Object.fromEntries(i),...$({oauth2MetadataUrl:X(t,`oauth2MetadataUrl`)})});break}case`openIdConnect`:{let i=X(t,`openIdConnectUrl`);if(i===void 0){e.error(`security/invalid-scheme`,`openIdConnect scheme "${r}" requires \`openIdConnectUrl\`.`,t);continue}n.push({...a,type:`openIdConnect`,openIdConnectUrl:i});break}case`mutualTLS`:n.push({...a,type:`mutualTLS`});break;default:e.error(`security/invalid-scheme`,`Security scheme "${r}" has unknown type "${o??``}".`,t)}}return n}function Mg(e,t,n,r){let i=new Set(n.filter(e=>e.type===`apiKey`&&e.in===`query`).map(e=>e.key));if(i.size!==0)for(let n of t){let t=n.parameters.find(e=>e.in===`querystring`),a=(t?.contentType??`application/x-www-form-urlencoded`).split(`;`)[0]?.trim().toLowerCase();if(t===void 0||a===`application/x-www-form-urlencoded`)continue;let o=(n.security??r).filter(e=>Object.keys(e).length>0),s=o.filter(e=>Object.keys(e).some(e=>i.has(e)));if(s.length===0)continue;let c=[...new Set(s.flatMap(e=>Object.keys(e).filter(e=>i.has(e))))],l=xh(n.method,n.path,n.operationId);e.diagnostics.warning({code:`operation/querystring-credentials`,message:`${l}: the query string is a ${a} document, so the API key${c.length===1?``:`s`} ${c.map(e=>`"${e}"`).join(`, `)} sent in the query cannot be added to it. ${s.length===o.length?`Requests are sent without these credentials.`:`Requirements that need them are skipped; the other alternatives are used.`}`,location:{file:e.store.byDisplay(t.source.file)?.location??e.store.root.location,pointer:t.source.pointer},operation:l,hint:`Send the key in a header or cookie (an apiKey scheme with in: header), or describe the query string as application/x-www-form-urlencoded.`})}}function Ng(e,t){let n=/* @__PURE__ */ new Map;for(let e of t){if(e.operationId===void 0)continue;let t=n.get(e.operationId)??[];t.push(e),n.set(e.operationId,t)}for(let[t,r]of n){if(r.length<2)continue;let n=r[1];e.diagnostics.warning({code:`operation/duplicate-id`,message:`operationId "${t}" is used by ${r.map(e=>`${e.method.toUpperCase()} ${e.path}`).join(`, `)}; generated names are disambiguated.`,...n===void 0?{}:{location:{file:e.store.byDisplay(n.source.file)?.location??e.store.root.location,pointer:n.source.pointer}}})}}var Pg=`application/json`;function Fg(e){let t=e.root,n=new ig(e,Wh);E(J(t,`paths`).value)||e.error(`spec/missing-field`,"Swagger 2.0 documents require a `paths` object.",t);for(let[,e]of Y(J(t,`definitions`)).sort(([e],[t])=>O(e,t)))n.registerComponent(e);let r=Gg(e,J(t,`securityDefinitions`)),i=new Set(r.map(e=>e.key)),a=Eh(J(t,`consumes`)),o=Eh(J(t,`produces`)),s=[];for(let[r,c]of Y(J(t,`paths`))){if(r.startsWith(`x-`))continue;if(!r.startsWith(`/`)){e.error(`spec/invalid-path`,`Path "${r}" must start with "/".`,c);continue}let t=e.deref(c);if(t!==void 0&&E(t.value))for(let c of ph(t)){if(!jh(c)||c===`trace`||c===`query`)continue;let l=J(t,c),u=Lg(e,n,{cursor:l,method:c,path:r,pathParameters:J(t,`parameters`),consumes:Q(l,`consumes`)?Eh(J(l,`consumes`)):a,produces:Q(l,`produces`)?Eh(J(l,`produces`)):o,schemeNames:i});u!==void 0&&s.push(u)}}Ng(e,s);let c=Ch(J(t,`externalDocs`));return{irVersion:4,specVersion:`2.0`,specVersionRaw:`2.0`,info:Sh(e,J(t,`info`)),servers:Ig(t),operations:Mh(s),schemas:n.finalize(),webhooks:[],securitySchemes:r,security:Dh(e,J(t,`security`),i)??[],tags:wh(J(t,`tags`)),...c===void 0?{}:{externalDocs:c},extensions:_h(t),sources:e.sources()}}function Ig(e){let t=X(e,`host`),n=X(e,`basePath`)??``,r=/^https?:/i.test(e.doc.url);if(t===void 0)return r?[{url:bh(n||`/`,e.doc.url),variables:{}}]:n===``?[]:[{url:n,variables:{}}];let i=Eh(J(e,`schemes`)).filter(e=>e===`https`||e===`http`);return(i.length===0?[r?new URL(e.doc.url).protocol.slice(0,-1):`https`]:[...i].sort((e,t)=>e===t?0:e===`https`?-1:1)).map(e=>({url:`${e}://${t}${n}`,variables:{}}))}function Lg(e,t,n){let{method:r,path:i}=n,a=e.derefNonStandard(n.cursor,`The ${r.toUpperCase()} ${i} operation`);if(a===void 0)return;if(!E(a.value)){e.error(`spec/invalid-operation`,`${r.toUpperCase()} ${i}: the operation must be an object.`,a);return}let o=X(a,`operationId`),s=xh(r,i,o),c=/* @__PURE__ */ new Map;for(let t of[n.pathParameters,J(a,`parameters`)])Array.isArray(t.value)&&t.value.forEach((n,r)=>{let i=e.deref(J(t,r));if(i===void 0)return;let a=X(i,`name`),o=X(i,`in`);a===void 0||o===void 0?e.error(`spec/invalid-parameter`,"Parameter requires `name` and `in`.",i,{operation:s}):c.set(`${o}:${a}`,i)});let l=[],u=[],d;for(let n of c.values()){let r=X(n,`in`);if(r===`body`)d!==void 0&&e.error(`operation/multiple-bodies`,`Only one body parameter is allowed.`,n,{operation:s}),d=n;else if(r===`formData`)u.push(n);else if(r===`path`||r===`query`||r===`header`){let i=Bg(e,t,n,r,s);i!==void 0&&l.push(i)}else e.error(`spec/invalid-parameter`,`Invalid parameter location "${r??``}".`,J(n,`in`),{operation:s})}d!==void 0&&u.length>0&&e.error(`operation/body-and-form`,`An operation cannot have both body and formData parameters; formData is ignored.`,a,{operation:s});for(let t of Lh(i))l.some(e=>e.in===`path`&&e.name===t)||(e.warning(`operation/missing-path-parameter`,`Path parameter "${t}" is used in the path but not declared; it is typed as string.`,a,{operation:s}),l.unshift({name:t,in:`path`,required:!0,deprecated:!1,schema:{kind:`string`},style:`simple`,explode:!1,allowReserved:!1,examples:[],extensions:{},source:e.sourceRef(a)}));let f;d===void 0?u.length>0&&(f=Ug(e,t,u,n.consumes,s)):f=Hg(e,t,d,n.consumes);let p=[];for(let[r,i]of Y(J(a,`responses`))){if(r.startsWith(`x-`))continue;if(!Nh(r)){e.warning(`operation/invalid-status`,`Invalid response status "${r}"; it is ignored.`,i,{operation:s});continue}let a=Wg(e,t,i,r,n.produces);a!==void 0&&p.push(a)}let m=Dh(e,J(a,`security`),n.schemeNames),h=Ch(J(a,`externalDocs`));return{key:`${r} ${i}`,...o===void 0?{}:{operationId:o},method:r,path:i,...$({summary:X(a,`summary`),description:X(a,`description`)}),tags:Eh(J(a,`tags`)),deprecated:Z(a,`deprecated`)===!0,parameters:l,...f===void 0?{}:{requestBody:f},responses:Fh(p),...m===void 0?{}:{security:m},...h===void 0?{}:{externalDocs:h},extensions:_h(a),source:e.sourceRef(a)}}function Rg(e,t,n,r){let i=X(t,`collectionFormat`)??`csv`,a=n===`query`||n===`formData`?`form`:`simple`;switch(i){case`csv`:return{style:a,explode:!1};case`ssv`:return{style:`spaceDelimited`,explode:!1};case`tsv`:return{style:`tabDelimited`,explode:!1};case`pipes`:return{style:`pipeDelimited`,explode:!1};case`multi`:return n===`query`||n===`formData`?{style:`form`,explode:!0}:(e.warning(`operation/invalid-collection-format`,"`collectionFormat: multi` is only valid for query and formData parameters; csv is used.",t,{operation:r}),{style:a,explode:!1});default:return e.warning(`operation/invalid-collection-format`,`Unknown collectionFormat "${i}"; csv is used.`,t,{operation:r}),{style:a,explode:!1}}}function zg(e,t,n,r){if(!Q(n,`type`))return e.error(`spec/invalid-parameter`,`Parameter "${X(n,`name`)??``}" requires a \`type\`.`,n,{operation:r}),{kind:`unknown`};let{description:i,...a}=t.convert(n);return a}function Bg(e,t,n,r,i){let a=X(n,`name`)??``,o=Z(n,`required`)===!0;r===`path`&&!o&&(e.warning(`operation/optional-path-parameter`,`Path parameter "${a}" must be required; it is treated as required.`,n,{operation:i}),o=!0);let s=zg(e,t,n,i),{style:c,explode:l}=X(n,`type`)===`array`?Rg(e,n,r,i):{style:r===`query`?`form`:`simple`,explode:r===`query`};return{name:a,in:r,required:o,deprecated:Z(n,`x-deprecated`)===!0,...$({description:X(n,`description`)}),schema:s,style:c,explode:l,allowReserved:!1,examples:Vg(n,`x-example`),extensions:_h(n),source:e.sourceRef(n)}}function Vg(e,t){if(!E(e.value)||!(t in e.value))return[];let n=gh(e.value[t]);return n===void 0?[]:[{value:n}]}function Hg(e,t,n,r){let i=Q(n,`schema`)?t.convert(J(n,`schema`)):{kind:`unknown`};Q(n,`schema`)||e.error(`spec/invalid-parameter`,"Body parameters require a `schema`.",n);let a=r.length===0?[Pg]:r;return{required:Z(n,`required`)===!0,...$({description:X(n,`description`)}),contents:a.map(e=>({mediaType:e,schema:Ih(e)&&(i.kind===`unknown`||i.kind===`string`)?{kind:`binary`}:i,examples:Vg(n,`x-example`)})),extensions:_h(n),source:e.sourceRef(n)}}function Ug(e,t,n,r,i){let a=[],o={},s=!1;for(let r of n){let n=X(r,`name`)??``,c=zg(e,t,r,i),l=X(r,`description`);if(c.kind===`binary`&&(s=!0),a.push({name:n,required:Z(r,`required`)===!0,schema:l===void 0?c:{...c,description:l}}),X(r,`type`)===`array`){let{style:t,explode:a}=Rg(e,r,`formData`,i);D(o,n,{style:t,explode:a})}}let c=s||r.includes(`multipart/form-data`);s&&!r.includes(`multipart/form-data`)&&e.warning(`operation/file-without-multipart`,"File parameters require `consumes: [multipart/form-data]`; multipart is used.",n[0]??e.root,{operation:i});let l={mediaType:c?`multipart/form-data`:`application/x-www-form-urlencoded`,schema:{kind:`object`,properties:a},examples:[],...Object.keys(o).length>0?{encoding:o}:{}},u=n[0];return{required:a.some(e=>e.required),contents:[l],extensions:{},source:u===void 0?e.sourceRef(e.root):e.sourceRef(u)}}function Wg(e,t,n,r,i){let a=e.deref(n);if(a===void 0||!E(a.value))return;let o=[];if(Q(a,`schema`)){let e=t.convert(J(a,`schema`)),n=J(a,`examples`),r=i.length===0?[Pg]:i;for(let t of r){let r=E(n.value)?gh(n.value[t]):void 0;o.push({mediaType:t,schema:Ih(t)&&(e.kind===`unknown`||e.kind===`string`)?{kind:`binary`}:e,examples:r===void 0?[]:[{value:r}]})}}let s=Y(J(a,`headers`)).map(([e,n])=>({name:e,required:!1,deprecated:!1,...$({description:X(n,`description`)}),schema:Q(n,`type`)?t.convert(n):{kind:`unknown`}}));return{status:r,...$({description:X(a,`description`)}),contents:o,headers:s,extensions:_h(a),source:e.sourceRef(a)}}function Gg(e,t){let n=[];for(let[r,i]of Y(t).sort(([e],[t])=>O(e,t))){let t={key:r,...$({description:X(i,`description`)}),extensions:_h(i),source:e.sourceRef(i)},a=X(i,`type`);if(a===`basic`)n.push({...t,type:`http`,scheme:`basic`});else if(a===`apiKey`){let a=X(i,`name`),o=X(i,`in`);if(a===void 0||o!==`header`&&o!==`query`){e.error(`security/invalid-scheme`,`apiKey scheme "${r}" requires \`name\` and \`in\` (header or query).`,i);continue}n.push({...t,type:`apiKey`,name:a,in:o})}else if(a===`oauth2`){let a=X(i,`flow`),o={};for(let[e,t]of Y(J(i,`scopes`)))o[e]=typeof t.value==`string`?t.value:``;let s={scopes:o,...$({authorizationUrl:X(i,`authorizationUrl`),tokenUrl:X(i,`tokenUrl`)})},c=a===`implicit`?`implicit`:a===`password`?`password`:a===`application`?`clientCredentials`:a===`accessCode`?`authorizationCode`:void 0;if(c===void 0){e.error(`security/invalid-scheme`,`oauth2 scheme "${r}" has invalid flow "${a??``}".`,i);continue}n.push({...t,type:`oauth2`,flows:{[c]:s}})}else e.error(`security/invalid-scheme`,`Security definition "${r}" has unknown type "${a??``}".`,i)}return n}var Kg={"2.0":{version:`2.0`,normalize:e=>Fg(e)},"3.0":{version:`3.0`,normalize:(e,t)=>gg(e,Gh,`3.0`,t)},"3.1":{version:`3.1`,normalize:(e,t)=>gg(e,qh,`3.1`,t)},"3.2":{version:`3.2`,normalize:(e,t)=>gg(e,Jh,`3.2`,t)}},qg={"2.0":`Swagger 2.0`,"3.0":`OpenAPI 3.0`,"3.1":`OpenAPI 3.1`,"3.2":`OpenAPI 3.2`};function Jg(e,t){let n={file:t,pointer:``};if(!E(e))return{ok:!1,diagnostic:{code:`spec/not-an-object`,severity:`error`,message:`The specification must be a JSON/YAML object.`,location:n}};let r=[];if(`swagger`in e)return(typeof e.swagger==`number`?e.swagger.toFixed(1):e.swagger)===`2.0`?(typeof e.swagger==`number`&&r.push(Yg(`swagger`,t)),{ok:!0,version:`2.0`,raw:`2.0`,warnings:r}):{ok:!1,diagnostic:{code:`spec/unsupported-version`,severity:`error`,message:`Unsupported Swagger version ${JSON.stringify(e.swagger)}; only "2.0" is supported.`,location:{file:t,pointer:`/swagger`}}};if(`openapi`in e){let n=e.openapi;if(typeof n==`number`){if(Number.isInteger(n))return{ok:!1,diagnostic:{code:`spec/invalid-version`,severity:`error`,message:`The openapi field ${n} is a number; it must be a string such as "3.0.3".`,location:{file:t,pointer:`/openapi`},hint:`Quote the version in YAML: openapi: "3.0.3".`}};r.push(Yg(`openapi`,t)),n=String(n)}if(typeof n==`string`){let e=/^3\.(\d+)(?:\.\d+)?(?:-[\w.]+)?$/.exec(n);if(e?.[1]===`0`)return{ok:!0,version:`3.0`,raw:n,warnings:r};if(e?.[1]===`1`)return{ok:!0,version:`3.1`,raw:n,warnings:r};if(e?.[1]===`2`)return{ok:!0,version:`3.2`,raw:n,warnings:r}}return{ok:!1,diagnostic:{code:`spec/unsupported-version`,severity:`error`,message:`Unsupported OpenAPI version ${JSON.stringify(e.openapi)}. Supported: 3.0.x, 3.1.x and 3.2.x.`,location:{file:t,pointer:`/openapi`}}}}return{ok:!1,diagnostic:{code:`spec/unknown-format`,severity:`error`,message:`The document has neither a "swagger" nor an "openapi" field, so it is not a Swagger/OpenAPI document.`,location:n}}}function Yg(e,t){return{code:`spec/unquoted-version`,severity:`warning`,message:`The ${e} version is a number; it should be a string.`,location:{file:t,pointer:`/${e}`},hint:`Quote it in YAML: ${e}: "<version>".`}}function Xg(e,t,n,r){if(e!==`auto`&&e!==t)return{code:`spec/version-mismatch`,severity:`error`,message:`The config expects ${qg[e]} (spec.version: '${e}'), but the document declares ${qg[t]} (${n}).`,location:{file:r,pointer:t===`2.0`?`/swagger`:`/openapi`},hint:`Set spec.version to '${t}' if the document is correct, or use 'auto' to accept any supported version.`}}async function Zg(e){let{config:t,diagnostics:n}=e,r=new sh({policy:t.spec.refs,fetch:t.spec.fetch,diagnostics:n,maxDocuments:t.spec.refs.maxDocuments}),i=await r.loadRoot(t.spec.input);if(t.spec.overlays.length>0){let e=/* @__PURE__ */ new WeakSet,i=await Vm(r.root.data,{overlays:t.spec.overlays,fetch:t.spec.fetch,diagnostics:n,shifted:e,.../^https?:\/\//i.test(t.spec.input)?{credentialOrigin:new URL(t.spec.input).origin}:{}});r.replaceRootData(i,e)}if(e.beforeParse!==void 0){let t=r.root.data,n=await e.beforeParse(t);n!==void 0&&n!==t&&r.replaceRootData(n)}let a=Jg(r.root.data,i.location);if(!a.ok)return n.add(a.diagnostic),{ir:void 0,store:r};n.addAll(a.warnings);let o=Xg(t.spec.version,a.version,a.raw,i.location);if(o!==void 0)return n.add(o),{ir:void 0,store:r};a.version===`2.0`&&r.enableSwagger2(),(a.version===`3.1`||a.version===`3.2`)&&r.enableSchemaIds(),a.version===`3.2`&&r.enableSelf(),await r.loadReferencedDocuments();let s=new yh(r,n);return{ir:Kg[a.version].normalize(s,a.raw),store:r}}var Qg=/* @__PURE__ */ new WeakMap;async function $g(e){let{config:t}=e,n=new Np,r=new Up(e.plugins??[],n,t);Qg.set(r,n);let i={},a=performance.now(),o=e=>{let t=performance.now();i[e]=Math.round((t-a)*10)/10,a=t},s,c=e=>{let t=s===void 0?n.toArray():xa(n.toArray(),s);return{ok:!n.hasErrors,files:[],...e,...s===void 0?{}:{store:s},diagnostics:t,runner:r,timings:i}};try{let e=await Zg({config:t,diagnostics:n,beforeParse:e=>r.beforeParse(e,t.spec.input)});if(s=e.store,o(`parse`),e.ir===void 0||n.hasErrors)return c(e.ir===void 0?{}:{ir:e.ir});let i=await r.afterNormalize(e.ir),a=t.types.readWrite===`split`?ht(i,t.naming.inputSuffix):i,l=Ha({ir:a,config:t,diagnostics:n,hooks:r.namingHooks()});o(`analyze`);let u=s,d={project:l,config:t,hooks:r.codegenHooks(),report:({severity:e,source:r,...i})=>{let a=r===void 0?t.spec.input:u.byDisplay(r.file)?.location??r.file;n.add({...i,severity:e,location:{file:a,...r===void 0?{}:{pointer:r.pointer}}})}},f={project:l};await r.beforeGenerate(f);let p=Mp(d);return p=await r.generate(p,f),p=await r.transformFiles(p,f),p=e_(p,n).sort((e,t)=>O(e.path,t.path)),await r.afterGenerate(p,f),o(`generate`),c({ir:a,project:l,files:n.count(`error`)>0?[]:p})}catch(e){if(e instanceof Pp)return n.addAll(e.diagnostics),e.diagnostics.length===0&&n.error({code:`internal/error`,message:e.message}),c({});throw e}}function e_(e,t){let n=/* @__PURE__ */ new Map,r=[];for(let i of e){if(!Hp(i.path)){t.error({code:`output/invalid-path`,message:`Generated file path "${i.path}" (from ${i.origin}) is not a normalized path inside the output directory.`});continue}let e=i.path.toLowerCase(),a=n.get(e);a===void 0?(n.set(e,i.path),r.push(i)):t.error({code:`output/duplicate-path`,message:`Generated file "${i.path}" (from ${i.origin}) collides with "${a}" (paths are compared case-insensitively).`})}return r}var t_=`/playground`;async function n_(e){Ip(Object.fromEntries(Object.entries(e.files).map(([e,t])=>[`${t_}/${e}`,t])));let t=Oe(e.config),n=e=>({...e,...e.location===void 0?{}:{location:{...e.location,file:e.location.file.replace(`${t_}/`,``)}},formatted:Ie(e,{cwd:t_})});if(t.length>0)return{ok:!1,files:[],diagnostics:t.map(e=>n({code:`config/invalid`,severity:`error`,message:`${e.path===``?`config`:e.path}: ${e.message}`,...e.hint===void 0?{}:{hint:e.hint}})),timings:{},operations:0,models:0};let r=x({...e.config,spec:{...e.config.spec,refs:{external:`none`}},output:{directory:`./out`,...e.config.output}},{root:t_}),i=await $g({config:r}),a=e.lint===!0&&i.project!==void 0?Oa(i.project,r,i.store):[];return{ok:i.ok,files:i.files.map(e=>({path:e.path,content:e.content})),diagnostics:[...i.diagnostics,...a].map(n),timings:i.timings,operations:i.project?.operations.length??0,models:i.project?.models.length??0}}function r_(e){if(typeof e!=`object`||!e)return!1;let{id:t,input:n}=e;return typeof t==`number`&&typeof n==`object`&&!!n&&typeof n.files==`object`}addEventListener(`message`,e=>{if(e.origin!==``&&e.origin!==self.location.origin||!r_(e.data))return;let{id:t,input:n}=e.data,r=performance.now();n_(n).then(e=>postMessage({id:t,result:e,elapsed:performance.now()-r}),e=>postMessage({id:t,error:e instanceof Error?e.message:String(e)}))})})();