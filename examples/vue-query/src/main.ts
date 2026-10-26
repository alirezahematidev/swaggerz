import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createApp } from 'vue';
import App from './App.vue';
import { startMocks } from './generated/api/mocks/start.ts';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 10_000 } } });

// During development, the generated mocks answer the API (with the handlers of src/mocks.ts
// first); render once they are ready. Production builds contain neither MSW nor the mocks.
if (import.meta.env.DEV)
  await startMocks({ handlers: () => import('./mocks.ts').then((mocks) => mocks.handlers) });

createApp(App).use(VueQueryPlugin, { queryClient }).mount('#root');
