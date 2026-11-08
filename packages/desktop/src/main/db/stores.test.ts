/**
 * Хранилища сущностей: записанное читается обратно тем же.
 *
 * Проверка сквозная — через порты, которыми пользуется ядро: если сущность
 * прошла запись и чтение без потерь, замена файлов на базу для ядра незаметна,
 * а этого и добивались.
 */

import { describe, expect, it } from 'vitest';
import type { PlanObject, Room, TreeNode } from '@izh/contracts';
import { openDatabase } from './database';
import { MIGRATIONS } from './schema';
import { createTreeStore } from './tree-store';
import { createRoomStore } from './rooms-store';
import { createObjectStore } from './objects-store';

const NOW = '2026-09-06T10:00:00.000Z';

function base() {
  const db = openDatabase(':memory:', MIGRATIONS);
  return { db, tree: createTreeStore(db), rooms: createRoomStore(db), objects: createObjectStore(db) };
}

function node(id: string, over: Partial<TreeNode> = {}): TreeNode {
  return {
    id, siteId: 'site', parentId: null, kind: 'organization', name: id,
    code: null, elevationM: null, note: null, building: null, sortOrder: 0,
    inCommonJournal: true, objectsPinned: false, archivedAt: null,
    createdAt: NOW, updatedAt: NOW, rowVersion: 1, ...over,
  } as TreeNode;
}

function room(id: string, levelId: string): Room {
  return {
    id, siteId: 'site', levelId, name: 'Электрощитовая', number: '105',
    category: 'В2', categoryBasis: null, purpose: 'производственное',
    fireClasses: ['A', 'E'], hasSuppression: false, heightM: 4.2,
    outline: [{ x: 1, y: 2 }, { x: 3, y: 4 }], areaM2: 400,
    archivedAt: null, createdAt: NOW, updatedAt: NOW, rowVersion: 1,
  };
}

function object(id: string, nodeId: string, over: Partial<PlanObject> = {}): PlanObject {
  return {
    id, siteId: 'site', nodeId, typeCode: 'extinguisher-powder', regNumber: 'ОП-12',
    model: 'ОП-5', manufacturer: null, serialNumber: null, commissionedOn: '2024-01-10',
    serviceLifeYears: 10, responsible: 'Иванов И. И.', roomId: null,
    position: { x: 60, y: 60 }, technicalState: 'исправен', note: null,
    archivedAt: null, createdAt: NOW, updatedAt: NOW, rowVersion: 1, ...over,
  } as PlanObject;
}

describe('хранилища сущностей', () => {
  it('узел с характеристиками здания читается тем же', async () => {
    const { db, tree } = base();
    const building = node('bld', {
      kind: 'building', name: 'Корпус 1',
      building: { fireResistance: 'II', functionalClasses: 'Ф5.1' } as TreeNode['building'],
    });

    await tree.save(building);
    const read = await tree.getById('bld');

    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value).toEqual(building);
    db.close();
  });

  it('характеристики убираются вместе с их очисткой', async () => {
    const { db, tree } = base();
    await tree.save(node('bld', { kind: 'building', building: { fireResistance: 'II' } as TreeNode['building'] }));
    await tree.save(node('bld', { kind: 'building', building: null }));

    const read = await tree.getById('bld');
    if (read.ok) expect(read.value.building).toBeNull();
    // Пустой строки в таблице характеристик не остаётся: «нет характеристик» и
    // «характеристики есть, но пустые» — разные ответы.
    expect(db.all('SELECT * FROM building_profiles')).toEqual([]);
    db.close();
  });

  it('помещение читается тем же и отбирается по этажу', async () => {
    const { db, tree, rooms } = base();
    await tree.save(node('org'));
    await tree.save(node('lvl', { kind: 'level', parentId: 'org' }));
    await tree.save(node('lvl2', { kind: 'level', parentId: 'org' }));

    const first = room('r1', 'lvl');
    await rooms.save(first);
    await rooms.save(room('r2', 'lvl2'));

    const read = await rooms.getById('r1');
    if (read.ok) expect(read.value).toEqual(first);

    const byLevel = await rooms.listByLevel('lvl');
    if (byLevel.ok) expect(byLevel.value.map((item) => item.id)).toEqual(['r1']);
    db.close();
  });

  it('элемент с карточкой вида читается тем же', async () => {
    const { db, tree, objects } = base();
    await tree.save(node('org'));

    const extinguisher = object('o1', 'org', {
      extinguisherProfile: { agent: 'порошок', nominalCharge: 5, fireClasses: ['A', 'B'] },
    } as unknown as Partial<PlanObject>);

    await objects.save(extinguisher);
    const read = await objects.getById('o1');

    expect(read.ok).toBe(true);
    if (!read.ok) return;

    /*
     * Сравнение не строгое, и это не поблажка. Необязательное поле в программе
     * бывает «его никогда не было» и «его очистили»; в базе и то и другое —
     * пустота, и читается она как `null`, потому что именно так записаны
     * необязательные поля в договорах. Для ядра разницы нет: оно везде пишет
     * `?? null`.
     */
    expect(read.value).toEqual({
      ...extinguisher,
      serviceLifeMonths: null, storageSection: null, systemId: null, placementId: null,
      registrationSignature: null,
    });
    db.close();
  });

  it('карточка вида убирается вместе с её очисткой', async () => {
    const { db, tree, objects } = base();
    await tree.save(node('org'));
    await objects.save(object('o1', 'org', { extinguisherProfile: { agent: 'порошок' } } as unknown as Partial<PlanObject>));
    await objects.save(object('o1', 'org', { extinguisherProfile: null } as unknown as Partial<PlanObject>));

    expect(db.all('SELECT * FROM object_profiles')).toEqual([]);
    db.close();
  });

  it('место на плане хранится обеими половинами или ни одной', async () => {
    const { db, tree, objects } = base();
    await tree.save(node('org'));
    await objects.save(object('o1', 'org', { position: null }));

    const read = await objects.getById('o1');
    if (read.ok) expect(read.value.position).toBeNull();
    db.close();
  });

  it('пачка записывается целиком или не записывается вовсе', async () => {
    const { db, tree, objects } = base();
    await tree.save(node('org'));

    // Второй элемент ссылается на несуществующий узел — вся пачка отменяется.
    await expect(objects.saveMany([
      object('o1', 'org'),
      object('o2', 'нет-такого-узла'),
    ])).rejects.toThrow();

    expect(db.all('SELECT * FROM objects')).toEqual([]);
    db.close();
  });

  it('элементы отбираются по узлу', async () => {
    const { db, tree, objects } = base();
    await tree.save(node('org'));
    await tree.save(node('lvl', { kind: 'level', parentId: 'org' }));
    await objects.save(object('o1', 'org'));
    await objects.save(object('o2', 'lvl'));

    const byNode = await objects.listByNode('lvl');
    if (byNode.ok) expect(byNode.value.map((item) => item.id)).toEqual(['o2']);
    db.close();
  });
});
