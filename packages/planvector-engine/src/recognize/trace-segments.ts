/**
 * Очистка и трассировка. Этапы 5 и 6 по пункту 28 ТЗ.
 *
 * Здесь пути документа превращаются в отрезки, из которых дальше собираются
 * стены. Это то место, где решается, что на чертеже является зданием.
 *
 * Признак «оставить всё чёрное» намеренно не используется — он неверен.
 * Чёрными нарисованы и стены, и текст, и разлиновка таблиц, и размерные линии,
 * и рамки. Решение принимается по совокупности: где путь лежит, чем нарисован,
 * какой он формы и длины.
 */

import type { PageContent, SourcePoint, SourceRect, VectorPath } from '../source/page-content.js';
import { rectContains, rectOf } from '../source/page-content.js';

/** Тоньше этого обводка на чертеже не видна: рисунок задаёт заливка. */
export const MIN_VISIBLE_STROKE = 0.1;

/** Толще этого залитая полоса уже не стена, а пятно. */
export const MAX_BAR_THICKNESS = 16;

/** Во сколько раз полоса должна быть длиннее своей толщины. */
export const MIN_BAR_ASPECT = 2.5;

/** Короче этого отрезок считается мелкой деталью. */
export const MIN_SEGMENT_LENGTH = 6;

/** Допуск совпадения направления двух отрезков, радианы. */
const ANGLE_TOLERANCE = 0.02;

/** Допуск совпадения положения двух отрезков. */
const OFFSET_TOLERANCE = 0.8;

/** Разрыв между кусками одной линии, который допустимо склеить. */
const JOIN_GAP = 2.5;

/** Отрезок чертежа с известным происхождением. */
export interface TracedSegment {
  readonly a: SourcePoint;
  readonly b: SourcePoint;
  /** Толщина, если она известна из залитой полосы. Ноль — неизвестна. */
  readonly thickness: number;
  /** Цветной путь — это, скорее всего, пожарная графика, а не здание. */
  readonly colored: boolean;
}

export interface TraceInput {
  readonly page: PageContent;
  readonly planArea: SourceRect;
  /** Рамки надписей и текстовых блоков: всё внутри них зданием не является. */
  readonly excludedRects: readonly SourceRect[];
}

export interface TraceResult {
  readonly segments: readonly TracedSegment[];
  readonly stats: {
    readonly pathsTotal: number;
    readonly droppedOutsideArea: number;
    readonly droppedInsideText: number;
    readonly droppedFills: number;
    readonly barsFound: number;
    readonly beforeMerge: number;
    readonly afterMerge: number;
  };
}

function isColored(color: readonly [number, number, number]): boolean {
  const max = Math.max(color[0], color[1], color[2]);
  const min = Math.min(color[0], color[1], color[2]);
  if (max === 0) return false;
  return (max - min) / max >= 0.15;
}

function lengthBetween(a: SourcePoint, b: SourcePoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function centreOf(points: readonly SourcePoint[]): SourcePoint | null {
  const rect = rectOf(points);
  if (rect === null) return null;
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/**
 * Пробует увидеть в замкнутом контуре тонкую вытянутую полосу — залитую стену.
 *
 * Возвращает пусто для всего остального: пятен, штриховки, букв, переведённых в
 * кривые, и мозаики из треугольников. Именно попытка соединить вершины такой
 * мозаики подряд превращала ранние перерисовки в месиво диагоналей.
 */
export function barFromOutline(points: readonly SourcePoint[]): TracedSegment | null {
  const unique: SourcePoint[] = [];
  for (const point of points) {
    const last = unique[unique.length - 1];
    if (last !== undefined && lengthBetween(last, point) < 0.01) continue;
    unique.push(point);
  }

  const first = unique[0];
  const last = unique[unique.length - 1];
  if (unique.length > 1 && first !== undefined && last !== undefined && lengthBetween(first, last) < 0.01) {
    unique.pop();
  }
  if (unique.length !== 4) return null;

  const sides = unique.map((point, index) => {
    const next = unique[(index + 1) % unique.length] as SourcePoint;
    return { from: point, to: next, length: lengthBetween(point, next) };
  });

  const ordered = [...sides].sort((one, two) => two.length - one.length);
  const longA = ordered[0];
  const longB = ordered[1];
  const shortA = ordered[2];
  const shortB = ordered[3];
  if (longA === undefined || longB === undefined || shortA === undefined || shortB === undefined) return null;

  const longLength = (longA.length + longB.length) / 2;
  const thickness = (shortA.length + shortB.length) / 2;
  if (thickness < 0.2 || thickness > MAX_BAR_THICKNESS) return null;
  if (longLength < thickness * MIN_BAR_ASPECT) return null;

  const midOf = (side: { from: SourcePoint; to: SourcePoint }): SourcePoint => ({
    x: (side.from.x + side.to.x) / 2,
    y: (side.from.y + side.to.y) / 2,
  });

  return { a: midOf(shortA), b: midOf(shortB), thickness, colored: false };
}

function angleOf(a: SourcePoint, b: SourcePoint): number {
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  if (angle < 0) return angle + Math.PI;
  return angle >= Math.PI ? angle - Math.PI : angle;
}

function offsetOf(a: SourcePoint, angle: number): number {
  return a.x * Math.sin(angle) - a.y * Math.cos(angle);
}

function projection(point: SourcePoint, angle: number): number {
  return point.x * Math.cos(angle) + point.y * Math.sin(angle);
}

function anglesClose(one: number, two: number): boolean {
  const difference = Math.abs(one - two);
  return Math.min(difference, Math.PI - difference) <= ANGLE_TOLERANCE;
}

/**
 * Склеивает куски одной прямой.
 *
 * Чертёж из САПР почти никогда не даёт стену одним отрезком: она разбита
 * проёмами, пересечениями и узлами полилинии. Без склейки почти всё оказалось
 * бы короче порога и было бы отброшено.
 */
export function mergeCollinear(segments: readonly TracedSegment[]): TracedSegment[] {
  const groups: { angle: number; offset: number; items: TracedSegment[] }[] = [];

  for (const segment of segments) {
    const angle = angleOf(segment.a, segment.b);
    const offset = offsetOf(segment.a, angle);
    const group = groups.find(
      (candidate) => anglesClose(candidate.angle, angle) && Math.abs(candidate.offset - offset) <= OFFSET_TOLERANCE,
    );
    if (group === undefined) groups.push({ angle, offset, items: [segment] });
    else group.items.push(segment);
  }

  const merged: TracedSegment[] = [];

  for (const group of groups) {
    const spans = group.items
      .map((segment) => {
        const from = projection(segment.a, group.angle);
        const to = projection(segment.b, group.angle);
        return { from: Math.min(from, to), to: Math.max(from, to), source: segment };
      })
      .sort((one, two) => one.from - two.from);

    let head = spans[0];
    if (head === undefined) continue;
    let from = head.from;
    let to = head.to;
    let sample = head.source;

    const flush = (): void => {
      const direction = { x: Math.cos(group.angle), y: Math.sin(group.angle) };
      const baseProjection = projection(sample.a, group.angle);
      merged.push({
        a: {
          x: sample.a.x + direction.x * (from - baseProjection),
          y: sample.a.y + direction.y * (from - baseProjection),
        },
        b: {
          x: sample.a.x + direction.x * (to - baseProjection),
          y: sample.a.y + direction.y * (to - baseProjection),
        },
        thickness: sample.thickness,
        colored: sample.colored,
      });
    };

    for (let i = 1; i < spans.length; i += 1) {
      head = spans[i];
      if (head === undefined) continue;
      if (head.from <= to + JOIN_GAP) {
        to = Math.max(to, head.to);
      } else {
        flush();
        from = head.from;
        to = head.to;
        sample = head.source;
      }
    }
    flush();
  }

  return merged;
}

/** Виден ли путь обводкой, а не только заливкой. */
function isStroked(path: VectorPath): boolean {
  return (path.paint === 'stroke' || path.paint === 'fill-stroke') && path.strokeWidth >= MIN_VISIBLE_STROKE;
}

export function traceSegments(input: TraceInput): TraceResult {
  const raw: TracedSegment[] = [];
  let droppedOutsideArea = 0;
  let droppedInsideText = 0;
  let droppedFills = 0;
  let barsFound = 0;

  for (const path of input.page.paths) {
    const centre = centreOf(path.points);
    if (centre === null) continue;

    if (!rectContains(input.planArea, centre)) {
      droppedOutsideArea += 1;
      continue;
    }
    if (input.excludedRects.some((rect) => rectContains(rect, centre))) {
      droppedInsideText += 1;
      continue;
    }

    const colored = isColored(path.color);

    if (isStroked(path)) {
      for (let i = 1; i < path.points.length; i += 1) {
        const a = path.points[i - 1] as SourcePoint;
        const b = path.points[i] as SourcePoint;
        if (lengthBetween(a, b) < 0.01) continue;
        raw.push({ a, b, thickness: 0, colored });
      }
      continue;
    }

    const bar = barFromOutline(path.points);
    if (bar === null) {
      droppedFills += 1;
      continue;
    }
    barsFound += 1;
    raw.push({ ...bar, colored });
  }

  const beforeMerge = raw.length;
  const merged = mergeCollinear(raw).filter(
    (segment) => lengthBetween(segment.a, segment.b) >= MIN_SEGMENT_LENGTH,
  );

  return {
    segments: merged,
    stats: {
      pathsTotal: input.page.paths.length,
      droppedOutsideArea,
      droppedInsideText,
      droppedFills,
      barsFound,
      beforeMerge,
      afterMerge: merged.length,
    },
  };
}
