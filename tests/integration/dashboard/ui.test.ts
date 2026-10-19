// @vitest-environment happy-dom
import { h, render, type ComponentChild } from 'preact';
import { afterEach, describe, expect, it } from 'vitest';
import type { OverviewResponse, SchemaIR } from '../../../src/dashboard/api-types.ts';
import { Overview } from '../../../src/dashboard/client/components/overview.tsx';
import { DiagnosticsList, SchemaView } from '../../../src/dashboard/client/components/ui.tsx';

const HOSTILE = '<img src=x onerror="alert(1)"><script>alert(2)</script>';

function mount(node: ComponentChild): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  render(node, container);
  return container;
}

afterEach(() => {
  document.body.innerHTML = '';
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
    reactQuery: false,
  },
  counts: { operations: 3, models: 2, files: 10, tags: 1, deprecated: 0 },
  methods: { GET: 2, POST: 1 },
  tags: [{ name: 'pets', count: 3, description: HOSTILE }],
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
};

describe('dashboard UI rendering', () => {
  it('renders specification text as inert text', () => {
    const container = mount(h(Overview, { data: overview }));
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(container.querySelectorAll('.prose p')).toHaveLength(2);
    expect(container.textContent).toContain('2 files differ');
  });

  it('filters diagnostics by severity', () => {
    const container = mount(
      h(DiagnosticsList, {
        diagnostics: [
          { code: 'a/error', severity: 'error', message: 'Broken' },
          { code: 'a/warning', severity: 'warning', message: 'Careful' },
        ],
      }),
    );
    expect(container.querySelectorAll('.diagnostic')).toHaveLength(2);
    const errorsTab = [...container.querySelectorAll('button')].find((b) =>
      b.textContent.startsWith('Errors'),
    );
    errorsTab?.click();
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(container.querySelectorAll('.diagnostic')).toHaveLength(1);
        expect(container.textContent).toContain('Broken');
        resolve();
      }, 0);
    });
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
    const container = mount(
      h(SchemaView, { schema, names: new Map([['#/components/schemas/User', 'User']]) }),
    );
    const link = container.querySelector('a.model-link');
    expect(link?.textContent).toBe('User');
    expect(link?.getAttribute('href')).toBe('#/models/%23%2Fcomponents%2Fschemas%2FUser');
    expect(container.querySelector('.required')).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
});
