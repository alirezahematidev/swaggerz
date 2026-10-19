// @ts-check
/**
 * A tiny in-memory implementation of openapi.yaml so the example runs without a backend.
 * Replace it with your real API by changing `baseUrl`.
 */
import http from 'node:http';

/** @typedef {import('./generated/api/index.js').Task} Task */
/** @typedef {import('./generated/api/index.js').NewTask} NewTask */

/** @type {Task[]} */
const tasks = [{ id: 1, title: 'Read the README', status: 'done', tags: ['docs'], dueDate: null }];

/**
 * Starts the server on a random local port.
 *
 * @param {{ apiKey: string }} options
 * @returns {Promise<{ url: string, close: () => void }>}
 */
export async function startServer({ apiKey }) {
  const server = http.createServer((req, res) => {
    /** @param {number} status @param {unknown} body */
    const send = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.headers['x-api-key'] !== apiKey)
      return send(401, { title: 'Missing or wrong API key' });
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname === '/tasks' && req.method === 'GET') {
      const status = url.searchParams.get('status');
      const tags = url.searchParams.getAll('tag');
      return send(
        200,
        tasks.filter(
          (task) =>
            (status === null || task.status === status) &&
            tags.every((tag) => task.tags.includes(tag)),
        ),
      );
    }
    if (url.pathname === '/tasks' && req.method === 'POST') {
      let raw = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        /** @type {NewTask} */
        const input = JSON.parse(raw);
        /** @type {Task} */
        const task = {
          id: tasks.length + 1,
          title: input.title,
          status: 'todo',
          tags: input.tags ?? [],
          dueDate: input.dueDate ?? null,
        };
        tasks.push(task);
        send(201, task);
      });
      return;
    }
    const match = /^\/tasks\/(\d+)$/.exec(url.pathname);
    const task = match && tasks.find((t) => t.id === Number(match[1]));
    if (task) return send(200, task);
    send(404, { title: `No task at ${url.pathname}` });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(undefined)));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  return { url: `http://127.0.0.1:${port}`, close: () => server.close() };
}
