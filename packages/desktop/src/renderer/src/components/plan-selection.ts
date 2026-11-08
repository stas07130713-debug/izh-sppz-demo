/**
 * Кто попал в групповое выделение на плане.
 *
 * Выделяют двумя способами, и они не взаимозаменяемы. Рамкой берут то, что
 * лежит кучно: ряд огнетушителей вдоль стены, извещатели в одной комнате.
 * Обводкой от руки — то, что вытянуто по сложной траектории: линия вдоль
 * коридора, оборудование вокруг установки, участок с вырезом. Рамка там
 * захватила бы половину цеха.
 *
 * Значок считается выделенным **по своей точке**, а не по картинке. Картинка
 * значка крупнее точки и рисуется поверх соседних: если считать по ней, в рамку
 * попадало бы всё, что рядом, и выделение перестало бы совпадать с тем, что
 * человек обвёл.
 */

import type { PixelPoint, PlanObject } from '@izh/contracts';

export type SelectMode = 'rect' | 'lasso';

/**
 * Как новый набор ложится на прежний.
 *
 * `replace` — обвели заново, прежнее снимается. `add` — обвели с Shift
 * или отметили галочку вида в журнале, набор растёт. `remove` — сняли эту
 * галочку. `toggle` — щёлкнули по значку или по строке с Ctrl: точечный
 * добор и снятие ошибочно захваченного, без которого набор пришлось бы
 * собирать заново из-за одного лишнего объекта.
 */
export type PickMode = 'replace' | 'add' | 'remove' | 'toggle';

/**
 * Где собран набор.
 *
 * Набор действует только в том окне, где его собрали. Общий на все экраны он
 * опасен: человек выделил строки в журнале, ушёл на план, обвёл там рамкой
 * другое — и не помнит, что в наборе всё ещё лежит прежнее. Уход из окна
 * набор снимает.
 */
export type SelectionScope = 'план' | 'журнал';

/** Ближе этого точки обводки не копятся: за один проход мыши их набегают тысячи. */
export const PICK_STEP_PX = 6;

/** Луч вправо: нечётное число пересечений — точка внутри обводки. */
export function inPath(point: PixelPoint, path: readonly PixelPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = path.length - 1; i < path.length; j = i, i += 1) {
    const a = path[i];
    const b = path[j];
    if (a === undefined || b === undefined) continue;
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Объекты внутри рамки или обводки.
 *
 * Обводка замыкается сама: человек ведёт мышью и отпускает там, где ему удобно,
 * а не возвращается точно в начало. Меньше трёх точек — не фигура, и выделять
 * по ней нечего.
 */
export function pickedObjects(
  objects: readonly PlanObject[],
  mode: SelectMode | null,
  rect: readonly [PixelPoint, PixelPoint] | null,
  path: readonly PixelPoint[],
): readonly string[] {
  if (mode === 'rect' && rect !== null) {
    const left = Math.min(rect[0].x, rect[1].x);
    const right = Math.max(rect[0].x, rect[1].x);
    const top = Math.min(rect[0].y, rect[1].y);
    const bottom = Math.max(rect[0].y, rect[1].y);

    return objects
      .filter((object) => object.position !== null
        && object.position.x >= left && object.position.x <= right
        && object.position.y >= top && object.position.y <= bottom)
      .map((object) => object.id);
  }

  if (mode === 'lasso' && path.length >= 3) {
    return objects
      .filter((object) => object.position !== null && inPath(object.position, path))
      .map((object) => object.id);
  }

  return [];
}
