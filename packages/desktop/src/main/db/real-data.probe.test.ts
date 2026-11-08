/**
 * Перенос настоящих данных предприятия — проверка на копии.
 *
 * Работает только тогда, когда рядом лежит копия рабочих файлов: на чистой
 * машине проверка пропускается, а не падает. Оригинал не трогается вовсе —
 * читается копия, база создаётся во временной папке.
 */

import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { legacyPaths, openStorage } from './storage';

const DATA = join(import.meta.dirname, '..', '..', '..', '..', '..', '_try', 'данные-копия');
const available = existsSync(join(DATA, 'tree.json'));

/** Сколько записей в прежнем файле: с этим и сверяем перенесённое. */
function countIn(file: string, key: string): number {
  try {
    const parsed = JSON.parse(readFileSync(join(DATA, file), 'utf8')) as Record<string, unknown>;
    const list = parsed[key];
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}

describe.skipIf(!available)('перенос настоящих данных', () => {
  it('переносит всё, что было в файлах', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'izh-real-'));
    const storage = await openStorage({
      databasePath: join(dir, 'sppz.db'),
      legacy: legacyPaths(DATA),
      reportPath: join(dir, 'отчёт.json'),
    });

    const nodes = await storage.tree.list();
    const objects = await storage.objects.list();
    const events = await storage.maintenance.list();
    const rooms = await storage.rooms.list();

    const counted = {
      узлы: nodes.ok ? nodes.value.length : -1,
      элементы: objects.ok ? objects.value.length : -1,
      записи: events.ok ? events.value.length : -1,
      помещения: rooms.ok ? rooms.value.length : -1,
    };

    // Ни одна запись не потеряна: столько же, сколько было в файлах.
    expect(counted.узлы).toBe(countIn('tree.json', 'nodes'));
    expect(counted.элементы).toBe(countIn('objects.json', 'objects'));
    expect(counted.записи).toBe(countIn('maintenance.json', 'events'));
    expect(counted.помещения).toBe(countIn('rooms.json', 'rooms'));

    // Видно в отчёте прогона: сколько чего перенесено.
    // eslint-disable-next-line no-console
    console.log('перенесено:', counted);

    storage.db.close();
  });

  it('масштаб и правка чертежей доехали вместе с подложками', async () => {
    /*
     * Здесь и вскрылась потеря: перенос брал из backdrops.json только сам
     * список подложек, а лежащие рядом масштабы и правку чертежей — нет. У
     * заказчика это выглядело так: масштаб «пропал, хотя был задан», проверка
     * расстановки огнетушителей стала считать вздор, а значки разъехались по
     * неочищенному чертежу другого размера.
     */
    const dir = mkdtempSync(join(tmpdir(), 'izh-real-'));
    const storage = await openStorage({
      databasePath: join(dir, 'sppz.db'),
      legacy: legacyPaths(DATA),
    });

    const calibrations = storage.db.get<{ n: number }>('SELECT count(*) AS n FROM calibrations');
    const cleanups = storage.db.get<{ n: number }>('SELECT count(*) AS n FROM cleanups');

    expect(calibrations?.n ?? 0).toBe(countIn('backdrops.json', 'calibrations'));
    expect(cleanups?.n ?? 0).toBe(countIn('backdrops.json', 'cleanups'));
    // Проверка имеет смысл, только если в файлах вообще что-то было.
    expect(countIn('backdrops.json', 'calibrations')).toBeGreaterThan(0);

    storage.db.close();
  });

  it('карточки видов доехали вместе с элементами', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'izh-real-'));
    const storage = await openStorage({
      databasePath: join(dir, 'sppz.db'),
      legacy: legacyPaths(DATA),
    });

    const raw = JSON.parse(readFileSync(join(DATA, 'objects.json'), 'utf8')) as {
      objects: readonly Record<string, unknown>[];
    };
    const withProfile = raw.objects.filter((item) => item['extinguisherProfile'] != null);

    const profiles = storage.db.get<{ n: number }>(
      "SELECT count(*) AS n FROM object_profiles WHERE kind = 'extinguisherProfile'",
    );

    expect(profiles?.n ?? 0).toBe(withProfile.length);
    storage.db.close();
  });

  it('связи элементов с узлами не потерялись', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'izh-real-'));
    const storage = await openStorage({
      databasePath: join(dir, 'sppz.db'),
      legacy: legacyPaths(DATA),
    });

    /*
     * Элементов без узла в базе быть не может по устройству схемы — но
     * проверить стоит именно на настоящих данных: если в прежних файлах такие
     * были, они попали бы в отчёт о переносе, а не в базу.
     */
    const orphans = storage.db.get<{ n: number }>(`
      SELECT count(*) AS n FROM objects o
      LEFT JOIN nodes n ON n.id = o.node_id
      WHERE n.id IS NULL
    `);
    expect(orphans?.n ?? 0).toBe(0);
    storage.db.close();
  });
});
