import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Package identity, read from `package.json` so the published name is defined in exactly one
 * place. `src/meta.ts` and `dist/meta.js` both sit one directory below the package root.
 */
interface PackageIdentity {
  readonly name: string;
  readonly version: string;
  readonly bin: string;
}

function readPackageIdentity(): PackageIdentity {
  const raw: unknown = JSON.parse(
    // Resolved with `path` (not `new URL()`) so it also works where a DOM shim replaces `URL`.
    readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json'),
      'utf8',
    ),
  );
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Unable to read package.json');
  }
  const name = 'name' in raw && typeof raw.name === 'string' ? raw.name : undefined;
  const version = 'version' in raw && typeof raw.version === 'string' ? raw.version : undefined;
  const binField = 'bin' in raw ? raw.bin : undefined;
  const bin =
    typeof binField === 'object' && binField !== null ? Object.keys(binField)[0] : undefined;
  if (name === undefined || version === undefined) {
    throw new Error('package.json is missing "name" or "version"');
  }
  return { name, version, bin: bin ?? name.split('/').at(-1) ?? name };
}

const identity = readPackageIdentity();

/** The npm package name, e.g. `swaggerz` or `@scope/swaggerz`. */
export const PACKAGE_NAME: string = identity.name;
/** The installed generator version. */
export const PACKAGE_VERSION: string = identity.version;
/** The CLI binary name, also used for the config file name and environment variable prefix. */
export const TOOL_NAME: string = identity.bin;
/** Config files are named `<tool>.config.{ts,mts,js,mjs,cts,cjs}`. */
export const CONFIG_BASENAME = `${TOOL_NAME}.config`;
/** Generated output ownership manifest. */
export const MANIFEST_FILENAME = `.${TOOL_NAME}-manifest.json`;
/** Prefix for environment variable overrides, e.g. `SWAGGERZ_SPEC_INPUT`. */
export const ENV_PREFIX = `${TOOL_NAME.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_`;
