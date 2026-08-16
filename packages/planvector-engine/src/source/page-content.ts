/**
 * Что ядро хочет получить от документа.
 *
 * Ядру нельзя иметь зависимости, поэтому оно не читает PDF само. Оно описывает
 * данные, которые ему нужны, а достаёт их переходник снаружи — сегодня на
 * pdf.js, завтра на чём угодно. Заменить библиотеку чтения PDF можно, не трогая
 * ни одного алгоритма распознавания.
 *
 * Все координаты — в единицах страницы документа, начало внизу слева, как в PDF.
 */

export interface SourcePoint {
  readonly x: number;
  readonly y: number;
}

/** Как путь появляется на бумаге. Определяет, что он значит на чертеже. */
export type PathPaint =
  /** Обведён видимой линией: настоящая линия чертежа. */
  | 'stroke'
  /** Залит: пятно, штриховка, залитая стена, буква, переведённая в кривые. */
  | 'fill'
  /** И то и другое. */
  | 'fill-stroke';

export interface VectorPath {
  /** Точки одного непрерывного куска пути. */
  readonly points: readonly SourcePoint[];
  readonly closed: boolean;
  readonly paint: PathPaint;
  /** Толщина обводки в единицах страницы. Ноль — обводка не видна. */
  readonly strokeWidth: number;
  readonly color: readonly [number, number, number];
}

/** Надпись с известным местом. Главный источник сведений о том, что на чертеже
 *  не является зданием: легенда, штамп, таблицы, размерные числа, подписи. */
export interface TextItem {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PageContent {
  readonly pageNumber: number;
  readonly widthPt: number;
  readonly heightPt: number;
  readonly paths: readonly VectorPath[];
  readonly texts: readonly TextItem[];
  /** Сколько растровых картинок вставлено в страницу. */
  readonly imageCount: number;
}

/** Прямоугольник в единицах страницы. */
export interface SourceRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function rectContains(rect: SourceRect, point: SourcePoint): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function rectOf(points: readonly SourcePoint[]): SourceRect | null {
  if (points.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function rectArea(rect: SourceRect): number {
  return rect.width * rect.height;
}

export function rectsOverlap(first: SourceRect, second: SourceRect, gap = 0): boolean {
  return (
    first.x < second.x + second.width + gap &&
    first.x + first.width + gap > second.x &&
    first.y < second.y + second.height + gap &&
    first.y + first.height + gap > second.y
  );
}

export function unionRect(first: SourceRect, second: SourceRect): SourceRect {
  const left = Math.min(first.x, second.x);
  const top = Math.min(first.y, second.y);
  const right = Math.max(first.x + first.width, second.x + second.width);
  const bottom = Math.max(first.y + first.height, second.y + second.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
