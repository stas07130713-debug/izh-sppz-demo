/**
 * Эталонные тесты области видимости журнала.
 *
 * Общий журнал здания включает этажи и склады; отдельно открытый журнал этажа
 * или склада всегда показывает себя целиком, даже если его отключили из
 * агрегированного вида сверху.
 *
 * Смотри docs/02_ТЗ_редакция_3.md, части 3.1, 3.4.
 */

import { describe, expect, it } from 'vitest';
import type { PlanObject } from '@izh/contracts';
import { journalScope } from '../objects/journal-scope.js';
import { setInCommonJournal } from '../object-tree/update-node.js';
import { createChildNode } from '../object-tree/create-node.js';
import { makeSampleTree, makeTreeDeps, value } from './tree-fixtures.js';

function objectAt(nodeId: string, id: string): PlanObject {
  return {
    id,
    siteId: 'site',
    nodeId,
    typeCode: 'extinguisher',
    regNumber: null,
    model: null,
    manufacturer: null,
    serialNumber: null,
    commissionedOn: null,
    serviceLifeMonths: null,
    responsible: null,
    roomId: null,
    position: null,
    technicalState: 'не определено',
    note: null,
    archivedAt: null,
    createdAt: '2026-08-16T00:00:00.000Z',
    updatedAt: '2026-08-16T00:00:00.000Z',
    rowVersion: 1,
  };
}

describe('область видимости журнала', () => {
  it('журнал здания включает объекты этажей и складов', async () => {
    const deps = makeTreeDeps();
    const { building, level } = await makeSampleTree(deps);
    const storage = value(
      await createChildNode(deps, { parentId: building.id, kind: 'storage', name: 'Склад' }),
    );
    const nodes = value(await deps.tree.list());

    const objects = [
      objectAt(building.id, 'a'), // генплан здания
      objectAt(level.id, 'b'),
      objectAt(storage.id, 'c'),
    ];

    expect(journalScope(nodes, objects, building.id).map((o) => o.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('отключённый склад пропадает из журнала здания, но виден в своём собственном', async () => {
    const deps = makeTreeDeps();
    const { building } = await makeSampleTree(deps);
    const storage = value(
      await createChildNode(deps, { parentId: building.id, kind: 'storage', name: 'Запас ОП' }),
    );
    await setInCommonJournal(deps, { id: storage.id, include: false });
    const nodes = value(await deps.tree.list());

    const objects = [objectAt(storage.id, 'c')];

    expect(journalScope(nodes, objects, building.id)).toEqual([]);
    // Открытый напрямую журнал склада показывает содержимое целиком.
    expect(journalScope(nodes, objects, storage.id)).toHaveLength(1);
  });

  it('журнал этажа не показывает объекты соседнего склада', async () => {
    const deps = makeTreeDeps();
    const { building, level } = await makeSampleTree(deps);
    const storage = value(
      await createChildNode(deps, { parentId: building.id, kind: 'storage', name: 'Склад' }),
    );
    const nodes = value(await deps.tree.list());

    const objects = [objectAt(level.id, 'b'), objectAt(storage.id, 'c')];

    expect(journalScope(nodes, objects, level.id).map((o) => o.id)).toEqual(['b']);
  });

  it('не показывает выведенные из эксплуатации объекты', async () => {
    const deps = makeTreeDeps();
    const { level } = await makeSampleTree(deps);
    const nodes = value(await deps.tree.list());

    const objects = [{ ...objectAt(level.id, 'b'), archivedAt: '2026-08-16T00:00:00.000Z' }];

    expect(journalScope(nodes, objects, level.id)).toEqual([]);
  });

  it('не показывает оснащение архивного этажа даже в старых несогласованных данных', async () => {
    const deps = makeTreeDeps();
    const { building, level } = await makeSampleTree(deps);
    const nodes = value(await deps.tree.list()).map((node) =>
      node.id === level.id ? { ...node, archivedAt: '2026-08-16T00:00:00.000Z' } : node,
    );
    const objects = [objectAt(level.id, 'old-orphan')];

    expect(journalScope(nodes, objects, building.id)).toEqual([]);
    expect(journalScope(nodes, objects, level.id)).toEqual([]);
  });

  it('не показывает активных потомков внутри архивированного здания', async () => {
    const deps = makeTreeDeps();
    const { organization, building, level } = await makeSampleTree(deps);
    const nodes = value(await deps.tree.list()).map((node) =>
      node.id === building.id ? { ...node, archivedAt: '2026-08-16T00:00:00.000Z' } : node,
    );

    expect(journalScope(nodes, [objectAt(level.id, 'nested-orphan')], organization.id)).toEqual([]);
  });
});
