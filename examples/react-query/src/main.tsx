import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { startMocks } from './generated/api/mocks/start.ts';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 10_000 } } });

// During development, the generated mocks answer the API (with the handlers of src/mocks.ts
// first); render once they are ready. Production builds contain neither MSW nor the mocks.
if (import.meta.env.DEV)
  await startMocks({ handlers: () => import('./mocks.ts').then((mocks) => mocks.handlers) });

const root = document.getElementById('root');
if (root === null) throw new Error('Missing #root element.');
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
