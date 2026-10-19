/** A file produced by the generator, before it is written to disk. */
export interface GeneratedFile {
  /** Path relative to the output directory, always using `/` separators. */
  readonly path: string;
  readonly content: string;
  /** Producer, e.g. `core:operation`, `core:model` or `plugin:<name>`. */
  readonly origin: string;
  /** Exported symbols, used by the barrel, the dashboard and usage scanning. */
  readonly exports?: readonly GeneratedExport[];
  /** IR entities this file was produced from. */
  readonly sources?: {
    readonly operations?: readonly string[];
    readonly schemas?: readonly string[];
  };
}

export type GeneratedExportKind =
  | 'operation'
  | 'type'
  | 'model'
  | 'hook'
  | 'query-options'
  | 'query-key'
  | 'mutation-options'
  | 'schema'
  | 'client'
  | 'runtime';

export interface GeneratedExport {
  readonly name: string;
  readonly kind: GeneratedExportKind;
  /** True for type-only exports. */
  readonly typeOnly: boolean;
}

/** Structured JSDoc block, rendered and escaped by the generator. */
export interface JsDocBlock {
  /** First paragraph. */
  readonly summary?: string;
  /** Additional paragraphs. */
  readonly description?: string;
  readonly tags: readonly JsDocTag[];
}

export interface JsDocTag {
  /** Tag name without `@`, e.g. `param`, `returns`, `deprecated`. */
  readonly tag: string;
  /** Raw tag text (escaped during rendering). */
  readonly text?: string;
}
