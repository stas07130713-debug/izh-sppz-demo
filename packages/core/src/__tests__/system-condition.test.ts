/**
 * Два состояния прибора приёмно-контрольного (ТЗ, Дополнение 6, часть С61).
 *
 * Прибор может быть исправен, а система — нет, и наоборот. Одно число на оба
 * вопроса не отвечает, поэтому их два, и путать их нельзя.
 */

import { describe, expect, it } from 'vitest';
import type { MaintenanceEvent, PlanObject } from '@izh/contracts';
import { systemCondition } from '../rules/system-condition.js';
import type { ActivityScheduleSource } from '../rules/activity-source.js';

const TODAY = '2026-08-26';

function object(id: string, typeCode: string, extra: Partial<PlanObject> = {}): PlanObject {
  return {
    id, siteId: 'site', nodeId: 'этаж', typeCode, regNumber: id,
    model: null, manufacturer: null, serialNumber: null, commissionedOn: '2026-01-01',
    responsible: null, roomId: null, position: { x: 1, y: 1 }, systemId: null,
    technicalState: 'не определено', note: null, archivedAt: null,
    createdAt: '', updatedAt: '', rowVersion: 1,
    ...extra,
  } as unknown as PlanObject;
}

/** Сроки соблюдены у всех: тревога может прийти только от исправности. */
const IN_TIME: ActivityScheduleSource = {
  rulesFor: () => [{
    activityCode: 'осмотр', title: 'Осмотр', periodicityMonths: 12,
    checklist: [], ndReference: 'СП 484', needsVerification: false,
  }],
  nextDueOn: () => '2027-01-01',
};

const NO_EVENTS: readonly MaintenanceEvent[] = [];

const PANEL = object('ППКУ-1', 'control-panel');
const DETECTOR = object('ИПД-1', 'smoke-detector', { systemId: 'ППКУ-1' });
const SOUNDER = object('СОУЭ-1', 'sounder-audible', { systemId: 'ППКУ-1' });

function conditionOf(objects: readonly PlanObject[]) {
  return systemCondition(objects[0] as PlanObject, objects, NO_EVENTS, TODAY, 14, IN_TIME);
}

describe('состояние системы', () => {
  it('у прибора два состояния, у остальных элементов — ни одного', () => {
    expect(conditionOf([PANEL, DETECTOR])).not.toBeNull();
    expect(systemCondition(DETECTOR, [PANEL, DETECTOR], NO_EVENTS, TODAY, 14, IN_TIME)).toBeNull();
  });

  it('исправный прибор при неисправном извещателе: своё «норма», система тревожна', () => {
    // Пятьдесят нечищеных извещателей — и «зелёный» прибор об этом молчит.
    // Ради этого случая второе состояние и заведено.
    const broken = object('ИПД-2', 'smoke-detector', { systemId: 'ППКУ-1', technicalState: 'неисправен' });
    const result = conditionOf([PANEL, DETECTOR, broken]);

    expect(result?.own.color).toBe('ok');
    expect(result?.whole.color).toBe('danger');
  });

  it('неисправный прибор красит и себя, и систему', () => {
    const brokenPanel = object('ППКУ-2', 'control-panel', { technicalState: 'неисправен' });
    const member = object('ИПД-3', 'smoke-detector', { systemId: 'ППКУ-2' });
    const result = conditionOf([brokenPanel, member]);

    expect(result?.own.color).toBe('danger');
    expect(result?.whole.color).toBe('danger');
  });

  it('система без замечаний: оба состояния спокойны', () => {
    const result = conditionOf([PANEL, DETECTOR, SOUNDER]);
    expect(result?.own.color).toBe('ok');
    expect(result?.whole.color).toBe('ok');
  });

  it('система без элементов равна самому прибору', () => {
    // Прибор заведён, состав ещё не расставлен: обещать сведения о системе,
    // которой нет, нельзя — второе состояние совпадает с первым.
    const result = conditionOf([PANEL]);
    expect(result?.memberCount).toBe(0);
    expect(result?.whole.color).toBe(result?.own.color);
  });

  it('чужая система не влияет', () => {
    const other = object('ППКУ-3', 'control-panel');
    const alien = object('ИПД-4', 'smoke-detector', { systemId: 'ППКУ-3', technicalState: 'неисправен' });
    const result = systemCondition(PANEL, [PANEL, DETECTOR, other, alien], NO_EVENTS, TODAY, 14, IN_TIME);

    expect(result?.whole.color).toBe('ok');
    expect(result?.memberCount).toBe(1);
  });

  it('удалённый элемент в счёт не идёт', () => {
    const archived = object('ИПД-5', 'smoke-detector', {
      systemId: 'ППКУ-1', technicalState: 'неисправен', archivedAt: '2026-05-01T00:00:00.000Z',
    });
    const result = conditionOf([PANEL, DETECTOR, archived]);

    expect(result?.whole.color).toBe('ok');
    expect(result?.memberCount).toBe(1);
  });
});
