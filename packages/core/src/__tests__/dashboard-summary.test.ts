/**
 * Сводка дашборда (ТЗ, Дополнение 6, часть С49).
 *
 * Главное правило заказчика: показанное = уровень объекта + выбранные системы.
 * Здесь проверяется именно оно, потому что ошибка тут не видна: цифра на
 * плитке выглядит правдоподобно при любом отборе.
 */

import { describe, expect, it } from 'vitest';
import type { MaintenanceEvent, PlanObject } from '@izh/contracts';
import { dashboardScope, dashboardSummary } from '../rules/dashboard-summary.js';
import type { ActivityScheduleSource } from '../rules/activity-source.js';
import type { ActivityRule } from '../rules/rule-package.js';

const TODAY = '2026-08-26';

function object(id: string, typeCode: string, extra: Partial<PlanObject> = {}): PlanObject {
  return {
    id, siteId: 'site', nodeId: 'этаж-1', typeCode, regNumber: id,
    model: null, manufacturer: null, serialNumber: null, commissionedOn: '2026-01-01',
    serviceLifeYears: null, responsible: null, roomId: null, position: { x: 1, y: 1 },
    technicalState: 'не определено', note: null, archivedAt: null,
    createdAt: '', updatedAt: '', rowVersion: 1,
    ...extra,
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

/**
 * Источник правил с заданным сроком.
 *
 * Настоящий здесь не нужен: проверяется отбор и подсчёт, а не расчёт дат, — у
 * него свои тесты. Задавая срок прямо, тест не зависит от библиотеки правил.
 */
function sourceDue(nextByObject: Readonly<Record<string, string | null>>): ActivityScheduleSource {
  return {
    rulesFor: () => [MONTHLY],
    nextDueOn: (_rule, lastPerformedOn) => nextByObject[lastPerformedOn ?? ''] ?? null,
  };
}

/** Все элементы «в норме»: срок далеко впереди. */
const FAR = sourceDue({ '2026-01-01': '2027-01-01' });
/** Все элементы просрочены на месяц. */
const LATE = sourceDue({ '2026-01-01': '2026-07-26' });

const OBJECTS: readonly PlanObject[] = [
  object('ОП-1', 'extinguisher-powder'),
  object('ОП-2', 'extinguisher-powder'),
  object('ОУ-1', 'extinguisher-co2'),
  object('ПК-1', 'fire-hydrant-indoor', { nodeId: 'этаж-2' }),
];

const NO_EVENTS: readonly MaintenanceEvent[] = [];

const base = {
  objects: OBJECTS, events: NO_EVENTS, today: TODAY, soonThresholdDays: 14, source: FAR,
};

describe('отбор систем', () => {
  it('без отбора считаются все системы уровня', () => {
    expect(dashboardScope({ ...base, typeCodes: null })).toHaveLength(4);
    expect(dashboardSummary({ ...base, typeCodes: null }).total).toBe(4);
  });

  it('одна система — только она', () => {
    const summary = dashboardSummary({ ...base, typeCodes: new Set(['extinguisher-powder']) });
    expect(summary.total).toBe(2);
    expect(summary.byType.map((item) => item.typeCode)).toEqual(['extinguisher-powder']);
  });

  it('несколько систем — только они, сложенные вместе', () => {
    const summary = dashboardSummary({
      ...base,
      typeCodes: new Set(['extinguisher-powder', 'fire-hydrant-indoor']),
    });
    expect(summary.total).toBe(3);
    expect(summary.byType.map((item) => item.typeCode).sort()).toEqual(
      ['extinguisher-powder', 'fire-hydrant-indoor'],
    );
  });

  it('ни одной системы — честные нули, а не всё подряд', () => {
    // Пустой отбор и «все системы» — разные вещи. Сняв все галочки, человек
    // должен увидеть, что показывать нечего, а не полный дашборд.
    const summary = dashboardSummary({ ...base, typeCodes: new Set() });
    expect(summary.total).toBe(0);
    expect(summary.byType).toEqual([]);
    expect(summary.overdue).toEqual([]);
  });
});

describe('счёт по элементам', () => {
  it('состояния складываются в общее число элементов', () => {
    const summary = dashboardSummary({ ...base, typeCodes: null });
    const sum = Object.values(summary.counts).reduce((total, value) => total + value, 0);
    expect(sum).toBe(summary.total);
  });

  it('просроченные работы попадают в список с числом дней', () => {
    const summary = dashboardSummary({ ...base, source: LATE, typeCodes: null });
    expect(summary.overdue).toHaveLength(4);
    expect(summary.overdue[0]?.activityTitle).toBe('Ежемесячный осмотр');
    expect(summary.overdue[0]?.daysLate).toBeGreaterThan(0);
  });

  it('неисправность считается отдельно от сроков', () => {
    // Элемент может быть проверен вовремя и признан неисправным: смешивать
    // это со сроком значило бы прятать поломку за зелёной плиткой.
    const summary = dashboardSummary({
      ...base,
      objects: [object('ОП-3', 'extinguisher-powder', { technicalState: 'неисправен' })],
      typeCodes: null,
    });
    expect(summary.counts['норма']).toBe(1);
    expect(summary.broken).toHaveLength(1);
    expect(summary.broken[0]?.state).toBe('неисправен');
  });

  it('неразмещённые считаются отдельно', () => {
    const summary = dashboardSummary({
      ...base,
      objects: [object('ОП-4', 'extinguisher-powder', { position: null })],
      typeCodes: null,
    });
    expect(summary.unplaced).toBe(1);
  });

  it('места разложены по узлам и отсортированы по тревожности', () => {
    const summary = dashboardSummary({ ...base, source: LATE, typeCodes: null });
    const ids = summary.byPlace.map((place) => place.nodeId);
    expect(ids).toContain('этаж-1');
    expect(ids).toContain('этаж-2');
    // На первом этаже трое просроченных, на втором один — он и идёт первым.
    expect(ids[0]).toBe('этаж-1');
  });
});

describe('системы пожарной автоматики', () => {
  const panel = object('ППКУ-1', 'control-panel');
  const detector = object('ИПД-1', 'smoke-detector', { systemId: 'ППКУ-1' });
  const broken = object('ИПД-2', 'smoke-detector', { systemId: 'ППКУ-1', technicalState: 'неисправен' });

  it('у прибора два состояния: своё и по всей системе', () => {
    const summary = dashboardSummary({
      ...base, objects: [panel, detector, broken], typeCodes: null,
    });

    expect(summary.systems).toHaveLength(1);
    expect(summary.systems[0]?.condition.own.color).toBe('ok');
    expect(summary.systems[0]?.condition.whole.color).toBe('danger');
    expect(summary.systems[0]?.condition.memberCount).toBe(2);
  });

  it('состояние системы не зависит от отбора справа', () => {
    // Снятая галочка «извещатели» решает, что показать, а не что исправно:
    // иначе система становилась бы благополучной от нажатия на галочку.
    const summary = dashboardSummary({
      ...base,
      objects: [panel, detector, broken],
      typeCodes: new Set(['control-panel']),
      levelObjects: [panel, detector, broken],
    });

    expect(summary.total).toBe(1);
    expect(summary.systems[0]?.condition.whole.color).toBe('danger');
  });
});

describe('ближайшие работы', () => {
  it('семь дней — подмножество тридцати', () => {
    const soon = sourceDue({ '2026-01-01': '2026-08-30' });
    const summary = dashboardSummary({ ...base, source: soon, typeCodes: null });
    expect(summary.upcoming7.length).toBeGreaterThan(0);
    expect(summary.upcoming30.length).toBeGreaterThanOrEqual(summary.upcoming7.length);
  });

  it('работа на тридцатый день не попадает в семидневный список', () => {
    const later = sourceDue({ '2026-01-01': '2026-09-20' });
    const summary = dashboardSummary({ ...base, source: later, typeCodes: null });
    expect(summary.upcoming7).toEqual([]);
    expect(summary.upcoming30).toHaveLength(1);
  });

  it('семидневный список не зависит от порога «скоро»', () => {
    // Порог задан настройкой и бывает короче недели. Если считать по статусу,
    // работы шестого дня в список «на 7 дней» не попали бы — а они предстоят.
    const inSixDays = sourceDue({ '2026-01-01': '2026-09-01' });
    const summary = dashboardSummary({
      ...base, source: inSixDays, soonThresholdDays: 3, typeCodes: null,
    });
    expect(summary.upcoming7).toHaveLength(1);
    expect(summary.upcoming7[0]?.count).toBe(4);
  });

  it('одинаковые работы на одну дату складываются в одну строку', () => {
    const soon = sourceDue({ '2026-01-01': '2026-08-30' });
    const summary = dashboardSummary({ ...base, source: soon, typeCodes: null });
    expect(summary.upcoming7).toHaveLength(1);
    expect(summary.upcoming7[0]?.count).toBe(4);
  });
});
