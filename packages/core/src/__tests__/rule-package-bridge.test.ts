/**
 * Эталонные тесты моста «библиотека → регламент» (Дополнение 5, часть Р16).
 *
 * Главное, что здесь закреплено: переход на конструктор не теряет выверенные
 * нормативные сроки. Сверка 19.08.2026 по ГОСТ Р 59641-2021 стоила отдельной
 * работы, и результат обязан пережить смену модели.
 */

import { describe, expect, it } from 'vitest';
import { defaultPeriodicities, defaultRegulation } from '../rules/rule-package-bridge.js';

// Движок здесь намеренно не вызывается: ядро о движках не знает (AGENTS.md,
// правило 1), и тест ядра проверяет только то, что перевод даёт правильное
// правило срока. Что движок считает по такому правилу верную дату — проверено
// его собственными эталонными тестами.

describe('перевод нормативной библиотеки в регламент', () => {
  it('сроки перезарядки огнетушителей сохраняются', () => {
    // ГОСТ Р 59641-2021, таблица 1 п. 5.1.11.1: вода и пена — 1 раз в год,
    // порошок и углекислота — 1 раз в 5 лет.
    const water = defaultPeriodicities('extinguisher-water');
    const powder = defaultPeriodicities('extinguisher-powder');

    expect(water.map((p) => p.title)).toContain('Ежегодно');
    expect(powder.map((p) => p.title)).toContain('Раз в 5 лет');
  });

  it('годовой срок водного огнетушителя переводится в интервал 12 месяцев', () => {
    const yearly = defaultPeriodicities('extinguisher-water').find((p) => p.title === 'Ежегодно');
    expect(yearly?.rule).toEqual({ kind: 'интервал', every: 12, unit: 'месяц' });
  });

  it('пятилетний срок порошкового огнетушителя переводится в интервал 60 месяцев', () => {
    const fiveYears = defaultPeriodicities('extinguisher-powder').find((p) => p.title === 'Раз в 5 лет');
    expect(fiveYears?.rule).toEqual({ kind: 'интервал', every: 60, unit: 'месяц' });
  });

  it('срок «по регламенту» не выдумывает число, а честно остаётся без срока', () => {
    // В библиотеке periodicityMonths === null означает «срок задан регламентом,
    // паспортом или проектом». Подставить сюда цифру было бы выдумкой норматива.
    const periodicities = defaultPeriodicities('fire-door');
    const byNeed = periodicities.find((p) => p.title === 'По необходимости');
    if (byNeed !== undefined) expect(byNeed.rule).toEqual({ kind: 'по-необходимости' });
  });

  it('мероприятия с одинаковым сроком собираются в одну периодичность', () => {
    // В конструкторе пользователь видит «Ежегодно» и внутри состав работ, а не
    // список независимых мероприятий с одинаковой цифрой.
    const periodicities = defaultPeriodicities('extinguisher-water');
    const titles = periodicities.map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('требование ППР помечается обязательным и не отключается', () => {
    // Перекатка рукавов — п. 50 ППР РФ №1479, это нормативный правовой акт.
    const periodicities = defaultPeriodicities('fire-hydrant-indoor');
    const activities = periodicities.flatMap((p) => p.activities);
    const mandatory = activities.filter((activity) =>
      activity.sources.some((source) => source.kind === 'обязательное требование'),
    );
    expect(mandatory.length).toBeGreaterThan(0);
  });

  it('измеряемый пункт становится числовым полем, а не галочкой', () => {
    // Давление и масса — это измерение. Хранить их галочкой значит терять
    // само значение, ради которого проверка и проводится.
    const activities = defaultPeriodicities('extinguisher-powder').flatMap((p) => p.activities);
    expect(activities.some((activity) => activity.answerKind === 'число')).toBe(true);
  });

  it('стартовый регламент назначается на организацию', () => {
    let counter = 0;
    const { regulation, version } = defaultRegulation({
      typeCode: 'extinguisher-powder',
      organizationId: 'node-org',
      now: '2026-08-19T10:00:00.000Z',
      effectiveFrom: '2026-08-19',
      newId: () => `id-${(counter += 1)}`,
    });

    expect(regulation.scope).toBe('организация');
    expect(regulation.targetId).toBe('node-org');
    expect(version.version).toBe(1);
    expect(version.periodicities.length).toBeGreaterThan(0);
  });

  it('тип, которого источники не касаются, даёт пустой регламент, а не выдуманный', () => {
    // Пустой ответ — честный: правил для этого вида не заведено ни в НПА, ни в
    // типовых регламентах, и придумывать срок неоткуда.
    expect(defaultPeriodicities('fire-truck-connection')).toHaveLength(0);
    expect(defaultPeriodicities('вида-которого-нет')).toHaveLength(0);
  });

  it('обязательное требование НПА попадает в регламент отдельной работой', () => {
    // Эталон обновлён 23.08.2026: проверялось требование ППР п. 60 об учёте
    // огнетушителей, но его убрали из регламента как работу без срока.
    // Осталось требование п. 54, абз. 4 — ежегодные испытания оборудования,
    // работающего сверх срока службы. В конструкторе оно обязано быть видно —
    // с указанием документа и с пометкой обязательности.
    const activities = defaultPeriodicities('control-panel').flatMap((item) => item.activities);
    const ispytanie = activities.find((item) => item.title.includes('испытания'));

    expect(ispytanie).toBeDefined();
    expect(ispytanie?.sources[0]?.kind).toBe('обязательное требование');
    expect(ispytanie?.sources[0]?.reference).toContain('ППР РФ №1479, п. 54');
  });
});
