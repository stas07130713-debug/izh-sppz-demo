/**
 * У каждой работы должен быть срок.
 *
 * Без срока программа не считает следующую дату и не напоминает — работа висит
 * в журнале вечным «нет данных» и на глаза не попадается. Прежнее
 * «по необходимости» выглядело честно, но пользы не приносило: пропущенную
 * работу никто не увидит именно потому, что её никто не увидит.
 */

import { describe, expect, it } from 'vitest';
import { ELEMENT_CATALOG, defaultPeriodicities, groupOf, ELEMENT_GROUP_ORDER } from '../index.js';
import { DEFAULT_PERIOD_NOTE } from '../rules/rule-package-bridge.js';

describe('сроки регламентных работ', () => {
  it('ни одна периодичность не остаётся без конкретного срока', () => {
    for (const element of ELEMENT_CATALOG) {
      for (const periodicity of defaultPeriodicities(element.typeCode)) {
        expect(periodicity.rule.kind, `${element.typeCode} — ${periodicity.title}`).not.toBe('по-необходимости');
      }
    }
  });

  it('срок, которого норматив не даёт, подписан как назначенный программой', () => {
    // Эталон обновлён 23.08.2026. Раньше подпись проверялась на конкретной
    // работе — общем требовании ТО по ППР, у которого своего срока не было.
    // Такие работы из библиотеки убраны, и подставлять срок теперь не за кого.
    // Сам механизм оставлен: правило из конструктора организации по-прежнему
    // может прийти без числа месяцев. Проверяется инвариант: если подпись
    // всё-таки появилась, она обязана быть помечена пользовательской —
    // иначе назначенный программой срок примут за требование документа и
    // сошлются на него перед проверяющим.
    const activities = ELEMENT_CATALOG
      .flatMap((element) => defaultPeriodicities(element.typeCode))
      .flatMap((item) => item.activities);
    const withDefault = activities.filter((item) =>
      item.sources.some((source) => source.reference === DEFAULT_PERIOD_NOTE),
    );

    expect(withDefault.every((item) => item.sources.some((source) => source.kind === 'пользовательское'))).toBe(true);
    // И сейчас таких нет: каждая работа библиотеки несёт конкретный срок.
    expect(withDefault).toHaveLength(0);
  });

  it('срок из норматива программой не подменяется', () => {
    // У ежегодной проверки огнетушителя срок есть в самом ГОСТ — пометки о
    // назначении программой у неё быть не должно.
    const yearly = defaultPeriodicities('extinguisher-powder').find((item) => item.title === 'Ежегодно');
    const sources = (yearly?.activities ?? []).flatMap((item) => item.sources.map((source) => source.reference));

    expect(sources).not.toContain(DEFAULT_PERIOD_NOTE);
  });

  it('полугодовая проверка получила срок, названный в самом пункте', () => {
    // ГОСТ Р 59641-2021, п. 5.1.7: «не реже 1 раза в 6 месяцев».
    const half = defaultPeriodicities('extinguisher-powder').find((item) => item.title === 'Раз в полгода');

    expect(half?.rule).toEqual({ kind: 'интервал', every: 6, unit: 'месяц' });
  });
});

describe('разделы оборудования', () => {
  it('каждый элемент каталога попадает ровно в один раздел', () => {
    for (const element of ELEMENT_CATALOG) {
      expect(ELEMENT_GROUP_ORDER, element.typeCode).toContain(groupOf(element));
    }
  });

  it('средства пожарной автоматики собраны в свой раздел', () => {
    for (const typeCode of ['control-panel', 'smoke-detector', 'manual-call-point', 'sounder', 'smoke-valve']) {
      const element = ELEMENT_CATALOG.find((item) => item.typeCode === typeCode);
      expect(element === undefined ? null : groupOf(element), typeCode).toBe('пожарная автоматика');
    }
  });

  it('огнетушители и пожарные шкафы — внутри здания, гидранты и лестницы — снаружи', () => {
    const groupFor = (typeCode: string) => {
      const element = ELEMENT_CATALOG.find((item) => item.typeCode === typeCode);
      return element === undefined ? null : groupOf(element);
    };

    expect(groupFor('extinguisher-powder')).toBe('внутри здания');
    expect(groupFor('fire-hydrant-indoor')).toBe('внутри здания');
    expect(groupFor('hydrant')).toBe('снаружи здания');
    expect(groupFor('outdoor-ladder')).toBe('снаружи здания');
  });
});

describe('порядок работ — от частых к редким', () => {
  it('в карточке и журнале сроки идут по возрастанию', async () => {
    // Один порядок на карточку, журнал, план и чек-лист: глаз запоминает
    // положение строки, и разный порядок на разных экранах заставляет искать
    // нужную работу заново.
    const { activityCellsForObject, rulePackageSource } = await import('../index.js');
    const probe = (typeCode: string) => ({
      id: 'p', siteId: 'org', nodeId: 'f1', typeCode, regNumber: '1',
      position: null, technicalState: 'исправен', archivedAt: null,
    } as unknown as import('@izh/contracts').PlanObject);

    for (const typeCode of ['extinguisher-powder', 'fire-hydrant-indoor', 'control-panel', 'self-rescuer']) {
      const months = activityCellsForObject(probe(typeCode), [], '2026-08-23', 14, rulePackageSource)
        .map((cell) => cell.rule.periodicityMonths ?? 1);
      expect([...months].sort((a, b) => a - b), typeCode).toEqual(months);
    }
  });
});
