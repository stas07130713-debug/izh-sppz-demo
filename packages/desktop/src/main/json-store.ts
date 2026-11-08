/**
 * Безопасное чтение и запись файлов данных.
 *
 * Здесь лежат два правила, от которых зависит сохранность журнала
 * эксплуатации. Оба появились после разбора реального дефекта: обрыв записи
 * оставлял на диске обрезанный JSON, чтение молча возвращало пустой список, и
 * первая же новая запись затирала всю историю.
 *
 * 1. **Запись атомарна.** Данные пишутся во временный файл рядом, сбрасываются
 *    на диск и только потом переименовываются поверх настоящего. Переименование
 *    в пределах одного тома — неделимая операция: на диске в любой момент лежит
 *    либо целиком старая версия, либо целиком новая. Оборвать запись на середине
 *    невозможно.
 *
 * 2. **Повреждённый файл — это ошибка, а не пустота.** «Файла ещё нет» и «файл
 *    испорчен» — разные события, и путать их нельзя. Первое нормально при первом
 *    запуске. Второе означает, что данные на диске есть, но прочитать их не
 *    удалось, и тогда программа обязана остановиться и сказать об этом, а не
 *    делать вид, что журнал пуст. Пока чтение возвращает ошибку, запись поверх
 *    файла не идёт — испорченный файл остаётся на месте и его можно спасти.
 *
 * Замена на SQLite снимет обе заботы: там атомарность и целостность — задача
 * самой базы. До тех пор они решаются здесь, в одном месте на все хранилища.
 */

import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Result } from '@izh/contracts';
import { describeUnknown, err, ok } from '@izh/contracts';

/** Ошибка отсутствия файла отличается от всех остальных по коду ENOENT. */
function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ENOENT';
}

/**
 * Читает файл-справочник и достаёт из него массив по имени ключа.
 *
 * Файла нет — пустой список, это обычное состояние до первой записи. Файл есть,
 * но не разбирается или устроен не так — ошибка с понятным текстом.
 */
export async function readJsonCollection(path: string, key: string): Promise<Result<readonly unknown[]>> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (e) {
    if (isMissingFile(e)) return ok([]);
    return err('FILE_READ_FAILED', `Не удалось прочитать файл данных: ${path}`, describeUnknown(e));
  }

  // Пустой файл равнозначен отсутствующему: так выглядит прерванная запись
  // в старом, неатомарном варианте сохранения.
  if (text.trim() === '') return ok([]);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return err(
      'FILE_CORRUPTED',
      `Файл данных повреждён и не был изменён: ${path}. Восстановите его из резервной копии.`,
      describeUnknown(e),
    );
  }

  if (parsed === null || typeof parsed !== 'object') {
    return err('FILE_CORRUPTED', `Файл данных повреждён и не был изменён: ${path}.`);
  }

  const value = (parsed as Record<string, unknown>)[key];
  if (value === undefined) return ok([]);
  if (!Array.isArray(value)) {
    return err('FILE_CORRUPTED', `Файл данных повреждён и не был изменён: ${path}.`);
  }
  return ok(value);
}

/** Читает файл с одиночной записью — так хранятся настройки программы. */
export async function readJsonRecord(path: string): Promise<Result<Record<string, unknown> | null>> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (e) {
    if (isMissingFile(e)) return ok(null);
    return err('FILE_READ_FAILED', `Не удалось прочитать файл данных: ${path}`, describeUnknown(e));
  }

  if (text.trim() === '') return ok(null);

  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== 'object') {
      return err('FILE_CORRUPTED', `Файл данных повреждён и не был изменён: ${path}.`);
    }
    return ok(parsed as Record<string, unknown>);
  } catch (e) {
    return err(
      'FILE_CORRUPTED',
      `Файл данных повреждён и не был изменён: ${path}. Восстановите его из резервной копии.`,
      describeUnknown(e),
    );
  }
}

/**
 * Записывает значение целиком и неделимо.
 *
 * Порядок важен и менять его нельзя: записать во временный файл → сбросить
 * буферы на диск (`sync`) → переименовать поверх. Без `sync` переименование
 * может опередить фактическую запись содержимого, и после отключения питания
 * на месте данных окажется пустой файл.
 */
export async function writeJsonAtomically(path: string, value: unknown): Promise<Result<void>> {
  // Папку создаём по самому пути, а не через Electron: слой записи не должен
  // знать про приложение — иначе его нельзя ни проверить, ни переиспользовать.
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;

  try {
    const handle = await open(temporary, 'w');
    try {
      await handle.writeFile(JSON.stringify(value, null, 2), 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, path);
    return ok(undefined);
  } catch (e) {
    // Временный файл после сбоя не нужен: настоящий файл не тронут.
    try {
      await unlink(temporary);
    } catch {
      // Его может и не быть — это не ошибка.
    }
    return err('FILE_WRITE_FAILED', `Не удалось сохранить файл данных: ${path}`, describeUnknown(e));
  }
}
