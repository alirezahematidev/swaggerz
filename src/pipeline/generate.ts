import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { ResolvedConfig } from '../config/resolved.ts';
import { hasErrors, SwaggerzError } from '../diagnostics/bag.ts';
import type { Diagnostic } from '../diagnostics/types.ts';
import { applyWrite, planWrite, type PlannedWrite } from '../output/writer.ts';
import type { WritePlan, WriteResult } from '../output/types.ts';
import type { SwaggerzPlugin } from '../plugins/types.ts';
import { compile, laterDiagnostics, type CompileResult } from './compile.ts';

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
  /**
   * How the output manifest's file list changes (or would change in a dry run). The generator
   * version recorded in the manifest is not compared.
   */
  readonly manifestChange?: 'create' | 'update' | 'unchanged';
}

function isInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * The real path of `target`: symbolic links in its existing part are resolved (and on macOS and
 * Windows the letter case is that of the file system); the part that does not exist is appended.
 */
async function realPathOf(target: string): Promise<string> {
  const missing: string[] = [];
  let current = path.resolve(target);
  for (;;) {
    try {
      return path.join(await realpath(current), ...missing);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target);
      missing.unshift(path.basename(current));
      current = parent;
    }
  }
}

async function identity(target: string): Promise<string | undefined> {
  try {
    const info = await stat(target, { bigint: true });
    return info.ino === 0n ? undefined : `${info.dev}:${info.ino}`;
  } catch {
    return undefined;
  }
}

/**
 * True when `child` is `parent` or inside it. Real paths are compared, so symbolic links and
 * letter case cannot hide the relationship; file identities cover file systems whose real paths
 * keep the letter case they were given.
 */
async function contains(parent: string, child: string): Promise<boolean> {
  const realParent = await realPathOf(parent);
  const realChild = await realPathOf(child);
  if (isInside(realChild, realParent)) return true;
  const parentIdentity = await identity(realParent);
  if (parentIdentity === undefined) return false;
  for (let current = realChild; ; current = path.dirname(current)) {
    if ((await identity(current)) === parentIdentity) return true;
    if (path.dirname(current) === current) return false;
  }
}

/** Refuses output directories that would mix generated files with the project itself. */
export async function checkOutputDirectory(
  config: ResolvedConfig,
): Promise<Diagnostic | undefined> {
  const output = config.output.directory;
  const reasons: string[] = [];
  if (await contains(output, config.root)) reasons.push('it contains the project root');
  if (config.configFile !== undefined && (await contains(output, config.configFile)))
    reasons.push('it contains the config file');
  if (!/^https?:/i.test(config.spec.input) && (await contains(output, config.spec.input)))
    reasons.push('it contains the input specification');
  if (reasons.length === 0) return undefined;
  return {
    code: 'config/unsafe-output',
    severity: 'error',
    message: `output.directory "${output}" is not safe because ${reasons.join(' and ')}.`,
    hint: 'Use a dedicated directory such as ./src/generated/api.',
  };
}

function writeFailure(config: ResolvedConfig, error: unknown): Diagnostic {
  return {
    code: 'output/write-failed',
    severity: 'error',
    message: `Could not write the output: ${error instanceof Error ? error.message : String(error)}`,
    location: { file: config.output.directory },
  };
}

/**
 * Compiles and writes the client. Nothing is written when any error is reported, including errors
 * that plugins report in `beforeWrite`. File system problems and plugin failures are returned as
 * diagnostics.
 */
export async function runGeneration(options: RunGenerationOptions): Promise<GenerationResult> {
  const { config } = options;
  const unsafe = await checkOutputDirectory(config);
  const compiled = await compile({
    config,
    ...(options.plugins === undefined ? {} : { plugins: options.plugins }),
  });
  if (unsafe !== undefined)
    return { ...compiled, ok: false, files: [], diagnostics: [...compiled.diagnostics, unsafe] };
  if (!compiled.ok || compiled.project === undefined) return compiled;

  let planned: PlannedWrite;
  try {
    planned = await planWrite(compiled.files, config.output.directory, {
      clean: config.output.clean,
      force: options.force === true,
    });
  } catch (error) {
    return {
      ...compiled,
      ok: false,
      diagnostics: [...compiled.diagnostics, writeFailure(config, error)],
    };
  }
  const diagnostics = [...compiled.diagnostics, ...planned.notes, ...planned.conflicts];
  if (planned.conflicts.length > 0)
    return { ...compiled, ok: false, diagnostics, plan: planned.plan };

  /** Diagnostics so far, including those plugins reported after compiling. */
  const collected = (extra: readonly Diagnostic[] = []): Diagnostic[] => [
    ...diagnostics,
    ...laterDiagnostics(compiled),
    ...extra,
  ];
  const base = { project: compiled.project };
  try {
    await compiled.runner.beforeWrite(planned.plan, base);
  } catch (error) {
    if (!(error instanceof SwaggerzError)) throw error;
    return {
      ...compiled,
      ok: false,
      diagnostics: collected(error.diagnostics),
      plan: planned.plan,
    };
  }
  const beforeWrite = collected();
  if (hasErrors(beforeWrite))
    return { ...compiled, ok: false, diagnostics: beforeWrite, plan: planned.plan };
  if (options.dryRun === true) {
    const by = (kind: string): string[] =>
      planned.plan.changes.filter((c) => c.kind === kind).map((c) => c.path);
    return {
      ...compiled,
      diagnostics: beforeWrite,
      plan: planned.plan,
      manifestChange: planned.manifestChange,
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
    return {
      ...compiled,
      ok: false,
      diagnostics: [...beforeWrite, writeFailure(config, error)],
      plan: planned.plan,
    };
  }
  let afterWrite: Diagnostic[];
  try {
    await compiled.runner.afterWrite(write, base);
    afterWrite = collected();
  } catch (error) {
    if (!(error instanceof SwaggerzError)) throw error;
    afterWrite = collected(error.diagnostics);
  }
  return {
    ...compiled,
    ok: !hasErrors(afterWrite),
    diagnostics: afterWrite,
    plan: planned.plan,
    manifestChange: planned.manifestChange,
    write,
  };
}
