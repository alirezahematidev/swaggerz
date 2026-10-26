import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 10_000 } } });

/** During development, the generated mocks serve the API (src/mocks.ts) before the first request. */
async function startMocks(): Promise<void> {
  if (!import.meta.env.DEV) return;
  const { worker } = await import('./mocks.ts');
  await worker.start({ onUnhandledFrame: 'bypass', quiet: true });
}

const root = document.getElementById('root');
if (root === null) throw new Error('Missing #root element.');
void startMocks().then(() => {
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
});
