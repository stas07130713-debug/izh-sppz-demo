/**
 * Сеанс, который переживает перезапуск программы.
 *
 * Пароля здесь нет. На диске лежит только зашифрованная средствами Windows
 * ссылка на пользователя и маркер текущего отпечатка пароля. Поэтому смена
 * пароля, отключение учётной записи или её удаление автоматически прекращают
 * сохранённый вход.
 */

import { readFile, unlink, writeFile } from 'node:fs/promises';
import { safeStorage } from 'electron';
import type { Result, UserAccount, UserRepository } from '@izh/contracts';
import { describeUnknown, err, ok } from '@izh/contracts';
import { ensureDataDirs, rememberedSessionFile } from './storage-paths.js';

interface RememberedSession {
  readonly version: 1;
  readonly userId: string;
  readonly passwordMarker: string | null;
}

async function removeFile(): Promise<void> {
  try {
    await unlink(rememberedSessionFile());
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause;
  }
}

export async function forgetRememberedSession(): Promise<Result<void>> {
  try {
    await removeFile();
    return ok(undefined);
  } catch (cause) {
    return err('FILE_WRITE_FAILED', 'Не удалось удалить сохранённый вход.', describeUnknown(cause));
  }
}

export async function rememberSession(users: UserRepository, userId: string): Promise<Result<void>> {
  if (!safeStorage.isEncryptionAvailable()) {
    return err('FILE_WRITE_FAILED', 'Windows сейчас не может защитить сохранённый вход. Войдите без запоминания.');
  }

  const found = await users.getById(userId);
  if (!found.ok) return found;
  if (found.value.archivedAt !== null || found.value.mustChangePassword) {
    return err('FORBIDDEN', 'Эту учётную запись нельзя сохранить для автоматического входа.');
  }

  const payload: RememberedSession = {
    version: 1,
    userId: found.value.id,
    passwordMarker: found.value.password?.digest ?? null,
  };

  try {
    await ensureDataDirs();
    const encrypted = safeStorage.encryptString(JSON.stringify(payload));
    await writeFile(rememberedSessionFile(), encrypted);
    return ok(undefined);
  } catch (cause) {
    return err('FILE_WRITE_FAILED', 'Не удалось сохранить вход на этом компьютере.', describeUnknown(cause));
  }
}

export async function restoreRememberedSession(users: UserRepository): Promise<Result<UserAccount | null>> {
  try {
    const encrypted = await readFile(rememberedSessionFile());
    if (!safeStorage.isEncryptionAvailable()) return ok(null);

    const raw = safeStorage.decryptString(encrypted);
    const parsed = JSON.parse(raw) as Partial<RememberedSession>;
    if (parsed.version !== 1 || typeof parsed.userId !== 'string') {
      await removeFile();
      return ok(null);
    }

    const found = await users.getById(parsed.userId);
    if (!found.ok) {
      await removeFile();
      return ok(null);
    }
    const user = found.value;
    const currentMarker = user.password?.digest ?? null;
    if (user.archivedAt !== null || user.mustChangePassword || parsed.passwordMarker !== currentMarker) {
      await removeFile();
      return ok(null);
    }
    return ok(user);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return ok(null);
    // Повреждённый или перенесённый из другого профиля файл не запирает
    // программу: вход по логину и паролю должен остаться доступным.
    try { await removeFile(); } catch { /* следующая попытка снова предложит обычный вход */ }
    return ok(null);
  }
}
