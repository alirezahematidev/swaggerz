import type { OperationSymbol } from '../analysis/types.ts';
import type { ApiDocument, MediaTypeIR, ParameterIR, ResponseIR } from '../ir/types.ts';
import { defaultBaseUrl } from './client-module.ts';

export type ParseAsHint = 'blob' | 'text' | undefined;

export interface PlannedParameter {
  readonly property: string;
  readonly parameter: ParameterIR;
}

export interface PlannedResponse {
  readonly response: ResponseIR;
  /** Preferred media type, or `undefined` when the response has no body. */
  readonly media: MediaTypeIR | undefined;
}

/**
 * How the runtime serializes a request body of a media type. `raw` covers structured formats the
 * runtime cannot produce (XML and other non-JSON types): callers pass the encoded body.
 */
export type BodyKind = 'json' | 'multipart' | 'urlencoded' | 'text' | 'binary' | 'raw';

export interface PlannedBody {
  readonly property: string;
  /** Params property that selects the media type when there are alternatives. */
  readonly contentTypeProperty: string;
  /** The default media type. */
  readonly media: MediaTypeIR;
  /** Other accepted media types, in declaration order. */
  readonly alternatives: readonly MediaTypeIR[];
  readonly required: boolean;
}

/**
 * Generator-independent decisions about one operation: argument shape, preferred media types,
 * success/error responses and security. Shared by the operation, React Query and validation
 * generators and by the dashboard.
 */
export interface OperationPlan {
  readonly symbol: OperationSymbol;
  readonly parameters: readonly PlannedParameter[];
  readonly body: PlannedBody | undefined;
  /** Whether the function takes a params argument at all. */
  readonly hasParams: boolean;
  /** Whether the params argument is required (some parameter or the body is required). */
  readonly paramsRequired: boolean;
  readonly success: readonly PlannedResponse[];
  readonly errors: readonly PlannedResponse[];
  /** Declared non-2xx statuses that resolve (`304`, `3XX`); 2xx always resolves. */
  readonly successStatuses: readonly string[];
  /** Base URL of the operation's own server (operation or path `servers`), if declared. */
  readonly server: string | undefined;
  readonly accept: string | undefined;
  readonly parseAs: ParseAsHint;
  /** Alternative requirements as lists of scheme keys; `undefined` when no auth applies. */
  readonly security: readonly (readonly string[])[] | undefined;
}

const isJson = (mediaType: string): boolean => {
  const type = (mediaType.split(';')[0] ?? '').trim().toLowerCase();
  return type === 'application/json' || type.endsWith('+json') || type === '*/*';
};

function rank(media: MediaTypeIR, direction: 'request' | 'response'): number {
  const type = media.mediaType.toLowerCase();
  if (isJson(type)) return 0;
  if (direction === 'request' && type.startsWith('multipart/form-data')) return 1;
  if (direction === 'request' && type.startsWith('application/x-www-form-urlencoded')) return 2;
  if (type.startsWith('text/')) return 3;
  if (media.schema.kind === 'binary') return 4;
  return 5;
}

/** Picks the media type generated code uses: JSON first, then forms, text and binary. */
export function preferredMedia(
  contents: readonly MediaTypeIR[],
  direction: 'request' | 'response',
): MediaTypeIR | undefined {
  let best: MediaTypeIR | undefined;
  let bestRank = Infinity;
  for (const media of contents) {
    const value = rank(media, direction);
    if (value < bestRank) {
      best = media;
      bestRank = value;
    }
  }
  return best;
}

export function bodyKind(media: MediaTypeIR): BodyKind {
  const type = (media.mediaType.split(';')[0] ?? '').trim().toLowerCase();
  if (isJson(type)) return 'json';
  if (type === 'multipart/form-data') return 'multipart';
  if (type === 'application/x-www-form-urlencoded') return 'urlencoded';
  if (media.schema.kind === 'binary') return 'binary';
  if (type.startsWith('text/')) return 'text';
  // Strings and bytes are sent as-is; structured values need a serializer the runtime lacks.
  return media.schema.kind === 'string' ? 'text' : 'raw';
}

/** What the runtime makes of a response body: parsed JSON, a string or a `Blob`. */
export type ResponseKind = 'json' | 'text' | 'binary';

/** Non-JSON media types the runtime reads as text (mirrors `isTextMediaType` in the runtime). */
function isTextResponse(type: string): boolean {
  return (
    type.startsWith('text/') ||
    type === 'application/xml' ||
    type.endsWith('+xml') ||
    type === 'application/x-www-form-urlencoded' ||
    type === 'application/javascript' ||
    type === 'application/jsonl' ||
    type === 'application/x-ndjson' ||
    type === 'application/json-seq' ||
    type.endsWith('+json-seq')
  );
}

/**
 * How the runtime reads a response of a media type: successful responses by the operation's
 * `parseAs` hint, if any, everything else by `Content-Type` (JSON is parsed, text media types are
 * strings, other types `Blob`s). Pass `undefined` as `parseAs` for error responses.
 */
export function responseKind(media: MediaTypeIR, parseAs: ParseAsHint): ResponseKind {
  if (parseAs === 'blob') return 'binary';
  if (parseAs === 'text') return 'text';
  const type = (media.mediaType.split(';')[0] ?? '').trim().toLowerCase();
  if (isJson(type) || type === 'text/json') return 'json';
  if (media.schema.kind === 'binary') return 'binary';
  return isTextResponse(type) ? 'text' : 'binary';
}

/** 2xx responses, and declared 3xx responses (redirects that surface, such as `304`). */
export function isSuccessStatus(status: string): boolean {
  return /^[23](\d\d|XX)$/i.test(status);
}

export function planOperation(symbol: OperationSymbol, ir: ApiDocument): OperationPlan {
  const operation = symbol.operation;
  const parameters = operation.parameters.map((parameter, index) => ({
    property: symbol.parameterProperties[index] ?? parameter.name,
    parameter,
  }));
  const bodyMedia =
    operation.requestBody === undefined
      ? undefined
      : preferredMedia(operation.requestBody.contents, 'request');
  const body: PlannedBody | undefined =
    operation.requestBody === undefined || bodyMedia === undefined
      ? undefined
      : {
          property: symbol.bodyProperty,
          contentTypeProperty: symbol.contentTypeProperty,
          media: bodyMedia,
          alternatives: operation.requestBody.contents.filter((media) => media !== bodyMedia),
          required: operation.requestBody.required,
        };

  const hasSuccess = operation.responses.some((r) => /^2(\d\d|XX)$/i.test(r.status));
  const isSuccess = (r: ResponseIR): boolean =>
    hasSuccess ? isSuccessStatus(r.status) : r.status === 'default';
  const planned = (r: ResponseIR): PlannedResponse => ({
    response: r,
    media: preferredMedia(r.contents, 'response'),
  });
  const success = operation.responses.filter(isSuccess).map(planned);
  const errors = operation.responses.filter((r) => !isSuccess(r)).map(planned);

  const successMedia = success.map((s) => s.media).filter((m): m is MediaTypeIR => m !== undefined);
  const accept = successMedia[0]?.mediaType;
  let parseAs: ParseAsHint;
  if (successMedia.length > 0 && successMedia.every((m) => m.schema.kind === 'binary'))
    parseAs = 'blob';
  else if (
    successMedia.length > 0 &&
    // Sequential media types described by `itemSchema` (OpenAPI 3.2) are read as text for now.
    successMedia.every(
      (m) => m.mediaType.toLowerCase().startsWith('text/') || m.itemSchema !== undefined,
    )
  )
    parseAs = 'text';

  const requirements = operation.security ?? ir.security;
  const security =
    requirements.length === 0
      ? undefined
      : requirements.map((requirement) => Object.keys(requirement).sort());

  return {
    symbol,
    parameters,
    body,
    hasParams: parameters.length > 0 || body !== undefined,
    paramsRequired: parameters.some((p) => p.parameter.required) || body?.required === true,
    success,
    errors,
    successStatuses: success
      .map((s) => s.response.status.toUpperCase())
      .filter((status) => status.startsWith('3')),
    server:
      operation.servers === undefined || operation.servers.length === 0
        ? undefined
        : defaultBaseUrl(operation.servers, undefined),
    accept: accept === '*/*' ? undefined : accept,
    parseAs,
    security,
  };
}
