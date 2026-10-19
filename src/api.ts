import { loadConfig } from './config/load.ts';
import type { UserConfig } from './config/types.ts';
import { compile, type CompileResult } from './pipeline/compile.ts';
import { runGeneration, type GenerationResult } from './pipeline/generate.ts';

export interface ApiOptions {
  /** Directory used to find the config file. Defaults to `process.cwd()`. */
  readonly cwd?: string;
  /** Explicit config file path. */
  readonly configFile?: string;
  /** Use this configuration instead of loading a config file. */
  readonly config?: UserConfig;
  /** Deep overrides applied on top of the loaded configuration. */
  readonly overrides?: Record<string, unknown>;
}

export interface GenerateOptions extends ApiOptions {
  /** Compute changes without writing files. */
  readonly dryRun?: boolean;
  /** Overwrite user-owned or hand-edited files. */
  readonly force?: boolean;
}

/**
 * Loads configuration, compiles the specification and writes the generated client.
 * Throws `SwaggerzError` when the configuration cannot be loaded; all other problems are returned
 * as diagnostics with `ok: false`.
 */
export async function generate(options: GenerateOptions = {}): Promise<GenerationResult> {
  const loaded = await loadConfig({
    cwd: options.cwd ?? process.cwd(),
    command: 'generate',
    ...(options.configFile === undefined ? {} : { configFile: options.configFile }),
    ...(options.config === undefined ? {} : { inlineConfig: options.config }),
    ...(options.overrides === undefined ? {} : { overrides: options.overrides }),
  });
  return runGeneration({
    config: loaded.config,
    plugins: loaded.plugins,
    ...(options.dryRun === undefined ? {} : { dryRun: options.dryRun }),
    ...(options.force === undefined ? {} : { force: options.force }),
  });
}

/** Validates the configuration and specification and generates in memory without writing. */
export async function validate(options: ApiOptions = {}): Promise<CompileResult> {
  const loaded = await loadConfig({
    cwd: options.cwd ?? process.cwd(),
    command: 'validate',
    ...(options.configFile === undefined ? {} : { configFile: options.configFile }),
    ...(options.config === undefined ? {} : { inlineConfig: options.config }),
    ...(options.overrides === undefined ? {} : { overrides: options.overrides }),
  });
  return compile({ config: loaded.config, plugins: loaded.plugins });
}
