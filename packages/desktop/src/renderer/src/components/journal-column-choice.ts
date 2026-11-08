/**
 * Состав таблицы журнала: какие графы показывать по каждому виду оборудования.
 *
 * Заказчик: «вкладка журнал должна сразу отображать три основные функции:
 * 1 — возможность изменять состав таблицы относительно каждого элемента».
 *
 * Одно описание на три места: таблицу на экране, выгрузку и сам список
 * выключателей в настройках. Разойдись они — человек убрал бы графу, а в
 * печатном журнале она осталась бы, и настройка обманывала бы.
 *
 * Графы проверок сюда не входят намеренно. Их состав задаёт регламент —
 * соседняя настройка на той же вкладке; убрать работу из журнала настройкой
 * вида значило бы спрятать обязанность, а не графу.
 */

import type { AppSettings } from '@izh/contracts';
import { cardColumnsFor } from './journal-columns';
import { familyOptionsFor } from './equipment-family-options';

/**
 * Под каким ключом хранится состав для этого вида.
 *
 * Виды со своими подвидами — огнетушители, извещатели, оповещатели —
 * настраиваются семьёй целиком. Человек говорит «в журнале огнетушителей мне
 * не нужна графа места установки», а не «у порошковых не нужна, у
 * углекислотных не нужна, у водных не нужна»: перечислять восемь подвидов
 * подряд — не настройка, а наказание.
 */
export function journalColumnFamily(typeCode: string): string {
  const family = familyOptionsFor(typeCode);
  return family?.options[0]?.code ?? typeCode;
}

/** Постоянные графы журнала — те же у любого вида оборудования. */
export const JOURNAL_NAME = 'наименование';
export const JOURNAL_NUMBER = 'номер';
export const JOURNAL_PLACE = 'место';
export const JOURNAL_STATE = 'состояние';
export const JOURNAL_RESPONSIBLE = 'ответственный';
export const JOURNAL_SIGNATURE = 'подпись';
export const JOURNAL_NOTE = 'примечание';

export interface JournalColumnChoice {
  readonly key: string;
  readonly title: string;
}

/** Графы карточки вида различаются по видам, поэтому ключ несёт название. */
export function cardColumnKey(title: string): string {
  return `карточка:${title}`;
}

const BEFORE_CARDS: readonly JournalColumnChoice[] = [
  { key: JOURNAL_NAME, title: 'Наименование' },
  { key: JOURNAL_NUMBER, title: 'Учётный номер' },
  { key: JOURNAL_PLACE, title: 'Место установки' },
  { key: JOURNAL_STATE, title: 'Состояние' },
];

const AFTER_CARDS: readonly JournalColumnChoice[] = [
  { key: JOURNAL_RESPONSIBLE, title: 'Ответственный' },
  { key: JOURNAL_SIGNATURE, title: 'ПЭП' },
  { key: JOURNAL_NOTE, title: 'Примечание' },
];

/**
 * Все графы этого вида — в том же порядке, в каком они стоят в таблице.
 *
 * Порядок важен: список в настройках читается как сама таблица, слева
 * направо. Переставленный он заставлял бы сверять каждую строку с экраном.
 */
export function journalColumnChoices(typeCode: string): readonly JournalColumnChoice[] {
  /*
   * Графы карточки берутся по всей семье, а не по одному подвиду.
   *
   * У «огнетушителя без определённого типа» своей карточки нет, а у
   * порошкового есть. Настраивают их вместе — значит, и список граф должен
   * быть общим, иначе настройка семьи не покрывала бы того, что видно в
   * журнале у её подвидов.
   */
  const family = familyOptionsFor(typeCode);
  const codes = family === null ? [typeCode] : family.codes;

  const cards: JournalColumnChoice[] = [];
  const seen = new Set<string>();
  for (const code of codes) {
    for (const column of cardColumnsFor(code)) {
      if (seen.has(column.title)) continue;
      seen.add(column.title);
      cards.push({ key: cardColumnKey(column.title), title: column.title });
    }
  }
  return [...BEFORE_CARDS, ...cards, ...AFTER_CARDS];
}

/** Убранные графы этого вида. Пусто — показываются все. */
export function hiddenJournalColumns(
  typeCode: string,
  settings: Pick<AppSettings, 'journalColumns'>,
): ReadonlySet<string> {
  return new Set(settings.journalColumns[journalColumnFamily(typeCode)] ?? []);
}

/** Показывать ли графу. Незнакомый вид и незаполненная настройка — показывать. */
export function journalColumnShown(
  key: string,
  typeCode: string,
  settings: Pick<AppSettings, 'journalColumns'>,
): boolean {
  return !hiddenJournalColumns(typeCode, settings).has(key);
}

/**
 * Новый состав после переключения одной графы.
 *
 * Возвращает всю запись настройки: вид, у которого не убрано ничего, из неё
 * исчезает — незачем хранить пустые списки, которые ничего не значат.
 */
export function toggleJournalColumn(
  settings: Pick<AppSettings, 'journalColumns'>,
  typeCode: string,
  key: string,
): Readonly<Record<string, readonly string[]>> {
  const family = journalColumnFamily(typeCode);
  const hidden = new Set(settings.journalColumns[family] ?? []);
  if (hidden.has(key)) hidden.delete(key);
  else hidden.add(key);

  const next = { ...settings.journalColumns };
  if (hidden.size === 0) delete next[family];
  else next[family] = [...hidden];
  return next;
}

/** Вернуть виду все графы. */
export function resetJournalColumns(
  settings: Pick<AppSettings, 'journalColumns'>,
  typeCode: string,
): Readonly<Record<string, readonly string[]>> {
  const next = { ...settings.journalColumns };
  delete next[journalColumnFamily(typeCode)];
  return next;
}
