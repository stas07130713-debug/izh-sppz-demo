/**
 * Табличка-указатель пожарного водоисточника (ТЗ, Дополнение 6).
 *
 * Надписи собираются из карточки по договорённости, одинаковой для всего
 * предприятия. Главное здесь — объём: расчёт по нему решает, хватит ли воды и
 * сколько стволов подать, и ошибка в подписи дороже всех прочих.
 */

import { describe, expect, it } from 'vitest';
import type { WaterSourceProfile } from '@izh/contracts';
import {
  WATER_SOURCE_VEHICLE_COUNTS, waterSourceNumberSign, waterSourceVolumeSign,
} from '../objects/water-source-reference.js';

const EMPTY: WaterSourceProfile = {
  execution: null, placement: null, volumeM3: null, designVolumeM3: null,
  tankCount: null, intakeMethod: null, pad: null, vehicleCount: null,
};

describe('номер на табличке', () => {
  it('пишется через тире', () => {
    expect(waterSourceNumberSign('12')).toBe('ПВ — 12');
  });

  it('без номера не пишется вовсе', () => {
    // «ПВ —» на указателе читается как обрыв краски, а не как пустое поле.
    expect(waterSourceNumberSign(null)).toBe('');
    expect(waterSourceNumberSign('   ')).toBe('');
  });
});

describe('объём на табличке', () => {
  it('один резервуар — просто V', () => {
    expect(waterSourceVolumeSign({ ...EMPTY, volumeM3: 50, tankCount: 1 })).toBe('V — 50 м³');
  });

  it('количество не указано — считается одним', () => {
    expect(waterSourceVolumeSign({ ...EMPTY, volumeM3: 50 })).toBe('V — 50 м³');
  });

  it('несколько резервуаров — объём умножается и подписывается общим', () => {
    // Эталон обновлён 24.08.2026: в карточке теперь объём одного резервуара, а
    // общий считается умножением. Раньше от человека ждали, что он сложит их
    // сам и впишет сумму, — и «100» у трёх резервуаров читалось то как объём
    // каждого, то как весь запас.
    //
    // Без слова «общее» расчёт прочтёт «V — 300» как объём каждой ёмкости и
    // приедет за втрое большим запасом воды, чем есть.
    expect(waterSourceVolumeSign({ ...EMPTY, volumeM3: 100, tankCount: 3 })).toBe('V общее — 300 м³');
    expect(waterSourceVolumeSign({ ...EMPTY, volumeM3: 50, tankCount: 2 })).toBe('V общее — 100 м³');
  });

  it('без объёма не пишется вовсе', () => {
    expect(waterSourceVolumeSign(EMPTY)).toBe('');
    expect(waterSourceVolumeSign({ ...EMPTY, tankCount: 3 })).toBe('');
  });
});

describe('количество автомобилей', () => {
  it('по проекту от одного до пяти', () => {
    expect(WATER_SOURCE_VEHICLE_COUNTS).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('проверка водоисточника в регламенте', () => {
  it('раз в полгода и у всех видов источника', async () => {
    const { activitiesFor } = await import('../index.js');
    for (const typeCode of ['water-reservoir', 'water-pond', 'water-tank', 'water-natural']) {
      const rule = activitiesFor(typeCode).find((item) => item.activityCode === 'proverka-vodoistochnika');
      expect(rule, typeCode).toBeDefined();
      expect(rule?.periodicityMonths, typeCode).toBe(6);
    }
  });

  it('водоотдачи у водоёма нет: она про водопроводную сеть', async () => {
    // Эталон обновлён 24.08.2026. Водоотдачу меряют на гидранте — давление и
    // расход в сети; у водоёма нет ни сети, ни напора, и в его чек-листе
    // появлялись пункты про давление, которого там не бывает.
    const { activitiesFor } = await import('../index.js');

    for (const typeCode of ['water-reservoir', 'water-pond', 'water-tank', 'water-natural']) {
      const codes = activitiesFor(typeCode).map((rule) => rule.activityCode);
      expect(codes, typeCode).not.toContain('vodootdacha');
      expect(codes, typeCode).toContain('proverka-vodoistochnika');
    }
    // У гидранта она осталась: там сеть и есть.
    expect(activitiesFor('hydrant').map((rule) => rule.activityCode)).toContain('vodootdacha');
  });

  it('пункты чек-листа покрывают все пять разделов', async () => {
    const { activitiesFor } = await import('../index.js');
    const rule = activitiesFor('water-pond').find((item) => item.activityCode === 'proverka-vodoistochnika');
    const texts = (rule?.checklist ?? []).map((item) => (typeof item === 'string' ? item : item.text));

    expect(texts).toHaveLength(12);
    for (const needle of ['исправном состоянии', 'запас воды', 'забора воды', 'колодец', 'подъезд',
      'Указатель направления', 'видим и читаем', 'Расстояние до водоисточника', 'Сезонные условия']) {
      expect(texts.some((text) => text.includes(needle)), needle).toBe(true);
    }
  });

  it('по проверке оформляется акт', async () => {
    // Признак стоит у правила, в данных: по нему окно проверки показывает
    // графу акта, а не по списку кодов, зашитому в разметку.
    const { activitiesFor } = await import('../index.js');
    const rule = activitiesFor('water-pond').find((item) => item.activityCode === 'proverka-vodoistochnika');

    expect(rule?.needsAct).toBe(true);
    const others = activitiesFor('water-pond').filter((item) => item.activityCode !== 'proverka-vodoistochnika');
    expect(others.every((item) => item.needsAct !== true)).toBe(true);
  });
});
