/**
 * The CLI reference, read from the command definitions the CLI parses its arguments with, and
 * each command's real `--help` text.
 */
import { commandHelp, GLOBAL_OPTIONS, type OptionSpec } from '../../../src/cli/args.ts';
import { EXIT } from '../../../src/cli/context.ts';
import { COMMANDS } from '../../../src/cli/main.ts';
import { TOOL_ALIASES, TOOL_NAME } from '../../../src/meta.ts';
import { inlineMarkdown } from './markdown.ts';
import { writeGenerated } from './output.ts';

interface Option {
  readonly name: string;
  readonly short: string | undefined;
  readonly value: string | undefined;
  readonly description: string;
}

function options(entries: Readonly<Record<string, OptionSpec>>): Option[] {
  return Object.entries(entries).map(([name, option]) => ({
    name,
    short: option.short,
    value: option.type === 'string' ? option.value : undefined,
    description: option.description,
    descriptionHtml: inlineMarkdown(option.description, 'src/cli/args.ts'),
  }));
}

const EXIT_MEANING: Record<keyof typeof EXIT, string> = {
  OK: 'Success.',
  FAILED:
    'Failed checks, an invalid specification or generation errors (diagnostics were printed).',
  USAGE: 'Invalid usage or configuration, including an unsafe output directory.',
  INTERNAL: 'An unexpected internal error; please report it.',
};

export async function cli(): Promise<void> {
  await writeGenerated('cli.json', {
    name: TOOL_NAME,
    aliases: TOOL_ALIASES,
    commands: COMMANDS.map(({ spec }) => ({
      name: spec.name,
      aliases: spec.aliases ?? [],
      summary: spec.summary,
      usage: spec.usage,
      options: options(spec.options),
      help: commandHelp(spec).trimEnd(),
    })),
    globalOptions: options(GLOBAL_OPTIONS),
    exitCodes: (Object.keys(EXIT) as (keyof typeof EXIT)[]).map((key) => ({
      code: EXIT[key],
      meaning: EXIT_MEANING[key],
    })),
  });
}
