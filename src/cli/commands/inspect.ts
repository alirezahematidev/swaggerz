import { inspectData } from '../../analysis/describe.ts';
import { TOOL_NAME } from '../../meta.ts';
import { compile } from '../../pipeline/compile.ts';
import { versionLabel } from '../../spec/detect.ts';
import { EXIT, flag, loadCliConfig, option, type Command } from '../context.ts';

const METHOD_STYLE = {
  GET: 'green',
  POST: 'yellow',
  PUT: 'blue',
  PATCH: 'cyan',
  DELETE: 'red',
} as const;

export const inspectCommand: Command = {
  spec: {
    name: 'inspect',
    summary: 'Print a summary of the operations and models that would be generated.',
    usage: `${TOOL_NAME} inspect [options]`,
    options: {
      operations: { type: 'boolean', description: 'Only list operations.' },
      models: { type: 'boolean', description: 'Only list models.' },
      filter: {
        type: 'string',
        value: 'text',
        description: 'Only show entries whose name, path or tag contains the text.',
      },
    },
  },
  async run(ctx) {
    const loaded = await loadCliConfig(ctx, 'inspect');
    const result = await compile({ config: loaded.config, plugins: loaded.plugins });
    const { reporter } = ctx;
    reporter.diagnostics(result.diagnostics.filter((d) => d.severity === 'error'));
    if (result.project === undefined) {
      reporter.json({ ok: false, diagnostics: result.diagnostics });
      reporter.error('The specification could not be analyzed.');
      return EXIT.FAILED;
    }
    const filter = option(ctx, 'filter')?.toLowerCase();
    const data = inspectData(result.project);
    const matches = (...values: unknown[]): boolean =>
      filter === undefined ||
      values.some((v) =>
        (Array.isArray(v) ? v.join(' ') : String(v)).toLowerCase().includes(filter),
      );
    const operations = data.operations.filter((op) =>
      matches(op.name, op.path, op.tags, op.operationId),
    );
    const models = data.models.filter((model) => matches(model.name, model.id));
    const showOperations = !flag(ctx, 'models') || flag(ctx, 'operations');
    const showModels = !flag(ctx, 'operations') || flag(ctx, 'models');
    const { ir } = result.project;

    reporter.json({
      ok: result.ok,
      title: ir.info.title,
      version: ir.info.version,
      specVersion: ir.specVersionRaw,
      ...(showOperations ? { operations } : {}),
      ...(showModels ? { models } : {}),
    });
    reporter.log(
      `${reporter.paint(ir.info.title, 'bold')} ${ir.info.version} · ${versionLabel(ir.specVersion)} (${ir.specVersionRaw})`,
    );
    if (showOperations) {
      reporter.log('');
      reporter.log(reporter.paint(`Operations (${operations.length})`, 'bold'));
      const pathWidth = Math.min(
        50,
        Math.max(4, ...operations.map((op) => String(op.path).length)),
      );
      for (const op of operations) {
        const method = String(op.method);
        const style = Object.hasOwn(METHOD_STYLE, method)
          ? METHOD_STYLE[method as keyof typeof METHOD_STYLE]
          : 'gray';
        const tags = (op.tags as string[]).join(', ');
        reporter.log(
          `  ${reporter.paint(method.padEnd(7), style)}${String(op.path).padEnd(pathWidth)}  ${String(op.name)}` +
            `${tags === '' ? '' : reporter.paint(`  [${tags}]`, 'dim')}${op.deprecated === true ? reporter.paint('  deprecated', 'yellow') : ''}`,
        );
      }
    }
    if (showModels) {
      reporter.log('');
      reporter.log(reporter.paint(`Models (${models.length})`, 'bold'));
      const nameWidth = Math.min(40, Math.max(4, ...models.map((m) => String(m.name).length)));
      for (const model of models) {
        const usedBy = (model.usedBy as string[]).length;
        reporter.log(
          `  ${String(model.name).padEnd(nameWidth)}  ${String(model.kind)}` +
            reporter.paint(
              usedBy === 0 ? '  unused' : `  used by ${usedBy} operation${usedBy === 1 ? '' : 's'}`,
              'dim',
            ),
        );
      }
    }
    return result.ok ? EXIT.OK : EXIT.FAILED;
  },
};
