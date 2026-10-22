import { describe, expect, it, vi } from 'vitest';
import { McpServer, type McpHandlers, type ToolDefinition } from '../../../src/mcp/server.ts';

/**
 * The protocol layer of `swaggerz mcp` in-process, with stub tools: request ids, cancellation,
 * confirmations and pagination. tests/integration/mcp drives the real server with the SDKs.
 */

type Message = Record<string, unknown>;

const MODERN = (capabilities: Record<string, unknown> = {}) => ({
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientCapabilities': capabilities,
});

const tool = (name: string): ToolDefinition => ({
  name,
  title: name,
  description: name,
  inputSchema: { type: 'object' },
  annotations: { readOnlyHint: false, openWorldHint: false },
});

function harness(options: { elicitationTimeoutMs?: number } = {}) {
  const sent: Message[] = [];
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const handlers: McpHandlers = {
    serverInfo: { name: 'test', version: '1.0.0' },
    instructions: () => 'Test server.',
    tools: () => [tool('write'), tool('slow')],
    callTool: async (name, _args, context) => {
      if (name === 'slow') {
        await gate;
        return { value: { done: true } };
      }
      const answer = await context.confirm({ message: 'Write the files?', fingerprint: 'plan' });
      return { value: { answer } };
    },
    resources: () =>
      Array.from({ length: 450 }, (_, index) => ({
        uri: `test://resources/${index}`,
        name: `resource-${index}`,
        mimeType: 'text/plain',
      })),
    resourceTemplates: () => [],
    readResource: () => Promise.resolve(undefined),
  };
  const server = new McpServer(handlers, { send: (message) => sent.push(message) }, options);
  const send = (message: unknown): void => {
    server.receive(typeof message === 'string' ? message : JSON.stringify(message));
  };
  const byId = (id: unknown): Message | undefined =>
    sent.find((m) => m.id === id && (m.result !== undefined || m.error !== undefined));
  const response = async (id: unknown): Promise<Message> => {
    await vi.waitFor(() => {
      expect(byId(id)).toBeDefined();
    });
    return byId(id) as Message;
  };
  const request = async (method: string): Promise<Message> =>
    vi.waitFor(() => {
      const found = sent.find((m) => m.method === method && m.id !== undefined);
      expect(found).toBeDefined();
      return found as Message;
    });
  const initialize = async (capabilities: Record<string, unknown> = {}): Promise<void> => {
    const id = `init-${sent.length}`;
    send({
      jsonrpc: '2.0',
      id,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities,
        clientInfo: { name: 'test', version: '1' },
      },
    });
    await response(id);
  };
  const toolValue = (message: Message): unknown =>
    ((message.result as { structuredContent?: unknown }).structuredContent as { answer?: unknown })
      .answer;
  return { server, sent, send, byId, response, request, initialize, toolValue, release };
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));

describe('MCP protocol layer', () => {
  it('rejects request ids that are not strings or numbers, and empty batches', async () => {
    const { send, sent } = harness();
    send({ jsonrpc: '2.0', id: null, method: 'ping' });
    send({ jsonrpc: '2.0', id: true, method: 'ping' });
    send({ jsonrpc: '2.0', id: { a: 1 }, method: 'ping' });
    send('[]');
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    await settle();
    expect(sent).toHaveLength(4);
    for (const message of sent)
      expect(message).toMatchObject({ id: null, error: { code: -32600 } });
  });

  it('forgets ids once answered: a cancellation after the response does not drop a later request', async () => {
    const { send, response, sent } = harness();
    send({ jsonrpc: '2.0', id: 5, method: 'ping' });
    await response(5);
    send({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 5 } });
    // "5" and 5 are different requests.
    send({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: '6' } });
    send({ jsonrpc: '2.0', id: 5, method: 'ping' });
    send({ jsonrpc: '2.0', id: 6, method: 'ping' });
    await settle();
    expect(sent.filter((m) => m.id === 5)).toHaveLength(2);
    expect(sent.filter((m) => m.id === 6)).toHaveLength(1);
  });

  it('sends no response to a cancelled request', async () => {
    const { send, initialize, sent, release } = harness();
    await initialize();
    send({ jsonrpc: '2.0', id: 'slow', method: 'tools/call', params: { name: 'slow' } });
    send({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 'slow' } });
    release();
    await settle();
    expect(sent.some((m) => m.id === 'slow')).toBe(false);
  });

  describe('confirmations fail closed', () => {
    const answers = [
      [{ action: 'accept' }, false],
      [{ action: 'accept', content: {} }, false],
      [{ action: 'accept', content: { confirm: 'no' } }, false],
      [{ action: 'accept', content: { confirm: 1 } }, false],
      [{ action: 'decline' }, false],
      [{ action: 'accept', content: { confirm: true } }, true],
    ] as const;

    it.each(answers)('2025-11-25: %j confirms: %s', async (answer, expected) => {
      const { send, initialize, request, response, toolValue } = harness();
      await initialize({ elicitation: {} });
      send({ jsonrpc: '2.0', id: 'call', method: 'tools/call', params: { name: 'write' } });
      const ask = await request('elicitation/create');
      send({ jsonrpc: '2.0', id: ask.id, result: answer });
      expect(toolValue(await response('call'))).toBe(expected);
    });

    it.each(answers)('2026-07-28: %j confirms: %s', async (answer, expected) => {
      const { send, response, toolValue } = harness();
      const meta = MODERN({ elicitation: {} });
      send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { _meta: meta, name: 'write' },
      });
      const asked = (await response(1)).result as Message;
      expect(asked).toMatchObject({ resultType: 'input_required' });
      send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          _meta: meta,
          name: 'write',
          requestState: asked.requestState,
          inputResponses: { confirm: answer },
        },
      });
      expect(toolValue(await response(2))).toBe(expected);
    });
  });

  it('asks for confirmation in form mode only when the client supports it', async () => {
    const legacy = harness();
    await legacy.initialize({ elicitation: { url: {} } });
    legacy.send({ jsonrpc: '2.0', id: 'url', method: 'tools/call', params: { name: 'write' } });
    expect(legacy.toolValue(await legacy.response('url'))).toBe('unsupported');
    expect(legacy.sent.some((m) => m.method === 'elicitation/create')).toBe(false);

    const form = harness();
    await form.initialize({ elicitation: { form: {}, url: {} } });
    form.send({ jsonrpc: '2.0', id: 'form', method: 'tools/call', params: { name: 'write' } });
    await form.request('elicitation/create');

    const modern = harness();
    modern.send({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { _meta: MODERN({ elicitation: { url: {} } }), name: 'write' },
    });
    expect(modern.toolValue(await modern.response(1))).toBe('unsupported');
  });

  it('withdraws a legacy confirmation when the call is cancelled or nobody answers', async () => {
    const cancelled = harness();
    await cancelled.initialize({ elicitation: {} });
    cancelled.send({ jsonrpc: '2.0', id: 'call', method: 'tools/call', params: { name: 'write' } });
    const ask = await cancelled.request('elicitation/create');
    cancelled.send({
      jsonrpc: '2.0',
      method: 'notifications/cancelled',
      params: { requestId: 'call' },
    });
    await settle();
    expect(cancelled.sent).toContainEqual(
      expect.objectContaining({
        method: 'notifications/cancelled',
        params: expect.objectContaining({ requestId: ask.id }) as unknown,
      }),
    );
    expect(cancelled.byId('call')).toBeUndefined();

    const timedOut = harness({ elicitationTimeoutMs: 10 });
    await timedOut.initialize({ elicitation: {} });
    timedOut.send({ jsonrpc: '2.0', id: 'call', method: 'tools/call', params: { name: 'write' } });
    const question = await timedOut.request('elicitation/create');
    expect(timedOut.toolValue(await timedOut.response('call'))).toBe(false);
    expect(timedOut.sent).toContainEqual(
      expect.objectContaining({
        method: 'notifications/cancelled',
        params: expect.objectContaining({ requestId: question.id }) as unknown,
      }),
    );
  });

  it('pages resources and rejects invalid cursors', async () => {
    const { send, response } = harness();
    const list = (id: number, cursor?: unknown) =>
      send({
        jsonrpc: '2.0',
        id,
        method: 'resources/list',
        params: { _meta: MODERN(), ...(cursor === undefined ? {} : { cursor }) },
      });
    list(1);
    expect((await response(1)).result).toMatchObject({ nextCursor: '200' });
    list(2, '400');
    const last = (await response(2)).result as { resources: unknown[]; nextCursor?: string };
    expect(last.resources).toHaveLength(50);
    expect(last.nextCursor).toBeUndefined();
    list(3, 'not-a-cursor');
    list(4, 7);
    expect((await response(3)).error).toMatchObject({ code: -32602 });
    expect((await response(4)).error).toMatchObject({ code: -32602 });
  });

  it('ends the subscriptions of a session when the client initializes again', async () => {
    const { send, initialize, response, server, sent } = harness();
    await initialize();
    send({
      jsonrpc: '2.0',
      id: 'sub',
      method: 'resources/subscribe',
      params: { uri: 'test://resources/1' },
    });
    await response('sub');
    expect(server.subscribedUris()).toEqual(new Set(['test://resources/1']));
    await initialize();
    expect(server.subscribedUris()).toEqual(new Set());
    server.resourcesChanged(new Set(['test://resources/1']));
    expect(sent.some((m) => m.method === 'notifications/resources/updated')).toBe(false);
  });
});
