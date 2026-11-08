import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Браузерная демонстрация использует тот же интерфейс и локальный веб-мост. */
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  plugins: [react()],
  define: { 'import.meta.env.VITE_WEB_DEMO': JSON.stringify('1') },
  build: {
    outDir: resolve(__dirname, '../../dist'),
    emptyOutDir: true,
  },
});
