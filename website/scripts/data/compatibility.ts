/**
 * docs/compatibility.md is rendered as written, but its version table is checked here: the
 * oldest versions against what `pnpm compat` installs (`scripts/compat-versions.ts`), the newest
 * against the versions the integration tests run with (the repository's installed dependencies).
 * When a dependency is bumped or a minimum changes, the build fails until the page says so.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DEPENDENCIES } from '../../../scripts/compat-versions.ts';
import { markdownTables } from './markdown.ts';
import { DriftError, ROOT } from './output.ts';

const SOURCE = 'docs/compatibility.md';

const exact = (alias: string): string => {
  const spec = DEPENDENCIES[alias];
  if (spec === undefined) throw new Error(`scripts/compat-versions.ts has no ${alias}`);
  return spec.replace(/^npm:[^@]+@/, '').replace(/^[~^]/, '');
};

const majorMinor = (version: string): string => version.split('.').slice(0, 2).join('.');

async function installed(name: string): Promise<string> {
  const pkg = JSON.parse(
    await readFile(path.join(ROOT, 'node_modules', name, 'package.json'), 'utf8'),
  ) as { version: string };
  return pkg.version;
}

const mentions = (cell: string, version: string): boolean =>
  new RegExp(`(^|[^\\d.])${version.replace(/\./g, '\\.')}([^\\d]|$)`).test(cell);

export async function compatibility(): Promise<void> {
  const text = await readFile(path.join(ROOT, SOURCE), 'utf8');
  const table = markdownTables(text).find((t) => t.heading === 'Tested versions');
  if (table === undefined)
    throw new DriftError(`${SOURCE} changed shape:`, ['no "Tested versions" table']);
  const rows = new Map(table.rows.slice(1).map((row) => [row[0]?.replace(/`/g, '') ?? '', row]));
  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8')) as {
    engines: { node: string };
  };

  const expected: { row: string; oldest: string[]; newest: string[] }[] = [
    {
      row: 'TypeScript',
      oldest: [exact('ts-5.0'), exact('ts-5.4')],
      newest: [majorMinor(await installed('typescript')), majorMinor(exact('ts-7'))],
    },
    ...(['react-query', 'vue-query', 'svelte-query', 'solid-query'] as const).map((name) => ({
      row: `@tanstack/${name}`,
      oldest: [exact(`@tanstack/${name}`)],
      newest: [] as string[],
    })),
    { row: 'SWR', oldest: [exact('swr')], newest: [] },
    { row: 'axios', oldest: [exact('axios')], newest: [] },
    { row: 'Zod', oldest: [exact('zod')], newest: [] },
    { row: 'Valibot', oldest: [exact('valibot')], newest: [] },
    { row: 'ArkType', oldest: [exact('arktype')], newest: [] },
    { row: 'Node.js (generator)', oldest: [pkg.engines.node.replace(/^>=/, '')], newest: [] },
  ];
  // Newest versions: what the repository installs for its integration tests.
  const newest: Record<string, string> = {
    '@tanstack/react-query': '@tanstack/react-query',
    '@tanstack/vue-query': '@tanstack/vue-query',
    '@tanstack/svelte-query': '@tanstack/svelte-query',
    '@tanstack/solid-query': '@tanstack/solid-query',
    SWR: 'swr',
    axios: 'axios',
    Zod: 'zod',
    Valibot: 'valibot',
    ArkType: 'arktype',
  };
  const frameworks: Record<string, { name: string; label: string; oldest: string }> = {
    '@tanstack/vue-query': { name: 'vue', label: 'Vue', oldest: exact('vue') },
    '@tanstack/svelte-query': {
      name: 'svelte',
      label: 'Svelte',
      oldest: majorMinor(exact('svelte')),
    },
    '@tanstack/solid-query': {
      name: 'solid-js',
      label: 'Solid',
      oldest: majorMinor(exact('solid-js')),
    },
  };
  for (const entry of expected) {
    const name = newest[entry.row];
    if (name !== undefined) entry.newest.push(majorMinor(await installed(name)));
    const framework = frameworks[entry.row];
    if (framework !== undefined) {
      entry.oldest.push(framework.oldest);
      entry.newest.push(majorMinor(await installed(framework.name)));
    }
  }

  const problems: string[] = [];
  for (const entry of expected) {
    const row = rows.get(entry.row);
    if (row === undefined) {
      problems.push(`the row "${entry.row}" is missing`);
      continue;
    }
    const [, oldestCell = '', newestCell = ''] = row;
    for (const version of entry.oldest) {
      if (!mentions(oldestCell, version)) {
        problems.push(
          `${entry.row}: "Oldest verified" says "${oldestCell}", pnpm compat installs ${version}`,
        );
      }
    }
    for (const version of entry.newest) {
      if (!mentions(newestCell, version)) {
        problems.push(
          `${entry.row}: "Newest verified" says "${newestCell}", the tests run ${version}`,
        );
      }
    }
  }
  if (problems.length > 0) {
    throw new DriftError(`The "Tested versions" table of ${SOURCE} is out of date:`, problems);
  }
}
