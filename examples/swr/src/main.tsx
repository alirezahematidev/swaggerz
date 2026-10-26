import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { App } from './App.tsx';
import { startMocks } from './generated/api/mocks/start.ts';

// During development, the generated mocks answer the API (with the handlers of src/mocks.ts
// first); render once they are ready. Production builds contain neither MSW nor the mocks.
if (import.meta.env.DEV)
  await startMocks({ handlers: () => import('./mocks.ts').then((mocks) => mocks.handlers) });

const root = document.getElementById('root');
if (root === null) throw new Error('Missing #root element.');
createRoot(root).render(
  <StrictMode>
    <SWRConfig value={{ dedupingInterval: 10_000, shouldRetryOnError: false }}>
      <App />
    </SWRConfig>
  </StrictMode>,
);
