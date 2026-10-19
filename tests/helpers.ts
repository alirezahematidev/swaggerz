import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfig } from '../src/config/resolve.ts';
import type { ResolvedConfig } from '../src/config/resolved.ts';
import type { UserConfig } from '../src/config/types.ts';
import { DiagnosticBag } from '../src/diagnostics/bag.ts';
import type { Diagnostic } from '../src/diagnostics/types.ts';
import type { ApiDocument, SchemaDefinition } from '../src/ir/types.ts';
import { parseSpecification } from '../src/spec/parse.ts';
import { deepMerge } from '../src/utils/object.ts';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURES = path.join(REPO_ROOT, 'fixtures', 'specs');

export function fixture(name: string): string {
  return path.join(FIXTURES, name);
}

export function makeConfig(
  overrides: Partial<UserConfig> & { spec: UserConfig['spec'] },
  root = REPO_ROOT,
): ResolvedConfig {
  const base: UserConfig = {
    output: { directory: path.join(root, '.tmp', 'out') },
    spec: overrides.spec,
  };
  return resolveConfig(deepMerge(base, overrides), { root });
}

export interface ParsedFixture {
  readonly ir: ApiDocument;
  readonly diagnostics: Diagnostic[];
  schema(name: string): SchemaDefinition;
}

export async function parseFixture(
  name: string,
  version: '2.0' | '3.0' | '3.1' | 'auto' = 'auto',
  extra: Partial<UserConfig> = {},
): Promise<ParsedFixture> {
  const diagnostics = new DiagnosticBag();
  const config = makeConfig({ ...extra, spec: { version, input: fixture(name), ...extra.spec } });
  const { ir } = await parseSpecification({ config, diagnostics });
  if (ir === undefined) {
    throw new Error(`Parsing failed: ${JSON.stringify(diagnostics.toArray(), null, 2)}`);
  }
  return {
    ir,
    diagnostics: diagnostics.toArray(),
    schema(schemaName: string) {
      const found = ir.schemas.find((s) => s.name === schemaName);
      if (found === undefined)
        throw new Error(
          `Schema ${schemaName} not found in ${ir.schemas.map((s) => s.name).join(', ')}`,
        );
      return found;
    },
  };
}

export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'swaggerz-test-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function codes(diagnostics: readonly Diagnostic[]): string[] {
  return diagnostics.map((d) => d.code);
}
