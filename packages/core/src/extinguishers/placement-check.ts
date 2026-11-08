/**
 * Проверка расстановки огнетушителей на этаже (ППР РФ № 1479, пункт 409,
 * приложения № 1 и 2).
 *
 * Отвечает на тот же вопрос, что и информационная справка «о соответствии
 * размещения первичных средств пожаротушения»: хватает ли огнетушителей, того
 * ли они ранга и достаёт ли до любой точки помещения хотя бы один из них.
 *
 * Считать можно двумя способами, и оба законны.
 *
 * **По зданию целиком** — когда помещения не заведены. Норме достаточно
 * категории, назначения, площади и классов возможного пожара, а всё это есть
 * в характеристике здания. Обводить и категорировать каждое помещение ради
 * проверки огнетушителей — работа на недели, и требовать её нельзя.
 *
 * **По помещениям** — когда они заведены. Тогда норма считается для каждого
 * своя, а по обводке и масштабу проверяется ещё и расстояние: круги на плане
 * показывают, докуда достаёт огнетушитель. Это уточнение, а не условие.
 *
 * Вывод по каждому помещению отдельно — норма задана помещению, а не этажу. По
 * этажу проверяется только то, что помещению не принадлежит: масштаб плана,
 * наименьшее число огнетушителей и оборудование, оставшееся вне обводок.
 *
 * Замечания не смешиваются с нарушениями. «Ранг ниже требуемого» — нарушение
 * нормы, «в карточке не заполнен ранг» — недостаток сведений: пока карточку не
 * заполнили, программа не вправе объявлять ни соответствие, ни нарушение.
 */

import type { PixelPoint, PlanObject, Room } from '@izh/contracts';
import { coverRoom, pointInPolygon, type RoomCoverage } from './coverage.js';
import { extinguisherFitness, type ExtinguisherFitness } from './extinguisher-fitness.js';
import { FIRE_CLASSES, type FireClass } from './fire-rank.js';
import { MIN_PER_LEVEL, ROOM_PURPOSES, normalizeCategory, type RoomPurpose } from './ppr-tables.js';
import {
  PPR_409, WORKING_STATES, collectRoomFindings, type PlacementFinding,
} from './placement-findings.js';
import { roomRequirement, type MissingFact, type RoomRequirement } from './room-requirement.js';
import type { BuildingHazard } from './building-hazard.js';

export type { FindingSeverity, PlacementFinding, PlacementFix } from './placement-findings.js';

export type RoomVerdict = 'соответствует' | 'нарушение' | 'нет данных' | 'не требуется';

export interface RoomPlacement {
  readonly roomId: string;
  readonly roomName: string;
  readonly category: string | null;
  readonly areaM2: number | null;
  readonly requirement: RoomRequirement;
  /** Огнетушители, чей круг достаёт до помещения, с выводом по каждому. */
  readonly nearby: readonly { readonly object: PlanObject; readonly fitness: ExtinguisherFitness }[];
  readonly coverage: RoomCoverage | null;
  /**
   * Огнетушители, зачтённые как защита помещения: подходящие по рангу,
   * переносные и исправные. По ним считается покрытие площади.
   */
  readonly counted: readonly string[];
  /** Радиус нормы в точках подложки — им же рисуются круги на плане. */
  readonly radiusPx: number | null;
  readonly findings: readonly PlacementFinding[];
  readonly verdict: RoomVerdict;
}

export interface PlacementReport {
  /**
   * Вывод по объекту целиком — по характеристике здания.
   *
   * Заказчик: «при проверке огнетушителей окно должно выводить несколько
   * пунктов: вначале в целом по зданию, как сейчас на основании требований
   * ППР, и дальше по каждому такому помещению в схожем формате».
   *
   * Он стоит и тогда, когда помещения обведены: по зданию считают по площади
   * и категории здания, по помещению — по его собственным. Ответы разные, и
   * оба нужны: проверяющему предъявляют норму на объект, а работают с ней по
   * помещениям.
   *
   * `null` — характеристика здания не заполнена, считать не по чему.
   */
  readonly whole: RoomPlacement | null;
  /** Выводы по каждому обведённому помещению. Пусто — помещения не заведены. */
  readonly rooms: readonly RoomPlacement[];
  /** Выводы по этажу целиком. */
  readonly findings: readonly PlacementFinding[];
  /** Сколько огнетушителей учтено и сколько из них размещено на плане. */
  readonly total: number;
  readonly placed: number;
  readonly verdict: RoomVerdict;
}

export interface PlacementCheckInput {
  readonly rooms: readonly Room[];
  /** Оборудование этажа целиком: огнетушители отбираются здесь же. */
  readonly objects: readonly PlanObject[];
  readonly metersPerPixel: number | null;
  /**
   * Классы возможного пожара из характеристики здания.
   *
   * В справках заказчика класс возможного пожара указан на объект целиком —
   * «класс возможного пожара на объекте: А, В, Е». Помещение может уточнить
   * его своим списком, и тогда считается по помещению.
   */
  readonly defaultFireClasses?: readonly FireClass[];
  /**
   * Категория здания по взрывопожарной и пожарной опасности.
   *
   * Пока помещения не категорированы, считается по зданию: категория указана
   * и на него тоже. Категория помещения её перебивает — она точнее.
   */
  readonly buildingCategory?: string | null;
  /**
   * Характеристика объекта защиты целиком.
   *
   * По ней считается норма, когда помещения не заведены: категории,
   * назначения, площади и классов возможного пожара для этого достаточно.
   */
  readonly building?: BuildingHazard | null;
  /**
   * Назначение по классу функциональной пожарной опасности здания.
   *
   * Категорировать каждое помещение ради проверки огнетушителей не нужно:
   * назначение здания известно из его характеристики, и для большинства
   * объектов оно же и есть назначение помещений.
   */
  readonly buildingPurpose?: RoomPurpose | null;
}



/** Как назвать незаполненное сведение человеку. */
const MISSING_TEXT: Readonly<Record<MissingFact, string>> = {
  категория: 'категория по взрывопожарной и пожарной опасности',
  назначение: 'назначение помещения',
  классы: 'классы возможного пожара',
  площадь: 'площадь',
};

/**
 * Категория для показа человеку.
 *
 * В поле категории пишут не только «В2»: встречаются «не категорируется»,
 * «н/к», прочерк. Для расчёта это одно и то же — категории нет, — и показывать
 * такую запись как категорию нельзя: в окне проверки получалось «категория не
 * категорируется».
 */
function shownCategory(category: string | null): string | null {
  const value = normalizeCategory(category);
  return value === '' ? null : value;
}

function isExtinguisher(object: PlanObject): boolean {
  return object.typeCode === 'extinguisher' || object.typeCode.startsWith('extinguisher-');
}

function purposeOf(room: Room): RoomPurpose | null {
  const value = room.purpose ?? null;
  return ROOM_PURPOSES.find((purpose) => purpose === value) ?? null;
}

function classesOf(room: Room, fallback: readonly FireClass[]): readonly FireClass[] {
  const own = (room.fireClasses ?? [])
    .map((value) => value.trim().toUpperCase())
    .filter((value): value is FireClass => FIRE_CLASSES.includes(value as FireClass));
  return own.length > 0 ? own : fallback;
}

/** Итог по набору выводов: нарушение важнее нехватки сведений, та — важнее тишины. */
function verdictOf(findings: readonly PlacementFinding[]): RoomVerdict {
  if (findings.some((finding) => finding.severity === 'нарушение')) return 'нарушение';
  if (findings.some((finding) => finding.severity === 'замечание')) return 'нет данных';
  return 'соответствует';
}

function checkRoom(
  room: Room,
  extinguishers: readonly PlanObject[],
  input: PlacementCheckInput,
  fallbackClasses: readonly FireClass[],
): RoomPlacement {
  // Своё важнее общего: категория и классы помещения перебивают здание, но
  // откуда взято значение, в выводе видно — «категория здания, помещения не
  // категорированы» читается иначе, чем категория самого помещения.
  const ownClasses = classesOf(room, []);
  const category = room.category ?? input.buildingCategory ?? null;

  const ownPurpose = purposeOf(room);
  const purpose = ownPurpose ?? input.buildingPurpose ?? null;

  const requirement = roomRequirement({
    category,
    purpose,
    areaM2: room.areaM2,
    fireClasses: ownClasses.length > 0 ? ownClasses : fallbackClasses,
    hasSuppression: room.hasSuppression ?? false,
    categoryFromBuilding: room.category === null && category !== null,
    purposeFromBuilding: ownPurpose === null && purpose !== null,
    classesFromBuilding: ownClasses.length === 0 && fallbackClasses.length > 0,
  });

  const base = {
    roomId: room.id, roomName: room.name, category: shownCategory(category), areaM2: room.areaM2, requirement,
  };

  if (!requirement.needed) {
    return {
      ...base, nearby: [], coverage: null, counted: [], radiusPx: null, verdict: 'не требуется',
      findings: [{ severity: 'сведения', text: `Огнетушители не требуются: ${requirement.exemption ?? ''}`, clause: PPR_409 }],
    };
  }

  /*
   * Каждое незаполненное сведение — со своей подсказкой и своей правкой.
   *
   * Сказать «не задан масштаб» и оставить человека искать, где он задаётся, —
   * половина дела. Поле `fix` называет, что именно задать, и по нему рядом с
   * замечанием встаёт кнопка.
   *
   * Площадь считается по обводке и масштабу, и не хватать может любого из
   * них. Причина у них разная, и чинятся они в разных местах, поэтому
   * «площадь» разворачивается в то, чего не хватает на самом деле.
   */
  const findings: PlacementFinding[] = requirement.unknown.map((what) => {
    if (what === 'площадь') {
      return room.outline === null
        ? {
          severity: 'замечание' as const,
          text: 'Помещение не обведено на плане — без обводки не считается площадь.',
          clause: PPR_409, fix: 'обводка' as const,
        }
        : {
          severity: 'замечание' as const,
          text: 'Не задан масштаб плана — без него обводка не превращается в квадратные метры.',
          clause: PPR_409, fix: 'масштаб' as const,
        };
    }

    return {
      severity: 'замечание' as const,
      text: `Не заполнено: ${MISSING_TEXT[what]}. Без этого норма для помещения не определяется.`,
      clause: PPR_409,
      fix: what,
    };
  });

  /*
   * Сведения, взятые от здания, называются вслух.
   *
   * Заказчик: «отдельное помещение не равно этаж или объект, поэтому для него
   * должны быть другие правила при проверке; нужно именно с учётом категории
   * определить, какой огнетушитель должен там быть».
   *
   * Так и считается — но пока у помещения нет своей категории, назначения или
   * классов пожара, программа берёт их от здания. Ответ получается тот же, что
   * по объекту целиком, и со стороны выглядит, будто помещение не считается
   * отдельно. Молчать об этом нельзя: это не вывод по помещению, а вывод по
   * зданию, поставленный на его место до тех пор, пока помещение не заполнят.
   */
  const BORROWED_TEXT: Readonly<Record<string, string>> = {
    категория: 'категория взята от здания',
    назначение: 'назначение взято от здания',
    классы: 'классы возможного пожара взяты от здания',
  };
  /*
   * Это сведения, а не замечание.
   *
   * Заказчик решил раньше (29.08.2026): «для расчёта проверки огнетушителей не
   * нужно категорирование всех помещений, достаточно категории и назначения
   * самого здания». Значит, вывод по унаследованным сведениям — законный
   * вывод, и портить им общую оценку нельзя. Но человек обязан видеть, что
   * норма пришла от здания: иначе одинаковые числа у помещения и у объекта
   * читаются как недоработка программы.
   */
  for (const fact of requirement.fromBuilding) {
    findings.push({
      severity: 'сведения',
      text: `У помещения нет своих сведений: ${BORROWED_TEXT[fact] ?? fact}. Пока их не задать, норма для него совпадает с нормой по объекту целиком.`,
      clause: PPR_409,
      // «Площадь» сюда не попадает: её считают по обводке, а не берут от здания.
      fix: fact === 'площадь' ? undefined : fact,
    });
  }

  const radiusPx = requirement.reachM !== null && input.metersPerPixel !== null && input.metersPerPixel > 0
    ? requirement.reachM / input.metersPerPixel
    : null;

  // Огнетушитель защищает помещение, если он в пределах нормы от него, — и не
  // важно, числится он за этим помещением или стоит в коридоре рядом. Норма
  // ППР о расстоянии, а не о принадлежности.
  const outline = room.outline;
  const nearby = radiusPx === null || outline === null
    ? []
    : extinguishers
      .filter((object) => object.position !== null && reaches(object.position, outline, radiusPx))
      .map((object) => ({ object, fitness: extinguisherFitness(object, requirement) }));

  const suitable = nearby.filter(
    (item) => item.fitness.verdict === 'подходит'
      && item.fitness.execution === 'переносной'
      && WORKING_STATES.includes(item.object.technicalState),
  );

  const coverage = radiusPx === null || outline === null
    ? null
    : coverRoom(
      outline,
      suitable.map((item) => item.object.position).filter((point): point is PixelPoint => point !== null),
      radiusPx,
    );

  collectRoomFindings(findings, { room, requirement, nearby, suitable, coverage, radiusPx });

  return {
    ...base, nearby, coverage, radiusPx, findings,
    counted: suitable.map((item) => item.object.id),
    verdict: verdictOf(findings),
  };
}

/**
 * Проверка объекта защиты целиком — когда помещения не заведены.
 *
 * Расстояния здесь не считаются: без обводки неизвестно, где что стоит.
 * Проверяется остальное — ранг, передвижные по площади, — и это уже ответ на
 * вопрос «то ли висит и хватает ли его».
 */
function checkBuilding(
  building: BuildingHazard,
  extinguishers: readonly PlanObject[],
  metersPerPixel: number | null,
): RoomPlacement {
  const classes = building.fireClasses
    .map((value) => value.trim().toUpperCase())
    .filter((value): value is FireClass => FIRE_CLASSES.includes(value as FireClass));

  const requirement = roomRequirement({
    category: building.category,
    purpose: building.purpose,
    areaM2: building.areaM2,
    fireClasses: classes,
    hasSuppression: building.hasSuppression,
  });

  const findings: PlacementFinding[] = requirement.unknown.map((what) => ({
    severity: 'замечание' as const,
    text: `В характеристике здания не заполнено: ${MISSING_TEXT[what] ?? what}.`,
    clause: PPR_409,
    fix: 'здание' as const,
  }));

  // Годность считается по всем огнетушителям объекта: где именно они висят,
  // без плана неизвестно, а ранг от места не зависит.
  const nearby = extinguishers.map((object) => ({ object, fitness: extinguisherFitness(object, requirement) }));
  const suitable = nearby.filter((item) => item.fitness.verdict === 'подходит'
    && item.fitness.execution === 'переносной'
    && WORKING_STATES.includes(item.object.technicalState));

  collectRoomFindings(findings, {
    room: {
      id: '', name: 'Объект целиком', outline: null, areaM2: building.areaM2,
    } as unknown as Room,
    requirement, nearby, suitable, coverage: null, radiusPx: null, wholeObject: true,
  });

  /*
   * Радиус нормы считается и без помещений: покрытие площади по нему не
   * проверить — обводки нет, — но круги на плане построить можно, и это то
   * самое, что рисуют на схемах в справках.
   */
  const radiusPx = requirement.reachM !== null && metersPerPixel !== null && metersPerPixel > 0
    ? requirement.reachM / metersPerPixel
    : null;

  return {
    roomId: '', roomName: 'Объект целиком',
    category: shownCategory(building.category), areaM2: building.areaM2, requirement,
    nearby, coverage: null, counted: suitable.map((item) => item.object.id), radiusPx,
    findings, verdict: verdictOf(findings),
  };
}

/**
 * Достаёт ли круг огнетушителя до помещения.
 *
 * Проверяется и попадание внутрь обводки, и расстояние до её сторон: в большом
 * цехе огнетушитель стоит посреди помещения, и до углов ему может быть дальше
 * нормы — по углам такой огнетушитель отбрасывался бы как «далёкий».
 */
function reaches(point: PixelPoint, outline: readonly PixelPoint[], radiusPx: number): boolean {
  if (pointInPolygon(point, outline)) return true;

  for (let i = 0, j = outline.length - 1; i < outline.length; j = i, i += 1) {
    const a = outline[i];
    const b = outline[j];
    if (a === undefined || b === undefined) continue;
    if (distanceToSegment(point, a, b) <= radiusPx) return true;
  }
  return false;
}

/** Расстояние от точки до отрезка — обычная проекция с зажимом на концах. */
function distanceToSegment(point: PixelPoint, a: PixelPoint, b: PixelPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}


/**
 * Проверка этажа.
 *
 * Помещения, выведенные из эксплуатации, не проверяются: их уже нет, а норма
 * относится к действующим.
 */
export function checkExtinguisherPlacement(input: PlacementCheckInput): PlacementReport {
  const extinguishers = input.objects.filter((object) => isExtinguisher(object) && object.archivedAt === null);
  const rooms = input.rooms.filter((room) => room.archivedAt === null);
  const fallback = input.defaultFireClasses ?? [];

  /*
   * Считаем и по объекту целиком, и по каждому обведённому помещению.
   *
   * По объекту норме хватает категории, назначения и площади здания —
   * требовать обводки каждого помещения ради проверки нельзя. По помещению
   * норма своя, и по обводке с масштабом проверяется ещё и расстояние.
   *
   * Раньше одно исключало другое: появилось первое обведённое помещение — и
   * вывод по объекту пропадал. Заказчик просил обратного: сначала по объекту,
   * потом по помещениям.
   */
  const building = input.building ?? null;
  const whole = building === null ? null : checkBuilding(building, extinguishers, input.metersPerPixel);
  const checked = rooms.map((room) => checkRoom(room, extinguishers, input, fallback));

  const findings: PlacementFinding[] = [];
  const placed = extinguishers.filter((object) => object.position !== null);

  // О масштабе говорим только там, где он нужен: без помещений расстояния и
  // не считаются, и требовать масштаб не за чем.
  if (rooms.length > 0 && (input.metersPerPixel === null || input.metersPerPixel <= 0)) {
    findings.push({
      severity: 'замечание',
      text: 'Масштаб плана не задан: без него расстояния в метрах не проверяются.',
      clause: PPR_409,
      fix: 'масштаб',
    });
  }

  if (extinguishers.length < MIN_PER_LEVEL) {
    findings.push({
      severity: 'нарушение',
      text: `На этаже ${extinguishers.length} огнетушителей, требуется не менее ${MIN_PER_LEVEL}.`,
      clause: PPR_409,
    });
  }

  const unplaced = extinguishers.length - placed.length;
  if (unplaced > 0 && rooms.length > 0) {
    findings.push({
      severity: 'замечание',
      text: `${unplaced} огнетушителей заведены, но не размещены на плане — в расчёт покрытия они не входят.`,
      clause: PPR_409,
    });
  }

  if (rooms.length === 0 && building === null) {
    findings.push({
      severity: 'замечание',
      text: 'Не заполнена характеристика здания: без категории, назначения и площади норму не определить.',
      clause: PPR_409,
      fix: 'здание',
    });
  }

  const all = [
    ...findings,
    ...(whole === null ? [] : whole.findings),
    ...checked.flatMap((room) => room.findings),
  ];
  return {
    whole,
    rooms: checked,
    findings,
    total: extinguishers.length,
    placed: placed.length,
    verdict: verdictOf(all),
  };
}
