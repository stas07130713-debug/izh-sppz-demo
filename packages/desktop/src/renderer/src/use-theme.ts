/**
 * Тёмная или светлая тема.
 *
 * Выбор запоминается между запусками: программа открывается в том виде, в
 * котором её закрыли. По умолчанию тёмная — так в макете заказчика.
 *
 * Тема хранится не в настройках программы (`settings.json`), а рядом с окном:
 * это свойство рабочего места, а не объекта защиты. На сервере у каждого
 * пользователя она будет своя, и класть её в общие настройки было бы неверно.
 */

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'izh.theme';

export function readStoredTheme(): Theme {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

/** Применяет тему одновременно к HTML и к нативной полосе окна Windows. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  window.localStorage.setItem(STORAGE_KEY, theme);
  // Нативные кнопки Windows находятся вне HTML и сами CSS-переменную не
  // видят, поэтому основной процесс получает тему отдельной командой.
  void window.izh.window.setTheme(theme);
}

export interface ThemeState {
  readonly theme: Theme;
  readonly toggle: () => void;
}

export function useTheme(): ThemeState {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggle };
}
