/**
 * Эталонные тесты перерисовки планировки.
 *
 * Отрезки задаются вручную, чтобы результат можно было проверить на бумаге.
 */

import { describe, expect, it } from 'vitest';
import { mergeCollinear, selectStructural, type RawSegment } from '../segments.js';
import { classifyLeftovers, pairIntoWalls } from '../walls.js';
import { renderPlanSvg } from '../render-svg.js';
import { IDENTITY, applyToPoint, averageScale, multiply } from '../matrix.js';

const BLACK: readonly [number, number, number] = [0, 0, 0];
const GREEN: readonly [number, number, number] = [0, 135, 84];

function segment(ax: number, ay: number, bx: number, by: number, color = BLACK): RawSegment {
  return { a: { x: ax, y: ay }, b: { x: bx, y: by }, color, lineWidthPt: 0.5 };
}

const WHOLE_PAGE = { x: -1000, y: -1000, width: 4000, height: 4000 };

describe('матрицы преобразования', () => {
  it('единичная матрица точку не двигает', () => {
    expect(applyToPoint(IDENTITY, 12, 34)).toEqual({ x: 12, y: 34 });
  });

  it('перенос и масштаб складываются в нужном порядке', () => {
    // Сначала масштаб вдвое, затем перенос на 100 по горизонтали.
    const combined = multiply([1, 0, 0, 1, 100, 0], [2, 0, 0, 2, 0, 0]);
    expect(applyToPoint(combined, 10, 5)).toEqual({ x: 120, y: 10 });
  });

  it('средний масштаб матрицы считается верно', () => {
    expect(averageScale([3, 0, 0, 3, 0, 0])).toBeCloseTo(3, 10);
  });
});

describe('отбор отрезков', () => {
  it('цветное отбрасывается: это стрелки и значки, а не здание', () => {
    const result = selectStructural(
      [segment(0, 0, 100, 0), segment(0, 20, 100, 20, GREEN)],
      WHOLE_PAGE,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.a.y).toBe(0);
  });

  it('за пределами области чертежа отрезки не берутся', () => {
    const area = { x: 0, y: 0, width: 50, height: 50 };
    const result = selectStructural([segment(0, 0, 40, 0), segment(200, 200, 260, 200)], area);
    expect(result).toHaveLength(1);
  });

  it('короткие обрывки отбрасываются', () => {
    const result = selectStructural([segment(0, 0, 2, 0)], WHOLE_PAGE);
    expect(result).toHaveLength(0);
  });
});

describe('склейка кусков одной прямой', () => {
  it('стена, разбитая на куски, собирается в один отрезок', () => {
    // Чертёж из САПР почти никогда не даёт стену одним отрезком.
    const merged = mergeCollinear([
      segment(0, 0, 40, 0),
      segment(40, 0, 90, 0),
      segment(91, 0, 150, 0),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.a.x).toBeCloseTo(0, 6);
    expect(merged[0]?.b.x).toBeCloseTo(150, 6);
  });

  it('далеко отстоящие куски одной прямой не склеиваются', () => {
    const merged = mergeCollinear([segment(0, 0, 40, 0), segment(200, 0, 260, 0)]);
    expect(merged).toHaveLength(2);
  });

  it('параллельные, но разнесённые линии остаются раздельными', () => {
    const merged = mergeCollinear([segment(0, 0, 100, 0), segment(0, 10, 100, 10)]);
    expect(merged).toHaveLength(2);
  });
});

describe('сборка стен из пары граней', () => {
  const makeId = (): string => 'id';

  it('две параллельные линии становятся стеной с толщиной', () => {
    const { walls, leftovers } = pairIntoWalls(
      [segment(0, 0, 200, 0), segment(0, 6, 200, 6)],
      makeId,
    );

    expect(walls).toHaveLength(1);
    expect(leftovers).toHaveLength(0);
    expect(walls[0]?.thickness).toBeCloseTo(6, 6);
    // Осевая линия проходит посередине между гранями.
    expect(walls[0]?.a.y).toBeCloseTo(3, 6);
    expect(walls[0]?.b.y).toBeCloseTo(3, 6);
  });

  it('слишком далеко разнесённые линии стеной не считаются', () => {
    const { walls, leftovers } = pairIntoWalls(
      [segment(0, 0, 200, 0), segment(0, 60, 200, 60)],
      makeId,
    );
    expect(walls).toHaveLength(0);
    expect(leftovers).toHaveLength(2);
  });

  it('линии, которые почти не перекрываются, в пару не идут', () => {
    const { walls } = pairIntoWalls([segment(0, 0, 100, 0), segment(300, 6, 400, 6)], makeId);
    expect(walls).toHaveLength(0);
  });

  it('одиночная длинная линия становится перегородкой, короткая — просто линией', () => {
    const elements = classifyLeftovers([segment(0, 0, 200, 0), segment(0, 50, 10, 50)], makeId);
    expect(elements[0]?.kind).toBe('partition');
    expect(elements[1]?.kind).toBe('line');
  });
});

describe('отрисовка планировки', () => {
  it('строит SVG с перевёрнутой осью и подписью из дерева объекта', () => {
    const svg = renderPlanSvg(
      {
        backdropId: 'b1',
        area: { x: 0, y: 0, width: 200, height: 100 },
        elements: [
          { id: 'w1', kind: 'wall', a: { x: 0, y: 0 }, b: { x: 200, y: 0 }, thickness: 6, manual: false },
        ],
        labels: [{ id: 'l1', text: '101', at: { x: 50, y: 50 }, manual: false }],
        createdAt: '2026-08-16T00:00:00.000Z',
      },
      { caption: 'Этаж 1, здание АБК ХМЦ', highlightManual: true },
    );

    expect(svg).toContain('<svg');
    // Ось Y в PDF направлена вверх, в SVG вниз — без переворота план был бы зеркальным.
    expect(svg).toContain('scale(1 -1)');
    expect(svg).toContain('stroke-width="6"');
    expect(svg).toContain('Этаж 1, здание АБК ХМЦ');
    expect(svg).toContain('>101<');
  });

  it('элемент, добавленный человеком, выделяется цветом', () => {
    const svg = renderPlanSvg(
      {
        backdropId: 'b1',
        area: { x: 0, y: 0, width: 100, height: 100 },
        elements: [
          { id: 'w1', kind: 'partition', a: { x: 0, y: 0 }, b: { x: 50, y: 0 }, thickness: 0, manual: true },
        ],
        labels: [],
        createdAt: '2026-08-16T00:00:00.000Z',
      },
      { caption: null, highlightManual: true },
    );
    expect(svg).toContain('#16a34a');
  });
});
