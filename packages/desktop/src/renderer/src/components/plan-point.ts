/**
 * Пересчёт точки щелчка из координат экрана в координаты подложки.
 *
 * Вынесено из плана отдельной величиной, потому что от неё зависит, куда встанет
 * объект, где пройдёт обводка помещения и каким выйдет масштаб. Ошибка здесь не
 * видна на экране: она попадает в данные и остаётся там.
 */

import type { PixelPoint } from '@izh/contracts';

/** Размер области плана на экране. Ровно то, что даёт `getBoundingClientRect`. */
export interface ScreenRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Точка события в координатах подложки.
 *
 * `null`, когда у области плана нет размера на экране. Пересчёт делит на ширину
 * области, и при нулевой ширине выходит бесконечность: такую координату нельзя
 * ни записать объекту, ни отмерить ею масштаб — «Отмерено Infinity точек».
 * Щелчок по области без размера ничего не значит, и правильный ответ — «точки
 * нет», а не бесконечность, разошедшаяся по данным.
 */
export function toImagePoint(
  event: { readonly clientX: number; readonly clientY: number },
  rect: ScreenRect,
  widthPx: number,
  heightPx: number,
): PixelPoint | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: Math.round((event.clientX - rect.left) * (widthPx / rect.width)),
    y: Math.round((event.clientY - rect.top) * (heightPx / rect.height)),
  };
}

/**
 * Отличает перенос от обычного нажатия.
 *
 * Микродвижение руки есть почти у каждого щелчка. Пока курсор не прошёл
 * порог, значок остаётся на прежнем месте и открывает карточку.
 */
export function isPointerDrag(
  from: { readonly clientX: number; readonly clientY: number },
  to: { readonly clientX: number; readonly clientY: number },
  thresholdPx: number,
): boolean {
  return Math.hypot(to.clientX - from.clientX, to.clientY - from.clientY) >= thresholdPx;
}
