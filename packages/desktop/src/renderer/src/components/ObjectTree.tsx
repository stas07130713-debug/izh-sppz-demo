/**
 * Дерево объекта: организация → цех → здание → этаж, рядом с этажами — склады.
 *
 * Ветвь раскрывается и скрывается знаком «+» / «−» на самой строке узла, как в
 * инженерных программах. Узлы без вложенных узлов знака не имеют — иначе
 * пользователь нажимал бы на пустоту.
 *
 * Компонент только рисует готовую структуру, собранную ядром (buildForest).
 * Своей логики вложенности у него нет — иначе интерфейс и ядро разошлись бы в
 * понимании того, что во что вкладывается.
 */

import type { TreeNode, TreeNodeId } from '@izh/contracts';
import { nodeTitle, ruleFor, type TreeNodeView } from '@izh/core';

export interface ObjectTreeProps {
  readonly forest: readonly TreeNodeView[];
  readonly selectedId: TreeNodeId | null;
  /** Узлы, ветви которых сейчас скрыты. */
  readonly collapsed: ReadonlySet<TreeNodeId>;
  readonly onSelect: (id: TreeNodeId) => void;
  readonly onToggle: (id: TreeNodeId) => void;
  readonly onReorder: (id: TreeNodeId, targetId: TreeNodeId, placement: 'before' | 'after') => void;
  readonly onContext: (id: TreeNodeId, x: number, y: number) => void;
}

export function ObjectTree(props: ObjectTreeProps): React.JSX.Element {
  if (props.forest.length === 0) {
    return (
      <p className="muted small">
        Дерева пока нет. Начните с организации — это корень всей структуры.
      </p>
    );
  }

  return (
    <ul className="tree">
      {props.forest.map((view) => (
        <TreeBranch key={view.node.id} view={view} {...props} />
      ))}
    </ul>
  );
}

interface TreeBranchProps extends ObjectTreeProps {
  readonly view: TreeNodeView;
}

function TreeBranch(props: TreeBranchProps): React.JSX.Element {
  const { node, children } = props.view;
  const hasChildren = children.length > 0;
  const open = hasChildren && !props.collapsed.has(node.id);

  return (
    <li>
      <div
        className={node.id === props.selectedId ? 'tree-row selected' : 'tree-row'}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(event) => {
          event.preventDefault();
          const draggedId = event.dataTransfer.getData('application/x-izh-tree-node');
          if (draggedId === '' || draggedId === node.id) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const placement = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
          props.onReorder(draggedId, node.id, placement);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          props.onContext(node.id, event.clientX, event.clientY);
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="tree-toggle"
            onClick={() => props.onToggle(node.id)}
            title={open ? 'Скрыть вложенные узлы' : 'Показать вложенные узлы'}
            aria-label={open ? 'Скрыть' : 'Показать'}
          >
            {open ? '−' : '+'}
          </button>
        ) : (
          /* Пустышка вместо знака раскрытия: у узла без вложенных нажимать
             нечего. Класс называется «tree-toggle-blank», а не «empty», —
             «empty» занят страницей «показывать нечего» с водяным знаком и
             отступом под него, и лист дерева получал их себе. */
          <span className="tree-toggle tree-toggle-blank" />
        )}

        <button
          type="button"
          className="tree-label"
          draggable={node.archivedAt === null}
          onClick={() => props.onSelect(node.id)}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('application/x-izh-tree-node', node.id);
          }}
        >
          <span className="tree-name">{nodeTitle(node)}</span>
          <span className="muted small">{ruleFor(node.kind).title}</span>
          {node.archivedAt !== null && <span className="badge warn">выведен</span>}
          {!node.inCommonJournal && <span className="badge muted">вне общего журнала</span>}
        </button>
      </div>

      {open && (
        <ul className="tree">
          {children.map((child) => (
            <TreeBranch key={child.node.id} {...props} view={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Название вида узла для показа рядом с именем. */
export function kindLabel(node: TreeNode): string {
  return ruleFor(node.kind).title;
}
