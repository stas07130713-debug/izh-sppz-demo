/**
 * Порядок и группировка видов в журнале (ТЗ, Дополнение 2, часть П4.1).
 *
 * Заказчик: «почему-то идут по очереди системы, например огнетушитель
 * порошковый, потом СИЗОД, потом ещё что-то, и только потом опять огнетушитель
 * с другим ОТВ; схожие системы должны быть рядом».
 */

import { describe, expect, it } from 'vitest';
import { byCatalogOrder, systemGroupOf } from './journal-groups';

describe('порядок видов в журнале', () => {
  it('родственные виды идут подряд, а не вперемешку', () => {
    const mixed = ['extinguisher-powder', 'self-rescuer', 'extinguisher-co2', 'fire-hydrant-indoor'];
    const sorted = [...mixed].sort(byCatalogOrder);

    const first = sorted.indexOf('extinguisher-powder');
    const second = sorted.indexOf('extinguisher-co2');
    // Между двумя огнетушителями не должно оказаться ничего постороннего.
    expect(Math.abs(first - second)).toBe(1);
  });

  it('огнетушители идут раньше кранов — как в каталоге', () => {
    const sorted = ['fire-hydrant-indoor', 'extinguisher-powder'].sort(byCatalogOrder);
    expect(sorted).toEqual(['extinguisher-powder', 'fire-hydrant-indoor']);
  });

  it('вид, которого нет в каталоге, уходит в конец, а не теряется', () => {
    const sorted = ['небывалый-вид', 'extinguisher-powder'].sort(byCatalogOrder);
    expect(sorted).toEqual(['extinguisher-powder', 'небывалый-вид']);
  });
});

describe('блоки журнала', () => {
  it('подвид попадает туда же, куда общий вид', () => {
    // Дымовой извещатель — такая же автоматика, как «извещатель пожарный».
    expect(systemGroupOf('fire-detector')).toBe('automation');
    expect(systemGroupOf('smoke-detector')).toBe('automation');
    expect(systemGroupOf('sounder-speech')).toBe('automation');
  });

  it('водоисточники и щиты стоят снаружи здания', () => {
    // Заведены отдельными видами позже общего списка и потому попадали
    // в «внутри здания» — рядом с огнетушителями, что неверно.
    expect(systemGroupOf('water-pond')).toBe('outside');
    expect(systemGroupOf('water-tank')).toBe('outside');
    expect(systemGroupOf('fire-board-a')).toBe('outside');
    expect(systemGroupOf('outdoor-cabinet-box')).toBe('outside');
  });

  it('всё прочее считается внутренним', () => {
    expect(systemGroupOf('extinguisher-powder')).toBe('inside');
    expect(systemGroupOf('fire-hydrant-indoor')).toBe('inside');
  });
});
