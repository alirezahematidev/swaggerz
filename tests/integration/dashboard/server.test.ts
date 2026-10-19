import { writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  GraphResponse,
  ModelDetail,
  ModelSummary,
  OperationDetail,
  OperationSummary,
  OverviewResponse,
  PreviewResponse,
  UsageReport,
} from '../../../src/dashboard/api-types.ts';
import { startDashboard, type DashboardServer } from '../../../src/dashboard/server.ts';
import { SwaggerzError } from '../../../src/diagnostics/bag.ts';
import { createProject } from '../../support/project.ts';

let dashboard: DashboardServer;
let project: string;

interface RawResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

/** Low-level HTTP so tests can send arbitrary Host/Origin headers. */
function raw(
  method: string,
  pathname: string,
  headers: Record<string, string> = {},
  body?: string,
): Promise<RawResponse> {
  const url = new URL(pathname, dashboard.origin);
  return new Promise((resolve, reject) => {
    const req = request(
      { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk.toString('utf8')));
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: data });
        });
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}

async function api<T>(pathname: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await raw(
    method,
    pathname,
    {
      authorization: `Bearer ${dashboard.token}`,
      ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
    },
    method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
  );
  if (response.status !== 200) throw new Error(`${response.status}: ${response.body}`);
  return JSON.parse(response.body) as T;
}

beforeAll(async () => {
  project = await createProject('dashboard', {
    files: {
      'src/app.ts': [
        "import { getPetById, type Pet } from './generated/api/index.js';",
        "import * as store from './generated/api/store/get-inventory.js';",
        "import { useThing } from './other.js';",
        'export const pet: Promise<Pet> = getPetById({ petId: 1 });',
        'export const inventory = store.getInventory();',
        "export const lazy = () => import('./generated/api/user/login-user.js');",
        'export { useThing };',
      ].join('\n'),
      'src/other.ts': 'export const useThing = 1;\n',
      // Path aliases from tsconfig.json, JSX, type references and shorthand properties.
      'tsconfig.json': JSON.stringify({
        compilerOptions: { baseUrl: '.', paths: { '@api/*': ['src/generated/api/*'] } },
      }),
      'src/view.tsx': [
        "import { deletePet, findPetsByStatus, type Order } from '@api/index.js';",
        "import type { Category } from '@api/models/category.js';",
        'const Button = (props: { onClick: () => void }) => <button onClick={props.onClick} />;',
        'export const view = <Button onClick={() => void deletePet({ petId: 1 })} />;',
        'export const handlers = { findPetsByStatus };',
        'export const order: Order | undefined = undefined;',
        'export const category = (value: Category) => value.name;',
        "export const config = { placeOrder: 'not the generated function' };",
        "export const legacy = () => require('./generated/api/user/logout-user.js');",
      ].join('\n'),
    },
  });
  dashboard = await startDashboard({ cwd: project, env: {}, port: 0 });
});

afterAll(async () => {
  await dashboard.close();
});

describe('dashboard security', () => {
  it('binds to loopback and serves a static shell with a strict CSP', async () => {
    expect(new URL(dashboard.origin).hostname).toBe('127.0.0.1');
    const page = await raw('GET', '/');
    expect(page.status).toBe(200);
    expect(page.headers['content-security-policy']).toContain("script-src 'self'");
    expect(page.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(page.headers['x-content-type-options']).toBe('nosniff');
    // No inline scripts and no specification content in the HTML shell.
    expect(page.body).not.toMatch(/<script(?![^>]*\bsrc=)/);
    expect(page.body).not.toContain('Petstore');
    expect((await raw('GET', '/assets/app.js')).status).toBe(200);
  });

  it('requires the session token for every API call', async () => {
    expect((await raw('GET', '/api/overview')).status).toBe(401);
    expect((await raw('GET', '/api/overview', { authorization: 'Bearer wrong' })).status).toBe(401);
    expect(
      (await raw('GET', '/api/overview', { authorization: `Bearer ${dashboard.token}` })).status,
    ).toBe(200);
  });

  it('rejects DNS-rebinding hosts, cross-origin writes and unexpected content types', async () => {
    const auth = { authorization: `Bearer ${dashboard.token}` };
    expect(
      (await raw('GET', '/api/overview', { ...auth, host: 'attacker.example.com' })).status,
    ).toBe(421);
    expect(
      (
        await raw(
          'POST',
          '/api/preview',
          { ...auth, origin: 'https://attacker.example.com', 'content-type': 'application/json' },
          '{}',
        )
      ).status,
    ).toBe(403);
    expect(
      (await raw('POST', '/api/preview', { ...auth, 'content-type': 'text/plain' }, '{}')).status,
    ).toBe(415);
    expect((await raw('GET', '/api/nope', auth)).status).toBe(404);
    const unconfirmed = await raw(
      'POST',
      '/api/generate',
      { ...auth, 'content-type': 'application/json' },
      '{}',
    );
    expect(unconfirmed.status).toBe(400);
  });

  it('refuses to listen on a network interface unless explicitly allowed', async () => {
    const error = await startDashboard({ cwd: project, env: {}, port: 0, host: '0.0.0.0' }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(SwaggerzError);
    expect((error as SwaggerzError).diagnostics[0]?.code).toBe('dashboard/network-access');
  });
});

describe('dashboard API', () => {
  it('summarizes the specification and generation status', async () => {
    const overview = await api<OverviewResponse>('/api/overview');
    expect(overview).toMatchObject({
      title: 'Swagger Petstore - OpenAPI 3.0',
      specVersionRaw: '3.0.3',
      counts: { operations: 15, models: 11, files: 34, tags: 3, deprecated: 1 },
      generation: { status: 'never' },
      config: { output: 'src/generated/api', language: 'typescript', adapter: 'fetch' },
    });
    expect(overview.methods).toEqual({ PUT: 1, POST: 3, GET: 9, DELETE: 2 });
  });

  it('lists and details operations from the shared IR', async () => {
    const operations = await api<OperationSummary[]>('/api/operations');
    expect(operations).toHaveLength(15);
    const detail = await api<OperationDetail>(
      `/api/operation?key=${encodeURIComponent('get /pet/{petId}')}`,
    );
    expect(detail.summary).toMatchObject({
      name: 'getPetById',
      method: 'GET',
      auth: ['api_key', 'petstore_auth'],
    });
    expect(Object.keys(detail.typeNames)).not.toContain('body');
    expect(detail.dependencies.map((d) => d.name)).toEqual([
      'Error',
      'Pet',
      'NewPet',
      'Category',
      'Tag',
    ]);
    expect(detail.dependencies.find((d) => d.name === 'Tag')?.chain).toEqual([
      'Pet',
      'NewPet',
      'Tag',
    ]);
    expect(detail.code.map((c) => c.label)).toEqual([
      'Generated',
      'JavaScript preview',
      'Declarations preview',
    ]);
    expect(detail.code[0]?.content).toContain('export function getPetById(');
    expect(detail.source).toMatchObject({ file: 'petstore-3.0.yaml', line: 143 });
    expect(detail.operation.description).toBe('Returns a single pet.');
  });

  it('details models with relations and code in every language', async () => {
    const models = await api<ModelSummary[]>('/api/models');
    expect(models.map((m) => m.name)).toContain('Pet');
    const pet = await api<ModelDetail>(
      `/api/model?id=${encodeURIComponent('#/components/schemas/Pet')}`,
    );
    expect(pet.references.map((r) => r.name)).toEqual(['NewPet']);
    expect(pet.usedBy.map((op) => op.name).sort()).toEqual([
      'addPet',
      'findPetsByStatus',
      'findPetsByTags',
      'getPetById',
      'updatePet',
    ]);
    expect(pet.code.map((c) => c.language)).toEqual(['typescript', 'javascript', 'typescript']);
    const graph = await api<GraphResponse>('/api/graph');
    expect(graph.unused).toEqual([]);
    // Pet and everything it references are reached by the same five operations; ties sort by name.
    expect(graph.mostUsed.slice(0, 4).map((m) => [m.name, m.count])).toEqual([
      ['Category', 5],
      ['NewPet', 5],
      ['Pet', 5],
      ['Tag', 5],
    ]);
  });

  it('previews, diffs and writes the generated output', async () => {
    const preview = await api<PreviewResponse>('/api/preview', 'POST');
    expect(preview.ok).toBe(true);
    expect(preview.changes.every((c) => c.kind === 'create')).toBe(true);
    const diff = await api<{ hunks: { lines: { kind: string }[] }[] }>(
      `/api/diff?path=${encodeURIComponent('client.ts')}`,
    );
    expect(diff.hunks[0]?.lines.every((line) => line.kind === 'add')).toBe(true);
    const result = await api<{ ok: boolean; write: { created: string[] } }>(
      '/api/generate',
      'POST',
      { confirm: true },
    );
    expect(result.ok).toBe(true);
    expect(result.write.created).toHaveLength(34);
    const overview = await api<OverviewResponse>('/api/overview');
    expect(overview.generation).toMatchObject({
      status: 'up-to-date',
      manifestFiles: 34,
      lastRun: { ok: true },
    });
  });

  it('scans application usage statically and flags ambiguous imports', async () => {
    const report = await api<UsageReport>('/api/usage', 'POST');
    expect(report.status).toBe('ok');
    expect(report.scanner).toBe('oxc-parser');
    expect(report.scannedFiles).toBe(3);
    const byName = new Map(report.entries.map((entry) => [entry.name, entry]));
    expect(byName.get('getPetById')).toMatchObject({
      status: 'used',
      references: 1,
      module: 'pet/get-pet-by-id',
    });
    expect(byName.get('getPetById')?.locations[0]).toMatchObject({ file: 'src/app.ts', line: 1 });
    expect(byName.get('Pet')).toMatchObject({ status: 'used', module: 'models/pet' });
    expect(byName.get('getInventory')).toMatchObject({ status: 'used', references: 1 });
    expect(byName.get('loginUser')?.status).toBe('unknown');
    expect(byName.get('logoutUser')?.status).toBe('unknown');
    expect(byName.get('addPet')?.status).toBe('unused');
    // Resolved through the @api/* path alias; used as a JSX attribute value, a shorthand
    // property and type references.
    expect(byName.get('deletePet')).toMatchObject({ status: 'used', references: 1 });
    expect(byName.get('deletePet')?.locations[0]).toMatchObject({ file: 'src/view.tsx', line: 1 });
    expect(byName.get('findPetsByStatus')).toMatchObject({ status: 'used', references: 1 });
    expect(byName.get('Order')).toMatchObject({ status: 'used', module: 'models/order' });
    expect(byName.get('Category')).toMatchObject({ status: 'used', references: 1 });
    // An object key with the same name is not a reference.
    expect(byName.get('placeOrder')?.status).toBe('unused');
    const ambiguous = report.ambiguous.map((entry) => `${entry.module}: ${entry.reason}`);
    expect(ambiguous.sort((a, b) => a.localeCompare(b))).toEqual([
      'user/login-user: dynamic import()',
      'user/logout-user: require()',
    ]);
  });

  it('reloads the specification from disk', async () => {
    await writeFile(
      path.join(project, 'swaggerz.config.mjs'),
      `export default ${JSON.stringify({ spec: { version: '3.0', input: path.join(project, '..', '..', '..', '..', 'fixtures', 'specs', 'external', 'openapi.yaml') }, output: { directory: './src/generated/api' } })};\n`,
    );
    const overview = await api<OverviewResponse>('/api/reload', 'POST');
    expect(overview.title).toBe('Multi-file API');
    expect(overview.generation.status).toBe('stale');
  });
});
