import { EventEmitter } from 'node:events';
import type { FSWatcher } from 'node:fs';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it.skipIf(process.platform === 'linux')(
    'matches a file whose name differs in case on case-insensitive file systems',
    async () => {
      const { root, next } = await watching((dir) => [path.join(dir, 'OpenAPI.yaml')]);
      await writeFile(path.join(root, 'openapi.yaml'), 'a');
      expect(await next()).toEqual([path.join(root, 'OpenAPI.yaml')]);
    },
  );

  it('keeps watching after a file is replaced by a rename, as editors save', async () => {
    const { root, next } = await watching((dir) => [path.join(dir, 'spec.yaml')]);
    const file = path.join(root, 'spec.yaml');
    await writeFile(file, 'a');
    expect(await next()).toEqual([file]);
    await writeFile(`${file}.tmp`, 'b');
    await rename(`${file}.tmp`, file);
    expect(await next()).toEqual([file]);
  });

  it('reports the files of a directory whose watcher fails, as on Windows when it is removed', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'swaggerz-watch-'));
    directory = root;
    const manifest = path.join(root, 'out', 'api', '.manifest.json');
    await mkdir(path.dirname(manifest), { recursive: true });
    await writeFile(manifest, '{}');
    const platform = new Map<string, EventEmitter>();
    const changes: (readonly string[])[] = [];
    watcher = new FileWatcher({
      debounceMs: 20,
      onChange: (changed) => {
        changes.push(changed);
      },
      watch: (watched) => {
        const fake = Object.assign(new EventEmitter(), { close: () => undefined });
        platform.set(watched, fake);
        return fake as unknown as FSWatcher;
      },
    });
    watcher.set([manifest]);
    expect([...platform.keys()]).toEqual([path.dirname(manifest)]);

    // `clean` removed the directory; Windows reports EPERM instead of the deletions.
    await rm(path.join(root, 'out'), { recursive: true, force: true });
    platform
      .get(path.dirname(manifest))
      ?.emit('error', Object.assign(new Error('operation not permitted'), { code: 'EPERM' }));
    await vi.waitFor(() => {
      expect(changes).toEqual([[manifest]]);
    });
    // Watched again from the nearest directory that exists.
    expect(platform.has(root)).toBe(true);
  });
});
