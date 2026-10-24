/**
 * The compiler for the browser: the repository's own pipeline, bundled with shims for the Node.js
 * modules it imports (scripts/playground.ts). It compiles a specification given as text, in
 * memory, and never fetches: external references are disabled.
 */
import { resolveConfig } from '../../src/config/resolve.ts';
import type { UserConfig } from '../../src/config/types.ts';
import { validateUserConfig } from '../../src/config/validate.ts';
import { formatDiagnostic } from '../../src/diagnostics/format.ts';
import type { Diagnostic } from '../../src/diagnostics/types.ts';
import { lintProject } from '../../src/lint/lint.ts';
import { compile } from '../../src/pipeline/compile.ts';
import { setFiles } from './shims/virtual-files.ts';

export const ROOT = '/playground';

export interface BrowserCompileInput {
  /** Virtual files by name, relative to the playground root; `spec.input` names one of them. */
  readonly files: Readonly<Record<string, string>>;
  readonly config: UserConfig;
  readonly lint?: boolean;
}

export interface BrowserDiagnostic extends Diagnostic {
  /** The diagnostic as the CLI prints it, without colors. */
  readonly formatted: string;
}

export interface BrowserCompileResult {
  readonly ok: boolean;
  readonly files: readonly { readonly path: string; readonly content: string }[];
  readonly diagnostics: readonly BrowserDiagnostic[];
  readonly timings: Readonly<Record<string, number>>;
  readonly operations: number;
  readonly models: number;
}

export async function compileInBrowser(input: BrowserCompileInput): Promise<BrowserCompileResult> {
  setFiles(
    Object.fromEntries(
      Object.entries(input.files).map(([name, content]) => [`${ROOT}/${name}`, content]),
    ),
  );
  const issues = validateUserConfig(input.config);
  const format = (diagnostic: Diagnostic): BrowserDiagnostic => ({
    ...diagnostic,
    ...(diagnostic.location === undefined
      ? {}
      : {
          location: {
            ...diagnostic.location,
            file: diagnostic.location.file.replace(`${ROOT}/`, ''),
          },
        }),
    formatted: formatDiagnostic(diagnostic, { cwd: ROOT }),
  });
  if (issues.length > 0) {
    return {
      ok: false,
      files: [],
      diagnostics: issues.map((issue) =>
        format({
          code: 'config/invalid',
          severity: 'error',
          message: `${issue.path === '' ? 'config' : issue.path}: ${issue.message}`,
          ...(issue.hint === undefined ? {} : { hint: issue.hint }),
        }),
      ),
      timings: {},
      operations: 0,
      models: 0,
    };
  }
  const config = resolveConfig(
    {
      ...input.config,
      // Nothing is fetched or read beyond the files given.
      spec: { ...input.config.spec, refs: { external: 'none' } },
      output: { directory: './out', ...input.config.output },
    },
    { root: ROOT },
  );
  const result = await compile({ config });
  const findings =
    input.lint === true && result.project !== undefined
      ? lintProject(result.project, config, result.store)
      : [];
  return {
    ok: result.ok,
    files: result.files.map((file) => ({ path: file.path, content: file.content })),
    diagnostics: [...result.diagnostics, ...findings].map(format),
    timings: result.timings,
    operations: result.project?.operations.length ?? 0,
    models: result.project?.models.length ?? 0,
  };
}
