/**
 * Справочник наружной пожарной лестницы (ГОСТ Р 53254-2009).
 *
 * Тип определяет объём испытаний: у вертикальной проверяют ступени и крепление
 * к стене, у маршевой — ещё марши, площадки и перила. Подтип привязан к типу, и
 * подтип маршевой у вертикальной лестницы — ошибка, а не описка.
 */

import { describe, expect, it } from 'vitest';
import { LADDER_TYPES, ladderSubtypesFor } from '../objects/ladder-reference.js';

describe('типы и подтипы лестницы', () => {
  it('два типа: вертикальная П1 и маршевая П2', () => {
    expect(LADDER_TYPES).toEqual(['П1 — вертикальная', 'П2 — маршевая']);
  });

  it('у вертикальной два подтипа — по наличию ограждения', () => {
    // С высоты 6 м ограждение обязательно, и подтип это и означает.
    const subtypes = ladderSubtypesFor('П1 — вертикальная');
    expect(subtypes).toHaveLength(2);
    expect(subtypes.some((item) => item.includes('без ограждения'))).toBe(true);
    expect(subtypes.some((item) => item.includes('с ограждением'))).toBe(true);
  });

  it('подтипы одного типа не предлагаются другому', () => {
    const vertical = ladderSubtypesFor('П1 — вертикальная');
    const march = ladderSubtypesFor('П2 — маршевая');
    expect(vertical.some((item) => march.includes(item))).toBe(false);
  });

  it('без выбранного типа подтипов нет', () => {
    expect(ladderSubtypesFor(null)).toEqual([]);
    expect(ladderSubtypesFor('что-то своё')).toEqual([]);
  });

  it('у каждого типа есть хотя бы один подтип', () => {
    for (const type of LADDER_TYPES) {
      expect(ladderSubtypesFor(type).length, type).toBeGreaterThan(0);
    }
  });
});
