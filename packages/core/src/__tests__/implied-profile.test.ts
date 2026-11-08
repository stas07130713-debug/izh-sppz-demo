/**
 * Вид и модель уже говорят, чем и сколько (ТЗ, часть С102).
 *
 * Заказчик: «нужно несколько раз вводить одни и те же данные, чтобы определился
 * ранг». Здесь проверяется, что второй и третий раз спрашивать не нужно — и,
 * что важнее, что подстановка не затирает введённое человеком: огнетушитель
 * бывает перезаряжен не тем, что написано на этикетке.
 */

import { describe, expect, it } from 'vitest';
import type { ExtinguisherProfile } from '@izh/contracts';
import { agentFromModel, agentOfType, chargeFromModel, impliedProfileFields } from '../extinguishers/implied-profile.js';
import { extinguisherMark, rankOfExtinguisher } from '../extinguishers/extinguisher-fitness.js';
import { formatFireRank } from '../extinguishers/fire-rank.js';

function profile(extra: Partial<ExtinguisherProfile> = {}): ExtinguisherProfile {
  return {
    agent: null, nominalCharge: null, chargeUnit: null, execution: null,
    fireRating: null, manufacturedOn: null, placedOn: null, serviceLifeEndsOn: null,
    ...extra,
  } as unknown as ExtinguisherProfile;
}

describe('вещество по виду изделия', () => {
  it('порошковый — порошок, углекислотный — углекислота', () => {
    expect(agentOfType('extinguisher-powder')).toBe('порошок');
    expect(agentOfType('extinguisher-co2')).toBe('углекислота');
  });

  it('общий вид «Огнетушитель» вещества не называет', () => {
    // Он и заведён для случая, когда вид ещё не уточнён: придумывать за
    // человека вещество нельзя — от него зависит и ранг, и пригодность.
    expect(agentOfType('extinguisher')).toBeNull();
  });

  it('вещество вида и обозначение вида говорят об одном и том же', () => {
    // Две таблицы описывают одно изделие: разойдись они, карточка показывала
    // бы «порошок», а ранг считался бы по углекислотному.
    for (const typeCode of ['extinguisher-powder', 'extinguisher-co2', 'extinguisher-water', 'extinguisher-foam']) {
      const byType = extinguisherMark(typeCode, null);
      const byAgent = extinguisherMark('extinguisher', profile({ agent: agentOfType(typeCode) }));
      expect(byAgent, typeCode).toBe(byType);
    }
  });
});

describe('заряд из обозначения модели', () => {
  it('читается число сразу за буквами вида', () => {
    expect(chargeFromModel('ОП-4')).toBe(4);
    expect(chargeFromModel('ОУ-5')).toBe(5);
    expect(chargeFromModel('ОВЭ-6')).toBe(6);
  });

  it('способ вытеснения и классы заряду не мешают', () => {
    expect(chargeFromModel('ОП-4(з) ABCE')).toBe(4);
    expect(chargeFromModel('ОП-2 (з)')).toBe(2);
  });

  it('дробный заряд читается', () => {
    expect(chargeFromModel('ОУ-1,5')).toBe(1.5);
  });

  it('чужие числа обозначения в заряд не попадают', () => {
    // «2A 55B» — это ранг, а не заряд. Взять первое попавшееся число значило бы
    // молча записать в карточку 55 килограммов порошка.
    expect(chargeFromModel('ОП-4(з) ABCE 2A 55B')).toBe(4);
  });

  it('не обозначение огнетушителя — не заряд', () => {
    expect(chargeFromModel('Буран-8')).toBeNull();
    expect(chargeFromModel('')).toBeNull();
    expect(chargeFromModel(null)).toBeNull();
  });
});

describe('дополнение карточки', () => {
  it('пустые вещество и заряд берутся из вида и модели', () => {
    expect(impliedProfileFields({ typeCode: 'extinguisher-powder', model: 'ОП-4', profile: null }))
      .toEqual({ agent: 'порошок', nominalCharge: 4 });
  });

  it('введённое человеком не затирается', () => {
    // Огнетушитель бывает перезаряжен другим составом, а модель — набрана своя.
    const mine = profile({ agent: 'углекислота', nominalCharge: 2 });
    expect(impliedProfileFields({ typeCode: 'extinguisher-powder', model: 'ОП-4', profile: mine })).toEqual({});
  });

  it('дополнять нечего — пустой ответ, а не подстановка пустот', () => {
    expect(impliedProfileFields({ typeCode: 'extinguisher', model: null, profile: null })).toEqual({});
  });
});

describe('ранг после дополнения', () => {
  it('вида и модели хватает, чтобы ранг посчитался сам', () => {
    // Ровно то, о чём просил заказчик: человек выбрал «порошковый» и «ОП-4» —
    // и больше ничего вводить не нужно.
    const filled = profile(impliedProfileFields({
      typeCode: 'extinguisher-powder', model: 'ОП-4(з) ABCE', profile: null,
    }));

    const { rank, fromCard } = rankOfExtinguisher('extinguisher-powder', filled);
    expect(fromCard).toBe(false);
    expect(rank).not.toBeNull();
    expect(formatFireRank(rank as NonNullable<typeof rank>)).not.toBe('');
  });

  it('без дополнения тех же данных не хватало', () => {
    // Проверка ловит именно то, ради чего написана: до подстановки ранг по
    // одному виду и модели не считался — за этим человек и заполнял поля второй раз.
    const { rank } = rankOfExtinguisher('extinguisher-powder', profile());
    expect(rank).toBeNull();
  });
});

describe('вещество, названное обозначением модели', () => {
  /*
   * Найдено при сплошной проверке: карточка огнетушителя с видом «Огнетушитель»
   * (без уточнения подвида) и моделью «ОП-5» не давала ни вещества, ни ранга —
   * спрашивала вещество заново. А вид «Огнетушитель» ставит сама программа: при
   * переносе чужого журнала и при укладке значка на план. То есть самый частый
   * случай как раз и не работал.
   */
  it('«ОП-5» — это порошок', () => {
    expect(agentFromModel('ОП-5')).toBe('порошок');
  });

  it('«ОУ-3» — углекислота, «ОВЭ-6» — вода с добавками', () => {
    expect(agentFromModel('ОУ-3')).toBe('углекислота');
    expect(agentFromModel('ОВЭ-6')).toBe('вода с добавками');
  });

  it('«ОВП» не путается с «ОВ»: пена, а не вода', () => {
    expect(agentFromModel('ОВП-8')).toBe('пена');
    expect(agentFromModel('ОВ-5')).toBe('вода');
  });

  it('своя модель ничего не подсказывает', () => {
    expect(agentFromModel('Буран-8')).toBeNull();
    expect(agentFromModel(null)).toBeNull();
  });

  it('вид изделия главнее обозначения', () => {
    // Перезаряженный другим составом огнетушитель остаётся с прежней надписью
    // на корпусе: выбранный человеком вид не должен ею перебиваться.
    const filled = impliedProfileFields({
      typeCode: 'extinguisher-co2',
      model: 'ОП-5',
      profile: null,
    });
    expect(filled.agent).toBe('углекислота');
  });

  it('без подвида вещество берётся из обозначения', () => {
    const filled = impliedProfileFields({ typeCode: 'extinguisher', model: 'ОП-5', profile: null });
    expect(filled.agent).toBe('порошок');
    expect(filled.nominalCharge).toBe(5);
  });
});
