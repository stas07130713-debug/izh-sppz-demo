/**
 * Превращение отрезков в элементы здания.
 *
 * Стена на чертеже нарисована двумя параллельными линиями — её гранями. Здесь
 * такие пары находятся и заменяются одной осевой линией с толщиной. Одиночные
 * длинные линии остаются перегородками, всё прочее — просто линиями.
 *
 * Чистые функции, покрытые тестами.
 */

import type { DrawnElement, DrawnElementKind, Point2D } from '@izh/contracts';
import { angleOf, lengthOf, offsetOf, type RawSegment } from './segments.js';

/** Толще этого пара линий уже не похожа на стену, в пунктах. */
export const MAX_WALL_THICKNESS_PT = 14;

/** Тоньше этого пара линий — это, скорее, штриховка, в пунктах. */
export const MIN_WALL_THICKNESS_PT = 0.8;

/** Насколько грани стены должны совпадать по направлению. */
export const PAIR_ANGLE_TOLERANCE_RAD = 0.03;

/** Какую долю длины грани должны перекрывать друг друга. */
export const MIN_OVERLAP_SHARE = 0.5;

/** Длиннее этого одиночная линия считается перегородкой, а не просто линией. */
export const PARTITION_MIN_LENGTH_PT = 25;

function projection(point: Point2D, angle: number): number {
  return point.x * Math.cos(angle) + point.y * Math.sin(angle);
}

function span(segment: RawSegment, angle: number): { from: number; to: number } {
  const first = projection(segment.a, angle);
  const second = projection(segment.b, angle);
  return { from: Math.min(first, second), to: Math.max(first, second) };
}

function midpointBetween(first: RawSegment, second: RawSegment, angle: number): RawSegment {
  const firstSpan = span(first, angle);
  const secondSpan = span(second, angle);
  const from = Math.max(firstSpan.from, secondSpan.from);
  const to = Math.min(firstSpan.to, secondSpan.to);

  const direction = { x: Math.cos(angle), y: Math.sin(angle) };
  const normal = { x: -Math.sin(angle), y: Math.cos(angle) };
  const centerOffset = (offsetOf(first) + offsetOf(second)) / 2;

  // Точка на осевой линии: сдвиг по нормали плюс положение вдоль направления.
  const base = { x: normal.x * -centerOffset, y: normal.y * -centerOffset };
  const baseProjection = projection(base, angle);

  return {
    a: {
      x: base.x + direction.x * (from - baseProjection),
      y: base.y + direction.y * (from - baseProjection),
    },
    b: {
      x: base.x + direction.x * (to - baseProjection),
      y: base.y + direction.y * (to - baseProjection),
    },
    color: first.color,
    lineWidthPt: first.lineWidthPt,
  };
}

function anglesClose(first: number, second: number): boolean {
  const difference = Math.abs(first - second);
  return Math.min(difference, Math.PI - difference) <= PAIR_ANGLE_TOLERANCE_RAD;
}

/**
 * Находит пары параллельных линий и делает из них стены.
 *
 * Возвращает готовые элементы и список отрезков, которые в пары не вошли.
 */
export function pairIntoWalls(
  segments: readonly RawSegment[],
  makeId: () => string,
): { walls: DrawnElement[]; leftovers: RawSegment[] } {
  const used = new Set<number>();
  const walls: DrawnElement[] = [];

  for (let i = 0; i < segments.length; i += 1) {
    if (used.has(i)) continue;
    const first = segments[i];
    if (first === undefined) continue;

    const firstAngle = angleOf(first);
    const firstSpan = span(first, firstAngle);
    const firstLength = lengthOf(first);

    let bestIndex = -1;
    let bestThickness = Infinity;

    for (let j = i + 1; j < segments.length; j += 1) {
      if (used.has(j)) continue;
      const second = segments[j];
      if (second === undefined) continue;
      if (!anglesClose(firstAngle, angleOf(second))) continue;

      const thickness = Math.abs(offsetOf(first) - offsetOf(second));
      if (thickness < MIN_WALL_THICKNESS_PT || thickness > MAX_WALL_THICKNESS_PT) continue;

      const secondSpan = span(second, firstAngle);
      const overlap = Math.min(firstSpan.to, secondSpan.to) - Math.max(firstSpan.from, secondSpan.from);
      const shorter = Math.min(firstLength, lengthOf(second));
      if (shorter <= 0 || overlap / shorter < MIN_OVERLAP_SHARE) continue;

      if (thickness < bestThickness) {
        bestThickness = thickness;
        bestIndex = j;
      }
    }

    if (bestIndex >= 0) {
      const second = segments[bestIndex];
      if (second === undefined) continue;
      used.add(i);
      used.add(bestIndex);
      const axis = midpointBetween(first, second, firstAngle);
      walls.push({
        id: makeId(),
        kind: 'wall',
        a: axis.a,
        b: axis.b,
        thickness: bestThickness,
        manual: false,
      });
    }
  }

  const leftovers = segments.filter((_, index) => !used.has(index));
  return { walls, leftovers };
}

/** Одиночные линии: длинные становятся перегородками, короткие — просто линиями. */
export function classifyLeftovers(
  segments: readonly RawSegment[],
  makeId: () => string,
): DrawnElement[] {
  return segments.map((segment) => {
    const kind: DrawnElementKind = lengthOf(segment) >= PARTITION_MIN_LENGTH_PT ? 'partition' : 'line';
    return {
      id: makeId(),
      kind,
      a: segment.a,
      b: segment.b,
      thickness: 0,
      manual: false,
    };
  });
}
