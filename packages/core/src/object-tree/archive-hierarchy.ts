/**
 * Каскадный вывод части иерархии из эксплуатации.
 *
 * Физически записи не удаляются: это позволило бы случайно уничтожить журнал
 * эксплуатации. Вместо этого одним временем архивируются сам узел, всё его
 * поддерево, помещения и оборудование. Активные представления после этого
 * больше не могут показать «осиротевшее» оборудование удалённого этажа.
 */

import type {
  Clock,
  ObjectTreeRepository,
  PlanObject,
  PlanObjectRepository,
  Result,
  Room,
  RoomId,
  RoomRepository,
  TreeNode,
  TreeNodeId,
} from '@izh/contracts';
import { ok } from '@izh/contracts';
import { checkVersion } from './node-checks.js';
import { descendantsOf } from './tree-shape.js';

export interface HierarchyArchiveDeps {
  readonly tree: ObjectTreeRepository;
  readonly objects: PlanObjectRepository;
  readonly rooms: RoomRepository;
  readonly clock: Clock;
}

export interface ArchiveHierarchyInput {
  readonly id: TreeNodeId;
  readonly expectedRowVersion?: number;
}

export interface ArchiveHierarchyResult {
  readonly node: TreeNode;
  readonly archivedNodes: number;
  readonly archivedRooms: number;
  readonly archivedObjects: number;
}

export interface ArchiveRoomHierarchyResult {
  readonly room: Room;
  readonly archivedObjects: number;
}

function archivePlanObject(object: PlanObject, now: string): PlanObject {
  return {
    ...object,
    archivedAt: now,
    updatedAt: now,
    rowVersion: object.rowVersion + 1,
  };
}

/** Выводит узел вместе со всеми вложенными уровнями, помещениями и оснащением. */
export async function archiveHierarchy(
  deps: HierarchyArchiveDeps,
  input: ArchiveHierarchyInput,
): Promise<Result<ArchiveHierarchyResult>> {
  const current = await deps.tree.getById(input.id);
  if (!current.ok) return current;

  const version = checkVersion(current.value, input.expectedRowVersion);
  if (!version.ok) return version;

  const allNodes = await deps.tree.list();
  if (!allNodes.ok) return allNodes;
  const allObjects = await deps.objects.list();
  if (!allObjects.ok) return allObjects;
  const allRooms = await deps.rooms.list();
  if (!allRooms.ok) return allRooms;

  const subtree = [current.value, ...descendantsOf(allNodes.value, current.value.id)];
  const subtreeIds = new Set(subtree.map((node) => node.id));
  const now = deps.clock.nowUtc();
  const activeObjects = allObjects.value.filter(
    (object) => object.archivedAt === null && subtreeIds.has(object.nodeId),
  );
  const activeRooms = allRooms.value.filter(
    (room) => room.archivedAt === null && subtreeIds.has(room.levelId),
  );
  const activeNodes = subtree.filter((node) => node.archivedAt === null);

  for (const object of activeObjects) {
    const saved = await deps.objects.save(archivePlanObject(object, now));
    if (!saved.ok) return saved;
  }

  for (const room of activeRooms) {
    const saved = await deps.rooms.save({
      ...room,
      archivedAt: now,
      updatedAt: now,
      rowVersion: room.rowVersion + 1,
    });
    if (!saved.ok) return saved;
  }

  // Потомки сохраняются раньше родителя: в любой успешно записанной точке
  // активный ребёнок не остаётся внутри уже архивированного родителя.
  for (const node of [...activeNodes].reverse()) {
    const saved = await deps.tree.save({
      ...node,
      archivedAt: now,
      updatedAt: now,
      rowVersion: node.rowVersion + 1,
    });
    if (!saved.ok) return saved;
  }

  const archivedRoot =
    current.value.archivedAt === null
      ? { ...current.value, archivedAt: now, updatedAt: now, rowVersion: current.value.rowVersion + 1 }
      : current.value;

  return ok({
    node: archivedRoot,
    archivedNodes: activeNodes.length,
    archivedRooms: activeRooms.length,
    archivedObjects: activeObjects.length,
  });
}

/** Выводит помещение и всё закреплённое за ним оснащение. */
export async function archiveRoomHierarchy(
  deps: HierarchyArchiveDeps,
  id: RoomId,
): Promise<Result<ArchiveRoomHierarchyResult>> {
  const current = await deps.rooms.getById(id);
  if (!current.ok) return current;
  const allObjects = await deps.objects.list();
  if (!allObjects.ok) return allObjects;

  const now = deps.clock.nowUtc();
  const activeObjects = allObjects.value.filter(
    (object) => object.archivedAt === null && object.roomId === current.value.id,
  );
  for (const object of activeObjects) {
    const saved = await deps.objects.save(archivePlanObject(object, now));
    if (!saved.ok) return saved;
  }

  const room =
    current.value.archivedAt === null
      ? {
          ...current.value,
          archivedAt: now,
          updatedAt: now,
          rowVersion: current.value.rowVersion + 1,
        }
      : current.value;
  if (current.value.archivedAt === null) {
    const saved = await deps.rooms.save(room);
    if (!saved.ok) return saved;
  }

  return ok({ room, archivedObjects: activeObjects.length });
}
