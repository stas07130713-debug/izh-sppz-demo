/**
 * Выбор объектов для заявки — прямо во вкладке, а не деревом слева.
 *
 * Заказчик: «привязку к выбранному в данный момент на дереве объекту делать не
 * нужно; пользователь внутри вкладки должен иметь возможность прямо там выбрать
 * любой объект или сразу несколько объектов — этажей или зданий — и сформировать
 * заявку с выбранными элементами».
 *
 * И это верно по существу работы: заявку подрядчику отдают на несколько зданий
 * разом, а не ходят по дереву, составляя по одной на этаж.
 *
 * Устройство простое: список узлов с отступами по вложенности и галочками.
 * Отмеченный узел даёт всё своё оборудование, включая вложенные уровни, —
 * поэтому отмечать здание и его этажи одновременно незачем, и такие отметки
 * ничего не удваивают: оборудование считается по одному разу.
 */

import type { TreeNode } from '@izh/contracts';
import { nodeTitle, ruleFor } from '@izh/core';

export interface RequestNodePickerProps {
  readonly nodes: readonly TreeNode[];
  readonly selected: ReadonlySet<string>;
  readonly onToggle: (nodeId: string) => void;
}

/** Глубина узла в дереве: по ней ставится отступ. */
function depthOf(nodes: readonly TreeNode[], node: TreeNode): number {
  let depth = 0;
  let current = node;
  while (current.parentId !== null) {
    const parent = nodes.find((item) => item.id === current.parentId);
    if (parent === undefined) break;
    current = parent;
    depth += 1;
  }
  return depth;
}

/** Узлы в порядке дерева: родитель, потом его дети. */
function inTreeOrder(nodes: readonly TreeNode[]): readonly TreeNode[] {
  const result: TreeNode[] = [];

  const walk = (parentId: string | null): void => {
    const children = nodes
      .filter((node) => node.parentId === parentId && node.archivedAt === null)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ru'));
    for (const child of children) {
      result.push(child);
      walk(child.id);
    }
  };

  walk(null);
  return result;
}

export function RequestNodePicker(props: RequestNodePickerProps): React.JSX.Element {
  const shown = inTreeOrder(props.nodes);

  if (shown.length === 0) {
    return <p className="muted small">Дерево объекта пусто: заявку составлять не по чему.</p>;
  }

  return (
    <div className="request-nodes">
      {shown.map((node) => (
        <label
          key={node.id}
          className="checkbox request-node"
          style={{ paddingLeft: `${depthOf(props.nodes, node) * 18}px` }}
        >
          <input
            type="checkbox"
            checked={props.selected.has(node.id)}
            onChange={() => props.onToggle(node.id)}
          />
          <span>
            {nodeTitle(node)}
            <span className="muted small"> · {ruleFor(node.kind).title}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
