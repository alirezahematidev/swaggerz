import type { QueryGroup, QueryLibrary } from '../../analysis/types.ts';
import { applyJsDocHook, renderAll, type EmitContext, type ModuleOutput } from '../context.ts';
import type { ImportManager, Lang } from '../imports.ts';
import type { OperationPlan } from '../operation-plan.ts';
import { literal, propertyKey, renderJsDoc } from '../printer.ts';
import type { GeneratedExport, JsDocBlock, JsDocTag } from '../types.ts';
import type { OperationSymbol } from '../../analysis/types.ts';

/** Shared pieces of the TanStack Query (React, Vue, Svelte, Solid) and SWR generators. */

export type QuerySymbols = NonNullable<OperationSymbol['query']>;

/** npm package each library's hooks import from. */
export const QUERY_PACKAGES = {
  'react-query': '@tanstack/react-query',
  'vue-query': '@tanstack/vue-query',
  'svelte-query': '@tanstack/svelte-query',
  'solid-query': '@tanstack/solid-query',
  swr: 'swr',
} as const satisfies Record<QueryLibrary, string>;

/** Display names, e.g. for the dashboard and documentation comments. */
export const QUERY_LABELS: Readonly<Record<QueryLibrary, string>> = {
  'react-query': 'React Query',
  'vue-query': 'Vue Query',
  'svelte-query': 'Svelte Query',
  'solid-query': 'Solid Query',
  swr: 'SWR',
};

export interface Param {
  readonly name: string;
  readonly type: string;
  readonly optional?: boolean;
  readonly defaultValue?: string;
  readonly description: string;
}

export interface FunctionSpec {
  readonly name: string;
  readonly typeParams?: readonly { readonly name: string; readonly default: string }[];
  readonly params: readonly Param[];
  /** Return type; omitted in TypeScript output when inference gives a more precise type. */
  readonly returns?: string;
  readonly body: string;
}

/** Imports and language helpers for one rendered module. */
export class Scope {
  readonly imports: ImportManager;
  readonly lang: Lang;
  readonly op: string;
  readonly params: string;
  readonly #responseName: string;
  readonly #module: string;
  readonly #package: string;
  /**
   * Data type of queries. TanStack Query rejects `undefined` query data, so operations that can
   * resolve without a body (204, 304) produce `null` instead.
   */
  readonly queryData: string;
  /** Whether query functions must map `undefined` to `null`. */
  readonly nullable: boolean;
  readonly error: string;
  readonly options: string;

  constructor(
    imports: ImportManager,
    lang: Lang,
    plan: OperationPlan,
    ctx: EmitContext,
    pkg: string,
  ) {
    this.imports = imports;
    this.lang = lang;
    this.#package = pkg;
    const symbol = plan.symbol;
    const type = (name: string): string => imports.add(symbol.module, name, { typeOnly: true });
    this.op =
      lang === 'dts' ? symbol.name : imports.add(symbol.module, symbol.name, { typeOnly: false });
    this.params = plan.hasParams ? type(symbol.typeNames.params) : 'never';
    this.#module = symbol.module;
    this.#responseName = symbol.typeNames.response;
    const dataStyle = ctx.config.client.responseStyle === 'data';
    const noBody = plan.success.every((s) => s.media === undefined);
    this.nullable = dataStyle && (noBody || plan.success.some((s) => s.media === undefined));
    this.queryData = !this.nullable
      ? this.response
      : noBody
        ? 'null'
        : `Exclude<${this.response}, undefined> | null`;
    this.error = type(symbol.typeNames.error);
    this.options = imports.add('client', 'RequestOptions', { typeOnly: true });
  }

  /**
   * The operation's response type, imported on first use: queries of operations without a
   * response body never mention it, and an unused import fails `noUnusedLocals`.
   */
  get response(): string {
    return this.imports.add(this.#module, this.#responseName, { typeOnly: true });
  }

  /** A value import from the query library (empty in declaration files, which have no bodies). */
  value(name: string, pkg = this.#package): string {
    return this.lang === 'dts'
      ? ''
      : this.imports.add(pkg, name, { typeOnly: false, external: true });
  }

  /** A type import from the query library (an inline `import()` type in JavaScript). */
  type(name: string, pkg = this.#package): string {
    return this.imports.add(pkg, name, { typeOnly: true, external: true });
  }

  /** `typeof useInfiniteQuery` usable in a type position. */
  typeofValue(name: string, pkg = this.#package): string {
    return this.lang === 'ts'
      ? this.imports.add(pkg, name, { typeOnly: false, external: true })
      : this.type(name, pkg);
  }

  typeArgs(args: readonly string[]): string {
    return this.lang === 'js' ? '' : `<${args.join(', ')}>`;
  }

  /** In JavaScript, a JSDoc cast that pins the generic arguments TypeScript infers. */
  cast(type: string, expression: string): string {
    return this.lang === 'js' ? `/** @type {${type}} */ (${expression})` : expression;
  }

  /** A type assertion in TypeScript and a JSDoc cast in JavaScript. */
  assert(type: string, expression: string): string {
    return this.lang === 'js'
      ? `/** @type {${type}} */ (${expression})`
      : `${expression} as ${type}`;
  }

  /** Wraps an operation call so a missing body becomes `null` for TanStack Query. */
  queryCall(expression: string): string {
    return this.nullable ? `${expression}.then((data) => data ?? null)` : expression;
  }

  signal(source: string, signal = 'signal'): string {
    const anySignal = this.imports.add('runtime/signal', 'anySignal', { typeOnly: false });
    return `{ ...${source}, signal: ${anySignal}(${source}?.signal, ${signal}) }`;
  }
}

export function keyLiteral(prefix: readonly string[], extra: readonly string[]): string {
  return `[${[...prefix.map((p) => literal(p)), ...extra].join(', ')}]`;
}

export function keyType(prefix: readonly string[], extra: readonly string[]): string {
  return `readonly [${[...prefix.map((p) => literal(p)), ...extra].join(', ')}]`;
}

/** Renders a function as TypeScript, JavaScript with JSDoc types, or a `.d.ts` declaration. */
export function renderFunction(scope: Scope, doc: JsDocBlock, spec: FunctionSpec): string {
  const typeParams = spec.typeParams ?? [];
  if (scope.lang === 'js') {
    const tags: JsDocTag[] = [
      ...typeParams.map((t) => ({ tag: 'template', text: `[${t.name}=${t.default}]` })),
      ...spec.params.map((p) => ({
        tag: 'param',
        text: `{${p.type}} ${p.optional === true || p.defaultValue !== undefined ? `[${p.name}]` : p.name} - ${p.description}`,
      })),
      ...(spec.returns === undefined ? [] : [{ tag: 'returns', text: `{${spec.returns}}` }]),
    ];
    const args = spec.params.map((p) =>
      p.defaultValue === undefined ? p.name : `${p.name} = ${p.defaultValue}`,
    );
    return `${renderJsDoc({ ...doc, tags: [...doc.tags, ...tags] })}export function ${spec.name}(${args.join(', ')}) {\n${spec.body}}\n`;
  }
  const generics =
    typeParams.length === 0
      ? ''
      : `<${typeParams.map((t) => `${t.name} = ${t.default}`).join(', ')}>`;
  const params = spec.params.map((p) => {
    const optional =
      p.optional === true || (scope.lang === 'dts' && p.defaultValue !== undefined) ? '?' : '';
    const defaultValue =
      scope.lang === 'ts' && p.defaultValue !== undefined ? ` = ${p.defaultValue}` : '';
    return `${p.name}${optional}: ${p.type}${defaultValue}`;
  });
  const returns = spec.returns === undefined ? '' : `: ${spec.returns}`;
  const keyword = scope.lang === 'dts' ? 'export declare function' : 'export function';
  const oneLine = `${keyword} ${spec.name}${generics}(${params.join(', ')})${returns}`;
  const signature =
    oneLine.length <= 100
      ? oneLine
      : `${keyword} ${spec.name}${generics}(\n${params.map((p) => `  ${p},`).join('\n')}\n)${returns}`;
  const tags: JsDocTag[] = spec.params.map((p) => ({
    tag: 'param',
    text: `${p.name} - ${p.description}`,
  }));
  const jsDoc = renderJsDoc({ ...doc, tags: [...doc.tags, ...tags] });
  return scope.lang === 'dts'
    ? `${jsDoc}${signature};\n`
    : `${jsDoc}${signature} {\n${spec.body}}\n`;
}

export function renderTypeAlias(scope: Scope, name: string, type: string, doc: JsDocBlock): string {
  if (scope.lang === 'js')
    return renderJsDoc({
      ...doc,
      tags: [...doc.tags, { tag: 'typedef', text: `{${type}} ${name}` }],
    });
  return `${renderJsDoc(doc)}export type ${name} = ${type};\n`;
}

/** A call of the operation function with `params` (when it has parameters) and `request`. */
export function call(scope: Scope, plan: OperationPlan, params: string, request: string): string {
  return `${scope.op}(${(plan.hasParams ? [params, request] : [request]).join(', ')})`;
}

export function hookDoc(
  ctx: EmitContext,
  plan: OperationPlan,
  summary: string,
  description: string,
): JsDocBlock {
  return applyJsDocHook(
    ctx,
    { summary, description, tags: plan.symbol.operation.deprecated ? [{ tag: 'deprecated' }] : [] },
    { kind: 'hook', operation: plan.symbol.operation },
  );
}

/** The `params` parameter of query key functions and query hooks. */
export function queryParamsParam(
  plan: OperationPlan,
  scope: Scope,
  description = 'Request parameters (part of the query key).',
  type = scope.params,
): Param[] {
  if (!plan.hasParams) return [];
  return [{ name: 'params', type, optional: !plan.paramsRequired, description }];
}

/** The query key type alias and the function building it. */
export function queryKeyParts(plan: OperationPlan, q: QuerySymbols, scope: Scope): string[] {
  const op = plan.symbol.name;
  const keyName = q.queryKeyType ?? '';
  const optionalParams = plan.hasParams && !plan.paramsRequired;
  return [
    renderTypeAlias(scope, keyName, keyType(q.keyPrefix, plan.hasParams ? [scope.params] : []), {
      summary: `Query key of {@link ${op}}: a static prefix followed by every request parameter.`,
      tags: [],
    }),
    renderFunction(
      scope,
      { summary: `Builds the query key of {@link ${op}}.`, tags: [] },
      {
        name: q.queryKey ?? '',
        params: queryParamsParam(plan, scope),
        returns: keyName,
        body: `  return ${keyLiteral(q.keyPrefix, plan.hasParams ? [optionalParams ? 'params ?? {}' : 'params'] : [])};\n`,
      },
    ),
  ];
}

/** The parameters of an infinite query: everything but the page parameter. */
export interface InfiniteShape {
  /** Params property that receives the page parameter. */
  readonly property: string;
  /** `Omit<Params, 'cursor'>`. */
  readonly paramsType: string;
  /** Whether the remaining parameters are required. */
  readonly required: boolean;
  readonly pageType: string;
  readonly keyName: string;
  readonly keyFn: string;
}

export function infiniteShape(plan: OperationPlan, q: QuerySymbols, scope: Scope): InfiniteShape {
  const pageParam = q.pageParam ?? '';
  const property =
    plan.parameters.find((p) => p.parameter.in === 'query' && p.parameter.name === pageParam)
      ?.property ?? pageParam;
  return {
    property,
    paramsType: `Omit<${scope.params}, ${literal(property)}>`,
    required:
      plan.parameters.some((p) => p.parameter.required && p.property !== property) ||
      plan.body?.required === true,
    pageType: q.pageParamType ?? '',
    keyName: q.infiniteQueryKeyType ?? '',
    keyFn: q.infiniteQueryKey ?? '',
  };
}

/** The page parameter type alias, the infinite key type alias and the infinite key function. */
export function infiniteKeyParts(
  plan: OperationPlan,
  q: QuerySymbols,
  scope: Scope,
  shape: InfiniteShape,
): string[] {
  const op = plan.symbol.name;
  return [
    renderTypeAlias(scope, shape.pageType, `${scope.params}[${literal(shape.property)}]`, {
      summary: `Page parameter of {@link ${q.infiniteHook ?? op}}: the \`${q.pageParam ?? ''}\` query parameter.`,
      tags: [],
    }),
    renderTypeAlias(scope, shape.keyName, keyType(q.keyPrefix, ["'infinite'", shape.paramsType]), {
      summary: `Query key of the infinite query of {@link ${op}}.`,
      tags: [],
    }),
    renderFunction(
      scope,
      { summary: `Builds the infinite query key of {@link ${op}}.`, tags: [] },
      {
        name: shape.keyFn,
        params: [infiniteParamsParam(q, shape)],
        returns: shape.keyName,
        body: `  return ${keyLiteral(q.keyPrefix, ["'infinite'", 'params'])};\n`,
      },
    ),
  ];
}

export function infiniteParamsParam(
  q: QuerySymbols,
  shape: InfiniteShape,
  type = shape.paramsType,
): Param {
  return {
    name: 'params',
    type,
    ...(shape.required ? {} : { defaultValue: '{}' }),
    description: `Request parameters without \`${q.pageParam ?? ''}\` (part of the query key).`,
  };
}

/** The type of `getNextPageParam`/`getPreviousPageParam` and the pagination object. */
export function paginationType(scope: Scope, pageType: string): string {
  const pageFn = `(lastPage: ${scope.queryData}, allPages: ${scope.queryData}[], lastPageParam: ${pageType}, allPageParams: ${pageType}[]) => ${pageType} | undefined | null`;
  return `{ initialPageParam: ${pageType}; getNextPageParam: ${pageFn}; getPreviousPageParam?: ${pageFn} }`;
}

/** The mutation variables type: the params, `void` without parameters. */
export function mutationVariables(plan: OperationPlan, scope: Scope): string {
  return !plan.hasParams ? 'void' : plan.paramsRequired ? scope.params : `${scope.params} | void`;
}

/** The mutation function calling the operation with the variables. */
export function mutationFn(plan: OperationPlan, scope: Scope, request: string): string {
  return !plan.hasParams
    ? `() => ${scope.op}(${request})`
    : plan.paramsRequired
      ? `(variables) => ${scope.op}(variables, ${request})`
      : `(variables) => ${scope.op}(variables || undefined, ${request})`;
}

/** Resolves configured invalidation targets (operation names/ids or tags) to query key prefixes. */
export function resolveInvalidations(plan: OperationPlan, ctx: EmitContext): string[][] {
  const options =
    ctx.config.features.query === false ? ctx.config.features.swr : ctx.config.features.query;
  if (options === false) return [];
  const symbol = plan.symbol;
  const targets =
    options.invalidates[symbol.name] ??
    (symbol.operation.operationId === undefined
      ? undefined
      : options.invalidates[symbol.operation.operationId]) ??
    [];
  const keys: string[][] = [];
  for (const target of targets) {
    const operation = ctx.project.operations.find(
      (o) => o.name === target || o.operation.operationId === target,
    );
    if (operation?.query !== undefined) {
      keys.push([...operation.query.keyPrefix]);
      continue;
    }
    // A tag (nested tags match their own name) or a group directory.
    const group = ctx.project.queryGroups.find(
      (g) => g.prefix.at(-1) === target || g.group === target,
    );
    if (group !== undefined) keys.push([...group.prefix]);
  }
  return keys;
}

/** Exports of a query module, in declaration order. */
export function queryModuleExports(q: QuerySymbols, isQuery: boolean): GeneratedExport[] {
  const named = (
    name: string | undefined,
    kind: GeneratedExport['kind'],
    typeOnly = false,
  ): GeneratedExport[] => (name === undefined ? [] : [{ name, kind, typeOnly }]);
  return isQuery
    ? [
        ...named(q.queryKeyType, 'type', true),
        ...named(q.queryKey, 'query-key'),
        ...named(q.queryOptions, 'query-options'),
        ...named(q.hook, 'hook'),
        ...named(q.pageParamType, 'type', true),
        ...named(q.infiniteQueryKeyType, 'type', true),
        ...named(q.infiniteQueryKey, 'query-key'),
        ...named(q.infiniteQueryOptions, 'query-options'),
        ...named(q.infiniteHook, 'hook'),
      ]
    : [...named(q.mutationOptions, 'mutation-options'), ...named(q.hook, 'hook')];
}

/** Per-group key factory: `<group>Keys.all` matches every query of the group. */
export function generateGroupKeys(
  group: QueryGroup,
  plans: readonly OperationPlan[],
  ctx: EmitContext,
  label: string,
): ModuleOutput {
  const members = plans.filter(
    (p) => p.symbol.group === group.group && p.symbol.query?.queryKey !== undefined,
  );
  const outputs = renderAll(group.module, ctx, (imports, lang) => {
    imports.declare(group.name);
    const doc: JsDocBlock = {
      summary: `${label} keys of the \`${group.prefix.join('/')}\` operations.`,
      description:
        label === 'SWR'
          ? '`all` is the prefix of every key of the group, e.g. to revalidate them with `mutate((key) => Array.isArray(key) && key[0] === keys.all[0])`.'
          : '`all` matches every query of the group, e.g. `queryClient.invalidateQueries({ queryKey: keys.all })`.',
      tags: [],
    };
    const entries = members.map((plan) => ({
      name: plan.symbol.name,
      keyFn: imports.add(plan.symbol.query?.module ?? '', plan.symbol.query?.queryKey ?? '', {
        typeOnly: lang === 'dts',
      }),
    }));
    const all = keyLiteral(group.prefix, []);
    if (lang === 'dts') {
      const lines = [
        `  readonly all: readonly ${all};`,
        ...entries.map((e) => `  readonly ${propertyKey(e.name)}: typeof ${e.keyFn};`),
      ];
      return `${renderJsDoc(doc)}export declare const ${group.name}: {\n${lines.join('\n')}\n};\n`;
    }
    const allValue = lang === 'ts' ? `${all} as const` : `/** @type {const} */ (${all})`;
    const lines = [
      `  all: ${allValue},`,
      ...entries.map((e) => `  ${propertyKey(e.name)}: ${e.keyFn},`),
    ];
    return `${renderJsDoc(doc)}export const ${group.name} = {\n${lines.join('\n')}\n};\n`;
  });
  return {
    module: group.module,
    origin: 'core:query',
    ...outputs,
    exports: [{ name: group.name, kind: 'query-key', typeOnly: false }],
  };
}

/**
 * The `<library>/index` barrel, e.g. `react-query/index`. Kept separate so the main barrel never
 * imports a UI framework.
 */
export function generateQueryBarrel(
  library: QueryLibrary,
  ctx: EmitContext,
  modules: readonly ModuleOutput[],
): ModuleOutput {
  const module = `${library}/index`;
  const outputs = renderAll(
    module,
    ctx,
    (imports) =>
      `${modules.map((m) => `export * from '${imports.specifier(m.module)}';`).join('\n')}\n`,
  );
  return {
    module,
    origin: 'core:query-barrel',
    ...outputs,
    exports: modules.flatMap((m) => m.exports),
  };
}
