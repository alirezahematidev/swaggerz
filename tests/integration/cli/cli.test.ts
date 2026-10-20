import { spawn, type ChildProcess } from 'node:child_process';
import { access, copyFile, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
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

/**
 * Exit code expected after `child.kill('SIGINT')`: 0 from the graceful shutdown. Windows has no
 * signals, so Node.js terminates the process instead (no exit code); a real Ctrl+C in a console
 * still reaches the CLI's SIGINT handler.
 */
const INTERRUPTED = process.platform === 'win32' ? null : 0;

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
    expect(first.write.created).toHaveLength(35);

    const second = await run(['generate'], project);
    expect(second.stdout).toContain('0 created, 0 updated, 0 deleted, 35 unchanged');

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
    expect(dry.stdout).toContain('Would remove 35 files');
    expect(await exists(path.join(project, 'src/generated/api/client.ts'))).toBe(true);
    expect((await run(['clean'], project)).stdout).toContain('Removed 35 generated files');
    expect(await exists(path.join(project, 'src/generated/api'))).toBe(false);
  });

  it('generate --check fails on missing, outdated, edited and leftover output', async () => {
    const project = await createProject('cli-check');
    const output = path.join(project, 'src/generated/api');
    interface Check {
      ok: boolean;
      upToDate: boolean;
      check?: {
        created: string[];
        updated: string[];
        deleted: string[];
        manifest: string;
      };
    }
    const check = async (): Promise<{ code: number | null; json: Check; text: Run }> => {
      const json = await run(['generate', '--check', '--json'], project);
      return {
        code: json.code,
        json: JSON.parse(json.stdout) as Check,
        text: await run(['generate', '--check'], project),
      };
    };

    // Nothing generated yet: every file and the manifest are missing.
    const missing = await check();
    expect(missing.code).toBe(1);
    expect(missing.json.check?.created).toHaveLength(35);
    expect(missing.json.check?.manifest).toBe('create');
    expect(await exists(output)).toBe(false);
    expect(missing.text.code).toBe(1);
    // Directories are printed with the platform's separator.
    const shown = path.join('src', 'generated', 'api');
    expect(missing.text.stderr).toContain(`${shown} is out of date: 35 missing`);

    expect((await run(['generate'], project)).code).toBe(0);
    const fresh = await check();
    expect(fresh.code).toBe(0);
    expect(fresh.json).toMatchObject({ ok: true, upToDate: true });
    expect(fresh.text.stdout).toContain(`${shown} is up to date (35 files)`);

    // A hand edit and a deleted file.
    await writeFile(path.join(output, 'client.ts'), '// edited\n', { flag: 'a' });
    await rm(path.join(output, 'user/logout-user.ts'));
    const edited = await check();
    expect(edited.code).toBe(1);
    expect(edited.json.check).toMatchObject({
      created: ['user/logout-user.ts'],
      updated: ['client.ts'],
      deleted: [],
      manifest: 'unchanged',
    });
    expect(edited.text.stderr).toContain('~ client.ts');
    expect(edited.text.stderr).toContain('+ user/logout-user.ts');
    expect(edited.text.stderr).toContain('Run `swaggerz generate`');

    // A specification change: one module is no longer generated, another one is new.
    await run(['generate'], project);
    const spec = path.join(project, 'openapi.yaml');
    await copyFile(fixture('petstore-3.0.yaml'), spec);
    await writeFile(
      path.join(project, 'swaggerz.config.mjs'),
      `export default { spec: { version: '3.0', input: './openapi.yaml' }, output: { directory: './src/generated/api' } };\n`,
    );
    await writeFile(
      spec,
      (await readFile(spec, 'utf8')).replace('operationId: logoutUser', 'operationId: signOut'),
    );
    const renamed = await check();
    expect(renamed.code).toBe(1);
    expect(renamed.json.check).toMatchObject({
      created: ['user/sign-out.ts'],
      deleted: ['user/logout-user.ts'],
      manifest: 'update',
    });
    expect(await exists(path.join(output, 'user/sign-out.ts'))).toBe(false);

    // Usage errors.
    expect((await run(['generate', '--check', '--watch'], project)).code).toBe(2);
    expect((await run(['generate', '--check', '--dry-run'], project)).code).toBe(2);
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
    expect(await exited(child)).toBe(INTERRUPTED);
  });

  it('polls a remote specification in watch mode', async () => {
    let spec = await readFile(fixture('petstore-3.0.yaml'), 'utf8');
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/yaml' });
      res.end(spec);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/openapi.yaml`;
    const project = await createProject('cli-watch-remote', {
      config: { spec: { version: '3.0', input: url, fetch: { poll: 500 } } },
    });
    const child = start(['generate', '--watch'], project);
    try {
      const watching = await waitForOutput(child, (out) => out.includes('Watching'));
      expect(watching).toContain(`${url} (every 0.5 s)`);
      spec = spec.replace('operationId: logoutUser', 'operationId: signOut');
      await waitForOutput(child, (out) => out.includes('1 created, 1 updated, 1 deleted'));
      expect(await exists(path.join(project, 'src/generated/api/user/sign-out.ts'))).toBe(true);
    } finally {
      child.kill('SIGINT');
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    expect(await exited(child)).toBe(INTERRUPTED);
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
    expect(await exited(child)).toBe(INTERRUPTED);
  });
});
