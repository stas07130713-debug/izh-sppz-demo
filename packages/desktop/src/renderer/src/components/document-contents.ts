/**
 * Титульный лист и оглавление выгружаемого журнала.
 *
 * Заказчик (пункт 8 перечня доработок): «Журналы нужно сделать с нормальным
 * титульным листом и сформированным оглавлением в виде таблицы, куда
 * подтягиваются разделы согласно составу выгружаемого журнала. Это должно
 * выглядеть как обычно оформленный бумажный журнал: титул, оглавление,
 * разделённое на разделы, потом сами элементы… там, где даты начала и конца,
 * должна быть дата формирования журнала… разделы — по нашему принципу: снаружи
 * здания, внутри здания, автоматика, и в их составе уже отдельные элементы и
 * номера страниц, где они размещены».
 *
 * Образец — бумажный «Журнал эксплуатации систем противопожарной защиты»: на
 * титуле наименование организации, название журнала и дата; дальше «Содержание
 * журнала» таблицей с номером раздела, названием и страницей начала.
 *
 * Отличие от бумажного одно и намеренное: вместо «Начат» и «Окончен» —
 * **дата формирования**. Выгрузка — не тетрадь, которую ведут год: это снимок
 * состояния на день, и обещать по нему срок ведения нельзя.
 */

import { ELEMENT_GROUP_ORDER, groupOfType, type ElementGroup } from '@izh/core';

/** Раздел оглавления: группа и виды оборудования внутри неё. */
export interface ContentsSection {
  /** Номер римскими цифрами, как в бумажном журнале. */
  readonly numeral: string;
  readonly title: string;
  readonly items: readonly ContentsItem[];
  /** Лист, с которого раздел начинается. */
  readonly page: number;
}

export interface ContentsItem {
  readonly title: string;
  readonly page: number;
  /** Сколько записей в разделе: по нему человек понимает объём. */
  readonly rows: number;
}

/** Что нужно знать о таблице, чтобы поставить её в оглавление. */
export interface ContentsInput {
  readonly title: string;
  readonly rows: number;
  /** Вид оборудования: по нему определяется раздел. */
  readonly typeCode?: string | null;
}

/**
 * Сколько строк таблицы помещается на листе.
 *
 * Это не оценка, а **правило**: документ сам режет таблицу на куски по этому
 * числу и ставит между ними разрыв листа. Поэтому номер, обещанный в
 * оглавлении, совпадает с тем, где раздел окажется на самом деле.
 *
 * Прежде число было оценочным, и оглавление обещало не тот лист: сколько строк
 * ляжет на лист, заранее не известно — в графах «Место установки» и
 * «Примечание» текст переносится, и одна запись занимает две-три строки.
 *
 * Величина взята с запасом: четырнадцать записей помещаются на альбомный лист
 * даже при переносах в двух графах сразу.
 */
export const ROWS_PER_PAGE = 14;

/** Титул и оглавление — два первых листа. */
const FIRST_CONTENT_PAGE = 3;

/** Как называется раздел в оглавлении. */
const GROUP_TITLES: Readonly<Record<ElementGroup, string>> = {
  'снаружи здания': 'Оборудование снаружи здания',
  'внутри здания': 'Первичные средства и оборудование внутри здания',
  'пожарная автоматика': 'Системы пожарной автоматики',
};

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'] as const;

/** Сколько листов занимает таблица: заголовок плюс строки. */
export function pagesOf(rows: number): number {
  return Math.max(1, Math.ceil(rows / ROWS_PER_PAGE));
}

/**
 * Оглавление по составу выгрузки.
 *
 * Разделы идут в том же порядке, что в библиотеке элементов, и пустых среди
 * них не бывает: в оглавлении обещано ровно то, что дальше есть.
 *
 * Виды, которых нет в каталоге — свои виды пользователя, — собираются в
 * последний раздел: выдумывать им место среди наружного оборудования или
 * автоматики программа не вправе.
 */
/**
 * Раскладывает таблицы по разделам, в порядке разделов.
 *
 * Тем же порядком печатается и сам документ: иначе оглавление обещает лист, а
 * раздел лежит на другом — так и вышло при первой проверке, когда оглавление
 * шло по группам, а таблицы печатались в порядке журнала.
 */
export function tablesByGroup<T extends { readonly typeCode?: string | null }>(
  tables: readonly T[],
): readonly { readonly group: string; readonly items: readonly T[] }[] {
  const byGroup = new Map<string, T[]>();
  for (const table of tables) {
    const group = (table.typeCode == null ? null : groupOfType(table.typeCode)) ?? 'прочее';
    const list = byGroup.get(group) ?? [];
    list.push(table);
    byGroup.set(group, list);
  }

  const order: readonly string[] = [...ELEMENT_GROUP_ORDER, 'прочее'];
  return order
    .map((group) => ({ group, items: byGroup.get(group) ?? [] }))
    .filter((section) => section.items.length > 0);
}

/** Таблицы в порядке разделов — тем же, что в оглавлении. */
export function orderedTables<T extends { readonly typeCode?: string | null }>(
  tables: readonly T[],
): readonly T[] {
  return tablesByGroup(tables).flatMap((section) => section.items);
}

export function buildContents(tables: readonly ContentsInput[]): readonly ContentsSection[] {
  const byGroup = new Map<string, ContentsInput[]>();
  for (const table of tables) {
    const group = (table.typeCode == null ? null : groupOfType(table.typeCode)) ?? 'прочее';
    const list = byGroup.get(group) ?? [];
    list.push(table);
    byGroup.set(group, list);
  }

  const order: readonly string[] = [...ELEMENT_GROUP_ORDER, 'прочее'];
  const sections: ContentsSection[] = [];
  let page = FIRST_CONTENT_PAGE;
  let index = 0;

  for (const group of order) {
    const list = byGroup.get(group);
    if (list === undefined || list.length === 0) continue;

    const items: ContentsItem[] = [];
    const first = page;
    for (const table of list) {
      items.push({ title: table.title, page, rows: table.rows });
      page += pagesOf(table.rows);
    }

    sections.push({
      numeral: NUMERALS[index] ?? String(index + 1),
      title: group === 'прочее' ? 'Прочее оборудование' : GROUP_TITLES[group as ElementGroup],
      items,
      page: first,
    });
    index += 1;
  }

  return sections;
}
