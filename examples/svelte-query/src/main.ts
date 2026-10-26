import { mount } from 'svelte';
import App from './App.svelte';
import { startMocks } from './generated/api/mocks/start.ts';

// During development, the generated mocks answer the API (with the handlers of src/mocks.ts
// first); render once they are ready. Production builds contain neither MSW nor the mocks.
if (import.meta.env.DEV)
  await startMocks({ handlers: () => import('./mocks.ts').then((mocks) => mocks.handlers) });

const target = document.getElementById('root');
if (target === null) throw new Error('Missing #root element.');
mount(App, { target });
