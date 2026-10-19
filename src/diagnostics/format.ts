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

/** Formats a diagnostic for terminals: severity, code, message, location, context and hint. */
export function formatDiagnostic(diagnostic: Diagnostic, options: FormatOptions = {}): string {
  const color = options.color === true;
  const lines = [
    `${paint(diagnostic.severity, SEVERITY_STYLE[diagnostic.severity], color)} ${paint(diagnostic.code, 'dim', color)} ${diagnostic.message}`,
  ];
  const location = diagnostic.location;
  if (location !== undefined) {
    let text = displayPath(location.file, options.cwd);
    if (location.line !== undefined)
      text += `:${location.line}${location.column === undefined ? '' : `:${location.column}`}`;
    if (location.pointer !== undefined && location.pointer !== '')
      text += ` (#${location.pointer})`;
    lines.push(`  ${paint('at', 'dim', color)} ${text}`);
  }
  if (diagnostic.operation !== undefined)
    lines.push(`  ${paint('in', 'dim', color)} ${diagnostic.operation}`);
  if (diagnostic.plugin !== undefined)
    lines.push(`  ${paint('plugin', 'dim', color)} ${diagnostic.plugin}`);
  if (diagnostic.hint !== undefined) {
    const [first = '', ...rest] = diagnostic.hint.split('\n');
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
