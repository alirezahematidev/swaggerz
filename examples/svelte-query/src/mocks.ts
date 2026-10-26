/**
 * The Tasks API in the browser, made of the generated Mock Service Worker handlers: fixtures seed
 * an in-memory list that the handlers read and change. `main.ts` passes them to the generated
 * `startMocks()` during development. The handlers and fixtures are typed with the generated
 * models, so this file stops compiling when the specification changes.
 */
import { HttpResponse } from 'msw';
import type { Problem, Task } from './generated/api';
import {
  makeTask,
  mockCreateTask,
  mockDeleteTask,
  mockGetTask,
  mockListTasks,
  mockUpdateTask,
} from './generated/api/mocks';

const tasks: Task[] = [
  makeTask({
    id: '3',
    title: 'Ship the release',
    status: 'todo',
    notes: null,
    createdAt: '2026-01-03T10:00:00Z',
  }),
  makeTask({
    id: '2',
    title: 'Write the changelog',
    status: 'doing',
    notes: 'Group by feature',
    createdAt: '2026-01-02T10:00:00Z',
  }),
  makeTask({
    id: '1',
    title: 'Generate the client',
    status: 'done',
    notes: null,
    createdAt: '2026-01-01T10:00:00Z',
  }),
];
let nextId = tasks.length + 1;

/** A little latency, so loading states are visible. */
const latency = { delay: 300 };

/** An error response the handler does not send by default (a body function can return one). */
function problem(status: 404 | 422, title: string, detail?: string): Response {
  const body: Problem = { title, ...(detail === undefined ? {} : { detail }) };
  return HttpResponse.json(body, { status });
}

const indexOf = (id: string): number => tasks.findIndex((task) => task.id === id);

export const handlers = [
  mockListTasks({
    ...latency,
    body: ({ query }) => {
      const status = query.get('status');
      const limit = Number(query.get('limit') ?? '10');
      const start = Number(query.get('cursor') ?? '0');
      const matching = tasks.filter((task) => status === null || task.status === status);
      const end = start + limit;
      return {
        items: matching.slice(start, end),
        ...(end < matching.length ? { nextCursor: String(end) } : {}),
      };
    },
  }),
  mockCreateTask({
    ...latency,
    body: async ({ body }) => {
      const input = await body();
      if (input.title.trim() === '')
        return problem(422, 'Invalid task', 'The title must not be empty.');
      const task = makeTask({
        id: String(nextId++),
        title: input.title,
        status: 'todo',
        notes: input.notes ?? null,
        createdAt: new Date().toISOString(),
      });
      tasks.unshift(task);
      return task;
    },
  }),
  mockGetTask({
    ...latency,
    body: ({ params }) => tasks[indexOf(params.taskId)] ?? problem(404, 'Not found'),
  }),
  mockUpdateTask({
    ...latency,
    body: async ({ params, body }) => {
      const index = indexOf(params.taskId);
      const task = tasks[index];
      if (task === undefined) return problem(404, 'Not found');
      const updated: Task = { ...task, ...(await body()) };
      tasks[index] = updated;
      return updated;
    },
  }),
  mockDeleteTask({
    ...latency,
    body: ({ params }) => {
      const index = indexOf(params.taskId);
      if (index === -1) return problem(404, 'Not found');
      tasks.splice(index, 1);
      return undefined;
    },
  }),
];
