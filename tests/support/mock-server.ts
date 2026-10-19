import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface RecordedRequest {
  readonly method: string;
  /** Path plus raw query string, exactly as received. */
  readonly url: string;
  readonly path: string;
  readonly rawQuery: string;
  readonly headers: IncomingHttpHeaders;
  readonly body: Buffer;
  text(): string;
  json(): unknown;
  formData(): Promise<FormData>;
}

export interface MockResponse {
  readonly status?: number;
  readonly headers?: Record<string, string>;
  /** Objects are sent as JSON unless a content-type header says otherwise. */
  readonly body?: unknown;
  /** Milliseconds to wait before responding. */
  readonly delay?: number;
  /** Destroy the socket instead of responding (simulates a network failure). */
  readonly destroy?: boolean;
}

export type MockHandler = (request: RecordedRequest) => MockResponse | Promise<MockResponse>;

export interface MockServer {
  readonly url: string;
  readonly requests: RecordedRequest[];
  /** Sets the handler for subsequent requests and clears recorded requests. */
  respond(handler: MockHandler): void;
  close(): Promise<void>;
}

/** A local HTTP server used to exercise generated clients end to end. */
export async function startMockServer(): Promise<MockServer> {
  let handler: MockHandler = () => ({ status: 200, body: { ok: true } });
  const requests: RecordedRequest[] = [];
  const server: Server = createServer((req, res) => {
    // Permissive CORS so browser-like environments (happy-dom) can call the server.
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-expose-headers', '*');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS',
        'access-control-allow-headers': req.headers['access-control-request-headers'] ?? '*',
      });
      res.end();
      return;
    }
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const url = req.url ?? '/';
      const queryIndex = url.indexOf('?');
      const recorded: RecordedRequest = {
        method: req.method ?? 'GET',
        url,
        path: queryIndex === -1 ? url : url.slice(0, queryIndex),
        rawQuery: queryIndex === -1 ? '' : url.slice(queryIndex + 1),
        headers: req.headers,
        body,
        text: () => body.toString('utf8'),
        json: () => JSON.parse(body.toString('utf8')) as unknown,
        formData: () => {
          const request = new Request('http://localhost/', {
            method: 'POST',
            headers: { 'content-type': req.headers['content-type'] ?? '' },
            body,
          });
          // Parsing multipart with the Fetch API is fine for small test payloads.
          return request.formData();
        },
      };
      requests.push(recorded);
      void Promise.resolve(handler(recorded)).then(async (response) => {
        if (response.delay !== undefined)
          await new Promise((resolve) => setTimeout(resolve, response.delay));
        if (response.destroy === true) {
          req.socket.destroy();
          return;
        }
        const headers: Record<string, string> = { ...response.headers };
        let payload: string | Buffer | undefined;
        if (Buffer.isBuffer(response.body) || typeof response.body === 'string')
          payload = response.body;
        else if (response.body !== undefined) {
          payload = JSON.stringify(response.body);
          headers['content-type'] ??= 'application/json';
        }
        res.writeHead(response.status ?? 200, headers);
        res.end(payload);
      });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    respond(next) {
      handler = next;
      requests.length = 0;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}
