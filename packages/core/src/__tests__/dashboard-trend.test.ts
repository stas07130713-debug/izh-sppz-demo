/**
 * Динамика состояния (ТЗ, Дополнение 6, часть С99).
 *
 * Проверяется то, что нельзя увидеть глазами на готовом графике: что прошлое
 * считается по записям, известным **на ту дату**, а не по всем сразу. Ошибка
 * здесь рисует ровную зелёную линию там, где месяц была просрочка, и выглядит
 * при этом правдоподобно.
 */

import { describe, expect, it } from 'vitest';
import type { MaintenanceEvent, PlanObject } from '@izh/contracts';
import { dashboardTrend } from '../rules/dashboard-trend.js';
import type { ActivityScheduleSource } from '../rules/activity-source.js';
import type { ActivityRule } from '../rules/rule-package.js';

const TODAY = '2026-08-26';

function object(id: string, createdAt: string): PlanObject {
  return {
    id, siteId: 'site', nodeId: 'этаж-1', typeCode: 'extinguisher-powder', regNumber: id,
    model: null, manufacturer: null, serialNumber: null, commissionedOn: '2026-01-01',
    serviceLifeYears: null, responsible: null, roomId: null, position: { x: 1, y: 1 },
    technicalState: 'не определено', note: null, archivedAt: null,
    createdAt, updatedAt: createdAt, rowVersion: 1,
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

/** Срок — ровно месяц от последней проверки; без проверок срока нет. */
const SOURCE: ActivityScheduleSource = {
  rulesFor: () => [MONTHLY],
  nextDueOn: (_rule, lastPerformedOn) => {
    if (lastPerformedOn === null) return null;
    const at = new Date(`${lastPerformedOn}T00:00:00.000Z`);
    at.setUTCMonth(at.getUTCMonth() + 1);
    return at.toISOString().slice(0, 10);
  },
};

function event(objectId: string, performedOn: string): MaintenanceEvent {
  return {
    id: `${objectId}-${performedOn}`, siteId: 'site', objectId, activityCode: 'осмотр',
    performedOn, performerName: 'Иванов', result: 'исправно', checklist: [], note: null,
    createdAt: performedOn, rowVersion: 1,
  } as unknown as MaintenanceEvent;
}

const base = {
  today: TODAY, soonThresholdDays: 14, source: SOURCE, days: 60, stepDays: 30,
};

describe('точки графика', () => {
  it('последняя точка — всегда сегодня', () => {
    const points = dashboardTrend({ ...base, objects: [object('ОП-1', '2026-01-01')], events: [], days: 61, stepDays: 30 });
    expect(points[points.length - 1]?.date).toBe(TODAY);
  });

  it('первая точка отстоит от сегодня на заданное число дней', () => {
    const points = dashboardTrend({ ...base, objects: [object('ОП-1', '2026-01-01')], events: [] });
    expect(points[0]?.date).toBe('2026-06-27');
  });

  it('без элементов график пустой, а не череда нулей', () => {
    expect(dashboardTrend({ ...base, objects: [], events: [] })).toEqual([]);
  });
});

describe('взгляд на прошлое', () => {
  /*
   * Главная проверка файла. Проверка проведена 20 августа; 27 июня о ней ещё
   * никто не знал, и на ту дату элемент был просрочен.
   */
  it('запись не чинит прошлое задним числом', () => {
    const points = dashboardTrend({
      ...base,
      objects: [object('ОП-1', '2026-01-01')],
      events: [event('ОП-1', '2026-08-20')],
    });

    const first = points[0];
    const last = points[points.length - 1];
    expect(first?.date).toBe('2026-06-27');
    // На 27 июня о проверке 20 августа знать было неоткуда: срок считался от
    // даты постановки на учёт и был к тому дню давно просрочен.
    expect(first?.counts['просрочено']).toBe(1);
    expect(last?.counts['норма']).toBe(1);
  });

  it('элемент, заведённый позже даты, в счёт этой даты не идёт', () => {
    const points = dashboardTrend({
      ...base,
      objects: [object('ОП-1', '2026-01-01'), object('ОП-2', '2026-08-10T09:00:00.000Z')],
      events: [],
    });

    const first = points[0];
    const last = points[points.length - 1];
    const sum = (point: (typeof points)[number] | undefined): number =>
      point === undefined ? -1 : Object.values(point.counts).reduce((a, b) => a + b, 0);

    expect(sum(first)).toBe(1);
    expect(sum(last)).toBe(2);
  });

  it('состояния каждой точки складываются в число элементов на эту дату', () => {
    const objects = [object('ОП-1', '2026-01-01'), object('ОП-2', '2026-01-01'), object('ОП-3', '2026-01-01')];
    const points = dashboardTrend({ ...base, objects, events: [event('ОП-1', '2026-08-20')] });

    for (const point of points) {
      const sum = Object.values(point.counts).reduce((a, b) => a + b, 0);
      expect(sum).toBe(3);
    }
  });
});
