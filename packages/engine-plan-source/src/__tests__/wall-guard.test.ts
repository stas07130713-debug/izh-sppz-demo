/**
 * Эталонные тесты защиты стен.
 *
 * Проверяют ровно ту беду, на которую жаловался заказчик: удаление значка
 * забирало с собой кусок стены рядом или под ним.
 */

import { describe, expect, it } from 'vitest';
import type { RgbColor, RgbaImage } from '@izh/contracts';
import { buildWallGuard } from '../wall-guard.js';
import { removeColored, removeComponentAt } from '../image-ops.js';

const WHITE: RgbColor = { r: 255, g: 255, b: 255 };
const BLACK: RgbColor = { r: 0, g: 0, b: 0 };
const RED: RgbColor = { r: 220, g: 30, b: 30 };

const GUARD = { minRunPx: 20, maxThicknessPx: 12, maxGapPx: 3, paddingPx: 0 };

function imageOf(widthPx: number, heightPx: number, fill: RgbColor = WHITE): RgbaImage {
  const data = new Uint8ClampedArray(widthPx * heightPx * 4);
  for (let pixel = 0; pixel < widthPx * heightPx; pixel += 1) {
    data[pixel * 4] = fill.r;
    data[pixel * 4 + 1] = fill.g;
    data[pixel * 4 + 2] = fill.b;
    data[pixel * 4 + 3] = 255;
  }
  return { widthPx, heightPx, data };
}

function paint(image: RgbaImage, x: number, y: number, w: number, h: number, color: RgbColor): void {
  for (let row = y; row < y + h; row += 1) {
    for (let column = x; column < x + w; column += 1) {
      const index = (row * image.widthPx + column) * 4;
      image.data[index] = color.r;
      image.data[index + 1] = color.g;
      image.data[index + 2] = color.b;
      image.data[index + 3] = 255;
    }
  }
}

function pixelAt(image: RgbaImage, x: number, y: number): RgbColor {
  const index = (y * image.widthPx + x) * 4;
  return { r: image.data[index] ?? 0, g: image.data[index + 1] ?? 0, b: image.data[index + 2] ?? 0 };
}

function isDark(color: RgbColor): boolean {
  return color.r < 120 && color.g < 120 && color.b < 120;
}

function inkOf(image: RgbaImage): Uint8Array {
  const mask = new Uint8Array(image.widthPx * image.heightPx);
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const index = pixel * 4;
    const luminance =
      0.299 * (image.data[index] ?? 255) +
      0.587 * (image.data[index + 1] ?? 255) +
      0.114 * (image.data[index + 2] ?? 255);
    if (luminance < 240) mask[pixel] = 1;
  }
  return mask;
}

describe('маска стен', () => {
  it('длинная линия защищается, короткий штрих — нет', () => {
    const image = imageOf(80, 30);
    paint(image, 5, 10, 60, 3, BLACK); // стена
    paint(image, 5, 20, 6, 3, BLACK); // штрих значка

    const guard = buildWallGuard(inkOf(image), image.widthPx, image.heightPx, GUARD);

    expect(guard[11 * 80 + 30]).toBe(1);
    expect(guard[21 * 80 + 7]).toBe(0);
  });

  it('толстое пятно стеной не считается', () => {
    const image = imageOf(80, 60);
    paint(image, 5, 5, 60, 40, BLACK);
    const guard = buildWallGuard(inkOf(image), image.widthPx, image.heightPx, GUARD);
    expect(guard[25 * 80 + 30]).toBe(0);
  });
});

describe('удаление значка рядом со стеной', () => {
  it('значок уходит, стена остаётся целой', () => {
    // Длинная стена, к ней вплотную примыкает красный значок в чёрной рамке.
    const image = imageOf(120, 40);
    paint(image, 5, 20, 100, 3, BLACK); // стена
    paint(image, 40, 10, 12, 10, BLACK); // рамка значка, касается стены
    paint(image, 43, 13, 6, 4, RED); // заливка значка

    const cleaned = removeColored(image, {
      saturationThreshold: 0.15,
      haloRadiusPx: 1,
      symbolGrowthPx: 14,
    });

    // Значок убран.
    expect(pixelAt(cleaned, 45, 14)).toEqual(WHITE);
    // Стена цела и слева, и справа, и прямо под значком.
    expect(isDark(pixelAt(cleaned, 10, 21))).toBe(true);
    expect(isDark(pixelAt(cleaned, 45, 21))).toBe(true);
    expect(isDark(pixelAt(cleaned, 100, 21))).toBe(true);
  });

  it('щелчок по значку не съедает стену', () => {
    const image = imageOf(120, 40);
    paint(image, 5, 20, 100, 3, BLACK);
    paint(image, 40, 10, 12, 10, BLACK);

    const cleaned = removeComponentAt(image, { x: 45, y: 14 }, 0.5, 200);

    expect(pixelAt(cleaned, 45, 14)).toEqual(WHITE);
    expect(isDark(pixelAt(cleaned, 10, 21))).toBe(true);
    expect(isDark(pixelAt(cleaned, 100, 21))).toBe(true);
  });

  it('стрелка, проходящая по стене, убирается, а стена восстанавливается сплошной', () => {
    const image = imageOf(120, 40);
    paint(image, 5, 20, 100, 3, BLACK);
    // Красная стрелка идёт прямо поверх стены.
    paint(image, 50, 20, 20, 3, RED);

    const cleaned = removeColored(image, {
      saturationThreshold: 0.15,
      haloRadiusPx: 1,
      symbolGrowthPx: 6,
    });

    // На месте стрелки снова стена, а не дыра.
    expect(isDark(pixelAt(cleaned, 60, 21))).toBe(true);
    expect(isDark(pixelAt(cleaned, 10, 21))).toBe(true);
  });
});
