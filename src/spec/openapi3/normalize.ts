import {
  IR_VERSION,
  type ApiDocument,
  type EncodingIR,
  type HeaderIR,
  type HttpMethod,
  type MediaTypeIR,
  type OAuthFlowIR,
  type OperationIR,
  type ParameterIR,
  type ParameterLocation,
  type ParameterStyle,
  type RequestBodyIR,
  type ResponseIR,
  type SchemaIR,
  type SecurityRequirementIR,
  type SecuritySchemeIR,
  type ServerIR,
  type WebhookIR,
  isStandardMethod,
} from '../../ir/types.ts';
import { pickMeta } from '../../ir/utils.ts';
import { isRecord, setOwn } from '../../utils/object.ts';
import { compareStrings } from '../../utils/strings.ts';
import {
  bool,
  child,
  entries,
  has,
  keysOf,
  readExtensions,
  str,
  type Cursor,
  type ParseContext,
} from '../context.ts';
import { parsePointer } from '../../loader/pointer.ts';
import { looksLikeReference } from '../../loader/refs.ts';
import { SchemaConverter } from '../schema/converter.ts';
import type { SchemaDialect } from '../schema/dialects.ts';
import {
  checkTagParents,
  isBinaryMediaType,
  isHttpMethod,
  isValidStatus,
  operationLabel,
  pathTemplateParams,
  readExamplesMap,
  readExternalDocs,
  readInfo,
  readSecurity,
  readStringArray,
  readTags,
  resolveServerUrl,
  singleExample,
  sortOperations,
  sortResponses,
  stripUndefined,
} from '../shared.ts';

const LOCATIONS: ReadonlySet<string> = new Set<ParameterLocation>([
  'path',
  'query',
  'header',
  'cookie',
]);
const STYLES: ReadonlySet<string> = new Set<ParameterStyle>([
  'matrix',
  'label',
  'form',
  'simple',
  'spaceDelimited',
  'pipeDelimited',
  'deepObject',
]);
/** An HTTP method token (RFC 9110). */
const METHOD_TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

type Version = '3.0' | '3.1' | '3.2';

/** Version-dependent document structure (schemas differ through the dialect). */
interface Structure {
  readonly version: Version;
  /** OpenAPI 3.2 additions: `query`, `additionalOperations`, `querystring`, `style: cookie`, … */
  readonly v32: boolean;
  /** OpenAPI 3.2: security requirements may name a scheme by URI. */
  readonly resolveSchemeUri?: (key: string, at: Cursor) => string | undefined;
}

/** Maps the URI of a security scheme in `components.securitySchemes` to its name. */
function schemeUriResolver(ctx: ParseContext): (key: string, at: Cursor) => string | undefined {
  return (key, at) => {
    if (!looksLikeReference(key)) return undefined;
    const resolved = ctx.store.resolve(key, at.doc, at.pointer);
    if (resolved === undefined || resolved.doc.url !== ctx.store.root.url) return undefined;
    const segments = parsePointer(resolved.pointer) ?? [];
    return segments.length === 3 &&
      segments[0] === 'components' &&
      segments[1] === 'securitySchemes'
      ? segments[2]
      : undefined;
  };
}
const IGNORED_HEADERS = new Set(['accept', 'content-type', 'authorization']);

/**
 * Normalizes OpenAPI 3.0 and 3.1 documents. Document structure is shared between the two
 * versions; schema semantics differ and are provided by `dialect`.
 */
export function normalizeOpenApi3(
  ctx: ParseContext,
  dialect: SchemaDialect,
  version: Version,
  rawVersion: string,
): ApiDocument {
  const root = ctx.root;
  const converter = new SchemaConverter(ctx, dialect);
  const structure: Structure =
    version === '3.2'
      ? { version, v32: true, resolveSchemeUri: schemeUriResolver(ctx) }
      : { version, v32: false };

  validateRoot(ctx, version);

  for (const [, schema] of sortedEntries(child(root, 'components', 'schemas'))) {
    converter.registerComponent(schema);
  }

  const securitySchemes = readSecuritySchemes(ctx, child(root, 'components', 'securitySchemes'));
  const schemeNames = new Set(securitySchemes.map((scheme) => scheme.key));
  const operations: OperationIR[] = [];

  const paths = child(root, 'paths');
  for (const [path, rawItem] of entries(paths)) {
    // Specification extensions are allowed in the Paths Object.
    if (path.startsWith('x-')) continue;
    if (!path.startsWith('/')) {
      ctx.error('spec/invalid-path', `Path "${path}" must start with "/".`, rawItem);
      continue;
    }
    const pathItem = ctx.deref(rawItem);
    if (pathItem === undefined || !isRecord(pathItem.value)) continue;
    const pathParameters = child(pathItem, 'parameters');
    const pathServers = readServers(child(pathItem, 'servers'));
    for (const [method, cursor] of pathItemOperations(ctx, pathItem, structure)) {
      const operation = convertOperation(ctx, converter, structure, {
        cursor,
        method,
        path,
        pathParameters,
        pathServers,
        schemeNames,
        pathItem,
      });
      if (operation !== undefined) operations.push(operation);
    }
  }

  const webhooks: WebhookIR[] = [];
  if (version !== '3.0') {
    for (const [name, rawItem] of sortedEntries(child(root, 'webhooks'))) {
      const webhookOperations = convertPathItem(ctx, converter, structure, rawItem, schemeNames, {
        kind: 'webhook',
        path: '',
        keyPrefix: `webhook:${name}`,
      });
      if (webhookOperations.length > 0) webhooks.push({ name, operations: webhookOperations });
    }
  }
  reportDuplicateOperationIds(ctx, operations);
  const documentSecurity =
    readSecurity(ctx, child(root, 'security'), schemeNames, structure.resolveSchemeUri) ?? [];
  reportQuerystringCredentials(ctx, operations, securitySchemes, documentSecurity);

  const externalDocs = readExternalDocs(child(root, 'externalDocs'));
  return {
    irVersion: IR_VERSION,
    specVersion: version,
    specVersionRaw: rawVersion,
    info: readInfo(ctx, child(root, 'info')),
    servers: readServers(child(root, 'servers')),
    operations: sortOperations(operations),
    schemas: converter.finalize(),
    webhooks,
    securitySchemes,
    security: documentSecurity,
    tags: structure.v32
      ? checkTagParents(ctx, child(root, 'tags'), readTags(child(root, 'tags'), true))
      : readTags(child(root, 'tags')),
    ...(externalDocs === undefined ? {} : { externalDocs }),
    extensions: readExtensions(root),
    sources: ctx.sources(),
  };
}

function validateRoot(ctx: ParseContext, version: Version): void {
  const root = ctx.root;
  if (version === '3.0' && !isRecord(child(root, 'paths').value)) {
    ctx.error('spec/missing-field', 'OpenAPI 3.0 documents require a `paths` object.', root);
  }
  if (
    version !== '3.0' &&
    !has(root, 'paths') &&
    !has(root, 'components') &&
    !has(root, 'webhooks')
  ) {
    ctx.error(
      'spec/missing-field',
      `OpenAPI ${version} documents require at least one of \`paths\`, \`components\` or \`webhooks\`.`,
      root,
    );
  }
  const dialectUri = str(root, 'jsonSchemaDialect');
  if (
    version !== '3.0' &&
    dialectUri !== undefined &&
    dialectUri !== 'https://spec.openapis.org/oas/3.1/dialect/base' &&
    !(version === '3.2' && dialectUri.startsWith('https://spec.openapis.org/oas/3.2/dialect/')) &&
    dialectUri !== 'https://json-schema.org/draft/2020-12/schema'
  ) {
    ctx.warning(
      'spec/unsupported-dialect',
      `jsonSchemaDialect "${dialectUri}" is not supported; schemas are interpreted as the OpenAPI ${version} base dialect.`,
      child(root, 'jsonSchemaDialect'),
    );
  }
}

function sortedEntries(cursor: Cursor): [string, Cursor][] {
  return entries(cursor).sort(([a], [b]) => compareStrings(a, b));
}

export function readServers(cursor: Cursor): ServerIR[] {
  if (!Array.isArray(cursor.value)) return [];
  const result: ServerIR[] = [];
  cursor.value.forEach((_, index) => {
    const server = child(cursor, index);
    const url = str(server, 'url');
    if (url === undefined) return;
    const variables: Record<string, { default: string; enum?: string[]; description?: string }> =
      {};
    for (const [name, variable] of entries(child(server, 'variables'))) {
      const defaultValue = str(variable, 'default');
      if (defaultValue === undefined) continue;
      const enumValues = readStringArray(child(variable, 'enum'));
      setOwn(variables, name, {
        default: defaultValue,
        ...(enumValues.length > 0 ? { enum: enumValues } : {}),
        ...stripUndefined({ description: str(variable, 'description') }),
      });
    }
    result.push({
      // Relative to the document that declares the server.
      url: resolveServerUrl(url, cursor.doc.url),
      variables,
      ...stripUndefined({ name: str(server, 'name'), description: str(server, 'description') }),
    });
  });
  return result;
}

interface OperationInput {
  readonly cursor: Cursor;
  readonly method: HttpMethod;
  readonly path: string;
  readonly pathParameters: Cursor;
  readonly pathServers: ServerIR[];
  readonly schemeNames: ReadonlySet<string>;
  readonly pathItem: Cursor;
  /** Webhooks and callbacks have no path template and a synthetic key. */
  readonly kind?: 'operation' | 'webhook' | 'callback';
  readonly keyPrefix?: string;
}

/**
 * The operations of a path item: the method fields, and in OpenAPI 3.2 `query` and
 * `additionalOperations` (methods sent exactly as their key is spelled).
 */
function pathItemOperations(
  ctx: ParseContext,
  pathItem: Cursor,
  structure: Structure,
): [HttpMethod, Cursor][] {
  const result: [HttpMethod, Cursor][] = [];
  for (const key of keysOf(pathItem)) {
    if (!isHttpMethod(key) || (key === 'query' && !structure.v32)) continue;
    result.push([key, child(pathItem, key)]);
  }
  if (!structure.v32) return result;
  for (const [method, cursor] of entries(child(pathItem, 'additionalOperations'))) {
    if (isStandardMethod(method.toLowerCase())) {
      ctx.error(
        'operation/reserved-method',
        `additionalOperations must not define "${method}"; use the path item's \`${method.toLowerCase()}\` field.`,
        cursor,
      );
    } else if (!METHOD_TOKEN.test(method)) {
      ctx.error('operation/invalid-method', `"${method}" is not a valid HTTP method.`, cursor);
    } else {
      result.push([method, cursor]);
    }
  }
  return result;
}

/** Converts the operations of a webhook or callback path item (which may be a `$ref`). */
function convertPathItem(
  ctx: ParseContext,
  converter: SchemaConverter,
  structure: Structure,
  rawItem: Cursor,
  schemeNames: ReadonlySet<string>,
  options: { kind: 'webhook' | 'callback'; path: string; keyPrefix: string },
): OperationIR[] {
  const pathItem = ctx.deref(rawItem);
  if (pathItem === undefined || !isRecord(pathItem.value)) return [];
  const result: OperationIR[] = [];
  for (const [method, cursor] of pathItemOperations(ctx, pathItem, structure)) {
    const operation = convertOperation(ctx, converter, structure, {
      cursor,
      method,
      path: options.path,
      pathParameters: child(pathItem, 'parameters'),
      pathServers: readServers(child(pathItem, 'servers')),
      schemeNames,
      pathItem,
      kind: options.kind,
      keyPrefix: options.keyPrefix,
    });
    if (operation !== undefined) result.push(operation);
  }
  return sortOperations(result);
}

/** Converts `callbacks`: name → { expression → path item }, where both levels may be `$ref`s. */
function convertCallbacks(
  ctx: ParseContext,
  converter: SchemaConverter,
  structure: Structure,
  cursor: Cursor,
  schemeNames: ReadonlySet<string>,
  ownerKey: string,
): WebhookIR[] {
  const callbacks: WebhookIR[] = [];
  for (const [name, rawCallback] of sortedEntries(cursor)) {
    const callback = ctx.deref(rawCallback);
    if (callback === undefined || !isRecord(callback.value)) continue;
    for (const [expression, rawItem] of sortedEntries(callback)) {
      if (expression.startsWith('x-')) continue;
      const operations = convertPathItem(ctx, converter, structure, rawItem, schemeNames, {
        kind: 'callback',
        path: expression,
        keyPrefix: `${ownerKey} callback:${name} ${expression}`,
      });
      if (operations.length > 0) callbacks.push({ name, expression, operations });
    }
  }
  return callbacks;
}

function convertOperation(
  ctx: ParseContext,
  converter: SchemaConverter,
  structure: Structure,
  input: OperationInput,
): OperationIR | undefined {
  const { method, path } = input;
  const cursor = ctx.derefNonStandard(
    input.cursor,
    `The ${method.toUpperCase()} ${path} operation`,
  );
  if (cursor === undefined) return undefined;
  if (!isRecord(cursor.value)) {
    ctx.error(
      'spec/invalid-operation',
      `${method.toUpperCase()} ${path}: the operation must be an object.`,
      cursor,
    );
    return undefined;
  }
  const operationId = str(cursor, 'operationId');
  const kind = input.kind ?? 'operation';
  const label =
    kind === 'operation'
      ? operationLabel(method, path, operationId)
      : `${kind} ${input.keyPrefix ?? ''} ${method.toUpperCase()}`;
  const key = input.keyPrefix === undefined ? `${method} ${path}` : `${input.keyPrefix} ${method}`;

  const parameters = mergeParameters(
    ctx,
    converter,
    structure,
    input.pathParameters,
    child(cursor, 'parameters'),
    label,
  );
  if (kind === 'operation') checkPathParameters(ctx, path, parameters, cursor, label);

  const requestBody = has(cursor, 'requestBody')
    ? convertRequestBody(ctx, converter, structure, child(cursor, 'requestBody'), label)
    : undefined;
  if (
    requestBody !== undefined &&
    kind === 'operation' &&
    (method === 'get' || method === 'head')
  ) {
    ctx.warning(
      'operation/body-on-get',
      `${method.toUpperCase()} requests with a body are not portable; browsers' fetch rejects them.`,
      child(cursor, 'requestBody'),
      { operation: label },
    );
  }

  const responses: ResponseIR[] = [];
  const responsesCursor = child(cursor, 'responses');
  // `responses` is required in OpenAPI 3.0 and optional since 3.1.
  if (!isRecord(responsesCursor.value) && structure.version === '3.0') {
    ctx.warning('spec/missing-field', 'Operation has no `responses` object.', cursor, {
      operation: label,
    });
  }
  for (const [status, rawResponse] of entries(responsesCursor)) {
    if (status.startsWith('x-')) continue;
    if (!isValidStatus(status)) {
      ctx.warning(
        'operation/invalid-status',
        `Invalid response status "${status}"; it is ignored.`,
        rawResponse,
        { operation: label },
      );
      continue;
    }
    const response = convertResponse(
      ctx,
      converter,
      structure,
      rawResponse,
      /^[1-5]xx$/i.test(status) ? status.toUpperCase() : status,
      label,
    );
    if (response !== undefined) responses.push(response);
  }

  const callbacks =
    kind === 'operation' && has(cursor, 'callbacks')
      ? convertCallbacks(
          ctx,
          converter,
          structure,
          child(cursor, 'callbacks'),
          input.schemeNames,
          key,
        )
      : [];

  const security = readSecurity(
    ctx,
    child(cursor, 'security'),
    input.schemeNames,
    structure.resolveSchemeUri,
  );
  const servers = readServers(child(cursor, 'servers'));
  const effectiveServers = servers.length > 0 ? servers : input.pathServers;
  const externalDocs = readExternalDocs(child(cursor, 'externalDocs'));
  const summary = str(cursor, 'summary') ?? str(input.pathItem, 'summary');
  const description = str(cursor, 'description') ?? str(input.pathItem, 'description');

  return {
    key,
    ...(operationId === undefined ? {} : { operationId }),
    method,
    path,
    ...stripUndefined({ summary, description }),
    tags: readStringArray(child(cursor, 'tags')),
    deprecated: bool(cursor, 'deprecated') === true,
    parameters,
    ...(requestBody === undefined ? {} : { requestBody }),
    responses: sortResponses(responses),
    ...(security === undefined ? {} : { security }),
    ...(effectiveServers.length > 0 ? { servers: effectiveServers } : {}),
    ...(externalDocs === undefined ? {} : { externalDocs }),
    ...(callbacks.length > 0 ? { callbacks } : {}),
    extensions: readExtensions(cursor),
    source: ctx.sourceRef(cursor),
  };
}

function mergeParameters(
  ctx: ParseContext,
  converter: SchemaConverter,
  structure: Structure,
  pathLevel: Cursor,
  operationLevel: Cursor,
  label: string,
): ParameterIR[] {
  const merged = new Map<string, ParameterIR>();
  for (const list of [pathLevel, operationLevel]) {
    if (list.value === undefined) continue;
    if (!Array.isArray(list.value)) {
      ctx.error('spec/invalid-parameters', '`parameters` must be an array.', list, {
        operation: label,
      });
      continue;
    }
    const seen = new Set<string>();
    list.value.forEach((_, index) => {
      const parameter = convertParameter(ctx, converter, structure, child(list, index), label);
      if (parameter === undefined) return;
      const key = `${parameter.in}:${parameter.in === 'header' ? parameter.name.toLowerCase() : parameter.name}`;
      if (seen.has(key)) {
        ctx.error(
          'operation/duplicate-parameter',
          `Parameter "${parameter.name}" in ${parameter.in} is declared twice.`,
          child(list, index),
          { operation: label },
        );
        return;
      }
      seen.add(key);
      merged.set(key, parameter);
    });
  }
  const parameters = [...merged.values()];
  const querystrings = parameters.filter((parameter) => parameter.in === 'querystring');
  const at = operationLevel.value === undefined ? pathLevel : operationLevel;
  if (querystrings.length > 1) {
    ctx.error(
      'operation/invalid-querystring',
      `Only one querystring parameter is allowed; found ${querystrings.map((p) => `"${p.name}"`).join(', ')}.`,
      at,
      { operation: label },
    );
  } else if (
    querystrings.length === 1 &&
    parameters.some((parameter) => parameter.in === 'query')
  ) {
    ctx.error(
      'operation/invalid-querystring',
      `The querystring parameter "${querystrings[0]?.name ?? ''}" describes the whole query string; it cannot be combined with query parameters.`,
      at,
      { operation: label },
    );
  }
  return parameters;
}

function convertParameter(
  ctx: ParseContext,
  converter: SchemaConverter,
  structure: Structure,
  raw: Cursor,
  label: string,
): ParameterIR | undefined {
  const cursor = ctx.deref(raw);
  if (cursor === undefined) return undefined;
  if (!isRecord(cursor.value)) {
    ctx.error('spec/invalid-parameter', 'Parameter must be an object.', cursor, {
      operation: label,
    });
    return undefined;
  }
  const name = str(cursor, 'name');
  const location = str(cursor, 'in');
  if (name === undefined || location === undefined) {
    ctx.error('spec/invalid-parameter', 'Parameter requires `name` and `in`.', cursor, {
      operation: label,
    });
    return undefined;
  }
  if (!LOCATIONS.has(location) && !(structure.v32 && location === 'querystring')) {
    ctx.error(
      'spec/invalid-parameter',
      `Parameter "${name}" has invalid location "${location}".`,
      child(cursor, 'in'),
      { operation: label },
    );
    return undefined;
  }
  const where = location as ParameterLocation;
  if (where === 'header' && IGNORED_HEADERS.has(name.toLowerCase())) {
    ctx.info(
      'operation/ignored-header',
      `Header parameter "${name}" is ignored; it is controlled by the request content or authentication.`,
      cursor,
      { operation: label },
    );
    return undefined;
  }

  let required = bool(cursor, 'required') === true;
  if (where === 'path' && !required) {
    ctx.warning(
      'operation/optional-path-parameter',
      `Path parameter "${name}" must be required; it is treated as required.`,
      cursor,
      { operation: label },
    );
    required = true;
  }

  let schema: SchemaIR;
  let contentType: string | undefined;
  let encoding: Record<string, EncodingIR> | undefined;
  if (where === 'querystring' && has(cursor, 'schema')) {
    ctx.error(
      'spec/invalid-parameter',
      `The querystring parameter "${name}" must describe its media type with \`content\`, not \`schema\`.`,
      cursor,
      { operation: label },
    );
    return undefined;
  }
  if (has(cursor, 'schema')) {
    schema = converter.convert(child(cursor, 'schema'));
  } else if (isRecord(child(cursor, 'content').value)) {
    const [mediaType, rawMedia] = entries(child(cursor, 'content'))[0] ?? [];
    const media = rawMedia === undefined ? undefined : ctx.deref(rawMedia);
    contentType = mediaType;
    schema =
      media !== undefined && has(media, 'schema')
        ? converter.convert(child(media, 'schema'))
        : { kind: 'unknown' };
    if (where === 'querystring' && media !== undefined) encoding = readEncoding(media);
  } else {
    ctx.warning(
      'spec/invalid-parameter',
      `Parameter "${name}" has neither \`schema\` nor \`content\`; it is typed as unknown.`,
      cursor,
      { operation: label },
    );
    schema = { kind: 'unknown' };
  }

  const defaultStyle: ParameterStyle =
    where === 'query' || where === 'querystring' || where === 'cookie' ? 'form' : 'simple';
  const rawStyle = str(cursor, 'style');
  let style: ParameterStyle = defaultStyle;
  if (rawStyle !== undefined) {
    if (STYLES.has(rawStyle) || (structure.v32 && rawStyle === 'cookie' && where === 'cookie'))
      style = rawStyle as ParameterStyle;
    else
      ctx.warning(
        'operation/invalid-style',
        `Unknown parameter style "${rawStyle}"; "${defaultStyle}" is used.`,
        child(cursor, 'style'),
        { operation: label },
      );
  }
  const explode = bool(cursor, 'explode') ?? (style === 'form' || style === 'cookie');
  const examples = [...singleExample(cursor), ...readExamplesMap(ctx, child(cursor, 'examples'))];
  // Parameters described by `content` may carry their examples on the media type.
  if (examples.length === 0 && contentType !== undefined) {
    const media = ctx.deref(child(cursor, 'content', contentType));
    if (media !== undefined)
      examples.push(...singleExample(media), ...readExamplesMap(ctx, child(media, 'examples')));
  }

  return {
    name,
    in: where,
    required,
    deprecated: bool(cursor, 'deprecated') === true,
    ...stripUndefined({ description: str(cursor, 'description'), contentType }),
    ...(encoding === undefined || Object.keys(encoding).length === 0 ? {} : { encoding }),
    schema,
    style,
    explode,
    allowReserved: bool(cursor, 'allowReserved') === true,
    examples,
    extensions: readExtensions(cursor),
    source: ctx.sourceRef(cursor),
  };
}

function checkPathParameters(
  ctx: ParseContext,
  path: string,
  parameters: ParameterIR[],
  cursor: Cursor,
  label: string,
): void {
  const templated = pathTemplateParams(path);
  const declared = new Set(parameters.filter((p) => p.in === 'path').map((p) => p.name));
  for (const name of templated) {
    if (!declared.has(name)) {
      ctx.warning(
        'operation/missing-path-parameter',
        `Path parameter "${name}" is used in the path but not declared; it is typed as string.`,
        cursor,
        { operation: label },
      );
      parameters.unshift({
        name,
        in: 'path',
        required: true,
        deprecated: false,
        schema: { kind: 'string' },
        style: 'simple',
        explode: false,
        allowReserved: false,
        examples: [],
        extensions: {},
        source: ctx.sourceRef(cursor),
      });
    }
  }
  for (const name of declared) {
    if (!templated.includes(name)) {
      ctx.warning(
        'operation/unused-path-parameter',
        `Path parameter "${name}" is declared but does not appear in the path.`,
        cursor,
        { operation: label },
      );
    }
  }
}

/** The `encoding` map of a Media Type Object (forms and multipart). */
function readEncoding(media: Cursor): Record<string, EncodingIR> {
  const encoding: Record<string, EncodingIR> = {};
  for (const [property, enc] of entries(child(media, 'encoding'))) {
    const style = str(enc, 'style');
    const explode = bool(enc, 'explode');
    encoding[property] = {
      ...stripUndefined({ contentType: str(enc, 'contentType') }),
      ...(style !== undefined && STYLES.has(style) ? { style: style as ParameterStyle } : {}),
      ...(explode === undefined ? {} : { explode }),
    };
  }
  return encoding;
}

function convertMediaTypes(
  ctx: ParseContext,
  converter: SchemaConverter,
  structure: Structure,
  content: Cursor,
): MediaTypeIR[] {
  const result: MediaTypeIR[] = [];
  for (const [mediaType, raw] of entries(content)) {
    // OpenAPI 3.2 media types may be references (components.mediaTypes).
    const media = ctx.deref(raw);
    if (media === undefined) continue;
    const itemSchema =
      structure.v32 && has(media, 'itemSchema')
        ? converter.convert(child(media, 'itemSchema'))
        : undefined;
    let schema: SchemaIR;
    if (has(media, 'schema')) {
      schema = converter.convert(child(media, 'schema'));
    } else if (itemSchema !== undefined) {
      ctx.info(
        'operation/item-schema',
        `${mediaType} is only described by \`itemSchema\`; the whole content is typed as text (streaming is not generated yet).`,
        child(media, 'itemSchema'),
      );
      schema = { kind: 'string' };
    } else {
      schema = { kind: 'unknown' };
    }
    if (
      isBinaryMediaType(mediaType) &&
      (schema.kind === 'unknown' ||
        (schema.kind === 'string' &&
          schema.format === undefined &&
          schema.constraints?.contentEncoding === undefined))
    ) {
      schema = { ...pickMeta(schema), kind: 'binary' };
    }
    const encoding = readEncoding(media);
    result.push({
      mediaType,
      schema,
      ...(itemSchema === undefined ? {} : { itemSchema }),
      examples: [...singleExample(media), ...readExamplesMap(ctx, child(media, 'examples'))],
      ...(Object.keys(encoding).length > 0 ? { encoding } : {}),
    });
  }
  return result;
}

function convertRequestBody(
  ctx: ParseContext,
  converter: SchemaConverter,
  structure: Structure,
  raw: Cursor,
  label: string,
): RequestBodyIR | undefined {
  const cursor = ctx.deref(raw);
  if (cursor === undefined || !isRecord(cursor.value)) return undefined;
  const contents = convertMediaTypes(ctx, converter, structure, child(cursor, 'content'));
  if (contents.length === 0) {
    ctx.warning(
      'operation/empty-request-body',
      'Request body declares no content types; it is ignored.',
      cursor,
      { operation: label },
    );
    return undefined;
  }
  return {
    required: bool(cursor, 'required') === true,
    ...stripUndefined({ description: str(cursor, 'description') }),
    contents,
    extensions: readExtensions(cursor),
    source: ctx.sourceRef(cursor),
  };
}

function convertResponse(
  ctx: ParseContext,
  converter: SchemaConverter,
  structure: Structure,
  raw: Cursor,
  status: string,
  label: string,
): ResponseIR | undefined {
  const cursor = ctx.deref(raw);
  if (cursor === undefined) return undefined;
  if (!isRecord(cursor.value)) {
    ctx.error('spec/invalid-response', `Response ${status} must be an object.`, cursor, {
      operation: label,
    });
    return undefined;
  }
  const headers: HeaderIR[] = [];
  for (const [name, rawHeader] of entries(child(cursor, 'headers'))) {
    const header = ctx.deref(rawHeader);
    if (header === undefined || name.toLowerCase() === 'content-type') continue;
    let schema: SchemaIR = { kind: 'unknown' };
    if (has(header, 'schema')) schema = converter.convert(child(header, 'schema'));
    else if (isRecord(child(header, 'content').value)) {
      const [, rawMedia] = entries(child(header, 'content'))[0] ?? [];
      const media = rawMedia === undefined ? undefined : ctx.deref(rawMedia);
      if (media !== undefined && has(media, 'schema'))
        schema = converter.convert(child(media, 'schema'));
    }
    headers.push({
      name,
      required: bool(header, 'required') === true,
      deprecated: bool(header, 'deprecated') === true,
      ...stripUndefined({ description: str(header, 'description') }),
      schema,
    });
  }
  return {
    status,
    ...stripUndefined({
      summary: structure.v32 ? str(cursor, 'summary') : undefined,
      description: str(cursor, 'description'),
    }),
    contents: convertMediaTypes(ctx, converter, structure, child(cursor, 'content')),
    headers,
    extensions: readExtensions(cursor),
    source: ctx.sourceRef(cursor),
  };
}

function readSecuritySchemes(ctx: ParseContext, cursor: Cursor): SecuritySchemeIR[] {
  const result: SecuritySchemeIR[] = [];
  for (const [key, raw] of sortedEntries(cursor)) {
    const scheme = ctx.deref(raw);
    if (scheme === undefined || !isRecord(scheme.value)) continue;
    const base = {
      key,
      ...stripUndefined({ description: str(scheme, 'description') }),
      ...(bool(scheme, 'deprecated') === true ? { deprecated: true } : {}),
      extensions: readExtensions(scheme),
      source: ctx.sourceRef(scheme),
    };
    const type = str(scheme, 'type');
    switch (type) {
      case 'apiKey': {
        const name = str(scheme, 'name');
        const where = str(scheme, 'in');
        if (name === undefined || (where !== 'header' && where !== 'query' && where !== 'cookie')) {
          ctx.error(
            'security/invalid-scheme',
            `apiKey scheme "${key}" requires \`name\` and \`in\` (header, query or cookie).`,
            scheme,
          );
          continue;
        }
        result.push({ ...base, type: 'apiKey', name, in: where });
        break;
      }
      case 'http': {
        const httpScheme = str(scheme, 'scheme');
        if (httpScheme === undefined) {
          ctx.error('security/invalid-scheme', `http scheme "${key}" requires \`scheme\`.`, scheme);
          continue;
        }
        result.push({
          ...base,
          type: 'http',
          scheme: httpScheme.toLowerCase(),
          ...stripUndefined({ bearerFormat: str(scheme, 'bearerFormat') }),
        });
        break;
      }
      case 'oauth2': {
        const flows = child(scheme, 'flows');
        const readFlow = (name: string): OAuthFlowIR | undefined => {
          const flow = child(flows, name);
          if (!isRecord(flow.value)) return undefined;
          const scopes: Record<string, string> = {};
          for (const [scope, description] of entries(child(flow, 'scopes'))) {
            scopes[scope] = typeof description.value === 'string' ? description.value : '';
          }
          return {
            scopes,
            ...stripUndefined({
              authorizationUrl: str(flow, 'authorizationUrl'),
              deviceAuthorizationUrl: str(flow, 'deviceAuthorizationUrl'),
              tokenUrl: str(flow, 'tokenUrl'),
              refreshUrl: str(flow, 'refreshUrl'),
            }),
          };
        };
        const flowEntries = (
          [
            'implicit',
            'password',
            'clientCredentials',
            'authorizationCode',
            'deviceAuthorization',
          ] as const
        )
          .map((name) => [name, readFlow(name)] as const)
          .filter(
            (entry): entry is readonly [(typeof entry)[0], OAuthFlowIR] => entry[1] !== undefined,
          );
        result.push({
          ...base,
          type: 'oauth2',
          flows: Object.fromEntries(flowEntries),
          ...stripUndefined({ oauth2MetadataUrl: str(scheme, 'oauth2MetadataUrl') }),
        });
        break;
      }
      case 'openIdConnect': {
        const url = str(scheme, 'openIdConnectUrl');
        if (url === undefined) {
          ctx.error(
            'security/invalid-scheme',
            `openIdConnect scheme "${key}" requires \`openIdConnectUrl\`.`,
            scheme,
          );
          continue;
        }
        result.push({ ...base, type: 'openIdConnect', openIdConnectUrl: url });
        break;
      }
      case 'mutualTLS':
        result.push({ ...base, type: 'mutualTLS' });
        break;
      default:
        ctx.error(
          'security/invalid-scheme',
          `Security scheme "${key}" has unknown type "${type ?? ''}".`,
          scheme,
        );
    }
  }
  return result;
}

/**
 * A JSON or text `querystring` parameter (OpenAPI 3.2) is the whole query string, so API keys
 * declared `in: query` cannot be added to it; the runtime skips such security requirements.
 */
function reportQuerystringCredentials(
  ctx: ParseContext,
  operations: readonly OperationIR[],
  schemes: readonly SecuritySchemeIR[],
  documentSecurity: readonly SecurityRequirementIR[],
): void {
  const inQuery = new Set(
    schemes.filter((s) => s.type === 'apiKey' && s.in === 'query').map((s) => s.key),
  );
  if (inQuery.size === 0) return;
  for (const operation of operations) {
    const querystring = operation.parameters.find((p) => p.in === 'querystring');
    const type = (querystring?.contentType ?? 'application/x-www-form-urlencoded')
      .split(';')[0]
      ?.trim()
      .toLowerCase();
    if (querystring === undefined || type === 'application/x-www-form-urlencoded') continue;
    const requirements = (operation.security ?? documentSecurity).filter(
      (requirement) => Object.keys(requirement).length > 0,
    );
    const blocked = requirements.filter((requirement) =>
      Object.keys(requirement).some((key) => inQuery.has(key)),
    );
    if (blocked.length === 0) continue;
    const keys = [...new Set(blocked.flatMap((r) => Object.keys(r).filter((k) => inQuery.has(k))))];
    const label = operationLabel(operation.method, operation.path, operation.operationId);
    ctx.diagnostics.warning({
      code: 'operation/querystring-credentials',
      message: `${label}: the query string is a ${type} document, so the API key${keys.length === 1 ? '' : 's'} ${keys.map((k) => `"${k}"`).join(', ')} sent in the query cannot be added to it. ${blocked.length === requirements.length ? 'Requests are sent without these credentials.' : 'Requirements that need them are skipped; the other alternatives are used.'}`,
      location: {
        file: ctx.store.byDisplay(querystring.source.file)?.location ?? ctx.store.root.location,
        pointer: querystring.source.pointer,
      },
      operation: label,
      hint: 'Send the key in a header or cookie (an apiKey scheme with in: header), or describe the query string as application/x-www-form-urlencoded.',
    });
  }
}

export function reportDuplicateOperationIds(
  ctx: ParseContext,
  operations: readonly OperationIR[],
): void {
  const byId = new Map<string, OperationIR[]>();
  for (const operation of operations) {
    if (operation.operationId === undefined) continue;
    const list = byId.get(operation.operationId) ?? [];
    list.push(operation);
    byId.set(operation.operationId, list);
  }
  for (const [operationId, list] of byId) {
    if (list.length < 2) continue;
    const duplicate = list[1];
    ctx.diagnostics.warning({
      code: 'operation/duplicate-id',
      message: `operationId "${operationId}" is used by ${list.map((op) => `${op.method.toUpperCase()} ${op.path}`).join(', ')}; generated names are disambiguated.`,
      ...(duplicate === undefined
        ? {}
        : {
            location: {
              file: ctx.store.byDisplay(duplicate.source.file)?.location ?? ctx.store.root.location,
              pointer: duplicate.source.pointer,
            },
          }),
    });
  }
}
