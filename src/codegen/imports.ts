import path from 'node:path';
import { GLOBAL_NAMES } from '../analysis/naming.ts';
import { compareStrings } from '../utils/strings.ts';

export type Lang = 'ts' | 'js' | 'dts';

export interface ImportOptions {
  /** Extension used in relative specifiers (`'.js'`, `'.ts'` or `''`). */
  readonly extension: string;
  /** Optional hook that rewrites a relative specifier. */
  readonly resolve?: (request: {
    from: string;
    to: string;
    specifier: string;
  }) => string | undefined;
}

interface ImportEntry {
  readonly imported: string;
  readonly local: string;
  typeOnly: boolean;
}

/**
 * Tracks the imports of one generated module and allocates local names. In JavaScript output,
 * type-only imports are expressed as inline `import('…').Name` JSDoc types instead of import
 * statements, so `.js` files never contain TypeScript syntax.
 */
export class ImportManager {
  readonly #from: string;
  readonly #lang: Lang;
  readonly #options: ImportOptions;
  readonly #modules = new Map<string, Map<string, ImportEntry>>();
  /** `import * as local from 'specifier'`, by specifier. */
  readonly #namespaces = new Map<string, ImportEntry>();
  readonly #locals = new Set<string>();

  /**
   * @param from Module path of the file being generated (output-relative, without extension),
   *   or a bare package name for external modules.
   */
  constructor(from: string, lang: Lang, options: ImportOptions) {
    this.#from = from;
    this.#lang = lang;
    this.#options = options;
  }

  get lang(): Lang {
    return this.#lang;
  }

  /** Reserves a name declared in this module so imports are aliased around it. */
  declare(name: string): void {
    this.#locals.add(name);
  }

  /** Relative specifier from this module to another generated module. */
  specifier(to: string): string {
    let relative = path.posix.relative(path.posix.dirname(this.#from), to);
    if (!relative.startsWith('.')) relative = `./${relative}`;
    const specifier = `${relative}${this.#options.extension}`;
    return this.#options.resolve?.({ from: this.#from, to, specifier }) ?? specifier;
  }

  /**
   * Imports `name` from a generated module (output-relative path) or an external package
   * (`external: true`) and returns the expression to use in code or types. `'default'` imports
   * the default export under `local` (e.g. `import useSWR from 'swr'`).
   */
  add(
    module: string,
    name: string,
    options: { typeOnly: boolean; external?: boolean; alias?: string; local?: string },
  ): string {
    // A module never imports itself; its own declarations are referenced by name.
    if (options.external !== true && module === this.#from) return name;
    const key = options.external === true ? module : this.specifier(module);
    if (options.typeOnly && this.#lang === 'js') return `import('${key}').${name}`;
    let entries = this.#modules.get(key);
    if (entries === undefined) {
      entries = new Map();
      this.#modules.set(key, entries);
    }
    const existing = entries.get(name);
    if (existing !== undefined) {
      if (!options.typeOnly) existing.typeOnly = false;
      return existing.local;
    }
    const taken = (candidate: string): boolean =>
      this.#locals.has(candidate) || (GLOBAL_NAMES.has(candidate) && this.#isModel(module));
    let local = options.local ?? name;
    if (taken(local)) {
      const base = options.alias ?? (this.#isModel(module) ? `${name}Model` : `${name}_`);
      local = base;
      for (let index = 2; taken(local); index++) local = `${base}${index}`;
    }
    this.#locals.add(local);
    entries.set(name, { imported: name, local, typeOnly: options.typeOnly });
    return local;
  }

  /**
   * Imports a whole external package as a namespace (`import * as v from 'valibot'`) and returns
   * its local name; in JavaScript, type-only uses are `import('valibot')` types.
   */
  namespace(module: string, preferred: string, options: { typeOnly: boolean }): string {
    if (options.typeOnly && this.#lang === 'js') return `import('${module}')`;
    const existing = this.#namespaces.get(module);
    if (existing !== undefined) {
      if (!options.typeOnly) existing.typeOnly = false;
      return existing.local;
    }
    let local = preferred;
    for (let index = 2; this.#locals.has(local); index++) local = `${preferred}${index}`;
    this.#locals.add(local);
    this.#namespaces.set(module, { imported: '*', local, typeOnly: options.typeOnly });
    return local;
  }

  /** Models with global names (e.g. `Error`, `Blob`) are aliased so globals stay usable. */
  #isModel(module: string): boolean {
    return module.startsWith('models/');
  }

  /** Renders import statements for the module's language. */
  render(): string {
    const lines: string[] = [];
    const specifiers = [...new Set([...this.#modules.keys(), ...this.#namespaces.keys()])].sort(
      (a, b) => {
        const aExternal = !a.startsWith('.');
        const bExternal = !b.startsWith('.');
        if (aExternal !== bExternal) return aExternal ? -1 : 1;
        return compareStrings(a, b);
      },
    );
    for (const specifier of specifiers) {
      const namespace = this.#namespaces.get(specifier);
      if (namespace !== undefined && (this.#lang !== 'js' || !namespace.typeOnly)) {
        const typeOnly = namespace.typeOnly || this.#lang === 'dts';
        lines.push(`import ${typeOnly ? 'type ' : ''}* as ${namespace.local} from '${specifier}';`);
      }
      const all = [...(this.#modules.get(specifier)?.values() ?? [])].sort((a, b) =>
        compareStrings(a.imported, b.imported),
      );
      const usable = this.#lang === 'js' ? all.filter((e) => !e.typeOnly) : all;
      if (usable.length === 0) continue;
      const allTypes = usable.every((e) => e.typeOnly) || this.#lang === 'dts';
      // A type-only import cannot combine a default import with named bindings.
      const defaultEntry = allTypes ? undefined : usable.find((e) => e.imported === 'default');
      const entries = usable.filter((e) => e !== defaultEntry);
      const names = entries.map((e) => {
        const binding = e.imported === e.local ? e.imported : `${e.imported} as ${e.local}`;
        return !allTypes && e.typeOnly && this.#lang === 'ts' ? `type ${binding}` : binding;
      });
      const keyword = allTypes && this.#lang !== 'js' ? 'import type' : 'import';
      const bindings = [
        ...(defaultEntry === undefined ? [] : [defaultEntry.local]),
        ...(names.length === 0 ? [] : [`{ ${names.join(', ')} }`]),
      ];
      lines.push(`${keyword} ${bindings.join(', ')} from '${specifier}';`);
    }
    return lines.length === 0 ? '' : `${lines.join('\n')}\n`;
  }
}
