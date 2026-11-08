/**
 * Число в уведомлении равно длине списка, который за ним стоит.
 *
 * Заказчик (пункт 12 перечня доработок): «показывается "В ближайшие 30 дней —
 * 1", но после нажатия ничего не открывается и соответствующей записи нет…
 * формировать количество уведомлений только по реально существующим событиям;
 * каждое число в счётчике должно соответствовать реальной записи; при нажатии
 * на категорию пользователь должен увидеть список соответствующих элементов».
 *
 * Расхождение было устроено так: счёт брался из перечня работ, сведённых в
 * пары «название плюс дата», а список показывался по метке состояния «скоро»,
 * которая считается по настроенному порогу. Порог короче тридцати дней — и
 * работа, до которой двадцать пять дней, попадала в счёт, но в список не
 * входила.
 *
 * Здесь проверяется, что перечень поимённый: у каждой записи есть сам элемент,
 * к которому можно перейти, и число записей от настройки порога не зависит.
 */

import { describe, expect, it } from 'vitest';
import type { PlanObject } from '@izh/contracts';
import { dashboardSummary } from '../rules/dashboard-summary.js';
import type { ActivityScheduleSource } from '../rules/activity-source.js';
import type { ActivityRule } from '../rules/rule-package.js';

const TODAY = '2026-08-26';

function object(id: string): PlanObject {
  return {
    id, siteId: 'site', nodeId: 'этаж-1', typeCode: 'extinguisher-powder', regNumber: id,
    model: null, manufacturer: null, serialNumber: null, commissionedOn: '2026-01-01',
    serviceLifeYears: null, responsible: null, roomId: null, position: { x: 1, y: 1 },
    technicalState: 'не определено', note: null, archivedAt: null,
    createdAt: '', updatedAt: '', rowVersion: 1,
  } as unknown as PlanObject;
}

const MONTHLY: ActivityRule = {
  activityCode: 'осмотр',
  title: 'Ежемесячный осмотр',
  periodicityMonths: 1,
  checklist: [],
  ndReference: 'ППР РФ №1479',
  needsVerification: false,
};

/** Срок задан прямо: проверяется отбор и подсчёт, а не расчёт дат. */
function sourceDue(next: string): ActivityScheduleSource {
  return { rulesFor: () => [MONTHLY], nextDueOn: () => next };
}

/** Срок через двадцать пять дней — дальше короткого порога «скоро». */
const IN_25_DAYS = sourceDue('2026-09-20');

describe('уведомления о ближайших сроках', () => {
  it('у каждой записи есть сам элемент и срок внутри тридцати дней', () => {
    const summary = dashboardSummary({
      objects: [object('ОП-1'), object('ОП-2')],
      events: [], today: TODAY, typeCodes: null, soonThresholdDays: 7, source: IN_25_DAYS,
    });

    expect(summary.upcomingItems.length).toBe(2);
    for (const item of summary.upcomingItems) {
      expect(item.object.regNumber, 'в записи должен быть сам элемент').toBeTruthy();
      expect(item.daysLeft).toBeGreaterThanOrEqual(0);
      expect(item.daysLeft).toBeLessThanOrEqual(30);
    }
  });

  it('короткий порог «скоро» перечню не мешает', () => {
    /*
     * Ровно тот случай, из-за которого требование и появилось: порог «скоро» —
     * три дня, а работа впереди дальше. Прежде она попадала в счётчик и
     * пропадала из списка; теперь она либо есть в обоих, либо нет ни в одном.
     */
    const short = dashboardSummary({
      objects: [object('ОП-1')], events: [], today: TODAY, typeCodes: null,
      soonThresholdDays: 3, source: IN_25_DAYS,
    });
    const long = dashboardSummary({
      objects: [object('ОП-1')], events: [], today: TODAY, typeCodes: null,
      soonThresholdDays: 30, source: IN_25_DAYS,
    });

    expect(short.upcomingItems.length).toBe(1);
    expect(short.upcomingItems.length).toBe(long.upcomingItems.length);
  });

  it('ближайшее впереди', () => {
    const summary = dashboardSummary({
      objects: [object('ОП-1'), object('ОП-2')],
      events: [], today: TODAY, typeCodes: null, soonThresholdDays: 7, source: IN_25_DAYS,
    });

    const days = summary.upcomingItems.map((item) => item.daysLeft);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
  });
});
