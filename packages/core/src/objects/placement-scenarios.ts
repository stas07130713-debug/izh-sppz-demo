/**
 * Заведение единиц в месте хранения (ТЗ, Дополнение 6).
 *
 * Пользователь ставит на план одну точку — шкаф с самоспасателями — и указывает
 * в карточке, сколько их там. Программа заводит недостающие; каждая получает
 * свой учётный номер и живёт дальше самостоятельно: своя карточка, свой срок
 * службы, своя строка в журнале.
 *
 * Убрать единицу можно только пометкой о выводе из эксплуатации: по ней могли
 * пройти проверки, а записи журнала не удаляются (AGENTS.md, правило 10).
 */

import type { PlanObject, PlanObjectId, Result } from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { ObjectDeps } from './object-deps.js';
import { isMultiUnitType, placementUnits } from './placement.js';

export interface SetPlacementCountInput {
  readonly headId: PlanObjectId;
  /** Сколько единиц должно быть в месте, считая саму точку размещения. */
  readonly count: number;
}

export interface PlacementResult {
  readonly created: readonly PlanObject[];
  readonly archived: readonly PlanObject[];
}

/**
 * Приводит число единиц в месте к указанному.
 *
 * Считается вместе с точкой размещения: пользователь говорит «здесь пять
 * самоспасателей», а не «здесь один плюс четыре». Меньше единицы быть не может
 * — сама точка и есть единица.
 */
export async function setPlacementCount(
  deps: ObjectDeps,
  input: SetPlacementCountInput,
): Promise<Result<PlacementResult>> {
  const head = await deps.objects.getById(input.headId);
  if (!head.ok) return head;

  if (!isMultiUnitType(head.value.typeCode)) {
    return err('INVALID_ARGUMENT', 'Это оборудование комплектом не хранится: каждая единица ставится на план отдельно.');
  }
  if ((head.value.placementId ?? null) !== null) {
    return err('INVALID_ARGUMENT', 'Количество задаётся у той единицы, что стоит на плане и представляет место хранения.');
  }
  if (head.value.archivedAt !== null) {
    return err('INVALID_ARGUMENT', 'Место хранения выведено из эксплуатации, состав его не меняется.');
  }
  if (!Number.isInteger(input.count) || input.count < 1) {
    return err('INVALID_ARGUMENT', 'В месте хранения должна быть хотя бы одна единица.');
  }

  const all = await deps.objects.list();
  if (!all.ok) return all;

  const units = placementUnits(all.value, head.value.id);
  // Точка размещения считается вместе с остальными: она такая же единица.
  const current = units.length + 1;
  const now = deps.clock.nowUtc();

  if (input.count === current) return ok({ created: [], archived: [] });

  if (input.count > current) {
    const created: PlanObject[] = [];
    for (let index = 0; index < input.count - current; index += 1) {
      created.push(makeUnit(deps, head.value, current + index + 1, now));
    }
    const saved = await deps.objects.saveMany(created);
    if (!saved.ok) return saved;
    return ok({ created, archived: [] });
  }

  // Убираются заведённые последними: у ранних уже может быть история проверок.
  const extra = current - input.count;
  const removable = [...units].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, extra);
  if (removable.length < extra) {
    return err('INVALID_ARGUMENT', 'Нельзя убрать точку размещения: она отмечена на плане. Снимите её с плана отдельно.');
  }

  const archived = removable.map((object) => ({
    ...object,
    archivedAt: now,
    updatedAt: now,
    rowVersion: object.rowVersion + 1,
  }));
  const saved = await deps.objects.saveMany(archived);
  if (!saved.ok) return saved;
  return ok({ created: [], archived });
}

/** Новая единица комплекта: место и ответственный те же, остальное своё. */
function makeUnit(deps: ObjectDeps, head: PlanObject, number: number, now: string): PlanObject {
  return {
    id: deps.ids.newId(),
    siteId: head.siteId,
    nodeId: head.nodeId,
    typeCode: head.typeCode,
    // Номер предварительный: при обходе его заменят на тот, что на изделии.
    regNumber: head.regNumber === null ? `${number}` : `${head.regNumber}-${number}`,
    model: null,
    manufacturer: null,
    serialNumber: null,
    // Дата берётся у точки размещения: комплект завели одновременно, и без
    // даты новая единица навсегда осталась бы «нет данных», а вместе с ней и
    // всё место — оно показывает худшее из состояний своих единиц.
    commissionedOn: head.commissionedOn,
    serviceLifeYears: head.serviceLifeYears ?? null,
    responsible: null,
    extinguisherProfile: null,
    hydrantProfile: null,
    systemId: null,
    suppressionProfile: null,
    placementId: head.id,
    roomId: head.roomId,
    // На плане не показывается: место обозначено одной точкой.
    position: null,
    technicalState: 'не определено',
    note: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    rowVersion: 1,
  };
}
