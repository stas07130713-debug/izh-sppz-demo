/**
 * Где программа хранит данные пользователя.
 *
 * Всё лежит в одной папке: файлы подложек и исходных чертежей — в files,
 * сведения о них — в backdrops.json. Папку можно скопировать на другой
 * компьютер целиком, потому что в данных нет ни одного абсолютного пути.
 *
 * На следующем шаге backdrops.json заменится на базу SQLite. Заменится только
 * реализация хранилища; сценарии ядра и движок не изменятся — ради этого они и
 * работают через порты.
 */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';

export function dataDir(): string {
  return join(app.getPath('userData'), 'data');
}

export function filesDir(): string {
  return join(dataDir(), 'files');
}

export function backdropsFile(): string {
  return join(dataDir(), 'backdrops.json');
}

export async function ensureDataDirs(): Promise<void> {
  await mkdir(filesDir(), { recursive: true });
}
