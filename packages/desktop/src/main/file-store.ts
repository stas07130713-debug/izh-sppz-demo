/**
 * Хранилище файлов с адресацией по содержимому.
 *
 * Имя файла — это SHA-256 его содержимого. Два одинаковых файла занимают место
 * один раз; данные никогда не содержат путей к диску.
 */

import { createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ContentHash, FileStore, Result } from '@izh/contracts';
import { describeUnknown, err, ok } from '@izh/contracts';
import { ensureDataDirs, filesDir } from './storage-paths.js';

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Расширение хранится в имени файла, чтобы содержимое можно было открыть
 *  посторонней программой при разборе неполадок. */
function fileNameFor(hash: string, extension: string): string {
  return `${hash}.${extension}`;
}

async function findExistingPath(hash: ContentHash): Promise<string | null> {
  for (const extension of ['pdf', 'png', 'jpg']) {
    const candidate = join(filesDir(), fileNameFor(hash, extension));
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Файла с таким расширением нет — пробуем следующее.
    }
  }
  return null;
}

export function createFileStore(): FileStore {
  return {
    async put(bytes: Uint8Array, extension: string): Promise<Result<ContentHash>> {
      try {
        await ensureDataDirs();
        const hash = sha256Hex(bytes);
        const path = join(filesDir(), fileNameFor(hash, extension));

        // Если файл с таким содержимым уже лежит, второй раз его не пишем.
        const existing = await findExistingPath(hash);
        if (existing === null) {
          await writeFile(path, bytes);
        }

        return ok(hash);
      } catch (e) {
        return err('FILE_WRITE_FAILED', 'Не удалось сохранить файл.', describeUnknown(e));
      }
    },

    async get(hash: ContentHash): Promise<Result<Uint8Array>> {
      try {
        const path = await findExistingPath(hash);
        if (path === null) return err('FILE_NOT_FOUND', 'Файл не найден в хранилище.');
        const buffer = await readFile(path);
        return ok(new Uint8Array(buffer));
      } catch (e) {
        return err('FILE_READ_FAILED', 'Не удалось прочитать файл.', describeUnknown(e));
      }
    },

    async exists(hash: ContentHash): Promise<Result<boolean>> {
      try {
        return ok((await findExistingPath(hash)) !== null);
      } catch (e) {
        return err('FILE_READ_FAILED', 'Не удалось проверить наличие файла.', describeUnknown(e));
      }
    },
  };
}
