import { TOOL_NAME } from '../../meta.ts';
import { cleanOutput } from '../../output/writer.ts';
import { checkOutputDirectory } from '../../pipeline/generate.ts';
import { pluralize } from '../../utils/strings.ts';
import { EXIT, failureCode, flag, loadCliConfig, relative, type Command } from '../context.ts';

export const cleanCommand: Command = {
  spec: {
    name: 'clean',
    summary: 'Remove generated files. Only files recorded in the output manifest are removed.',
    usage: `${TOOL_NAME} clean [options]`,
    options: {
      'dry-run': { type: 'boolean', description: 'List the files that would be removed.' },
      force: {
        type: 'boolean',
        description: 'Also remove generated files that were edited by hand.',
      },
    },
  },
  async run(ctx) {
    const loaded = await loadCliConfig(ctx, 'clean');
    const directory = loaded.config.output.directory;
    const dryRun = flag(ctx, 'dry-run');
    const { reporter } = ctx;
    // The same output directories as `generate` are refused (never the project root).
    const unsafe = await checkOutputDirectory(loaded.config);
    if (unsafe !== undefined) {
      reporter.diagnostics([unsafe]);
      reporter.json({ ok: false, directory, deleted: [], kept: [], dryRun, diagnostics: [unsafe] });
      reporter.error('Nothing was removed.');
      return failureCode([unsafe]);
    }
    const { deleted, kept, errors } = await cleanOutput(directory, {
      force: flag(ctx, 'force'),
      dryRun,
    });
    reporter.diagnostics([...kept, ...errors]);
    reporter.json({
      ok: errors.length === 0,
      directory,
      deleted,
      kept,
      dryRun,
      ...(errors.length === 0 ? {} : { diagnostics: errors }),
    });
    if (errors.length > 0) {
      reporter.error(
        deleted.length === 0
          ? `Nothing was removed from ${relative(ctx, directory)}.`
          : `Removed ${pluralize(deleted.length, 'generated file')} from ${relative(ctx, directory)}, but some could not be removed.`,
      );
      return EXIT.FAILED;
    }
    if (deleted.length === 0 && kept.length === 0) {
      reporter.log(`Nothing to clean in ${relative(ctx, directory)}.`);
    } else if (dryRun) {
      reporter.log(
        `Would remove ${pluralize(deleted.length, 'file')} from ${relative(ctx, directory)}:`,
      );
      for (const file of deleted) reporter.log(`  ${reporter.paint('-', 'red')} ${file}`);
    } else {
      reporter.success(
        `Removed ${pluralize(deleted.length, 'generated file')} from ${relative(ctx, directory)}.`,
      );
    }
    return EXIT.OK;
  },
};
