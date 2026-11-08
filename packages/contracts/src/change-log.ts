/**
 * Журнал вносимых изменений: кто, когда и что изменил.
 *
 * Это не история Undo/Redo и не журнал эксплуатации. Разница принципиальная:
 *
 *  - история команд (history.ts) обратима и укорачивается: отменённое из неё
 *    уходит, чтобы вернуть его кнопкой «вперёд». Как след она не годится —
 *    из неё можно всё вычистить;
 *  - журнал эксплуатации (maintenance.ts) содержит проверки и работы, а не
 *    правки карточек;
 *  - этот журнал только пополняется. Отмена действия — тоже запись в нём, а не
 *    стирание прежней. Так же ведут бумажный журнал: ошибку не вырывают, рядом
 *    пишут исправление.
 *
 * Записывается на каждое изменение: что за сущность, к какому узлу дерева она
 * относится, кто изменил, когда, и что именно поменялось — по полям. Поля, а не
 * снимки целиком: «изменил категорию с В2 на В1» читается человеком, а два
 * полных объекта рядом — нет.
 */

import type { IsoDateTime } from './basic-types.js';
import type { TreeNodeId } from './object-tree.js';
import type { UserId, UserRole } from './access.js';
import type { Result } from './result.js';

export type ChangeLogEntryId = string;

/** Что произошло с записью. */
export type ChangeAction = 'заведено' | 'изменено' | 'удалено' | 'восстановлено';

/** С чем произошло. Совпадает с видами сущностей истории команд. */
export type ChangeSubject =
  | 'узел дерева'
  | 'помещение'
  | 'оборудование'
  | 'запись журнала'
  | 'подложка'
  | 'масштаб'
  | 'правка подложки'
  | 'настройки'
  | 'регламент'
  | 'пользователь';

/** Одно изменившееся поле. */
export interface ChangedField {
  /** Название поля по-человечески: «категория помещения», а не «category». */
  readonly title: string;
  /** Прежнее значение текстом. null — поля не было. */
  readonly before: string | null;
  /** Новое значение текстом. null — поле очищено. */
  readonly after: string | null;
}

export interface ChangeLogEntry {
  readonly id: ChangeLogEntryId;
  readonly at: IsoDateTime;
  readonly authorId: UserId;
  /** Снимок автора: кем он был в тот момент. Должности меняются, запись — нет. */
  readonly authorName: string;
  readonly authorRole: UserRole;
  /** Название действия, как его видел человек: «Стереть лишнее с подложки». */
  readonly command: string;
  readonly action: ChangeAction;
  readonly subject: ChangeSubject;
  /** Идентификатор изменённой записи. */
  readonly subjectId: string;
  /** Название изменённого по-человечески: «Огнетушитель ОП-4 № 28-11». */
  readonly subjectTitle: string;
  /**
   * Узел дерева, к которому относится изменение.
   *
   * По нему журнал и смотрят: заказчик просил «по каждому объекту, цеху, этажу
   * посмотреть, что менялось». Права тоже проверяются по нему: ответственный
   * видит изменения только своих узлов.
   *
   * null — изменение не относится к узлу: общие настройки, регламенты, люди.
   */
  readonly nodeId: TreeNodeId | null;
  readonly fields: readonly ChangedField[];
}

export interface ChangeLogFilter {
  /** Узел и всё, что внутри него. null — без ограничения по дереву. */
  readonly nodeIds?: readonly TreeNodeId[];
  readonly subject?: ChangeSubject;
  readonly authorId?: UserId;
  /** Границы по времени, включительно. */
  readonly from?: IsoDateTime;
  readonly to?: IsoDateTime;
}

/**
 * Хранилище журнала изменений.
 *
 * Метода удаления нет и не будет — по той же причине, по которой его нет у
 * журнала эксплуатации (AGENTS.md, правило 10). Журнал, из которого можно
 * вычистить неудобную запись, не журнал.
 */
export interface ChangeLogRepository {
  list(filter?: ChangeLogFilter): Promise<Result<readonly ChangeLogEntry[]>>;
  append(entry: ChangeLogEntry): Promise<Result<void>>;
  /**
   * Записать пачку разом.
   *
   * Один жест человека задевает сколько угодно записей: завести сто
   * огнетушителей, перенести этаж на склад, применить состав системы. Писать
   * их по одной значит переписать файл журнала сто раз подряд — и тем
   * дольше, чем длиннее журнал.
   */
  appendMany(entries: readonly ChangeLogEntry[]): Promise<Result<void>>;
}
