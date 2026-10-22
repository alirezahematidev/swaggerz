/**
 * An in-memory implementation of `openapi.yaml` for the Vite dev server. It is typed with the
 * generated models, so it breaks at compile time when the specification changes.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import type { NewTask, Problem, Task, TaskPage, TaskUpdate } from './src/generated/api/index.ts';

const tasks: Task[] = [
  {
    id: '3',
    title: 'Ship the release',
    status: 'todo',
    notes: null,
    createdAt: '2026-01-03T10:00:00Z',
  },
  {
    id: '2',
    title: 'Write the changelog',
    status: 'doing',
    notes: 'Group by feature',
    createdAt: '2026-01-02T10:00:00Z',
  },
  {
    id: '1',
    title: 'Generate the client',
    status: 'done',
    notes: null,
    createdAt: '2026-01-01T10:00:00Z',
  },
];
let nextId = tasks.length + 1;

function send(res: ServerResponse, status: number, body?: Task | TaskPage | Problem): void {
  res.statusCode = status;
  if (body === undefined) {
    res.end();
    return;
  }
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/tasks' && req.method === 'GET') {
    const status = url.searchParams.get('status');
    const limit = Number(url.searchParams.get('limit') ?? '10');
    const matching = tasks.filter((task) => status === null || task.status === status);
    const start = Number(url.searchParams.get('cursor') ?? '0');
    const page: TaskPage = { items: matching.slice(start, start + limit) };
    if (start + limit < matching.length) page.nextCursor = String(start + limit);
    send(res, 200, page);
    return;
  }
  if (url.pathname === '/tasks' && req.method === 'POST') {
    const input = (await readJson(req)) as NewTask;
    if (input.title.trim() === '') {
      send(res, 422, { title: 'Invalid task', detail: 'The title must not be empty.' });
      return;
    }
    const task: Task = {
      id: String(nextId++),
      title: input.title,
      status: 'todo',
      notes: input.notes ?? null,
      createdAt: new Date().toISOString(),
    };
    tasks.unshift(task);
    send(res, 201, task);
    return;
  }
  const match = /^\/tasks\/([^/]+)$/.exec(url.pathname);
  const index = match === null ? -1 : tasks.findIndex((task) => task.id === match[1]);
  const task = tasks[index];
  if (task === undefined) {
    send(res, 404, { title: 'Not found' });
    return;
  }
  if (req.method === 'GET') send(res, 200, task);
  else if (req.method === 'PATCH') {
    const update = (await readJson(req)) as TaskUpdate;
    const updated: Task = { ...task, ...update };
    tasks[index] = updated;
    send(res, 200, updated);
  } else if (req.method === 'DELETE') {
    tasks.splice(index, 1);
    send(res, 204);
  } else send(res, 405, { title: 'Method not allowed' });
}

export function mockApi(): Plugin {
  return {
    name: 'tasks-mock-api',
    configureServer(server) {
      server.middlewares.use('/api', (req, res) => {
        // Simulate a little latency so loading states are visible.
        setTimeout(() => {
          handle(req, res).catch((error: unknown) => {
            send(res, 500, { title: 'Server error', detail: String(error) });
          });
        }, 300);
      });
    },
  };
}
