/**
 * Public API. Everything exported here follows semantic versioning, except types marked
 * **experimental** (the IR and the project model), which may change in minor releases before 1.0.
 */
export { defineConfig, definePlugin } from './config/define.ts';
export { generate, validate } from './api.ts';
export type { ApiOptions, GenerateOptions } from './api.ts';
export { loadConfig } from './config/load.ts';
export type { LoadConfigOptions, LoadedConfig } from './config/load.ts';
export { SwaggerzError } from './diagnostics/bag.ts';
export { formatDiagnostic } from './diagnostics/format.ts';

export type {
  CaseStyle,
  ClientConfig,
  ConfigEnv,
  ConfigExport,
  DashboardConfig,
  FeaturesConfig,
  FetchConfig,
  InlineHooks,
  NamingConfig,
  OutputConfig,
  ReactQueryConfig,
  RefsConfig,
  SpecConfig,
  SpecVersionOption,
  TypesConfig,
  UsageScanConfig,
  UserConfig,
  ZodConfig,
} from './config/types.ts';
export type { ResolvedConfig } from './config/resolved.ts';
export type {
  AfterNormalizeContext,
  BeforeParseContext,
  FileContext,
  GenerateContext,
  SwaggerzPlugin,
  JsDocTarget,
  PluginContext,
} from './plugins/types.ts';
export type {
  GeneratedExport,
  GeneratedExportKind,
  GeneratedFile,
  JsDocBlock,
  JsDocTag,
} from './codegen/types.ts';
export type { Diagnostic, Severity, SourceLocation } from './diagnostics/types.ts';
export type { FileChange, FileChangeKind, WritePlan, WriteResult } from './output/types.ts';
export type { CompileResult } from './pipeline/compile.ts';
export type { GenerationResult } from './pipeline/generate.ts';
export type { ModelSymbol, OperationSymbol, ProjectModel } from './analysis/types.ts';
export type * from './ir/types.ts';
