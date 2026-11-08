/**
 * Эталонные тесты пакета правил: проверяют сами цифры, а не только механику.
 *
 * Периодичности взяты из справочника заказчика
 * `ИЖ_СППЗ_периодичность_проверок_и_ТО_2026.docx`. Тест — это то место, где
 * ошибка в цифре (например, перезарядка порошкового огнетушителя раз в год
 * вместо раза в пять лет) будет замечена немедленно, а не на проверке МЧС.
 */

import { describe, expect, it } from 'vitest';
import { activitiesFor, activityRule } from '../rules/rule-package.js';

describe('огнетушители: периодичность зависит от заряда', () => {
  it('водный/пенный — проверка и перезарядка раз в год', () => {
    const rule = activityRule('extinguisher-water', 'perezaryadka');
    expect(rule?.periodicityMonths).toBe(12);
    expect(activityRule('extinguisher-foam', 'perezaryadka')?.periodicityMonths).toBe(12);
  });

  it('порошковый — перезарядка раз в 5 лет, а не раз в год', () => {
    const rule = activityRule('extinguisher-powder', 'perezaryadka');
    expect(rule?.periodicityMonths).toBe(60);
  });

  it('углекислотный — перезарядка раз в 5 лет плюс гидроиспытание корпуса', () => {
    const activities = activitiesFor('extinguisher-co2').map((rule) => rule.activityCode);
    // Эталон обновлён 23.08.2026: требование «Учёт наличия, осмотров и сроков
    // перезарядки» (ППР п. 60) из регламента убрано по решению заказчика.
    // Своего срока у него нет, и в чек-листе оно давало работу без даты —
    // вечное «нет данных», от которого исправный огнетушитель выглядел
    // необслуженным. Сама обязанность закрыта конкретными работами ниже:
    // осмотр, ежегодная проверка, перезарядка — каждая идёт в журнал.
    expect(activities).toEqual([
      'lokalny-kvartalny-osmotr', 'ezhegodnaya-proverka', 'polugodovaya-proverka',
      'vzveshivanie', 'perezaryadka', 'gidroispytanie',
    ]);
    expect(activityRule('extinguisher-co2', 'perezaryadka')?.periodicityMonths).toBe(60);
    expect(activityRule('extinguisher-co2', 'gidroispytanie')?.periodicityMonths).toBe(60);
  });

  it('BONTEL — перезарядка и переосвидетельствование раз в 10 лет', () => {
    expect(activityRule('extinguisher-bantl', 'perezaryadka')?.periodicityMonths).toBe(120);
    // Эталон обновлён 23.08.2026: пятилетнего освидетельствования у BONTEL нет.
    // Паспорт изделия назначает перезарядку и переосвидетельствование баллона
    // раз в 10 лет одной работой; типовой пятилетний срок ГОСТ к нему не
    // применяется, и держать оба значило бы требовать вскрывать огнетушитель
    // вдвое чаще, чем предписал изготовитель.
    expect(activitiesFor('extinguisher-bantl').map((rule) => rule.activityCode)).toEqual([
      'lokalny-kvartalny-osmotr', 'ezhegodnaya-proverka', 'polugodovaya-proverka',
      'vizualny-kontrol', 'perezaryadka',
    ]);
    expect(activitiesFor('extinguisher-bantl').map((rule) => rule.activityCode))
      .not.toContain('pyatiletnee-osvidetelstvovanie');
  });

  it('общий тип «Огнетушитель» — общие работы есть, срок перезарядки не назначается', () => {
    // Эталон обновлён 23.08.2026. Раньше список был пуст целиком, и 248
    // огнетушителей заказчика оставались вовсе без регламента. Работы, не
    // зависящие от заряда, к ним относятся: ежегодная проверка технического
    // состояния по ГОСТ Р 59641-2021 и квартальный осмотр.
    const codes = activitiesFor('extinguisher').map((rule) => rule.activityCode);
    expect(codes).toContain('ezhegodnaya-proverka');

    // А вот перезарядки нет: её срок зависит от заряда (вода — 1 год, порошок
    // и CO₂ — 5 лет), и подставить одно число для всех означало бы соврать.
    expect(codes).not.toContain('perezaryadka');
  });
});

describe('СПС и СОУЭ: осмотр и контроль — разные периодичности', () => {
  it('извещатель: осмотр раз в полгода, контроль функционирования раз в год', () => {
    expect(activityRule('smoke-detector', 'osmotr')?.periodicityMonths).toBe(6);
    expect(activityRule('smoke-detector', 'kontrol')?.periodicityMonths).toBe(12);
  });

  it('ППКП: осмотр ежемесячно, контроль раз в квартал, комплексные испытания раз в год', () => {
    expect(activityRule('control-panel', 'osmotr')?.periodicityMonths).toBe(1);
    expect(activityRule('control-panel', 'kontrol')?.periodicityMonths).toBe(3);
    expect(activityRule('control-panel', 'kompleks')?.periodicityMonths).toBe(12);
  });

  it('оповещатель СОУЭ: обслуживание раз в квартал, работоспособность раз в полгода', () => {
    expect(activityRule('sounder', 'obsluzhivanie')?.periodicityMonths).toBe(3);
    expect(activityRule('sounder', 'rabotosposobnost')?.periodicityMonths).toBe(6);
  });
});

describe('ВПВ и наружное водоснабжение', () => {
  it('кран ВПВ: осмотр ежемесячно, испытание клапана раз в полгода, перекатка раз в год', () => {
    expect(activityRule('fire-hydrant-indoor', 'osmotr')?.periodicityMonths).toBe(1);
    expect(activityRule('fire-hydrant-indoor', 'ispytanie')?.periodicityMonths).toBe(6);
    expect(activityRule('fire-hydrant-indoor', 'perekatka')?.periodicityMonths).toBe(12);
  });

  it('гидрант: водоотдача весной и осенью — раз в полгода', () => {
    expect(activityRule('hydrant', 'vodootdacha')?.periodicityMonths).toBe(6);
  });

  it('водоём и резервуар проверяются своей работой, а не водоотдачей', () => {
    // Эталон обновлён 24.08.2026. Водоотдачу меряют в водопроводной сети —
    // давление и расход; у водоёма нет ни сети, ни напора, и в его чек-листе
    // стояли пункты про давление, которого там не бывает. Вместо неё —
    // проверка водоисточника, тоже раз в полгода: запас воды, забор, подъезд.
    expect(activityRule('water-reservoir', 'vodootdacha')).toBeNull();
    expect(activityRule('water-reservoir', 'proverka-vodoistochnika')?.periodicityMonths).toBe(6);
  });
});

describe('наружные лестницы и ограждения кровли', () => {
  it('два разных мероприятия: обследование ежегодно и испытания раз в 5 лет', () => {
    // Оставить только пятилетние испытания значило бы, что девять лет из
    // десяти объект выглядит «в норме» без единой проверки.
    expect(activityRule('outdoor-ladder', 'obsledovanie')?.periodicityMonths).toBe(12);
    expect(activityRule('outdoor-ladder', 'ispytanie')?.periodicityMonths).toBe(60);
    expect(activityRule('roof-fence', 'obsledovanie')?.periodicityMonths).toBe(12);
    expect(activityRule('roof-fence', 'ispytanie')?.periodicityMonths).toBe(60);
  });
});

describe('противодымная защита, двери, СИЗ', () => {
  it('клапан и вентилятор ПДЗ: ТО ежемесячно и ежегодная проверка длительности работы', () => {
    expect(activityRule('smoke-valve', 'to-mesyachnoe')?.periodicityMonths).toBe(1);
    expect(activityRule('smoke-valve', 'to-godovoe')?.periodicityMonths).toBe(12);
    expect(activityRule('smoke-fan', 'to-mesyachnoe')?.periodicityMonths).toBe(1);
  });

  it('противопожарная дверь: обслуживание раз в квартал', () => {
    expect(activityRule('fire-door', 'to-kvartal')?.periodicityMonths).toBe(3);
  });

  it('самоспасатель: проверка раз в год', () => {
    expect(activityRule('self-rescuer', 'proverka')?.periodicityMonths).toBe(12);
  });
});

describe('типы без пакета правил', () => {
  it('общий «Огнетушитель»: срока перезарядки нет, общие работы есть', () => {
    const codes = activitiesFor('extinguisher').map((rule) => rule.activityCode);
    expect(codes).not.toContain('perezaryadka');
    expect(codes).toContain('ezhegodnaya-proverka');
  });

  it('типы, которых источники не касаются', () => {
    expect(activitiesFor('fire-truck-connection')).toEqual([]);
    expect(activitiesFor('assembly-point-которого-нет')).toEqual([]);
    expect(activitiesFor('exit')).toEqual([]);
  });
});

describe('каждое правило несёт нормативное основание', () => {
  it('у любого правила в пакете есть ссылка на документ и явная пометка статуса проверки', () => {
    const allTypeCodes = [
      'extinguisher-water',
      'extinguisher-foam',
      'extinguisher-powder',
      'extinguisher-co2',
      'extinguisher-bantl',
      'smoke-detector',
      'control-panel',
      'sounder',
      'powder-module',
      'fire-hydrant-indoor',
      'hydrant',
      'water-reservoir',
      'outdoor-ladder',
      'roof-fence',
      'smoke-valve',
      'smoke-fan',
      'fire-door',
      'self-rescuer',
    ];
    for (const typeCode of allTypeCodes) {
      for (const rule of activitiesFor(typeCode)) {
        expect(rule.ndReference.length).toBeGreaterThan(0);
        expect(typeof rule.needsVerification).toBe('boolean');
      }
    }
  });
});
