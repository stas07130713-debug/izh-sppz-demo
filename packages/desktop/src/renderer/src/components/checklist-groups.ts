/**
 * Разбиение работ чек-листа по срокам обслуживания (ТЗ, Дополнение 5, часть Р3).
 *
 * Проверяющий приходит не «делать осмотр», а закрывать срок: ежемесячный,
 * квартальный, годовой. Внутри срока уже лежат работы — осмотр, перекатка,
 * испытание. Так это устроено в настройках, так должно выглядеть и в чек-листе:
 * иначе человек видит в настройках одно дерево, а в проверке плоский список и
 * не понимает, что чему соответствует.
 *
 * Разбиение нужно ровно потому, что источников правил два и устроены они
 * по-разному:
 *
 * — **регламент организации** уже даёт периодичности: одна работа = один срок,
 *   и её пункты и есть состав. Такая группа состоит из единственной работы, и
 *   повторять её название под заголовком не нужно;
 * — **нормативная библиотека** даёт отдельные работы, у каждой своё число
 *   месяцев. Тут группу собирает эта функция: «Раз в полгода» и внутри
 *   «Испытание клапана».
 *
 * Обе картины сводятся к одной, и пользователь разницы между источниками не
 * видит — да и не должен.
 */

import { periodicityTitle, type ActivityCell } from '@izh/core';

export interface ChecklistGroup {
  /** Название срока: «Ежемесячно», «Раз в полгода». */
  readonly title: string;
  /** Через сколько месяцев повторяется. По нему группы и упорядочены. */
  readonly months: number;
  readonly cells: readonly ActivityCell[];
  /**
   * Совпадает ли название единственной работы с названием группы.
   *
   * Так выглядит регламент организации: работа и есть периодичность. Заголовок
   * группы в этом случае её и называет, и печатать имя второй раз незачем.
   */
  readonly titleIsWork: boolean;
}

/** Срок работы в месяцах: из правила, а где его нет — ежемесячно. */
function monthsOf(cell: ActivityCell): number {
  const months = cell.rule.periodicityMonths;
  return months === null || months === undefined || months <= 0 ? 1 : months;
}

/**
 * Название срока для работы.
 *
 * У правила из регламента организации название периодичности уже есть — оно и
 * есть заголовок работы. У правила из библиотеки название собирается по числу
 * месяцев той же функцией, что и в конструкторе.
 */
function groupTitleOf(cell: ActivityCell): string {
  if (cell.rule.periodicityId !== undefined) return cell.rule.title;
  return periodicityTitle(monthsOf(cell));
}

/**
 * Раскладывает работы по срокам.
 *
 * Порядок групп — от частого к редкому: ежемесячное закрывают чаще всего, и
 * держать его внизу списка значило бы каждый раз прокручивать мимо годового.
 * Порядок работ внутри группы сохраняется как есть — в нём обязательные
 * требования НПА идут первыми (`activitiesFor`).
 */
export function groupChecklistCells(cells: readonly ActivityCell[]): readonly ChecklistGroup[] {
  const groups = new Map<string, { months: number; cells: ActivityCell[] }>();

  for (const cell of cells) {
    const title = groupTitleOf(cell);
    const existing = groups.get(title);
    if (existing === undefined) groups.set(title, { months: monthsOf(cell), cells: [cell] });
    else existing.cells.push(cell);
  }

  return [...groups.entries()]
    .map(([title, group]) => ({
      title,
      months: group.months,
      cells: group.cells,
      titleIsWork: group.cells.length === 1 && group.cells[0]?.rule.title === title,
    }))
    .sort((a, b) => a.months - b.months || a.title.localeCompare(b.title, 'ru'));
}
