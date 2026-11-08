/**
 * Оглавление журнала: разделы, порядок и листы.
 *
 * Заказчик (пункт 8 перечня доработок): «оглавление в виде таблицы, куда
 * подтягиваются разделы согласно составу выгружаемого журнала… разделы — по
 * нашему принципу: снаружи здания, внутри здания, автоматика, и в их составе
 * уже отдельные элементы и номера страниц, где они размещены».
 */

import { describe, expect, it } from 'vitest';
import { buildContents, pagesOf } from './document-contents';

describe('содержание журнала', () => {
  it('разделы — по нашему делению и в порядке библиотеки', () => {
    const sections = buildContents([
      { title: 'Огнетушители', rows: 3, typeCode: 'extinguisher-powder' },
      { title: 'Гидранты', rows: 2, typeCode: 'hydrant' },
      { title: 'Извещатели', rows: 5, typeCode: 'smoke-detector' },
    ]);

    expect(sections.map((section) => section.title)).toEqual([
      'Системы пожарной автоматики',
      'Первичные средства и оборудование внутри здания',
      'Оборудование снаружи здания',
    ]);
    expect(sections.map((section) => section.numeral)).toEqual(['I', 'II', 'III']);
  });

  it('внутри раздела — виды оборудования с числом записей', () => {
    const [section] = buildContents([
      { title: 'Огнетушители', rows: 7, typeCode: 'extinguisher-powder' },
      { title: 'Пожарные краны', rows: 2, typeCode: 'fire-hydrant-indoor' },
    ]);

    expect(section?.items.map((item) => item.title)).toEqual(['Огнетушители', 'Пожарные краны']);
    expect(section?.items.map((item) => item.rows)).toEqual([7, 2]);
  });

  it('первый раздел — третий лист: титул и содержание заняли два', () => {
    const [section] = buildContents([{ title: 'Огнетушители', rows: 1, typeCode: 'extinguisher-powder' }]);
    expect(section?.page).toBe(3);
  });

  it('листы не идут назад', () => {
    const sections = buildContents([
      { title: 'Огнетушители', rows: 40, typeCode: 'extinguisher-powder' },
      { title: 'Пожарные краны', rows: 5, typeCode: 'fire-hydrant-indoor' },
      { title: 'Гидранты', rows: 1, typeCode: 'hydrant' },
    ]);

    const pages = sections.flatMap((section) => section.items.map((item) => item.page));
    expect([...pages].sort((a, b) => a - b)).toEqual(pages);
    // Большой раздел занимает не один лист: следующий начинается дальше.
    expect(pages[1]).toBeGreaterThan(pages[0] ?? 0);
  });

  it('вид не из каталога попадает в «прочее», а не выдумывает себе место', () => {
    const sections = buildContents([
      { title: 'Свой вид', rows: 2, typeCode: 'custom-нечто' },
      { title: 'Огнетушители', rows: 1, typeCode: 'extinguisher-powder' },
    ]);

    const titles = sections.map((section) => section.title);
    expect(titles).toContain('Прочее оборудование');
    // «Прочее» — последним: это не раздел журнала, а то, что в него не легло.
    expect(titles[titles.length - 1]).toBe('Прочее оборудование');
  });

  it('лист вмещает не одну строку', () => {
    // Число строк на листе — правило, а не оценка: документ сам режет таблицу
    // по нему, и обещанный лист совпадает с настоящим.
    expect(pagesOf(1)).toBe(1);
    expect(pagesOf(14)).toBe(1);
    expect(pagesOf(15)).toBe(2);
  });
});
