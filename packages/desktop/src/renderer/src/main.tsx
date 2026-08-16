import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initEngines } from './deps';
import './styles.css';

initEngines();

const container = document.getElementById('root');
if (container === null) throw new Error('Не найден корневой элемент страницы.');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
