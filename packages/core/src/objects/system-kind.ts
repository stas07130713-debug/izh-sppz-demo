/**
 * Вид системы, к которому относится подвид оборудования.
 *
 * Заказчик про заявки: «нужно, чтобы заявка формировалась именно по виду
 * системы, а не по подразделам — например, целая заявка на огнетушители, а там
 * может быть несколько разделов, где отдельно углекислотные и отдельно
 * порошковые».
 *
 * И это верно не только для заявок. Порошковый и углекислотный огнетушители —
 * подвиды одного вида: их вместе заказывают, вместе обходят и вместе считают.
 * Дымовой и тепловой извещатели — тоже. Различие подвидов важно в карточке и в
 * сроках, но не там, где речь идёт об оборудовании как о хозяйстве.
 *
 * Семейства уже перечислены в каталоге (`configurableFamily`): это те же
 * группы, внутри которых вид уточняется в карточке. Второго перечня здесь нет
 * намеренно — он разошёлся бы с первым.
 */

import { configurableFamily } from './element-catalog.js';
import { elementByCode, elementTitle } from './element-lookup.js';

/**
 * Код общего вида для подвида. Для оборудования без семейства — он сам.
 *
 * Возвращается именно код вида из каталога, а не название семейства: по нему
 * берутся значок и название, и лишнее превращение кода в код однажды разошлось
 * бы с каталогом.
 */
export function systemKindOf(typeCode: string): string {
  const family = configurableFamily(typeCode);
  if (family === null) return typeCode;

  /*
   * Почти у всех семейств название совпадает с кодом общего вида каталога.
   * Исключение одно: семейство «fire-suppression» описывает установки
   * пожаротушения, а общий вид у них зовётся «fire-suppression-system».
   */
  const code = family === 'fire-suppression' ? 'fire-suppression-system' : family;
  return elementByCode(code) === null ? typeCode : code;
}

/** Название вида системы: «Огнетушитель», «Извещатель пожарный». */
export function systemKindTitle(typeCode: string): string {
  return elementTitle(systemKindOf(typeCode));
}

/**
 * Раскладывает оборудование по видам систем, сохраняя порядок первой встречи.
 *
 * Возвращает пары «код вида → сколько единиц»: список видов и счёт нужны
 * вместе, а два прохода по одному и тому же набору разошлись бы при отборе.
 */
export function countBySystemKind(typeCodes: readonly string[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const typeCode of typeCodes) {
    const kind = systemKindOf(typeCode);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return counts;
}
