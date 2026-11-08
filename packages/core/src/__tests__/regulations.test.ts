/**
 * Эталонные тесты сценариев регламентов (Дополнение 5, часть Р9).
 *
 * Главное, что здесь закреплено: действующая версия не переписывается. Это не
 * удобство, а условие того, чтобы старая запись журнала показывала свой
 * чек-лист — иначе предъявить проверяющему будет нечего.
 */

import { describe, expect, it } from 'vitest';
import type {
  LocalDocument,
  Regulation,
  RegulationPeriodicity,
  RegulationRepository,
  RegulationTemplate,
  RegulationVersion,
} from '@izh/contracts';
import { ok } from '@izh/contracts';
import type { RegulationDeps } from '../regulations/regulation-deps.js';
import {
  archiveRegulation,
  createRegulation,
  releaseRegulationVersion,
  saveRegulationTemplate,
} from '../regulations/regulation-scenarios.js';
import { fakeClock, fakeIdGenerator } from './test-doubles.js';

/** Поддельное хранилище регламентов: держит всё в памяти. */
function fakeRegulationRepository(): RegulationRepository {
  const regulations = new Map<string, Regulation>();
  const versions = new Map<string, RegulationVersion>();
  const documents = new Map<string, LocalDocument>();
  const templates = new Map<string, RegulationTemplate>();

  return {
    async listRegulations() {
      return ok([...regulations.values()]);
    },
    async listVersions() {
      return ok([...versions.values()]);
    },
    async listDocuments() {
      return ok([...documents.values()]);
    },
    async listTemplates() {
      return ok([...templates.values()]);
    },
    async saveRegulation(regulation) {
      regulations.set(regulation.id, regulation);
      return ok(undefined);
    },
    async saveVersions(incoming) {
      for (const version of incoming) versions.set(version.id, version);
      return ok(undefined);
    },
    async saveDocument(document) {
      documents.set(document.id, document);
      return ok(undefined);
    },
    async saveTemplate(template) {
      templates.set(template.id, template);
      return ok(undefined);
    },
  };
}

function makeDeps(): RegulationDeps {
  return { regulations: fakeRegulationRepository(), clock: fakeClock(), ids: fakeIdGenerator() };
}

const MONTHLY: RegulationPeriodicity = {
  id: 'per-monthly',
  title: 'Ежемесячно',
  rule: { kind: 'интервал', every: 1, unit: 'месяц' },
  enabled: true,
  activities: [],
  warnDaysBefore: null,
};

function value<T>(result: { ok: boolean } & Record<string, unknown>): T {
  if (!result.ok) throw new Error(`Ожидался успех: ${JSON.stringify(result)}`);
  return result.value as T;
}

async function makeRegulation(deps: RegulationDeps, effectiveFrom = '2026-01-01') {
  return value<{ regulation: Regulation; version: RegulationVersion }>(
    await createRegulation(deps, {
      title: 'Регламент ПК',
      scope: 'организация',
      targetId: 'node-org',
      typeCode: 'fire-hydrant-indoor',
      localDocumentId: null,
      effectiveFrom,
      periodicities: [MONTHLY],
    }),
  );
}

describe('создание регламента', () => {
  it('создаётся вместе с первой версией', async () => {
    const deps = makeDeps();
    const { regulation, version } = await makeRegulation(deps);

    expect(regulation.title).toBe('Регламент ПК');
    expect(version.version).toBe(1);
    expect(version.effectiveTo).toBeNull();
  });

  it('без названия не создаётся', async () => {
    const deps = makeDeps();
    const result = await createRegulation(deps, {
      title: '   ',
      scope: 'организация',
      targetId: 'node-org',
      typeCode: null,
      localDocumentId: null,
      effectiveFrom: '2026-01-01',
      periodicities: [],
    });
    expect(result.ok).toBe(false);
  });

  it('дата не в формате ГГГГ-ММ-ДД отклоняется', async () => {
    const deps = makeDeps();
    const result = await createRegulation(deps, {
      title: 'Регламент',
      scope: 'организация',
      targetId: 'node-org',
      typeCode: null,
      localDocumentId: null,
      effectiveFrom: '01.01.2026',
      periodicities: [],
    });
    expect(result.ok).toBe(false);
  });
});

describe('выпуск новой версии (часть Р9)', () => {
  it('прежняя версия закрывается днём раньше начала новой', async () => {
    const deps = makeDeps();
    const { regulation } = await makeRegulation(deps);

    const next = value<RegulationVersion>(
      await releaseRegulationVersion(deps, {
        regulationId: regulation.id,
        effectiveFrom: '2026-07-01',
        periodicities: [{ ...MONTHLY, title: 'Ежемесячно', activities: [] }],
      }),
    );

    const versions = value<readonly RegulationVersion[]>(await deps.regulations.listVersions());
    const first = versions.find((version) => version.version === 1);

    expect(next.version).toBe(2);
    expect(next.effectiveTo).toBeNull();
    // Ровно одна действующая версия на любую дату: v1 закрыта 30 июня.
    expect(first?.effectiveTo).toBe('2026-06-30');
  });

  it('старая версия остаётся в хранилище, а не заменяется', async () => {
    const deps = makeDeps();
    const { regulation, version } = await makeRegulation(deps);

    await releaseRegulationVersion(deps, {
      regulationId: regulation.id,
      effectiveFrom: '2026-07-01',
      periodicities: [],
    });

    const versions = value<readonly RegulationVersion[]>(await deps.regulations.listVersions());
    expect(versions).toHaveLength(2);
    expect(versions.some((item) => item.id === version.id)).toBe(true);
  });

  it('в тот же день выпускается следующая версия, а не отказ', async () => {
    // Заказчик: «добавляю ежеквартальные проверки, выпускаю версию — в журнале
    // ничего не меняется». Причина была здесь: регламент завели сегодня, правку
    // выпускали сегодня же, и выпуск отклонялся сравнением «раньше или в тот
    // же день». Настройка и правка регламента идут подряд — это норма.
    const deps = makeDeps();
    const { regulation, version } = await makeRegulation(deps, '2026-06-01');

    const result = await releaseRegulationVersion(deps, {
      regulationId: regulation.id,
      effectiveFrom: '2026-06-01',
      periodicities: [],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.version).toBe(2);

    // Прежняя версия не исчезает и не получает отрезок, кончающийся раньше
    // начала: по ней могли уже записать проверку сегодня утром.
    const versions = value<readonly RegulationVersion[]>(await deps.regulations.listVersions());
    const first = versions.find((item) => item.id === version.id);
    expect(first?.effectiveTo).toBe('2026-06-01');
  });

  it('версия не может начаться раньше предыдущей', async () => {
    const deps = makeDeps();
    const { regulation } = await makeRegulation(deps);

    const result = await releaseRegulationVersion(deps, {
      regulationId: regulation.id,
      effectiveFrom: '2025-06-01',
      periodicities: [],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('раньше предыдущей');
  });

  it('у несуществующего регламента версию не выпустить', async () => {
    const deps = makeDeps();
    const result = await releaseRegulationVersion(deps, {
      regulationId: 'нет такого',
      effectiveFrom: '2026-07-01',
      periodicities: [],
    });
    expect(result.ok).toBe(false);
  });
});

describe('вывод регламента из обращения', () => {
  it('помечается, а не удаляется', async () => {
    const deps = makeDeps();
    const { regulation } = await makeRegulation(deps);

    const archived = value<Regulation>(await archiveRegulation(deps, regulation.id));
    expect(archived.archivedAt).not.toBeNull();

    // Сам регламент и его версии остаются: на них ссылаются записи журнала.
    const all = value<readonly Regulation[]>(await deps.regulations.listRegulations());
    expect(all).toHaveLength(1);
    const versions = value<readonly RegulationVersion[]>(await deps.regulations.listVersions());
    expect(versions).toHaveLength(1);
  });

  it('повторный вывод из обращения ничего не ломает', async () => {
    const deps = makeDeps();
    const { regulation } = await makeRegulation(deps);
    await archiveRegulation(deps, regulation.id);
    const again = await archiveRegulation(deps, regulation.id);
    expect(again.ok).toBe(true);
  });
});

describe('шаблоны регламентов', () => {
  it('сохраняет заготовку, не назначая её ни на что', async () => {
    // Часть Р12: шаблон — это заготовка. Ни области действия, ни даты начала у
    // него нет, и сам по себе он на сроки не влияет.
    const deps = makeDeps();

    const template = value<RegulationTemplate>(
      await saveRegulationTemplate(deps, {
        title: 'Порядок для цехов с постоянным присутствием',
        typeCode: 'fire-hydrant-indoor',
        periodicities: [MONTHLY],
        localDocumentId: null,
      }),
    );

    expect(template.title).toBe('Порядок для цехов с постоянным присутствием');
    expect(value<readonly RegulationTemplate[]>(await deps.regulations.listTemplates())).toHaveLength(1);
    // Ни одного регламента при этом не завелось: шаблон ничего не назначает.
    expect(value<readonly Regulation[]>(await deps.regulations.listRegulations())).toHaveLength(0);
  });

  it('отклоняет шаблон без названия', async () => {
    const deps = makeDeps();

    const result = await saveRegulationTemplate(deps, {
      title: '   ',
      typeCode: 'fire-hydrant-indoor',
      periodicities: [MONTHLY],
      localDocumentId: null,
    });

    expect(result.ok).toBe(false);
  });

  it('отклоняет пустой шаблон', async () => {
    // Заготовка без единой периодичности не заготовка: применять из неё нечего.
    const deps = makeDeps();

    const result = await saveRegulationTemplate(deps, {
      title: 'Пустой',
      typeCode: 'fire-hydrant-indoor',
      periodicities: [],
      localDocumentId: null,
    });

    expect(result.ok).toBe(false);
  });
});

describe('регламент нижнего уровня', () => {
  it('заводится рядом с регламентом организации, а не вместо него', async () => {
    // Часть Р8: цех дополняет организацию. Два регламента живут одновременно,
    // и сведением их в один занимается движок при сборке.
    const deps = makeDeps();
    await makeRegulation(deps);

    const shop = value<{ regulation: Regulation }>(
      await createRegulation(deps, {
        title: 'Регламент ПК — цех 1',
        scope: 'цех',
        targetId: 'node-shop',
        typeCode: 'fire-hydrant-indoor',
        localDocumentId: null,
        effectiveFrom: '2026-02-01',
        periodicities: [{ ...MONTHLY, id: 'per-shop-weekly', title: 'Еженедельно' }],
      }),
    );

    const all = value<readonly Regulation[]>(await deps.regulations.listRegulations());
    expect(all).toHaveLength(2);
    expect(all.map((item) => item.scope).sort()).toEqual(['организация', 'цех']);
    expect(shop.regulation.targetId).toBe('node-shop');
  });
});
