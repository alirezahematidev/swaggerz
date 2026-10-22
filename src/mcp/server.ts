import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isRecord } from '../utils/object.ts';

/**
 * A Model Context Protocol server over stdio, with no dependencies. It serves both protocol eras:
 *
 * - **2026-07-28** (stateless): every request carries its protocol version and client
 *   capabilities in `_meta`; `server/discover` advertises the server; `subscriptions/listen`
 *   opens notification streams; confirmations use input-required results (multi round-trip
 *   requests) with an integrity-protected `requestState`.
 * - **2025-11-25 back to 2024-11-05**: the `initialize` handshake, `resources/subscribe` and
 *   server-to-client `elicitation/create` requests.
 *
 * Messages are newline-delimited JSON-RPC 2.0. Nothing but protocol messages is written to the
 * output stream; logging goes to stderr.
 */

export const MODERN_VERSIONS = ['2026-07-28'] as const;
export const LEGACY_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'] as const;

/** The protocol's metadata member of params and results. */
const META_FIELD = '_meta';

const META = {
  protocolVersion: 'io.modelcontextprotocol/protocolVersion',
  clientCapabilities: 'io.modelcontextprotocol/clientCapabilities',
  serverInfo: 'io.modelcontextprotocol/serverInfo',
  subscriptionId: 'io.modelcontextprotocol/subscriptionId',
} as const;

const ERROR = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
  /** 2025-11-25 and earlier: resource not found. */
  legacyResourceNotFound: -32002,
  unsupportedProtocolVersion: -32022,
} as const;

/** Cache hints of list and read results (2026-07-28): fresh until a change notification. */
const CACHE = { ttlMs: 0, cacheScope: 'private' } as const;

export type JsonValue = unknown;
type RequestId = string | number;

export class McpError extends Error {
  readonly code: number;
  readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = 'McpError';
    this.code = code;
    if (data !== undefined) this.data = data;
  }
}

/** A tool as advertised by `tools/list`. */
export interface ToolDefinition {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly annotations: {
    readonly readOnlyHint: boolean;
    readonly destructiveHint?: boolean;
    readonly idempotentHint?: boolean;
    readonly openWorldHint: boolean;
  };
}

/** What a tool returns: shown as JSON text and as structured content. */
export interface ToolOutcome {
  readonly value: unknown;
  readonly isError?: boolean;
}

/** A question for the user before a tool proceeds (an elicitation in form mode). */
export interface Confirmation {
  readonly message: string;
  /** Changes when the thing to confirm changes, so an outdated answer is asked again. */
  readonly fingerprint: string;
}

export interface ToolContext {
  /**
   * Asks the user to confirm. Returns `true` when they accept, `false` when they decline, and
   * `'unsupported'` when the client cannot ask (the tool then decides).
   */
  confirm(confirmation: Confirmation): Promise<boolean | 'unsupported'>;
}

export interface ResourceEntry {
  readonly uri: string;
  readonly name: string;
  readonly title?: string;
  readonly description?: string;
  readonly mimeType: string;
}

export interface ResourceTemplate {
  readonly uriTemplate: string;
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly mimeType: string;
}

/** What the protocol layer serves. */
export interface McpHandlers {
  readonly serverInfo: { readonly name: string; readonly version: string; readonly title?: string };
  instructions(): string;
  tools(): readonly ToolDefinition[];
  callTool(name: string, args: Record<string, unknown>, context: ToolContext): Promise<ToolOutcome>;
  resources(): readonly ResourceEntry[];
  resourceTemplates(): readonly ResourceTemplate[];
  /** The text of a resource, or `undefined` when it does not exist. */
  readResource(
    uri: string,
  ): Promise<{ readonly mimeType: string; readonly text: string } | undefined>;
}

export interface McpTransport {
  /** Writes one message. */
  send(message: Record<string, unknown>): void;
}

interface Subscription {
  readonly id: RequestId;
  readonly resourcesListChanged: boolean;
  readonly uris: ReadonlySet<string>;
}

/** Elicitation input request (form mode) asking the user to confirm. */
function elicitation(message: string, withMode: boolean): Record<string, unknown> {
  return {
    ...(withMode ? { mode: 'form' } : {}),
    message,
    requestedSchema: {
      type: 'object',
      properties: {
        confirm: {
          type: 'boolean',
          title: 'Proceed',
          description: 'Confirm to continue.',
          default: false,
        },
      },
      required: ['confirm'],
    },
  };
}

/** Whether an elicitation result accepts: `accept`, with `confirm` true when it is present. */
function accepted(result: unknown): boolean {
  if (!isRecord(result) || result.action !== 'accept') return false;
  return !isRecord(result.content) || result.content.confirm !== false;
}

export class McpServer {
  readonly #handlers: McpHandlers;
  readonly #transport: McpTransport;
  readonly #log: (message: string) => void;
  /** Key of the HMAC protecting `requestState` (2026-07-28 confirmations). */
  readonly #stateKey = randomBytes(32);
  // Legacy session state (the `initialize` handshake scopes it to the stdio process).
  #legacyVersion: string | undefined;
  #legacyCapabilities: Record<string, unknown> = {};
  readonly #legacySubscriptions = new Set<string>();
  // Modern `subscriptions/listen` streams.
  readonly #subscriptions = new Map<string, Subscription>();
  // Server-to-client requests (legacy elicitation) awaiting a response.
  readonly #pending = new Map<RequestId, (result: unknown) => void>();
  #nextRequestId = 0;
  readonly #cancelled = new Set<string>();

  readonly #onSubscribe: (uri: string) => void;

  constructor(
    handlers: McpHandlers,
    transport: McpTransport,
    options: {
      readonly log?: (message: string) => void;
      /** A client subscribed to a resource: remember its content to report real changes only. */
      readonly onSubscribe?: (uri: string) => void;
    } = {},
  ) {
    this.#handlers = handlers;
    this.#transport = transport;
    this.#log = options.log ?? (() => undefined);
    this.#onSubscribe = options.onSubscribe ?? (() => undefined);
  }

  /** Handles one incoming line of the transport. */
  receive(line: string): void {
    if (line.trim() === '') return;
    let message: unknown;
    try {
      message = JSON.parse(line) as unknown;
    } catch {
      this.#transport.send({
        jsonrpc: '2.0',
        id: null,
        error: { code: ERROR.parse, message: 'Parse error' },
      });
      return;
    }
    if (Array.isArray(message)) {
      // JSON-RPC batches were removed from MCP in 2025-06-18; answer each element.
      for (const item of message) this.#dispatch(item);
      return;
    }
    this.#dispatch(message);
  }

  #dispatch(message: unknown): void {
    if (!isRecord(message) || message.jsonrpc !== '2.0') {
      this.#transport.send({
        jsonrpc: '2.0',
        id: null,
        error: { code: ERROR.invalidRequest, message: 'Invalid JSON-RPC message' },
      });
      return;
    }
    const id = message.id;
    const hasId = typeof id === 'string' || typeof id === 'number';
    if (typeof message.method !== 'string') {
      // A response to a request this server sent.
      if (hasId) {
        const resolve = this.#pending.get(id);
        this.#pending.delete(id);
        resolve?.(message.error === undefined ? message.result : undefined);
      }
      return;
    }
    const params = isRecord(message.params) ? message.params : {};
    if (!hasId) {
      this.#notification(message.method, params);
      return;
    }
    void this.#request(id, message.method, params);
  }

  #notification(method: string, params: Record<string, unknown>): void {
    if (method === 'notifications/cancelled') {
      const requestId = params.requestId;
      if (typeof requestId === 'string' || typeof requestId === 'number') {
        // Ending a subscription needs no response; other cancelled requests get none either.
        this.#subscriptions.delete(String(requestId));
        this.#cancelled.add(String(requestId));
      }
    }
    // `notifications/initialized` and others need no action.
  }

  async #request(id: RequestId, method: string, params: Record<string, unknown>): Promise<void> {
    const respond = (result: Record<string, unknown>, modern: boolean): void => {
      if (this.#cancelled.delete(String(id))) return;
      this.#transport.send({
        jsonrpc: '2.0',
        id,
        result: modern
          ? {
              resultType: 'complete',
              ...result,
              [META_FIELD]: {
                ...(isRecord(result[META_FIELD]) ? result[META_FIELD] : {}),
                [META.serverInfo]: this.#handlers.serverInfo,
              },
            }
          : result,
      });
    };
    const fail = (error: McpError): void => {
      if (this.#cancelled.delete(String(id))) return;
      this.#transport.send({
        jsonrpc: '2.0',
        id,
        error: {
          code: error.code,
          message: error.message,
          ...(error.data === undefined ? {} : { data: error.data }),
        },
      });
    };
    try {
      const meta = isRecord(params[META_FIELD]) ? params[META_FIELD] : {};
      const requested = meta[META.protocolVersion];
      if (method === 'initialize') {
        respond(this.#initialize(params), false);
        return;
      }
      if (requested !== undefined) {
        // A modern request: everything it needs is in `_meta`.
        if (
          typeof requested !== 'string' ||
          !(MODERN_VERSIONS as readonly string[]).includes(requested)
        )
          throw new McpError(ERROR.unsupportedProtocolVersion, 'Unsupported protocol version', {
            supported: [...MODERN_VERSIONS],
            requested,
          });
        const capabilities = meta[META.clientCapabilities];
        if (!isRecord(capabilities))
          throw new McpError(ERROR.invalidParams, `Missing ${META.clientCapabilities} in _meta`);
        const result = await this.#modern(id, method, params, capabilities);
        if (result !== undefined) respond(result, true);
        return;
      }
      if (method === 'server/discover')
        throw new McpError(ERROR.invalidParams, `Missing ${META.protocolVersion} in _meta`);
      if (method === 'ping') {
        respond({}, false);
        return;
      }
      if (this.#legacyVersion === undefined)
        throw new McpError(
          ERROR.invalidRequest,
          `Send initialize first, or ${META.protocolVersion} in _meta (supported: ${[...MODERN_VERSIONS, ...LEGACY_VERSIONS].join(', ')}).`,
        );
      respond(await this.#legacy(method, params), false);
    } catch (error) {
      if (error instanceof McpError) {
        fail(error);
        return;
      }
      this.#log(
        `Internal error in ${method}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
      );
      fail(new McpError(ERROR.internal, error instanceof Error ? error.message : 'Internal error'));
    }
  }

  #capabilities(): Record<string, unknown> {
    return {
      tools: {},
      resources: { subscribe: true, listChanged: true },
    };
  }

  #initialize(params: Record<string, unknown>): Record<string, unknown> {
    const requested = params.protocolVersion;
    const version =
      typeof requested === 'string' && (LEGACY_VERSIONS as readonly string[]).includes(requested)
        ? requested
        : LEGACY_VERSIONS[0];
    this.#legacyVersion = version;
    this.#legacyCapabilities = isRecord(params.capabilities) ? params.capabilities : {};
    return {
      protocolVersion: version,
      capabilities: this.#capabilities(),
      serverInfo: this.#handlers.serverInfo,
      instructions: this.#handlers.instructions(),
    };
  }

  /** Methods of the 2026-07-28 revision. Returns `undefined` for streams answered later. */
  async #modern(
    id: RequestId,
    method: string,
    params: Record<string, unknown>,
    capabilities: Record<string, unknown>,
  ): Promise<Record<string, unknown> | undefined> {
    switch (method) {
      case 'server/discover':
        return {
          // Earlier revisions are served through `initialize`, not with per-request metadata.
          supportedVersions: [...MODERN_VERSIONS],
          capabilities: this.#capabilities(),
          instructions: this.#handlers.instructions(),
          ...CACHE,
        };
      case 'tools/list':
        return { tools: this.#handlers.tools(), ...CACHE };
      case 'tools/call':
        return this.#callTool(params, async (confirmation) => {
          if (!isRecord(capabilities.elicitation)) return 'unsupported';
          const state = this.#sign(confirmation.fingerprint);
          const responses = isRecord(params.inputResponses) ? params.inputResponses : {};
          // The state binds the answer to what was asked: when the change to confirm differs
          // (the specification changed meanwhile), the user is asked again.
          if (
            typeof params.requestState === 'string' &&
            McpServer.sameState(params.requestState, state) &&
            responses.confirm !== undefined
          )
            return accepted(responses.confirm);
          // Ask, and let the client retry the call with the answer.
          throw new InputRequired({
            resultType: 'input_required',
            inputRequests: {
              confirm: {
                method: 'elicitation/create',
                params: elicitation(confirmation.message, true),
              },
            },
            requestState: state,
          });
        });
      case 'resources/list':
        return { ...this.#resourcePage(params), ...CACHE };
      case 'resources/templates/list':
        return { resourceTemplates: this.#handlers.resourceTemplates(), ...CACHE };
      case 'resources/read':
        return { contents: [await this.#read(params, ERROR.invalidParams)], ...CACHE };
      case 'subscriptions/listen': {
        const filter = isRecord(params.notifications) ? params.notifications : {};
        const uris = Array.isArray(filter.resourceSubscriptions)
          ? filter.resourceSubscriptions.filter((uri): uri is string => typeof uri === 'string')
          : [];
        const subscription: Subscription = {
          id,
          resourcesListChanged: filter.resourcesListChanged === true,
          uris: new Set(uris),
        };
        this.#subscriptions.set(String(id), subscription);
        for (const uri of uris) this.#onSubscribe(uri);
        this.#transport.send({
          jsonrpc: '2.0',
          method: 'notifications/subscriptions/acknowledged',
          params: {
            _meta: { [META.subscriptionId]: id },
            // The tools never change, so only resource notifications are honored.
            notifications: {
              ...(subscription.resourcesListChanged ? { resourcesListChanged: true } : {}),
              ...(uris.length === 0 ? {} : { resourceSubscriptions: uris }),
            },
          },
        });
        return undefined;
      }
      default:
        throw new McpError(ERROR.methodNotFound, `Method not found: ${method}`);
    }
  }

  /** Methods of the initialize-based revisions. */
  async #legacy(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    switch (method) {
      case 'tools/list':
        return { tools: this.#handlers.tools() };
      case 'tools/call':
        return this.#callTool(params, (confirmation) => this.#elicit(confirmation.message));
      case 'resources/list':
        return this.#resourcePage(params);
      case 'resources/templates/list':
        return { resourceTemplates: this.#handlers.resourceTemplates() };
      case 'resources/read':
        return { contents: [await this.#read(params, ERROR.legacyResourceNotFound)] };
      case 'resources/subscribe':
      case 'resources/unsubscribe': {
        if (typeof params.uri !== 'string')
          throw new McpError(ERROR.invalidParams, 'Expected a uri');
        if (method === 'resources/subscribe') {
          this.#legacySubscriptions.add(params.uri);
          this.#onSubscribe(params.uri);
        } else {
          this.#legacySubscriptions.delete(params.uri);
        }
        return {};
      }
      default:
        throw new McpError(ERROR.methodNotFound, `Method not found: ${method}`);
    }
  }

  /** Legacy confirmations: an `elicitation/create` request to the client. */
  async #elicit(message: string): Promise<boolean | 'unsupported'> {
    if (!isRecord(this.#legacyCapabilities.elicitation)) return 'unsupported';
    const id = `elicitation-${this.#nextRequestId++}`;
    const withMode = this.#legacyVersion === LEGACY_VERSIONS[0];
    const result = await new Promise<unknown>((resolve) => {
      this.#pending.set(id, resolve);
      this.#transport.send({
        jsonrpc: '2.0',
        id,
        method: 'elicitation/create',
        params: elicitation(message, withMode),
      });
    });
    return accepted(result);
  }

  #sign(fingerprint: string): string {
    return createHmac('sha256', this.#stateKey).update(fingerprint).digest('base64url');
  }

  async #callTool(
    params: Record<string, unknown>,
    confirm: ToolContext['confirm'],
  ): Promise<Record<string, unknown>> {
    const name = params.name;
    if (typeof name !== 'string' || !this.#handlers.tools().some((tool) => tool.name === name))
      throw new McpError(ERROR.invalidParams, `Unknown tool: ${String(name)}`);
    const args = isRecord(params.arguments) ? params.arguments : {};
    try {
      const outcome = await this.#handlers.callTool(name, args, { confirm });
      const structured = isRecord(outcome.value) ? { structuredContent: outcome.value } : {};
      return {
        content: [{ type: 'text', text: JSON.stringify(outcome.value, null, 2) }],
        ...structured,
        ...(outcome.isError === true ? { isError: true } : {}),
      };
    } catch (error) {
      if (error instanceof InputRequired) return error.result;
      if (error instanceof McpError) throw error;
      // Tool failures are results the model can read, not protocol errors.
      return {
        content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
        isError: true,
      };
    }
  }

  #resourcePage(params: Record<string, unknown>): Record<string, unknown> {
    const all = this.#handlers.resources();
    const size = 200;
    const start =
      typeof params.cursor === 'string' && /^\d+$/.test(params.cursor) ? Number(params.cursor) : 0;
    const page = all.slice(start, start + size);
    return {
      resources: page,
      ...(start + size < all.length ? { nextCursor: String(start + size) } : {}),
    };
  }

  async #read(params: Record<string, unknown>, notFound: number): Promise<Record<string, unknown>> {
    const uri = params.uri;
    if (typeof uri !== 'string') throw new McpError(ERROR.invalidParams, 'Expected a uri');
    const resource = await this.#handlers.readResource(uri);
    if (resource === undefined) throw new McpError(notFound, `Resource not found: ${uri}`, { uri });
    return { uri, mimeType: resource.mimeType, text: resource.text };
  }

  /**
   * Tells clients that resources changed: `list_changed` to whoever listens for it, and
   * `updated` for each subscribed URI in `updated`.
   */
  resourcesChanged(updated: ReadonlySet<string>): void {
    if (this.#legacyVersion !== undefined) {
      this.#transport.send({ jsonrpc: '2.0', method: 'notifications/resources/list_changed' });
      for (const uri of this.#legacySubscriptions)
        if (updated.has(uri))
          this.#transport.send({
            jsonrpc: '2.0',
            method: 'notifications/resources/updated',
            params: { uri },
          });
    }
    for (const subscription of this.#subscriptions.values()) {
      const meta = { _meta: { [META.subscriptionId]: subscription.id } };
      if (subscription.resourcesListChanged)
        this.#transport.send({
          jsonrpc: '2.0',
          method: 'notifications/resources/list_changed',
          params: meta,
        });
      for (const uri of subscription.uris)
        if (updated.has(uri))
          this.#transport.send({
            jsonrpc: '2.0',
            method: 'notifications/resources/updated',
            params: { ...meta, uri },
          });
    }
  }

  /** Every URI a client watches, to know which resources to compare after a change. */
  subscribedUris(): Set<string> {
    const uris = new Set(this.#legacySubscriptions);
    for (const subscription of this.#subscriptions.values())
      for (const uri of subscription.uris) uris.add(uri);
    return uris;
  }

  /** Ends open subscriptions gracefully (on shutdown). */
  close(): void {
    for (const subscription of this.#subscriptions.values())
      this.#transport.send({
        jsonrpc: '2.0',
        id: subscription.id,
        result: { resultType: 'complete', _meta: { [META.subscriptionId]: subscription.id } },
      });
    this.#subscriptions.clear();
    for (const resolve of this.#pending.values()) resolve(undefined);
    this.#pending.clear();
  }

  /** Compares signed states in constant time. */
  static sameState(a: string, b: string): boolean {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
  }
}

/** Thrown inside a tool to answer with an input-required result (2026-07-28). */
class InputRequired extends Error {
  readonly result: Record<string, unknown>;

  constructor(result: Record<string, unknown>) {
    super('Input required');
    this.result = result;
  }
}
