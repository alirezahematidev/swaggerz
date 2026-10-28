import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  firstLocation,
  generateOnce,
  GenerationSession,
  summarize,
  type GenerationReport,
} from '../../../src/integrations/core.ts';
import { createProject } from '../../support/project.ts';

const spec = (title: string, operation = 'listPets'): string => `openapi: 3.0.3
info: { title: ${title}, version: '1' }
paths:
  /pets:
    get:
      operationId: ${operation}
      responses:
        '200':
          description: The pets.
          content:
            application/json:
              schema: { $ref: './schemas/pet.yaml' }
`;
const PET = `type: object
properties:
  name: { type: string }
`;
const CONFIG = { spec: { version: '3.0', input: './openapi.yaml' } };

const closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
});

function project(name: string): Promise<string> {
  return createProject(name, {
    config: CONFIG,
    files: { 'openapi.yaml': spec('Pets'), 'schemas/pet.yaml': PET },
  });
}

/** A session and the reports it made. */
async function session(directory: string, watch = true) {
  const reports: GenerationReport[] = [];
  const generation = new GenerationSession({
    cwd: directory,
    watch,
    onReport: (report) => reports.push(report),
  });
  closers.push(() => generation.close());
  await generation.start();
  /**
   * Writes a file until a report satisfies `done`. Writing again covers an edit the platform
   * watcher reported before it was ready.
   */
  const edit = async (
    file: string,
    text: string,
    done: (report: GenerationReport) => boolean,
  ): Promise<GenerationReport> => {
    const from = reports.length;
    const started = Date.now();
    for (;;) {
      await writeFile(path.join(directory, file), text);
      const until = Date.now() + 1000;
      while (Date.now() < until) {
        const match = reports.slice(from).find(done);
        if (match !== undefined) return match;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      if (Date.now() - started > 15_000)
        throw new Error(`No matching report, got ${JSON.stringify(reports.slice(from))}`);
    }
  };
  return { reports, edit };
}

describe('generateOnce', () => {
  it('generates the client, then checks it', async () => {
    const directory = await project('integration-once');
    const generated = await generateOnce({ cwd: directory });
    expect(generated.ok).toBe(true);
    expect(generated.write?.created).toContain('index.ts');
    expect(generated.sources).toEqual(
      [
        path.join(directory, 'openapi.yaml'),
        path.join(directory, 'schemas', 'pet.yaml'),
        path.join(directory, 'swaggerz.config.mjs'),
      ].sort(),
    );
    expect(summarize(generated, directory)).toMatch(
      /^Generated \d+ files in src\/generated\/api \(\d+ created\) in \d+ ms\.$/,
    );

    const checked = await generateOnce({ cwd: directory, check: true });
    expect(checked).toMatchObject({ ok: true, upToDate: true });
    expect(summarize(checked, directory)).toMatch(
      /^src\/generated\/api is up to date \(\d+ files\)\.$/,
    );

    await writeFile(path.join(directory, 'openapi.yaml'), spec('Pets', 'listAllPets'));
    const stale = await generateOnce({ cwd: directory, check: true });
    expect(stale).toMatchObject({ ok: false, upToDate: false });
    expect(summarize(stale, directory)).toMatch(
      /^src\/generated\/api is out of date \(\d+ missing, \d+ outdated or edited, \d+ no longer generated\)\. Run `swaggerz generate` and commit the result\.$/,
    );
    // A check writes nothing.
    expect((await generateOnce({ cwd: directory, check: true })).upToDate).toBe(false);
  });

  it('reports a missing config file and an invalid specification without throwing', async () => {
    const directory = await project('integration-once-errors');
    await rm(path.join(directory, 'swaggerz.config.mjs'));
    const missing = await generateOnce({ cwd: directory });
    expect(missing).toMatchObject({ ok: false, error: 'No config file found' });
    expect(missing.diagnostics.map((d) => d.code)).toEqual(['config/not-found']);
    expect(missing.sources).toContain(path.join(directory, 'swaggerz.config.ts'));
    expect(summarize(missing, directory)).toBe('No config file found.');

    await writeFile(
      path.join(directory, 'swaggerz.config.mjs'),
      `export default ${JSON.stringify(CONFIG)};\n`,
    );
    await writeFile(
      path.join(directory, 'schemas', 'pet.yaml'),
      `${PET}  owner: { $ref: './owner.yaml' }\n`,
    );
    const invalid = await generateOnce({ cwd: directory });
    expect(invalid.ok).toBe(false);
    expect(invalid.write).toBeUndefined();
    expect(summarize(invalid, directory)).toMatch(
      /^Generation failed \(\d+ errors?\); nothing was written\.$/,
    );
    expect(firstLocation(invalid)?.file).toBe(path.join(directory, 'schemas', 'pet.yaml'));
  });
});

describe('GenerationSession', { timeout: 30_000 }, () => {
  it('generates, then writes only what a change to the specification changes', async () => {
    const directory = await project('integration-session');
    const { reports, edit } = await session(directory);
    expect(reports).toHaveLength(1);
    expect(reports[0]?.ok).toBe(true);
    expect(reports[0]?.write?.created).toContain('index.ts');
    const index = path.join(directory, 'src', 'generated', 'api', 'index.ts');
    expect(await readFile(index, 'utf8')).toContain('list-pets');

    const report = await edit('openapi.yaml', spec('Pets', 'listAllPets'), (r) => r.ok);
    expect(report.changed).toEqual(['openapi.yaml']);
    expect(report.write?.updated).toContain('index.ts');
    // The runtime did not change, so it was not written.
    expect(report.write?.unchanged.length).toBeGreaterThan(0);
    expect(summarize(report, directory)).toMatch(
      /^openapi\.yaml changed: regenerated src\/generated\/api \(.*\) in \d+ ms\.$/,
    );
    expect(await readFile(index, 'utf8')).toContain('list-all-pets');
  });

  it('reports a broken specification, keeps the output and recovers', async () => {
    const directory = await project('integration-session-broken');
    const { edit } = await session(directory);
    const index = path.join(directory, 'src', 'generated', 'api', 'index.ts');
    const before = await readFile(index, 'utf8');

    const broken = await edit('openapi.yaml', 'openapi: 3.0.3\ninfo: [unclosed\n', (r) => !r.ok);
    expect(broken.write).toBeUndefined();
    expect(broken.diagnostics.some((d) => d.severity === 'error')).toBe(true);
    expect(summarize(broken, directory)).toMatch(
      /^openapi\.yaml changed: generation failed \(\d+ errors?\); nothing was written\.$/,
    );
    expect(await readFile(index, 'utf8')).toBe(before);

    const fixed = await edit('openapi.yaml', spec('Pets', 'listAllPets'), (r) => r.ok);
    expect(fixed.write?.updated).toContain('index.ts');
  });

  it('waits for a config file that cannot be loaded yet', async () => {
    const directory = await project('integration-session-config');
    const config = path.join(directory, 'swaggerz.config.mjs');
    await rm(config);
    const { reports, edit } = await session(directory);
    expect(reports[0]).toMatchObject({ ok: false, error: 'No config file found' });

    const report = await edit(
      'swaggerz.config.mjs',
      `export default ${JSON.stringify(CONFIG)};\n`,
      (r) => r.ok,
    );
    expect(report.changed).toEqual(['swaggerz.config.mjs']);
    expect(report.write?.created).toContain('index.ts');
    // Watching the project now: a change to the specification regenerates.
    await edit('openapi.yaml', spec('Pets', 'listAllPets'), (r) =>
      r.changed.includes('openapi.yaml'),
    );
  });

  it('generates once without watching', async () => {
    const directory = await project('integration-session-once');
    const { reports } = await session(directory, false);
    expect(reports).toHaveLength(1);
    await writeFile(path.join(directory, 'openapi.yaml'), spec('Pets', 'listAllPets'));
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(reports).toHaveLength(1);
  });

  it('stops reporting once closed', async () => {
    const directory = await project('integration-session-close');
    const reports: GenerationReport[] = [];
    const generation = new GenerationSession({
      cwd: directory,
      watch: true,
      onReport: (report) => reports.push(report),
    });
    await generation.start();
    await generation.close();
    await writeFile(path.join(directory, 'openapi.yaml'), spec('Pets', 'listAllPets'));
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(reports).toHaveLength(1);
    await vi.waitFor(() => {
      expect(reports).toHaveLength(1);
    });
  });
});

describe('summarize', () => {
  const write = {
    directory: '/project/src/api',
    created: [],
    updated: ['index.ts'],
    deleted: [],
    unchanged: ['runtime.ts'],
    dryRun: false,
  };
  const report = (fields: Partial<GenerationReport>): GenerationReport => ({
    ok: true,
    diagnostics: [],
    changed: [],
    elapsed: 12.4,
    ...fields,
  });

  it('describes what changed', () => {
    expect(summarize(report({ write }), '/project')).toBe(
      'Generated 2 files in src/api (1 updated) in 12 ms.',
    );
    expect(
      summarize(report({ write: { ...write, updated: [], unchanged: ['a', 'b'] } }), '/project'),
    ).toBe('src/api is up to date (2 files, 12 ms).');
    expect(
      summarize(
        report({
          write: { ...write, updated: [] },
          changed: ['a.yaml', 'b.yaml', 'c.yaml', 'd.yaml'],
        }),
        '/project',
      ),
    ).toBe('a.yaml, b.yaml, c.yaml and 1 more changed: no generated file changed (12 ms).');
  });

  it('describes failures', () => {
    const error = { code: 'spec/x', severity: 'error', message: 'Bad.' } as const;
    const warning = { code: 'spec/y', severity: 'warning', message: 'Odd.' } as const;
    expect(summarize(report({ ok: false, diagnostics: [error, warning] }), '/project')).toBe(
      'Generation failed (1 error, 1 warning); nothing was written.',
    );
    expect(
      summarize(
        report({ ok: false, write, diagnostics: [error], changed: ['x.yaml'] }),
        '/project',
      ),
    ).toBe(
      'x.yaml changed: the files in src/api were written, but errors were reported afterwards (1 error).',
    );
  });
});
