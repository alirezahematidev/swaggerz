import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  compareReleases,
  minorOf,
  olderThanArchived,
  pagesOf,
  parseManifest,
  withVersion,
} from '../../../website/scripts/versions.ts';
import { REPO_ROOT, withTempDir } from '../../helpers.ts';

const SCRIPT = path.join(REPO_ROOT, 'website', 'scripts', 'versions.ts');
const run = promisify(execFile);

/** A built site with these pages (`''` for the start page). */
async function site(directory: string, pages: readonly string[]): Promise<string> {
  for (const page of pages) {
    await mkdir(path.join(directory, page), { recursive: true });
    await writeFile(
      path.join(directory, page, 'index.html'),
      `<!doctype html><title>${page}</title>`,
    );
  }
  return directory;
}

describe('versions of the docs', () => {
  it('orders releases and names their minor line', () => {
    expect(minorOf('0.3.2')).toBe('0.3');
    expect(minorOf('v1.10.0-beta.1')).toBe('1.10');
    expect(() => minorOf('latest')).toThrow('not a release version');
    const releases = ['0.10.0', '0.9.3', '1.0.0', '1.0.0-beta.1', '0.9.10'];
    expect(releases.sort(compareReleases)).toEqual([
      '0.9.3',
      '0.9.10',
      '0.10.0',
      '1.0.0-beta.1',
      '1.0.0',
    ]);
  });

  it('keeps one entry per minor release, newest first', () => {
    const manifest = { versions: [{ id: '0.2', release: '0.2.0', pages: [''] }] };
    expect(
      withVersion(manifest, { id: '0.3', release: '0.3.0' }).versions.map((v) => v.release),
    ).toEqual(['0.3.0', '0.2.0']);
    expect(withVersion(manifest, { id: '0.2', release: '0.2.1' }).versions).toEqual([
      { id: '0.2', release: '0.2.1' },
    ]);
  });

  it('refuses to deploy a release older than the newest archived one', () => {
    const manifest = { versions: [{ id: '0.3', release: '0.3.1' }] };
    expect(olderThanArchived(manifest, '0.3.1')).toBeUndefined();
    expect(olderThanArchived(manifest, '0.4.0')).toBeUndefined();
    expect(olderThanArchived(manifest, '0.3.0')).toMatch(/^0\.3\.0 is older than 0\.3\.1/);
    expect(olderThanArchived(manifest, '0.2.5')).toMatch(/"snapshot" input/);
    expect(olderThanArchived({ versions: [] }, '0.1.0')).toBeUndefined();
  });

  it('validates manifests', () => {
    expect(
      parseManifest(
        '{"versions":[{"id":"0.2","release":"0.2.1"},{"id":"0.3","release":"0.3.0"}]}',
        'm',
      ).versions.map((v) => v.id),
    ).toEqual(['0.3', '0.2']);
    expect(() => parseManifest('{"versions":[{"id":"0.3","release":"0.2.1"}]}', 'm.json')).toThrow(
      'm.json is not a versions manifest.',
    );
    expect(() =>
      parseManifest('{"versions":[{"id":"0.2","release":"0.2.1","pages":[1]}]}', 'm'),
    ).toThrow('m is not a versions manifest.');
  });

  it('lists the pages of a built site', () =>
    withTempDir(async (dir) => {
      await site(dir, ['', 'docs/introduction', 'playground']);
      await writeFile(path.join(dir, '404.html'), '');
      expect(await pagesOf(dir)).toEqual(['', 'docs/introduction/', 'playground/']);
    }));

  it('archives snapshots and assembles the site with the root', () =>
    withTempDir(async (dir) => {
      const archive = path.join(dir, 'archive');
      const root = await site(path.join(dir, 'root'), ['', 'docs/introduction']);
      const old = await site(path.join(dir, 'old'), ['', 'docs/intro']);
      const current = await site(path.join(dir, 'current'), ['', 'docs/introduction']);
      await run(process.execPath, [SCRIPT, 'archive', archive, old, '0.2.1']);
      await run(process.execPath, [SCRIPT, 'archive', archive, current, 'v0.3.0']);
      const manifest = parseManifest(
        await readFile(path.join(archive, 'versions.json'), 'utf8'),
        'm',
      );
      expect(manifest.versions).toEqual([
        { id: '0.3', release: '0.3.0', pages: ['', 'docs/introduction/'] },
        { id: '0.2', release: '0.2.1', pages: ['', 'docs/intro/'] },
      ]);
      // An older release of an archived minor does not replace it.
      await expect(
        run(process.execPath, [SCRIPT, 'archive', archive, old, '0.2.0']),
      ).rejects.toThrow(/already has 0\.2\.1/);

      const out = path.join(dir, 'site');
      await run(process.execPath, [SCRIPT, 'assemble', archive, root, out]);
      expect(await pagesOf(out)).toEqual([
        '',
        'docs/introduction/',
        'v0.2/',
        'v0.2/docs/intro/',
        'v0.3/',
        'v0.3/docs/introduction/',
      ]);
      expect(JSON.parse(await readFile(path.join(out, 'versions.json'), 'utf8'))).toEqual(manifest);

      const check = await run(process.execPath, [
        SCRIPT,
        'check',
        path.join(archive, 'versions.json'),
        '0.3.0',
      ]);
      expect(check.stderr).toBe('');
      await expect(
        run(process.execPath, [SCRIPT, 'check', path.join(archive, 'versions.json'), '0.2.1']),
      ).rejects.toThrow(/older than 0\.3\.0/);
    }));
});
