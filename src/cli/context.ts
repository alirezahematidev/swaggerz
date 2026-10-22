import path from 'node:path';
import { loadConfig, type LoadedConfig } from '../config/load.ts';
import type { Diagnostic } from '../diagnostics/types.ts';
import { UsageError, type ParsedArgs, type CommandSpec } from './args.ts';
import type { Reporter } from './reporter.ts';

export const EXIT = {
  /** Success. */
  OK: 0,
  /** The specification, generation or a check failed (diagnostics were printed). */
  FAILED: 1,
  /** Invalid command-line usage or configuration. */
  USAGE: 2,
  /** Unexpected internal error. */
  INTERNAL: 3,
} as const;

/**
 * The exit code for a failed run: configuration errors (such as `config/unsafe-output`) exit with
 * {@link EXIT.USAGE} like other configuration problems, everything else with {@link EXIT.FAILED}.
 */
export function failureCode(diagnostics: readonly Diagnostic[]): number {
  return diagnostics.some((d) => d.severity === 'error' && d.code.startsWith('config/'))
    ? EXIT.USAGE
    : EXIT.FAILED;
}

export interface CommandContext {
  readonly args: ParsedArgs;
  readonly reporter: Reporter;
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  /** Resolves when the command should stop (e.g. Ctrl+C in watch mode). */
  readonly signal: AbortSignal;
}

export interface Command {
  readonly spec: CommandSpec;
  run(ctx: CommandContext): Promise<number>;
}

export function flag(ctx: CommandContext, name: string): boolean {
  return ctx.args.values[name] === true;
}

export function option(ctx: CommandContext, name: string): string | undefined {
  const value = ctx.args.values[name];
  return typeof value === 'string' ? value : undefined;
}

/**
 * A non-negative integer option written in decimal digits (so `''`, `0x10`, `1e1` and `-1` are
 * rejected rather than read as numbers). Throws a {@link UsageError} for other values.
 */
export function integerOption(
  ctx: CommandContext,
  name: string,
  range: { readonly max?: number } = {},
): number | undefined {
  const value = option(ctx, name);
  if (value === undefined) return undefined;
  const parsed = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(parsed) || (range.max !== undefined && parsed > range.max)) {
    throw new UsageError(
      `--${name} must be ${range.max === undefined ? 'a non-negative integer' : `an integer between 0 and ${range.max}`}, but received ${JSON.stringify(value)}.`,
    );
  }
  return parsed;
}

/** Loads configuration honoring `--config`, `--cwd` and command-specific overrides. */
export function loadCliConfig(
  ctx: CommandContext,
  command: string,
  overrides?: Record<string, unknown>,
): Promise<LoadedConfig> {
  const configFile = option(ctx, 'config');
  return loadConfig({
    cwd: ctx.cwd,
    command,
    env: ctx.env,
    ...(configFile === undefined ? {} : { configFile }),
    ...(overrides === undefined ? {} : { overrides }),
  });
}

export function relative(ctx: CommandContext, target: string): string {
  const result = path.relative(ctx.cwd, target);
  return result === '' ? '.' : result.startsWith('..') ? target : result;
}
