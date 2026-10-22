import type { ProjectModel } from '../analysis/types.ts';
import type { GeneratedFile, JsDocBlock } from '../codegen/types.ts';
import type { ResolvedConfig } from '../config/resolved.ts';
import type { Diagnostic } from '../diagnostics/types.ts';
import type { ApiDocument, OperationIR, SchemaDefinition } from '../ir/types.ts';
import type { WritePlan, WriteResult } from '../output/types.ts';

type MaybePromise<T> = T | Promise<T>;

/** Shared by every hook context. */
export interface PluginContext {
  readonly config: ResolvedConfig;
  /** Report a diagnostic. Error diagnostics abort generation before files are written. */
  report(diagnostic: Omit<Diagnostic, 'plugin'>): void;
}

export interface BeforeParseContext extends PluginContext {
  /** URL or absolute path of the root document. */
  readonly source: string;
}

export type AfterNormalizeContext = PluginContext;

export interface GenerateContext extends PluginContext {
  /** IR plus resolved names and layout. Experimental. */
  readonly project: ProjectModel;
}

export interface FileContext extends GenerateContext {
  /** Files produced so far, in deterministic order. */
  readonly files: readonly GeneratedFile[];
}

export type JsDocTarget =
  | { readonly kind: 'operation'; readonly operation: OperationIR }
  | { readonly kind: 'model'; readonly definition: SchemaDefinition }
  | { readonly kind: 'hook'; readonly operation: OperationIR };

/**
 * A generator plugin. Every hook is optional. Hooks of all plugins run sequentially in a
 * deterministic order: `enforce: 'pre'` plugins, then default plugins, then `config.hooks`,
 * then `enforce: 'post'` plugins — each group in array order. A hook that throws aborts the
 * run with a `plugin/hook-failed` diagnostic; no files are written.
 */
export interface SwaggerzPlugin {
  /** Unique, human-readable plugin name used in diagnostics. */
  readonly name: string;
  readonly enforce?: 'pre' | 'post';

  /**
   * Before the document is validated and parsed. Receives the raw root document and may return a
   * replacement (for example to patch a broken specification).
   */
  beforeParse?(document: unknown, ctx: BeforeParseContext): MaybePromise<unknown>;

  /** After the document is normalized into the IR. May return a modified IR. */
  afterNormalize?(ir: ApiDocument, ctx: AfterNormalizeContext): MaybePromise<ApiDocument | void>;

  /** Override an operation function name. Return `undefined` to keep the suggestion. */
  operationName?(operation: OperationIR, suggested: string): string | undefined;

  /** Override a model type name. Return `undefined` to keep the suggestion. */
  modelName?(definition: SchemaDefinition, suggested: string): string | undefined;

  /** Customize a JSDoc block before rendering. */
  jsdoc?(block: JsDocBlock, target: JsDocTarget): JsDocBlock | void;

  /**
   * Customize the static prefix of a query key (TanStack Query or SWR hooks). The request
   * parameters are always appended as the final element.
   */
  queryKey?(operation: OperationIR, prefix: readonly string[]): readonly string[] | void;

  /** Customize a relative import specifier between two generated modules. */
  resolveImport?(request: {
    readonly from: string;
    readonly to: string;
    readonly specifier: string;
  }): string | void;

  /** After semantic analysis, before any code is generated. */
  beforeGenerate?(ctx: GenerateContext): MaybePromise<void>;

  /** Add files. Runs after the built-in generators. */
  generate?(ctx: FileContext): MaybePromise<readonly GeneratedFile[] | void>;

  /** Modify a file (return the new file), drop it (`null`) or keep it (`undefined`). */
  transformFile?(file: GeneratedFile, ctx: FileContext): MaybePromise<GeneratedFile | null | void>;

  /** After all files are generated and transformed. */
  afterGenerate?(files: readonly GeneratedFile[], ctx: GenerateContext): MaybePromise<void>;

  /** Before files are written (also runs in dry-run mode). Throw to abort. */
  beforeWrite?(plan: WritePlan, ctx: GenerateContext): MaybePromise<void>;

  /** After output was written successfully. Not called in dry-run mode. */
  afterWrite?(result: WriteResult, ctx: GenerateContext): MaybePromise<void>;
}
