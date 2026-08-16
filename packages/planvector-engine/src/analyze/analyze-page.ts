/**
 * Анализ источника. Пункт 5 ТЗ.
 *
 * Определяет, с чем мы имеем дело: векторный чертёж или скан, есть ли текстовый
 * слой, где область плана, известен ли масштаб, какой профиль распознавания
 * применять. От этого зависит весь дальнейший конвейер, поэтому анализ идёт
 * отдельным шагом и его результат показывается пользователю.
 */

import type { DocumentAnalysis } from '../api.js';
import type { PageContent } from '../source/page-content.js';
import { findPlanArea, planAreaConfidence } from './plan-area.js';
import { detectProfile, scaleFromText } from './text-analysis.js';

/** Столько видимых путей достаточно, чтобы считать страницу векторной. */
export const VECTOR_PATH_THRESHOLD = 20;

/** Столько надписей достаточно, чтобы считать текстовый слой пригодным. */
export const TEXT_LAYER_THRESHOLD = 5;

export interface PageAnalysis extends DocumentAnalysis {
  /** Насколько можно доверять найденной области плана, от 0 до 1. */
  readonly planAreaConfidence: number;
  /** Скопления текста, исключённые из области плана. Режим отладки, пункт 20. */
  readonly textClusters: readonly { x: number; y: number; width: number; height: number }[];
}

export function analyzePage(page: PageContent): PageAnalysis {
  const visiblePaths = page.paths.filter(
    (path) => path.points.length >= 2 && (path.paint !== 'stroke' || path.strokeWidth > 0),
  );

  const hasVectorGeometry = visiblePaths.length >= VECTOR_PATH_THRESHOLD;
  const hasTextLayer = page.texts.length >= TEXT_LAYER_THRESHOLD;

  const planArea = findPlanArea(page);
  const scaleDenominator = scaleFromText(page.texts);

  return {
    pageNumber: page.pageNumber,
    widthPt: page.widthPt,
    heightPt: page.heightPt,
    hasVectorGeometry,
    hasTextLayer,
    textItemCount: page.texts.length,
    vectorPathCount: visiblePaths.length,
    imageCount: page.imageCount,
    planArea: planArea.area,
    scaleFromText: scaleDenominator,
    recommendedProfile: detectProfile(page.texts),
    planAreaConfidence: planAreaConfidence(planArea.area, page),
    textClusters: planArea.excludedTextClusters,
  };
}

/**
 * Нужна ли растеризация.
 *
 * Пункт 5 ТЗ прямо запрещает лишнюю растеризацию, когда в документе есть
 * векторная геометрия: разбирать её напрямую и точнее, и быстрее.
 */
export function needsRasterPipeline(analysis: PageAnalysis): boolean {
  return !analysis.hasVectorGeometry;
}
