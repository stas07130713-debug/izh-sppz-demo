/**
 * Проверка расстановки огнетушителей сверяется с документами заказчика.
 *
 * Эталон — три информационные справки «о соответствии размещения первичных
 * средств пожаротушения» по ЦЭН-2 и рафинировочному цеху. В них выведены готовые
 * ответы, и программа обязана получать те же:
 *
 *   «для помещений категории В-2, В-3, В-4 … с учетом классов возможных пожаров
 *    (А, В, Е) принимаются огнетушители с рангом тушения модельного очага не
 *    ниже 3A, 70B, C, E»;
 *   «для помещений категории Г, Д … не ниже 2A, 55B, C, E».
 *
 * Если эти проверки покраснели — либо сломан расчёт, либо изменился норматив.
 * Второе бывает: ППР меняют постановлением. Тогда правится таблица в
 * `ppr-tables.ts`, а здесь появляется новая ожидаемая строка с датой и ссылкой
 * на документ, которым норма изменена.
 */

import { describe, expect, it } from 'vitest';
import type { PlanObject, Room } from '@izh/contracts';
import {
  checkExtinguisherPlacement, coverRoom, extinguisherFitness, formatFireRank,
  parseFireRank, purposeOfFunctionalClasses, rankSatisfies, roomRequirement, type FireClass,
} from '../index.js';

/** Классы возможного пожара на объекте заказчика: А, В, Е. */
const CLASSES: readonly FireClass[] = ['A', 'B', 'E'];

function requirementFor(category: string, area: number, extra: Partial<Parameters<typeof roomRequirement>[0]> = {}) {
  return roomRequirement({
    category, areaM2: area, fireClasses: CLASSES,
    purpose: 'производственное', hasSuppression: false, ...extra,
  });
}

describe('ранг тушения по таблице 1 ППР', () => {
  it('В2 — В4 с классами А, В, Е дают «3A, 70B, C, E» (справка по ОГП ЦЭН-2)', () => {
    for (const category of ['В2', 'В3', 'В4']) {
      expect(requirementFor(category, 400).rankText).toBe('3A, 70B, C, E');
    }
  });

  it('Г и Д с теми же классами дают «2A, 55B, C, E» (справка по ОО РЦ)', () => {
    expect(requirementFor('Г', 400).rankText).toBe('2A, 55B, C, E');
    expect(requirementFor('Д', 400).rankText).toBe('2A, 55B, C, E');
  });

  it('запись категории через дефис не меняет вывод: «В-2» — та же строка таблицы', () => {
    // В справках заказчика категории набраны и так, и так.
    expect(requirementFor('В-2', 400).rankText).toBe(requirementFor('В2', 400).rankText);
  });

  it('один класс пожара не тянет за собой требования других', () => {
    expect(requirementFor('В2', 400, { fireClasses: ['A'] }).rankText).toBe('3A');
    expect(requirementFor('Д', 400, { fireClasses: ['B'] }).rankText).toBe('55B');
  });
});

describe('расстояние до огнетушителя (ППР, пункт 409)', () => {
  it('30 метров для А, Б, В1 — В4; 40 для Г; 70 для Д', () => {
    expect(requirementFor('В2', 400).reachM).toBe(30);
    expect(requirementFor('А', 400).reachM).toBe(30);
    expect(requirementFor('Г', 400).reachM).toBe(40);
    expect(requirementFor('Д', 400).reachM).toBe(70);
  });

  it('20 метров в административных и общественных помещениях независимо от категории', () => {
    expect(requirementFor('В2', 400, { purpose: 'административное' }).reachM).toBe(20);
    expect(requirementFor('Д', 400, { purpose: 'общественное' }).reachM).toBe(20);
  });
});

describe('освобождения и передвижные огнетушители', () => {
  it('категория Д до 100 м² огнетушителями не оснащается', () => {
    expect(requirementFor('Д', 100).needed).toBe(false);
    expect(requirementFor('Д', 100.01).needed).toBe(true);
  });

  it('производственное помещение больше 500 м² требует передвижных', () => {
    // Участок ОГП ЦЭН — 3994,2 м², категории В2 — В4.
    const mobile = requirementFor('В3', 3994.2).mobile;
    expect(mobile?.limitAreaM2).toBe(500);
    expect(mobile?.sets).toBe(8);
  });

  it('порог оснащения — 500 м² по ППР, а не 800 из таблицы выбора', () => {
    // Пункт 409 требует передвижные для производственных и складских помещений
    // площадью более 500 кв. метров без деления по категориям. 800 — это
    // предельная защищаемая площадь одного комплекта для категории Г, и она
    // влияет на число комплектов, а не на сам порог.
    expect(requirementFor('Г', 500).mobile).toBeNull();
    expect(requirementFor('Г', 700).mobile?.limitAreaM2).toBe(800);
    expect(requirementFor('Г', 700).mobile?.sets).toBe(1);
    expect(requirementFor('Г', 900).mobile?.sets).toBe(2);
  });

  it('в помещениях категории Д передвижные не требуются', () => {
    expect(requirementFor('Д', 5000).mobile).toBeNull();
  });

  it('административное помещение передвижными не оснащается', () => {
    expect(requirementFor('В3', 3994.2, { purpose: 'административное' }).mobile).toBeNull();
  });

  it('АУП уменьшает расчётное количество вдвое, но не отменяет его', () => {
    expect(requirementFor('В3', 3994.2, { hasSuppression: true }).mobile?.sets).toBe(4);
    expect(requirementFor('В3', 600, { hasSuppression: true }).mobile?.sets).toBe(1);
  });
});

describe('разбор ранга тушения', () => {
  it('кириллица в записи ранга не мешает: «3А, 70В, С, Е» — тот же ранг', () => {
    expect(formatFireRank(parseFireRank('3А, 70В, С, Е'))).toBe('3A, 70B, C, E');
  });

  it('ППР разрешает более высокий ранг, чем предусмотрено приложениями', () => {
    const required = parseFireRank('2A, 55B, C, E');
    expect(rankSatisfies(parseFireRank('4A, 144B, C, E'), required)).toBe(true);
    expect(rankSatisfies(parseFireRank('2A, 55B, C, E'), required)).toBe(true);
  });

  it('ранга «2A, 55B» не хватает там, где требуется «3A, 70B, C, E»', () => {
    const required = parseFireRank('3A, 70B, C, E');
    expect(rankSatisfies(parseFireRank('2A, 55B, C, E'), required)).toBe(false);
  });

  it('пустая карточка не считается нулевым рангом', () => {
    expect(parseFireRank(null)).toEqual({ a: null, b: null, c: false, d: false, e: false });
  });
});

/** Квадрат со стороной `side` точек, левый верхний угол в начале координат. */
function square(side: number): readonly { x: number; y: number }[] {
  return [{ x: 0, y: 0 }, { x: side, y: 0 }, { x: side, y: side }, { x: 0, y: side }];
}

function room(patch: Partial<Room>): Room {
  return {
    id: 'помещение', siteId: 'объект', levelId: 'этаж', name: 'Участок', number: null,
    category: 'В3', categoryBasis: null, heightM: null, purpose: 'производственное',
    fireClasses: [...CLASSES], hasSuppression: false, outline: square(100), areaM2: 400,
    archivedAt: null, createdAt: '', updatedAt: '', rowVersion: 1, ...patch,
  };
}

function extinguisher(id: string, x: number, y: number, rating: string | null): PlanObject {
  return {
    id, siteId: 'объект', nodeId: 'этаж', typeCode: 'extinguisher-powder', regNumber: id,
    roomId: null, position: { x, y }, technicalState: 'исправен', archivedAt: null,
    extinguisherProfile: { fireRating: rating, execution: 'переносной', nominalCharge: 8 },
  } as unknown as PlanObject;
}

describe('покрытие помещения кругами радиуса нормы', () => {
  // Масштаб: 1 метр в точке. Квадрат 100×100 точек — помещение 100×100 метров.
  const METERS_PER_PIXEL = 1;

  it('один огнетушитель в центре не накрывает большой цех, и это нарушение', () => {
    const report = checkExtinguisherPlacement({
      rooms: [room({})],
      objects: [extinguisher('ОП-1', 50, 50, '3A, 70B, C, E'), extinguisher('ОП-2', 50, 50, '3A, 70B, C, E')],
      metersPerPixel: METERS_PER_PIXEL,
    });

    const first = report.rooms[0];
    expect(first?.verdict).toBe('нарушение');
    // Норма 30 метров, до дальних углов около 70 — покрыта лишь часть площади.
    expect(first?.coverage?.ratio ?? 1).toBeLessThan(1);
  });

  it('огнетушители по углам накрывают помещение целиком', () => {
    const report = checkExtinguisherPlacement({
      rooms: [room({ outline: square(40) })],
      objects: [
        extinguisher('ОП-1', 10, 10, '3A, 70B, C, E'),
        extinguisher('ОП-2', 30, 30, '3A, 70B, C, E'),
      ],
      metersPerPixel: METERS_PER_PIXEL,
    });

    expect(report.rooms[0]?.coverage?.ratio).toBe(1);
    expect(report.rooms[0]?.verdict).toBe('соответствует');
  });

  it('огнетушитель ниже требуемого ранга помещение не защищает', () => {
    const report = checkExtinguisherPlacement({
      rooms: [room({ outline: square(40) })],
      objects: [
        extinguisher('ОП-1', 10, 10, '2A, 55B, C, E'),
        extinguisher('ОП-2', 30, 30, '2A, 55B, C, E'),
      ],
      metersPerPixel: METERS_PER_PIXEL,
    });

    const first = report.rooms[0];
    expect(first?.verdict).toBe('нарушение');
    expect(first?.coverage?.covered).toBe(0);
    expect(first?.findings.some((finding) => finding.text.includes('ранг ниже требуемого'))).toBe(true);
  });

  it('неисправный огнетушитель защитой не считается', () => {
    const broken = { ...extinguisher('ОП-2', 30, 30, '3A, 70B, C, E'), technicalState: 'неисправен' } as PlanObject;
    const report = checkExtinguisherPlacement({
      rooms: [room({ outline: square(40) })],
      objects: [extinguisher('ОП-1', 10, 10, '3A, 70B, C, E'), broken],
      metersPerPixel: METERS_PER_PIXEL,
    });

    expect(report.rooms[0]?.findings.some((finding) => finding.text.includes('неисправен'))).toBe(true);
  });

  it('без масштаба расстояния не проверяются, и это сказано прямо', () => {
    const report = checkExtinguisherPlacement({
      rooms: [room({})],
      objects: [extinguisher('ОП-1', 50, 50, '3A, 70B, C, E'), extinguisher('ОП-2', 20, 20, '3A, 70B, C, E')],
      metersPerPixel: null,
    });

    expect(report.rooms[0]?.coverage).toBeNull();
    expect(report.findings.some((finding) => finding.text.includes('Масштаб плана не задан'))).toBe(true);
  });

  it('помещение категории Д до 100 м² в нарушения не попадает', () => {
    const report = checkExtinguisherPlacement({
      rooms: [room({ category: 'Д', outline: square(9), areaM2: 81 })],
      objects: [extinguisher('ОП-1', 500, 500, '2A, 55B'), extinguisher('ОП-2', 500, 500, '2A, 55B')],
      metersPerPixel: METERS_PER_PIXEL,
    });

    expect(report.rooms[0]?.verdict).toBe('не требуется');
  });

  it('на этаже должно быть не менее двух огнетушителей', () => {
    const report = checkExtinguisherPlacement({
      rooms: [room({ outline: square(20) })],
      objects: [extinguisher('ОП-1', 10, 10, '3A, 70B, C, E')],
      metersPerPixel: METERS_PER_PIXEL,
    });

    expect(report.findings.some((finding) => finding.text.includes('не менее 2'))).toBe(true);
  });
});

describe('подбор по марке и заряду (таблица 3)', () => {
  const requirement = requirementFor('Г', 400);

  it('ОП-4 подтверждает «2A, 55B, C, E» массой заряда', () => {
    const object = {
      typeCode: 'extinguisher-powder',
      extinguisherProfile: { fireRating: null, nominalCharge: 4, execution: 'переносной' },
    } as unknown as PlanObject;
    expect(extinguisherFitness(object, requirement).verdict).toBe('подходит');
  });

  it('ОП-2 не дотягивает: таблица требует не менее ОП-4', () => {
    const object = {
      typeCode: 'extinguisher-powder',
      extinguisherProfile: { fireRating: null, nominalCharge: 2, execution: 'переносной' },
    } as unknown as PlanObject;
    expect(extinguisherFitness(object, requirement).verdict).toBe('не подходит');
  });

  it('марка, которой нет в строке таблицы, не объявляется нарушением', () => {
    // ОВЭ заказчика стоят в помещениях с классом E, а таблица 3 для этого
    // класса приводит только ОП, ОУ и ОХ. Это повод заполнить ранг в карточке,
    // а не объявить исправное оборудование не соответствующим норме.
    const object = {
      typeCode: 'extinguisher-emulsion',
      extinguisherProfile: { fireRating: null, nominalCharge: 10, execution: 'переносной' },
    } as unknown as PlanObject;
    const fitness = extinguisherFitness(object, requirement);
    expect(fitness.verdict).toBe('нет сведений');
    expect(fitness.reason).toContain('паспорте');
  });

  it('пустая карточка не считается подходящей', () => {
    const object = { typeCode: 'extinguisher', extinguisherProfile: null } as unknown as PlanObject;
    expect(extinguisherFitness(object, requirement).verdict).toBe('нет сведений');
  });
});

describe('геометрия покрытия', () => {
  it('маленькое помещение проверяется по углам, а не пропускается', () => {
    const tiny = square(2);
    expect(coverRoom(tiny, [{ x: 1, y: 1 }], 30).ratio).toBe(1);
    expect(coverRoom(tiny, [{ x: 500, y: 500 }], 30).ratio).toBe(0);
  });

  it('непокрытые места возвращаются точками — их показывают на плане', () => {
    const coverage = coverRoom(square(100), [{ x: 0, y: 0 }], 20);
    expect(coverage.ratio).toBeLessThan(1);
    expect(coverage.gaps.length).toBeGreaterThan(0);
  });
});

describe('административные и общественные помещения', () => {
  // В приложении № 1 к ППР таких помещений нет: по взрывопожарной и пожарной
  // опасности их не категорируют. Принята нижняя строка «Г, Д» — наименее
  // строгая из нормированных, — а расстояние своё, 20 метров по пункту 409.
  const office = { category: null, purpose: 'административное' as const, areaM2: 60, fireClasses: CLASSES, hasSuppression: false };

  it('требование — не ниже 2A, 55B, C, E при 20 метрах', () => {
    const requirement = roomRequirement(office);
    expect(requirement.rankText).toBe('2A, 55B, C, E');
    expect(requirement.reachM).toBe(20);
  });

  it('отсутствие категории не считается нехваткой сведений', () => {
    // Категории у такого помещения нет и не будет: требовать её значило бы
    // держать кабинет вечно «без полных сведений».
    expect(roomRequirement(office).unknown).not.toContain('категория');
  });

  it('основание вывода названо, а не подразумевается', () => {
    expect(roomRequirement(office).rowBasis).toContain('не категорируется');
  });

  it('у производственного помещения без категории нехватка сведений остаётся', () => {
    const shop = { ...office, purpose: 'производственное' as const };
    expect(roomRequirement(shop).unknown).toContain('категория');
  });
});

describe('сведения здания подставляются, пока помещения не категорированы', () => {
  it('категория здания «В» считается по верхней строке таблицы', () => {
    // У здания категорий В1 — В4 не бывает: по СП 12.13130 на подклассы делятся
    // помещения. Одиночная «В» обязана попадать в ту же строку, иначе цех
    // считался бы по требованиям категории Д.
    expect(requirementFor('В', 400).rankText).toBe('3A, 70B, C, E');
    expect(requirementFor('В', 400).reachM).toBe(30);
  });

  it('категория и классы берутся от здания, когда своих у помещения нет', () => {
    const report = checkExtinguisherPlacement({
      rooms: [room({ category: null, fireClasses: [], outline: square(40) })],
      objects: [extinguisher('ОП-1', 10, 10, '3A, 70B, C, E'), extinguisher('ОП-2', 30, 30, '3A, 70B, C, E')],
      metersPerPixel: 1,
      buildingCategory: 'В',
      defaultFireClasses: CLASSES,
    });

    const first = report.rooms[0];
    expect(first?.requirement.rankText).toBe('3A, 70B, C, E');
    expect(first?.requirement.rowBasis).toContain('помещения не категорированы');
    expect(first?.verdict).toBe('соответствует');
  });

  it('своя категория помещения перебивает здание', () => {
    const report = checkExtinguisherPlacement({
      rooms: [room({ category: 'Д', areaM2: 400, outline: square(40) })],
      objects: [extinguisher('ОП-1', 10, 10, '2A, 55B, C, E'), extinguisher('ОП-2', 30, 30, '2A, 55B, C, E')],
      metersPerPixel: 1,
      buildingCategory: 'В',
      defaultFireClasses: CLASSES,
    });

    expect(report.rooms[0]?.requirement.rankText).toBe('2A, 55B, C, E');
    expect(report.rooms[0]?.verdict).toBe('соответствует');
  });
});

describe('назначение берётся от здания', () => {
  /*
   * Заказчик, 29.08.2026: «для расчёта проверки огнетушителей не нужно
   * категорирование всех помещений, достаточно категории и функционального
   * назначения самого здания».
   *
   * Класс функциональной пожарной опасности у здания есть всегда, и назначение
   * помещений для большинства объектов из него и следует.
   */
  it('Ф5.1 — производственное, Ф5.2 — складское', () => {
    expect(purposeOfFunctionalClasses('Ф5.1')).toBe('производственное');
    expect(purposeOfFunctionalClasses('Ф5.2')).toBe('складское');
    expect(purposeOfFunctionalClasses('Ф5.3')).toBe('производственное');
  });

  it('Ф4.3 — административное, прочие Ф1 — Ф4 — общественные', () => {
    expect(purposeOfFunctionalClasses('Ф4.3')).toBe('административное');
    expect(purposeOfFunctionalClasses('Ф3.1')).toBe('общественное');
    expect(purposeOfFunctionalClasses('Ф1.3')).toBe('общественное');
  });

  it('при нескольких классах берётся более строгий', () => {
    // Административная часть Ф4.3 и производственная Ф5.1 в одном корпусе —
    // обычное дело. Производственное строже: 30 метров против 20 и требование
    // передвижных.
    expect(purposeOfFunctionalClasses('Ф4.3, Ф5.1')).toBe('производственное');
  });

  it('без класса назначение не выдумывается', () => {
    expect(purposeOfFunctionalClasses(null)).toBeNull();
    expect(purposeOfFunctionalClasses('не задан')).toBeNull();
  });

  it('назначение здания снимает нехватку сведений у помещения', () => {
    const report = checkExtinguisherPlacement({
      rooms: [room({ purpose: null, outline: square(40) })],
      objects: [extinguisher('ОП-1', 10, 10, '3A, 70B, C, E'), extinguisher('ОП-2', 30, 30, '3A, 70B, C, E')],
      metersPerPixel: 1,
      buildingPurpose: 'производственное',
    });

    const first = report.rooms[0];
    expect(first?.requirement.unknown).not.toContain('назначение');
    expect(first?.requirement.reachM).toBe(30);
  });
});

describe('расчёт по объекту целиком', () => {
  /*
   * Заказчик, 29.08.2026: «для расчёта проверки огнетушителей не нужно
   * категорирование всех помещений, достаточно категорию и функциональное
   * назначение самого здания».
   *
   * Обводить и категорировать каждое помещение — работа на недели, а норме
   * хватает категории, назначения, площади и классов пожара. Помещения
   * остаются уточнением: с ними добавляются расстояния по плану.
   */
  const BUILDING = {
    category: 'В',
    purpose: 'производственное' as const,
    areaM2: 3994.2,
    fireClasses: ['A', 'B', 'E'],
    hasSuppression: false,
  };

  it('без помещений норма считается по зданию', () => {
    const report = checkExtinguisherPlacement({
      rooms: [],
      objects: [extinguisher('ОП-1', 0, 0, '3A, 70B, C, E'), extinguisher('ОП-2', 0, 0, '3A, 70B, C, E')],
      metersPerPixel: null,
      building: BUILDING,
    });

    const whole = report.whole;
    expect(whole?.roomName).toBe('Объект целиком');
    expect(whole?.requirement.rankText).toBe('3A, 70B, C, E');
    // Площадь больше 500 м²: нужны ещё и передвижные.
    expect(whole?.requirement.mobile?.sets).toBe(8);
  });

  it('без помещений масштаб не требуется', () => {
    // Расстояния без обводки всё равно не считаются, и требовать масштаб не за чем.
    const report = checkExtinguisherPlacement({
      rooms: [],
      objects: [extinguisher('ОП-1', 0, 0, '3A, 70B, C, E'), extinguisher('ОП-2', 0, 0, '3A, 70B, C, E')],
      metersPerPixel: null,
      building: BUILDING,
    });

    expect(report.findings.some((finding) => finding.text.includes('Масштаб'))).toBe(false);
  });

  it('ранг проверяется и без плана', () => {
    const report = checkExtinguisherPlacement({
      rooms: [],
      objects: [extinguisher('ОП-1', 0, 0, '2A, 55B, C, E'), extinguisher('ОП-2', 0, 0, '2A, 55B, C, E')],
      metersPerPixel: null,
      building: BUILDING,
    });

    expect(report.whole?.verdict).toBe('нарушение');
    expect(report.whole?.findings.some((item) => item.text.includes('ранг ниже требуемого'))).toBe(true);
  });

  it('незаполненная характеристика названа и указывает, где её править', () => {
    const report = checkExtinguisherPlacement({
      rooms: [],
      objects: [extinguisher('ОП-1', 0, 0, '3A, 70B, C, E'), extinguisher('ОП-2', 0, 0, '3A, 70B, C, E')],
      metersPerPixel: null,
      building: { ...BUILDING, areaM2: null, category: null },
    });

    const fixes = report.whole?.findings.map((finding) => finding.fix) ?? [];
    expect(fixes).toContain('здание');
  });

  /*
   * Заказчик: «при проверке огнетушителей окно должно выводить несколько
   * пунктов: вначале в целом по зданию... и дальше по каждому такому
   * помещению в схожем формате».
   *
   * Помещения не отменяют вывода по объекту: по зданию считают по его площади
   * и категории, по помещению — по его собственным, и оба ответа нужны.
   */
  it('помещения не отменяют вывода по объекту целиком', () => {
    const report = checkExtinguisherPlacement({
      rooms: [room({ outline: square(40) })],
      objects: [extinguisher('ОП-1', 10, 10, '3A, 70B, C, E'), extinguisher('ОП-2', 30, 30, '3A, 70B, C, E')],
      metersPerPixel: 1,
      building: BUILDING,
    });

    expect(report.whole?.roomName).toBe('Объект целиком');
    // Норма объекта считается по его площади, а не по площади помещения.
    expect(report.whole?.areaM2).toBe(BUILDING.areaM2);
    expect(report.rooms).toHaveLength(1);
    expect(report.rooms[0]?.roomName).toBe('Участок');
  });
});
