import { describe, expect, it } from 'vitest';
import { diffHunks, unifiedDiff } from '../../../src/output/diff.ts';

describe('diff', () => {
  it('produces unified hunks with context', () => {
    const before = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].join('\n') + '\n';
    const after = ['a', 'b', 'c', 'D', 'e', 'f', 'g', 'h', 'i'].join('\n') + '\n';
    expect(unifiedDiff(before, after, 'x.ts')).toBe(
      [
        '--- a/x.ts',
        '+++ b/x.ts',
        '@@ -1,8 +1,9 @@',
        ' a',
        ' b',
        ' c',
        '-d',
        '+D',
        ' e',
        ' f',
        ' g',
        ' h',
        '+i',
      ].join('\n'),
    );
  });

  it('separates distant changes into hunks', () => {
    const lines = Array.from({ length: 40 }, (_, i) => `line ${i}`);
    const changed = [...lines];
    changed[2] = 'changed 2';
    changed[35] = 'changed 35';
    const hunks = diffHunks(lines.join('\n'), changed.join('\n'));
    expect(hunks).toHaveLength(2);
    expect(hunks[0]).toMatchObject({ oldStart: 1, newStart: 1 });
    expect(hunks[1]?.lines.filter((l) => l.kind !== 'context').map((l) => l.text)).toEqual([
      'line 35',
      'changed 35',
    ]);
  });

  it('handles empty inputs', () => {
    expect(diffHunks('', '')).toEqual([]);
    expect(diffHunks('', 'a\nb\n')[0]?.lines.map((l) => l.kind)).toEqual(['add', 'add']);
    expect(diffHunks('a\n', '')[0]?.lines.map((l) => l.kind)).toEqual(['remove']);
  });
});
