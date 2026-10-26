import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { App } from './App.tsx';

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
      <SWRConfig value={{ dedupingInterval: 10_000, shouldRetryOnError: false }}>
        <App />
      </SWRConfig>
    </StrictMode>,
  );
});
