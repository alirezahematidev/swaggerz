<script lang="ts">
  import type { Task, TaskStatus } from './generated/api';
  import {
    createDeleteTaskMutation,
    createUpdateTaskMutation,
  } from './generated/api/svelte-query';

  let { task, onselect }: { task: Task; onselect: () => void } = $props();

  const updateTask = createUpdateTaskMutation();
  const deleteTask = createDeleteTaskMutation();
  const next: TaskStatus = $derived(task.status === 'todo' ? 'doing' : 'done');
</script>

<li>
  <button onclick={onselect}>{task.title}</button> <small>{task.status}</small>
  {#if task.status !== 'done'}
    <button onclick={() => updateTask.mutate({ taskId: task.id, body: { status: next } })}>
      → {next}
    </button>
  {/if}
  <button onclick={() => deleteTask.mutate({ taskId: task.id })}>Delete</button>
</li>
