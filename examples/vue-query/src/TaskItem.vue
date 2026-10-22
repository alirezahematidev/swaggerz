<script setup lang="ts">
import { computed } from 'vue';
import type { Task, TaskStatus } from './generated/api';
import { useDeleteTask, useUpdateTask } from './generated/api/vue-query';

const props = defineProps<{ task: Task }>();
defineEmits<{ select: [] }>();

const updateTask = useUpdateTask();
const deleteTask = useDeleteTask();
const next = computed<TaskStatus>(() => (props.task.status === 'todo' ? 'doing' : 'done'));
</script>

<template>
  <li>
    <button @click="$emit('select')">{{ task.title }}</button> <small>{{ task.status }}</small>
    <button
      v-if="task.status !== 'done'"
      @click="updateTask.mutate({ taskId: task.id, body: { status: next } })"
    >
      → {{ next }}
    </button>
    <button @click="deleteTask.mutate({ taskId: task.id })">Delete</button>
  </li>
</template>
