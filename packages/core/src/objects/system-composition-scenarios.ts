/**
 * Заведение состава системы пожарной автоматики (ТЗ, Дополнение 6).
 *
 * Пользователь ставит на план прибор, открывает его карточку и указывает, чего
 * и сколько в системе — **с указанием этажа**: на первом этаже семь дымовых
 * извещателей, на втором пять, ручных по два на каждом. Программа заводит
 * элементы; расставляет их на планах уже человек.
 *
 * Почему числами, а не по одному: в системе средних размеров сотня извещателей,
 * и заводить их по одному через карточку — работа на день. Числом это минута, а
 * дальше расстановка идёт мышью по плану.
 *
 * Почему этаж указывает пользователь, а не программа: программа не знает, где
 * на самом деле стоят извещатели. Разложенный поровну состав выглядел бы
 * достоверным, а был бы выдуманным, и человек стал бы искать датчик там, где
 * его нет.
 *
 * Элементы создаются без места на плане (`position: null`). Это не полуфабрикат:
 * такой элемент уже есть в журнале, у него своя карточка и свои сроки. На плане
 * он появится, когда его туда перетащат.
 */

import type { PlanObject, PlanObjectId, Result, TreeNode, TreeNodeId } from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { ObjectDeps } from './object-deps.js';
import { canJoinSystem, isSystemHead, systemFloors, systemMembers } from './fire-system.js';
import { inheritsFromSystem } from './system-inheritance.js';

export interface SystemCompositionItem {
  readonly typeCode: string;
  /** Этаж или иной узел, на котором стоит это оборудование. */
  readonly nodeId: TreeNodeId;
  /** Сколько элементов этого вида на этом этаже. */
  readonly count: number;
}

export interface SetSystemCompositionInput {
  readonly headId: PlanObjectId;
  readonly items: readonly SystemCompositionItem[];
  /** Дерево нужно, чтобы проверить: указанные этажи принадлежат зданию прибора. */
  readonly nodes: readonly TreeNode[];
}

export interface SystemCompositionResult {
  readonly created: readonly PlanObject[];
  /** Элементы, которые пользователь убрал из состава: выводятся из эксплуатации. */
  readonly archived: readonly PlanObject[];
}

/**
 * Приводит состав системы к указанным числам.
 *
 * Больше стало — заводятся новые элементы на указанном этаже. Меньше — лишние
 * выводятся из эксплуатации пометкой, а не удаляются: по ним могли уже пройти
 * проверки, и записи журнала на них ссылаются (AGENTS.md, правило 10).
 * Выводятся при этом те, что заведены позже и ещё не размещены на плане:
 * расставленный вручную элемент трогать нельзя, за ним стоит работа человека.
 */
export async function setSystemComposition(
  deps: ObjectDeps,
  input: SetSystemCompositionInput,
): Promise<Result<SystemCompositionResult>> {
  const head = await deps.objects.getById(input.headId);
  if (!head.ok) return head;
  if (!isSystemHead(head.value)) {
    return err('INVALID_ARGUMENT', 'Состав задаётся у прибора приёмно-контрольного: он и есть система.');
  }
  if (head.value.archivedAt !== null) {
    return err('INVALID_ARGUMENT', 'Прибор выведен из эксплуатации, состав его системы не меняется.');
  }

  const allowedFloors = new Set(systemFloors(input.nodes, head.value).map((node) => node.id));
  if (allowedFloors.size === 0) {
    return err('INVALID_ARGUMENT', 'У прибора не определено здание, в котором заводить оборудование системы.');
  }

  for (const item of input.items) {
    if (!canJoinSystem(item.typeCode)) {
      return err('INVALID_ARGUMENT', `Оборудование «${item.typeCode}» не входит в систему пожарной автоматики.`);
    }
    if (!allowedFloors.has(item.nodeId)) {
      return err('INVALID_ARGUMENT', 'Оборудование системы заводится только на этажах того здания, где стоит прибор.');
    }
    if (!Number.isInteger(item.count) || item.count < 0) {
      return err('INVALID_ARGUMENT', 'Количество элементов должно быть целым неотрицательным числом.');
    }
  }

  const all = await deps.objects.list();
  if (!all.ok) return all;

  const existing = systemMembers(all.value, head.value.id);
  const now = deps.clock.nowUtc();
  const created: PlanObject[] = [];
  const archived: PlanObject[] = [];

  // Номера продолжаются сквозь всю систему, а не начинаются заново на каждом
  // этаже: два разных извещателя с номером «1» в одной системе не различить.
  let nextNumber = existing.length;

  for (const item of input.items) {
    const own = existing.filter(
      (object) => object.typeCode === item.typeCode && object.nodeId === item.nodeId,
    );

    if (item.count > own.length) {
      for (let index = 0; index < item.count - own.length; index += 1) {
        nextNumber += 1;
        created.push(makeMember({
          deps, head: head.value, typeCode: item.typeCode, nodeId: item.nodeId, number: nextNumber, now,
        }));
      }
      continue;
    }

    if (item.count < own.length) {
      // Убираются сперва не размещённые на плане и заведённые последними:
      // за расставленным вручную элементом стоит работа человека.
      const removable = [...own]
        .filter((object) => object.position === null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const extra = own.length - item.count;
      if (removable.length < extra) {
        return err(
          'INVALID_ARGUMENT',
          `Нельзя уменьшить количество: из ${own.length} элементов ${own.length - removable.length} уже размещены на плане. Снимите лишние с плана вручную.`,
        );
      }
      archived.push(...removable.slice(0, extra).map((object) => ({
        ...object,
        archivedAt: now,
        updatedAt: now,
        rowVersion: object.rowVersion + 1,
      })));
    }
  }

  // Строки, которых пользователь не прислал вовсе, состава не меняют: он мог
  // править один этаж и не должен потерять оборудование на других.
  if (created.length === 0 && archived.length === 0) return ok({ created: [], archived: [] });

  const saved = await deps.objects.saveMany([...created, ...archived]);
  if (!saved.ok) return saved;
  return ok({ created, archived });
}

interface MakeMemberInput {
  readonly deps: ObjectDeps;
  readonly head: PlanObject;
  readonly typeCode: string;
  readonly nodeId: TreeNodeId;
  readonly number: number;
  readonly now: string;
}

function makeMember(input: MakeMemberInput): PlanObject {
  return {
    id: input.deps.ids.newId(),
    siteId: input.head.siteId,
    nodeId: input.nodeId,
    typeCode: input.typeCode,
    // Номер предварительный и человеку понятный: он видит, что элемент заведён
    // составом, а не расставлен поштучно, и переименует его при обходе.
    regNumber: `${input.number}`,
    model: null,
    // Изготовитель — только у оборудования адресной линии: ДИП, ИПР, СОУЭ
    // (Дополнение 6). У клапана и вентилятора он свой, и подставленный
    // оказался бы неправдой в карточке.
    manufacturer: inheritsFromSystem(input.typeCode) ? input.head.manufacturer : null,
    serialNumber: null,
    // Дата — всем: систему проектируют, монтируют и сдают целиком.
    commissionedOn: input.head.commissionedOn,
    serviceLifeYears: null,
    responsible: input.head.responsible,
    extinguisherProfile: null,
    systemId: input.head.id,
    suppressionProfile: null,
    roomId: null,
    // Места на плане нет: элемент заведён числом, ставит его человек.
    position: null,
    technicalState: 'не определено',
    note: null,
    archivedAt: null,
    createdAt: input.now,
    updatedAt: input.now,
    rowVersion: 1,
  };
}
