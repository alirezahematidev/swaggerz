import { mount } from 'svelte';
import App from './App.svelte';

/** During development, the generated mocks serve the API (src/mocks.ts) before the first request. */
async function startMocks(): Promise<void> {
  if (!import.meta.env.DEV) return;
  const { worker } = await import('./mocks.ts');
  await worker.start({ onUnhandledFrame: 'bypass', quiet: true });
}

const target = document.getElementById('root');
if (target === null) throw new Error('Missing #root element.');
void startMocks().then(() => mount(App, { target }));
