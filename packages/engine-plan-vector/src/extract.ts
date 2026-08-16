/**
 * Извлечение геометрии из векторного PDF.
 *
 * Читает список операций отрисовки и превращает пути в отрезки в координатах
 * страницы, отслеживая стек матриц преобразования и текущий цвет.
 *
 * Ни холста, ни файлов: работает и в окне программы, и в обычном Node — поэтому
 * разбор чертежа можно проверять на настоящих файлах без запуска интерфейса.
 */

import type { AreaRect, Result } from '@izh/contracts';
import { describeUnknown, err, ok } from '@izh/contracts';
import { IDENTITY, applyToPoint, averageScale, multiply, type Matrix } from './matrix.js';
import type { RawSegment } from './segments.js';

/** То, что нужно от pdf.js. Описано интерфейсом, чтобы движок не зависел от
 *  способа, которым документ был открыт. */
export interface PdfPageSource {
  readonly widthPt: number;
  readonly heightPt: number;
  readonly fnArray: readonly number[];
  readonly argsArray: readonly unknown[];
  /** Коды операций pdf.js. */
  readonly ops: {
    readonly save: number;
    readonly restore: number;
    readonly transform: number;
    readonly setLineWidth: number;
    readonly setStrokeRGBColor: number;
    readonly constructPath: number;
    readonly moveTo: number;
    readonly lineTo: number;
    readonly curveTo: number;
    readonly rectangle: number;
    readonly closePath: number;
  };
}

export interface ExtractedPage {
  readonly widthPt: number;
  readonly heightPt: number;
  readonly segments: readonly RawSegment[];
}

type Color = readonly [number, number, number];

const BLACK: Color = [0, 0, 0];

function toColor(args: unknown): Color {
  if (Array.isArray(args) && typeof args[0] === 'number') {
    return [Number(args[0]), Number(args[1] ?? 0), Number(args[2] ?? 0)];
  }
  return BLACK;
}

/** Разбирает страницу в набор отрезков. */
export function extractSegments(page: PdfPageSource): Result<ExtractedPage> {
  try {
    const OPS = page.ops;
    let matrix: Matrix = IDENTITY;
    let lineWidth = 1;
    let color: Color = BLACK;
    const stack: { matrix: Matrix; lineWidth: number; color: Color }[] = [];
    const segments: RawSegment[] = [];

    for (let i = 0; i < page.fnArray.length; i += 1) {
      const fn = page.fnArray[i];
      const args = page.argsArray[i];

      if (fn === OPS.save) {
        stack.push({ matrix, lineWidth, color });
      } else if (fn === OPS.restore) {
        const saved = stack.pop();
        if (saved !== undefined) {
          matrix = saved.matrix;
          lineWidth = saved.lineWidth;
          color = saved.color;
        }
      } else if (fn === OPS.transform && Array.isArray(args)) {
        matrix = multiply(matrix, args as unknown as Matrix);
      } else if (fn === OPS.setLineWidth && Array.isArray(args)) {
        lineWidth = Number(args[0] ?? 1);
      } else if (fn === OPS.setStrokeRGBColor) {
        color = toColor(args);
      } else if (fn === OPS.constructPath && Array.isArray(args)) {
        const pathOps = args[0] as number[] | undefined;
        const coords = args[1] as ArrayLike<number> | undefined;
        if (pathOps === undefined || coords === undefined) continue;

        const widthPt = lineWidth * averageScale(matrix);
        let cursor = 0;
        let previous: { x: number; y: number } | null = null;
        let subpathStart: { x: number; y: number } | null = null;

        for (const pathOp of pathOps) {
          if (pathOp === OPS.moveTo) {
            previous = applyToPoint(matrix, coords[cursor] ?? 0, coords[cursor + 1] ?? 0);
            subpathStart = previous;
            cursor += 2;
          } else if (pathOp === OPS.lineTo) {
            const point = applyToPoint(matrix, coords[cursor] ?? 0, coords[cursor + 1] ?? 0);
            if (previous !== null) segments.push({ a: previous, b: point, color, lineWidthPt: widthPt });
            previous = point;
            cursor += 2;
          } else if (pathOp === OPS.curveTo) {
            // Кривая заменяется хордой: на планировках это дуги дверей и скругления,
            // и для распознавания стен их точная форма роли не играет.
            const point = applyToPoint(matrix, coords[cursor + 4] ?? 0, coords[cursor + 5] ?? 0);
            if (previous !== null) segments.push({ a: previous, b: point, color, lineWidthPt: widthPt });
            previous = point;
            cursor += 6;
          } else if (pathOp === OPS.rectangle) {
            const x = coords[cursor] ?? 0;
            const y = coords[cursor + 1] ?? 0;
            const w = coords[cursor + 2] ?? 0;
            const h = coords[cursor + 3] ?? 0;
            const corners = [
              applyToPoint(matrix, x, y),
              applyToPoint(matrix, x + w, y),
              applyToPoint(matrix, x + w, y + h),
              applyToPoint(matrix, x, y + h),
            ];
            for (let c = 0; c < 4; c += 1) {
              const from = corners[c];
              const to = corners[(c + 1) % 4];
              if (from !== undefined && to !== undefined) {
                segments.push({ a: from, b: to, color, lineWidthPt: widthPt });
              }
            }
            previous = null;
            cursor += 4;
          } else if (pathOp === OPS.closePath) {
            if (previous !== null && subpathStart !== null) {
              segments.push({ a: previous, b: subpathStart, color, lineWidthPt: widthPt });
              previous = subpathStart;
            }
          }
        }
      }
    }

    return ok({ widthPt: page.widthPt, heightPt: page.heightPt, segments });
  } catch (e) {
    return err('PDF_PARSE_FAILED', 'Не удалось разобрать геометрию чертежа.', describeUnknown(e));
  }
}

/**
 * Предполагаемая область чертежа.
 *
 * Рамка листа и штамп идут по краям страницы, поэтому от границ отступается
 * небольшая доля, а дальше берётся охват оставшихся отрезков. Пользователь
 * потом поправит область в окне сверки — это надёжнее любой догадки.
 */
export function guessDrawingArea(page: ExtractedPage, marginShare = 0.02): AreaRect {
  const marginX = page.widthPt * marginShare;
  const marginY = page.heightPt * marginShare;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const segment of page.segments) {
    for (const point of [segment.a, segment.b]) {
      if (point.x < marginX || point.x > page.widthPt - marginX) continue;
      if (point.y < marginY || point.y > page.heightPt - marginY) continue;
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
  }

  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: page.widthPt, height: page.heightPt };
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
