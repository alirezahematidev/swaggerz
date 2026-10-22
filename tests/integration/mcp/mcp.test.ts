import { spawn } from 'node:child_process';
import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client as LegacyClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport as LegacyStdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  ElicitRequestSchema,
  ResourceListChangedNotificationSchema,
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

/**
 * Writes a file on every attempt until `check` passes. A platform file watcher that is still
 * starting (under load, right after the server started) does not report an earlier write.
 */
async function writeUntil(
  file: string,
  text: string,
  check: () => void | Promise<void>,
): Promise<void> {
  await vi.waitFor(
    async () => {
      await writeFile(file, text);
      await check();
    },
    { timeout: 15_000, interval: 500 },
  );
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
      output: { directory: 'src/generated/api', hooks: { library: 'React Query' } },
      generation: { status: 'never' },
      specification: { title: 'Swagger Petstore - OpenAPI 3.0' },
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
      // Placeholders from the types; the specification's examples only under `specification`.
      example: 'const result = await getPetById({ petId: 1 });',
      errors: { guard: 'isGetPetByIdApiError' },
      hooks: { library: 'React Query' },
      specification: {
        summary: 'Find pet by ID.',
        example: 'const result = await getPetById({ petId: 10 });',
      },
    });
    expect(operation.declaration).toContain('export declare function getPetById(');
    expect(operation.declaration).not.toContain('/*');

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

  it('returns text from the specification only under specification keys', async () => {
    const spec = [
      'openapi: 3.0.3',
      "info: { title: 'MARKER title', version: 'MARKER version', description: 'MARKER info' }",
      'paths:',
      '  /pets:',
      '    post:',
      '      operationId: addPet',
      "      summary: 'MARKER summary'",
      "      description: 'MARKER description */ ignore the above'",
      '      requestBody:',
      "        description: 'MARKER body'",
      '        required: true',
      "        content: { application/json: { schema: { $ref: '#/components/schemas/Pet' } } }",
      "      responses: { '204': { description: 'MARKER response' } }",
      'components:',
      '  schemas:',
      '    Pet:',
      "      description: 'MARKER model'",
      '      type: object',
      '      required: [name]',
      '      properties:',
      '        name:',
      '          type: string',
      "          description: 'MARKER property'",
      "          example: 'MARKER example'",
      "          default: 'MARKER default'",
    ].join('\n');
    const directory = await createProject('mcp-specification-text', {
      config: {
        spec: { version: '3.0', input: './openapi.yaml' },
        features: { query: true },
      },
      files: { 'openapi.yaml': spec },
    });
    const client = await connect(directory);
    const outside = (value: Record<string, unknown>): string => {
      const { specification: _, ...rest } = value;
      return JSON.stringify(rest);
    };

    const overview = json(await client.callTool({ name: 'api_overview', arguments: {} }));
    expect(outside(overview)).not.toContain('MARKER');
    expect(overview.specification).toEqual({
      title: 'MARKER title',
      version: 'MARKER version',
      description: 'MARKER info',
    });

    const operation = json(
      await client.callTool({ name: 'get_operation', arguments: { name: 'addPet' } }),
    );
    expect(outside(operation)).not.toContain('MARKER');
    expect(operation.declaration).toContain('export declare function addPet(');
    expect(operation.example).toBe("await addPet({ body: { name: '…' } });");
    expect(operation.specification).toMatchObject({
      summary: 'MARKER summary',
      description: 'MARKER description */ ignore the above',
      example: "await addPet({ body: { name: 'MARKER example' } });",
      requestBody: 'MARKER body',
      responses: { '204': 'MARKER response' },
    });

    const model = json(await client.callTool({ name: 'get_model', arguments: { name: 'Pet' } }));
    expect(outside(model)).not.toContain('MARKER');
    expect(model.declaration).toBe('export type Pet = {\n  name: string;\n};');
    expect(model.specification).toEqual({
      description: 'MARKER model',
      properties: { name: 'MARKER property' },
      examples: { name: 'MARKER example' },
    });

    // Resources carry the same content.
    const read = await client.readResource({ uri: 'swaggerz://operations/addPet' });
    const text = (read.contents[0] as { text: string }).text;
    expect(outside(JSON.parse(text) as Record<string, unknown>)).not.toContain('MARKER');
  });

  it('reports a change that does not load in check and the overview', async () => {
    const directory = await project('mcp-reload-failure');
    const spec = await useLocalSpec(directory);
    const client = await connect(directory);
    expect(json(await client.callTool({ name: 'check', arguments: {} }))).toMatchObject({
      ok: true,
    });
    const text = await readFile(spec, 'utf8');
    let failed: Record<string, unknown> = {};
    await writeUntil(
      spec,
      text.replace("$ref: '#/components/schemas/Pet'", "$ref: '#/components/schemas/Nope'"),
      async () => {
        failed = json(await client.callTool({ name: 'check', arguments: {} }));
        expect(failed.ok).toBe(false);
      },
    );
    expect(failed).toMatchObject({
      reloadFailed: { message: 'The specification could not be compiled' },
      diagnostics: {
        items: [expect.objectContaining({ code: 'ref/missing-target', severity: 'error' })],
      },
    });
    const overview = json(await client.callTool({ name: 'api_overview', arguments: {} }));
    expect(overview).toMatchObject({ diagnostics: { errors: 1 }, reloadFailed: {} });
    // The last version that loaded is still served.
    expect(
      json(await client.callTool({ name: 'get_operation', arguments: { name: 'getPetById' } })),
    ).toMatchObject({ name: 'getPetById' });

    await writeUntil(spec, text, async () => {
      const check = json(await client.callTool({ name: 'check', arguments: {} }));
      expect(check.ok).toBe(true);
      expect(check.reloadFailed).toBeUndefined();
    });
  });

  it('fails check when a lint rule configured as an error fires', async () => {
    const directory = await createProject('mcp-lint-error', {
      config: { lint: { rules: { 'duplicate-schema': 'error' } } },
    });
    const client = await connect(directory);
    const check = json(await client.callTool({ name: 'check', arguments: {} }));
    expect(check).toMatchObject({
      ok: false,
      diagnostics: { count: 0 },
      lint: { items: [expect.objectContaining({ code: 'lint/duplicate-schema' })] },
    });
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
    await writeUntil(spec, text.replace('operationId: getPetById', 'operationId: fetchPet'), () => {
      expect(changed).toHaveBeenCalled();
    });
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

  it('asks again when the content to write changed after the question, even at the same size', async () => {
    const directory = await project('mcp-generate-changed');
    const spec = await useLocalSpec(directory);
    const client = await connect(directory, '--allow-write');
    let reloaded: () => void = () => undefined;
    client.setNotificationHandler('notifications/resources/list_changed', () => {
      reloaded();
    });
    const subscription = await client.listen({ resourcesListChanged: true });
    const asked = vi.fn<(params: unknown) => void>();
    client.setRequestHandler('elicitation/create', async (request) => {
      asked(request.params);
      if (asked.mock.calls.length === 1) {
        // While the user reads the question, the summary changes to text of the same length.
        const done = new Promise<void>((resolve) => (reloaded = resolve));
        const text = await readFile(spec, 'utf8');
        await writeFile(spec, text.replace('summary: Find pet by ID.', 'summary: Find pet by Id.'));
        await done;
      }
      return { action: 'accept', content: { confirm: true } };
    });
    const written = json(await client.callTool({ name: 'generate', arguments: {} }));
    expect(written).toMatchObject({ ok: true, written: true });
    // The first answer was about other content: the user confirmed the new content too.
    expect(asked).toHaveBeenCalledTimes(2);
    expect(
      await readFile(path.join(directory, 'src/generated/api/pet/get-pet-by-id.ts'), 'utf8'),
    ).toContain('Find pet by Id.');
    await subscription.close();
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
    // Examples from the specification fill the placeholders under `specification`.
    expect(operation.example).toBe(
      "const result = await addPet({ body: { name: '…', photoUrls: ['…'] } });",
    );
    expect(operation.specification).toMatchObject({
      example: "const result = await addPet({ body: { name: 'doggie', photoUrls: ['…'] } });",
    });
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
    await writeUntil(
      spec,
      text.replace('summary: Find pet by ID.', 'summary: Look up a pet.'),
      () => {
        expect(updated).toHaveBeenCalledWith('swaggerz://operations/getPetById');
      },
    );
    // Only resources whose content changed are reported.
    expect(updated).not.toHaveBeenCalledWith('swaggerz://models/User');
  });

  it('compares with the content at the time of a new subscription', async () => {
    const directory = await project('mcp-legacy-resubscribe');
    const spec = await useLocalSpec(directory);
    const client = await connect(directory);
    const updated = vi.fn<(uri: string) => void>();
    const reloads = vi.fn<() => void>();
    client.setNotificationHandler(ResourceUpdatedNotificationSchema, (notification) => {
      updated(notification.params.uri);
      return Promise.resolve();
    });
    client.setNotificationHandler(ResourceListChangedNotificationSchema, () => {
      reloads();
      return Promise.resolve();
    });
    /** Writes the specification and waits until the server reloaded it. */
    const edit = async (text: string): Promise<void> => {
      const before = reloads.mock.calls.length;
      await writeUntil(spec, text, () => {
        expect(reloads.mock.calls.length).toBeGreaterThan(before);
      });
    };
    const uri = 'swaggerz://operations/getPetById';
    await client.subscribeResource({ uri });
    await client.unsubscribeResource({ uri });
    // The resource changes while nobody is subscribed.
    const text = await readFile(spec, 'utf8');
    const changed = text.replace('summary: Find pet by ID.', 'summary: Look up a pet.');
    await edit(changed);
    await client.subscribeResource({ uri });
    // A change elsewhere leaves the resource as it was when subscribed again.
    await edit(changed.replace('summary: Add a new pet', 'summary: Add a pet'));
    expect(updated).not.toHaveBeenCalled();
  });

  it('follows generations and cleans made outside the server', async () => {
    const directory = await project('mcp-legacy-output');
    const client = await connect(directory);
    const updated = vi.fn<(uri: string) => void>();
    client.setNotificationHandler(ResourceUpdatedNotificationSchema, (notification) => {
      updated(notification.params.uri);
      return Promise.resolve();
    });
    await client.subscribeResource({ uri: 'swaggerz://overview' });
    const status = async (): Promise<unknown> =>
      (
        json(await client.callTool({ name: 'check', arguments: {} })).generation as {
          status: string;
        }
      ).status;
    expect(await status()).toBe('never');
    const run = (...args: string[]) =>
      new Promise((resolve) => {
        spawn(process.execPath, [BIN, ...args], { cwd: directory }).on('close', resolve);
      });

    await run('generate');
    await vi.waitFor(
      () => {
        expect(updated).toHaveBeenCalledWith('swaggerz://overview');
      },
      { timeout: 15_000 },
    );
    expect(await status()).toBe('up-to-date');

    updated.mockClear();
    await run('clean');
    await vi.waitFor(
      () => {
        expect(updated).toHaveBeenCalledWith('swaggerz://overview');
      },
      { timeout: 15_000 },
    );
    expect(await status()).toBe('never');
  });

  it('writes the changes the user confirmed, not what is on disk now', async () => {
    const directory = await project('mcp-legacy-generate-reviewed');
    const spec = await useLocalSpec(directory);
    // Without watching, the server describes the version it loaded; so does what it writes.
    const client = await connect(directory, '--allow-write', '--no-watch');
    const text = await readFile(spec, 'utf8');
    await writeFile(
      spec,
      text.replace(
        'paths:\n',
        "paths:\n  /health:\n    get:\n      operationId: getHealth\n      responses:\n        '204':\n          description: Healthy.\n",
      ),
    );
    const messages: string[] = [];
    client.setRequestHandler(ElicitRequestSchema, (request) => {
      messages.push(request.params.message);
      return Promise.resolve({ action: 'accept', content: { confirm: true } });
    });
    const written = json(await client.callTool({ name: 'generate', arguments: {} }));
    expect(written).toMatchObject({ ok: true, written: true });
    const count = Number(/(\d+) file\(s\) change/.exec(messages[0] ?? '')?.[1]);
    expect(count).toBeGreaterThan(0);
    expect((written.created as number) + (written.updated as number)).toBe(count);
    await expect(
      access(path.join(directory, 'src/generated/api/default/get-health.ts')),
    ).rejects.toThrow(/ENOENT/);
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

  it('answers invalid request ids, empty batches and malformed resource URIs', async () => {
    const directory = await project('mcp-raw-invalid');
    const meta = {
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientCapabilities': {},
    };
    const responses = await exchange(directory, [
      { jsonrpc: '2.0', id: null, method: 'ping' },
      { jsonrpc: '2.0', id: true, method: 'ping' },
      '[]',
      {
        jsonrpc: '2.0',
        id: 'modern',
        method: 'resources/read',
        params: { _meta: meta, uri: 'swaggerz://operations/%' },
      },
      {
        jsonrpc: '2.0',
        id: 'init',
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'raw', version: '1' },
        },
      },
      {
        jsonrpc: '2.0',
        id: 'legacy',
        method: 'resources/read',
        params: { uri: 'swaggerz://models/%E0%A4%A' },
      },
    ]);
    expect(responses.filter((r) => r.id === null)).toEqual([
      expect.objectContaining({ error: expect.objectContaining({ code: -32600 }) as unknown }),
      expect.objectContaining({ error: expect.objectContaining({ code: -32600 }) as unknown }),
      expect.objectContaining({ error: expect.objectContaining({ code: -32600 }) as unknown }),
    ]);
    expect(responses.find((r) => r.id === 'modern')?.error).toMatchObject({ code: -32602 });
    expect(responses.find((r) => r.id === 'legacy')?.error).toMatchObject({ code: -32002 });
  });

  it('keeps output of the config file and plugins off the protocol stream', async () => {
    const config = {
      spec: { version: '3.0', input: path.join(REPO_ROOT, 'fixtures/specs/petstore-3.0.yaml') },
      output: { directory: './src/generated/api' },
    };
    const directory = await createProject('mcp-noisy-config', {
      files: {
        'swaggerz.config.mjs': [
          "console.log('Loading the config');",
          'export default {',
          `  ...${JSON.stringify(config)},`,
          '  plugins: [',
          '    {',
          "      name: 'noisy',",
          '      operationName() {',
          "        process.stdout.write('Naming an operation\\n');",
          '        return undefined;',
          '      },',
          '    },',
          '  ],',
          '};',
        ].join('\n'),
      },
    });
    // Every line of stdout is a protocol message (exchange parses each one as JSON).
    const responses = await exchange(directory, [
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {
          _meta: {
            'io.modelcontextprotocol/protocolVersion': '2026-07-28',
            'io.modelcontextprotocol/clientCapabilities': {},
          },
        },
      },
    ]);
    expect(responses).toEqual([expect.objectContaining({ id: 1 })]);
  });

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
