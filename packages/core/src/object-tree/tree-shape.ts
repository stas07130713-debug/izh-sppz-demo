/**
 * Форма дерева: сборка, обход, подписи.
 *
 * Здесь только вычисления над готовым списком узлов — ни хранилища, ни часов.
 * Поэтому всё проверяется тестами построчно, а интерфейс может пользоваться
 * этими же функциями, ничего не пересчитывая по-своему.
 *
 * Подпись схемы собирается отсюда, а не хранится на плане. Иначе после
 * переименования здания на чертеже осталась бы прежняя надпись, и распечатанный
 * план перестал бы соответствовать журналу.
 */

import type { TreeNode, TreeNodeId } from '@izh/contracts';

/** Узел вместе с потомками. */
export interface TreeNodeView {
  readonly node: TreeNode;
  readonly children: readonly TreeNodeView[];
}

export interface BuildForestOptions {
  /** Показывать ли выведенные из эксплуатации узлы. По умолчанию нет. */
  readonly includeArchived?: boolean;
}

function isVisible(node: TreeNode, options: BuildForestOptions): boolean {
  return options.includeArchived === true || node.archivedAt === null;
}

/** Соседи по порядку: сначала как расставил пользователь, при равенстве — по алфавиту. */
function compareSiblings(a: TreeNode, b: TreeNode): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.name.localeCompare(b.name, 'ru');
}

/**
 * Собирает дерево из плоского списка.
 *
 * Узел, чей родитель в списке отсутствует, становится корнем, а не пропадает.
 *
 * Прежде такие узлы в дерево не попадали: считалось, что показать этаж без
 * здания значит соврать о структуре объекта. Но список приходит уже отобранным —
 * по области прав, по поиску, по пометке о выводе из эксплуатации, — и
 * «родителя нет» чаще означает не порчу данных, а то, что родитель просто не
 * относится к делу. Ответственному за одно здание организация и цех не
 * показываются вовсе, и при прежнем правиле он видел бы пустое дерево вместо
 * своего здания.
 *
 * Родитель, скрытый пометкой о выводе из эксплуатации, ведёт себя так же: сам
 * он не показывается, а живые узлы внутри него остаются видимыми — их ещё
 * обслуживают.
 */
export function buildForest(
  nodes: readonly TreeNode[],
  options: BuildForestOptions = {},
): readonly TreeNodeView[] {
  const visible = nodes.filter((node) => isVisible(node, options));
  const byParent = new Map<TreeNodeId | null, TreeNode[]>();
  for (const node of visible) {
    const siblings = byParent.get(node.parentId) ?? [];
    siblings.push(node);
    byParent.set(node.parentId, siblings);
  }

  const grow = (node: TreeNode): TreeNodeView => ({
    node,
    children: [...(byParent.get(node.id) ?? [])].sort(compareSiblings).map(grow),
  });

  /*
   * Корнем считается узел, чьего родителя в списке нет, — а не только тот, у
   * кого родителя нет вовсе.
   *
   * Список приходит уже отобранным: по области прав пользователя, по поиску, по
   * пометке о выводе из эксплуатации. Ответственному за одно здание достаётся
   * само здание и его этажи, а организация и цех остаются снаружи. Считай
   * корнями только узлы без родителя — и такому человеку показалось бы пустое
   * дерево: корней в его списке нет ни одного.
   */
  const present = new Set(visible.map((node) => node.id));

  return visible
    .filter((node) => node.parentId === null || !present.has(node.parentId))
    .sort(compareSiblings)
    .map(grow);
}

/**
 * Дерево, оставшееся после поиска.
 *
 * Ищем по названию и по коду: на предприятии здание чаще помнят по инвентарному
 * номеру, чем по имени. Показываются найденные узлы и их родители — без
 * родителей найденный этаж повис бы в воздухе и стало бы непонятно, чей он.
 * Потомки найденного узла скрыты: поиск отвечает на вопрос «где это», а не
 * заменяет обычный просмотр дерева.
 */
export function filterForest(
  nodes: readonly TreeNode[],
  query: string,
  options: BuildForestOptions = {},
): readonly TreeNodeView[] {
  const needle = query.trim().toLocaleLowerCase('ru');
  if (needle === '') return buildForest(nodes, options);

  const matches = nodes.filter(
    (node) =>
      node.name.toLocaleLowerCase('ru').includes(needle) ||
      (node.code !== null && node.code.toLocaleLowerCase('ru').includes(needle)),
  );

  const keep = new Set<TreeNodeId>();
  for (const match of matches) {
    for (const step of pathToNode(nodes, match.id)) keep.add(step.id);
  }

  return buildForest(
    nodes.filter((node) => keep.has(node.id)),
    options,
  );
}

/** Прямые потомки узла в порядке показа. */
export function childrenOf(
  nodes: readonly TreeNode[],
  parentId: TreeNodeId | null,
  options: BuildForestOptions = {},
): readonly TreeNode[] {
  return nodes
    .filter((node) => node.parentId === parentId && isVisible(node, options))
    .sort(compareSiblings);
}

/**
 * Путь от площадки до узла включительно.
 *
 * Возвращает пустой список, если узла нет или цепочка родителей оборвана.
 */
export function pathToNode(nodes: readonly TreeNode[], id: TreeNodeId): readonly TreeNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const path: TreeNode[] = [];
  let current = byId.get(id);
  // Ограничение на длину пути — защита от закольцованных данных: без него
  // повреждённая цепочка родителей повесила бы программу намертво.
  while (current !== undefined && path.length <= nodes.length) {
    path.unshift(current);
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }
  return path;
}

/** Все потомки узла, на любую глубину. Сам узел не входит. */
export function descendantsOf(nodes: readonly TreeNode[], id: TreeNodeId): readonly TreeNode[] {
  const found: TreeNode[] = [];
  const queue: TreeNodeId[] = [id];
  while (queue.length > 0) {
    const parentId = queue.shift();
    if (parentId === undefined) break;
    for (const node of nodes) {
      if (node.parentId !== parentId) continue;
      found.push(node);
      queue.push(node.id);
    }
  }
  return found;
}

/** Лежит ли узел внутри поддерева другого узла. */
export function isDescendantOf(
  nodes: readonly TreeNode[],
  candidateId: TreeNodeId,
  ancestorId: TreeNodeId,
): boolean {
  return pathToNode(nodes, candidateId).some(
    (node) => node.id === ancestorId && node.id !== candidateId,
  );
}

/**
 * Отметка этажа в принятом на чертежах виде: +4.200, 0.000, -3.600.
 *
 * Три знака после запятой — как в строительной документации; округление до
 * сантиметров исказило бы отметку, взятую из проекта.
 */
export function formatElevation(elevationM: number): string {
  const sign = elevationM > 0 ? '+' : elevationM < 0 ? '-' : '';
  return `${sign}${Math.abs(elevationM).toFixed(3)}`;
}

/** Название узла для показа: у этажа добавляется отметка. */
export function nodeTitle(node: TreeNode): string {
  // Число, а не «не null»: у перенесённых из чужого журнала этажей отметка
  // приходит и пустой строкой, и мусором, а «отм. NaN» попадёт в печатный
  // журнал и в заявку, где его уже не объяснить.
  const elevation = node.elevationM;
  if (node.kind === 'level' && elevation !== null && Number.isFinite(elevation)) {
    return `${node.name} (отм. ${formatElevation(elevation)})`;
  }
  return node.name;
}

/**
 * Подпись схемы: весь путь от площадки до узла.
 *
 * Пример: «Кольская ГМК · МВАСО · Учебная башня · 2 этаж (отм. +4.200)».
 * Именно эта строка попадает в штамп печатного плана и в заголовок журнала.
 */
export function planCaption(nodes: readonly TreeNode[], id: TreeNodeId): string {
  return pathToNode(nodes, id).map(nodeTitle).join(' · ');
}
