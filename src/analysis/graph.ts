import { createHash } from 'node:crypto';
import type { ApiDocument, SchemaIR } from '../ir/types.ts';
import { collectRefs, operationSchemas, webhookOperations } from '../ir/utils.ts';
import { stableStringify } from '../utils/object.ts';
import { compareStrings } from '../utils/strings.ts';

const EMPTY: ReadonlySet<string> = new Set();

/**
 * Dependency indexes between operations and named schemas. Built once per compilation and shared
 * by generators and the dashboard.
 */
export class DependencyGraph {
  /** Schema id → schemas it references directly. */
  readonly schemaDeps: ReadonlyMap<string, ReadonlySet<string>>;
  /** Schema id → schemas that reference it directly. */
  readonly schemaDependents: ReadonlyMap<string, ReadonlySet<string>>;
  /** Schema id → schemas referenced structurally (excluding discriminator subtypes). */
  readonly structuralDeps: ReadonlyMap<string, ReadonlySet<string>>;
  /** Operation key → schemas it references directly. */
  readonly operationDeps: ReadonlyMap<string, ReadonlySet<string>>;
  /** Schema id → operations that reference it directly. */
  readonly schemaOperations: ReadonlyMap<string, ReadonlySet<string>>;
  /** Schemas referenced directly by webhooks and callbacks. */
  readonly webhookDeps: ReadonlySet<string>;

  readonly #usingCache = new Map<string, string[]>();
  #used: ReadonlySet<string> | undefined;
  #recursive: ReadonlySet<string> | undefined;
  /** Recursive schema id → its strongly connected component. */
  readonly #cycles = new Map<string, ReadonlySet<string>>();

  private constructor(maps: {
    schemaDeps: Map<string, Set<string>>;
    structuralDeps: Map<string, Set<string>>;
    schemaDependents: Map<string, Set<string>>;
    operationDeps: Map<string, Set<string>>;
    schemaOperations: Map<string, Set<string>>;
    webhookDeps: Set<string>;
  }) {
    this.schemaDeps = maps.schemaDeps;
    this.structuralDeps = maps.structuralDeps;
    this.schemaDependents = maps.schemaDependents;
    this.operationDeps = maps.operationDeps;
    this.schemaOperations = maps.schemaOperations;
    this.webhookDeps = maps.webhookDeps;
  }

  static build(ir: ApiDocument): DependencyGraph {
    const schemaDeps = new Map<string, Set<string>>();
    const structuralDeps = new Map<string, Set<string>>();
    const schemaDependents = new Map<string, Set<string>>();
    const operationDeps = new Map<string, Set<string>>();
    const schemaOperations = new Map<string, Set<string>>();
    for (const definition of ir.schemas) {
      schemaDeps.set(definition.id, collectRefs(definition.schema));
      structuralDeps.set(
        definition.id,
        collectRefs(definition.schema, new Set(), { subtypes: false }),
      );
      schemaDependents.set(definition.id, new Set());
      schemaOperations.set(definition.id, new Set());
    }
    for (const [id, deps] of schemaDeps) {
      for (const dep of deps) schemaDependents.get(dep)?.add(id);
    }
    for (const operation of ir.operations) {
      const deps = new Set<string>();
      for (const schema of operationSchemas(operation)) collectRefs(schema, deps);
      operationDeps.set(operation.key, deps);
      for (const dep of deps) schemaOperations.get(dep)?.add(operation.key);
    }
    const webhookDeps = new Set<string>();
    for (const operation of webhookOperations(ir))
      for (const schema of operationSchemas(operation)) collectRefs(schema, webhookDeps);
    return new DependencyGraph({
      schemaDeps,
      structuralDeps,
      schemaDependents,
      operationDeps,
      schemaOperations,
      webhookDeps,
    });
  }

  /** Schemas reachable from `sources` through references (breadth-first, linear time). */
  #reachable(sources: Iterable<string>): Set<string> {
    const result = new Set<string>();
    const queue = [...sources];
    for (let index = 0; index < queue.length; index++) {
      const id = queue[index];
      if (id === undefined || result.has(id)) continue;
      result.add(id);
      for (const next of this.schemaDeps.get(id) ?? []) if (!result.has(next)) queue.push(next);
    }
    return result;
  }

  /** All schemas reachable from a schema (excluding itself unless recursive). */
  schemaClosure(id: string): ReadonlySet<string> {
    return this.#reachable(this.schemaDeps.get(id) ?? []);
  }

  /** All schemas an operation depends on, directly or transitively. */
  operationClosure(key: string): ReadonlySet<string> {
    return this.#reachable(this.operationDeps.get(key) ?? []);
  }

  /** Operations that depend on a schema directly or transitively (reverse breadth-first search). */
  operationsUsing(id: string): string[] {
    const cached = this.#usingCache.get(id);
    if (cached !== undefined) return cached;
    const ancestors = new Set<string>();
    const queue = [id];
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index];
      if (current === undefined || ancestors.has(current)) continue;
      ancestors.add(current);
      for (const parent of this.schemaDependents.get(current) ?? [])
        if (!ancestors.has(parent)) queue.push(parent);
    }
    const operations = new Set<string>();
    for (const schema of ancestors)
      for (const key of this.schemaOperations.get(schema) ?? []) operations.add(key);
    const result = [...operations].sort(compareStrings);
    this.#usingCache.set(id, result);
    return result;
  }

  /** Schemas reachable from at least one operation, webhook or callback. */
  usedSchemas(): ReadonlySet<string> {
    this.#used ??= this.#reachable([
      ...[...this.operationDeps.values()].flatMap((deps) => [...deps]),
      ...this.webhookDeps,
    ]);
    return this.#used;
  }

  /**
   * Schemas that can reach themselves through structural references (Tarjan's strongly connected
   * components). Discriminator subtype links do not make a schema recursive.
   */
  recursiveSchemas(): ReadonlySet<string> {
    if (this.#recursive !== undefined) return this.#recursive;
    const recursive = new Set<string>();
    const index = new Map<string, number>();
    const low = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    let counter = 0;
    for (const root of this.schemaDeps.keys()) {
      if (index.has(root)) continue;
      // Iterative DFS: each frame tracks the node and its remaining successors.
      const frames: { node: string; successors: string[] }[] = [];
      const enter = (node: string): void => {
        index.set(node, counter);
        low.set(node, counter);
        counter++;
        stack.push(node);
        onStack.add(node);
        frames.push({ node, successors: [...(this.structuralDeps.get(node) ?? [])] });
      };
      enter(root);
      while (frames.length > 0) {
        const frame = frames[frames.length - 1];
        if (frame === undefined) break;
        const next = frame.successors.pop();
        if (next !== undefined) {
          if (!this.schemaDeps.has(next)) continue;
          if (!index.has(next)) enter(next);
          else if (onStack.has(next))
            low.set(frame.node, Math.min(low.get(frame.node) ?? 0, index.get(next) ?? 0));
          continue;
        }
        frames.pop();
        const parent = frames[frames.length - 1];
        if (parent !== undefined)
          low.set(parent.node, Math.min(low.get(parent.node) ?? 0, low.get(frame.node) ?? 0));
        if (low.get(frame.node) === index.get(frame.node)) {
          const component: string[] = [];
          for (let member = stack.pop(); member !== undefined; member = stack.pop()) {
            onStack.delete(member);
            component.push(member);
            if (member === frame.node) break;
          }
          const selfLoop = this.structuralDeps.get(frame.node)?.has(frame.node) === true;
          if (component.length > 1 || selfLoop) {
            const cycle: ReadonlySet<string> = new Set(component);
            for (const member of component) {
              recursive.add(member);
              this.#cycles.set(member, cycle);
            }
          }
        }
      }
    }
    this.#recursive = recursive;
    return recursive;
  }

  /**
   * The schemas a recursive schema reaches that reach it back (its strongly connected component,
   * itself included); empty for schemas that are not recursive.
   */
  cycleOf(id: string): ReadonlySet<string> {
    this.recursiveSchemas();
    return this.#cycles.get(id) ?? EMPTY;
  }

  /**
   * Shortest reference chain explaining why `schemaId` is part of an operation's dependencies:
   * `[firstSchema, ..., schemaId]`, or `undefined` when unrelated.
   */
  explain(operationKey: string, schemaId: string): string[] | undefined {
    const direct = this.operationDeps.get(operationKey);
    if (direct === undefined) return undefined;
    const previous = new Map<string, string | null>();
    const queue: string[] = [];
    for (const id of [...direct].sort(compareStrings)) {
      previous.set(id, null);
      queue.push(id);
    }
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;
      if (current === schemaId) {
        const chain: string[] = [];
        for (let node: string | null | undefined = current; node != null; node = previous.get(node))
          chain.unshift(node);
        return chain;
      }
      for (const next of [...(this.schemaDeps.get(current) ?? [])].sort(compareStrings)) {
        if (!previous.has(next)) {
          previous.set(next, current);
          queue.push(next);
        }
      }
    }
    return undefined;
  }
}

/** Groups named schemas whose structure is identical (ignoring documentation). */
export function findDuplicateSchemas(ir: ApiDocument): string[][] {
  const groups = new Map<string, string[]>();
  for (const definition of ir.schemas) {
    if (!isNonTrivial(definition.schema)) continue;
    const hash = createHash('sha256')
      .update(stableStringify(structuralShape(definition.schema)))
      .digest('hex');
    const list = groups.get(hash) ?? [];
    list.push(definition.id);
    groups.set(hash, list);
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => group.sort(compareStrings));
}

function isNonTrivial(schema: SchemaIR): boolean {
  return (
    (schema.kind === 'object' && schema.properties.length > 0) ||
    (schema.kind === 'enum' && schema.values.length > 1)
  );
}

function structuralShape(schema: SchemaIR): unknown {
  const {
    description: _d,
    title: _t,
    examples: _e,
    source: _s,
    extensions: _x,
    default: _def,
    ...rest
  } = schema;
  const shape: Record<string, unknown> = { ...rest };
  if (schema.kind === 'object') {
    shape.properties = schema.properties.map((p) => ({
      name: p.name,
      required: p.required,
      schema: structuralShape(p.schema),
    }));
    if (schema.additionalProperties !== undefined && schema.additionalProperties !== false) {
      shape.additionalProperties = structuralShape(schema.additionalProperties);
    }
  } else {
    if (schema.kind === 'array') shape.items = structuralShape(schema.items);
    if (schema.kind === 'union') shape.variants = schema.variants.map(structuralShape);
    if (schema.kind === 'intersection') shape.members = schema.members.map(structuralShape);
  }
  return shape;
}
