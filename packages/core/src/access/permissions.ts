/**
 * Проверка прав: что человеку можно и до каких узлов дерева он дотягивается.
 *
 * Две проверки, и обе нужны. Право отвечает на вопрос «можно ли такое
 * действие вообще», область — «можно ли его над этим узлом». Ответственный за
 * ПБ вправе править оборудование, но только на своих объектах; порознь эти
 * вопросы не решаются.
 *
 * Проверки — чистые функции над учётной записью и деревом. Ни одна из них не
 * ходит в хранилище: право нужно спрашивать часто, в том числе на отрисовке
 * каждой кнопки, и поход в хранилище на каждую кнопку programme не переживёт.
 */

import type { Permission, TreeNode, TreeNodeId, UserAccount } from '@izh/contracts';
import { ROLE_PERMISSIONS } from '@izh/contracts';

/** Есть ли у пользователя такое право вообще. */
export function can(user: UserAccount | null, permission: Permission): boolean {
  if (user === null || user.archivedAt !== null) return false;
  return ROLE_PERMISSIONS[user.role].includes(permission);
}

/**
 * Дотягивается ли пользователь до узла.
 *
 * Администратор — до любого: у него нет области, он ведёт программу целиком.
 * Остальным выданные узлы наследуются вниз: выдали цех — доступны все его
 * здания, этажи и склады. Вверх права не идут: доступ к этажу не открывает
 * здание, иначе выдача одного этажа означала бы выдачу всего объекта.
 */
export function canReachNode(
  user: UserAccount | null,
  nodeId: TreeNodeId,
  nodes: readonly TreeNode[],
): boolean {
  if (user === null || user.archivedAt !== null) return false;
  if (user.role === 'администратор') return true;
  if (user.scope.length === 0) return false;

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const granted = new Set(user.scope);

  // Идём от узла вверх: если по дороге встретился выданный — доступ есть.
  // Ограничение по числу шагов защищает от испорченного дерева с петлёй:
  // без него цикл parent → child → parent завис бы навсегда.
  let current: TreeNode | undefined = byId.get(nodeId);
  for (let step = 0; step < nodes.length + 1 && current !== undefined; step += 1) {
    if (granted.has(current.id)) return true;
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }
  return false;
}

/**
 * Все узлы, доступные пользователю, — сам выданный и всё, что внутри.
 *
 * Нужно там, где список узлов строят заранее: дерево, журнал по объекту,
 * журнал изменений. Считать `canReachNode` на каждую строку журнала из тысячи
 * записей значило бы тысячу раз пройти дерево вверх.
 */
export function reachableNodeIds(
  user: UserAccount | null,
  nodes: readonly TreeNode[],
): ReadonlySet<TreeNodeId> {
  if (user === null || user.archivedAt !== null) return new Set();
  if (user.role === 'администратор') return new Set(nodes.map((node) => node.id));

  const children = new Map<TreeNodeId, TreeNode[]>();
  for (const node of nodes) {
    if (node.parentId === null) continue;
    const list = children.get(node.parentId);
    if (list === undefined) children.set(node.parentId, [node]);
    else list.push(node);
  }

  const reached = new Set<TreeNodeId>();
  const queue = [...user.scope];
  while (queue.length > 0) {
    const id = queue.pop();
    if (id === undefined || reached.has(id)) continue;
    reached.add(id);
    for (const child of children.get(id) ?? []) queue.push(child.id);
  }
  return reached;
}

/**
 * Дерево, каким его видит этот человек.
 *
 * Отдельной функцией, а не двумя строками в окне программы. Отбор дерева — это
 * и есть разграничение доступа: по отобранному дереву строится всё остальное —
 * список узлов, журнал, дашборд, выбор места для оборудования. Правило, от
 * которого столько зависит, должно жить в ядре и проверяться, а не лежать
 * россыпью там, где его однажды забудут применить.
 */
export function visibleNodes(
  user: UserAccount | null,
  nodes: readonly TreeNode[],
): readonly TreeNode[] {
  if (user !== null && user.archivedAt === null && user.role === 'администратор') return nodes;

  const allowed = reachableNodeIds(user, nodes);
  return nodes.filter((node) => allowed.has(node.id));
}

/**
 * Можно ли действие над узлом: право и область вместе.
 *
 * Отдельная функция, чтобы на местах не забывали вторую половину. Забытая
 * проверка области — самая вероятная ошибка в разграничении: право есть, и
 * кнопка кажется законной.
 */
export function canOnNode(
  user: UserAccount | null,
  permission: Permission,
  nodeId: TreeNodeId,
  nodes: readonly TreeNode[],
): boolean {
  return can(user, permission) && canReachNode(user, nodeId, nodes);
}
