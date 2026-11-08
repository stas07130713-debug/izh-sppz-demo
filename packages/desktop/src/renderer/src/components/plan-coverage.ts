/**
 * Слой покрытия огнетушителями поверх плана.
 *
 * В справках заказчика достаточность огнетушителей показана именно так:
 * «указана на схемах с радиусом в зависимости от категории и планировочных
 * решений». Программа рисует то же самое — круг нормы вокруг каждого зачтённого
 * огнетушителя, — но добавляет то, чего на бумажной схеме нет: непокрытые места
 * видно точками, и спорить приходится не с выводом, а с конкретным местом.
 *
 * На плане у одного огнетушителя ровно один круг. Если он относится к
 * помещениям с разными нормами, берётся меньший (более строгий) радиус.
 *
 * Круг рисуется вокруг каждого **переносного** огнетушителя, а не только
 * зачтённого. Прежде круги были лишь у подходящих — и на объекте, где ранг в
 * карточках не заполнен, план оставался пустым: человек нажимал «проверить» и
 * не видел ничего.
 *
 * У передвижных круга нет вовсе. ППР нормирует их площадью, а не расстоянием
 * (приложение № 2): круг вокруг передвижного означал бы норму, которой не
 * существует. Что их не хватает или что вместо них стоят переносные — сказано
 * словами в перечне выводов.
 *
 * Непригодный огнетушитель обведён пунктиром: он на месте, но защитой не
 * считается, и это видно сразу.
 *
 * Центр круга — точка объекта, она же середина значка: значок рисуется со
 * сдвигом на половину своего размера, поэтому круг и значок соосны при любом
 * масштабе.
 */

import type { PixelPoint, PlanObject, Room } from '@izh/contracts';
import type { PlacementReport, RoomVerdict } from '@izh/core';

export interface CoverageCircle {
  readonly key: string;
  readonly objectId: string;
  readonly x: number;
  readonly y: number;
  readonly radiusPx: number;
  /** Зачтён ли огнетушитель как защита: от этого цвет круга. */
  readonly counted: boolean;
}

export interface CoverageRoom {
  readonly key: string;
  readonly points: readonly PixelPoint[];
  readonly verdict: RoomVerdict;
}

/**
 * Итог одной строкой — он рисуется над планом.
 *
 * Заказчик: «или не все огнетушители учитывает». Учитывает программа верно, но
 * молча: круг зачтённого сплошной, незачтённого пунктиром — и различить их на
 * плане цеха, где кругов десяток, нельзя. Числа сказаны словами: сколько
 * огнетушителей в круге нормы и сколько из них зачтено.
 */
export interface CoverageSummary {
  /** Сколько огнетушителей попало в разбор. */
  readonly total: number;
  /** Из них зачтено как защита: подходят по рангу, переносные и исправные. */
  readonly counted: number;
  /** Норма расстояния в метрах — наибольшая из встретившихся. */
  readonly reachM: number | null;
  /** Мест, до которых не достаёт ни один зачтённый огнетушитель. */
  readonly gaps: number;
  /**
   * Считалось по зданию целиком: ни одно помещение этажа не обведено.
   *
   * Тогда расстояния не проверяются вовсе — без обводки неизвестно, что где
   * кончается, — и круги на плане показывают только досягаемость, а не
   * покрытие. Молчать об этом нельзя: картинка выглядит одинаково, а значит
   * она разная.
   */
  readonly wholeObject: boolean;
}

export interface CoverageLayer {
  readonly circles: readonly CoverageCircle[];
  readonly gaps: readonly PixelPoint[];
  readonly rooms: readonly CoverageRoom[];
  readonly summary: CoverageSummary;
}

/** Цвет заливки помещения по выводу проверки. Нормативным обозначением не является. */
export const VERDICT_COLOR: Readonly<Record<RoomVerdict, string>> = {
  соответствует: '#16a34a',
  нарушение: '#dc2626',
  'нет данных': '#d97706',
  'не требуется': '#64748b',
};

/**
 * Консервативный радиус, когда категория объекта ещё не заполнена.
 *
 * Масштаб — единственное техническое условие, без которого круг построить
 * нельзя. Пустая карточка огнетушителя или здания не должна убирать с плана
 * уже установленное средство защиты. Берём самую строгую из норм ППР — 20 м:
 * она не обещает лишнего покрытия и остаётся полезной до заполнения карточек.
 */
const FALLBACK_REACH_M = 20;

function isExtinguisher(object: PlanObject): boolean {
  return object.typeCode === 'extinguisher' || object.typeCode.startsWith('extinguisher-');
}

export function coverageLayer(
  report: PlacementReport,
  rooms: readonly Room[],
  objects: readonly PlanObject[] = [],
  metersPerPixel: number | null = null,
): CoverageLayer {
  /*
   * Круги строятся и по объекту целиком, и по каждому помещению.
   *
   * Объект целиком даёт норму там, где помещений не обвели, — а обводят их
   * далеко не всегда. Помещение уточняет: его радиус меньше, и ниже выбирается
   * наименьший. Без вывода по объекту круги пропадали на всяком этаже без
   * обводок — то есть почти на всех.
   */
  const sections = report.whole === null ? report.rooms : [report.whole, ...report.rooms];

  const positions = new Map<string, PixelPoint>();
  for (const placement of sections) {
    for (const item of placement.nearby) {
      if (item.object.position !== null) positions.set(item.object.id, item.object.position);
    }
  }

  const circleByObject = new Map<string, CoverageCircle>();
  const gaps: PixelPoint[] = [];
  const shapes: CoverageRoom[] = [];

  for (const placement of sections) {
    const room = rooms.find((candidate) => candidate.id === placement.roomId);
    if (room?.outline != null) {
      shapes.push({ key: placement.roomId, points: room.outline, verdict: placement.verdict });
    }

    if (placement.radiusPx === null) continue;

    const counted = new Set(placement.counted);
    for (const item of placement.nearby) {
      const point = item.object.position;
      if (point === null) continue;
      /*
       * Круга нет только у передвижного: его норма — площадь, а не расстояние
       * (ППР, приложение № 2), и круг вокруг него означал бы норму, которой не
       * существует.
       *
       * У всех остальных круг есть, даже когда исполнение по карточке не
       * определяется. Заказчик: «или не все огнетушители учитывает». Прежде
       * круг требовал доказанного «переносной», и огнетушитель с незаполненной
       * карточкой оставался на плане без круга — молча, будто его и нет. То,
       * что он не зачтён, показано пунктиром и сказано словами в перечне
       * выводов; исчезать с картины он не должен.
       */
      const candidate: CoverageCircle = {
        key: `${item.object.id}-помещение:${placement.roomId}`,
        objectId: item.object.id,
        x: point.x,
        y: point.y,
        radiusPx: placement.radiusPx,
        counted: counted.has(item.object.id),
      };
      const current = circleByObject.get(item.object.id);
      // Один значок — один круг. На границе помещений несколько окружностей
      // выглядели как овал/сложная фигура и вводили в заблуждение.
      if (current === undefined || candidate.radiusPx < current.radiusPx) {
        circleByObject.set(item.object.id, { ...candidate, counted: candidate.counted || current?.counted === true });
      } else if (candidate.counted && !current.counted) {
        circleByObject.set(item.object.id, { ...current, counted: true });
      }
    }

    for (const gap of placement.coverage?.gaps ?? []) gaps.push(gap);
  }

  /*
   * Огнетушитель считается один раз, даже если он попал в круг нормы двух
   * соседних помещений: человеку важно, сколько их на этаже, а не сколько
   * получилось пар «огнетушитель и помещение».
   */
  const seen = new Set<string>();
  const countedIds = new Set<string>();
  let reachM: number | null = null;
  for (const placement of sections) {
    if (placement.requirement.reachM !== null) {
      reachM = reachM === null ? placement.requirement.reachM : Math.max(reachM, placement.requirement.reachM);
    }
    for (const item of placement.nearby) {
      seen.add(item.object.id);
    }
    for (const id of placement.counted) countedIds.add(id);
  }

  /*
   * Отчёт помещения содержит только огнетушители, чей радиус уже достаёт до
   * его границы. Значит, дальний огнетушитель, огнетушитель без помещения или
   * без заполненной карточки мог вообще не попасть в `nearby` и исчезал со
   * схемы. Слой плана обязан начинаться не с результата расчёта, а с факта:
   * каждый установленный огнетушитель получает круг. Расчёт лишь уточняет его
   * радиус и признак «зачтён».
   */
  const shownIds = new Set(circleByObject.keys());
  const knownRadii = sections
    .map((placement) => placement.radiusPx)
    .filter((radius): radius is number => radius !== null && radius > 0);
  const fallbackRadiusPx = knownRadii.length > 0
    ? Math.min(...knownRadii)
    : metersPerPixel !== null && metersPerPixel > 0
      ? FALLBACK_REACH_M / metersPerPixel
      : null;

  if (fallbackRadiusPx !== null) {
    for (const object of objects) {
      if (!isExtinguisher(object) || object.archivedAt !== null || object.position === null || shownIds.has(object.id)) continue;
      circleByObject.set(object.id, {
        key: `${object.id}-весь-план`,
        objectId: object.id,
        x: object.position.x,
        y: object.position.y,
        radiusPx: fallbackRadiusPx,
        counted: countedIds.has(object.id),
      });
      seen.add(object.id);
    }
  }

  return {
    circles: [...circleByObject.values()],
    gaps,
    rooms: shapes,
    summary: {
      total: seen.size,
      counted: countedIds.size,
      reachM,
      gaps: gaps.length,
      wholeObject: shapes.length === 0,
    },
  };
}
