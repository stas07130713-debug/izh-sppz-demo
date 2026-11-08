/**
 * Согласованность значков внутри семейств оборудования.
 *
 * Появился после ошибки: подвиды модульной установки по виду ОТВ не были
 * заведены в таблице значков и проваливались в запасную отрисовку — цветной
 * квадрат с буквами вместо общего знака. Уточнение вида в карточке меняло
 * обозначение на плане, и схему приходилось читать заново.
 *
 * Такую ошибку глазами не поймать: она проявляется только у того подвида,
 * который забыли, — поэтому проверка сплошная.
 */

import { describe, expect, it } from 'vitest';
import { ELEMENT_CATALOG, ELEMENT_FAMILIES } from '@izh/core';
import { ICONS } from './element-icon-source';

describe('значки семейств', () => {
  it('у каждого штатного вида есть графический значок', () => {
    for (const element of ELEMENT_CATALOG) {
      expect(ICONS[element.typeCode], element.typeCode).toBeDefined();
    }
  });

  it('у подвида тот же значок, что у общего вида', () => {
    for (const family of ELEMENT_FAMILIES) {
      const parent = ICONS[family.parent];
      for (const member of family.members) {
        expect(ICONS[member], `${family.parent} → ${member}`).toBe(parent);
      }
    }
  });

  it('у каждого вида семейства значок вообще есть', () => {
    // Без значка вид рисуется цветным квадратом с буквами — он и выделяется
    // среди соседей, и означает, что про вид просто забыли.
    for (const family of ELEMENT_FAMILIES) {
      expect(ICONS[family.parent], family.parent).toBeDefined();
      for (const member of family.members) {
        expect(ICONS[member], member).toBeDefined();
      }
    }
  });

  it('условное обозначение остаётся своим у каждого подвида', () => {
    // Единым должен быть только значок. Обозначение («ОП», «ОУ», «ОВ») —
    // не украшение: из него складывается префикс учётного номера при создании
    // партии, и сведя их к одному, мы сломали бы нумерацию.
    const markOf = (typeCode: string): string | undefined =>
      ELEMENT_CATALOG.find((item) => item.typeCode === typeCode)?.mark;

    expect(markOf('extinguisher-powder')).not.toBe(markOf('extinguisher-co2'));
  });
});
