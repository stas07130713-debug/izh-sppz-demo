/**
 * Отмена и возврат применяются к базе.
 *
 * Проверка появилась из-за настоящей опасности перехода: переходники отмены
 * писали прямо в файлы JSON. Оставь их такими — человек нажимал бы «отменить»,
 * файл менялся, а программа, читающая теперь базу, показывала бы прежнее.
 */

import { describe, expect, it } from 'vitest';
import type { TreeNode } from '@izh/contracts';
import { CommandHistory } from '../command-history';
import { openDatabase } from './database';
import { MIGRATIONS } from './schema';
import { createStorage } from './storage';
import { createDbHistoryAdapters } from './history-adapters';

const NOW = '2026-09-06T10:00:00.000Z';

function node(id: string, name: string): TreeNode {
  return {
    id, siteId: 'site', parentId: null, kind: 'organization', name,
    code: null, elevationM: null, note: null, building: null, sortOrder: 0,
    inCommonJournal: true, objectsPinned: false, archivedAt: null,
    createdAt: NOW, updatedAt: NOW, rowVersion: 1,
  } as TreeNode;
}

function setup() {
  const db = openDatabase(':memory:', MIGRATIONS);
  const storage = createStorage(db);
  const history = new CommandHistory(createDbHistoryAdapters(storage));
  return { db, storage, history };
}

describe('отмена действий и база', () => {
  it('отмена правки возвращает прежнее значение в базу', async () => {
    const { storage, history, db } = setup();
    const before = node('org', 'АО «Проверка»');
    await storage.tree.save(before);

    const action = await history.begin('Сохранить карточку узла');
    expect(action.ok).toBe(true);
    if (!action.ok) return;

    const after = { ...before, name: 'АО «Проверка» и Ко' };
    await history.record(action.value.id, 'tree', 'org', before, after);
    await storage.tree.save(after);
    await history.commit(action.value.id);

    await history.undoLast();

    const read = await storage.tree.getById('org');
    expect(read.ok && read.value.name).toBe('АО «Проверка»');
    db.close();
  });

  it('отмена заведения убирает запись из базы', async () => {
    const { storage, history, db } = setup();

    const action = await history.begin('Завести организацию');
    if (!action.ok) return;

    const created = node('org', 'АО «Проверка»');
    await history.record(action.value.id, 'tree', 'org', null, created);
    await storage.tree.save(created);
    await history.commit(action.value.id);

    await history.undoLast();

    const list = await storage.tree.list();
    expect(list.ok && list.value).toEqual([]);
    db.close();
  });

  it('возврат после отмены снова записывает', async () => {
    const { storage, history, db } = setup();

    const action = await history.begin('Завести организацию');
    if (!action.ok) return;

    const created = node('org', 'АО «Проверка»');
    await history.record(action.value.id, 'tree', 'org', null, created);
    await storage.tree.save(created);
    await history.commit(action.value.id);

    await history.undoLast();
    await history.redoLast();

    const list = await storage.tree.list();
    expect(list.ok && list.value).toHaveLength(1);
    db.close();
  });
});
