/**
 * Эталонные тесты модели этажа.
 *
 * Это спецификация того, что такое корректная PlanModel. Всё остальное в ядре —
 * лишь способы её построить, поэтому проверки написаны первыми.
 */

import { describe, expect, it } from 'vitest';
import { areaOf, perimeterOf } from '../model/geometry.js';
import {
  MODEL_VERSION,
  createEmptyPlanModel,
  withHistory,
  type PlanElement,
  type PlanModel,
  type Room,
  type SourceRef,
} from '../model/plan-model.js';
import { applyScaleToMeters } from '../model/scale.js';
import { LOW_CONFIDENCE, validatePlanModel } from '../model/validate.js';

const SOURCE: SourceRef = {
  fileName: 'план.pdf',
  contentHash: 'abc',
  kind: 'pdf',
  pageNumber: 1,
  area: null,
};

function emptyModel(): PlanModel {
  return createEmptyPlanModel({
    id: 'm1',
    createdAt: '2026-08-16T00:00:00.000Z',
    source: SOURCE,
    profile: 'EVACUATION_PLAN',
  });
}

function withFloorContent(model: PlanModel, elements: PlanElement[], rooms: Room[]): PlanModel {
  const floor = model.building.floors[0];
  if (floor === undefined) throw new Error('в модели нет этажа');
  return {
    ...model,
    building: { ...model.building, floors: [{ ...floor, elements, rooms }] },
  };
}

/** Квадрат 10 на 10 в единицах исходника. */
const SQUARE = {
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ],
};

function squareRoom(): Room {
  return {
    id: 'r1',
    polygon: SQUARE,
    area: areaOf(SQUARE),
    perimeter: perimeterOf(SQUARE),
    name: 'Кабинет',
    number: '101',
    confidence: 0.9,
    provenance: 'recognized',
    neighbourRoomIds: [],
    boundaryElementIds: [],
  };
}

describe('пустая модель', () => {
  it('создаётся в единицах исходника, без масштаба и с одним этажом', () => {
    const model = emptyModel();
    expect(model.version).toBe(MODEL_VERSION);
    expect(model.units).toBe('source');
    expect(model.scale.metersPerSourceUnit).toBe(null);
    expect(model.building.floors).toHaveLength(1);
  });

  it('проходит проверку целостности', () => {
    expect(validatePlanModel(emptyModel()).ok).toBe(true);
  });

  it('история пополняется, не меняя прежнюю модель', () => {
    const model = emptyModel();
    const next = withHistory(model, { at: '2026-08-16T01:00:00.000Z', stage: 'импорт', summary: 'загружен PDF' });
    expect(model.history).toHaveLength(0);
    expect(next.history).toHaveLength(1);
  });
});

describe('проверка целостности', () => {
  it('замечает объект с низкой уверенностью', () => {
    const element: PlanElement = {
      id: 'w1',
      kind: 'WALL_INT',
      confidence: LOW_CONFIDENCE - 0.1,
      provenance: 'recognized',
      attributes: {},
      geometry: 'segment',
      segment: { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
      thickness: 0.2,
    };
    const report = validatePlanModel(withFloorContent(emptyModel(), [element], []));

    expect(report.ok).toBe(true); // это предупреждение, а не ошибка
    expect(report.counts.lowConfidence).toBe(1);
    expect(report.issues.some((issue) => issue.code === 'LOW_CONFIDENCE')).toBe(true);
  });

  it('находит нулевую длину стены', () => {
    const element: PlanElement = {
      id: 'w1',
      kind: 'WALL_EXT',
      confidence: 1,
      provenance: 'manual',
      attributes: {},
      geometry: 'segment',
      segment: { a: { x: 5, y: 5 }, b: { x: 5, y: 5 } },
      thickness: 0.3,
    };
    const report = validatePlanModel(withFloorContent(emptyModel(), [element], []));

    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.code === 'ZERO_LENGTH')).toBe(true);
  });

  it('находит расхождение записанной площади с геометрией', () => {
    const room = { ...squareRoom(), area: 12345 };
    const report = validatePlanModel(withFloorContent(emptyModel(), [], [room]));

    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.code === 'ROOM_AREA_MISMATCH')).toBe(true);
  });

  it('находит повторяющиеся идентификаторы', () => {
    const room = squareRoom();
    const report = validatePlanModel(withFloorContent(emptyModel(), [], [room, { ...room }]));

    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.code === 'DUPLICATE_ID')).toBe(true);
  });

  it('требует масштаб, если модель объявлена в метрах', () => {
    const broken: PlanModel = { ...emptyModel(), units: 'meters' };
    const report = validatePlanModel(broken);

    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.code === 'SCALE_MISSING')).toBe(true);
  });
});

describe('калибровка в метры', () => {
  it('пересчитывает геометрию, площади и толщины', () => {
    const element: PlanElement = {
      id: 'w1',
      kind: 'WALL_EXT',
      confidence: 1,
      provenance: 'recognized',
      attributes: {},
      geometry: 'segment',
      segment: { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
      thickness: 2,
    };
    const model = withFloorContent(emptyModel(), [element], [squareRoom()]);

    // Половина метра в одной единице исходника.
    const scaled = applyScaleToMeters(model, 0.5, 'two-points', true, 'по двум точкам');
    expect(scaled).not.toBe(null);
    if (scaled === null) return;

    const floor = scaled.building.floors[0];
    const wall = floor?.elements[0];
    const room = floor?.rooms[0];

    expect(scaled.units).toBe('meters');
    expect(wall?.geometry === 'segment' ? wall.segment.b.x : 0).toBeCloseTo(5, 10);
    expect(wall?.geometry === 'segment' ? wall.thickness : 0).toBeCloseTo(1, 10);
    // Квадрат 10 на 10 при половине метра в единице — это 5 на 5 метров.
    expect(room?.area).toBeCloseTo(25, 10);
    expect(room?.perimeter).toBeCloseTo(20, 10);
    expect(validatePlanModel(scaled).ok).toBe(true);
  });

  it('повторная калибровка запрещена: координаты нельзя умножать дважды', () => {
    const once = applyScaleToMeters(emptyModel(), 0.5, 'two-points', true);
    expect(once).not.toBe(null);
    if (once === null) return;
    expect(applyScaleToMeters(once, 0.5, 'two-points', true)).toBe(null);
  });

  it('нулевой и отрицательный масштаб отклоняются', () => {
    expect(applyScaleToMeters(emptyModel(), 0, 'two-points', true)).toBe(null);
    expect(applyScaleToMeters(emptyModel(), -1, 'two-points', true)).toBe(null);
  });

  it('неподтверждённый масштаб отмечается предупреждением', () => {
    const scaled = applyScaleToMeters(emptyModel(), 0.5, 'text', false);
    expect(scaled).not.toBe(null);
    if (scaled === null) return;

    const report = validatePlanModel(scaled);
    expect(report.ok).toBe(true);
    expect(report.issues.some((issue) => issue.code === 'SCALE_UNCONFIRMED')).toBe(true);
  });
});
