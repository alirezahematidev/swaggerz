/** JSON shapes exchanged between the dashboard server and its web client. */
import type { Diagnostic } from '../diagnostics/types.ts';
import type { OperationIR, SchemaDefinition, SecuritySchemeIR } from '../ir/types.ts';
import type { DiffHunk } from '../output/diff.ts';
import type { FileChangeKind, WriteResult } from '../output/types.ts';
import type { GeneratedExportKind } from '../codegen/types.ts';

export type { Diagnostic, DiffHunk, OperationIR, SchemaDefinition, SecuritySchemeIR, WriteResult };
export type { SchemaIR } from '../ir/types.ts';

export interface Link {
  readonly id: string;
  readonly name: string;
}

export interface SourceInfo {
  readonly file: string;
  readonly pointer: string;
  readonly line?: number;
}

export interface CodeVariant {
  readonly label: string;
  readonly path: string;
  readonly language: 'typescript' | 'javascript';
  readonly content: string;
}

export interface GenerationStatus {
  /** `never`: no manifest; `stale`: generated files differ from the current output. */
  readonly status: 'never' | 'up-to-date' | 'stale' | 'failed';
  readonly generatorVersion?: string;
  readonly manifestFiles: number;
  readonly staleFiles: number;
  readonly lastRun?: { readonly at: string; readonly ok: boolean; readonly summary: string };
}

/**
 * How an operation or model differs from the version the dashboard loaded when it started:
 * `new` did not exist then, `updated` changed (in the specification or in its generated code).
 * Badges last until the dashboard is restarted.
 */
export type ChangeKind = 'new' | 'updated';

export interface ChangedItem {
  /** Operation key or model id. */
  readonly id: string;
  readonly name: string;
  /** `GET /pets/{id}` for operations. */
  readonly label?: string;
  readonly change: ChangeKind | 'removed';
}

/** Counts of what one reload changed compared with the version before it. */
export interface ReloadDelta {
  readonly operations: { readonly new: number; readonly updated: number; readonly removed: number };
  readonly models: { readonly new: number; readonly updated: number; readonly removed: number };
}

export type ReloadTrigger = 'watch' | 'manual';

export interface ReloadFailure {
  readonly at: string;
  readonly message: string;
  readonly diagnostics: readonly Diagnostic[];
}

/** The dashboard session: what it watches and what changed since it started. */
export interface SessionInfo {
  readonly startedAt: string;
  /** Increases with every reload and output change. */
  readonly revision: number;
  /** Files watched for live reload, relative to the project root; empty when watching is off. */
  readonly watching: readonly string[];
  readonly lastReload?: {
    readonly at: string;
    readonly trigger: ReloadTrigger;
    /** Changed files that triggered the reload, relative to the project root. */
    readonly files: readonly string[];
  };
  readonly changes: {
    readonly operations: readonly ChangedItem[];
    readonly models: readonly ChangedItem[];
  };
  /**
   * The latest reload failed (invalid config, unparsable specification); the dashboard keeps
   * showing the last version that loaded.
   */
  readonly failure?: ReloadFailure;
  /**
   * Polled remote documents (`spec.fetch.poll`) that cannot be fetched right now. Polling goes on;
   * the dashboard keeps showing the last version that loaded.
   */
  readonly unreachable?: readonly UnreachableDocument[];
}

export interface UnreachableDocument {
  readonly url: string;
  readonly error: string;
  /** When polling started failing (ISO 8601). */
  readonly since: string;
}

/** Events streamed from `GET /api/events` (server-sent events). */
export type ServerEvent =
  | { readonly type: 'hello'; readonly revision: number }
  | {
      readonly type: 'reload';
      readonly revision: number;
      readonly trigger: ReloadTrigger;
      readonly files: readonly string[];
      readonly ok: boolean;
      readonly delta?: ReloadDelta;
      readonly error?: string;
    }
  | { readonly type: 'output'; readonly revision: number }
  | {
      /** A polled remote document became unreachable, or reachable again. */
      readonly type: 'remote';
      readonly revision: number;
      readonly url: string;
      readonly reachable: boolean;
      readonly error?: string;
    };

export interface OverviewResponse {
  readonly title: string;
  readonly version: string;
  readonly description?: string;
  readonly specVersion: string;
  readonly specVersionRaw: string;
  readonly servers: readonly string[];
  readonly config: {
    readonly configFile?: string;
    readonly input: string;
    readonly output: string;
    readonly language: string;
    readonly adapter: string;
    readonly reactQuery: boolean;
    /** The validation library when runtime validation is on. */
    readonly validation?: 'zod';
  };
  readonly counts: {
    readonly operations: number;
    readonly models: number;
    readonly files: number;
    readonly tags: number;
    readonly deprecated: number;
  };
  readonly methods: Readonly<Record<string, number>>;
  /** In tree order: nested tags (OpenAPI 3.2) follow their parent. */
  readonly tags: readonly OverviewTag[];
  readonly diagnostics: readonly Diagnostic[];
  readonly generation: GenerationStatus;
  readonly timings: Readonly<Record<string, number>>;
  readonly session: SessionInfo;
}

export interface OverviewTag {
  readonly name: string;
  readonly summary?: string;
  readonly description?: string;
  /** OpenAPI 3.2 tag kind, e.g. `nav` or `audience`. */
  readonly kind?: string;
  readonly parent?: string;
  /** Nesting level: 0 for top-level tags. */
  readonly depth: number;
  /** Operations tagged with it directly. */
  readonly count: number;
}

export interface OperationSummary {
  readonly key: string;
  readonly name: string;
  readonly method: string;
  readonly path: string;
  readonly summary?: string;
  readonly operationId?: string;
  readonly tags: readonly string[];
  /** Tags its tags are nested under (OpenAPI 3.2), so filtering by a parent tag finds it. */
  readonly tagAncestors?: readonly string[];
  readonly deprecated: boolean;
  readonly module: string;
  readonly auth: readonly string[];
  /** First characters of the description, for search. */
  readonly description?: string;
  /** Names of every model the operation depends on, for search. */
  readonly models: readonly string[];
  readonly change?: ChangeKind;
}

export interface DependencyEntry extends Link {
  /** Reference chain from the operation to this model (model names). */
  readonly chain: readonly string[];
}

export interface OperationDetail {
  readonly summary: OperationSummary;
  readonly operation: OperationIR;
  readonly typeNames: Readonly<Record<string, string>>;
  readonly hooks: readonly string[];
  readonly request: {
    readonly accept?: string;
    readonly mediaType?: string;
    readonly parseAs?: string;
  };
  readonly security: readonly SecuritySchemeIR[];
  readonly dependencies: readonly DependencyEntry[];
  readonly code: readonly CodeVariant[];
  readonly source: SourceInfo;
}

export interface ModelSummary extends Link {
  readonly kind: string;
  readonly module: string;
  readonly used: boolean;
  readonly usedBy: number;
  readonly recursive: boolean;
  readonly deprecated: boolean;
  readonly change?: ChangeKind;
}

export interface ModelDetail {
  readonly summary: ModelSummary;
  readonly definition: SchemaDefinition;
  readonly aliases: readonly string[];
  readonly references: readonly Link[];
  readonly referencedBy: readonly Link[];
  readonly usedBy: readonly (OperationSummary & { readonly chain: readonly string[] })[];
  readonly duplicates: readonly Link[];
  readonly code: readonly CodeVariant[];
  readonly source: SourceInfo;
}

export interface GraphResponse {
  readonly unused: readonly Link[];
  readonly recursive: readonly Link[];
  readonly duplicates: readonly (readonly Link[])[];
  readonly mostUsed: readonly (Link & { readonly count: number })[];
}

export interface PreviewChange {
  readonly path: string;
  readonly kind: FileChangeKind;
  readonly additions: number;
  readonly deletions: number;
}

export interface PreviewResponse {
  readonly ok: boolean;
  readonly directory: string;
  readonly diagnostics: readonly Diagnostic[];
  readonly changes: readonly PreviewChange[];
}

export interface DiffResponse {
  readonly path: string;
  readonly kind: FileChangeKind;
  readonly hunks: readonly DiffHunk[];
}

export interface GenerateResponse {
  readonly ok: boolean;
  readonly diagnostics: readonly Diagnostic[];
  readonly write?: WriteResult;
}

export interface UsageLocation {
  /** Path relative to the project root. */
  readonly file: string;
  readonly line: number;
  readonly column: number;
}

export type UsageStatus = 'used' | 'imported' | 'unused' | 'unknown';

export interface UsageEntry {
  readonly name: string;
  readonly kind: GeneratedExportKind;
  readonly module: string;
  readonly typeOnly: boolean;
  /**
   * `used`: imported and referenced; `imported`: imported or re-exported but never referenced;
   * `unused`: never imported; `unknown`: may be used through a dynamic import, a namespace object
   * that escapes static analysis, or an `export *` re-export.
   */
  readonly status: UsageStatus;
  readonly references: number;
  readonly locations: readonly UsageLocation[];
}

export interface AmbiguousUsage {
  readonly module: string;
  readonly reason: string;
  readonly location: UsageLocation;
}

export interface UsageReport {
  readonly status: 'ok' | 'unavailable';
  readonly reason?: string;
  /** Parser used for the scan, e.g. `oxc-parser 0.154.0`. */
  readonly scanner?: string;
  readonly scannedFiles: number;
  readonly truncated: boolean;
  readonly durationMs: number;
  readonly entries: readonly UsageEntry[];
  readonly ambiguous: readonly AmbiguousUsage[];
}
