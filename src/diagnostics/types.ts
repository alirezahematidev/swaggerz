export type Severity = 'error' | 'warning' | 'info';

/** A position inside a loaded specification document. */
export interface SourceLocation {
  /** Absolute file path or URL of the document. */
  readonly file: string;
  /** RFC 6901 JSON pointer inside the document, e.g. `/paths/~1pets/get`. */
  readonly pointer?: string;
  /** 1-based line, resolved lazily when available. */
  readonly line?: number;
  /** 1-based column, resolved lazily when available. */
  readonly column?: number;
}

/**
 * A compiler diagnostic. Codes follow `<area>/<problem>` (for example `spec/version-mismatch`)
 * and are stable across patch releases so tooling can filter on them.
 */
export interface Diagnostic {
  readonly code: string;
  readonly severity: Severity;
  readonly message: string;
  readonly location?: SourceLocation;
  /** Operation context such as `GET /pets/{id} (getPet)`. */
  readonly operation?: string;
  /** Actionable advice for resolving the problem. */
  readonly hint?: string;
  /** Name of the plugin that reported or caused the diagnostic. */
  readonly plugin?: string;
}
