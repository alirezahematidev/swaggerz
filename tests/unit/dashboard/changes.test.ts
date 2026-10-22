import { describe, expect, it } from 'vitest';
import { ChangeTracker, type Snapshot } from '../../../src/service/changes.ts';

function version(
  operations: Record<string, string>,
  models: Record<string, string> = {},
): Snapshot {
  return {
    operations: new Map(
      Object.entries(operations).map(([key, fingerprint]) => [
        key,
        { fingerprint, name: key.split(' ')[1] ?? key, label: key.toUpperCase() },
      ]),
    ),
    models: new Map(
      Object.entries(models).map(([id, fingerprint]) => [id, { fingerprint, name: id }]),
    ),
  };
}

describe('ChangeTracker', () => {
  it('uses the first version as the baseline and marks nothing', () => {
    const tracker = new ChangeTracker();
    const delta = tracker.update(version({ 'get a': '1' }, { A: '1' }));
    expect(delta).toEqual({
      operations: { new: 0, updated: 0, removed: 0 },
      models: { new: 0, updated: 0, removed: 0 },
    });
    expect(tracker.operation('get a')).toBeUndefined();
    expect(tracker.changes).toEqual({ operations: [], models: [] });
  });

  it('marks new and updated items against the baseline and counts each reload separately', () => {
    const tracker = new ChangeTracker();
    tracker.update(version({ 'get a': '1', 'get b': '1' }, { A: '1' }));

    const first = tracker.update(version({ 'get a': '2', 'get b': '1', 'get c': '1' }, { A: '1' }));
    expect(first.operations).toEqual({ new: 1, updated: 1, removed: 0 });
    expect(tracker.operation('get a')).toBe('updated');
    expect(tracker.operation('get c')).toBe('new');
    expect(tracker.operation('get b')).toBeUndefined();

    // A second reload only counts its own changes, but the marks still compare with the start.
    const second = tracker.update(version({ 'get a': '2', 'get c': '2' }, { A: '1', B: '1' }));
    expect(second.operations).toEqual({ new: 0, updated: 1, removed: 1 });
    expect(second.models).toEqual({ new: 1, updated: 0, removed: 0 });
    expect(tracker.operation('get c')).toBe('new');
    expect(tracker.model('B')).toBe('new');
    expect(tracker.changes.operations.map((item) => [item.id, item.change])).toEqual([
      ['get c', 'new'],
      ['get a', 'updated'],
      ['get b', 'removed'],
    ]);
  });

  it('drops the mark when an item returns to its original form', () => {
    const tracker = new ChangeTracker();
    tracker.update(version({ 'get a': '1' }));
    tracker.update(version({ 'get a': '2' }));
    expect(tracker.operation('get a')).toBe('updated');
    tracker.update(version({ 'get a': '1' }));
    expect(tracker.operation('get a')).toBeUndefined();
    expect(tracker.changes.operations).toEqual([]);
  });
});
