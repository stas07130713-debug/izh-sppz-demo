/**
 * Табличка-указатель пожарного гидранта (ТЗ, Дополнение 6).
 *
 * Надписи собираются из карточки по договорённости, одинаковой для всего
 * предприятия: «кольцевая сеть диаметром 200 мм» становится «К-200». Это
 * правило, а не оформление, поэтому живёт в ядре и проверяется здесь.
 *
 * Половина обозначения хуже его отсутствия: «К-» на табличке читается как
 * обрыв краски, а не как незаполненное поле, и расчёт делает по нему выводы.
 */

import { describe, expect, it } from 'vitest';
import type { OutdoorHydrantProfile } from '@izh/contracts';
import {
  HYDRANT_HEIGHTS_MM, HYDRANT_PATTERNS, WATER_NETWORK_KINDS,
  formatSignDistance, hydrantPatternSign, waterNetworkSign,
} from '../objects/hydrant-reference.js';

const EMPTY: OutdoorHydrantProfile = {
  placementKind: null, pattern: null, networkKind: null, networkDiameterMm: null,
  heightMm: null, signDistanceLeftM: null, signDistanceRightM: null, signDistanceDownM: null,
};

describe('обозначение водопроводной сети', () => {
  it('складывается из типа сети и диаметра', () => {
    expect(waterNetworkSign({ ...EMPTY, networkKind: 'кольцевая', networkDiameterMm: 200 })).toBe('К-200');
    expect(waterNetworkSign({ ...EMPTY, networkKind: 'тупиковая', networkDiameterMm: 100 })).toBe('Т-100');
    expect(waterNetworkSign({
      ...EMPTY, networkKind: 'кольцевая с тупиковыми участками', networkDiameterMm: 300,
    })).toBe('КТ-300');
  });

  it('без диаметра или без типа сети не пишется вовсе', () => {
    expect(waterNetworkSign({ ...EMPTY, networkKind: 'кольцевая' })).toBe('');
    expect(waterNetworkSign({ ...EMPTY, networkDiameterMm: 200 })).toBe('');
    expect(waterNetworkSign(EMPTY)).toBe('');
  });

  it('у каждого типа сети обозначение своё', () => {
    const signs = WATER_NETWORK_KINDS.map((item) => item.sign);
    expect(new Set(signs).size).toBe(signs.length);
  });
});

describe('обозначение образца', () => {
  it('московский, ленинградский и немецкий — МО, ЛО, НО', () => {
    expect(hydrantPatternSign('московского образца')).toBe('МО');
    expect(hydrantPatternSign('ленинградского образца')).toBe('ЛО');
    expect(hydrantPatternSign('немецкого образца')).toBe('НО');
  });

  it('у «другого» образца обозначения нет: придумывать его нельзя', () => {
    // К гидранту одного образца колонка другого не подходит, и выдуманная
    // буква на табличке отправила бы расчёт с неподходящей колонкой.
    expect(hydrantPatternSign('другой')).toBe('');
    expect(hydrantPatternSign(null)).toBe('');
    expect(hydrantPatternSign('неизвестно что')).toBe('');
  });

  it('обозначения образцов не повторяются', () => {
    const signs = HYDRANT_PATTERNS.map((item) => item.sign).filter((sign) => sign !== '');
    expect(new Set(signs).size).toBe(signs.length);
  });
});

describe('расстояние на табличке', () => {
  it('пишется с одним знаком после точки', () => {
    expect(formatSignDistance('12')).toBe('12.0');
    expect(formatSignDistance('3,5')).toBe('3.5');
    expect(formatSignDistance('0.25')).toBe('0.3');
  });

  it('незаполненное остаётся пустым, а не превращается в ноль', () => {
    // «0.0» означает «гидрант под указателем», и подставлять его туда, где не
    // измеряли, нельзя: расчёт пойдёт искать колодец не там.
    expect(formatSignDistance(null)).toBe('');
    expect(formatSignDistance('   ')).toBe('');
    expect(formatSignDistance('около десяти')).toBe('');
    expect(formatSignDistance('-4')).toBe('');
  });
});

describe('высоты гидранта', () => {
  it('ряд по ГОСТ 8220-85: от 500 до 3500 мм с шагом 250', () => {
    expect(HYDRANT_HEIGHTS_MM[0]).toBe(500);
    expect(HYDRANT_HEIGHTS_MM[HYDRANT_HEIGHTS_MM.length - 1]).toBe(3500);
    for (let i = 1; i < HYDRANT_HEIGHTS_MM.length; i += 1) {
      expect((HYDRANT_HEIGHTS_MM[i] ?? 0) - (HYDRANT_HEIGHTS_MM[i - 1] ?? 0)).toBe(250);
    }
  });
});
