export interface DiffLine {
  readonly kind: 'context' | 'add' | 'remove';
  readonly text: string;
  /** 1-based line numbers in the old/new file (absent for added/removed lines respectively). */
  readonly oldLine?: number;
  readonly newLine?: number;
}

export interface DiffHunk {
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  readonly lines: readonly DiffLine[];
}

type Edit = { kind: 'equal' | 'add' | 'remove'; text: string };

/** Myers' O((N+M)·D) line diff. Falls back to a whole-file replace for very large edit distances. */
function diffLines(a: readonly string[], b: readonly string[], maxEdits = 4000): Edit[] {
  const n = a.length;
  const m = b.length;
  const max = Math.min(n + m, maxEdits);
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  let found = false;
  outer: for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      const down = k === -d || (k !== d && (v[offset + k - 1] ?? 0) < (v[offset + k + 1] ?? 0));
      let x = down ? (v[offset + k + 1] ?? 0) : (v[offset + k - 1] ?? 0) + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = true;
        break outer;
      }
    }
  }
  if (!found) {
    return [
      ...a.map((text) => ({ kind: 'remove' as const, text })),
      ...b.map((text) => ({ kind: 'add' as const, text })),
    ];
  }
  const edits: Edit[] = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    const vd = trace[d] ?? new Int32Array();
    const k = x - y;
    const down = k === -d || (k !== d && (vd[offset + k - 1] ?? 0) < (vd[offset + k + 1] ?? 0));
    const prevK = down ? k + 1 : k - 1;
    const prevX = vd[offset + prevK] ?? 0;
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      edits.push({ kind: 'equal', text: a[x - 1] ?? '' });
      x--;
      y--;
    }
    if (d > 0) {
      if (down) edits.push({ kind: 'add', text: b[y - 1] ?? '' });
      else edits.push({ kind: 'remove', text: a[x - 1] ?? '' });
    }
    x = prevX;
    y = prevY;
  }
  return edits.reverse();
}

function splitLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

/** Computes unified-diff hunks with `context` lines around each change. */
export function diffHunks(before: string, after: string, context = 3): DiffHunk[] {
  const edits = diffLines(splitLines(before), splitLines(after));
  const lines: DiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;
  for (const edit of edits) {
    if (edit.kind === 'equal')
      lines.push({ kind: 'context', text: edit.text, oldLine: oldLine++, newLine: newLine++ });
    else if (edit.kind === 'remove')
      lines.push({ kind: 'remove', text: edit.text, oldLine: oldLine++ });
    else lines.push({ kind: 'add', text: edit.text, newLine: newLine++ });
  }
  const hunks: DiffHunk[] = [];
  let index = 0;
  while (index < lines.length) {
    while (index < lines.length && lines[index]?.kind === 'context') index++;
    if (index >= lines.length) break;
    const start = Math.max(0, index - context);
    let end = index;
    let lastChange = index;
    while (end < lines.length) {
      if (lines[end]?.kind !== 'context') lastChange = end;
      else if (end - lastChange > context * 2) break;
      end++;
    }
    end = Math.min(lines.length, lastChange + context + 1);
    const slice = lines.slice(start, end);
    const firstOld = slice.find((l) => l.oldLine !== undefined)?.oldLine ?? 0;
    const firstNew = slice.find((l) => l.newLine !== undefined)?.newLine ?? 0;
    hunks.push({
      oldStart: firstOld,
      oldLines: slice.filter((l) => l.kind !== 'add').length,
      newStart: firstNew,
      newLines: slice.filter((l) => l.kind !== 'remove').length,
      lines: slice,
    });
    index = end;
  }
  return hunks;
}

/** Renders a unified diff in the conventional text format. */
export function unifiedDiff(before: string, after: string, file: string): string {
  const hunks = diffHunks(before, after);
  if (hunks.length === 0) return '';
  const body = hunks.map((hunk) => {
    const header = `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`;
    return [
      header,
      ...hunk.lines.map(
        (l) => `${l.kind === 'add' ? '+' : l.kind === 'remove' ? '-' : ' '}${l.text}`,
      ),
    ].join('\n');
  });
  return [`--- a/${file}`, `+++ b/${file}`, ...body].join('\n');
}
