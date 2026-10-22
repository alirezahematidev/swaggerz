import { useState, type FormEvent } from 'react';
import { isApiError, type OperationError, type Task, type TaskStatus } from './generated/api';
import {
  useCreateTask,
  useDeleteTask,
  useGetTask,
  useListTasksInfinite,
  useUpdateTask,
} from './generated/api/swr';

const STATUSES: readonly TaskStatus[] = ['todo', 'doing', 'done'];

/** A readable message for any error an operation can reject with. */
function errorMessage(error: OperationError<unknown>): string {
  if (isApiError(error)) {
    const body = error.body as { title?: unknown } | undefined;
    return typeof body?.title === 'string' ? body.title : `HTTP ${error.status}`;
  }
  // RequestError: network failure, timeout, or a response that failed ArkType validation.
  return `${error.kind}: ${error.message}`;
}

export function App() {
  const [status, setStatus] = useState<TaskStatus | undefined>(undefined);
  const [selected, setSelected] = useState<string | undefined>(undefined);

  // Every parameter is part of the key, so each filter is cached separately.
  const tasks = useListTasksInfinite(
    { status, limit: 2 },
    { initialPageParam: undefined, getNextPageParam: (page) => page.nextCursor },
  );
  const pages = tasks.data ?? [];
  const hasMore = pages.at(-1)?.nextCursor !== undefined;

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
      {tasks.isLoading && <p>Loading…</p>}
      {tasks.error !== undefined && <p role="alert">{errorMessage(tasks.error)}</p>}
      <ul>
        {pages
          .flatMap((page) => page.items)
          .map((task) => (
            <TaskItem key={task.id} task={task} onSelect={() => setSelected(task.id)} />
          ))}
      </ul>
      {hasMore && (
        <button disabled={tasks.isValidating} onClick={() => void tasks.setSize(tasks.size + 1)}>
          {tasks.isValidating ? 'Loading…' : 'Load more'}
        </button>
      )}
      {selected !== undefined && <TaskDetails taskId={selected} />}
    </main>
  );
}

function NewTaskForm() {
  const [title, setTitle] = useState('');
  // `invalidates` in swaggerz.config.ts revalidates the task lists after the mutation succeeds.
  const createTask = useCreateTask();

  async function submit(event: FormEvent) {
    event.preventDefault();
    await createTask.trigger({ body: { title } });
    setTitle('');
  }

  return (
    <form onSubmit={(event) => void submit(event).catch(() => undefined)}>
      <input
        name="title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="New task"
      />
      <button disabled={createTask.isMutating}>Add</button>
      {createTask.error !== undefined && <p role="alert">{errorMessage(createTask.error)}</p>}
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
        <button
          onClick={() => void updateTask.trigger({ taskId: task.id, body: { status: next } })}
        >
          → {next}
        </button>
      )}
      <button onClick={() => void deleteTask.trigger({ taskId: task.id })}>Delete</button>
    </li>
  );
}

function TaskDetails({ taskId }: { taskId: string }) {
  const task = useGetTask({ taskId });

  if (task.error !== undefined) return <p role="alert">{errorMessage(task.error)}</p>;
  return (
    <aside>
      <h2>Details</h2>
      <p>
        Created: {task.data === undefined ? '…' : new Date(task.data.createdAt).toLocaleString()}
      </p>
      <p>{task.data?.notes ?? 'No notes'}</p>
    </aside>
  );
}
