/**
 * Смена чертежа снимает значки с плана (ТЗ, Дополнение 6, часть С95).
 *
 * Заказчик: «при замене подложки и её переработке нужно, чтобы значки систем
 * ППЗ уходили в меню „требуют расстановки“ на плане».
 *
 * Закреплено главное: объекты не пропадают и из журнала не уходят — у них
 * снимается только место на плане. Это то же состояние, в котором объект
 * оказывается после переноса на другой узел.
 */

import { describe, expect, it } from 'vitest';
import type { ObjectDeps } from '../objects/object-deps.js';
import { placeObject } from '../objects/object-scenarios.js';
import { unplaceNodeObjects } from '../objects/unplace-node-objects.js';
import { createChildNode } from '../object-tree/create-node.js';
import { fakeClock, fakeIdGenerator, fakePlanObjectRepository } from './test-doubles.js';
import { makeSampleTree, makeTreeDeps, value } from './tree-fixtures.js';

async function makeDeps(): Promise<{ deps: ObjectDeps; levelId: string; storageId: string }> {
  const treeDeps = makeTreeDeps();
  const { level, building } = await makeSampleTree(treeDeps);
  const storage = value(
    await createChildNode(treeDeps, { parentId: building.id, kind: 'storage', name: 'Запас ОП' }),
  );
  return {
    deps: { objects: fakePlanObjectRepository(), tree: treeDeps.tree, clock: fakeClock(), ids: fakeIdGenerator() },
    levelId: level.id,
    storageId: storage.id,
  };
}

describe('снятие значков при смене чертежа', () => {
  it('расставленное уходит в «требуют размещения»', async () => {
    const { deps, levelId } = await makeDeps();
    const object = value(
      await placeObject(deps, { nodeId: levelId, typeCode: 'extinguisher', position: { x: 10, y: 20 } }),
    );

    const unplaced = value(await unplaceNodeObjects(deps, { nodeId: levelId }));

    expect(unplaced).toHaveLength(1);
    expect(unplaced[0]?.position).toBeNull();
    expect(unplaced[0]?.id).toBe(object.id);
  });

  it('объект остаётся в журнале, а не удаляется', async () => {
    // Это прямое требование заказчика: всё, что на плане, есть в журнале, и
    // наоборот. Снятие с плана — не удаление записи.
    const { deps, levelId } = await makeDeps();
    const object = value(
      await placeObject(deps, { nodeId: levelId, typeCode: 'extinguisher', position: { x: 10, y: 20 } }),
    );

    value(await unplaceNodeObjects(deps, { nodeId: levelId }));

    const stored = value(await deps.objects.getById(object.id));
    expect(stored.archivedAt).toBeNull();
    expect(stored.nodeId).toBe(levelId);
    expect(stored.position).toBeNull();
    expect(stored.rowVersion).toBe(object.rowVersion + 1);
  });

  it('помещение тоже сбрасывается', async () => {
    // Обводки помещений заданы в точках того же чертежа: на новом плане такого
    // помещения может не быть вовсе.
    const { deps, levelId } = await makeDeps();
    value(await placeObject(deps, { nodeId: levelId, typeCode: 'extinguisher', position: { x: 1, y: 1 } }));

    const unplaced = value(await unplaceNodeObjects(deps, { nodeId: levelId }));

    expect(unplaced[0]?.roomId).toBeNull();
  });

  it('чужие узлы не трогаются', async () => {
    const { deps, levelId, storageId } = await makeDeps();
    const onLevel = value(
      await placeObject(deps, { nodeId: levelId, typeCode: 'extinguisher', position: { x: 5, y: 5 } }),
    );
    const inStorage = value(await placeObject(deps, { nodeId: storageId, typeCode: 'extinguisher', position: null }));

    const unplaced = value(await unplaceNodeObjects(deps, { nodeId: levelId }));

    expect(unplaced.map((item) => item.id)).toEqual([onLevel.id]);
    expect(value(await deps.objects.getById(inStorage.id)).rowVersion).toBe(inStorage.rowVersion);
  });

  it('снимать нечего — ничего и не пишется', async () => {
    // Стирание лишнего не меняет координат, и снятие после него не вызывается.
    // Но и вызванное впустую, оно не должно трогать записи: лишняя версия у
    // каждого объекта — это ложный след в истории изменений.
    const { deps, levelId, storageId } = await makeDeps();
    const inStorage = value(await placeObject(deps, { nodeId: storageId, typeCode: 'extinguisher', position: null }));

    const unplaced = value(await unplaceNodeObjects(deps, { nodeId: levelId }));

    expect(unplaced).toEqual([]);
    expect(value(await deps.objects.getById(inStorage.id)).rowVersion).toBe(inStorage.rowVersion);
  });
});
