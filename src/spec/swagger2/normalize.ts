import {
  IR_VERSION,
  type ApiDocument,
  type EncodingIR,
  type ExampleIR,
  type HeaderIR,
  type HttpMethod,
  type MediaTypeIR,
  type OperationIR,
  type ParameterIR,
  type ParameterLocation,
  type ParameterStyle,
  type PropertyIR,
  type RequestBodyIR,
  type ResponseIR,
  type SchemaIR,
  type SecuritySchemeIR,
  type ServerIR,
} from '../../ir/types.ts';
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
  toJsonValue,
  type Cursor,
  type ParseContext,
} from '../context.ts';
import { reportDuplicateOperationIds } from '../openapi3/normalize.ts';
import { SchemaConverter } from '../schema/converter.ts';
import { swagger2Dialect } from '../schema/dialects.ts';
import {
  isBinaryMediaType,
  isHttpMethod,
  isValidStatus,
  operationLabel,
  pathTemplateParams,
  readExternalDocs,
  readInfo,
  readSecurity,
  readStringArray,
  readTags,
  sortOperations,
  sortResponses,
  stripUndefined,
} from '../shared.ts';

const DEFAULT_MEDIA_TYPE = 'application/json';

/** Normalizes a Swagger 2.0 document. */
export function normalizeSwagger2(ctx: ParseContext): ApiDocument {
  const root = ctx.root;
  const converter = new SchemaConverter(ctx, swagger2Dialect);

  if (!isRecord(child(root, 'paths').value)) {
    ctx.error('spec/missing-field', 'Swagger 2.0 documents require a `paths` object.', root);
  }

  for (const [, schema] of entries(child(root, 'definitions')).sort(([a], [b]) =>
    compareStrings(a, b),
  )) {
    converter.registerComponent(schema);
  }

  const securitySchemes = readSecurityDefinitions(ctx, child(root, 'securityDefinitions'));
  const schemeNames = new Set(securitySchemes.map((scheme) => scheme.key));
  const globalConsumes = readStringArray(child(root, 'consumes'));
  const globalProduces = readStringArray(child(root, 'produces'));
  const operations: OperationIR[] = [];

  for (const [path, rawItem] of entries(child(root, 'paths'))) {
    if (path.startsWith('x-')) continue;
    if (!path.startsWith('/')) {
      ctx.error('spec/invalid-path', `Path "${path}" must start with "/".`, rawItem);
      continue;
    }
    const pathItem = ctx.deref(rawItem);
    if (pathItem === undefined || !isRecord(pathItem.value)) continue;
    for (const method of keysOf(pathItem)) {
      if (!isHttpMethod(method) || method === 'trace') continue;
      const cursor = child(pathItem, method);
      const operation = convertOperation(ctx, converter, {
        cursor,
        method,
        path,
        pathParameters: child(pathItem, 'parameters'),
        consumes: has(cursor, 'consumes')
          ? readStringArray(child(cursor, 'consumes'))
          : globalConsumes,
        produces: has(cursor, 'produces')
          ? readStringArray(child(cursor, 'produces'))
          : globalProduces,
        schemeNames,
      });
      if (operation !== undefined) operations.push(operation);
    }
  }
  reportDuplicateOperationIds(ctx, operations);

  const externalDocs = readExternalDocs(child(root, 'externalDocs'));
  return {
    irVersion: IR_VERSION,
    specVersion: '2.0',
    specVersionRaw: '2.0',
    info: readInfo(ctx, child(root, 'info')),
    servers: readServers(root),
    operations: sortOperations(operations),
    schemas: converter.finalize(),
    webhooks: [],
    securitySchemes,
    security: readSecurity(ctx, child(root, 'security'), schemeNames) ?? [],
    tags: readTags(child(root, 'tags')),
    ...(externalDocs === undefined ? {} : { externalDocs }),
    extensions: readExtensions(root),
    sources: ctx.sources(),
  };
}

function readServers(root: Cursor): ServerIR[] {
  const host = str(root, 'host');
  const basePath = str(root, 'basePath') ?? '';
  if (host === undefined) return basePath === '' ? [] : [{ url: basePath, variables: {} }];
  const declared = readStringArray(child(root, 'schemes')).filter(
    (s) => s === 'https' || s === 'http',
  );
  const schemes =
    declared.length === 0
      ? ['https']
      : [...declared].sort((a, b) => (a === b ? 0 : a === 'https' ? -1 : 1));
  return schemes.map((scheme) => ({ url: `${scheme}://${host}${basePath}`, variables: {} }));
}

interface OperationInput {
  readonly cursor: Cursor;
  readonly method: HttpMethod;
  readonly path: string;
  readonly pathParameters: Cursor;
  readonly consumes: readonly string[];
  readonly produces: readonly string[];
  readonly schemeNames: ReadonlySet<string>;
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
  const label = operationLabel(method, path, operationId);

  // Merge path-level and operation-level parameters; operation parameters override by in+name.
  const merged = new Map<string, Cursor>();
  for (const list of [input.pathParameters, child(cursor, 'parameters')]) {
    if (!Array.isArray(list.value)) continue;
    list.value.forEach((_, index) => {
      const parameter = ctx.deref(child(list, index));
      if (parameter === undefined) return;
      const name = str(parameter, 'name');
      const where = str(parameter, 'in');
      if (name === undefined || where === undefined) {
        ctx.error('spec/invalid-parameter', 'Parameter requires `name` and `in`.', parameter, {
          operation: label,
        });
        return;
      }
      merged.set(`${where}:${name}`, parameter);
    });
  }

  const parameters: ParameterIR[] = [];
  const formData: Cursor[] = [];
  let body: Cursor | undefined;
  for (const parameter of merged.values()) {
    const where = str(parameter, 'in');
    if (where === 'body') {
      if (body !== undefined)
        ctx.error('operation/multiple-bodies', 'Only one body parameter is allowed.', parameter, {
          operation: label,
        });
      body = parameter;
    } else if (where === 'formData') {
      formData.push(parameter);
    } else if (where === 'path' || where === 'query' || where === 'header') {
      const converted = convertParameter(ctx, converter, parameter, where, label);
      if (converted !== undefined) parameters.push(converted);
    } else {
      ctx.error(
        'spec/invalid-parameter',
        `Invalid parameter location "${where ?? ''}".`,
        child(parameter, 'in'),
        { operation: label },
      );
    }
  }
  if (body !== undefined && formData.length > 0) {
    ctx.error(
      'operation/body-and-form',
      'An operation cannot have both body and formData parameters; formData is ignored.',
      cursor,
      { operation: label },
    );
  }

  for (const name of pathTemplateParams(path)) {
    if (!parameters.some((p) => p.in === 'path' && p.name === name)) {
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

  let requestBody: RequestBodyIR | undefined;
  if (body !== undefined) requestBody = convertBody(ctx, converter, body, input.consumes);
  else if (formData.length > 0)
    requestBody = convertFormData(ctx, converter, formData, input.consumes, label);

  const responses: ResponseIR[] = [];
  for (const [status, raw] of entries(child(cursor, 'responses'))) {
    if (status.startsWith('x-')) continue;
    if (!isValidStatus(status)) {
      ctx.warning(
        'operation/invalid-status',
        `Invalid response status "${status}"; it is ignored.`,
        raw,
        { operation: label },
      );
      continue;
    }
    const response = convertResponse(ctx, converter, raw, status, input.produces);
    if (response !== undefined) responses.push(response);
  }

  const security = readSecurity(ctx, child(cursor, 'security'), input.schemeNames);
  const externalDocs = readExternalDocs(child(cursor, 'externalDocs'));
  return {
    key: `${method} ${path}`,
    ...(operationId === undefined ? {} : { operationId }),
    method,
    path,
    ...stripUndefined({ summary: str(cursor, 'summary'), description: str(cursor, 'description') }),
    tags: readStringArray(child(cursor, 'tags')),
    deprecated: bool(cursor, 'deprecated') === true,
    parameters,
    ...(requestBody === undefined ? {} : { requestBody }),
    responses: sortResponses(responses),
    ...(security === undefined ? {} : { security }),
    ...(externalDocs === undefined ? {} : { externalDocs }),
    extensions: readExtensions(cursor),
    source: ctx.sourceRef(cursor),
  };
}

/** Maps `collectionFormat` to an OpenAPI 3 style. */
function collectionStyle(
  ctx: ParseContext,
  parameter: Cursor,
  where: ParameterLocation | 'formData',
  label: string,
): { style: ParameterStyle; explode: boolean } {
  const format = str(parameter, 'collectionFormat') ?? 'csv';
  const listStyle: ParameterStyle = where === 'query' || where === 'formData' ? 'form' : 'simple';
  switch (format) {
    case 'csv':
      return { style: listStyle, explode: false };
    case 'ssv':
      return { style: 'spaceDelimited', explode: false };
    case 'tsv':
      return { style: 'tabDelimited', explode: false };
    case 'pipes':
      return { style: 'pipeDelimited', explode: false };
    case 'multi':
      if (where === 'query' || where === 'formData') return { style: 'form', explode: true };
      ctx.warning(
        'operation/invalid-collection-format',
        '`collectionFormat: multi` is only valid for query and formData parameters; csv is used.',
        parameter,
        { operation: label },
      );
      return { style: listStyle, explode: false };
    default:
      ctx.warning(
        'operation/invalid-collection-format',
        `Unknown collectionFormat "${format}"; csv is used.`,
        parameter,
        { operation: label },
      );
      return { style: listStyle, explode: false };
  }
}

function convertParameterSchema(
  ctx: ParseContext,
  converter: SchemaConverter,
  parameter: Cursor,
  label: string,
): SchemaIR {
  if (!has(parameter, 'type')) {
    ctx.error(
      'spec/invalid-parameter',
      `Parameter "${str(parameter, 'name') ?? ''}" requires a \`type\`.`,
      parameter,
      { operation: label },
    );
    return { kind: 'unknown' };
  }
  const schema = converter.convert(parameter);
  // The parameter's own description is documented on the parameter, not on its type.
  const { description: _description, ...rest } = schema;
  return rest;
}

function convertParameter(
  ctx: ParseContext,
  converter: SchemaConverter,
  parameter: Cursor,
  where: ParameterLocation,
  label: string,
): ParameterIR | undefined {
  const name = str(parameter, 'name') ?? '';
  let required = bool(parameter, 'required') === true;
  if (where === 'path' && !required) {
    ctx.warning(
      'operation/optional-path-parameter',
      `Path parameter "${name}" must be required; it is treated as required.`,
      parameter,
      { operation: label },
    );
    required = true;
  }
  const schema = convertParameterSchema(ctx, converter, parameter, label);
  const { style, explode } =
    str(parameter, 'type') === 'array'
      ? collectionStyle(ctx, parameter, where, label)
      : {
          style: (where === 'query' ? 'form' : 'simple') as ParameterStyle,
          explode: where === 'query',
        };
  return {
    name,
    in: where,
    required,
    deprecated: bool(parameter, 'x-deprecated') === true,
    ...stripUndefined({ description: str(parameter, 'description') }),
    schema,
    style,
    explode,
    allowReserved: false,
    examples: exampleOf(parameter, 'x-example'),
    extensions: readExtensions(parameter),
    source: ctx.sourceRef(parameter),
  };
}

function exampleOf(cursor: Cursor, key: string): ExampleIR[] {
  if (!isRecord(cursor.value) || !(key in cursor.value)) return [];
  const value = toJsonValue(cursor.value[key]);
  return value === undefined ? [] : [{ value }];
}

function convertBody(
  ctx: ParseContext,
  converter: SchemaConverter,
  parameter: Cursor,
  consumes: readonly string[],
): RequestBodyIR {
  const schema: SchemaIR = has(parameter, 'schema')
    ? converter.convert(child(parameter, 'schema'))
    : { kind: 'unknown' };
  if (!has(parameter, 'schema'))
    ctx.error('spec/invalid-parameter', 'Body parameters require a `schema`.', parameter);
  const mediaTypes = consumes.length === 0 ? [DEFAULT_MEDIA_TYPE] : consumes;
  return {
    required: bool(parameter, 'required') === true,
    ...stripUndefined({ description: str(parameter, 'description') }),
    contents: mediaTypes.map((mediaType) => ({
      mediaType,
      schema:
        isBinaryMediaType(mediaType) && (schema.kind === 'unknown' || schema.kind === 'string')
          ? { kind: 'binary' }
          : schema,
      examples: exampleOf(parameter, 'x-example'),
    })),
    extensions: readExtensions(parameter),
    source: ctx.sourceRef(parameter),
  };
}

function convertFormData(
  ctx: ParseContext,
  converter: SchemaConverter,
  parameters: readonly Cursor[],
  consumes: readonly string[],
  label: string,
): RequestBodyIR {
  const properties: PropertyIR[] = [];
  const encoding: Record<string, EncodingIR> = {};
  let hasFile = false;
  for (const parameter of parameters) {
    const name = str(parameter, 'name') ?? '';
    const schema = convertParameterSchema(ctx, converter, parameter, label);
    const description = str(parameter, 'description');
    if (schema.kind === 'binary') hasFile = true;
    properties.push({
      name,
      required: bool(parameter, 'required') === true,
      schema: description === undefined ? schema : { ...schema, description },
    });
    if (str(parameter, 'type') === 'array') {
      const { style, explode } = collectionStyle(ctx, parameter, 'formData', label);
      encoding[name] = { style, explode };
    }
  }
  const multipart = hasFile || consumes.includes('multipart/form-data');
  if (hasFile && !consumes.includes('multipart/form-data')) {
    ctx.warning(
      'operation/file-without-multipart',
      'File parameters require `consumes: [multipart/form-data]`; multipart is used.',
      parameters[0] ?? ctx.root,
      { operation: label },
    );
  }
  const mediaType = multipart ? 'multipart/form-data' : 'application/x-www-form-urlencoded';
  const content: MediaTypeIR = {
    mediaType,
    schema: { kind: 'object', properties },
    examples: [],
    ...(Object.keys(encoding).length > 0 ? { encoding } : {}),
  };
  const first = parameters[0];
  return {
    required: properties.some((p) => p.required),
    contents: [content],
    extensions: {},
    source: first === undefined ? ctx.sourceRef(ctx.root) : ctx.sourceRef(first),
  };
}

function convertResponse(
  ctx: ParseContext,
  converter: SchemaConverter,
  raw: Cursor,
  status: string,
  produces: readonly string[],
): ResponseIR | undefined {
  const cursor = ctx.deref(raw);
  if (cursor === undefined || !isRecord(cursor.value)) return undefined;
  const contents: MediaTypeIR[] = [];
  if (has(cursor, 'schema')) {
    const schema = converter.convert(child(cursor, 'schema'));
    const examples = child(cursor, 'examples');
    const mediaTypes = produces.length === 0 ? [DEFAULT_MEDIA_TYPE] : produces;
    for (const mediaType of mediaTypes) {
      const exampleValue = isRecord(examples.value)
        ? toJsonValue(examples.value[mediaType])
        : undefined;
      contents.push({
        mediaType,
        schema:
          isBinaryMediaType(mediaType) && (schema.kind === 'unknown' || schema.kind === 'string')
            ? { kind: 'binary' }
            : schema,
        examples: exampleValue === undefined ? [] : [{ value: exampleValue }],
      });
    }
  }
  const headers: HeaderIR[] = entries(child(cursor, 'headers')).map(([name, header]) => ({
    name,
    required: false,
    deprecated: false,
    ...stripUndefined({ description: str(header, 'description') }),
    schema: has(header, 'type') ? converter.convert(header) : { kind: 'unknown' },
  }));
  return {
    status,
    ...stripUndefined({ description: str(cursor, 'description') }),
    contents,
    headers,
    extensions: readExtensions(cursor),
    source: ctx.sourceRef(cursor),
  };
}

function readSecurityDefinitions(ctx: ParseContext, cursor: Cursor): SecuritySchemeIR[] {
  const result: SecuritySchemeIR[] = [];
  for (const [key, scheme] of entries(cursor).sort(([a], [b]) => compareStrings(a, b))) {
    const base = {
      key,
      ...stripUndefined({ description: str(scheme, 'description') }),
      extensions: readExtensions(scheme),
      source: ctx.sourceRef(scheme),
    };
    const type = str(scheme, 'type');
    if (type === 'basic') {
      result.push({ ...base, type: 'http', scheme: 'basic' });
    } else if (type === 'apiKey') {
      const name = str(scheme, 'name');
      const where = str(scheme, 'in');
      if (name === undefined || (where !== 'header' && where !== 'query')) {
        ctx.error(
          'security/invalid-scheme',
          `apiKey scheme "${key}" requires \`name\` and \`in\` (header or query).`,
          scheme,
        );
        continue;
      }
      result.push({ ...base, type: 'apiKey', name, in: where });
    } else if (type === 'oauth2') {
      const flow = str(scheme, 'flow');
      const scopes: Record<string, string> = {};
      for (const [scope, description] of entries(child(scheme, 'scopes'))) {
        scopes[scope] = typeof description.value === 'string' ? description.value : '';
      }
      const details = {
        scopes,
        ...stripUndefined({
          authorizationUrl: str(scheme, 'authorizationUrl'),
          tokenUrl: str(scheme, 'tokenUrl'),
        }),
      };
      const flowName =
        flow === 'implicit'
          ? 'implicit'
          : flow === 'password'
            ? 'password'
            : flow === 'application'
              ? 'clientCredentials'
              : flow === 'accessCode'
                ? 'authorizationCode'
                : undefined;
      if (flowName === undefined) {
        ctx.error(
          'security/invalid-scheme',
          `oauth2 scheme "${key}" has invalid flow "${flow ?? ''}".`,
          scheme,
        );
        continue;
      }
      result.push({ ...base, type: 'oauth2', flows: { [flowName]: details } });
    } else {
      ctx.error(
        'security/invalid-scheme',
        `Security definition "${key}" has unknown type "${type ?? ''}".`,
        scheme,
      );
    }
  }
  return result;
}
