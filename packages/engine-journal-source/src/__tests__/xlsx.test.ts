/**
 * Эталонные тесты чтения xlsx.
 *
 * Книга собирается прямо здесь: zip с нужными частями, сжатый эталонным zlib.
 * Так тест не зависит от внешнего файла и проверяет именно разбор — включая
 * общую таблицу строк, пропущенные ячейки и заголовок не в первой строке, то
 * есть всё то, что встречается в журнале заказчика.
 */

import { describe, expect, it } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { journalSourceEngine } from '../index.js';

const encoder = new TextEncoder();

interface FileToPack {
  readonly name: string;
  readonly content: string;
}

/** Собирает минимальный zip из локальных заголовков — их и читает движок. */
function makeZip(files: readonly FileToPack[]): Uint8Array {
  const chunks: Uint8Array[] = [];

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const contentBytes = encoder.encode(file.content);
    const compressed = new Uint8Array(deflateRawSync(Buffer.from(contentBytes), { level: 6 }));

    const header = new Uint8Array(30);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true); // версия
    view.setUint16(6, 0, true); // флаги
    view.setUint16(8, 8, true); // метод: deflate
    view.setUint32(14, 0, true); // crc32 — движок его не проверяет
    view.setUint32(18, compressed.length, true);
    view.setUint32(22, contentBytes.length, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true); // extra

    chunks.push(header, nameBytes, compressed);
  }

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const zip = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    zip.set(chunk, offset);
    offset += chunk.length;
  }
  return zip;
}

/** Книга, повторяющая устройство журнала заказчика: заголовок в третьей строке. */
function makeJournalWorkbook(): Uint8Array {
  return makeZip([
    {
      name: 'xl/workbook.xml',
      content:
        '<?xml version="1.0"?><workbook xmlns:r="x"><sheets>' +
        '<sheet name="Огнетушители" sheetId="1" r:id="rId1"/>' +
        '<sheet name="СИЗ" sheetId="2" r:id="rId2"/>' +
        '</sheets></workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content:
        '<?xml version="1.0"?><Relationships>' +
        '<Relationship Id="rId1" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Target="worksheets/sheet2.xml"/>' +
        '</Relationships>',
    },
    {
      name: 'xl/sharedStrings.xml',
      content:
        '<?xml version="1.0"?><sst>' +
        '<si><t>Учет наличия огнетушителей</t></si>' +
        '<si><t>№ п/п</t></si>' +
        '<si><t>Номер огнетушителя</t></si>' +
        '<si><t>Тип и марка огнетушителя</t></si>' +
        '<si><t>28-27</t></si>' +
        '<si><t>ОП-8</t></si>' +
        '<si><r><t>ОВЭ-5 </t></r><r><t>(Бонтел)</t></r></si>' +
        '</sst>',
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      content:
        '<?xml version="1.0"?><worksheet><sheetData>' +
        '<row r="1"><c r="A1" t="s"><v>0</v></c></row>' +
        '<row r="3"><c r="A3" t="s"><v>1</v></c><c r="B3" t="s"><v>2</v></c><c r="C3" t="s"><v>3</v></c></row>' +
        '<row r="4"><c r="A4"><v>1</v></c><c r="B4" t="s"><v>4</v></c><c r="C4" t="s"><v>5</v></c></row>' +
        // Пропущенная колонка B: проверяет, что номера не съезжают.
        '<row r="5"><c r="A5"><v>2</v></c><c r="C5" t="s"><v>6</v></c></row>' +
        '</sheetData></worksheet>',
    },
    {
      name: 'xl/worksheets/sheet2.xml',
      content: '<?xml version="1.0"?><worksheet><sheetData><row r="1"><c r="A1"><v>42</v></c></row></sheetData></worksheet>',
    },
  ]);
}

describe('движок E7: чтение xlsx', () => {
  const workbook = makeJournalWorkbook();

  it('узнаёт xlsx по содержимому, а не по расширению', () => {
    expect(journalSourceEngine.detectKind(workbook)).toBe('xlsx');
    expect(journalSourceEngine.detectKind(encoder.encode('это просто текст'))).toBeNull();
  });

  it('читает оглавление книги', () => {
    const probed = journalSourceEngine.probeWorkbook(workbook);
    expect(probed.ok).toBe(true);
    if (!probed.ok) return;
    expect(probed.value.sheetNames).toEqual(['Огнетушители', 'СИЗ']);
  });

  it('читает лист, сохраняя номера строк и колонок', () => {
    const sheet = journalSourceEngine.readSheet(workbook, 'Огнетушители');
    expect(sheet.ok).toBe(true);
    if (!sheet.ok) return;

    // Строка 2 пуста в файле — в массиве она тоже есть, чтобы номера совпадали.
    expect(sheet.value.rows[0]?.[0]).toBe('Учет наличия огнетушителей');
    expect(sheet.value.rows[1]).toEqual([]);
    expect(sheet.value.rows[2]).toEqual(['№ п/п', 'Номер огнетушителя', 'Тип и марка огнетушителя']);
    expect(sheet.value.rows[3]).toEqual(['1', '28-27', 'ОП-8']);
  });

  it('пропущенная ячейка не сдвигает остальные', () => {
    const sheet = journalSourceEngine.readSheet(workbook, 'Огнетушители');
    if (!sheet.ok) return;
    // В строке 5 колонка B пуста, значение должно остаться в колонке C.
    expect(sheet.value.rows[4]).toEqual(['2', '', 'ОВЭ-5 (Бонтел)']);
  });

  it('склеивает текст из нескольких фрагментов одной ячейки', () => {
    const sheet = journalSourceEngine.readSheet(workbook, 'Огнетушители');
    if (!sheet.ok) return;
    // В журнале заказчика так разбит текст на листе огнезащитной обработки.
    expect(sheet.value.rows[4]?.[2]).toBe('ОВЭ-5 (Бонтел)');
  });

  it('несуществующий лист даёт ошибку значением, а не исключением', () => {
    const sheet = journalSourceEngine.readSheet(workbook, 'Нет такого листа');
    expect(sheet.ok).toBe(false);
    if (sheet.ok) return;
    expect(sheet.error.message).toContain('Нет такого листа');
  });

  it('битый файл даёт ошибку значением', () => {
    const broken = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
    const probed = journalSourceEngine.probeWorkbook(broken);
    // Либо ошибка, либо пустой список листов — но не падение программы.
    expect(probed.ok ? probed.value.sheetNames.length : 0).toBe(0);
  });
});
