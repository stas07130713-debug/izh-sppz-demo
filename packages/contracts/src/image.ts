/**
 * Изображение в памяти и операции очистки подложки.
 *
 * Очистка нужна, потому что планы приходят «с нагрузкой»: стрелки эвакуации,
 * уже расставленные значки огнетушителей, легенда, экспликация, штамп, рамка.
 * Для работы нужна голая архитектура — стены, проёмы, лестницы, — на которую
 * программа сама нанесёт оборудование.
 *
 * Очистка неразрушающая. Исходное изображение остаётся в хранилище нетронутым,
 * а список операций сохраняется отдельно, чтобы очистку можно было повторить,
 * поправить или отменить целиком.
 */

import type { ContentHash, IsoDateTime, PixelPoint, PixelRect } from './basic-types.js';

export interface RgbColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Изображение в памяти: четыре байта на точку, красный-зелёный-синий-прозрачность. */
export interface RgbaImage {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly data: Uint8ClampedArray;
}

/**
 * Одно действие очистки.
 *
 * Действия применяются по порядку. Каждое из них — чистая функция над
 * изображением, поэтому результат всегда воспроизводим.
 */
export type CleanupOperation =
  /** Обрезка: оставить только выбранный прямоугольник. Убирает рамку и штамп. */
  | { readonly kind: 'crop'; readonly rect: PixelRect }
  /** Стереть прямоугольник. Убирает легенду, экспликацию, таблицы. */
  | { readonly kind: 'erase-rect'; readonly rect: PixelRect }
  /** Убрать один конкретный цвет с допуском. Выбирается щелчком по палитре плана. */
  | { readonly kind: 'remove-color'; readonly color: RgbColor; readonly tolerance: number }
  /**
   * Убрать всё цветное, оставив только чёрные и серые линии здания.
   *
   * Главное действие для планов эвакуации. Устроено сложнее, чем «убрать
   * насыщенные точки», потому что этого недостаточно:
   *
   * - края линий на плане сглажены, вокруг зелёной стрелки остаётся бледная
   *   кайма с почти нулевой насыщенностью. Если убрать только яркое, на месте
   *   стрелки останется её призрак. Для этого есть haloRadiusPx;
   * - значок огнетушителя — красная заливка в чёрной обводке. Обводка по цвету
   *   не отличается от стены, и после удаления красного остаётся пустая рамка.
   *   Для этого есть wholeSymbols: связная фигура убирается целиком, если она в
   *   основном цветная и невелика по площади. Стены защищены размером — они
   *   образуют одну огромную фигуру.
   */
  | {
      readonly kind: 'remove-colored';
      /** Относительная насыщенность, от 0 до 1. Меньше — убирается больше. */
      readonly saturationThreshold: number;
      /** Расширение маски наружу, чтобы снять кайму сглаживания. */
      readonly haloRadiusPx: number;
      /** Убирать связную фигуру целиком, вместе с обводкой. */
      readonly wholeSymbols: boolean;
      /** Какая доля точек фигуры должна быть цветной, чтобы убрать её целиком. */
      readonly minColoredShare: number;
      /** Фигуры крупнее этой доли площади считаются зданием и не трогаются. */
      readonly maxSymbolShare: number;
    }
  /**
   * Убрать одну фигуру, на которую указал пользователь.
   *
   * Действует и на одноцветных чертежах, где значки нарисованы тем же чёрным,
   * что и стены: там цвет не помогает, а щелчок по значку — помогает.
   */
  | {
      readonly kind: 'remove-component';
      readonly seed: PixelPoint;
      readonly maxShare: number;
    }
  /** Оставить только тёмное. Убирает светлую заливку, штриховку и подложечную серость. */
  | { readonly kind: 'keep-dark'; readonly luminanceThreshold: number };

/** Сохранённая очистка подложки. */
export interface BackdropCleanup {
  readonly backdropId: string;
  readonly operations: readonly CleanupOperation[];
  /** Очищенное изображение в хранилище. */
  readonly cleanedImageHash: ContentHash;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly updatedAt: IsoDateTime;
}

/** Запись палитры плана: цвет и какую долю точек он занимает. */
export interface PaletteEntry {
  readonly color: RgbColor;
  /** Доля от всех точек изображения, от 0 до 1. */
  readonly share: number;
}
