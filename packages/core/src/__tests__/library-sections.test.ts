/**
 * Разделы библиотеки элементов (Дополнение 6).
 *
 * Порядок и состав разделов задан заказчиком: сначала противопожарные элементы —
 * огнетушитель, пожарный шкаф, противопожарная дверь, самоспасатель, — потом
 * под чертой системы пожарной автоматики, потом отдельно автономное
 * пожаротушение.
 */

import { describe, expect, it } from 'vitest';
import { elementsFor, librarySections } from '../index.js';

describe('разделы библиотеки', () => {
  it('на поэтажном плане три раздела в заданном порядке', () => {
    const sections = librarySections(elementsFor('floor')).map((group) => group.section);

    expect(sections).toEqual([
      'противопожарные элементы', 'системы пожарной автоматики', 'автономное пожаротушение',
    ]);
  });

  it('противопожарные элементы идут в порядке, названном заказчиком', () => {
    const primary = librarySections(elementsFor('floor'))
      .find((group) => group.section === 'противопожарные элементы');

    // Эталон обновлён 24.08.2026: добавлена огнезащитная обработка. Она стоит
    // среди противопожарных элементов по коду системы преград — как и
    // сами преграды, это защита самой конструкции, а не средство тушения.
    expect(primary?.items.map((item) => item.typeCode)).toEqual([
      'extinguisher', 'fire-hydrant-indoor', 'fire-door', 'self-rescuer', 'fireproofing',
    ]);
  });

  it('в разделе автоматики только прибор: остальное заводится его составом', () => {
    const automation = librarySections(elementsFor('floor'))
      .find((group) => group.section === 'системы пожарной автоматики');

    expect(automation?.items.map((item) => item.typeCode)).toEqual(['control-panel']);
  });

  it('автономная установка стоит отдельным разделом', () => {
    // Она не входит ни в одну систему: срабатывает без прибора управления.
    const autonomous = librarySections(elementsFor('floor'))
      .find((group) => group.section === 'автономное пожаротушение');

    expect(autonomous?.items.map((item) => item.typeCode)).toEqual(['autonomous-suppression']);
  });

  it('у разделов, где способ заведения особый, есть пояснение', () => {
    const groups = librarySections(elementsFor('floor'));

    expect(groups.find((g) => g.section === 'системы пожарной автоматики')?.note).not.toBeNull();
    expect(groups.find((g) => g.section === 'автономное пожаротушение')?.note).not.toBeNull();
    // Противопожарным элементам пояснение не нужно: их просто переносят на план.
    expect(groups.find((g) => g.section === 'противопожарные элементы')?.note).toBeNull();
  });

  it('на генплане нет ни систем, ни автономных установок — и заголовков тоже', () => {
    // Заголовок над пустотой только занимал бы место.
    const sections = librarySections(elementsFor('general')).map((group) => group.section);

    expect(sections).toEqual(['противопожарные элементы']);
  });

  it('ни один элемент набора не теряется при раскладке по разделам', () => {
    for (const planKind of ['floor', 'general', 'storage'] as const) {
      const items = elementsFor(planKind);
      const inSections = librarySections(items).flatMap((group) => group.items);
      expect(inSections.length, planKind).toBe(items.length);
    }
  });
});
