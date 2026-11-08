/**
 * Сквозной прогон главных путей по настоящим данным предприятия.
 *
 * Обычные проверки берут придуманные данные: три узла, два огнетушителя, всё
 * заполнено. Настоящие данные не такие — в них есть карточки без ранга, узлы
 * без подложки, элементы без номера и записи журнала за прошлый год. Ошибки
 * такого рода в придуманных данных не встречаются, и находятся они только
 * здесь.
 *
 * Проверяется не «правильно посчитано», а «посчиталось вообще»: каждый главный
 * путь программы прогоняется по каждому узлу и каждому элементу, и ни один не
 * должен сорваться. Правильность отдельных правил закреплена своими проверками.
 *
 * Работает только тогда, когда рядом лежит копия рабочих файлов: на чистой
 * машине проверка пропускается, а не падает. База собирается во временной
 * папке из этой копии — оригинал не трогается вовсе.
 */

import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PlanObject, Room, TreeNode } from '@izh/contracts';
import {
  buildForest, checkExtinguisherPlacement, incompleteCards, journalScope,
  placementCondition, rulePackageSource, systemCondition,
} from '@izh/core';
import { legacyPaths, openStorage } from './storage';

const DATA = join(import.meta.dirname, '..', '..', '..', '..', '..', '_try', 'данные-копия');
const available = existsSync(join(DATA, 'tree.json'));

/** День, от которого считаются сроки. Задан, а не «сегодня»: прогон повторяем. */
const TODAY = '2026-09-07';

describe.skipIf(!available)('сквозной прогон по настоящим данным', () => {
  it('каждый главный путь проходит по всем узлам и элементам', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'izh-смоук-'));
    const storage = await openStorage({
      databasePath: join(dir, 'sppz.db'),
      legacy: legacyPaths(DATA),
    });

    const tree = await storage.tree.list();
    const objectList = await storage.objects.list();
    const roomList = await storage.rooms.list();
    const eventList = await storage.maintenance.list();
    expect(tree.ok && objectList.ok && roomList.ok && eventList.ok).toBe(true);

    const nodes: readonly TreeNode[] = tree.ok ? tree.value : [];
    const objects: readonly PlanObject[] = objectList.ok ? objectList.value : [];
    const rooms: readonly Room[] = roomList.ok ? roomList.value : [];
    const events = eventList.ok ? eventList.value : [];

    const troubles: string[] = [];
    const run = (what: string, work: () => void): void => {
      try {
        work();
      } catch (error) {
        troubles.push(`${what}: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    run('сборка дерева', () => { buildForest(nodes); });
    run('незаполненные карточки', () => { incompleteCards(objects); });

    for (const node of nodes) {
      run(`область журнала «${node.name}»`, () => { journalScope(nodes, objects, node.id); });
    }

    for (const object of objects) {
      const name = object.regNumber ?? object.id;
      run(`состояние «${name}»`, () => {
        placementCondition(object, objects, events, TODAY, 14, rulePackageSource);
      });
      run(`состояние системы «${name}»`, () => {
        systemCondition(object, objects, events, TODAY, 14, rulePackageSource);
      });
    }

    for (const level of nodes.filter((node) => node.kind === 'level')) {
      run(`расстановка огнетушителей «${level.name}»`, () => {
        checkExtinguisherPlacement({
          rooms: rooms.filter((room) => room.levelId === level.id),
          objects: objects.filter((object) => object.nodeId === level.id),
          metersPerPixel: 0.05,
        });
      });
    }

    // Видно в отчёте прогона: на чём именно прошли проверки.
    // eslint-disable-next-line no-console
    console.log('прогон:', {
      узлы: nodes.length, элементы: objects.length, помещения: rooms.length, записи: events.length,
    });

    expect(troubles).toEqual([]);
    storage.db.close();
  });
});
