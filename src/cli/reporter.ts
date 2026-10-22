import { styleText } from 'node:util';
import { formatDiagnostic, printable, summarize } from '../diagnostics/format.ts';
import type { Diagnostic } from '../diagnostics/types.ts';
import { pluralize } from '../utils/strings.ts';

export interface ReporterOptions {
  readonly quiet: boolean;
  readonly verbose: boolean;
  readonly json: boolean;
  readonly color: boolean;
  readonly cwd: string;
  readonly stdout: NodeJS.WritableStream;
  readonly stderr: NodeJS.WritableStream;
}

type Style = Parameters<typeof styleText>[0];

const ESCAPE = '\u001b';

/** The color and weight sequences {@link Reporter.paint} produces (after the escape character). */
const STYLE_SEQUENCE = /^\[(?:1|2|22|31|32|33|34|36|39|90)m/;

/**
 * Escapes control characters in text printed to a terminal (see {@link printable}). With colors
 * enabled, only the color and weight sequences that {@link Reporter.paint} produces are kept, so
 * text from a specification cannot clear the screen, set the window title or write to the
 * clipboard.
 */
export function terminalSafe(text: string, color: boolean): string {
  if (!color || !text.includes(ESCAPE)) return printable(text);
  const [first = '', ...rest] = text.split(ESCAPE);
  return (
    printable(first) +
    rest
      .map((part) => {
        const style = STYLE_SEQUENCE.exec(part)?.[0];
        return style === undefined
          ? printable(`${ESCAPE}${part}`)
          : `${ESCAPE}${style}${printable(part.slice(style.length))}`;
      })
      .join('')
  );
}

/**
 * Terminal output. Human-readable output goes to stderr for diagnostics and stdout for results;
 * in `--json` mode only a single JSON document is written to stdout. Human-readable output never
 * contains control characters other than newlines, tabs and the reporter's own colors.
 */
export class Reporter {
  readonly options: ReporterOptions;

  constructor(options: ReporterOptions) {
    this.options = options;
  }

  #write(stream: NodeJS.WritableStream, text: string): void {
    stream.write(`${terminalSafe(text, this.options.color)}\n`);
  }

  paint(text: string, style: Style): string {
    return this.options.color ? styleText(style, text, { validateStream: false }) : text;
  }

  /** Regular output (suppressed by `--quiet` and `--json`). */
  log(message = ''): void {
    if (this.options.quiet || this.options.json) return;
    this.#write(this.options.stdout, message);
  }

  /** Output shown only with `--verbose`. */
  debug(message: string): void {
    if (!this.options.verbose || this.options.json) return;
    this.#write(this.options.stderr, this.paint(message, 'dim'));
  }

  success(message: string): void {
    this.log(`${this.paint('✔', 'green')} ${message}`);
  }

  warn(message: string): void {
    if (this.options.json) return;
    this.#write(this.options.stderr, `${this.paint('!', 'yellow')} ${message}`);
  }

  /** Errors are always printed (to stderr), except in JSON mode where they are part of the document. */
  error(message: string): void {
    if (this.options.json) return;
    this.#write(this.options.stderr, `${this.paint('✖', 'red')} ${message}`);
  }

  /** Details of an error, such as the files it concerns (stderr; also printed with `--quiet`). */
  detail(message: string): void {
    if (this.options.json) return;
    this.#write(this.options.stderr, message);
  }

  json(value: unknown): void {
    if (this.options.json) this.options.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  }

  /**
   * Prints diagnostics: errors always, warnings unless quiet, info only when verbose (or when
   * `showInfo` is set, for reports such as lint findings).
   */
  diagnostics(diagnostics: readonly Diagnostic[], options: { showInfo?: boolean } = {}): void {
    if (this.options.json) return;
    for (const diagnostic of diagnostics) {
      if (diagnostic.severity === 'info' && !this.options.verbose && options.showInfo !== true)
        continue;
      if (diagnostic.severity === 'warning' && this.options.quiet) continue;
      this.#write(
        this.options.stderr,
        formatDiagnostic(diagnostic, { cwd: this.options.cwd, color: this.options.color }),
      );
    }
  }

  /** One-line summary such as `2 errors, 1 warning`. */
  summary(diagnostics: readonly Diagnostic[]): string {
    const counts = summarize(diagnostics);
    const parts = [pluralize(counts.error, 'error'), pluralize(counts.warning, 'warning')];
    if (this.options.verbose) parts.push(pluralize(counts.info, 'note'));
    return parts.join(', ');
  }
}
