/**
 * Раскладка значков на условном поле — когда подложки нет
 * (ТЗ, Дополнение 6, часть С85).
 *
 * Заказчик: «когда загружаешь объекты на план, на котором нет подложки, значки
 * должны нормально формироваться, не перекрывая друг друга».
 *
 * Прежняя раскладка шла снизу вверх с постоянным отступом раздела в 112 точек
 * при шаге строки 76: две строки в разделе — и третья уже налезала на соседний
 * раздел, а при большом числе объектов значки уходили выше верхнего края поля.
 *
 * Проверяется не картинка, а расстояния: значок с подписью занимает по высоте
 * около 50 точек, и меньше этого между соседями быть не должно.
 */

import { describe, expect, it } from 'vitest';
import type { PlanObject } from '@izh/contracts';
import { FIELD_ROW_PX, arrangeWithoutBackdrop } from './plan-field';

/** Столько по высоте занимает значок вместе с подписью под ним. */
const MARKER_HEIGHT_PX = 50;

function object(id: string, typeCode: string): PlanObject {
  return {
    id, siteId: 'объект', nodeId: 'этаж', typeCode, regNumber: id,
    position: null, archivedAt: null,
  } as unknown as PlanObject;
}

/** Много объектов трёх разделов: внутренние, наружные, автоматика. */
function crowd(): readonly PlanObject[] {
  const list: PlanObject[] = [];
  for (let i = 0; i < 20; i += 1) list.push(object(`ОП-${i}`, 'extinguisher-powder'));
  for (let i = 0; i < 12; i += 1) list.push(object(`ПГ-${i}`, 'hydrant'));
  for (let i = 0; i < 30; i += 1) list.push(object(`ИПД-${i}`, 'smoke-detector'));
  return list;
}

/** Наименьшее расстояние между значками, стоящими в одной колонке. */
function closestInColumn(objects: readonly PlanObject[]): number {
  const byColumn = new Map<number, number[]>();
  for (const item of objects) {
    if (item.position === null) continue;
    byColumn.set(item.position.x, [...(byColumn.get(item.position.x) ?? []), item.position.y]);
  }

  let closest = Number.POSITIVE_INFINITY;
  for (const rows of byColumn.values()) {
    const sorted = [...rows].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
      closest = Math.min(closest, (sorted[i] ?? 0) - (sorted[i - 1] ?? 0));
    }
  }
  return closest;
}

describe('условное поле без подложки', () => {
  it('значки в колонке не налезают друг на друга', () => {
    const field = arrangeWithoutBackdrop(crowd(), 1600, 900);
    expect(closestInColumn(field.objects)).toBeGreaterThanOrEqual(MARKER_HEIGHT_PX);
  });

  it('разделы не наезжают друг на друга при многих строках', () => {
    // Прежде отступ раздела был меньше двух строк, и третья строка первого
    // раздела оказывалась поверх второго.
    const field = arrangeWithoutBackdrop(crowd(), 1600, 900);
    const rows = [...new Set(field.objects.map((item) => item.position?.y ?? 0))].sort((a, b) => a - b);
    for (let i = 1; i < rows.length; i += 1) {
      expect((rows[i] ?? 0) - (rows[i - 1] ?? 0)).toBeGreaterThanOrEqual(MARKER_HEIGHT_PX);
    }
  });

  it('поле растёт под содержимое, а не обрезает его', () => {
    const field = arrangeWithoutBackdrop(crowd(), 1600, 900);
    const lowest = Math.max(...field.objects.map((item) => item.position?.y ?? 0));

    expect(field.heightPx).toBeGreaterThanOrEqual(lowest);
    // Тесное поле не ужимает раскладку, а раздвигается само.
    expect(arrangeWithoutBackdrop(crowd(), 1600, 200).heightPx).toBeGreaterThan(200);
  });

  it('ни один значок не уходит выше верхнего края', () => {
    // Прежняя раскладка считалась от нижнего края вверх и при большом числе
    // объектов давала отрицательные координаты.
    const field = arrangeWithoutBackdrop(crowd(), 1600, 900);
    expect(Math.min(...field.objects.map((item) => item.position?.y ?? 0))).toBeGreaterThan(0);
  });

  it('на узком поле колонка одна, и строки идут подряд', () => {
    const field = arrangeWithoutBackdrop(crowd(), 300, 900);
    const columns = new Set(field.objects.map((item) => item.position?.x ?? 0));

    expect(columns.size).toBe(1);
    expect(closestInColumn(field.objects)).toBe(FIELD_ROW_PX);
  });

  it('пустой список не ломает раскладку', () => {
    const field = arrangeWithoutBackdrop([], 1600, 900);
    expect(field.objects).toEqual([]);
    expect(field.heightPx).toBe(900);
  });
});
