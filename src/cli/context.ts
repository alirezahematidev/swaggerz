import path from 'node:path';
import { loadConfig, type LoadedConfig } from '../config/load.ts';
import type { ParsedArgs, CommandSpec } from './args.ts';
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
