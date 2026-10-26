import type { EmitContext, ModuleOutput } from '../context.ts';
import type { OperationPlan } from '../operation-plan.ts';
import { generateFixtureModule } from './fixtures.ts';
import { generateHandlerModule, generateHandlersModule, generateMocksBarrel } from './handlers.ts';
import { webhookModules } from '../webhooks.ts';
import { MockSampler } from './sampler.ts';
import { generateStartModule } from './start.ts';
import { generateWebhookMockModule } from './webhooks.ts';

/**
 * `features.mocks`: a fixture factory per model (`mocks/models/`), a Mock Service Worker handler
 * per operation (`mocks/<tag>/`), request fixtures and senders for webhooks and callbacks,
 * `mockHandlers()`, `startMocks()` (`mocks/start`) and the `mocks/index` barrel. The support and
 * fake data modules (`mocks/support`, `mocks/fake`) are templates, emitted with the runtime.
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
  for (const group of webhookModules(ctx.project.webhooks)) {
    const module = generateWebhookMockModule(group, sampler, ctx);
    if (module !== undefined) modules.push(module);
  }
  const handlers = generateHandlersModule(plans, ctx);
  if (handlers !== undefined) modules.push(handlers);
  const start = generateStartModule(ctx);
  if (start !== undefined) modules.push(start);
  if (ctx.config.output.barrel) modules.push(generateMocksBarrel(ctx, modules));
  return modules;
}
