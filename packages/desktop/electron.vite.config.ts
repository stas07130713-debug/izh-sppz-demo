import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

/**
 * Пакеты проекта поставляются исходниками на TypeScript, а не собранными.
 * Поэтому их нельзя объявлять внешними зависимостями — их нужно собирать
 * вместе с программой.
 */
const WORKSPACE_PACKAGES = ['@izh/contracts', '@izh/core', '@izh/engine-plan-source'];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: WORKSPACE_PACKAGES })],
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: WORKSPACE_PACKAGES })],
  },
  renderer: {
    plugins: [react()],
    optimizeDeps: {
      exclude: WORKSPACE_PACKAGES,
    },
  },
});
