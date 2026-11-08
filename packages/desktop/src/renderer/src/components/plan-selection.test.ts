/**
 * Групповое выделение значков на плане (ТЗ, Дополнение 6, часть С77).
 *
 * Заказчик: «должна быть возможность выделять точечно и удалять объекты —
 * обычным выделением и точечным по сложным траекториям».
 *
 * Отсюда два способа и одна общая проверка: выделено ровно то, что человек
 * обвёл. Действие потом необратимое — вывод оборудования из эксплуатации, — и
 * лишний объект в наборе стоит дороже недостающего.
 */

import { describe, expect, it } from 'vitest';
import type { PlanObject } from '@izh/contracts';
import { inPath, pickedObjects } from './plan-selection';

function object(id: string, x: number | null, y = 0): PlanObject {
  return {
    id, siteId: 'объект', nodeId: 'этаж', typeCode: 'extinguisher-powder', regNumber: id,
    position: x === null ? null : { x, y }, archivedAt: null,
  } as unknown as PlanObject;
}

/** Ряд вдоль стены и один в стороне. */
const OBJECTS: readonly PlanObject[] = [
  object('ОП-1', 10, 10),
  object('ОП-2', 20, 10),
  object('ОП-3', 30, 10),
  object('ОП-4', 90, 90),
  object('в журнале', null),
];

const SQUARE: readonly [{ x: number; y: number }, { x: number; y: number }] = [
  { x: 0, y: 0 }, { x: 40, y: 40 },
];

describe('выделение рамкой', () => {
  it('берёт то, что внутри, и не берёт остальное', () => {
    expect(pickedObjects(OBJECTS, 'rect', SQUARE, [])).toEqual(['ОП-1', 'ОП-2', 'ОП-3']);
  });

  it('рамка считается по углам в любом порядке: тянуть можно в любую сторону', () => {
    const backwards: readonly [{ x: number; y: number }, { x: number; y: number }] = [
      { x: 40, y: 40 }, { x: 0, y: 0 },
    ];
    expect(pickedObjects(OBJECTS, 'rect', backwards, [])).toEqual(pickedObjects(OBJECTS, 'rect', SQUARE, []));
  });

  it('объект без точки на плане в выделение не попадает', () => {
    // Он есть в журнале, но на чертеже его нет — выделять нечего.
    const all: readonly [{ x: number; y: number }, { x: number; y: number }] = [
      { x: -1000, y: -1000 }, { x: 1000, y: 1000 },
    ];
    expect(pickedObjects(OBJECTS, 'rect', all, [])).not.toContain('в журнале');
  });

  it('пустая рамка не выделяет ничего', () => {
    expect(pickedObjects(OBJECTS, 'rect', null, [])).toEqual([]);
  });
});

describe('выделение обводкой по сложной траектории', () => {
  it('узкая полоса вдоль стены берёт ряд и не берёт дальний объект', () => {
    // Рамкой то же самое не выделить: она захватила бы весь угол плана.
    const corridor = [
      { x: 0, y: 5 }, { x: 40, y: 5 }, { x: 40, y: 15 }, { x: 0, y: 15 },
    ];
    expect(pickedObjects(OBJECTS, 'lasso', null, corridor)).toEqual(['ОП-1', 'ОП-2', 'ОП-3']);
  });

  it('невыпуклая обводка не берёт то, что в вырезе', () => {
    // Буква «П»: средний объект остаётся снаружи, хотя лежит между двумя
    // выделенными. Ради этого обводка и нужна.
    const shape = [
      { x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 25, y: 20 },
      { x: 25, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 20 }, { x: 0, y: 20 },
    ];
    expect(pickedObjects(OBJECTS, 'lasso', null, shape)).toEqual(['ОП-1', 'ОП-3']);
  });

  it('обводка меньше трёх точек ничего не выделяет', () => {
    // Одиночный щелчок в режиме обводки — не фигура, и выделять по нему нечего.
    expect(pickedObjects(OBJECTS, 'lasso', null, [{ x: 10, y: 10 }, { x: 20, y: 10 }])).toEqual([]);
  });

  it('точка на границе разбирается однозначно, а не через раз', () => {
    const box = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }];
    expect(inPath({ x: 10, y: 10 }, box)).toBe(true);
    expect(inPath({ x: 30, y: 10 }, box)).toBe(false);
  });
});

describe('режим выключен', () => {
  it('без режима не выделяется ничего, чем бы ни водили мышью', () => {
    expect(pickedObjects(OBJECTS, null, SQUARE, [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }])).toEqual([]);
  });
});
