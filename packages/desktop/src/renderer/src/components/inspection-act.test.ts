/**
 * Акт проверки в записи журнала (ТЗ, Дополнение 6).
 *
 * Хранится либо целиком, либо никак: акт с номером, но без файла в делах не
 * найти, а с файлом без номера на него не сослаться. Половина акта в журнале
 * выглядит как приложенный документ, которого на самом деле нет.
 */

import { describe, expect, it } from 'vitest';
import {
  EMPTY_INSPECTION_ACT, inspectionActErrors, inspectionActFrom, type InspectionActState,
} from './InspectionActFields';

const FILE = { hash: 'a'.repeat(64), fileName: 'Акт проверки водоёма.pdf' };
const FULL: InspectionActState = { number: '14/2026', date: '2026-04-18', file: FILE };

describe('готовность акта', () => {
  it('заполненный целиком превращается в акт записи', () => {
    expect(inspectionActFrom(FULL)).toEqual({ number: '14/2026', date: '2026-04-18', file: FILE });
  });

  it('пустой акт — не ошибка: он положен не по всякой работе', () => {
    expect(inspectionActFrom(EMPTY_INSPECTION_ACT)).toBeNull();
    expect(inspectionActErrors(EMPTY_INSPECTION_ACT)).toEqual([]);
  });

  it('начатый, но не законченный акт не сохраняется и объясняет, чего не хватает', () => {
    for (const partial of [
      { ...FULL, file: null },
      { ...FULL, number: '   ' },
      { ...FULL, date: '' },
    ]) {
      expect(inspectionActFrom(partial)).toBeNull();
      expect(inspectionActErrors(partial).length).toBeGreaterThan(0);
    }
  });
});
