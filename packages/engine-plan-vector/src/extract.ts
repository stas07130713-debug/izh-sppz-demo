/**
 * Извлечение геометрии из векторного PDF.
 *
 * Читает список операций отрисовки и превращает пути в отрезки в координатах
 * страницы, отслеживая стек матриц преобразования и текущий цвет.
 *
 * Ни холста, ни файлов: работает и в окне программы, и в обычном Node — поэтому
 * разбор чертежа можно проверять на настоящих файлах без запуска интерфейса.
 */

import type { AreaRect, Point2D, Result } from '@izh/contracts';
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
  /** Операции, которые обводят путь линией. */
  readonly strokePaintOps: readonly number[];
  /** Операции, которые заливают путь. */
  readonly fillPaintOps: readonly number[];
}

/**
 * Залитая полоса: тонкий вытянутый четырёхугольник.
 *
 * В чертежах из САПР стена часто нарисована не двумя линиями, а сплошной
 * заливкой. Такая полоса сразу даёт и осевую линию, и толщину.
 */
export interface FilledBar {
  readonly a: Point2D;
  readonly b: Point2D;
  readonly thicknessPt: number;
  readonly color: readonly [number, number, number];
}

export interface ExtractedPage {
  readonly widthPt: number;
  readonly heightPt: number;
  /** Отрезки обведённых путей: это настоящие линии чертежа. */
  readonly segments: readonly RawSegment[];
  /** Залитые полосы — кандидаты в стены. */
  readonly bars: readonly FilledBar[];
  /** Сколько залитых путей отброшено как не полосы: заливка, штриховка, буквы. */
  readonly discardedFills: number;
}

type Color = readonly [number, number, number];

const BLACK: Color = [0, 0, 0];

function toColor(args: unknown): Color {
  if (Array.isArray(args) && typeof args[0] === 'number') {
    return [Number(args[0]), Number(args[1] ?? 0), Number(args[2] ?? 0)];
  }
  return BLACK;
}

/** Тоньше этого обводка на чертеже не видна: рисунок задаёт заливка. */
const MIN_VISIBLE_STROKE_PT = 0.1;

/** Толще этого залитая полоса уже не похожа на стену, в пунктах. */
const MAX_BAR_THICKNESS_PT = 16;

/** Во сколько раз полоса должна быть длиннее своей толщины. */
const MIN_BAR_ASPECT = 2.5;

/**
 * Пробует увидеть в замкнутом контуре тонкую вытянутую полосу.
 *
 * Возвращает пусто, если это не полоса: заливка сложной формы, треугольник
 * из мозаики, буква, обведённая контуром. Такие фигуры не несут сведений о
 * здании, и попытка соединить их вершины подряд как раз и даёт то месиво
 * диагоналей, из-за которого первая перерисовка оказалась нечитаемой.
 */
function barFromOutline(points: readonly Point2D[], color: Color): FilledBar | null {
  const unique: Point2D[] = [];
  for (const point of points) {
    const last = unique[unique.length - 1];
    if (last !== undefined && Math.hypot(point.x - last.x, point.y - last.y) < 0.01) continue;
    unique.push(point);
  }
  if (unique.length > 0) {
    const first = unique[0] as Point2D;
    const last = unique[unique.length - 1] as Point2D;
    if (unique.length > 1 && Math.hypot(first.x - last.x, first.y - last.y) < 0.01) unique.pop();
  }
  if (unique.length !== 4) return null;

  // У полосы две пары противоположных сторон: длинные и короткие.
  const sides = unique.map((point, index) => {
    const next = unique[(index + 1) % unique.length] as Point2D;
    return { from: point, to: next, length: Math.hypot(next.x - point.x, next.y - point.y) };
  });

  const ordered = [...sides].sort((first, second) => second.length - first.length);
  const longFirst = ordered[0];
  const longSecond = ordered[1];
  const shortFirst = ordered[2];
  const shortSecond = ordered[3];
  if (longFirst === undefined || longSecond === undefined || shortFirst === undefined || shortSecond === undefined) {
    return null;
  }

  const longLength = (longFirst.length + longSecond.length) / 2;
  const thickness = (shortFirst.length + shortSecond.length) / 2;
  if (thickness < 0.2 || thickness > MAX_BAR_THICKNESS_PT) return null;
  if (longLength < thickness * MIN_BAR_ASPECT) return null;

  // Осевая линия — середины коротких сторон.
  const midOf = (side: { from: Point2D; to: Point2D }): Point2D => ({
    x: (side.from.x + side.to.x) / 2,
    y: (side.from.y + side.to.y) / 2,
  });

  return { a: midOf(shortFirst), b: midOf(shortSecond), thicknessPt: thickness, color };
}

/** Разбирает страницу: обведённые линии и залитые полосы отдельно. */
export function extractSegments(page: PdfPageSource): Result<ExtractedPage> {
  try {
    const OPS = page.ops;
    const strokePaint = new Set(page.strokePaintOps);
    const fillPaint = new Set(page.fillPaintOps);

    let matrix: Matrix = IDENTITY;
    let lineWidth = 1;
    let color: Color = BLACK;
    const stack: { matrix: Matrix; lineWidth: number; color: Color }[] = [];
    const segments: RawSegment[] = [];
    const bars: FilledBar[] = [];
    let discardedFills = 0;

    /** Подпути текущего пути: путь может состоять из нескольких контуров. */
    let subpaths: Point2D[][] = [];
    let currentWidthPt = 0;
    let currentColor: Color = BLACK;

    const finishPath = (stroked: boolean, filled: boolean): void => {
      for (const points of subpaths) {
        if (points.length < 2) continue;

        if (stroked) {
          for (let i = 1; i < points.length; i += 1) {
            const from = points[i - 1] as Point2D;
            const to = points[i] as Point2D;
            segments.push({ a: from, b: to, color: currentColor, lineWidthPt: currentWidthPt });
          }
        } else if (filled) {
          const bar = barFromOutline(points, currentColor);
          if (bar !== null) bars.push(bar);
          else discardedFills += 1;
        }
      }
      subpaths = [];
    };

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

        currentWidthPt = lineWidth * averageScale(matrix);
        currentColor = color;

        let cursor = 0;
        let current: Point2D[] = [];

        const startNew = (point: Point2D): void => {
          if (current.length > 1) subpaths.push(current);
          current = [point];
        };

        for (const pathOp of pathOps) {
          if (pathOp === OPS.moveTo) {
            startNew(applyToPoint(matrix, coords[cursor] ?? 0, coords[cursor + 1] ?? 0));
            cursor += 2;
          } else if (pathOp === OPS.lineTo) {
            current.push(applyToPoint(matrix, coords[cursor] ?? 0, coords[cursor + 1] ?? 0));
            cursor += 2;
          } else if (pathOp === OPS.curveTo) {
            // Кривая заменяется хордой: на планировках это дуги дверей и
            // скругления, и для распознавания стен их точная форма роли не играет.
            current.push(applyToPoint(matrix, coords[cursor + 4] ?? 0, coords[cursor + 5] ?? 0));
            cursor += 6;
          } else if (pathOp === OPS.rectangle) {
            const x = coords[cursor] ?? 0;
            const y = coords[cursor + 1] ?? 0;
            const w = coords[cursor + 2] ?? 0;
            const h = coords[cursor + 3] ?? 0;
            if (current.length > 1) subpaths.push(current);
            current = [];
            subpaths.push([
              applyToPoint(matrix, x, y),
              applyToPoint(matrix, x + w, y),
              applyToPoint(matrix, x + w, y + h),
              applyToPoint(matrix, x, y + h),
              applyToPoint(matrix, x, y),
            ]);
            cursor += 4;
          } else if (pathOp === OPS.closePath) {
            const first = current[0];
            if (first !== undefined && current.length > 1) current.push(first);
          }
        }

        if (current.length > 1) subpaths.push(current);
      } else if (typeof fn === 'number' && (strokePaint.has(fn) || fillPaint.has(fn))) {
        // Обводка нулевой толщины на чертеже не видна — видна заливка. Именно
        // такие пути и оказались мозаикой из треугольников, которая при
        // соединении вершин подряд превращала перерисовку в месиво.
        const strokeIsVisible = strokePaint.has(fn) && currentWidthPt >= MIN_VISIBLE_STROKE_PT;
        finishPath(strokeIsVisible, !strokeIsVisible && fillPaint.has(fn));
      }
    }

    return ok({ widthPt: page.widthPt, heightPt: page.heightPt, segments, bars, discardedFills });
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

  const points: { x: number; y: number }[] = [];
  for (const segment of page.segments) points.push(segment.a, segment.b);
  for (const bar of page.bars) points.push(bar.a, bar.b);

  {
    for (const point of points) {
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
