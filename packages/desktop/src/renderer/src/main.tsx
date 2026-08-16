import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initEngines } from './deps';
import { runHeadlessTry } from './headless-try';
import './styles.css';

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

// Безголовый прогон: интерфейс не запускается, программа закрывается сама.
// Обычный запуск отличается только тем, что прогон не задан в командной строке.
void runHeadlessTry().then((handled) => {
  if (handled) void window.izh.headless.done();
  else startInterface();
});
