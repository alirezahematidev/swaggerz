import type {
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
  tabDelimited: '\t',
};

type Encoder = (value: string) => string;

const encodeStrict: Encoder = (value) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/**
 * Keeps RFC 3986 reserved characters, as requested by `allowReserved`. Percent signs are kept only
 * when they start a percent-encoded octet, so the result is always valid percent-encoding.
 */
const encodeReserved: Encoder = (value) =>
  value.replace(/%(?![0-9A-Fa-f]{2})|[^A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]/gu, (c) =>
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

/** Serializes one path parameter value (`simple`, `label` or `matrix` style). */
export function serializePathParam(
  name: string,
  value: unknown,
  serialization?: ParamSerialization,
): string {
  const { style, explode, encode, json } = settings('path', serialization);
  if (json) return encode(JSON.stringify(value));
  const prefix = style === 'label' ? '.' : style === 'matrix' ? `;${name}=` : '';
  if (Array.isArray(value)) {
    const items = value.map((item) => encode(primitiveToString(item)));
    if (style === 'matrix' && explode) return items.map((item) => `;${name}=${item}`).join('');
    const separator = style === 'label' && explode ? '.' : (DELIMITERS[style] ?? ',');
    return prefix + items.join(separator === ' ' ? '%20' : separator === '\t' ? '%09' : separator);
  }
  if (isObject(value)) {
    const pairs = entriesOf(value);
    if (explode) {
      const separator = style === 'label' ? '.' : style === 'matrix' ? ';' : ',';
      const body = pairs
        .map(([key, item]) => `${encode(key)}=${encode(primitiveToString(item))}`)
        .join(separator);
      return style === 'matrix' ? `;${body}` : style === 'label' ? `.${body}` : body;
    }
    return (
      prefix +
      pairs.flatMap(([key, item]) => [encode(key), encode(primitiveToString(item))]).join(',')
    );
  }
  if (style === 'matrix' && value === '') return `;${name}`;
  return prefix + encode(primitiveToString(value));
}

/** Replaces `{name}` segments in a path template. Throws when a value is missing. */
export function interpolatePath(
  path: string,
  values: Readonly<Record<string, unknown>> | undefined,
  styles: Readonly<Record<string, ParamSerialization>> | undefined,
): string {
  return path.replace(/\{([^}]+)\}/g, (_match, name: string) => {
    const value = values?.[name];
    if (value === undefined || value === null) {
      throw new TypeError(`Missing required path parameter "${name}"`);
    }
    return serializePathParam(name, value, styles?.[name]);
  });
}

/** Serializes query parameters into a query string without the leading `?`. */
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
      parts.push(`${key}=${encode(JSON.stringify(value))}`);
    } else if (Array.isArray(value)) {
      const items = value
        .filter((item) => item !== undefined && item !== null)
        .map((item) => encode(primitiveToString(item)));
      if (items.length === 0) continue;
      const delimiter = DELIMITERS[style];
      if (style === 'form' && explode) parts.push(...items.map((item) => `${key}=${item}`));
      else if (delimiter !== undefined) parts.push(`${key}=${items.join(encodeStrict(delimiter))}`);
      else parts.push(`${key}=${items.join(',')}`);
    } else if (isObject(value)) {
      if (style === 'deepObject') {
        for (const [path, item] of deepObjectPairs(key, value, encodeStrict))
          parts.push(`${path}=${encode(primitiveToString(item))}`);
      } else if (explode) {
        for (const [property, item] of entriesOf(value)) {
          parts.push(`${encodeStrict(property)}=${encode(primitiveToString(item))}`);
        }
      } else {
        const flat = entriesOf(value).flatMap(([property, item]) => [
          encode(property),
          encode(primitiveToString(item)),
        ]);
        const delimiter = DELIMITERS[style];
        parts.push(`${key}=${flat.join(delimiter === undefined ? ',' : encodeStrict(delimiter))}`);
      }
    } else {
      parts.push(`${key}=${encode(primitiveToString(value))}`);
    }
  }
  return parts.join('&');
}

/**
 * `deepObject` pairs: bracketed key paths (`filter[a][0]`, property names passed through
 * `encodeKey`) and the primitive values at their ends.
 */
function deepObjectPairs(
  prefix: string,
  value: unknown,
  encodeKey: Encoder,
): [path: string, value: unknown][] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => deepObjectPairs(`${prefix}[${index}]`, item, encodeKey));
  }
  if (isObject(value)) {
    return entriesOf(value).flatMap(([key, item]) =>
      deepObjectPairs(`${prefix}[${encodeKey(key)}]`, item, encodeKey),
    );
  }
  if (value === undefined || value === null) return [];
  return [[prefix, value]];
}

/** Serializes a header parameter (`simple` style). */
export function serializeHeader(value: unknown, serialization?: ParamSerialization): string {
  if (serialization?.json === true) return JSON.stringify(value);
  const explode = serialization?.explode ?? false;
  if (Array.isArray(value)) return value.map(primitiveToString).join(',');
  if (isObject(value)) {
    const pairs = entriesOf(value);
    return explode
      ? pairs.map(([key, item]) => `${key}=${primitiveToString(item)}`).join(',')
      : pairs.flatMap(([key, item]) => [key, primitiveToString(item)]).join(',');
  }
  return primitiveToString(value);
}

/** Builds a `Cookie` header value. Browsers ignore this header; cookies are sent by the browser. */
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
    parts.push(`${name}=${encodeStrict(text)}`);
  }
  return parts.join('; ');
}

/**
 * OpenAPI 3.2 `style: cookie`: like `form`, but pairs are separated by `; ` and nothing is
 * percent-encoded (values must already be escaped as the cookie requires).
 */
function cookieStyle(name: string, value: unknown, explode: boolean): string {
  if (Array.isArray(value)) {
    const items = value.map(primitiveToString);
    return explode
      ? items.map((item) => `${name}=${item}`).join('; ')
      : `${name}=${items.join(',')}`;
  }
  if (isObject(value)) {
    const pairs = entriesOf(value);
    return explode
      ? pairs.map(([key, item]) => `${key}=${primitiveToString(item)}`).join('; ')
      : `${name}=${pairs.flatMap(([key, item]) => [key, primitiveToString(item)]).join(',')}`;
  }
  return `${name}=${primitiveToString(value)}`;
}

/**
 * Serializes an OpenAPI 3.2 `querystring` parameter: the whole query string, without `?`. Form
 * content uses `application/x-www-form-urlencoded` rules; other media types are serialized (JSON
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

/** Whether a media type carries JSON (`application/json`, `application/problem+json`, ...). */
export function isJsonMediaType(mediaType: string | null | undefined): boolean {
  if (mediaType === null || mediaType === undefined) return false;
  const type = (mediaType.split(';')[0] ?? '').trim().toLowerCase();
  return type === 'application/json' || type.endsWith('+json') || type === 'text/json';
}

/**
 * How a transport reads a response body: `parseAs` applies to successful and redirect statuses;
 * error bodies (other statuses) are read by their `Content-Type` (`auto`), so `ApiError.body`
 * matches the error response's declared type. `stream` keeps every body unread.
 */
export function responseParseAs(parseAs: ParseAs, status: number): ParseAs {
  return parseAs === 'stream' || (status >= 200 && status < 400) ? parseAs : 'auto';
}

/** Whether a response of this (non-JSON) media type is read as text rather than as a `Blob`. */
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
  /** Content-Type to send; `undefined` lets the transport choose (e.g. multipart boundaries). */
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
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    return { body: isForm ? body : toFormData(body, encoding), contentType: undefined };
  }
  if (type === 'application/x-www-form-urlencoded') {
    const isParams = typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams;
    return { body: isParams ? body : toSearchParams(body, encoding), contentType: mediaType };
  }
  // A wildcard (`*/*`, `text/*`) is not a Content-Type: JSON is labeled as such, and native bodies
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

/** Copies bytes into an `ArrayBuffer`-backed view, which every `Blob` implementation accepts. */
function bytesToBlob(value: ArrayBuffer | ArrayBufferView, contentType: string | undefined): Blob {
  const source =
    value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  return new Blob([copy], contentType === undefined ? {} : { type: contentType });
}

/** Converts an object into `FormData`. Arrays are sent as repeated fields unless `explode: false`. */
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

/** Appends an object property of a form body that declares `style` or `explode`. */
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
 * Converts an object into `URLSearchParams` (`form` style). Nested objects are sent as JSON unless
 * their `encoding` declares a `style` or `explode` (`deepObject` sends `name[key]=value`).
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
 * after the path and combined with `query`.
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
