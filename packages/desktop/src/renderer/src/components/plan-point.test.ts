/**
 * Проверка пересчёта точки щелчка (см. `plan-point.ts`).
 *
 * Случай с нулевой шириной найден на стенде: свёрнутая до нуля область плана
 * давала бесконечные координаты, и окно длины отрезка сообщало «Отмерено
 * Infinity точек плана». Бесконечность отсюда уходила бы в положение объекта и
 * в масштаб всего плана.
 */

import { describe, expect, it } from 'vitest';
import { isPointerDrag, toImagePoint } from './plan-point';

describe('пересчёт точки щелчка в координаты подложки', () => {
  const rect = { left: 100, top: 50, width: 800, height: 600 };

  it('переводит экранную точку в точку подложки', () => {
    expect(toImagePoint({ clientX: 500, clientY: 350 }, rect, 400, 300)).toEqual({ x: 200, y: 150 });
  });

  it('учитывает растяжение подложки по экрану', () => {
    expect(toImagePoint({ clientX: 900, clientY: 650 }, rect, 400, 300)).toEqual({ x: 400, y: 300 });
  });

  it('отказывается считать, когда у области нет ширины', () => {
    expect(toImagePoint({ clientX: 500, clientY: 350 }, { ...rect, width: 0 }, 400, 300)).toBeNull();
  });

  it('отказывается считать, когда у области нет высоты', () => {
    expect(toImagePoint({ clientX: 500, clientY: 350 }, { ...rect, height: 0 }, 400, 300)).toBeNull();
  });

  it('никогда не возвращает бесконечность', () => {
    const point = toImagePoint({ clientX: 500, clientY: 350 }, { ...rect, width: 0, height: 0 }, 400, 300);
    expect(point).toBeNull();
  });

  it('не принимает дрожание руки за перенос значка', () => {
    expect(isPointerDrag({ clientX: 100, clientY: 100 }, { clientX: 102, clientY: 102 }, 4)).toBe(false);
    expect(isPointerDrag({ clientX: 100, clientY: 100 }, { clientX: 104, clientY: 100 }, 4)).toBe(true);
  });
});
