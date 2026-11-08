/**
 * Сборка полевого помощника.
 *
 * Пакеты проекта поставляются исходниками на TypeScript и собираются вместе с
 * приложением — как и в настольной программе.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Сборка кладётся в папку, которую потом забирает оболочка Android.
  build: { outDir: 'dist', emptyOutDir: true },
});
