import type { Diagnostic, Severity } from './types.ts';

type DiagnosticInput = Omit<Diagnostic, 'severity'>;

/** Collects diagnostics during a compilation and keeps them in a deterministic order. */
export class DiagnosticBag {
  readonly #items: Diagnostic[] = [];
  readonly #seen = new Set<string>();

  add(diagnostic: Diagnostic): void {
    const key = `${diagnostic.severity}|${diagnostic.code}|${diagnostic.message}|${diagnostic.location?.file ?? ''}|${diagnostic.location?.pointer ?? ''}|${diagnostic.operation ?? ''}`;
    if (this.#seen.has(key)) return;
    this.#seen.add(key);
    this.#items.push(diagnostic);
  }

  error(input: DiagnosticInput): void {
    this.add({ ...input, severity: 'error' });
  }

  warning(input: DiagnosticInput): void {
    this.add({ ...input, severity: 'warning' });
  }

  info(input: DiagnosticInput): void {
    this.add({ ...input, severity: 'info' });
  }

  addAll(diagnostics: Iterable<Diagnostic>): void {
    for (const diagnostic of diagnostics) this.add(diagnostic);
  }

  get hasErrors(): boolean {
    return this.#items.some((d) => d.severity === 'error');
  }

  count(severity: Severity): number {
    return this.#items.filter((d) => d.severity === severity).length;
  }

  /** Diagnostics in insertion order, which follows the deterministic traversal of the spec. */
  toArray(): Diagnostic[] {
    return [...this.#items];
  }
}

/** Thrown when compilation cannot continue. Carries the diagnostics collected so far. */
export class SwaggerzError extends Error {
  readonly diagnostics: readonly Diagnostic[];

  constructor(message: string, diagnostics: readonly Diagnostic[] = []) {
    super(message);
    this.name = 'SwaggerzError';
    this.diagnostics = diagnostics;
  }
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === 'error');
}
