/**
 * Эталонные тесты истории команд.
 *
 * Главное, что здесь закреплено: журнал эксплуатации не откатывается. Отмена
 * должна возвращать правки карточек и дерева, но никогда не стирать записи о
 * проведённых проверках — это требование к журналу, а не удобство.
 */

import { describe, expect, it } from 'vitest';
import type { HistoryAdapter } from './command-history.js';
import { CommandHistory } from './command-history.js';
import { ok } from '@izh/contracts';

/** Поддельное хранилище одной сущности: держит записи в памяти. */
function memoryAdapter(kind: HistoryAdapter['kind'], store: Map<string, unknown>): HistoryAdapter {
  return {
    kind,
    async get(id) {
      return ok(store.get(id) ?? null);
    },
    async put(value) {
      const record = value as { readonly id: string };
      store.set(record.id, value);
      return ok(undefined);
    },
    async remove(id) {
      store.delete(id);
      return ok(undefined);
    },
  };
}

describe('история команд', () => {
  it('откатывает создание объекта', async () => {
    const objects = new Map<string, unknown>();
    const history = new CommandHistory([memoryAdapter('object', objects)]);

    const action = await history.begin('Создать объект');
    expect(action.ok).toBe(true);
    if (!action.ok) return;

    objects.set('o1', { id: 'o1', regNumber: '28-1' });
    await history.record(action.value.id, 'object', 'o1', null, { id: 'o1', regNumber: '28-1' });
    await history.commit(action.value.id);

    const undone = await history.undoLast();
    expect(undone.ok).toBe(true);
    expect(objects.has('o1')).toBe(false);
  });

  it('запись журнала эксплуатации не попадает в стек отмены', async () => {
    const events = new Map<string, unknown>([['e1', { id: 'e1', activityCode: 'osmotr' }]]);
    const history = new CommandHistory([memoryAdapter('maintenance', events)]);

    const action = await history.begin('Записать чек-лист проверки');
    expect(action.ok).toBe(true);
    if (!action.ok) return;

    await history.record(action.value.id, 'maintenance', 'e1', null, { id: 'e1', activityCode: 'osmotr' });
    const state = await history.commit(action.value.id);

    // Действие вышло пустым: откатывать нечего.
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    expect(state.value.state.canUndo).toBe(false);

    // И сама запись проверки на месте.
    expect(events.has('e1')).toBe(true);
  });

  it('после отмены правки карточки запись проверки остаётся', async () => {
    const objects = new Map<string, unknown>([['o1', { id: 'o1', note: 'было' }]]);
    const events = new Map<string, unknown>();
    const history = new CommandHistory([
      memoryAdapter('object', objects),
      memoryAdapter('maintenance', events),
    ]);

    const action = await history.begin('Записать чек-лист проверки');
    expect(action.ok).toBe(true);
    if (!action.ok) return;

    objects.set('o1', { id: 'o1', note: 'стало' });
    await history.record(action.value.id, 'object', 'o1', { id: 'o1', note: 'было' }, { id: 'o1', note: 'стало' });

    events.set('e1', { id: 'e1', activityCode: 'osmotr' });
    await history.record(action.value.id, 'maintenance', 'e1', null, { id: 'e1', activityCode: 'osmotr' });

    await history.commit(action.value.id);
    const undone = await history.undoLast();
    expect(undone.ok).toBe(true);

    // Карточка вернулась к прежнему виду...
    expect(objects.get('o1')).toEqual({ id: 'o1', note: 'было' });
    // ...а проведённая проверка осталась в журнале.
    expect(events.has('e1')).toBe(true);
  });
});
