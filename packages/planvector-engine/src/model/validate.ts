/**
 * Проверка целостности модели. Пункт 27 ТЗ: качество нельзя принимать по
 * визуальному впечатлению, нужны отдельные проверяемые признаки.
 *
 * Проверка не «чинит» модель и ничего не выбрасывает. Она сообщает, что не так,
 * а решение принимает человек — это прямо следует из пункта 25: цель первой
 * версии не абсолютная автоматика, а автоматика плюс проверка человеком.
 */

import { areaOf, lengthOf, perimeterOf } from './geometry.js';
import type { PlanModel } from './plan-model.js';
import { MODEL_VERSION } from './plan-model.js';

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  readonly severity: IssueSeverity;
  /** Короткий код для отбора и подсчёта. */
  readonly code: string;
  readonly message: string;
  /** Объект модели, к которому относится замечание. */
  readonly elementId: string | null;
}

export interface ValidationReport {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly counts: {
    readonly elements: number;
    readonly rooms: number;
    readonly lowConfidence: number;
  };
}

/** Ниже этой уверенности объект требует обязательной проверки. Пункт 13 ТЗ. */
export const LOW_CONFIDENCE = 0.5;

/** Расхождение площади и геометрии, которое считается ошибкой расчёта. */
const AREA_TOLERANCE_SHARE = 0.01;

export function validatePlanModel(model: PlanModel): ValidationReport {
  const issues: ValidationIssue[] = [];
  let elements = 0;
  let rooms = 0;
  let lowConfidence = 0;

  if (model.version !== MODEL_VERSION) {
    issues.push({
      severity: 'error',
      code: 'VERSION_MISMATCH',
      message: `Модель версии ${model.version}, программа работает с версией ${MODEL_VERSION}. Нужна миграция.`,
      elementId: null,
    });
  }

  if (model.units === 'meters' && model.scale.metersPerSourceUnit === null) {
    issues.push({
      severity: 'error',
      code: 'SCALE_MISSING',
      message: 'Модель объявлена в метрах, но масштаб не задан.',
      elementId: null,
    });
  }

  if (model.scale.metersPerSourceUnit !== null && !model.scale.confirmedByUser) {
    issues.push({
      severity: 'warning',
      code: 'SCALE_UNCONFIRMED',
      message: 'Масштаб определён автоматически и не подтверждён пользователем.',
      elementId: null,
    });
  }

  const seenIds = new Set<string>();

  for (const floor of model.building.floors) {
    for (const element of floor.elements) {
      elements += 1;

      if (seenIds.has(element.id)) {
        issues.push({
          severity: 'error',
          code: 'DUPLICATE_ID',
          message: `Повторяющийся идентификатор ${element.id}.`,
          elementId: element.id,
        });
      }
      seenIds.add(element.id);

      if (element.confidence < 0 || element.confidence > 1) {
        issues.push({
          severity: 'error',
          code: 'CONFIDENCE_RANGE',
          message: 'Уверенность должна быть от 0 до 1.',
          elementId: element.id,
        });
      } else if (element.confidence < LOW_CONFIDENCE && element.provenance === 'recognized') {
        lowConfidence += 1;
        issues.push({
          severity: 'warning',
          code: 'LOW_CONFIDENCE',
          message: 'Низкая уверенность распознавания, нужна проверка.',
          elementId: element.id,
        });
      }

      if (element.provenance === 'manual' && element.confidence !== 1) {
        issues.push({
          severity: 'warning',
          code: 'MANUAL_CONFIDENCE',
          message: 'Объект поставлен человеком, уверенность должна быть единицей.',
          elementId: element.id,
        });
      }

      if (element.geometry === 'segment' && lengthOf(element.segment) <= 0) {
        issues.push({
          severity: 'error',
          code: 'ZERO_LENGTH',
          message: 'Нулевая длина объекта.',
          elementId: element.id,
        });
      }

      if (element.geometry === 'polygon' && element.polygon.points.length < 3) {
        issues.push({
          severity: 'error',
          code: 'BAD_POLYGON',
          message: 'Контур объекта содержит меньше трёх точек.',
          elementId: element.id,
        });
      }
    }

    for (const room of floor.rooms) {
      rooms += 1;

      if (seenIds.has(room.id)) {
        issues.push({
          severity: 'error',
          code: 'DUPLICATE_ID',
          message: `Повторяющийся идентификатор ${room.id}.`,
          elementId: room.id,
        });
      }
      seenIds.add(room.id);

      if (room.polygon.points.length < 3) {
        issues.push({
          severity: 'error',
          code: 'ROOM_NOT_CLOSED',
          message: 'Контур помещения не замкнут.',
          elementId: room.id,
        });
        continue;
      }

      const computedArea = areaOf(room.polygon);
      if (computedArea <= 0) {
        issues.push({
          severity: 'error',
          code: 'ROOM_ZERO_AREA',
          message: 'Нулевая площадь помещения.',
          elementId: room.id,
        });
      } else if (Math.abs(room.area - computedArea) / computedArea > AREA_TOLERANCE_SHARE) {
        issues.push({
          severity: 'error',
          code: 'ROOM_AREA_MISMATCH',
          message: 'Записанная площадь не совпадает с геометрией контура.',
          elementId: room.id,
        });
      }

      const computedPerimeter = perimeterOf(room.polygon);
      if (computedPerimeter > 0 && Math.abs(room.perimeter - computedPerimeter) / computedPerimeter > AREA_TOLERANCE_SHARE) {
        issues.push({
          severity: 'error',
          code: 'ROOM_PERIMETER_MISMATCH',
          message: 'Записанный периметр не совпадает с геометрией контура.',
          elementId: room.id,
        });
      }
    }
  }

  return {
    ok: issues.every((issue) => issue.severity !== 'error'),
    issues,
    counts: { elements, rooms, lowConfidence },
  };
}
