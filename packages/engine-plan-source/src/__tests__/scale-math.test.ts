/**
 * Эталонные тесты арифметики подложки.
 *
 * Эти таблицы — спецификация поведения движка. Если вы меняете движок и тест
 * покраснел, вы либо сломали поведение, либо обязаны осознанно обновить эталон
 * и объяснить почему.
 */

import { describe, expect, it } from 'vitest';
import type { PdfPageInfo } from '@izh/contracts';
import {
  MAX_BACKDROP_SIDE_PX,
  estimateRasterSize,
  measureByBuildingExtents,
  metersPerPixelFromDrawingScale,
  metersPerPixelFromTwoPoints,
} from '../scale-math.js';

/** Лист A4 книжной ориентации: 210 x 297 мм это 595 x 842 пункта. */
const A4: PdfPageInfo = {
  pageNumber: 1,
  widthPt: 595,
  heightPt: 842,
  rotationDeg: 0,
};

/** Лист A1 альбомной ориентации: 841 x 594 мм это 2384 x 1684 пункта. */
const A1_LANDSCAPE: PdfPageInfo = {
  pageNumber: 1,
  widthPt: 2384,
  heightPt: 1684,
  rotationDeg: 0,
};

describe('estimateRasterSize', () => {
  it('при 72 dpi размер в пикселях совпадает с размером в пунктах', () => {
    const size = estimateRasterSize(A4, 72, 0);
    expect(size.widthPx).toBe(595);
    expect(size.heightPx).toBe(842);
  });

  it('удвоение разрешения удваивает обе стороны', () => {
    const size = estimateRasterSize(A4, 144, 0);
    expect(size.widthPx).toBe(1190);
    expect(size.heightPx).toBe(1684);
  });

  it('поворот на 90 градусов меняет стороны местами', () => {
    const straight = estimateRasterSize(A1_LANDSCAPE, 150, 0);
    const turned = estimateRasterSize(A1_LANDSCAPE, 150, 90);
    expect(turned.widthPx).toBe(straight.heightPx);
    expect(turned.heightPx).toBe(straight.widthPx);
  });

  it('поворот на 180 градусов размеры не меняет', () => {
    const straight = estimateRasterSize(A1_LANDSCAPE, 150, 0);
    const turned = estimateRasterSize(A1_LANDSCAPE, 150, 180);
    expect(turned.widthPx).toBe(straight.widthPx);
    expect(turned.heightPx).toBe(straight.heightPx);
  });

  it('чертёж A1 при 150 dpi укладывается в допустимый размер', () => {
    const size = estimateRasterSize(A1_LANDSCAPE, 150, 0);
    expect(size.widthPx).toBe(4967);
    expect(size.heightPx).toBe(3509);
    expect(size.tooLarge).toBe(false);
  });

  it('слишком высокое разрешение помечается как недопустимое', () => {
    const size = estimateRasterSize(A1_LANDSCAPE, 600, 0);
    expect(size.widthPx).toBeGreaterThan(MAX_BACKDROP_SIDE_PX);
    expect(size.tooLarge).toBe(true);
  });
});

describe('metersPerPixelFromTwoPoints', () => {
  it('горизонтальный отрезок в 100 пикселей длиной 10 метров даёт 0,1 м на пиксель', () => {
    const result = metersPerPixelFromTwoPoints({
      a: { x: 0, y: 0 },
      b: { x: 100, y: 0 },
      realDistanceM: 10,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeCloseTo(0.1, 10);
  });

  it('диагональный отрезок считается по теореме Пифагора', () => {
    const result = metersPerPixelFromTwoPoints({
      a: { x: 0, y: 0 },
      b: { x: 300, y: 400 },
      realDistanceM: 50,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeCloseTo(0.1, 10);
  });

  it('отрицательное расстояние отклоняется', () => {
    const result = metersPerPixelFromTwoPoints({
      a: { x: 0, y: 0 },
      b: { x: 100, y: 0 },
      realDistanceM: -5,
    });
    expect(result.ok).toBe(false);
  });

  it('слишком короткий отрезок отклоняется', () => {
    const result = metersPerPixelFromTwoPoints({
      a: { x: 10, y: 10 },
      b: { x: 10.5, y: 10 },
      realDistanceM: 5,
    });
    expect(result.ok).toBe(false);
  });
});

describe('measureByBuildingExtents', () => {
  it('здание 60 на 30 метров в прямоугольнике 600 на 300 точек даёт 0,1 м на точку', () => {
    const result = measureByBuildingExtents({
      rect: { x: 100, y: 100, widthPx: 600, heightPx: 300 },
      horizontalMeters: 60,
      verticalMeters: 30,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.metersPerPixel).toBeCloseTo(0.1, 10);
    expect(result.value.discrepancyPercent).toBeCloseTo(0, 10);
  });

  it('расхождение по направлениям вычисляется и показывается', () => {
    // По горизонтали 0,1 м на точку, по вертикали 0,11 — расхождение около 9,5 %.
    const result = measureByBuildingExtents({
      rect: { x: 0, y: 0, widthPx: 600, heightPx: 300 },
      horizontalMeters: 60,
      verticalMeters: 33,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.metersPerPixelHorizontal).toBeCloseTo(0.1, 10);
    expect(result.value.metersPerPixelVertical).toBeCloseTo(0.11, 10);
    expect(result.value.discrepancyPercent).toBeCloseTo(9.52, 1);
  });

  it('слишком маленький прямоугольник отклоняется', () => {
    const result = measureByBuildingExtents({
      rect: { x: 0, y: 0, widthPx: 8, heightPx: 8 },
      horizontalMeters: 60,
      verticalMeters: 30,
    });
    expect(result.ok).toBe(false);
  });

  it('нулевой размер здания отклоняется', () => {
    const result = measureByBuildingExtents({
      rect: { x: 0, y: 0, widthPx: 600, heightPx: 300 },
      horizontalMeters: 0,
      verticalMeters: 30,
    });
    expect(result.ok).toBe(false);
  });
});

describe('metersPerPixelFromDrawingScale', () => {
  it('масштаб 1:1 при 72 dpi даёт размер пикселя в один пункт', () => {
    const result = metersPerPixelFromDrawingScale({ scaleDenominator: 1 }, 72);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeCloseTo(0.0254 / 72, 12);
  });

  it('чертёж 1:100 при 150 dpi даёт примерно 1,69 см на пиксель', () => {
    const result = metersPerPixelFromDrawingScale({ scaleDenominator: 100 }, 150);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeCloseTo(0.016933, 6);
  });

  it('нулевой знаменатель масштаба отклоняется', () => {
    const result = metersPerPixelFromDrawingScale({ scaleDenominator: 0 }, 150);
    expect(result.ok).toBe(false);
  });
});
