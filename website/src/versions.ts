/**
 * The versions of the docs this build knows and links to (scripts/versions.ts has the model). A
 * build is either the root of the site, the latest release's docs (`SITE_BASE`), or the snapshot
 * of a release below that root (`SITE_BASE=<root>v0.3/` with `SITE_ROOT=<root>`). `SITE_VERSIONS`
 * names the archive's manifest when the site is built to be deployed; without it, as in
 * development, this version is the only one. Read at build time only (server side).
 */
import { readFileSync } from 'node:fs';
import {
  directoryOf,
  minorOf,
  parseManifest,
  withVersion,
  type DocsVersion,
} from '../scripts/versions.ts';
import { PACKAGE } from './site.ts';

const slash = (value: string): string => (value.endsWith('/') ? value : `${value}/`);

/** Where this build is served. */
export const BASE = slash(import.meta.env.BASE_URL);

/** Where the root of the site, the latest release's docs, is served. */
export const ROOT = slash(process.env['SITE_ROOT'] ?? BASE);

/** This build is the snapshot of a release, served below the root. */
export const SNAPSHOT = ROOT !== BASE;

/** The version this build documents. */
export const CURRENT: DocsVersion = { id: minorOf(PACKAGE.version), release: PACKAGE.version };

function archived(): readonly DocsVersion[] {
  const file = process.env['SITE_VERSIONS'];
  if (file === undefined || file === '') return [];
  return parseManifest(readFileSync(file, 'utf8'), file).versions;
}

/** Every version of the site this build knows, newest first, this one included. */
export const VERSIONS: readonly DocsVersion[] = withVersion(
  { versions: archived() },
  CURRENT,
).versions;

/**
 * The path of a page below this build's base (`docs/introduction/`); the start page and pages that
 * exist in every build only once (the 404 page) are `''`.
 */
export function pageOf(pathname: string): string {
  const page = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : '';
  return /^404(\.html|\/)?$/.test(page) ? '' : page;
}

/** Where a version's docs start: the root for the latest release in its root build. */
export function homeOf(version: DocsVersion): string {
  return !SNAPSHOT && version.id === CURRENT.id ? ROOT : `${ROOT}${directoryOf(version.id)}/`;
}

export interface VersionLink {
  readonly label: string;
  readonly href: string;
  /** The version of this page. */
  readonly current: boolean;
  /** The newest version this build knows. */
  readonly latest: boolean;
}

/**
 * The same page in every version: the page itself when that version has it, otherwise the
 * version's start page. A snapshot also links to the latest docs at the root, whose pages it does
 * not know.
 */
export function versionLinks(page: string): VersionLink[] {
  const links: VersionLink[] = SNAPSHOT
    ? [{ label: 'Latest', href: `${ROOT}${page}`, current: false, latest: false }]
    : [];
  for (const [index, version] of VERSIONS.entries()) {
    const current = version.id === CURRENT.id;
    const target = current || version.pages?.includes(page) === true ? page : '';
    links.push({
      label: version.id,
      href: `${homeOf(version)}${target}`,
      current,
      latest: !SNAPSHOT && index === 0,
    });
  }
  return links;
}
