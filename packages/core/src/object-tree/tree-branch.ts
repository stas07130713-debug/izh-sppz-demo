/**
 * Ветвь, в которой сейчас работает пользователь (ТЗ, Дополнение 6, часть С48).
 *
 * Нужна свёрнутому дереву. Убрав левое поле ради ширины плана, человек не
 * должен терять возможность перейти на соседний этаж: показывать весь объект в
 * полосе шириной в сорок точек нельзя, а ветвь своего цеха — можно, и её
 * достаточно, потому что переходят почти всегда внутри неё.
 *
 * Началом ветви считается ближайший цех, а если цеха нет — здание, а если нет и
 * его — корень. Не «родитель выбранного»: у этажа родителем будет здание, и
 * соседние здания цеха из полосы пропали бы, хотя переход между ними обычен.
 */

import type { TreeNode, TreeNodeId } from '@izh/contracts';
import { childrenOf, pathToNode } from './tree-shape.js';

/** Узел ветви и его глубина от начала ветви: по ней рисуется отступ. */
export interface BranchStep {
  readonly node: TreeNode;
  readonly depth: number;
}

/** Виды узлов, с которых начинается ветвь, — от предпочтительного к запасному. */
const BRANCH_ROOTS = ['shop', 'building'] as const;

/**
 * Начало ветви для выбранного узла.
 *
 * Возвращает сам узел, если ничего подходящего выше нет: одинокая организация
 * — тоже ветвь, просто короткая.
 */
export function branchRoot(nodes: readonly TreeNode[], nodeId: TreeNodeId): TreeNode | null {
  const path = pathToNode(nodes, nodeId);
  if (path.length === 0) return null;

  for (const kind of BRANCH_ROOTS) {
    const found = path.find((step) => step.kind === kind);
    if (found !== undefined) return found;
  }
  return path[0] ?? null;
}

/**
 * Ветвь целиком, сверху вниз, в порядке показа.
 *
 * Архивные узлы пропускаются вместе со своими потомками: удалённый цех не
 * должен возвращаться в полосу навигации.
 */
export function branchOf(nodes: readonly TreeNode[], nodeId: TreeNodeId): readonly BranchStep[] {
  const root = branchRoot(nodes, nodeId);
  if (root === null || root.archivedAt !== null) return [];

  const steps: BranchStep[] = [];
  const walk = (node: TreeNode, depth: number): void => {
    steps.push({ node, depth });
    for (const child of childrenOf(nodes, node.id)) {
      if (child.archivedAt !== null) continue;
      walk(child, depth + 1);
    }
  };
  walk(root, 0);
  return steps;
}
