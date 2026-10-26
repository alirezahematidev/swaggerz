// @ts-check
/**
 * The HTTP server behind `suite.js`: the petstore endpoints the suite calls, and the generated
 * client and suite as static files (with a page that runs them) for browsers. Plain JavaScript on
 * `node:http`, so the smoke test can use it on Node.js 18.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const TYPES = /** @type {Record<string, string | undefined>} */ ({
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
});

/**
 * Page that imports a generated client, its mocks and the suites, and publishes the results. The
 * import map points `msw` at the browser bundle `scripts/runtimes.ts` builds.
 */
const PAGE = `<!doctype html>
<meta charset="utf-8" />
<title>swaggerz runtime suite</title>
<script type="importmap">{ "imports": { "msw": "/static/msw.js" } }</script>
<script type="module">
  const run = new URL(location.href).searchParams.get('run') ?? 'browser';
  const client = new URL(location.href).searchParams.get('client') ?? 'js';
  let results;
  try {
    const api = await import('/static/' + client + '/index.js');
    const { runSuite } = await import('/static/suite.js');
    results = await runSuite(api, location.origin, run);
    try {
      const mocks = await import('/static/' + client + '/mocks/index.js');
      const { runMocksSuite } = await import('/static/mocks-suite.js');
      results.push(...(await runMocksSuite(api, mocks)));
    } catch (error) {
      results.push({ name: 'mocks: load', ok: false, error: String(error && error.stack || error) });
    }
  } catch (error) {
    results = [{ name: 'load', ok: false, error: String(error && error.stack || error) }];
  }
  window.__results = results;
</script>
`;

/**
 * Starts the server on a free local port. `staticRoot` (optional) is served under `/static/`.
 * @param {{ staticRoot?: string }} [options]
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
export async function startServer(options = {}) {
  /** Requests per run id and path, for endpoints that fail once. */
  const seen = new Map();
  const server = http.createServer((req, res) => {
    // Browsers on another origin (and preflights) are allowed; same-origin pages need nothing.
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-expose-headers', '*');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS,QUERY',
        'access-control-allow-headers': req.headers['access-control-request-headers'] ?? '*',
      });
      res.end();
      return;
    }
    /** @type {Buffer[]} */
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const raw = req.url ?? '/';
      const url = new URL(raw, 'http://localhost');
      const run = String(req.headers['x-run'] ?? '');
      /** @param {number} status @param {unknown} data */
      const json = (status, data) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(data));
      };
      /** @param {string} key */
      const once = (key) => {
        const id = `${run} ${key}`;
        const count = seen.get(id) ?? 0;
        seen.set(id, count + 1);
        return count === 0;
      };

      if (url.pathname === '/browser.html') {
        res.writeHead(200, { 'content-type': TYPES['.html'] });
        res.end(PAGE);
        return;
      }
      if (url.pathname.startsWith('/static/') && options.staticRoot !== undefined) {
        const file = path.join(options.staticRoot, decodeURIComponent(url.pathname.slice(8)));
        if (!file.startsWith(options.staticRoot) || !existsSync(file) || !statSync(file).isFile()) {
          json(404, { message: 'no such file' });
          return;
        }
        res.writeHead(200, {
          'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
        });
        createReadStream(file).pipe(res);
        return;
      }
      switch (url.pathname) {
        case '/pet/findByTags':
          json(200, [
            {
              id: 1,
              name: url.searchParams.get('tags'),
              photoUrls: [],
              tag: req.headers['x-trace'],
            },
          ]);
          return;
        case '/pet/findByStatus':
          if (req.headers.authorization !== 'Bearer renewed') json(401, { message: 'expired' });
          else
            json(200, [
              { id: 1, name: 'Rex', photoUrls: [], status: url.searchParams.get('status') },
            ]);
          return;
        case '/pet':
          json(201, { id: 7, ...JSON.parse(body.toString('utf8')) });
          return;
        case '/pet/1/uploadImage':
          json(200, {
            code: 200,
            message: url.searchParams.get('additionalMetadata'),
            type: `${req.headers['content-type'] ?? ''}\n${body.toString('latin1')}`,
          });
          return;
        case '/pet/1/photo':
          res.writeHead(200, { 'content-type': 'image/png' });
          res.end(Buffer.from([137, 80, 78, 71]));
          return;
        case '/pet/2':
          setTimeout(() => json(200, {}), 2000);
          return;
        case '/store/inventory':
          if (req.headers.api_key === 'secret') json(200, { key: 1 });
          else json(401, { message: 'no key' });
          return;
        case '/store/order/503':
          if (once(url.pathname)) json(503, { message: 'busy' });
          else json(200, { id: 503, status: 'placed' });
          return;
        default:
          if (url.pathname.startsWith('/user/')) json(200, { username: raw.split('?')[0] });
          else json(404, { message: 'missing' });
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(undefined)));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
