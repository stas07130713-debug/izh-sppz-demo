import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

/**
 * Пакеты проекта поставляются исходниками на TypeScript, а не собранными.
 * Поэтому их нельзя объявлять внешними зависимостями — их нужно собирать
 * вместе с программой.
 *
 * Драйвер базы здесь по другой причине: в поставке программы папки
 * `node_modules` нет вовсе, и внешний пакет там просто не нашёлся бы. Он
 * собирается внутрь основного процесса, а его файл WebAssembly кладётся
 * рядом — драйвер ищет его по соседству с собой.
 */
const BUNDLED = ['@izh/contracts', '@izh/core', '@izh/engine-plan-source', 'node-sqlite3-wasm'];

/**
 * Кладёт файл WebAssembly рядом с собранным основным процессом.
 *
 * Без него программа падает при первом обращении к базе — а это первое, что
 * она делает при запуске. Сборщик такие файлы сам не переносит: для него это
 * не код, а данные, о которых он ничего не знает.
 */
function copySqliteWasm(): Plugin {
  return {
    name: 'изж-копирование-sqlite-wasm',
    apply: 'build',
    closeBundle() {
      const here = dirname(fileURLToPath(import.meta.url));
      const require = createRequire(import.meta.url);
      const driver = require.resolve('node-sqlite3-wasm');
      const source = join(dirname(driver), 'node-sqlite3-wasm.wasm');
      const target = join(here, 'out', 'main');

      mkdirSync(target, { recursive: true });
      copyFileSync(source, join(target, 'node-sqlite3-wasm.wasm'));
    },
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: BUNDLED }), copySqliteWasm()],
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: BUNDLED })],
  },
  renderer: {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
    },
    optimizeDeps: {
      exclude: BUNDLED,
    },
  },
});
