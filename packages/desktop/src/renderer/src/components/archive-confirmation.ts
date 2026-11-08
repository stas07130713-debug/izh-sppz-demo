import type { PlanObject, Room, TreeNode, TreeNodeId } from '@izh/contracts';
import { descendantsOf } from '@izh/core';

export interface ArchiveImpact {
  readonly nestedNodes: number;
  readonly rooms: number;
  readonly objects: number;
}

export function archiveImpact(
  nodes: readonly TreeNode[],
  rooms: readonly Room[],
  objects: readonly PlanObject[],
  nodeId: TreeNodeId,
): ArchiveImpact {
  const subtree = new Set<TreeNodeId>([
    nodeId,
    ...descendantsOf(nodes, nodeId).map((node) => node.id),
  ]);
  return {
    nestedNodes: [...subtree].filter((id) => id !== nodeId && nodes.some((node) => node.id === id && node.archivedAt === null)).length,
    rooms: rooms.filter((room) => room.archivedAt === null && subtree.has(room.levelId)).length,
    objects: objects.filter((object) => object.archivedAt === null && subtree.has(object.nodeId)).length,
  };
}

export function confirmNodeArchive(node: TreeNode, impact: ArchiveImpact): boolean {
  return window.confirm(
    `Вывести «${node.name}» из эксплуатации?\n\n` +
      `Вместе с ним из текущего учёта будут исключены:\n` +
      `• вложенные уровни: ${impact.nestedNodes}\n` +
      `• помещения: ${impact.rooms}\n` +
      `• элементы и системы: ${impact.objects}\n\n` +
      'Они исчезнут с планов и из активного журнала. История проверок сохранится. Продолжить?',
  );
}

export function confirmRoomArchive(room: Room, objectCount: number): boolean {
  return window.confirm(
    `Вывести помещение «${room.name}» из эксплуатации?\n\n` +
      `Вместе с помещением из текущего учёта будут исключены элементы: ${objectCount}.\n` +
      'История проверок сохранится. Продолжить?',
  );
}

export function confirmObjectArchive(object: PlanObject): boolean {
  const label = object.regNumber === null ? 'выбранный элемент' : `элемент № ${object.regNumber}`;
  return window.confirm(
    `Вывести ${label} из эксплуатации?\n\n` +
      'Он исчезнет со схемы и из активного журнала. История проверок сохранится. Продолжить?',
  );
}
