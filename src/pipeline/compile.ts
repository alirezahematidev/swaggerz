import { buildProject } from '../analysis/project.ts';
import { splitReadWrite } from '../analysis/read-write.ts';
import type { ProjectModel } from '../analysis/types.ts';
import type { EmitContext } from '../codegen/context.ts';
import { generateBuiltinFiles } from '../codegen/generate.ts';
import type { GeneratedFile } from '../codegen/types.ts';
import type { ResolvedConfig } from '../config/resolved.ts';
import { DiagnosticBag, SwaggerzError } from '../diagnostics/bag.ts';
import type { Diagnostic } from '../diagnostics/types.ts';
import type { ApiDocument } from '../ir/types.ts';
import { enrichLocations } from '../loader/locate.ts';
import type { DocumentStore } from '../loader/store.ts';
import { isSafeOutputPath } from '../output/writer.ts';
import { PluginRunner } from '../plugins/runner.ts';
import type { GenerateContext, SwaggerzPlugin, PluginContext } from '../plugins/types.ts';
import { parseSpecification } from '../spec/parse.ts';
import { compareStrings } from '../utils/strings.ts';

export interface CompileOptions {
  readonly config: ResolvedConfig;
  readonly plugins?: readonly SwaggerzPlugin[];
}

export interface CompileResult {
  /** True when no error diagnostics were reported. */
  readonly ok: boolean;
  readonly ir?: ApiDocument;
  readonly project?: ProjectModel;
  /** Generated files sorted by path (empty when compilation failed). */
  readonly files: readonly GeneratedFile[];
  readonly diagnostics: readonly Diagnostic[];
  readonly store?: DocumentStore;
  readonly runner: PluginRunner;
  /** Milliseconds per pipeline stage. */
  readonly timings: Readonly<Record<string, number>>;
}

/** The diagnostics bag each compilation's plugins report into. */
const bags = new WeakMap<PluginRunner, DiagnosticBag>();

/**
 * Diagnostics reported after {@link compile} returned, by plugin hooks that run later
 * (`beforeWrite`, `afterWrite`), with source positions added.
 */
export function laterDiagnostics(result: CompileResult): Diagnostic[] {
  const later = bags.get(result.runner)?.toArray().slice(result.diagnostics.length) ?? [];
  return result.store === undefined ? later : enrichLocations(later, result.store);
}

/**
 * Runs the compiler pipeline without touching the file system:
 * load → plugins.beforeParse → detect/validate → resolve refs → adapter → IR →
 * plugins.afterNormalize → analysis → generators → plugin files → validation.
 */
export async function compile(options: CompileOptions): Promise<CompileResult> {
  const { config } = options;
  const diagnostics = new DiagnosticBag();
  const runner = new PluginRunner(options.plugins ?? [], diagnostics, config);
  bags.set(runner, diagnostics);
  const timings: Record<string, number> = {};
  let started = performance.now();
  const lap = (stage: string): void => {
    const now = performance.now();
    timings[stage] = Math.round((now - started) * 10) / 10;
    started = now;
  };

  let store: DocumentStore | undefined;
  const finish = (
    result: Partial<Omit<CompileResult, 'diagnostics' | 'runner' | 'timings'>>,
  ): CompileResult => {
    const all =
      store === undefined ? diagnostics.toArray() : enrichLocations(diagnostics.toArray(), store);
    return {
      ok: !diagnostics.hasErrors,
      files: [],
      ...result,
      ...(store === undefined ? {} : { store }),
      diagnostics: all,
      runner,
      timings,
    };
  };

  try {
    const parsed = await parseSpecification({
      config,
      diagnostics,
      beforeParse: (document) => runner.beforeParse(document, config.spec.input),
    });
    store = parsed.store;
    lap('parse');
    if (parsed.ir === undefined || diagnostics.hasErrors)
      return finish(parsed.ir === undefined ? {} : { ir: parsed.ir });

    const normalized = await runner.afterNormalize(parsed.ir);
    const ir =
      config.types.readWrite === 'split'
        ? splitReadWrite(normalized, config.naming.inputSuffix)
        : normalized;
    const project = buildProject({ ir, config, diagnostics, hooks: runner.namingHooks() });
    lap('analyze');

    const documents = store;
    const emit: EmitContext = {
      project,
      config,
      hooks: runner.codegenHooks(),
      report: ({ severity, source, ...diagnostic }) => {
        const file =
          source === undefined
            ? config.spec.input
            : (documents.byDisplay(source.file)?.location ?? source.file);
        diagnostics.add({
          ...diagnostic,
          severity,
          location: { file, ...(source === undefined ? {} : { pointer: source.pointer }) },
        });
      },
    };
    const base: Omit<GenerateContext, keyof PluginContext> = { project };
    await runner.beforeGenerate(base);
    let files = generateBuiltinFiles(emit);
    files = await runner.generate(files, base);
    files = await runner.transformFiles(files, base);
    files = validateFiles(files, diagnostics).sort((a, b) => compareStrings(a.path, b.path));
    await runner.afterGenerate(files, base);
    lap('generate');
    // Generation may have added errors (e.g. invalid plugin paths) after the earlier check.
    return finish({ ir, project, files: diagnostics.count('error') > 0 ? [] : files });
  } catch (error) {
    if (error instanceof SwaggerzError) {
      diagnostics.addAll(error.diagnostics);
      if (error.diagnostics.length === 0)
        diagnostics.error({ code: 'internal/error', message: error.message });
      return finish({});
    }
    throw error;
  }
}

/** Rejects unsafe or duplicate output paths. */
function validateFiles(
  files: readonly GeneratedFile[],
  diagnostics: DiagnosticBag,
): GeneratedFile[] {
  const seen = new Map<string, string>();
  const valid: GeneratedFile[] = [];
  for (const file of files) {
    if (!isSafeOutputPath(file.path)) {
      diagnostics.error({
        code: 'output/invalid-path',
        message: `Generated file path "${file.path}" (from ${file.origin}) is not a normalized path inside the output directory.`,
      });
      continue;
    }
    const key = file.path.toLowerCase();
    const previous = seen.get(key);
    if (previous !== undefined) {
      diagnostics.error({
        code: 'output/duplicate-path',
        message: `Generated file "${file.path}" (from ${file.origin}) collides with "${previous}" (paths are compared case-insensitively).`,
      });
      continue;
    }
    seen.set(key, file.path);
    valid.push(file);
  }
  return valid;
}
