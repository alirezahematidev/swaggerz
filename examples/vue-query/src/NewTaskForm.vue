<script setup lang="ts">
import { ref } from 'vue';
import { useCreateTask } from './generated/api/vue-query';
import { errorMessage } from './errors.ts';

const title = ref('');
// `invalidates` in swaggerz.config.ts refreshes the task lists after the mutation succeeds.
const createTask = useCreateTask();

function submit() {
  createTask.mutate({ body: { title: title.value } }, { onSuccess: () => (title.value = '') });
}
</script>

<template>
  <form @submit.prevent="submit">
    <input v-model="title" name="title" placeholder="New task" />
    <button :disabled="createTask.isPending.value">Add</button>
    <p v-if="createTask.error.value" role="alert">{{ errorMessage(createTask.error.value) }}</p>
  </form>
</template>
