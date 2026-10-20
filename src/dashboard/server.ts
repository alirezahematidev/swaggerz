import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SwaggerzError } from '../diagnostics/bag.ts';
import { TOOL_NAME } from '../meta.ts';
import { FileWatcher } from '../utils/file-watcher.ts';
import type { ServerEvent } from './api-types.ts';
import { DashboardState } from './state.ts';

export interface DashboardOptions {
  readonly cwd: string;
  readonly configFile?: string;
  readonly env: NodeJS.ProcessEnv;
  /** Overrides `dashboard.host` from the config. */
  readonly host?: string;
  /** Overrides `dashboard.port` from the config. */
  readonly port?: number;
  /**
   * Reload when the config, the specification or the output manifest changes, and push the
   * changes to open pages (default `true`).
   */
  readonly watch?: boolean;
}

export interface DashboardServer {
  /** URL including the session token. */
  readonly url: string;
  readonly origin: string;
  readonly token: string;
  readonly state: DashboardState;
  close(): Promise<void>;
}

/** `src/dashboard` and `dist/dashboard` both sit two levels below the package root. */
const ASSETS = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'assets',
  'dashboard',
);
const MAX_BODY_BYTES = 64 * 1024;
const HEARTBEAT_MS = 25_000;

/**
 * Strict policy: same-origin scripts, styles and fonts only. Libraries that insert `<style>`
 * elements (scroll locking) receive a per-response nonce; no inline scripts are allowed.
 */
function contentSecurityPolicy(nonce?: string): string {
  const styles = nonce === undefined ? "'self'" : `'self' 'nonce-${nonce}'`;
  return `default-src 'none'; script-src 'self'; style-src ${styles}; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
}

const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'content-security-policy': contentSecurityPolicy(),
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'cache-control': 'no-store',
};

export function isLoopback(host: string): boolean {
  return (
    host === 'localhost' || host === '::1' || host === '[::1]' || /^127(\.\d{1,3}){3}$/.test(host)
  );
}

/** The HTML shell. It contains no specification data and no inline scripts or styles. */
function indexHtml(nonce: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="csp-nonce" content="${nonce}" />
    <meta name="color-scheme" content="light dark" />
    <title>${TOOL_NAME} dashboard</title>
    <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
    <link rel="preload" href="/assets/fonts/geist-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/assets/fonts/source-serif-4-latin-opsz-normal.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/assets/fonts/geist-mono-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="stylesheet" href="/assets/app.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/assets/app.js"></script>
  </body>
</html>
`;
}

const ASSET_TYPES: Readonly<Record<string, string>> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

/** URL path (`/assets/…`) → file, for every file of the built dashboard. Nothing else is served. */
async function assetIndex(): Promise<Map<string, { file: string; type: string }>> {
  const index = new Map<string, { file: string; type: string }>();
  let entries;
  try {
    entries = await readdir(ASSETS, { recursive: true, withFileTypes: true });
  } catch {
    return index;
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const type = ASSET_TYPES[path.extname(entry.name)];
    if (type === undefined) continue;
    const file = path.join(entry.parentPath, entry.name);
    const relative = path.relative(ASSETS, file).split(path.sep).join('/');
    index.set(`/assets/${relative}`, { file, type });
  }
  return index;
}

class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function send(
  res: ServerResponse,
  status: number,
  body: string | Buffer,
  type: string,
  headers: Readonly<Record<string, string>> = {},
): void {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    ...headers,
    'content-type': type,
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  send(res, status, JSON.stringify(value), 'application/json; charset=utf-8');
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.byteLength;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request body too large');
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

function tokenMatches(expected: string, header: string | undefined): boolean {
  const provided = header?.startsWith('Bearer ') === true ? header.slice('Bearer '.length) : '';
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Starts the local dashboard server. Throws `SwaggerzError` for configuration problems. */
export async function startDashboard(options: DashboardOptions): Promise<DashboardServer> {
  const state = new DashboardState({
    cwd: options.cwd,
    env: options.env,
    ...(options.configFile === undefined ? {} : { configFile: options.configFile }),
  });
  await state.reload('start');
  const settings = state.loaded.config.dashboard;
  const host = options.host ?? settings.host;
  if (!isLoopback(host) && !settings.allowNetworkAccess) {
    throw new SwaggerzError('Refusing to expose the dashboard on the network', [
      {
        code: 'dashboard/network-access',
        severity: 'error',
        message: `The dashboard would listen on ${host}, which is reachable from other machines and exposes your API description and source paths.`,
        hint: 'Use the default 127.0.0.1, or set dashboard.allowNetworkAccess: true in the config if this is intended.',
      },
    ]);
  }
  const token = randomBytes(24).toString('base64url');
  let origin = '';
  let allowedHosts = new Set<string>();

  // Live reload: open pages hold a server-sent event stream and refetch when told to.
  const clients = new Set<ServerResponse>();
  const broadcast = (event: ServerEvent): void => {
    const message = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of clients) client.write(message);
  };

  let watcher: FileWatcher | undefined;
  const watchFiles = (): void => {
    if (watcher === undefined) return;
    const { sources, manifest } = state.watchTargets();
    watcher.set([...sources, manifest]);
    state.setWatching(sources);
  };

  const api: Record<string, (req: IncomingMessage, url: URL) => Promise<unknown>> = {
    'GET /api/overview': () => state.overview(),
    'GET /api/operations': () => Promise.resolve(state.operations()),
    'GET /api/operation': (_req, url) => {
      const detail = state.operationDetail(url.searchParams.get('key') ?? '');
      if (detail === undefined) throw new HttpError(404, 'Unknown operation');
      return Promise.resolve(detail);
    },
    'GET /api/models': () => Promise.resolve(state.models()),
    'GET /api/model': (_req, url) => {
      const detail = state.modelDetail(url.searchParams.get('id') ?? '');
      if (detail === undefined) throw new HttpError(404, 'Unknown model');
      return Promise.resolve(detail);
    },
    'GET /api/graph': () => Promise.resolve(state.graph()),
    'POST /api/usage': () => state.usage(),
    'POST /api/preview': () => state.preview(),
    'GET /api/diff': (_req, url) => {
      const diff = state.diff(url.searchParams.get('path') ?? '');
      if (diff === undefined) throw new HttpError(404, 'Unknown file; compute a preview first');
      return Promise.resolve(diff);
    },
    'POST /api/generate': async (req) => {
      const body = await readBody(req);
      if (
        typeof body !== 'object' ||
        body === null ||
        (body as { confirm?: unknown }).confirm !== true
      ) {
        throw new HttpError(400, 'Generation must be confirmed with { "confirm": true }');
      }
      return state.generate();
    },
    'POST /api/reload': async () => {
      const outcome = await state.reload('manual');
      watchFiles();
      broadcast({ type: 'reload', trigger: 'manual', ...outcome });
      return state.overview();
    },
  };

  const assets = assetIndex();
  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // DNS-rebinding protection: only answer requests addressed to this server.
    if (!allowedHosts.has((req.headers.host ?? '').toLowerCase()))
      throw new HttpError(421, 'Unexpected Host header');
    const url = new URL(req.url ?? '/', origin);
    const method = req.method ?? 'GET';

    if (method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const nonce = randomBytes(16).toString('base64');
      send(res, 200, indexHtml(nonce), 'text/html; charset=utf-8', {
        'content-security-policy': contentSecurityPolicy(nonce),
      });
      return;
    }
    if (method === 'GET' && url.pathname.startsWith('/assets/')) {
      // Exact matches against the built files only; no path from the request reaches the disk.
      const asset = (await assets).get(url.pathname);
      if (asset === undefined) {
        if (url.pathname === '/assets/app.js' || url.pathname === '/assets/app.css')
          throw new HttpError(500, 'The dashboard bundle is missing; run the package build.');
        throw new HttpError(404, 'Not found');
      }
      send(res, 200, await readFile(asset.file), asset.type);
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      if (!tokenMatches(token, req.headers.authorization))
        throw new HttpError(401, 'Missing or invalid session token');
      if (method !== 'GET') {
        const requestOrigin = req.headers.origin;
        if (requestOrigin !== undefined && requestOrigin !== origin)
          throw new HttpError(403, 'Cross-origin request rejected');
        if (!(req.headers['content-type'] ?? '').startsWith('application/json'))
          throw new HttpError(415, 'Expected application/json');
      }
      if (method === 'GET' && url.pathname === '/api/events') {
        res.writeHead(200, {
          ...SECURITY_HEADERS,
          'content-type': 'text/event-stream; charset=utf-8',
          'x-accel-buffering': 'no',
        });
        res.write(
          `event: hello\ndata: ${JSON.stringify({ type: 'hello', revision: state.revision })}\n\n`,
        );
        clients.add(res);
        req.on('close', () => {
          clients.delete(res);
        });
        return;
      }
      const handler = api[`${method} ${url.pathname}`];
      if (handler === undefined) throw new HttpError(404, 'Unknown endpoint');
      sendJson(res, 200, await handler(req, url));
      return;
    }
    throw new HttpError(404, 'Not found');
  };

  const server: Server = createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      if (error instanceof HttpError) sendJson(res, error.status, { error: error.message });
      else if (error instanceof SwaggerzError)
        sendJson(res, 422, { error: error.message, diagnostics: error.diagnostics });
      else sendJson(res, 500, { error: error instanceof Error ? error.message : 'Internal error' });
    });
  });

  const explicitPort = options.port !== undefined;
  let port = options.port ?? settings.port;
  for (let attempt = 0; ; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolve();
        });
      });
      break;
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? error.code : undefined;
      if (code === 'EADDRINUSE' && !explicitPort && port !== 0 && attempt < 20) {
        port++;
        continue;
      }
      throw error;
    }
  }

  const address = server.address() as AddressInfo;
  const urlHost = address.family === 'IPv6' ? `[${address.address}]` : address.address;
  origin = `http://${urlHost}:${address.port}`;
  allowedHosts = new Set(
    [
      `${urlHost}:${address.port}`,
      `localhost:${address.port}`,
      `127.0.0.1:${address.port}`,
      `[::1]:${address.port}`,
      `${host}:${address.port}`,
    ].map((h) => h.toLowerCase()),
  );

  // Started once the server listens, so a failed start leaves nothing running.
  const heartbeat = setInterval(() => {
    for (const client of clients) client.write(': heartbeat\n\n');
  }, HEARTBEAT_MS);
  heartbeat.unref();
  if (options.watch !== false) {
    watcher = new FileWatcher({
      debounceMs: 150,
      onChange: async (files) => {
        const { manifest } = state.watchTargets();
        const sources = files.filter((file) => file !== manifest);
        if (sources.length === 0) {
          broadcast({ type: 'output', revision: state.outputChanged() });
          return;
        }
        const outcome = await state.reload('watch', sources);
        watchFiles();
        broadcast({ type: 'reload', trigger: 'watch', ...outcome });
      },
    });
    watchFiles();
  }

  return {
    url: `${origin}/?token=${token}`,
    origin,
    token,
    state,
    close: async () => {
      clearInterval(heartbeat);
      await watcher?.close();
      for (const client of clients) client.end();
      clients.clear();
      await new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}
