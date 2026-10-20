import type { LoadedConfig } from '../../config/load.ts';
import { MANIFEST_FILENAME, TOOL_NAME } from '../../meta.ts';
import { runGeneration, type GenerationResult } from '../../pipeline/generate.ts';
import { pluralize } from '../../utils/strings.ts';
import { UsageError } from '../args.ts';
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

/**
 * `--check`: compares what would be generated with the output directory without writing, and fails
 * when they differ (missing, outdated, hand-edited or leftover files, or a changed manifest).
 */
function reportCheck(ctx: CommandContext, result: GenerationResult): number {
  const { reporter } = ctx;
  reporter.diagnostics(result.diagnostics);
  const write = result.write;
  if (!result.ok || write === undefined) {
    reporter.json({ ok: false, upToDate: false, diagnostics: result.diagnostics });
    reporter.error(
      `Check failed: the client cannot be generated (${reporter.summary(result.diagnostics)}).`,
    );
    return EXIT.FAILED;
  }
  const manifest = result.manifestChange ?? 'unchanged';
  const changed = write.created.length + write.updated.length + write.deleted.length;
  const upToDate = changed === 0 && manifest === 'unchanged';
  reporter.json({
    ok: upToDate,
    upToDate,
    diagnostics: result.diagnostics,
    check: {
      directory: write.directory,
      created: write.created,
      updated: write.updated,
      deleted: write.deleted,
      unchanged: write.unchanged.length,
      manifest,
    },
    timings: result.timings,
  });
  const directory = relative(ctx, write.directory);
  if (upToDate) {
    reporter.success(`${directory} is up to date (${pluralize(write.unchanged.length, 'file')}).`);
    return EXIT.OK;
  }
  const parts = [
    write.created.length > 0 ? `${write.created.length} missing` : '',
    write.updated.length > 0 ? `${write.updated.length} outdated or edited` : '',
    write.deleted.length > 0 ? `${write.deleted.length} no longer generated` : '',
    manifest === 'unchanged' ? '' : `manifest ${manifest === 'create' ? 'missing' : 'outdated'}`,
  ].filter((part) => part !== '');
  reporter.error(`${directory} is out of date: ${parts.join(', ')}.`);
  const line = (mark: string, style: 'green' | 'yellow' | 'red', file: string): void => {
    reporter.detail(`  ${reporter.paint(mark, style)} ${file}`);
  };
  for (const file of write.created) line('+', 'green', file);
  for (const file of write.updated) line('~', 'yellow', file);
  for (const file of write.deleted) line('-', 'red', file);
  if (manifest !== 'unchanged')
    line(manifest === 'create' ? '+' : '~', 'yellow', MANIFEST_FILENAME);
  reporter.detail(`Run \`${TOOL_NAME} generate\` and commit the result.`);
  return EXIT.FAILED;
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
  const check = flag(ctx, 'check');
  const result = await runGeneration({
    config: loaded.config,
    plugins: loaded.plugins,
    dryRun: check || flag(ctx, 'dry-run'),
    force: flag(ctx, 'force'),
  });
  const code = check
    ? reportCheck(ctx, result)
    : reportResult(ctx, result, performance.now() - started);
  return { code, result, loaded };
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
      check: {
        type: 'boolean',
        description:
          'Write nothing; exit with 1 and list the differences when the output is not up to date (for CI).',
      },
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
    if (flag(ctx, 'check') && (flag(ctx, 'watch') || flag(ctx, 'dry-run'))) {
      throw new UsageError(
        `--check cannot be combined with --${flag(ctx, 'watch') ? 'watch' : 'dry-run'}.`,
        '--check already writes nothing; run it once, for example in CI.',
      );
    }
    if (flag(ctx, 'watch')) return watchAndRegenerate(ctx);
    return (await generateOnce(ctx)).code;
  },
};
