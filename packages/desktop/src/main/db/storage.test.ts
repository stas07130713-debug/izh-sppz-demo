/**
 * Хранилище целиком: открытие настоящего файла базы, перенос и чтение.
 *
 * Самая важная проверка перехода: она повторяет первый запуск у человека,
 * который до этого работал на файлах. Данные должны оказаться в базе, читаться
 * через те же порты и пережить закрытие и повторное открытие программы.
 */

import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { legacyPaths, openStorage } from './storage';

const NOW = '2026-09-06T10:00:00.000Z';

function folder(): string {
  return mkdtempSync(join(tmpdir(), 'izh-storage-'));
}

function seedLegacy(dir: string): void {
  writeFileSync(join(dir, 'tree.json'), JSON.stringify({
    nodes: [{
      id: 'org', siteId: 'org', parentId: null, kind: 'organization', name: 'АО «Проверка»',
      code: null, elevationM: null, note: null, building: null, sortOrder: 0,
      inCommonJournal: true, objectsPinned: false, archivedAt: null,
      createdAt: NOW, updatedAt: NOW, rowVersion: 1,
    }],
  }), 'utf8');

  writeFileSync(join(dir, 'objects.json'), JSON.stringify({
    objects: [{
      id: 'o1', siteId: 'org', nodeId: 'org', typeCode: 'extinguisher-powder',
      regNumber: 'ОП-1', model: 'ОП-5', manufacturer: null, serialNumber: null,
      commissionedOn: '2024-01-10', responsible: null, roomId: null,
      position: { x: 1, y: 2 }, technicalState: 'исправен', note: null, archivedAt: null,
      createdAt: NOW, updatedAt: NOW, rowVersion: 1,
      extinguisherProfile: { agent: 'порошок', nominalCharge: 5 },
    }],
  }), 'utf8');
}

describe('хранилище программы', () => {
  it('первый запуск переносит прежние данные в базу', async () => {
    const dir = folder();
    seedLegacy(dir);
    const path = join(dir, 'sppz.db');

    const storage = await openStorage({
      databasePath: path,
      legacy: legacyPaths(dir),
      reportPath: join(dir, 'отчёт.json'),
    });

    const nodes = await storage.tree.list();
    const objects = await storage.objects.list();

    expect(nodes.ok && nodes.value).toHaveLength(1);
    expect(objects.ok && objects.value).toHaveLength(1);
    // Файл базы появился на диске: его можно скопировать и положить в резерв.
    expect(existsSync(path)).toBe(true);
    // Отчёт о переносе записан рядом.
    expect(existsSync(join(dir, 'отчёт.json'))).toBe(true);

    storage.db.close();
  });

  it('данные переживают закрытие и повторное открытие', async () => {
    const dir = folder();
    seedLegacy(dir);
    const path = join(dir, 'sppz.db');

    const first = await openStorage({ databasePath: path, legacy: legacyPaths(dir) });
    const before = await first.objects.getById('o1');
    first.db.close();

    // Второе открытие: перенос не повторяется — база уже не пуста.
    const second = await openStorage({ databasePath: path, legacy: legacyPaths(dir) });
    const after = await second.objects.getById('o1');
    const all = await second.objects.list();

    expect(all.ok && all.value).toHaveLength(1);
    expect(before.ok && after.ok && after.value).toEqual(before.ok ? before.value : null);
    second.db.close();
  });

  it('карточка вида переживает перенос', async () => {
    const dir = folder();
    seedLegacy(dir);

    const storage = await openStorage({
      databasePath: join(dir, 'sppz.db'),
      legacy: legacyPaths(dir),
    });

    const read = await storage.objects.getById('o1');
    expect(read.ok).toBe(true);
    if (read.ok) {
      const profile = (read.value as unknown as { extinguisherProfile: { agent: string } })
        .extinguisherProfile;
      expect(profile.agent).toBe('порошок');
    }
    storage.db.close();
  });

  it('база без прежних файлов открывается пустой', async () => {
    const dir = folder();
    const storage = await openStorage({ databasePath: join(dir, 'sppz.db'), legacy: null });

    const nodes = await storage.tree.list();
    expect(nodes.ok && nodes.value).toEqual([]);
    storage.db.close();
  });

  it('настройки читаются со значениями по умолчанию', async () => {
    const dir = folder();
    const storage = await openStorage({ databasePath: join(dir, 'sppz.db'), legacy: null });

    const settings = await storage.settings.get();
    expect(settings.ok).toBe(true);
    // Новая настройка у прежнего пользователя получает разумное значение,
    // а не ноль: это и проверяется.
    if (settings.ok) expect(settings.value.soonThresholdDays).toBeGreaterThan(0);
    storage.db.close();
  });
});
