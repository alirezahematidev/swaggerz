<script lang="ts">
  import type { TaskStatus } from './generated/api';
  import { createListTasksInfiniteQuery } from './generated/api/svelte-query';
  import { errorMessage } from './errors.ts';
  import NewTaskForm from './NewTaskForm.svelte';
  import TaskDetails from './TaskDetails.svelte';
  import TaskItem from './TaskItem.svelte';

  const STATUSES: readonly TaskStatus[] = ['todo', 'doing', 'done'];
  let status = $state<TaskStatus | undefined>(undefined);
  let selected = $state<string | undefined>(undefined);

  // Parameters are accessors read reactively: changing the filter refetches, and every filter is
  // cached separately because every parameter is part of the query key.
  const tasks = createListTasksInfiniteQuery(
    () => ({ status, limit: 2 }),
    () => ({ initialPageParam: undefined, getNextPageParam: (page) => page.nextCursor }),
  );

  function setStatus(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    status = STATUSES.find((s) => s === value);
  }
</script>

<main style="font-family: system-ui; max-width: 640px; margin: 2rem auto; padding: 0 1rem">
  <h1>Tasks</h1>
  <NewTaskForm />
  <p>
    Show:
    <select name="status" value={status ?? ''} onchange={setStatus}>
      <option value="">all</option>
      {#each STATUSES as s (s)}
        <option value={s}>{s}</option>
      {/each}
    </select>
  </p>
  {#if tasks.isPending}<p>Loading…</p>{/if}
  {#if tasks.error}<p role="alert">{errorMessage(tasks.error)}</p>{/if}
  <ul>
    {#each tasks.data?.pages.flatMap((page) => page.items) ?? [] as task (task.id)}
      <TaskItem {task} onselect={() => (selected = task.id)} />
    {/each}
  </ul>
  {#if tasks.hasNextPage}
    <button disabled={tasks.isFetchingNextPage} onclick={() => tasks.fetchNextPage()}>
      {tasks.isFetchingNextPage ? 'Loading…' : 'Load more'}
    </button>
  {/if}
  {#if selected !== undefined}<TaskDetails taskId={selected} />{/if}
</main>
