/**
 * История команд Undo/Redo для локальной оболочки.
 *
 * Хранит не снимки файлов, а изменения сущностей: что было до команды и что
 * стало после. Поэтому один пользовательский жест может включать несколько
 * записей (например, сортировка меняет порядок двух узлов), а Undo откатывает
 * их одной командой.
 */

import type {
  HistoryActionHandle, HistoryActionId, HistoryCommit, HistoryEntityChange, HistoryEntityKind,
  HistoryState, Result,
} from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import { readJsonRecord, writeJsonAtomically } from './json-store.js';

const LIMIT = 10;

export interface HistoryAdapter {
  readonly kind: HistoryEntityKind;
  readonly get: (id: string) => Promise<Result<unknown | null>>;
  readonly put: (value: unknown) => Promise<Result<void>>;
  readonly remove: (id: string) => Promise<Result<void>>;
}

interface EntityChange {
  readonly kind: HistoryEntityKind;
  readonly id: string;
  readonly before: unknown | null;
  readonly after: unknown | null;
}

interface StoredAction {
  readonly id: HistoryActionId;
  readonly label: string;
  readonly createdAt: string;
  readonly changes: readonly EntityChange[];
}

interface StoredHistory {
  readonly undo: readonly StoredAction[];
  readonly redo: readonly StoredAction[];
}

export class CommandHistory {
  private readonly adapters: ReadonlyMap<HistoryEntityKind, HistoryAdapter>;
  private readonly path: string | null;
  private undo: StoredAction[] = [];
  private redo: StoredAction[] = [];
  private active = new Map<HistoryActionId, StoredAction>();
  private loaded = false;

  /**
   * Путь к файлу истории передаётся явно, а не берётся из Electron: так класс
   * можно проверить тестами. `null` — история живёт только в памяти и не
   * переживает перезапуск.
   */
  constructor(adapters: readonly HistoryAdapter[], path: string | null = null) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.kind, adapter]));
    this.path = path;
  }

  async begin(label: string): Promise<Result<HistoryActionHandle>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const id = crypto.randomUUID();
    this.active.set(id, { id, label: label.trim() || 'Изменение данных', createdAt: new Date().toISOString(), changes: [] });
    return ok({ id });
  }

  async record(actionId: HistoryActionId | null, kind: HistoryEntityKind, id: string, before: unknown | null, after: unknown | null): Promise<void> {
    if (actionId === null || sameValue(before, after)) return;
    // Журнал эксплуатации в историю команд не попадает: его записи нельзя ни
    // править, ни удалять (AGENTS.md, правило 10), а значит и откатывать
    // нечего. Действие, состоящее только из записи проверки, окажется пустым и
    // на стек отмены не ляжет — так и задумано.
    if (kind === 'maintenance') return;
    const action = this.active.get(actionId);
    if (action === undefined) return;

    const previous = action.changes.find((change) => change.kind === kind && change.id === id);
    const nextChange: EntityChange = {
      kind,
      id,
      before: previous?.before ?? cloneValue(before),
      after: cloneValue(after),
    };
    const changes = [
      ...action.changes.filter((change) => !(change.kind === kind && change.id === id)),
      nextChange,
    ];
    this.active.set(actionId, { ...action, changes });
  }

  /**
   * Завершает команду и отдаёт то, что она изменила.
   *
   * Перечень изменений нужен журналу изменений: он заполняется по тем же
   * записям, по которым команда откатывается, а не вторым обходом хранилища.
   */
  async commit(actionId: HistoryActionId): Promise<Result<HistoryCommit>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const action = this.active.get(actionId);
    if (action === undefined) return ok(this.commitOf('', []));
    this.active.delete(actionId);
    const changes = action.changes.map((change) => ({ ...change }));
    if (action.changes.length === 0) return ok(this.commitOf(action.label, changes));
    this.undo.push(action);
    if (this.undo.length > LIMIT) this.undo.shift();
    this.redo = [];
    const saved = await this.save();
    if (!saved.ok) return saved;
    return ok(this.commitOf(action.label, changes));
  }

  async cancel(actionId: HistoryActionId): Promise<Result<HistoryCommit>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    this.active.delete(actionId);
    return ok(this.commitOf('', []));
  }

  /**
   * Откат последней команды.
   *
   * Изменения отдаются перевёрнутыми: то, что было «до», для отката стало
   * «после». Журнал изменений от этого читается верно — «вернул категорию с
   * В1 на В2», а не наоборот. Отмена в журнале и есть отдельная запись:
   * прежнюю из него не вычёркивают.
   */
  async undoLast(): Promise<Result<HistoryCommit>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const action = this.undo.pop();
    if (action === undefined) return err('INVALID_ARGUMENT', 'Откатывать больше нечего.');
    const applied = await this.apply(action, 'undo');
    if (!applied.ok) return applied;
    this.redo.push(action);
    if (this.redo.length > LIMIT) this.redo.shift();
    const saved = await this.save();
    if (!saved.ok) return saved;
    const changes = action.changes.map((change) => ({
      kind: change.kind, id: change.id, before: change.after, after: change.before,
    }));
    return ok(this.commitOf(`Отмена: ${action.label}`, changes));
  }

  async redoLast(): Promise<Result<HistoryCommit>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const action = this.redo.pop();
    if (action === undefined) return err('INVALID_ARGUMENT', 'Возвращать больше нечего.');
    const applied = await this.apply(action, 'redo');
    if (!applied.ok) return applied;
    this.undo.push(action);
    if (this.undo.length > LIMIT) this.undo.shift();
    const saved = await this.save();
    if (!saved.ok) return saved;
    const changes = action.changes.map((change) => ({ ...change }));
    return ok(this.commitOf(`Возврат: ${action.label}`, changes));
  }

  /** Итог команды одним видом: состояние стека плюс перечень изменений. */
  private commitOf(label: string, changes: readonly HistoryEntityChange[]): HistoryCommit {
    return { state: this.state(), label, changes };
  }

  async getState(): Promise<Result<HistoryState>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    return ok(this.state());
  }

  private async apply(action: StoredAction, direction: 'undo' | 'redo'): Promise<Result<void>> {
    const changes = direction === 'undo' ? [...action.changes].reverse() : action.changes;
    for (const change of changes) {
      const adapter = this.adapters.get(change.kind);
      if (adapter === undefined) return err('INTERNAL', `Нет адаптера истории для ${change.kind}.`);
      const value = direction === 'undo' ? change.before : change.after;
      const result = value === null ? await adapter.remove(change.id) : await adapter.put(value);
      if (!result.ok) return result;
    }
    return ok(undefined);
  }

  private state(): HistoryState {
    return {
      canUndo: this.undo.length > 0,
      canRedo: this.redo.length > 0,
      undoDepth: this.undo.length,
      redoDepth: this.redo.length,
    };
  }

  private async load(): Promise<Result<void>> {
    if (this.loaded) return ok(undefined);
    this.loaded = true;
    if (this.path === null) return ok(undefined);

    const stored = await readJsonRecord(this.path);
    // Испорченный файл истории — не повод останавливать работу: в отличие от
    // журнала, стек отмены восстанавливается сам и ничего не хранит навсегда.
    if (!stored.ok || stored.value === null) return ok(undefined);

    const parsed = stored.value as Partial<StoredHistory>;
    this.undo = [...(parsed.undo ?? [])].slice(-LIMIT);
    this.redo = [...(parsed.redo ?? [])].slice(-LIMIT);
    return ok(undefined);
  }

  private async save(): Promise<Result<void>> {
    if (this.path === null) return ok(undefined);
    return writeJsonAtomically(this.path, { undo: this.undo, redo: this.redo });
  }
}

function cloneValue(value: unknown | null): unknown | null {
  if (value === null) return null;
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function sameValue(a: unknown | null, b: unknown | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
