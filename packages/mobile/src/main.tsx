/** Точка входа полевого помощника. */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const container = document.getElementById('root');
if (container === null) throw new Error('Не найден корневой элемент страницы.');

/** Сегодняшний день телефона: по нему считаются сроки на обходе. */
const today = new Date().toISOString().slice(0, 10);

createRoot(container).render(
  <StrictMode>
    <App today={today} />
  </StrictMode>,
);
