import { TOOL_NAME } from '../../meta.ts';
import { cleanOutput } from '../../output/writer.ts';
import { pluralize } from '../../utils/strings.ts';
import { EXIT, flag, loadCliConfig, relative, type Command } from '../context.ts';

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
    const { deleted, kept } = await cleanOutput(directory, { force: flag(ctx, 'force'), dryRun });
    const { reporter } = ctx;
    reporter.diagnostics(kept);
    reporter.json({ ok: true, directory, deleted, kept, dryRun });
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
