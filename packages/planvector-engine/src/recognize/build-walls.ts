/**
 * Сборка стен и перегородок. Этап 7 по пункту 28 ТЗ.
 *
 * Отрезки чертежа превращаются в конструктивные элементы. Стена на плане
 * нарисована одним из двух способов, и оба надо понимать:
 *   — залитой полосой: тогда толщина известна сразу;
 *   — двумя параллельными линиями, её гранями: тогда толщина это расстояние
 *     между ними, а осевая линия проходит посередине.
 *
 * Всё, что не сложилось в стену, но достаточно длинное, становится
 * перегородкой с невысокой уверенностью: пункт 25 ТЗ прямо говорит, что лучше
 * оставить сомнительный элемент на проверку человеку, чем удалить стену.
 */

import type { SourcePoint } from '../source/page-content.js';
import type { Confidence, ElementKind, PlanElement } from '../model/plan-model.js';
import type { TracedSegment } from './trace-segments.js';

/** Толще этого пара линий уже не стена. */
export const MAX_WALL_THICKNESS = 14;

/** Тоньше этого пара линий — это штриховка или сдвоенная линия чертежа. */
export const MIN_WALL_THICKNESS = 0.8;

/** Допуск совпадения направления граней стены, радианы. */
const PAIR_ANGLE_TOLERANCE = 0.03;

/** Какую долю длины грани должны перекрывать друг друга. */
const MIN_OVERLAP_SHARE = 0.5;

/** Длиннее этого одиночная линия становится перегородкой. */
export const PARTITION_MIN_LENGTH = 25;

/** Наружной считается стена, лежащая в этой доле габарита от края здания. */
const EXTERIOR_BAND_SHARE = 0.04;

/** Уверенность по способу получения. Пункт 13 ТЗ. */
export const CONFIDENCE = {
  /** Залитая полоса: и осевая линия, и толщина взяты прямо из чертежа. */
  bar: 0.95,
  /** Пара граней: толщина вычислена, но способ надёжный. */
  paired: 0.85,
  /** Одиночная длинная линия: может оказаться размерной или выноской. */
  singleLine: 0.45,
  /** Цветная линия: на плане эвакуации это, скорее всего, маршрут. */
  colored: 0.2,
} as const;

function lengthOf(segment: TracedSegment): number {
  return Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y);
}

function angleOf(segment: TracedSegment): number {
  const angle = Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x);
  if (angle < 0) return angle + Math.PI;
  return angle >= Math.PI ? angle - Math.PI : angle;
}

function offsetOf(segment: TracedSegment, angle: number): number {
  return segment.a.x * Math.sin(angle) - segment.a.y * Math.cos(angle);
}

function projection(point: SourcePoint, angle: number): number {
  return point.x * Math.cos(angle) + point.y * Math.sin(angle);
}

function spanOf(segment: TracedSegment, angle: number): { from: number; to: number } {
  const one = projection(segment.a, angle);
  const two = projection(segment.b, angle);
  return { from: Math.min(one, two), to: Math.max(one, two) };
}

function anglesClose(one: number, two: number): boolean {
  const difference = Math.abs(one - two);
  return Math.min(difference, Math.PI - difference) <= PAIR_ANGLE_TOLERANCE;
}

/** Осевая линия между двумя гранями стены. */
function axisBetween(first: TracedSegment, second: TracedSegment, angle: number): TracedSegment {
  const firstSpan = spanOf(first, angle);
  const secondSpan = spanOf(second, angle);
  const from = Math.max(firstSpan.from, secondSpan.from);
  const to = Math.min(firstSpan.to, secondSpan.to);

  const direction = { x: Math.cos(angle), y: Math.sin(angle) };
  const normal = { x: -Math.sin(angle), y: Math.cos(angle) };
  const centreOffset = (offsetOf(first, angle) + offsetOf(second, angle)) / 2;

  const base = { x: normal.x * -centreOffset, y: normal.y * -centreOffset };
  const baseProjection = projection(base, angle);

  return {
    a: { x: base.x + direction.x * (from - baseProjection), y: base.y + direction.y * (from - baseProjection) },
    b: { x: base.x + direction.x * (to - baseProjection), y: base.y + direction.y * (to - baseProjection) },
    thickness: Math.abs(offsetOf(first, angle) - offsetOf(second, angle)),
    colored: first.colored || second.colored,
  };
}

interface WallCandidate {
  readonly segment: TracedSegment;
  readonly confidence: Confidence;
}

/** Находит пары граней и превращает их в стены. */
function pairFaces(segments: readonly TracedSegment[]): {
  walls: WallCandidate[];
  leftovers: TracedSegment[];
} {
  const used = new Set<number>();
  const walls: WallCandidate[] = [];

  for (let i = 0; i < segments.length; i += 1) {
    if (used.has(i)) continue;
    const first = segments[i];
    if (first === undefined || first.thickness > 0) continue;

    const angle = angleOf(first);
    const firstSpan = spanOf(first, angle);
    const firstLength = lengthOf(first);

    let bestIndex = -1;
    let bestThickness = Infinity;

    for (let j = i + 1; j < segments.length; j += 1) {
      if (used.has(j)) continue;
      const second = segments[j];
      if (second === undefined || second.thickness > 0) continue;
      if (!anglesClose(angle, angleOf(second))) continue;

      const thickness = Math.abs(offsetOf(first, angle) - offsetOf(second, angle));
      if (thickness < MIN_WALL_THICKNESS || thickness > MAX_WALL_THICKNESS) continue;

      const secondSpan = spanOf(second, angle);
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
      walls.push({ segment: axisBetween(first, second, angle), confidence: CONFIDENCE.paired });
    }
  }

  const leftovers = segments.filter((segment, index) => !used.has(index) && segment.thickness === 0);
  return { walls, leftovers };
}

/** Габарит всей найденной геометрии: по нему отличаются наружные стены. */
function boundsOf(segments: readonly TracedSegment[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  if (segments.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const segment of segments) {
    for (const point of [segment.a, segment.b]) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
  }

  return { minX, minY, maxX, maxY };
}

function isExterior(
  segment: TracedSegment,
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null,
): boolean {
  if (bounds === null) return false;

  const bandX = (bounds.maxX - bounds.minX) * EXTERIOR_BAND_SHARE;
  const bandY = (bounds.maxY - bounds.minY) * EXTERIOR_BAND_SHARE;

  const nearEdge = (point: SourcePoint): boolean =>
    point.x <= bounds.minX + bandX ||
    point.x >= bounds.maxX - bandX ||
    point.y <= bounds.minY + bandY ||
    point.y >= bounds.maxY - bandY;

  // Наружная стена прижата к габариту обоими концами.
  return nearEdge(segment.a) && nearEdge(segment.b);
}

export interface BuildWallsInput {
  readonly segments: readonly TracedSegment[];
  readonly makeId: () => string;
}

export interface BuildWallsResult {
  readonly elements: readonly PlanElement[];
  readonly stats: {
    readonly fromBars: number;
    readonly fromPairs: number;
    readonly partitions: number;
    readonly exterior: number;
    readonly needsReview: number;
  };
}

export function buildWalls(input: BuildWallsInput): BuildWallsResult {
  const bars = input.segments.filter((segment) => segment.thickness > 0);
  const { walls: paired, leftovers } = pairFaces(input.segments);

  const candidates: WallCandidate[] = [
    ...bars.map((segment) => ({ segment, confidence: CONFIDENCE.bar })),
    ...paired,
  ];

  const partitions = leftovers
    .filter((segment) => lengthOf(segment) >= PARTITION_MIN_LENGTH)
    .map((segment) => ({ segment, confidence: CONFIDENCE.singleLine }));

  const bounds = boundsOf(candidates.map((candidate) => candidate.segment));

  const elements: PlanElement[] = [];
  let exterior = 0;
  let needsReview = 0;

  const push = (candidate: WallCandidate, kind: ElementKind): void => {
    // Цветная линия на плане эвакуации почти всегда маршрут, а не конструкция.
    const confidence = candidate.segment.colored
      ? Math.min(candidate.confidence, CONFIDENCE.colored)
      : candidate.confidence;

    if (confidence < 0.5) needsReview += 1;

    elements.push({
      id: input.makeId(),
      kind,
      confidence,
      provenance: 'recognized',
      attributes: { colored: candidate.segment.colored },
      geometry: 'segment',
      segment: { a: candidate.segment.a, b: candidate.segment.b },
      thickness: candidate.segment.thickness,
    });
  };

  for (const candidate of candidates) {
    const outer = isExterior(candidate.segment, bounds);
    if (outer) exterior += 1;
    push(candidate, outer ? 'WALL_EXT' : 'WALL_INT');
  }

  for (const candidate of partitions) {
    push(candidate, 'PARTITION');
  }

  return {
    elements,
    stats: {
      fromBars: bars.length,
      fromPairs: paired.length,
      partitions: partitions.length,
      exterior,
      needsReview,
    },
  };
}
