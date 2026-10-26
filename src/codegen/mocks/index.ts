import type { EmitContext, ModuleOutput } from '../context.ts';
import type { OperationPlan } from '../operation-plan.ts';
import { generateFixtureModule } from './fixtures.ts';
import { generateHandlerModule, generateHandlersModule, generateMocksBarrel } from './handlers.ts';
import { MockSampler } from './sampler.ts';

/**
 * `features.mocks`: a fixture factory per model (`mocks/models/`), a Mock Service Worker handler
 * per operation (`mocks/<tag>/`), `mockHandlers()` and the `mocks/index` barrel. The support
 * module (`mocks/support`) is a template, emitted with the runtime.
 */
export function generateMockModules(
  plans: readonly OperationPlan[],
  ctx: EmitContext,
): ModuleOutput[] {
  if (ctx.config.features.mocks === false) return [];
  const sampler = new MockSampler(ctx);
  const modules: ModuleOutput[] = [];
  for (const model of ctx.project.models) {
    const module = generateFixtureModule(model, sampler, ctx);
    if (module !== undefined) modules.push(module);
  }
  for (const plan of plans) {
    const module = generateHandlerModule(plan, sampler, ctx);
    if (module !== undefined) modules.push(module);
  }
  const handlers = generateHandlersModule(plans, ctx);
  if (handlers !== undefined) modules.push(handlers);
  if (ctx.config.output.barrel) modules.push(generateMocksBarrel(ctx, modules));
  return modules;
}
