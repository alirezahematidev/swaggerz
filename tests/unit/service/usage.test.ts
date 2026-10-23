import { rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../src/config/load.ts';
import { runGeneration } from '../../../src/pipeline/generate.ts';
import type { UsageEntry, UsageReport } from '../../../src/service/types.ts';
import { excludeMatcher, scanUsage } from '../../../src/service/usage.ts';
import { createProject } from '../../support/project.ts';

/** Generates the client of a project with the given application files, then scans its usage. */
async function scan(
  name: string,
  files: Record<string, string>,
  options: {
    config?: Record<string, unknown>;
    exclude?: readonly string[];
    /** Opens the project through this symbolic link instead of its real path. */
    link?: string;
  } = {},
): Promise<{ report: UsageReport; entry: (name: string) => UsageEntry | undefined }> {
  const real = await createProject(name, {
    ...(options.config === undefined ? {} : { config: options.config }),
    files,
  });
  let cwd = real;
  if (options.link !== undefined) {
    cwd = path.join(path.dirname(real), options.link);
    await rm(cwd, { force: true, recursive: true });
    await symlink(real, cwd, 'junction');
  }
  const { config } = await loadConfig({ cwd, command: 'dashboard', env: {} });
  const generated = await runGeneration({ config });
  expect(generated.ok).toBe(true);
  const report = await scanUsage({
    root: config.root,
    outputDirectory: config.output.directory,
    files: generated.files,
    include: ['src'],
    exclude: options.exclude ?? [],
  });
  const byName = new Map(report.entries.map((entry) => [entry.name, entry]));
  return { report, entry: (key) => byName.get(key) };
}

describe('usage scanning', () => {
  it('scans the scripts and templates of Vue and Svelte components', async () => {
    const { entry, report } = await scan('usage-components', {
      'src/Pet.vue': [
        '<template>',
        '  <p>{{ formatPet(pet) }}</p>',
        '</template>',
        '',
        '<script setup lang="ts">',
        "import { getPetById, formatPet, type Pet } from './generated/api/index.js';",
        'const pet: Pet = await getPetById({ petId: 1 });',
        '</script>',
        '',
        '<style scoped>',
        'p { color: red; }',
        '</style>',
      ].join('\n'),
      'src/Inventory.svelte': [
        '<script>',
        "  import { getInventory } from './generated/api/index.js';",
        '  const inventory = getInventory();',
        '</script>',
        '',
        '{#await inventory}<p>Loading…</p>{/await}',
      ].join('\n'),
    });
    expect(report.scannedFiles).toBe(2);
    expect(entry('getPetById')).toMatchObject({
      status: 'used',
      references: 1,
      locations: [{ file: 'src/Pet.vue', line: 6, column: 10 }],
    });
    // `formatPet` is not generated; the template use of a generated name counts.
    expect(entry('getInventory')).toMatchObject({
      status: 'used',
      references: 1,
      locations: [{ file: 'src/Inventory.svelte', line: 2, column: 12 }],
    });
    expect(entry('addPet')?.status).toBe('unused');
  });

  it('counts names used only in a component template', async () => {
    const { entry } = await scan('usage-template', {
      'src/Pets.vue': [
        '<script setup>',
        "import { findPetsByStatus } from './generated/api/index.js';",
        '</script>',
        '<template><button @click="findPetsByStatus({ status: [] })">Find</button></template>',
      ].join('\n'),
    });
    expect(entry('findPetsByStatus')).toMatchObject({ status: 'used', references: 1 });
  });

  it('attributes imports through every barrel to the module defining the name', async () => {
    const { entry } = await scan(
      'usage-barrels',
      {
        'src/app.ts': [
          "import { useGetPetById } from './generated/api/swr/index.js';",
          "import { PetSchema } from './generated/api/zod/index.js';",
          "import { getInventory } from './generated/api/index.js';",
          'export const pet = useGetPetById({ petId: 1 });',
          'export const schema = PetSchema;',
          'export const inventory = getInventory();',
        ].join('\n'),
      },
      { config: { features: { swr: true, validation: 'zod' } } },
    );
    expect(entry('useGetPetById')).toMatchObject({
      status: 'used',
      references: 1,
      module: 'swr/pet/get-pet-by-id',
    });
    expect(entry('PetSchema')).toMatchObject({ status: 'used', module: 'zod/pet' });
    expect(entry('getInventory')).toMatchObject({ status: 'used', module: 'store/get-inventory' });
    expect(entry('useFindPetsByStatus')?.status).toBe('unused');
  });

  it('counts only references to the imported binding, not to local declarations', async () => {
    const { entry } = await scan('usage-scopes', {
      'src/app.ts': [
        "import { updatePet, addPet, deletePet, getPetById, type Pet } from './generated/api/index.js';",
        'export function local(o: { updatePet: () => void }) {',
        '  const { updatePet } = o;',
        '  return updatePet();',
        '}',
        'export const shadowed = (addPet: () => void) => addPet();',
        'export function caught() {',
        '  try {',
        '    return 1;',
        '  } catch (deletePet) {',
        '    return deletePet;',
        '  }',
        '}',
        'export function generic<Pet>(value: Pet): Pet {',
        '  return value;',
        '}',
        'export function hoisted() {',
        '  if (Math.random() > 1) {',
        '    var getPetById = 1;',
        '  }',
        '  return getPetById;',
        '}',
      ].join('\n'),
    });
    for (const name of ['updatePet', 'addPet', 'deletePet', 'getPetById', 'Pet'])
      expect([name, entry(name)?.status, entry(name)?.references]).toEqual([name, 'imported', 0]);
  });

  it('still counts the import inside nested scopes that do not redeclare it', async () => {
    const { entry } = await scan('usage-nested', {
      'src/app.ts': [
        "import { updatePet, type Pet } from './generated/api/index.js';",
        'export function edit(pet: Pet) {',
        '  const updatePetLater = () => updatePet({ body: pet });',
        '  for (const other of [pet]) void updatePet({ body: other });',
        '  return updatePetLater;',
        '}',
      ].join('\n'),
    });
    expect(entry('updatePet')).toMatchObject({ status: 'used', references: 2 });
    expect(entry('Pet')).toMatchObject({ status: 'used', references: 1 });
  });

  it('resolves the generated client of a project opened through a symbolic link', async () => {
    const { report, entry } = await scan(
      'usage-symlink',
      {
        'src/app.ts':
          "import { getPetById } from './generated/api/index.js';\nexport const pet = getPetById({ petId: 1 });\n",
      },
      { link: 'usage-symlink-link' },
    );
    expect(report.scannedFiles).toBe(1);
    expect(entry('getPetById')).toMatchObject({ status: 'used', references: 1 });
  });

  it('matches exclusions against the path inside the project, by segment', async () => {
    const { report, entry } = await scan(
      'usage-exclude',
      {
        'src/app.ts':
          "import { getPetById } from './generated/api/index.js';\nexport const pet = getPetById({ petId: 1 });\n",
        'src/legacy/old.ts':
          "import { addPet } from '../generated/api/index.js';\nexport const add = addPet;\n",
        'src/app.test.ts':
          "import { deletePet } from './generated/api/index.js';\nexport const remove = deletePet;\n",
        'src/legacy-free.ts':
          "import { updatePet } from './generated/api/index.js';\nexport const update = updatePet;\n",
      },
      // `projects` and `usage-exclude` are directories above the project root, not inside it.
      { exclude: ['projects', 'usage-exclude', 'legacy', '*.test.ts'] },
    );
    expect(report.scannedFiles).toBe(2);
    expect(entry('getPetById')?.status).toBe('used');
    expect(entry('updatePet')?.status).toBe('used');
    expect(entry('addPet')?.status).toBe('unused');
    expect(entry('deletePet')?.status).toBe('unused');
  });
});

describe('usage exclusions', () => {
  const root = path.resolve('/work/app');
  const matches = (patterns: readonly string[], file: string): boolean =>
    excludeMatcher(root, patterns)(file.split('/'));

  it('matches whole segments, sequences of segments and wildcards within a segment', () => {
    expect(matches(['legacy'], 'src/legacy/a.ts')).toBe(true);
    expect(matches(['legacy'], 'src/legacy-free.ts')).toBe(false);
    expect(matches(['src/legacy'], 'packages/a/src/legacy/b.ts')).toBe(true);
    expect(matches(['src/legacy'], 'src/other/legacy/b.ts')).toBe(false);
    expect(matches(['*.test.ts'], 'src/a.test.ts')).toBe(true);
    expect(matches(['*.test.ts'], 'src/a.ts')).toBe(false);
    expect(matches(['./src/'], 'src/a.ts')).toBe(true);
    expect(matches([path.join(root, 'src', 'legacy')], 'src/legacy/a.ts')).toBe(true);
    expect(matches(['', '.', '../app'], 'src/a.ts')).toBe(false);
  });
});
