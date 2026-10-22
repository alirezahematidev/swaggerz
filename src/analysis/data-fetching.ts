import type { ResolvedDataFetching } from '../config/resolved.ts';
import type { DiagnosticBag } from '../diagnostics/bag.ts';
import { wireMethod } from '../ir/types.ts';
import { compareStrings, suggest } from '../utils/strings.ts';
import type { OperationSymbol, QueryGroup } from './types.ts';

/**
 * Query keys of TanStack Query and SWR hooks beyond single operations: the `all` key of each
 * group and the queries a mutation invalidates (`invalidates`), with diagnostics for keys and
 * targets of the `infinite` and `invalidates` options that do not resolve.
 */

type Key = readonly string[];

function startsWith(key: Key, prefix: Key): boolean {
  return prefix.length <= key.length && prefix.every((part, index) => key[index] === part);
}

function commonPrefix(keys: readonly Key[]): string[] {
  const [first = [], ...rest] = keys;
  let length = first.length;
  for (const key of rest) {
    let shared = 0;
    while (shared < length && key[shared] === first[shared]) shared += 1;
    length = shared;
  }
  return first.slice(0, length);
}

/** The key prefix of a group member: as built (`key`) and before the `queryKey` hook (`base`). */
export interface MemberKey {
  readonly key: Key;
  readonly base: Key;
}

/**
 * The `all` key of a group: its tag path, which starts every key of its operations, unless a
 * `queryKey` hook moved them away from it. A hook that puts the same parts before every key
 * (`['api-v1', ...prefix]`) puts them before the tag path too; otherwise the key is the longest
 * prefix the operations' keys share.
 */
export function groupKey(tags: Key, members: readonly MemberKey[]): Key {
  if (members.every((m) => startsWith(m.key, tags))) return tags;
  const before = members.map((m) =>
    m.key.length >= m.base.length &&
    m.base.every((part, index) => m.key[m.key.length - m.base.length + index] === part)
      ? m.key.slice(0, m.key.length - m.base.length)
      : undefined,
  );
  const [first] = before;
  if (
    first !== undefined &&
    before.every((parts) => parts !== undefined && parts.join('\0') === first.join('\0'))
  )
    return [...first, ...tags];
  return commonPrefix(members.map((m) => m.key));
}

/** The tag followed by the tags it is nested under (OpenAPI 3.2 `parent`). */
function withAncestors(tag: string, parents: ReadonlyMap<string, string>): string[] {
  const tags = [tag];
  for (
    let parent = parents.get(tag);
    parent !== undefined && !tags.includes(parent);
    parent = parents.get(parent)
  )
    tags.push(parent);
  return tags;
}

/** Removes duplicate keys and keys another key of the list already starts. */
function minimal(keys: readonly Key[]): Key[] {
  return keys.filter(
    (key, index) =>
      !keys.some(
        (other, j) =>
          j !== index && startsWith(key, other) && (other.length < key.length || j < index),
      ),
  );
}

export interface DataFetchingInput {
  /** Sorted operation symbols; mutations get their `invalidates` keys (replaced in place). */
  readonly operations: OperationSymbol[];
  readonly groups: readonly QueryGroup[];
  /** Tags declared by the document. */
  readonly tags: readonly string[];
  readonly parents: ReadonlyMap<string, string>;
  readonly options: ResolvedDataFetching;
  /** `features.query` or `features.swr`, for messages. */
  readonly option: string;
  readonly diagnostics: DiagnosticBag;
}

/**
 * Resolves the invalidation targets of every mutation to query key prefixes: an operation name
 * or `operationId` of a query is that query's prefix (it takes precedence over a tag of the same
 * name), a tag (or group directory) is the `all` key of its group when that key matches only
 * operations carrying the tag, plus the prefix of every other query carrying it, including
 * queries that carry it as a secondary tag or under a nested tag. Reports `infinite` and
 * `invalidates` keys that name no operation of the right kind (`query/unknown-operation`) and
 * targets that match no query (`query/unknown-target`).
 */
export function linkDataFetching(input: DataFetchingInput): void {
  const { operations, groups, parents, options, option, diagnostics } = input;
  const find = (name: string): OperationSymbol | undefined =>
    operations.find((o) => o.name === name) ??
    operations.find((o) => o.operation.operationId === name);
  const isQuery = (symbol: OperationSymbol): boolean => symbol.query?.queryKey !== undefined;
  const queries = operations.filter(isQuery);
  const operationNames = [
    ...new Set(operations.flatMap((o) => [o.name, o.operation.operationId ?? o.name])),
  ].sort(compareStrings);
  const describe = (symbol: OperationSymbol): string =>
    `${wireMethod(symbol.operation.method)} ${symbol.operation.path}`;
  const keyHint = (name: string): string => {
    const guess = suggest(name, operationNames);
    return guess === undefined
      ? 'Keys are generated operation names or operationIds.'
      : `Did you mean "${guess}"?`;
  };

  // Every tag an operation carries, with the tags they are nested under; `default` when untagged.
  const carried = new Map(
    operations.map((symbol) => {
      const own = symbol.operation.tags.length === 0 ? ['default'] : symbol.operation.tags;
      return [symbol, new Set(own.flatMap((tag) => withAncestors(tag, parents)))] as const;
    }),
  );
  const tagNames = new Set([...input.tags, ...[...carried.values()].flatMap((tags) => [...tags])]);
  const targetNames = [
    ...new Set([
      ...queries.flatMap((o) => [o.name, o.operation.operationId ?? o.name]),
      ...tagNames,
      ...groups.map((g) => g.group),
    ]),
  ].sort(compareStrings);

  for (const name of Object.keys(options.infinite).sort(compareStrings)) {
    const symbol = find(name);
    if (symbol === undefined) {
      diagnostics.warning({
        code: 'query/unknown-operation',
        message: `${option}.infinite: "${name}" is not an operation; no infinite query is generated for it.`,
        hint: keyHint(name),
      });
    } else if (!isQuery(symbol)) {
      diagnostics.warning({
        code: 'query/unknown-operation',
        message: `${option}.infinite: "${name}" (${describe(symbol)}) is not a query; infinite queries are generated for queries only.`,
        hint: 'Queries are the operations whose method is listed in `queryMethods`.',
      });
    }
  }
  for (const name of Object.keys(options.invalidates).sort(compareStrings)) {
    const symbol = find(name);
    if (symbol === undefined) {
      diagnostics.warning({
        code: 'query/unknown-operation',
        message: `${option}.invalidates: "${name}" is not an operation; its targets are ignored.`,
        hint: keyHint(name),
      });
    } else if (isQuery(symbol)) {
      diagnostics.warning({
        code: 'query/unknown-operation',
        message: `${option}.invalidates: "${name}" (${describe(symbol)}) is a query; only mutations invalidate queries.`,
      });
    }
  }

  const resolve = (target: string, source: string): Key[] => {
    const operation = find(target);
    if (operation?.query !== undefined && isQuery(operation)) return [operation.query.keyPrefix];
    const tag = tagNames.has(target) ? target : groups.find((g) => g.group === target)?.tags.at(-1);
    if (tag !== undefined) {
      const members = queries.filter((symbol) => carried.get(symbol)?.has(tag) === true);
      if (members.length === 0) {
        diagnostics.warning({
          code: 'query/unknown-target',
          message: `${source}: the tag "${target}" has no query operations; nothing is invalidated for it.`,
        });
        return [];
      }
      const memberKeys = members.map((symbol) => symbol.query?.keyPrefix ?? []);
      // The group's `all` key also covers queries added later, as long as it matches no query
      // that does not carry the tag.
      const all = groups.find((g) => g.tags.at(-1) === tag)?.prefix;
      const usable =
        all !== undefined &&
        all.length > 0 &&
        queries.every(
          (symbol) => members.includes(symbol) || !startsWith(symbol.query?.keyPrefix ?? [], all),
        );
      if (!usable) return memberKeys;
      return [all, ...memberKeys.filter((key) => !startsWith(key, all))];
    }
    const guess = suggest(target, targetNames);
    diagnostics.warning({
      code: 'query/unknown-target',
      message:
        operation === undefined
          ? `${source}: "${target}" is neither a query operation nor a tag; it is ignored.`
          : `${source}: "${target}" (${describe(operation)}) is not a query; only queries are invalidated.`,
      hint:
        guess === undefined || guess === target
          ? 'Targets are names or operationIds of queries, or tags.'
          : `Did you mean "${guess}"?`,
    });
    return [];
  };

  operations.forEach((symbol, index) => {
    const query = symbol.query;
    if (query === undefined || isQuery(symbol)) return;
    const key =
      options.invalidates[symbol.name] === undefined ? symbol.operation.operationId : symbol.name;
    const targets = key === undefined ? undefined : options.invalidates[key];
    if (key === undefined || targets === undefined) return;
    const source = `${option}.invalidates.${key}`;
    const keys = minimal(targets.flatMap((target) => resolve(target, source)));
    operations[index] = {
      ...symbol,
      query: { ...query, invalidates: keys.map((k) => [...k]) },
    };
  });
}
