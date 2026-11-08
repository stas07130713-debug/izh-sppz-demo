/**
 * Один цвет состояния на карточку и на план.
 *
 * Заказчик сообщил: значок на плане и карточка показывают разное. Причина была
 * в том, что цвет считался в двух местах по разным правилам — значок сводил
 * вместе сроки и исправность, карточка показывала одни сроки. Здесь закреплено
 * правило, по которому теперь считают оба экрана.
 */

import { describe, expect, it } from 'vitest';
import type { MaintenanceEvent, PlanObject } from '@izh/contracts';
import { conditionColor, placementCondition, technicalEscalation } from '../rules/object-condition.js';

const TODAY = '2026-08-23';

function object(overrides: Partial<PlanObject> = {}): PlanObject {
  return {
    id: 'o1', siteId: 's', nodeId: 'n', typeCode: 'self-rescuer',
    regNumber: '1', model: null, manufacturer: null, serialNumber: null,
    commissionedOn: '2026-08-01', serviceLifeYears: 5, responsible: null,
    roomId: null, position: { x: 1, y: 1 }, technicalState: 'не определено',
    note: null, archivedAt: null, createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z', rowVersion: 1,
    ...overrides,
  };
}

function brokenCheck(objectId: string): MaintenanceEvent {
  return {
    id: `e-${objectId}`, siteId: 's', objectId, activityCode: 'osmotr',
    performedOn: TODAY, result: 'не выполнено',
    checklist: [{ item: 'целостность корпуса', result: 'не выполнено', defect: 'повреждён корпус' }],
    defect: 'повреждён корпус', executor: null, note: null,
    createdAt: '2026-08-23T00:00:00.000Z',
  };
}

describe('исправность и сроки сводятся в один цвет', () => {
  it('неисправность красит в тревожный цвет, даже когда сроки в норме', () => {
    // Прежняя ошибка: значок красный, полоса карточки зелёная.
    expect(conditionColor('норма', 'неисправен')).toBe('danger');
    expect(conditionColor('норма', 'забракован')).toBe('danger');
  });

  it('замечания и ремонт дают жёлтый', () => {
    expect(conditionColor('норма', 'исправен с замечаниями')).toBe('warn');
    expect(conditionColor('норма', 'требует ремонта')).toBe('warn');
    expect(conditionColor('норма', 'на ТО')).toBe('warn');
  });

  it('исправность не гасит просрочку', () => {
    // Отметка «исправен» при осмотре не отменяет пропущенную перезарядку.
    expect(conditionColor('просрочено', 'исправен')).toBe('danger');
    expect(conditionColor('скоро', 'исправен')).toBe('warn');
  });

  it('молчаливое техническое состояние оставляет цвет срокам', () => {
    expect(conditionColor('норма', 'не определено')).toBe('ok');
    expect(conditionColor('нет данных', 'исправен')).toBe('unknown');
    expect(technicalEscalation('исправен')).toBeNull();
    expect(technicalEscalation('не определено')).toBeNull();
  });
});

describe('комплект отвечает за все свои единицы', () => {
  it('неисправная единица красит точку комплекта', () => {
    // Один самоспасатель из трёх сломан: раньше исправность бралась только у
    // самой точки, и значок оставался спокойным.
    const head = object({ id: 'head' });
    const unit = object({ id: 'unit-2', placementId: 'head', position: null });
    const all = [head, unit];

    const alone = placementCondition(head, [head], [brokenCheck('unit-2')], TODAY, 30);
    const together = placementCondition(head, all, [brokenCheck('unit-2')], TODAY, 30);

    expect(alone.technical).not.toBe('неисправен');
    expect(together.technical).toBe('неисправен');
    expect(together.color).toBe('danger');
  });

  it('обычный объект отвечает только за себя', () => {
    const lone = object({ id: 'lone', typeCode: 'hydrant' });
    const other = object({ id: 'other', typeCode: 'hydrant' });

    const condition = placementCondition(lone, [lone, other], [brokenCheck('other')], TODAY, 30);

    expect(condition.technical).not.toBe('неисправен');
  });
});
