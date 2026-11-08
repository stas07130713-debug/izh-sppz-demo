/**
 * Склад — не этаж, и элемент на складе не «забыли разместить».
 *
 * Требование заказчика, названное им принципиальным:
 *
 *   «Склад является самостоятельной сущностью и не является этажом/отметкой
 *   здания. Элементы, перемещённые на склад, считаются временно не
 *   размещёнными на эксплуатируемом объекте и не требуют размещения на плане».
 *
 * До этого программа считала «нет координат» ошибкой всегда. Оттого резерв,
 * лежащий на складе, попадал в «Требуют размещения на плане», в уведомления и в
 * показатели дашборда — и предприятие видело у себя десятки мнимых недоделок.
 *
 * Здесь одно правило, к которому обращаются все: **сначала смотрим, где элемент
 * находится, и только потом решаем, нужны ли ему координаты.**
 *
 * Складом считается узел дерева вида `storage`. Не полка (`storageSection`) — её
 * могут и не выбрать, — и не отсутствие координат: по нему и путались.
 */

import type { PlanObject, TreeNode, TreeNodeId } from '@izh/contracts';

/** Узлы-склады: по ним отличают хранение от эксплуатации. */
export function storageNodeIds(nodes: readonly TreeNode[]): ReadonlySet<TreeNodeId> {
  return new Set(nodes.filter((node) => node.kind === 'storage').map((node) => node.id));
}

/** Лежит ли элемент на складе. */
export function inStorage(object: PlanObject, storageIds: ReadonlySet<TreeNodeId>): boolean {
  return storageIds.has(object.nodeId);
}

/**
 * Нужно ли этому элементу место на плане.
 *
 * Нет — если он на складе (там планов нет вовсе) или выведен из эксплуатации
 * (его не обслуживают). Да — если он числится на эксплуатируемом объекте, а
 * координат у него нет: вот это и есть настоящая недоделка.
 */
export function needsPlacement(object: PlanObject, storageIds: ReadonlySet<TreeNodeId>): boolean {
  if (object.archivedAt !== null) return false;
  if (inStorage(object, storageIds)) return false;
  return object.position === null;
}

/** Сколько элементов ждут размещения на плане по-настоящему. */
export function countNeedingPlacement(
  objects: readonly PlanObject[],
  storageIds: ReadonlySet<TreeNodeId>,
): number {
  return objects.filter((object) => needsPlacement(object, storageIds)).length;
}

/** Сколько элементов лежит на складе: отдельная справочная величина. */
export function countInStorage(
  objects: readonly PlanObject[],
  storageIds: ReadonlySet<TreeNodeId>,
): number {
  return objects.filter((object) => object.archivedAt === null && inStorage(object, storageIds)).length;
}
