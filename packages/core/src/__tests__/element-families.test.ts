/**
 * Семейства оборудования в конструкторе регламентов.
 *
 * Общий вид — заголовок, исполнения под ним. Настраивается исполнение: у
 * водного огнетушителя перезарядка раз в год, у порошкового раз в пять лет, и
 * назначить срок общему виду нельзя.
 *
 * Состав семейств задан списком, а не выведен из кода системы. Здесь это
 * закреплено проверкой: угаданное правило отнесло бы оборудование не туда, и
 * человек настроил бы сроки не тому.
 */

import { describe, expect, it } from 'vitest';
import { ELEMENT_CATALOG, ELEMENT_FAMILIES, activitiesFor, elementByCode, familyOf, isFamilyMember, isFamilyParent } from '../index.js';
import { configurableFamily } from '../objects/element-catalog.js';

describe('состав семейств', () => {
  it('десять семейств: у каждого вида с исполнениями своё', () => {
    // Эталон обновлён 24.08.2026. Раньше семейств было пять, а пять видов
    // оборудования лежали в каталоге одной строкой, хотя внутри них разные
    // изделия: клапан огнезадерживающий и дымовой работают в разные стороны,
    // вентилятор дымоудаления и подпора — тоже, фильтрующий самоспасатель в
    // дыму без кислорода бесполезен, а щиты ЩП-А и ЩП-Е комплектуются
    // по-разному. Одной строкой их в журнале не различить.
    expect(ELEMENT_FAMILIES.map((family) => family.parent)).toEqual([
      'extinguisher', 'fire-detector', 'sounder', 'fire-suppression-system', 'autonomous-suppression',
      'smoke-valve', 'smoke-fan', 'self-rescuer', 'water-reservoir', 'outdoor-cabinet',
    ]);
  });

  it('все виды семейств есть в каталоге элементов', () => {
    const known = new Set(ELEMENT_CATALOG.map((item) => item.typeCode));
    for (const family of ELEMENT_FAMILIES) {
      expect(known.has(family.parent), family.parent).toBe(true);
      for (const member of family.members) expect(known.has(member), member).toBe(true);
    }
  });

  it('вид не может быть и заголовком, и исполнением', () => {
    for (const item of ELEMENT_CATALOG) {
      expect(isFamilyParent(item.typeCode) && isFamilyMember(item.typeCode), item.typeCode).toBe(false);
    }
  });

  it('исполнение не попадает в два семейства сразу', () => {
    const seen = new Set<string>();
    for (const family of ELEMENT_FAMILIES) {
      for (const member of family.members) {
        expect(seen.has(member), member).toBe(false);
        seen.add(member);
      }
    }
  });

  it('по любому виду семейства находится его семейство', () => {
    expect(familyOf('extinguisher-powder')?.parent).toBe('extinguisher');
    expect(familyOf('smoke-detector')?.parent).toBe('fire-detector');
    expect(familyOf('gas-module')?.parent).toBe('fire-suppression-system');
    expect(familyOf('hydrant')).toBeNull();
  });
});

describe('вид уточняется внутри своего семейства', () => {
  it('у каждого исполнения есть настраиваемое семейство', () => {
    // Без этого правка карточки откажется менять вид: смена типа разрешена
    // только внутри одной семьи, и вид вне семьи оказался бы неизменяемым.
    for (const family of ELEMENT_FAMILIES) {
      expect(configurableFamily(family.parent), family.parent).not.toBeNull();
      for (const member of family.members) {
        expect(configurableFamily(member), member).toBe(configurableFamily(family.parent));
      }
    }
  });
});

describe('почему семейства заданы списком', () => {
  it('по коду системы вывести их нельзя: покрывало имеет код огнетушителей', () => {
    // «01» у огнетушителя и у покрывала для изоляции очага. Правило «один код —
    // одно семейство» сделало бы покрывало огнетушителем.
    // Огнетушитель и пожарный кран — соседи по разделу, но не одно семейство:
    // вид огнетушителя выбирается в его карточке, а кран им стать не может.
    expect(isFamilyMember('fire-hydrant-indoor')).toBe(false);
  });

  it('и наоборот: модули имеют коды, отличные от своей установки', () => {
    // Порошковый и газовый модули относятся к установке пожаротушения, но коды
    // у них «08» и «07», а у неё «06».
    expect(elementByCode('powder-module')?.systemCode).not.toBe(elementByCode('fire-suppression-system')?.systemCode);
    expect(familyOf('powder-module')?.parent).toBe('fire-suppression-system');
  });
});

describe('исполнения настраиваются, заголовки — нет', () => {
  it('исполнение обслуживается не меньше, чем общий вид', () => {
    // Эталон обновлён 24.08.2026. Раньше требовалось, чтобы работы были у
    // каждого исполнения, но у пожарных щитов их нет и у общего вида: ППР
    // задаёт комплектацию щита, а периодичность осмотра назначает организация,
    // и подставить сюда число значило бы выдумать норматив. Настоящее правило
    // другое: уточнение вида не может лишить оборудование обслуживания.
    for (const family of ELEMENT_FAMILIES) {
      const parent = activitiesFor(family.parent).map((rule) => rule.activityCode);
      for (const member of family.members) {
        const own = activitiesFor(member).map((rule) => rule.activityCode);
        for (const code of parent) expect(own, `${family.parent} → ${member}`).toContain(code);
      }
    }
  });

  it('у огнетушителей исполнения различаются сроком перезарядки', () => {
    // Ради этого семейства и заведены: одним сроком их не покрыть.
    const rechargeMonths = (typeCode: string): number | null =>
      activitiesFor(typeCode).find((rule) => rule.activityCode === 'perezaryadka')?.periodicityMonths ?? null;

    expect(rechargeMonths('extinguisher-water')).toBe(12);
    expect(rechargeMonths('extinguisher-powder')).toBe(60);
    expect(rechargeMonths('extinguisher-bantl')).toBe(120);
  });
});
