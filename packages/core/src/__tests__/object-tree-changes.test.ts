/**
 * Эталонные тесты дерева объекта: изменения уже заведённой структуры.
 *
 * Перенос узла, вывод из эксплуатации, правка карточки и порядок соседей.
 * Здесь же проверяется главное обещание модели данных: записи не удаляются.
 */

import { describe, expect, it } from 'vitest';
import { createChildNode, createOrganization } from '../object-tree/create-node.js';
import { reorderNode, reorderNodeAround, setInCommonJournal, setObjectsPinned, updateNode } from '../object-tree/update-node.js';
import { moveNode } from '../object-tree/move-node.js';
import { archiveNode, restoreNode } from '../object-tree/archive-node.js';
import { buildForest } from '../object-tree/tree-shape.js';
import { FIXED_NOW } from './test-doubles.js';
import { makeSampleTree, makeTreeDeps, value } from './tree-fixtures.js';

describe('перенос узла', () => {
  it('переносит здание в другой цех', async () => {
    const deps = makeTreeDeps();
    const { organization, building } = await makeSampleTree(deps);
    const other = value(
      await createChildNode(deps, { parentId: organization.id, kind: 'shop', name: 'ГМО-2' }),
    );

    const moved = value(await moveNode(deps, { id: building.id, newParentId: other.id }));
    expect(moved.parentId).toBe(other.id);
    expect(moved.rowVersion).toBe(building.rowVersion + 1);
  });

  it('не даёт поместить узел внутрь собственного потомка', async () => {
    const deps = makeTreeDeps();
    const { shop, building } = await makeSampleTree(deps);
    const result = await moveNode(deps, { id: shop.id, newParentId: building.id });

    expect(result.ok).toBe(false);
  });

  it('не даёт поместить узел внутрь самого себя', async () => {
    const deps = makeTreeDeps();
    const { building } = await makeSampleTree(deps);
    const result = await moveNode(deps, { id: building.id, newParentId: building.id });

    expect(result.ok).toBe(false);
  });

  it('не переносит в другую организацию', async () => {
    const deps = makeTreeDeps();
    const { building } = await makeSampleTree(deps);
    const another = value(await createOrganization(deps, { name: 'Вторая организация' }));

    const result = await moveNode(deps, { id: building.id, newParentId: another.id });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('другую организацию');
  });

  it('проверяет правила вложенности и при переносе', async () => {
    const deps = makeTreeDeps();
    const { organization, level } = await makeSampleTree(deps);
    const result = await moveNode(deps, { id: level.id, newParentId: organization.id });

    expect(result.ok).toBe(false);
  });
});

describe('вывод из эксплуатации', () => {
  it('не удаляет запись, а проставляет дату', async () => {
    const deps = makeTreeDeps();
    const { level } = await makeSampleTree(deps);

    const archived = value(await archiveNode(deps, { id: level.id }));
    expect(archived.archivedAt).toBe(FIXED_NOW);

    const stored = value(await deps.tree.getById(level.id));
    expect(stored.archivedAt).toBe(FIXED_NOW);
  });

  it('не выводит узел, внутри которого ещё есть живые узлы', async () => {
    const deps = makeTreeDeps();
    const { building } = await makeSampleTree(deps);

    const result = await archiveNode(deps, { id: building.id });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('внутри');
  });

  it('возвращает в работу, но не внутрь выведенного родителя', async () => {
    const deps = makeTreeDeps();
    const { building, level } = await makeSampleTree(deps);

    await archiveNode(deps, { id: level.id });
    await archiveNode(deps, { id: building.id });

    const tooEarly = await restoreNode(deps, level.id);
    expect(tooEarly.ok).toBe(false);

    await restoreNode(deps, building.id);
    expect(value(await restoreNode(deps, level.id)).archivedAt).toBeNull();
  });

  it('не пускает новые узлы внутрь выведенного из эксплуатации', async () => {
    const deps = makeTreeDeps();
    const { building, level } = await makeSampleTree(deps);
    await archiveNode(deps, { id: level.id });
    await archiveNode(deps, { id: building.id });

    const result = await createChildNode(deps, { parentId: building.id, kind: 'level', name: '3 этаж' });
    expect(result.ok).toBe(false);
  });
});

describe('правка карточки узла', () => {
  it('отклоняет правку, если запись успели изменить', async () => {
    const deps = makeTreeDeps();
    const { building } = await makeSampleTree(deps);
    await updateNode(deps, { id: building.id, name: 'Башня' });

    const stale = await updateNode(deps, {
      id: building.id,
      name: 'Башня учебная',
      expectedRowVersion: building.rowVersion,
    });

    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.error.code).toBe('VERSION_CONFLICT');
  });

  it('пустое поле означает, что значения нет', async () => {
    const deps = makeTreeDeps();
    const { building } = await makeSampleTree(deps);

    const updated = value(await updateNode(deps, { id: building.id, name: 'Башня', code: '   ' }));
    expect(updated.code).toBeNull();
  });

  it('меняет порядок соседей местами', async () => {
    const deps = makeTreeDeps();
    const { building, level } = await makeSampleTree(deps);
    const first = value(
      await createChildNode(deps, { parentId: building.id, kind: 'level', name: '1 этаж', elevationM: 0 }),
    );

    value(await reorderNode(deps, { id: first.id, offset: -1 }));
    const nodes = value(await deps.tree.list());
    const levels = buildForest(nodes)[0]?.children[0]?.children[0]?.children ?? [];

    expect(levels.map((child) => child.node.name)).toEqual(['1 этаж', '2 этаж']);
    expect(levels[1]?.node.id).toBe(level.id);
  });

  it('дальше крайнего узла не двигает', async () => {
    const deps = makeTreeDeps();
    const { level } = await makeSampleTree(deps);

    const result = await reorderNode(deps, { id: level.id, offset: -1 });
    expect(result.ok).toBe(false);
  });

  it('перетаскиванием ставит узел рядом с соседом того же родителя', async () => {
    const deps = makeTreeDeps();
    const { building, level } = await makeSampleTree(deps);
    const first = value(
      await createChildNode(deps, { parentId: building.id, kind: 'level', name: '1 этаж', elevationM: 0 }),
    );
    const third = value(
      await createChildNode(deps, { parentId: building.id, kind: 'level', name: '3 этаж', elevationM: 8 }),
    );

    value(await reorderNodeAround(deps, { id: third.id, targetId: level.id, placement: 'before' }));
    const nodes = value(await deps.tree.list());
    const levels = buildForest(nodes)[0]?.children[0]?.children[0]?.children ?? [];

    expect(levels.map((child) => child.node.name)).toEqual(['3 этаж', '2 этаж', '1 этаж']);
    expect(first.parentId).toBe(building.id);
  });

  it('перетаскиванием не меняет родителя узла', async () => {
    const deps = makeTreeDeps();
    const { organization, level } = await makeSampleTree(deps);
    const otherBuilding = value(
      await createChildNode(deps, { parentId: organization.id, kind: 'building', name: 'Складской корпус' }),
    );
    const otherLevel = value(
      await createChildNode(deps, { parentId: otherBuilding.id, kind: 'level', name: '1 этаж', elevationM: 0 }),
    );

    const result = await reorderNodeAround(deps, { id: level.id, targetId: otherLevel.id, placement: 'after' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('одного родителя');
  });
});

describe('состав общего журнала здания', () => {
  it('склад можно убрать из общего журнала, не трогая сами записи', async () => {
    const deps = makeTreeDeps();
    const { building } = await makeSampleTree(deps);
    const storage = value(
      await createChildNode(deps, { parentId: building.id, kind: 'storage', name: 'Запас ОП' }),
    );

    expect(storage.inCommonJournal).toBe(true);

    const excluded = value(await setInCommonJournal(deps, { id: storage.id, include: false }));
    expect(excluded.inCommonJournal).toBe(false);
    // Узел остаётся в работе: отключение меняет только состав представления.
    expect(excluded.archivedAt).toBeNull();
  });
});

describe('закрепление объектов на плане', () => {
  it('сохраняет блокировку в выбранном узле', async () => {
    const deps = makeTreeDeps();
    const { level } = await makeSampleTree(deps);

    const pinned = value(await setObjectsPinned(deps, { id: level.id, pinned: true }));

    expect(pinned.objectsPinned).toBe(true);
    expect(pinned.rowVersion).toBe(level.rowVersion + 1);
    expect(value(await deps.tree.getById(level.id)).objectsPinned).toBe(true);
  });
});
