/**
 * Движок E1В «Перерисовка планировки».
 *
 * Берёт векторный PDF и строит по нему данные о здании: стены с толщиной,
 * перегородки, линии, подписи. Это не очистка картинки — это чертёж, прочитанный
 * заново и нарисованный своими средствами.
 *
 * Движок не зависит ни от растрового движка подложек, ни от ядра, ни от
 * интерфейса. Работает и в окне программы, и в обычном Node — поэтому правила
 * разбора проверяются на настоящих чертежах без запуска интерфейса.
 */

import type { AreaRect, DrawnElement, DrawnLabel, PlanDrawing, Result } from '@izh/contracts';
import { ok } from '@izh/contracts';
import { extractSegments, guessDrawingArea, type ExtractedPage, type PdfPageSource } from './extract.js';
import { selectStructural } from './segments.js';
import { classifyLeftovers, pairIntoWalls } from './walls.js';

export interface RedrawInput {
  readonly backdropId: string;
  readonly area: AreaRect;
  readonly labels: readonly DrawnLabel[];
  readonly createdAt: string;
  readonly makeId: () => string;
}

export interface RedrawStats {
  readonly rawSegments: number;
  readonly structuralSegments: number;
  readonly walls: number;
  readonly partitions: number;
  readonly lines: number;
}

/** Собирает планировку из уже извлечённых отрезков. Чистая функция. */
export function buildDrawing(
  page: ExtractedPage,
  input: RedrawInput,
): { drawing: PlanDrawing; stats: RedrawStats } {
  const structural = selectStructural(page.segments, input.area);
  const { walls, leftovers } = pairIntoWalls(structural, input.makeId);
  const rest = classifyLeftovers(leftovers, input.makeId);
  const elements: DrawnElement[] = [...walls, ...rest];

  return {
    drawing: {
      backdropId: input.backdropId,
      area: input.area,
      elements,
      labels: input.labels,
      createdAt: input.createdAt,
    },
    stats: {
      rawSegments: page.segments.length,
      structuralSegments: structural.length,
      walls: walls.length,
      partitions: rest.filter((element) => element.kind === 'partition').length,
      lines: rest.filter((element) => element.kind === 'line').length,
    },
  };
}

/** Полный проход: страница PDF → планировка. */
export function redrawFromPdfPage(
  page: PdfPageSource,
  input: Omit<RedrawInput, 'area'> & { area?: AreaRect },
): Result<{ drawing: PlanDrawing; stats: RedrawStats; page: ExtractedPage }> {
  const extracted = extractSegments(page);
  if (!extracted.ok) return extracted;

  const area = input.area ?? guessDrawingArea(extracted.value);
  const built = buildDrawing(extracted.value, { ...input, area });
  return ok({ ...built, page: extracted.value });
}

export { extractSegments, guessDrawingArea } from './extract.js';
export type { ExtractedPage, PdfPageSource } from './extract.js';
export { renderPlanSvg, type RenderOptions } from './render-svg.js';
export { selectStructural, mergeCollinear, isStructural, lengthOf } from './segments.js';
export type { RawSegment } from './segments.js';
export { pairIntoWalls, classifyLeftovers } from './walls.js';
