// @ts-check
/**
 * The Tasks API, made of the generated Mock Service Worker handlers: fixtures seed an in-memory
 * list that the handlers' response functions read and change. index.js serves them with MSW's
 * `setupServer()`, which answers the client's requests inside this process.
 */
import {
  makeTask,
  mockCreateTask,
  mockGetTask,
  mockListTasks,
} from './generated/api/mocks/index.js';

/** @type {import('./generated/api/index.js').Task[]} */
const tasks = [
  makeTask({ id: 1, title: 'Read the README', status: 'done', tags: ['docs'], dueDate: null }),
];

/**
 * Handlers that check the API key, as the real API does.
 *
 * @param {string} apiKey
 */
export function taskHandlers(apiKey) {
  /**
   * A `401` for requests without the key; handlers may return any `Response`.
   *
   * @param {Request} request
   */
  const unauthorized = (request) =>
    request.headers.get('x-api-key') === apiKey
      ? undefined
      : Response.json({ title: 'Missing or wrong API key' }, { status: 401 });

  return [
    mockListTasks({
      body: ({ request, query }) => {
        const status = query.get('status');
        const tags = query.getAll('tag');
        return (
          unauthorized(request) ??
          tasks.filter(
            (task) =>
              (status === null || task.status === status) &&
              tags.every((tag) => task.tags.includes(tag)),
          )
        );
      },
    }),
    mockCreateTask({
      body: async ({ request, body }) => {
        const denied = unauthorized(request);
        if (denied !== undefined) return denied;
        const input = await body();
        const task = makeTask({
          id: tasks.length + 1,
          title: input.title,
          status: 'todo',
          tags: input.tags ?? [],
          dueDate: input.dueDate ?? null,
        });
        tasks.push(task);
        return task;
      },
    }),
    mockGetTask({
      body: ({ request, params }) =>
        unauthorized(request) ??
        tasks.find((task) => task.id === Number(params.taskId)) ??
        // The documented 404, with the body the spec describes.
        Response.json({ title: `No task at /tasks/${params.taskId}` }, { status: 404 }),
    }),
  ];
}
