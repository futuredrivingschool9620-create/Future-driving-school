import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

window.addEventListener('error', (event) => {
  console.error('[Global Error]:', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]:', event.reason);
});

try {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  }
} catch (err: any) {
  console.error('[Fatal Mount Error]:', err);
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;color:white;font-family:sans-serif;padding:24px;">
        <div style="max-width:500px;text-align:center;">
          <h2 style="font-size:20px;font-weight:bold;margin-bottom:12px;">Failed to initialize application</h2>
          <p style="color:#94a3b8;font-size:13px;margin-bottom:16px;">${err?.message || 'An unexpected error occurred during startup.'}</p>
          <button onclick="window.location.reload()" style="padding:8px 18px;border-radius:8px;background:#14b8a6;color:white;border:none;cursor:pointer;font-weight:600;">Reload App</button>
        </div>
      </div>
    `;
  }
}
