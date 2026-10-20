import type { ParamLocation, ParamSerialization, ParamStyle, PropertyEncoding } from './types.js';

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

/** Keeps RFC 3986 reserved characters, as requested by `allowReserved`. */
const encodeReserved: Encoder = (value) =>
  value.replace(/[^A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]/g, (c) => encodeURIComponent(c));

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
      if (style === 'deepObject') parts.push(...deepObjectPairs(key, value, encode));
      else if (explode) {
        for (const [property, item] of entriesOf(value)) {
          parts.push(`${encodeStrict(property)}=${encode(primitiveToString(item))}`);
        }
      } else {
        const flat = entriesOf(value).flatMap(([property, item]) => [
          encode(property),
          encode(primitiveToString(item)),
        ]);
        parts.push(`${key}=${flat.join(',')}`);
      }
    } else {
      parts.push(`${key}=${encode(primitiveToString(value))}`);
    }
  }
  return parts.join('&');
}

function deepObjectPairs(prefix: string, value: unknown, encode: Encoder): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => deepObjectPairs(`${prefix}[${index}]`, item, encode));
  }
  if (isObject(value)) {
    return entriesOf(value).flatMap(([key, item]) =>
      deepObjectPairs(`${prefix}[${encodeStrict(key)}]`, item, encode),
    );
  }
  if (value === undefined || value === null) return [];
  return [`${prefix}=${encode(primitiveToString(value))}`];
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
  if (type === '' || isJsonMediaType(type)) {
    if (type === '' && isNativeBody(body)) return { body, contentType: undefined };
    return { body: JSON.stringify(body), contentType: mediaType ?? 'application/json' };
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

/** Converts an object into `URLSearchParams` (`form` style; nested objects are sent as JSON). */
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
      params.append(name, JSON.stringify(value));
    } else {
      params.append(name, primitiveToString(value));
    }
  }
  return params;
}

/** Joins a base URL and a path without duplicating slashes. */
export function joinUrl(baseUrl: string, path: string, query: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const url = base + path;
  if (query === '') return url;
  return url + (url.includes('?') ? '&' : '?') + query;
}
