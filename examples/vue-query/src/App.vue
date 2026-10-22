<script setup lang="ts">
import { ref } from 'vue';
import type { TaskStatus } from './generated/api';
import { useListTasksInfinite } from './generated/api/vue-query';
import { errorMessage } from './errors.ts';
import NewTaskForm from './NewTaskForm.vue';
import TaskDetails from './TaskDetails.vue';
import TaskItem from './TaskItem.vue';

const STATUSES: readonly TaskStatus[] = ['todo', 'doing', 'done'];
const status = ref<TaskStatus | undefined>(undefined);
const selected = ref<string | undefined>(undefined);

// Parameters may be getters: changing the filter refetches, and every filter is cached
// separately because every parameter is part of the query key.
const tasks = useListTasksInfinite(() => ({ status: status.value, limit: 2 }), {
  initialPageParam: undefined,
  getNextPageParam: (page) => page.nextCursor,
});

function setStatus(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  status.value = STATUSES.find((s) => s === value);
}
</script>

<template>
  <main style="font-family: system-ui; max-width: 640px; margin: 2rem auto; padding: 0 1rem">
    <h1>Tasks</h1>
    <NewTaskForm />
    <p>
      Show:
      <select name="status" :value="status ?? ''" @change="setStatus">
        <option value="">all</option>
        <option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option>
      </select>
    </p>
    <p v-if="tasks.isPending.value">Loading…</p>
    <p v-if="tasks.error.value" role="alert">{{ errorMessage(tasks.error.value) }}</p>
    <ul>
      <template v-for="page in tasks.data.value?.pages ?? []">
        <TaskItem
          v-for="task in page.items"
          :key="task.id"
          :task="task"
          @select="selected = task.id"
        />
      </template>
    </ul>
    <button
      v-if="tasks.hasNextPage.value"
      :disabled="tasks.isFetchingNextPage.value"
      @click="tasks.fetchNextPage()"
    >
      {{ tasks.isFetchingNextPage.value ? 'Loading…' : 'Load more' }}
    </button>
    <TaskDetails v-if="selected !== undefined" :task-id="selected" />
  </main>
</template>
