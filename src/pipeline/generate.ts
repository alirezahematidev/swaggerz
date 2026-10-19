import path from 'node:path';
import type { ResolvedConfig } from '../config/resolved.ts';
import type { Diagnostic } from '../diagnostics/types.ts';
import { applyWrite, planWrite } from '../output/writer.ts';
import type { WritePlan, WriteResult } from '../output/types.ts';
import type { SwaggerzPlugin } from '../plugins/types.ts';
import { compile, type CompileResult } from './compile.ts';

export interface RunGenerationOptions {
  readonly config: ResolvedConfig;
  readonly plugins?: readonly SwaggerzPlugin[];
  /** Compute changes without writing anything. */
  readonly dryRun?: boolean;
  /** Overwrite user-owned or hand-edited files. */
  readonly force?: boolean;
}

export interface GenerationResult extends Omit<CompileResult, 'ok' | 'diagnostics'> {
  readonly ok: boolean;
  readonly diagnostics: readonly Diagnostic[];
  readonly plan?: WritePlan;
  readonly write?: WriteResult;
}

function isInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/** Refuses output directories that would mix generated files with the project itself. */
export function checkOutputDirectory(config: ResolvedConfig): Diagnostic | undefined {
  const output = config.output.directory;
  const reasons: string[] = [];
  if (isInside(config.root, output)) reasons.push('it contains the project root');
  if (config.configFile !== undefined && isInside(config.configFile, output))
    reasons.push('it contains the config file');
  if (!/^https?:/i.test(config.spec.input) && isInside(config.spec.input, output))
    reasons.push('it contains the input specification');
  if (reasons.length === 0) return undefined;
  return {
    code: 'config/unsafe-output',
    severity: 'error',
    message: `output.directory "${output}" is not safe because ${reasons.join(' and ')}.`,
    hint: 'Use a dedicated directory such as ./src/generated/api.',
  };
}

/** Compiles and writes the client. Nothing is written when any error is reported. */
export async function runGeneration(options: RunGenerationOptions): Promise<GenerationResult> {
  const { config } = options;
  const unsafe = checkOutputDirectory(config);
  const compiled = await compile({
    config,
    ...(options.plugins === undefined ? {} : { plugins: options.plugins }),
  });
  if (unsafe !== undefined)
    return { ...compiled, ok: false, files: [], diagnostics: [...compiled.diagnostics, unsafe] };
  if (!compiled.ok || compiled.project === undefined) return compiled;

  const planned = await planWrite(compiled.files, config.output.directory, {
    clean: config.output.clean,
    force: options.force === true,
  });
  const diagnostics = [...compiled.diagnostics, ...planned.notes, ...planned.conflicts];
  if (planned.conflicts.length > 0)
    return { ...compiled, ok: false, diagnostics, plan: planned.plan };

  const base = { project: compiled.project };
  await compiled.runner.beforeWrite(planned.plan, base);
  if (options.dryRun === true) {
    const by = (kind: string): string[] =>
      planned.plan.changes.filter((c) => c.kind === kind).map((c) => c.path);
    return {
      ...compiled,
      diagnostics,
      plan: planned.plan,
      write: {
        directory: planned.plan.directory,
        created: by('create'),
        updated: by('update'),
        deleted: by('delete'),
        unchanged: by('unchanged'),
        dryRun: true,
      },
    };
  }
  let write: WriteResult;
  try {
    write = await applyWrite(planned);
  } catch (error) {
    // Temporary files were removed; the previous output is still in place.
    const failure: Diagnostic = {
      code: 'output/write-failed',
      severity: 'error',
      message: `Could not write the output: ${error instanceof Error ? error.message : String(error)}`,
      location: { file: config.output.directory },
    };
    return { ...compiled, ok: false, diagnostics: [...diagnostics, failure], plan: planned.plan };
  }
  await compiled.runner.afterWrite(write, base);
  return { ...compiled, diagnostics, plan: planned.plan, write };
}
