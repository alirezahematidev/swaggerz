import { generateBarrel } from './barrel.ts';
import { generateClientModule } from './client-module.ts';
import type { EmitContext, ModuleOutput } from './context.ts';
import { generateModel } from './models.ts';
import { planOperation, type OperationPlan } from './operation-plan.ts';
import { generateOperation } from './operations.ts';
import { generateQueryModules } from './query/index.ts';
import { generateRuntimeFiles } from './runtime-files.ts';
import { generateDatesModule } from './dates.ts';
import { generateMockModules } from './mocks/index.ts';
import { generateWebhookModule, webhookModules } from './webhooks.ts';
import { generateValidationModules } from './validation/index.ts';
import type { GeneratedFile } from './types.ts';

export function planOperations(ctx: EmitContext): OperationPlan[] {
  return ctx.project.operations.map((symbol) => planOperation(symbol, ctx.project.ir));
}

/** Generates every built-in module (not yet expanded into language-specific files). */
export function generateModules(ctx: EmitContext): ModuleOutput[] {
  const plans = planOperations(ctx);
  const modules: ModuleOutput[] = [generateClientModule(ctx)];
  for (const model of ctx.project.models) modules.push(generateModel(model, ctx));
  for (const plan of plans) modules.push(generateOperation(plan, ctx));
  for (const group of webhookModules(ctx.project.webhooks))
    modules.push(generateWebhookModule(group, ctx));
  for (const model of ctx.project.models) {
    const dates = generateDatesModule(model, ctx);
    if (dates !== undefined) modules.push(dates);
  }
  if (ctx.config.output.barrel) modules.push(generateBarrel(ctx, modules));
  modules.push(...generateValidationModules(ctx));
  modules.push(...generateQueryModules(plans, ctx));
  modules.push(...generateMockModules(plans, ctx));
  return modules;
}

/** Expands modules into files: `.ts` for TypeScript, `.js` (+ `.d.ts`) for JavaScript output. */
export function modulesToFiles(
  modules: readonly ModuleOutput[],
  ctx: EmitContext,
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const typescript = ctx.config.output.language === 'typescript';
  for (const module of modules) {
    const meta = {
      origin: module.origin,
      exports: module.exports,
      ...(module.sources === undefined ? {} : { sources: module.sources }),
    };
    if (typescript) {
      files.push({ path: `${module.module}.ts`, content: module.ts, ...meta });
    } else {
      files.push({ path: `${module.module}.js`, content: module.js, ...meta });
      if (ctx.config.output.declarations)
        files.push({ path: `${module.module}.d.ts`, content: module.dts, ...meta });
    }
  }
  return files;
}

/** All built-in files in deterministic order. */
export function generateBuiltinFiles(ctx: EmitContext): GeneratedFile[] {
  return [...generateRuntimeFiles(ctx.config), ...modulesToFiles(generateModules(ctx), ctx)];
}
