import { createSignal, For, Show } from 'solid-js';
import { isApiError, type OperationError, type Task, type TaskStatus } from './generated/api';
import {
  createCreateTaskMutation,
  createDeleteTaskMutation,
  createGetTaskQuery,
  createListTasksInfiniteQuery,
  createUpdateTaskMutation,
} from './generated/api/solid-query';

const STATUSES: readonly TaskStatus[] = ['todo', 'doing', 'done'];

/** A readable message for any error an operation can reject with. */
function errorMessage(error: OperationError<unknown>): string {
  if (isApiError(error)) {
    const body = error.body as { title?: unknown } | undefined;
    return typeof body?.title === 'string' ? body.title : `HTTP ${error.status}`;
  }
  // RequestError: network failure, timeout, or a response the client could not parse.
  return `${error.kind}: ${error.message}`;
}

export function App() {
  const [status, setStatus] = createSignal<TaskStatus | undefined>(undefined);
  const [selected, setSelected] = createSignal<string | undefined>(undefined);

  // Parameters are accessors read reactively: changing the filter refetches, and every filter is
  // cached separately because every parameter is part of the query key.
  const tasks = createListTasksInfiniteQuery(
    () => ({ status: status(), limit: 2 }),
    () => ({ initialPageParam: undefined, getNextPageParam: (page) => page.nextCursor }),
  );

  return (
    <main
      style={{
        'font-family': 'system-ui',
        'max-width': '640px',
        margin: '2rem auto',
        padding: '0 1rem',
      }}
    >
      <h1>Tasks</h1>
      <NewTaskForm />
      <p>
        Show:{' '}
        <select
          name="status"
          value={status() ?? ''}
          onChange={(event) => setStatus(STATUSES.find((s) => s === event.currentTarget.value))}
        >
          <option value="">all</option>
          <For each={STATUSES}>{(s) => <option value={s}>{s}</option>}</For>
        </select>
      </p>
      <Show when={tasks.isPending}>
        <p>Loading…</p>
      </Show>
      <Show when={tasks.error}>{(error) => <p role="alert">{errorMessage(error())}</p>}</Show>
      <ul>
        <For each={tasks.data?.pages.flatMap((page) => page.items) ?? []}>
          {(task) => <TaskItem task={task} onSelect={() => setSelected(task.id)} />}
        </For>
      </ul>
      <Show when={tasks.hasNextPage}>
        <button disabled={tasks.isFetchingNextPage} onClick={() => void tasks.fetchNextPage()}>
          {tasks.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      </Show>
      <Show when={selected()}>{(taskId) => <TaskDetails taskId={taskId()} />}</Show>
    </main>
  );
}

function NewTaskForm() {
  const [title, setTitle] = createSignal('');
  // `invalidates` in swaggerz.config.ts refreshes the task lists after the mutation succeeds.
  const createTask = createCreateTaskMutation();

  function submit(event: SubmitEvent) {
    event.preventDefault();
    createTask.mutate({ body: { title: title() } }, { onSuccess: () => setTitle('') });
  }

  return (
    <form onSubmit={submit}>
      <input
        name="title"
        value={title()}
        onInput={(event) => setTitle(event.currentTarget.value)}
        placeholder="New task"
      />
      <button disabled={createTask.isPending}>Add</button>
      <Show when={createTask.error}>{(error) => <p role="alert">{errorMessage(error())}</p>}</Show>
    </form>
  );
}

function TaskItem(props: { task: Task; onSelect: () => void }) {
  const updateTask = createUpdateTaskMutation();
  const deleteTask = createDeleteTaskMutation();
  const next = (): TaskStatus => (props.task.status === 'todo' ? 'doing' : 'done');

  return (
    <li>
      <button onClick={() => props.onSelect()}>{props.task.title}</button>{' '}
      <small>{props.task.status}</small>{' '}
      <Show when={props.task.status !== 'done'}>
        <button
          onClick={() => updateTask.mutate({ taskId: props.task.id, body: { status: next() } })}
        >
          → {next()}
        </button>
      </Show>
      <button onClick={() => deleteTask.mutate({ taskId: props.task.id })}>Delete</button>
    </li>
  );
}

function TaskDetails(props: { taskId: string }) {
  // The accessor reads the prop, so the query follows it; `select` narrows the cached data and
  // its result type is inferred.
  const created = createGetTaskQuery(
    () => ({ taskId: props.taskId }),
    () => ({ select: (task) => new Date(task.createdAt).toLocaleString() }),
  );
  const notes = createGetTaskQuery(
    () => ({ taskId: props.taskId }),
    () => ({ select: (task) => task.notes ?? 'No notes' }),
  );

  return (
    <Show when={!created.error} fallback={<p role="alert">{errorMessage(created.error!)}</p>}>
      <aside>
        <h2>Details</h2>
        <p>Created: {created.data ?? '…'}</p>
        <p>{notes.data}</p>
      </aside>
    </Show>
  );
}
