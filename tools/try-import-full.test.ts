/**
 * Полный цикл переноса журнала: файл → движок → предпросмотр → записи.
 *
 * Здесь вызываются ровно те же функции и в том же порядке, что и мастер в окне
 * программы: движок E7 читает файл, ядро сопоставляет колонки и строит
 * предпросмотр, затем сценарии `placeObject` и `recordMaintenance` создают
 * записи. Отличие одно — хранилища поддельные, в памяти, и файл открывается
 * напрямую, а не через диалог.
 *
 * Зачем именно так. Проверить перенос 163 записей щелчками по окну ненадёжно и
 * ничего не доказывает про содержимое журнала. Здесь же видно главное: что
 * получилось в записях, попали ли даты в мероприятия и какие статусы посчитал
 * движок сроков.
 *
 * Пропускается без файла:
 *   IZH_JOURNAL="C:/.../Журнал.xlsx" npx vitest run tools/try-import-full.test.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type {
  Clock,
  IdGenerator,
  MaintenanceEvent,
  MaintenanceEventRepository,
  ObjectTreeRepository,
  PlanObject,
  PlanObjectRepository,
  TreeNode,
} from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import {
  activityCellsForObject,
  buildImportPreview,
  datesToActivities,
  detectHeaderRow,
  matchColumns,
  placeObject,
  recordMaintenance,
  updateObject,
} from '@izh/core';
import { journalSourceEngine } from '@izh/engine-journal-source';

const JOURNAL = process.env.IZH_JOURNAL ?? '';
const available = JOURNAL !== '' && existsSync(JOURNAL);

const LEVEL: TreeNode = {
  id: 'level-1',
  siteId: 'org-1',
  parentId: 'building-1',
  kind: 'level',
  name: '1 этаж',
  code: null,
  elevationM: 0,
  note: null,
  building: null,
  sortOrder: 0,
  inCommonJournal: true,
  archivedAt: null,
  createdAt: '2026-08-17T00:00:00.000Z',
  updatedAt: '2026-08-17T00:00:00.000Z',
  rowVersion: 1,
};

function memoryTree(): ObjectTreeRepository {
  return {
    async list() {
      return ok([LEVEL]);
    },
    async getById(id) {
      return id === LEVEL.id ? ok(LEVEL) : err('NOT_FOUND', `Нет узла ${id}`);
    },
    async save() {
      return ok(undefined);
    },
  };
}

function memoryObjects(): PlanObjectRepository {
  const objects = new Map<string, PlanObject>();
  return {
    async list() {
      return ok([...objects.values()]);
    },
    async listByNode(nodeId) {
      return ok([...objects.values()].filter((object) => object.nodeId === nodeId));
    },
    async getById(id) {
      const found = objects.get(id);
      return found === undefined ? err('NOT_FOUND', `Нет объекта ${id}`) : ok(found);
    },
    async save(object) {
      objects.set(object.id, object);
      return ok(undefined);
    },
  };
}

function memoryEvents(): MaintenanceEventRepository {
  const events = new Map<string, MaintenanceEvent>();
  return {
    async list() {
      return ok([...events.values()]);
    },
    async listByObject(objectId) {
      return ok([...events.values()].filter((event) => event.objectId === objectId));
    },
    async save(event) {
      events.set(event.id, event);
      return ok(undefined);
    },
  };
}

const clock: Clock = { nowUtc: () => '2026-08-17T00:00:00.000Z' };

function counterIds(): IdGenerator {
  let counter = 0;
  return {
    newId: () => {
      counter += 1;
      return `id-${counter}`;
    },
  };
}

describe.skipIf(!available)('полный перенос журнала', () => {
  it('переносит записи листа «Огнетушители» вместе с мероприятиями', async () => {
    const bytes = new Uint8Array(readFileSync(JOURNAL));

    const sheet = journalSourceEngine.readSheet(bytes, 'Огнетушители');
    expect(sheet.ok).toBe(true);
    if (!sheet.ok) return;

    const headerIndex = detectHeaderRow(sheet.value.rows);
    expect(headerIndex).not.toBeNull();
    if (headerIndex === null) return;

    const matches = matchColumns(sheet.value.rows[headerIndex] ?? []);
    const preview = buildImportPreview({
      rows: sheet.value.rows,
      headerRowIndex: headerIndex,
      matches,
      existingObjects: [],
      baseTypeCode: 'extinguisher',
    });

    const objects = memoryObjects();
    const events = memoryEvents();
    const objectDeps = { objects, tree: memoryTree(), clock, ids: counterIds() };
    const maintenanceDeps = { events, objects, clock, ids: counterIds() };

    let createdObjects = 0;
    let createdEvents = 0;
    const failures: string[] = [];

    for (const row of preview.rows.filter((r) => r.verdict === 'создать')) {
      const placed = await placeObject(objectDeps, {
        nodeId: LEVEL.id,
        typeCode: row.typeCode,
        position: null,
        regNumber: row.regNumber,
        model: row.model,
        responsible: row.responsible,
      });
      if (!placed.ok) {
        failures.push(`стр.${row.sourceRow}: ${placed.error.message}`);
        continue;
      }
      createdObjects += 1;

      if (row.technicalState !== 'не определено' || row.placement !== null) {
        await updateObject(objectDeps, {
          id: placed.value.id,
          regNumber: row.regNumber,
          model: row.model,
          responsible: row.responsible,
          technicalState: row.technicalState,
          note: row.placement === null ? null : `Место по журналу: ${row.placement}`,
        });
      }

      for (const activity of datesToActivities(row.typeCode, row.lastCheck, row.lastRecharge)) {
        const recorded = await recordMaintenance(maintenanceDeps, {
          objectId: placed.value.id,
          activityCode: activity.activityCode,
          performedOn: activity.performedOn,
          result: 'выполнено',
          checklist: [],
          note: 'Перенесено из существующего журнала',
        });
        if (recorded.ok) createdEvents += 1;
        else failures.push(`стр.${row.sourceRow} мероприятие: ${recorded.error.message}`);
      }
    }

    // eslint-disable-next-line no-console -- вывод и есть отчёт прогона
    console.log(`создано объектов: ${createdObjects}, мероприятий: ${createdEvents}`);
    if (failures.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`не удалось: ${failures.length}\n  ` + failures.slice(0, 5).join('\n  '));
    }

    expect(createdObjects).toBe(preview.toCreate);
    expect(failures).toEqual([]);
    expect(createdEvents).toBeGreaterThan(0);

    // Что получилось в журнале: статусы считаются по перенесённым датам.
    const stored = await objects.list();
    const allEvents = await events.list();
    if (!stored.ok || !allEvents.ok) return;

    const byType = new Map<string, number>();
    for (const object of stored.value) byType.set(object.typeCode, (byType.get(object.typeCode) ?? 0) + 1);
    // eslint-disable-next-line no-console
    console.log('по типам: ' + [...byType].map(([type, count]) => `${type}=${count}`).join(', '));

    const statuses = new Map<string, number>();
    for (const object of stored.value) {
      for (const cell of activityCellsForObject(object, allEvents.value, '2026-08-17', 14)) {
        const key = `${cell.rule.title}: ${cell.schedule.status}`;
        statuses.set(key, (statuses.get(key) ?? 0) + 1);
      }
    }
    // eslint-disable-next-line no-console
    console.log('статусы в журнале:\n  ' + [...statuses].map(([key, count]) => `${key} — ${count}`).join('\n  '));

    const sample = stored.value[0];
    // eslint-disable-next-line no-console
    console.log(
      `пример записи: № ${sample?.regNumber}, ${sample?.model}, тип ${sample?.typeCode}, ` +
        `состояние ${sample?.technicalState}, примечание «${sample?.note}»`,
    );

    // Ни одна запись не должна остаться без места в журнале: все объекты
    // относятся к типам с заведённым пакетом правил, иначе перенос дат был бы
    // бессмысленным.
    const withoutActivities = stored.value.filter(
      (object) => activityCellsForObject(object, allEvents.value, '2026-08-17', 14).length === 0,
    );
    // eslint-disable-next-line no-console
    console.log(`объектов без применимых мероприятий: ${withoutActivities.length}`);
  });
});
