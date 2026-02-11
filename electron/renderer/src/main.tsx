/**
 * LOCAL-CLI-UI - Entry Point
 * Modern Electron React application
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

// Global error handlers for uncaught errors
window.onerror = (message, source, lineno, colno, error) => {
  window.electronAPI?.log?.error('[Global] Uncaught error', { message, source, lineno, colno, error: error instanceof Error ? error.message : String(error) });
  return false;
};

window.onunhandledrejection = (event) => {
  window.electronAPI?.log?.error('[Global] Unhandled promise rejection', { reason: event.reason instanceof Error ? event.reason.message : String(event.reason) });
};

// Mount the application
const root = document.getElementById('root');

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} else {
  window.electronAPI?.log?.error('[Main] Root element not found');
}
