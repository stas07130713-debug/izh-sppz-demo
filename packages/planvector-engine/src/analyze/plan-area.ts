/**
 * Поиск области плана. Пункт 10 документа об архитектурной подложке.
 *
 * На листе кроме самого плана есть рамка, штамп, легенда, таблицы и
 * пояснительные блоки. Обрабатывать весь лист одинаково нельзя — именно это
 * губило ранние попытки: разлиновка таблицы и рамка легенды попадали в результат
 * наравне со стенами.
 *
 * Порядок рассуждения:
 *   1. отбрасываем то, что лежит внутри скоплений текста;
 *   2. отбрасываем рамку листа — она идёт по самому краю;
 *   3. остаётся геометрия чертежа, её охват и есть область плана.
 *
 * Результат обязательно показывается пользователю: пункт 10 требует ручной
 * коррекции, потому что надёжно угадать можно не всегда.
 */

import type { PageContent, SourceRect, VectorPath } from '../source/page-content.js';
import { rectArea, rectContains, rectOf, rectsOverlap, unionRect } from '../source/page-content.js';
import { textClusters } from './text-analysis.js';

/** Полоса вдоль края листа, где проходит рамка, доли размера страницы. */
export const PAGE_MARGIN_SHARE = 0.015;

/** Пути короче этого не участвуют в поиске области: это мелкие детали. */
const MIN_PATH_SPAN = 8;

/** Насколько близко к текстовому блоку должна лежать графика, чтобы считаться его частью. */
const GROW_GAP = 20;

/** Блок не поглощает путь, который во столько раз крупнее самого блока. */
const MAX_ABSORBED_SPAN_SHARE = 1.5;

/** Ограничение числа проходов расширения: защита от разрастания на весь лист. */
const MAX_GROW_ROUNDS = 4;

export interface PlanAreaResult {
  readonly area: SourceRect | null;
  /** Скопления текста, которые были исключены. Показываются в режиме отладки. */
  readonly excludedTextClusters: readonly SourceRect[];
  /** Сколько путей участвовало в определении области. */
  readonly usedPaths: number;
}

function spanOf(rect: SourceRect): number {
  return Math.max(rect.width, rect.height);
}

/** Путь целиком лежит в приграничной полосе — это рамка листа или штамп по краю. */
function isPageBorder(rect: SourceRect, page: PageContent): boolean {
  const marginX = page.widthPt * PAGE_MARGIN_SHARE;
  const marginY = page.heightPt * PAGE_MARGIN_SHARE;

  const touchesLeft = rect.x <= marginX;
  const touchesRight = rect.x + rect.width >= page.widthPt - marginX;
  const touchesTop = rect.y + rect.height >= page.heightPt - marginY;
  const touchesBottom = rect.y <= marginY;

  // Рамка охватывает лист целиком хотя бы по одному направлению.
  const spansWidth = rect.width >= page.widthPt * 0.9;
  const spansHeight = rect.height >= page.heightPt * 0.9;

  return (spansWidth && (touchesTop || touchesBottom)) || (spansHeight && (touchesLeft || touchesRight));
}

function isInsideAnyCluster(rect: SourceRect, clusters: readonly SourceRect[]): boolean {
  const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  return clusters.some((cluster) => rectContains(cluster, centre));
}

/**
 * Расширяет текстовые блоки на прилегающую графику.
 *
 * Легенда — это не только надписи, но и пиктограммы рядом с ними; таблица — это
 * текст плюс разлиновка. Без такого расширения графика легенды остаётся снаружи
 * блока и попадает в область плана — на этом ранние попытки и спотыкались.
 *
 * Ограничение обязательно: блок не поглощает путь крупнее себя. Иначе стена,
 * задевшая подпись помещения, утащила бы блок на весь чертёж.
 */
function growClustersOverGraphics(
  clusters: readonly SourceRect[],
  page: PageContent,
): SourceRect[] {
  const grown = clusters.map((cluster) => ({ ...cluster }));
  const paths = page.paths
    .map((path) => rectOf(path.points))
    .filter((rect): rect is SourceRect => rect !== null && spanOf(rect) >= MIN_PATH_SPAN);

  let changed = true;
  let rounds = 0;

  while (changed && rounds < MAX_GROW_ROUNDS) {
    changed = false;
    rounds += 1;

    for (let i = 0; i < grown.length; i += 1) {
      const cluster = grown[i];
      if (cluster === undefined) continue;

      for (const rect of paths) {
        if (!rectsOverlap(cluster, rect, GROW_GAP)) continue;
        // Путь крупнее самого блока — это элемент чертежа, а не часть легенды.
        if (spanOf(rect) > spanOf(cluster) * MAX_ABSORBED_SPAN_SHARE) continue;

        const merged = unionRect(cluster, rect);
        if (merged.width === cluster.width && merged.height === cluster.height) continue;

        grown[i] = merged;
        changed = true;
      }
    }
  }

  return grown;
}

/** Оставляет пути, похожие на геометрию здания. */
function candidatePaths(page: PageContent, clusters: readonly SourceRect[]): VectorPath[] {
  return page.paths.filter((path) => {
    const rect = rectOf(path.points);
    if (rect === null) return false;
    if (spanOf(rect) < MIN_PATH_SPAN) return false;
    if (isPageBorder(rect, page)) return false;
    if (isInsideAnyCluster(rect, clusters)) return false;
    return true;
  });
}

export function findPlanArea(page: PageContent): PlanAreaResult {
  const textOnly = textClusters(page.texts).map((cluster) => cluster.rect);
  const clusters = growClustersOverGraphics(textOnly, page);
  const candidates = candidatePaths(page, clusters);

  if (candidates.length === 0) {
    return { area: null, excludedTextClusters: clusters, usedPaths: 0 };
  }

  const points = candidates.flatMap((path) => path.points);
  const area = rectOf(points);

  return { area, excludedTextClusters: clusters, usedPaths: candidates.length };
}

/**
 * Насколько уверенно определена область.
 *
 * Если область заняла почти весь лист, скорее всего отделить чертёж от обвязки
 * не удалось, и пользователю нужно указать её самому.
 */
export function planAreaConfidence(area: SourceRect | null, page: PageContent): number {
  if (area === null) return 0;

  const pageArea = page.widthPt * page.heightPt;
  if (pageArea <= 0) return 0;

  const share = rectArea(area) / pageArea;
  if (share > 0.92) return 0.3;
  if (share < 0.05) return 0.4;
  return 0.8;
}

/** Пересекается ли найденная область со скоплениями текста: признак того, что
 *  легенда стоит поверх чертежа и разделить их автоматически не выйдет. */
export function overlapsText(area: SourceRect | null, clusters: readonly SourceRect[]): boolean {
  if (area === null) return false;
  return clusters.some((cluster) => rectsOverlap(area, cluster));
}
