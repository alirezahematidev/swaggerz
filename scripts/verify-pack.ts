/**
 * Packs the package, installs the tarball into a clean project outside the repository and
 * exercises it exactly like a user would: `init`, `generate`, compile the generated client with
 * `tsc`, run the generated JavaScript client against a local server and use the programmatic API.
 *
 * Usage: node scripts/verify-pack.ts   (requires network access to install dependencies)
 */
import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8')) as {
  name: string;
  version: string;
  bin: string | Record<string, string>;
};
// A string `bin` installs a binary named after the package (without its scope).
const bin =
  typeof pkg.bin === 'string'
    ? (pkg.name.split('/').at(-1) ?? pkg.name)
    : (Object.keys(pkg.bin)[0] ?? pkg.name);

function run(command: string, args: readonly string[], cwd: string): string {
  console.log(`$ ${command} ${args.join(' ')}`);
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(`verify-pack: ${message}`);
  console.log(`  ✔ ${message}`);
}

const work = await mkdtemp(path.join(os.tmpdir(), 'swaggerz-pack-'));
try {
  // 1. Build, pack and audit the tarball contents. The build runs separately because lifecycle
  //    script output would be mixed into `npm pack --json` on stdout.
  execFileSync(process.execPath, ['scripts/build.ts'], { cwd: ROOT, stdio: 'inherit' });
  const packOutput = run(
    'npm',
    ['pack', '--json', '--ignore-scripts', '--pack-destination', work],
    ROOT,
  );
  const [info] = JSON.parse(packOutput) as [
    { filename: string; files: { path: string }[]; size: number; unpackedSize: number },
  ];
  const files = info.files.map((f) => f.path);
  check(
    files.includes('dist/index.js') && files.includes('dist/index.d.ts'),
    'tarball contains the library entry and types',
  );
  check(files.includes('dist/cli/bin.js'), 'tarball contains the CLI');
  check(
    files.some((f) => f.startsWith('assets/runtime/')) && files.includes('assets/dashboard/app.js'),
    'tarball contains runtime templates and the dashboard bundle',
  );
  check(
    !files.some((f) => /^(src|tests|fixtures|scripts|examples)\//.test(f)),
    'tarball excludes sources, tests and fixtures',
  );
  check(
    files.includes('LICENSE') && files.includes('README.md'),
    'tarball contains README and LICENSE',
  );
  console.log(
    `  tarball: ${(info.size / 1024).toFixed(0)} kB packed, ${(info.unpackedSize / 1024).toFixed(0)} kB unpacked, ${files.length} files`,
  );

  // 2. Install into a clean project.
  const project = path.join(work, 'app');
  await rm(project, { recursive: true, force: true });
  execFileSync('mkdir', ['-p', path.join(project, 'src')]);
  await writeFile(
    path.join(project, 'package.json'),
    JSON.stringify({ name: 'pack-test-app', private: true, type: 'module' }),
  );
  await writeFile(
    path.join(project, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        target: 'ES2022',
        lib: ['ES2022', 'DOM'],
        noEmit: true,
        skipLibCheck: true,
      },
      include: ['src'],
    }),
  );
  await copyFile(
    path.join(ROOT, 'fixtures', 'specs', 'petstore-3.0.yaml'),
    path.join(project, 'openapi.yaml'),
  );
  run(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      '--loglevel=error',
      path.join(work, info.filename),
      'typescript@~6.0.3',
    ],
    project,
  );
  const npx = (...args: string[]): string => run('npx', ['--no-install', bin, ...args], project);

  // 3. CLI workflow with a TypeScript config importing the package.
  check(npx('--version').trim() === `${pkg.name} ${pkg.version}`, 'CLI reports the packed version');
  npx('init');
  check(
    (await readFile(path.join(project, `${bin}.config.ts`), 'utf8')).includes(`from '${pkg.name}'`),
    'init writes a typed config importing the package',
  );
  npx('generate');
  check(npx('generate').includes('32 unchanged'), 'regeneration is a no-op');
  const validation = JSON.parse(npx('validate', '--json')) as { ok: boolean; operations: number };
  check(validation.ok && validation.operations === 15, 'validate succeeds');
  await writeFile(
    path.join(project, 'src', 'app.ts'),
    "import { getPetById, client, type Pet } from './generated/api/index.js';\nclient.setConfig({ baseUrl: 'http://localhost' });\nexport const pet: Promise<Pet> = getPetById({ petId: 1 });\n",
  );
  run('npx', ['--no-install', 'tsc', '-p', 'tsconfig.json'], project);
  check(true, 'generated TypeScript client compiles in the consumer project');

  // 4. Generated JavaScript runs in Node against a real server.
  await writeFile(
    path.join(project, 'js.config.mjs'),
    "import { defineConfig } from '" +
      pkg.name +
      "';\nexport default defineConfig({ spec: { version: '3.0', input: './openapi.yaml' }, output: { directory: './js-client', language: 'javascript' } });\n",
  );
  npx('generate', '--config', 'js.config.mjs');
  await writeFile(
    path.join(project, 'run.mjs'),
    [
      "import { createServer } from 'node:http';",
      "import { client, getPetById } from './js-client/index.js';",
      "const server = createServer((req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ id: 1, name: 'Rex', path: req.url })); });",
      "await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));",
      'client.setConfig({ baseUrl: `http://127.0.0.1:${server.address().port}` });',
      'const pet = await getPetById({ petId: 1 });',
      'server.close();',
      'console.log(JSON.stringify(pet));',
    ].join('\n'),
  );
  const pet = JSON.parse(run('node', ['run.mjs'], project)) as { name: string; path: string };
  check(
    pet.name === 'Rex' && pet.path === '/pet/1',
    'generated JavaScript client performs a real request',
  );

  // 5. Programmatic API and package exports.
  const api = run(
    'node',
    [
      '--input-type=module',
      '-e',
      `import * as m from '${pkg.name}'; console.log(Object.keys(m).sort().join(','))`,
    ],
    project,
  );
  check(
    ['defineConfig', 'definePlugin', 'generate', 'validate'].every((name) =>
      api.trim().split(',').includes(name),
    ),
    'programmatic API is exported',
  );
  console.log('\nPacked package verified.');
} finally {
  await rm(work, { recursive: true, force: true });
}
