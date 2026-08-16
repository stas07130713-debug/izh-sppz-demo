/**
 * Очистка подложки: чистые операции над изображением в памяти.
 *
 * Здесь нет ни холста, ни файлов, ни PDF — только массив точек. Поэтому весь
 * файл покрыт тестами и является спецификацией поведения очистки.
 *
 * Всё убранное заменяется белым: подложка должна остаться белым листом с
 * чёрными линиями здания.
 */

import type {
  CleanupOperation,
  PaletteEntry,
  PixelPoint,
  PixelRect,
  RgbColor,
  Result,
  RgbaImage,
} from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import { buildColorMask, buildInkMask, dilateMask, luminanceOf } from './color-mask.js';
import {
  addComponentAt,
  growIntoInk,
  measureComponentAt,
  type ComponentSummary,
} from './components.js';

/** Цвет фона подложки. */
const WHITE = 255;

/** Ярче этого по всем каналам — считается фоном и в палитру не попадает. */
const NEAR_WHITE_LEVEL = 240;

/** Шаг огрубления цвета при построении палитры. */
const PALETTE_BUCKET = 16;

function paintWhite(data: Uint8ClampedArray, index: number): void {
  data[index] = WHITE;
  data[index + 1] = WHITE;
  data[index + 2] = WHITE;
  data[index + 3] = 255;
}

function copyOf(image: RgbaImage): RgbaImage {
  return {
    widthPx: image.widthPx,
    heightPx: image.heightPx,
    data: new Uint8ClampedArray(image.data),
  };
}

/** Приводит прямоугольник к границам изображения. */
function clampRect(image: RgbaImage, rect: PixelRect): PixelRect | null {
  const x = Math.max(0, Math.round(rect.x));
  const y = Math.max(0, Math.round(rect.y));
  const right = Math.min(image.widthPx, Math.round(rect.x + rect.widthPx));
  const bottom = Math.min(image.heightPx, Math.round(rect.y + rect.heightPx));

  if (right - x < 1 || bottom - y < 1) return null;
  return { x, y, widthPx: right - x, heightPx: bottom - y };
}

/** Обрезка: оставить только выбранный прямоугольник. */
export function cropImage(image: RgbaImage, rect: PixelRect): Result<RgbaImage> {
  const area = clampRect(image, rect);
  if (area === null) {
    return err('INVALID_ARGUMENT', 'Область обрезки не попадает на подложку или слишком мала.');
  }

  const data = new Uint8ClampedArray(area.widthPx * area.heightPx * 4);
  for (let row = 0; row < area.heightPx; row += 1) {
    const from = ((area.y + row) * image.widthPx + area.x) * 4;
    const to = row * area.widthPx * 4;
    data.set(image.data.subarray(from, from + area.widthPx * 4), to);
  }

  return ok({ widthPx: area.widthPx, heightPx: area.heightPx, data });
}

/** Стереть прямоугольник — легенду, экспликацию, штамп. */
export function eraseRect(image: RgbaImage, rect: PixelRect): Result<RgbaImage> {
  const area = clampRect(image, rect);
  if (area === null) {
    return err('INVALID_ARGUMENT', 'Стираемая область не попадает на подложку.');
  }

  const result = copyOf(image);
  for (let row = area.y; row < area.y + area.heightPx; row += 1) {
    for (let column = area.x; column < area.x + area.widthPx; column += 1) {
      paintWhite(result.data, (row * image.widthPx + column) * 4);
    }
  }
  return ok(result);
}

/** Убрать один цвет с допуском. */
export function removeColor(image: RgbaImage, color: RgbColor, tolerance: number): RgbaImage {
  const result = copyOf(image);
  const limit = Math.max(0, tolerance);

  for (let index = 0; index < result.data.length; index += 4) {
    const dr = Math.abs((result.data[index] ?? 0) - color.r);
    const dg = Math.abs((result.data[index + 1] ?? 0) - color.g);
    const db = Math.abs((result.data[index + 2] ?? 0) - color.b);
    if (Math.max(dr, dg, db) <= limit) paintWhite(result.data, index);
  }

  return result;
}

export interface RemoveColoredOptions {
  readonly saturationThreshold: number;
  readonly haloRadiusPx: number;
  readonly symbolGrowthPx: number;
}

/**
 * Убрать всё цветное, оставив чёрные и серые линии здания.
 *
 * Работает в три приёма, и каждый нужен:
 *   1. находим цветные точки по относительной насыщенности;
 *   2. расширяем маску, чтобы снять бледную кайму сглаживания вокруг них —
 *      иначе на месте стрелки остаётся её призрак;
 *   3. прорастаем от цветных точек в соседний рисунок на ограниченное число
 *      шагов — иначе от значка огнетушителя остаётся пустая чёрная рамка.
 *
 * Ограничение числа шагов принципиально: без него стрелка, коснувшаяся стены,
 * утащила бы за собой всю стену.
 */
export function removeColored(image: RgbaImage, options: RemoveColoredOptions): RgbaImage {
  const colorMask = buildColorMask(image.data, options.saturationThreshold);

  const removal = options.haloRadiusPx > 0
    ? dilateMask(colorMask, image.widthPx, image.heightPx, options.haloRadiusPx)
    : new Uint8Array(colorMask);

  if (options.symbolGrowthPx > 0) {
    const inkMask = buildInkMask(image.data);
    growIntoInk(removal, inkMask, image.widthPx, image.heightPx, options.symbolGrowthPx);
  }

  return applyRemovalMask(image, removal);
}

/** Убрать одну связную фигуру, на которую указал пользователь. */
export function removeComponentAt(
  image: RgbaImage,
  seed: PixelPoint,
  maxShare: number,
  maxRadiusPx: number,
): RgbaImage {
  const column = Math.round(seed.x);
  const row = Math.round(seed.y);
  if (column < 0 || row < 0 || column >= image.widthPx || row >= image.heightPx) return copyOf(image);

  const inkMask = buildInkMask(image.data);
  const removal = addComponentAt(
    new Uint8Array(inkMask.length),
    inkMask,
    image.widthPx,
    image.heightPx,
    row * image.widthPx + column,
    maxShare,
    maxRadiusPx,
  );

  return applyRemovalMask(image, removal);
}

/** Размер фигуры под точкой — чтобы предупредить до удаления. */
export function inspectComponentAt(
  image: RgbaImage,
  seed: PixelPoint,
  maxRadiusPx: number,
): ComponentSummary | null {
  const column = Math.round(seed.x);
  const row = Math.round(seed.y);
  if (column < 0 || row < 0 || column >= image.widthPx || row >= image.heightPx) return null;

  const inkMask = buildInkMask(image.data);
  return measureComponentAt(
    inkMask,
    image.widthPx,
    image.heightPx,
    row * image.widthPx + column,
    maxRadiusPx,
  );
}

/** Закрашивает белым все точки, отмеченные в маске. */
function applyRemovalMask(image: RgbaImage, removal: Uint8Array): RgbaImage {
  const result = copyOf(image);
  for (let pixel = 0; pixel < removal.length; pixel += 1) {
    if (removal[pixel] === 1) paintWhite(result.data, pixel * 4);
  }
  return result;
}

/** Оставить только тёмное: убирает светлую заливку, штриховку и серость скана. */
export function keepDark(image: RgbaImage, luminanceThreshold: number): RgbaImage {
  const result = copyOf(image);

  for (let index = 0; index < result.data.length; index += 4) {
    const luminance = luminanceOf(
      result.data[index] ?? 0,
      result.data[index + 1] ?? 0,
      result.data[index + 2] ?? 0,
    );
    if (luminance > luminanceThreshold) paintWhite(result.data, index);
  }

  return result;
}

/** Уменьшение усреднением по области. Нужно для быстрого предпросмотра очистки. */
export function downscale(image: RgbaImage, maxSidePx: number): RgbaImage {
  const longestSide = Math.max(image.widthPx, image.heightPx);
  if (longestSide <= maxSidePx || maxSidePx < 1) return copyOf(image);

  const ratio = maxSidePx / longestSide;
  const widthPx = Math.max(1, Math.round(image.widthPx * ratio));
  const heightPx = Math.max(1, Math.round(image.heightPx * ratio));
  const data = new Uint8ClampedArray(widthPx * heightPx * 4);

  for (let row = 0; row < heightPx; row += 1) {
    const sourceTop = Math.floor((row * image.heightPx) / heightPx);
    const sourceBottom = Math.max(sourceTop + 1, Math.floor(((row + 1) * image.heightPx) / heightPx));

    for (let column = 0; column < widthPx; column += 1) {
      const sourceLeft = Math.floor((column * image.widthPx) / widthPx);
      const sourceRight = Math.max(sourceLeft + 1, Math.floor(((column + 1) * image.widthPx) / widthPx));

      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let count = 0;

      for (let y = sourceTop; y < sourceBottom; y += 1) {
        for (let x = sourceLeft; x < sourceRight; x += 1) {
          const index = (y * image.widthPx + x) * 4;
          sumR += image.data[index] ?? 0;
          sumG += image.data[index + 1] ?? 0;
          sumB += image.data[index + 2] ?? 0;
          count += 1;
        }
      }

      const target = (row * widthPx + column) * 4;
      data[target] = sumR / count;
      data[target + 1] = sumG / count;
      data[target + 2] = sumB / count;
      data[target + 3] = 255;
    }
  }

  return { widthPx, heightPx, data };
}

/**
 * Основные цвета плана.
 *
 * Почти белые точки не учитываются: иначе весь список занял бы фон. Доля
 * считается от точек, на которых что-то нарисовано, — так число сразу говорит,
 * велика ли эта часть чертежа.
 */
export function samplePalette(image: RgbaImage, maxEntries: number): readonly PaletteEntry[] {
  const counts = new Map<number, number>();
  let painted = 0;

  for (let index = 0; index < image.data.length; index += 4) {
    const r = image.data[index] ?? 0;
    const g = image.data[index + 1] ?? 0;
    const b = image.data[index + 2] ?? 0;
    if (r > NEAR_WHITE_LEVEL && g > NEAR_WHITE_LEVEL && b > NEAR_WHITE_LEVEL) continue;

    painted += 1;
    const key =
      Math.floor(r / PALETTE_BUCKET) * 65536 +
      Math.floor(g / PALETTE_BUCKET) * 256 +
      Math.floor(b / PALETTE_BUCKET);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  if (painted === 0) return [];

  const half = PALETTE_BUCKET / 2;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxEntries)
    .map(([key, count]) => ({
      color: {
        r: Math.floor(key / 65536) * PALETTE_BUCKET + half,
        g: (Math.floor(key / 256) % 256) * PALETTE_BUCKET + half,
        b: (key % 256) * PALETTE_BUCKET + half,
      },
      share: count / painted,
    }));
}

/**
 * Пересчитывает действия под другой размер изображения.
 *
 * Нужно для предпросмотра: он считается на уменьшенной копии, а области и точки
 * пользователь указывает на подложке в полном размере. Без пересчёта стёртая
 * область в предпросмотре оказалась бы совсем не там, где её обвели.
 */
export function scaleOperations(
  operations: readonly CleanupOperation[],
  factor: number,
): CleanupOperation[] {
  if (factor === 1) return [...operations];

  const scaleRect = (rect: PixelRect): PixelRect => ({
    x: rect.x * factor,
    y: rect.y * factor,
    widthPx: rect.widthPx * factor,
    heightPx: rect.heightPx * factor,
  });

  return operations.map((operation) => {
    switch (operation.kind) {
      case 'crop':
        return { kind: 'crop', rect: scaleRect(operation.rect) };
      case 'erase-rect':
        return { kind: 'erase-rect', rect: scaleRect(operation.rect) };
      case 'remove-component':
        return {
          ...operation,
          seed: { x: operation.seed.x * factor, y: operation.seed.y * factor },
          maxRadiusPx: operation.maxRadiusPx * factor,
        };
      default:
        // Действия с цветом от размера изображения не зависят: радиус каймы
        // задан в точках и намеренно не масштабируется — на уменьшенной копии
        // кайма тоже уже.
        return operation;
    }
  });
}

/** Применяет действия очистки по порядку. */
export function applyCleanup(
  image: RgbaImage,
  operations: readonly CleanupOperation[],
): Result<RgbaImage> {
  let current = image;

  for (const operation of operations) {
    switch (operation.kind) {
      case 'crop': {
        const cropped = cropImage(current, operation.rect);
        if (!cropped.ok) return cropped;
        current = cropped.value;
        break;
      }
      case 'erase-rect': {
        const erased = eraseRect(current, operation.rect);
        if (!erased.ok) return erased;
        current = erased.value;
        break;
      }
      case 'remove-color':
        current = removeColor(current, operation.color, operation.tolerance);
        break;
      case 'remove-colored':
        current = removeColored(current, {
          saturationThreshold: operation.saturationThreshold,
          haloRadiusPx: operation.haloRadiusPx,
          symbolGrowthPx: operation.symbolGrowthPx,
        });
        break;
      case 'remove-component':
        current = removeComponentAt(current, operation.seed, operation.maxShare, operation.maxRadiusPx);
        break;
      case 'keep-dark':
        current = keepDark(current, operation.luminanceThreshold);
        break;
    }
  }

  return ok(current === image ? copyOf(image) : current);
}
