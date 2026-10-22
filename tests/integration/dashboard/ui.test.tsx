// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ModelSummary,
  OperationDetail,
  OperationSummary,
  OverviewResponse,
  SchemaIR,
} from '../../../src/service/types.ts';
import { App } from '../../../src/dashboard/client/app.tsx';
import {
  ChangeBadge,
  describeDelta,
  reloadToast,
} from '../../../src/dashboard/client/components/change.tsx';
import { DiagnosticsList } from '../../../src/dashboard/client/components/diagnostics.tsx';
import { SchemaView } from '../../../src/dashboard/client/components/schema.tsx';
import { Overview } from '../../../src/dashboard/client/pages/overview.tsx';

const HOSTILE = '<img src=x onerror="alert(1)"><script>alert(2)</script>';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  location.hash = '';
});

const overview: OverviewResponse = {
  title: `API ${HOSTILE}`,
  version: '1.0.0',
  description: `First paragraph ${HOSTILE}\n\nSecond paragraph`,
  specVersion: 'OpenAPI 3.1',
  specVersionRaw: '3.1.0',
  servers: ['https://api.example.com'],
  config: {
    input: 'openapi.yaml',
    output: 'src/api',
    language: 'typescript',
    adapter: 'fetch',
    validation: 'Zod',
  },
  counts: { operations: 1, models: 1, files: 10, tags: 1, deprecated: 0 },
  methods: { GET: 1 },
  tags: [{ name: 'pets', count: 1, depth: 0, description: HOSTILE }],
  diagnostics: [
    {
      code: 'schema/unsupported-keyword',
      severity: 'warning',
      message: `Ignored ${HOSTILE}`,
      hint: HOSTILE,
    },
  ],
  generation: { status: 'stale', manifestFiles: 10, staleFiles: 2 },
  timings: { parse: 1 },
  session: {
    startedAt: '2026-10-20T10:00:00.000Z',
    revision: 1,
    watching: ['openapi.yaml', 'swaggerz.config.ts'],
    changes: { operations: [], models: [] },
  },
};

const operation: OperationSummary = {
  key: 'get /pets/{petId}',
  name: 'getPet',
  method: 'GET',
  path: '/pets/{petId}',
  operationId: 'getPet',
  tags: ['pets'],
  deprecated: false,
  module: 'pets/get-pet',
  auth: [],
  models: ['Pet'],
};

const model: ModelSummary = {
  id: '#/components/schemas/Pet',
  name: 'Pet',
  kind: 'object (1 property)',
  module: 'models/pet',
  used: true,
  usedBy: 1,
  recursive: false,
  deprecated: false,
};

const detail: OperationDetail = {
  summary: operation,
  operation: {
    key: operation.key,
    operationId: 'getPet',
    method: 'get',
    path: operation.path,
    summary: 'Returns a pet.',
    tags: ['pets'],
    deprecated: false,
    parameters: [
      {
        name: 'petId',
        in: 'path',
        required: true,
        deprecated: false,
        schema: { kind: 'string' },
        style: 'simple',
        explode: false,
        allowReserved: false,
        examples: [],
        extensions: {},
        source: { file: 'openapi.yaml', pointer: '/paths' },
      },
    ],
    responses: [],
    extensions: {},
    source: { file: 'openapi.yaml', pointer: '/paths' },
  },
  typeNames: { params: 'GetPetParams' },
  hooks: [],
  request: {},
  security: [],
  dependencies: [{ id: model.id, name: 'Pet', chain: ['Pet'] }],
  code: [
    {
      label: 'TypeScript',
      path: 'pets/get-pet.ts',
      language: 'typescript',
      content: 'export function getPet() {}\n',
    },
  ],
  source: { file: 'openapi.yaml', pointer: '/paths/~1pets~1{petId}/get', line: 3 },
};

describe('dashboard UI rendering', () => {
  it('renders specification text as inert text', () => {
    const { container } = render(<Overview data={overview} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(container.querySelectorAll('.prose p')).toHaveLength(2);
    expect(container.textContent).toContain('2 files differ');
    // The generation card lists the enabled features.
    expect(screen.getByText('Zod')).toBeTruthy();
    expect(screen.queryByText('React Query')).toBeNull();
  });

  it('filters diagnostics by severity', () => {
    const { container } = render(
      <DiagnosticsList
        diagnostics={[
          { code: 'a/error', severity: 'error', message: 'Broken' },
          { code: 'a/warning', severity: 'warning', message: 'Careful' },
        ]}
      />,
    );
    expect(container.querySelectorAll('.diagnostic')).toHaveLength(2);
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Errors/ }), { button: 0 });
    expect(container.querySelectorAll('.diagnostic')).toHaveLength(1);
    expect(container.textContent).toContain('Broken');
  });

  it('renders schemas with links to referenced models', () => {
    const schema: SchemaIR = {
      kind: 'object',
      properties: [
        { name: 'id', required: true, schema: { kind: 'integer', format: 'int64' } },
        {
          name: 'owner',
          required: false,
          schema: { kind: 'ref', target: '#/components/schemas/User', nullable: true },
        },
        {
          name: 'tags',
          required: false,
          schema: { kind: 'array', items: { kind: 'string' }, description: HOSTILE },
        },
      ],
    };
    const { container } = render(
      <SchemaView schema={schema} names={new Map([['#/components/schemas/User', 'User']])} />,
    );
    const link = container.querySelector('a.model-link');
    expect(link?.textContent).toBe('User');
    expect(link?.getAttribute('href')).toBe('#/models/%23%2Fcomponents%2Fschemas%2FUser');
    expect(container.querySelector('.required')).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('live reload marks', () => {
  it('labels new, updated and removed items', () => {
    const { container } = render(
      <>
        <ChangeBadge change="new" />
        <ChangeBadge change="updated" />
        <ChangeBadge change="removed" />
        <ChangeBadge change={undefined} />
      </>,
    );
    expect(container.textContent).toBe(
      'New since the dashboard startedUpdated since the dashboard startedRemoved since the dashboard started',
    );
  });

  it('describes reloads in notifications', () => {
    const delta = {
      operations: { new: 2, updated: 1, removed: 0 },
      models: { new: 0, updated: 0, removed: 1 },
    };
    expect(describeDelta(delta)).toEqual([
      '2 new operations',
      '1 updated operation',
      '1 removed model',
    ]);
    expect(
      reloadToast({
        type: 'reload',
        revision: 2,
        trigger: 'watch',
        files: ['openapi.yaml'],
        ok: true,
        delta,
      }),
    ).toEqual({
      tone: 'success',
      title: '2 new operations, 1 updated operation, 1 removed model',
      description: 'openapi.yaml changed',
    });
    expect(
      reloadToast({
        type: 'reload',
        revision: 3,
        trigger: 'manual',
        files: [],
        ok: false,
        error: 'Bad',
      }),
    ).toMatchObject({
      tone: 'danger',
      description: expect.stringContaining('Reloaded from disk: Bad'),
    });
  });

  it('shows what changed since the dashboard started on the overview', () => {
    const { container } = render(
      <Overview
        data={{
          ...overview,
          session: {
            ...overview.session,
            lastReload: {
              at: '2026-10-20T10:05:00.000Z',
              trigger: 'watch',
              files: ['openapi.yaml'],
            },
            changes: {
              operations: [
                { id: 'get /health', name: 'getHealth', label: 'GET /health', change: 'new' },
              ],
              models: [{ id: '#/components/schemas/Old', name: 'Old', change: 'removed' }],
            },
          },
        }}
      />,
    );
    expect(screen.getByText('Changes since the dashboard started')).toBeDefined();
    const health = screen.getByText('/health').closest('a');
    expect(health?.getAttribute('href')).toBe('#/operations/get%20%2Fhealth');
    // Removed items are listed but not linked.
    expect(screen.getByText('Old').closest('a')).toBeNull();
    expect(container.textContent).toContain('(openapi.yaml)');
  });
});

describe('dashboard app shell', () => {
  it('loads data, navigates to an operation and searches with the command palette', async () => {
    const responses: Record<string, unknown> = {
      '/api/overview': overview,
      '/api/operations': [operation],
      '/api/models': [model],
      [`/api/operation?key=${encodeURIComponent(operation.key)}`]: detail,
    };
    const requests: { path: string; authorization: string | null }[] = [];
    vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
      requests.push({ path: input, authorization: new Headers(init.headers).get('authorization') });
      const body = responses[input];
      return new Response(JSON.stringify(body ?? { error: 'not found' }), {
        status: body === undefined ? 404 : 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    sessionStorage.setItem('swaggerz-dashboard-token', 'secret');
    const { initToken } = await import('../../../src/dashboard/client/api.ts');
    initToken();

    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: /^API / })).toBeDefined();
    expect(requests.every((r) => r.authorization === 'Bearer secret')).toBe(true);

    await act(async () => {
      location.hash = `#/operations/${encodeURIComponent(operation.key)}`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(await screen.findByRole('heading', { level: 1, name: '/pets/{petId}' })).toBeDefined();
    expect(screen.getByText('Returns a pet.')).toBeDefined();
    expect(screen.getAllByText('petId').length).toBeGreaterThan(0);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'pet' } });
    await waitFor(() => {
      expect(within(dialog).getByText('Pet')).toBeDefined();
    });
    expect(within(dialog).getByText('/pets/{petId}')).toBeDefined();
  });

  it('refetches and marks changes when the server reports a reload', async () => {
    let reloaded = false;
    let emit: ((event: object) => void) | undefined;
    vi.stubGlobal('fetch', async (input: string) => {
      if (input === '/api/events') {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const encoder = new TextEncoder();
            emit = (event) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            };
            emit({ type: 'hello', revision: 1 });
          },
        });
        return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
      }
      const added: OperationSummary = {
        ...operation,
        key: 'get /health',
        name: 'getHealth',
        path: '/health',
        change: 'new',
      };
      const body = {
        '/api/overview': overview,
        '/api/operations': reloaded ? [operation, added] : [operation],
        '/api/models': [model],
      }[input];
      return new Response(JSON.stringify(body ?? { error: 'not found' }), {
        status: body === undefined ? 404 : 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    sessionStorage.setItem('swaggerz-dashboard-token', 'secret');
    const { initToken } = await import('../../../src/dashboard/client/api.ts');
    initToken();
    location.hash = '#/operations';

    render(<App />);
    expect(await screen.findByText('/pets/{petId}')).toBeDefined();
    await waitFor(() => {
      expect(screen.getByText('Live reload')).toBeDefined();
    });
    expect(screen.queryByText('/health')).toBeNull();

    reloaded = true;
    await act(async () => {
      emit?.({
        type: 'reload',
        revision: 2,
        trigger: 'watch',
        files: ['openapi.yaml'],
        ok: true,
        delta: {
          operations: { new: 1, updated: 0, removed: 0 },
          models: { new: 0, updated: 0, removed: 0 },
        },
      });
    });
    expect(await screen.findByText('1 new operation')).toBeDefined();
    expect(await screen.findByText('/health')).toBeDefined();
    expect(screen.getAllByText('New').length).toBeGreaterThan(0);
  });
});
