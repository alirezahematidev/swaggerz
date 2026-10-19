import path from 'node:path';
import { SwaggerzError } from '../diagnostics/bag.ts';
import { PACKAGE_NAME, PACKAGE_VERSION, TOOL_NAME } from '../meta.ts';
import { suggest } from '../utils/strings.ts';
import { commandHelp, parseCommandArgs, UsageError } from './args.ts';
import { cleanCommand } from './commands/clean.ts';
import { dashboardCommand } from './commands/dashboard.ts';
import { doctorCommand } from './commands/doctor.ts';
import { generateCommand } from './commands/generate.ts';
import { initCommand } from './commands/init.ts';
import { inspectCommand } from './commands/inspect.ts';
import { validateCommand } from './commands/validate.ts';
import { EXIT, type Command } from './context.ts';
import { Reporter } from './reporter.ts';

export const COMMANDS: readonly Command[] = [
  initCommand,
  generateCommand,
  validateCommand,
  inspectCommand,
  dashboardCommand,
  cleanCommand,
  doctorCommand,
];

export interface CliIO {
  readonly stdout: NodeJS.WritableStream & { isTTY?: boolean };
  readonly stderr: NodeJS.WritableStream;
  readonly env: NodeJS.ProcessEnv;
  readonly cwd: string;
  /** Aborts long-running commands (watch mode, dashboard). */
  readonly signal: AbortSignal;
}

function generalHelp(): string {
  const width = Math.max(...COMMANDS.map((c) => c.spec.name.length));
  return [
    `${TOOL_NAME} ${PACKAGE_VERSION} — typed API clients from Swagger/OpenAPI specifications`,
    '',
    `Usage: ${TOOL_NAME} <command> [options]`,
    '',
    'Commands:',
    ...COMMANDS.map((c) => `  ${c.spec.name.padEnd(width)}  ${c.spec.summary}`),
    '',
    `Run \`${TOOL_NAME} <command> --help\` for command options.`,
    `Exit codes: 0 success, 1 failed checks or generation, 2 invalid usage or configuration, 3 internal error.`,
    '',
  ].join('\n');
}

function findCommand(name: string): Command | undefined {
  return COMMANDS.find((c) => c.spec.name === name || (c.spec.aliases ?? []).includes(name));
}

function useColor(values: Record<string, unknown>, io: CliIO): boolean {
  if (values.color === true) return true;
  if (values['no-color'] === true || values.json === true) return false;
  if (io.env.NO_COLOR !== undefined && io.env.NO_COLOR !== '') return false;
  if (io.env.FORCE_COLOR !== undefined && io.env.FORCE_COLOR !== '0') return true;
  return io.stdout.isTTY === true;
}

/** Runs the CLI and returns the process exit code. */
export async function main(argv: readonly string[], io: CliIO): Promise<number> {
  const [first, ...rest] = argv;
  if (first === undefined || first === 'help' || first === '--help' || first === '-h') {
    const target = first === 'help' && rest[0] !== undefined ? findCommand(rest[0]) : undefined;
    io.stdout.write(target === undefined ? generalHelp() : commandHelp(target.spec));
    return EXIT.OK;
  }
  if (first === '--version' || first === '-v') {
    io.stdout.write(`${PACKAGE_NAME} ${PACKAGE_VERSION}\n`);
    return EXIT.OK;
  }
  const command = findCommand(first);
  if (command === undefined) {
    const guess = suggest(
      first,
      COMMANDS.flatMap((c) => [c.spec.name, ...(c.spec.aliases ?? [])]),
    );
    io.stderr.write(
      `Unknown command "${first}".${guess === undefined ? '' : ` Did you mean "${guess}"?`}\n\n${generalHelp()}`,
    );
    return EXIT.USAGE;
  }

  let reporter: Reporter | undefined;
  try {
    const args = parseCommandArgs(command.spec, rest);
    if (args.values.help === true) {
      io.stdout.write(commandHelp(command.spec));
      return EXIT.OK;
    }
    if (args.positionals.length > 0) {
      throw new UsageError(
        `Unexpected argument "${args.positionals[0] ?? ''}" for "${command.spec.name}".`,
      );
    }
    const cwdOption = args.values.cwd;
    const cwd = typeof cwdOption === 'string' ? path.resolve(io.cwd, cwdOption) : io.cwd;
    reporter = new Reporter({
      quiet: args.values.quiet === true,
      verbose: args.values.verbose === true,
      json: args.values.json === true,
      color: useColor(args.values, io),
      cwd,
      stdout: io.stdout,
      stderr: io.stderr,
    });
    return await command.run({ args, reporter, cwd, env: io.env, signal: io.signal });
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr.write(`${error.message}\n${error.hint === undefined ? '' : `${error.hint}\n`}`);
      return EXIT.USAGE;
    }
    if (error instanceof SwaggerzError) {
      const active =
        reporter ??
        new Reporter({
          quiet: false,
          verbose: false,
          json: false,
          color: false,
          cwd: io.cwd,
          stdout: io.stdout,
          stderr: io.stderr,
        });
      active.diagnostics(error.diagnostics);
      active.json({ ok: false, diagnostics: error.diagnostics });
      const configProblem = error.diagnostics.some((d) => d.code.startsWith('config/'));
      if (!active.options.json) active.error(error.message);
      return configProblem ? EXIT.USAGE : EXIT.FAILED;
    }
    const message =
      error instanceof Error
        ? reporter?.options.verbose === true
          ? (error.stack ?? error.message)
          : error.message
        : String(error);
    io.stderr.write(
      `Internal error: ${message}\nPlease report this at the project's issue tracker${reporter?.options.verbose === true ? '' : ' (rerun with --verbose for a stack trace)'}.\n`,
    );
    return EXIT.INTERNAL;
  }
}
