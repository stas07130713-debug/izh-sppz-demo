/**
 * Эталонные тесты объектов СППЗ.
 *
 * Главное, что здесь закреплено: объект и запись журнала — одно и то же, снятие
 * с плана не удаляет запись, а тип элемента должен соответствовать рабочей
 * области — на генплане извещателей не бывает.
 *
 * Смотри docs/02_ТЗ_редакция_3.md, часть 7.
 */

import { describe, expect, it } from 'vitest';
import type { ObjectDeps } from '../objects/object-deps.js';
import {
  archiveObject,
  moveObject,
  placeObject,
  relocateObject,
  setStorageSection,
  swapObjects,
  updateObject,
} from '../objects/object-scenarios.js';
import { elementsFor, elementTitle } from '../objects/element-lookup.js';
import {
  extinguisherModelsForManufacturer,
  extinguisherManufacturersForType,
  extinguisherReferenceByManufacturerAndModel,
  serviceLifeEndsOn,
} from '../objects/extinguisher-reference.js';
import { createChildNode } from '../object-tree/create-node.js';
import { fakeClock, fakeIdGenerator, fakePlanObjectRepository } from './test-doubles.js';
import { makeSampleTree, makeTreeDeps, value } from './tree-fixtures.js';

const fakeObjectRepository = fakePlanObjectRepository;

async function makeObjectDeps(): Promise<{
  deps: ObjectDeps;
  levelId: string;
  buildingId: string;
  storageId: string;
}> {
  const treeDeps = makeTreeDeps();
  const { level, building } = await makeSampleTree(treeDeps);
  const storage = value(
    await createChildNode(treeDeps, { parentId: building.id, kind: 'storage', name: 'Запас ОП' }),
  );
  return {
    deps: { objects: fakeObjectRepository(), tree: treeDeps.tree, clock: fakeClock(), ids: fakeIdGenerator() },
    levelId: level.id,
    buildingId: building.id,
    storageId: storage.id,
  };
}

describe('каталог элементов', () => {
  it('на генплане свои элементы, на этаже свои', () => {
    const general = elementsFor('general').map((item) => item.typeCode);
    const floor = elementsFor('floor').map((item) => item.typeCode);

    expect(general).toEqual([
      'hydrant', 'water-reservoir', 'fire-truck-connection', 'outdoor-ladder',
      'roof-fence', 'outdoor-cabinet', 'pump-station',
    ]);
    // Эталон обновлён 23.08.2026 дважды.
    //
    // Добавлена модульная автономная установка пожаротушения: она стоит
    // отдельно от систем, работающих от ППКУ, срабатывает без прибора
    // управления и обслуживается сама по себе.
    //
    // Убрано оборудование системы пожарной автоматики — извещатели,
    // оповещатели, клапаны, установки пожаротушения. Оно заводится составом
    // системы в карточке прибора (Дополнение 6), а не поштучно из библиотеки.
    // Второй путь заведения давал бы датчик без системы: он не попал бы ни в
    // проверку системы, ни в её журнал. Сам прибор в библиотеке остался — с
    // него система и начинается.
    // Эталон обновлён 24.08.2026: добавлена огнезащитная обработка — её
    // наносят на конструкции этажа и проверяют по ППР РФ №1479, п. 13.
    expect(floor).toEqual([
      'extinguisher', 'fire-hydrant-indoor', 'control-panel',
      'autonomous-suppression', 'fire-door', 'fireproofing', 'self-rescuer',
    ]);
  });

  it('на складе лежит то же, что и на этаже', () => {
    expect(elementsFor('storage').map((item) => item.typeCode)).toContain('extinguisher');
    expect(elementsFor('storage').map((item) => item.typeCode)).not.toContain('extinguisher-powder');
    expect(elementsFor('storage').map((item) => item.typeCode)).not.toContain('extinguisher-foam');
  });

  it('название типа берётся из каталога', () => {
    expect(elementTitle('extinguisher')).toBe('Огнетушитель');
    expect(elementTitle('extinguisher-bantl')).toBe('Огнетушитель BONTEL');
  });
});

describe('справочник огнетушителей', () => {
  it('подбирает модели по изготовителю и виду огнетушителя', () => {
    const models = extinguisherModelsForManufacturer('yarpozhinvest', 'extinguisher-powder').map((model) => model.code);
    expect(models).toContain('ОП-1 Ярпожинвест');
    expect(models).toContain('ОП-8 Ярпожинвест');
    expect(models).toContain('ОП-100 Ярпожинвест');
    expect(models).not.toContain('ОУ-5 Ярпожинвест');
  });

  it('возвращает срок службы, страницу изделия и паспорт файлом', () => {
    // Страница живёт на сайте, а файл — в его хранилище: у BONTEL это разные
    // хосты одного изготовителя, и справочник это различает (часть С89).
    const reference = extinguisherReferenceByManufacturerAndModel('BONTEL', 'ОВЭ-5 BONTEL');
    expect(reference?.serviceLifeYears).toBe(20);
    expect(reference?.officialUrl).toContain('bontel.ru/production');
    expect(reference?.passportUrl).toContain('.pdf');
  });

  it('не предлагает изготовителя для вида, который он не выпускает', () => {
    const powderManufacturers = extinguisherManufacturersForType('extinguisher-powder').map((item) => item.id);
    const emulsionManufacturers = extinguisherManufacturersForType('extinguisher-bantl').map((item) => item.id);
    expect(powderManufacturers).not.toContain('bontel');
    expect(emulsionManufacturers).toContain('bontel');
  });

  it('подставляет срок службы для порошковой модели Пожтехника', () => {
    const reference = extinguisherReferenceByManufacturerAndModel('Пожтехника', 'ОП-8 Пожтехника');
    expect(reference?.serviceLifeYears).toBe(10);
  });

  it('считает окончание срока службы от даты изготовления календарными годами', () => {
    expect(serviceLifeEndsOn('2026-02-10', 10)).toBe('2036-02-10');
    expect(serviceLifeEndsOn('2024-02-29', 1)).toBe('2025-02-28');
    expect(serviceLifeEndsOn('2026-02-30', 10)).toBeNull();
  });
});

describe('размещение объектов', () => {
  it('создаёт объект на поэтажном плане', async () => {
    const { deps, levelId } = await makeObjectDeps();

    const object = value(
      await placeObject(deps, {
        nodeId: levelId,
        typeCode: 'extinguisher',
        position: { x: 120, y: 340 },
        regNumber: '28-27',
      }),
    );

    expect(object.typeCode).toBe('extinguisher');
    expect(object.position).toEqual({ x: 120, y: 340 });
    expect(object.regNumber).toBe('28-27');
    expect(object.technicalState).toBe('не определено');
  });

  it('объект заводится и до загрузки плана — без места установки', async () => {
    const { deps, levelId } = await makeObjectDeps();

    // План ещё не загружен: объект попадает в журнал и встаёт в строку
    // ожидающих размещения (ТЗ, часть 7.3).
    const object = value(
      await placeObject(deps, { nodeId: levelId, typeCode: 'extinguisher', position: null }),
    );

    expect(object.position).toBeNull();
    expect(value(await deps.objects.listByNode(levelId))).toHaveLength(1);
  });

  it('не ставит гидрант на поэтажный план', async () => {
    const { deps, levelId } = await makeObjectDeps();

    const result = await placeObject(deps, {
      nodeId: levelId,
      typeCode: 'hydrant',
      position: { x: 10, y: 10 },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('не размещается');
  });

  it('гидрант ставится на генплан здания', async () => {
    const { deps, buildingId } = await makeObjectDeps();

    const result = await placeObject(deps, {
      nodeId: buildingId,
      typeCode: 'hydrant',
      position: { x: 50, y: 60 },
    });

    expect(result.ok).toBe(true);
  });

  it('на складе объект заводится без координат', async () => {
    const { deps, storageId } = await makeObjectDeps();

    const object = value(
      await placeObject(deps, {
        nodeId: storageId,
        typeCode: 'extinguisher',
        position: { x: 10, y: 10 },
      }),
    );

    // Координаты на складе значения не имеют: важен состав.
    expect(object.position).toBeNull();
  });

  it('в узел без рабочей области объект не ставится', async () => {
    const { deps } = await makeObjectDeps();
    const treeDeps = makeTreeDeps();
    const { shop } = await makeSampleTree(treeDeps);

    const result = await placeObject(deps, {
      nodeId: shop.id,
      typeCode: 'extinguisher',
      position: { x: 1, y: 1 },
    });
    expect(result.ok).toBe(false);
  });
});

/*
 * Заказчик, 29.08.2026: «все объекты СППЗ, которые есть на плане, должны быть
 * в журнале и наоборот». Прежде объект снимали с плана, и он оставался записью
 * без координат: в журнале числится, на плане не найти. Снятие убрано — уйти с
 * плана можно только вместе с местом, переносом или выводом из эксплуатации.
 */
describe('перемещение и уход с плана', () => {
  it('переносит объект в совместимую рабочую область и возвращает в строку ожидания', async () => {
    const { deps, levelId, storageId } = await makeObjectDeps();
    const object = value(
      await placeObject(deps, { nodeId: levelId, typeCode: 'extinguisher', position: { x: 10, y: 10 } }),
    );

    const relocated = value(await relocateObject(deps, { id: object.id, nodeId: storageId }));

    expect(relocated.nodeId).toBe(storageId);
    expect(relocated.position).toBeNull();
    expect(relocated.roomId).toBeNull();
    expect(relocated.rowVersion).toBe(object.rowVersion + 1);
  });

  it('перемещает значок по плану', async () => {
    const { deps, levelId } = await makeObjectDeps();
    const object = value(
      await placeObject(deps, { nodeId: levelId, typeCode: 'extinguisher', position: { x: 10, y: 10 } }),
    );

    const moved = value(await moveObject(deps, { id: object.id, position: { x: 400, y: 500 } }));
    expect(moved.position).toEqual({ x: 400, y: 500 });
    expect(moved.rowVersion).toBe(object.rowVersion + 1);
  });

  it('перенос не оставляет запись на прежнем узле', async () => {
    // Иначе объект числился бы в журнале этажа, которого на его плане нет.
    const { deps, levelId, storageId } = await makeObjectDeps();
    const object = value(
      await placeObject(deps, { nodeId: levelId, typeCode: 'extinguisher', position: { x: 10, y: 10 } }),
    );

    value(await relocateObject(deps, { id: object.id, nodeId: storageId }));

    expect(value(await deps.objects.listByNode(levelId))).toHaveLength(0);
    expect(value(await deps.objects.listByNode(storageId))).toHaveLength(1);
  });

  it('вывод из эксплуатации убирает объект и с плана, и из работы', async () => {
    const { deps, levelId } = await makeObjectDeps();
    const object = value(
      await placeObject(deps, { nodeId: levelId, typeCode: 'extinguisher', position: { x: 10, y: 10 } }),
    );

    const archived = value(await archiveObject(deps, object.id));

    expect(archived.archivedAt).not.toBeNull();
    // Запись при этом не пропадает: журнал задним числом не переписывается.
    expect(value(await deps.objects.listByNode(levelId))).toHaveLength(1);
  });
});

describe('карточка объекта', () => {
  it('уточняет служебный подтип огнетушителя без создания нового объекта', async () => {
    const { deps, levelId } = await makeObjectDeps();
    const object = value(
      await placeObject(deps, { nodeId: levelId, typeCode: 'extinguisher', position: { x: 10, y: 10 } }),
    );

    const updated = value(await updateObject(deps, {
      id: object.id,
      typeCode: 'extinguisher-co2',
      model: 'ОУ-5',
    }));

    expect(updated.id).toBe(object.id);
    expect(updated.typeCode).toBe('extinguisher-co2');
    expect(updated.model).toBe('ОУ-5');
  });

  it('правка одного поля не стирает остальные', async () => {
    const { deps, levelId } = await makeObjectDeps();
    const object = value(await placeObject(deps, {
      nodeId: levelId,
      typeCode: 'extinguisher',
      position: { x: 10, y: 10 },
      regNumber: '28-27',
      model: 'ОП-5',
      manufacturer: 'Ярпожинвест',
      commissionedOn: '2024-03-30',
      responsible: 'Иванов И.И.',
    }));

    // Вызов меняет только примечание. Все поля правки необязательные, поэтому
    // непереданное поле обязано сохранить прежнее значение.
    const updated = value(await updateObject(deps, { id: object.id, note: 'перевешен у выхода' }));

    expect(updated.note).toBe('перевешен у выхода');
    expect(updated.regNumber).toBe('28-27');
    expect(updated.model).toBe('ОП-5');
    expect(updated.manufacturer).toBe('Ярпожинвест');
    expect(updated.commissionedOn).toBe('2024-03-30');
    expect(updated.responsible).toBe('Иванов И.И.');
  });

  it('переданное пустое значение очищает поле', async () => {
    const { deps, levelId } = await makeObjectDeps();
    const object = value(await placeObject(deps, {
      nodeId: levelId, typeCode: 'extinguisher', position: { x: 10, y: 10 }, regNumber: '28-27',
    }));

    // Отличие от предыдущего случая: поле передано явно и пустым — значит,
    // пользователь его стёр, и это надо выполнить.
    expect(value(await updateObject(deps, { id: object.id, regNumber: null })).regNumber).toBeNull();
  });

  it('уточняет подтип извещателя и системы пожаротушения внутри общей строки', async () => {
    const { deps, levelId } = await makeObjectDeps();
    const detector = value(await placeObject(deps, {
      nodeId: levelId, typeCode: 'fire-detector', position: { x: 10, y: 10 },
    }));
    const suppression = value(await placeObject(deps, {
      nodeId: levelId, typeCode: 'fire-suppression-system', position: { x: 20, y: 20 },
    }));

    expect(value(await updateObject(deps, { id: detector.id, typeCode: 'heat-detector' })).typeCode).toBe('heat-detector');
    expect(value(await updateObject(deps, { id: suppression.id, typeCode: 'gas-module' })).typeCode).toBe('gas-module');
  });

  it('заполняется и хранит техническое состояние', async () => {
    const { deps, levelId } = await makeObjectDeps();
    const object = value(
      await placeObject(deps, { nodeId: levelId, typeCode: 'extinguisher', position: { x: 10, y: 10 } }),
    );

    const updated = value(
      await updateObject(deps, {
        id: object.id,
        regNumber: '28-27',
        model: 'ОП-5(з) АВСЕ',
        commissionedOn: '2024-05-12',
        serviceLifeMonths: 120,
        technicalState: 'исправен',
      }),
    );

    expect(updated.model).toBe('ОП-5(з) АВСЕ');
    expect(updated.commissionedOn).toBe('2024-05-12');
    expect(updated.technicalState).toBe('исправен');
    // Правка карточки не сдвигает объект на плане.
    expect(updated.position).toEqual({ x: 10, y: 10 });
  });

  it('сохраняет и повторно открывает изготовителя, модель и срок службы в годах', async () => {
    const { deps, levelId } = await makeObjectDeps();
    const object = value(
      await placeObject(deps, { nodeId: levelId, typeCode: 'extinguisher-bantl', position: null }),
    );

    await updateObject(deps, {
      id: object.id,
      manufacturer: 'BONTEL',
      model: 'ОВЭ-5 BONTEL',
      serviceLifeYears: 20,
      serialNumber: 'BNT-2026-005',
    });
    const reopened = value(await deps.objects.getById(object.id));

    expect(reopened.manufacturer).toBe('BONTEL');
    expect(reopened.model).toBe('ОВЭ-5 BONTEL');
    expect(reopened.serviceLifeYears).toBe(20);
    expect(reopened.serialNumber).toBe('BNT-2026-005');
  });

  it('вывод из эксплуатации не удаляет объект', async () => {
    const { deps, levelId } = await makeObjectDeps();
    const object = value(
      await placeObject(deps, { nodeId: levelId, typeCode: 'sounder', position: { x: 1, y: 2 } }),
    );

    const archived = value(await archiveObject(deps, object.id));
    expect(archived.archivedAt).not.toBeNull();
    expect(value(await deps.objects.getById(object.id)).archivedAt).not.toBeNull();
  });

  it('выведенный из эксплуатации объект не правится', async () => {
    const { deps, levelId } = await makeObjectDeps();
    const object = value(
      await placeObject(deps, { nodeId: levelId, typeCode: 'sounder', position: { x: 1, y: 2 } }),
    );
    await archiveObject(deps, object.id);

    const result = await updateObject(deps, { id: object.id, regNumber: '5' });
    expect(result.ok).toBe(false);
  });
});

describe('склад СППЗ: полки и обмен местами', () => {
  /*
   * Заказчик, 29.08.2026: «этот нужно сдать на перезарядку, пользователь
   * нажимает заменить и выбирает конкретный огнетушитель со склада, и он
   * меняет своё месторасположение».
   *
   * Это обмен, а не замена записи: оба огнетушителя уже заведены, у обоих своя
   * история, и списывать никого нельзя — сданный вернётся с перезарядки.
   */
  it('обмен меняет местами два объекта и не трогает их истории', async () => {
    const { deps, levelId, storageId } = await makeObjectDeps();
    const onWall = value(await placeObject(deps, {
      nodeId: levelId, typeCode: 'extinguisher', position: { x: 10, y: 20 }, regNumber: 'ОП-1',
    }));
    const spare = value(await placeObject(deps, {
      nodeId: storageId, typeCode: 'extinguisher', position: null, regNumber: 'ОП-2',
    }));

    value(await swapObjects(deps, { firstId: onWall.id, secondId: spare.id }));

    const movedWall = value(await deps.objects.getById(onWall.id));
    const movedSpare = value(await deps.objects.getById(spare.id));

    // Подменный встал на стену, снятый уехал на склад.
    expect(movedSpare.nodeId).toBe(levelId);
    expect(movedSpare.position).toEqual({ x: 10, y: 20 });
    expect(movedWall.nodeId).toBe(storageId);
    expect(movedWall.position).toBeNull();
    // Ни один не выведен из эксплуатации: оба в работе, просто в разных местах.
    expect(movedWall.archivedAt).toBeNull();
    expect(movedSpare.archivedAt).toBeNull();
    expect(movedWall.regNumber).toBe('ОП-1');
    expect(movedSpare.regNumber).toBe('ОП-2');
  });

  it('обмен с самим собой — не операция', async () => {
    const { deps, levelId } = await makeObjectDeps();
    const object = value(await placeObject(deps, {
      nodeId: levelId, typeCode: 'extinguisher', position: { x: 1, y: 1 },
    }));

    const result = await swapObjects(deps, { firstId: object.id, secondId: object.id });
    expect(result.ok).toBe(false);
  });

  it('обмен отказывает, если вид на чужой рабочей области не размещается', async () => {
    // Наружные средства живут на генплане, внутренние — на этажах. Узнать об
    // этом нужно до записи, а не после.
    const { deps, levelId, buildingId } = await makeObjectDeps();
    const indoor = value(await placeObject(deps, {
      nodeId: levelId, typeCode: 'fire-hydrant-indoor', position: { x: 1, y: 1 },
    }));
    const outdoor = value(await placeObject(deps, {
      nodeId: buildingId, typeCode: 'hydrant', position: { x: 2, y: 2 },
    }));

    const result = await swapObjects(deps, { firstId: indoor.id, secondId: outdoor.id });
    expect(result.ok).toBe(false);

    // И ничего не сдвинулось: отказ не должен оставлять половину сделанного.
    expect(value(await deps.objects.getById(indoor.id)).nodeId).toBe(levelId);
    expect(value(await deps.objects.getById(outdoor.id)).nodeId).toBe(buildingId);
  });

  it('полка меняется только у складского оборудования', async () => {
    const { deps, levelId, storageId } = await makeObjectDeps();
    const spare = value(await placeObject(deps, {
      nodeId: storageId, typeCode: 'extinguisher', position: null,
    }));
    const onWall = value(await placeObject(deps, {
      nodeId: levelId, typeCode: 'extinguisher', position: { x: 5, y: 5 },
    }));

    const moved = value(await setStorageSection(deps, { id: spare.id, section: 'ремонт' }));
    expect(moved.storageSection).toBe('ремонт');

    // У объекта на плане полки нет: «резерв» на стене ничего не значит, и
    // молчаливо пропустить такую попытку значило бы скрыть промах.
    const refused = await setStorageSection(deps, { id: onWall.id, section: 'ремонт' });
    expect(refused.ok).toBe(false);
  });

  it('обмен переносит и полку: подменный уходит туда, где лежал сменённый', async () => {
    const { deps, storageId } = await makeObjectDeps();
    const inRepair = value(await placeObject(deps, {
      nodeId: storageId, typeCode: 'extinguisher', position: null,
    }));
    value(await setStorageSection(deps, { id: inRepair.id, section: 'ремонт' }));
    const spare = value(await placeObject(deps, {
      nodeId: storageId, typeCode: 'extinguisher', position: null,
    }));
    value(await setStorageSection(deps, { id: spare.id, section: 'резерв' }));

    value(await swapObjects(deps, { firstId: inRepair.id, secondId: spare.id }));

    expect(value(await deps.objects.getById(inRepair.id)).storageSection).toBe('резерв');
    expect(value(await deps.objects.getById(spare.id)).storageSection).toBe('ремонт');
  });
});
