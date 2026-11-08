/**
 * Состояние системы пожарной автоматики (ТЗ, Дополнение 6, часть С61).
 *
 * У прибора приёмно-контрольного два состояния, и путать их нельзя:
 *
 * * **своё** — исправен ли сам прибор и соблюдены ли его сроки;
 * * **системы целиком** — худшее по прибору и всем его извещателям,
 *   оповещателям, клапанам и модулям.
 *
 * Прибор может быть исправен, а система — нет: пятьдесят извещателей не
 * чищены, и «зелёный» прибор об этом молчит. Обратное тоже бывает: прибор снят
 * на ремонт, а шлейфы в порядке. Одно число на оба вопроса не отвечает, поэтому
 * их два.
 *
 * У остальных элементов автоматики состояние своё и только своё: извещатель не
 * краснеет из-за соседа по шлейфу — иначе на плане нельзя найти тот, который
 * действительно нужно обслужить.
 */

import type { IsoDate, MaintenanceEvent, PlanObject } from '@izh/contracts';
import { isSystemHead, systemMembers } from '../objects/fire-system.js';
import { placementCondition, type ObjectCondition } from './object-condition.js';
import { rulePackageSource, type ActivityScheduleSource } from './activity-source.js';

/** Оба состояния прибора: своё и по всей системе. */
export interface SystemCondition {
  /** Сам прибор — как отдельная единица оборудования. */
  readonly own: ObjectCondition;
  /** Прибор вместе со всем, что к нему подключено. */
  readonly whole: ObjectCondition;
  /** Сколько элементов в системе, не считая самого прибора. */
  readonly memberCount: number;
}

/** Насколько тревожно состояние: меньше — тревожнее. */
function rank(condition: ObjectCondition): number {
  const { color } = condition;
  return color === 'danger' ? 0 : color === 'warn' ? 1 : color === 'unknown' ? 2 : 3;
}

/**
 * Состояние прибора и его системы.
 *
 * `null` — объект не прибор: у остальных элементов второго состояния нет, и
 * рисовать им пустой второй значок значило бы обещать сведения, которых нет.
 */
export function systemCondition(
  object: PlanObject,
  allObjects: readonly PlanObject[],
  events: readonly MaintenanceEvent[],
  today: IsoDate,
  soonThresholdDays: number,
  source: ActivityScheduleSource = rulePackageSource,
): SystemCondition | null {
  if (!isSystemHead(object)) return null;

  const own = placementCondition(object, allObjects, events, today, soonThresholdDays, source);
  const members = systemMembers(allObjects, object.id);

  const whole = members.reduce((worst, member) => {
    const condition = placementCondition(member, allObjects, events, today, soonThresholdDays, source);
    return rank(condition) < rank(worst) ? condition : worst;
  }, own);

  return { own, whole, memberCount: members.length };
}
