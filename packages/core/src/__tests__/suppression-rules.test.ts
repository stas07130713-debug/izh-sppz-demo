/**
 * Регламент модульных установок пожаротушения по паспортам изделий
 * (ТЗ, Дополнение 6).
 *
 * Порядок обслуживания модульной установки задают проектная документация и
 * паспорт конкретного изделия, а не общий норматив. Сроки в библиотеке —
 * типовые, из распространённых паспортов, и это должно быть видно в основании
 * каждой работы: приняв их за норму прямого действия, организация сослалась бы
 * на несуществующее требование.
 */

import { describe, expect, it } from 'vitest';
import { ELEMENT_FAMILIES, activitiesFor, defaultPeriodicities, elementByCode, familyOf } from '../index.js';

const SUBTYPES: readonly string[] = [
  'suppression-powder', 'suppression-gas', 'suppression-aerosol',
  'suppression-water', 'suppression-mist',
];

describe('виды установок по огнетушащему веществу', () => {
  it('все пять подвидов входят в одно семейство', () => {
    const family = ELEMENT_FAMILIES.find((item) => item.parent === 'autonomous-suppression');

    expect(family?.members).toEqual(SUBTYPES);
  });

  it('у каждого подвида есть название в каталоге', () => {
    for (const typeCode of SUBTYPES) {
      expect(elementByCode(typeCode)?.title, typeCode).toBeTruthy();
    }
  });

  it('у общего вида работ нет: пока неизвестно, чем тушит, назначать нечего', () => {
    // У порошкового осматривают мембрану, у газового взвешивают заряд, у
    // водяного ищут подтекания. Общего списка для них не существует.
    expect(activitiesFor('autonomous-suppression')).toEqual([]);
  });

  it('у каждого подвида свои работы', () => {
    for (const typeCode of SUBTYPES) {
      expect(activitiesFor(typeCode).length, typeCode).toBeGreaterThan(0);
    }
  });

  it('подвид опознаётся как исполнение своего семейства', () => {
    expect(familyOf('suppression-gas')?.parent).toBe('autonomous-suppression');
  });
});

describe('сроки взяты из паспортов и подписаны как таковые', () => {
  it('у каждой работы в основании стоит оговорка про паспорт и проект', () => {
    // Без неё пользователь примет типовой срок за требование норматива и
    // сошлётся на него перед проверяющим.
    for (const typeCode of SUBTYPES) {
      for (const rule of activitiesFor(typeCode)) {
        expect(rule.ndReference, `${typeCode} — ${rule.title}`)
          .toContain('определяются паспортом изделия и проектной документацией');
      }
    }
  });

  it('в основании назван сам паспорт, а не общая фраза', () => {
    const powder = activitiesFor('suppression-powder')[0];
    const gas = activitiesFor('suppression-gas')[0];

    expect(powder?.ndReference).toContain('Паспорт МПП');
    expect(gas?.ndReference).toContain('МГП');
  });

  it('все работы требуют сверки: паспорта у разных изделий разные', () => {
    for (const typeCode of SUBTYPES) {
      expect(activitiesFor(typeCode).every((rule) => rule.needsVerification), typeCode).toBe(true);
    }
  });
});

describe('сроки соответствуют прочитанным паспортам', () => {
  it('порошковый модуль: осмотр раз в квартал', () => {
    // Паспорт МПП «Тунгус», п. 7.1: один раз в квартал внешним осмотром.
    const osmotr = activitiesFor('suppression-powder').find((rule) => rule.activityCode === 'module-osmotr');

    expect(osmotr?.periodicityMonths).toBe(3);
  });

  it('газовый модуль: четыре вложенных регламента — месяц, квартал, год, пять лет', () => {
    const months = activitiesFor('suppression-gas').map((rule) => rule.periodicityMonths);

    expect(months).toEqual([1, 3, 12, 60]);
  });

  it('аэрозольный генератор: осмотр не реже двух раз в год', () => {
    // Паспорт ГОАП, п. 6.2. Перезарядки у него нет: сработавший заменяется.
    const osmotr = activitiesFor('suppression-aerosol').find((rule) => rule.activityCode === 'module-osmotr');

    expect(osmotr?.periodicityMonths).toBe(6);
    expect(activitiesFor('suppression-aerosol').map((rule) => rule.activityCode)).not.toContain('module-massa');
  });

  it('модуль тонкораспылённой воды: осмотр раз в квартал, без контроля массы', () => {
    // Паспорт МУПТВ, п. 7.3 прямо оговаривает: проверка массы баллонов
    // газом-вытеснителем в течение срока службы не требуется.
    const codes = activitiesFor('suppression-mist').map((rule) => rule.activityCode);

    expect(activitiesFor('suppression-mist')[0]?.periodicityMonths).toBe(3);
    expect(codes).not.toContain('module-massa');
  });

  it('контроль массы газа отсчитывается от изготовления, а не от установки', () => {
    // Заряд стареет со дня заправки, а не со дня монтажа.
    const mass = activitiesFor('suppression-gas').find((rule) => rule.activityCode === 'module-massa');

    expect(mass?.baselineKind).toBe('изготовление');
  });
});

describe('регламент собирается в конструкторе', () => {
  it('у каждого подвида периодичности выстраиваются от частых к редким', () => {
    for (const typeCode of SUBTYPES) {
      const months = defaultPeriodicities(typeCode).map((item) =>
        item.rule.kind === 'интервал' ? item.rule.every : 0);
      expect([...months].sort((a, b) => a - b), typeCode).toEqual(months);
    }
  });
});

describe('вид ОТВ уточняется в карточке', () => {
  it('общий вид и все подвиды входят в одну настраиваемую группу', async () => {
    // Установку ставят на план одним значком, а чем она тушит — выясняется по
    // паспорту. Значит, вид должен меняться в карточке, как заряд огнетушителя.
    const { configurableFamily } = await import('../objects/element-catalog.js');

    expect(configurableFamily('autonomous-suppression')).toBe('autonomous-suppression');
    for (const typeCode of SUBTYPES) {
      expect(configurableFamily(typeCode), typeCode).toBe('autonomous-suppression');
    }
  });

  it('смена вида ОТВ меняет состав работ', async () => {
    const { activitiesFor } = await import('../index.js');
    const powder = activitiesFor('suppression-powder').map((rule) => rule.activityCode);
    const gas = activitiesFor('suppression-gas').map((rule) => rule.activityCode);

    expect(powder).not.toEqual(gas);
    // У порошкового осматривают узел запуска, у газового взвешивают заряд.
    expect(powder).toContain('module-pusk');
    expect(gas).toContain('module-massa');
  });

  it('подвид установки нельзя перепутать с подвидом огнетушителя', async () => {
    // Группы разные, и смена типа между ними запрещена сценарием правки.
    const { configurableFamily } = await import('../objects/element-catalog.js');

    expect(configurableFamily('extinguisher-powder')).not.toBe(configurableFamily('suppression-powder'));
  });
});
