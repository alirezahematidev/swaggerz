import { createHash } from 'node:crypto';
import { wireMethod } from '../ir/types.ts';
import type { ProjectModel } from '../analysis/types.ts';
import type { GeneratedFile } from '../codegen/types.ts';
import { compareStrings } from '../utils/strings.ts';
import type { ChangedItem, ChangeKind, ReloadDelta } from './types.ts';

interface Entry {
  readonly fingerprint: string;
  readonly name: string;
  readonly label?: string;
}

/** Fingerprints of every operation and model of one compiled version. */
export interface Snapshot {
  readonly operations: ReadonlyMap<string, Entry>;
  readonly models: ReadonlyMap<string, Entry>;
}

/**
 * Fingerprints each operation and model from its IR and the files generated from it, so a change
 * in the specification and a change in the generated code (for example after a config change)
 * both count.
 */
export function snapshot(project: ProjectModel, files: readonly GeneratedFile[]): Snapshot {
  const contents = {
    operations: new Map<string, string[]>(),
    schemas: new Map<string, string[]>(),
  };
  for (const file of files) {
    for (const key of file.sources?.operations ?? [])
      contents.operations.set(key, [...(contents.operations.get(key) ?? []), file.content]);
    for (const id of file.sources?.schemas ?? [])
      contents.schemas.set(id, [...(contents.schemas.get(id) ?? []), file.content]);
  }
  const fingerprint = (value: unknown, generated: readonly string[] = []): string => {
    const hash = createHash('sha256').update(JSON.stringify(value));
    for (const content of generated) hash.update('\0').update(content);
    return hash.digest('base64url');
  };
  return {
    operations: new Map(
      project.operations.map((symbol) => [
        symbol.key,
        {
          fingerprint: fingerprint(symbol.operation, contents.operations.get(symbol.key)),
          name: symbol.name,
          label: `${wireMethod(symbol.operation.method)} ${symbol.operation.path}`,
        },
      ]),
    ),
    models: new Map(
      project.models.map((model) => [
        model.id,
        {
          fingerprint: fingerprint(model.definition, contents.schemas.get(model.id)),
          name: model.name,
        },
      ]),
    ),
  };
}

function compare(
  before: ReadonlyMap<string, Entry>,
  after: ReadonlyMap<string, Entry>,
): ChangedItem[] {
  const items: ChangedItem[] = [];
  for (const [id, entry] of after) {
    const previous = before.get(id);
    if (previous === undefined || previous.fingerprint !== entry.fingerprint) {
      items.push({
        id,
        name: entry.name,
        ...(entry.label === undefined ? {} : { label: entry.label }),
        change: previous === undefined ? 'new' : 'updated',
      });
    }
  }
  for (const [id, entry] of before) {
    if (!after.has(id))
      items.push({
        id,
        name: entry.name,
        ...(entry.label === undefined ? {} : { label: entry.label }),
        change: 'removed',
      });
  }
  const order = { new: 0, updated: 1, removed: 2 } as const;
  return items.sort((a, b) => order[a.change] - order[b.change] || compareStrings(a.name, b.name));
}

function count(items: readonly ChangedItem[]): ReloadDelta['operations'] {
  return {
    new: items.filter((item) => item.change === 'new').length,
    updated: items.filter((item) => item.change === 'updated').length,
    removed: items.filter((item) => item.change === 'removed').length,
  };
}

/**
 * Tracks what changed since the dashboard started. The first snapshot is the baseline; badges
 * compare against it, so they last until the dashboard restarts.
 */
export class ChangeTracker {
  #baseline: Snapshot | undefined;
  #current: Snapshot | undefined;
  #operations = new Map<string, ChangeKind>();
  #models = new Map<string, ChangeKind>();
  #changes: { operations: ChangedItem[]; models: ChangedItem[] } = { operations: [], models: [] };

  /** Records a new version and returns what changed compared with the previous one. */
  update(next: Snapshot): ReloadDelta {
    const previous = this.#current ?? next;
    this.#baseline ??= next;
    this.#current = next;
    this.#changes = {
      operations: compare(this.#baseline.operations, next.operations),
      models: compare(this.#baseline.models, next.models),
    };
    const kinds = (items: readonly ChangedItem[]): Map<string, ChangeKind> =>
      new Map(items.flatMap((item) => (item.change === 'removed' ? [] : [[item.id, item.change]])));
    this.#operations = kinds(this.#changes.operations);
    this.#models = kinds(this.#changes.models);
    return {
      operations: count(compare(previous.operations, next.operations)),
      models: count(compare(previous.models, next.models)),
    };
  }

  operation(key: string): ChangeKind | undefined {
    return this.#operations.get(key);
  }

  model(id: string): ChangeKind | undefined {
    return this.#models.get(id);
  }

  /** Everything that differs from the baseline, including removed items. */
  get changes(): {
    readonly operations: readonly ChangedItem[];
    readonly models: readonly ChangedItem[];
  } {
    return this.#changes;
  }
}
