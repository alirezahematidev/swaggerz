<script lang="ts">
  import { createCreateTaskMutation } from './generated/api/svelte-query';
  import { errorMessage } from './errors.ts';

  let title = $state('');
  // `invalidates` in swaggerz.config.ts refreshes the task lists after the mutation succeeds.
  const createTask = createCreateTaskMutation();

  function submit(event: SubmitEvent) {
    event.preventDefault();
    createTask.mutate({ body: { title } }, { onSuccess: () => (title = '') });
  }
</script>

<form onsubmit={submit}>
  <input bind:value={title} name="title" placeholder="New task" />
  <button disabled={createTask.isPending}>Add</button>
  {#if createTask.error}<p role="alert">{errorMessage(createTask.error)}</p>{/if}
</form>
