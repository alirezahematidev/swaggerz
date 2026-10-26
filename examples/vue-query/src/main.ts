import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createApp } from 'vue';
import App from './App.vue';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 10_000 } } });

/** During development, the generated mocks serve the API (src/mocks.ts) before the first request. */
async function startMocks(): Promise<void> {
  if (!import.meta.env.DEV) return;
  const { worker } = await import('./mocks.ts');
  await worker.start({ onUnhandledFrame: 'bypass', quiet: true });
}

void startMocks().then(() => {
  createApp(App).use(VueQueryPlugin, { queryClient }).mount('#root');
});
