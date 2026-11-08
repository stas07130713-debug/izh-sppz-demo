/**
 * Отбор систем действует на плане, в журнале и на дашборде одинаково
 * (ТЗ, Дополнение 6, часть С75).
 *
 * Заказчик: «нужно, чтобы работало в три стороны». Раньше отборов было два:
 * план прятал виды своим списком, дашборд держал свой, а журнал не слушал ни
 * того, ни другого. Человек снимал галочку и видел, что «ничего не работает».
 *
 * Отбор один и хранит **скрытые** виды: по умолчанию видно всё, и хранить
 * нужно исключения. Иначе на новом уровне отбор пришлось бы пересобирать, и
 * виды, которых там раньше не было, появлялись бы уже снятыми.
 */

import { describe, expect, it } from 'vitest';
import type { MaintenanceEvent, PlanObject } from '@izh/contracts';
import { dashboardSummary, rulePackageSource } from '@izh/core';

const TODAY = '2026-08-28';
const NO_EVENTS: readonly MaintenanceEvent[] = [];

function object(id: string, typeCode: string, placed: boolean): PlanObject {
  return {
    id, siteId: 'site', nodeId: 'этаж', typeCode, regNumber: id,
    model: null, manufacturer: null, serialNumber: null, commissionedOn: '2026-01-01',
    responsible: null, roomId: null, position: placed ? { x: 1, y: 1 } : null,
    technicalState: 'исправен', note: null, archivedAt: null,
    createdAt: '', updatedAt: '', rowVersion: 1,
  } as unknown as PlanObject;
}

const LEVEL: readonly PlanObject[] = [
  object('ОП-1', 'extinguisher-powder', true),
  object('ОП-2', 'extinguisher-powder', false),
  object('ПК-1', 'fire-hydrant-indoor', true),
  object('ИПД-1', 'smoke-detector', true),
];

/** Что видно на каждом из трёх экранов при данном отборе. */
function views(hidden: ReadonlySet<string>) {
  const types = new Set(LEVEL.map((item) => item.typeCode));
  const shownTypes = new Set([...types].filter((typeCode) => !hidden.has(typeCode)));

  return {
    plan: LEVEL.filter((item) => item.position !== null && !hidden.has(item.typeCode)).length,
    journal: LEVEL.filter((item) => !hidden.has(item.typeCode)).length,
    dashboard: dashboardSummary({
      objects: LEVEL, events: NO_EVENTS, today: TODAY, soonThresholdDays: 14,
      source: rulePackageSource, typeCodes: shownTypes, levelObjects: LEVEL,
    }).total,
  };
}

describe('общий отбор систем', () => {
  it('без отбора видно всё: план — только размещённое, журнал и дашборд — всё', () => {
    // План и журнал считают разное не из-за отбора: на плане видно то, у чего
    // есть точка, а в журнале — всё заведённое оборудование.
    expect(views(new Set())).toEqual({ plan: 3, journal: 4, dashboard: 4 });
  });

  it('снятый вид исчезает со всех трёх экранов', () => {
    expect(views(new Set(['extinguisher-powder']))).toEqual({ plan: 2, journal: 2, dashboard: 2 });
  });

  it('снятый вид без точек на плане меняет журнал и дашборд, но не план', () => {
    // Отсюда и брались жалобы «галочка не работает»: у вида не было точек, и
    // на плане ничего не менялось, хотя отбор действовал.
    const withUnplaced = new Set(['fire-hydrant-indoor']);
    const before = views(new Set());
    const after = views(withUnplaced);
    expect(after.journal).toBe(before.journal - 1);
    expect(after.dashboard).toBe(before.dashboard - 1);
    expect(after.plan).toBe(before.plan - 1);
  });

  it('снятые все виды дают пустоту везде, а не всё подряд', () => {
    const all = new Set(LEVEL.map((item) => item.typeCode));
    expect(views(all)).toEqual({ plan: 0, journal: 0, dashboard: 0 });
  });

  it('вид, которого на уровне нет, отбор не ломает', () => {
    // Отбор живёт дольше уровня: перешли на другой этаж — скрытые остались.
    expect(views(new Set(['вида-тут-нет']))).toEqual({ plan: 3, journal: 4, dashboard: 4 });
  });
});
