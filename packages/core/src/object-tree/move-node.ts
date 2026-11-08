/**
 * Сценарий: перенести узел в другого родителя.
 *
 * Здание переехало из одного цеха в другой, этаж завели не в том корпусе —
 * обычные исправления, ради которых нельзя заводить объект заново и терять его
 * историю.
 *
 * Перенос между организациями запрещён. Он потребовал бы переписать признак
 * принадлежности у всего поддерева, а это уже перенос данных между областями
 * видимости — операция с правами доступа и отчётом, а не движение мышью в дереве.
 */

import type { Result, TreeNode, TreeNodeId } from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { TreeDeps } from './tree-deps.js';
import { checkVersion, findDuplicateSibling, nextSortOrder } from './node-checks.js';
import { canContain, ruleFor } from './tree-rules.js';
import { isDescendantOf } from './tree-shape.js';

export interface MoveNodeInput {
  readonly id: TreeNodeId;
  readonly newParentId: TreeNodeId;
  readonly expectedRowVersion?: number;
}

export async function moveNode(deps: TreeDeps, input: MoveNodeInput): Promise<Result<TreeNode>> {
  if (input.id === input.newParentId) {
    return err('INVALID_ARGUMENT', 'Узел нельзя поместить внутрь самого себя.');
  }

  const current = await deps.tree.getById(input.id);
  if (!current.ok) return current;

  const version = checkVersion(current.value, input.expectedRowVersion);
  if (!version.ok) return version;

  const parent = await deps.tree.getById(input.newParentId);
  if (!parent.ok) return parent;

  if (current.value.archivedAt !== null) {
    return err('INVALID_ARGUMENT', `Узел «${current.value.name}» выведен из эксплуатации и не переносится.`);
  }
  if (parent.value.archivedAt !== null) {
    return err('INVALID_ARGUMENT', `Узел «${parent.value.name}» выведен из эксплуатации.`);
  }
  if (parent.value.siteId !== current.value.siteId) {
    return err('INVALID_ARGUMENT', 'Перенос в другую организацию не поддерживается.');
  }
  if (current.value.parentId === parent.value.id) {
    return ok(current.value);
  }
  if (!canContain(parent.value.kind, current.value.kind)) {
    return err(
      'INVALID_ARGUMENT',
      `Внутрь узла «${ruleFor(parent.value.kind).title}» нельзя поместить «${ruleFor(current.value.kind).title}».`,
    );
  }

  const all = await deps.tree.list();
  if (!all.ok) return all;

  // Перенос узла внутрь собственного потомка оторвал бы кусок дерева от корня:
  // узлы остались бы в хранилище, но перестали быть видны откуда бы то ни было.
  if (isDescendantOf(all.value, parent.value.id, current.value.id)) {
    return err('INVALID_ARGUMENT', 'Узел нельзя поместить внутрь узла, который лежит в нём самом.');
  }

  const duplicate = findDuplicateSibling(
    all.value,
    parent.value.id,
    current.value.kind,
    current.value.name,
    current.value.id,
  );
  if (duplicate !== null) {
    return err('INVALID_ARGUMENT', `«${current.value.name}» уже есть внутри «${parent.value.name}».`);
  }

  const node: TreeNode = {
    ...current.value,
    parentId: parent.value.id,
    sortOrder: nextSortOrder(all.value, parent.value.id),
    updatedAt: deps.clock.nowUtc(),
    rowVersion: current.value.rowVersion + 1,
  };

  const saved = await deps.tree.save(node);
  if (!saved.ok) return saved;
  return ok(node);
}
