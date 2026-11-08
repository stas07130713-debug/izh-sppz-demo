/**
 * Части книги Excel: разметка должна быть целой.
 *
 * Формат мы пишем руками, а Excel на любую ошибку отвечает одинаково — «файл
 * повреждён», не называя места. Поэтому здесь проверяется то, что проверить
 * можно: все обязательные части на месте, каждая — законченный XML, а порядок
 * элементов в `styles.xml` тот, которого требует схема (перепутанный порядок
 * Excel тоже считает повреждением).
 */

import { describe, expect, it } from 'vitest';
import type { JournalExportSheet } from '@izh/contracts';
import { createXlsx } from './xlsx-writer';

const decoder = new TextDecoder();

/**
 * Части архива без распаковки.
 *
 * Мы пишем zip без сжатия, поэтому содержимое лежит сразу за заголовком: этого
 * достаточно, чтобы прочитать части и не тянуть распаковщик в тесты.
 */
function parts(bytes: Uint8Array): ReadonlyMap<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const found = new Map<string, string>();
  let offset = 0;

  while (offset + 30 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;

    found.set(
      decoder.decode(bytes.slice(nameStart, nameStart + nameLength)),
      decoder.decode(bytes.slice(dataStart, dataStart + size)),
    );
    offset = dataStart + size;
  }
  return found;
}

/** Все ли теги закрыты и закрыты ли в том порядке, в каком открыты. */
function unbalancedTag(xml: string): string | null {
  const stack: string[] = [];
  const tag = /<(\/?)([A-Za-z_:][\w.:-]*)([^>]*?)(\/?)>/g;

  for (const match of xml.matchAll(tag)) {
    const [, closing, name, attributes, selfClosing] = match;
    if (name === undefined) continue;
    if (attributes?.startsWith('?') === true || name.startsWith('?')) continue;
    if (selfClosing === '/') continue;

    if (closing === '/') {
      if (stack.pop() !== name) return name;
    } else {
      stack.push(name);
    }
  }
  return stack.length === 0 ? null : (stack[stack.length - 1] ?? null);
}

const SHEET: JournalExportSheet = {
  name: 'Огнетушители',
  rows: [['Журнал СППЗ'], ['Огнетушители'], ['№', 'Наименование'], ['1', 'ОП-5 «Ярпожинвест»']],
  rowKinds: ['заголовок', 'заголовок', 'шапка'],
  columnWidths: [9, 32],
  frozenRows: 3,
};

describe('части книги Excel', () => {
  const files = parts(createXlsx([SHEET]));

  it('содержит все обязательные части', () => {
    expect([...files.keys()]).toEqual(expect.arrayContaining([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
    ]));
  });

  it('каждая часть — законченный XML', () => {
    for (const [name, text] of files) {
      expect(`${name}: ${unbalancedTag(text) ?? 'цел'}`).toBe(`${name}: цел`);
    }
  });

  it('оформление идёт в порядке, которого требует схема', () => {
    const styles = files.get('xl/styles.xml') ?? '';
    const order = ['<fonts', '<fills', '<borders', '<cellStyleXfs', '<cellXfs', '<cellStyles']
      .map((element) => styles.indexOf(element));

    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('шапка таблицы ссылается на жирный набор оформления', () => {
    const sheet = files.get('xl/worksheets/sheet1.xml') ?? '';
    // Третья строка — шапка: набор 2, жирный с заливкой и рамкой.
    expect(sheet).toContain('<c r="A3" s="2"');
    // Данные — набор 3: рамка и перенос по словам.
    expect(sheet).toContain('<c r="A4" s="3"');
  });

  it('ширины колонок и закрепление шапки попадают в лист', () => {
    const sheet = files.get('xl/worksheets/sheet1.xml') ?? '';
    expect(sheet).toContain('<col min="2" max="2" width="32"');
    expect(sheet).toContain('ySplit="3"');
  });

  it('кавычки в значениях не рвут разметку', () => {
    const sheet = files.get('xl/worksheets/sheet1.xml') ?? '';
    expect(sheet).toContain('ОП-5 «Ярпожинвест»');
    expect(unbalancedTag(sheet)).toBeNull();
  });
});
