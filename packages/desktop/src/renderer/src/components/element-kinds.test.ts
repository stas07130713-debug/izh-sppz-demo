/**
 * Вид оборудования доходит до всех экранов целиком.
 *
 * Вид живёт в семи местах сразу: каталог элементов, семейство, состав системы
 * прибора, пакет правил, обязательные требования НПА, таблица значков и список
 * выбора в карточке. Забыть его в одном из них легко, а последствие тихое: вид
 * либо не выбирается, либо выбирается и остаётся без регламента, без значка
 * или вне системы. Такую ошибку глазами не поймать — она проявляется только у
 * того вида, который забыли, — поэтому проверка сплошная.
 *
 * Появилась после того, как при добавлении видов клапанов, вентиляторов и
 * оповещателей перечень обязательных требований ППР остался прежним: в
 * каталоге вид есть, в регламенте его нет.
 */

import { describe, expect, it } from 'vitest';
import {
  ELEMENT_FAMILIES, SYSTEM_MEMBER_TYPES, activitiesFor, elementByCode,
} from '@izh/core';
import { familyOptionsFor } from './equipment-family-options';
import { ICONS } from './element-icon-source';

const ALL = ELEMENT_FAMILIES.flatMap((family) => [family.parent, ...family.members]);

describe('вид оборудования не теряется', () => {
  it('каждый вид есть в каталоге и назван по-человечески', () => {
    for (const typeCode of ALL) {
      const element = elementByCode(typeCode);
      expect(element, typeCode).not.toBeNull();
      expect(element?.title.length, typeCode).toBeGreaterThan(3);
    }
  });

  it('каждый вид выбирается в карточке своего семейства', () => {
    for (const family of ELEMENT_FAMILIES) {
      const options = familyOptionsFor(family.parent)?.options ?? [];
      const codes = new Set(options.map((option) => option.code));
      expect(codes.has(family.parent), family.parent).toBe(true);
      for (const member of family.members) expect(codes.has(member), member).toBe(true);
    }
  });

  it('у каждого вида есть значок общего вида семейства', () => {
    for (const family of ELEMENT_FAMILIES) {
      for (const member of family.members) {
        expect(ICONS[member], `${family.parent} → ${member}`).toBe(ICONS[family.parent]);
      }
    }
  });

  it('исполнение обслуживается не меньше общего вида', () => {
    for (const family of ELEMENT_FAMILIES) {
      const parent = activitiesFor(family.parent).map((rule) => rule.activityCode);
      for (const member of family.members) {
        const own = activitiesFor(member).map((rule) => rule.activityCode);
        for (const code of parent) expect(own, `${family.parent} → ${member}`).toContain(code);
      }
    }
  });

  it('исполнение входит в систему прибора там же, где общий вид', () => {
    // Иначе заведённый составом клапан оказался бы вне своей системы: без
    // общего чек-листа и без сведений, подставляемых от прибора.
    for (const family of ELEMENT_FAMILIES) {
      if (!SYSTEM_MEMBER_TYPES.includes(family.parent)) continue;
      for (const member of family.members) {
        expect(SYSTEM_MEMBER_TYPES.includes(member), `${family.parent} → ${member}`).toBe(true);
      }
    }
  });

  it('вид не попадает в два семейства сразу', () => {
    const seen = new Set<string>();
    for (const typeCode of ALL) {
      expect(seen.has(typeCode), typeCode).toBe(false);
      seen.add(typeCode);
    }
  });
});
