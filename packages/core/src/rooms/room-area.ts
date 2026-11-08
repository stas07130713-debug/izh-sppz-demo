/**
 * Площадь помещения по обводке на плане.
 *
 * Пользователь площадь не набирает: он обводит помещение по углам, а программа
 * считает. Это и точнее, и проверяемо — обводка видна на плане, и с ней можно
 * спорить, в отличие от числа, взятого неизвестно откуда.
 *
 * Обводка задаётся в точках подложки, поэтому для перевода в метры нужен
 * масштаб — сколько метров в одной точке. Без масштаба площадь не вычисляется:
 * выдумывать её нельзя, а показать «0 м²» значит соврать.
 */

import type { PixelPoint } from '@izh/contracts';

/**
 * Площадь многоугольника в точках, формула Гаусса («шнуровка»).
 *
 * Знак площади зависит от направления обхода, поэтому берётся модуль:
 * пользователь обводит помещение как ему удобно, по часовой стрелке или против.
 */
export function polygonAreaPx(points: readonly PixelPoint[]): number {
  if (points.length < 3) return 0;

  let doubled = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    if (current === undefined || next === undefined) continue;
    doubled += current.x * next.y - next.x * current.y;
  }
  return Math.abs(doubled) / 2;
}

/**
 * Площадь в квадратных метрах.
 *
 * Возвращает null, если масштаб не задан или обводка вырождена — меньше трёх
 * точек либо нулевая площадь (все точки на одной линии).
 */
export function polygonAreaM2(
  points: readonly PixelPoint[],
  metersPerPixel: number | null,
): number | null {
  if (metersPerPixel === null || !Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return null;

  const areaPx = polygonAreaPx(points);
  if (areaPx <= 0) return null;

  // Масштаб линейный, площадь — квадратичная: метры на точку возводятся в квадрат.
  const area = areaPx * metersPerPixel * metersPerPixel;
  // Сотые доли квадратного метра: точнее обводка мышью всё равно не бывает.
  return Math.round(area * 100) / 100;
}
