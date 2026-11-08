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
import { buildColorMask, buildInkMask, dilateMask, isColoredPixel, luminanceOf } from './color-mask.js';
import { drawLine, eraseColoredInArea, rotateImage, scaleArea } from './image-area-ops.js';
import {
  addComponentAt,
  measureComponentAt,
  type ComponentSummary,
} from './components.js';
import { buildWallGuard } from './wall-guard.js';

/**
 * Рисунок без цветного — основа для маски стен.
 *
 * Линия маршрута эвакуации тоже длинная и сплошная, поэтому по одной лишь форме
 * она неотличима от стены и попадала под защиту: вместо того чтобы убраться,
 * маршрут превращался в чёрную стену. Цвет как признак «это не конструкция»
 * здесь работает, поэтому цветные точки в основу защиты не берутся.
 */
function structuralInk(image: RgbaImage, saturationThreshold: number): Uint8Array {
  const ink = buildInkMask(image.data);
  const colored = buildColorMask(image.data, saturationThreshold);
  for (let pixel = 0; pixel < ink.length; pixel += 1) {
    if (colored[pixel] === 1) ink[pixel] = 0;
  }
  return ink;
}

/** Цвет фона подложки. */
const WHITE = 255;

/** Ярче этого по всем каналам — считается фоном и в палитру не попадает. */
const NEAR_WHITE_LEVEL = 240;

/** Шаг огрубления цвета при построении палитры. */
const PALETTE_BUCKET = 16;
const LINE_REPAIR_RADIUS_PX = 14;
const MIN_LINE_REPAIR_RUN_PX = 4;
const DARK_LINE_LEVEL = 90;
const MONOCHROME_BACKGROUND_LEVEL = 190;
const RESIDUAL_COLOR_THRESHOLD = 0.04;

function paintWhite(data: Uint8ClampedArray, index: number): void {
  data[index] = WHITE;
  data[index + 1] = WHITE;
  data[index + 2] = WHITE;
  data[index + 3] = 255;
}

function paintBlack(data: Uint8ClampedArray, index: number): void {
  data[index] = 0;
  data[index + 1] = 0;
  data[index + 2] = 0;
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
 * Убрать цветные служебные слои, не ломая планировку.
 *
 * Работает в три приёма, и каждый нужен:
 *   1. находим цветные точки по относительной насыщенности;
 *   2. расширяем маску, чтобы снять бледную кайму сглаживания вокруг них —
 *      иначе на месте стрелки остаётся её призрак;
 *   3. переводим результат в чёрно-белую архитектурную основу.
 *
 * После удаления дополнительно чинятся короткие разрывы тёмных линий. Это
 * нужно для планов эвакуации: зелёная стрелка часто лежит прямо поверх стены,
 * и простое «стереть цвет» превращает стену в пунктир. Если по обе стороны от
 * удалённого участка видна продолжающаяся длинная тёмная линия, разрыв
 * возвращается как чёрная линия. Маленькие рамки значков так не
 * восстанавливаются: иначе автоматика сама возвращает удалённые пиктограммы.
 */
export function removeColored(image: RgbaImage, options: RemoveColoredOptions): RgbaImage {
  const colorMask = buildColorMask(image.data, options.saturationThreshold);
  const guard = buildWallGuard(structuralInk(image, options.saturationThreshold), image.widthPx, image.heightPx);

  const removal = options.haloRadiusPx > 0
    ? dilateMask(colorMask, image.widthPx, image.heightPx, options.haloRadiusPx)
    : new Uint8Array(colorMask);

  if (!maskHasAny(removal)) return copyOf(image);

  const cleaned = applyRemovalMask(image, removal, guard);
  const repaired = repairLineGaps(image, cleaned, removal);
  return architecturalMonochrome(repaired);
}

function maskHasAny(mask: Uint8Array): boolean {
  for (const value of mask) {
    if (value === 1) return true;
  }
  return false;
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
  const guard = buildWallGuard(structuralInk(image, 0.15), image.widthPx, image.heightPx);
  const removal = addComponentAt(
    new Uint8Array(inkMask.length),
    inkMask,
    image.widthPx,
    image.heightPx,
    row * image.widthPx + column,
    maxShare,
    maxRadiusPx,
    guard,
  );

  return applyRemovalMask(image, removal, guard);
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
  const guard = buildWallGuard(structuralInk(image, 0.15), image.widthPx, image.heightPx);
  return measureComponentAt(
    inkMask,
    image.widthPx,
    image.heightPx,
    row * image.widthPx + column,
    maxRadiusPx,
    guard,
  );
}

export interface RemoveSmallComponentsOptions {
  readonly maxWidthPx: number;
  readonly maxHeightPx: number;
  readonly maxPixels: number;
}

/** Убрать мелкие текстоподобные компоненты без OCR и внешних библиотек. */
export function removeSmallComponents(image: RgbaImage, options: RemoveSmallComponentsOptions): RgbaImage {
  const ink = buildInkMask(image.data);
  const guard = buildWallGuard(structuralInk(image, 0.15), image.widthPx, image.heightPx);
  const visited = new Uint8Array(ink.length);
  const removal = new Uint8Array(ink.length);

  for (let start = 0; start < ink.length; start += 1) {
    if (ink[start] !== 1 || visited[start] === 1 || guard[start] === 1) continue;
    const component = collectComponent(ink, guard, visited, image.widthPx, image.heightPx, start);
    if (
      component.pixels.length <= options.maxPixels &&
      component.maxX - component.minX + 1 <= options.maxWidthPx &&
      component.maxY - component.minY + 1 <= options.maxHeightPx
    ) {
      for (const pixel of component.pixels) removal[pixel] = 1;
    }
  }

  return applyRemovalMask(image, removal);
}

/**
 * Закрашивает белым точки, отмеченные к удалению.
 *
 * Точки стены не стираются никогда и не перекрашиваются: они остаются такими,
 * какими были на исходном изображении.
 */
function applyRemovalMask(image: RgbaImage, removal: Uint8Array, guard?: Uint8Array): RgbaImage {
  const result = copyOf(image);

  for (let pixel = 0; pixel < removal.length; pixel += 1) {
    if (removal[pixel] !== 1) continue;

    // Точка стены не трогается вовсе. Перекрашивать её нельзя: получаются
    // утолщения там, где удаление подошло к стене вплотную.
    if (guard !== undefined && guard[pixel] === 1) continue;
    paintWhite(result.data, pixel * 4);
  }

  return result;
}

function repairLineGaps(original: RgbaImage, cleaned: RgbaImage, removal: Uint8Array): RgbaImage {
  const result = copyOf(cleaned);

  for (let pixel = 0; pixel < removal.length; pixel += 1) {
    if (removal[pixel] !== 1) continue;
    const x = pixel % original.widthPx;
    const y = Math.floor(pixel / original.widthPx);
    if (hasLineContinuationOnBothSides(original, removal, x, y, 1, 0) ||
      hasLineContinuationOnBothSides(original, removal, x, y, 0, 1)) {
      paintBlack(result.data, pixel * 4);
    }
  }

  return result;
}

function hasLineContinuationOnBothSides(
  image: RgbaImage,
  removal: Uint8Array,
  x: number,
  y: number,
  dx: number,
  dy: number,
): boolean {
  return (
    darkRunLengthNear(image, removal, x, y, dx, dy) >= MIN_LINE_REPAIR_RUN_PX &&
    darkRunLengthNear(image, removal, x, y, -dx, -dy) >= MIN_LINE_REPAIR_RUN_PX
  );
}

function darkRunLengthNear(
  image: RgbaImage,
  removal: Uint8Array,
  x: number,
  y: number,
  dx: number,
  dy: number,
): number {
  for (let step = 1; step <= LINE_REPAIR_RADIUS_PX; step += 1) {
    const nx = x + dx * step;
    const ny = y + dy * step;
    if (nx < 0 || ny < 0 || nx >= image.widthPx || ny >= image.heightPx) return 0;
    const pixel = ny * image.widthPx + nx;
    if (removal[pixel] === 1) continue;
    if (!isDarkLinePixel(image, pixel)) return 0;
    return countDarkRun(image, nx, ny, dx, dy);
  }
  return 0;
}

function countDarkRun(
  image: RgbaImage,
  startX: number,
  startY: number,
  dx: number,
  dy: number,
): number {
  let run = 0;
  for (let step = 0; step < MIN_LINE_REPAIR_RUN_PX; step += 1) {
    const nx = startX + dx * step;
    const ny = startY + dy * step;
    if (nx < 0 || ny < 0 || nx >= image.widthPx || ny >= image.heightPx) break;
    const pixel = ny * image.widthPx + nx;
    if (!isDarkLinePixel(image, pixel)) break;
    run += 1;
  }
  return run;
}

function isDarkLinePixel(image: RgbaImage, pixel: number): boolean {
  const index = pixel * 4;
  return luminanceOf(
    image.data[index] ?? 0,
    image.data[index + 1] ?? 0,
    image.data[index + 2] ?? 0,
  ) <= DARK_LINE_LEVEL;
}

function architecturalMonochrome(image: RgbaImage): RgbaImage {
  const result = copyOf(image);

  for (let index = 0; index < result.data.length; index += 4) {
    const r = result.data[index] ?? 0;
    const g = result.data[index + 1] ?? 0;
    const b = result.data[index + 2] ?? 0;
    const luminance = luminanceOf(r, g, b);

    if (
      luminance >= MONOCHROME_BACKGROUND_LEVEL ||
      isColoredPixel(r, g, b, RESIDUAL_COLOR_THRESHOLD)
    ) {
      paintWhite(result.data, index);
    } else {
      paintBlack(result.data, index);
    }
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
      case 'erase-polygon':
        return {
          kind: 'erase-polygon',
          points: operation.points.map((point) => ({ x: point.x * factor, y: point.y * factor })),
        };
      case 'remove-component':
        return {
          ...operation,
          seed: { x: operation.seed.x * factor, y: operation.seed.y * factor },
          maxRadiusPx: operation.maxRadiusPx * factor,
        };
      case 'draw-line':
        // Линия принадлежит чертежу: и точки, и толщина считаются в его
        // точках, поэтому уменьшаются вместе с ним.
        return {
          ...operation,
          points: operation.points.map((point) => ({ x: point.x * factor, y: point.y * factor })),
          widthPx: Math.max(1, operation.widthPx * factor),
        };
      case 'erase-colored-in-area':
        // Область считается в точках чертежа, значит, пересчитывается.
        // Допуск и насыщенность — про цвет, от размера не зависят.
        return { ...operation, area: scaleArea(operation.area, factor) };
      case 'remove-small-components':
        return {
          ...operation,
          maxWidthPx: operation.maxWidthPx * factor,
          maxHeightPx: operation.maxHeightPx * factor,
          maxPixels: Math.max(1, Math.round(operation.maxPixels * factor * factor)),
        };
      default:
        // Действия с цветом от размера изображения не зависят: радиус каймы
        // задан в точках и намеренно не масштабируется — на уменьшенной копии
        // кайма тоже уже.
        return operation;
    }
  });
}

/**
 * Стирает область, обведённую от руки.
 *
 * Точка внутри многоугольника определяется лучом вправо: нечётное число
 * пересечений — внутри. Обход строк изображения ограничен рамкой обводки:
 * проверять весь чертёж ради пятна в углу незачем.
 *
 * Стирается в белый, а не в прозрачный: подложку печатают и показывают на
 * белом листе, и дыра в изображении выглядела бы чёрной.
 */
export function erasePolygon(image: RgbaImage, points: readonly PixelPoint[]): RgbaImage {
  if (points.length < 3) return copyOf(image);

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.max(0, Math.floor(Math.min(...xs)));
  const right = Math.min(image.widthPx - 1, Math.ceil(Math.max(...xs)));
  const top = Math.max(0, Math.floor(Math.min(...ys)));
  const bottom = Math.min(image.heightPx - 1, Math.ceil(Math.max(...ys)));

  const result = copyOf(image);
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      // Проверяется середина точки: по краю обводки иначе получается
      // рваная кромка — соседние точки попадают и не попадают через одну.
      if (!inPolygon(x + 0.5, y + 0.5, points)) continue;
      const at = (y * image.widthPx + x) * 4;
      result.data[at] = 255;
      result.data[at + 1] = 255;
      result.data[at + 2] = 255;
      result.data[at + 3] = 255;
    }
  }
  return result;
}

function inPolygon(x: number, y: number, polygon: readonly PixelPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (a === undefined || b === undefined) continue;
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Разбирает цвет вида «#rrggbb».
 *
 * Строкой, а не тремя числами: именно так цвет отдаёт поле выбора цвета в
 * окне, и хранить его в том же виде проще, чем переводить туда и обратно.
 * Непонятное — чёрное: линия на плане чёрная по умолчанию.
 */
function parseColor(value: string): RgbColor {
  const match = /^#?([0-9a-f]{6})$/iu.exec(value.trim());
  if (match === null) return { r: 0, g: 0, b: 0 };
  const digits = match[1] as string;
  return {
    r: Number.parseInt(digits.slice(0, 2), 16),
    g: Number.parseInt(digits.slice(2, 4), 16),
    b: Number.parseInt(digits.slice(4, 6), 16),
  };
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
      case 'erase-polygon':
        current = erasePolygon(current, operation.points);
        break;
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
      case 'remove-small-components':
        current = removeSmallComponents(current, {
          maxWidthPx: operation.maxWidthPx,
          maxHeightPx: operation.maxHeightPx,
          maxPixels: operation.maxPixels,
        });
        break;
      case 'keep-dark':
        current = keepDark(current, operation.luminanceThreshold);
        break;
      case 'rotate':
        current = rotateImage(current, operation.quarterTurns);
        break;
      case 'draw-line':
        current = drawLine(current, {
          points: operation.points,
          color: parseColor(operation.color),
          widthPx: operation.widthPx,
        });
        break;
      case 'erase-colored-in-area':
        current = eraseColoredInArea(current, {
          area: operation.area,
          color: operation.color,
          tolerance: operation.tolerance,
          saturationThreshold: operation.saturationThreshold,
          haloRadiusPx: operation.haloRadiusPx,
        });
        break;
    }
  }

  return ok(current === image ? copyOf(image) : current);
}

interface CollectedComponent {
  readonly pixels: readonly number[];
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

function collectComponent(
  ink: Uint8Array,
  guard: Uint8Array,
  visited: Uint8Array,
  widthPx: number,
  heightPx: number,
  start: number,
): CollectedComponent {
  const queue = [start];
  const pixels: number[] = [];
  visited[start] = 1;
  let minX = start % widthPx;
  let maxX = minX;
  let minY = Math.floor(start / widthPx);
  let maxY = minY;

  for (let index = 0; index < queue.length; index += 1) {
    const pixel = queue[index] ?? 0;
    pixels.push(pixel);
    const x = pixel % widthPx;
    const y = Math.floor(pixel / widthPx);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= widthPx || ny >= heightPx) continue;
        const next = ny * widthPx + nx;
        if (visited[next] === 1 || ink[next] !== 1 || guard[next] === 1) continue;
        visited[next] = 1;
        queue.push(next);
      }
    }
  }

  return { pixels, minX, minY, maxX, maxY };
}
