/**
 * Три цветных блока вкладок журнала (ТЗ, Дополнение 2, часть П4.1).
 *
 * Вкладки видов СППЗ собраны в блоки, чтобы взгляд находил нужную сразу, а не
 * читал два десятка названий подряд. Деление ровно то, которым пользуется
 * заказчик: что снаружи здания, что внутри и что относится к пожарной
 * автоматике.
 *
 * Принадлежность определяется по типу элемента из каталога ядра. Это описание
 * показа, а не свойство оборудования, поэтому живёт в интерфейсе: в журнале
 * извещатель попадает в «автоматику», но сам по себе он остаётся извещателем.
 */

import { ELEMENT_CATALOG, familyOf } from '@izh/core';

export type SystemGroup = 'outside' | 'inside' | 'automation';

export const GROUP_TITLES: Readonly<Record<SystemGroup, string>> = {
  outside: 'Снаружи здания',
  inside: 'Внутри здания',
  automation: 'Системы пожарной автоматики',
};

/** Порядок блоков на экране — от наружного к внутреннему и к автоматике. */
export const GROUP_ORDER: readonly SystemGroup[] = ['outside', 'inside', 'automation'];

const OUTSIDE = new Set([
  'hydrant',
  'water-reservoir',
  'fire-truck-connection',
  'outdoor-ladder',
  'roof-fence',
  'outdoor-cabinet',
  'fire-post',
  'pump-station',
  // Водоисточники и щиты заведены отдельными видами позже общего списка:
  // без них водоём и пожарный щит попадали в «внутри здания».
  'water-pond',
  'water-tank',
  'water-natural',
  'fire-board-a',
  'fire-board-v',
  'fire-board-e',
  'fire-board-sh',
  'fire-board-mobile',
  'outdoor-cabinet-box',
]);

const AUTOMATION = new Set([
  'fire-detector',
  'smoke-detector',
  'heat-detector',
  'flame-detector',
  'manual-call-point',
  'control-panel',
  'sounder',
  'smoke-valve',
  'smoke-fan',
  'sprinkler',
  'fire-suppression-system',
  'powder-module',
  'gas-module',
]);

/**
 * В какой блок попадает тип элемента.
 *
 * Всё, что не наружное и не автоматика, считается внутренним: огнетушители,
 * краны, двери, знаки, СИЗ. Это и есть смысл среднего блока — «всё остальное
 * внутри здания», как его описал заказчик.
 */
export function systemGroupOf(typeCode: string): SystemGroup {
  if (OUTSIDE.has(typeCode)) return 'outside';
  if (AUTOMATION.has(typeCode)) return 'automation';

  // Подвид относится туда же, куда общий вид: дымовой извещатель — такая же
  // автоматика, как «извещатель пожарный», а щит ЩП-А стоит там же, где
  // «пожарный щит». Перечислять подвиды поимённо значило бы заводить второй
  // список, который разойдётся с каталогом при первом же добавлении.
  const family = familyOf(typeCode);
  if (family !== null && family.parent !== typeCode) return systemGroupOf(family.parent);

  return 'inside';
}

/**
 * Порядок видов в журнале — каталожный.
 *
 * Раньше виды шли в том порядке, в каком встретились объекты: порошковый
 * огнетушитель, следом СИЗОД, потом углекислотный. Схожее оказывалось врозь, и
 * журнал читался как перемешанная стопка. В каталоге родственные виды стоят
 * рядом (все огнетушители, все извещатели, все установки пожаротушения), и
 * этот порядок — единственный, который не нужно поддерживать отдельно.
 *
 * Вид, которого в каталоге нет, уходит в конец: пропасть он не должен.
 */
const CATALOG_ORDER: ReadonlyMap<string, number> = new Map(
  ELEMENT_CATALOG.map((element, index) => [element.typeCode, index]),
);

export function catalogOrderOf(typeCode: string): number {
  return CATALOG_ORDER.get(typeCode) ?? Number.MAX_SAFE_INTEGER;
}

/** Виды по каталожному порядку — тем же для вкладок, разделов и выгрузки. */
export function byCatalogOrder(a: string, b: string): number {
  return catalogOrderOf(a) - catalogOrderOf(b) || a.localeCompare(b, 'ru');
}
