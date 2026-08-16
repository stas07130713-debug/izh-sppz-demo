/**
 * Перерисованная планировка.
 *
 * Это не картинка, а данные: список элементов здания с координатами. Из них
 * рисуется чистая планировка любого размера, из них же в дальнейшем получаются
 * помещения и площади.
 *
 * Координаты — в пунктах страницы PDF (1/72 дюйма). Перевод в метры делает
 * калибровка подложки, потому что она едина для всей программы.
 */

import type { IsoDateTime } from './basic-types.js';

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface AreaRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Что за элемент здания.
 *
 * Список намеренно короткий: распознаётся то, что действительно можно отличить
 * по геометрии. Остальное пользователь добавляет руками теми же типами.
 */
export type DrawnElementKind =
  | 'wall'
  | 'partition'
  | 'window'
  | 'door'
  | 'stairs'
  | 'opening'
  | 'line';

export const ELEMENT_LABELS: Record<DrawnElementKind, string> = {
  wall: 'Стена',
  partition: 'Перегородка',
  window: 'Окно',
  door: 'Дверь',
  stairs: 'Лестница',
  opening: 'Проём',
  line: 'Линия',
};

export interface DrawnElement {
  readonly id: string;
  readonly kind: DrawnElementKind;
  /** Осевая линия элемента. */
  readonly a: Point2D;
  readonly b: Point2D;
  /** Толщина в пунктах. Ноль — элемент рисуется одной линией. */
  readonly thickness: number;
  /** Добавлен человеком, а не распознан. Такие элементы не пропадают при
   *  повторном разборе чертежа. */
  readonly manual: boolean;
}

/** Подпись с чертежа: номер помещения, название. */
export interface DrawnLabel {
  readonly id: string;
  readonly text: string;
  readonly at: Point2D;
  readonly manual: boolean;
}

export interface PlanDrawing {
  readonly backdropId: string;
  /** Область чертежа на странице: рамка, штамп и легенда в неё не входят. */
  readonly area: AreaRect;
  readonly elements: readonly DrawnElement[];
  readonly labels: readonly DrawnLabel[];
  readonly createdAt: IsoDateTime;
}

/**
 * Подпись схемы.
 *
 * Собирается из дерева объекта — здания и этажа, в которых лежит план, — а не
 * хранится на самом плане. Так подпись не может разойтись с деревом, а при
 * переименовании здания она меняется сама.
 */
export interface DrawingCaption {
  readonly buildingName: string;
  readonly levelName: string;
}

export function formatCaption(caption: DrawingCaption): string {
  const parts = [caption.levelName, caption.buildingName].filter((part) => part.trim() !== '');
  return parts.join(', ');
}
