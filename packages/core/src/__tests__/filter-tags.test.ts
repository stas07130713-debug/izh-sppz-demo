/**
 * Плитка дашборда и отбор журнала считают одно и то же
 * (ТЗ, Дополнение 6, часть С72).
 *
 * Заказчик: «нажимаешь Неисправно — перекидывает на журнал, а там ничего нет и
 * неисправно 0». Причина: плитка считала неисправным всё, что требует ремонта,
 * а журнал — только настоящую поломку. «Требует ремонта» попадало у плитки в
 * «Неисправно», а в журнале значилось «Требует внимания».
 */

import { describe, expect, it } from 'vitest';
import type { MaintenanceEvent, PlanObject, TechnicalState } from '@izh/contracts';
import { conditionFilterTags, matchesFilterTags, type FilterTag } from '../rules/filter-tags.js';
import { objectCondition } from '../rules/object-condition.js';
import { dashboardSummary } from '../rules/dashboard-summary.js';
import type { ActivityScheduleSource } from '../rules/activity-source.js';

const TODAY = '2026-08-28';
const NO_EVENTS: readonly MaintenanceEvent[] = [];

function object(id: string, technicalState: TechnicalState): PlanObject {
  return {
    id, siteId: 'site', nodeId: 'этаж', typeCode: 'extinguisher-powder', regNumber: id,
    model: null, manufacturer: null, serialNumber: null, commissionedOn: '2026-01-01',
    responsible: null, roomId: null, position: { x: 1, y: 1 },
    technicalState, note: null, archivedAt: null,
    createdAt: '', updatedAt: '', rowVersion: 1,
  } as unknown as PlanObject;
}

/** Сроки соблюдены у всех: тревога может прийти только от исправности. */
const IN_TIME: ActivityScheduleSource = {
  rulesFor: () => [{
    activityCode: 'осмотр', title: 'Осмотр', periodicityMonths: 12,
    checklist: [], ndReference: 'ППР РФ №1479', needsVerification: false,
  }],
  nextDueOn: () => '2027-01-01',
};

const tagsOf = (state: TechnicalState): ReadonlySet<FilterTag> =>
  conditionFilterTags(objectCondition(object('o', state), NO_EVENTS, TODAY, 14, IN_TIME));

describe('метки состояния', () => {
  it('поломка даёт «неисправно»', () => {
    expect([...tagsOf('неисправен')]).toContain('неисправно');
    expect([...tagsOf('забракован')]).toContain('неисправно');
  });

  it('замечания и ремонт дают «требует внимания», а не «неисправно»', () => {
    // Так же красит значок на плане: это ещё не поломка. Плитка обязана
    // считать так же, иначе она обещает список, которого журнал не покажет.
    for (const state of ['исправен с замечаниями', 'требует ремонта', 'на ТО'] as const) {
      expect(`${state}: ${[...tagsOf(state)].join(', ')}`).toContain('скоро');
      expect([...tagsOf(state)]).not.toContain('неисправно');
    }
  });

  it('исправный при соблюдённых сроках — только «норма»', () => {
    expect([...tagsOf('исправен')]).toEqual(['норма']);
  });

  it('пустой отбор пропускает всех', () => {
    expect(matchesFilterTags(tagsOf('исправен'), new Set())).toBe(true);
  });
});

describe('плитки дашборда', () => {
  const objects = [
    object('о-1', 'исправен'),
    object('о-2', 'неисправен'),
    object('о-3', 'требует ремонта'),
    object('о-4', 'исправен с замечаниями'),
  ];

  const summary = dashboardSummary({
    objects, events: NO_EVENTS, today: TODAY, soonThresholdDays: 14,
    source: IN_TIME, typeCodes: null, levelObjects: objects,
  });

  it('число на плитке равно числу строк, которые покажет журнал', () => {
    for (const tag of ['норма', 'скоро', 'просрочено', 'неисправно', 'нет данных'] as const) {
      const inJournal = objects.filter((item) =>
        matchesFilterTags(
          conditionFilterTags(objectCondition(item, NO_EVENTS, TODAY, 14, IN_TIME)),
          new Set([tag]),
        )).length;
      expect(`${tag}: ${summary.tagCounts[tag]}`).toBe(`${tag}: ${inJournal}`);
    }
  });

  it('«неисправно» считает только поломку', () => {
    expect(summary.tagCounts['неисправно']).toBe(1);
  });

  it('замечания и ремонт попадают в «требует внимания»', () => {
    expect(summary.tagCounts['скоро']).toBe(2);
  });

  it('список ремонта совпадает с плиткой «Неисправно»', () => {
    // Иначе плитка ведёт в журнал на одно число, а список рядом показывает
    // другое — и непонятно, какому верить.
    expect(summary.broken).toHaveLength(summary.tagCounts['неисправно']);
  });
});
