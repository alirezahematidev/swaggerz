import { parseArgs } from 'node:util';
import { suggest } from '../utils/strings.ts';

export type OptionSpec =
  | { readonly type: 'boolean'; readonly short?: string; readonly description: string }
  | {
      readonly type: 'string';
      readonly short?: string;
      readonly description: string;
      readonly value: string;
    };

export interface CommandSpec {
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly summary: string;
  readonly usage: string;
  readonly options: Readonly<Record<string, OptionSpec>>;
}

export const GLOBAL_OPTIONS: Readonly<Record<string, OptionSpec>> = {
  config: { type: 'string', short: 'c', value: 'path', description: 'Path to the config file.' },
  cwd: {
    type: 'string',
    value: 'dir',
    description: 'Working directory (default: current directory).',
  },
  verbose: { type: 'boolean', description: 'Show notes, timings and details.' },
  quiet: { type: 'boolean', short: 'q', description: 'Only print errors.' },
  json: { type: 'boolean', description: 'Print a machine-readable JSON result.' },
  color: { type: 'boolean', description: 'Force colored output.' },
  'no-color': { type: 'boolean', description: 'Disable colored output.' },
  help: { type: 'boolean', short: 'h', description: 'Show help.' },
};

export class UsageError extends Error {
  readonly hint: string | undefined;

  constructor(message: string, hint?: string) {
    super(message);
    this.name = 'UsageError';
    this.hint = hint;
  }
}

export interface ParsedArgs {
  readonly values: Readonly<Record<string, string | boolean | undefined>>;
  readonly positionals: readonly string[];
}

/** Parses arguments for a command, with helpful errors for unknown options. */
export function parseCommandArgs(spec: CommandSpec, argv: readonly string[]): ParsedArgs {
  const all = { ...GLOBAL_OPTIONS, ...spec.options };
  const options: Record<string, { type: 'boolean' | 'string'; short?: string }> = {};
  for (const [name, option] of Object.entries(all)) {
    options[name] =
      option.short === undefined
        ? { type: option.type }
        : { type: option.type, short: option.short };
  }
  try {
    const { values, positionals } = parseArgs({
      args: [...argv],
      options,
      allowPositionals: true,
      strict: true,
    });
    return { values, positionals };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const unknown = /Unknown option '(-{1,2})([^']+)'/.exec(message);
    if (unknown?.[2] !== undefined) {
      const guess = suggest(unknown[2], Object.keys(all));
      throw new UsageError(
        `Unknown option ${unknown[1] ?? '--'}${unknown[2]} for "${spec.name}".`,
        guess === undefined
          ? `Run \`${spec.usage.split(' ')[0] ?? ''} ${spec.name} --help\` for available options.`
          : `Did you mean --${guess}?`,
      );
    }
    throw new UsageError(message);
  }
}

/** Renders help text for one command. */
export function commandHelp(spec: CommandSpec): string {
  const lines = [`Usage: ${spec.usage}`, '', spec.summary, ''];
  const render = (title: string, entries: Readonly<Record<string, OptionSpec>>): void => {
    const rows = Object.entries(entries).map(([name, option]) => {
      const flag = `${option.short === undefined ? '    ' : `-${option.short}, `}--${name}${option.type === 'string' ? ` <${option.value}>` : ''}`;
      return [flag, option.description] as const;
    });
    if (rows.length === 0) return;
    const width = Math.max(...rows.map(([flag]) => flag.length));
    lines.push(`${title}:`);
    for (const [flag, description] of rows) lines.push(`  ${flag.padEnd(width)}  ${description}`);
    lines.push('');
  };
  render('Options', spec.options);
  render('Global options', GLOBAL_OPTIONS);
  return lines.join('\n');
}
