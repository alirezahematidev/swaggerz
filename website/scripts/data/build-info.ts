/** What the site was built from: version, commit and date. */
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, writeGenerated } from './output.ts';

function git(...args: string[]): string | undefined {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return undefined;
  }
}

export interface BuildInfo {
  readonly version: string;
  readonly commit: string | undefined;
  readonly shortCommit: string | undefined;
  /** Uncommitted changes in the working tree when the site was built. */
  readonly dirty: boolean;
  readonly builtAt: string;
}

export async function buildInfo(): Promise<BuildInfo> {
  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8')) as {
    version: string;
  };
  const commit = git('rev-parse', 'HEAD');
  const status = git('status', '--porcelain');
  const info: BuildInfo = {
    version: pkg.version,
    commit,
    shortCommit: commit?.slice(0, 7),
    dirty: status !== undefined && status !== '',
    builtAt: new Date().toISOString(),
  };
  await writeGenerated('build.json', info);
  return info;
}
