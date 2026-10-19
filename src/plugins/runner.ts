/* oxlint-disable typescript/unbound-method -- hooks are extracted and always invoked with `.call(plugin, …)`, preserving `this`. */
import type { NamingHooks } from '../analysis/project.ts';
import type { CodegenHooks } from '../codegen/context.ts';
import type { GeneratedFile, JsDocBlock } from '../codegen/types.ts';
import type { ResolvedConfig } from '../config/resolved.ts';
import { SwaggerzError, type DiagnosticBag } from '../diagnostics/bag.ts';
import type { Diagnostic } from '../diagnostics/types.ts';
import type { ApiDocument } from '../ir/types.ts';
import type { WritePlan, WriteResult } from '../output/types.ts';
import type { FileContext, GenerateContext, SwaggerzPlugin, PluginContext } from './types.ts';

type HookName = Exclude<keyof SwaggerzPlugin, 'name' | 'enforce'>;

/** Runs plugin hooks sequentially in a deterministic order and attributes failures. */
export class PluginRunner {
  readonly #plugins: readonly SwaggerzPlugin[];
  readonly #diagnostics: DiagnosticBag;
  readonly #config: ResolvedConfig;

  constructor(
    plugins: readonly SwaggerzPlugin[],
    diagnostics: DiagnosticBag,
    config: ResolvedConfig,
  ) {
    // Stable order: \`pre\`, default, \`post\`; declaration order within each group.
    const rank = (plugin: SwaggerzPlugin): number =>
      plugin.enforce === 'pre' ? 0 : plugin.enforce === 'post' ? 2 : 1;
    this.#plugins = [...plugins].sort((a, b) => rank(a) - rank(b));
    this.#diagnostics = diagnostics;
    this.#config = config;
  }

  get plugins(): readonly SwaggerzPlugin[] {
    return this.#plugins;
  }

  context(plugin: SwaggerzPlugin): PluginContext {
    return {
      config: this.#config,
      report: (diagnostic: Omit<Diagnostic, 'plugin'>) => {
        this.#diagnostics.add({ ...diagnostic, plugin: plugin.name });
      },
    };
  }

  #fail(plugin: SwaggerzPlugin, hook: HookName, error: unknown): never {
    if (error instanceof SwaggerzError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new SwaggerzError(`Plugin "${plugin.name}" failed in ${hook}`, [
      {
        code: 'plugin/hook-failed',
        severity: 'error',
        message: `Plugin "${plugin.name}" threw in the ${hook} hook: ${message}`,
        plugin: plugin.name,
        ...(error instanceof Error && error.stack !== undefined
          ? { hint: error.stack.split('\n').slice(0, 4).join('\n') }
          : {}),
      },
    ]);
  }

  #sync<T>(plugin: SwaggerzPlugin, hook: HookName, run: () => T): T {
    try {
      return run();
    } catch (error) {
      this.#fail(plugin, hook, error);
    }
  }

  async #async<T>(plugin: SwaggerzPlugin, hook: HookName, run: () => Promise<T> | T): Promise<T> {
    try {
      return await run();
    } catch (error) {
      this.#fail(plugin, hook, error);
    }
  }

  async beforeParse(document: unknown, source: string): Promise<unknown> {
    let current = document;
    for (const plugin of this.#plugins) {
      const hook = plugin.beforeParse;
      if (hook === undefined) continue;
      const result = await this.#async(plugin, 'beforeParse', () =>
        hook.call(plugin, current, { ...this.context(plugin), source }),
      );
      if (result !== undefined) current = result;
    }
    return current;
  }

  async afterNormalize(ir: ApiDocument): Promise<ApiDocument> {
    let current = ir;
    for (const plugin of this.#plugins) {
      const hook = plugin.afterNormalize;
      if (hook === undefined) continue;
      const result = await this.#async(plugin, 'afterNormalize', () =>
        hook.call(plugin, current, this.context(plugin)),
      );
      if (result !== undefined) current = result;
    }
    return current;
  }

  namingHooks(): NamingHooks {
    const chain = (
      hook: 'operationName' | 'modelName',
      subject: unknown,
      suggested: string,
    ): string | undefined => {
      let current: string | undefined;
      for (const plugin of this.#plugins) {
        const fn = plugin[hook] as
          | ((subject: unknown, suggested: string) => string | undefined)
          | undefined;
        if (fn === undefined) continue;
        const result = this.#sync(plugin, hook, () =>
          fn.call(plugin, subject, current ?? suggested),
        );
        if (result !== undefined && result.trim() !== '') current = result;
      }
      return current;
    };
    const hooks: NamingHooks = {
      operationName: (operation, suggested) => chain('operationName', operation, suggested),
      modelName: (definition, suggested) => chain('modelName', definition, suggested),
    };
    if (this.#plugins.some((p) => p.queryKey !== undefined)) {
      hooks.queryKey = (operation, prefix) => {
        let current = prefix;
        for (const plugin of this.#plugins) {
          const fn = plugin.queryKey;
          if (fn === undefined) continue;
          const result = this.#sync(plugin, 'queryKey', () => fn.call(plugin, operation, current));
          if (result !== undefined) current = result;
        }
        return current;
      };
    }
    return hooks;
  }

  codegenHooks(): CodegenHooks {
    const hooks: CodegenHooks = {};
    if (this.#plugins.some((p) => p.jsdoc !== undefined)) {
      hooks.jsdoc = (block, target) => {
        let current: JsDocBlock = block;
        for (const plugin of this.#plugins) {
          const fn = plugin.jsdoc;
          if (fn === undefined) continue;
          const result = this.#sync(plugin, 'jsdoc', () => fn.call(plugin, current, target));
          if (result !== undefined) current = result;
        }
        return current;
      };
    }
    if (this.#plugins.some((p) => p.resolveImport !== undefined)) {
      hooks.resolveImport = (request) => {
        let specifier: string | undefined;
        for (const plugin of this.#plugins) {
          const fn = plugin.resolveImport;
          if (fn === undefined) continue;
          const result = this.#sync(plugin, 'resolveImport', () =>
            fn.call(plugin, { ...request, specifier: specifier ?? request.specifier }),
          );
          if (result !== undefined) specifier = result;
        }
        return specifier;
      };
    }
    return hooks;
  }

  generateContext(
    plugin: SwaggerzPlugin,
    base: Omit<GenerateContext, keyof PluginContext>,
  ): GenerateContext {
    return { ...this.context(plugin), ...base };
  }

  async beforeGenerate(base: Omit<GenerateContext, keyof PluginContext>): Promise<void> {
    for (const plugin of this.#plugins) {
      const hook = plugin.beforeGenerate;
      if (hook !== undefined)
        await this.#async(plugin, 'beforeGenerate', () =>
          hook.call(plugin, this.generateContext(plugin, base)),
        );
    }
  }

  async generate(
    files: readonly GeneratedFile[],
    base: Omit<GenerateContext, keyof PluginContext>,
  ): Promise<GeneratedFile[]> {
    const result = [...files];
    for (const plugin of this.#plugins) {
      const hook = plugin.generate;
      if (hook === undefined) continue;
      const context: FileContext = { ...this.generateContext(plugin, base), files: [...result] };
      const added = await this.#async(plugin, 'generate', () => hook.call(plugin, context));
      if (added !== undefined) {
        result.push(...added.map((file) => ({ ...file, origin: `plugin:${plugin.name}` })));
      }
    }
    return result;
  }

  async transformFiles(
    files: readonly GeneratedFile[],
    base: Omit<GenerateContext, keyof PluginContext>,
  ): Promise<GeneratedFile[]> {
    let current = [...files];
    for (const plugin of this.#plugins) {
      const hook = plugin.transformFile;
      if (hook === undefined) continue;
      const next: GeneratedFile[] = [];
      for (const file of current) {
        const context: FileContext = { ...this.generateContext(plugin, base), files: current };
        const result = await this.#async(plugin, 'transformFile', () =>
          hook.call(plugin, file, context),
        );
        if (result === null) continue;
        next.push(result ?? file);
      }
      current = next;
    }
    return current;
  }

  async afterGenerate(
    files: readonly GeneratedFile[],
    base: Omit<GenerateContext, keyof PluginContext>,
  ): Promise<void> {
    for (const plugin of this.#plugins) {
      const hook = plugin.afterGenerate;
      if (hook !== undefined)
        await this.#async(plugin, 'afterGenerate', () =>
          hook.call(plugin, files, this.generateContext(plugin, base)),
        );
    }
  }

  async beforeWrite(
    plan: WritePlan,
    base: Omit<GenerateContext, keyof PluginContext>,
  ): Promise<void> {
    for (const plugin of this.#plugins) {
      const hook = plugin.beforeWrite;
      if (hook !== undefined)
        await this.#async(plugin, 'beforeWrite', () =>
          hook.call(plugin, plan, this.generateContext(plugin, base)),
        );
    }
  }

  async afterWrite(
    result: WriteResult,
    base: Omit<GenerateContext, keyof PluginContext>,
  ): Promise<void> {
    for (const plugin of this.#plugins) {
      const hook = plugin.afterWrite;
      if (hook !== undefined)
        await this.#async(plugin, 'afterWrite', () =>
          hook.call(plugin, result, this.generateContext(plugin, base)),
        );
    }
  }
}
