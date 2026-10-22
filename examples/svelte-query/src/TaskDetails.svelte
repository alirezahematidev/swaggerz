<script lang="ts">
  import { createGetTaskQuery } from './generated/api/svelte-query';
  import { errorMessage } from './errors.ts';

  let { taskId }: { taskId: string } = $props();

  // The accessor reads the prop, so the query follows it; `select` narrows the cached data and
  // its result type is inferred.
  const created = createGetTaskQuery(
    () => ({ taskId }),
    () => ({ select: (task) => new Date(task.createdAt).toLocaleString() }),
  );
  const notes = createGetTaskQuery(
    () => ({ taskId }),
    () => ({ select: (task) => task.notes ?? 'No notes' }),
  );
</script>

{#if created.error}
  <p role="alert">{errorMessage(created.error)}</p>
{:else}
  <aside>
    <h2>Details</h2>
    <p>Created: {created.data ?? '…'}</p>
    <p>{notes.data}</p>
  </aside>
{/if}
