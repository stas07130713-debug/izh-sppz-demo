/**
 * Сборка модели этажа из страницы документа.
 *
 * Соединяет уже готовые этапы в одну цепочку: анализ, трассировка, стены. Это
 * тот вход, которым пользуется основная программа, чтобы получить PlanModel и
 * показать её в окне сверки.
 */

import type { PageContent, SourceRect } from '../source/page-content.js';
import type { PlanModel, SourceRef } from '../model/plan-model.js';
import { createEmptyPlanModel, withHistory } from '../model/plan-model.js';
import { analyzePage, type PageAnalysis } from '../analyze/analyze-page.js';
import { textBoxes } from '../analyze/text-analysis.js';
import { traceSegments, type TraceResult } from './trace-segments.js';
import { buildWalls, type BuildWallsResult } from './build-walls.js';

export interface RecognizeInput {
  readonly page: PageContent;
  readonly source: SourceRef;
  readonly createdAt: string;
  readonly makeId: () => string;
  /** Область плана, если пользователь указал её сам. */
  readonly planArea?: SourceRect;
}

export interface RecognizeOutcome {
  readonly model: PlanModel;
  readonly analysis: PageAnalysis;
  readonly trace: TraceResult['stats'];
  readonly walls: BuildWallsResult['stats'];
}

/**
 * Полный проход по векторному документу.
 *
 * Для скана вернёт модель без элементов: растровый путь ещё не реализован, и
 * притворяться, что он есть, нельзя. Пункт 24 ТЗ требует в таком случае выдавать
 * пригодный для правки результат, а не падать с ошибкой.
 */
export function recognizeFloor(input: RecognizeInput): RecognizeOutcome {
  const analysis = analyzePage(input.page);
  const area = input.planArea ?? analysis.planArea;

  const base = createEmptyPlanModel({
    id: input.makeId(),
    createdAt: input.createdAt,
    source: { ...input.source, area: area ?? null },
    profile: analysis.recommendedProfile,
  });

  // Разбирается любая имеющаяся геометрия, сколько бы её ни было. Признак
  // hasVectorGeometry говорит лишь о том, насколько документ векторный, и
  // служит советом пользователю, а не запретом на разбор: у простого плана
  // путей может быть немного, и это не повод отказываться от них.
  if (analysis.vectorPathCount === 0 || area === null) {
    const reason =
      analysis.vectorPathCount === 0
        ? 'В документе нет векторной геометрии: нужен растровый разбор, он ещё не реализован.'
        : 'Не удалось определить область плана — укажите её вручную.';

    return {
      model: withHistory(base, { at: input.createdAt, stage: 'распознавание', summary: reason }),
      analysis,
      trace: {
        pathsTotal: input.page.paths.length,
        droppedOutsideArea: 0,
        droppedInsideText: 0,
        droppedFills: 0,
        barsFound: 0,
        beforeMerge: 0,
        afterMerge: 0,
      },
      walls: { fromBars: 0, fromPairs: 0, partitions: 0, exterior: 0, needsReview: 0 },
    };
  }

  const trace = traceSegments({
    page: input.page,
    planArea: area,
    excludedRects: textBoxes(input.page.texts),
  });

  const walls = buildWalls({ segments: trace.segments, makeId: input.makeId });

  const floor = base.building.floors[0];
  if (floor === undefined) throw new Error('в новой модели нет этажа');

  const model: PlanModel = {
    ...base,
    building: {
      ...base.building,
      floors: [{ ...floor, elements: walls.elements }],
    },
  };

  const summary =
    `отрезков ${trace.stats.afterMerge}, стен ${walls.stats.fromBars + walls.stats.fromPairs}, ` +
    `перегородок ${walls.stats.partitions}, требуют проверки ${walls.stats.needsReview}`;

  return {
    model: withHistory(model, { at: input.createdAt, stage: 'распознавание', summary }),
    analysis,
    trace: trace.stats,
    walls: walls.stats,
  };
}
