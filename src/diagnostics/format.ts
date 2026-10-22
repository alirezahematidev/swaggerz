import path from 'node:path';
import { styleText } from 'node:util';
import type { Diagnostic, Severity } from './types.ts';

export interface FormatOptions {
  /** Paths are shown relative to this directory. */
  readonly cwd?: string;
  /** Use ANSI colors. Default `false`. */
  readonly color?: boolean;
}

type Style = Parameters<typeof styleText>[0];

const SEVERITY_STYLE: Record<Severity, Style> = { error: 'red', warning: 'yellow', info: 'cyan' };

function isControlCharacter(code: number): boolean {
  return (code < 0x20 && code !== 0x09 && code !== 0x0a) || (code >= 0x7f && code <= 0x9f);
}

/**
 * Makes untrusted text (from specifications, plugins or file names) safe to print to a terminal:
 * C0 and C1 control characters other than newline and tab are shown as `\xNN` escapes, so the
 * text cannot move the cursor, clear the screen, set the window title or write to the clipboard.
 */
export function printable(text: string): string {
  let result = '';
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (!isControlCharacter(code)) continue;
    result += `${text.slice(start, index)}\\x${code.toString(16).padStart(2, '0')}`;
    start = index + 1;
  }
  return start === 0 ? text : result + text.slice(start);
}

function paint(text: string, style: Style, enabled: boolean): string {
  return enabled ? styleText(style, text, { validateStream: false }) : text;
}

export function displayPath(file: string, cwd: string | undefined): string {
  if (cwd === undefined || /^[a-z]+:\/\//i.test(file)) return file;
  const relative = path.relative(cwd, file);
  return relative === ''
    ? file
    : relative.startsWith('..') && path.isAbsolute(file)
      ? file
      : relative;
}

/**
 * Formats a diagnostic for terminals: severity, code, message, location, context and hint.
 * Control characters in the diagnostic's text are escaped (see {@link printable}).
 */
export function formatDiagnostic(diagnostic: Diagnostic, options: FormatOptions = {}): string {
  const color = options.color === true;
  const lines = [
    `${paint(diagnostic.severity, SEVERITY_STYLE[diagnostic.severity], color)} ${paint(printable(diagnostic.code), 'dim', color)} ${printable(diagnostic.message)}`,
  ];
  const location = diagnostic.location;
  if (location !== undefined) {
    let text = printable(displayPath(location.file, options.cwd));
    if (location.line !== undefined)
      text += `:${location.line}${location.column === undefined ? '' : `:${location.column}`}`;
    if (location.pointer !== undefined && location.pointer !== '')
      text += ` (#${printable(location.pointer)})`;
    lines.push(`  ${paint('at', 'dim', color)} ${text}`);
  }
  if (diagnostic.operation !== undefined)
    lines.push(`  ${paint('in', 'dim', color)} ${printable(diagnostic.operation)}`);
  if (diagnostic.plugin !== undefined)
    lines.push(`  ${paint('plugin', 'dim', color)} ${printable(diagnostic.plugin)}`);
  if (diagnostic.hint !== undefined) {
    const [first = '', ...rest] = printable(diagnostic.hint).split('\n');
    lines.push(
      `  ${paint('hint', 'green', color)} ${first}`,
      ...rest.map((line) => `       ${line}`),
    );
  }
  return lines.join('\n');
}

export function summarize(diagnostics: readonly Diagnostic[]): Record<Severity, number> {
  return {
    error: diagnostics.filter((d) => d.severity === 'error').length,
    warning: diagnostics.filter((d) => d.severity === 'warning').length,
    info: diagnostics.filter((d) => d.severity === 'info').length,
  };
}
