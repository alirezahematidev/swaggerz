import { hasErrors } from '../../diagnostics/bag.ts';
import { lintProject, LINT_RULES, ruleSeverities } from '../../lint/lint.ts';
import { TOOL_NAME } from '../../meta.ts';
import { compile } from '../../pipeline/compile.ts';
import { pluralize } from '../../utils/strings.ts';
import { EXIT, flag, integerOption, loadCliConfig, type Command } from '../context.ts';

export const lintCommand: Command = {
  spec: {
    name: 'lint',
    summary:
      'Report what in the specification makes the generated client worse: missing operationIds, untyped responses, inline schemas and more.',
    usage: `${TOOL_NAME} lint [options]`,
    options: {
      'max-warnings': {
        type: 'string',
        value: 'n',
        description: 'Fail when there are more than n warnings (default: no limit).',
      },
      rules: { type: 'boolean', description: 'List the rules with their configured severity.' },
    },
  },
  async run(ctx) {
    const { reporter } = ctx;
    const limit = integerOption(ctx, 'max-warnings');
    const loaded = await loadCliConfig(ctx, 'lint');

    if (flag(ctx, 'rules')) {
      const severities = ruleSeverities(loaded.config);
      const rules = LINT_RULES.map((rule) => ({
        name: rule.name,
        severity: severities.get(rule.name) ?? 'off',
        summary: rule.summary,
      }));
      reporter.json({ ok: true, rules });
      const width = Math.max(...rules.map((rule) => rule.name.length));
      for (const rule of rules)
        reporter.log(
          `${rule.name.padEnd(width)}  ${reporter.paint(rule.severity.padEnd(7), rule.severity === 'error' ? 'red' : rule.severity === 'warning' ? 'yellow' : 'dim')}  ${rule.summary}`,
        );
      return EXIT.OK;
    }

    const result = await compile({ config: loaded.config, plugins: loaded.plugins });
    const findings =
      result.project === undefined ? [] : lintProject(result.project, loaded.config, result.store);
    const diagnostics = [...result.diagnostics, ...findings];
    const warnings = diagnostics.filter((d) => d.severity === 'warning').length;
    const tooManyWarnings = limit !== undefined && warnings > limit;
    const ok = result.project !== undefined && !hasErrors(diagnostics) && !tooManyWarnings;
    reporter.diagnostics(result.diagnostics);
    reporter.diagnostics(findings, { showInfo: true });
    reporter.json({ ok, diagnostics });
    const counts = (['error', 'warning', 'info'] as const).map(
      (severity) => findings.filter((d) => d.severity === severity).length,
    );
    const summary = `${pluralize(findings.length, 'finding')} (${pluralize(counts[0] ?? 0, 'error')}, ${pluralize(counts[1] ?? 0, 'warning')}, ${pluralize(counts[2] ?? 0, 'note')})`;
    if (result.project === undefined) {
      reporter.error(`The specification could not be compiled: ${reporter.summary(diagnostics)}.`);
      return EXIT.FAILED;
    }
    if (!ok) {
      reporter.error(
        tooManyWarnings && !hasErrors(diagnostics)
          ? `${summary}: ${pluralize(warnings, 'warning')} exceed --max-warnings ${String(limit)}.`
          : `${summary}; the specification has errors.`,
      );
      return EXIT.FAILED;
    }
    reporter.success(
      findings.length === 0 ? 'No findings.' : `${summary}. Configure rules with lint.rules.`,
    );
    return EXIT.OK;
  },
};
