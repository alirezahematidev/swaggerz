import path from 'node:path';
import { wireMethod, type TagIR } from '../ir/types.ts';
import { findDuplicateSchemas } from '../analysis/graph.ts';
import type { OperationSymbol, ProjectModel } from '../analysis/types.ts';
import { dataFetching } from '../analysis/project.ts';
import type { EmitContext } from '../codegen/context.ts';
import { generateModel } from '../codegen/models.ts';
import { planOperation } from '../codegen/operation-plan.ts';
import { generateOperation } from '../codegen/operations.ts';
import { generateQueryModule, QUERY_LABELS } from '../codegen/query/index.ts';
import { validatorFor } from '../codegen/validation/index.ts';
import { loadConfig, type LoadedConfig } from '../config/load.ts';
import { SwaggerzError } from '../diagnostics/bag.ts';
import { MANIFEST_FILENAME } from '../meta.ts';
import { describeSchema, inspectData } from '../analysis/describe.ts';
import { locatePointer } from '../loader/locate.ts';
import { polledDocuments, type PolledDocument } from '../loader/remote-watcher.ts';
import { diffHunks, unifiedDiff } from '../output/diff.ts';
import { planWrite, readManifest, type PlannedWrite } from '../output/writer.ts';
import { compile, type CompileResult } from '../pipeline/compile.ts';
import { runGeneration } from '../pipeline/generate.ts';
import { versionLabel } from '../spec/detect.ts';
import { compareStrings, pluralize } from '../utils/strings.ts';
import type {
  ChangedItem,
  CodeVariant,
  DiffResponse,
  GenerateResponse,
  GenerationStatus,
  GraphResponse,
  Link,
  ModelDetail,
  ModelSummary,
  OperationDetail,
  OperationSummary,
  OverviewResponse,
  OverviewTag,
  PreviewResponse,
  ReloadDelta,
  ReloadFailure,
  ReloadTrigger,
  SessionInfo,
  SourceInfo,
  UsageReport,
} from './types.ts';
import { ChangeTracker, snapshot } from './changes.ts';
import { scanUsage } from './usage.ts';

/** The result of a reload, as broadcast to connected clients. */
export interface ReloadOutcome {
  readonly revision: number;
  readonly ok: boolean;
  readonly files: readonly string[];
  readonly delta?: ReloadDelta;
  readonly error?: string;
}

export interface ProjectServiceOptions {
  readonly cwd: string;
  readonly configFile?: string;
  readonly env: NodeJS.ProcessEnv;
  /** Command name passed to config functions (`ConfigEnv.command`). Default `dashboard`. */
  readonly command?: string;
}

function changeOf(kind: ChangedItem['change'] | undefined): { change?: 'new' | 'updated' } {
  return kind === 'new' || kind === 'updated' ? { change: kind } : {};
}

/**
 * Holds a compiled project for long-running tools: the dashboard and the MCP server are two
 * adapters over it. Everything is derived from the same compiler pipeline (`compile()`) the CLI
 * uses; nothing here parses specifications itself.
 */
export class ProjectService {
  readonly #options: ProjectServiceOptions;
  #loaded: LoadedConfig | undefined;
  #compiled: CompileResult | undefined;
  #preview: PlannedWrite | undefined;
  #status: GenerationStatus | undefined;
  #lastRun: GenerationStatus['lastRun'];
  readonly #tracker = new ChangeTracker();
  readonly #startedAt = new Date().toISOString();
  #revision = 0;
  #lastReload: SessionInfo['lastReload'];
  #failure: ReloadFailure | undefined;
  #watching: readonly string[] = [];
  readonly #unreachable = new Map<string, { readonly error: string; readonly since: string }>();

  constructor(options: ProjectServiceOptions) {
    this.#options = options;
  }

  get loaded(): LoadedConfig {
    if (this.#loaded === undefined) throw new Error('The project is not loaded');
    return this.#loaded;
  }

  get compiled(): CompileResult {
    if (this.#compiled === undefined) throw new Error('The project is not loaded');
    return this.#compiled;
  }

  get project(): ProjectModel | undefined {
    return this.#compiled?.project;
  }

  get revision(): number {
    return this.#revision;
  }

  /**
   * Reloads the config file and recompiles the specification. The first load throws on failure.
   * Later loads that fail (an invalid config, a specification that cannot be parsed while it is
   * being edited) keep the last version that loaded and record the failure instead.
   */
  async reload(
    trigger: ReloadTrigger | 'start' = 'manual',
    files: readonly string[] = [],
  ): Promise<ReloadOutcome> {
    const at = new Date().toISOString();
    const changed = this.#loaded === undefined ? [] : files.map((file) => this.#relative(file));
    const fail = (failure: Omit<ReloadFailure, 'at'>): ReloadOutcome => {
      this.#failure = { at, ...failure };
      this.#status = undefined;
      this.#preview = undefined;
      this.#revision++;
      return { revision: this.#revision, ok: false, files: changed, error: failure.message };
    };
    let loaded: LoadedConfig;
    let compiled: CompileResult;
    try {
      loaded = await loadConfig({
        cwd: this.#options.cwd,
        command: this.#options.command ?? 'dashboard',
        env: this.#options.env,
        ...(this.#options.configFile === undefined ? {} : { configFile: this.#options.configFile }),
      });
      compiled = await compile({ config: loaded.config, plugins: loaded.plugins });
    } catch (error) {
      if (this.#compiled === undefined) throw error;
      return fail(
        error instanceof SwaggerzError
          ? { message: error.message, diagnostics: error.diagnostics }
          : { message: error instanceof Error ? error.message : String(error), diagnostics: [] },
      );
    }
    if (compiled.project === undefined && this.#compiled?.project !== undefined) {
      const errors = compiled.diagnostics.filter((d) => d.severity === 'error');
      return fail({
        message: 'The specification could not be compiled',
        diagnostics: errors.length > 0 ? errors : compiled.diagnostics,
      });
    }
    this.#loaded = loaded;
    this.#compiled = compiled;
    this.#failure = undefined;
    this.#preview = undefined;
    this.#status = undefined;
    const delta =
      compiled.project === undefined
        ? undefined
        : this.#tracker.update(snapshot(compiled.project, compiled.files));
    if (trigger !== 'start') this.#lastReload = { at, trigger, files: changed };
    this.#revision++;
    return {
      revision: this.#revision,
      ok: true,
      files: changed,
      ...(delta === undefined ? {} : { delta }),
    };
  }

  /** The output directory changed (a generation from the CLI or this dashboard). */
  outputChanged(): number {
    this.#status = undefined;
    this.#preview = undefined;
    return ++this.#revision;
  }

  /**
   * What should reload the dashboard: the config file and every local document of the
   * specification (`sources`), the output manifest (for the generation status), and the remote
   * documents to poll (`spec.fetch.poll`) with their interval.
   */
  watchTargets(): {
    readonly sources: readonly string[];
    readonly manifest: string;
    readonly remote: readonly PolledDocument[];
    readonly interval: number;
  } {
    const { config, file } = this.loaded;
    const sources = new Set<string>();
    if (file !== undefined) sources.add(file);
    if (!/^https?:/i.test(config.spec.input)) sources.add(config.spec.input);
    for (const overlay of config.spec.overlays)
      if (!/^https?:/i.test(overlay)) sources.add(overlay);
    for (const doc of this.#compiled?.store?.documents ?? []) {
      if (doc.url.startsWith('file:')) sources.add(doc.location);
    }
    return {
      sources: [...sources].sort(compareStrings),
      manifest: path.join(config.output.directory, MANIFEST_FILENAME),
      remote: polledDocuments(config, this.#compiled?.store),
      interval: config.spec.fetch.poll.interval,
    };
  }

  /** Records which files are watched, for display. */
  setWatching(files: readonly string[]): void {
    this.#watching = files.map((file) => this.#relative(file));
    for (const url of this.#unreachable.keys())
      if (!files.includes(url)) this.#unreachable.delete(url);
  }

  /** A polled remote document cannot be fetched; returns the new revision. */
  remoteFailed(url: string, error: string): number {
    this.#unreachable.set(url, { error, since: new Date().toISOString() });
    return ++this.#revision;
  }

  /** A polled remote document can be fetched again; returns the new revision. */
  remoteRecovered(url: string): number {
    this.#unreachable.delete(url);
    return ++this.#revision;
  }

  #session(): SessionInfo {
    const changes = this.#tracker.changes;
    return {
      startedAt: this.#startedAt,
      revision: this.#revision,
      watching: this.#watching,
      ...(this.#lastReload === undefined ? {} : { lastReload: this.#lastReload }),
      changes: { operations: changes.operations, models: changes.models },
      ...(this.#failure === undefined ? {} : { failure: this.#failure }),
      ...(this.#unreachable.size === 0
        ? {}
        : {
            unreachable: [...this.#unreachable]
              .sort(([a], [b]) => compareStrings(a, b))
              .map(([url, problem]) => ({ url, ...problem })),
          }),
    };
  }

  #emit(): EmitContext | undefined {
    const project = this.project;
    if (project === undefined) return undefined;
    return { project, config: this.loaded.config, hooks: this.compiled.runner.codegenHooks() };
  }

  #relative(target: string): string {
    if (/^https?:\/\//i.test(target)) return target;
    const relative = path.relative(this.loaded.config.root, target);
    return relative === '' ? '.' : relative.split(path.sep).join('/');
  }

  #source(file: string, pointer: string): SourceInfo {
    const doc = this.compiled.store?.byDisplay(file);
    const position = doc === undefined ? undefined : locatePointer(doc, pointer);
    return { file, pointer, ...(position === undefined ? {} : { line: position.line }) };
  }

  async #generationStatus(): Promise<GenerationStatus> {
    if (this.#status !== undefined) return this.#status;
    const directory = this.loaded.config.output.directory;
    const manifest = await readManifest(directory);
    const base = {
      manifestFiles: Object.keys(manifest?.files ?? {}).length,
      ...(manifest === undefined ? {} : { generatorVersion: manifest.generator.version }),
      ...(this.#lastRun === undefined ? {} : { lastRun: this.#lastRun }),
    };
    if (!this.compiled.ok || this.#failure !== undefined) {
      this.#status = { status: 'failed', staleFiles: 0, ...base };
    } else if (manifest === undefined) {
      this.#status = { status: 'never', staleFiles: this.compiled.files.length, ...base };
    } else {
      const planned = await planWrite(this.compiled.files, directory, {
        clean: this.loaded.config.output.clean,
        force: false,
      });
      const staleFiles = planned.plan.changes.filter((c) => c.kind !== 'unchanged').length;
      this.#status = { status: staleFiles === 0 ? 'up-to-date' : 'stale', staleFiles, ...base };
    }
    return this.#status;
  }

  async overview(): Promise<OverviewResponse> {
    const { config } = this.loaded;
    const compiled = this.compiled;
    const ir = compiled.ir;
    const methods: Record<string, number> = {};
    const tagCounts = new Map<string, number>();
    for (const op of ir?.operations ?? []) {
      const method = wireMethod(op.method);
      methods[method] = (methods[method] ?? 0) + 1;
      for (const tag of op.tags.length === 0 ? ['default'] : op.tags)
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    const tags = tagTree(ir?.tags ?? [], tagCounts);
    const library = dataFetching(config)?.library;
    const emit = this.#emit();
    const validator = emit === undefined ? undefined : validatorFor(emit);
    return {
      title: ir?.info.title ?? 'Unavailable',
      version: ir?.info.version ?? '',
      ...(ir?.info.description === undefined ? {} : { description: ir.info.description }),
      specVersion: ir === undefined ? '' : versionLabel(ir.specVersion),
      specVersionRaw: ir?.specVersionRaw ?? '',
      servers: (ir?.servers ?? []).map((s) => s.url),
      config: {
        ...(this.loaded.file === undefined ? {} : { configFile: this.#relative(this.loaded.file) }),
        input: /^https?:/i.test(config.spec.input)
          ? config.spec.input
          : this.#relative(config.spec.input),
        output: this.#relative(config.output.directory),
        language: config.output.language,
        adapter: config.client.adapter,
        ...(library === undefined ? {} : { query: QUERY_LABELS[library] }),
        ...(validator === undefined ? {} : { validation: validator.label }),
      },
      counts: {
        operations: ir?.operations.length ?? 0,
        models: ir?.schemas.length ?? 0,
        files: compiled.files.length,
        tags: tags.length,
        deprecated: (ir?.operations ?? []).filter((op) => op.deprecated).length,
      },
      methods,
      tags,
      diagnostics: compiled.diagnostics,
      generation: await this.#generationStatus(),
      timings: compiled.timings,
      session: this.#session(),
    };
  }

  #operationSummary(symbol: OperationSymbol): OperationSummary {
    const op = symbol.operation;
    const security = op.security ?? this.project?.ir.security ?? [];
    const ancestors = tagAncestors(op.tags, this.project?.ir.tags ?? []);
    return {
      key: symbol.key,
      name: symbol.name,
      method: wireMethod(op.method),
      path: op.path,
      ...(op.summary === undefined ? {} : { summary: op.summary }),
      ...(op.operationId === undefined ? {} : { operationId: op.operationId }),
      tags: op.tags,
      ...(ancestors.length === 0 ? {} : { tagAncestors: ancestors }),
      deprecated: op.deprecated,
      module: symbol.module,
      auth: [...new Set(security.flatMap((requirement) => Object.keys(requirement)))].sort(
        compareStrings,
      ),
      ...(op.description === undefined ? {} : { description: op.description.slice(0, 300) }),
      models: [...(this.project?.graph.operationClosure(symbol.key) ?? [])]
        .map((id) => this.project?.modelById.get(id)?.name ?? id)
        .sort(compareStrings),
      ...changeOf(this.#tracker.operation(symbol.key)),
    };
  }

  operations(): OperationSummary[] {
    return (this.project?.operations ?? []).map((symbol) => this.#operationSummary(symbol));
  }

  #link(id: string): Link {
    return { id, name: this.project?.modelById.get(id)?.name ?? id };
  }

  #codeVariants(
    module: string,
    generated: { ts: string; js: string; dts: string } | undefined,
    prefix = '',
  ): CodeVariant[] {
    const languageLabel = (file: string): string =>
      file.endsWith('.d.ts') ? 'Declarations' : file.endsWith('.js') ? 'JavaScript' : 'TypeScript';
    const variants: CodeVariant[] = [];
    const files = this.compiled.files.filter(
      (f) => f.path.replace(/\.d\.ts$|\.(ts|js)$/, '') === module,
    );
    for (const file of files) {
      variants.push({
        label: `${prefix}${languageLabel(file.path)}`,
        path: file.path,
        language: file.path.endsWith('.js') ? 'javascript' : 'typescript',
        content: file.content,
      });
    }
    if (generated !== undefined) {
      if (this.loaded.config.output.language === 'typescript') {
        variants.push({
          label: 'JavaScript (preview)',
          path: `${module}.js`,
          language: 'javascript',
          content: generated.js,
        });
        variants.push({
          label: 'Declarations (preview)',
          path: `${module}.d.ts`,
          language: 'typescript',
          content: generated.dts,
        });
      } else {
        variants.push({
          label: 'TypeScript (preview)',
          path: `${module}.ts`,
          language: 'typescript',
          content: generated.ts,
        });
      }
    }
    return variants;
  }

  operationDetail(key: string): OperationDetail | undefined {
    const project = this.project;
    const symbol = project?.operationByKey.get(key);
    const emit = this.#emit();
    if (project === undefined || symbol === undefined || emit === undefined) return undefined;
    const plan = planOperation(symbol, project.ir);
    const operationModule = generateOperation(plan, emit);
    const code = this.#codeVariants(symbol.module, operationModule);
    const hooks = symbol.query === undefined ? undefined : generateQueryModule(plan, emit);
    const hooksLabel = symbol.query === undefined ? undefined : QUERY_LABELS[symbol.query.library];
    if (hooks !== undefined)
      code.push(...this.#codeVariants(hooks.module, undefined, `${hooksLabel ?? ''} · `));
    const op = symbol.operation;
    const schemeKeys = new Set(this.#operationSummary(symbol).auth);
    const dependencies = [...project.graph.operationClosure(key)]
      .map((id) => ({
        ...this.#link(id),
        chain: (project.graph.explain(key, id) ?? [id]).map((step) => this.#link(step).name),
      }))
      .sort((a, b) => a.chain.length - b.chain.length || compareStrings(a.name, b.name));
    return {
      summary: this.#operationSummary(symbol),
      operation: op,
      // Only the type names the operation module actually exports.
      typeNames: {
        ...Object.fromEntries(
          Object.entries(symbol.typeNames).filter(([role]) =>
            role === 'params' ? plan.hasParams : role === 'body' ? plan.body !== undefined : true,
          ),
        ),
        errorGuard: symbol.errorGuard,
      },
      hooks: [symbol.query?.hook, symbol.query?.infiniteHook].filter(
        (h): h is string => h !== undefined,
      ),
      ...(hooksLabel === undefined ? {} : { hooksLabel }),
      request: {
        ...(plan.accept === undefined ? {} : { accept: plan.accept }),
        ...(plan.body === undefined ? {} : { mediaType: plan.body.media.mediaType }),
        ...(plan.parseAs === undefined ? {} : { parseAs: plan.parseAs }),
      },
      security: project.ir.securitySchemes.filter((scheme) => schemeKeys.has(scheme.key)),
      dependencies,
      code,
      source: this.#source(op.source.file, op.source.pointer),
    };
  }

  models(): ModelSummary[] {
    const project = this.project;
    if (project === undefined) return [];
    const recursive = project.graph.recursiveSchemas();
    return project.models.map((model) => ({
      id: model.id,
      name: model.name,
      kind: describeSchema(model.definition.schema),
      module: model.module,
      used: model.used,
      usedBy: project.graph.operationsUsing(model.id).length,
      recursive: recursive.has(model.id),
      deprecated: model.definition.schema.deprecated === true,
      ...changeOf(this.#tracker.model(model.id)),
    }));
  }

  modelDetail(id: string): ModelDetail | undefined {
    const project = this.project;
    const model = project?.modelById.get(id);
    const emit = this.#emit();
    if (project === undefined || model === undefined || emit === undefined) return undefined;
    const summary = this.models().find((m) => m.id === id);
    if (summary === undefined) return undefined;
    const duplicates = findDuplicateSchemas(project.ir).find((group) => group.includes(id)) ?? [];
    const usedBy = project.graph.operationsUsing(id).flatMap((key) => {
      const symbol = project.operationByKey.get(key);
      if (symbol === undefined) return [];
      return [
        {
          ...this.#operationSummary(symbol),
          chain: (project.graph.explain(key, id) ?? []).map((step) => this.#link(step).name),
        },
      ];
    });
    return {
      summary,
      definition: model.definition,
      aliases: model.aliases,
      references: [...(project.graph.schemaDeps.get(id) ?? [])]
        .map((dep) => this.#link(dep))
        .sort((a, b) => compareStrings(a.name, b.name)),
      referencedBy: [...(project.graph.schemaDependents.get(id) ?? [])]
        .map((dep) => this.#link(dep))
        .sort((a, b) => compareStrings(a.name, b.name)),
      usedBy,
      duplicates: duplicates.filter((other) => other !== id).map((other) => this.#link(other)),
      code: this.#codeVariants(model.module, generateModel(model, emit)),
      source: this.#source(model.definition.source.file, model.definition.source.pointer),
    };
  }

  graph(): GraphResponse {
    const project = this.project;
    if (project === undefined) return { unused: [], recursive: [], duplicates: [], mostUsed: [] };
    const data = inspectData(project);
    const counts = data.models.map((m) => ({
      id: String(m.id),
      name: String(m.name),
      count: (m.usedBy as unknown[]).length,
    }));
    return {
      unused: project.models.filter((m) => !m.used).map((m) => ({ id: m.id, name: m.name })),
      recursive: [...project.graph.recursiveSchemas()]
        .map((id) => this.#link(id))
        .sort((a, b) => compareStrings(a.name, b.name)),
      duplicates: findDuplicateSchemas(project.ir).map((group) =>
        group.map((id) => this.#link(id)),
      ),
      mostUsed: counts
        .sort((a, b) => b.count - a.count || compareStrings(a.name, b.name))
        .slice(0, 15),
    };
  }

  async usage(): Promise<UsageReport> {
    const { config } = this.loaded;
    return scanUsage({
      root: config.root,
      outputDirectory: config.output.directory,
      files: this.compiled.files,
      include: config.dashboard.usage.include,
      exclude: config.dashboard.usage.exclude,
    });
  }

  async preview(): Promise<PreviewResponse> {
    const { config } = this.loaded;
    if (!this.compiled.ok || this.#failure !== undefined) {
      return {
        ok: false,
        directory: this.#relative(config.output.directory),
        diagnostics: this.#failure?.diagnostics ?? this.compiled.diagnostics,
        changes: [],
      };
    }
    const planned = await planWrite(this.compiled.files, config.output.directory, {
      clean: config.output.clean,
      force: false,
    });
    this.#preview = planned;
    const changes = planned.plan.changes.map((change) => {
      const lines = (text: string | undefined): number =>
        text === undefined || text === '' ? 0 : text.split('\n').length;
      let additions = 0;
      let deletions = 0;
      if (change.kind === 'create') additions = lines(change.after);
      else if (change.kind === 'delete') deletions = lines(change.before);
      else if (change.kind === 'update') {
        for (const hunk of diffHunks(change.before ?? '', change.after ?? '')) {
          for (const line of hunk.lines) {
            if (line.kind === 'add') additions++;
            else if (line.kind === 'remove') deletions++;
          }
        }
      }
      return { path: change.path, kind: change.kind, additions, deletions };
    });
    return {
      ok: planned.conflicts.length === 0,
      directory: this.#relative(config.output.directory),
      diagnostics: [...this.compiled.diagnostics, ...planned.notes, ...planned.conflicts],
      changes,
    };
  }

  /** The unified diff of one file of the last {@link preview}, or `undefined`. */
  unifiedDiff(file: string): string | undefined {
    const change = this.#preview?.plan.changes.find((c) => c.path === file);
    if (change === undefined) return undefined;
    return unifiedDiff(change.before ?? '', change.after ?? '', change.path);
  }

  diff(file: string): DiffResponse | undefined {
    const change = this.#preview?.plan.changes.find((c) => c.path === file);
    if (change === undefined) return undefined;
    return {
      path: change.path,
      kind: change.kind,
      hunks: diffHunks(change.before ?? '', change.after ?? ''),
    };
  }

  /** Writes the generated client (same safety rules as `generate`: user files are never overwritten). */
  async generate(): Promise<GenerateResponse> {
    const result = await runGeneration({
      config: this.loaded.config,
      plugins: this.loaded.plugins,
    });
    const write = result.write;
    this.#lastRun = {
      at: new Date().toISOString(),
      ok: result.ok,
      summary:
        write === undefined
          ? 'Generation failed; nothing was written.'
          : `${pluralize(write.created.length, 'file')} created, ${write.updated.length} updated, ${write.deleted.length} deleted, ${write.unchanged.length} unchanged`,
    };
    this.#status = undefined;
    this.#preview = undefined;
    return {
      ok: result.ok,
      diagnostics: result.diagnostics,
      ...(write === undefined ? {} : { write }),
    };
  }
}

/** The tags an operation's tags are nested under (OpenAPI 3.2 `parent`), sorted. */
function tagAncestors(tags: readonly string[], declared: readonly TagIR[]): string[] {
  const parents = new Map(declared.map((tag) => [tag.name, tag.parent]));
  const result = new Set<string>();
  for (const tag of tags) {
    for (let parent = parents.get(tag); parent !== undefined; parent = parents.get(parent)) {
      if (result.has(parent) || tags.includes(parent)) break;
      result.add(parent);
    }
  }
  return [...result].sort(compareStrings);
}

/**
 * Tags with their operation counts in tree order: nested tags (OpenAPI 3.2 `parent`) follow their
 * parent with a greater depth. Declared parents of used tags are listed even without operations.
 */
function tagTree(declared: readonly TagIR[], counts: ReadonlyMap<string, number>): OverviewTag[] {
  const byName = new Map(declared.map((tag) => [tag.name, tag]));
  const names = new Set(counts.keys());
  for (const name of names) {
    for (
      let parent = byName.get(name)?.parent;
      parent !== undefined && !names.has(parent);
      parent = byName.get(parent)?.parent
    )
      names.add(parent);
  }
  const children = new Map<string | undefined, string[]>();
  for (const name of names) {
    const parent = byName.get(name)?.parent;
    const key = parent !== undefined && names.has(parent) ? parent : undefined;
    children.set(key, [...(children.get(key) ?? []), name]);
  }
  const result: OverviewTag[] = [];
  const visit = (parent: string | undefined, depth: number): void => {
    for (const name of (children.get(parent) ?? []).sort(compareStrings)) {
      const tag = byName.get(name);
      result.push({
        name,
        count: counts.get(name) ?? 0,
        depth,
        ...(tag?.summary === undefined ? {} : { summary: tag.summary }),
        ...(tag?.description === undefined ? {} : { description: tag.description }),
        ...(tag?.kind === undefined ? {} : { kind: tag.kind }),
        ...(tag?.parent === undefined ? {} : { parent: tag.parent }),
      });
      visit(name, depth + 1);
    }
  };
  visit(undefined, 0);
  return result;
}
