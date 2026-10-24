/**
 * The public API corpus (`pnpm corpus`, run in CI): which descriptions are compiled and the
 * totals recorded in its baseline, `fixtures/corpus/baseline.json`.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DriftError, ROOT, writeGenerated } from './output.ts';

interface Result {
  readonly version: string;
  readonly ok: boolean;
  readonly operations?: number;
  readonly models?: number;
  readonly typeErrors?: number;
}

export async function corpus(): Promise<void> {
  const read = async (name: string): Promise<unknown> =>
    JSON.parse(await readFile(path.join(ROOT, 'fixtures', 'corpus', name), 'utf8'));
  const { documents } = (await read('corpus.json')) as { documents: { name: string }[] };
  const baseline = (await read('baseline.json')) as Record<string, Result>;
  const missing = documents
    .filter((doc) => baseline[doc.name] === undefined)
    .map((doc) => doc.name);
  if (missing.length > 0) {
    throw new DriftError('fixtures/corpus/baseline.json has no result for:', missing);
  }
  const results = documents.map((doc) => ({ name: doc.name, ...(baseline[doc.name] as Result) }));
  await writeGenerated('corpus.json', {
    documents: results.length,
    compiled: results.filter((result) => result.ok).length,
    operations: results.reduce((total, result) => total + (result.operations ?? 0), 0),
    models: results.reduce((total, result) => total + (result.models ?? 0), 0),
    typeErrors: results.reduce((total, result) => total + (result.typeErrors ?? 0), 0),
    names: results.map((result) => result.name),
  });
}
