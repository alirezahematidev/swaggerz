import {
  HTTP_METHODS,
  type ApiInfo,
  type ExampleIR,
  type ExternalDocsIR,
  type OperationIR,
  type StandardHttpMethod,
  type ResponseIR,
  type SecurityRequirementIR,
  type TagIR,
} from '../ir/types.ts';
import { isRecord, setOwn } from '../utils/object.ts';
import { compareStrings } from '../utils/strings.ts';
import {
  child,
  entries,
  items,
  num,
  str,
  toJsonValue,
  type Cursor,
  type ParseContext,
} from './context.ts';

export function operationLabel(method: string, path: string, operationId?: string): string {
  return `${method.toUpperCase()} ${path}${operationId === undefined ? '' : ` (${operationId})`}`;
}

export function readInfo(ctx: ParseContext, cursor: Cursor): ApiInfo {
  if (!isRecord(cursor.value)) {
    ctx.error('spec/missing-field', 'The required `info` object is missing.', cursor);
    return { title: 'API', version: '0.0.0' };
  }
  const title = str(cursor, 'title');
  let version = str(cursor, 'version');
  if (title === undefined) ctx.warning('spec/missing-field', '`info.title` is required.', cursor);
  // YAML reads an unquoted `version: 1.0` as a number.
  const numeric = version === undefined ? num(cursor, 'version') : undefined;
  if (numeric !== undefined) {
    version = String(numeric);
    ctx.warning(
      'spec/unquoted-version',
      `\`info.version\` is the number ${version}; quote it to keep its exact text (for example '${version}').`,
      child(cursor, 'version'),
    );
  } else if (version === undefined) {
    ctx.warning('spec/missing-field', '`info.version` is required.', cursor);
  }
  const contactCursor = child(cursor, 'contact');
  const licenseCursor = child(cursor, 'license');
  const contact = isRecord(contactCursor.value)
    ? stripUndefined({
        name: str(contactCursor, 'name'),
        url: str(contactCursor, 'url'),
        email: str(contactCursor, 'email'),
      })
    : undefined;
  const licenseName = str(licenseCursor, 'name');
  const license =
    licenseName === undefined
      ? undefined
      : {
          name: licenseName,
          ...stripUndefined({
            url: str(licenseCursor, 'url'),
            identifier: str(licenseCursor, 'identifier'),
          }),
        };
  return {
    title: title ?? 'API',
    version: version ?? '0.0.0',
    ...stripUndefined({
      summary: str(cursor, 'summary'),
      description: str(cursor, 'description'),
      termsOfService: str(cursor, 'termsOfService'),
    }),
    ...(contact === undefined ? {} : { contact }),
    ...(license === undefined ? {} : { license }),
  };
}

export function readExternalDocs(cursor: Cursor): ExternalDocsIR | undefined {
  const url = str(cursor, 'url');
  if (url === undefined) return undefined;
  const description = str(cursor, 'description');
  return description === undefined ? { url } : { url, description };
}

/** Tag Objects; `v32` also reads OpenAPI 3.2's `summary`, `parent` and `kind`. */
export function readTags(cursor: Cursor, v32 = false): TagIR[] {
  return items(cursor)
    .map((tag): TagIR | undefined => {
      const name = str(tag, 'name');
      if (name === undefined) return undefined;
      const externalDocs = readExternalDocs(child(tag, 'externalDocs'));
      return {
        name,
        ...stripUndefined({
          summary: v32 ? str(tag, 'summary') : undefined,
          description: str(tag, 'description'),
        }),
        ...(externalDocs === undefined ? {} : { externalDocs }),
        ...stripUndefined({
          parent: v32 ? str(tag, 'parent') : undefined,
          kind: v32 ? str(tag, 'kind') : undefined,
        }),
      };
    })
    .filter((tag): tag is TagIR => tag !== undefined);
}

/**
 * Drops `parent` references to undeclared tags and breaks cycles (OpenAPI 3.2), reporting
 * `spec/invalid-tag-parent` for each.
 */
export function checkTagParents(ctx: ParseContext, cursor: Cursor, tags: TagIR[]): TagIR[] {
  const parents = new Map<string, string>();
  for (const tag of tags) if (tag.parent !== undefined) parents.set(tag.name, tag.parent);
  const declared = new Set(tags.map((tag) => tag.name));
  const at = (name: string): Cursor =>
    items(cursor).find((item) => str(item, 'name') === name) ?? cursor;
  for (const tag of tags) {
    const parent = parents.get(tag.name);
    if (parent === undefined) continue;
    if (!declared.has(parent)) {
      ctx.warning(
        'spec/invalid-tag-parent',
        `Tag "${tag.name}" names parent "${parent}", which is not declared; it is treated as a top-level tag.`,
        at(tag.name),
      );
      parents.delete(tag.name);
      continue;
    }
    const chain = new Set([tag.name]);
    for (
      let current = parents.get(tag.name);
      current !== undefined;
      current = parents.get(current)
    ) {
      if (chain.has(current)) {
        ctx.warning(
          'spec/invalid-tag-parent',
          `Tag "${tag.name}" is its own ancestor (${[...chain, current].join(' → ')}); its parent is ignored.`,
          at(tag.name),
        );
        parents.delete(tag.name);
        break;
      }
      chain.add(current);
    }
  }
  return tags.map((tag) => {
    if (tag.parent === undefined || parents.has(tag.name)) return tag;
    const { parent: _ignored, ...rest } = tag;
    return rest;
  });
}

export function readStringArray(cursor: Cursor): string[] {
  return Array.isArray(cursor.value)
    ? cursor.value.filter((v): v is string => typeof v === 'string')
    : [];
}

export function readSecurity(
  ctx: ParseContext,
  cursor: Cursor,
  knownSchemes: ReadonlySet<string>,
  /** OpenAPI 3.2: maps a requirement key that is a URI of a security scheme to its name. */
  resolveUri?: (key: string, at: Cursor) => string | undefined,
): SecurityRequirementIR[] | undefined {
  if (cursor.value === undefined) return undefined;
  if (!Array.isArray(cursor.value)) {
    ctx.error(
      'spec/invalid-security',
      '`security` must be an array of requirement objects.',
      cursor,
    );
    return undefined;
  }
  const result: SecurityRequirementIR[] = [];
  for (const requirement of items(cursor)) {
    if (!isRecord(requirement.value)) continue;
    const entry: Record<string, string[]> = {};
    for (const [key, scopes] of entries(requirement)) {
      // Component names take precedence over URIs (OpenAPI 3.2).
      const name = knownSchemes.has(key) ? key : (resolveUri?.(key, scopes) ?? key);
      if (!knownSchemes.has(name)) {
        ctx.warning(
          'security/unknown-scheme',
          `Security requirement references unknown scheme "${name}"; it is ignored.`,
          scopes,
        );
        continue;
      }
      setOwn(entry, name, readStringArray(scopes));
    }
    // Drop requirements whose schemes were all unknown, but keep a deliberate `{}` (optional auth).
    if (Object.keys(entry).length > 0 || Object.keys(requirement.value).length === 0)
      result.push(entry);
  }
  return result;
}

export function readExamplesMap(ctx: ParseContext, cursor: Cursor): ExampleIR[] {
  const result: ExampleIR[] = [];
  for (const [name, raw] of entries(cursor)) {
    const example = ctx.deref(raw);
    if (example === undefined || !isRecord(example.value)) continue;
    // OpenAPI 3.2 `dataValue` is the data form of `value`.
    const data =
      'dataValue' in example.value
        ? example.value.dataValue
        : 'value' in example.value
          ? example.value.value
          : undefined;
    const value = toJsonValue(data);
    result.push({
      name,
      ...stripUndefined({
        summary: str(example, 'summary'),
        description: str(example, 'description'),
        serializedValue: str(example, 'serializedValue'),
        externalValue: str(example, 'externalValue'),
      }),
      ...(value === undefined ? {} : { value }),
    });
  }
  return result;
}

export function singleExample(cursor: Cursor, key = 'example'): ExampleIR[] {
  if (!isRecord(cursor.value) || !(key in cursor.value)) return [];
  const value = toJsonValue(cursor.value[key]);
  return value === undefined ? [] : [{ value }];
}

const METHOD_ORDER = new Map<string, number>(HTTP_METHODS.map((method, index) => [method, index]));

/** Whether a Path Item key is a standard method field (`query` only counts from OpenAPI 3.2). */
export function isHttpMethod(value: string): value is StandardHttpMethod {
  return METHOD_ORDER.has(value);
}

/** By path, then standard methods in spec order, then additional methods alphabetically. */
export function sortOperations(operations: OperationIR[]): OperationIR[] {
  const rank = (method: string): number => METHOD_ORDER.get(method) ?? HTTP_METHODS.length;
  return operations.sort(
    (a, b) =>
      compareStrings(a.path, b.path) ||
      rank(a.method) - rank(b.method) ||
      compareStrings(a.method, b.method),
  );
}

export function isValidStatus(status: string): boolean {
  return status === 'default' || /^[1-5](\d\d|XX)$/i.test(status);
}

function statusRank(status: string): number {
  if (status === 'default') return 1_000_000;
  if (/^[1-5]XX$/i.test(status)) return Number(status[0]) * 1000 + 999;
  return Number(status) * 10;
}

export function sortResponses(responses: ResponseIR[]): ResponseIR[] {
  return responses.sort((a, b) => statusRank(a.status) - statusRank(b.status));
}

/** Media types whose bodies are raw bytes rather than structured or textual data. */
export function isBinaryMediaType(mediaType: string): boolean {
  const type = mediaType.split(';')[0]?.trim().toLowerCase() ?? '';
  return (
    type === 'application/octet-stream' ||
    type === 'application/pdf' ||
    type === 'application/zip' ||
    type === 'application/gzip' ||
    /^(image|audio|video|font)\//.test(type)
  );
}

/** Extracts `{name}` segments from a path template. */
export function pathTemplateParams(path: string): string[] {
  return [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1] ?? '');
}

/** Returns a copy of `value` without keys whose value is `undefined`. */
export function stripUndefined<T extends Record<string, unknown>>(
  value: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) if (entry !== undefined) result[key] = entry;
  return result as { [K in keyof T]?: Exclude<T[K], undefined> };
}
