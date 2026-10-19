import { access, constants } from 'node:fs/promises';
import path from 'node:path';
import type { LoadedConfig } from '../../config/load.ts';
import { SwaggerzError } from '../../diagnostics/bag.ts';
import { formatDiagnostic } from '../../diagnostics/format.ts';
import { TOOL_NAME } from '../../meta.ts';
import { planWrite } from '../../output/writer.ts';
import { compile } from '../../pipeline/compile.ts';
import { checkOutputDirectory } from '../../pipeline/generate.ts';
import { versionLabel } from '../../spec/detect.ts';
import { pluralize } from '../../utils/strings.ts';
import { EXIT, loadCliConfig, relative, type Command, type CommandContext } from '../context.ts';
import { compareVersions, installedVersion, satisfiesCaret } from '../dependencies.ts';

type Status = 'ok' | 'warn' | 'fail';

interface Check {
  readonly name: string;
  readonly status: Status;
  readonly detail: string;
}

/** Minimum versions of packages that generated code depends on. */
export const PEER_REQUIREMENTS = {
  axios: '1.0.0',
  '@tanstack/react-query': '5.0.0',
  react: '18.0.0',
  typescript: '5.0.0',
  // Recursive getter schemas fail to type-check with Zod 4.0.0-4.0.14 on TypeScript 6+.
  zod: '4.0.15',
} as const;

const MINIMUM_NODE = '22.18.0';

/** Packages checked with a minimum version rather than a same-major (caret) range. */
const MINIMUM_ONLY = new Set<string>(['react', 'typescript']);

async function dependencyCheck(
  name: keyof typeof PEER_REQUIREMENTS,
  root: string,
  required: boolean,
  reason: string,
): Promise<Check> {
  const version = await installedVersion(name, root);
  const minimum = PEER_REQUIREMENTS[name];
  const range = MINIMUM_ONLY.has(name) ? `>=${minimum}` : `^${minimum}`;
  if (version === undefined) {
    return {
      name,
      status: required ? 'fail' : 'warn',
      detail: `not installed (${reason}; requires ${range})`,
    };
  }
  const ok = MINIMUM_ONLY.has(name)
    ? compareVersions(version, minimum) >= 0
    : satisfiesCaret(version, minimum);
  return {
    name,
    status: ok ? 'ok' : 'fail',
    detail: `${version}${ok ? '' : ` (requires ${range})`} — ${reason}`,
  };
}

async function runChecks(ctx: CommandContext): Promise<Check[]> {
  const checks: Check[] = [];
  const node = process.versions.node;
  checks.push({
    name: 'Node.js',
    status: compareVersions(node, MINIMUM_NODE) >= 0 ? 'ok' : 'fail',
    detail:
      compareVersions(node, MINIMUM_NODE) >= 0
        ? node
        : `${node} (requires >= ${MINIMUM_NODE} for TypeScript config files)`,
  });

  let loaded: LoadedConfig;
  try {
    loaded = await loadCliConfig(ctx, 'doctor');
    checks.push({
      name: 'Config',
      status: 'ok',
      detail: loaded.file === undefined ? 'inline' : relative(ctx, loaded.file),
    });
  } catch (error) {
    const detail =
      error instanceof SwaggerzError
        ? error.diagnostics.map((d) => formatDiagnostic(d, { cwd: ctx.cwd })).join('\n')
        : error instanceof Error
          ? error.message
          : String(error);
    checks.push({ name: 'Config', status: 'fail', detail });
    return checks;
  }

  const { config } = loaded;
  const compiled = await compile({ config, plugins: loaded.plugins });
  const errors = compiled.diagnostics.filter((d) => d.severity === 'error');
  const warnings = compiled.diagnostics.filter((d) => d.severity === 'warning');
  if (compiled.ir === undefined || errors.length > 0) {
    checks.push({
      name: 'Specification',
      status: 'fail',
      detail: `${pluralize(errors.length, 'error')}: ${errors
        .slice(0, 3)
        .map((d) => d.message)
        .join('; ')}`,
    });
  } else {
    checks.push({
      name: 'Specification',
      status: warnings.length > 0 ? 'warn' : 'ok',
      detail: `${versionLabel(compiled.ir.specVersion)} (${compiled.ir.specVersionRaw}), ${pluralize(compiled.ir.operations.length, 'operation')}, ${pluralize(compiled.ir.schemas.length, 'model')}${warnings.length > 0 ? `, ${pluralize(warnings.length, 'warning')} (run validate)` : ''}`,
    });
  }

  const unsafe = checkOutputDirectory(config);
  const output = relative(ctx, config.output.directory);
  if (unsafe !== undefined) {
    checks.push({ name: 'Output directory', status: 'fail', detail: unsafe.message });
  } else {
    let writable = path.resolve(config.output.directory);
    for (;;) {
      try {
        await access(writable);
        break;
      } catch {
        const parent = path.dirname(writable);
        if (parent === writable) break;
        writable = parent;
      }
    }
    try {
      await access(writable, constants.W_OK);
      checks.push({ name: 'Output directory', status: 'ok', detail: output });
    } catch {
      checks.push({
        name: 'Output directory',
        status: 'fail',
        detail: `${relative(ctx, writable)} is not writable`,
      });
    }
  }

  if (compiled.ok && compiled.files.length > 0 && unsafe === undefined) {
    const planned = await planWrite(compiled.files, config.output.directory, {
      clean: config.output.clean,
      force: false,
    });
    const stale = planned.plan.changes.filter((c) => c.kind !== 'unchanged').length;
    checks.push({
      name: 'Generated output',
      status: stale === 0 ? 'ok' : 'warn',
      detail:
        stale === 0
          ? 'up to date'
          : `${pluralize(stale, 'file')} out of date — run \`${TOOL_NAME} generate\``,
    });
  }

  const root = config.root;
  if (config.client.adapter === 'axios')
    checks.push(await dependencyCheck('axios', root, true, 'required by the axios adapter'));
  if (config.features.reactQuery !== false) {
    checks.push(
      await dependencyCheck('@tanstack/react-query', root, true, 'required by React Query hooks'),
    );
    checks.push(await dependencyCheck('react', root, true, 'required by React Query hooks'));
  }
  if (config.features.validation !== false)
    checks.push(await dependencyCheck('zod', root, true, 'required by Zod schemas'));
  if (config.output.language === 'typescript') {
    checks.push(
      await dependencyCheck('typescript', root, false, 'used to compile the generated client'),
    );
  }
  return checks;
}

export const doctorCommand: Command = {
  spec: {
    name: 'doctor',
    summary:
      'Check the environment, configuration, specification, output directory and dependencies.',
    usage: `${TOOL_NAME} doctor [options]`,
    options: {},
  },
  async run(ctx) {
    const checks = await runChecks(ctx);
    const { reporter } = ctx;
    const failed = checks.some((c) => c.status === 'fail');
    reporter.json({ ok: !failed, checks });
    const symbol: Record<Status, string> = {
      ok: reporter.paint('✔', 'green'),
      warn: reporter.paint('!', 'yellow'),
      fail: reporter.paint('✖', 'red'),
    };
    const width = Math.max(...checks.map((c) => c.name.length));
    for (const check of checks) {
      const [first = '', ...rest] = check.detail.split('\n');
      reporter.log(`${symbol[check.status]} ${check.name.padEnd(width)}  ${first}`);
      for (const line of rest) reporter.log(`  ${' '.repeat(width)}  ${line}`);
    }
    if (failed) reporter.error('Some checks failed.');
    return failed ? EXIT.FAILED : EXIT.OK;
  },
};
