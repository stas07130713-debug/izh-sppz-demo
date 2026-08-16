/**
 * Отбор и склейка отрезков чертежа.
 *
 * Чистые функции: ни PDF, ни файлов, ни графики. Пороговые значения подобраны по
 * настоящему чертежу заказчика (`2.pdf`, лист 1701 × 1120 пунктов), где из 9446
 * путей несущей графикой оказались 785 чёрных, а конструкцией — 189 длинных.
 */

import type { AreaRect, Point2D } from '@izh/contracts';

export interface RawSegment {
  readonly a: Point2D;
  readonly b: Point2D;
  /** Цвет обводки в виде трёх составляющих 0..255. */
  readonly color: readonly [number, number, number];
  readonly lineWidthPt: number;
}

/** Ярче этого по любой составляющей — цвет не считается чёрным. */
export const BLACK_LEVEL = 70;

/** Короче этого отрезок считается мелкой деталью, а не конструкцией, в пунктах. */
export const MIN_SEGMENT_PT = 6;

/** Насколько отрезки должны совпадать по направлению, чтобы считаться одной линией. */
export const ANGLE_TOLERANCE_RAD = 0.02;

/** Насколько отрезки должны совпадать по положению, чтобы считаться одной линией. */
export const OFFSET_TOLERANCE_PT = 0.8;

/** Разрыв между кусками одной линии, который допускается склеить, в пунктах. */
export const JOIN_GAP_PT = 2.5;

export function lengthOf(segment: RawSegment): number {
  return Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y);
}

/** Чертёж рисуется чёрным. Цветное — это стрелки эвакуации, значки и легенда. */
export function isStructural(segment: RawSegment): boolean {
  const [r, g, b] = segment.color;
  return r <= BLACK_LEVEL && g <= BLACK_LEVEL && b <= BLACK_LEVEL;
}

export function isInside(segment: RawSegment, area: AreaRect): boolean {
  const right = area.x + area.width;
  const bottom = area.y + area.height;
  const inside = (point: Point2D): boolean =>
    point.x >= area.x && point.x <= right && point.y >= area.y && point.y <= bottom;
  return inside(segment.a) && inside(segment.b);
}

/** Угол наклона, приведённый к диапазону половины окружности: линия не имеет направления. */
export function angleOf(segment: RawSegment): number {
  const angle = Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x);
  return angle < 0 ? angle + Math.PI : angle >= Math.PI ? angle - Math.PI : angle;
}

/** Расстояние от начала координат до прямой, на которой лежит отрезок. */
export function offsetOf(segment: RawSegment): number {
  const angle = angleOf(segment);
  return segment.a.x * Math.sin(angle) - segment.a.y * Math.cos(angle);
}

function angleClose(first: number, second: number): boolean {
  const difference = Math.abs(first - second);
  return Math.min(difference, Math.PI - difference) <= ANGLE_TOLERANCE_RAD;
}

/** Положение точки вдоль направления отрезка. */
function projection(point: Point2D, angle: number): number {
  return point.x * Math.cos(angle) + point.y * Math.sin(angle);
}

/**
 * Склеивает куски одной прямой в длинные отрезки.
 *
 * Чертёж из САПР почти никогда не содержит стену одним отрезком: она разбита
 * проёмами, пересечениями и просто узлами полилинии. Без склейки почти всё
 * оказалось бы короче порога и было бы отброшено.
 */
export function mergeCollinear(segments: readonly RawSegment[]): RawSegment[] {
  const groups: { angle: number; offset: number; items: RawSegment[] }[] = [];

  for (const segment of segments) {
    const angle = angleOf(segment);
    const offset = offsetOf(segment);
    const group = groups.find(
      (candidate) =>
        angleClose(candidate.angle, angle) &&
        Math.abs(candidate.offset - offset) <= OFFSET_TOLERANCE_PT,
    );
    if (group === undefined) groups.push({ angle, offset, items: [segment] });
    else group.items.push(segment);
  }

  const merged: RawSegment[] = [];

  for (const group of groups) {
    // Каждый кусок описывается отрезком [начало, конец] вдоль общего направления.
    const spans = group.items
      .map((segment) => {
        const from = projection(segment.a, group.angle);
        const to = projection(segment.b, group.angle);
        return { from: Math.min(from, to), to: Math.max(from, to), source: segment };
      })
      .sort((first, second) => first.from - second.from);

    let current = spans[0];
    if (current === undefined) continue;
    let from = current.from;
    let to = current.to;
    let sample = current.source;

    const flush = (): void => {
      const direction = { x: Math.cos(group.angle), y: Math.sin(group.angle) };
      const base = { x: sample.a.x, y: sample.a.y };
      const baseProjection = projection(base, group.angle);
      merged.push({
        a: {
          x: base.x + direction.x * (from - baseProjection),
          y: base.y + direction.y * (from - baseProjection),
        },
        b: {
          x: base.x + direction.x * (to - baseProjection),
          y: base.y + direction.y * (to - baseProjection),
        },
        color: sample.color,
        lineWidthPt: sample.lineWidthPt,
      });
    };

    for (let i = 1; i < spans.length; i += 1) {
      current = spans[i];
      if (current === undefined) continue;
      if (current.from <= to + JOIN_GAP_PT) {
        to = Math.max(to, current.to);
      } else {
        flush();
        from = current.from;
        to = current.to;
        sample = current.source;
      }
    }
    flush();
  }

  return merged;
}

/** Полный отбор: только чёрное, только внутри области чертежа, только длинное. */
export function selectStructural(
  segments: readonly RawSegment[],
  area: AreaRect,
  minLengthPt = MIN_SEGMENT_PT,
): RawSegment[] {
  const candidates = segments.filter(
    (segment) => isStructural(segment) && isInside(segment, area) && lengthOf(segment) > 0.01,
  );
  return mergeCollinear(candidates).filter((segment) => lengthOf(segment) >= minLengthPt);
}
