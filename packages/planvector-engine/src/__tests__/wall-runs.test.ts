/**
 * Эталонные тесты поиска стен по изображению.
 *
 * Картинки собираются вручную из точек, чтобы результат можно было проверить
 * пересчётом на бумаге.
 */

import { describe, expect, it } from 'vitest';
import type { Mask } from '../raster/wall-runs.js';
import { DEFAULT_WALL_SEARCH, eraseRects, findWalls, inkMaskFromRgba } from '../raster/wall-runs.js';

const OPTIONS = { ...DEFAULT_WALL_SEARCH, minLengthPx: 20, maxThicknessPx: 12 };

function emptyMask(widthPx: number, heightPx: number): Mask {
  return { widthPx, heightPx, data: new Uint8Array(widthPx * heightPx) };
}

function fillRect(mask: Mask, x: number, y: number, width: number, height: number): Mask {
  const data = new Uint8Array(mask.data);
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      if (row < 0 || column < 0 || row >= mask.heightPx || column >= mask.widthPx) continue;
      data[row * mask.widthPx + column] = 1;
    }
  }
  return { ...mask, data };
}

describe('маска рисунка', () => {
  it('тёмные точки попадают в маску, светлые — нет', () => {
    const data = new Uint8ClampedArray(2 * 1 * 4);
    data.set([0, 0, 0, 255], 0);
    data.set([255, 255, 255, 255], 4);

    const mask = inkMaskFromRgba(data, 2, 1);
    expect(mask.data[0]).toBe(1);
    expect(mask.data[1]).toBe(0);
  });
});

describe('стирание областей', () => {
  it('убирает из маски прямоугольник легенды', () => {
    let mask = emptyMask(20, 10);
    mask = fillRect(mask, 0, 0, 20, 10);
    const cleared = eraseRects(mask, [{ x: 5, y: 2, widthPx: 6, heightPx: 4 }]);

    expect(cleared.data[2 * 20 + 5]).toBe(0);
    expect(cleared.data[2 * 20 + 4]).toBe(1);
  });
});

describe('поиск стен', () => {
  it('находит горизонтальную стену и её толщину', () => {
    const mask = fillRect(emptyMask(100, 40), 10, 15, 80, 4);
    const walls = findWalls(mask, OPTIONS);

    expect(walls).toHaveLength(1);
    const wall = walls[0];
    expect(wall?.horizontal).toBe(true);
    expect(wall?.thickness).toBe(4);
    // Осевая линия проходит посередине полосы: строки 15..18.
    expect(wall?.y1).toBeCloseTo(16.5, 6);
    expect(wall?.x1).toBe(10);
    expect(wall?.x2).toBe(89);
  });

  it('находит вертикальную стену', () => {
    const mask = fillRect(emptyMask(40, 100), 18, 5, 3, 70);
    const walls = findWalls(mask, OPTIONS);

    expect(walls).toHaveLength(1);
    expect(walls[0]?.horizontal).toBe(false);
    expect(walls[0]?.thickness).toBe(3);
  });

  it('короткие обрывки стенами не считаются', () => {
    // Значок, засечка размерной линии, буква — всё это короткое.
    const mask = fillRect(emptyMask(100, 40), 10, 15, 8, 3);
    expect(findWalls(mask, OPTIONS)).toHaveLength(0);
  });

  it('толстое пятно стеной не считается', () => {
    // Залитый прямоугольник легенды или картинка.
    const mask = fillRect(emptyMask(100, 60), 10, 5, 80, 40);
    expect(findWalls(mask, OPTIONS)).toHaveLength(0);
  });

  it('разрыв в стене от проёма не разрывает её на две', () => {
    let mask = fillRect(emptyMask(120, 30), 10, 12, 45, 3);
    mask = fillRect(mask, 57, 12, 45, 3);

    const walls = findWalls(mask, { ...OPTIONS, maxGapPx: 4 });
    expect(walls.filter((wall) => wall.horizontal)).toHaveLength(1);
  });

  it('большой разрыв разделяет стену на две', () => {
    let mask = fillRect(emptyMask(200, 30), 10, 12, 45, 3);
    mask = fillRect(mask, 120, 12, 45, 3);

    const walls = findWalls(mask, { ...OPTIONS, maxGapPx: 4 });
    expect(walls.filter((wall) => wall.horizontal)).toHaveLength(2);
  });

  it('коробка здания даёт четыре стены', () => {
    let mask = emptyMask(160, 120);
    mask = fillRect(mask, 10, 10, 140, 4);
    mask = fillRect(mask, 10, 106, 140, 4);
    mask = fillRect(mask, 10, 10, 4, 100);
    mask = fillRect(mask, 146, 10, 4, 100);

    const walls = findWalls(mask, OPTIONS);
    expect(walls.filter((wall) => wall.horizontal)).toHaveLength(2);
    expect(walls.filter((wall) => !wall.horizontal)).toHaveLength(2);
  });

  it('текст, стёртый по рамкам надписей, стен не порождает', () => {
    // Строка текста выглядит как множество коротких кусков; после стирания её
    // не остаётся вовсе.
    let mask = emptyMask(200, 40);
    for (let i = 0; i < 20; i += 1) mask = fillRect(mask, 10 + i * 9, 15, 6, 8);

    const cleared = eraseRects(mask, [{ x: 0, y: 10, widthPx: 200, heightPx: 20 }]);
    expect(findWalls(cleared, OPTIONS)).toHaveLength(0);
  });
});
