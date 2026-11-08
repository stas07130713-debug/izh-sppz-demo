/**
 * Поиск вида элемента: встроенного или заведённого пользователем.
 *
 * Отдельно от каталога, потому что каталог — это данные, а здесь правило: вид
 * ищется сначала среди встроенных, потом среди своих (движок E4). Порядок
 * именно такой и обратным быть не может: коды встроенных видов закреплены
 * правилами, справочниками и печатными формами, и подменить их своим видом
 * нельзя. Столкновение кодов при этом невозможно и по построению — свои коды
 * начинаются с `custom-`, — но правило записано на случай, если данные придут
 * из чужого файла.
 */

import type { CustomElementType } from '@izh/contracts';
import type { PlanKind } from '../object-tree/tree-rules.js';
import { ELEMENT_CATALOG, SYSTEM_MEMBER_TYPES_IN_LIBRARY, type ElementType } from './element-catalog.js';
import { activeCustomElementTypes, customElementTypes, planKindsOf } from './custom-element-registry.js';
import { elementTitleOverride } from './element-title-registry.js';

/** Свой вид в том же виде, в каком его понимает остальная программа. */
function asElementType(type: CustomElementType): ElementType {
  return {
    typeCode: type.typeCode,
    // Кода системы по регламенту заказчика у своего вида нет: его присваивает
    // не пользователь, а нормативный перечень. Пустая строка честнее выдуманного.
    systemCode: '',
    title: type.title,
    appliesTo: planKindsOf(type),
    color: type.color,
    mark: type.mark,
  };
}

/**
 * Название вида с учётом переименования, сделанного организацией.
 *
 * Подменяется здесь, а не в местах показа: название берут восемь десятков
 * мест — план, библиотека, журнал, дашборд, заявка, печатные формы, — и
 * подмешивать настройки в каждое значило бы переписать половину программы.
 */
function renamed(element: ElementType): ElementType {
  const own = elementTitleOverride(element.typeCode);
  return own === null ? element : { ...element, title: own };
}

export function elementByCode(typeCode: string): ElementType | null {
  const builtin = ELEMENT_CATALOG.find((item) => item.typeCode === typeCode);
  if (builtin !== undefined) return renamed(builtin);

  // Выведенный из обращения вид тоже находится: на него ссылаются заведённые
  // объекты и записи журнала, и они должны оставаться читаемыми.
  const own = customElementTypes().find((item) => item.typeCode === typeCode);
  return own === undefined ? null : renamed(asElementType(own));
}

/**
 * Что можно наносить на эту рабочую область из библиотеки элементов.
 *
 * Оборудование системы пожарной автоматики отсюда исключено намеренно
 * (Дополнение 6): извещатель, оповещатель и клапан заводятся составом системы
 * в карточке прибора, а не поштучно из библиотеки. Иначе появился бы второй
 * путь заведения, и по нему приходил бы датчик без системы — он не попал бы ни
 * в проверку системы, ни в её журнал, и выпал бы из обслуживания незаметно.
 *
 * Сам прибор в библиотеке остаётся: с него система и начинается.
 *
 * Свои виды показываются здесь же, а не отдельным списком: для пользователя это
 * такое же оборудование, и искать его в другом месте он не станет.
 */
export function elementsFor(planKind: PlanKind): readonly ElementType[] {
  const builtin = ELEMENT_CATALOG.filter((item) => item.showInLibrary !== false
    && item.appliesTo.includes(planKind)
    && !isSystemMemberType(item.typeCode));

  const own = activeCustomElementTypes()
    .filter((type) => planKindsOf(type).includes(planKind))
    .map(asElementType);

  return [...builtin, ...own].map(renamed);
}

/**
 * Чем можно заменить оборудование на этой рабочей области.
 *
 * Шире библиотеки: заменять извещатель на извещатель нужно, а завести его
 * поштучно из библиотеки нельзя. Это разные вопросы, и один список на оба
 * запрещал бы замену вместе с заведением.
 */
export function replaceableFor(planKind: PlanKind): readonly ElementType[] {
  const own = activeCustomElementTypes()
    .filter((type) => planKindsOf(type).includes(planKind))
    .map(asElementType);
  return [...ELEMENT_CATALOG.filter((item) => item.appliesTo.includes(planKind)), ...own].map(renamed);
}

/**
 * Входит ли вид оборудования в систему пожарной автоматики.
 *
 * Список живёт в `fire-system.ts`, но каталог не может на него сослаться:
 * получилась бы кольцевая зависимость. Поэтому здесь тот же перечень,
 * закреплённый тестом на совпадение.
 */
function isSystemMemberType(typeCode: string): boolean {
  return SYSTEM_MEMBER_TYPES_IN_LIBRARY.includes(typeCode);
}

/** Название типа для журнала и карточки. Неизвестный код показывается как есть. */
export function elementTitle(typeCode: string): string {
  const element = elementByCode(typeCode);
  if (element !== null) return element.title;
  /*
   * Вида нет в каталоге: он остался в данных от прежней сборки или пришёл из
   * более новой. Показывать голый код нельзя — по «water-pier» человек не
   * поймёт ни что это, ни почему у него нет проверок. Строка говорит прямо:
   * это неизвестный вид, а не оборудование без названия.
   */
  return `Неизвестный вид (${typeCode})`;
}
