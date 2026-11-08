/**
 * Какие объекты попадают в журнал выбранного узла.
 *
 * Узел сам по себе не хранит объектов — они хранятся по `nodeId`, а журнал
 * узла обязан показать не только его собственные записи, но и записи всего
 * поддерева: общий журнал здания включает этажи и склады (часть 3.1 ТЗ).
 *
 * Отключение этажа или склада из общего журнала (часть 3.4) действует только
 * на агрегированный вид сверху — открытый напрямую журнал самого этажа или
 * склада всегда показывает его содержимое целиком, иначе отключить узел
 * значило бы спрятать его работу от него самого.
 */

import type { PlanObject, TreeNode, TreeNodeId } from '@izh/contracts';
import { descendantsOf, pathToNode } from '../object-tree/tree-shape.js';

function isJournalToggleable(node: TreeNode): boolean {
  return node.kind === 'level' || node.kind === 'storage';
}

export function journalScope(
  nodes: readonly TreeNode[],
  objects: readonly PlanObject[],
  nodeId: TreeNodeId,
): readonly PlanObject[] {
  const selected = nodes.find((node) => node.id === nodeId);
  // Архивный этаж не имеет активного журнала. Эта проверка также исправляет
  // старые данные, созданные до появления каскадного архивирования.
  if (selected === undefined || selected.archivedAt !== null) return [];

  const included = new Set<TreeNodeId>([nodeId]);
  for (const node of descendantsOf(nodes, nodeId)) {
    // Если архивирован родитель, вся его ветка скрыта, даже когда в старых
    // данных потомок или его оснащение ошибочно остались активными.
    if (pathToNode(nodes, node.id).some((step) => step.archivedAt !== null)) continue;
    if (isJournalToggleable(node) && !node.inCommonJournal) continue;
    included.add(node.id);
  }

  return objects.filter((object) => object.archivedAt === null && included.has(object.nodeId));
}
