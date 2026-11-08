/**
 * Сквозная проверка цепочки: настройки → чек-лист → запись в журнале.
 *
 * Отдельными частями всё уже закрыто: движок считает сроки, адаптер собирает
 * правила, сценарий пишет событие. Но заказчику важна не часть, а цепочка
 * целиком: включил регламент с периодичностью, отметил внутри него шаги — и
 * ровно эти шаги обязаны появиться в чек-листе элемента и лечь в журнал.
 *
 * Поэтому здесь настоящий путь без подмен: реальный мост
 * `regulationScheduleSource`, реальный сценарий `recordMaintenanceBatch`,
 * реальный расчёт состояний. Подделаны только хранилища.
 */

import { describe, expect, it } from 'vitest';
import type {
  Clock,
  IdGenerator,
  LocalDocument,
  MaintenanceEvent,
  MaintenanceEventRepository,
  PlanObject,
  PlanObjectRepository,
  Regulation,
  RegulationPeriodicity,
  RegulationTemplate,
  RegulationVersion,
  Result,
  TreeNode,
} from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import {
  activityCellsForObject, createRegulation, defaultPeriodicities,
  recordMaintenanceBatch, releaseRegulationVersion,
} from '@izh/core';
import { regulationScheduleSource } from './regulation-source';

const NODES: readonly TreeNode[] = [
  { id: 'org', parentId: null, kind: 'organization', name: 'Предприятие', archivedAt: null },
] as unknown as readonly TreeNode[];

const OBJECT: PlanObject = {
  id: 'obj-1',
  siteId: 'org',
  nodeId: 'org',
  typeCode: 'fire-hydrant-indoor',
  technicalState: 'исправен',
  position: { x: 0, y: 0 },
  extinguisherProfile: null,
  archivedAt: null,
} as unknown as PlanObject;

function fakeObjects(): PlanObjectRepository {
  return {
    async getById(id: string) {
      return id === OBJECT.id ? ok(OBJECT) : err('NOT_FOUND', 'Нет такого объекта.');
    },
  } as unknown as PlanObjectRepository;
}

function fakeEvents(): MaintenanceEventRepository & { readonly saved: MaintenanceEvent[] } {
  const saved: MaintenanceEvent[] = [];
  return {
    saved,
    async listByObject(objectId) { return ok(saved.filter((event) => event.objectId === objectId)); },
    async list() { return ok([...saved]); },
    async save(event) { saved.push(event); return ok(undefined); },
    async saveMany(events) { saved.push(...events); return ok(undefined); },
  };
}

let counter = 0;
const ids: IdGenerator = { newId: () => `id-${++counter}` };
const clock: Clock = { nowUtc: () => '2026-08-23T09:00:00.000Z' };

/**
 * Регламент организации, собранный так же, как его собирает конструктор: из
 * нормативной библиотеки, с отключением одной работы внутри периодичности.
 */
function makeRegulation(): { regulation: Regulation; version: RegulationVersion; firstTitle: string } {
  const periodicities = defaultPeriodicities('fire-hydrant-indoor');
  const first = periodicities[0];
  if (first === undefined) throw new Error('Библиотека пуста — тест бессмыслен.');

  // Пользователь снял галочку с первой работы внутри периодичности.
  const edited = periodicities.map((item, index) =>
    index !== 0 ? item : {
      ...item,
      activities: item.activities.map((activity, position) =>
        position === 0 ? { ...activity, required: false } : activity,
      ),
    },
  );

  return {
    regulation: {
      id: 'reg-1',
      title: 'Регламент предприятия',
      scope: 'организация',
      targetId: 'org',
      typeCode: 'fire-hydrant-indoor',
      localDocumentId: null,
      archivedAt: null,
    },
    version: {
      id: 'ver-1',
      regulationId: 'reg-1',
      version: 1,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      periodicities: edited,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    firstTitle: first.title,
  };
}

describe('настройки → чек-лист → журнал', () => {
  it('включённая периодичность становится строкой чек-листа элемента', () => {
    const { regulation, version, firstTitle } = makeRegulation();
    const source = regulationScheduleSource({
      regulations: [regulation], versions: [version], nodes: NODES, soonThresholdDays: 14,
    });

    const rules = source.rulesFor(OBJECT, '2026-08-23');

    expect(rules.map((rule) => rule.title)).toContain(firstTitle);
    expect(rules.every((rule) => rule.periodicityId !== undefined)).toBe(true);
  });

  it('выключенная периодичность не даёт ни строки в журнале, ни чек-листа', () => {
    const { regulation, version } = makeRegulation();
    const off: RegulationVersion = {
      ...version,
      periodicities: version.periodicities.map((item) => ({ ...item, enabled: false })),
    };
    const source = regulationScheduleSource({
      regulations: [regulation], versions: [off], nodes: NODES, soonThresholdDays: 14,
    });

    expect(activityCellsForObject(OBJECT, [], '2026-08-23', 14, source)).toEqual([]);
  });

  it('проверка по регламенту ложится в журнал с ссылкой на версию', async () => {
    const { regulation, version } = makeRegulation();
    const source = regulationScheduleSource({
      regulations: [regulation], versions: [version], nodes: NODES, soonThresholdDays: 14,
    });
    const events = fakeEvents();
    const deps = { events, objects: fakeObjects(), clock, ids, activities: source };

    const rule = source.rulesFor(OBJECT, '2026-08-23')[0];
    if (rule === undefined) throw new Error('Регламент не дал ни одной работы.');

    const recorded = await recordMaintenanceBatch(deps, [{
      objectId: OBJECT.id,
      activityCode: rule.activityCode,
      performedOn: '2026-08-23',
      result: 'выполнено',
      checklist: rule.checklist.map((item) => ({
        item: typeof item === 'string' ? item : item.text,
        result: 'выполнено' as const,
        defect: null,
      })),
      executorDetails: { fullName: 'Иванов И.И.', position: 'Инженер', organization: 'ООО «Пример»' },
    }]);

    expect(recorded.ok).toBe(true);
    expect(events.saved).toHaveLength(1);
    // Часть Р9: запись навсегда знает, по какой версии регламента её сделали.
    expect(events.saved[0]?.regulationVersionId).toBe('ver-1');
    expect(events.saved[0]?.periodicityId).toBe(rule.periodicityId);
  });

  it('записанная проверка сдвигает срок в журнале', async () => {
    const { regulation, version } = makeRegulation();
    const source = regulationScheduleSource({
      regulations: [regulation], versions: [version], nodes: NODES, soonThresholdDays: 14,
    });
    const events = fakeEvents();
    const deps = { events, objects: fakeObjects(), clock, ids, activities: source };
    const rule = source.rulesFor(OBJECT, '2026-08-23')[0];
    if (rule === undefined) throw new Error('Регламент не дал ни одной работы.');

    const before = activityCellsForObject(OBJECT, [], '2026-08-23', 14, source)
      .find((cell) => cell.rule.activityCode === rule.activityCode);
    expect(before?.schedule.status).toBe('нет данных');

    await recordMaintenanceBatch(deps, [{
      objectId: OBJECT.id,
      activityCode: rule.activityCode,
      performedOn: '2026-08-23',
      result: 'выполнено',
      checklist: [],
    }]);

    const after = activityCellsForObject(OBJECT, events.saved, '2026-08-23', 14, source)
      .find((cell) => cell.rule.activityCode === rule.activityCode);

    expect(after?.schedule.lastDate).toBe('2026-08-23');
    expect(after?.schedule.status).not.toBe('нет данных');
    expect(after?.history).toHaveLength(1);
  });

  it('работу, которой нет в регламенте, записать нельзя', async () => {
    // Иначе в журнал попала бы проверка, которой организация не назначала, и
    // убрать её оттуда было бы уже нельзя (правило 10).
    const { regulation, version } = makeRegulation();
    const source = regulationScheduleSource({
      regulations: [regulation], versions: [version], nodes: NODES, soonThresholdDays: 14,
    });
    const events = fakeEvents();
    const deps = { events, objects: fakeObjects(), clock, ids, activities: source };

    const recorded = await recordMaintenanceBatch(deps, [{
      objectId: OBJECT.id,
      activityCode: 'работа-которой-нет',
      performedOn: '2026-08-23',
      result: 'выполнено',
      checklist: [],
    }]);

    expect(recorded.ok).toBe(false);
    expect(events.saved).toHaveLength(0);
  });
});

/**
 * Выпуск версии доходит до журнала.
 *
 * Заказчик сообщил: «добавляю ежеквартальные проверки, нажимаю выпустить новую
 * версию — в журнале ничего не меняется». Причина была в выпуске: регламент
 * заводят и правят в один день, а выпуск отклонял дату «не позже предыдущей».
 * Отказ показывался в баннере за подложкой окна, то есть не показывался вовсе.
 *
 * Здесь проверяется весь путь: хранилище → сценарий выпуска → источник правил
 * журнала. Подделано только хранилище.
 */
function fakeRegulationStore() {
  let regulations: Regulation[] = [];
  let versions: RegulationVersion[] = [];

  return {
    get regulations() { return regulations; },
    get versions() { return versions; },
    repository: {
      listRegulations: async (): Promise<Result<readonly Regulation[]>> => ok(regulations),
      listVersions: async (): Promise<Result<readonly RegulationVersion[]>> => ok(versions),
      listDocuments: async (): Promise<Result<readonly LocalDocument[]>> => ok([]),
      listTemplates: async (): Promise<Result<readonly RegulationTemplate[]>> => ok([]),
      saveRegulation: async (regulation: Regulation): Promise<Result<void>> => {
        regulations = [...regulations.filter((item) => item.id !== regulation.id), regulation];
        return ok(undefined);
      },
      saveVersions: async (next: readonly RegulationVersion[]): Promise<Result<void>> => {
        const ids = new Set(next.map((item) => item.id));
        versions = [...versions.filter((item) => !ids.has(item.id)), ...next];
        return ok(undefined);
      },
      saveDocument: async (): Promise<Result<void>> => ok(undefined),
      saveTemplate: async (): Promise<Result<void>> => ok(undefined),
    },
  };
}

/**
 * Ежеквартальная проверка — ровно та, что заводят кнопкой в конструкторе.
 *
 * Собирается из библиотечной работы, а не пишется полем за полем: состав
 * работы задан контрактом, и вторая рукописная копия разошлась бы с ним при
 * первой же правке.
 */
function quarterly(): RegulationPeriodicity {
  const base = defaultPeriodicities('fire-hydrant-indoor')[0];
  if (base === undefined) throw new Error('Библиотека пуста — тест бессмыслен.');
  return {
    ...base,
    id: 'кв-1',
    title: 'Раз в квартал',
    rule: { kind: 'интервал', every: 3, unit: 'месяц' },
    enabled: true,
  };
}

describe('выпуск версии доходит до журнала', () => {
  const TODAY = '2026-08-23';

  async function setUp() {
    const store = fakeRegulationStore();
    let counter = 0;
    const deps = {
      regulations: store.repository,
      clock: { nowUtc: () => `${TODAY}T09:00:00.000Z` },
      ids: { newId: () => `reg-${(counter += 1)}` },
    };

    const created = await createRegulation(deps, {
      title: 'Регламент организации',
      scope: 'организация' as const,
      targetId: 'org',
      typeCode: 'fire-hydrant-indoor',
      localDocumentId: null,
      effectiveFrom: TODAY,
      periodicities: defaultPeriodicities('fire-hydrant-indoor'),
    });
    if (!created.ok) throw new Error(created.error.message);

    return { store, deps, regulationId: created.value.regulation.id };
  }

  const sourceOf = (store: ReturnType<typeof fakeRegulationStore>) => regulationScheduleSource({
    regulations: store.regulations,
    versions: store.versions,
    nodes: NODES,
    soonThresholdDays: 14,
  });

  it('новая периодичность становится колонкой журнала в тот же день', async () => {
    const { store, deps, regulationId } = await setUp();
    const before = sourceOf(store).rulesFor(OBJECT, TODAY).map((rule) => rule.title);
    expect(before).not.toContain('Раз в квартал');

    const released = await releaseRegulationVersion(deps, {
      regulationId,
      effectiveFrom: TODAY,
      periodicities: [...defaultPeriodicities('fire-hydrant-indoor'), quarterly()],
    });
    expect(released.ok).toBe(true);

    const after = sourceOf(store).rulesFor(OBJECT, TODAY).map((rule) => rule.title);
    expect(after).toContain('Раз в квартал');
  });

  it('у новой работы считается срок, а не остаётся пустая ячейка', async () => {
    const { store, deps, regulationId } = await setUp();
    await releaseRegulationVersion(deps, {
      regulationId,
      effectiveFrom: TODAY,
      periodicities: [quarterly()],
    });

    const source = sourceOf(store);
    const cells = activityCellsForObject(OBJECT, [], TODAY, 14, source);
    const cell = cells.find((item) => item.rule.title === 'Раз в квартал');
    expect(cell).toBeDefined();
    if (cell === undefined) return;

    // Пока работу не выполняли и дата постановки на учёт неизвестна, срока нет
    // и быть не может: считать его не от чего. А вот от известной даты он
    // обязан посчитаться кварталом — тем самым, который задали в конструкторе.
    expect(cell.schedule.status).toBe('нет данных');
    expect(source.nextDueOn(cell.rule, '2026-01-01', TODAY)).toBe('2026-04-01');
  });

  it('прежняя версия остаётся читаемой: по ней записана история', async () => {
    // Часть Р9: запись журнала ссылается на версию, и та обязана сохранить
    // свой состав работ, даже если новую версию выпустили в тот же день.
    const { store, deps, regulationId } = await setUp();
    const firstVersionId = store.versions[0]?.id;

    await releaseRegulationVersion(deps, {
      regulationId,
      effectiveFrom: TODAY,
      periodicities: [quarterly()],
    });

    const kept = store.versions.find((version) => version.id === firstVersionId);
    expect(kept).toBeDefined();
    expect(kept?.periodicities.length).toBeGreaterThan(0);
    expect(store.versions).toHaveLength(2);
  });
});
