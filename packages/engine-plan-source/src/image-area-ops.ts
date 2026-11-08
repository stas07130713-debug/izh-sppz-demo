/**
 * Поворот чертежа и стирание цвета внутри выделенной области.
 *
 * Оба действия появились из одной жалобы на живой чертёж: план приходит
 * лежащим на боку и с чужой цветной разметкой поверх планировки. Разворачивать
 * лист в стороннем редакторе и там же вытирать стрелки — работа, которую
 * программа должна делать сама.
 */

import type { CleanupOperation, EraseArea, PixelPoint, PixelRect, RgbaImage, RgbColor } from '@izh/contracts';
import { dilateMask, isColoredPixel } from './color-mask.js';

/**
 * Поворот на четверть оборота по часовой стрелке, столько раз, сколько сказано.
 *
 * Считается прямым перекладыванием точек, без промежуточных значений: при
 * повороте на прямой угол каждая точка попадает ровно в другую точку. Поэтому
 * чертёж не мутнеет, сколько его ни крути, и поворот туда-обратно возвращает
 * исходный файл точка в точку.
 */
export function rotateImage(image: RgbaImage, quarterTurns: number): RgbaImage {
  const turns = ((Math.round(quarterTurns) % 4) + 4) % 4;
  if (turns === 0) return { ...image, data: new Uint8ClampedArray(image.data) };

  const swapped = turns % 2 === 1;
  const width = swapped ? image.heightPx : image.widthPx;
  const height = swapped ? image.widthPx : image.heightPx;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < image.heightPx; y += 1) {
    for (let x = 0; x < image.widthPx; x += 1) {
      // Куда переезжает точка (x, y) при повороте по часовой стрелке.
      const to = turns === 1
        ? { x: image.heightPx - 1 - y, y: x }
        : turns === 2
          ? { x: image.widthPx - 1 - x, y: image.heightPx - 1 - y }
          : { x: y, y: image.widthPx - 1 - x };

      const from = (y * image.widthPx + x) * 4;
      const at = (to.y * width + to.x) * 4;
      data[at] = image.data[from] ?? 255;
      data[at + 1] = image.data[from + 1] ?? 255;
      data[at + 2] = image.data[from + 2] ?? 255;
      data[at + 3] = image.data[from + 3] ?? 255;
    }
  }

  return { widthPx: width, heightPx: height, data };
}

export interface EraseColoredInAreaOptions {
  readonly area: EraseArea;
  readonly color: RgbColor | null;
  readonly tolerance: number;
  readonly saturationThreshold: number;
  readonly haloRadiusPx: number;
}

/**
 * Стирает цветное внутри области, оставляя чёрные линии здания.
 *
 * Кайма сглаживания снимается расширением маски: иначе на месте фиолетовой
 * стрелки остаётся её бледный призрак. Расширение не выходит за область — вред
 * ограничен ровно тем, что человек обвёл.
 */
export function eraseColoredInArea(image: RgbaImage, options: EraseColoredInAreaOptions): RgbaImage {
  const box = boundsOf(options.area, image);
  if (box === null) return { ...image, data: new Uint8ClampedArray(image.data) };

  const inside = new Uint8Array(image.widthPx * image.heightPx);
  const removal = new Uint8Array(image.widthPx * image.heightPx);

  for (let y = box.top; y <= box.bottom; y += 1) {
    for (let x = box.left; x <= box.right; x += 1) {
      if (!inArea(options.area, x, y)) continue;
      const at = y * image.widthPx + x;
      inside[at] = 1;

      const index = at * 4;
      const r = image.data[index] ?? 255;
      const g = image.data[index + 1] ?? 255;
      const b = image.data[index + 2] ?? 255;
      if (doomed(r, g, b, options)) removal[at] = 1;
    }
  }

  const grown = options.haloRadiusPx > 0
    ? dilateMask(removal, image.widthPx, image.heightPx, options.haloRadiusPx)
    : removal;

  const data = new Uint8ClampedArray(image.data);
  for (let at = 0; at < grown.length; at += 1) {
    // Расширенная маска обрезается областью: за обведённым не трогаем ничего.
    if (grown[at] !== 1 || inside[at] !== 1) continue;
    const index = at * 4;
    data[index] = 255;
    data[index + 1] = 255;
    data[index + 2] = 255;
    data[index + 3] = 255;
  }

  return { widthPx: image.widthPx, heightPx: image.heightPx, data };
}

function doomed(r: number, g: number, b: number, options: EraseColoredInAreaOptions): boolean {
  if (options.color === null) return isColoredPixel(r, g, b, options.saturationThreshold);
  const limit = Math.max(0, options.tolerance);
  return Math.max(
    Math.abs(r - options.color.r),
    Math.abs(g - options.color.g),
    Math.abs(b - options.color.b),
  ) <= limit;
}

interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

function boundsOf(area: EraseArea, image: RgbaImage): Box | null {
  const points = area.kind === 'rect' ? cornersOf(area.rect) : area.points;
  if (points.length === 0) return null;

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const box = {
    left: Math.max(0, Math.floor(Math.min(...xs))),
    top: Math.max(0, Math.floor(Math.min(...ys))),
    right: Math.min(image.widthPx - 1, Math.ceil(Math.max(...xs))),
    bottom: Math.min(image.heightPx - 1, Math.ceil(Math.max(...ys))),
  };
  return box.right < box.left || box.bottom < box.top ? null : box;
}

function cornersOf(rect: PixelRect): readonly PixelPoint[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.widthPx, y: rect.y + rect.heightPx },
  ];
}

function inArea(area: EraseArea, x: number, y: number): boolean {
  if (area.kind === 'rect') {
    return x + 0.5 >= area.rect.x && x + 0.5 <= area.rect.x + area.rect.widthPx
      && y + 0.5 >= area.rect.y && y + 0.5 <= area.rect.y + area.rect.heightPx;
  }
  return inPolygon(x + 0.5, y + 0.5, area.points);
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

/** Пересчитывает область под другой размер изображения — для предпросмотра. */
export function scaleArea(area: EraseArea, factor: number): EraseArea {
  if (area.kind === 'rect') {
    return {
      kind: 'rect',
      rect: {
        x: area.rect.x * factor,
        y: area.rect.y * factor,
        widthPx: area.rect.widthPx * factor,
        heightPx: area.rect.heightPx * factor,
      },
    };
  }
  return { kind: 'polygon', points: area.points.map((point) => ({ x: point.x * factor, y: point.y * factor })) };
}

/** Меняет ли действие размеры чертежа. Нужно, чтобы вовремя сбросить разметку. */
export function changesExtent(operation: CleanupOperation): boolean {
  if (operation.kind === 'crop') return true;
  return operation.kind === 'rotate' && operation.quarterTurns % 2 === 1;
}

/**
 * Рисует ломаную поверх чертежа.
 *
 * Линия кладётся кистью круглой формы вдоль каждого звена: так у неё нет
 * рваных концов и изломов на стыках, а рисование от руки и прямая линия
 * получаются одним и тем же кодом — разница только в числе точек.
 *
 * Сглаживания нет намеренно. Чертёж чёрно-белый и печатается; полупрозрачная
 * кромка на печати превращается в серую бахрому, а линия на плане должна быть
 * такой же чёткой, как остальные линии здания.
 */
export function drawLine(image: RgbaImage, options: DrawLineOptions): RgbaImage {
  const data = new Uint8ClampedArray(image.data);
  const radius = Math.max(0.5, options.widthPx / 2);
  const color = options.color;

  const stamp = (cx: number, cy: number): void => {
    const from = { x: Math.floor(cx - radius), y: Math.floor(cy - radius) };
    const to = { x: Math.ceil(cx + radius), y: Math.ceil(cy + radius) };
    for (let y = Math.max(0, from.y); y <= Math.min(image.heightPx - 1, to.y); y += 1) {
      for (let x = Math.max(0, from.x); x <= Math.min(image.widthPx - 1, to.x); x += 1) {
        // Точка (10, 10) — это середина точки чертежа с такими же номерами,
        // а не её угол. Иначе линия толщиной в одну точку не закрашивала бы
        // ничего: центр кисти оказывался бы ровно между четырьмя точками.
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > radius * radius) continue;
        const at = (y * image.widthPx + x) * 4;
        data[at] = color.r;
        data[at + 1] = color.g;
        data[at + 2] = color.b;
        data[at + 3] = 255;
      }
    }
  };

  if (options.points.length === 1) {
    const only = options.points[0];
    if (only !== undefined) stamp(only.x, only.y);
    return { widthPx: image.widthPx, heightPx: image.heightPx, data };
  }

  for (let index = 1; index < options.points.length; index += 1) {
    const a = options.points[index - 1];
    const b = options.points[index];
    if (a === undefined || b === undefined) continue;

    // Шаг в половину кисти: реже — и линия распадётся на бусины, чаще —
    // напрасная работа, точки всё равно лягут одна на другую.
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(length / Math.max(0.5, radius / 2)));
    for (let step = 0; step <= steps; step += 1) {
      const part = step / steps;
      stamp(a.x + (b.x - a.x) * part, a.y + (b.y - a.y) * part);
    }
  }

  return { widthPx: image.widthPx, heightPx: image.heightPx, data };
}

export interface DrawLineOptions {
  readonly points: readonly PixelPoint[];
  readonly color: RgbColor;
  readonly widthPx: number;
}
