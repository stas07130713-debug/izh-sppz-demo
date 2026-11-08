/**
 * Вид системы против подвида (ТЗ, часть С104).
 *
 * Заказчик: «заявка должна формироваться по виду системы, а не по подразделам —
 * целая заявка на огнетушители, а не отдельно на порошковые и углекислотные».
 */

import { describe, expect, it } from 'vitest';
import { countBySystemKind, systemKindOf, systemKindTitle } from '../objects/system-kind.js';
import { elementByCode } from '../objects/element-lookup.js';

describe('подвид сводится к виду', () => {
  it('огнетушители всех зарядов — один вид', () => {
    expect(systemKindOf('extinguisher-powder')).toBe('extinguisher');
    expect(systemKindOf('extinguisher-co2')).toBe('extinguisher');
    expect(systemKindOf('extinguisher')).toBe('extinguisher');
    expect(systemKindTitle('extinguisher-co2')).toBe('Огнетушитель');
  });

  it('извещатели и оповещатели тоже', () => {
    expect(systemKindOf('smoke-detector')).toBe('fire-detector');
    expect(systemKindOf('heat-detector')).toBe('fire-detector');
    expect(systemKindOf('sounder-light')).toBe('sounder');
  });

  it('установки пожаротушения сводятся к виду каталога, а не к названию семейства', () => {
    // Семейство зовётся «fire-suppression», а вид в каталоге —
    // «fire-suppression-system»: по коду вида берутся значок и название.
    expect(systemKindOf('sprinkler')).toBe('fire-suppression-system');
    expect(elementByCode(systemKindOf('sprinkler'))).not.toBeNull();
  });

  it('оборудование без семейства остаётся собой', () => {
    expect(systemKindOf('fire-hydrant-indoor')).toBe('fire-hydrant-indoor');
    expect(systemKindOf('hydrant')).toBe('hydrant');
  });

  it('любой вид сводится к коду, который есть в каталоге', () => {
    // Иначе заявка получила бы раздел без значка и без названия.
    for (const code of ['extinguisher-halon', 'gas-detector', 'damper-dual', 'fan-supply', 'aup-foam']) {
      expect(elementByCode(systemKindOf(code)), code).not.toBeNull();
    }
  });
});

describe('счёт по видам', () => {
  it('подвиды складываются в один вид', () => {
    const counts = countBySystemKind([
      'extinguisher-powder', 'extinguisher-powder', 'extinguisher-co2', 'fire-hydrant-indoor',
    ]);
    expect(counts.get('extinguisher')).toBe(3);
    expect(counts.get('fire-hydrant-indoor')).toBe(1);
    expect(counts.size).toBe(2);
  });
});
