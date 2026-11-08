/**
 * Наружное оборудование: ограждение кровли, пожарный щит, насосная станция
 * (ТЗ, Дополнение 6).
 *
 * У всех троих раньше было чужое или пустое: ограждение проверялось чек-листом
 * лестницы, у щита и насосной станции регламента не было вовсе, и в карточке
 * они выглядели необслуживаемыми.
 */

import { describe, expect, it } from 'vitest';
import { activitiesFor } from '../index.js';
import { requiredFenceHeight } from '../objects/outdoor-equipment-reference.js';

describe('требуемая высота ограждения кровли', () => {
  it('растёт ступенями по высоте здания (ГОСТ Р 53254-2009, таблица 3)', () => {
    expect(requiredFenceHeight(12)).toBe(0.6);
    expect(requiredFenceHeight(20)).toBe(0.6);
    expect(requiredFenceHeight(25)).toBe(0.8);
    expect(requiredFenceHeight(30)).toBe(0.8);
    expect(requiredFenceHeight(45)).toBe(1.0);
    expect(requiredFenceHeight(50)).toBe(1.0);
    expect(requiredFenceHeight(80)).toBe(1.1);
  });

  it('без высоты здания норму назвать нельзя', () => {
    // Подставить сюда «обычные» 0,6 м значило бы объявить нормальным ограждение,
    // которое на высотном здании втрое ниже положенного.
    expect(requiredFenceHeight(null)).toBeNull();
    expect(requiredFenceHeight(0)).toBeNull();
  });
});

describe('регламенты наружного оборудования', () => {
  it('у ограждения кровли свой чек-лист, а не лестничный', () => {
    // Раньше у ограждения стоял чек-лист лестницы, и человек читал в нём про
    // ступени, которых нет.
    const fence = activitiesFor('roof-fence');
    const ladder = activitiesFor('outdoor-ladder');

    const текст = (rules: typeof fence): readonly string[] =>
      rules.flatMap((rule) => rule.checklist.map((item) => (typeof item === 'string' ? item : item.text)));

    expect(текст(fence).some((item) => item.includes('ступен'))).toBe(false);
    expect(текст(ladder).some((item) => item.includes('Крепления к стене'))).toBe(true);
    expect(текст(fence).some((item) => item.includes('парапету'))).toBe(true);
    expect(текст(fence).some((item) => item.includes('Высота ограждения'))).toBe(true);
  });

  it('сроки у ограждения те же, что у лестницы: одна норма на двоих', () => {
    const period = (typeCode: string, code: string): number | null | undefined =>
      activitiesFor(typeCode).find((rule) => rule.activityCode === code)?.periodicityMonths;

    expect(period('roof-fence', 'obsledovanie')).toBe(12);
    expect(period('roof-fence', 'ispytanie')).toBe(60);
    expect(period('outdoor-ladder', 'obsledovanie')).toBe(12);
    expect(period('outdoor-ladder', 'ispytanie')).toBe(60);
  });

  it('по испытаниям лестницы и ограждения оформляется акт', () => {
    for (const typeCode of ['outdoor-ladder', 'roof-fence']) {
      const rule = activitiesFor(typeCode).find((item) => item.activityCode === 'ispytanie');
      expect(rule?.needsAct, typeCode).toBe(true);
    }
  });

  it('у пожарного щита проверяется комплектность — у всех его видов', () => {
    for (const typeCode of ['outdoor-cabinet', 'fire-board-a', 'fire-board-v', 'fire-board-e',
      'fire-board-sh', 'fire-board-mobile', 'outdoor-cabinet-box']) {
      const rule = activitiesFor(typeCode).find((item) => item.activityCode === 'komplektnost-shchita');
      expect(rule, typeCode).toBeDefined();
      expect(rule?.periodicityMonths, typeCode).toBe(3);
    }
  });

  it('у насосной станции проверяются насосы и приборы', () => {
    const codes = activitiesFor('pump-station').map((rule) => rule.activityCode);
    expect(codes).toContain('rabotosposobnost-nasosov');
    expect(codes).toContain('kip');

    const pumps = activitiesFor('pump-station').find((rule) => rule.activityCode === 'rabotosposobnost-nasosov');
    // Насос, который не запускали, считается неработающим: подшипники прикипают,
    // а обнаруживается это при пожаре.
    expect(pumps?.periodicityMonths).toBe(1);
  });
});

describe('огнезащитная обработка', () => {
  it('проверяется раз в год по ППР п. 13 и оформляется актом', async () => {
    // Пункт 13 Правил: в сроки изготовителя, а если он их не назвал — не реже
    // одного раза в год, с составлением акта (протокола).
    const rule = activitiesFor('fireproofing').find((item) => item.activityCode === 'proverka-ognezashchity');

    expect(rule?.periodicityMonths).toBe(12);
    expect(rule?.needsAct).toBe(true);
    expect(rule?.ndReference).toContain('ППР РФ №1479, п. 13');
  });

  it('возобновление — работа условная и по умолчанию выключена', () => {
    // Она нужна не по календарю, а когда истёк срок состава или проверка
    // выявила повреждения.
    const rule = activitiesFor('fireproofing').find((item) => item.activityCode === 'vozobnovlenie-ognezashchity');

    expect(rule?.optIn).toBe(true);
    expect(rule?.periodicityByOrganization).toBe(true);
  });
});

describe('срок, назначаемый организацией', () => {
  it('помечен там, где норматив числа не даёт', () => {
    // По этой пометке конструктор говорит, что срок — предложение программы, а
    // не норма, и на него нельзя сослаться перед проверяющим.
    const shield = activitiesFor('fire-board-v').find((item) => item.activityCode === 'komplektnost-shchita');
    const pumps = activitiesFor('pump-station').find((item) => item.activityCode === 'rabotosposobnost-nasosov');

    expect(shield?.periodicityByOrganization).toBe(true);
    expect(pumps?.periodicityByOrganization).toBe(true);
  });

  it('там, где норматив срок называет, пометки нет', () => {
    const yearly = activitiesFor('roof-fence').find((item) => item.activityCode === 'obsledovanie');
    const fireproofing = activitiesFor('fireproofing').find((item) => item.activityCode === 'proverka-ognezashchity');

    expect(yearly?.periodicityByOrganization).not.toBe(true);
    expect(fireproofing?.periodicityByOrganization).not.toBe(true);
  });
});
