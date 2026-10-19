import path from 'node:path';
import { findDuplicateSchemas } from '../analysis/graph.ts';
import type { OperationSymbol, ProjectModel } from '../analysis/types.ts';
import type { EmitContext } from '../codegen/context.ts';
import { generateModel } from '../codegen/models.ts';
import { planOperation } from '../codegen/operation-plan.ts';
import { generateOperation } from '../codegen/operations.ts';
import { generateReactQueryModule } from '../codegen/react-query.ts';
import { loadConfig, type LoadedConfig } from '../config/load.ts';
import { describeSchema, inspectData } from '../analysis/describe.ts';
import { locatePointer } from '../loader/locate.ts';
import { diffHunks } from '../output/diff.ts';
import { planWrite, readManifest, type PlannedWrite } from '../output/writer.ts';
import { compile, type CompileResult } from '../pipeline/compile.ts';
import { runGeneration } from '../pipeline/generate.ts';
import { versionLabel } from '../spec/detect.ts';
import { compareStrings, pluralize } from '../utils/strings.ts';
import type {
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
  PreviewResponse,
  SourceInfo,
  UsageReport,
} from './api-types.ts';
import { scanUsage } from './usage.ts';

export interface DashboardStateOptions {
  readonly cwd: string;
  readonly configFile?: string;
  readonly env: NodeJS.ProcessEnv;
}

/**
 * Holds the compiled project the dashboard shows. Everything is derived from the same compiler
 * pipeline (`compile()`) the CLI uses; the dashboard never parses specifications itself.
 */
export class DashboardState {
  readonly #options: DashboardStateOptions;
  #loaded: LoadedConfig | undefined;
  #compiled: CompileResult | undefined;
  #preview: PlannedWrite | undefined;
  #status: GenerationStatus | undefined;
  #lastRun: GenerationStatus['lastRun'];

  constructor(options: DashboardStateOptions) {
    this.#options = options;
  }

  get loaded(): LoadedConfig {
    if (this.#loaded === undefined) throw new Error('Dashboard state is not loaded');
    return this.#loaded;
  }

  get compiled(): CompileResult {
    if (this.#compiled === undefined) throw new Error('Dashboard state is not loaded');
    return this.#compiled;
  }

  get project(): ProjectModel | undefined {
    return this.#compiled?.project;
  }

  /** Reloads the config file and recompiles the specification. */
  async reload(): Promise<void> {
    this.#loaded = await loadConfig({
      cwd: this.#options.cwd,
      command: 'dashboard',
      env: this.#options.env,
      ...(this.#options.configFile === undefined ? {} : { configFile: this.#options.configFile }),
    });
    this.#compiled = await compile({ config: this.#loaded.config, plugins: this.#loaded.plugins });
    this.#preview = undefined;
    this.#status = undefined;
  }

  #emit(): EmitContext | undefined {
    const project = this.project;
    if (project === undefined) return undefined;
    return { project, config: this.loaded.config, hooks: this.compiled.runner.codegenHooks() };
  }

  #relative(target: string): string {
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
    if (!this.compiled.ok) {
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
      const method = op.method.toUpperCase();
      methods[method] = (methods[method] ?? 0) + 1;
      for (const tag of op.tags.length === 0 ? ['default'] : op.tags)
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    const declared = new Map((ir?.tags ?? []).map((tag) => [tag.name, tag.description]));
    const tags = [...tagCounts.entries()]
      .sort(([a], [b]) => compareStrings(a, b))
      .map(([name, count]) => {
        const description = declared.get(name);
        return { name, count, ...(description === undefined ? {} : { description }) };
      });
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
        reactQuery: config.features.reactQuery !== false,
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
    };
  }

  #operationSummary(symbol: OperationSymbol): OperationSummary {
    const op = symbol.operation;
    const security = op.security ?? this.project?.ir.security ?? [];
    return {
      key: symbol.key,
      name: symbol.name,
      method: op.method.toUpperCase(),
      path: op.path,
      ...(op.summary === undefined ? {} : { summary: op.summary }),
      ...(op.operationId === undefined ? {} : { operationId: op.operationId }),
      tags: op.tags,
      deprecated: op.deprecated,
      module: symbol.module,
      auth: [...new Set(security.flatMap((requirement) => Object.keys(requirement)))].sort(
        compareStrings,
      ),
      ...(op.description === undefined ? {} : { description: op.description.slice(0, 300) }),
      models: [...(this.project?.graph.operationClosure(symbol.key) ?? [])]
        .map((id) => this.project?.modelById.get(id)?.name ?? id)
        .sort(compareStrings),
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
  ): CodeVariant[] {
    const variants: CodeVariant[] = [];
    const files = this.compiled.files.filter(
      (f) => f.path.replace(/\.d\.ts$|\.(ts|js)$/, '') === module,
    );
    for (const file of files) {
      variants.push({
        label: file.path.endsWith('.d.ts') ? 'Declarations' : 'Generated',
        path: file.path,
        language: file.path.endsWith('.js') ? 'javascript' : 'typescript',
        content: file.content,
      });
    }
    if (generated !== undefined) {
      if (this.loaded.config.output.language === 'typescript') {
        variants.push({
          label: 'JavaScript preview',
          path: `${module}.js`,
          language: 'javascript',
          content: generated.js,
        });
        variants.push({
          label: 'Declarations preview',
          path: `${module}.d.ts`,
          language: 'typescript',
          content: generated.dts,
        });
      } else {
        variants.push({
          label: 'TypeScript preview',
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
    const reactQuery =
      symbol.reactQuery === undefined ? undefined : generateReactQueryModule(plan, emit);
    if (reactQuery !== undefined) code.push(...this.#codeVariants(reactQuery.module, undefined));
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
      typeNames: Object.fromEntries(
        Object.entries(symbol.typeNames).filter(([role]) =>
          role === 'params' ? plan.hasParams : role === 'body' ? plan.body !== undefined : true,
        ),
      ),
      hooks: [symbol.reactQuery?.hook, symbol.reactQuery?.infiniteHook].filter(
        (h): h is string => h !== undefined,
      ),
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
    if (!this.compiled.ok) {
      return {
        ok: false,
        directory: this.#relative(config.output.directory),
        diagnostics: this.compiled.diagnostics,
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
