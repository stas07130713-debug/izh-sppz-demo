/**
 * Что уезжает на телефон обходчика.
 *
 * Заказчик: «должна быть привязка к учётной записи, и перенос по веб-приложению».
 *
 * Отсюда два правила, и оба здесь.
 *
 * **Снимок собирается под человека, а не «весь журнал».** Область прав в этой
 * программе задана деревом: выдали цех — доступны его здания и этажи. Телефон
 * не исключение: обходчику уезжает ровно то, до чего он дотягивается, и ни
 * узлом больше. Иначе перенос стал бы дырой в разграничении, которое остальная
 * программа соблюдает.
 *
 * **Выведенное из эксплуатации не уезжает вовсе.** Его нет: ни строкой, ни
 * обводкой, ни поводом для обхода. Тот же отбор, что на экране настольной
 * программы (часть С147).
 *
 * Здесь только отбор — ни сети, ни файлов, ни времени. Поэтому он проверяется
 * без сервера и телефона.
 */

import type {
  MaintenanceEvent, PlanObject, Room, TreeNode, UserAccount,
} from '@izh/contracts';
import { canReachNode } from '../access/permissions.js';

export interface FieldSnapshot {
  /** Когда снят: обходчик должен видеть, насколько свежи сроки. */
  readonly takenAt: string;
  /** Кому снят: подпись под записями обхода будет его. */
  readonly forUserId: string;
  readonly nodes: readonly TreeNode[];
  readonly objects: readonly PlanObject[];
  readonly rooms: readonly Room[];
  readonly events: readonly MaintenanceEvent[];
}

export interface SnapshotInput {
  readonly user: UserAccount;
  readonly at: string;
  readonly nodes: readonly TreeNode[];
  readonly objects: readonly PlanObject[];
  readonly rooms: readonly Room[];
  readonly events: readonly MaintenanceEvent[];
}

export function fieldSnapshot(input: SnapshotInput): FieldSnapshot {
  /*
   * Узлы отбираются дважды: сначала действующие, потом доступные.
   *
   * Порядок важен. Выведенный из эксплуатации узел недоступен никому, включая
   * администратора: доступ — про права, а вывод — про то, что узла больше нет.
   */
  const live = input.nodes.filter((node) => node.archivedAt === null);
  const nodes = live.filter((node) => canReachNode(input.user, node.id, live));
  const allowed = new Set(nodes.map((node) => node.id));

  const objects = input.objects.filter(
    (object) => object.archivedAt === null && allowed.has(object.nodeId),
  );
  const rooms = input.rooms.filter(
    (room) => room.archivedAt === null && allowed.has(room.levelId),
  );

  /*
   * Записи журнала — только по уехавшему оборудованию.
   *
   * По ним считаются сроки, и без них телефон показал бы «нет данных» там, где
   * проверка была. А записи чужого оборудования на обходе не нужны и незачем
   * им уезжать: чем меньше уехало, тем меньше потерь, если телефон потеряют.
   */
  const own = new Set(objects.map((object) => object.id));
  const events = input.events.filter((event) => own.has(event.objectId));

  return { takenAt: input.at, forUserId: input.user.id, nodes, objects, rooms, events };
}
