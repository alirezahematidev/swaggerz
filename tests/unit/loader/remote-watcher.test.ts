import { createHash } from 'node:crypto';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { documentFetchOptions } from '../../../src/loader/store.ts';
import { polledDocuments, RemoteWatcher } from '../../../src/loader/remote-watcher.ts';
import { makeConfig } from '../../helpers.ts';

/** A document server: ETags unless `validators` is off; `status` forces an error status. */
const served = { body: 'openapi: 3.1.0', validators: true, status: 200 };
const requests: IncomingHttpHeaders[] = [];
let server: Server;
let url: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    requests.push(req.headers);
    if (served.status !== 200) {
      res.writeHead(served.status).end();
      return;
    }
    const etag = `"${createHash('sha1').update(served.body).digest('hex')}"`;
    if (served.validators && req.headers['if-none-match'] === etag) {
      res.writeHead(304).end();
      return;
    }
    res.writeHead(200, {
      'content-type': 'application/yaml',
      ...(served.validators ? { etag } : {}),
    });
    res.end(served.body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/openapi.yaml`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

afterEach(() => {
  Object.assign(served, { body: 'openapi: 3.1.0', validators: true, status: 200 });
  requests.length = 0;
});

const fetchOptions = () =>
  documentFetchOptions(
    {
      fetch: { headers: {}, timeout: 5_000, maxBytes: 1_000_000 },
      policy: { external: 'local', allowedDirectories: [], allowedHosts: [] },
    },
    new URL(url),
    { isRoot: true },
  );

async function until(condition: () => boolean, timeout = 5_000): Promise<void> {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeout) throw new Error('Timed out');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function watch() {
  const events: string[] = [];
  const watcher = new RemoteWatcher({
    onChange: (urls) => {
      events.push(`change ${urls.join(',')}`);
    },
    onError: (failed, error) => {
      events.push(`error ${failed} ${error instanceof Error ? error.message : String(error)}`);
    },
    onRecover: (recovered) => {
      events.push(`recover ${recovered}`);
    },
  });
  return { events, watcher };
}

describe('RemoteWatcher', () => {
  it('polls with conditional requests and reports each new version once', async () => {
    const { events, watcher } = watch();
    try {
      watcher.set([{ url, text: served.body, fetch: fetchOptions() }], 10);
      expect(watcher.urls).toEqual([url]);
      // The first response has the same content: no change, but its ETag is used from now on.
      await until(() => requests.length >= 3);
      expect(events).toEqual([]);
      expect(requests[0]?.['if-none-match']).toBeUndefined();
      expect(requests[1]?.['if-none-match']).toMatch(/^"/);

      served.body = 'openapi: 3.1.1';
      await until(() => events.length === 1);
      expect(events).toEqual([`change ${url}`]);
      const seen = requests.length;
      await until(() => requests.length >= seen + 3);
      expect(events).toHaveLength(1);
    } finally {
      await watcher.close();
    }
  });

  it('compares content when the server sends no validators', async () => {
    served.validators = false;
    const { events, watcher } = watch();
    try {
      watcher.set([{ url, text: served.body, fetch: fetchOptions() }], 10);
      await until(() => requests.length >= 3);
      expect(events).toEqual([]);
      expect(requests.every((headers) => headers['if-none-match'] === undefined)).toBe(true);
      served.body = 'openapi: 3.1.2';
      await until(() => events.length === 1);
      expect(events).toEqual([`change ${url}`]);
    } finally {
      await watcher.close();
    }
  });

  it('reports a failing document once and a change made while it was failing', async () => {
    served.status = 503;
    const { events, watcher } = watch();
    try {
      watcher.set([{ url, text: served.body, fetch: fetchOptions() }], 10);
      await until(() => requests.length >= 4);
      expect(events).toEqual([`error ${url} HTTP 503 Service Unavailable`]);
      served.status = 200;
      served.body = 'openapi: 3.2.0';
      await until(() => events.length === 3);
      expect(events.slice(1)).toEqual([`recover ${url}`, `change ${url}`]);
    } finally {
      await watcher.close();
    }
  });

  it('treats any response as a change when the document never loaded', async () => {
    const { events, watcher } = watch();
    try {
      watcher.set([{ url, fetch: fetchOptions() }], 10);
      await until(() => events.length === 1);
      expect(events).toEqual([`change ${url}`]);
    } finally {
      await watcher.close();
    }
  });

  it('keeps the content it saw when the same documents are set again', async () => {
    const original = served.body;
    const { events, watcher } = watch();
    try {
      watcher.set([{ url, text: original, fetch: fetchOptions() }], 10);
      served.body = 'openapi: 3.1.3';
      await until(() => events.length === 1);
      // A reload that failed passes the last version that loaded; that is not a new change.
      watcher.set([{ url, text: original, fetch: fetchOptions() }], 10);
      const seen = requests.length;
      await until(() => requests.length >= seen + 3);
      expect(events).toHaveLength(1);
      watcher.set([], 10);
      expect(watcher.urls).toEqual([]);
    } finally {
      await watcher.close();
    }
  });

  it('cancels a request in flight when it closes instead of waiting for the timeout', async () => {
    // A server that accepts requests and never answers them.
    const hanging = createServer(() => undefined);
    await new Promise<void>((resolve) => hanging.listen(0, '127.0.0.1', resolve));
    const slow = `http://127.0.0.1:${(hanging.address() as AddressInfo).port}/openapi.yaml`;
    let received = 0;
    hanging.on('request', () => received++);
    const { events, watcher } = watch();
    try {
      const options = documentFetchOptions(
        {
          fetch: { headers: {}, timeout: 30_000, maxBytes: 1_000_000 },
          policy: { external: 'local', allowedDirectories: [], allowedHosts: [] },
        },
        new URL(slow),
        { isRoot: true },
      );
      watcher.set([{ url: slow, text: 'openapi: 3.1.0', fetch: options }], 10);
      await until(() => received === 1);
      const started = Date.now();
      await watcher.close();
      expect(Date.now() - started).toBeLessThan(2_000);
      // Closing is not a failure of the document.
      expect(events).toEqual([]);
    } finally {
      hanging.closeAllConnections();
      await new Promise<void>((resolve) => hanging.close(() => resolve()));
    }
  });
});

describe('polled documents', () => {
  const remote = (input: string, poll?: boolean | number) =>
    makeConfig({
      spec: { version: '3.1', input, ...(poll === undefined ? {} : { fetch: { poll } }) },
    });

  it('polls loopback hosts by default, every host when enabled and none when disabled', () => {
    const local = polledDocuments(remote('http://localhost:3000/openapi.json'), undefined);
    expect(local.map((doc) => doc.url)).toEqual(['http://localhost:3000/openapi.json']);
    expect(polledDocuments(remote('https://api.example.com/openapi.json'), undefined)).toEqual([]);
    expect(
      polledDocuments(remote('https://api.example.com/openapi.json', true), undefined),
    ).toHaveLength(1);
    expect(polledDocuments(remote('http://127.0.0.1:3000/openapi.json', false), undefined)).toEqual(
      [],
    );
    const interval = remote('https://api.example.com/openapi.json', 750).spec.fetch.poll;
    expect(interval).toEqual({ hosts: 'all', interval: 750 });
    expect(polledDocuments(remote('./openapi.yaml', true), undefined)).toEqual([]);
  });
});
