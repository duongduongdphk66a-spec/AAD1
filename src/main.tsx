import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { reportClientError } from './core/reportClientError.ts';
import './index.css';

if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    reportClientError('error', e.error ?? e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    reportClientError('unhandledrejection', e.reason);
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary label="AetherTerra 3D">
    <App />
  </ErrorBoundary>
);
