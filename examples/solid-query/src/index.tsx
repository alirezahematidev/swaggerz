import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { render } from 'solid-js/web';
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
void startMocks().then(() =>
  render(
    () => (
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    ),
    root,
  ),
);
