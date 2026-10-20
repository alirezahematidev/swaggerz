import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileWatcher } from '../../../src/utils/file-watcher.ts';

let directory: string | undefined;
let watcher: FileWatcher | undefined;

afterEach(async () => {
  await watcher?.close();
  watcher = undefined;
  if (directory !== undefined) await rm(directory, { recursive: true, force: true });
  directory = undefined;
});

/** Starts a watcher and returns a function that resolves with the next batch of changes. */
async function watching(files: (root: string) => string[]): Promise<{
  root: string;
  next: () => Promise<readonly string[]>;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'swaggerz-watch-'));
  directory = root;
  const batches: (readonly string[])[] = [];
  let wake: (() => void) | undefined;
  watcher = new FileWatcher({
    debounceMs: 40,
    onChange: (changed) => {
      batches.push(changed);
      wake?.();
    },
  });
  watcher.set(files(root));
  // Let the platform watcher start before the test writes.
  await new Promise((resolve) => setTimeout(resolve, 50));
  return {
    root,
    next: () =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('No change reported'));
        }, 5000);
        const check = (): void => {
          const batch = batches.shift();
          if (batch === undefined) return;
          clearTimeout(timer);
          wake = undefined;
          resolve(batch);
        };
        wake = check;
        check();
      }),
  };
}

describe('FileWatcher', () => {
  it('reports changed files once per burst of writes', async () => {
    const { root, next } = await watching((dir) => [path.join(dir, 'spec.yaml')]);
    const file = path.join(root, 'spec.yaml');
    await writeFile(file, 'a');
    await writeFile(file, 'b');
    await writeFile(path.join(root, 'unrelated.txt'), 'x');
    expect(await next()).toEqual([file]);
  });

  it('notices files whose directory is created later', async () => {
    const { root, next } = await watching((dir) => [
      path.join(dir, 'out', 'api', '.manifest.json'),
    ]);
    await mkdir(path.join(root, 'out', 'api'), { recursive: true });
    await writeFile(path.join(root, 'out', 'api', '.manifest.json'), '{}');
    expect(await next()).toEqual([path.join(root, 'out', 'api', '.manifest.json')]);
  });
});
