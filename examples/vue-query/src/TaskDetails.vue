<script setup lang="ts">
import { useGetTask } from './generated/api/vue-query';
import { errorMessage } from './errors.ts';

const props = defineProps<{ taskId: string }>();

// A getter keeps the query in step with the prop; `select` narrows the cached data and its
// result type is inferred.
const created = useGetTask(() => ({ taskId: props.taskId }), {
  select: (task) => new Date(task.createdAt).toLocaleString(),
});
const notes = useGetTask(() => ({ taskId: props.taskId }), {
  select: (task) => task.notes ?? 'No notes',
});
</script>

<template>
  <p v-if="created.error.value" role="alert">{{ errorMessage(created.error.value) }}</p>
  <aside v-else>
    <h2>Details</h2>
    <p>Created: {{ created.data.value ?? '…' }}</p>
    <p>{{ notes.data.value }}</p>
  </aside>
</template>
