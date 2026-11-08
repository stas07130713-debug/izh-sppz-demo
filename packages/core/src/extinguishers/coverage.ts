/**
 * Покрытие помещения огнетушителями — геометрия к пункту 409 ППР.
 *
 * ППР задаёт требование через расстояние: от любого возможного очага пожара до
 * переносного огнетушителя не более 20, 30, 40 или 70 метров. Проверить это
 * можно только на плане, и именно так его показывают в документах заказчика —
 * «указана на схемах с радиусом в зависимости от категории и планировочных
 * решений». Отсюда и способ проверки: круг радиусом нормы вокруг каждого
 * огнетушителя, помещение покрыто, если кругами накрыта вся его площадь.
 *
 * Расстояние считается по прямой. ППР велит учитывать перегородки, дверные
 * проёмы и загромождения, но их в плане нет: программа считает так же, как
 * рисуют схемы, а обход препятствий остаётся за человеком. Поэтому непокрытые
 * места показываются на плане, а не сводятся к одному «да/нет».
 */

import type { PixelPoint } from '@izh/contracts';

/** Сколько точек проверяется внутри помещения. Больше — точнее и медленнее. */
const MAX_SAMPLES = 4000;

/**
 * Шаг сетки относительно радиуса.
 *
 * Пятая часть радиуса — компромисс: разрыв покрытия меньше этого шага сетка
 * может не заметить, а при 30-метровой норме это 6 метров, что для вывода
 * «помещение накрыто» несущественно.
 */
const STEP_OF_RADIUS = 5;

export interface RoomCoverage {
  /** Сколько точек помещения проверено. 0 — обводка вырождена. */
  readonly sampled: number;
  readonly covered: number;
  /** Доля покрытия, 0…1. */
  readonly ratio: number;
  /** Непокрытые точки — их показывают на плане, чтобы было видно, где дыра. */
  readonly gaps: readonly PixelPoint[];
}

/** Луч вправо: нечётное число пересечений — точка внутри. */
export function pointInPolygon(point: PixelPoint, polygon: readonly PixelPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (a === undefined || b === undefined) continue;

    const crosses = (a.y > point.y) !== (b.y > point.y);
    if (!crosses) continue;

    const x = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (point.x < x) inside = !inside;
  }
  return inside;
}

/**
 * Точки внутри помещения, по которым проверяется покрытие.
 *
 * Если сетка не попала внутрь ни разу — помещение мельче шага, — берутся его
 * углы: маленькое помещение всё равно должно быть проверено, а не пропущено.
 */
export function sampleRoom(outline: readonly PixelPoint[], stepPx: number): readonly PixelPoint[] {
  if (outline.length < 3 || stepPx <= 0) return [];

  const xs = outline.map((point) => point.x);
  const ys = outline.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Шаг не даём измельчать сверх меры: на большом помещении сетка в четверть
  // метра — это миллионы точек и подвисший экран.
  const area = Math.max(1, (maxX - minX) * (maxY - minY));
  const step = Math.max(stepPx, Math.sqrt(area / MAX_SAMPLES));

  const points: PixelPoint[] = [];
  for (let y = minY + step / 2; y < maxY; y += step) {
    for (let x = minX + step / 2; x < maxX; x += step) {
      const point = { x, y };
      if (pointInPolygon(point, outline)) points.push(point);
    }
  }

  return points.length > 0 ? points : outline;
}

function withinAny(point: PixelPoint, sources: readonly PixelPoint[], radiusPx: number): boolean {
  const limit = radiusPx * radiusPx;
  for (const source of sources) {
    const dx = source.x - point.x;
    const dy = source.y - point.y;
    if (dx * dx + dy * dy <= limit) return true;
  }
  return false;
}

/**
 * Покрыто ли помещение кругами радиуса `radiusPx` вокруг точек `sources`.
 *
 * `sources` — только подходящие огнетушители: круг непригодного по рангу
 * огнетушителя ничего не защищает, и учитывать его значило бы выдать
 * несоответствие за соответствие.
 */
export function coverRoom(
  outline: readonly PixelPoint[],
  sources: readonly PixelPoint[],
  radiusPx: number,
): RoomCoverage {
  const points = sampleRoom(outline, radiusPx / STEP_OF_RADIUS);
  if (points.length === 0) return { sampled: 0, covered: 0, ratio: 0, gaps: [] };

  const gaps: PixelPoint[] = [];
  let covered = 0;
  for (const point of points) {
    if (withinAny(point, sources, radiusPx)) covered += 1;
    else gaps.push(point);
  }

  return {
    sampled: points.length,
    covered,
    ratio: covered / points.length,
    // Показывать все дыры незачем: на плане это сплошное пятно. Хватает
    // разрежённого набора, по которому видно место и размер непокрытой части.
    gaps: gaps.filter((_, index) => index % Math.ceil(gaps.length / 120 || 1) === 0),
  };
}
