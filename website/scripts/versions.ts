/**
 * The versioned docs: every minor release keeps a snapshot of the site, built from its tag and
 * served at `/v<major>.<minor>/`, while the latest release is served at the root. The snapshots
 * live on the `website-archive` branch, with a manifest (`versions.json`) that lists them and their
 * pages; `.github/workflows/website.yml` updates it on every release tag and deploys the root build
 * together with every snapshot.
 *
 * Usage (Node.js only, no dependencies, so the deploy job runs it without installing anything):
 *   node website/scripts/versions.ts fetch <out>
 *       Writes the archive's manifest to <out> (an empty one before the first archived release),
 *       read with the GitHub API: GITHUB_API_URL, GITHUB_REPOSITORY and GITHUB_TOKEN.
 *   node website/scripts/versions.ts minor <release>
 *       Prints the minor release line of <release> (`0.3` for `0.3.2` or `v0.3.2`).
 *   node website/scripts/versions.ts check <manifest> <release>
 *       Fails when <release> is older than the newest version in the manifest (deploying an old
 *       tag would replace the root with old docs).
 *   node website/scripts/versions.ts with <manifest> <release>
 *       Prints the manifest with <release> added (its pages unknown), for a build that will be
 *       deployed together with a snapshot of <release>.
 *   node website/scripts/versions.ts archive <archive> <snapshot> <release>
 *       Puts the built <snapshot> of <release> into <archive>/v<minor>/ (replacing an older
 *       release of that minor) and records it, with its pages, in <archive>/versions.json.
 *   node website/scripts/versions.ts assemble <archive> <root> <out>
 *       Copies the root build and every snapshot of <archive> into <out>, the site to deploy.
 *
 * A missing manifest counts as an empty one.
 */
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** One version of the docs: a minor release line and its newest release. */
export interface DocsVersion {
  /** `0.3` */
  readonly id: string;
  /** `0.3.2`: the release the snapshot was built from. */
  readonly release: string;
  /** The pages of the snapshot, relative to its root (`''`, `docs/introduction/`), when known. */
  readonly pages?: readonly string[];
}

export interface VersionManifest {
  /** Newest first. */
  readonly versions: readonly DocsVersion[];
}

const RELEASE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

function parse(release: string): [number, number, number, string | undefined] {
  const match = RELEASE.exec(release);
  if (match === null) throw new Error(`"${release}" is not a release version (x.y.z).`);
  return [Number(match[1]), Number(match[2]), Number(match[3]), match[4]];
}

/** The minor release line of a release: `0.3.2` → `0.3`. */
export function minorOf(release: string): string {
  const [major, minor] = parse(release);
  return `${major}.${minor}`;
}

/** Orders releases (`0.10.0` after `0.9.3`; `1.0.0-beta.1` before `1.0.0`). */
export function compareReleases(a: string, b: string): number {
  const [aMajor, aMinor, aPatch, aPre] = parse(a);
  const [bMajor, bMinor, bPatch, bPre] = parse(b);
  return (
    aMajor - bMajor ||
    aMinor - bMinor ||
    aPatch - bPatch ||
    (aPre === bPre ? 0 : aPre === undefined ? 1 : bPre === undefined ? -1 : aPre < bPre ? -1 : 1)
  );
}

/** The manifest with `version` in place of the entry of its minor, newest first. */
export function withVersion(manifest: VersionManifest, version: DocsVersion): VersionManifest {
  return {
    versions: [...manifest.versions.filter((entry) => entry.id !== version.id), version].sort(
      (a, b) => compareReleases(b.release, a.release),
    ),
  };
}

/** Why `release` must not be deployed as the latest docs, or `undefined` when it can be. */
export function olderThanArchived(manifest: VersionManifest, release: string): string | undefined {
  const newest = manifest.versions[0];
  return newest !== undefined && compareReleases(release, newest.release) < 0
    ? `${release} is older than ${newest.release}, the newest version on the site: run the workflow on the latest tag (and pass the old tag as its "snapshot" input to add it as a version).`
    : undefined;
}

function isManifest(value: unknown): value is VersionManifest {
  if (typeof value !== 'object' || value === null) return false;
  const versions: unknown = (value as Record<string, unknown>)['versions'];
  return (
    Array.isArray(versions) &&
    versions.every((entry: unknown) => {
      if (typeof entry !== 'object' || entry === null) return false;
      const { id, release, pages } = entry as Record<string, unknown>;
      return (
        typeof id === 'string' &&
        typeof release === 'string' &&
        RELEASE.test(release) &&
        minorOf(release) === id &&
        (pages === undefined ||
          (Array.isArray(pages) && pages.every((page) => typeof page === 'string')))
      );
    })
  );
}

/** Parses a manifest (the text of `file`), newest version first. */
export function parseManifest(text: string, file: string): VersionManifest {
  const value: unknown = JSON.parse(text);
  if (!isManifest(value)) throw new Error(`${file} is not a versions manifest.`);
  return { versions: [...value.versions].sort((a, b) => compareReleases(b.release, a.release)) };
}

/** Reads a manifest; a missing file is an empty manifest, an invalid one an error. */
export async function readManifest(file: string): Promise<VersionManifest> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return { versions: [] };
    throw error;
  }
  return parseManifest(text, file);
}

const writeManifest = (file: string, manifest: VersionManifest): Promise<void> =>
  writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`);

/** The pages of a built site: every `index.html`, as the path it is served at below the site. */
export async function pagesOf(site: string): Promise<string[]> {
  const entries = await readdir(site, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name === 'index.html')
    .map((entry) => {
      const directory = path.relative(site, entry.parentPath).split(path.sep).join('/');
      return directory === '' ? '' : `${directory}/`;
    })
    .sort();
}

/** The branch that holds the snapshots and their manifest. */
export const ARCHIVE_BRANCH = 'website-archive';

/** The archive's manifest from the repository on GitHub, or an empty one. */
async function fetchManifest(out: string): Promise<void> {
  const api = process.env['GITHUB_API_URL'] ?? 'https://api.github.com';
  const repository = process.env['GITHUB_REPOSITORY'];
  const token = process.env['GITHUB_TOKEN'];
  if (repository === undefined) throw new Error('GITHUB_REPOSITORY is not set.');
  const response = await fetch(
    `${api}/repos/${repository}/contents/versions.json?ref=${ARCHIVE_BRANCH}`,
    {
      headers: {
        accept: 'application/vnd.github.raw+json',
        'x-github-api-version': '2022-11-28',
        ...(token === undefined || token === '' ? {} : { authorization: `Bearer ${token}` }),
      },
    },
  );
  if (response.status === 404) {
    await writeManifest(out, { versions: [] });
    console.log(`No ${ARCHIVE_BRANCH} branch yet: no archived versions.`);
    return;
  }
  if (!response.ok) throw new Error(`GitHub answered ${response.status} for versions.json.`);
  const manifest = parseManifest(await response.text(), `versions.json on ${ARCHIVE_BRANCH}`);
  await writeManifest(out, manifest);
  console.log(`Archived versions: ${manifest.versions.map((entry) => entry.release).join(', ')}.`);
}

/** The directory of a version in the archive and on the site. */
export const directoryOf = (id: string): string => `v${id}`;

const VERSION_DIRECTORY = /^v\d+\.\d+$/;

async function archive(directory: string, snapshot: string, release: string): Promise<void> {
  const file = path.join(directory, 'versions.json');
  const manifest = await readManifest(file);
  const id = minorOf(release);
  const current = manifest.versions.find((entry) => entry.id === id);
  if (current !== undefined && compareReleases(release, current.release) < 0) {
    throw new Error(
      `The archive already has ${current.release}, newer than ${release}; it is kept.`,
    );
  }
  const target = path.join(directory, directoryOf(id));
  await rm(target, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  await cp(snapshot, target, { recursive: true });
  const pages = await pagesOf(target);
  if (!pages.includes('')) throw new Error(`${snapshot} has no index.html: not a built site.`);
  await writeManifest(file, withVersion(manifest, { id, release, pages }));
  console.log(`Archived ${release} as ${directoryOf(id)}/ (${pages.length} pages).`);
}

async function assemble(directory: string, root: string, out: string): Promise<void> {
  const manifest = await readManifest(path.join(directory, 'versions.json'));
  const listed = new Set(manifest.versions.map((entry) => directoryOf(entry.id)));
  await rm(out, { recursive: true, force: true });
  await cp(root, out, { recursive: true });
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory() || !VERSION_DIRECTORY.test(entry.name)) continue;
    if (!listed.has(entry.name)) throw new Error(`${entry.name}/ is not in versions.json.`);
    await cp(path.join(directory, entry.name), path.join(out, entry.name), { recursive: true });
  }
  await writeManifest(path.join(out, 'versions.json'), manifest);
  console.log(
    `Assembled the site: the root and ${listed.size === 1 ? 'one version' : `${listed.size} versions`}${listed.size === 0 ? '' : ` (${[...listed].join(', ')})`}.`,
  );
}

async function main(args: readonly string[]): Promise<void> {
  const [command, ...rest] = args;
  const [first, second, third] = rest;
  if (command === 'fetch' && first !== undefined) {
    await fetchManifest(first);
    return;
  }
  if (command === 'minor' && first !== undefined) {
    process.stdout.write(`${minorOf(first)}\n`);
    return;
  }
  if (command === 'check' && first !== undefined && second !== undefined) {
    const problem = olderThanArchived(await readManifest(first), second);
    if (problem !== undefined) throw new Error(problem);
    return;
  }
  if (command === 'with' && first !== undefined && second !== undefined) {
    const manifest = withVersion(await readManifest(first), {
      id: minorOf(second),
      release: second.replace(/^v/, ''),
    });
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    return;
  }
  if (command === 'archive' && first !== undefined && second !== undefined && third !== undefined) {
    await archive(first, second, third.replace(/^v/, ''));
    return;
  }
  if (
    command === 'assemble' &&
    first !== undefined &&
    second !== undefined &&
    third !== undefined
  ) {
    await assemble(first, second, third);
    return;
  }
  throw new Error(
    'Usage: versions.ts fetch <out> | minor <release> | check <manifest> <release> | with <manifest> <release> | archive <archive> <snapshot> <release> | assemble <archive> <root> <out>',
  );
}

// Run directly (`file:///C:/…` on Windows, so the path is converted rather than prefixed).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
