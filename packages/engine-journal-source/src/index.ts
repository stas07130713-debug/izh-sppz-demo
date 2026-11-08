/**
 * Движок E7 «Импорт данных»: чтение чужих учётных журналов.
 *
 * Движок ссылается только на @izh/contracts — правило 1 из AGENTS.md. Он не
 * читает файлы с диска и не пишет в базу: получает байты, возвращает
 * содержимое. Ошибку возвращает значением, а не исключением, поэтому битый
 * файл заказчика не роняет программу.
 *
 * Детерминирован: один и тот же файл всегда даёт один и тот же результат.
 * Никакого времени, случайности и настроек внутри нет.
 */

import type { JournalSheet, JournalSourceEngine, JournalWorkbook, Result } from '@izh/contracts';
import { describeUnknown, err, ok } from '@izh/contracts';
import { looksLikeXlsx, xlsxSheetNames, xlsxSheetRows } from './xlsx.js';

export const journalSourceEngine: JournalSourceEngine = {
  name: 'E7 xlsx',
  version: '0.1.0',

  detectKind(bytes: Uint8Array): 'xlsx' | null {
    return looksLikeXlsx(bytes) ? 'xlsx' : null;
  },

  probeWorkbook(bytes: Uint8Array): Result<JournalWorkbook> {
    try {
      return ok({ sheetNames: xlsxSheetNames(bytes) });
    } catch (e) {
      return err('UNSUPPORTED_FORMAT', 'Не удалось прочитать книгу Excel.', describeUnknown(e));
    }
  },

  readSheet(bytes: Uint8Array, sheetName: string): Result<JournalSheet> {
    try {
      return ok({ name: sheetName, rows: xlsxSheetRows(bytes, sheetName) });
    } catch (e) {
      return err('UNSUPPORTED_FORMAT', `Не удалось прочитать лист «${sheetName}».`, describeUnknown(e));
    }
  },
};

export { inflateRaw } from './inflate.js';
export { looksLikeXlsx, xlsxSheetNames, xlsxSheetRows } from './xlsx.js';
