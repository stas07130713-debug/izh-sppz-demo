/**
 * Кем можно заменить объект, поменявшись местами.
 *
 * Правило одно: та же настраиваемая группа. У огнетушителей вид дробный —
 * порошковый, углекислотный, воздушно-эмульсионный, — а подменный со склада
 * почти всегда другого вида, чем снимаемый. Список по точному виду показывал бы
 * пустоту там, где замена есть, — с этого и началась правка.
 *
 * Где группы нет (кран, извещатель без подвидов), сравнивается сам вид:
 * подменять кран извещателем — не замена, а другое оборудование.
 *
 * Выведенные из эксплуатации не предлагаются: их место в архиве, а не на стене.
 */

import type { PlanObject } from '@izh/contracts';
import { configurableFamily } from '@izh/core';

export function swapCandidates(
  object: PlanObject,
  all: readonly PlanObject[],
): readonly PlanObject[] {
  const family = configurableFamily(object.typeCode);

  const sameKind = (item: PlanObject): boolean => (family === null
    ? item.typeCode === object.typeCode
    : configurableFamily(item.typeCode) === family);

  return all.filter((item) => item.id !== object.id && item.archivedAt === null && sameKind(item));
}
