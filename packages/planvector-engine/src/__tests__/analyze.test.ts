/**
 * Эталонные тесты анализа источника.
 *
 * Проверяют главное, на чём проваливались ранние попытки: отделение чертежа от
 * легенды, штампа и таблиц.
 */

import { describe, expect, it } from 'vitest';
import type { PageContent, TextItem, VectorPath } from '../source/page-content.js';
import { analyzePage, needsRasterPipeline } from '../analyze/analyze-page.js';
import { findPlanArea } from '../analyze/plan-area.js';
import { detectProfile, scaleFromText, textClusters } from '../analyze/text-analysis.js';

function text(value: string, x: number, y: number, width = 40, height = 8): TextItem {
  return { text: value, x, y, width, height };
}

function line(x1: number, y1: number, x2: number, y2: number): VectorPath {
  return {
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ],
    closed: false,
    paint: 'stroke',
    strokeWidth: 0.5,
    color: [0, 0, 0],
  };
}

/** Лист с чертежом слева и легендой справа — типичный план эвакуации. */
function sheetWithLegend(): PageContent {
  const walls: VectorPath[] = [];
  for (let i = 0; i < 30; i += 1) {
    walls.push(line(100, 200 + i * 10, 600, 200 + i * 10));
  }

  const legend: VectorPath[] = [];
  for (let i = 0; i < 10; i += 1) {
    legend.push(line(820, 100 + i * 20, 960, 100 + i * 20));
  }

  const legendTexts: TextItem[] = [];
  for (let i = 0; i < 10; i += 1) {
    legendTexts.push(text('ОГНЕТУШИТЕЛЬ', 820, 100 + i * 20));
  }

  return {
    pageNumber: 1,
    widthPt: 1000,
    heightPt: 700,
    paths: [...walls, ...legend],
    texts: legendTexts,
    imageCount: 0,
  };
}

describe('масштаб из текста', () => {
  it('читает «М 1:100»', () => {
    expect(scaleFromText([text('М 1:100', 0, 0)])).toBe(100);
  });

  it('читает запись без пробелов и с латинской буквой', () => {
    expect(scaleFromText([text('M1:200', 0, 0)])).toBe(200);
  });

  it('читает слово «Масштаб»', () => {
    expect(scaleFromText([text('Масштаб 1:50', 0, 0)])).toBe(50);
  });

  it('при двух разных масштабах на листе не доверяет ни одному', () => {
    // Обычно это значит, что рядом врезка или узел в другом масштабе.
    expect(scaleFromText([text('М 1:100', 0, 0), text('М 1:20', 0, 40)])).toBe(null);
  });

  it('не принимает бессмысленные значения', () => {
    expect(scaleFromText([text('1:2', 0, 0)])).toBe(null);
    expect(scaleFromText([text('время 1:30', 0, 0)])).toBe(30);
  });

  it('на листе без масштаба возвращает пусто', () => {
    expect(scaleFromText([text('ПЛАН ЭВАКУАЦИИ', 0, 0)])).toBe(null);
  });
});

describe('профиль распознавания', () => {
  it('узнаёт план эвакуации по характерным словам', () => {
    const profile = detectProfile([
      text('ПЛАН ЭВАКУАЦИИ', 0, 0),
      text('ОГНЕТУШИТЕЛЬ', 0, 20),
      text('УСЛОВНЫЕ ОБОЗНАЧЕНИЯ', 0, 40),
    ]);
    expect(profile).toBe('EVACUATION_PLAN');
  });

  it('обычный поэтажный план считает техническим', () => {
    const profile = detectProfile([text('План 1 этажа', 0, 0), text('М 1:100', 0, 20)]);
    expect(profile).toBe('TECHNICAL_PLAN');
  });
});

describe('скопления текста', () => {
  it('собирает легенду в один блок', () => {
    const clusters = textClusters(
      Array.from({ length: 6 }, (_, index) => text('ОГНЕТУШИТЕЛЬ', 800, 100 + index * 20)),
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.itemCount).toBe(6);
  });

  it('одиночную подпись блоком не считает', () => {
    expect(textClusters([text('101', 300, 300)])).toHaveLength(0);
  });

  it('разнесённые блоки не сливает', () => {
    const clusters = textClusters([
      ...Array.from({ length: 4 }, (_, i) => text('ЛЕГЕНДА', 800, 100 + i * 20)),
      ...Array.from({ length: 4 }, (_, i) => text('ШТАМП', 100, 600 + i * 20)),
    ]);
    expect(clusters).toHaveLength(2);
  });
});

describe('область плана', () => {
  it('исключает легенду и оставляет только чертёж', () => {
    const result = findPlanArea(sheetWithLegend());
    expect(result.area).not.toBe(null);
    if (result.area === null) return;

    // Чертёж занимает x от 100 до 600; легенда с x 820 попасть не должна.
    expect(result.area.x).toBeCloseTo(100, 6);
    expect(result.area.x + result.area.width).toBeLessThan(700);
    expect(result.excludedTextClusters).toHaveLength(1);
  });

  it('отбрасывает рамку листа', () => {
    const page: PageContent = {
      pageNumber: 1,
      widthPt: 1000,
      heightPt: 700,
      paths: [
        // Рамка по краю листа.
        line(5, 5, 995, 5),
        line(5, 695, 995, 695),
        // Чертёж в середине.
        line(300, 300, 500, 300),
        line(300, 350, 500, 350),
      ],
      texts: [],
      imageCount: 0,
    };

    const result = findPlanArea(page);
    expect(result.area).not.toBe(null);
    if (result.area === null) return;
    expect(result.area.x).toBeCloseTo(300, 6);
    expect(result.area.width).toBeCloseTo(200, 6);
  });

  it('на пустой странице область не определяется', () => {
    const result = findPlanArea({
      pageNumber: 1,
      widthPt: 100,
      heightPt: 100,
      paths: [],
      texts: [],
      imageCount: 0,
    });
    expect(result.area).toBe(null);
  });
});

describe('анализ страницы', () => {
  it('векторный чертёж не требует растрового конвейера', () => {
    const analysis = analyzePage(sheetWithLegend());
    expect(analysis.hasVectorGeometry).toBe(true);
    expect(needsRasterPipeline(analysis)).toBe(false);
  });

  it('скан без геометрии требует растрового конвейера', () => {
    const scan: PageContent = {
      pageNumber: 1,
      widthPt: 800,
      heightPt: 600,
      paths: [],
      texts: [],
      imageCount: 1,
    };
    const analysis = analyzePage(scan);
    expect(analysis.hasVectorGeometry).toBe(false);
    expect(needsRasterPipeline(analysis)).toBe(true);
  });

  it('обводка нулевой толщины видимой не считается', () => {
    // Именно такие пути в чертеже заказчика оказались мозаикой из заливок.
    const invisible: VectorPath[] = Array.from({ length: 50 }, () => ({
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ],
      closed: true,
      paint: 'stroke' as const,
      strokeWidth: 0,
      color: [0, 0, 0] as const,
    }));

    const analysis = analyzePage({
      pageNumber: 1,
      widthPt: 800,
      heightPt: 600,
      paths: invisible,
      texts: [],
      imageCount: 0,
    });
    expect(analysis.vectorPathCount).toBe(0);
    expect(analysis.hasVectorGeometry).toBe(false);
  });

  it('область, занявшая почти весь лист, получает низкую уверенность', () => {
    const page: PageContent = {
      pageNumber: 1,
      widthPt: 1000,
      heightPt: 700,
      paths: Array.from({ length: 30 }, (_, i) => line(30, 30 + i, 970, 30 + i)),
      texts: [],
      imageCount: 0,
    };
    const analysis = analyzePage(page);
    expect(analysis.planAreaConfidence).toBeLessThan(0.5);
  });
});
