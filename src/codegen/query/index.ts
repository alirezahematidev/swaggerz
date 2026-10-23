import { dataFetching } from '../../analysis/project.ts';
import { renderAll, type EmitContext, type ModuleOutput } from '../context.ts';
import type { OperationPlan } from '../operation-plan.ts';
import { generateAccessorMutation, generateAccessorQuery, SOLID, SVELTE } from './accessor.ts';
import {
  generateGroupKeys,
  generateQueryBarrel,
  QUERY_LABELS,
  QUERY_PACKAGES,
  queryModuleExports,
  resolveInvalidations,
  Scope,
} from './common.ts';
import { generateReactMutation, generateReactQuery } from './react.ts';
import { generateSwrMutation, generateSwrQuery } from './swr.ts';
import { generateVueMutation, generateVueQuery } from './vue.ts';

export { QUERY_LABELS, QUERY_PACKAGES } from './common.ts';

/** The hooks module of one operation (`react-query/pets/get-pet`, `swr/pets/get-pet`, …). */
export function generateQueryModule(
  plan: OperationPlan,
  ctx: EmitContext,
): ModuleOutput | undefined {
  const q = plan.symbol.query;
  if (q === undefined) return undefined;
  const isQuery = q.queryKey !== undefined;
  const invalidations = isQuery ? [] : resolveInvalidations(plan);
  const exports = queryModuleExports(q, isQuery);
  const outputs = renderAll(q.module, ctx, (imports, lang) => {
    for (const entry of exports) imports.declare(entry.name);
    const scope = new Scope(imports, lang, plan, ctx, QUERY_PACKAGES[q.library]);
    const parts = (() => {
      switch (q.library) {
        case 'react-query':
          return isQuery
            ? generateReactQuery(plan, q, scope, ctx)
            : generateReactMutation(plan, q, scope, ctx, invalidations);
        case 'vue-query':
          return isQuery
            ? generateVueQuery(plan, q, scope, ctx)
            : generateVueMutation(plan, q, scope, ctx, invalidations);
        case 'svelte-query':
        case 'solid-query': {
          const framework = q.library === 'svelte-query' ? SVELTE : SOLID;
          return isQuery
            ? generateAccessorQuery(framework, plan, q, scope, ctx)
            : generateAccessorMutation(framework, plan, q, scope, ctx, invalidations);
        }
        case 'swr':
          return isQuery
            ? generateSwrQuery(plan, q, scope, ctx)
            : generateSwrMutation(plan, q, scope, ctx, invalidations);
      }
    })();
    return parts.join('\n');
  });
  return {
    module: q.module,
    origin: 'core:query',
    ...outputs,
    exports,
    sources: { operations: [plan.symbol.key] },
  };
}

/** Every hooks module, the group key factories and the library barrel. */
export function generateQueryModules(
  plans: readonly OperationPlan[],
  ctx: EmitContext,
): ModuleOutput[] {
  // From the config: the barrel exists whenever the feature is enabled, even without operations.
  const library = dataFetching(ctx.config)?.library;
  if (library === undefined) return [];
  const modules: ModuleOutput[] = [];
  for (const plan of plans) {
    const module = generateQueryModule(plan, ctx);
    if (module !== undefined) modules.push(module);
  }
  for (const group of ctx.project.queryGroups)
    modules.push(generateGroupKeys(group, plans, ctx, QUERY_LABELS[library]));
  if (ctx.config.output.barrel) modules.push(generateQueryBarrel(library, ctx, modules));
  return modules;
}
