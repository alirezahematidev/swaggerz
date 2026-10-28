/**
 * The Tasks API, answered in this process by the generated Mock Service Worker handlers over a
 * fixed list of tasks. Typed with the generated models: it stops compiling when the
 * specification changes.
 */
import { HttpResponse } from 'msw';
import type { Problem, Task } from './generated/api';
import { makeTask, mockGetTask, mockListTasks } from './generated/api/mocks';

const tasks: Task[] = [
  makeTask({ id: '3', title: 'Ship the release', status: 'todo', notes: null }),
  makeTask({ id: '2', title: 'Write the changelog', status: 'doing', notes: 'Group by feature' }),
  makeTask({ id: '1', title: 'Generate the client', status: 'done', notes: null }),
];

export const handlers = [
  mockListTasks({
    body: ({ query }) => {
      const status = query.get('status');
      return { items: tasks.filter((task) => status === null || task.status === status) };
    },
  }),
  mockGetTask({
    body: ({ params }) =>
      tasks.find((task) => task.id === params.taskId) ??
      HttpResponse.json({ title: 'Not found' } satisfies Problem, { status: 404 }),
  }),
];
