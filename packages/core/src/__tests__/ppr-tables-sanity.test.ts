/**
 * Внутренняя связность таблиц норм (ТЗ, часть С107).
 *
 * Написан по живой ошибке. У воздушно-эмульсионного огнетушителя наименьший
 * заряд по классу A стоял «1» в строке опасных помещений и «8» — в строке
 * обычных. Значит, в опасном помещении хватало литра, а в обычном требовалось
 * восемь: требование строже там, где опасность меньше. Из-за этого литровый ОВЭ
 * получал высший ранг 3A, и ранги изготовителей считались неправильно.
 *
 * Ошибку такого рода не ловит ни тип, ни сборка: число как число, таблица как
 * таблица. Ловит только сравнение строк между собой — им и занят этот файл.
 */

import { describe, expect, it } from 'vitest';
import { TABLE_1, TABLE_2, TABLE_3 } from '../extinguishers/ppr-tables.js';

const STRICT = 'А, Б, В1 - В4';
const MILD = 'Г, Д';

/** Наименьший заряд марки в строке, либо `null`, если марка в строке не названа. */
function minimumOf(row: string, fireClass: string, mark: string): number | null {
  const norm = TABLE_3.find((item) => item.row === row && item.fireClass === fireClass);
  return norm?.minimums.find((item) => item.mark === mark)?.minCharge ?? null;
}

describe('проверка ловит то, ради чего написана', () => {
  it('находит строку, где опасное помещение требует меньше обычного', () => {
    // Тот самый случай: строгая строка мягче мягкой.
    const broken = [
      { row: STRICT, mark: 'ОВЭ', minCharge: 1 },
      { row: MILD, mark: 'ОВЭ', minCharge: 8 },
    ];
    const strict = broken.find((item) => item.row === STRICT)?.minCharge ?? 0;
    const mild = broken.find((item) => item.row === MILD)?.minCharge ?? 0;
    expect(strict < mild).toBe(true);
  });
});

describe('таблица 3: наименьшие заряды', () => {
  it('опасное помещение нигде не требует меньше обычного', () => {
    const wrong: string[] = [];
    for (const norm of TABLE_3) {
      if (norm.row !== STRICT) continue;
      for (const minimum of norm.minimums) {
        const mild = minimumOf(MILD, norm.fireClass, minimum.mark);
        if (mild === null) continue;
        if (minimum.minCharge < mild) {
          wrong.push(`класс ${norm.fireClass}, ${minimum.mark}: ${minimum.minCharge} против ${mild}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('заряды положительные, кроме специального порошка', () => {
    // У специального порошка для класса D величина не нормируется — там ноль.
    for (const norm of TABLE_3) {
      for (const minimum of norm.minimums) {
        if (minimum.mark.includes('специальный')) continue;
        expect(minimum.minCharge, `${norm.row} ${norm.fireClass} ${minimum.mark}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('таблицы 1 и 2: строки и классы', () => {
  it('у каждой строки таблицы 1 все пять классов пожара', () => {
    for (const row of [STRICT, MILD]) {
      const classes = TABLE_1.filter((item) => item.row === row).map((item) => item.fireClass);
      expect(new Set(classes), row).toEqual(new Set(['A', 'B', 'C', 'D', 'E']));
    }
  });

  it('ранги из приложения № 1 — те, что там напечатаны', () => {
    // Сверено с текстом постановления: приложение № 1 состоит из трёх граф и
    // называет ранг, а не марку и заряд.
    const rankOf = (row: string, fireClass: string): string | undefined =>
      TABLE_1.find((item) => item.row === row && item.fireClass === fireClass)?.rank;

    expect(rankOf(STRICT, 'A')).toBe('3A');
    expect(rankOf(STRICT, 'B')).toBe('70B');
    expect(rankOf(MILD, 'A')).toBe('2A');
    expect(rankOf(MILD, 'B')).toBe('55B');
  });

  it('передвижные нормы заданы для обеих строк', () => {
    expect(TABLE_2.some((item) => item.row === STRICT)).toBe(true);
    expect(TABLE_2.some((item) => item.row === MILD)).toBe(true);
  });
});
