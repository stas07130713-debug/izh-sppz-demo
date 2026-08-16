/**
 * Состояние очистки в интерфейсе и сборка списка действий для ядра.
 *
 * Порядок действий важен и задаётся здесь один раз:
 *   1. стирание областей и работа с цветом — в координатах исходной подложки;
 *   2. обрезка — последней.
 *
 * Обрезка идёт последней намеренно. Пользователь обводит легенду и штамп на
 * исходном изображении, и координаты этих областей должны оставаться верными.
 * Если бы обрезка выполнялась первой, все ранее указанные области уехали бы.
 */

import type { CleanupOperation, PixelRect, RgbColor } from '@izh/contracts';

export interface RemovedColor {
  readonly color: RgbColor;
  readonly tolerance: number;
}

export interface CleanupState {
  readonly crop: PixelRect | null;
  readonly eraseRects: readonly PixelRect[];
  readonly removeColored: boolean;
  readonly chromaThreshold: number;
  readonly removedColors: readonly RemovedColor[];
  readonly keepDark: boolean;
  readonly luminanceThreshold: number;
}

export const EMPTY_CLEANUP: CleanupState = {
  crop: null,
  eraseRects: [],
  removeColored: false,
  chromaThreshold: 40,
  removedColors: [],
  keepDark: false,
  luminanceThreshold: 200,
};

/** Полный список действий, включая обрезку. Уходит в ядро при применении. */
export function toOperations(state: CleanupState): CleanupOperation[] {
  const operations: CleanupOperation[] = [];

  for (const rect of state.eraseRects) {
    operations.push({ kind: 'erase-rect', rect });
  }
  if (state.removeColored) {
    operations.push({ kind: 'remove-colored', chromaThreshold: state.chromaThreshold });
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
      case 'remove-colored':
        state = { ...state, removeColored: true, chromaThreshold: operation.chromaThreshold };
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
