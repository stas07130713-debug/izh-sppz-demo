/**
 * Ранг тушения, вычисленный по марке и заряду огнетушителя.
 *
 * Заказчик: «ранги пожаров на огнетушителе должны вычисляться самостоятельно
 * программой в зависимости от вида заведённого в программу огнетушителя, по его
 * характеристикам».
 *
 * Ранг не выдумывается. Он выводится из таблицы 3 — той самой, по которой
 * заказчик подбирает огнетушители: «≥ ОП-6» в строке класса A означает, что
 * порошковый шестикилограммовый ранг 3A обеспечивает. Читая таблицу в обратную
 * сторону, по марке и заряду получаем ранги, которые ГОСТ гарантирует.
 *
 * Это **нижняя оценка**, и обращаться с ней надо как с нижней. Отсутствие класса
 * в выводе не значит, что огнетушитель его не тушит: таблица перечисляет обычные
 * решения, а производитель вправе подтвердить больше испытаниями. Поэтому ранг
 * из карточки, если он заполнен, всегда главнее вычисленного — в паспорте
 * написано то, что подтверждено для конкретного изделия.
 */

import { mergeFireRanks, parseFireRank, type FireClass, type FireRank } from './fire-rank.js';
import { TABLE_1, TABLE_3, type HazardRow } from './ppr-tables.js';

const ROWS: readonly HazardRow[] = ['А, Б, В1 - В4', 'Г, Д'];
const CLASSES: readonly FireClass[] = ['A', 'B', 'C', 'D', 'E'];

/**
 * Что гарантирует ГОСТ для этой марки и заряда.
 *
 * По каждому классу пожара берётся наибольший ранг, требование которого марка с
 * таким зарядом закрывает. Строк в таблице две — верхняя строже, поэтому она и
 * проверяется первой: если заряда хватает на неё, класс закрыт с более высоким
 * рангом.
 */
export function derivedRank(mark: string | null, charge: number | null): FireRank | null {
  if (mark === null || charge === null || !Number.isFinite(charge)) return null;

  const granted: FireRank[] = [];
  for (const fireClass of CLASSES) {
    for (const row of ROWS) {
      const norm = TABLE_3.find((item) => item.row === row && item.fireClass === fireClass);
      const minimum = norm?.minimums.find((item) => item.mark === mark) ?? null;
      // Класс D подтверждается только специальным порошком: обычная марка его
      // не закрывает, и в таблице она под другим обозначением.
      if (minimum === null || charge < minimum.minCharge) continue;

      const rank = TABLE_1.find((item) => item.row === row && item.fireClass === fireClass);
      if (rank !== undefined) granted.push(parseFireRank(rank.rank));
      break;
    }
  }

  if (granted.length === 0) return null;
  return mergeFireRanks(granted);
}
