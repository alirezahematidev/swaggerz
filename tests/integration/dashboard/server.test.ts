import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer, request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { hostname, networkInterfaces } from 'node:os';
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
  ServerEvent,
  UsageReport,
} from '../../../src/service/types.ts';
import { startDashboard, type DashboardServer } from '../../../src/dashboard/server.ts';
import { SwaggerzError } from '../../../src/diagnostics/bag.ts';
import { fixture } from '../../helpers.ts';
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
  return rawTo(dashboard, method, pathname, headers, body);
}

function rawTo(
  server: DashboardServer,
  method: string,
  pathname: string,
  headers: Record<string, string> = {},
  body?: string,
): Promise<RawResponse> {
  const url = new URL(pathname, server.origin);
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

async function api<T>(
  pathname: string,
  method = 'GET',
  body?: unknown,
  server: DashboardServer = dashboard,
): Promise<T> {
  const response = await rawTo(
    server,
    method,
    pathname,
    {
      authorization: `Bearer ${server.token}`,
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
  // Live reload is tested separately; here files change only when a test says so.
  dashboard = await startDashboard({ cwd: project, env: {}, port: 0, watch: false });
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

  it('allows inline styles only with a fresh per-response nonce and serves only built assets', async () => {
    const page = await raw('GET', '/');
    const csp = String(page.headers['content-security-policy']);
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonce).toMatch(/^[A-Za-z0-9+/=]{20,}$/);
    expect(csp).toContain(`style-src 'self' 'nonce-${nonce ?? ''}'`);
    expect(page.body).toContain(`<meta name="csp-nonce" content="${nonce ?? ''}" />`);
    expect((await raw('GET', '/')).headers['content-security-policy']).not.toBe(csp);

    const favicon = await raw('GET', '/assets/favicon.svg');
    expect([favicon.status, favicon.headers['content-type']]).toEqual([200, 'image/svg+xml']);
    const font = await raw('GET', '/assets/fonts/figtree-latin-wght-normal.woff2');
    expect([font.status, font.headers['content-type']]).toEqual([200, 'font/woff2']);
    for (const probe of [
      '/assets/../package.json',
      '/assets/%2e%2e/package.json',
      '/assets/nope.js',
    ]) {
      expect((await raw('GET', probe)).status).toBe(404);
    }
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

  it('accepts writes from a page opened with any of its loopback names, and no other origin', async () => {
    const port = new URL(dashboard.origin).port;
    const post = (host: string, origin: string) =>
      raw(
        'POST',
        '/api/preview',
        {
          authorization: `Bearer ${dashboard.token}`,
          'content-type': 'application/json',
          host,
          origin,
        },
        '{}',
      );
    expect((await post(`localhost:${port}`, `http://localhost:${port}`)).status).toBe(200);
    expect((await post(`[::1]:${port}`, `http://[::1]:${port}`)).status).toBe(200);
    expect((await post(`127.0.0.1:${port}`, `http://localhost:${port}`)).status).toBe(200);
    // Another port, another scheme or another site is another origin.
    for (const origin of [
      `http://localhost:${Number(port) + 1}`,
      `https://localhost:${port}`,
      `http://attacker.example.com:${port}`,
      'null',
    ])
      expect([origin, (await post(`localhost:${port}`, origin)).status]).toEqual([origin, 403]);
  });

  it('answers on every interface address when it listens on all of them', async () => {
    const network = await createProject('dashboard-network', {
      config: { dashboard: { allowNetworkAccess: true } },
    });
    const server = await startDashboard({
      cwd: network,
      env: {},
      port: 0,
      host: '0.0.0.0',
      watch: false,
    });
    try {
      const port = new URL(server.origin).port;
      const addresses = Object.values(networkInterfaces())
        .flatMap((entries) => entries ?? [])
        .filter((entry) => entry.family === 'IPv4' && !entry.internal)
        .map((entry) => entry.address);
      for (const host of [...addresses, hostname().toLowerCase(), '127.0.0.1']) {
        const authority = `${host}:${port}`;
        const headers = { authorization: `Bearer ${server.token}`, host: authority };
        expect([authority, (await rawTo(server, 'GET', '/api/overview', headers)).status]).toEqual([
          authority,
          200,
        ]);
        const write = await rawTo(
          server,
          'POST',
          '/api/preview',
          { ...headers, 'content-type': 'application/json', origin: `http://${authority}` },
          '{}',
        );
        expect([authority, write.status]).toEqual([authority, 200]);
      }
      // DNS rebinding and cross-site writes are still refused.
      const auth = { authorization: `Bearer ${server.token}` };
      expect(
        (await rawTo(server, 'GET', '/api/overview', { ...auth, host: `evil.example:${port}` }))
          .status,
      ).toBe(421);
      expect(
        (
          await rawTo(
            server,
            'POST',
            '/api/preview',
            { ...auth, 'content-type': 'application/json', origin: `http://evil.example:${port}` },
            '{}',
          )
        ).status,
      ).toBe(403);
    } finally {
      await server.close();
    }
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
      counts: { operations: 15, models: 11, files: 35, tags: 3, deprecated: 1 },
      generation: { status: 'never' },
      config: { output: 'src/generated/api', language: 'typescript', adapter: 'fetch' },
    });
    expect(overview.methods).toEqual({ PUT: 1, POST: 3, GET: 9, DELETE: 2 });
    expect(overview.session).toMatchObject({
      revision: 1,
      watching: [],
      changes: { operations: [], models: [] },
    });
    expect(overview.session.lastReload).toBeUndefined();
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
      'TypeScript',
      'JavaScript (preview)',
      'Declarations (preview)',
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
    expect(preview.id).toMatch(/^[0-9a-f]{64}$/);
    // The preview that was reviewed is required, and only that one is written.
    await expect(api('/api/generate', 'POST', { confirm: true })).rejects.toThrow(/^400/);
    await expect(
      api('/api/generate', 'POST', { confirm: true, preview: '0'.repeat(64) }),
    ).rejects.toThrow(/^409/);
    const result = await api<{ ok: boolean; write: { created: string[] } }>(
      '/api/generate',
      'POST',
      { confirm: true, preview: preview.id },
    );
    expect(result.ok).toBe(true);
    expect(result.write.created).toHaveLength(35);
    const overview = await api<OverviewResponse>('/api/overview');
    expect(overview.generation).toMatchObject({
      status: 'up-to-date',
      manifestFiles: 35,
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
    expect(byName.get('getPetById')?.kind).toBe('operation');
    // Error guards are functions, but not operations: the operation counts must not include them.
    expect(byName.get('isGetPetByIdApiError')?.kind).toBe('error-guard');
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

/** Reads the server-sent event stream of a dashboard. */
function subscribe(server: DashboardServer): {
  next: (match: (event: ServerEvent) => boolean) => Promise<ServerEvent>;
  close: () => void;
} {
  const controller = new AbortController();
  const queue: ServerEvent[] = [];
  const waiting = new Set<() => void>();
  void (async () => {
    const response = await fetch(`${server.origin}/api/events`, {
      headers: { authorization: `Bearer ${server.token}` },
      signal: controller.signal,
    });
    const reader = response.body?.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const chunk = await reader?.read();
      if (chunk === undefined || chunk.done) break;
      buffer += chunk.value;
      let end = buffer.indexOf('\n\n');
      while (end !== -1) {
        const data = buffer
          .slice(0, end)
          .split('\n')
          .find((line) => line.startsWith('data:'));
        buffer = buffer.slice(end + 2);
        if (data !== undefined) queue.push(JSON.parse(data.slice(5)) as ServerEvent);
        for (const wake of waiting) wake();
        end = buffer.indexOf('\n\n');
      }
    }
  })().catch(() => undefined);
  return {
    next: (match) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiting.delete(check);
          reject(new Error(`No matching event; received ${JSON.stringify(queue)}`));
        }, 15_000);
        function check(): void {
          const index = queue.findIndex(match);
          if (index === -1) return;
          const [event] = queue.splice(index, 1);
          clearTimeout(timer);
          waiting.delete(check);
          if (event !== undefined) resolve(event);
        }
        waiting.add(check);
        check();
      }),
    close: () => {
      controller.abort();
    },
  };
}

describe('dashboard live reload', () => {
  let live: DashboardServer;
  let directory: string;
  let original: string;
  let events: ReturnType<typeof subscribe>;
  const spec = (): string => path.join(directory, 'openapi.yaml');
  const edit = async (change: (text: string) => string): Promise<void> => {
    await writeFile(spec(), change(original));
  };

  beforeAll(async () => {
    original = await readFile(fixture('petstore-3.0.yaml'), 'utf8');
    directory = await createProject('dashboard-live', {
      config: { spec: { version: '3.0', input: './openapi.yaml' } },
      files: { 'openapi.yaml': original },
    });
    live = await startDashboard({ cwd: directory, env: {}, port: 0 });
    events = subscribe(live);
    await events.next((event) => event.type === 'hello');
  });

  afterAll(async () => {
    events.close();
    await live.close();
  });

  it('requires the session token for the event stream', async () => {
    expect((await rawTo(live, 'GET', '/api/events')).status).toBe(401);
  });

  it('watches the config and every local document of the specification', async () => {
    const overview = await api<OverviewResponse>('/api/overview', 'GET', undefined, live);
    expect(overview.session.watching).toEqual(['openapi.yaml', 'swaggerz.config.mjs']);
  });

  it('reloads on change and marks new and updated operations until restart', async () => {
    await edit((text) =>
      text
        .replace('summary: Find pet by ID.', 'summary: Find a pet by its ID.')
        .replace(
          'paths:\n',
          [
            'paths:',
            '  /health:',
            '    get:',
            '      operationId: getHealth',
            '      responses:',
            "        '204':",
            '          description: Healthy.',
            '',
          ].join('\n'),
        ),
    );
    const event = await events.next(
      (e) => e.type === 'reload' && e.ok && e.delta?.operations.new === 1,
    );
    expect(event).toMatchObject({
      type: 'reload',
      trigger: 'watch',
      ok: true,
      files: ['openapi.yaml'],
      delta: {
        operations: { new: 1, updated: 1, removed: 0 },
        models: { new: 0, updated: 0, removed: 0 },
      },
    });

    const operations = await api<OperationSummary[]>('/api/operations', 'GET', undefined, live);
    const change = new Map(operations.map((op) => [op.name, op.change]));
    expect(change.get('getHealth')).toBe('new');
    expect(change.get('getPetById')).toBe('updated');
    expect(change.get('addPet')).toBeUndefined();
    const detail = await api<OperationDetail>(
      `/api/operation?key=${encodeURIComponent('get /health')}`,
      'GET',
      undefined,
      live,
    );
    expect(detail.summary.change).toBe('new');

    const overview = await api<OverviewResponse>('/api/overview', 'GET', undefined, live);
    expect(overview.session.lastReload).toMatchObject({
      trigger: 'watch',
      files: ['openapi.yaml'],
    });
    expect(overview.session.changes.operations.map((item) => [item.name, item.change])).toEqual([
      ['getHealth', 'new'],
      ['getPetById', 'updated'],
    ]);
  });

  it('keeps the last version that loaded when a change does not parse', async () => {
    await edit((text) => `${text}\n  /broken: [unclosed\n`);
    const event = await events.next((e) => e.type === 'reload' && !e.ok);
    expect(event).toMatchObject({ trigger: 'watch', files: ['openapi.yaml'] });
    const overview = await api<OverviewResponse>('/api/overview', 'GET', undefined, live);
    expect(overview.session.failure?.diagnostics[0]?.code).toBe('spec/parse-error');
    // The last version that loaded (with getHealth) stays visible.
    expect(overview.counts.operations).toBe(16);
    expect(overview.generation.status).toBe('failed');
    const preview = await api<PreviewResponse>('/api/preview', 'POST', undefined, live);
    expect(preview).toMatchObject({ ok: false, changes: [] });
  });

  it('recovers, reports removed operations and returns to the baseline', async () => {
    await edit((text) => text.replace(/  \/user\/logout:\n(?: {4}.*\n)+/, ''));
    const event = await events.next(
      (e) => e.type === 'reload' && e.ok && (e.delta?.operations.removed ?? 0) > 0,
    );
    // Compared with the last version that loaded: getHealth and logoutUser are gone and
    // getPetById is back to its original summary.
    expect(event).toMatchObject({ delta: { operations: { new: 0, updated: 1, removed: 2 } } });
    const overview = await api<OverviewResponse>('/api/overview', 'GET', undefined, live);
    expect(overview.session.failure).toBeUndefined();
    expect(overview.session.changes.operations).toEqual([
      { id: 'get /user/logout', name: 'logoutUser', label: 'GET /user/logout', change: 'removed' },
    ]);
    expect(
      (
        await rawTo(live, 'GET', `/api/operation?key=${encodeURIComponent('get /user/logout')}`, {
          authorization: `Bearer ${live.token}`,
        })
      ).status,
    ).toBe(404);
  });

  it('refreshes the generation status when the output changes', async () => {
    await edit((text) => text);
    await events.next((e) => e.type === 'reload' && e.ok && e.delta?.operations.new === 1);
    expect(
      (await api<OverviewResponse>('/api/overview', 'GET', undefined, live)).generation.status,
    ).toBe('never');
    // Generated outside the dashboard (the CLI) or from it: only the manifest changes.
    const preview = await api<PreviewResponse>('/api/preview', 'POST', undefined, live);
    await api('/api/generate', 'POST', { confirm: true, preview: preview.id }, live);
    expect(await events.next((e) => e.type === 'output')).toMatchObject({ type: 'output' });
    expect(
      (await api<OverviewResponse>('/api/overview', 'GET', undefined, live)).generation.status,
    ).toBe('up-to-date');
  });
});

describe('dashboard generation', () => {
  const health = [
    'paths:',
    '  /health:',
    '    get:',
    '      operationId: getHealth',
    '      responses:',
    "        '204':",
    '          description: Healthy.',
    '',
  ].join('\n');

  async function setup(name: string, watch: boolean) {
    const original = await readFile(fixture('petstore-3.0.yaml'), 'utf8');
    const directory = await createProject(name, {
      config: { spec: { version: '3.0', input: './openapi.yaml' } },
      files: { 'openapi.yaml': original },
    });
    const server = await startDashboard({ cwd: directory, env: {}, port: 0, watch });
    const output = (file: string) => path.join(directory, 'src/generated/api', file);
    const addHealth = () =>
      writeFile(path.join(directory, 'openapi.yaml'), original.replace('paths:\n', health));
    return { directory, server, output, addHealth };
  }

  it('writes the reviewed preview, not what is on disk now', async () => {
    // Without watching, the dashboard shows the version it loaded; so does what it writes.
    const { server, output, addHealth } = await setup('dashboard-generate-reviewed', false);
    try {
      const preview = await api<PreviewResponse>('/api/preview', 'POST', undefined, server);
      await addHealth();
      const result = await api<{ ok: boolean; write: { created: string[] } }>(
        '/api/generate',
        'POST',
        { confirm: true, preview: preview.id },
        server,
      );
      expect(result.ok).toBe(true);
      expect(result.write.created).toEqual(
        preview.changes.filter((c) => c.kind === 'create').map((c) => c.path),
      );
      await expect(readFile(output('default/get-health.ts'), 'utf8')).rejects.toThrow(/ENOENT/);
    } finally {
      await server.close();
    }
  });

  it('refuses a preview that the specification or the output changed since', async () => {
    const { server, output, addHealth } = await setup('dashboard-generate-outdated', true);
    const events = subscribe(server);
    try {
      await events.next((event) => event.type === 'hello');
      const before = await api<PreviewResponse>('/api/preview', 'POST', undefined, server);
      await addHealth();
      await events.next((e) => e.type === 'reload' && e.ok);
      const refused = await rawTo(
        server,
        'POST',
        '/api/generate',
        { authorization: `Bearer ${server.token}`, 'content-type': 'application/json' },
        JSON.stringify({ confirm: true, preview: before.id }),
      );
      expect(refused.status).toBe(409);
      await expect(readFile(output('client.ts'), 'utf8')).rejects.toThrow(/ENOENT/);

      const after = await api<PreviewResponse>('/api/preview', 'POST', undefined, server);
      expect(after.id).not.toBe(before.id);
      expect(after.changes.map((c) => c.path)).toContain('default/get-health.ts');
      // A file changed in the output directory after the preview: asked again too.
      await mkdir(output(''), { recursive: true });
      await writeFile(output('client.ts'), '// mine\n');
      await expect(
        api('/api/generate', 'POST', { confirm: true, preview: after.id }, server),
      ).rejects.toThrow(/^409/);
      expect(await readFile(output('client.ts'), 'utf8')).toBe('// mine\n');
    } finally {
      events.close();
      await server.close();
    }
  });
});

describe('dashboard live reload of a remote specification', () => {
  it('polls the specification and reloads when it changes', async () => {
    let spec = await readFile(fixture('petstore-3.0.yaml'), 'utf8');
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/yaml' });
      res.end(spec);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/openapi.yaml`;
    const directory = await createProject('dashboard-remote', {
      config: { spec: { version: '3.0', input: url, fetch: { poll: 500 } } },
    });
    const remoteDashboard = await startDashboard({ cwd: directory, env: {}, port: 0 });
    const stream = subscribe(remoteDashboard);
    try {
      await stream.next((event) => event.type === 'hello');
      const overview = await api<OverviewResponse>(
        '/api/overview',
        'GET',
        undefined,
        remoteDashboard,
      );
      expect(overview.session.watching).toEqual(['swaggerz.config.mjs', url]);
      spec = spec.replace('operationId: logoutUser', 'operationId: signOut');
      const event = await stream.next((e) => e.type === 'reload' && e.ok);
      // Operations are identified by method and path, so a new operationId is an update.
      expect(event).toMatchObject({
        trigger: 'watch',
        files: [url],
        delta: { operations: { new: 0, updated: 1, removed: 0 } },
      });
    } finally {
      stream.close();
      await remoteDashboard.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe('dashboard with an unreachable remote specification', () => {
  it('reports a polled document that cannot be fetched, and its recovery', async () => {
    const spec = await readFile(fixture('petstore-3.0.yaml'), 'utf8');
    let down = false;
    const server = createServer((_req, res) => {
      if (down) {
        res.writeHead(503).end();
        return;
      }
      res.writeHead(200, { 'content-type': 'application/yaml' });
      res.end(spec);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/openapi.yaml`;
    const directory = await createProject('dashboard-unreachable', {
      config: { spec: { version: '3.0', input: url, fetch: { poll: 500 } } },
    });
    const remoteDashboard = await startDashboard({ cwd: directory, env: {}, port: 0 });
    const stream = subscribe(remoteDashboard);
    try {
      await stream.next((event) => event.type === 'hello');
      down = true;
      expect(await stream.next((e) => e.type === 'remote' && !e.reachable)).toMatchObject({
        url,
        error: 'HTTP 503 Service Unavailable',
      });
      const failing = await api<OverviewResponse>(
        '/api/overview',
        'GET',
        undefined,
        remoteDashboard,
      );
      expect(failing.session.unreachable).toEqual([
        { url, error: 'HTTP 503 Service Unavailable', since: expect.any(String) as string },
      ]);
      // The last version that loaded stays visible.
      expect(failing.counts.operations).toBe(15);
      down = false;
      expect(await stream.next((e) => e.type === 'remote' && e.reachable)).toMatchObject({ url });
      const recovered = await api<OverviewResponse>(
        '/api/overview',
        'GET',
        undefined,
        remoteDashboard,
      );
      expect(recovered.session.unreachable).toBeUndefined();
    } finally {
      stream.close();
      await remoteDashboard.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe('dashboard with an OpenAPI 3.2 specification', () => {
  it('shows nested tags, QUERY and additional methods, and querystring parameters', async () => {
    const directory = await createProject('dashboard-32', {
      config: { spec: { version: '3.2', input: fixture('features-3.2.yaml') } },
    });
    const dashboard32 = await startDashboard({ cwd: directory, env: {}, port: 0, watch: false });
    try {
      const overview = await api<OverviewResponse>('/api/overview', 'GET', undefined, dashboard32);
      expect(overview.specVersion).toBe('OpenAPI 3.2');
      expect(overview.methods).toMatchObject({ QUERY: 1, COPY: 1 });
      expect(overview.tags.map((tag) => [tag.name, tag.depth, tag.count, tag.kind])).toEqual([
        ['admin', 0, 2, 'audience'],
        ['documents', 0, 3, 'nav'],
        ['pets', 0, 2, 'nav'],
        ['cats', 1, 1, 'nav'],
      ]);
      const operations = await api<OperationSummary[]>(
        '/api/operations',
        'GET',
        undefined,
        dashboard32,
      );
      const getPet = operations.find((op) => op.name === 'getPet');
      expect(getPet).toMatchObject({ tags: ['cats'], tagAncestors: ['pets'] });
      expect(operations.find((op) => op.name === 'copyDocument')?.method).toBe('COPY');
      const detail = await api<OperationDetail>(
        `/api/operation?key=${encodeURIComponent('get /pets')}`,
        'GET',
        undefined,
        dashboard32,
      );
      expect(detail.operation.parameters[0]).toMatchObject({
        in: 'querystring',
        contentType: 'application/x-www-form-urlencoded',
      });
      expect(detail.typeNames.errorGuard).toBe('isListPetsApiError');
    } finally {
      await dashboard32.close();
    }
  });
});
