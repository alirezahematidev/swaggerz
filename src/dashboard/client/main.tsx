import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initToken } from './api.ts';
import { App } from './app.tsx';
import { initStyleNonce } from './lib/nonce.ts';
import { applyStoredTheme } from './lib/theme.ts';

applyStoredTheme();
initStyleNonce();

const root = document.getElementById('app');
if (root !== null) {
  if (initToken() === undefined) {
    root.textContent =
      'Missing session token. Open the dashboard using the link printed by the CLI.';
    root.className = 'p-10 font-sans text-sm';
  } else {
    root.textContent = '';
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }
}
