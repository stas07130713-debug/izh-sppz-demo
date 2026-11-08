/**
 * Круги нормы на плане (ТЗ, Дополнение 6, часть С86).
 *
 * Заказчик: «не отображаются круги на плане при проверке огнетушителей».
 *
 * Круги строились только вокруг зачтённых огнетушителей — подходящих по рангу,
 * исправных, переносных. На объекте, где ранг в карточках не заполнен, таких не
 * было ни одного, и план оставался пустым: человек нажимал «проверить» и не
 * видел ничего.
 *
 * Теперь круг есть у каждого огнетушителя, а зачтён он или нет — показано
 * цветом. Соосность круга и значка проверена замером в браузере: обе середины
 * совпадают при любом масштабе, потому что значок сдвинут на половину своего
 * размера, а круг стоит в той же точке подложки.
 */

import { describe, expect, it } from 'vitest';
import type { PlanObject, Room } from '@izh/contracts';
import { checkExtinguisherPlacement } from '@izh/core';
import { coverageLayer } from './plan-coverage';

const OUTLINE = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }];

function room(): Room {
  return {
    id: 'помещение', siteId: 'объект', levelId: 'этаж', name: 'Участок', number: null,
    category: 'В3', categoryBasis: null, heightM: null, purpose: 'производственное',
    fireClasses: ['A', 'B', 'E'], hasSuppression: false, outline: OUTLINE, areaM2: 400,
    archivedAt: null, createdAt: '', updatedAt: '', rowVersion: 1,
  };
}

function extinguisher(id: string, x: number, rating: string | null, charge: number | null = 8): PlanObject {
  return {
    id, siteId: 'объект', nodeId: 'этаж', typeCode: 'extinguisher-powder', regNumber: id,
    roomId: null, position: { x, y: 20 }, technicalState: 'исправен', archivedAt: null,
    extinguisherProfile: { fireRating: rating, execution: 'переносной', nominalCharge: charge },
  } as unknown as PlanObject;
}

const BUILDING = {
  category: 'В',
  purpose: 'производственное' as const,
  areaM2: 400,
  fireClasses: ['A', 'B', 'E'],
  hasSuppression: false,
};

/** Огнетушитель с пустой карточкой: исполнение по ней не определяется. */
function unknownExtinguisher(id: string, x: number): PlanObject {
  return {
    id, siteId: 'объект', nodeId: 'этаж', typeCode: 'extinguisher', regNumber: id,
    roomId: null, position: { x, y: 20 }, technicalState: 'не определено', archivedAt: null,
    extinguisherProfile: null,
  } as unknown as PlanObject;
}

describe('круги на плане', () => {
  it('круг есть и у огнетушителя с пустой карточкой', () => {
    /*
     * Разбор жалобы: «или не все огнетушители учитывает». Круг требовал
     * доказанного «переносной», и огнетушитель, у которого карточка не
     * заполнена, оставался на плане без круга — молча, будто его и нет.
     */
    const report = checkExtinguisherPlacement({
      rooms: [room()],
      objects: [extinguisher('ОП-1', 10, '3A, 70B, C, E'), unknownExtinguisher('без-карточки', 30)],
      metersPerPixel: 1,
    });

    const layer = coverageLayer(report, [room()]);
    expect(layer.circles).toHaveLength(2);
    // Зачтён только тот, про кого известно, что он подходит и исправен.
    expect(layer.circles.filter((circle) => circle.counted)).toHaveLength(1);
  });

  it('итог называет числа: сколько всего и сколько зачтено', () => {
    const report = checkExtinguisherPlacement({
      rooms: [room()],
      objects: [extinguisher('ОП-1', 10, '3A, 70B, C, E'), unknownExtinguisher('без-карточки', 30)],
      metersPerPixel: 1,
    });

    const layer = coverageLayer(report, [room()]);
    expect(layer.summary.total).toBe(2);
    expect(layer.summary.counted).toBe(1);
    expect(layer.summary.reachM).toBe(30);
  });

  it('круг есть и у огнетушителя, который не подходит по рангу', () => {
    const report = checkExtinguisherPlacement({
      rooms: [room()],
      objects: [extinguisher('ОП-1', 10, '3A, 70B, C, E'), extinguisher('ОП-2', 30, '2A, 55B')],
      metersPerPixel: 1,
    });

    const layer = coverageLayer(report, [room()]);
    expect(layer.circles).toHaveLength(2);
    expect(layer.circles.filter((circle) => circle.counted)).toHaveLength(1);
  });

  it('без сведений о ранге и заряде круги всё равно строятся', () => {
    // Ровно тот случай, из-за которого план оставался пустым.
    const report = checkExtinguisherPlacement({
      rooms: [room()],
      // Ни ранга, ни заряда: подтвердить пригодность нечем.
      objects: [extinguisher('ОП-1', 10, null, null), extinguisher('ОП-2', 30, null, null)],
      metersPerPixel: 1,
    });

    const layer = coverageLayer(report, [room()]);
    expect(layer.circles).toHaveLength(2);
    expect(layer.circles.every((circle) => !circle.counted)).toBe(true);
  });

  it('радиус круга — норма расстояния в точках подложки', () => {
    // Категория В3, норма 30 метров, в точке 0,5 метра — значит 60 точек.
    const report = checkExtinguisherPlacement({
      rooms: [room()],
      objects: [extinguisher('ОП-1', 10, '3A, 70B, C, E')],
      metersPerPixel: 0.5,
    });

    expect(coverageLayer(report, [room()]).circles[0]?.radiusPx).toBe(60);
  });

  it('круг стоит в точке объекта — она же середина значка', () => {
    const report = checkExtinguisherPlacement({
      rooms: [room()],
      objects: [extinguisher('ОП-1', 17, '3A, 70B, C, E')],
      metersPerPixel: 1,
    });

    const circle = coverageLayer(report, [room()]).circles[0];
    expect([circle?.x, circle?.y]).toEqual([17, 20]);
  });

  it('без помещений круги строятся по норме объекта целиком', () => {
    // Обводок нет, покрытие площади не считается — но круги нужны и здесь.
    const report = checkExtinguisherPlacement({
      rooms: [],
      objects: [extinguisher('ОП-1', 10, '3A, 70B, C, E')],
      metersPerPixel: 1,
      building: BUILDING,
    });

    const layer = coverageLayer(report, []);
    expect(layer.circles).toHaveLength(1);
    // Категория В — верхняя строка таблицы, 30 метров.
    expect(layer.circles[0]?.radiusPx).toBe(30);
  });

  it('без масштаба кругов нет: откладывать метры не на чем', () => {
    const report = checkExtinguisherPlacement({
      rooms: [],
      objects: [extinguisher('ОП-1', 10, '3A, 70B, C, E')],
      metersPerPixel: null,
      building: BUILDING,
    });

    expect(coverageLayer(report, []).circles).toEqual([]);
  });

  it('каждый установленный огнетушитель получает круг, даже если он далеко от помещений', () => {
    const near = extinguisher('ОП-рядом', 10, '3A, 70B, C, E');
    const far = extinguisher('ОП-далеко', 500, null, null);
    const report = checkExtinguisherPlacement({
      rooms: [room()], objects: [near, far], metersPerPixel: 1,
    });

    const layer = coverageLayer(report, [room()], [near, far], 1);
    expect(new Set(layer.circles.map((circle) => circle.x))).toEqual(new Set([10, 500]));
    expect(layer.summary.total).toBe(2);
  });

  it('при незаполненных характеристиках достаточно масштаба: применяется строгий радиус 20 м', () => {
    const object = unknownExtinguisher('без-сведений', 25);
    const report = checkExtinguisherPlacement({ rooms: [], objects: [object], metersPerPixel: 0.5 });

    const layer = coverageLayer(report, [], [object], 0.5);
    expect(layer.circles).toHaveLength(1);
    expect(layer.circles[0]?.radiusPx).toBe(40);
  });

  it('на один огнетушитель рисует один круг, даже если он относится к двум помещениям', () => {
    const object = extinguisher('ОП-общий', 20, '3A, 70B, C, E');
    const second = { ...room(), id: 'помещение-2', category: 'Г' };
    const report = checkExtinguisherPlacement({ rooms: [room(), second], objects: [object], metersPerPixel: 1 });

    const layer = coverageLayer(report, [room(), second], [object], 1);
    expect(layer.circles.filter((circle) => circle.objectId === object.id)).toHaveLength(1);
  });
});
