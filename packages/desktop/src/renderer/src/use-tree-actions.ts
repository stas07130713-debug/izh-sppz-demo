/**
 * Действия над деревом объекта и помещениями этажа.
 *
 * Вынесено из главного экрана: это работа над одним предметом — состав объекта,
 * — со своими правилами, а главный экран занят связыванием частей. Разметка
 * дерева осталась на месте: она короткая, длинными были именно действия.
 *
 * Общее для всех: сценарий выполняется через страж главного экрана (`runCommand`
 * ведёт отмену и ловит сорвавшийся вызов), а списки перечитываются только после
 * успеха. Вывод из эксплуатации спрашивает подтверждение: физического удаления
 * в программе нет, но и выводить из строя случайным нажатием нельзя
 * (AGENTS.md, правило 10).
 */

import type { PlanObject, Result, Room, TreeNode, TreeNodeId } from '@izh/contracts';
import {
  archiveHierarchy,
  archiveRoomHierarchy,
  clearRoomOutline,
  createChildNode,
  createOrganization,
  createRoom,
  descendantsOf,
  moveNode,
  reorderNodeAround,
  setInCommonJournal,
  updateNode,
  updateRoom,
} from '@izh/core';
import { hierarchyArchiveDeps, roomDeps, treeDeps } from './deps';
import { archiveImpact, confirmNodeArchive, confirmRoomArchive } from './components/archive-confirmation';
import type { NewRoom } from './components/RoomsPanel';
import type { NewChild } from './components/AddChildForm';
import type { NodeFields } from './components/NodeCard';
import type { RoomHazardPatch } from './components/RoomHazardFields';

export interface TreeActionsInput {
  readonly nodes: readonly TreeNode[];
  readonly rooms: readonly Room[];
  readonly allRooms: readonly Room[];
  readonly allObjects: readonly PlanObject[];
  readonly selected: TreeNode | null;
  readonly selectedId: TreeNodeId | null;

  /** Сценарий дерева: показывает ошибку и перечитывает дерево при успехе. */
  readonly run: <T>(action: () => Promise<Result<T>>) => Promise<T | null>;
  /** Страж главного экрана: ведёт отмену и ловит сорвавшийся вызов. */
  readonly runCommand: <T>(label: string, action: () => Promise<T>) => Promise<T | null>;
  readonly setMessage: (message: string) => void;

  readonly setSelectedId: (id: TreeNodeId | null) => void;
  readonly setSelectedObjectId: (id: string | null) => void;
  readonly reloadRooms: () => void;
  readonly reloadObjectLists: () => void;
}

export interface TreeActions {
  readonly addRoom: (room: NewRoom) => void;
  readonly archiveRoom: (roomId: string) => void;
  /** Убрать обводку помещения с плана, оставив само помещение. */
  readonly clearRoomOutline: (roomId: string) => void;
  readonly changeRoomHazard: (roomId: string, patch: RoomHazardPatch) => void;
  readonly createOrganization: (name: string) => Promise<boolean>;
  readonly addChild: (child: NewChild, parentId: TreeNodeId) => void;
  readonly saveNode: (fields: NodeFields) => void;
  readonly reorder: (id: TreeNodeId, targetId: TreeNodeId, placement: 'before' | 'after') => void;
  readonly moveTo: (id: TreeNodeId, parentId: TreeNodeId) => void;
  readonly toggleJournal: (include: boolean) => void;
  readonly archive: (id: TreeNodeId) => void;
}

export function useTreeActions(input: TreeActionsInput): TreeActions {
  const {
    nodes, rooms, allRooms, allObjects, selected, selectedId,
    run, runCommand, setMessage, setSelectedId, setSelectedObjectId, reloadRooms, reloadObjectLists,
  } = input;

  return {
    addRoom: (room) => {
      if (selected === null) return;
      void runCommand('Создать помещение', () => createRoom(roomDeps, {
        levelId: selected.id,
        name: room.name,
        number: room.number,
        category: room.category,
      })).then((result) => {
        if (result === null) return;
        if (!result.ok) setMessage(result.error.message);
        else reloadRooms();
      });
    },

    clearRoomOutline: (roomId) => {
      const room = rooms.find((candidate) => candidate.id === roomId);
      if (room === undefined || room.outline === null) return;
      if (!window.confirm(
        `Снять обводку помещения «${room.name}» с плана? `
        + 'Само помещение и его сведения останутся, но площадь придётся считать заново — '
        + 'она бралась из обводки.',
      )) return;

      void runCommand('Снять обводку помещения', () => clearRoomOutline(roomDeps, roomId))
        .then((result) => {
          if (result === null) return;
          if (!result.ok) setMessage(result.error.message);
          else reloadRooms();
        });
    },

    archiveRoom: (roomId) => {
      const room = rooms.find((candidate) => candidate.id === roomId);
      if (room === undefined) return;
      const objectCount = allObjects.filter(
        (object) => object.archivedAt === null && object.roomId === roomId,
      ).length;
      if (!confirmRoomArchive(room, objectCount)) return;

      void runCommand('Вывести помещение из эксплуатации', () => archiveRoomHierarchy(hierarchyArchiveDeps, roomId))
        .then((result) => {
          if (result === null) return;
          if (!result.ok) setMessage(result.error.message);
          else { reloadRooms(); reloadObjectLists(); }
        });
    },

    changeRoomHazard: (roomId, patch) => {
      const room = rooms.find((candidate) => candidate.id === roomId);
      if (room === undefined) return;

      void runCommand('Изменить сведения помещения', () => updateRoom(roomDeps, {
        id: room.id,
        name: room.name,
        number: room.number,
        category: patch.category === undefined ? room.category : patch.category,
        categoryBasis: room.categoryBasis,
        heightM: room.heightM,
        purpose: patch.purpose === undefined ? room.purpose : patch.purpose,
        fireClasses: patch.fireClasses ?? room.fireClasses,
        hasSuppression: patch.hasSuppression ?? room.hasSuppression,
      })).then((result) => {
        if (result === null) return;
        if (!result.ok) { setMessage(result.error.message); return; }
        reloadRooms();
        /*
         * О записи говорится вслух.
         *
         * Сведения помещения сохраняются сразу, без общей кнопки, — а кнопка
         * «Сохранить» стоит тут же, под ними, и остаётся серой. Заказчик:
         * «при корректировке данных кнопка сохранить не активна». Так и есть,
         * и так и задумано: сохранять уже нечего. Но пока программа об этом
         * молчала, единственным её ответом на правку была неподвижная серая
         * кнопка — то есть ответ «ничего не произошло».
         */
        setMessage(`Сведения помещения «${room.name}» сохранены.`);
      });
    },

    createOrganization: async (name) => {
      const created = await runCommand('Создать организацию', () => run(() => createOrganization(treeDeps, { name })));
      if (created === null) return false;
      setSelectedId(created.id);
      return true;
    },

    addChild: (child, parentId) => {
      void runCommand('Создать узел дерева', () => run(() => createChildNode(treeDeps, {
        parentId,
        kind: child.kind,
        name: child.name,
        code: child.code,
        elevationM: child.elevationM,
      }))).then((created) => {
        if (created !== null) setSelectedId(created.id);
      });
    },

    saveNode: (fields) => {
      if (selected === null) return;
      void runCommand('Сохранить карточку узла', () => run(() => updateNode(treeDeps, {
        id: selected.id,
        name: fields.name,
        code: fields.code,
        elevationM: fields.elevationM,
        building: fields.building,
        expectedRowVersion: selected.rowVersion,
      })));
    },

    reorder: (id, targetId, placement) => {
      void runCommand('Изменить порядок узлов', () => run(() => reorderNodeAround(treeDeps, { id, targetId, placement })));
    },

    moveTo: (id, parentId) => {
      const node = nodes.find((candidate) => candidate.id === id);
      if (node === undefined) return;
      void runCommand('Перенести узел дерева', () => run(() => moveNode(treeDeps, {
        id,
        newParentId: parentId,
        expectedRowVersion: node.rowVersion,
      })));
    },

    toggleJournal: (include) => {
      if (selected === null) return;
      void runCommand('Изменить состав общего журнала', () => run(() => setInCommonJournal(treeDeps, { id: selected.id, include })));
    },

    archive: (id) => {
      const node = nodes.find((candidate) => candidate.id === id);
      if (node === undefined) return;
      const impact = archiveImpact(nodes, allRooms, allObjects, id);
      if (!confirmNodeArchive(node, impact)) return;

      void runCommand(
        'Вывести узел из эксплуатации',
        () => run(() => archiveHierarchy(hierarchyArchiveDeps, { id, expectedRowVersion: node.rowVersion })),
      ).then((result) => {
        if (result === null) return;
        setSelectedObjectId(null);
        /*
         * Выбор переводится наверх, если выведенный узел был выбран сам или
         * содержал выбранный: иначе правая часть экрана показывала бы карточку
         * того, чего в строю уже нет.
         */
        if (selectedId === id || descendantsOf(nodes, id).some((child) => child.id === selectedId)) {
          setSelectedId(node.parentId);
        }
        reloadRooms();
        reloadObjectLists();
      });
    },
  };
}
