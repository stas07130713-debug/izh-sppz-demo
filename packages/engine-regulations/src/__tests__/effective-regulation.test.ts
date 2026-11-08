/**
 * Эталонные тесты сборки регламента (ТЗ, Дополнение 5, части Р7–Р10).
 *
 * Проверяются на том самом примере, который привёл заказчик: организация
 * назначила крану ежемесячную и ежегодную работу, цех добавил полугодовое
 * испытание клапана, здание — проверку маркировки раз в квартал. Итоговый
 * регламент конкретного крана обязан включить всё это, и у каждой строки должно
 * быть видно, кто её назначил.
 */

import { describe, expect, it } from 'vitest';
import type {
  Regulation,
  RegulationActivity,
  RegulationPeriodicity,
  RegulationVersion,
} from '@izh/contracts';
import { ALL_OBJECTS_REGULATION_TARGET_ID } from '@izh/contracts';
import { assembleRegulation, canDisableActivity } from '../effective-regulation.js';
import { assembleChecklist } from '../checklist.js';

const ORG = 'node-org';
const SHOP = 'node-shop';
const BUILDING = 'node-building';
const OBJECT = 'obj-kran-27';
const TYPE = 'fire-hydrant-indoor';
const PATH = [ORG, SHOP, BUILDING];

function activity(title: string, mandatory = false): RegulationActivity {
  return {
    id: `act-${title}`,
    title,
    description: null,
    answerKind: 'галочка',
    options: [],
    unit: null,
    required: true,
    sources: [
      mandatory
        ? { kind: 'обязательное требование', reference: 'ППР РФ №1479, п. 50', localDocumentId: null }
        : { kind: 'локальный документ', reference: 'Регламент организации №12', localDocumentId: 'doc-12' },
    ],
    successCriterion: null,
    failureImpact: 'требует внимания',
    needsNote: false,
    needsPhoto: false,
    needsDocument: false,
  };
}

function monthly(activities: readonly string[]): RegulationPeriodicity {
  return {
    id: 'per-monthly',
    title: 'Ежемесячно',
    rule: { kind: 'интервал', every: 1, unit: 'месяц' },
    enabled: true,
    activities: activities.map((title) => activity(title)),
    warnDaysBefore: null,
  };
}

function regulation(id: string, scope: Regulation['scope'], targetId: string): Regulation {
  return {
    id,
    title: `Регламент ${scope}`,
    scope,
    targetId,
    typeCode: TYPE,
    localDocumentId: null,
    archivedAt: null,
  };
}

function version(regulationId: string, periodicities: readonly RegulationPeriodicity[], from = '2026-01-01'): RegulationVersion {
  return {
    id: `${regulationId}-v1`,
    regulationId,
    version: 1,
    effectiveFrom: from,
    effectiveTo: null,
    periodicities,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

const BASE = { nodePath: PATH, objectId: OBJECT, typeCode: TYPE, onDate: '2026-08-19' };

describe('наследование по дереву объекта', () => {
  it('общее правило действует на объект любой организации и дополняется локальным', () => {
    const regulations = [
      regulation('r-all', 'организация', ALL_OBJECTS_REGULATION_TARGET_ID),
      regulation('r-org', 'организация', ORG),
    ];
    const versions = [
      version('r-all', [monthly(['Общая проверка'])]),
      version('r-org', [monthly(['Проверка предприятия'])]),
    ];

    const result = assembleRegulation({ ...BASE, regulations, versions });
    expect(result.periodicities[0]?.activities.map((item) => item.title)).toEqual([
      'Общая проверка', 'Проверка предприятия',
    ]);
  });
  it('собирает регламент из всех уровней, дополняя сверху вниз', () => {
    const regulations = [
      regulation('r-org', 'организация', ORG),
      regulation('r-shop', 'цех', SHOP),
      regulation('r-building', 'здание', BUILDING),
    ];
    const versions = [
      version('r-org', [monthly(['Внешний осмотр']), {
        id: 'per-yearly', title: 'Ежегодно', rule: { kind: 'интервал', every: 1, unit: 'год' },
        enabled: true, activities: [activity('Перекатка рукава', true)], warnDaysBefore: null,
      }]),
      version('r-shop', [{
        id: 'per-half', title: 'Раз в полгода', rule: { kind: 'интервал', every: 6, unit: 'месяц' },
        enabled: true, activities: [activity('Испытание клапана')], warnDaysBefore: null,
      }]),
      version('r-building', [{
        id: 'per-quarter', title: 'Ежеквартально', rule: { kind: 'интервал', every: 3, unit: 'месяц' },
        enabled: true, activities: [activity('Проверка маркировки')], warnDaysBefore: null,
      }]),
    ];

    const result = assembleRegulation({ ...BASE, regulations, versions });
    const titles = result.periodicities.map((item) => item.title).sort();

    // Порядок — обычная сортировка строк по кодам символов, «к» раньше «м».
    expect(titles).toEqual(['Ежегодно', 'Ежеквартально', 'Ежемесячно', 'Раз в полгода']);
  });

  it('у каждой периодичности видно, кто её назначил', () => {
    const regulations = [regulation('r-org', 'организация', ORG), regulation('r-shop', 'цех', SHOP)];
    const versions = [
      version('r-org', [monthly(['Внешний осмотр'])]),
      version('r-shop', [{
        id: 'per-half', title: 'Раз в полгода', rule: { kind: 'интервал', every: 6, unit: 'месяц' },
        enabled: true, activities: [activity('Испытание клапана')], warnDaysBefore: null,
      }]),
    ];

    const result = assembleRegulation({ ...BASE, regulations, versions });
    const byTitle = new Map(result.periodicities.map((item) => [item.title, item.origin]));

    expect(byTitle.get('Ежемесячно')).toBe('организация');
    expect(byTitle.get('Раз в полгода')).toBe('цех');
  });

  it('одноимённые периодичности объединяются по составу, а не заменяют друг друга', () => {
    // Организация задала ежемесячный осмотр из двух пунктов, цех добавил третий.
    // Нижний уровень дополняет верхний (часть Р7) — должны остаться все три.
    const regulations = [regulation('r-org', 'организация', ORG), regulation('r-shop', 'цех', SHOP)];
    const versions = [
      version('r-org', [monthly(['Внешний осмотр', 'Комплектность'])]),
      version('r-shop', [monthly(['Проверка пломбы рукава'])]),
    ];

    const result = assembleRegulation({ ...BASE, regulations, versions });
    const merged = result.periodicities.find((item) => item.title === 'Ежемесячно');

    expect(merged?.activities.map((a) => a.title)).toEqual([
      'Внешний осмотр', 'Комплектность', 'Проверка пломбы рукава',
    ]);
    expect(merged?.origin).toBe('цех');
  });

  it('чужой цех и чужой элемент в сборку не попадают', () => {
    const regulations = [
      regulation('r-org', 'организация', ORG),
      regulation('r-other', 'цех', 'node-other-shop'),
      regulation('r-elem', 'элемент', 'obj-another'),
    ];
    const versions = [
      version('r-org', [monthly(['Внешний осмотр'])]),
      version('r-other', [monthly(['Чужая работа'])]),
      version('r-elem', [monthly(['Работа другого крана'])]),
    ];

    const result = assembleRegulation({ ...BASE, regulations, versions });
    expect(result.appliedRegulationIds).toEqual(['r-org']);
  });

  it('регламент другого типа оборудования не применяется', () => {
    const foreign = { ...regulation('r-org', 'организация', ORG), typeCode: 'extinguisher-powder' };
    const result = assembleRegulation({
      ...BASE, regulations: [foreign], versions: [version('r-org', [monthly(['Взвешивание'])])],
    });
    expect(result.periodicities).toHaveLength(0);
  });
});

describe('версионность (часть Р9)', () => {
  const regulations = [regulation('r-org', 'организация', ORG)];
  const versions: readonly RegulationVersion[] = [
    { ...version('r-org', [monthly(['Осмотр по старому порядку'])], '2026-01-01'),
      id: 'v1', version: 1, effectiveTo: '2026-06-30' },
    { ...version('r-org', [monthly(['Осмотр', 'Новая проверка маркировки'])], '2026-07-01'),
      id: 'v2', version: 2, effectiveTo: null },
  ];

  it('на сегодняшнюю дату действует новая версия', () => {
    const result = assembleRegulation({ ...BASE, regulations, versions, onDate: '2026-08-19' });
    expect(result.periodicities[0]?.version).toBe(2);
    expect(result.periodicities[0]?.activities).toHaveLength(2);
  });

  it('старая запись журнала показывает тот регламент, что действовал в её день', () => {
    // Это и есть смысл версионности: проверка от 15 марта обязана показывать
    // чек-лист версии v1, даже если сегодня действует v2.
    const result = assembleRegulation({ ...BASE, regulations, versions, onDate: '2026-03-15' });
    expect(result.periodicities[0]?.version).toBe(1);
    expect(result.periodicities[0]?.activities.map((a) => a.title)).toEqual(['Осмотр по старому порядку']);
  });

  it('до начала действия регламента его нет', () => {
    const result = assembleRegulation({ ...BASE, regulations, versions, onDate: '2025-12-31' });
    expect(result.periodicities).toHaveLength(0);
  });
});

describe('защита обязательных требований (часть Р8)', () => {
  it('требование нормативного акта отключить нельзя', () => {
    expect(canDisableActivity(activity('Перекатка рукава', true))).toBe(false);
  });

  it('локальное и рекомендательное требование отключается свободно', () => {
    expect(canDisableActivity(activity('Проверка бирки'))).toBe(true);
  });
});

describe('сборка чек-листа (часть Р10)', () => {
  const regulations = [regulation('r-org', 'организация', ORG)];
  const versions = [version('r-org', [
    monthly(['Внешний осмотр', 'Комплектность']),
    { id: 'per-yearly', title: 'Ежегодно', rule: { kind: 'интервал', every: 1, unit: 'год' },
      enabled: true, activities: [activity('Перекатка рукава', true)], warnDaysBefore: null },
    { id: 'per-off', title: 'Ежеквартально', rule: { kind: 'интервал', every: 3, unit: 'месяц' },
      enabled: false, activities: [activity('Отключённая работа')], warnDaysBefore: null },
  ])];

  it('на одну дату наступившие периодичности собираются в один чек-лист разделами', () => {
    const effective = assembleRegulation({ ...BASE, regulations, versions });
    const checklist = assembleChecklist({
      periodicities: effective.periodicities,
      history: [
        { periodicityId: 'per-monthly', lastPerformedOn: '2026-07-01' },
        { periodicityId: 'per-yearly', lastPerformedOn: '2025-08-01' },
      ],
      today: '2026-08-19',
      warnDaysBefore: 14,
    });

    expect(checklist.due.map((section) => section.periodicity.title).sort()).toEqual(['Ежегодно', 'Ежемесячно']);
    expect(checklist.worstState).toBe('просрочено');
  });

  it('выключенная периодичность в чек-лист не попадает вовсе', () => {
    const effective = assembleRegulation({ ...BASE, regulations, versions });
    const checklist = assembleChecklist({
      periodicities: effective.periodicities, history: [], today: '2026-08-19', warnDaysBefore: 14,
    });

    const all = [...checklist.due, ...checklist.upcoming].map((section) => section.periodicity.title);
    expect(all).not.toContain('Ежеквартально');
  });

  it('ненаступившие сроки показываются отдельно и к выполнению не предлагаются', () => {
    const effective = assembleRegulation({ ...BASE, regulations, versions });
    const checklist = assembleChecklist({
      periodicities: effective.periodicities,
      history: [
        { periodicityId: 'per-monthly', lastPerformedOn: '2026-08-18' },
        { periodicityId: 'per-yearly', lastPerformedOn: '2026-08-18' },
      ],
      today: '2026-08-19',
      warnDaysBefore: 14,
    });

    expect(checklist.due).toHaveLength(0);
    expect(checklist.upcoming).toHaveLength(2);
    expect(checklist.worstState).toBe('норма');
  });
});
