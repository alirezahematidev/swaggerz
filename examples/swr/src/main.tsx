import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { App } from './App.tsx';

const root = document.getElementById('root');
if (root === null) throw new Error('Missing #root element.');
createRoot(root).render(
  <StrictMode>
    <SWRConfig value={{ dedupingInterval: 10_000, shouldRetryOnError: false }}>
      <App />
    </SWRConfig>
  </StrictMode>,
);
