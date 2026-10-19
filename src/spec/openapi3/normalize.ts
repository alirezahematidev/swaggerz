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
  type SecuritySchemeIR,
  type ServerIR,
  type WebhookIR,
} from '../../ir/types.ts';
import { pickMeta } from '../../ir/utils.ts';
import { isRecord } from '../../utils/object.ts';
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
import { SchemaConverter } from '../schema/converter.ts';
import type { SchemaDialect } from '../schema/dialects.ts';
import {
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
const IGNORED_HEADERS = new Set(['accept', 'content-type', 'authorization']);

/**
 * Normalizes OpenAPI 3.0 and 3.1 documents. Document structure is shared between the two
 * versions; schema semantics differ and are provided by `dialect`.
 */
export function normalizeOpenApi3(
  ctx: ParseContext,
  dialect: SchemaDialect,
  version: '3.0' | '3.1',
  rawVersion: string,
): ApiDocument {
  const root = ctx.root;
  const converter = new SchemaConverter(ctx, dialect);

  validateRoot(ctx, version);

  for (const [, schema] of sortedEntries(child(root, 'components', 'schemas'))) {
    converter.registerComponent(schema);
  }

  const securitySchemes = readSecuritySchemes(ctx, child(root, 'components', 'securitySchemes'));
  const schemeNames = new Set(securitySchemes.map((scheme) => scheme.key));
  const operations: OperationIR[] = [];

  const paths = child(root, 'paths');
  for (const [path, rawItem] of entries(paths)) {
    if (!path.startsWith('/')) {
      ctx.error('spec/invalid-path', `Path "${path}" must start with "/".`, rawItem);
      continue;
    }
    const pathItem = ctx.deref(rawItem);
    if (pathItem === undefined || !isRecord(pathItem.value)) continue;
    const pathParameters = child(pathItem, 'parameters');
    const pathServers = readServers(child(pathItem, 'servers'));
    for (const key of keysOf(pathItem)) {
      if (!isHttpMethod(key)) continue;
      const operation = convertOperation(ctx, converter, {
        cursor: child(pathItem, key),
        method: key,
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
  if (version === '3.1') {
    for (const [name, rawItem] of sortedEntries(child(root, 'webhooks'))) {
      const webhookOperations = convertPathItem(ctx, converter, rawItem, schemeNames, {
        kind: 'webhook',
        path: '',
        keyPrefix: `webhook:${name}`,
      });
      if (webhookOperations.length > 0) webhooks.push({ name, operations: webhookOperations });
    }
  }
  reportDuplicateOperationIds(ctx, operations);

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
    security: readSecurity(ctx, child(root, 'security'), schemeNames) ?? [],
    tags: readTags(child(root, 'tags')),
    ...(externalDocs === undefined ? {} : { externalDocs }),
    extensions: readExtensions(root),
    sources: ctx.sources(),
  };
}

function validateRoot(ctx: ParseContext, version: '3.0' | '3.1'): void {
  const root = ctx.root;
  if (version === '3.0' && !isRecord(child(root, 'paths').value)) {
    ctx.error('spec/missing-field', 'OpenAPI 3.0 documents require a `paths` object.', root);
  }
  if (
    version === '3.1' &&
    !has(root, 'paths') &&
    !has(root, 'components') &&
    !has(root, 'webhooks')
  ) {
    ctx.error(
      'spec/missing-field',
      'OpenAPI 3.1 documents require at least one of `paths`, `components` or `webhooks`.',
      root,
    );
  }
  const dialectUri = str(root, 'jsonSchemaDialect');
  if (
    version === '3.1' &&
    dialectUri !== undefined &&
    dialectUri !== 'https://spec.openapis.org/oas/3.1/dialect/base' &&
    dialectUri !== 'https://json-schema.org/draft/2020-12/schema'
  ) {
    ctx.warning(
      'spec/unsupported-dialect',
      `jsonSchemaDialect "${dialectUri}" is not supported; schemas are interpreted as the OpenAPI 3.1 base dialect.`,
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
      variables[name] = {
        default: defaultValue,
        ...(enumValues.length > 0 ? { enum: enumValues } : {}),
        ...stripUndefined({ description: str(variable, 'description') }),
      };
    }
    result.push({ url, variables, ...stripUndefined({ description: str(server, 'description') }) });
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

/** Converts the operations of a webhook or callback path item (which may be a `$ref`). */
function convertPathItem(
  ctx: ParseContext,
  converter: SchemaConverter,
  rawItem: Cursor,
  schemeNames: ReadonlySet<string>,
  options: { kind: 'webhook' | 'callback'; path: string; keyPrefix: string },
): OperationIR[] {
  const pathItem = ctx.deref(rawItem);
  if (pathItem === undefined || !isRecord(pathItem.value)) return [];
  const result: OperationIR[] = [];
  for (const key of keysOf(pathItem)) {
    if (!isHttpMethod(key)) continue;
    const operation = convertOperation(ctx, converter, {
      cursor: child(pathItem, key),
      method: key,
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
      const operations = convertPathItem(ctx, converter, rawItem, schemeNames, {
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
  input: OperationInput,
): OperationIR | undefined {
  const { cursor, method, path } = input;
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
    input.pathParameters,
    child(cursor, 'parameters'),
    label,
  );
  if (kind === 'operation') checkPathParameters(ctx, path, parameters, cursor, label);

  const requestBody = has(cursor, 'requestBody')
    ? convertRequestBody(ctx, converter, child(cursor, 'requestBody'), label)
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
  if (!isRecord(responsesCursor.value)) {
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
      rawResponse,
      /^[1-5]xx$/i.test(status) ? status.toUpperCase() : status,
      label,
    );
    if (response !== undefined) responses.push(response);
  }

  const callbacks =
    kind === 'operation' && has(cursor, 'callbacks')
      ? convertCallbacks(ctx, converter, child(cursor, 'callbacks'), input.schemeNames, key)
      : [];

  const security = readSecurity(ctx, child(cursor, 'security'), input.schemeNames);
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
      const parameter = convertParameter(ctx, converter, child(list, index), label);
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
  return [...merged.values()];
}

function convertParameter(
  ctx: ParseContext,
  converter: SchemaConverter,
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
  if (!LOCATIONS.has(location)) {
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
  if (has(cursor, 'schema')) {
    schema = converter.convert(child(cursor, 'schema'));
  } else if (isRecord(child(cursor, 'content').value)) {
    const [mediaType, media] = entries(child(cursor, 'content'))[0] ?? [];
    contentType = mediaType;
    schema =
      media !== undefined && has(media, 'schema')
        ? converter.convert(child(media, 'schema'))
        : { kind: 'unknown' };
  } else {
    ctx.warning(
      'spec/invalid-parameter',
      `Parameter "${name}" has neither \`schema\` nor \`content\`; it is typed as unknown.`,
      cursor,
      { operation: label },
    );
    schema = { kind: 'unknown' };
  }

  const defaultStyle: ParameterStyle = where === 'query' || where === 'cookie' ? 'form' : 'simple';
  const rawStyle = str(cursor, 'style');
  let style: ParameterStyle = defaultStyle;
  if (rawStyle !== undefined) {
    if (STYLES.has(rawStyle)) style = rawStyle as ParameterStyle;
    else
      ctx.warning(
        'operation/invalid-style',
        `Unknown parameter style "${rawStyle}"; "${defaultStyle}" is used.`,
        child(cursor, 'style'),
        { operation: label },
      );
  }
  const explode = bool(cursor, 'explode') ?? style === 'form';
  const examples = [...singleExample(cursor), ...readExamplesMap(ctx, child(cursor, 'examples'))];

  return {
    name,
    in: where,
    required,
    deprecated: bool(cursor, 'deprecated') === true,
    ...stripUndefined({ description: str(cursor, 'description'), contentType }),
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

function convertMediaTypes(
  ctx: ParseContext,
  converter: SchemaConverter,
  content: Cursor,
): MediaTypeIR[] {
  const result: MediaTypeIR[] = [];
  for (const [mediaType, media] of entries(content)) {
    let schema: SchemaIR = has(media, 'schema')
      ? converter.convert(child(media, 'schema'))
      : { kind: 'unknown' };
    if (
      isBinaryMediaType(mediaType) &&
      (schema.kind === 'unknown' ||
        (schema.kind === 'string' &&
          schema.format === undefined &&
          schema.constraints?.contentEncoding === undefined))
    ) {
      schema = { ...pickMeta(schema), kind: 'binary' };
    }
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
    result.push({
      mediaType,
      schema,
      examples: [...singleExample(media), ...readExamplesMap(ctx, child(media, 'examples'))],
      ...(Object.keys(encoding).length > 0 ? { encoding } : {}),
    });
  }
  return result;
}

function convertRequestBody(
  ctx: ParseContext,
  converter: SchemaConverter,
  raw: Cursor,
  label: string,
): RequestBodyIR | undefined {
  const cursor = ctx.deref(raw);
  if (cursor === undefined || !isRecord(cursor.value)) return undefined;
  const contents = convertMediaTypes(ctx, converter, child(cursor, 'content'));
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
      const [, media] = entries(child(header, 'content'))[0] ?? [];
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
    ...stripUndefined({ description: str(cursor, 'description') }),
    contents: convertMediaTypes(ctx, converter, child(cursor, 'content')),
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
              tokenUrl: str(flow, 'tokenUrl'),
              refreshUrl: str(flow, 'refreshUrl'),
            }),
          };
        };
        const flowEntries = (
          ['implicit', 'password', 'clientCredentials', 'authorizationCode'] as const
        )
          .map((name) => [name, readFlow(name)] as const)
          .filter(
            (entry): entry is readonly [(typeof entry)[0], OAuthFlowIR] => entry[1] !== undefined,
          );
        result.push({ ...base, type: 'oauth2', flows: Object.fromEntries(flowEntries) });
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
