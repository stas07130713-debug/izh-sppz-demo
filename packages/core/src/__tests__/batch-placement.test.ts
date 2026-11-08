/**
 * Эталонные тесты группового создания: схема нумерации, проверка занятых
 * номеров, расстановка по контуру помещения.
 *
 * Смотри docs/02_ТЗ_редакция_3.md, часть 6.3.
 */

import { describe, expect, it } from 'vitest';
import type { PixelPoint, PlanObject } from '@izh/contracts';
import { distributeAlongOutline, duplicateRegNumbers, generateRegNumbers } from '../objects/batch-placement.js';

describe('схема нумерации', () => {
  it('пример из ТЗ: префикс, начальный номер, шаг', () => {
    expect(generateRegNumbers({ prefix: 'ОП-', startNumber: 15, step: 1 }, 3)).toEqual([
      'ОП-15',
      'ОП-16',
      'ОП-17',
    ]);
  });

  it('шаг может быть больше единицы', () => {
    expect(generateRegNumbers({ prefix: 'ИПД-', startNumber: 100, step: 10 }, 3)).toEqual([
      'ИПД-100',
      'ИПД-110',
      'ИПД-120',
    ]);
  });

  it('поддерживает десятые доли без лишних хвостов округления', () => {
    expect(generateRegNumbers({ prefix: 'ОП-', startNumber: 1, step: 0.1 }, 3)).toEqual([
      'ОП-1',
      'ОП-1.1',
      'ОП-1.2',
    ]);
  });

  it('поддерживает сотые доли для дробной нумерации', () => {
    expect(generateRegNumbers({ prefix: 'ОП-', startNumber: 1, step: 0.01 }, 3)).toEqual([
      'ОП-1',
      'ОП-1.01',
      'ОП-1.02',
    ]);
  });

  it('нулевое и отрицательное количество не даёт номеров', () => {
    expect(generateRegNumbers({ prefix: '', startNumber: 1, step: 1 }, 0)).toEqual([]);
    expect(generateRegNumbers({ prefix: '', startNumber: 1, step: 1 }, -3)).toEqual([]);
  });
});

function objectWithNumber(siteId: string, regNumber: string, archivedAt: string | null = null): PlanObject {
  return {
    id: `id-${regNumber}`,
    siteId,
    nodeId: 'node',
    typeCode: 'extinguisher',
    regNumber,
    model: null,
    manufacturer: null,
    serialNumber: null,
    commissionedOn: null,
    serviceLifeMonths: null,
    responsible: null,
    roomId: null,
    position: null,
    technicalState: 'не определено',
    note: null,
    archivedAt,
    createdAt: '2026-08-16T00:00:00.000Z',
    updatedAt: '2026-08-16T00:00:00.000Z',
    rowVersion: 1,
  };
}

describe('проверка занятых номеров', () => {
  it('находит пересечение с уже существующими', () => {
    const existing = [objectWithNumber('site-1', 'ОП-15'), objectWithNumber('site-1', 'ОП-16')];
    expect(duplicateRegNumbers(existing, 'site-1', ['ОП-15', 'ОП-16', 'ОП-17'])).toEqual(['ОП-15', 'ОП-16']);
  });

  it('не считает номера другой организации занятыми', () => {
    const existing = [objectWithNumber('site-2', 'ОП-15')];
    expect(duplicateRegNumbers(existing, 'site-1', ['ОП-15'])).toEqual([]);
  });

  it('номер выведенного из эксплуатации объекта можно использовать снова', () => {
    const existing = [objectWithNumber('site-1', 'ОП-15', '2026-08-01T00:00:00.000Z')];
    expect(duplicateRegNumbers(existing, 'site-1', ['ОП-15'])).toEqual([]);
  });
});

describe('расстановка по контуру помещения', () => {
  /** Квадрат 100 × 100 точек, периметр 400. */
  const square: readonly PixelPoint[] = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  it('ставит одну точку в первую вершину', () => {
    expect(distributeAlongOutline(square, 1)).toEqual([{ x: 0, y: 0 }]);
  });

  it('четыре точки на квадрате ложатся по его углам', () => {
    expect(distributeAlongOutline(square, 4)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]);
  });

  it('две точки — противоположные стороны периметра', () => {
    // Половина периметра 400 — это 200: от (0,0) по часовой стрелке через (100,0) до (100,100).
    expect(distributeAlongOutline(square, 2)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ]);
  });

  it('вырожденный контур или нулевой счёт не даёт точек', () => {
    expect(distributeAlongOutline([{ x: 0, y: 0 }, { x: 1, y: 1 }], 3)).toEqual([]);
    expect(distributeAlongOutline(square, 0)).toEqual([]);
  });
});
