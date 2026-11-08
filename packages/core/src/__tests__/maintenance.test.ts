/**
 * Эталонные тесты мероприятий: запись проверки, ячейка журнала, статус.
 *
 * Фикстура — пожарный кран ВПВ: у него три подтверждённых мероприятия
 * (осмотр, испытание клапана, перекатка рукава) с периодичностями из
 * справочника заказчика, удобно для проверки независимости колонок.
 *
 * Смотри docs/02_ТЗ_редакция_3.md, Дополнение 1, части Д5–Д8, Д11.
 */

import { describe, expect, it } from 'vitest';
import type { MaintenanceDeps } from '../rules/maintenance-deps.js';
import type { ActivityScheduleSource } from '../rules/activity-source.js';
import { recordMaintenance } from '../rules/maintenance-scenarios.js';
import { activityCellsForObject, technicalStateForObject } from '../rules/activity-status.js';
import { placeObject } from '../objects/object-scenarios.js';
import type { ObjectDeps } from '../objects/object-deps.js';
import {
  fakeClock,
  fakeIdGenerator,
  fakeMaintenanceEventRepository,
  fakePlanObjectRepository,
} from './test-doubles.js';
import { makeSampleTree, makeTreeDeps, value } from './tree-fixtures.js';

const EXECUTOR = { fullName: 'Иванов Иван Иванович', position: 'Инженер по ПБ', organization: 'ООО «Пример»' };

/** Пожарный кран ВПВ: осмотр (1 мес), испытание клапана (6 мес), перекатка рукава (12 мес). */
async function makeFixture() {
  const treeDeps = makeTreeDeps();
  const { level } = await makeSampleTree(treeDeps);

  const objects = fakePlanObjectRepository();
  const objectDeps: ObjectDeps = { objects, tree: treeDeps.tree, clock: fakeClock(), ids: fakeIdGenerator() };
  const hydrantCabinet = value(
    await placeObject(objectDeps, { nodeId: level.id, typeCode: 'fire-hydrant-indoor', position: { x: 1, y: 1 } }),
  );

  const maintenanceDeps: MaintenanceDeps = {
    events: fakeMaintenanceEventRepository(),
    objects,
    clock: fakeClock(),
    ids: fakeIdGenerator(),
  };

  return { maintenanceDeps, hydrantCabinet };
}

describe('запись мероприятия', () => {
  it('запоминает версию регламента, по которой шла проверка', async () => {
    // Дополнение 5, часть Р9: без этой ссылки старая запись показывала бы
    // сегодняшний состав работ, а предъявляют то, что действовало в её день.
    const { maintenanceDeps, hydrantCabinet } = await makeFixture();

    const event = value(
      await recordMaintenance(maintenanceDeps, {
        objectId: hydrantCabinet.id,
        activityCode: 'osmotr',
        performedOn: '2026-08-01',
        result: 'выполнено',
        checklist: [{ item: 'Пломба на месте', result: 'выполнено', defect: null }],
        executorDetails: EXECUTOR,
        regulationVersionId: 'version-2',
        periodicityId: 'per-monthly',
      }),
    );

    expect(event.regulationVersionId).toBe('version-2');
    expect(event.periodicityId).toBe('per-monthly');
  });

  it('берёт версию у действующего регламента, а не у присланной интерфейсом', async () => {
    // Иначе запись могла бы сослаться не на тот состав работ: интерфейс держит
    // версию с момента открытия окна, а выпустить новую могли уже после.
    const { maintenanceDeps, hydrantCabinet } = await makeFixture();
    const activities: ActivityScheduleSource = {
      rulesFor: () => [{
        activityCode: 'per-monthly',
        title: 'Ежемесячно',
        periodicityMonths: null,
        checklist: [],
        ndReference: 'Регламент организации',
        needsVerification: false,
        regulationVersionId: 'version-3',
        periodicityId: 'per-monthly',
      }],
      nextDueOn: () => null,
    };

    const event = value(
      await recordMaintenance({ ...maintenanceDeps, activities }, {
        objectId: hydrantCabinet.id,
        activityCode: 'per-monthly',
        performedOn: '2026-08-01',
        result: 'выполнено',
        checklist: [{ item: 'Пломба на месте', result: 'выполнено', defect: null }],
        executorDetails: EXECUTOR,
        regulationVersionId: 'version-2',
      }),
    );

    expect(event.regulationVersionId).toBe('version-3');
  });

  it('запись без регламента остаётся допустимой', async () => {
    // Проверки, сделанные до появления конструктора, ссылки не имеют, и
    // переписывать их задним числом нельзя.
    const { maintenanceDeps, hydrantCabinet } = await makeFixture();

    const event = value(
      await recordMaintenance(maintenanceDeps, {
        objectId: hydrantCabinet.id,
        activityCode: 'osmotr',
        performedOn: '2026-08-01',
        result: 'выполнено',
        checklist: [{ item: 'Пломба на месте', result: 'выполнено', defect: null }],
        executorDetails: EXECUTOR,
      }),
    );

    expect(event.regulationVersionId).toBeNull();
  });

  it('создаёт событие с чек-листом и результатом', async () => {
    const { maintenanceDeps, hydrantCabinet } = await makeFixture();

    const event = value(
      await recordMaintenance(maintenanceDeps, {
        objectId: hydrantCabinet.id,
        activityCode: 'osmotr',
        performedOn: '2026-08-01',
        result: 'выполнено',
        checklist: [{ item: 'Пломба на месте', result: 'выполнено', defect: null }],
        executor: 'Иванов И.И.',
        executorDetails: EXECUTOR,
      }),
    );

    expect(event.activityCode).toBe('osmotr');
    expect(event.performedOn).toBe('2026-08-01');
    expect(event.executor).toBe('Иванов И.И.');
  });

  it('отклоняет проверку, записанную будущим числом', async () => {
    // Журнал записывает сделанное, а не запланированное: от даты выполнения
    // отсчитывается следующий срок, и запись будущим числом отодвигает его
    // на год вперёд — оборудование выглядит обслуженным, хотя к нему не
    // подходили. Найдено при проверке на журнале предприятия: десять записей
    // из семидесяти восьми стояли будущим числом.
    const { maintenanceDeps, hydrantCabinet } = await makeFixture();
    const result = await recordMaintenance(maintenanceDeps, {
      objectId: hydrantCabinet.id,
      activityCode: 'osmotr',
      performedOn: '2030-01-01',
      result: 'выполнено',
      checklist: [],
      executorDetails: EXECUTOR,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('ещё не наступила');
  });

  it('отклоняет мероприятие, не применимое к типу оборудования', async () => {
    const { maintenanceDeps, hydrantCabinet } = await makeFixture();

    const result = await recordMaintenance(maintenanceDeps, {
      objectId: hydrantCabinet.id,
      activityCode: 'perezaryadka', // это мероприятие для огнетушителей, не для крана ВПВ
      performedOn: '2026-08-01',
      result: 'выполнено',
      checklist: [],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('не применимо');
  });

  it('требует описание дефекта при результате хуже «выполнено»', async () => {
    const { maintenanceDeps, hydrantCabinet } = await makeFixture();

    const withoutDefect = await recordMaintenance(maintenanceDeps, {
      objectId: hydrantCabinet.id,
      activityCode: 'osmotr',
      performedOn: '2026-08-01',
      result: 'не выполнено',
      checklist: [{ item: 'Проверить исправность', result: 'не выполнено', defect: 'Обнаружена неисправность' }],
    });
    expect(withoutDefect.ok).toBe(false);

    const withDefect = await recordMaintenance(maintenanceDeps, {
      objectId: hydrantCabinet.id,
      activityCode: 'osmotr',
      performedOn: '2026-08-01',
      result: 'не выполнено',
      checklist: [],
      defect: 'Повреждён манометр',
    });
    expect(withDefect.ok).toBe(true);
  });

  it('не сохраняет замечание по пункту чек-листа без комментария', async () => {
    const { maintenanceDeps, hydrantCabinet } = await makeFixture();

    const result = await recordMaintenance(maintenanceDeps, {
      objectId: hydrantCabinet.id,
      activityCode: 'osmotr',
      performedOn: '2026-08-01',
      result: 'выполнено с замечаниями',
      checklist: [{ item: 'Проверить комплектность', result: 'выполнено с замечанием', defect: null }],
      defect: 'Есть замечание',
    });

    expect(result.ok).toBe(false);
  });

  it('не завершает чек-лист без полного исполнителя, но принимает акт сторонней организации', async () => {
    const { maintenanceDeps, hydrantCabinet } = await makeFixture();
    const base = {
      objectId: hydrantCabinet.id, activityCode: 'osmotr', performedOn: '2026-08-01', result: 'выполнено' as const,
      checklist: [{ item: 'Пломба', result: 'выполнено' as const, defect: null }],
    };
    expect((await recordMaintenance(maintenanceDeps, base)).ok).toBe(false);
    const external = await recordMaintenance(maintenanceDeps, {
      ...base,
      externalEvidence: {
        organization: 'ООО «Сервис»', inn: '1830000000', licenseNumber: '18-Б/00001',
        actNumber: '15', actDate: '2026-08-01', actFile: { hash: 'abc', fileName: 'акт-15.pdf' },
      },
    });
    expect(external.ok).toBe(true);
  });

  it('не завершает чек-лист с пунктом «не проверено»', async () => {
    const { maintenanceDeps, hydrantCabinet } = await makeFixture();
    const result = await recordMaintenance(maintenanceDeps, {
      objectId: hydrantCabinet.id, activityCode: 'osmotr', performedOn: '2026-08-01', result: 'выполнено',
      checklist: [{ item: 'Пломба', result: 'не проверено', defect: null }], executorDetails: EXECUTOR,
    });
    expect(result.ok).toBe(false);
  });

  it('отклоняет проверку выведенного из эксплуатации объекта', async () => {
    const { maintenanceDeps, hydrantCabinet } = await makeFixture();
    // Выводим напрямую через хранилище — сценарий вывода из эксплуатации
    // проверяется отдельно в plan-objects.test.ts.
    await maintenanceDeps.objects.save({ ...hydrantCabinet, archivedAt: '2026-08-01T00:00:00.000Z' });

    const result = await recordMaintenance(maintenanceDeps, {
      objectId: hydrantCabinet.id,
      activityCode: 'osmotr',
      performedOn: '2026-08-01',
      result: 'выполнено',
      checklist: [],
    });
    expect(result.ok).toBe(false);
  });
});

describe('ячейки журнала по объекту', () => {
  it('без единого выполнения — «нет данных» по каждому применимому мероприятию', async () => {
    const { hydrantCabinet } = await makeFixture();

    const cells = activityCellsForObject(hydrantCabinet, [], '2026-08-16', 14);

    expect(cells.map((cell) => cell.rule.activityCode)).toEqual(['osmotr', 'ispytanie', 'perekatka']);
    expect(cells.every((cell) => cell.schedule.status === 'нет данных')).toBe(true);
  });

  it('после мероприятия статус считается по факту, независимо по каждой колонке', async () => {
    const { maintenanceDeps, hydrantCabinet } = await makeFixture();

    const event = value(
      await recordMaintenance(maintenanceDeps, {
        objectId: hydrantCabinet.id,
        activityCode: 'osmotr',
        performedOn: '2026-08-01',
        result: 'выполнено',
        checklist: [],
      }),
    );

    const events = value(await maintenanceDeps.events.listByObject(hydrantCabinet.id));
    const cells = activityCellsForObject(hydrantCabinet, events, '2026-08-16', 14);

    const osmotr = cells.find((cell) => cell.rule.activityCode === 'osmotr');
    // Периодичность осмотра — 1 месяц, до следующей даты далеко: статус «норма».
    expect(osmotr?.schedule.status).toBe('норма');
    expect(osmotr?.history).toEqual([event]);

    const ispytanie = cells.find((cell) => cell.rule.activityCode === 'ispytanie');
    expect(ispytanie?.schedule.status).toBe('нет данных');
    const perekatka = cells.find((cell) => cell.rule.activityCode === 'perekatka');
    expect(perekatka?.schedule.status).toBe('нет данных');
  });

  it('тип оборудования без пакета правил даёт пустой список мероприятий', async () => {
    const treeDeps = makeTreeDeps();
    const { building } = await makeSampleTree(treeDeps);
    const objects = fakePlanObjectRepository();
    const objectDeps: ObjectDeps = { objects, tree: treeDeps.tree, clock: fakeClock(), ids: fakeIdGenerator() };

    // Пирс для забора воды — есть в каталоге, но справочник периодичности его не покрывает.
    const withoutPackage = value(
      await placeObject(objectDeps, { nodeId: building.id, typeCode: 'fire-truck-connection', position: { x: 1, y: 1 } }),
    );

    expect(activityCellsForObject(withoutPackage, [], '2026-08-16', 14)).toEqual([]);
  });

  it('для первой перезарядки использует дату изготовления, пока нет фактической перезарядки', async () => {
    const treeDeps = makeTreeDeps();
    const { level } = await makeSampleTree(treeDeps);
    const objects = fakePlanObjectRepository();
    const objectDeps: ObjectDeps = { objects, tree: treeDeps.tree, clock: fakeClock(), ids: fakeIdGenerator() };

    const extinguisher = value(
      await placeObject(objectDeps, {
        nodeId: level.id,
        typeCode: 'extinguisher-powder',
        position: { x: 1, y: 1 },
        extinguisherProfile: {
          placedOn: null,
          installationPoint: null,
          manufacturedOn: '2026-02-10',
          lastRechargeOn: null,
          nextAnnualCheckOn: null,
          nextWeighingOn: null,
          nextCylinderTestOn: null,
          serviceLifeEndsOn: null,
          responsiblePosition: null,
          responsibleOrganization: null,
          agent: null,
          propulsion: null,
          execution: null,
          nominalCharge: null,
          chargeUnit: null,
          tareMassKg: null,
          nominalFullMassKg: null,
          nominalPressureMpa: null,
          pressureMinMpa: null,
          pressureMaxMpa: null,
          temperatureMinC: null,
          temperatureMaxC: null,
          fireClasses: [],
          fireRating: null,
          certificateNumber: null,
          passportFile: null,
          bodyMaterial: null,
          innerCoating: null,
          stabilizedMulticomponentCharge: false,
          adverseConditions: [],
        },
      }),
    );

    const cells = activityCellsForObject(extinguisher, [], '2026-08-22', 14);
    const recharge = cells.find((cell) => cell.rule.activityCode === 'perezaryadka');
    expect(recharge?.schedule.lastDate).toBe('2026-02-10');
    expect(recharge?.schedule.nextDate).toBe('2031-02-10');
    expect(recharge?.schedule.status).toBe('норма');
  });

  it('фактическая перезарядка из журнала важнее даты изготовления', async () => {
    const treeDeps = makeTreeDeps();
    const { level } = await makeSampleTree(treeDeps);
    const objects = fakePlanObjectRepository();
    const objectDeps: ObjectDeps = { objects, tree: treeDeps.tree, clock: fakeClock(), ids: fakeIdGenerator() };
    const extinguisher = value(
      await placeObject(objectDeps, {
        nodeId: level.id,
        typeCode: 'extinguisher-powder',
        position: { x: 1, y: 1 },
        extinguisherProfile: { ...baseExtinguisherProfile(), manufacturedOn: '2026-02-10' },
      }),
    );
    const event = {
      id: 'recharge-1',
      siteId: extinguisher.siteId,
      objectId: extinguisher.id,
      activityCode: 'perezaryadka',
      performedOn: '2028-04-01',
      result: 'выполнено' as const,
      checklist: [],
      defect: null,
      executor: null,
      note: null,
      createdAt: '2028-04-01T00:00:00.000Z',
    };

    const cells = activityCellsForObject(extinguisher, [event], '2028-04-02', 14);
    const recharge = cells.find((cell) => cell.rule.activityCode === 'perezaryadka');
    expect(recharge?.schedule.lastDate).toBe('2028-04-01');
    expect(recharge?.schedule.nextDate).toBe('2033-04-01');
  });
});

function baseExtinguisherProfile() {
  return {
    placedOn: null,
    installationPoint: null,
    manufacturedOn: null,
    lastRechargeOn: null,
    nextAnnualCheckOn: null,
    nextWeighingOn: null,
    nextCylinderTestOn: null,
    serviceLifeEndsOn: null,
    responsiblePosition: null,
    responsibleOrganization: null,
    agent: null,
    propulsion: null,
    execution: null,
    nominalCharge: null,
    chargeUnit: null,
    tareMassKg: null,
    nominalFullMassKg: null,
    nominalPressureMpa: null,
    pressureMinMpa: null,
    pressureMaxMpa: null,
    temperatureMinC: null,
    temperatureMaxC: null,
    fireClasses: [],
    fireRating: null,
    certificateNumber: null,
    passportFile: null,
    bodyMaterial: null,
    innerCoating: null,
    stabilizedMulticomponentCharge: false,
    adverseConditions: [],
  };
}

describe('техническое состояние по чек-листу', () => {
  it('до проверки использует импортированное состояние, затем — последнюю проверку', async () => {
    const { maintenanceDeps, hydrantCabinet } = await makeFixture();
    const imported = { ...hydrantCabinet, technicalState: 'исправен' as const };
    expect(technicalStateForObject(imported, [])).toBe('исправен');

    const failed = value(await recordMaintenance(maintenanceDeps, {
      objectId: hydrantCabinet.id,
      activityCode: 'osmotr',
      performedOn: '2026-08-01',
      result: 'не выполнено',
      checklist: [{ item: 'Проверить исправность', result: 'не выполнено', defect: 'Обнаружена неисправность' }],
      defect: 'Обнаружена неисправность',
      executorDetails: EXECUTOR,
    }));
    const passed = value(await recordMaintenance(maintenanceDeps, {
      objectId: hydrantCabinet.id,
      activityCode: 'osmotr',
      performedOn: '2026-08-10',
      result: 'выполнено',
      checklist: [{ item: 'Проверить исправность', result: 'выполнено', defect: null }],
      executorDetails: EXECUTOR,
    }));

    expect(technicalStateForObject(imported, [failed])).toBe('неисправен');
    expect(technicalStateForObject(imported, [failed, passed])).toBe('исправен');
    expect(technicalStateForObject(
      { ...imported, technicalState: 'неисправен' },
      [{ ...passed, performedOn: '2026-08-20', checklist: [] }],
    )).toBe('неисправен');
  });

  it('не скрывает неисправность успешной проверкой другого вида и показывает замечания отдельно', async () => {
    const { maintenanceDeps, hydrantCabinet } = await makeFixture();
    const failed = value(await recordMaintenance(maintenanceDeps, {
      objectId: hydrantCabinet.id, activityCode: 'osmotr', performedOn: '2026-08-01', result: 'не выполнено',
      checklist: [{ item: 'Корпус', result: 'не выполнено', defect: 'Повреждён' }],
      defect: 'Повреждён', executorDetails: EXECUTOR,
    }));
    const otherPassed = value(await recordMaintenance(maintenanceDeps, {
      objectId: hydrantCabinet.id, activityCode: 'ispytanie', performedOn: '2026-08-10', result: 'выполнено',
      checklist: [{ item: 'Клапан', result: 'выполнено', defect: null }], executorDetails: EXECUTOR,
    }));
    expect(technicalStateForObject(hydrantCabinet, [failed, otherPassed])).toBe('неисправен');

    const remark = { ...failed, id: 'remark', result: 'выполнено с замечаниями' as const, performedOn: '2026-08-20' };
    expect(technicalStateForObject(hydrantCabinet, [remark])).toBe('исправен с замечаниями');
  });
});

describe('акт проверки в записи журнала', () => {
  /*
   * Найдено разбором главного экрана: окно чек-листа собирало акт — номер, дату
   * и приложенный файл — и передавало его в запись, а сценарий его не переносил.
   * Поля в вводе просто не было, и присланное молча пропадало: ни история
   * элемента, ни перечень документов акта после этого не находили, хотя человек
   * его приложил и был уверен, что акт сохранён.
   *
   * Акт предъявляют при проверке. Потерянный акт — это отсутствующее
   * доказательство проведённой работы.
   */
  const ACT = {
    number: '14/26',
    date: '2026-08-03',
    file: { hash: 'a1b2', fileName: 'акт-проверки.pdf' },
  };

  it('акт сохраняется вместе с записью', async () => {
    const { maintenanceDeps, hydrantCabinet } = await makeFixture();

    const event = value(
      await recordMaintenance(maintenanceDeps, {
        objectId: hydrantCabinet.id,
        activityCode: 'osmotr',
        performedOn: '2026-08-01',
        result: 'выполнено',
        checklist: [{ item: 'Пломба на месте', result: 'выполнено', defect: null }],
        executorDetails: EXECUTOR,
        inspectionAct: ACT,
      }),
    );

    expect(event.inspectionAct).toEqual(ACT);
  });

  it('без акта в записи стоит пусто, а не «не задано»', async () => {
    const { maintenanceDeps, hydrantCabinet } = await makeFixture();

    const event = value(
      await recordMaintenance(maintenanceDeps, {
        objectId: hydrantCabinet.id,
        activityCode: 'osmotr',
        performedOn: '2026-08-01',
        result: 'выполнено',
        checklist: [{ item: 'Пломба на месте', result: 'выполнено', defect: null }],
        executorDetails: EXECUTOR,
      }),
    );

    expect(event.inspectionAct).toBeNull();
  });
});
