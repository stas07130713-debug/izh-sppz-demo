/**
 * Поиск на обходе.
 *
 * Обходчик стоит перед предметом и вводит то, что видит на корпусе: номер, а
 * когда номера нет — марку. Искать он должен одной строкой, не выбирая
 * заранее, по какому полю: выбор поля на телефоне в перчатке — лишнее
 * действие там, где их и так много.
 */

import { describe, expect, it } from 'vitest';
import type { PlanObject } from '@izh/contracts';
import { matches } from './ObjectList';

function object(fields: Partial<PlanObject>): PlanObject {
  return {
    id: 'о1', typeCode: 'extinguisher-powder', regNumber: null, model: null,
    ...fields,
  } as unknown as PlanObject;
}

const место = 'АСС · МВАСО · 2 этаж';

describe('поиск оборудования на обходе', () => {
  it('пустой запрос показывает всё', () => {
    expect(matches(object({ regNumber: '28-16' }), место, '')).toBe(true);
    expect(matches(object({ regNumber: '28-16' }), место, '   ')).toBe(true);
  });

  it('находит по учётному номеру — по нему ищут чаще всего', () => {
    expect(matches(object({ regNumber: '28-16' }), место, '28-16')).toBe(true);
    expect(matches(object({ regNumber: '28-16' }), место, '28-17')).toBe(false);
  });

  it('находит по части номера: на корпусе бывает видна не вся надпись', () => {
    expect(matches(object({ regNumber: '28-16' }), место, '16')).toBe(true);
  });

  it('находит по марке и по виду', () => {
    expect(matches(object({ model: 'ОП-8' }), место, 'оп-8')).toBe(true);
    expect(matches(object({}), место, 'порошковый')).toBe(true);
  });

  it('находит по месту: обход идёт по этажам', () => {
    expect(matches(object({ regNumber: '28-16' }), место, 'мвасо')).toBe(true);
    expect(matches(object({ regNumber: '28-16' }), место, '2 этаж')).toBe(true);
  });

  it('регистр и лишние пробелы не мешают', () => {
    expect(matches(object({ model: 'ОП-8' }), место, '  ОП-8  ')).toBe(true);
    expect(matches(object({ regNumber: 'ОГ-1' }), место, 'ог-1')).toBe(true);
  });
});
