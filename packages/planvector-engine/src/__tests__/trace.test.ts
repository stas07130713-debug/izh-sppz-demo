/**
 * Эталонные тесты очистки и трассировки.
 *
 * Проверяют то, на чём проваливались ранние попытки: мозаику заливок, графику
 * легенды и склейку разбитых стен.
 */

import { describe, expect, it } from 'vitest';
import type { PageContent, SourceRect, VectorPath } from '../source/page-content.js';
import { barFromOutline, mergeCollinear, traceSegments } from '../recognize/trace-segments.js';

const AREA: SourceRect = { x: 0, y: 0, width: 1000, height: 1000 };
const BLACK: readonly [number, number, number] = [0, 0, 0];
const GREEN: readonly [number, number, number] = [0, 135, 84];

function stroked(x1: number, y1: number, x2: number, y2: number, color = BLACK): VectorPath {
  return {
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ],
    closed: false,
    paint: 'stroke',
    strokeWidth: 0.5,
    color,
  };
}

function page(paths: VectorPath[]): PageContent {
  return { pageNumber: 1, widthPt: 1000, heightPt: 1000, paths, texts: [], imageCount: 0 };
}

function trace(paths: VectorPath[], excluded: SourceRect[] = []) {
  return traceSegments({ page: page(paths), planArea: AREA, excludedRects: excluded });
}

describe('залитая полоса', () => {
  it('тонкий вытянутый четырёхугольник становится осевой линией с толщиной', () => {
    const bar = barFromOutline([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 6 },
      { x: 0, y: 6 },
      { x: 0, y: 0 },
    ]);

    expect(bar).not.toBe(null);
    if (bar === null) return;
    expect(bar.thickness).toBeCloseTo(6, 6);
    expect(bar.a.y).toBeCloseTo(3, 6);
    expect(bar.b.y).toBeCloseTo(3, 6);
  });

  it('мозаика из треугольников полосой не считается', () => {
    // Так выглядели 7714 путей в чертеже заказчика. Соединение их вершин
    // подряд и давало месиво диагоналей поверх плана.
    const bar = barFromOutline([
      { x: 74.9, y: 67.9 },
      { x: 68.8, y: 67.9 },
      { x: 74.9, y: 66.6 },
      { x: 68.8, y: 67.9 },
      { x: 74.9, y: 66.6 },
      { x: 68.8, y: 66.6 },
    ]);
    expect(bar).toBe(null);
  });

  it('квадратное пятно полосой не считается', () => {
    const bar = barFromOutline([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
    expect(bar).toBe(null);
  });

  it('слишком толстая полоса отбрасывается', () => {
    const bar = barFromOutline([
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 40 },
      { x: 0, y: 40 },
    ]);
    expect(bar).toBe(null);
  });
});

describe('склейка кусков одной стены', () => {
  it('собирает разбитую стену в один отрезок', () => {
    const merged = mergeCollinear([
      { a: { x: 0, y: 0 }, b: { x: 40, y: 0 }, thickness: 0, colored: false },
      { a: { x: 40, y: 0 }, b: { x: 90, y: 0 }, thickness: 0, colored: false },
      { a: { x: 91, y: 0 }, b: { x: 150, y: 0 }, thickness: 0, colored: false },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.a.x).toBeCloseTo(0, 6);
    expect(merged[0]?.b.x).toBeCloseTo(150, 6);
  });

  it('параллельные грани стены остаются раздельными', () => {
    const merged = mergeCollinear([
      { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, thickness: 0, colored: false },
      { a: { x: 0, y: 6 }, b: { x: 100, y: 6 }, thickness: 0, colored: false },
    ]);
    expect(merged).toHaveLength(2);
  });
});

describe('трассировка', () => {
  it('обводка нулевой толщины разбирается как заливка, а не как линия', () => {
    // Ключевая ошибка ранних попыток: такие пути соединялись как ломаные.
    const invisible: VectorPath = {
      points: [
        { x: 100, y: 100 },
        { x: 160, y: 100 },
        { x: 100, y: 108 },
        { x: 160, y: 108 },
      ],
      closed: true,
      paint: 'fill-stroke',
      strokeWidth: 0,
      color: BLACK,
    };

    const result = trace([invisible]);
    // Это мозаика, а не полоса: отбрасывается целиком.
    expect(result.stats.droppedFills).toBe(1);
    expect(result.segments).toHaveLength(0);
  });

  it('графика внутри текстового блока отбрасывается', () => {
    const legendBox: SourceRect = { x: 800, y: 100, width: 180, height: 220 };
    const result = trace(
      [stroked(100, 500, 400, 500), stroked(820, 150, 960, 150)],
      [legendBox],
    );

    expect(result.stats.droppedInsideText).toBe(1);
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.a.x).toBeCloseTo(100, 6);
  });

  it('графика вне области плана отбрасывается', () => {
    const result = traceSegments({
      page: page([stroked(50, 50, 200, 50), stroked(700, 700, 900, 700)]),
      planArea: { x: 0, y: 0, width: 400, height: 400 },
      excludedRects: [],
    });

    expect(result.stats.droppedOutsideArea).toBe(1);
    expect(result.segments).toHaveLength(1);
  });

  it('цветное сохраняется, но помечается: решение принимается позже', () => {
    // Цвет не является причиной удаления сам по себе — это отдельный признак.
    const result = trace([stroked(100, 100, 300, 100, GREEN)]);
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.colored).toBe(true);
  });

  it('короткие обрывки после склейки отбрасываются', () => {
    const result = trace([stroked(100, 100, 103, 100)]);
    expect(result.segments).toHaveLength(0);
  });

  it('считает, что и почему было отброшено', () => {
    const result = trace([stroked(100, 100, 400, 100), stroked(500, 500, 800, 500)]);
    expect(result.stats.pathsTotal).toBe(2);
    expect(result.stats.afterMerge).toBe(2);
  });
});
