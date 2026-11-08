/**
 * Область прав пользователя: до каких узлов дерева он дотягивается.
 *
 * Показана деревом, а не списком. Заказчик: «при выдаче допусков на объекты
 * нужно объекты структурировать, как сделано в дереве; сейчас они идут в
 * хаотичном порядке. Нужно структурировать, с возможностью выпадения
 * дальнейшего». Плоский список и правда был хаотичен: узлы шли в том порядке,
 * в каком лежали в хранилище, и «Корпус 1» мог оказаться между двумя чужими
 * цехами. По такому списку не видно, что во что входит, — а вся выдача прав
 * именно об этом.
 *
 * Отмечают не каждый узел, а верхний. Права идут вниз: отметили здание —
 * доступны все его этажи и склады, отмечать их отдельно не нужно. Поэтому
 * отмеченный узел **сворачивается**: внутри него выбирать больше нечего.
 * Заказчик: «если я могу дать доступ к зданию, то отмечать отдельные этажи не
 * нужно; если даю полный доступ к объекту, то здания там не должны
 * отображаться».
 *
 * Выведенные из эксплуатации узлы не показываются. Они остаются в данных,
 * потому что на них ссылается журнал, но выдавать права на снесённый цех
 * незачем.
 */

import { useMemo, useState } from 'react';
import type { TreeNode, UserAccount } from '@izh/contracts';

export interface UserScopePickerProps {
  readonly user: UserAccount;
  readonly nodes: readonly TreeNode[];
  readonly busy: boolean;
  readonly onToggle: (nodeId: string) => void;
}

/** Узел дерева вместе с тем, что в него входит. */
interface Branch {
  readonly node: TreeNode;
  readonly children: readonly Branch[];
}

/**
 * Собирает дерево из плоского списка.
 *
 * Корнями считаются узлы, чьего родителя в списке нет: так дерево строится и
 * тогда, когда список отобран (например, по области прав самого выдающего) и
 * верхних узлов в нём не осталось.
 */
function toBranches(nodes: readonly TreeNode[]): readonly Branch[] {
  const known = new Set(nodes.map((node) => node.id));
  const children = new Map<string, TreeNode[]>();
  const roots: TreeNode[] = [];

  for (const node of nodes) {
    if (node.parentId === null || !known.has(node.parentId)) { roots.push(node); continue; }
    const list = children.get(node.parentId);
    if (list === undefined) children.set(node.parentId, [node]);
    else list.push(node);
  }

  const order = (list: readonly TreeNode[]): readonly TreeNode[] =>
    [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ru'));

  const grow = (node: TreeNode): Branch => ({
    node,
    children: order(children.get(node.id) ?? []).map(grow),
  });

  return order(roots).map(grow);
}

/** Сколько узлов внутри — числом: по нему видно цену отметки. */
function countInside(branch: Branch): number {
  return branch.children.reduce((sum, child) => sum + 1 + countInside(child), 0);
}

export function UserScopePicker(props: UserScopePickerProps): React.JSX.Element {
  const live = useMemo(
    () => props.nodes.filter((node) => node.archivedAt === null),
    [props.nodes],
  );
  const tree = useMemo(() => toBranches(live), [live]);

  /*
   * Раскрытые ветви. Сначала раскрыты верхние: с закрытого дерева выдача
   * начинается вслепую. Дальше человек раскрывает сам — и его выбор
   * запоминается, пока окно открыто.
   */
  const [opened, setOpened] = useState<ReadonlySet<string>>(
    () => new Set(tree.map((branch) => branch.node.id)),
  );

  const toggleOpen = (id: string): void => {
    setOpened((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (tree.length === 0) {
    return <p className="muted small">Дерево объекта пусто: выдавать права не на что.</p>;
  }

  const granted = new Set(props.user.scope);

  const row = (branch: Branch, depth: number): React.JSX.Element => {
    const { node } = branch;
    const isGranted = granted.has(node.id);
    const inside = countInside(branch);
    const open = opened.has(node.id);

    return (
      <div key={node.id} className="scope-branch">
        <div className="scope-row" style={{ paddingLeft: `${depth * 18}px` }}>
          {/* Разворот стоит слева от галочки, как в дереве объекта: там же его
              и ищут. У отмеченного узла разворачивать нечего — внутри всё
              доступно и выбирать не из чего. */}
          {branch.children.length > 0 && !isGranted ? (
            <button
              type="button"
              className="scope-toggle"
              title={open ? 'Свернуть' : 'Развернуть'}
              aria-label={open ? 'Свернуть' : 'Развернуть'}
              onClick={() => toggleOpen(node.id)}
            >
              {open ? '−' : '+'}
            </button>
          ) : (
            <span className="scope-toggle scope-toggle-blank" />
          )}

          <label className="checkbox scope-check">
            <input
              type="checkbox"
              checked={isGranted}
              disabled={props.busy}
              onChange={() => props.onToggle(node.id)}
            />
            <span>
              {node.name}
              {isGranted && inside > 0 && (
                <span className="muted small"> — и всё, что внутри: {inside}</span>
              )}
              {!isGranted && branch.children.length > 0 && !open && (
                <span className="muted small"> · внутри: {inside}</span>
              )}
            </span>
          </label>
        </div>

        {/* Внутренность отмеченного узла не показывается вовсе: она уже выдана,
            и галочки в ней означали бы выбор, которого нет. */}
        {!isGranted && open && branch.children.map((child) => row(child, depth + 1))}
      </div>
    );
  };

  return <div className="user-scope">{tree.map((branch) => row(branch, 0))}</div>;
}

/**
 * Область одной строкой — для списка пользователей.
 *
 * Администратору область не выдают: у него её нет, он ведёт программу целиком.
 */
export function scopeSummary(user: UserAccount, nodes: readonly TreeNode[]): string {
  if (user.role === 'администратор') return 'весь объект';
  if (user.scope.length === 0) return 'ничего не выдано';

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const names = user.scope
    .map((id) => byId.get(id))
    .filter((node): node is TreeNode => node !== undefined)
    .map((node) => (node.archivedAt === null ? node.name : `${node.name} (выведен)`));

  // Выданный узел мог исчезнуть из дерева — тогда о нём сказано числом, а не
  // молчанием: иначе список выглядел бы короче, чем есть на самом деле.
  const lost = user.scope.length - names.length;
  const tail = lost > 0 ? `, и ещё ${lost} несуществующих` : '';
  return `${names.join(', ')}${tail}`;
}
