/**
 * Состояние очистки в интерфейсе и сборка списка действий для ядра.
 *
 * Порядок действий важен и задаётся здесь один раз:
 *   1. стирание областей, удаление значков и работа с цветом — в координатах
 *      исходной подложки;
 *   2. обрезка — последней.
 *
 * Обрезка идёт последней намеренно. Пользователь обводит легенду и штамп на
 * исходном изображении, и координаты этих областей должны оставаться верными.
 * Если бы обрезка выполнялась первой, все ранее указанные области уехали бы.
 */

import type { CleanupOperation, PixelPoint, PixelRect, RgbColor } from '@izh/contracts';

/** Сила очистки от цветного. За словами стоят настройки алгоритма. */
export type CleanupStrength = 'light' | 'normal' | 'strong';

export interface ColoredPreset {
  readonly saturationThreshold: number;
  readonly haloRadiusPx: number;
  readonly wholeSymbols: boolean;
  readonly minColoredShare: number;
  readonly maxSymbolShare: number;
}

/**
 * Три готовые настройки вместо пяти ползунков.
 *
 * «Слабо» — только явно цветное, ничего лишнего не заденет.
 * «Обычно» — плюс кайма сглаживания и значки целиком, вместе с обводкой.
 * «Сильно» — ловит бледные заливки и крупные значки; может задеть цветные
 * подписи, если они есть на чертеже.
 */
export const STRENGTH_PRESETS: Record<CleanupStrength, ColoredPreset> = {
  light: {
    saturationThreshold: 0.3,
    haloRadiusPx: 0,
    wholeSymbols: false,
    minColoredShare: 0.5,
    maxSymbolShare: 0.01,
  },
  normal: {
    saturationThreshold: 0.15,
    haloRadiusPx: 1,
    wholeSymbols: true,
    minColoredShare: 0.35,
    maxSymbolShare: 0.02,
  },
  strong: {
    saturationThreshold: 0.08,
    haloRadiusPx: 2,
    wholeSymbols: true,
    minColoredShare: 0.2,
    maxSymbolShare: 0.05,
  },
};

export const STRENGTH_LABELS: Record<CleanupStrength, string> = {
  light: 'Слабо',
  normal: 'Обычно',
  strong: 'Сильно',
};

/** Фигура крупнее этой доли площади считается зданием и щелчком не убирается. */
export const COMPONENT_MAX_SHARE = 0.02;

export interface RemovedColor {
  readonly color: RgbColor;
  readonly tolerance: number;
}

export interface CleanupState {
  readonly crop: PixelRect | null;
  readonly eraseRects: readonly PixelRect[];
  readonly removeColored: boolean;
  readonly strength: CleanupStrength;
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
  removedColors: [],
  removedComponents: [],
  keepDark: false,
  luminanceThreshold: 200,
};

/** Полный список действий, включая обрезку. Уходит в ядро при применении. */
export function toOperations(state: CleanupState): CleanupOperation[] {
  const operations: CleanupOperation[] = [];

  for (const rect of state.eraseRects) {
    operations.push({ kind: 'erase-rect', rect });
  }
  for (const seed of state.removedComponents) {
    operations.push({ kind: 'remove-component', seed, maxShare: COMPONENT_MAX_SHARE });
  }
  if (state.removeColored) {
    operations.push({ kind: 'remove-colored', ...STRENGTH_PRESETS[state.strength] });
  }
  for (const removed of state.removedColors) {
    operations.push({ kind: 'remove-color', color: removed.color, tolerance: removed.tolerance });
  }
  if (state.keepDark) {
    operations.push({ kind: 'keep-dark', luminanceThreshold: state.luminanceThreshold });
  }
  if (state.crop !== null) {
    operations.push({ kind: 'crop', rect: state.crop });
  }

  return operations;
}

/**
 * Список действий для предпросмотра — без обрезки.
 *
 * Обрезка меняет размеры изображения, а предпросмотр должен оставаться в тех же
 * координатах, что и исходная подложка, иначе указанные пользователем области
 * перестанут совпадать с тем, что он видит. Поэтому в предпросмотре обрезка
 * показывается рамкой, а применяется только при сохранении.
 */
export function toPreviewOperations(state: CleanupState): CleanupOperation[] {
  return toOperations({ ...state, crop: null });
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
