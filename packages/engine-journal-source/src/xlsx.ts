/**
 * Разбор xlsx: листы и значения ячеек текстом.
 *
 * Значения отдаются как есть, без превращения в даты и числа: в Excel дата
 * лежит числом, и решать, дата это или испорченный ввод, — работа ядра, где
 * для этого есть проверки и отчёт пользователю. Движок только достаёт текст.
 */

import { readZipEntries, zipEntryNames, zipEntryText } from './zip.js';

/**
 * Что из книги вообще нужно.
 *
 * Всё остальное — картинки, шрифты, темы, оформление, настройки печати — в
 * переносе журнала не участвует, и распаковывать это незачем: в чужой книге
 * лишнего бывает на десятки мегабайт.
 */
function isNeededPart(name: string): boolean {
  return name === 'xl/workbook.xml'
    || name === 'xl/_rels/workbook.xml.rels'
    || name === 'xl/sharedStrings.xml'
    || (name.startsWith('xl/worksheets/') && name.endsWith('.xml'));
}

function decodeXmlText(raw: string): string {
  return raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Общая таблица строк: текст ячеек хранится отдельно, в листе лежат номера. */
function readSharedStrings(entries: readonly { name: string; data: Uint8Array }[]): readonly string[] {
  const xml = zipEntryText(entries, 'xl/sharedStrings.xml');
  if (xml === null) return [];

  const items: string[] = [];
  for (const match of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    const inner = match[1] ?? '';
    // Внутри одной строки может быть несколько фрагментов с разным оформлением
    // — в журнале заказчика так разбит текст в ячейках листа огнезащиты.
    const parts = [...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1] ?? '');
    items.push(decodeXmlText(parts.join('')));
  }
  return items;
}

interface SheetRef {
  readonly name: string;
  readonly file: string;
}

interface ParsedWorkbook {
  readonly entries: readonly { name: string; data: Uint8Array }[];
  readonly sheets: readonly SheetRef[];
  readonly shared: readonly string[];
}

// Один загруженный Uint8Array разбирается один раз. Раньше ZIP целиком
// распаковывался заново для каждого листа, поэтому чужая книга с десятками
// листов могла на несколько секунд «заморозить» окно.
const workbookCache = new WeakMap<Uint8Array, ParsedWorkbook>();

function parseWorkbook(bytes: Uint8Array): ParsedWorkbook {
  const cached = workbookCache.get(bytes);
  if (cached !== undefined) return cached;
  const entries = readZipEntries(bytes, isNeededPart);
  const parsed = { entries, sheets: readSheetIndex(entries), shared: readSharedStrings(entries) };
  workbookCache.set(bytes, parsed);
  return parsed;
}

function readSheetIndex(entries: readonly { name: string; data: Uint8Array }[]): readonly SheetRef[] {
  const workbook = zipEntryText(entries, 'xl/workbook.xml') ?? '';
  const rels = zipEntryText(entries, 'xl/_rels/workbook.xml.rels') ?? '';

  const targets = new Map<string, string>();
  for (const match of rels.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g)) {
    targets.set(match[1] ?? '', (match[2] ?? '').replace(/^\/?xl\//, ''));
  }

  const sheets: SheetRef[] = [];
  for (const match of workbook.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g)) {
    const target = targets.get(match[2] ?? '');
    if (target === undefined) continue;
    sheets.push({ name: decodeXmlText(match[1] ?? ''), file: `xl/${target}` });
  }
  return sheets;
}

/** Буква колонки в номер: A → 0, B → 1, AA → 26. */
function columnIndex(reference: string): number {
  const letters = /^([A-Z]+)/.exec(reference)?.[1] ?? 'A';
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

export function xlsxSheetNames(bytes: Uint8Array): readonly string[] {
  return parseWorkbook(bytes).sheets.map((sheet) => sheet.name);
}

/**
 * Строки листа.
 *
 * Пропуски заполняются пустыми строками, чтобы номер ячейки в массиве совпадал
 * с колонкой в Excel: иначе сопоставление заголовков разъехалось бы на листах,
 * где часть ячеек пуста — а в журнале заказчика таких листов большинство.
 */
export function xlsxSheetRows(bytes: Uint8Array, sheetName: string): readonly (readonly string[])[] {
  const parsed = parseWorkbook(bytes);
  const sheet = parsed.sheets.find((item) => item.name === sheetName);
  if (sheet === undefined) throw new Error(`Лист «${sheetName}» не найден`);

  const xml = zipEntryText(parsed.entries, sheet.file);
  if (xml === null) throw new Error(`Файл листа ${sheet.file} не читается`);

  const shared = parsed.shared;
  const rows: string[][] = [];

  for (const rowMatch of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(rowMatch[1] ?? '0');
    const cells: string[] = [];

    for (const cellMatch of (rowMatch[2] ?? '').matchAll(
      /<c[^>]*r="([A-Z]+\d+)"([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g,
    )) {
      const index = columnIndex(cellMatch[1] ?? 'A');
      const attrs = cellMatch[2] ?? '';
      const body = cellMatch[3] ?? '';

      const valueMatch = /<v>([\s\S]*?)<\/v>/.exec(body);
      const inlineMatch = /<t[^>]*>([\s\S]*?)<\/t>/.exec(body);
      let value = valueMatch?.[1] ?? inlineMatch?.[1] ?? '';

      if (/t="s"/.test(attrs) && value !== '') value = shared[Number(value)] ?? '';
      else value = decodeXmlText(value);

      while (cells.length < index) cells.push('');
      cells[index] = value;
    }

    while (rows.length < rowNumber - 1) rows.push([]);
    rows[rowNumber - 1] = cells;
  }

  return rows;
}

/** Похож ли файл на xlsx: zip-сигнатура плюс обязательные части книги. */
export function looksLikeXlsx(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  if (!isZip) return false;

  /*
   * Только имена записей: содержимое для ответа не нужно.
   *
   * Прежде здесь распаковывался весь архив — и вопрос «книга ли это Excel?»
   * стоил столько же, сколько полное чтение. На документе Word с картинками
   * окно замирало, и человек видел зависшую программу вместо ответа
   * «это не журнал».
   */
  try {
    return zipEntryNames(bytes).includes('xl/workbook.xml');
  } catch {
    return false;
  }
}
