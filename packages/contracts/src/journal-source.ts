/**
 * Движок E7 «Импорт данных»: чтение чужих учётных журналов.
 *
 * Движок получает байты файла и возвращает содержимое листов текстом. Он не
 * знает ни о нашей модели данных, ни о сопоставлении колонок — этим занимается
 * ядро (packages/core/src/import). Разделение то же, что у движка подложек:
 * движок разбирает формат, ядро решает, что означают данные.
 *
 * Смотри docs/02_ТЗ_редакция_3.md, Дополнение 1, части Д12–Д13.
 */

import type { Result } from './result.js';

/**
 * Лист чужого журнала: строки и ячейки текстом.
 *
 * Именно текстом, а не числами и датами: даты в Excel лежат числами, и
 * превращать их в календарные — работа ядра, где для этого есть проверки и
 * отчёт о непригодных значениях. Движок не должен решать за него.
 *
 * Пропуски заполнены пустыми строками, поэтому номер ячейки в массиве
 * совпадает с колонкой в исходном файле.
 */
export interface JournalSheet {
  readonly name: string;
  readonly rows: readonly (readonly string[])[];
}

export interface JournalWorkbook {
  readonly sheetNames: readonly string[];
}

/** Контракт движка E7. Работает только с байтами и текстом. */
export interface JournalSourceEngine {
  readonly name: string;
  readonly version: string;

  /** Определяет, похож ли файл на поддерживаемую таблицу. По содержимому, не по расширению. */
  detectKind(bytes: Uint8Array): 'xlsx' | null;

  /** Читает оглавление: какие листы есть в книге. */
  probeWorkbook(bytes: Uint8Array): Result<JournalWorkbook>;

  /** Читает один лист целиком. */
  readSheet(bytes: Uint8Array, sheetName: string): Result<JournalSheet>;
}
