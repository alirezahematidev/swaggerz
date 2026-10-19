export type FileChangeKind = 'create' | 'update' | 'delete' | 'unchanged';

export interface FileChange {
  /** Path relative to the output directory. */
  readonly path: string;
  readonly kind: FileChangeKind;
  /** Previous content (for updates and deletes of text files). */
  readonly before?: string;
  /** New content (for creates and updates). */
  readonly after?: string;
}

export interface WritePlan {
  /** Absolute output directory. */
  readonly directory: string;
  /** Sorted by path. */
  readonly changes: readonly FileChange[];
}

export interface WriteResult {
  readonly directory: string;
  readonly created: readonly string[];
  readonly updated: readonly string[];
  readonly deleted: readonly string[];
  readonly unchanged: readonly string[];
  readonly dryRun: boolean;
}
