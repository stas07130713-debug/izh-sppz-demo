/**
 * Куда можно назначить регламент (ТЗ, Дополнение 5, часть Р7).
 *
 * Уровней в требованиях пять: организация → цех → здание → тип оборудования →
 * элемент. Первые три — это узлы дерева, и пользователю их надо показать так,
 * как он их видит в дереве: с полным путём, иначе два цеха с названием
 * «Механический» не различить.
 *
 * Этаж и склад в список не попадают намеренно. Регламент — документ уровня
 * организации, цеха или здания; «регламент на второй этаж» не бывает, а если
 * порядок на этаже действительно свой, это задаётся на самом элементе.
 */

import { ALL_OBJECTS_REGULATION_TARGET_ID, type NodeKind, type RegulationScope, type TreeNode } from '@izh/contracts';
import { nodeTitle, pathToNode } from '@izh/core';

export interface RegulationTarget {
  readonly scope: RegulationScope;
  readonly targetId: string;
  /** Как показать пользователю: «Цех 1 → Корпус А». */
  readonly label: string;
}

/** Уровень дерева в область действия регламента. null — назначать сюда нельзя. */
function scopeOf(kind: NodeKind): RegulationScope | null {
  if (kind === 'organization') return 'организация';
  if (kind === 'shop') return 'цех';
  if (kind === 'building') return 'здание';
  return null;
}

/**
 * Места, куда можно назначить регламент, в порядке обхода дерева.
 *
 * Порядок именно древесный, а не алфавитный: список читается как структура
 * предприятия, и вложенность видна по пути в названии.
 */
export function regulationTargets(nodes: readonly TreeNode[]): readonly RegulationTarget[] {
  const targets: RegulationTarget[] = [{
    scope: 'организация',
    targetId: ALL_OBJECTS_REGULATION_TARGET_ID,
    label: 'Общее — все объекты в системе',
  }];

  for (const node of nodes) {
    const scope = scopeOf(node.kind);
    if (scope === null || node.archivedAt !== null) continue;

    const path = pathToNode(nodes, node.id)
      .filter((item) => scopeOf(item.kind) !== null)
      .map((item) => nodeTitle(item));

    targets.push({ scope, targetId: node.id, label: path.join(' → ') });
  }

  const [global, ...specific] = targets;
  return global === undefined
    ? specific
    : [global, ...specific.sort((a, b) => a.label.localeCompare(b.label, 'ru'))];
}

/** Название уровня для подписи: «на всю организацию», «на цех». */
export function scopeLabel(scope: RegulationScope): string {
  switch (scope) {
    case 'организация': return 'на всю организацию';
    case 'цех': return 'на цех';
    case 'здание': return 'на здание';
    case 'тип оборудования': return 'на вид оборудования';
    case 'элемент': return 'на отдельный элемент';
  }
}
