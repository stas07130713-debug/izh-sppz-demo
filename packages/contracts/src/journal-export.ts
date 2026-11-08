/** Форматы выгрузки специализированного журнала. */
export type JournalExportFormat = 'excel' | 'word' | 'pdf' | 'print';

/**
 * Вид строки на вкладке книги.
 *
 * Оболочке нужно знать не оформление, а смысл строки: заголовок над таблицей,
 * шапка таблицы или данные. Как это выглядит — жирным, с рамкой, с заливкой —
 * решает тот, кто пишет файл, и решает одинаково для всех выгрузок.
 */
export type JournalSheetRowKind = 'заголовок' | 'шапка' | 'данные';

/** Одна вкладка книги: обычно один вид оборудования. */
export interface JournalExportSheet {
  /** Имя вкладки. Excel не принимает длиннее 31 знака и не терпит : \ / ? * [ ]. */
  readonly name: string;
  readonly rows: readonly (readonly string[])[];
  /** Вид каждой строки по её номеру; чего нет в списке — данные. */
  readonly rowKinds: readonly JournalSheetRowKind[];
  /** Ширина колонок в знаках: считается по самому длинному значению. */
  readonly columnWidths: readonly number[];
  /** Сколько верхних строк закрепить при прокрутке. */
  readonly frozenRows: number;
}

/**
 * Готовый снимок журнала передаётся оболочке без доступа к данным хранилища.
 * HTML — для PDF и печати, `wordHtml` — для Word, вкладки — для XLSX.
 */
export interface JournalExportRequest {
  readonly format: JournalExportFormat;
  readonly suggestedName: string;
  readonly html: string;
  /**
   * Разметка для Word.
   *
   * Отдельно от печатной: Word не понимает `@page` и разворачивает лист
   * альбомно только по своему описанию раздела. Нет — берётся `html`.
   */
  readonly wordHtml?: string;
  readonly csv: string;
  /** Вкладки книги Excel. */
  readonly sheets: readonly JournalExportSheet[];
  /** Карточки печатаются книжно, широкие журналы — альбомно. */
  readonly landscape?: boolean;
}

export interface JournalExportResult {
  /** null означает, что пользователь закрыл системное окно сохранения. */
  readonly savedPath: string | null;
}
