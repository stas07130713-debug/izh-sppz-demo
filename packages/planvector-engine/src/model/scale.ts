/**
 * Перевод модели в метры. Пункты 14 и 15 ТЗ.
 *
 * До калибровки геометрия хранится в единицах исходного документа. Калибровка
 * переводит её в метры один раз и запоминает, как именно масштаб получен и
 * подтвердил ли его человек.
 */

import type { Point, Polygon, Segment } from './geometry.js';
import { areaOf, perimeterOf } from './geometry.js';
import type { PlanElement, PlanModel, Room } from './plan-model.js';

function scalePoint(point: Point, factor: number): Point {
  return { x: point.x * factor, y: point.y * factor };
}

function scaleSegment(segment: Segment, factor: number): Segment {
  return { a: scalePoint(segment.a, factor), b: scalePoint(segment.b, factor) };
}

function scalePolygon(polygon: Polygon, factor: number): Polygon {
  return { points: polygon.points.map((point) => scalePoint(point, factor)) };
}

function scaleElement(element: PlanElement, factor: number): PlanElement {
  if (element.geometry === 'segment') {
    return { ...element, segment: scaleSegment(element.segment, factor), thickness: element.thickness * factor };
  }
  return { ...element, polygon: scalePolygon(element.polygon, factor) };
}

function scaleRoom(room: Room, factor: number): Room {
  const polygon = scalePolygon(room.polygon, factor);
  return { ...room, polygon, area: areaOf(polygon), perimeter: perimeterOf(polygon) };
}

/**
 * Переводит модель в метры.
 *
 * Повторная калибровка уже переведённой модели запрещена: иначе координаты
 * умножились бы на масштаб дважды, а такая ошибка обнаруживается очень поздно.
 * Чтобы задать масштаб заново, калибруется исходная модель.
 */
export function applyScaleToMeters(
  model: PlanModel,
  metersPerSourceUnit: number,
  method: PlanModel['scale']['method'],
  confirmedByUser: boolean,
  note = '',
): PlanModel | null {
  if (model.units === 'meters') return null;
  if (!Number.isFinite(metersPerSourceUnit) || metersPerSourceUnit <= 0) return null;

  return {
    ...model,
    units: 'meters',
    scale: { metersPerSourceUnit, method, confirmedByUser, note },
    building: {
      ...model.building,
      floors: model.building.floors.map((floor) => ({
        ...floor,
        elements: floor.elements.map((element) => scaleElement(element, metersPerSourceUnit)),
        rooms: floor.rooms.map((room) => scaleRoom(room, metersPerSourceUnit)),
      })),
    },
  };
}
