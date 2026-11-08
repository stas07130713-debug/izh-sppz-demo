/**
 * Подключение движка регламентов к журналу.
 *
 * Проверяется стык, а не сам движок: сроки и сборку по дереву закрывают тесты
 * `@izh/engine-regulations`. Здесь важно другое — что журнал берёт правила
 * оттуда, откуда должен, и что при пустом конструкторе он ведёт себя ровно
 * как раньше.
 */

import { describe, expect, it } from 'vitest';
import type { PlanObject, Regulation, RegulationVersion, TreeNode } from '@izh/contracts';
import { activityCellsForObject, rulePackageSource } from '@izh/core';
import { regulationScheduleSource } from './regulation-source';

const NODES: readonly TreeNode[] = [
  { id: 'org', parentId: null, kind: 'организация', title: 'Предприятие' },
  { id: 'shop', parentId: 'org', kind: 'цех', title: 'Цех 1' },
] as unknown as readonly TreeNode[];

const OBJECT: PlanObject = {
  id: 'obj-1',
  siteId: 'shop',
  nodeId: 'shop',
  typeCode: 'fire-hydrant-indoor',
  technicalState: 'исправен',
  position: { x: 0, y: 0 },
  extinguisherProfile: null,
  archivedAt: null,
} as unknown as PlanObject;

const REGULATION: Regulation = {
  id: 'reg-1',
  title: 'Регламент предприятия',
  scope: 'организация',
  targetId: 'org',
  typeCode: 'fire-hydrant-indoor',
  localDocumentId: null,
  archivedAt: null,
};

const VERSION: RegulationVersion = {
  id: 'ver-1',
  regulationId: 'reg-1',
  version: 1,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  periodicities: [
    {
      id: 'per-quarter',
      title: 'Ежеквартально',
      rule: { kind: 'интервал', every: 3, unit: 'месяц' },
      enabled: true,
      warnDaysBefore: null,
      activityCodes: ['osmotr'],
      activities: [
        {
          id: 'a-1',
          title: 'Осмотр шкафа',
          description: null,
          answerKind: 'галочка',
          options: [],
          unit: null,
          required: true,
          sources: [{ kind: 'обязательное требование', reference: 'ППР РФ, п. 50', localDocumentId: null }],
          successCriterion: null,
          failureImpact: 'неисправно',
          needsNote: false,
          needsPhoto: false,
          needsDocument: false,
        },
      ],
    },
  ],
};

function makeSource(regulations: readonly Regulation[], versions: readonly RegulationVersion[]) {
  return regulationScheduleSource({ regulations, versions, nodes: NODES, soonThresholdDays: 14 });
}

describe('журнал по регламенту организации', () => {
  it('без единого регламента считает как нормативная библиотека', () => {
    const byEngine = activityCellsForObject(OBJECT, [], '2026-08-16', 14, makeSource([], []));
    const byPackage = activityCellsForObject(OBJECT, [], '2026-08-16', 14, rulePackageSource);

    expect(byEngine.map((cell) => cell.rule.activityCode)).toEqual(byPackage.map((cell) => cell.rule.activityCode));
  });

  it('заведённый регламент подменяет состав работ на свой', () => {
    const cells = activityCellsForObject(OBJECT, [], '2026-08-16', 14, makeSource([REGULATION], [VERSION]));

    expect(cells.map((cell) => cell.rule.title)).toEqual(['Ежеквартально']);
    expect(cells[0]?.rule.ndReference).toBe('ППР РФ, п. 50');
    // Ссылка на версию — то, что попадёт в запись журнала (часть Р9).
    expect(cells[0]?.rule.regulationVersionId).toBe('ver-1');
  });

  it('срок считает движок, а не число месяцев в правиле', () => {
    const events = [
      {
        id: 'e-1', siteId: 'shop', objectId: 'obj-1', activityCode: 'osmotr',
        performedOn: '2026-05-20', result: 'выполнено', checklist: [], defect: null,
        executor: null, note: null, createdAt: '2026-05-20T09:00:00.000Z',
      },
    ] as unknown as readonly import('@izh/contracts').MaintenanceEvent[];

    const cells = activityCellsForObject(OBJECT, events, '2026-08-16', 14, makeSource([REGULATION], [VERSION]));

    // Осмотр 20 мая плюс квартал — 20 августа. Старая история подхватилась по
    // коду «osmotr», хотя записи делались до конструктора.
    expect(cells[0]?.schedule.nextDate).toBe('2026-08-20');
    expect(cells[0]?.schedule.status).toBe('скоро');
  });

  it('выключенная периодичность в журнал не попадает', () => {
    const disabled: RegulationVersion = {
      ...VERSION,
      periodicities: VERSION.periodicities.map((item) => ({ ...item, enabled: false })),
    };

    const cells = activityCellsForObject(OBJECT, [], '2026-08-16', 14, makeSource([REGULATION], [disabled]));

    expect(cells).toEqual([]);
  });

  it('регламент, ещё не вступивший в силу, не действует', () => {
    const future: RegulationVersion = { ...VERSION, effectiveFrom: '2027-01-01' };

    const cells = activityCellsForObject(OBJECT, [], '2026-08-16', 14, makeSource([REGULATION], [future]));

    // Действующего регламента на эту дату нет — работает библиотека.
    expect(cells.map((cell) => cell.rule.activityCode)).toEqual(['osmotr', 'ispytanie', 'perekatka']);
  });
});

describe('регламент цеха поверх регламента организации', () => {
  const SHOP_REGULATION: Regulation = {
    id: 'reg-2',
    title: 'Регламент цеха 1',
    scope: 'цех',
    targetId: 'shop',
    typeCode: 'fire-hydrant-indoor',
    localDocumentId: null,
    archivedAt: null,
  };

  const SHOP_VERSION: RegulationVersion = {
    id: 'ver-2',
    regulationId: 'reg-2',
    version: 1,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    periodicities: [
      {
        id: 'per-month',
        title: 'Ежемесячно',
        rule: { kind: 'интервал', every: 1, unit: 'месяц' },
        enabled: true,
        warnDaysBefore: null,
        activities: [],
      },
    ],
  };

  it('добавляет свою работу, не отменяя работу организации', () => {
    // Часть Р8: нижний уровень дополняет верхний. Кран в этом цехе проверяется
    // и ежеквартально по предприятию, и ежемесячно по решению цеха.
    const source = makeSource([REGULATION, SHOP_REGULATION], [VERSION, SHOP_VERSION]);

    const cells = activityCellsForObject(OBJECT, [], '2026-08-16', 14, source);

    expect(cells.map((cell) => cell.rule.title).sort()).toEqual(['Ежеквартально', 'Ежемесячно']);
  });

  it('на элемент вне этого цеха регламент цеха не распространяется', () => {
    const elsewhere = { ...OBJECT, id: 'obj-2', nodeId: 'org', siteId: 'org' } as unknown as PlanObject;
    const source = makeSource([REGULATION, SHOP_REGULATION], [VERSION, SHOP_VERSION]);

    const cells = activityCellsForObject(elsewhere, [], '2026-08-16', 14, source);

    expect(cells.map((cell) => cell.rule.title)).toEqual(['Ежеквартально']);
  });
});

describe('состав работ доходит до чек-листа', () => {
  /** Периодичность с двумя работами, одна из которых в конструкторе снята. */
  const PARTIAL: RegulationVersion = {
    ...VERSION,
    id: 'ver-3',
    periodicities: [
      {
        id: 'per-quarter',
        title: 'Ежеквартально',
        rule: { kind: 'интервал', every: 3, unit: 'месяц' },
        enabled: true,
        warnDaysBefore: null,
        activityCodes: ['osmotr'],
        activities: [
          {
            id: 'a-1', title: 'Осмотр шкафа', description: null, answerKind: 'галочка',
            options: [], unit: null, required: true,
            sources: [{ kind: 'обязательное требование', reference: 'ППР РФ, п. 50', localDocumentId: null }],
            successCriterion: null, failureImpact: 'неисправно',
            needsNote: false, needsPhoto: false, needsDocument: false,
          },
          {
            id: 'a-2', title: 'Замер давления', description: null, answerKind: 'число',
            options: [], unit: 'МПа', required: false,
            sources: [{ kind: 'рекомендация ГОСТ', reference: 'ГОСТ Р 59642', localDocumentId: null }],
            successCriterion: null, failureImpact: 'требует внимания',
            needsNote: false, needsPhoto: false, needsDocument: false,
          },
        ],
      },
    ],
  };

  it('включённые шаги становятся пунктами чек-листа', () => {
    const cells = activityCellsForObject(OBJECT, [], '2026-08-16', 14, makeSource([REGULATION], [PARTIAL]));

    expect(cells[0]?.rule.checklist).toHaveLength(1);
    expect(cells[0]?.rule.checklist[0]).toMatchObject({ text: 'Осмотр шкафа', severity: 'критический' });
  });

  it('снятая в конструкторе работа в чек-лист не попадает', () => {
    // Организация отказалась от замера давления — значит, проверяющему его не
    // предлагают. Из регламента работа при этом не исчезает.
    const cells = activityCellsForObject(OBJECT, [], '2026-08-16', 14, makeSource([REGULATION], [PARTIAL]));

    expect(cells[0]?.rule.checklist.map((item) => (typeof item === 'string' ? item : item.text)))
      .not.toContain('Замер давления');
  });

  it('основание берётся только от включённых работ', () => {
    const cells = activityCellsForObject(OBJECT, [], '2026-08-16', 14, makeSource([REGULATION], [PARTIAL]));

    expect(cells[0]?.rule.ndReference).toBe('ППР РФ, п. 50');
  });

  it('измеряемый шаг остаётся числовым полем', () => {
    const measured: RegulationVersion = {
      ...PARTIAL,
      periodicities: PARTIAL.periodicities.map((item) => ({
        ...item,
        activities: item.activities.map((activity) => ({ ...activity, required: true })),
      })),
    };

    const cells = activityCellsForObject(OBJECT, [], '2026-08-16', 14, makeSource([REGULATION], [measured]));
    const pressure = cells[0]?.rule.checklist.find((item) => typeof item !== 'string' && item.text === 'Замер давления');

    expect(pressure).toMatchObject({ measurementCode: 'a-2' });
  });
});

describe('особый порядок отдельного элемента', () => {
  const ELEMENT_REGULATION: Regulation = {
    id: 'reg-el',
    title: 'Особый порядок: кран № 5',
    scope: 'элемент',
    targetId: 'obj-1',
    // Типа у регламента элемента нет: он и так относится ровно к одному элементу.
    typeCode: null,
    localDocumentId: null,
    archivedAt: null,
  };

  const ELEMENT_VERSION: RegulationVersion = {
    id: 'ver-el',
    regulationId: 'reg-el',
    version: 1,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    periodicities: [
      {
        id: 'per-weekly',
        title: 'Еженедельно',
        rule: { kind: 'интервал', every: 7, unit: 'день' },
        enabled: true,
        warnDaysBefore: null,
        activities: [],
      },
    ],
  };

  it('добавляется к нормативной библиотеке, а не вытесняет её', () => {
    // Часть Р8: особый порядок элемента — всегда добавка. Без этого достаточно
    // было бы задать крану одну свою проверку, чтобы он потерял все остальные.
    const source = makeSource([ELEMENT_REGULATION], [ELEMENT_VERSION]);

    const titles = activityCellsForObject(OBJECT, [], '2026-08-16', 14, source).map((cell) => cell.rule.title);

    expect(titles).toContain('Еженедельно');
    // Работы библиотеки на месте: осмотр, испытание клапана, перекатка рукава.
    expect(titles.length).toBeGreaterThan(1);
  });

  it('добавляется к регламенту организации, а не заменяет его', () => {
    const source = makeSource([REGULATION, ELEMENT_REGULATION], [VERSION, ELEMENT_VERSION]);

    const titles = activityCellsForObject(OBJECT, [], '2026-08-16', 14, source).map((cell) => cell.rule.title).sort();

    // Порядок — по кодам символов, а не по алфавиту: «к» идёт раньше «н».
    expect(titles).toEqual(['Ежеквартально', 'Еженедельно']);
  });

  it('на другие элементы того же вида не распространяется', () => {
    const other = { ...OBJECT, id: 'obj-2' } as unknown as PlanObject;
    const source = makeSource([REGULATION, ELEMENT_REGULATION], [VERSION, ELEMENT_VERSION]);

    const titles = activityCellsForObject(other, [], '2026-08-16', 14, source).map((cell) => cell.rule.title);

    expect(titles).toEqual(['Ежеквартально']);
  });
});
