/**
 * Проверки, общие для всех сценариев дерева.
 *
 * Вынесены отдельно, потому что одни и те же условия нужны и при создании, и
 * при переименовании, и при переносе узла. Если бы каждый сценарий проверял
 * по-своему, они бы разошлись — а расходятся такие вещи молча.
 */

import type { BuildingProfile, NodeKind, Result, TreeNode, TreeNodeId } from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import { ruleFor } from './tree-rules.js';

/** Убирает крайние пробелы и сдвоенные пробелы внутри: «1  этаж » → «1 этаж». */
export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Пустая строка и строка из пробелов — это отсутствие значения, а не значение. */
export function normalizeOptional(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const value = normalizeName(raw);
  return value.length === 0 ? null : value;
}

export function checkName(raw: string): Result<string> {
  const name = normalizeName(raw);
  if (name.length === 0) return err('INVALID_ARGUMENT', 'Название не может быть пустым.');
  if (name.length > 200) return err('INVALID_ARGUMENT', 'Название длиннее 200 знаков.');
  return ok(name);
}

/**
 * Одноимённый сосед того же вида.
 *
 * Два этажа с названием «2 этаж» в одном здании — почти всегда двойное нажатие
 * кнопки, а не замысел. Выведенные из эксплуатации узлы не в счёт: новый этаж
 * на месте прежнего называется так же, и это нормально.
 */
export function findDuplicateSibling(
  nodes: readonly TreeNode[],
  parentId: TreeNodeId | null,
  kind: NodeKind,
  name: string,
  exceptId: TreeNodeId | null,
): TreeNode | null {
  const lowered = name.toLocaleLowerCase('ru');
  return (
    nodes.find(
      (node) =>
        node.parentId === parentId &&
        node.kind === kind &&
        node.archivedAt === null &&
        node.id !== exceptId &&
        node.name.toLocaleLowerCase('ru') === lowered,
    ) ?? null
  );
}

/** Ставит новый узел последним среди соседей. */
export function nextSortOrder(nodes: readonly TreeNode[], parentId: TreeNodeId | null): number {
  const orders = nodes.filter((node) => node.parentId === parentId).map((node) => node.sortOrder);
  return orders.length === 0 ? 0 : Math.max(...orders) + 1;
}

/** Характеристики в части ПБ заполняются только у здания. */
export function checkBuildingProfile(
  kind: NodeKind,
  profile: BuildingProfile | null,
): Result<BuildingProfile | null> {
  if (profile === null) return ok(null);
  if (!ruleFor(kind).hasBuildingProfile) {
    return err(
      'INVALID_ARGUMENT',
      `Характеристики пожарной безопасности заполняются у здания, а не у узла «${ruleFor(kind).title}».`,
    );
  }
  return ok(profile);
}

/** Отметка нужна только этажу и должна быть числом, а не «примерно». */
export function checkElevation(kind: NodeKind, elevationM: number | null): Result<number | null> {
  if (elevationM === null) return ok(null);
  if (!ruleFor(kind).hasElevation) {
    return err('INVALID_ARGUMENT', `Отметка задаётся только для этажа, а не для «${ruleFor(kind).title}».`);
  }
  if (!Number.isFinite(elevationM)) return err('INVALID_ARGUMENT', 'Отметка должна быть числом.');
  return ok(elevationM);
}

/**
 * Совпадает ли версия записи с той, которую держит вызывающий.
 *
 * Пока пользователь один, проверка почти всегда проходит. Она стоит здесь с
 * первого дня, потому что вставить её во все сценарии записи задним числом —
 * это и есть переписывание уровня приложения.
 */
export function checkVersion(node: TreeNode, expected: number | undefined): Result<void> {
  if (expected === undefined || expected === node.rowVersion) return ok(undefined);
  return err(
    'VERSION_CONFLICT',
    `Узел «${node.name}» уже изменён. Обновите дерево и повторите правку.`,
  );
}
