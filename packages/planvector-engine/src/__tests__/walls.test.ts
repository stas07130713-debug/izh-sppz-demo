/**
 * Эталонные тесты сборки стен. Этап 7 ТЗ.
 */

import { describe, expect, it } from 'vitest';
import type { TracedSegment } from '../recognize/trace-segments.js';
import { CONFIDENCE, buildWalls } from '../recognize/build-walls.js';

function face(x1: number, y1: number, x2: number, y2: number, colored = false): TracedSegment {
  return { a: { x: x1, y: y1 }, b: { x: x2, y: y2 }, thickness: 0, colored };
}

function bar(x1: number, y1: number, x2: number, y2: number, thickness: number): TracedSegment {
  return { a: { x: x1, y: y1 }, b: { x: x2, y: y2 }, thickness, colored: false };
}

function build(segments: TracedSegment[]) {
  let counter = 0;
  return buildWalls({ segments, makeId: () => `e${(counter += 1)}` });
}

describe('стены из залитых полос', () => {
  it('полоса становится стеной с высокой уверенностью', () => {
    const result = build([bar(0, 0, 200, 0, 6)]);

    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]?.confidence).toBe(CONFIDENCE.bar);
    expect(result.elements[0]?.geometry === 'segment' ? result.elements[0].thickness : 0).toBe(6);
    expect(result.stats.fromBars).toBe(1);
  });
});

describe('стены из пары граней', () => {
  it('две параллельные линии дают осевую линию с толщиной', () => {
    const result = build([face(0, 0, 200, 0), face(0, 6, 200, 6)]);

    expect(result.stats.fromPairs).toBe(1);
    expect(result.elements).toHaveLength(1);

    const wall = result.elements[0];
    expect(wall?.geometry === 'segment' ? wall.thickness : 0).toBeCloseTo(6, 6);
    expect(wall?.geometry === 'segment' ? wall.segment.a.y : 0).toBeCloseTo(3, 6);
    expect(wall?.confidence).toBe(CONFIDENCE.paired);
  });

  it('слишком далеко разнесённые линии стеной не считаются', () => {
    const result = build([face(0, 0, 200, 0), face(0, 60, 200, 60)]);
    expect(result.stats.fromPairs).toBe(0);
    // Обе линии длинные, поэтому становятся перегородками на проверку.
    expect(result.stats.partitions).toBe(2);
  });

  it('почти не перекрывающиеся линии в пару не идут', () => {
    const result = build([face(0, 0, 100, 0), face(300, 6, 400, 6)]);
    expect(result.stats.fromPairs).toBe(0);
  });
});

describe('перегородки и сомнительные элементы', () => {
  it('одиночная длинная линия становится перегородкой, требующей проверки', () => {
    const result = build([face(0, 0, 200, 0)]);

    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]?.kind).toBe('PARTITION');
    expect(result.elements[0]?.confidence).toBe(CONFIDENCE.singleLine);
    expect(result.stats.needsReview).toBe(1);
  });

  it('короткая одиночная линия отбрасывается', () => {
    const result = build([face(0, 0, 10, 0)]);
    expect(result.elements).toHaveLength(0);
  });

  it('цветная линия получает низкую уверенность: это маршрут, а не стена', () => {
    const result = build([face(0, 0, 200, 0, true), face(0, 6, 200, 6, true)]);

    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]?.confidence).toBe(CONFIDENCE.colored);
    expect(result.stats.needsReview).toBe(1);
  });

  it('сомнительное не удаляется, а помечается: лучше проверка, чем потерянная стена', () => {
    const result = build([face(0, 0, 200, 0, true)]);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]?.confidence).toBeLessThan(0.5);
  });
});

describe('наружные и внутренние стены', () => {
  it('стены по краю габарита считаются наружными, внутренние — внутренними', () => {
    // Коробка здания плюс внутренняя перегородка посередине.
    const result = build([
      bar(0, 0, 400, 0, 6),
      bar(0, 300, 400, 300, 6),
      bar(0, 0, 0, 300, 6),
      bar(400, 0, 400, 300, 6),
      bar(150, 60, 150, 240, 4),
    ]);

    const exterior = result.elements.filter((element) => element.kind === 'WALL_EXT');
    const interior = result.elements.filter((element) => element.kind === 'WALL_INT');

    expect(exterior).toHaveLength(4);
    expect(interior).toHaveLength(1);
    expect(result.stats.exterior).toBe(4);
  });
});
