import { describe, expect, it, vi } from 'vitest';
import { ProjectService } from '../../../src/service/project.ts';
import { fixture } from '../../helpers.ts';
import { createProject } from '../../support/project.ts';

async function load(name: string, config: Record<string, unknown> = {}): Promise<ProjectService> {
  const directory = await createProject(name, { config });
  const service = new ProjectService({ cwd: directory, env: {} });
  await service.reload('start');
  return service;
}

describe('ProjectService output directory', () => {
  it('refuses to preview an output directory that generate would refuse', async () => {
    const service = await load('service-unsafe-output', { output: { directory: '.' } });
    const preview = await service.preview();
    expect(preview.ok).toBe(false);
    expect(preview.changes).toEqual([]);
    expect(preview.diagnostics.map((d) => d.code)).toContain('config/unsafe-output');
    const overview = await service.overview();
    expect(overview.generation.status).toBe('failed');
    expect(overview.diagnostics.map((d) => d.code)).toContain('config/unsafe-output');
  });
});

describe('ProjectService generation', () => {
  it('writes only the previewed plan, running the write hooks around it', async () => {
    const directory = await createProject('service-generate', {
      files: {
        // Inline hooks record the calls in the test process.
        'swaggerz.config.mjs': [
          `export default {`,
          `  spec: { version: '3.0', input: ${JSON.stringify(fixture('petstore-3.0.yaml'))} },`,
          `  output: { directory: './src/generated/api' },`,
          `  hooks: {`,
          `    beforeWrite(plan) { globalThis.serviceGenerateHooks.push('before ' + plan.changes.length); },`,
          `    afterWrite(result) { globalThis.serviceGenerateHooks.push('after ' + result.created.length); },`,
          `  },`,
          `};`,
        ].join('\n'),
      },
    });
    const hooks: string[] = [];
    Object.assign(globalThis, { serviceGenerateHooks: hooks });
    const service = new ProjectService({ cwd: directory, env: {} });
    await service.reload('start');
    const preview = await service.preview();
    expect(preview.id).toMatch(/^[0-9a-f]{64}$/);
    // The same state gives the same id; anything else writes nothing.
    expect((await service.preview()).id).toBe(preview.id);
    expect(await service.generate('outdated')).toEqual({
      ok: false,
      outdated: true,
      diagnostics: [],
    });
    expect(hooks).toEqual([]);

    const result = await service.generate(preview.id ?? '');
    expect(result.ok).toBe(true);
    expect(result.write?.created).toHaveLength(preview.changes.length);
    expect(hooks).toEqual([`before ${preview.changes.length}`, `after ${preview.changes.length}`]);
    // Written: the old preview no longer describes the output directory.
    expect((await service.generate(preview.id ?? '')).outdated).toBe(true);
    expect((await service.overview()).generation).toMatchObject({
      status: 'up-to-date',
      lastRun: { ok: true },
    });
  });
});

describe('ProjectService writes for the integrations', () => {
  it('writes without a preview, unless a plugin reported an error before the write', async () => {
    const directory = await createProject('service-write', {
      files: {
        'swaggerz.config.mjs': [
          `export default {`,
          `  spec: { version: '3.0', input: ${JSON.stringify(fixture('petstore-3.0.yaml'))} },`,
          `  output: { directory: './src/generated/api' },`,
          `  hooks: {`,
          `    beforeWrite(plan, ctx) {`,
          `      if (globalThis.serviceWriteBlocked) ctx.report({ code: 'test/blocked', severity: 'error', message: 'Blocked.' });`,
          `      else ctx.report({ code: 'test/noted', severity: 'warning', message: 'Noted.' });`,
          `    },`,
          `  },`,
          `};`,
        ].join('\n'),
      },
    });
    Object.assign(globalThis, { serviceWriteBlocked: true });
    const service = new ProjectService({ cwd: directory, env: {} });
    await service.reload('start');
    const blocked = await service.write();
    expect(blocked.ok).toBe(false);
    expect(blocked.write).toBeUndefined();
    expect(blocked.diagnostics.filter((d) => d.code === 'test/blocked')).toHaveLength(1);
    expect((await service.overview()).generation.status).toBe('never');

    // The error stays with that compilation: writing it again is refused too.
    expect((await service.write()).ok).toBe(false);

    Object.assign(globalThis, { serviceWriteBlocked: false });
    await service.reload('manual');
    const written = await service.write();
    expect(written.ok).toBe(true);
    expect(written.write?.created.length).toBeGreaterThan(0);
    // Each write reports what the plugins reported for its compilation, once.
    expect(written.diagnostics.map((d) => d.code)).not.toContain('test/blocked');
    expect(written.diagnostics.filter((d) => d.code === 'test/noted')).toHaveLength(1);
    const again = await service.write();
    expect(again.write?.created).toEqual([]);
    expect(again.diagnostics.filter((d) => d.code === 'test/noted')).toHaveLength(1);
  });
});

describe('ProjectService model details', () => {
  it('reuses summaries computed for the lists instead of recomputing every model', async () => {
    const service = await load('service-model-detail');
    const graph = service.project?.graph;
    if (graph === undefined) throw new Error('not compiled');
    // The lists the dashboard loads first.
    service.operations();
    service.models();
    const closures = vi.spyOn(graph, 'operationClosure');
    const recursive = vi.spyOn(graph, 'recursiveSchemas');
    const pet = service.modelDetail('#/components/schemas/Pet');
    expect(pet?.summary).toMatchObject({ name: 'Pet', usedBy: 5 });
    expect(pet?.usedBy).toHaveLength(5);
    service.modelDetail('#/components/schemas/Tag');
    expect(closures).not.toHaveBeenCalled();
    expect(recursive).not.toHaveBeenCalled();
  });
});
