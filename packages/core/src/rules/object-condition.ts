/**
 * Один цвет состояния для всей программы.
 *
 * Состояний у оборудования два, и они независимы: регламентное (сроки работ,
 * считает программа) и техническое (исправность, ставит человек по результату
 * проверки). Значок на плане показывал оба сразу — красная точка и от
 * просрочки, и от неисправности, — а полоса карточки только регламентное.
 * Отсюда и расхождение, на которое жаловался заказчик: значок красный,
 * карточка зелёная, и непонятно, какому месту верить.
 *
 * Здесь правило записано один раз, и все экраны берут его отсюда. Цвет
 * возвращается цветом, а не состоянием: «неисправен» — это не «просрочено», и
 * подменять одно другим значило бы врать в подписи ради общей раскраски.
 *
 * Техническое состояние может только ухудшить цвет, но не улучшить: «исправен»
 * не красит просроченный элемент в зелёный. Иначе отметка исправности при
 * осмотре гасила бы пропущенную перезарядку.
 */

import type { MaintenanceEvent, PlanObject, IsoDate, TechnicalState } from '@izh/contracts';
import { worstOfPlacement } from '../objects/placement.js';
import { technicalStateForObject, worstPlacementStatus } from './activity-status.js';
import type { ScheduleStatus } from './schedule.js';
import { rulePackageSource, type ActivityScheduleSource } from './activity-source.js';

/** Цвет индикатора: спокойный, внимание, тревога, нечем судить. */
export type ConditionColor = 'ok' | 'warn' | 'danger' | 'unknown';

export interface ObjectCondition {
  /** Состояние по срокам работ. */
  readonly schedule: ScheduleStatus;
  /** Исправность по последней проверке. */
  readonly technical: TechnicalState;
  /** Чем красить значок и полосу карточки. */
  readonly color: ConditionColor;
}

const SCHEDULE_COLOR: Readonly<Record<ScheduleStatus, ConditionColor>> = {
  'норма': 'ok',
  'скоро': 'warn',
  'просрочено': 'danger',
  'нет данных': 'unknown',
};

/**
 * Насколько техническое состояние обязано ухудшить цвет.
 *
 * null — не обязано ничем: «исправен» и «не определено» ничего не сообщают
 * сверх сроков, и цвет остаётся тем, что дали сроки. По этому же признаку
 * экраны решают, показывать ли исправность отдельной подписью: молчаливое
 * состояние подписывать незачем, тревожное — обязательно, иначе непонятно,
 * почему значок красный.
 */
export function technicalEscalation(state: TechnicalState): ConditionColor | null {
  if (state === 'неисправен' || state === 'забракован') return 'danger';
  if (state === 'исправен с замечаниями' || state === 'требует ремонта' || state === 'на ТО') return 'warn';
  return null;
}

/** Какой из двух цветов тревожнее. «Нет данных» тревожнее спокойного: судить не по чему. */
function worseColor(a: ConditionColor, b: ConditionColor): ConditionColor {
  const rank = (color: ConditionColor): number =>
    color === 'danger' ? 0 : color === 'warn' ? 1 : color === 'unknown' ? 2 : 3;
  return rank(a) <= rank(b) ? a : b;
}

/** Худшее из двух технических состояний — по тому же порядку тревожности. */
function worseTechnical(a: TechnicalState, b: TechnicalState): TechnicalState {
  const rank = (state: TechnicalState): number => {
    const escalation = technicalEscalation(state);
    if (escalation === 'danger') return 0;
    if (escalation === 'warn') return 1;
    return state === 'не определено' ? 2 : 3;
  };
  return rank(a) <= rank(b) ? a : b;
}

/**
 * Состояние места хранения целиком: и сроки, и исправность берутся по худшей
 * единице комплекта (ТЗ, Дополнение 6).
 *
 * Раньше по комплекту усреднялись только сроки, а исправность бралась у самой
 * точки: один неисправный самоспасатель из пяти не красил значок, хотя в
 * карточке комплекта был виден. Для обычного объекта комплект состоит из него
 * одного, и функция возвращает его собственное состояние.
 */
export function placementCondition(
  object: PlanObject,
  allObjects: readonly PlanObject[],
  events: readonly MaintenanceEvent[],
  today: IsoDate,
  soonThresholdDays: number,
  source: ActivityScheduleSource = rulePackageSource,
): ObjectCondition {
  const schedule = worstPlacementStatus(object, allObjects, events, today, soonThresholdDays, source);
  const technical = worstOfPlacement(
    allObjects,
    object,
    (item) => technicalStateForObject(item, events),
    worseTechnical,
  );
  return { schedule, technical, color: conditionColor(schedule, technical) };
}

/**
 * Состояние одного объекта, без оглядки на комплект.
 *
 * Нужно журналу: там строка заводится на каждую единицу отдельно, и строка
 * исправного самоспасателя не должна краснеть из-за соседнего по шкафу.
 * План, наоборот, показывает место целиком и берёт `placementCondition`.
 */
export function objectCondition(
  object: PlanObject,
  events: readonly MaintenanceEvent[],
  today: IsoDate,
  soonThresholdDays: number,
  source: ActivityScheduleSource = rulePackageSource,
): ObjectCondition {
  return placementCondition(object, [object], events, today, soonThresholdDays, source);
}

/** Цвет по паре состояний. Вынесен отдельно: журнал считает состояния сам, по колонкам. */
export function conditionColor(schedule: ScheduleStatus, technical: TechnicalState): ConditionColor {
  const escalation = technicalEscalation(technical);
  const base = scheduleColor(schedule);
  return escalation === null ? base : worseColor(base, escalation);
}


/** Цвет по состоянию сроков. Соответствие взаимно однозначное: цвет читается обратно в состояние. */
function scheduleColor(status: ScheduleStatus): ConditionColor {
  return SCHEDULE_COLOR[status] ?? 'unknown';
}
