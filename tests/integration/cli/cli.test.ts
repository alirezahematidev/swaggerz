import { spawn, type ChildProcess } from 'node:child_process';
import { access, copyFile, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../../../src/meta.ts';
import { fixture, REPO_ROOT } from '../../helpers.ts';
import { createProject } from '../../support/project.ts';

const BIN = path.join(REPO_ROOT, 'src', 'cli', 'bin.ts');

interface Run {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function start(args: readonly string[], cwd: string): ChildProcess {
  return spawn(process.execPath, [BIN, ...args], {
    cwd,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '' },
  });
}

function run(args: readonly string[], cwd: string): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = start(args, cwd);
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

/** Resolves once `predicate` matches the accumulated stdout of a long-running process. */
function waitForOutput(
  child: ChildProcess,
  predicate: (output: string) => boolean,
  timeout = 20_000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for output. Got:\n${output}`));
    }, timeout);
    const onData = (chunk: Buffer): void => {
      output += chunk.toString();
      if (predicate(output)) {
        clearTimeout(timer);
        child.stdout?.off('data', onData);
        resolve(output);
      }
    };
    child.stdout?.on('data', onData);
  });
}

const exited = (child: ChildProcess): Promise<number | null> =>
  new Promise((resolve) => {
    child.on('close', resolve);
  });

const exists = (file: string): Promise<boolean> =>
  access(file).then(
    () => true,
    () => false,
  );

describe('CLI basics', () => {
  it('prints help, version and usage errors with documented exit codes', async () => {
    const help = await run(['--help'], REPO_ROOT);
    expect(help.code).toBe(0);
    for (const command of [
      'init',
      'generate',
      'validate',
      'inspect',
      'dashboard',
      'clean',
      'doctor',
    ]) {
      expect(help.stdout).toContain(command);
    }
    expect((await run(['--version'], REPO_ROOT)).stdout.trim()).toBe(
      `${PACKAGE_NAME} ${PACKAGE_VERSION}`,
    );
    const unknown = await run(['genrate'], REPO_ROOT);
    expect(unknown.code).toBe(2);
    expect(unknown.stderr).toContain('Did you mean "generate"?');
    const option = await run(['generate', '--dryrun'], REPO_ROOT);
    expect(option.code).toBe(2);
    expect(option.stderr).toContain('Did you mean --dry-run?');
    expect((await run(['generate', '--help'], REPO_ROOT)).stdout).toContain('--watch');
  });
});

describe('init', () => {
  it('detects the specification and project language and never overwrites silently', async () => {
    const project = await createProject('cli-init', { files: { 'tsconfig.json': '{}' } });
    await copyFile(fixture('petstore-2.0.json'), path.join(project, 'swagger.json'));
    // Start without a config file so `init` creates one.
    await rm(path.join(project, 'swaggerz.config.mjs'));
    const first = await run(['init', '--adapter', 'axios'], project);
    expect(first.code).toBe(0);
    const config = await readFile(path.join(project, 'swaggerz.config.ts'), 'utf8');
    expect(config).toContain(`import { defineConfig } from '${PACKAGE_NAME}';`);
    expect(config).toContain("version: '2.0'");
    expect(config).toContain("input: './swagger.json'");
    expect(config).toContain("adapter: 'axios'");
    expect(config).toContain("language: 'typescript'");
    const again = await run(['init'], project);
    expect(again.code).toBe(1);
    expect(again.stderr).toContain('already exists');
    expect((await run(['init', '--force', '--language', 'cobol'], project)).code).toBe(2);
  });
});

describe('commands on a project', () => {
  it('generates, regenerates without changes, validates, inspects, checks and cleans', async () => {
    const project = await createProject('cli-commands');
    const generated = await run(['generate', '--json'], project);
    expect(generated.code).toBe(0);
    const first = JSON.parse(generated.stdout) as { ok: boolean; write: { created: string[] } };
    expect(first.ok).toBe(true);
    expect(first.write.created).toHaveLength(34);

    const second = await run(['generate'], project);
    expect(second.stdout).toContain('0 created, 0 updated, 0 deleted, 34 unchanged');

    const validated = await run(['validate', '--json'], project);
    expect(validated.code).toBe(0);
    expect(JSON.parse(validated.stdout)).toMatchObject({ ok: true, operations: 15, models: 11 });

    const inspected = JSON.parse(
      (await run(['inspect', '--json', '--filter', 'pet'], project)).stdout,
    ) as {
      operations: { name: string; models: string[] }[];
    };
    expect(inspected.operations.find((o) => o.name === 'getPetById')?.models).toEqual([
      'Category',
      'Error',
      'NewPet',
      'Pet',
      'Tag',
    ]);

    const doctor = await run(['doctor', '--json'], project);
    const checks = (JSON.parse(doctor.stdout) as { checks: { name: string; status: string }[] })
      .checks;
    expect(checks.find((c) => c.name === 'Specification')?.status).toBe('ok');
    expect(checks.find((c) => c.name === 'Generated output')?.status).toBe('ok');

    const dry = await run(['clean', '--dry-run'], project);
    expect(dry.stdout).toContain('Would remove 34 files');
    expect(await exists(path.join(project, 'src/generated/api/client.ts'))).toBe(true);
    expect((await run(['clean'], project)).stdout).toContain('Removed 34 generated files');
    expect(await exists(path.join(project, 'src/generated/api'))).toBe(false);
  });

  it('loads TypeScript config files and reports failures with exit codes', async () => {
    const project = await createProject('cli-errors');
    await writeFile(
      path.join(project, 'swaggerz.config.ts'),
      [
        "type Version = '3.0';",
        "const version: Version = '3.0';",
        `const config: { spec: { version: Version; input: string } } = { spec: { version, input: ${JSON.stringify(fixture('invalid/broken-refs.yaml'))} } };`,
        'export default config;',
      ].join('\n'),
    );
    const broken = await run(['validate'], project);
    expect(broken.code).toBe(1);
    expect(broken.stderr).toContain('ref/missing-target');
    expect(broken.stderr).toMatch(/broken-refs\.yaml:14:\d+/);

    await writeFile(
      path.join(project, 'swaggerz.config.ts'),
      'export default { spec: { version: "3.0", input: "x.yaml" }, ouput: {} };\n',
    );
    const invalid = await run(['generate'], project);
    expect(invalid.code).toBe(2);
    expect(invalid.stderr).toContain('Did you mean "output"?');
  });

  it('doctor checks the versions of the dependencies the enabled features need', async () => {
    const installed = (version: string): string => JSON.stringify({ name: 'zod', version });
    const project = await createProject('cli-doctor', {
      config: { features: { validation: 'zod' } },
      files: { 'node_modules/zod/package.json': installed('4.0.14') },
    });
    const zodCheck = async (): Promise<{ status: string; detail: string } | undefined> => {
      const doctor = await run(['doctor', '--json'], project);
      const { checks } = JSON.parse(doctor.stdout) as {
        checks: { name: string; status: string; detail: string }[];
      };
      return checks.find((c) => c.name === 'zod');
    };
    // Zod 4.0.0-4.0.14 cannot type recursive getter schemas on TypeScript 6+.
    expect(await zodCheck()).toMatchObject({
      status: 'fail',
      detail: expect.stringContaining('^4.0.15') as string,
    });
    await writeFile(path.join(project, 'node_modules/zod/package.json'), installed('4.6.0'));
    expect(await zodCheck()).toMatchObject({ status: 'ok' });
    await writeFile(path.join(project, 'node_modules/zod/package.json'), installed('3.25.0'));
    expect(await zodCheck()).toMatchObject({ status: 'fail' });
  });
});

describe('long-running commands', () => {
  it('regenerates in watch mode when the specification changes', async () => {
    const project = await createProject('cli-watch');
    const spec = path.join(project, 'openapi.yaml');
    await copyFile(fixture('petstore-3.0.yaml'), spec);
    await writeFile(
      path.join(project, 'swaggerz.config.mjs'),
      `export default { spec: { version: '3.0', input: './openapi.yaml' }, output: { directory: './src/generated/api' } };\n`,
    );
    const child = start(['generate', '--watch'], project);
    try {
      await waitForOutput(child, (out) => out.includes('Watching'));
      expect(await exists(path.join(project, 'src/generated/api/user/logout-user.ts'))).toBe(true);
      await writeFile(
        spec,
        (await readFile(spec, 'utf8')).replace('operationId: logoutUser', 'operationId: signOut'),
      );
      await waitForOutput(child, (out) => out.includes('1 created, 1 updated, 1 deleted'));
      expect(await exists(path.join(project, 'src/generated/api/user/sign-out.ts'))).toBe(true);
      expect(await exists(path.join(project, 'src/generated/api/user/logout-user.ts'))).toBe(false);
    } finally {
      child.kill('SIGINT');
    }
    expect(await exited(child)).toBe(0);
  });

  it('serves the dashboard until interrupted', async () => {
    const project = await createProject('cli-dashboard');
    const child = start(['dashboard', '--port', '0', '--json'], project);
    try {
      const output = await waitForOutput(child, (out) => out.includes('"url"'));
      const url = new URL((JSON.parse(output) as { url: string }).url);
      const token = url.searchParams.get('token') ?? '';
      const response = await fetch(new URL('/api/overview', url), {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(200);
      expect(
        ((await response.json()) as { counts: { operations: number } }).counts.operations,
      ).toBe(15);
    } finally {
      child.kill('SIGINT');
    }
    expect(await exited(child)).toBe(0);
  });
});
