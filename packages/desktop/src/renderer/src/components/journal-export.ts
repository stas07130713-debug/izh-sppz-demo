/**
 * Сборка выгрузки журнала (ТЗ, Дополнение 2, часть П4.3).
 *
 * Выгружается ровно то, что показано на экране: выбранный вид, целый раздел
 * или весь журнал вместе с наложенными фильтрами. Устроена выгрузка так же,
 * как экран, — разделами: у каждого вида оборудования свои проверки и свои
 * сведения карточки, и одной шапкой их не накрыть.
 *
 * Графы те же и в том же порядке, что в журнале (часть С34): номер,
 * наименование, учётный номер, место, состояние, проверки, сведения карточки,
 * ответственный, примечание. Раньше сведения карточки сваливались в
 * «Примечание» — в печатном журнале это выглядело как чужой текст не в своей
 * графе.
 */

import type { JournalExportFormat, JournalExportRequest } from '@izh/contracts';
import { buildDocumentExportRequest } from './document-export';

export interface ExportActivityValue {
  readonly title: string;
  readonly lastDate: string;
  readonly nextDate: string;
  readonly status: string;
}

export interface ExportJournalRow {
  readonly number: number;
  /** Наименование: марка изделия, а где её не ведут — название вида. */
  readonly name: string;
  readonly registrationNumber: string;
  readonly place: string;
  /** Техническое состояние — та же графа «Состояние», что в журнале. */
  readonly state: string;
  readonly activities: readonly ExportActivityValue[];
  /** Значения граф карточки по числу `cardTitles` раздела. */
  readonly card: readonly string[];
  readonly responsible: string;
  readonly note: string;
}

/** Один вид оборудования со своей шапкой и своими строками. */
export interface JournalExportSection {
  readonly equipmentTitle: string;
  /**
   * Вид оборудования: по нему раздел попадает в свою часть оглавления —
   * снаружи здания, внутри здания или автоматика.
   */
  readonly typeCode?: string | null;
  /** Заголовки граф сведений карточки — свои у каждого вида. */
  readonly cardTitles: readonly string[];
  /**
   * Убранные постоянные графы — настройка «состав таблицы журнала».
   *
   * Графы карточки сюда не входят: их уже нет в `cardTitles`. А постоянные
   * графы выгрузка знает сама, и убрать их можно только здесь.
   */
  readonly hiddenColumns?: readonly string[];
  readonly rows: readonly ExportJournalRow[];
}

export interface JournalSnapshot {
  readonly title: string;
  /** Что открыто: вид, раздел или весь журнал — попадает в имя файла и в шапку. */
  readonly scopeTitle: string;
  /**
   * Объект для титульного листа — полный путь по дереву.
   *
   * Именно путь, а не название узла: «1 этаж» на обложке journal ничего не
   * говорит, а «АО «Кольская ГМК» · АСС · МВАСО · 1 этаж» говорит всё.
   */
  readonly objectTitle: string;
  readonly sections: readonly JournalExportSection[];
}

/**
 * Постоянные графы выгрузки и их ключи в настройке состава.
 *
 * Ключи те же, что в `journal-column-choice`: одна настройка правит и экран, и
 * выгрузку, и разойтись им нельзя.
 */
const HEAD = [
  ['№', null],
  ['Наименование', 'наименование'],
  ['Учётный номер', 'номер'],
  ['Место установки', 'место'],
  ['Состояние', 'состояние'],
] as const;
const TAIL = [
  ['Ответственный', 'ответственный'],
  ['Примечание', 'примечание'],
] as const;

/**
 * Названия проверок раздела.
 *
 * Берутся от строки с наибольшим их числом, а не от первой: у крана в другом
 * цехе регламент может быть шире, и его колонки иначе потерялись бы.
 */
function activityTitlesOf(section: JournalExportSection): readonly string[] {
  return section.rows
    .reduce<readonly ExportActivityValue[]>(
      (best, row) => (row.activities.length > best.length ? row.activities : best),
      [],
    )
    .map((activity) => activity.title);
}

function headersOf(section: JournalExportSection, activityTitles: readonly string[]): readonly string[] {
  const hidden = new Set(section.hiddenColumns ?? []);
  const kept = (list: readonly (readonly [string, string | null])[]): readonly string[] =>
    list.filter(([, key]) => key === null || !hidden.has(key)).map(([title]) => title);

  return [
    ...kept(HEAD),
    ...activityTitles.flatMap((title) => [`${title}: последняя`, `${title}: следующая`]),
    ...section.cardTitles,
    ...kept(TAIL),
  ];
}

/**
 * Строки раздела под его шапкой.
 *
 * Проверка ставится в колонку по названию, а не по порядку: если у одного
 * элемента работы нет, соседние не должны сдвигаться на её место.
 */
function bodyOf(section: JournalExportSection, activityTitles: readonly string[]): readonly string[][] {
  const hidden = new Set(section.hiddenColumns ?? []);
  const keep = (key: string | null, value: string): readonly string[] =>
    (key !== null && hidden.has(key) ? [] : [value]);

  return section.rows.map((row) => {
    const byTitle = new Map(row.activities.map((activity) => [activity.title, activity]));
    return [
      String(row.number),
      ...keep('наименование', row.name),
      ...keep('номер', row.registrationNumber),
      ...keep('место', row.place),
      ...keep('состояние', row.state),
      ...activityTitles.flatMap((title) => {
        const activity = byTitle.get(title);
        return activity === undefined
          ? ['', '']
          : [activity.lastDate, `${activity.nextDate} (${activity.status})`];
      }),
      ...section.cardTitles.map((_, index) => row.card[index] ?? ''),
      ...keep('ответственный', row.responsible),
      ...keep('примечание', row.note),
    ];
  });
}

interface PreparedSection {
  readonly section: JournalExportSection;
  readonly headers: readonly string[];
  readonly body: readonly string[][];
}

function prepare(snapshot: JournalSnapshot): readonly PreparedSection[] {
  return snapshot.sections
    .filter((section) => section.rows.length > 0)
    .map((section) => {
      const activityTitles = activityTitlesOf(section);
      return {
        section,
        headers: headersOf(section, activityTitles),
        body: bodyOf(section, activityTitles),
      };
    });
}

export function buildJournalExportRequest(
  format: JournalExportFormat,
  snapshot: JournalSnapshot,
): JournalExportRequest {
  // Оформление, вкладки и разметку для Word делает общий сборщик: у журнала и
  // заявки они одни и те же, а различаются только таблицы.
  const prepared = prepare(snapshot);

  return buildDocumentExportRequest(format, {
    title: snapshot.title,
    scopeTitle: snapshot.scopeTitle,
    /*
     * Титульный лист, как у бумажного журнала: название, объект, перечень
     * разделов. Разделы берутся из того же подготовленного списка, что и
     * таблицы, — обложка не может обещать раздел, которого дальше нет.
     */
    cover: {
      heading: 'эксплуатации систем противопожарной защиты',
      objectTitle: snapshot.objectTitle,
      /*
       * Наименование организации — верхняя строка титула. Берётся из начала
       * пути по дереву: путь всегда начинается с организации.
       */
      organization: snapshot.objectTitle.split(' · ')[0] ?? null,
      sections: prepared.map(({ section }) => section.equipmentTitle),
      notes: [`Состав: ${snapshot.scopeTitle}`],
    },
    tables: prepared.map(({ section, headers, body }) => ({
      title: section.equipmentTitle,
      typeCode: section.typeCode ?? null,
      headers,
      rows: body,
    })),
  });
}
