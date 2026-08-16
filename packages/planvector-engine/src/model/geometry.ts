/**
 * Геометрические примитивы модели.
 *
 * Единица измерения не зашита: она задаётся в модели полем `units`. До
 * калибровки координаты хранятся в единицах исходного документа, после — в
 * метрах. Так модель остаётся пригодной и до того, как масштаб стал известен.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Отрезок: осевая линия стены, перегородки, проёма. */
export interface Segment {
  readonly a: Point;
  readonly b: Point;
}

export interface Polygon {
  readonly points: readonly Point[];
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function lengthOf(segment: Segment): number {
  return Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y);
}

export function midpointOf(segment: Segment): Point {
  return { x: (segment.a.x + segment.b.x) / 2, y: (segment.a.y + segment.b.y) / 2 };
}

/** Площадь многоугольника по формуле шнурования. Знак отбрасывается: направление
 *  обхода контура помещения не задано. */
export function areaOf(polygon: Polygon): number {
  const points = polygon.points;
  if (points.length < 3) return 0;

  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i] as Point;
    const next = points[(i + 1) % points.length] as Point;
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

export function perimeterOf(polygon: Polygon): number {
  const points = polygon.points;
  if (points.length < 2) return 0;

  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i] as Point;
    const next = points[(i + 1) % points.length] as Point;
    sum += Math.hypot(next.x - current.x, next.y - current.y);
  }
  return sum;
}
