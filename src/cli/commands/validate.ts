import { hasErrors } from '../../diagnostics/bag.ts';
import { TOOL_NAME } from '../../meta.ts';
import { compile } from '../../pipeline/compile.ts';
import { checkOutputDirectory } from '../../pipeline/generate.ts';
import { versionLabel } from '../../spec/detect.ts';
import { pluralize } from '../../utils/strings.ts';
import { EXIT, failureCode, loadCliConfig, type Command } from '../context.ts';

export const validateCommand: Command = {
  spec: {
    name: 'validate',
    summary:
      'Validate the configuration and specification and generate in memory, without writing files.',
    usage: `${TOOL_NAME} validate [options]`,
    options: {},
  },
  async run(ctx) {
    const loaded = await loadCliConfig(ctx, 'validate');
    const result = await compile({ config: loaded.config, plugins: loaded.plugins });
    const unsafe = await checkOutputDirectory(loaded.config);
    const diagnostics = unsafe === undefined ? result.diagnostics : [...result.diagnostics, unsafe];
    const ok = !hasErrors(diagnostics);
    const { reporter } = ctx;
    reporter.diagnostics(diagnostics);
    reporter.json({
      ok,
      ...(result.ir === undefined
        ? {}
        : {
            specVersion: result.ir.specVersionRaw,
            title: result.ir.info.title,
            operations: result.ir.operations.length,
            models: result.ir.schemas.length,
          }),
      files: result.files.length,
      diagnostics,
    });
    if (!ok || result.ir === undefined) {
      reporter.error(`Validation failed: ${reporter.summary(diagnostics)}.`);
      return failureCode(diagnostics);
    }
    const { ir } = result;
    reporter.success(
      `${ir.info.title} ${ir.info.version} is valid ${versionLabel(ir.specVersion)} (${ir.specVersionRaw}): ` +
        `${pluralize(ir.operations.length, 'operation')}, ${pluralize(ir.schemas.length, 'model')}, ` +
        `${pluralize(result.files.length, 'file')} would be generated. ${reporter.summary(diagnostics)}.`,
    );
    return EXIT.OK;
  },
};
