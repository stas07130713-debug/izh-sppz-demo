/**
 * Сценарий: завести узел дерева объекта.
 *
 * Организация создаётся отдельной функцией: у неё нет родителя, и она сама себе
 * задаёт признак принадлежности, который дальше наследуют все узлы под ней.
 * Ради этого поля один сервер сможет вести несколько организаций, не переделывая
 * ни одного запроса.
 */

import type { BuildingProfile, NodeKind, Result, TreeNode, TreeNodeId } from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { TreeDeps } from './tree-deps.js';
import {
  checkBuildingProfile,
  checkElevation,
  checkName,
  findDuplicateSibling,
  nextSortOrder,
  normalizeOptional,
} from './node-checks.js';
import { canContain, ruleFor } from './tree-rules.js';

export interface CreateOrganizationInput {
  readonly name: string;
  readonly code?: string | null;
  readonly note?: string | null;
}

export async function createOrganization(
  deps: TreeDeps,
  input: CreateOrganizationInput,
): Promise<Result<TreeNode>> {
  const name = checkName(input.name);
  if (!name.ok) return name;

  const all = await deps.tree.list();
  if (!all.ok) return all;

  const duplicate = findDuplicateSibling(all.value, null, 'organization', name.value, null);
  if (duplicate !== null) {
    return err('INVALID_ARGUMENT', `Организация «${name.value}» уже заведена.`);
  }

  const id: TreeNodeId = deps.ids.newId();
  const now = deps.clock.nowUtc();
  const node: TreeNode = {
    id,
    // Организация принадлежит сама себе: так у любого узла дерева признак
    // принадлежности заполнен, и выборки не нуждаются в особом случае для корня.
    siteId: id,
    parentId: null,
    kind: 'organization',
    name: name.value,
    code: normalizeOptional(input.code),
    elevationM: null,
    note: normalizeOptional(input.note),
    building: null,
    sortOrder: nextSortOrder(all.value, null),
    inCommonJournal: true,
    objectsPinned: false,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    rowVersion: 1,
  };

  const saved = await deps.tree.save(node);
  if (!saved.ok) return saved;
  return ok(node);
}

export interface CreateChildNodeInput {
  readonly parentId: TreeNodeId;
  readonly kind: NodeKind;
  readonly name: string;
  readonly code?: string | null;
  readonly elevationM?: number | null;
  readonly note?: string | null;
  readonly building?: BuildingProfile | null;
}

export async function createChildNode(
  deps: TreeDeps,
  input: CreateChildNodeInput,
): Promise<Result<TreeNode>> {
  const name = checkName(input.name);
  if (!name.ok) return name;

  const elevation = checkElevation(input.kind, input.elevationM ?? null);
  if (!elevation.ok) return elevation;

  const profile = checkBuildingProfile(input.kind, input.building ?? null);
  if (!profile.ok) return profile;

  const parent = await deps.tree.getById(input.parentId);
  if (!parent.ok) return parent;

  if (parent.value.archivedAt !== null) {
    return err(
      'INVALID_ARGUMENT',
      `Узел «${parent.value.name}» выведен из эксплуатации, внутрь него нельзя ничего добавить.`,
    );
  }

  if (!canContain(parent.value.kind, input.kind)) {
    return err(
      'INVALID_ARGUMENT',
      `Внутрь узла «${ruleFor(parent.value.kind).title}» нельзя поместить «${ruleFor(input.kind).title}».`,
    );
  }

  const all = await deps.tree.list();
  if (!all.ok) return all;

  const duplicate = findDuplicateSibling(all.value, parent.value.id, input.kind, name.value, null);
  if (duplicate !== null) {
    return err('INVALID_ARGUMENT', `«${name.value}» уже есть внутри «${parent.value.name}».`);
  }

  const now = deps.clock.nowUtc();
  const node: TreeNode = {
    id: deps.ids.newId(),
    siteId: parent.value.siteId,
    parentId: parent.value.id,
    kind: input.kind,
    name: name.value,
    code: normalizeOptional(input.code),
    elevationM: elevation.value,
    note: normalizeOptional(input.note),
    building: profile.value,
    sortOrder: nextSortOrder(all.value, parent.value.id),
    inCommonJournal: true,
    objectsPinned: false,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    rowVersion: 1,
  };

  const saved = await deps.tree.save(node);
  if (!saved.ok) return saved;
  return ok(node);
}
