/**
 * Основание базы: открытие, версия схемы, связи и сделки.
 *
 * Проверяется не SQLite, а то, ради чего программа на него перешла: связи
 * между таблицами должны быть настоящими, а незавершённое действие не должно
 * оставлять половину записанного.
 */

import { describe, expect, it } from 'vitest';
import { migrate, openDatabase, schemaVersion, type Db } from './database';
import { MIGRATIONS } from './schema';

function base(): Db {
  return openDatabase(':memory:', MIGRATIONS);
}

const NOW = '2026-09-06T10:00:00.000Z';

function addNode(db: Db, id: string, parent: string | null = null): void {
  db.run(
    `INSERT INTO nodes(id, site_id, parent_id, kind, name, sort_order, in_common_journal,
      objects_pinned, created_at, updated_at, row_version)
     VALUES (?,?,?,?,?,0,1,0,?,?,1)`,
    [id, 'site', parent, parent === null ? 'organization' : 'level', id, NOW, NOW],
  );
}

function addObject(db: Db, id: string, nodeId: string): void {
  db.run(
    `INSERT INTO objects(id, site_id, node_id, type_code, technical_state,
      created_at, updated_at, row_version)
     VALUES (?,?,?,?,?,?,?,1)`,
    [id, 'site', nodeId, 'extinguisher', 'исправен', NOW, NOW],
  );
}

describe('основание базы', () => {
  it('схема поднимается до текущей версии', () => {
    // Версия сверяется с числом переходов: забыть поднять её, добавив переход,
    // — обычная ошибка, и стоит она тем, что переход не выполнится.
    const db = base();
    expect(schemaVersion(db)).toBe(MIGRATIONS.length);
    db.close();
  });

  it('повторное открытие ничего не ломает', () => {
    // Переходы применяются один раз: иначе второй запуск падал бы на создании
    // уже существующих таблиц.
    const db = base();
    migrate(db, MIGRATIONS);
    expect(schemaVersion(db)).toBe(MIGRATIONS.length);
    db.close();
  });

  it('заведённая база доезжает до новой версии, ничего не потеряв', () => {
    /*
     * Так выглядит обновление у заказчика: база уже наполнена первой версией
     * схемы, и перейти на вторую она должна сама. Проверяется и то и другое:
     * что новая колонка появилась и что прежние записи на месте.
     */
    const db = openDatabase(':memory:', [MIGRATIONS[0] as never]);
    db.run(
      `INSERT INTO users(id, login, full_name, role, must_change_password,
         created_at, updated_at, row_version)
       VALUES ('u1','ivanov','Иванов И. И.','администратор',0,'2026-01-01','2026-01-01',1)`,
    );
    expect(schemaVersion(db)).toBe(1);

    migrate(db, MIGRATIONS);

    expect(schemaVersion(db)).toBe(MIGRATIONS.length);
    const кто = db.get<{ full_name: string; organization: string | null }>(
      'SELECT full_name, organization FROM users WHERE id = ?', ['u1'],
    );
    expect(кто?.full_name).toBe('Иванов И. И.');
    expect(кто?.organization ?? null).toBeNull();
    db.close();
  });

  it('элемент нельзя завести в несуществующем узле', () => {
    // То, чего не могли файлы JSON: там связь держалась на совпадении строк.
    const db = base();
    expect(() => addObject(db, 'o1', 'нет-такого')).toThrow();
    db.close();
  });

  it('узел с элементами не удаляется', () => {
    const db = base();
    addNode(db, 'n1');
    addObject(db, 'o1', 'n1');
    // Вывод из обращения — пометка, а не удаление: удалить узел с элементами
    // означало бы потерять их вместе с историей.
    expect(() => db.run('DELETE FROM nodes WHERE id = ?', ['n1'])).toThrow();
    db.close();
  });

  it('карточка вида уходит вместе со своим элементом', () => {
    const db = base();
    addNode(db, 'n1');
    addObject(db, 'o1', 'n1');
    db.run('INSERT INTO object_profiles(object_id, kind, data) VALUES (?,?,?)',
      ['o1', 'extinguisher', '{}']);

    db.run('DELETE FROM objects WHERE id = ?', ['o1']);
    expect(db.all('SELECT * FROM object_profiles')).toEqual([]);
    db.close();
  });

  it('записи журнала эксплуатации удалить нельзя', () => {
    const db = base();
    addNode(db, 'n1');
    addObject(db, 'o1', 'n1');
    db.run(
      `INSERT INTO maintenance_events(id, site_id, object_id, activity_code, performed_on,
        result, created_at)
       VALUES (?,?,?,?,?,?,?)`,
      ['m1', 'site', 'o1', 'osmotr', '2026-09-01', 'выполнено', NOW],
    );

    // Даже удаление элемента не уносит доказательство проведённых работ.
    expect(() => db.run('DELETE FROM objects WHERE id = ?', ['o1'])).toThrow();
    db.close();
  });

  it('незавершённое действие не оставляет половины', () => {
    const db = base();
    addNode(db, 'n1');

    expect(() => db.transaction(() => {
      addObject(db, 'o1', 'n1');
      throw new Error('срыв посреди работы');
    })).toThrow('срыв посреди работы');

    expect(db.all('SELECT * FROM objects')).toEqual([]);
    db.close();
  });

  it('вложенное действие записывается вместе с внешним', () => {
    // Сценарии ядра вызывают друг друга, а второй сделки SQLite не открывает:
    // решает внешний вызов.
    const db = base();
    addNode(db, 'n1');

    expect(() => db.transaction(() => {
      db.transaction(() => addObject(db, 'o1', 'n1'));
      throw new Error('срыв');
    })).toThrow();

    expect(db.all('SELECT * FROM objects')).toEqual([]);
    db.close();
  });

  it('журнал изменений переживает удаление того, о чём написан', () => {
    const db = base();
    addNode(db, 'n1');
    db.run(
      `INSERT INTO change_log(id, at, author_id, author_name, author_role, command,
        action, subject, subject_id, subject_title, node_id, fields_json)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      ['c1', NOW, 'u1', 'Иванов И. И.', 'администратор', 'Удалить узел',
        'удалено', 'узел дерева', 'n1', 'Этаж 1', 'n1', '[]'],
    );

    db.run('DELETE FROM nodes WHERE id = ?', ['n1']);
    // Запись осталась — ради таких случаев журнал и ведут.
    expect(db.all('SELECT * FROM change_log')).toHaveLength(1);
    db.close();
  });
});
