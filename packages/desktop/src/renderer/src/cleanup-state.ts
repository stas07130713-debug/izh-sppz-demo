/**
 * Состояние очистки в интерфейсе и сборка списка действий для ядра.
 *
 * Порядок действий важен и задаётся здесь один раз:
 *   1. вырезать рабочую область листа;
 *   2. все следующие действия выполнять уже внутри этой области;
 *
 * Это именно поэтапная подготовка подложки: выбрал нужный фрагмент — дальше
 * работаешь только с ним, а не продолжаешь чистить весь эвакуационный лист.
 */

import type { CleanupOperation, PixelPoint, PixelRect, RgbColor } from '@izh/contracts';

/** Сила очистки от цветного. За словами стоят настройки алгоритма. */
export type CleanupStrength = 'light' | 'normal' | 'strong';

export interface ColoredPreset {
  readonly saturationThreshold: number;
  readonly haloRadiusPx: number;
  readonly symbolGrowthPx: number;
}

/**
 * Три готовые настройки вместо пяти ползунков.
 *
 * «Слабо» — только явно цветное, ничего лишнего не заденет.
 * «Обычно» — плюс кайма сглаживания.
 * «Сильно» — ловит бледные заливки; может задеть цветные подписи, если они
 * есть на чертеже.
 *
 * Важно: автоматическая цветная очистка не прорастает в чёрную графику. Чёрная
 * обводка значка убирается вручную щелчком или областью. Иначе зелёная стрелка,
 * коснувшаяся стены, съедает стену — для коммерческой подложки это недопустимо.
 */
export const STRENGTH_PRESETS: Record<CleanupStrength, ColoredPreset> = {
  light: { saturationThreshold: 0.3, haloRadiusPx: 0, symbolGrowthPx: 0 },
  normal: { saturationThreshold: 0.15, haloRadiusPx: 2, symbolGrowthPx: 0 },
  strong: { saturationThreshold: 0.08, haloRadiusPx: 4, symbolGrowthPx: 0 },
};

export const STRENGTH_LABELS: Record<CleanupStrength, string> = {
  light: 'Слабо',
  normal: 'Обычно',
  strong: 'Сильно',
};

/** Фигура крупнее этой доли площади считается зданием и щелчком не убирается. */
export const COMPONENT_MAX_SHARE = 0.02;

/** Дальше этого расстояния от щелчка удаление не уходит: иначе значок,
 *  примыкающий к стене, утащил бы стену за собой. */
export const COMPONENT_MAX_RADIUS_PX = 250;

export interface RemovedColor {
  readonly color: RgbColor;
  readonly tolerance: number;
}

export interface CleanupState {
  readonly crop: PixelRect | null;
  readonly eraseRects: readonly PixelRect[];
  readonly removeColored: boolean;
  readonly strength: CleanupStrength;
  readonly removeTextLike: boolean;
  readonly textMaxWidthPx: number;
  readonly textMaxHeightPx: number;
  readonly textMaxPixels: number;
  readonly removedColors: readonly RemovedColor[];
  /** Значки, убранные щелчком. Хранятся точки, а не результат. */
  readonly removedComponents: readonly PixelPoint[];
  readonly keepDark: boolean;
  readonly luminanceThreshold: number;
}

export const EMPTY_CLEANUP: CleanupState = {
  crop: null,
  eraseRects: [],
  removeColored: false,
  strength: 'normal',
  removeTextLike: false,
  textMaxWidthPx: 180,
  textMaxHeightPx: 80,
  textMaxPixels: 900,
  removedColors: [],
  removedComponents: [],
  keepDark: false,
  luminanceThreshold: 200,
};

/** Полный список действий, включая обрезку. Уходит в ядро при применении. */
export function toOperations(state: CleanupState): CleanupOperation[] {
  const operations: CleanupOperation[] = [];

  if (state.crop !== null) {
    operations.push({ kind: 'crop', rect: state.crop });
  }
  for (const rect of state.eraseRects) {
    operations.push({ kind: 'erase-rect', rect });
  }
  for (const seed of state.removedComponents) {
    operations.push({ kind: 'remove-component', seed, maxShare: COMPONENT_MAX_SHARE, maxRadiusPx: COMPONENT_MAX_RADIUS_PX });
  }
  if (state.removeColored) {
    operations.push({ kind: 'remove-colored', ...STRENGTH_PRESETS[state.strength] });
  }
  if (state.removeTextLike) {
    operations.push({
      kind: 'remove-small-components',
      maxWidthPx: state.textMaxWidthPx,
      maxHeightPx: state.textMaxHeightPx,
      maxPixels: state.textMaxPixels,
    });
  }
  for (const removed of state.removedColors) {
    operations.push({ kind: 'remove-color', color: removed.color, tolerance: removed.tolerance });
  }
  if (state.keepDark) {
    operations.push({ kind: 'keep-dark', luminanceThreshold: state.luminanceThreshold });
  }

  return operations;
}

/**
 * Список действий для предпросмотра совпадает с рабочим списком.
 * Обрезка видна сразу: после выбора нужной области пользователь работает уже
 * только с ней.
 */
export function toPreviewOperations(state: CleanupState): CleanupOperation[] {
  return toOperations(state);
}

/** Есть ли что применять. */
export function hasAnything(state: CleanupState): boolean {
  return toOperations(state).length > 0;
}

/** Определяет силу очистки по сохранённым настройкам. */
function strengthOf(preset: ColoredPreset): CleanupStrength {
  if (preset.saturationThreshold >= 0.25) return 'light';
  if (preset.saturationThreshold <= 0.1) return 'strong';
  return 'normal';
}

/** Восстанавливает состояние интерфейса из сохранённого списка действий. */
export function fromOperations(operations: readonly CleanupOperation[]): CleanupState {
  let state = EMPTY_CLEANUP;

  for (const operation of operations) {
    switch (operation.kind) {
      case 'crop':
        state = { ...state, crop: operation.rect };
        break;
      case 'erase-rect':
        state = { ...state, eraseRects: [...state.eraseRects, operation.rect] };
        break;
      case 'remove-component':
        state = { ...state, removedComponents: [...state.removedComponents, operation.seed] };
        break;
      case 'remove-colored':
        state = { ...state, removeColored: true, strength: strengthOf(operation) };
        break;
      case 'remove-small-components':
        state = {
          ...state,
          removeTextLike: true,
          textMaxWidthPx: operation.maxWidthPx,
          textMaxHeightPx: operation.maxHeightPx,
          textMaxPixels: operation.maxPixels,
        };
        break;
      case 'remove-color':
        state = {
          ...state,
          removedColors: [
            ...state.removedColors,
            { color: operation.color, tolerance: operation.tolerance },
          ],
        };
        break;
      case 'keep-dark':
        state = { ...state, keepDark: true, luminanceThreshold: operation.luminanceThreshold };
        break;
    }
  }

  return state;
}

