import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initEngines } from './deps';
import { applyTheme, readStoredTheme } from './use-theme';
import { installWebDemoBridge } from './web-demo-bridge';
import './styles.css';

if (import.meta.env.VITE_WEB_DEMO === '1') installWebDemoBridge();

// Полоса окна получает сохранённую тему ещё до экрана входа. Иначе после
// перезапуска светлая форма на мгновение открывалась под тёмной шапкой.
applyTheme(readStoredTheme());
initEngines();

function startInterface(): void {
  const container = document.getElementById('root');
  if (container === null) throw new Error('Не найден корневой элемент страницы.');

  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

startInterface();
