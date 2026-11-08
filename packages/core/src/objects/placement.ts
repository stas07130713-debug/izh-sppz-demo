/**
 * Места хранения комплектов оборудования (ТЗ, Дополнение 6).
 *
 * Самоспасатели не расставляют по одному: на схеме одна точка — шкаф или полка,
 * а в ней пять штук. Ставить на план пять значков в одном месте бессмысленно,
 * они лягут друг на друга.
 *
 * Но учитывать их надо поштучно. У каждой штуки свой учётный и заводской номер,
 * свой срок службы по паспорту и своя строка в журнале: при замене одной из
 * пяти иначе неясно, какую именно заменили и когда истекает срок у остальных.
 *
 * Отсюда устройство: на плане стоит одна единица и представляет место, а
 * остальные ссылаются на неё. Отдельной сущности «место хранения» нет — у неё
 * были бы те же помещение и ответственный, что у самой единицы, и две записи об
 * одном разошлись бы при первой правке.
 */

import type { PlanObject, PlanObjectId } from '@izh/contracts';

/**
 * Виды оборудования, которые хранят комплектом.
 *
 * Пока один — самоспасатели. Список, а не признак в каталоге, потому что это
 * свойство не оборудования, а способа его размещения: тот же самоспасатель на
 * рабочем месте машиниста стоит поштучно.
 */
export const MULTI_UNIT_TYPES: readonly string[] = ['self-rescuer', 'self-rescuer-filter', 'self-rescuer-isolating'];

export function isMultiUnitType(typeCode: string): boolean {
  return MULTI_UNIT_TYPES.includes(typeCode);
}

/**
 * Единица, лежащая внутри места хранения.
 *
 * На плане такие не показываются никогда: место обозначено одной точкой, и
 * пять значков в одной комнате легли бы друг на друга. В журнале они, наоборот,
 * идут отдельными строками — учёт поштучный.
 *
 * Проверка нужна не только плану: в полосу «требуют размещения» единицы тоже
 * попадать не должны — они не ждут расстановки, их место уже определено.
 */
export function isPlacementUnit(object: PlanObject): boolean {
  return (object.placementId ?? null) !== null;
}

/** Объекты, которым место на плане: единицы комплектов исключены. */
export function placeableObjects(objects: readonly PlanObject[]): readonly PlanObject[] {
  return objects.filter((object) => !isPlacementUnit(object));
}

/**
 * Худшее состояние среди всего, что лежит в месте хранения.
 *
 * Точка на плане отвечает за весь комплект: если хоть один самоспасатель из
 * пяти просрочен, зелёный значок соврал бы. Поэтому берётся худшее — так же,
 * как состояние объекта берётся по худшей из его работ.
 */
export function worstOfPlacement<T>(
  objects: readonly PlanObject[],
  head: PlanObject,
  statusOf: (object: PlanObject) => T,
  worse: (a: T, b: T) => T,
): T {
  return placementContents(objects, head).map(statusOf).reduce(worse);
}

/** Единицы, лежащие в этом месте. Сама точка размещения в список не входит. */
export function placementUnits(
  objects: readonly PlanObject[],
  headId: PlanObjectId,
): readonly PlanObject[] {
  return objects.filter((object) => object.placementId === headId && object.archivedAt === null);
}

/**
 * Всё содержимое места: точка размещения и лежащие в ней единицы.
 *
 * Точка — такая же единица, как остальные: у неё свой номер и свой срок. Она
 * лишь дополнительно отмечена на плане.
 */
export function placementContents(
  objects: readonly PlanObject[],
  head: PlanObject,
): readonly PlanObject[] {
  return [head, ...placementUnits(objects, head.id)];
}

/** Место, к которому принадлежит единица. null — она сама место или лежит одна. */
export function placementOf(
  objects: readonly PlanObject[],
  object: PlanObject,
): PlanObject | null {
  const placementId = object.placementId ?? null;
  if (placementId === null) return null;
  return objects.find((item) => item.id === placementId) ?? null;
}

/** Сколько единиц в месте, считая саму точку размещения. */
export function placementCount(
  objects: readonly PlanObject[],
  head: PlanObject,
): number {
  return placementContents(objects, head).length;
}

/**
 * Является ли объект точкой размещения комплекта.
 *
 * Одиночная единица точкой не считается: подпись «(1 шт)» на плане только
 * загромождала бы схему.
 */
export function isPlacementHead(
  objects: readonly PlanObject[],
  object: PlanObject,
): boolean {
  if (!isMultiUnitType(object.typeCode)) return false;
  if ((object.placementId ?? null) !== null) return false;
  return placementUnits(objects, object.id).length > 0;
}
