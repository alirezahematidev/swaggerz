import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectService, type ReloadOutcome } from '../../../src/service/project.ts';
import { ProjectWatcher } from '../../../src/service/watch.ts';
import { createProject } from '../../support/project.ts';

const SPEC = `openapi: 3.0.3
info: { title: Pets, version: '1' }
paths:
  /pets:
    get:
      operationId: listPets
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

const closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
});

/** A watched project and the outcomes of its reloads. */
async function watched(
  name: string,
  files: Record<string, string>,
  config: Record<string, unknown> = {},
) {
  const directory = await createProject(name, {
    config: { spec: { version: '3.0', input: './openapi.yaml' }, ...config },
    files,
  });
  const service = new ProjectService({ cwd: directory, env: {} });
  await service.reload('start');
  const outcomes: ReloadOutcome[] = [];
  const watcher = new ProjectWatcher(service, {
    reloaded: (outcome) => outcomes.push(outcome),
  });
  watcher.start();
  closers.push(() => watcher.close());
  // Let the platform watchers start before the test writes (as in the FileWatcher tests).
  await new Promise((resolve) => setTimeout(resolve, 200));
  const next = async (count: number): Promise<ReloadOutcome> => {
    const started = Date.now();
    while (outcomes.length < count) {
      if (Date.now() - started > 10_000)
        throw new Error(`Expected ${count} reloads, got ${JSON.stringify(outcomes)}`);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const outcome = outcomes[count - 1];
    if (outcome === undefined) throw new Error('No reload');
    return outcome;
  };
  return { directory, service, next, file: (relative: string) => path.join(directory, relative) };
}

describe('ProjectWatcher after a failed reload', { timeout: 20_000 }, () => {
  it('reloads when a missing $ref target is created', async () => {
    const project = await watched('watch-missing-ref', {
      'openapi.yaml': SPEC,
      'schemas/pet.yaml': PET,
    });
    await writeFile(project.file('schemas/pet.yaml'), `${PET}  owner: { $ref: './owner.yaml' }\n`);
    expect(await project.next(1)).toMatchObject({ ok: false });
    expect(project.service.watchTargets().sources).toContain(project.file('schemas/owner.yaml'));

    await writeFile(project.file('schemas/owner.yaml'), 'type: string\n');
    expect(await project.next(2)).toMatchObject({ ok: true });
    expect(project.service.models().map((model) => model.name)).toContain('Owner');
  });

  it('watches a new input that does not compile until it is fixed', async () => {
    const project = await watched('watch-new-input', {
      'openapi.yaml': SPEC,
      'schemas/pet.yaml': PET,
      'other.yaml': 'openapi: 3.0.3\ninfo: [unclosed\n',
    });
    const config = project.file('swaggerz.config.mjs');
    await writeFile(
      config,
      (await readFile(config, 'utf8')).replace('./openapi.yaml', './other.yaml'),
    );
    expect(await project.next(1)).toMatchObject({ ok: false });

    await writeFile(
      project.file('other.yaml'),
      SPEC.replace('title: Pets', 'title: Other').replace('listPets', 'listOthers'),
    );
    expect(await project.next(2)).toMatchObject({ ok: true });
    expect((await project.service.overview()).title).toBe('Other');
  });

  it('watches missing $ref targets of a first load that did not compile', async () => {
    const project = await watched('watch-missing-ref-start', {
      'openapi.yaml': SPEC,
      'schemas/pet.yaml': `${PET}  owner: { $ref: './owner.yaml#/definitions/Owner' }\n`,
    });
    expect(project.service.project).toBeUndefined();
    expect(project.service.watchTargets().sources).toContain(project.file('schemas/owner.yaml'));
    await writeFile(
      project.file('schemas/owner.yaml'),
      'definitions:\n  Owner: { type: string }\n',
    );
    expect(await project.next(1)).toMatchObject({ ok: true });
    expect(project.service.project).toBeDefined();
  });

  it('reloads with the new code when a local plugin changes', async () => {
    const plugin = (prefix: string): string =>
      `export default { name: 'prefix', operationName: (operation, suggested) => '${prefix}' + suggested };\n`;
    const project = await watched(
      'watch-plugin',
      { 'openapi.yaml': SPEC, 'schemas/pet.yaml': PET, 'plugin.mjs': plugin('v1_') },
      { plugins: ['./plugin.mjs'] },
    );
    expect(project.service.watchTargets().sources).toContain(project.file('plugin.mjs'));
    expect(project.service.project?.operations.map((op) => op.name)).toEqual(['v1_listPets']);

    await writeFile(project.file('plugin.mjs'), plugin('v2_'));
    expect(await project.next(1)).toMatchObject({ ok: true });
    expect(project.service.project?.operations.map((op) => op.name)).toEqual(['v2_listPets']);
  });
});
