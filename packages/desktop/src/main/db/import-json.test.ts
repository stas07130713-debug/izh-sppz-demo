/**
 * Перенос данных из прежних файлов в базу.
 *
 * Проверяется то, ради чего перенос и делают: данные предприятия не теряются,
 * связи восстанавливаются, а испорченные записи из прежнего хранения не рушат
 * перенос остальных.
 */

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDatabase } from './database';
import { MIGRATIONS } from './schema';
import { importFromJson, isEmpty, recoverMissing, type ImportPaths } from './import-json';

const NOW = '2026-09-06T10:00:00.000Z';

function folder(): string {
  return mkdtempSync(join(tmpdir(), 'izh-import-'));
}

function write(dir: string, name: string, value: unknown): void {
  writeFileSync(join(dir, name), JSON.stringify(value), 'utf8');
}

function paths(dir: string): ImportPaths {
  return {
    tree: join(dir, 'tree.json'),
    rooms: join(dir, 'rooms.json'),
    objects: join(dir, 'objects.json'),
    maintenance: join(dir, 'maintenance.json'),
    users: join(dir, 'users.json'),
    audit: join(dir, 'audit.json'),
    changeLog: join(dir, 'change-log.json'),
    backdrops: join(dir, 'backdrops.json'),
    settings: join(dir, 'settings.json'),
    regulations: join(dir, 'regulations.json'),
  };
}

const NODES = [
  {
    id: 'org', siteId: 'org', parentId: null, kind: 'organization', name: 'АО «Проверка»',
    code: null, elevationM: null, note: null, building: null, sortOrder: 0,
    inCommonJournal: true, objectsPinned: false, archivedAt: null,
    createdAt: NOW, updatedAt: NOW, rowVersion: 1,
  },
  // Этаж записан в файле раньше своего здания: порядка в файлах не было.
  {
    id: 'lvl', siteId: 'org', parentId: 'bld', kind: 'level', name: 'Этаж 1',
    code: null, elevationM: 0, note: null, building: null, sortOrder: 1,
    inCommonJournal: true, objectsPinned: false, archivedAt: null,
    createdAt: NOW, updatedAt: NOW, rowVersion: 1,
  },
  {
    id: 'bld', siteId: 'org', parentId: 'org', kind: 'building', name: 'Корпус 1',
    code: null, elevationM: null, note: null, building: { fireResistance: 'II' }, sortOrder: 0,
    inCommonJournal: true, objectsPinned: false, archivedAt: null,
    createdAt: NOW, updatedAt: NOW, rowVersion: 1,
  },
];

const OBJECTS = [
  // Извещатель ссылается на прибор, записанный ниже: и это переносится верно.
  {
    id: 'det', siteId: 'org', nodeId: 'lvl', typeCode: 'smoke-detector', regNumber: 'ИП-1',
    model: null, manufacturer: null, serialNumber: null, commissionedOn: null,
    responsible: null, roomId: null, position: null, technicalState: 'исправен',
    systemId: 'ppk', note: null, archivedAt: null, createdAt: NOW, updatedAt: NOW, rowVersion: 1,
  },
  {
    id: 'ppk', siteId: 'org', nodeId: 'lvl', typeCode: 'control-panel', regNumber: 'ППК-1',
    model: null, manufacturer: null, serialNumber: null, commissionedOn: null,
    responsible: null, roomId: null, position: { x: 10, y: 20 }, technicalState: 'исправен',
    note: null, archivedAt: null, createdAt: NOW, updatedAt: NOW, rowVersion: 1,
  },
];

function seed(dir: string): void {
  write(dir, 'tree.json', { nodes: NODES });
  write(dir, 'objects.json', { objects: OBJECTS });
  write(dir, 'rooms.json', { rooms: [] });
  write(dir, 'maintenance.json', {
    events: [{
      id: 'm1', siteId: 'org', objectId: 'ppk', activityCode: 'osmotr',
      performedOn: '2026-08-01', result: 'выполнено', checklist: [], defect: null,
      executor: null, note: null, createdAt: NOW,
    }],
  });
  write(dir, 'users.json', {
    users: [{
      id: 'u1', login: 'admin', fullName: 'Иванов И. И.', position: null, email: null,
      role: 'администратор', scope: ['bld', 'lvl'], password: null, mustChangePassword: false,
      archivedAt: null, createdAt: NOW, updatedAt: NOW, rowVersion: 1,
    }],
  });
  write(dir, 'audit.json', {
    audit: [{
      id: 'a1', at: NOW, actorId: 'u1', actorName: 'Иванов И. И.',
      actorRole: 'администратор', kind: 'вход', subject: null, details: null,
    }],
  });
  write(dir, 'change-log.json', { changes: [] });
  /*
   * Подложка со своим масштабом и правкой чертежа. Все три списка лежат в
   * одном файле, и переносить их надо вместе: без масштаба не считается ни
   * площадь помещения, ни расстояние до огнетушителя, а без правки чертежа
   * показывается исходный лист другого размера — и значки на нём оказываются
   * не на своих местах.
   */
  write(dir, 'backdrops.json', {
    backdrops: [{
      id: 'b1', nodeId: 'lvl', sourceHash: 'h', sourceFileName: 'этаж.png', sourceKind: 'image',
      pageNumber: 1, dpi: null, rotationDeg: 0, crop: null, widthPx: 400, heightPx: 300,
      imageHash: 'h', createdAt: NOW,
    }],
    calibrations: [{ backdropId: 'b1', metersPerPixel: 0.05, widthM: 20, source: 'две точки' }],
    cleanups: [{
      backdropId: 'b1', engineVersion: 1, cleanedImageHash: 'ч', widthPx: 380, heightPx: 290,
      operations: [],
    }],
  });
  write(dir, 'settings.json', { soonThresholdDays: 14 });
  write(dir, 'regulations.json', { regulations: [], versions: [], documents: [], templates: [] });
}

describe('перенос данных из файлов', () => {
  it('пустая база видна как пустая', () => {
    const db = openDatabase(':memory:', MIGRATIONS);
    expect(isEmpty(db)).toBe(true);
    db.close();
  });

  it('переносит дерево, элементы, историю и людей', async () => {
    const dir = folder();
    seed(dir);
    const db = openDatabase(':memory:', MIGRATIONS);

    const report = await importFromJson(db, paths(dir));

    expect(report.skipped).toEqual([]);
    expect(db.get<{ n: number }>('SELECT count(*) n FROM nodes')?.n).toBe(3);
    expect(db.get<{ n: number }>('SELECT count(*) n FROM objects')?.n).toBe(2);
    expect(db.get<{ n: number }>('SELECT count(*) n FROM maintenance_events')?.n).toBe(1);
    expect(db.get<{ n: number }>('SELECT count(*) n FROM users')?.n).toBe(1);
    expect(isEmpty(db)).toBe(false);
    db.close();
  });

  it('связи восстанавливаются, каким бы ни был порядок в файле', async () => {
    // В файле этаж шёл раньше своего здания, а извещатель — раньше прибора.
    const dir = folder();
    seed(dir);
    const db = openDatabase(':memory:', MIGRATIONS);

    await importFromJson(db, paths(dir));

    const level = db.get<{ parent_id: string }>(
      'SELECT parent_id FROM nodes WHERE id = ?', ['lvl'],
    );
    expect(level?.parent_id).toBe('bld');

    const detector = db.get<{ system_id: string }>(
      'SELECT system_id FROM objects WHERE id = ?', ['det'],
    );
    expect(detector?.system_id).toBe('ppk');
    db.close();
  });

  it('область прав становится связями, а не полем', async () => {
    const dir = folder();
    seed(dir);
    const db = openDatabase(':memory:', MIGRATIONS);

    await importFromJson(db, paths(dir));

    const scope = db.all<{ node_id: string }>(
      'SELECT node_id FROM user_scopes WHERE user_id = ?', ['u1'],
    );
    expect(scope.map((item) => item.node_id).sort()).toEqual(['bld', 'lvl']);
    db.close();
  });

  it('характеристики здания переносятся своей строкой', async () => {
    const dir = folder();
    seed(dir);
    const db = openDatabase(':memory:', MIGRATIONS);

    await importFromJson(db, paths(dir));

    const profile = db.get<{ data: string }>(
      'SELECT data FROM building_profiles WHERE node_id = ?', ['bld'],
    );
    expect(profile?.data).toContain('II');
    db.close();
  });

  it('испорченная запись не рушит перенос остальных', async () => {
    const dir = folder();
    seed(dir);
    // Элемент от узла, которого нет: след ошибки прежнего хранения.
    write(dir, 'objects.json', {
      objects: [
        ...OBJECTS,
        {
          id: 'сирота', siteId: 'org', nodeId: 'нет-такого-узла', typeCode: 'extinguisher',
          regNumber: null, model: null, manufacturer: null, serialNumber: null,
          commissionedOn: null, responsible: null, roomId: null, position: null,
          technicalState: 'исправен', note: null, archivedAt: null,
          createdAt: NOW, updatedAt: NOW, rowVersion: 1,
        },
      ],
    });

    const db = openDatabase(':memory:', MIGRATIONS);
    const report = await importFromJson(db, paths(dir));

    // Остальные перенесены, а о непереносимой сказано, а не умолчано.
    expect(db.get<{ n: number }>('SELECT count(*) n FROM objects')?.n).toBe(2);
    expect(report.skipped.length).toBeGreaterThan(0);
    db.close();
  });

  it('масштаб и правка чертежа переносятся вместе с подложкой', async () => {
    const dir = folder();
    seed(dir);
    const db = openDatabase(':memory:', MIGRATIONS);

    const report = await importFromJson(db, paths(dir));

    expect(report.skipped).toEqual([]);
    expect(db.get<{ n: number }>('SELECT count(*) n FROM backdrops')?.n).toBe(1);
    expect(db.get<{ n: number }>('SELECT count(*) n FROM calibrations')?.n).toBe(1);
    expect(db.get<{ n: number }>('SELECT count(*) n FROM cleanups')?.n).toBe(1);
    db.close();
  });

  it('добор поднимает масштаб, пропущенный прежним переносом', async () => {
    /*
     * Так и случилось на деле: перенос забыл масштабы и правку чертежей, а
     * узналось это, когда база была уже не пуста и обычный перенос к ней не
     * подступался. Прежние файлы при этом целы — из них и добирается.
     */
    const dir = folder();
    seed(dir);
    const db = openDatabase(':memory:', MIGRATIONS);
    await importFromJson(db, paths(dir));
    db.run('DELETE FROM calibrations');
    db.run('DELETE FROM cleanups');

    const report = await recoverMissing(db, paths(dir));

    expect(report.skipped).toEqual([]);
    expect(report.moved['масштабы']).toBe(1);
    expect(db.get<{ n: number }>('SELECT count(*) n FROM calibrations')?.n).toBe(1);
    expect(db.get<{ n: number }>('SELECT count(*) n FROM cleanups')?.n).toBe(1);
    db.close();
  });

  it('добор не трогает масштаб, заданный после перехода', async () => {
    /*
     * Пока ошибку искали, человек задал масштаб заново хотя бы одному этажу.
     * Его работа новее файла: вернуть чертёж к прежнему значению — та же
     * потеря данных, только наоборот.
     */
    const dir = folder();
    seed(dir);
    const db = openDatabase(':memory:', MIGRATIONS);
    await importFromJson(db, paths(dir));
    db.run('DELETE FROM cleanups');
    db.run(
      'UPDATE calibrations SET data = ? WHERE backdrop_id = ?',
      [JSON.stringify({ backdropId: 'b1', metersPerPixel: 0.02, widthM: 8, source: 'две точки' }), 'b1'],
    );

    const report = await recoverMissing(db, paths(dir));

    expect(report.moved['масштабы']).toBeUndefined();
    expect(report.moved['правка чертежей']).toBe(1);
    const kept = db.get<{ data: string }>('SELECT data FROM calibrations WHERE backdrop_id = ?', ['b1']);
    expect(JSON.parse(kept?.data ?? '{}').metersPerPixel).toBe(0.02);
    db.close();
  });

  it('добору нечего делать, когда масштаб на месте', async () => {
    const dir = folder();
    seed(dir);
    const db = openDatabase(':memory:', MIGRATIONS);
    await importFromJson(db, paths(dir));

    const report = await recoverMissing(db, paths(dir));

    // Ничего не тронуто: запись, сделанную человеком после перехода, добор
    // перезаписать не должен.
    expect(report.moved).toEqual({});
    expect(report.skipped).toEqual([]);
    db.close();
  });

  it('первый запуск без файлов проходит без ошибок', async () => {
    const dir = folder();
    const db = openDatabase(':memory:', MIGRATIONS);

    const report = await importFromJson(db, paths(dir));

    expect(report.skipped).toEqual([]);
    expect(isEmpty(db)).toBe(true);
    db.close();
  });
});
