import { spawn } from 'node:child_process';
import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client as LegacyClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport as LegacyStdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  ElicitRequestSchema,
  ResourceUpdatedNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { REPO_ROOT } from '../../helpers.ts';
import { createProject } from '../../support/project.ts';

/**
 * `swaggerz mcp` driven over stdio by the official MCP SDK clients: v2 (protocol 2026-07-28,
 * stateless) and v1 (2025-11-25, the `initialize` handshake).
 */
const BIN = path.join(REPO_ROOT, 'src', 'cli', 'bin.ts');
const server = (directory: string, ...flags: string[]) => ({
  command: process.execPath,
  args: [BIN, 'mcp', ...flags],
  cwd: directory,
  env: { ...process.env, NO_COLOR: '1' } as Record<string, string>,
  stderr: 'pipe' as const,
});

const closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
});

interface ToolResult {
  content: { type: string; text?: string }[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}
const json = (result: unknown): Record<string, unknown> =>
  JSON.parse((result as ToolResult).content[0]?.text ?? 'null') as Record<string, unknown>;

async function project(name: string): Promise<string> {
  return createProject(name, {
    spec: 'petstore-3.0.yaml',
    config: { features: { query: true } },
    files: {
      'openapi.yaml': await readFile(
        path.join(REPO_ROOT, 'fixtures/specs/petstore-3.0.yaml'),
        'utf8',
      ),
      'src/app.ts':
        "import { getPetById } from './generated/api/index.js';\nexport const pet = getPetById({ petId: 1 });\n",
    },
  });
}

/** Points the project at its own copy of the specification, so tests can edit it. */
async function useLocalSpec(directory: string): Promise<string> {
  const config = path.join(directory, 'swaggerz.config.mjs');
  const text = await readFile(config, 'utf8');
  await writeFile(config, text.replace(/"input": "[^"]+"/, '"input": "./openapi.yaml"'));
  return path.join(directory, 'openapi.yaml');
}

describe('MCP 2026-07-28 (SDK v2)', () => {
  async function connect(directory: string, ...flags: string[]): Promise<Client> {
    const client = new Client(
      { name: 'test', version: '1.0.0' },
      { versionNegotiation: { mode: 'auto' }, capabilities: { elicitation: {} } },
    );
    await client.connect(new StdioClientTransport(server(directory, ...flags)));
    closers.push(() => client.close());
    return client;
  }

  it('negotiates the stateless revision and serves the tools', async () => {
    const directory = await project('mcp-modern');
    const client = await connect(directory);
    expect(client.getNegotiatedProtocolVersion()).toBe('2026-07-28');
    expect(client.getInstructions()).toContain('find_operations');

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual([
      'api_overview',
      'find_operations',
      'get_operation',
      'get_model',
      'check',
      'preview_generation',
      'find_usages',
    ]);
    expect(tools.every((t) => t.annotations?.readOnlyHint === true)).toBe(true);

    const overview = json(await client.callTool({ name: 'api_overview', arguments: {} }));
    expect(overview).toMatchObject({
      title: 'Swagger Petstore - OpenAPI 3.0',
      output: { directory: 'src/generated/api', hooks: { library: 'React Query' } },
      generation: { status: 'never' },
    });

    const found = json(
      await client.callTool({ name: 'find_operations', arguments: { query: 'pet by id' } }),
    );
    expect((found.operations as { name: string }[])[0]).toMatchObject({
      name: 'getPetById',
      method: 'GET',
      path: '/pet/{petId}',
      import: "import { getPetById } from './src/generated/api/index.js';",
    });

    const operation = json(
      await client.callTool({ name: 'get_operation', arguments: { name: 'GET /pet/{petId}' } }),
    );
    expect(operation).toMatchObject({
      name: 'getPetById',
      example: 'const result = await getPetById({ petId: 10 });',
      errors: { guard: 'isGetPetByIdApiError' },
      hooks: { library: 'React Query' },
      specification: { summary: 'Find pet by ID.' },
    });
    expect(operation.declaration).toContain('export declare function getPetById(');

    const model = json(await client.callTool({ name: 'get_model', arguments: { name: 'Pet' } }));
    expect(model).toMatchObject({
      name: 'Pet',
      import: "import type { Pet } from './src/generated/api/index.js';",
    });
    expect(model.usedBy).toContain('getPetById');

    const missing = (await client.callTool({
      name: 'get_operation',
      arguments: { name: 'getPetByID2' },
    })) as ToolResult;
    expect(missing.isError).toBe(true);
    expect(json(missing).error).toContain('Did you mean "getPetById"?');

    const check = json(await client.callTool({ name: 'check', arguments: {} }));
    expect(check).toMatchObject({ ok: true, generation: { status: 'never' } });

    const preview = json(await client.callTool({ name: 'preview_generation', arguments: {} }));
    expect((preview.summary as Record<string, number>).create).toBeGreaterThan(10);
    const diff = json(
      await client.callTool({ name: 'preview_generation', arguments: { file: 'client.ts' } }),
    );
    expect(diff.diff).toContain('+++ b/client.ts');

    // Usage scanning resolves the application's imports to the generated files.
    await new Promise((resolve) => {
      spawn(process.execPath, [BIN, 'generate'], { cwd: directory }).on('close', resolve);
    });
    const usages = json(
      await client.callTool({ name: 'find_usages', arguments: { name: 'getPetById' } }),
    );
    expect((usages.exports as { status: string; locations: string[] }[])[0]).toMatchObject({
      status: 'used',
      locations: [expect.stringContaining('src/app.ts:1') as string],
    });
  });

  it('serves operations and models as resources', async () => {
    const client = await connect(await project('mcp-resources'));
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toEqual(
      expect.arrayContaining([
        'swaggerz://overview',
        'swaggerz://operations/getPetById',
        'swaggerz://models/Pet',
      ]),
    );
    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates.map((t) => t.uriTemplate)).toContain('swaggerz://operations/{name}');
    const read = await client.readResource({ uri: 'swaggerz://operations/getPetById' });
    const content = read.contents[0] as { text: string; mimeType: string };
    expect(content.mimeType).toBe('application/json');
    expect(JSON.parse(content.text)).toMatchObject({ name: 'getPetById' });
    await expect(client.readResource({ uri: 'swaggerz://models/Nope' })).rejects.toThrow(
      /not found/,
    );
  });

  it('notifies listeners when the specification changes', async () => {
    const directory = await project('mcp-listen');
    const spec = await useLocalSpec(directory);
    const client = await connect(directory);
    const changed = vi.fn<(notification: unknown) => void>();
    client.setNotificationHandler('notifications/resources/list_changed', changed);
    const subscription = await client.listen({ resourcesListChanged: true });
    expect(subscription.honoredFilter).toMatchObject({ resourcesListChanged: true });
    const text = await readFile(spec, 'utf8');
    await writeFile(spec, text.replace('operationId: getPetById', 'operationId: fetchPet'));
    await vi.waitFor(
      () => {
        expect(changed).toHaveBeenCalled();
      },
      { timeout: 15_000 },
    );
    const found = json(
      await client.callTool({ name: 'find_operations', arguments: { query: 'fetch' } }),
    );
    expect((found.operations as { name: string }[]).map((o) => o.name)).toContain('fetchPet');
    await subscription.close();
  });

  it('asks for confirmation before generate writes, and only offers it with --allow-write', async () => {
    const directory = await project('mcp-generate');
    const readOnly = await connect(directory);
    expect((await readOnly.listTools()).tools.some((t) => t.name === 'generate')).toBe(false);

    const client = await connect(directory, '--allow-write');
    let answer: 'accept' | 'decline' = 'decline';
    const asked = vi.fn<(params: unknown) => void>();
    client.setRequestHandler('elicitation/create', (request) => {
      asked(request.params);
      return Promise.resolve(
        answer === 'accept'
          ? { action: 'accept', content: { confirm: true } }
          : { action: 'decline' },
      );
    });
    const declined = json(await client.callTool({ name: 'generate', arguments: {} }));
    expect(declined).toMatchObject({ ok: false, written: false });
    expect(asked).toHaveBeenCalledTimes(1);
    expect(asked.mock.calls[0]?.[0]).toMatchObject({
      message: expect.stringContaining('Write the generated client') as string,
    });
    await expect(access(path.join(directory, 'src/generated/api/index.ts'))).rejects.toThrow(
      /ENOENT/,
    );

    answer = 'accept';
    const written = json(await client.callTool({ name: 'generate', arguments: {} }));
    expect(written).toMatchObject({ ok: true, written: true });
    await access(path.join(directory, 'src/generated/api/index.ts'));
    const again = json(await client.callTool({ name: 'generate', arguments: {} }));
    expect(again).toMatchObject({ ok: true, written: false });
  });
});

describe('MCP 2025-11-25 (SDK v1)', () => {
  async function connect(directory: string, ...flags: string[]): Promise<LegacyClient> {
    const client = new LegacyClient(
      { name: 'legacy', version: '1.0.0' },
      { capabilities: { elicitation: {} } },
    );
    await client.connect(new LegacyStdioClientTransport(server(directory, ...flags)));
    closers.push(() => client.close());
    return client;
  }

  it('initializes and serves the same tools and resources', async () => {
    const client = await connect(await project('mcp-legacy'));
    expect(client.getServerVersion()?.name).toBe('swaggerz');
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('get_operation');
    const operation = json(
      await client.callTool({ name: 'get_operation', arguments: { name: 'addPet' } }),
    );
    // Examples from the specification fill the placeholders when there are some.
    expect(operation.example).toBe(
      "const result = await addPet({ body: { name: 'doggie', photoUrls: ['…'] } });",
    );
    const read = await client.readResource({ uri: 'swaggerz://models/Pet' });
    expect(JSON.parse((read.contents[0] as { text: string }).text)).toMatchObject({ name: 'Pet' });
  });

  it('sends resource updates to subscribers', async () => {
    const directory = await project('mcp-legacy-subscribe');
    const spec = await useLocalSpec(directory);
    const client = await connect(directory);
    const updated = vi.fn<(uri: string) => void>();
    client.setNotificationHandler(ResourceUpdatedNotificationSchema, (notification) => {
      updated(notification.params.uri);
      return Promise.resolve();
    });
    await client.readResource({ uri: 'swaggerz://operations/getPetById' });
    await client.subscribeResource({ uri: 'swaggerz://operations/getPetById' });
    await client.subscribeResource({ uri: 'swaggerz://models/User' });
    const text = await readFile(spec, 'utf8');
    await writeFile(spec, text.replace('summary: Find pet by ID.', 'summary: Look up a pet.'));
    await vi.waitFor(
      () => {
        expect(updated).toHaveBeenCalledWith('swaggerz://operations/getPetById');
      },
      { timeout: 15_000 },
    );
    // Only resources whose content changed are reported.
    expect(updated).not.toHaveBeenCalledWith('swaggerz://models/User');
  });

  it('confirms generate with an elicitation request', async () => {
    const directory = await project('mcp-legacy-generate');
    const client = await connect(directory, '--allow-write');
    client.setRequestHandler(ElicitRequestSchema, () =>
      Promise.resolve({ action: 'accept', content: { confirm: true } }),
    );
    const written = json(await client.callTool({ name: 'generate', arguments: {} }));
    expect(written).toMatchObject({ ok: true, written: true });
    await access(path.join(directory, 'src/generated/api/index.ts'));
  });
});

describe('MCP protocol details', () => {
  /** Sends raw lines and collects the response lines. */
  async function exchange(
    directory: string,
    messages: readonly unknown[],
  ): Promise<Record<string, unknown>[]> {
    const child = spawn(process.execPath, [BIN, 'mcp', '--no-watch'], { cwd: directory });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    // Strings are sent as they are (to send invalid JSON), everything else as JSON.
    child.stdin.end(
      messages.map((m) => (typeof m === 'string' ? m : JSON.stringify(m))).join('\n') + '\n',
    );
    await new Promise((resolve) => child.on('close', resolve));
    return output
      .trim()
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  }

  it('rejects unsupported versions, requests without metadata and unknown methods', async () => {
    const directory = await project('mcp-raw');
    const meta = (version: string) => ({
      'io.modelcontextprotocol/protocolVersion': version,
      'io.modelcontextprotocol/clientCapabilities': {},
    });
    const responses = await exchange(directory, [
      { jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: meta('1900-01-01') } },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { jsonrpc: '2.0', id: 3, method: 'prompts/list', params: { _meta: meta('2026-07-28') } },
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/list',
        params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } },
      },
      { jsonrpc: '2.0', id: 5, method: 'tools/list', params: { _meta: meta('2026-07-28') } },
      'not json',
    ]);
    const byId = (id: number) => responses.find((r) => r.id === id);
    expect(byId(1)?.error).toMatchObject({
      code: -32022,
      data: { supported: ['2026-07-28'], requested: '1900-01-01' },
    });
    expect(byId(2)?.error).toMatchObject({ code: -32600 });
    expect(byId(3)?.error).toMatchObject({ code: -32601 });
    expect(byId(4)?.error).toMatchObject({ code: -32602 });
    expect(byId(5)?.result).toMatchObject({
      resultType: 'complete',
      ttlMs: 0,
      cacheScope: 'private',
      _meta: { 'io.modelcontextprotocol/serverInfo': { name: 'swaggerz' } },
    });
    expect(responses.some((r) => (r.error as { code?: number } | undefined)?.code === -32700)).toBe(
      true,
    );
  });
});
