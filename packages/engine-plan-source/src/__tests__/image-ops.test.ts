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
  erasePolygon,
  inspectComponentAt,
  keepDark,
  removeColor,
  removeColored,
  removeComponentAt,
  removeSmallComponents,
  samplePalette,
  scaleOperations,
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

/** Настройки «обычной» силы очистки: как в интерфейсе по умолчанию. */
const NORMAL = {
  saturationThreshold: 0.15,
  haloRadiusPx: 0,
  symbolGrowthPx: 0,
};

describe('removeColored — убрать всё цветное', () => {
  it('убирает зелёную стрелку и красный значок, оставляет стену', () => {
    const cleaned = removeColored(planStrip(), NORMAL);
    expect(pixelAt(cleaned, 0, 0)).toEqual(BLACK);
    expect(pixelAt(cleaned, 1, 0)).toEqual(WHITE);
    expect(pixelAt(cleaned, 2, 0)).toEqual(WHITE);
  });

  it('светлую серую штриховку переводит в фон архитектурной основы', () => {
    const cleaned = removeColored(planStrip(), NORMAL);
    expect(pixelAt(cleaned, 3, 0)).toEqual(WHITE);
  });

  it('при высоком пороге насыщенности не убирает ничего', () => {
    const cleaned = removeColored(planStrip(), { ...NORMAL, saturationThreshold: 1.1 });
    expect(pixelAt(cleaned, 1, 0)).toEqual(GREEN);
  });

  it('бледная цветная заливка и светлая серая заливка становятся фоном', () => {
    // Бледно-зелёный: разброс каналов невелик, но по отношению к яркости заметен.
    const paleGreen: RgbColor = { r: 200, g: 230, b: 205 };
    const gray: RgbColor = { r: 215, g: 215, b: 215 };
    const cleaned = removeColored(imageOf(2, 1, [paleGreen, gray]), {
      ...NORMAL,
      saturationThreshold: 0.1,
    });
    expect(pixelAt(cleaned, 0, 0)).toEqual(WHITE);
    expect(pixelAt(cleaned, 1, 0)).toEqual(WHITE);
  });

  it('кайма сглаживания вокруг цветного тоже убирается даже без ручного радиуса', () => {
    // Так выглядит край зелёной стрелки: яркий центр и бледная кайма,
    // у которой насыщенность ниже порога.
    const halo: RgbColor = { r: 225, g: 240, b: 230 };
    const image = imageOf(3, 1, [halo, GREEN, halo]);

    const withoutHalo = removeColored(image, { ...NORMAL, haloRadiusPx: 0 });
    expect(pixelAt(withoutHalo, 0, 0)).toEqual(WHITE);

    const withHalo = removeColored(image, { ...NORMAL, haloRadiusPx: 1 });
    expect(pixelAt(withHalo, 0, 0)).toEqual(WHITE);
    expect(pixelAt(withHalo, 2, 0)).toEqual(WHITE);
  });

  it('цветная автоматика не трогает чёрную обводку значка', () => {
    // Значок огнетушителя: рамка чёрная, внутри красное. Стена рядом не касается.
    const image = imageOf(5, 3, [
      BLACK, BLACK, BLACK, WHITE, BLACK,
      BLACK, RED,   BLACK, WHITE, BLACK,
      BLACK, BLACK, BLACK, WHITE, BLACK,
    ]);

    const cleaned = removeColored(image, {
      ...NORMAL,
      symbolGrowthPx: 3,
    });
    expect(pixelAt(cleaned, 0, 0)).toEqual(BLACK);
    expect(pixelAt(cleaned, 1, 1)).toEqual(WHITE);
    expect(pixelAt(cleaned, 4, 1)).toEqual(BLACK);
  });

  it('стена, которой касается стрелка, не съедается автоматической очисткой', () => {
    // Ровно тот случай, на который пожаловался заказчик: раньше связная фигура
    // убиралась целиком, и вместе со стрелкой уходила вся стена.
    // Длинная чёрная стена, к её началу примыкает зелёная стрелка.
    const wall = new Array<RgbColor>(12).fill(BLACK);
    const image = imageOf(13, 1, [GREEN, ...wall]);

    const cleaned = removeColored(image, { ...NORMAL, symbolGrowthPx: 2 });

    expect(pixelAt(cleaned, 0, 0)).toEqual(WHITE); // стрелка убрана
    expect(pixelAt(cleaned, 1, 0)).toEqual(BLACK);
    expect(pixelAt(cleaned, 2, 0)).toEqual(BLACK);
    expect(pixelAt(cleaned, 3, 0)).toEqual(BLACK);
    expect(pixelAt(cleaned, 12, 0)).toEqual(BLACK);
  });

  it('без прорастания стена не страдает вовсе', () => {
    const image = imageOf(4, 1, [GREEN, BLACK, BLACK, BLACK]);
    const cleaned = removeColored(image, { ...NORMAL, symbolGrowthPx: 0 });
    expect(pixelAt(cleaned, 1, 0)).toEqual(BLACK);
  });

  it('восстанавливает короткий разрыв длинной стены под цветным маршрутом', () => {
    const image = imageOf(13, 1, [
      BLACK, BLACK, BLACK, BLACK, BLACK, BLACK,
      GREEN,
      BLACK, BLACK, BLACK, BLACK, BLACK, BLACK,
    ]);
    const cleaned = removeColored(image, { ...NORMAL, symbolGrowthPx: 0 });

    expect(pixelAt(cleaned, 0, 0)).toEqual(BLACK);
    expect(pixelAt(cleaned, 1, 0)).toEqual(BLACK);
    expect(pixelAt(cleaned, 6, 0)).toEqual(BLACK);
    expect(pixelAt(cleaned, 11, 0)).toEqual(BLACK);
    expect(pixelAt(cleaned, 12, 0)).toEqual(BLACK);
  });
});

describe('removeComponentAt — убрать значок щелчком', () => {
  it('убирает связную фигуру целиком, даже одноцветную', () => {
    // Одноцветный чертёж: значок нарисован тем же чёрным, что и стена.
    const image = imageOf(5, 1, [BLACK, BLACK, WHITE, BLACK, BLACK]);
    const cleaned = removeComponentAt(image, { x: 0, y: 0 }, 0.9, 100);

    expect(pixelAt(cleaned, 0, 0)).toEqual(WHITE);
    expect(pixelAt(cleaned, 1, 0)).toEqual(WHITE);
    // Не связанная с ней часть осталась.
    expect(pixelAt(cleaned, 3, 0)).toEqual(BLACK);
  });

  it('слишком крупную фигуру не трогает: это стены', () => {
    const image = imageOf(4, 1, [BLACK, BLACK, BLACK, BLACK]);
    const cleaned = removeComponentAt(image, { x: 0, y: 0 }, 0.2, 100);
    expect(pixelAt(cleaned, 0, 0)).toEqual(BLACK);
  });

  it('удаление не уходит дальше заданного расстояния от щелчка', () => {
    // Значок примыкает к длинной стене. Ограничение по расстоянию не даёт
    // одному щелчку снести всю стену.
    const image = imageOf(10, 1, new Array<RgbColor>(10).fill(BLACK));
    const cleaned = removeComponentAt(image, { x: 0, y: 0 }, 0.9, 2);

    expect(pixelAt(cleaned, 0, 0)).toEqual(WHITE);
    expect(pixelAt(cleaned, 2, 0)).toEqual(WHITE);
    expect(pixelAt(cleaned, 5, 0)).toEqual(BLACK);
    expect(pixelAt(cleaned, 9, 0)).toEqual(BLACK);
  });

  it('щелчок по пустому месту ничего не меняет', () => {
    const image = imageOf(3, 1, [WHITE, BLACK, WHITE]);
    const cleaned = removeComponentAt(image, { x: 0, y: 0 }, 0.9, 100);
    expect(pixelAt(cleaned, 1, 0)).toEqual(BLACK);
  });
});

describe('inspectComponentAt — размер фигуры под точкой', () => {
  it('сообщает размер и долю площади', () => {
    const image = imageOf(4, 1, [BLACK, BLACK, WHITE, BLACK]);
    const found = inspectComponentAt(image, { x: 0, y: 0 }, 100);
    expect(found?.sizePx).toBe(2);
    expect(found?.share).toBeCloseTo(0.5, 6);
  });

  it('на пустом месте возвращает пусто', () => {
    expect(inspectComponentAt(imageOf(2, 1, [WHITE, BLACK]), { x: 0, y: 0 }, 100)).toBe(null);
  });
});

describe('removeSmallComponents — убрать мелкие текстовые подписи', () => {
  it('убирает маленькую подпись и оставляет длинную линию стены', () => {
    const pixels = new Array<RgbColor>(60).fill(WHITE);
    for (let x = 0; x < 40; x += 1) pixels[x] = BLACK;
    pixels[55] = BLACK;
    pixels[56] = BLACK;

    const cleaned = removeSmallComponents(imageOf(60, 1, pixels), {
      maxWidthPx: 3,
      maxHeightPx: 3,
      maxPixels: 3,
    });

    expect(pixelAt(cleaned, 0, 0)).toEqual(BLACK);
    expect(pixelAt(cleaned, 39, 0)).toEqual(BLACK);
    expect(pixelAt(cleaned, 55, 0)).toEqual(WHITE);
    expect(pixelAt(cleaned, 56, 0)).toEqual(WHITE);
  });
});

describe('scaleOperations — пересчёт действий под уменьшенную копию', () => {
  it('области и точки пересчитываются, настройки цвета — нет', () => {
    const scaled = scaleOperations(
      [
        { kind: 'erase-rect', rect: { x: 100, y: 200, widthPx: 40, heightPx: 60 } },
        { kind: 'remove-component', seed: { x: 300, y: 400 }, maxShare: 0.05, maxRadiusPx: 200 },
        { kind: 'remove-small-components', maxWidthPx: 180, maxHeightPx: 80, maxPixels: 900 },
        { ...NORMAL, kind: 'remove-colored' },
      ],
      0.5,
    );

    expect(scaled[0]).toEqual({ kind: 'erase-rect', rect: { x: 50, y: 100, widthPx: 20, heightPx: 30 } });
    expect(scaled[1]).toEqual({
      kind: 'remove-component',
      seed: { x: 150, y: 200 },
      maxShare: 0.05,
      maxRadiusPx: 100,
    });
    expect(scaled[2]).toEqual({ kind: 'remove-small-components', maxWidthPx: 90, maxHeightPx: 40, maxPixels: 225 });
    expect(scaled[3]).toEqual({ ...NORMAL, kind: 'remove-colored' });
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
      { ...NORMAL, kind: 'remove-colored' },
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
    applyCleanup(original, [{ ...NORMAL, kind: 'remove-colored' }]);
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

describe('erasePolygon — стереть область произвольной формы', () => {
  /** Поле 5×5 чёрных точек: стёртое видно сразу. */
  const black5 = (): RgbaImage => imageOf(5, 5, Array.from({ length: 25 }, () => BLACK));

  it('стирает внутренность треугольника, не трогая остальное', () => {
    // Треугольник по левому верхнему углу: (0,0) — (4,0) — (0,4).
    const cleaned = erasePolygon(black5(), [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 4 }]);

    expect(pixelAt(cleaned, 0, 0)).toEqual(WHITE);
    expect(pixelAt(cleaned, 1, 1)).toEqual(WHITE);
    // Правый нижний угол за гипотенузой — остаётся.
    expect(pixelAt(cleaned, 4, 4)).toEqual(BLACK);
    expect(pixelAt(cleaned, 3, 3)).toEqual(BLACK);
  });

  it('невыпуклая обводка стирает только то, что внутри', () => {
    // Буква «П»: две ножки стираются, вырез между ними — нет. Прямоугольником
    // так не выделить, ради этого обводка и нужна.
    const cleaned = erasePolygon(black5(), [
      { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 4, y: 5 },
      { x: 4, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 5 }, { x: 0, y: 5 },
    ]);

    expect(pixelAt(cleaned, 0, 4)).toEqual(WHITE);
    expect(pixelAt(cleaned, 4, 4)).toEqual(WHITE);
    expect(pixelAt(cleaned, 2, 4)).toEqual(BLACK);
  });

  it('обводка за краем изображения не выходит за его границы', () => {
    const cleaned = erasePolygon(black5(), [
      { x: -50, y: -50 }, { x: 50, y: -50 }, { x: 50, y: 2 }, { x: -50, y: 2 },
    ]);

    expect(cleaned.widthPx).toBe(5);
    expect(pixelAt(cleaned, 0, 0)).toEqual(WHITE);
    expect(pixelAt(cleaned, 4, 4)).toEqual(BLACK);
  });

  it('меньше трёх точек стирать нечего — изображение возвращается как есть', () => {
    const cleaned = erasePolygon(black5(), [{ x: 0, y: 0 }, { x: 4, y: 4 }]);
    expect(pixelAt(cleaned, 0, 0)).toEqual(BLACK);
  });

  it('в списке действий обводка применяется наравне с прямоугольником', () => {
    const result = applyCleanup(black5(), [
      { kind: 'erase-rect', rect: { x: 0, y: 0, widthPx: 2, heightPx: 1 } },
      { kind: 'erase-polygon', points: [{ x: 3, y: 3 }, { x: 5, y: 3 }, { x: 5, y: 5 }, { x: 3, y: 5 }] },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(pixelAt(result.value, 0, 0)).toEqual(WHITE);
    expect(pixelAt(result.value, 4, 4)).toEqual(WHITE);
    expect(pixelAt(result.value, 0, 4)).toEqual(BLACK);
  });

  it('на уменьшенной копии обводка пересчитывается вместе с остальным', () => {
    const scaled = scaleOperations(
      [{ kind: 'erase-polygon', points: [{ x: 10, y: 20 }, { x: 30, y: 20 }, { x: 30, y: 40 }] }],
      0.5,
    );

    const first = scaled[0];
    expect(first?.kind).toBe('erase-polygon');
    if (first?.kind !== 'erase-polygon') return;
    expect(first.points).toEqual([{ x: 5, y: 10 }, { x: 15, y: 10 }, { x: 15, y: 20 }]);
  });
});
