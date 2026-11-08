/**
 * Что элемент системы берёт от своего прибора (ТЗ, Дополнение 6).
 *
 * Наследуются две разные вещи, и по разным правилам.
 *
 * **Дата постановки на учёт — всему оборудованию системы.** Система пожарной
 * автоматики проектируется, монтируется и сдаётся целиком: у клапана
 * дымоудаления та же дата ввода, что у прибора, даже если куплен он у другого
 * изготовителя. Сорок дат, набранных вручную, разойдутся между собой, а от даты
 * считаются все регламентные сроки.
 *
 * **Изготовитель — только оборудованию адресной линии:** ДИП, ИПР, СОУЭ. Их
 * ставят одного изготовителя с прибором, потому что протокол линии у каждого
 * свой и чужой извещатель с прибором попросту не заработает. Клапан, вентилятор,
 * спринклер, модуль пожаротушения — самостоятельные изделия, их покупают
 * отдельно и у других изготовителей, и подставить им марку прибора значило бы
 * записать в карточку неправду.
 *
 * Поэтому изготовитель и дата постановки на учёт подставляются от прибора.
 * Своё значение элемента при этом главнее: извещатель, заменённый позже
 * остальных, имеет собственную дату, и подставленная затёрла бы её.
 *
 * Значения именно переписываются в карточку элемента, а не вычисляются на
 * лету. Так журнал, план и расчёт сроков видят одно и то же поле и не должны
 * знать про систему вовсе; а история замены остаётся у элемента, даже если
 * прибор потом заменят.
 */

import type { IsoDate, PlanObject, PlanObjectId, Result } from '@izh/contracts';
import { ok } from '@izh/contracts';
import type { ObjectDeps } from './object-deps.js';
import { isSystemHead, systemMembers } from './fire-system.js';

/**
 * Виды, берущие от прибора ещё и изготовителя: ДИП, ИПР, СОУЭ.
 *
 * Список закрыт намеренно и задан перечислением, а не выведен из «входит в
 * систему»: в систему входят и клапаны с вентиляторами, а у них свои
 * изготовители. Дата при этом наследуется всем — она про сдачу системы, а не
 * про поставщика.
 */
export const INHERITING_SYSTEM_TYPES: readonly string[] = [
  'smoke-detector', 'manual-call-point',
  'sounder', 'sounder-audible', 'sounder-speech', 'sounder-light', 'sounder-combined',
];

/** Берёт ли этот вид изготовителя от прибора системы. Дату берут все. */
export function inheritsFromSystem(typeCode: string): boolean {
  return INHERITING_SYSTEM_TYPES.includes(typeCode);
}

/** Поля, которые элемент системы получает от прибора при создании. */
export interface SystemDefaults {
  readonly manufacturer: string | null;
  readonly commissionedOn: IsoDate | null;
}

/** Что подставить новому элементу системы. */
export function systemDefaultsOf(head: PlanObject): SystemDefaults {
  return { manufacturer: head.manufacturer, commissionedOn: head.commissionedOn };
}

export interface PropagateSystemDefaultsInput {
  readonly headId: PlanObjectId;
  /** Значения прибора до правки: по ним отличают унаследованное от своего. */
  readonly previous: SystemDefaults;
}

/**
 * Разослать изменившиеся сведения прибора его элементам.
 *
 * Нужно потому, что порядок работы обратный ожидаемому: состав системы заводят
 * сразу после появления прибора, а его карточку заполняют потом. Без рассылки
 * сорок извещателей навсегда остались бы без изготовителя и без даты.
 *
 * Переписывается только унаследованное — пустое поле либо в точности прежнее
 * значение прибора. Элемент, у которого стоит своё, не трогается: это либо
 * замена, поставленная позже, либо извещатель другого изготовителя, и затирать
 * такое было бы враньём в учётной карточке.
 */
export async function propagateSystemDefaults(
  deps: ObjectDeps,
  input: PropagateSystemDefaultsInput,
): Promise<Result<readonly PlanObject[]>> {
  const head = await deps.objects.getById(input.headId);
  if (!head.ok) return head;
  if (!isSystemHead(head.value)) return ok([]);

  const next = systemDefaultsOf(head.value);
  if (next.manufacturer === input.previous.manufacturer && next.commissionedOn === input.previous.commissionedOn) {
    return ok([]);
  }

  const all = await deps.objects.list();
  if (!all.ok) return all;

  const now = deps.clock.nowUtc();
  const updated: PlanObject[] = [];
  for (const member of systemMembers(all.value, head.value.id)) {
    if (member.archivedAt !== null) continue;
    // Клапану и вентилятору изготовитель не рассылается: он у них свой, и
    // подставленный оказался бы неправдой в учётной карточке. Дата приходит
    // всем: систему сдают целиком.
    const inheritsManufacturer = inheritsFromSystem(member.typeCode)
      && (member.manufacturer === null || member.manufacturer === input.previous.manufacturer);
    const inheritsDate = member.commissionedOn === null || member.commissionedOn === input.previous.commissionedOn;
    if (!inheritsManufacturer && !inheritsDate) continue;

    const manufacturer = inheritsManufacturer ? next.manufacturer : member.manufacturer;
    const commissionedOn = inheritsDate ? next.commissionedOn : member.commissionedOn;
    if (manufacturer === member.manufacturer && commissionedOn === member.commissionedOn) continue;

    updated.push({ ...member, manufacturer, commissionedOn, updatedAt: now, rowVersion: member.rowVersion + 1 });
  }

  if (updated.length === 0) return ok([]);
  const saved = await deps.objects.saveMany(updated);
  if (!saved.ok) return saved;
  return ok(updated);
}
