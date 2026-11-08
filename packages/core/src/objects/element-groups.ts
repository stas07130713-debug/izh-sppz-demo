/**
 * Разделы оборудования для конструктора регламентов и библиотеки элементов.
 *
 * Три раздела вместо одного длинного списка: снаружи здания, внутри здания и
 * пожарная автоматика. Деление не выдумано для красоты — так на предприятии и
 * распределена ответственность: наружное водоснабжение и подъезды ведёт одна
 * служба, первичные средства внутри здания другая, автоматику третья.
 *
 * Признак раздела вычисляется из каталога, а не хранится отдельным полем:
 * второе место для той же истины разошлось бы с первым при первой же правке.
 */

import { ELEMENT_CATALOG, type ElementType } from './element-catalog.js';

export type ElementGroup = 'снаружи здания' | 'внутри здания' | 'пожарная автоматика';

export const ELEMENT_GROUP_ORDER: readonly ElementGroup[] = [
  'пожарная автоматика',
  'внутри здания',
  'снаружи здания',
];

/**
 * Коды систем, относящихся к пожарной автоматике.
 *
 * 03 — пожарная сигнализация, 04 — оповещение и управление эвакуацией,
 * 05 — противодымная защита, 06–08 — установки пожаротушения. Все они
 * работают от одного прибора приёмно-контрольного и управления.
 */
const AUTOMATION_SYSTEMS: readonly string[] = ['03', '04', '05', '06', '07', '08'];

export function groupOf(element: ElementType): ElementGroup {
  const system = element.systemCode.split('.')[0] ?? '';
  if (AUTOMATION_SYSTEMS.includes(system)) return 'пожарная автоматика';
  return element.appliesTo.includes('general') ? 'снаружи здания' : 'внутри здания';
}

export function groupOfType(typeCode: string): ElementGroup | null {
  const element = ELEMENT_CATALOG.find((item) => item.typeCode === typeCode);
  return element === null || element === undefined ? null : groupOf(element);
}
