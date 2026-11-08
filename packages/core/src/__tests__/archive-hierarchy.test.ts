import { describe, expect, it } from 'vitest';
import { archiveHierarchy, archiveRoomHierarchy } from '../object-tree/archive-hierarchy.js';
import { createRoom } from '../rooms/room-scenarios.js';
import { placeObject } from '../objects/object-scenarios.js';
import {
  fakeClock,
  fakeIdGenerator,
  fakePlanObjectRepository,
  fakeRoomRepository,
} from './test-doubles.js';
import { makeSampleTree, makeTreeDeps, value } from './tree-fixtures.js';

async function fixture() {
  const treeDeps = makeTreeDeps();
  const { building, level } = await makeSampleTree(treeDeps);
  const rooms = fakeRoomRepository();
  const objects = fakePlanObjectRepository();
  const clock = fakeClock();
  const ids = fakeIdGenerator();
  const room = value(
    await createRoom(
      { rooms, tree: treeDeps.tree, clock, ids },
      { levelId: level.id, name: 'Кабинет 101' },
    ),
  );
  const object = value(
    await placeObject(
      { objects, tree: treeDeps.tree, clock, ids },
      { nodeId: level.id, typeCode: 'extinguisher', position: null, roomId: room.id },
    ),
  );
  return {
    deps: { tree: treeDeps.tree, rooms, objects, clock },
    building,
    level,
    room,
    object,
    ids,
  };
}

describe('каскадный вывод из эксплуатации', () => {
  it('архивирует этаж, помещения и всё оснащение внутри здания', async () => {
    const { deps, building, level, room, object } = await fixture();

    const result = value(await archiveHierarchy(deps, { id: building.id }));

    expect(result).toMatchObject({ archivedNodes: 2, archivedRooms: 1, archivedObjects: 1 });
    expect(value(await deps.tree.getById(building.id)).archivedAt).not.toBeNull();
    expect(value(await deps.tree.getById(level.id)).archivedAt).not.toBeNull();
    expect(value(await deps.rooms.getById(room.id)).archivedAt).not.toBeNull();
    expect(value(await deps.objects.getById(object.id)).archivedAt).not.toBeNull();
  });

  it('архивирует вместе с помещением только закреплённое за ним оснащение', async () => {
    const { deps, level, room, object, ids } = await fixture();
    const other = value(
      await placeObject(
        { objects: deps.objects, tree: deps.tree, clock: deps.clock, ids },
        { nodeId: level.id, typeCode: 'extinguisher', position: null },
      ),
    );

    const result = value(await archiveRoomHierarchy(deps, room.id));

    expect(result.archivedObjects).toBe(1);
    expect(value(await deps.objects.getById(object.id)).archivedAt).not.toBeNull();
    expect(value(await deps.objects.getById(other.id)).archivedAt).toBeNull();
  });
});
