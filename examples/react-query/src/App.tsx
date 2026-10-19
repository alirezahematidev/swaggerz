import { useState, type FormEvent } from 'react';
import { isApiError, type OperationError, type Task, type TaskStatus } from './generated/api';
import {
  useCreateTask,
  useDeleteTask,
  useGetTask,
  useListTasksInfinite,
  useUpdateTask,
} from './generated/api/react-query';

const STATUSES: readonly TaskStatus[] = ['todo', 'doing', 'done'];

/** A readable message for any error an operation can reject with. */
function errorMessage(error: OperationError<unknown>): string {
  if (isApiError(error)) {
    const body = error.body as { title?: unknown } | undefined;
    return typeof body?.title === 'string' ? body.title : `HTTP ${error.status}`;
  }
  // RequestError: network failure, timeout, or a response that failed Zod validation.
  return `${error.kind}: ${error.message}`;
}

export function App() {
  const [status, setStatus] = useState<TaskStatus | undefined>(undefined);
  const [selected, setSelected] = useState<string | undefined>(undefined);

  // Every parameter is part of the query key, so each filter is cached separately.
  const tasks = useListTasksInfinite(
    { status, limit: 2 },
    { initialPageParam: undefined, getNextPageParam: (page) => page.nextCursor },
  );

  return (
    <main
      style={{ fontFamily: 'system-ui', maxWidth: 640, margin: '2rem auto', padding: '0 1rem' }}
    >
      <h1>Tasks</h1>
      <NewTaskForm />
      <p>
        Show:{' '}
        <select
          name="status"
          value={status ?? ''}
          onChange={(event) => {
            const value = STATUSES.find((s) => s === event.target.value);
            setStatus(value);
          }}
        >
          <option value="">all</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </p>
      {tasks.isPending && <p>Loading…</p>}
      {tasks.isError && <p role="alert">{errorMessage(tasks.error)}</p>}
      <ul>
        {tasks.data?.pages
          .flatMap((page) => page.items)
          .map((task) => (
            <TaskItem key={task.id} task={task} onSelect={() => setSelected(task.id)} />
          ))}
      </ul>
      {tasks.hasNextPage && (
        <button disabled={tasks.isFetchingNextPage} onClick={() => void tasks.fetchNextPage()}>
          {tasks.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}
      {selected !== undefined && <TaskDetails taskId={selected} />}
    </main>
  );
}

function NewTaskForm() {
  const [title, setTitle] = useState('');
  // `invalidates` in swaggerz.config.ts refreshes the task lists after the mutation succeeds.
  const createTask = useCreateTask();

  function submit(event: FormEvent) {
    event.preventDefault();
    createTask.mutate({ body: { title } }, { onSuccess: () => setTitle('') });
  }

  return (
    <form onSubmit={submit}>
      <input
        name="title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="New task"
      />
      <button disabled={createTask.isPending}>Add</button>
      {createTask.isError && <p role="alert">{errorMessage(createTask.error)}</p>}
    </form>
  );
}

function TaskItem({ task, onSelect }: { task: Task; onSelect: () => void }) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const next: TaskStatus = task.status === 'todo' ? 'doing' : 'done';

  return (
    <li>
      <button onClick={onSelect}>{task.title}</button> <small>{task.status}</small>{' '}
      {task.status !== 'done' && (
        <button onClick={() => updateTask.mutate({ taskId: task.id, body: { status: next } })}>
          → {next}
        </button>
      )}
      <button onClick={() => deleteTask.mutate({ taskId: task.id })}>Delete</button>
    </li>
  );
}

function TaskDetails({ taskId }: { taskId: string }) {
  // `select` narrows the cached data; its result type is inferred.
  const created = useGetTask(
    { taskId },
    { select: (task) => new Date(task.createdAt).toLocaleString() },
  );
  const notes = useGetTask({ taskId }, { select: (task) => task.notes ?? 'No notes' });

  if (created.isError) return <p role="alert">{errorMessage(created.error)}</p>;
  return (
    <aside>
      <h2>Details</h2>
      <p>Created: {created.data ?? '…'}</p>
      <p>{notes.data}</p>
    </aside>
  );
}
