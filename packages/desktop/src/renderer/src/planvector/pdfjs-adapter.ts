/**
 * Переходник pdf.js → PageContent.
 *
 * У ядра PlanVector нет зависимостей, поэтому оно не читает PDF само: оно лишь
 * описывает, какие данные ему нужны. Достаёт их этот файл — единственное место,
 * где ядро встречается с конкретной библиотекой чтения PDF. Заменить pdf.js на
 * что-то другое можно, переписав только его.
 */

import type { PageContent, SourcePoint, TextItem, VectorPath } from '@izh/planvector-engine';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(outer: Matrix, inner: Matrix): Matrix {
  return [
    outer[0] * inner[0] + outer[2] * inner[1],
    outer[1] * inner[0] + outer[3] * inner[1],
    outer[0] * inner[2] + outer[2] * inner[3],
    outer[1] * inner[2] + outer[3] * inner[3],
    outer[0] * inner[4] + outer[2] * inner[5] + outer[4],
    outer[1] * inner[4] + outer[3] * inner[5] + outer[5],
  ];
}

function apply(matrix: Matrix, x: number, y: number): SourcePoint {
  return { x: matrix[0] * x + matrix[2] * y + matrix[4], y: matrix[1] * x + matrix[3] * y + matrix[5] };
}

function averageScale(matrix: Matrix): number {
  return (Math.hypot(matrix[0], matrix[1]) + Math.hypot(matrix[2], matrix[3])) / 2;
}

const OPS = pdfjs.OPS;

const STROKE_OPS = new Set<number>([
  OPS.stroke,
  OPS.closeStroke,
  OPS.fillStroke,
  OPS.eoFillStroke,
  OPS.closeFillStroke,
  OPS.closeEOFillStroke,
]);

const FILL_OPS = new Set<number>([
  OPS.fill,
  OPS.eoFill,
  OPS.fillStroke,
  OPS.eoFillStroke,
  OPS.closeFillStroke,
  OPS.closeEOFillStroke,
]);

const IMAGE_OPS = new Set<number>([
  OPS.paintImageXObject,
  OPS.paintInlineImageXObject,
  OPS.paintImageMaskXObject,
  OPS.paintImageXObjectRepeat,
]);

function toColor(args: unknown): [number, number, number] {
  if (Array.isArray(args) && typeof args[0] === 'number') {
    return [Number(args[0]), Number(args[1] ?? 0), Number(args[2] ?? 0)];
  }
  return [0, 0, 0];
}

/** Читает страницу и отдаёт ядру то, что оно просит. */
export async function readPageContent(
  document: PDFDocumentProxy,
  pageNumber: number,
): Promise<PageContent> {
  const page = await document.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const operatorList = await page.getOperatorList();
  const textContent = await page.getTextContent();

  let matrix: Matrix = IDENTITY;
  let strokeWidth = 1;
  let color: [number, number, number] = [0, 0, 0];
  const stack: { matrix: Matrix; strokeWidth: number; color: [number, number, number] }[] = [];

  const paths: VectorPath[] = [];
  let imageCount = 0;

  /** Подпути текущего пути: путь может состоять из нескольких контуров. */
  let subpaths: SourcePoint[][] = [];
  let pathStrokeWidth = 0;
  let pathColor: [number, number, number] = [0, 0, 0];

  const finish = (stroked: boolean, filled: boolean): void => {
    const paint = stroked && filled ? 'fill-stroke' : stroked ? 'stroke' : 'fill';
    for (const points of subpaths) {
      if (points.length < 2) continue;
      const first = points[0] as SourcePoint;
      const last = points[points.length - 1] as SourcePoint;
      const closed = Math.hypot(first.x - last.x, first.y - last.y) < 0.01;
      paths.push({ points, closed, paint, strokeWidth: pathStrokeWidth, color: pathColor });
    }
    subpaths = [];
  };

  for (let i = 0; i < operatorList.fnArray.length; i += 1) {
    const fn = operatorList.fnArray[i] as number;
    const args = operatorList.argsArray[i];

    if (fn === OPS.save) {
      stack.push({ matrix, strokeWidth, color });
    } else if (fn === OPS.restore) {
      const saved = stack.pop();
      if (saved !== undefined) ({ matrix, strokeWidth, color } = saved);
    } else if (fn === OPS.transform && Array.isArray(args)) {
      matrix = multiply(matrix, args as unknown as Matrix);
    } else if (fn === OPS.setLineWidth && Array.isArray(args)) {
      strokeWidth = Number(args[0] ?? 1);
    } else if (fn === OPS.setStrokeRGBColor) {
      color = toColor(args);
    } else if (IMAGE_OPS.has(fn)) {
      imageCount += 1;
    } else if (fn === OPS.constructPath && Array.isArray(args)) {
      const pathOps = args[0] as number[] | undefined;
      const coords = args[1] as ArrayLike<number> | undefined;
      if (pathOps === undefined || coords === undefined) continue;

      pathStrokeWidth = strokeWidth * averageScale(matrix);
      pathColor = color;

      let cursor = 0;
      let current: SourcePoint[] = [];

      for (const pathOp of pathOps) {
        if (pathOp === OPS.moveTo) {
          if (current.length > 1) subpaths.push(current);
          current = [apply(matrix, coords[cursor] ?? 0, coords[cursor + 1] ?? 0)];
          cursor += 2;
        } else if (pathOp === OPS.lineTo) {
          current.push(apply(matrix, coords[cursor] ?? 0, coords[cursor + 1] ?? 0));
          cursor += 2;
        } else if (pathOp === OPS.curveTo) {
          // Кривая заменяется хордой: для стен её точная форма роли не играет.
          current.push(apply(matrix, coords[cursor + 4] ?? 0, coords[cursor + 5] ?? 0));
          cursor += 6;
        } else if (pathOp === OPS.rectangle) {
          const x = coords[cursor] ?? 0;
          const y = coords[cursor + 1] ?? 0;
          const w = coords[cursor + 2] ?? 0;
          const h = coords[cursor + 3] ?? 0;
          if (current.length > 1) subpaths.push(current);
          current = [];
          subpaths.push([
            apply(matrix, x, y),
            apply(matrix, x + w, y),
            apply(matrix, x + w, y + h),
            apply(matrix, x, y + h),
            apply(matrix, x, y),
          ]);
          cursor += 4;
        } else if (pathOp === OPS.closePath) {
          const first = current[0];
          if (first !== undefined && current.length > 1) current.push(first);
        }
      }

      if (current.length > 1) subpaths.push(current);
    } else if (STROKE_OPS.has(fn) || FILL_OPS.has(fn)) {
      finish(STROKE_OPS.has(fn), FILL_OPS.has(fn));
    }
  }

  const texts: TextItem[] = [];
  for (const item of textContent.items) {
    if (!('str' in item) || typeof item.str !== 'string') continue;
    if (item.str.trim() === '') continue;
    const transform = item.transform as number[] | undefined;
    if (transform === undefined) continue;
    texts.push({
      text: item.str,
      x: transform[4] ?? 0,
      y: transform[5] ?? 0,
      width: item.width ?? 0,
      height: item.height ?? 0,
    });
  }

  page.cleanup();

  return {
    pageNumber,
    widthPt: viewport.width,
    heightPt: viewport.height,
    paths,
    texts,
    imageCount,
  };
}
