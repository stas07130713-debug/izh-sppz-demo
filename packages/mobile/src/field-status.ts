/**
 * Состояние оборудования словами и цветом — для полевого помощника.
 *
 * Считает то же ядро, что и настольная программа: `objectCondition` по
 * записям журнала и регламенту. Второго расчёта сроков в проекте нет и быть не
 * должно — иначе телефон и настольная программа однажды скажут разное, и
 * человек не будет знать, чему верить.
 *
 * Здесь только показ: как назвать и каким цветом отметить.
 */

import type { MaintenanceEvent, PlanObject } from '@izh/contracts';
import { activityCellsForObject, objectCondition, type ActivityScheduleSource } from '@izh/core';

export type FieldColor = 'ok' | 'warn' | 'danger' | 'unknown';

export interface FieldStatus {
  readonly color: FieldColor;
  readonly label: string;
}

const COLOR_BY_CONDITION: Readonly<Record<string, FieldColor>> = {
  ok: 'ok', warn: 'warn', danger: 'danger', unknown: 'unknown',
};

export function fieldStatus(
  object: PlanObject,
  events: readonly MaintenanceEvent[],
  today: string,
  soonThresholdDays: number,
  source: ActivityScheduleSource,
): FieldStatus {
  const condition = objectCondition(object, events, today, soonThresholdDays, source);
  const color = COLOR_BY_CONDITION[condition.color] ?? 'unknown';

  /*
   * Показывается худшее из двух: срок и исправность.
   *
   * На обходе важно одно — надо ли этим заниматься сейчас. «Исправен» у
   * огнетушителя с просроченной на год перезарядкой обманул бы: в настольной
   * программе такую ошибку уже исправляли.
   */
  const label = condition.schedule === 'норма' ? condition.technical : condition.schedule;
  return { color, label };
}

/** Ближайший срок по оборудованию: что и когда предстоит. */
export interface NextWork {
  readonly title: string;
  readonly date: string | null;
  readonly daysLeft: number | null;
  readonly overdue: boolean;
}

export function nextWorks(
  object: PlanObject,
  events: readonly MaintenanceEvent[],
  today: string,
  soonThresholdDays: number,
  source: ActivityScheduleSource,
): readonly NextWork[] {
  return activityCellsForObject(object, events, today, soonThresholdDays, source)
    .map((cell) => ({
      title: cell.rule.title,
      date: cell.schedule.nextDate,
      daysLeft: cell.schedule.daysToNext,
      overdue: cell.schedule.status === 'просрочено',
    }))
    /*
     * Сначала просроченное, потом ближайшее. Работы без срока — в конец: по
     * ним ничего не назначено, и на обходе они не первоочередные.
     */
    .sort((a, b) => {
      if (a.date === null) return b.date === null ? 0 : 1;
      if (b.date === null) return -1;
      return a.date.localeCompare(b.date);
    });
}
