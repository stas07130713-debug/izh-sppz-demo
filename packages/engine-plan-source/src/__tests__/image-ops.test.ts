/**
 * Эталонные тесты очистки подложки.
 *
 * Изображения собираются вручную из нескольких точек, чтобы результат можно
 * было проверить пересчётом на бумаге.
 */

import { describe, expect, it } from 'vitest';
import type { RgbColor, RgbaImage } from '@izh/contracts';
import {
  applyCleanup,
  cropImage,
  downscale,
  eraseRect,
  keepDark,
  removeColor,
  removeColored,
  samplePalette,
} from '../image-ops.js';

const WHITE: RgbColor = { r: 255, g: 255, b: 255 };
const BLACK: RgbColor = { r: 0, g: 0, b: 0 };
/** Зелёная стрелка эвакуации. */
const GREEN: RgbColor = { r: 0, g: 160, b: 60 };
/** Красный значок огнетушителя. */
const RED: RgbColor = { r: 220, g: 30, b: 30 };
/** Светло-серая штриховка. */
const LIGHT_GRAY: RgbColor = { r: 200, g: 200, b: 200 };

function imageOf(widthPx: number, heightPx: number, pixels: readonly RgbColor[]): RgbaImage {
  const data = new Uint8ClampedArray(widthPx * heightPx * 4);
  pixels.forEach((color, index) => {
    data[index * 4] = color.r;
    data[index * 4 + 1] = color.g;
    data[index * 4 + 2] = color.b;
    data[index * 4 + 3] = 255;
  });
  return { widthPx, heightPx, data };
}

function pixelAt(image: RgbaImage, x: number, y: number): RgbColor {
  const index = (y * image.widthPx + x) * 4;
  return {
    r: image.data[index] ?? 0,
    g: image.data[index + 1] ?? 0,
    b: image.data[index + 2] ?? 0,
  };
}

/** Полоса: стена, зелёная стрелка, красный значок, светлая штриховка. */
function planStrip(): RgbaImage {
  return imageOf(4, 1, [BLACK, GREEN, RED, LIGHT_GRAY]);
}

describe('removeColored — убрать всё цветное', () => {
  it('убирает зелёную стрелку и красный значок, оставляет стену', () => {
    const cleaned = removeColored(planStrip(), 40);
    expect(pixelAt(cleaned, 0, 0)).toEqual(BLACK);
    expect(pixelAt(cleaned, 1, 0)).toEqual(WHITE);
    expect(pixelAt(cleaned, 2, 0)).toEqual(WHITE);
  });

  it('серую штриховку не трогает: у неё нет насыщенности', () => {
    const cleaned = removeColored(planStrip(), 40);
    expect(pixelAt(cleaned, 3, 0)).toEqual(LIGHT_GRAY);
  });

  it('при слишком высоком пороге не убирает ничего', () => {
    const cleaned = removeColored(planStrip(), 255);
    expect(pixelAt(cleaned, 1, 0)).toEqual(GREEN);
  });
});

describe('keepDark — оставить только тёмное', () => {
  it('убирает светлую штриховку, оставляет стену', () => {
    const cleaned = keepDark(planStrip(), 180);
    expect(pixelAt(cleaned, 0, 0)).toEqual(BLACK);
    expect(pixelAt(cleaned, 3, 0)).toEqual(WHITE);
  });
});

describe('removeColor — убрать выбранный цвет', () => {
  it('убирает точно указанный цвет', () => {
    const cleaned = removeColor(planStrip(), GREEN, 10);
    expect(pixelAt(cleaned, 1, 0)).toEqual(WHITE);
    expect(pixelAt(cleaned, 2, 0)).toEqual(RED);
  });

  it('с большим допуском захватывает и близкие оттенки', () => {
    const cleaned = removeColor(imageOf(2, 1, [GREEN, { r: 10, g: 170, b: 70 }]), GREEN, 20);
    expect(pixelAt(cleaned, 0, 0)).toEqual(WHITE);
    expect(pixelAt(cleaned, 1, 0)).toEqual(WHITE);
  });
});

describe('cropImage — обрезка рамки и штампа', () => {
  it('оставляет только выбранный прямоугольник', () => {
    const image = imageOf(3, 2, [BLACK, GREEN, RED, LIGHT_GRAY, BLACK, GREEN]);
    const cropped = cropImage(image, { x: 1, y: 0, widthPx: 2, heightPx: 2 });
    expect(cropped.ok).toBe(true);
    if (!cropped.ok) return;

    expect(cropped.value.widthPx).toBe(2);
    expect(cropped.value.heightPx).toBe(2);
    expect(pixelAt(cropped.value, 0, 0)).toEqual(GREEN);
    expect(pixelAt(cropped.value, 1, 1)).toEqual(GREEN);
  });

  it('область за пределами подложки отклоняется', () => {
    const cropped = cropImage(planStrip(), { x: 100, y: 100, widthPx: 10, heightPx: 10 });
    expect(cropped.ok).toBe(false);
  });
});

describe('eraseRect — стереть легенду', () => {
  it('заливает выбранный прямоугольник белым', () => {
    const erased = eraseRect(planStrip(), { x: 1, y: 0, widthPx: 2, heightPx: 1 });
    expect(erased.ok).toBe(true);
    if (!erased.ok) return;

    expect(pixelAt(erased.value, 0, 0)).toEqual(BLACK);
    expect(pixelAt(erased.value, 1, 0)).toEqual(WHITE);
    expect(pixelAt(erased.value, 2, 0)).toEqual(WHITE);
    expect(pixelAt(erased.value, 3, 0)).toEqual(LIGHT_GRAY);
  });
});

describe('applyCleanup — несколько действий подряд', () => {
  it('выполняет действия по порядку', () => {
    const result = applyCleanup(planStrip(), [
      { kind: 'remove-colored', chromaThreshold: 40 },
      { kind: 'keep-dark', luminanceThreshold: 180 },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(pixelAt(result.value, 0, 0)).toEqual(BLACK);
    expect(pixelAt(result.value, 1, 0)).toEqual(WHITE);
    expect(pixelAt(result.value, 3, 0)).toEqual(WHITE);
  });

  it('пустой список действий возвращает исходное изображение без изменений', () => {
    const original = planStrip();
    const result = applyCleanup(original, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([...result.value.data]).toEqual([...original.data]);
  });

  it('исходное изображение не меняется — очистка неразрушающая', () => {
    const original = planStrip();
    const before = [...original.data];
    applyCleanup(original, [{ kind: 'remove-colored', chromaThreshold: 40 }]);
    expect([...original.data]).toEqual(before);
  });

  it('ошибка в одном действии останавливает всю очистку', () => {
    const result = applyCleanup(planStrip(), [
      { kind: 'crop', rect: { x: 900, y: 900, widthPx: 5, heightPx: 5 } },
    ]);
    expect(result.ok).toBe(false);
  });
});

describe('samplePalette — палитра плана', () => {
  it('не показывает белый фон и считает доли от нарисованного', () => {
    const image = imageOf(4, 1, [BLACK, BLACK, GREEN, WHITE]);
    const palette = samplePalette(image, 10);

    expect(palette).toHaveLength(2);
    expect(palette[0]?.share).toBeCloseTo(2 / 3, 6);
    expect(palette[1]?.share).toBeCloseTo(1 / 3, 6);
  });

  it('на чистом белом листе палитра пуста', () => {
    expect(samplePalette(imageOf(2, 1, [WHITE, WHITE]), 10)).toHaveLength(0);
  });
});

describe('downscale — уменьшение для предпросмотра', () => {
  it('уменьшает длинную сторону до заданного предела', () => {
    const image = imageOf(4, 2, [BLACK, BLACK, BLACK, BLACK, BLACK, BLACK, BLACK, BLACK]);
    const small = downscale(image, 2);
    expect(small.widthPx).toBe(2);
    expect(small.heightPx).toBe(1);
  });

  it('маленькое изображение не трогает', () => {
    const image = planStrip();
    const same = downscale(image, 100);
    expect(same.widthPx).toBe(4);
    expect(same.heightPx).toBe(1);
  });
});
