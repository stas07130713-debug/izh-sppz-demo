/**
 * История пользовательских команд: Undo/Redo.
 *
 * Это не журнал эксплуатации оборудования. Это техническая история правок
 * интерфейса: пользователь создал узел, перетащил значок, поменял карточку —
 * команда может быть откатана и возвращена. В серверной версии рядом появятся
 * пользователь, права и аудит, но форма команды останется такой же.
 */

export type HistoryEntityKind =
  | 'tree'
  | 'room'
  | 'object'
  | 'maintenance'
  | 'settings'
  | 'backdrop'
  | 'calibration'
  | 'cleanup';

export type HistoryActionId = string;

export interface HistoryState {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoDepth: number;
  readonly redoDepth: number;
}

export interface HistoryActionHandle {
  readonly id: HistoryActionId;
}

/**
 * Одна изменённая сущность в составе команды.
 *
 * То же, что история команд хранит для отката, — но отдаётся наружу. По этим
 * записям заполняется журнал изменений: один жест пользователя может задеть
 * несколько сущностей, и все они должны попасть в журнал одной командой.
 */
export interface HistoryEntityChange {
  readonly kind: HistoryEntityKind;
  readonly id: string;
  /** Значение до команды. null — сущности не было. */
  readonly before: unknown | null;
  /** Значение после команды. null — сущность убрана. */
  readonly after: unknown | null;
}

/**
 * Итог команды: и состояние стека отмены, и что именно поменялось.
 *
 * Прежде возвращалось только состояние стека, и для журнала изменений
 * приходилось бы заново вычитывать все затронутые записи и гадать, какие из
 * них правила именно эта команда. Изменения уже собраны здесь — тем же кодом,
 * который умеет их откатывать.
 */
export interface HistoryCommit {
  readonly state: HistoryState;
  /** Название команды, как его видел человек: «Сохранить карточку объекта». */
  readonly label: string;
  readonly changes: readonly HistoryEntityChange[];
}
