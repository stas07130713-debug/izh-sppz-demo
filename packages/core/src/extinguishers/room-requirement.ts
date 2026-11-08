/**
 * Что требуется от огнетушителей в конкретном помещении (ППР, пункт 409,
 * приложения № 1 и 2).
 *
 * Требование складывается из четырёх сведений о помещении: категория по
 * взрывопожарной и пожарной опасности, назначение, площадь и классы возможного
 * пожара. Программа их не выдумывает — категорию определяет расчёт категорий,
 * площадь считается по обводке на плане, назначение и классы задаёт человек.
 * Чего нет, то и написано в `unknown`: молчаливая подстановка «по умолчанию»
 * превратила бы проверку в угадывание.
 *
 * Строка таблицы, по которой сделан вывод, возвращается текстом. Норма без
 * основания — это мнение программы, а с основанием её можно проверить по
 * первоисточнику и оспорить.
 */

import { formatFireRank, mergeFireRanks, parseFireRank, type FireClass, type FireRank } from './fire-rank.js';
import {
  CATEGORY_D_EXEMPT_AREA_M2, MOBILE_REQUIRED_FROM_M2, REACH_BY_CATEGORY, REACH_PUBLIC_M,
  hazardRowOf, mobileNorm, normalizeCategory, portableNorm,
  type HazardRow, type MobileOption, type RoomPurpose,
} from './ppr-tables.js';

/**
 * Сведений, без которых норма не определяется, четыре. Перечисление, а не
 * строка: по нему интерфейс ставит кнопку «задать» рядом с каждым, а строку
 * пришлось бы разбирать обратно.
 */
export type MissingFact = 'категория' | 'назначение' | 'площадь' | 'классы';

/** Сведения о помещении, от которых зависит норма. */
export interface RoomHazard {
  readonly category: string | null;
  readonly purpose: RoomPurpose | null;
  readonly areaM2: number | null;
  readonly fireClasses: readonly FireClass[];
  /** Помещение защищено автоматической установкой пожаротушения. */
  readonly hasSuppression: boolean;
  /**
   * Категория взята из характеристики здания, а не из карточки помещения.
   *
   * Класс возможного пожара и категория указываются на здание, и пока помещения
   * не категорированы, программа считает по зданию — но говорит об этом.
   */
  readonly categoryFromBuilding?: boolean;
  readonly classesFromBuilding?: boolean;
  readonly purposeFromBuilding?: boolean;
}

/** Требование по передвижным огнетушителям — комплектами на предельную площадь. */
export interface MobileRequirement {
  readonly limitAreaM2: number;
  /** Сколько раз предельная площадь укладывается в площадь помещения. */
  readonly sets: number;
  readonly byClass: readonly { readonly fireClass: FireClass; readonly options: readonly MobileOption[] }[];
}

export interface RoomRequirement {
  readonly row: HazardRow;
  /** По какой строке таблицы 1 сделан вывод и почему именно по ней. */
  readonly rowBasis: string;
  /** Классы возможного пожара, по которым сложено требование. */
  readonly fireClasses: readonly FireClass[];
  /** Нужны ли огнетушители вообще. */
  readonly needed: boolean;
  /** Почему не нужны: «категория Д площадью не более 100 кв. метров». */
  readonly exemption: string | null;
  readonly rank: FireRank;
  readonly rankText: string;
  /**
   * Графы приложения № 1 дословно — по одной на каждый объявленный класс.
   *
   * Заказчик: «показывать как требуется согласно таблиц ППР». Сложенный
   * ранг отвечает на вопрос «что купить», но не показывает, откуда взялась
   * каждая его часть: буква «С» приходит вместе с классом E, где ранг так и
   * напечатан — «55В, С, Е», — и без исходных граф читается как требование
   * класса С, которого в здании может не быть.
   */
  readonly printedCells: readonly { readonly fireClass: FireClass; readonly asPrinted: string }[];
  /** Наибольшее расстояние от очага до огнетушителя, метров. `null` — неизвестно. */
  readonly reachM: number | null;
  /** Помещение под АУП: расчётное количество берётся наполовину. */
  readonly halved: boolean;
  readonly mobile: MobileRequirement | null;
  /** Каких сведений не хватает, чтобы вывод был полным. */
  readonly unknown: readonly MissingFact[];
  /**
   * Что взято от здания, потому что своего у помещения нет.
   *
   * Вывод при этом получается тот же, что по объекту целиком, — и со стороны
   * читается как «помещение не считается отдельно». Проверка обязана сказать
   * об этом словами, иначе человек решит, что программа не различает
   * помещение и здание.
   */
  readonly fromBuilding: readonly MissingFact[];
}

const PUBLIC_PURPOSES: readonly RoomPurpose[] = ['административное', 'общественное'];
const PRODUCTION_PURPOSES: readonly RoomPurpose[] = ['производственное', 'складское'];

function isPublic(purpose: RoomPurpose | null): boolean {
  return purpose !== null && PUBLIC_PURPOSES.includes(purpose);
}

/**
 * Расстояние до огнетушителя.
 *
 * Административное и общественное назначение перебивает категорию: ППР задаёт
 * для таких помещений 20 метров, и это самое строгое из значений.
 */
function reachFor(hazard: RoomHazard): number | null {
  if (isPublic(hazard.purpose)) return REACH_PUBLIC_M;
  return REACH_BY_CATEGORY.get(normalizeCategory(hazard.category)) ?? null;
}

/**
 * По какой строке таблицы 1 считается помещение.
 *
 * Административные и общественные помещения в приложении № 1 не упомянуты: их
 * не категорируют по взрывопожарной опасности. Для них принята нижняя строка
 * «Г, Д» — наименее строгая из нормированных, — а расстояние берётся своё,
 * 20 метров по пункту 409. Требование получается «не ниже 2A, 55B, C, E»: то
 * самое, что обычно и предъявляют общественным зданиям.
 */
function rowBasisFor(hazard: RoomHazard, row: HazardRow, category: string): string {
  if (category !== '') {
    const source = hazard.categoryFromBuilding === true
      ? 'категория здания, помещения не категорированы'
      : `категория помещения ${category}`;
    return `строка «${row}» таблицы 1 (${source})`;
  }
  if (isPublic(hazard.purpose)) {
    return `строка «${row}» таблицы 1: помещение ${hazard.purpose} назначения по взрывопожарной`
      + ' и пожарной опасности не категорируется, принята нормированная строка с наименьшими'
      + ` требованиями; расстояние ${REACH_PUBLIC_M} м по пункту 409`;
  }
  return `строка «${row}» таблицы 1 принята по умолчанию: категория не задана`;
}

/**
 * Требование по передвижным огнетушителям.
 *
 * Порог оснащения — 500 кв. метров по пункту 409 ППР, одинаковый для всех
 * производственных и складских помещений. Предельная защищаемая площадь одного
 * комплекта берётся из приложения № 2 и своя для строки: 500 кв. метров для
 * А, Б, В1 — В4 и 800 — для Г. В зданиях и сооружениях категории Д передвижные
 * огнетушители не требуются.
 */
function mobileFor(hazard: RoomHazard, row: HazardRow, classes: readonly FireClass[]): MobileRequirement | null {
  if (hazard.purpose === null || !PRODUCTION_PURPOSES.includes(hazard.purpose)) return null;
  if (normalizeCategory(hazard.category) === 'Д') return null;
  if (hazard.areaM2 === null || hazard.areaM2 <= MOBILE_REQUIRED_FROM_M2) return null;

  const norms = classes
    .map((fireClass) => mobileNorm(row, fireClass))
    .filter((norm): norm is NonNullable<typeof norm> => norm !== null);
  const first = norms[0];
  if (first === undefined) return null;

  // Комплект — на каждую предельную площадь. АУП уменьшает расчётное
  // количество вдвое (ППР, пункт 409), но не меньше одного комплекта:
  // «половина» требования не означает его отмену.
  const full = Math.ceil(hazard.areaM2 / first.limitAreaM2);
  const sets = hazard.hasSuppression ? Math.max(1, Math.ceil(full / 2)) : full;

  return {
    limitAreaM2: first.limitAreaM2,
    sets,
    byClass: norms.map((norm) => ({ fireClass: norm.fireClass, options: norm.options })),
  };
}

/** Чего не хватает для полного вывода — списком, чтобы это можно было показать и заполнить. */
function missingFor(hazard: RoomHazard, category: string): readonly MissingFact[] {
  const unknown: MissingFact[] = [];

  // Категория обязательна только там, где помещения категорируют. У
  // административного помещения её нет и не будет — требовать её значило бы
  // держать такое помещение вечно «без полных сведений».
  if (category === '' && !isPublic(hazard.purpose)) unknown.push('категория');
  if (hazard.purpose === null) unknown.push('назначение');
  if (hazard.areaM2 === null) unknown.push('площадь');
  if (hazard.fireClasses.length === 0) unknown.push('классы');
  return unknown;
}

/**
 * Норма для помещения.
 *
 * Порядок важен: сначала проверяется освобождение по категории Д, потом
 * считается ранг. Освобождённому помещению ранг не нужен, и показывать его
 * значило бы предъявлять требование там, где его нет.
 */
export function roomRequirement(hazard: RoomHazard): RoomRequirement {
  const row = hazardRowOf(hazard.category);
  const category = normalizeCategory(hazard.category);
  const unknown = missingFor(hazard, category);
  const rowBasis = rowBasisFor(hazard, row, category);

  const fromBuilding: MissingFact[] = [];
  if (hazard.categoryFromBuilding === true) fromBuilding.push('категория');
  if (hazard.purposeFromBuilding === true) fromBuilding.push('назначение');
  if (hazard.classesFromBuilding === true) fromBuilding.push('классы');

  // Помещение категории Д не оснащается огнетушителями, если его площадь не
  // превышает 100 кв. метров (ППР, пункт 409).
  if (category === 'Д' && hazard.areaM2 !== null && hazard.areaM2 <= CATEGORY_D_EXEMPT_AREA_M2) {
    return {
      row, rowBasis, fireClasses: hazard.fireClasses, needed: false,
      exemption: `категория Д, площадь ${hazard.areaM2} м² не превышает ${CATEGORY_D_EXEMPT_AREA_M2} м²`,
      rank: { a: null, b: null, c: false, d: false, e: false }, rankText: '', printedCells: [],
      reachM: null, halved: false, mobile: null, unknown, fromBuilding,
    };
  }

  const rank = mergeFireRanks(
    hazard.fireClasses
      .map((fireClass) => portableNorm(row, fireClass))
      .filter((norm): norm is NonNullable<typeof norm> => norm !== null)
      .map((norm) => parseFireRank(norm.rank)),
  );

  return {
    row,
    rowBasis,
    fireClasses: hazard.fireClasses,
    needed: true,
    exemption: null,
    rank,
    rankText: formatFireRank(rank),
    printedCells: hazard.fireClasses
      .map((fireClass) => ({ fireClass, norm: portableNorm(row, fireClass) }))
      .filter((item): item is { fireClass: FireClass; norm: NonNullable<typeof item.norm> } => item.norm !== null)
      .map((item) => ({ fireClass: item.fireClass, asPrinted: item.norm.asPrinted })),
    reachM: reachFor(hazard),
    halved: hazard.hasSuppression,
    mobile: mobileFor(hazard, row, hazard.fireClasses),
    unknown,
    fromBuilding,
  };
}
