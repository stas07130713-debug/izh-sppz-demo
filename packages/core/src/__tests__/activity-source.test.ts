/**
 * Подстановка источника правил в журнал (ТЗ, Дополнение 5, части Р9, Р19).
 *
 * Главное, что здесь закрепляется, — переход на конструктор не должен ни
 * оборвать накопленную историю, ни изменить сроки тем, кто конструктором не
 * пользуется. Обе ошибки тихие: журнал по-прежнему открывается и выглядит
 * рабочим, просто показывает неправду, а его предъявляют при проверке МЧС.
 */

import { describe, expect, it } from 'vitest';
import type { MaintenanceEvent, PlanObject } from '@izh/contracts';
import { activityCellsForObject } from '../rules/activity-status.js';
import { rulePackageSource, type ActivityScheduleSource } from '../rules/activity-source.js';
import type { ActivityRule } from '../rules/rule-package.js';

const OBJECT: PlanObject = {
  id: 'obj-1',
  siteId: 'site-1',
  nodeId: 'node-1',
  typeCode: 'fire-hydrant-indoor',
  regNumber: null,
  model: null,
  manufacturer: null,
  serialNumber: null,
  commissionedOn: null,
  serviceLifeYears: null,
  serviceLifeMonths: null,
  responsible: null,
  technicalState: 'исправен',
  position: { x: 0, y: 0 },
  note: null,
  extinguisherProfile: null,
  archivedAt: null,
} as unknown as PlanObject;

function event(patch: Partial<MaintenanceEvent> & { readonly id: string }): MaintenanceEvent {
  return {
    siteId: 'site-1',
    objectId: 'obj-1',
    activityCode: 'osmotr',
    performedOn: '2026-01-10',
    result: 'выполнено',
    checklist: [],
    defect: null,
    executor: null,
    note: null,
    createdAt: '2026-01-10T09:00:00.000Z',
    ...patch,
  } as MaintenanceEvent;
}

/** Регламент организации: осмотр и контроль сведены в одну ежемесячную работу. */
const MERGED: ActivityRule = {
  activityCode: 'per-monthly',
  title: 'Ежемесячно',
  periodicityMonths: null,
  checklist: [],
  ndReference: 'Регламент организации',
  needsVerification: false,
  regulationVersionId: 'ver-1',
  periodicityId: 'per-monthly',
  historyCodes: ['osmotr', 'kontrol'],
};

const MERGED_SOURCE: ActivityScheduleSource = {
  rulesFor: () => [MERGED],
  nextDueOn: (_rule, lastPerformedOn) => (lastPerformedOn === null ? null : '2026-02-10'),
};

describe('источник правил для журнала', () => {
  it('по умолчанию считает по нормативной библиотеке — как до конструктора', () => {
    const withSource = activityCellsForObject(OBJECT, [], '2026-08-16', 14, rulePackageSource);
    const withoutSource = activityCellsForObject(OBJECT, [], '2026-08-16', 14);

    expect(withoutSource.map((cell) => cell.rule.activityCode)).toEqual(withSource.map((cell) => cell.rule.activityCode));
    expect(withoutSource.length).toBeGreaterThan(0);
  });

  it('подставленный источник задаёт и состав работ, и срок', () => {
    const events = [event({ id: 'e-1', periodicityId: 'per-monthly' })];

    const cells = activityCellsForObject(OBJECT, events, '2026-02-01', 14, MERGED_SOURCE);

    expect(cells).toHaveLength(1);
    expect(cells[0]?.schedule.nextDate).toBe('2026-02-10');
    expect(cells[0]?.schedule.status).toBe('скоро');
  });

  it('подхватывает записи, сделанные до конструктора, по старому коду мероприятия', () => {
    // У записи нет ни версии регламента, ни периодичности: её сделали раньше,
    // и переписать её задним числом нельзя (AGENTS.md, правило 10).
    const events = [event({ id: 'e-old', activityCode: 'kontrol', performedOn: '2026-01-05' })];

    const cells = activityCellsForObject(OBJECT, events, '2026-02-01', 14, MERGED_SOURCE);

    expect(cells[0]?.history.map((item) => item.id)).toEqual(['e-old']);
    expect(cells[0]?.schedule.status).not.toBe('нет данных');
  });

  it('не показывает одну запись дважды, если она подошла и по коду, и по периодичности', () => {
    const events = [event({ id: 'e-1', activityCode: 'osmotr', periodicityId: 'per-monthly' })];

    const cells = activityCellsForObject(OBJECT, events, '2026-02-01', 14, MERGED_SOURCE);

    expect(cells[0]?.history).toHaveLength(1);
  });

  it('сводит историю разных кодов в одну ленту, свежее — первым', () => {
    const events = [
      event({ id: 'e-old', activityCode: 'osmotr', performedOn: '2026-01-05' }),
      event({ id: 'e-new', activityCode: 'kontrol', performedOn: '2026-01-20' }),
    ];

    const cells = activityCellsForObject(OBJECT, events, '2026-02-01', 14, MERGED_SOURCE);

    expect(cells[0]?.history.map((item) => item.id)).toEqual(['e-new', 'e-old']);
  });

  it('срок «по необходимости» остаётся «нет данных», а не просрочкой', () => {
    const source: ActivityScheduleSource = { rulesFor: () => [MERGED], nextDueOn: () => null };

    const cells = activityCellsForObject(OBJECT, [event({ id: 'e-1' })], '2026-08-01', 14, source);

    expect(cells[0]?.schedule.status).toBe('нет данных');
    expect(cells[0]?.schedule.nextDate).toBeNull();
  });
});
