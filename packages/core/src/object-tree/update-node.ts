/**
 * Сценарий: изменить сведения об узле дерева.
 *
 * Переименование отделено от переноса намеренно. Перенос меняет структуру
 * объекта и затрагивает всё поддерево, а правка названия — нет; смешивать их в
 * одном сценарии значит делать опасным то, что опасным не является.
 *
 * Вид узла не меняется никогда. Этаж, ставший складом, унёс бы за собой план и
 * координаты размещённого оборудования; вместо этого узел выводится из
 * эксплуатации и заводится новый.
 *
 * Карточка узла записывается целиком: незаполненное поле означает, что значения
 * нет, а не «оставить как было». Иначе стереть однажды введённый инвентарный
 * номер стало бы невозможно.
 */

import type { BuildingProfile, Result, TreeNode, TreeNodeId } from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { TreeDeps } from './tree-deps.js';
import {
  checkBuildingProfile,
  checkElevation,
  checkName,
  checkVersion,
  findDuplicateSibling,
  normalizeOptional,
} from './node-checks.js';

export interface UpdateNodeInput {
  readonly id: TreeNodeId;
  readonly name: string;
  readonly code?: string | null;
  readonly elevationM?: number | null;
  readonly note?: string | null;
  /** Характеристики в части ПБ. Только для здания. */
  readonly building?: BuildingProfile | null;
  /** Версия записи, которую видел пользователь. Если запись успели изменить, правка отклоняется. */
  readonly expectedRowVersion?: number;
}

export async function updateNode(deps: TreeDeps, input: UpdateNodeInput): Promise<Result<TreeNode>> {
  const current = await deps.tree.getById(input.id);
  if (!current.ok) return current;

  const version = checkVersion(current.value, input.expectedRowVersion);
  if (!version.ok) return version;

  if (current.value.archivedAt !== null) {
    return err(
      'INVALID_ARGUMENT',
      `Узел «${current.value.name}» выведен из эксплуатации. Сначала верните его в работу.`,
    );
  }

  const name = checkName(input.name);
  if (!name.ok) return name;

  const elevation = checkElevation(current.value.kind, input.elevationM ?? null);
  if (!elevation.ok) return elevation;

  const profile = checkBuildingProfile(current.value.kind, input.building ?? null);
  if (!profile.ok) return profile;

  const all = await deps.tree.list();
  if (!all.ok) return all;

  const duplicate = findDuplicateSibling(
    all.value,
    current.value.parentId,
    current.value.kind,
    name.value,
    current.value.id,
  );
  if (duplicate !== null) {
    return err('INVALID_ARGUMENT', `«${name.value}» уже есть на этом же уровне дерева.`);
  }

  const node: TreeNode = {
    ...current.value,
    name: name.value,
    code: normalizeOptional(input.code),
    elevationM: elevation.value,
    note: normalizeOptional(input.note),
    building: profile.value,
    updatedAt: deps.clock.nowUtc(),
    rowVersion: current.value.rowVersion + 1,
  };

  const saved = await deps.tree.save(node);
  if (!saved.ok) return saved;
  return ok(node);
}

export interface SetObjectsPinnedInput {
  readonly id: TreeNodeId;
  readonly pinned: boolean;
}

/**
 * Закрепляет или снимает закрепление объектов на плане узла (ТЗ, Дополнение
 * 3, часть К5).
 *
 * Хранится в самом узле, а не в состоянии окна: иначе закрепление слетало бы
 * при переходе на другой этаж и при каждом перезапуске программы, а смысл
 * кнопки — защитить расстановку надолго, а не на текущий сеанс.
 */
export async function setObjectsPinned(deps: TreeDeps, input: SetObjectsPinnedInput): Promise<Result<TreeNode>> {
  const current = await deps.tree.getById(input.id);
  if (!current.ok) return current;
  if (current.value.objectsPinned === input.pinned) return ok(current.value);

  const node: TreeNode = {
    ...current.value,
    objectsPinned: input.pinned,
    updatedAt: deps.clock.nowUtc(),
    rowVersion: current.value.rowVersion + 1,
  };

  const saved = await deps.tree.save(node);
  if (!saved.ok) return saved;
  return ok(node);
}

export interface SetInCommonJournalInput {
  readonly id: TreeNodeId;
  readonly include: boolean;
}

/**
 * Включает или убирает узел из общего журнала здания.
 *
 * Запасные огнетушители со склада не нужны в журнале по конкретному этажу, но
 * нужны в инвентарной ведомости. Настройка влияет только на состав
 * представления: записи остаются на месте и продолжают учитываться в сроках —
 * иначе отключением можно было бы спрятать просроченную проверку.
 */
export async function setInCommonJournal(
  deps: TreeDeps,
  input: SetInCommonJournalInput,
): Promise<Result<TreeNode>> {
  const current = await deps.tree.getById(input.id);
  if (!current.ok) return current;
  if (current.value.inCommonJournal === input.include) return ok(current.value);

  const node: TreeNode = {
    ...current.value,
    inCommonJournal: input.include,
    updatedAt: deps.clock.nowUtc(),
    rowVersion: current.value.rowVersion + 1,
  };

  const saved = await deps.tree.save(node);
  if (!saved.ok) return saved;
  return ok(node);
}

export interface ReorderNodeInput {
  readonly id: TreeNodeId;
  /** На сколько позиций сдвинуть среди соседей: −1 вверх, +1 вниз. */
  readonly offset: number;
}

export interface ReorderNodeAroundInput {
  readonly id: TreeNodeId;
  readonly targetId: TreeNodeId;
  readonly placement: 'before' | 'after';
}

/**
 * Сдвигает узел среди соседей.
 *
 * Порядок этажей пользователь расставляет сам: где-то счёт идёт снизу вверх,
 * где-то сверху вниз, и навязывать одно из этих правил нельзя. Меняются местами
 * ровно два узла, поэтому сбой на второй записи оставит понятную картину, а не
 * перемешанное дерево.
 */
export async function reorderNode(
  deps: TreeDeps,
  input: ReorderNodeInput,
): Promise<Result<readonly TreeNode[]>> {
  const current = await deps.tree.getById(input.id);
  if (!current.ok) return current;

  const all = await deps.tree.list();
  if (!all.ok) return all;

  const siblings = all.value
    .filter((node) => node.parentId === current.value.parentId && node.archivedAt === null)
    .sort((a, b) => (a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.name.localeCompare(b.name, 'ru')));

  const index = siblings.findIndex((node) => node.id === current.value.id);
  const target = index + input.offset;
  if (index < 0 || target < 0 || target >= siblings.length) {
    return err('INVALID_ARGUMENT', 'Дальше двигать некуда.');
  }

  const neighbour = siblings[target];
  if (neighbour === undefined) return err('INTERNAL', 'Не найден соседний узел.');

  // Обычно у соседей разный порядок, и они просто меняются номерами. Одинаковый
  // номер встречается только у данных, пришедших со стороны — при импорте или
  // после ручной правки хранилища. Тогда узел сдвигается на единицу, а не
  // остаётся на месте, делая вид, что кнопка не нажималась.
  const sameOrder = neighbour.sortOrder === current.value.sortOrder;
  const now = deps.clock.nowUtc();
  const moved: TreeNode = {
    ...current.value,
    sortOrder: sameOrder ? neighbour.sortOrder + (input.offset > 0 ? 1 : -1) : neighbour.sortOrder,
    updatedAt: now,
    rowVersion: current.value.rowVersion + 1,
  };
  const swapped: TreeNode = {
    ...neighbour,
    sortOrder: sameOrder ? neighbour.sortOrder : current.value.sortOrder,
    updatedAt: now,
    rowVersion: neighbour.rowVersion + 1,
  };

  const savedMoved = await deps.tree.save(moved);
  if (!savedMoved.ok) return savedMoved;
  const savedSwapped = await deps.tree.save(swapped);
  if (!savedSwapped.ok) return savedSwapped;

  return ok([moved, swapped]);
}

/**
 * Ставит узел перед или после выбранного соседа.
 *
 * Это сценарий именно для drag-and-drop сортировки дерева. Он намеренно
 * запрещает смену родителя: перенос в другого родителя должен идти через
 * отдельный сценарий `moveNode`, где пользователь явно выбирает новое место.
 */
export async function reorderNodeAround(
  deps: TreeDeps,
  input: ReorderNodeAroundInput,
): Promise<Result<readonly TreeNode[]>> {
  if (input.id === input.targetId) return ok([]);

  const current = await deps.tree.getById(input.id);
  if (!current.ok) return current;

  const target = await deps.tree.getById(input.targetId);
  if (!target.ok) return target;

  if (current.value.archivedAt !== null || target.value.archivedAt !== null) {
    return err('INVALID_ARGUMENT', 'Выведенные из эксплуатации узлы не сортируются.');
  }
  if (current.value.parentId !== target.value.parentId) {
    return err('INVALID_ARGUMENT', 'Сортировка мышью возможна только внутри одного родителя.');
  }

  const all = await deps.tree.list();
  if (!all.ok) return all;

  const siblings = all.value
    .filter((node) => node.parentId === current.value.parentId && node.archivedAt === null)
    .sort((a, b) => (a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.name.localeCompare(b.name, 'ru')));

  const withoutMoved = siblings.filter((node) => node.id !== current.value.id);
  const targetIndex = withoutMoved.findIndex((node) => node.id === target.value.id);
  if (targetIndex < 0) return err('INVALID_ARGUMENT', 'Целевой сосед не найден.');

  const insertAt = input.placement === 'before' ? targetIndex : targetIndex + 1;
  const ordered = [
    ...withoutMoved.slice(0, insertAt),
    current.value,
    ...withoutMoved.slice(insertAt),
  ];

  const changed = ordered.filter((node, index) => node.sortOrder !== index);
  if (changed.length === 0) return ok([]);

  const now = deps.clock.nowUtc();
  const savedNodes: TreeNode[] = [];
  for (const node of changed) {
    const updated: TreeNode = {
      ...node,
      sortOrder: ordered.findIndex((orderedNode) => orderedNode.id === node.id),
      updatedAt: now,
      rowVersion: node.rowVersion + 1,
    };
    const saved = await deps.tree.save(updated);
    if (!saved.ok) return saved;
    savedNodes.push(updated);
  }

  return ok(savedNodes);
}
