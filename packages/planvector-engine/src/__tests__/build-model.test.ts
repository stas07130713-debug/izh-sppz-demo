/**
 * Эталонные тесты полной цепочки: страница документа → модель этажа.
 */

import { describe, expect, it } from 'vitest';
import type { PageContent, TextItem, VectorPath } from '../source/page-content.js';
import type { SourceRef } from '../model/plan-model.js';
import { recognizeFloor } from '../recognize/build-model.js';
import { renderFloorSvg } from '../render/render-svg.js';
import { validatePlanModel } from '../model/validate.js';

const SOURCE: SourceRef = {
  fileName: 'план.pdf',
  contentHash: 'hash',
  kind: 'pdf',
  pageNumber: 1,
  area: null,
};

/** Стена, нарисованная залитой полосой: прямоугольник заданной толщины. */
function bar(x1: number, y1: number, x2: number, y2: number, thickness: number): VectorPath {
  const horizontal = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
  const offsetX = horizontal ? 0 : thickness;
  const offsetY = horizontal ? thickness : 0;

  return {
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
      { x: x2 + offsetX, y: y2 + offsetY },
      { x: x1 + offsetX, y: y1 + offsetY },
      { x: x1, y: y1 },
    ],
    closed: true,
    paint: 'fill',
    strokeWidth: 0,
    color: [0, 0, 0],
  };
}

function legendText(index: number): TextItem {
  return { text: 'ОГНЕТУШИТЕЛЬ', x: 800, y: 100 + index * 20, width: 60, height: 8 };
}

/** Простое здание: четыре наружные стены и одна внутренняя, плюс легенда справа. */
function buildingPage(): PageContent {
  return {
    pageNumber: 1,
    widthPt: 1000,
    heightPt: 700,
    paths: [
      bar(100, 100, 600, 100, 8),
      bar(100, 500, 600, 500, 8),
      bar(100, 100, 100, 500, 8),
      bar(600, 100, 600, 500, 8),
      bar(350, 140, 350, 460, 5),
    ],
    texts: [legendText(0), legendText(1), legendText(2), legendText(3)],
    imageCount: 0,
  };
}

function recognize(page: PageContent) {
  let counter = 0;
  return recognizeFloor({
    page,
    source: SOURCE,
    createdAt: '2026-08-16T00:00:00.000Z',
    makeId: () => `e${(counter += 1)}`,
  });
}

describe('цепочка от страницы до модели', () => {
  it('строит стены и оставляет модель целостной', () => {
    const outcome = recognize(buildingPage());
    const floor = outcome.model.building.floors[0];

    expect(floor?.elements.length).toBeGreaterThan(0);
    expect(validatePlanModel(outcome.model).ok).toBe(true);
  });

  it('легенда не попадает в модель', () => {
    const outcome = recognize(buildingPage());
    const floor = outcome.model.building.floors[0];
    const rightmost = Math.max(
      ...(floor?.elements ?? []).map((element) =>
        element.geometry === 'segment' ? Math.max(element.segment.a.x, element.segment.b.x) : 0,
      ),
    );
    // Легенда начинается с x 800; в модели ничего правее здания быть не должно.
    expect(rightmost).toBeLessThan(700);
  });

  it('записывает в историю, что именно получилось', () => {
    const outcome = recognize(buildingPage());
    expect(outcome.model.history).toHaveLength(1);
    expect(outcome.model.history[0]?.summary).toContain('стен');
  });

  it('на скане не падает, а честно сообщает причину', () => {
    const scan: PageContent = {
      pageNumber: 1,
      widthPt: 800,
      heightPt: 600,
      paths: [],
      texts: [],
      imageCount: 1,
    };
    const outcome = recognize(scan);

    expect(outcome.model.building.floors[0]?.elements).toHaveLength(0);
    expect(outcome.model.history[0]?.summary).toContain('растровый');
    expect(validatePlanModel(outcome.model).ok).toBe(true);
  });
});

describe('отрисовка цифрового плана', () => {
  it('раскладывает объекты по группам SVG и переворачивает ось', () => {
    const outcome = recognize(buildingPage());
    const rendered = renderFloorSvg(outcome.model, 0, {
      caption: 'Этаж 1, здание АБК ХМЦ',
      showConfidence: false,
      reviewThreshold: 0.5,
    });

    expect(rendered).not.toBe(null);
    if (rendered === null) return;

    expect(rendered.svg).toContain('<g id="walls">');
    expect(rendered.svg).toContain('scale(1 -1)');
    expect(rendered.svg).toContain('Этаж 1, здание АБК ХМЦ');
  });

  it('в режиме уверенности сомнительное красится отдельно', () => {
    const outcome = recognize(buildingPage());
    const rendered = renderFloorSvg(outcome.model, 0, {
      caption: null,
      showConfidence: true,
      reviewThreshold: 0.5,
    });

    expect(rendered).not.toBe(null);
    if (rendered === null) return;
    // Стены из полос уверенные — зелёные.
    expect(rendered.svg).toContain('#16a34a');
  });

  it('сообщает, сколько объектов требует проверки', () => {
    const outcome = recognize(buildingPage());
    const rendered = renderFloorSvg(outcome.model, 0);
    expect(rendered?.needsReview).toBe(outcome.walls.needsReview);
  });
});
