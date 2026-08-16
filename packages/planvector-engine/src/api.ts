/**
 * Внешний интерфейс ядра. Пункт 22 ТЗ.
 *
 * Основная программа обращается только сюда и не знает, что внутри. Благодаря
 * этому ядро можно переписать целиком или выделить в самостоятельный продукт,
 * не трогая приложение.
 *
 * Все действия возвращают результат значением, а не бросают исключения:
 * пункт 24 требует при частичном распознавании выдавать пригодный для правки
 * результат, а не падать.
 */

import type { PlanModel } from './model/plan-model.js';
import type { ValidationReport } from './model/validate.js';

export type EngineErrorCode =
  | 'UNSUPPORTED_FORMAT'
  | 'PARSE_FAILED'
  | 'NOT_ENOUGH_GEOMETRY'
  | 'SCALE_UNKNOWN'
  | 'INTERNAL';

export interface EngineError {
  readonly code: EngineErrorCode;
  readonly message: string;
  readonly details?: string;
}

export type EngineResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: EngineError };

export function engineOk<T>(value: T): EngineResult<T> {
  return { ok: true, value };
}

export function engineErr<T>(code: EngineErrorCode, message: string, details?: string): EngineResult<T> {
  return { ok: false, error: details === undefined ? { code, message } : { code, message, details } };
}

/** Загруженный документ до разбора. */
export interface ImportedDocument {
  readonly fileName: string;
  readonly contentHash: string;
  readonly kind: 'pdf' | 'image' | 'cad';
  readonly pageCount: number;
  readonly bytes: Uint8Array;
}

/** Итог анализа источника. Пункт 5 ТЗ. */
export interface DocumentAnalysis {
  readonly pageNumber: number;
  readonly widthPt: number;
  readonly heightPt: number;
  /** Есть ли в документе настоящая векторная геометрия. Если да, пункт 5
   *  запрещает лишнюю растеризацию. */
  readonly hasVectorGeometry: boolean;
  readonly hasTextLayer: boolean;
  readonly textItemCount: number;
  readonly vectorPathCount: number;
  readonly imageCount: number;
  /** Предполагаемая область плана без рамки, штампа и легенды. */
  readonly planArea: { x: number; y: number; width: number; height: number } | null;
  /** Масштаб, найденный в тексте, например «М 1:100». */
  readonly scaleFromText: number | null;
  readonly recommendedProfile: PlanModel['profile'];
}

export interface RecognizeOptions {
  readonly profile: PlanModel['profile'];
  /** Область плана, если пользователь указал её сам. */
  readonly planArea?: { x: number; y: number; width: number; height: number };
  /** Сообщения о ходе работы. Пункт 17 требует показывать прогресс. */
  readonly onProgress?: (stage: string, share: number) => void;
}

export interface CalibrateInput {
  readonly method: 'two-points' | 'building-extents' | 'text' | 'dimension-line';
  readonly metersPerSourceUnit: number;
  readonly confirmedByUser: boolean;
  readonly note?: string;
}

/** Сериализованная модель для файла .planmodel. */
export interface ExportedModel {
  readonly format: 'planmodel';
  readonly version: number;
  readonly json: string;
}

/**
 * Ядро реконструкции планов.
 *
 * Реализация появляется этапами по пункту 28 ТЗ. Интерфейс описан целиком
 * заранее, чтобы приложение могло строиться вокруг него, не дожидаясь всех
 * этапов.
 */
export interface PlanVectorEngine {
  readonly name: string;
  readonly version: string;

  importDocument(bytes: Uint8Array, fileName: string): Promise<EngineResult<ImportedDocument>>;

  analyzeDocument(
    document: ImportedDocument,
    pageNumber: number,
  ): Promise<EngineResult<DocumentAnalysis>>;

  recognizePlan(
    document: ImportedDocument,
    analysis: DocumentAnalysis,
    options: RecognizeOptions,
  ): Promise<EngineResult<PlanModel>>;

  calibrateScale(model: PlanModel, input: CalibrateInput): EngineResult<PlanModel>;

  validateModel(model: PlanModel): ValidationReport;

  exportPlanModel(model: PlanModel): EngineResult<ExportedModel>;
}
