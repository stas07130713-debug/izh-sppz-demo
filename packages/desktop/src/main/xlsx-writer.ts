/**
 * XLSX без сжатия: несколько вкладок, значения строками, оформление — набором
 * из `xlsx-styles.ts`.
 *
 * Своя запись, а не библиотека: формат нужен ровно в одном месте и ровно на
 * одну задачу — выгрузить журнал так, чтобы его открыли и прочитали. Тянуть
 * ради этого стороннюю сборку с половиной OOXML внутри незачем.
 */

import { STYLES_XML, STYLE_INDEX } from './xlsx-styles.js';
import type { JournalExportSheet } from '@izh/contracts';

const encoder = new TextEncoder();

function xml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function columnName(index: number): string {
  let value = index + 1;
  let name = '';
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

/**
 * Имя вкладки, которое Excel примет.
 *
 * Ограничения не наши: 31 знак, и ни одного из `: \ / ? * [ ]`. Файл с
 * недопустимым именем Excel объявляет повреждённым и не открывает вовсе.
 */
function sheetName(name: string, taken: ReadonlySet<string>): string {
  const clean = name.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Лист';
  if (!taken.has(clean)) return clean;

  for (let index = 2; index < 100; index += 1) {
    const suffix = ` (${index})`;
    const candidate = clean.slice(0, 31 - suffix.length) + suffix;
    if (!taken.has(candidate)) return candidate;
  }
  return clean.slice(0, 28) + '...';
}

function colsXml(widths: readonly number[]): string {
  if (widths.length === 0) return '';
  const cols = widths
    .map((width, index) => {
      // Ширина в знаках; узкие колонки нечитаемы, широкие расползаются на весь
      // экран, и текст в них всё равно переносится.
      const value = Math.min(70, Math.max(8, Math.round(width * 10) / 10));
      return `<col min="${index + 1}" max="${index + 1}" width="${value}" customWidth="1"/>`;
    })
    .join('');
  return `<cols>${cols}</cols>`;
}

function freezeXml(frozenRows: number): string {
  if (frozenRows <= 0) return '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  return '<sheetViews><sheetView workbookViewId="0">'
    + `<pane ySplit="${frozenRows}" topLeftCell="A${frozenRows + 1}" activePane="bottomLeft" state="frozen"/>`
    + '</sheetView></sheetViews>';
}

function sheetXml(sheet: JournalExportSheet): string {
  const body = sheet.rows
    .map((row, rowIndex) => {
      const kind = sheet.rowKinds[rowIndex] ?? 'данные';
      const style = STYLE_INDEX[kind];
      const cells = row
        .map((value, columnIndex) => {
          const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
          // Пустая ячейка всё равно пишется: без неё рамка таблицы рвётся.
          return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + freezeXml(sheet.frozenRows)
    // Высоту строк не задаём: без явной высоты Excel подгоняет её сам под
    // перенесённый текст — ровно то, что нужно.
    + '<sheetFormatPr defaultRowHeight="14.5"/>'
    + colsXml(sheet.columnWidths)
    + `<sheetData>${body}</sheetData>`
    + '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>'
    + '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>'
    + '</worksheet>';
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0);
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function localHeader(name: Uint8Array, data: Uint8Array, crc: number): Uint8Array {
  const header = new Uint8Array(30);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, data.length, true);
  view.setUint32(22, data.length, true);
  view.setUint16(26, name.length, true);
  return concat([header, name, data]);
}

function centralHeader(name: Uint8Array, data: Uint8Array, crc: number, offset: number): Uint8Array {
  const header = new Uint8Array(46);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, data.length, true);
  view.setUint32(24, data.length, true);
  view.setUint16(28, name.length, true);
  view.setUint32(42, offset, true);
  return concat([header, name]);
}

function zip(files: readonly { readonly name: string; readonly text: string }[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.text);
    const crc = crc32(data);
    const local = localHeader(name, data, crc);
    locals.push(local);
    centrals.push(centralHeader(name, data, crc, offset));
    offset += local.length;
  }
  const central = concat(centrals);
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, files.length, true);
  view.setUint16(10, files.length, true);
  view.setUint32(12, central.length, true);
  view.setUint32(16, offset, true);
  return concat([...locals, central, end]);
}

export function createXlsx(sheets: readonly JournalExportSheet[]): Uint8Array {
  // Книга без единой вкладки не открывается: пустая всё же должна открыться и
  // показать, что данных нет.
  const source = sheets.length === 0
    ? [{ name: 'Журнал СППЗ', rows: [['Нет данных']], rowKinds: ['заголовок' as const], columnWidths: [24], frozenRows: 0 }]
    : sheets;

  const taken = new Set<string>();
  const named = source.map((sheet) => {
    const name = sheetName(sheet.name, taken);
    taken.add(name);
    return { sheet, name };
  });

  const contentTypes = '<?xml version="1.0" encoding="UTF-8"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + named
      .map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml"`
        + ' ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>')
      .join('')
    + '</Types>';

  const workbook = '<?xml version="1.0" encoding="UTF-8"?>'
    + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
    + named
      .map(({ name }, index) => `<sheet name="${xml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
      .join('')
    + '</sheets></workbook>';

  const workbookRels = '<?xml version="1.0" encoding="UTF-8"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + named
      .map((_, index) => `<Relationship Id="rId${index + 1}"`
        + ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"'
        + ` Target="worksheets/sheet${index + 1}.xml"/>`)
      .join('')
    // Оформление идёт следом за вкладками: своих номеров у связей нет, важно
    // лишь чтобы они не совпали.
    + `<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
    + '</Relationships>';

  return zip([
    { name: '[Content_Types].xml', text: contentTypes },
    {
      name: '_rels/.rels',
      text: '<?xml version="1.0" encoding="UTF-8"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        + '</Relationships>',
    },
    { name: 'xl/workbook.xml', text: workbook },
    { name: 'xl/_rels/workbook.xml.rels', text: workbookRels },
    { name: 'xl/styles.xml', text: STYLES_XML },
    ...named.map(({ sheet }, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      text: sheetXml(sheet),
    })),
  ]);
}
