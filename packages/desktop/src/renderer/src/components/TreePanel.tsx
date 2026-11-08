/**
 * Левое поле: дерево объекта и всё управление им.
 *
 * Устроено как в инженерных программах: сверху дерево с раскрытием ветвей, снизу
 * карточка выбранного узла.
 *
 * Узлы заводятся правым щелчком по тому, внутрь чего их кладут: щёлкнул по
 * зданию — добавил этаж или склад, щёлкнул по цеху — добавил здание. Отдельной
 * кнопки «создать» больше нет. Она спрашивала «что создаём» в отрыве от места и
 * молча брала родителем выделенный узел — а выделение к тому времени могло быть
 * и не тем, о котором думал человек. Правый щелчок называет место сам.
 *
 * Поле сворачивается в узкую полосу: план и журнал шире, чем экран, и ради них
 * дерево убирают. Свёрнутое поле продолжает отвечать на вопрос «где я»: на
 * полосе стоит название выбранного узла, а полный путь виден в подписи над
 * рабочей областью.
 */

import { useEffect, useRef, useState } from 'react';
import type { NodeKind, TreeNode, TreeNodeId } from '@izh/contracts';
import {
  allowedChildKinds, branchOf, canContain, filterForest, isDescendantOf, nodeTitle, planCaption, ruleFor,
} from '@izh/core';
import { useMenuPlacement } from '../menu-placement';
import { AddChildForm, type NewChild } from './AddChildForm';
import { ObjectTree } from './ObjectTree';
import { SelectField } from './SelectField';

interface MoveTarget {
  readonly id: string;
  readonly caption: string;
}

/**
 * Открытое меню узла.
 *
 * Одно меню на три вида работы — пункты, добавление, перенос, — а не три
 * всплывающих окна: все они об одном узле, и уводить человека от него незачем.
 * `addKind` хранит выбранный пунктом вид: форма о нём уже не спрашивает.
 */
interface TreeMenu {
  readonly nodeId: TreeNodeId;
  readonly x: number;
  readonly y: number;
  readonly moving: boolean;
  readonly addKind: NodeKind | null;
  /** Форма заводит узел не внутрь, а рядом — то есть в родителя. */
  readonly addToParent: boolean;
}

export interface TreePanelProps {
  readonly nodes: readonly TreeNode[];
  readonly selected: TreeNode | null;
  readonly busy: boolean;
  readonly onSelect: (id: TreeNodeId) => void;
  /**
   * Заводит организацию. Отвечает, получилось ли.
   *
   * Ответ нужен форме: набранное имя стирается **только при успехе**.
   * Прежде оно стиралось всегда, и сорвавшееся сохранение заставляло
   * набирать заново — а причина срыва к тому времени уже уходила из виду.
   */
  readonly onCreateOrganization: (name: string) => Promise<boolean>;
  /**
   * Завести узел. Родитель передаётся явно: внутрь узла и рядом с ним —
   * разные родители, а выбранный узел один.
   */
  readonly onAddChild: (child: NewChild, parentId: TreeNodeId) => void;
  readonly onReorder: (id: TreeNodeId, targetId: TreeNodeId, placement: 'before' | 'after') => void;
  readonly onMoveTo: (id: TreeNodeId, parentId: TreeNodeId) => void;
  readonly onArchive: (id: TreeNodeId) => void;
  /** Открыта ли карточка узла. */
  readonly cardOpen: boolean;
  readonly onToggleCard: () => void;
  /**
   * Сама карточка узла.
   *
   * Приходит готовой разметкой, а не двумя десятками свойств: дерево про её
   * содержимое ничего не знает и знать не должно — оно только даёт ей место и
   * полосу, которой её открывают.
   */
  readonly card?: React.ReactNode;
}

export function TreePanel(props: TreePanelProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<TreeNodeId>>(new Set());
  const [organizationName, setOrganizationName] = useState('');
  /** Форма организации открыта вручную — когда в дереве уже что-то есть. */
  const [addingOrganization, setAddingOrganization] = useState(false);
  const [folded, setFolded] = useState(false);

  /*
   * Дерево сворачивает только человек.
   *
   * Сворачивание при смене вкладки было сделано по просьбе и отменено ею же:
   * «отмени, пусть сворачивается принудительно пользователем». И это верно —
   * между планом и журналом ходят постоянно, и поле, закрывающееся само,
   * приходится открывать каждый раз заново.
   */
  const [menu, setMenu] = useState<TreeMenu | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const forest = filterForest(props.nodes, query);
  /**
   * Дерево пусто на экране.
   *
   * Считается по видимым узлам, а не по всему списку. Выведенные из
   * эксплуатации в дереве не показываются: раньше при подсчёте по списку
   * они делали вид, что дерево есть. Форма организации не появлялась, а
   * правым щелчком нажать было не на что — программа упиралась в тупик,
   * из которого нельзя было завести ни одного узла.
   */
  const nothingYet = filterForest(props.nodes, '').length === 0;
  const menuNode = menu === null ? null : props.nodes.find((node) => node.id === menu.nodeId) ?? null;
  const menuMoveTargets = menuNode === null ? [] : possibleParents(props.nodes, menuNode);
  const menuChildKinds = menuNode === null ? [] : allowedChildKinds(menuNode.kind);
  /**
   * Что можно завести рядом с узлом.
   *
   * Без этого от этажа и склада завести было нечего: внутрь них узлы не
   * заводятся, а кнопки «Создать» больше нет. Человек, стоящий на этаже,
   * упирался в тупик и не догадывался, что щёлкать надо по зданию.
   */
  const menuParent = menuNode?.parentId === undefined || menuNode.parentId === null
    ? null
    : props.nodes.find((node) => node.id === menuNode.parentId) ?? null;
  const menuSiblingKinds = menuParent === null ? [] : allowedChildKinds(menuParent.kind);
  const branch = props.selected === null ? [] : branchOf(props.nodes, props.selected.id);

  useEffect(() => {
    if (menu === null) return undefined;

    const closeOnOutsideClick = (event: MouseEvent): void => {
      if (menuRef.current?.contains(event.target as Node) === true) return;
      setMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMenu(null);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menu]);

  /**
   * Меню держится в пределах окна.
   *
   * Оно открывается под курсором, а с формой добавления вырастает втрое — и у
   * нижнего края экрана кнопка «Добавить» оказывалась за его пределами.
   * Правило размещения общее на все меню программы: считается оно по
   * настоящему размеру меню, после отрисовки, потому что заранее размер не
   * вычислить — он зависит от вида узла и от того, что в меню открыто.
   *
   * Признак пересчёта — раскрытая форма: от неё меняется высота, а место
   * щелчка остаётся прежним.
   */
  const menuStyle = useMenuPlacement(menuRef, menu?.x ?? 0, menu?.y ?? 0, menu?.addKind ?? '');

  const toggle = (id: TreeNodeId): void => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /*
   * Свёрнутое поле — узкая полоса, а не пустота. На ней кнопка разворота и
   * название выбранного узла: убрав дерево ради ширины плана, человек не должен
   * терять из виду, где он стоит. Полный путь при этом виден в подписи над
   * рабочей областью.
   */
  if (folded) {
    return (
      <aside className="sidebar folded">
        <button
          type="button"
          className="sidebar-fold"
          title="Развернуть дерево объекта"
          aria-label="Развернуть дерево объекта"
          onClick={() => setFolded(false)}
        >
          ▸
        </button>

        {/* Ветвь своего цеха целиком — по ней и переходят: этаж, соседний этаж,
            соседнее здание. Весь объект в полосу не поместится, а ветвь
            помещается, и её достаточно. */}
        <div className="sidebar-branch">
          {branch.map(({ node, depth }) => (
            <button
              key={node.id}
              type="button"
              className={node.id === props.selected?.id ? 'branch-step current' : 'branch-step'}
              style={{ paddingLeft: 5 + depth * 9 }}
              title={`${ruleFor(node.kind).title}: ${nodeTitle(node)}`}
              onClick={() => props.onSelect(node.id)}
            >
              {nodeTitle(node)}
            </button>
          ))}
          {branch.length === 0 && <div className="sidebar-branch-empty">Дерево объекта</div>}
        </div>
      </aside>
    );
  }

  /*
   * Раскрытая карточка занимает левое поле целиком — «до самого верха».
   *
   * Дерево при этом не рисуется вовсе, а не прячется под карточкой: делить
   * колонку в 340 точек между ними не выходит — у здания в карточке
   * восемнадцать полей, и на половине колонки они сминаются в столбик. Пока
   * карточку правят, дерево не нужно; закрыл — дерево снова на месте.
   *
   * Так же надёжнее: карточка — обычный блок в потоке, а не панель, положенная
   * поверх. У поля свои внутренние отступы и своя прокрутка, и наложенная
   * поверх панель отсчитывалась от них, а не от самого края.
   */
  if (props.cardOpen && props.card != null) {
    return <aside className="sidebar sidebar-card">{props.card}</aside>;
  }

  return (
    <aside className="sidebar">
      <div className="panel-head">
        <h3>Дерево объекта</h3>
        {/* Вторую организацию иначе не завести: правый щелчок по
            организации предлагает только то, что внутрь. */}
        <button
          type="button"
          className="panel-action-button"
          title="Завести организацию — ещё один корень дерева"
          onClick={() => setAddingOrganization(!addingOrganization)}
        >
          + Организация
        </button>
        <button
          type="button"
          className="sidebar-fold"
          title="Свернуть дерево — рабочая область станет шире"
          aria-label="Свернуть дерево объекта"
          onClick={() => setFolded(true)}
        >
          ◂
        </button>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Поиск по названию или номеру"
      />

      {/* Форма организации нужна ровно один раз — пока дерева нет и правым
          щелчком нажать не на что. Дальше узлы заводятся по месту. */}
      {(nothingYet || addingOrganization) && (
        <div className="create-block">
          <h4>Новая организация</h4>
          <p className="muted small">
            {props.nodes.length === 0
              ? 'Организация — корень дерева: предприятие целиком.'
              : 'Все узлы выведены из эксплуатации. Заведите организацию заново — прежние записи журнала сохранены.'}
          </p>
          <div className="field-row">
            <label className="field">
              <input
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
                placeholder="Например: Кольская ГМК"
              />
            </label>
            <button
              type="button"
              className="primary"
              disabled={props.busy || organizationName.trim() === ''}
              onClick={() => {
                void props.onCreateOrganization(organizationName).then((created) => {
                  if (!created) return;
                  setOrganizationName('');
                  setAddingOrganization(false);
                });
              }}
            >
              Создать
            </button>
          </div>
        </div>
      )}

      {!nothingYet && (
        <p className="muted small tree-hint">
          Правый щелчок по узлу — добавить внутрь, перенести или удалить.
        </p>
      )}

      <div className="tree-area">
        <ObjectTree
          forest={forest}
          selectedId={props.selected?.id ?? null}
          collapsed={collapsed}
          onSelect={props.onSelect}
          onToggle={toggle}
          onReorder={props.onReorder}
          onContext={(id, x, y) => {
            props.onSelect(id);
            setMenu({ nodeId: id, x, y, moving: false, addKind: null, addToParent: false });
          }}
        />
        {forest.length === 0 && query.trim() !== '' && (
          <p className="muted small">По запросу «{query}» ничего не найдено.</p>
        )}
      </div>

      {props.selected !== null && (
        <div className="sidebar-props">
          {/*
            * Полоса, которой карточку открывают.
            *
            * Стоит у нижнего края левого поля — там же, где потом появится
            * полоса «скрыть»: движение читается как выдвижной ящик. Раскрытая
            * карточка занимает поле целиком и эту полосу собой закрывает,
            * поэтому парная ей полоса живёт внутри самой карточки.
            */}
          <button type="button" className="card-toggle" onClick={props.onToggleCard}>
            ▲ Карточка узла
          </button>
        </div>
      )}

      {props.card}

      {menu !== null && menuNode !== null && (
        <div
          ref={menuRef}
          className={menu.addKind === null ? 'context-menu tree-context-menu' : 'context-menu tree-context-menu wide'}
          style={menuStyle}
        >
          {menu.addKind !== null ? (
            <>
              {/* Вид уже выбран пунктом меню — форма спрашивает только то, чего
                  ещё не знает: название, номер и отметку. */}
              <AddChildForm
                parent={menu.addToParent && menuParent !== null ? menuParent : menuNode}
                fixedKind={menu.addKind}
                busy={props.busy}
                onAdd={(child) => {
                  const parentId = menu.addToParent && menuParent !== null ? menuParent.id : menuNode.id;
                  props.onAddChild(child, parentId);
                  setMenu(null);
                }}
              />
              <button type="button" onClick={() => setMenu({ ...menu, addKind: null })}>
                Назад
              </button>
            </>
          ) : menu.moving ? (
            <>
              <label className="field compact-field">
                <SelectField
                  value=""
                  placeholder="Новый родитель"
                  disabled={props.busy}
                  options={menuMoveTargets.map((target) => ({ value: target.id, title: target.caption }))}
                  onChange={(value) => {
                    if (value === '') return;
                    props.onMoveTo(menuNode.id, value);
                    setMenu(null);
                  }}
                />
              </label>
              <button type="button" onClick={() => setMenu({ ...menu, moving: false })}>
                Назад
              </button>
            </>
          ) : (
            <>
              <div className="context-menu-title">{nodeTitle(menuNode)}</div>
              {/* Что можно завести внутрь, решают правила ядра, а не интерфейс:
                  невозможного действия здесь просто нет в списке. */}
              {menuChildKinds.length === 0 && menuSiblingKinds.length === 0 && (
                <p className="muted small context-menu-note">
                  Внутрь узлы не заводятся — здесь работает уже само оборудование.
                </p>
              )}
              {menuChildKinds.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  disabled={props.busy}
                  onClick={() => setMenu({ ...menu, addKind: kind, addToParent: false })}
                >
                  + {ruleFor(kind).title}
                </button>
              ))}

              {/* Рядом — то же, что разрешено родителю. Стоя на этаже, заводят
                  соседний этаж, а не идут искать здание в дереве. */}
              {menuParent !== null && menuSiblingKinds.map((kind) => (
                <button
                  key={`рядом-${kind}`}
                  type="button"
                  disabled={props.busy}
                  title={`Завести в «${nodeTitle(menuParent)}»`}
                  onClick={() => setMenu({ ...menu, addKind: kind, addToParent: true })}
                >
                  + {ruleFor(kind).title} рядом
                </button>
              ))}
              <button
                type="button"
                disabled={props.busy || menuMoveTargets.length === 0}
                onClick={() => setMenu({ ...menu, moving: true })}
              >
                Перенести в другой узел
              </button>
              <button
                type="button"
                className="danger"
                disabled={props.busy}
                onClick={() => {
                  props.onArchive(menuNode.id);
                  setMenu(null);
                }}
              >
                Удалить
              </button>
            </>
          )}
        </div>
      )}

    </aside>
  );
}

function possibleParents(nodes: readonly TreeNode[], node: TreeNode): readonly MoveTarget[] {
  return nodes
    .filter(
      (candidate) =>
        candidate.archivedAt === null &&
        candidate.siteId === node.siteId &&
        candidate.id !== node.id &&
        candidate.id !== node.parentId &&
        canContain(candidate.kind, node.kind) &&
        !isDescendantOf(nodes, candidate.id, node.id),
    )
    .sort((a, b) => nodeTitle(a).localeCompare(nodeTitle(b), 'ru'))
    .map((target) => ({ id: target.id, caption: planCaption(nodes, target.id) }));
}
