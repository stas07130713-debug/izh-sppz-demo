/**
 * Сценарий: вывести узел из эксплуатации и вернуть обратно.
 *
 * Физического удаления в программе нет вообще — ни здесь, ни где-либо ещё.
 * Журнал эксплуатации предъявляется при проверке, и записи о снесённом здании
 * или закрытом цехе обязаны оставаться доступными (требование №11 ТЗ).
 *
 * Узел с живыми потомками не выводится. Причина не техническая: скрыв здание
 * одним нажатием, пользователь потерял бы из виду десятки этажей вместе с
 * оборудованием и сроками проверок, ничего об этом не узнав. Поэтому здание
 * закрывается снизу вверх и осознанно.
 */

import type { Result, TreeNode, TreeNodeId } from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { TreeDeps } from './tree-deps.js';
import { checkVersion } from './node-checks.js';
import { childrenOf } from './tree-shape.js';

export interface ArchiveNodeInput {
  readonly id: TreeNodeId;
  readonly expectedRowVersion?: number;
}

export async function archiveNode(deps: TreeDeps, input: ArchiveNodeInput): Promise<Result<TreeNode>> {
  const current = await deps.tree.getById(input.id);
  if (!current.ok) return current;

  const version = checkVersion(current.value, input.expectedRowVersion);
  if (!version.ok) return version;

  if (current.value.archivedAt !== null) return ok(current.value);

  const all = await deps.tree.list();
  if (!all.ok) return all;

  const children = childrenOf(all.value, current.value.id);
  if (children.length > 0) {
    return err(
      'INVALID_ARGUMENT',
      `Сначала выведите из эксплуатации то, что находится внутри: ${children.length === 1 ? 'узел' : 'узлов'} ${children.length}.`,
    );
  }

  const node: TreeNode = {
    ...current.value,
    archivedAt: deps.clock.nowUtc(),
    updatedAt: deps.clock.nowUtc(),
    rowVersion: current.value.rowVersion + 1,
  };

  const saved = await deps.tree.save(node);
  if (!saved.ok) return saved;
  return ok(node);
}

/**
 * Возвращает узел в работу.
 *
 * Внутрь выведенного из эксплуатации родителя вернуть нельзя: получилось бы
 * живое помещение в снесённом здании.
 */
export async function restoreNode(deps: TreeDeps, id: TreeNodeId): Promise<Result<TreeNode>> {
  const current = await deps.tree.getById(id);
  if (!current.ok) return current;

  if (current.value.archivedAt === null) return ok(current.value);

  if (current.value.parentId !== null) {
    const parent = await deps.tree.getById(current.value.parentId);
    if (!parent.ok) return parent;
    if (parent.value.archivedAt !== null) {
      return err(
        'INVALID_ARGUMENT',
        `Сначала верните в работу «${parent.value.name}» — узел находится внутри него.`,
      );
    }
  }

  const node: TreeNode = {
    ...current.value,
    archivedAt: null,
    updatedAt: deps.clock.nowUtc(),
    rowVersion: current.value.rowVersion + 1,
  };

  const saved = await deps.tree.save(node);
  if (!saved.ok) return saved;
  return ok(node);
}
