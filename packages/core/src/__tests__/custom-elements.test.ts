/**
 * Конструктор своих видов элементов (движок E4, ТЗ Дополнение 6, часть С100).
 *
 * Проверяется то, что нельзя увидеть в форме: вид без пометки, вид-двойник,
 * список без вариантов. Всё это выглядит нормально в момент заведения и
 * ломается месяцем позже — в журнале, на плане и в отчёте.
 */

import { afterEach, describe, expect, it } from 'vitest';
import type { CustomElementType, CustomField } from '@izh/contracts';
import {
  customElementUsage,
  removeCustomElement,
  buildCustomElement, setCustomElementArchived, upsertCustomElement,
  type CustomElementDraft,
} from '../objects/custom-element-rules.js';
import {
  activeCustomElementTypes, resetCustomElementTypes, setCustomElementTypes,
} from '../objects/custom-element-registry.js';
import { elementByCode, elementTitle, elementsFor } from '../objects/element-lookup.js';

const NOW = '2026-09-01T10:00:00.000Z';
const CODE = 'custom-0001';

function draft(extra: Partial<CustomElementDraft> = {}): CustomElementDraft {
  return {
    typeCode: null,
    title: 'Ящик с песком',
    mark: 'ЯП',
    color: '#b45309',
    iconDataUrl: null,
    placements: ['этаж'],
    fields: [],
    note: null,
    ...extra,
  };
}

function field(extra: Partial<CustomField> = {}): CustomField {
  return { id: 'f1', title: 'Объём', kind: 'число', options: [], unit: 'м³', hint: null, ...extra };
}

function build(input: CustomElementDraft, existing: readonly CustomElementType[] = []) {
  return buildCustomElement({ draft: input, existing, now: NOW, newTypeCode: CODE });
}

afterEach(() => { resetCustomElementTypes(); });

describe('описание вида', () => {
  it('вид собирается и получает переданный код', () => {
    const result = build(draft());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.typeCode).toBe(CODE);
    expect(result.value.title).toBe('Ящик с песком');
    expect(result.value.archivedAt).toBeNull();
  });

  it('без названия вид не заводится', () => {
    const result = build(draft({ title: '   ' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('название');
  });

  it('пометка длиннее пяти знаков на значке не помещается', () => {
    const result = build(draft({ mark: 'ЯЩИКПЕСКА' }));
    expect(result.ok).toBe(false);
  });

  it('без области применения вид не заводится: он не попал бы ни в одну библиотеку', () => {
    const result = build(draft({ placements: [] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('генплан');
  });

  it('название-двойник запрещено: в журнале от вида остаётся только название', () => {
    const first = build(draft());
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = buildCustomElement({
      draft: draft({ title: 'ящик с песком' }),
      existing: [first.value],
      now: NOW,
      newTypeCode: 'custom-0002',
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe('CONFLICT');
  });

  it('правка того же вида двойником не считается', () => {
    const first = build(draft());
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const again = buildCustomElement({
      draft: draft({ typeCode: CODE, mark: 'ПЯ' }),
      existing: [first.value],
      now: '2026-09-02T10:00:00.000Z',
      newTypeCode: 'custom-0002',
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    // Дата заведения переживает правку: вид тот же самый.
    expect(again.value.createdAt).toBe(NOW);
    expect(again.value.updatedAt).toBe('2026-09-02T10:00:00.000Z');
  });
});

describe('поля карточки', () => {
  it('два поля с одним названием запрещены', () => {
    const result = build(draft({
      fields: [field(), field({ id: 'f2' })],
    }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CONFLICT');
  });

  it('список меньше чем с двумя вариантами не заводится', () => {
    const result = build(draft({
      fields: [field({ kind: 'список', title: 'Состояние', options: ['целый'] })],
    }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('вариант');
  });

  it('единица измерения остаётся только у числа', () => {
    const result = build(draft({
      fields: [field({ kind: 'текст', title: 'Примечание', unit: 'кг' })],
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.fields[0]?.unit).toBeNull();
  });
});

describe('список видов', () => {
  it('правка заменяет вид на месте, а не добавляет второй', () => {
    const first = build(draft());
    if (!first.ok) throw new Error('вид не собрался');

    const list = upsertCustomElement([first.value], { ...first.value, title: 'Ящик с песком 0,5 м³' });
    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe('Ящик с песком 0,5 м³');
  });

  it('вывод из обращения не удаляет запись', () => {
    const first = build(draft());
    if (!first.ok) throw new Error('вид не собрался');

    const list = setCustomElementArchived([first.value], CODE, NOW);
    expect(list).toHaveLength(1);
    expect(list[0]?.archivedAt).toBe(NOW);
  });
});

describe('свой вид в остальной программе', () => {
  it('находится по коду и показывается в библиотеке своей области', () => {
    const first = build(draft());
    if (!first.ok) throw new Error('вид не собрался');
    setCustomElementTypes([first.value]);

    expect(elementByCode(CODE)?.title).toBe('Ящик с песком');
    expect(elementTitle(CODE)).toBe('Ящик с песком');
    expect(elementsFor('floor').map((item) => item.typeCode)).toContain(CODE);
    // Область выбрана только «этаж»: на генплане вида быть не должно.
    expect(elementsFor('general').map((item) => item.typeCode)).not.toContain(CODE);
  });

  it('выведенный из обращения пропадает из библиотеки, но остаётся читаемым', () => {
    const first = build(draft());
    if (!first.ok) throw new Error('вид не собрался');
    setCustomElementTypes(setCustomElementArchived([first.value], CODE, NOW));

    expect(activeCustomElementTypes()).toHaveLength(0);
    expect(elementsFor('floor').map((item) => item.typeCode)).not.toContain(CODE);
    // Карточки и журнал по-прежнему знают, что это было.
    expect(elementTitle(CODE)).toBe('Ящик с песком');
  });

  it('встроенные виды на месте, пока свой вид заведён', () => {
    const first = build(draft());
    if (!first.ok) throw new Error('вид не собрался');
    setCustomElementTypes([first.value]);

    expect(elementByCode('extinguisher')?.title).toBe('Огнетушитель');
    expect(elementsFor('floor').map((item) => item.typeCode)).toContain('extinguisher');
  });
});

describe('удаление своего вида', () => {
  /*
   * Заказчик: «при выведении из обращения элемента удаляй его полностью (из
   * истории), не нужно отображать в настройках».
   *
   * Так и сделано, но с оговоркой: вид, по которому есть единицы в работе, из
   * настроек не убрать — сначала их выводят из эксплуатации. А когда единицы
   * все сняты, вид уходит из настроек, но описание его остаётся: после полного
   * удаления в журнале на месте названия было бы «Неизвестный вид (custom-…)»,
   * а журнал предъявляют при проверке.
   */
  const inService = (typeCode: string) => ({ typeCode, archivedAt: null });
  const retired = (typeCode: string) => ({ typeCode, archivedAt: '2026-09-05T20:16:00.000Z' });

  it('вид без единиц удаляется начисто', () => {
    const usage = customElementUsage('custom-1', []);
    expect(usage.removal).toBe('убрать совсем');
    expect(usage.objectCount).toBe(0);

    const rest = removeCustomElement(
      [{ typeCode: 'custom-1' } as never, { typeCode: 'custom-2' } as never],
      'custom-1',
    );
    expect(rest.map((type) => type.typeCode)).toEqual(['custom-2']);
  });

  it('вид с единицами в работе не убрать, и названо их число', () => {
    const usage = customElementUsage('custom-1', [
      inService('custom-1'), inService('custom-1'), inService('extinguisher'),
    ]);
    expect(usage.removal).toBe('сначала снять с эксплуатации');
    expect(usage.activeCount).toBe(2);
    expect(usage.objectCount).toBe(2);
  });

  it('подсказка считает только то, что видно в дереве', () => {
    /*
     * Разбор жалобы: «нельзя удалить ящик с песком, пишет — сначала выведите
     * из эксплуатации, но по дереву его нигде нет». Единица была снята, из
     * дерева пропала, а счётчик её считал — совет вёл в тупик.
     */
    const usage = customElementUsage('custom-1', [inService('custom-1'), retired('custom-1')]);
    expect(usage.removal).toBe('сначала снять с эксплуатации');
    expect(usage.activeCount).toBe(1);
    expect(usage.archivedCount).toBe(1);
  });

  it('когда все единицы сняты, вид убирается из настроек', () => {
    const usage = customElementUsage('custom-1', [retired('custom-1')]);
    expect(usage.removal).toBe('убрать из настроек');
    expect(usage.activeCount).toBe(0);
    expect(usage.archivedCount).toBe(1);
  });

  it('убранный из настроек вид перестаёт предлагаться, но название находится', () => {
    const first = build(draft());
    if (!first.ok) throw new Error('вид не завёлся');
    const hidden = setCustomElementArchived([first.value], first.value.typeCode, NOW);
    setCustomElementTypes(hidden);

    expect(activeCustomElementTypes()).toEqual([]);
    expect(elementByCode(first.value.typeCode)?.title).toBe('Ящик с песком');
  });
});
