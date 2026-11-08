/**
 * Обязательные требования нормативных правовых актов в регламенте.
 *
 * Проверяется не текст норматива — его проверял человек по справочнику
 * заказчика, — а то, что требование доходит до регламента, помечено
 * обязательным и не теряется по дороге. Потерять его тихо — худшее, что может
 * сделать программа: журнал будет выглядеть полным, а работа не вестись.
 */

import { describe, expect, it } from 'vitest';
import { ELEMENT_CATALOG, RULE_PACKAGE, activitiesFor, defaultPeriodicities } from '../index.js';
import { EXTINGUISHER_TYPES, SPZ_SYSTEM_TYPES, npaRequirementsFor } from '../rules/npa-requirements.js';

describe('требования НПА по видам оборудования', () => {
  it('в регламенте нет требований без конкретного срока', () => {
    // Эталон обновлён 23.08.2026 по решению заказчика. Раньше сюда попадали
    // две общие обязанности ППР — «обслуживать по регламенту» (п. 54,
    // абз. 1–3) и «вести учёт огнетушителей» (п. 60). Своего срока у них нет,
    // и в чек-листе они давали работу без даты: вечное «нет данных», от
    // которого исправный элемент выглядел необслуженным, а значок на плане
    // серел. Обязанности закрыты конкретными работами — осмотром, ежегодной
    // проверкой, перезарядкой, — и каждая идёт в журнал эксплуатации.
    for (const typeCode of [...EXTINGUISHER_TYPES, ...SPZ_SYSTEM_TYPES]) {
      for (const rule of npaRequirementsFor(typeCode)) {
        expect(rule.periodicityMonths, `${typeCode}/${rule.activityCode}`).not.toBeNull();
      }
    }
  });

  it('у средств пожарной автоматики требование ППР об испытаниях сверх срока службы', () => {
    for (const typeCode of SPZ_SYSTEM_TYPES) {
      const codes = activitiesFor(typeCode).map((rule) => rule.activityCode);
      expect(codes, typeCode).toContain('ppr-ispytanie-sverh-sroka');
    }
  });

  it('требование НПА идёт первым, раньше типовых регламентов ГОСТ', () => {
    // Порядок становится порядком работ в конструкторе и в чек-листе:
    // обязательное пользователь должен увидеть раньше рекомендованного.
    expect(activitiesFor('smoke-detector')[0]?.activityCode).toBe('ppr-ispytanie-sverh-sroka');
  });

  it('испытания сверх срока службы — условные, в состав по умолчанию не входят', () => {
    // ППР п. 54, абз. 4 применяется, только когда срок службы истёк.
    const rule = activitiesFor('control-panel').find((item) => item.activityCode === 'ppr-ispytanie-sverh-sroka');

    expect(rule?.optIn).toBe(true);
  });

  it('видам, которых требования ППР не касаются, ничего не приписывается', () => {
    // Молча подставить «похожее» требование нельзя: ошибка здесь оборачивается
    // замечанием при проверке МЧС у заказчика.
    expect(npaRequirementsFor('fire-truck-connection')).toEqual([]);
    expect(npaRequirementsFor('вида-которого-нет')).toEqual([]);
  });

  it('каждое требование НПА несёт ссылку на документ и пункт', () => {
    for (const typeCode of [...EXTINGUISHER_TYPES, ...SPZ_SYSTEM_TYPES]) {
      for (const rule of npaRequirementsFor(typeCode)) {
        expect(rule.ndReference, rule.activityCode).toContain('ППР РФ №1479');
        expect(rule.ndReference, rule.activityCode).toMatch(/п\. \d+/);
      }
    }
  });
});

describe('требование НПА в собранном регламенте', () => {
  it('помечено как обязательное, а не как рекомендация', () => {
    // Эталон обновлён 23.08.2026: у огнетушителей требований ППР со сроком не
    // осталось, поэтому проверяется на средстве автоматики.
    const activities = defaultPeriodicities('smoke-detector').flatMap((item) => item.activities);
    const npa = activities.filter((item) => item.sources.some((source) => source.reference.includes('ППР')));

    expect(npa.length).toBeGreaterThan(0);
    expect(npa.every((item) => item.sources.some((source) => source.kind === 'обязательное требование'))).toBe(true);
  });

  it('условное требование приходит выключенным: его включает наступившее условие', () => {
    // Эталон обновлён 23.08.2026. Раньше здесь проверялось обратное — что
    // требование НПА приходит включённым. Это было верно, пока среди них были
    // безусловные (ППР п. 54 абз. 1–3 и п. 60). Их убрали как работы без
    // срока, и осталось одно — ежегодные испытания сверх срока службы. Оно
    // применяется, только когда срок службы изготовителя истёк, и включать
    // его всем подряд значило бы требовать испытаний с нового оборудования.
    const activities = defaultPeriodicities('smoke-detector').flatMap((item) => item.activities);
    const npa = activities.filter((item) => item.sources.some((source) => source.kind === 'обязательное требование'));

    expect(npa.length).toBeGreaterThan(0);
    expect(npa.every((item) => !item.required)).toBe(true);
  });
});

describe('покрытие оборудования регламентами', () => {
  it('у каждого вида, заведённого в каталоге огнетушителей, есть регламент', () => {
    for (const typeCode of EXTINGUISHER_TYPES) {
      expect(defaultPeriodicities(typeCode).length, typeCode).toBeGreaterThan(0);
    }
  });

  it('все виды с правилами имеют название в каталоге элементов', () => {
    // Иначе в конструкторе появится строка с кодом вместо названия, и
    // пользователь не поймёт, что настраивает.
    const catalog = new Set(ELEMENT_CATALOG.map((element) => element.typeCode));
    for (const typeCode of Object.keys(RULE_PACKAGE)) {
      expect(catalog.has(typeCode), typeCode).toBe(true);
    }
  });
});
