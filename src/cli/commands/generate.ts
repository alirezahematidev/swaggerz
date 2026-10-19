import type { LoadedConfig } from '../../config/load.ts';
import { TOOL_NAME } from '../../meta.ts';
import { runGeneration, type GenerationResult } from '../../pipeline/generate.ts';
import { pluralize } from '../../utils/strings.ts';
import {
  EXIT,
  flag,
  loadCliConfig,
  relative,
  type Command,
  type CommandContext,
} from '../context.ts';
import { watchAndRegenerate } from '../watch.ts';

function reportResult(ctx: CommandContext, result: GenerationResult, elapsed: number): number {
  const { reporter } = ctx;
  reporter.diagnostics(result.diagnostics);
  const write = result.write;
  reporter.json({
    ok: result.ok,
    diagnostics: result.diagnostics,
    ...(write === undefined ? {} : { write }),
    timings: result.timings,
  });
  if (!result.ok || write === undefined) {
    reporter.error(
      `Generation failed: ${reporter.summary(result.diagnostics)}. No files were written.`,
    );
    return EXIT.FAILED;
  }
  const directory = relative(ctx, write.directory);
  const changes = [
    `${write.created.length} created`,
    `${write.updated.length} updated`,
    `${write.deleted.length} deleted`,
    `${write.unchanged.length} unchanged`,
  ].join(', ');
  if (write.dryRun) {
    reporter.log(`Dry run for ${directory}: ${changes}.`);
    for (const file of write.created) reporter.log(`  ${reporter.paint('+', 'green')} ${file}`);
    for (const file of write.updated) reporter.log(`  ${reporter.paint('~', 'yellow')} ${file}`);
    for (const file of write.deleted) reporter.log(`  ${reporter.paint('-', 'red')} ${file}`);
    return EXIT.OK;
  }
  const total = write.created.length + write.updated.length + write.unchanged.length;
  reporter.success(
    `Generated ${pluralize(total, 'file')} in ${directory} (${changes}) in ${Math.round(elapsed)} ms.`,
  );
  if (ctx.reporter.options.verbose) {
    ctx.reporter.debug(
      `timings: ${Object.entries(result.timings)
        .map(([stage, ms]) => `${stage} ${ms} ms`)
        .join(', ')}`,
    );
  }
  return EXIT.OK;
}

export async function generateOnce(
  ctx: CommandContext,
): Promise<{ code: number; result: GenerationResult; loaded: LoadedConfig }> {
  const started = performance.now();
  const loaded = await loadCliConfig(
    ctx,
    'generate',
    flag(ctx, 'no-clean') ? { output: { clean: false } } : undefined,
  );
  for (const name of loaded.envApplied) ctx.reporter.debug(`environment override: ${name}`);
  const result = await runGeneration({
    config: loaded.config,
    plugins: loaded.plugins,
    dryRun: flag(ctx, 'dry-run'),
    force: flag(ctx, 'force'),
  });
  return { code: reportResult(ctx, result, performance.now() - started), result, loaded };
}

export const generateCommand: Command = {
  spec: {
    name: 'generate',
    aliases: ['gen'],
    summary: 'Generate the API client from the specification.',
    usage: `${TOOL_NAME} generate [options]`,
    options: {
      watch: {
        type: 'boolean',
        short: 'w',
        description: 'Regenerate when the specification or config changes.',
      },
      'dry-run': { type: 'boolean', description: 'Show what would change without writing files.' },
      force: {
        type: 'boolean',
        description: 'Overwrite files the generator does not own and delete edited stale files.',
      },
      'no-clean': {
        type: 'boolean',
        description: 'Keep generated files that are no longer produced.',
      },
    },
  },
  async run(ctx) {
    if (flag(ctx, 'watch')) return watchAndRegenerate(ctx);
    return (await generateOnce(ctx)).code;
  },
};
