/**
 * Ограничения карточки оборудования (ТЗ, Дополнение 7, части А, В, Г, Д, Е).
 *
 * Проверяется то, что можно проверить по самим данным: даты жизненного цикла,
 * числовые величины паспорта, связи между элементами и уникальность учётных
 * номеров.
 *
 * Правильность нормативных сроков здесь не проверяется — это дело регламента.
 * Здесь только логика: изготовлено раньше, чем поставлено; минимум меньше
 * максимума; элемент не входит сам в себя.
 */

import type { PlanObject, TreeNode } from '@izh/contracts';
import { pathToNode } from '../object-tree/tree-shape.js';
import { forbid, isBefore, isCalendarDate, warn, type Problem } from './problem.js';

export interface ObjectConstraintContext {
  readonly nodes: readonly TreeNode[];
  /** Все объекты: нужны для связей и проверки повторов учётного номера. */
  readonly objects: readonly PlanObject[];
  /** Сегодняшняя дата: даты в будущем определяются относительно неё. */
  readonly today: string;
  /** Помещения: у каждого свой этаж (`levelId`). Нужны для проверки Е1. */
  readonly rooms?: readonly { readonly id: string; readonly levelId: string }[];
}

/** Все нарушения карточки: и запреты, и предупреждения. */
export function objectProblems(
  object: PlanObject,
  context: ObjectConstraintContext,
): readonly Problem[] {
  return [
    ...lifecycleDates(object, context.today),
    ...extinguisherNumbers(object),
    ...systemLinks(object, context),
    ...placementLinks(object, context),
    ...placementAndRoom(object, context),
  ];
}

/** А1–А6: даты жизненного цикла и срок службы. */
function lifecycleDates(object: PlanObject, today: string): readonly Problem[] {
  const problems: Problem[] = [];
  const made = object.extinguisherProfile?.manufacturedOn ?? null;
  const placed = object.commissionedOn ?? null;
  const recharged = object.extinguisherProfile?.lastRechargeOn ?? null;

  // А1. Изделия не бывает раньше, чем его изготовили.
  if (isCalendarDate(made) && isCalendarDate(placed) && isBefore(placed, made)) {
    problems.push(forbid(
      'Дата постановки на учёт раньше даты изготовления. Проверьте обе даты: от них считаются все сроки.',
      'commissionedOn',
    ));
  }

  // А2. Перезарядить можно только изготовленное. К дате постановки на учёт
  // перезарядка не привязана: изделие могли перезарядить до этого объекта.
  if (isCalendarDate(made) && isCalendarDate(recharged) && isBefore(recharged, made)) {
    problems.push(forbid('Дата перезарядки раньше даты изготовления.', 'lastRechargeOn'));
  }

  // А3–А4. Ни изготовление, ни перезарядка не происходят в будущем.
  if (isCalendarDate(made) && isBefore(today, made)) {
    problems.push(forbid('Дата изготовления в будущем.', 'manufacturedOn'));
  }
  if (isCalendarDate(recharged) && isBefore(today, recharged)) {
    problems.push(forbid('Дата перезарядки в будущем.', 'lastRechargeOn'));
  }

  // А5. Постановка на учёт будущим числом бывает законной: оборудование
  // закупили и заводят заранее. Поэтому не запрет, а вопрос.
  if (isCalendarDate(placed) && isBefore(today, placed)) {
    problems.push(warn(
      'Дата постановки на учёт в будущем. Так бывает при плановой установке — убедитесь, что это не опечатка.',
      'commissionedOn',
    ));
  }

  // А6. Срок службы: годы, а не месяцы и не опечатка в три знака.
  const years = object.serviceLifeYears ?? null;
  if (years !== null && (!Number.isInteger(years) || years < 1 || years > 50)) {
    problems.push(forbid('Срок службы указывается целым числом лет от 1 до 50.', 'serviceLifeYears'));
  }

  return problems;
}

/**
 * В1–В4: числовые величины паспорта огнетушителя.
 *
 * Это паспортные значения, а не результаты измерений. Измерения из чек-листа
 * не ограничиваются ничем: выход за допуск — и есть результат проверки, дефект,
 * и запрещать его ввод значило бы мешать записать неисправность.
 */
function extinguisherNumbers(object: PlanObject): readonly Problem[] {
  const profile = object.extinguisherProfile;
  if (profile === null || profile === undefined) return [];

  const problems: Problem[] = [];
  const { pressureMinMpa: min, nominalPressureMpa: nominal, pressureMaxMpa: max } = profile;

  if (min !== null && max !== null && min > max) {
    problems.push(forbid('Минимальное рабочее давление больше максимального.', 'pressureMinMpa'));
  }
  if (min !== null && nominal !== null && nominal < min) {
    problems.push(forbid('Номинальное давление ниже минимального рабочего.', 'nominalPressureMpa'));
  }
  if (max !== null && nominal !== null && nominal > max) {
    problems.push(forbid('Номинальное давление выше максимального рабочего.', 'nominalPressureMpa'));
  }

  if (profile.tareMassKg !== null && profile.nominalFullMassKg !== null
    && profile.tareMassKg >= profile.nominalFullMassKg) {
    problems.push(forbid(
      'Масса пустого корпуса не меньше полной массы. Полная масса включает заряд.',
      'tareMassKg',
    ));
  }

  if (profile.temperatureMinC !== null && profile.temperatureMaxC !== null
    && profile.temperatureMinC >= profile.temperatureMaxC) {
    problems.push(forbid('Нижняя температура применения не ниже верхней.', 'temperatureMinC'));
  }

  if (profile.nominalCharge !== null && profile.nominalCharge <= 0) {
    problems.push(forbid('Номинальный заряд должен быть больше нуля.', 'nominalCharge'));
  }

  return problems;
}

/** Г1–Г3: связи внутри системы пожарной автоматики. */
function systemLinks(object: PlanObject, context: ObjectConstraintContext): readonly Problem[] {
  const systemId = object.systemId ?? null;
  if (systemId === null) return [];

  const problems: Problem[] = [];
  if (systemId === object.id) {
    problems.push(forbid('Элемент не может входить сам в себя.', 'systemId'));
    return problems;
  }

  const head = context.objects.find((item) => item.id === systemId) ?? null;
  if (head === null) return problems;

  // Г2. Система — два уровня, а не дерево: прибор и его оборудование. Цепочка
  // «элемент → элемент → прибор» сделала бы состав неопределимым.
  if ((head.systemId ?? null) !== null) {
    problems.push(forbid(
      'Прибор системы сам входит в другую систему. Оборудование подключается к прибору напрямую.',
      'systemId',
    ));
  }

  // Г3. Система защищает своё здание; оборудование живёт в нём же.
  const own = buildingOf(context.nodes, object.nodeId);
  const headBuilding = buildingOf(context.nodes, head.nodeId);
  if (own !== null && headBuilding !== null && own !== headBuilding) {
    problems.push(forbid(
      'Оборудование системы находится в другом здании, чем её прибор.',
      'systemId',
    ));
  }

  return problems;
}

/** Д1–Д2: связи внутри места хранения комплекта. */
function placementLinks(object: PlanObject, context: ObjectConstraintContext): readonly Problem[] {
  const placementId = object.placementId ?? null;
  if (placementId === null) return [];

  if (placementId === object.id) {
    return [forbid('Единица не может быть местом хранения самой себя.', 'placementId')];
  }

  const head = context.objects.find((item) => item.id === placementId) ?? null;
  if (head === null) return [];

  const problems: Problem[] = [];
  // Д1. Два уровня: точка размещения и единицы в ней. Цепочка из единиц
  // сделала бы неопределимым, сколько всего штук в месте.
  if ((head.placementId ?? null) !== null) {
    problems.push(forbid('Единица комплекта не может быть местом хранения для другой.', 'placementId'));
  }
  // Д2. В одном месте лежит однотипное: иначе «5 шт» на плане ничего не значит.
  if (head.typeCode !== object.typeCode) {
    problems.push(forbid('В одном месте хранения учитывается оборудование одного вида.', 'placementId'));
  }

  return problems;
}

/** Е1–Е2: помещение и учётный номер. */
function placementAndRoom(object: PlanObject, context: ObjectConstraintContext): readonly Problem[] {
  const problems: Problem[] = [];

  // Е1. Помещение принадлежит тому же этажу: иначе объект числится в комнате
  // другого этажа, и найти его на плане невозможно.
  const roomId = object.roomId ?? null;
  if (roomId !== null && context.rooms !== undefined) {
    const room = context.rooms.find((item) => item.id === roomId) ?? null;
    if (room !== null && room.levelId !== object.nodeId) {
      problems.push(forbid('Выбранное помещение относится к другому этажу.', 'roomId'));
    }
  }

  // Е2. Повтор учётного номера — обычно опечатка, но бывает и намеренно: на
  // крупном объекте нумерацию ведут по цехам. Поэтому вопрос, а не запрет.
  const regNumber = (object.regNumber ?? '').trim();
  if (regNumber !== '') {
    const building = buildingOf(context.nodes, object.nodeId);
    const twin = context.objects.find((item) => item.id !== object.id
      && item.archivedAt === null
      && item.typeCode === object.typeCode
      && (item.regNumber ?? '').trim() === regNumber
      && buildingOf(context.nodes, item.nodeId) === building);

    if (twin !== undefined) {
      problems.push(warn(`Учётный номер «${regNumber}» уже есть у другого такого же элемента в этом здании.`, 'regNumber'));
    }
  }

  return problems;
}

/** Здание, которому принадлежит узел. null — узел вне здания. */
function buildingOf(nodes: readonly TreeNode[], nodeId: string): string | null {
  return pathToNode(nodes, nodeId).find((node) => node.kind === 'building')?.id ?? null;
}
