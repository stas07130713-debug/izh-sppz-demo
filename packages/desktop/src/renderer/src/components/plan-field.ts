/**
 * Раскладка значков на условном поле — когда подложки нет.
 *
 * Объекты можно заводить до загрузки плана, и показать их всё равно нужно.
 * Тогда вместо чертежа — условное поле: разделы сверху вниз, внутри раздела
 * строки по колонкам.
 *
 * Отдельным файлом, а не внутри плана: раскладка — это расчёт, у которого своя
 * проверка. Значки, наезжающие друг на друга, видно только на глаз, а замерить
 * расстояния между ними можно и без картинки.
 */

import type { PlanObject } from '@izh/contracts';
import { GROUP_ORDER, systemGroupOf } from './journal-groups';
/** Ширина колонки: значок узкий, но подпись под ним — до 170 точек. */
export const FIELD_COLUMN_PX = 230;
/** Шаг строки: значок 28, подпись под ним и просвет, чтобы не слипалось. */
export const FIELD_ROW_PX = 96;
/** Просвет между разделами — больше строчного, чтобы группы читались отдельно. */
export const FIELD_GROUP_GAP_PX = 48;
export const FIELD_TOP_PX = 60;

export interface ArrangedField {
  readonly objects: readonly PlanObject[];
  /** Высота условного поля: столько, сколько нужно всем строкам. */
  readonly heightPx: number;
}

/**
 * Раскладка значков на условном поле — когда подложки нет.
 *
 * Сверху вниз, разделами, и поле растёт под содержимое. Прежняя раскладка
 * шла снизу вверх с постоянным отступом раздела: при трёх и более строках
 * значки одного раздела заезжали на соседний, а при большом числе объектов
 * уходили выше верхнего края поля.
 *
 * Шаг строки считает и подпись: под значком стоит учётный номер, и без места
 * под него значки не перекрываются, а перекрываются подписи — читать
 * невозможно так же.
 */
export function arrangeWithoutBackdrop(
  objects: readonly PlanObject[],
  width: number,
  height: number,
): ArrangedField {
  const columns = Math.max(1, Math.min(6, Math.floor(width / FIELD_COLUMN_PX)));
  const placed: PlanObject[] = [];
  let top = FIELD_TOP_PX;

  for (const group of GROUP_ORDER) {
    const own = objects
      .filter((object) => systemGroupOf(object.typeCode) === group)
      .sort((a, b) => a.typeCode.localeCompare(b.typeCode, 'ru')
        || (a.regNumber ?? '').localeCompare(b.regNumber ?? '', 'ru'));
    if (own.length === 0) continue;

    for (const [index, object] of own.entries()) {
      // На условном поле всегда своя расчётная позиция, включая объекты,
      // заведённые до появления подложки.
      placed.push({
        ...object,
        position: {
          x: Math.round(((index % columns) + 0.5) * (width / columns)),
          y: Math.round(top + Math.floor(index / columns) * FIELD_ROW_PX),
        },
      });
    }

    top += Math.ceil(own.length / columns) * FIELD_ROW_PX + FIELD_GROUP_GAP_PX;
  }

  return { objects: placed, heightPx: Math.max(height, Math.round(top)) };
}
