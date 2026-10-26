/**
 * Support for the generated Mock Service Worker handlers (`features.mocks: 'msw'`): matching
 * requests against the client's base URL, typed access to the request, building responses, and
 * `mockFetch()`, which answers a client from the handlers without intercepting anything.
 * Works with MSW 2.11 and later 2.x releases, and with MSW 3.
 */
import { delay, getResponse, http, HttpResponse, type HttpHandler } from 'msw';

/** A client whose configuration decides the base URL requests are matched against. */
export interface MockClient {
  getConfig(): { readonly baseUrl: string; readonly operationServers?: boolean | undefined };
}

/** Settings every mock handler accepts; `mockHandlers()` passes them on to each handler. */
export interface MockSettings {
  /**
   * The base URL requests are matched against. By default the one the client sends them to: its
   * current `baseUrl`, or the operation's own server when it declares one (and
   * `operationServers` is on). A relative URL matches any origin unless the page has one.
   */
  readonly baseUrl?: string;
  /** Match the base URL of this client (e.g. one made with `createClient()`) instead. */
  readonly client?: MockClient;
  /**
   * Wait before responding: milliseconds, `'real'` (a realistic, random server time in browsers)
   * or `'infinite'` (never respond, to see loading states).
   */
  readonly delay?: number | 'real' | 'infinite';
  /** Headers added to the response. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Fail like a network error instead of responding. */
  readonly networkError?: boolean;
  /** Respond to the first matching request only. */
  readonly once?: boolean;
}

/** What a response function receives. */
export interface MockRequest<TParams, TBody> {
  /** The intercepted request. */
  readonly request: Request;
  /** Path parameters by name, percent-decoded. */
  readonly params: TParams;
  /** The query string of the request. */
  readonly query: URLSearchParams;
  /** Cookies sent with the request. */
  readonly cookies: Readonly<Record<string, string>>;
  /**
   * Reads the request body by its media type: parsed JSON (with dates revived), `FormData`,
   * `URLSearchParams`, text or a `Blob`; `undefined` without a body. Can be called more than once.
   */
  body(): Promise<TBody>;
}

/**
 * A response body, or a function of the request that returns one. The function may also return
 * a `Response`, which is sent as it is: another status, or `Response.error()` for a network error.
 */
export type MockBody<T, TRequest> =
  | T
  | ((request: TRequest) => T | Response | Promise<T | Response>);

/** How `MockRequest.body()` reads a request body. */
export type MockRequestBody = 'json' | 'multipart' | 'urlencoded' | 'text' | 'binary';

/** A documented response of an operation. */
export interface MockResponse {
  /** Media type of the body; absent for responses without one. */
  readonly mediaType?: string;
  /** Creates the default body (a fixture), once per request. */
  readonly body?: () => unknown;
  /** The headers the response documents as required, with example values. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Converts a body to its wire form, e.g. `Date` values to strings. */
  readonly encode?: (body: unknown) => unknown;
}

/** An operation as its generated mock handler describes it. */
export interface MockOperation {
  /** The client whose configuration decides the base URL. */
  readonly client: MockClient;
  /** The request method, as the client sends it. */
  readonly method: string;
  /** The path template, e.g. `/pets/{petId}`. */
  readonly path: string;
  /** The operation's own server, if it declares one. */
  readonly server?: string;
  /** Path parameters serialized with the `label` or `matrix` style. */
  readonly styles?: Readonly<Record<string, 'label' | 'matrix'>>;
  /** The status to respond with when the options name none. */
  readonly status: number;
  /** How `body()` reads the request body; by its `Content-Type` when absent. */
  readonly request?: MockRequestBody;
  /** Converts a parsed JSON request body, e.g. date strings to `Date` values. */
  readonly decode?: (body: unknown) => unknown;
  /** Documented responses by status: `'200'`, `'4XX'` or `'default'`. */
  readonly responses: Readonly<Record<string, MockResponse>>;
  /** `false` when the path has an `OPTIONS` operation, which answers plain `OPTIONS` requests. */
  readonly preflight?: boolean;
}

/** The options of a generated handler, without their per-status types. */
interface MockOptions extends MockSettings {
  readonly status?: number;
  readonly body?: unknown;
}

type Segment = string | { readonly pattern: RegExp; readonly names: readonly string[] };

/** Statuses whose responses have no body. */
const NULL_BODY: ReadonlySet<number> = new Set([101, 103, 204, 205, 304]);

/** The page's URL in browsers (and DOM environments such as happy-dom), otherwise `undefined`. */
function pageUrl(): string | undefined {
  return (globalThis as { location?: { href?: string } }).location?.href;
}

/**
 * A request handler for one operation: it matches the method and the path below the base URL,
 * and responds with `options.status` (or the operation's default status) and `options.body` (or
 * the documented response's fixture).
 */
export function mockHandler(operation: MockOperation, options: MockOptions = {}): HttpHandler {
  const segments = compilePath(operation.path);
  const method = operation.method.toUpperCase();
  // `once` is counted here rather than by MSW, so that CORS preflights do not use it up.
  let used = false;
  return http.all(
    ({ request }): false | { matches: true; params: Record<string, string> } => {
      const preflight = isPreflight(request, method, operation);
      // Methods compare like MSW compares them: `fetch` sends `Patch` as it is spelled.
      if (!preflight && (request.method.toUpperCase() !== method || used)) return false;
      const params = matchUrl(request.url, baseUrlOf(operation, options), segments, operation);
      return params === undefined ? false : { matches: true, params };
    },
    async ({ request, params, cookies }): Promise<Response> => {
      if (isPreflight(request, method, operation)) return preflightResponse(request);
      if (options.once === true) used = true;
      if (options.delay !== undefined) await delay(options.delay);
      if (options.networkError === true) return HttpResponse.error();
      const status = options.status ?? operation.status;
      const response =
        own(operation.responses, String(status)) ??
        own(operation.responses, `${String(status).charAt(0)}XX`) ??
        own(operation.responses, 'default');
      let body: unknown;
      if (typeof options.body === 'function') {
        const info: MockRequest<Readonly<Record<string, string>>, unknown> = {
          request,
          params,
          query: new URL(request.url).searchParams,
          cookies,
          body: () => readBody(request, operation),
        };
        body = await (options.body as (request: typeof info) => unknown)(info);
        if (isResponse(body)) return body;
      } else {
        body = options.body === undefined ? response?.body?.() : options.body;
      }
      return respond(request, status, body, response, options.headers);
    },
  );
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

/**
 * A `fetch` answered by mock handlers instead of the network, without intercepting anything:
 * give it to the client's fetch transport. It works wherever `Request` and `Response` exist
 * (Node.js, browsers, Deno, Bun, edge runtimes), leaves the global `fetch` alone,
 * and lets tests that run in parallel use handlers of their own. Relative URLs resolve against
 * the page, or `http://localhost` outside browsers. A request no handler answers rejects like a
 * network error, or goes to `fallback`.
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
      throw new TypeError(`No mock handler answers ${request.method} ${request.url}.`);
    }
    // `Response.error()` is a network error, which `fetch` reports by rejecting.
    if (response.type === 'error') throw new TypeError('Failed to fetch (mocked network error).');
    return response;
  };
  // oxlint-disable-next-line typescript/no-unnecessary-type-assertion -- Some environments type `fetch` with members of their own (Bun's `fetch.preconnect`).
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
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** The segments of a path template after its leading `/`: literal text, or a pattern. */
function compilePath(path: string): Segment[] {
  return path
    .split('/')
    .slice(1)
    .map((segment) => {
      if (!/\{[^}]+\}/.test(segment)) return decode(segment);
      const names: string[] = [];
      let source = '';
      let last = 0;
      const parameter = /\{([^}]+)\}/g;
      for (let match = parameter.exec(segment); match !== null; match = parameter.exec(segment)) {
        source += `${escapeRegExp(decode(segment.slice(last, match.index)))}([\\s\\S]+?)`;
        names.push(match[1] ?? '');
        last = match.index + match[0].length;
      }
      source += escapeRegExp(decode(segment.slice(last)));
      return { pattern: new RegExp(`^${source}$`), names };
    });
}

/**
 * The path parameters of `url` when it is the base URL followed by the path template, compared
 * segment by segment after percent-decoding; `undefined` when it is not.
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
  const absolute = /^[a-z][a-z\d+.-]*:/i.test(basePath);
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
      else if (style === 'matrix' && param.startsWith(`;${name}=`))
        param = param.slice(name.length + 2);
      // `defineProperty`, so a parameter named `__proto__` stays a property.
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
  // `GET` requests (and others sent without one) have no body.
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
 * Whether a value is a `Response`, also one from another realm (a DOM test environment's) or
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

/** A `Blob` (also from another realm), whose bytes are sent. */
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
 * The response for a body: `HttpResponse`, which also mocks `Set-Cookie` headers in browsers
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
