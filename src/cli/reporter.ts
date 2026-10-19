import { styleText } from 'node:util';
import { formatDiagnostic, summarize } from '../diagnostics/format.ts';
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

/**
 * Terminal output. Human-readable output goes to stderr for diagnostics and stdout for results;
 * in `--json` mode only a single JSON document is written to stdout.
 */
export class Reporter {
  readonly options: ReporterOptions;

  constructor(options: ReporterOptions) {
    this.options = options;
  }

  paint(text: string, style: Style): string {
    return this.options.color ? styleText(style, text, { validateStream: false }) : text;
  }

  /** Regular output (suppressed by `--quiet` and `--json`). */
  log(message = ''): void {
    if (this.options.quiet || this.options.json) return;
    this.options.stdout.write(`${message}\n`);
  }

  /** Output shown only with `--verbose`. */
  debug(message: string): void {
    if (!this.options.verbose || this.options.json) return;
    this.options.stderr.write(`${this.paint(message, 'dim')}\n`);
  }

  success(message: string): void {
    this.log(`${this.paint('✔', 'green')} ${message}`);
  }

  warn(message: string): void {
    if (this.options.json) return;
    this.options.stderr.write(`${this.paint('!', 'yellow')} ${message}\n`);
  }

  /** Errors are always printed (to stderr), except in JSON mode where they are part of the document. */
  error(message: string): void {
    if (this.options.json) return;
    this.options.stderr.write(`${this.paint('✖', 'red')} ${message}\n`);
  }

  json(value: unknown): void {
    if (this.options.json) this.options.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  }

  /** Prints diagnostics: errors always, warnings unless quiet, info only when verbose. */
  diagnostics(diagnostics: readonly Diagnostic[]): void {
    if (this.options.json) return;
    for (const diagnostic of diagnostics) {
      if (diagnostic.severity === 'info' && !this.options.verbose) continue;
      if (diagnostic.severity === 'warning' && this.options.quiet) continue;
      this.options.stderr.write(
        `${formatDiagnostic(diagnostic, { cwd: this.options.cwd, color: this.options.color })}\n`,
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
