/**
 * Определение типа загруженного файла по его содержимому.
 *
 * Расширению файла не доверяем: пользователи присылают чертежи с любыми
 * расширениями, а иногда и вовсе без них.
 *
 * Узнаётся то, что программа умеет показать сама: PDF, растровые картинки,
 * SVG, DXF и свой JSON. Форматы, которые без стороннего преобразователя не
 * прочитать (DWG, Visio), сюда не попадают намеренно — принять файл и показать
 * вместо чертежа пустоту хуже, чем честно сказать, что нужен экспорт.
 */

import type { PlanSourceKind } from '@izh/contracts';

/** Заголовок PDF может быть смещён от начала файла — по стандарту допускается. */
const PDF_HEADER_SEARCH_LIMIT = 1024;

const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

/**
 * Растровые заголовки.
 *
 * Все эти форматы Chromium показывает сам, а под подложку годится любая
 * картинка: чертёж, скан, фотография доски. Раньше узнавались только PNG и
 * JPEG, и снимок с телефона в BMP или скан в TIFF не принимался, хотя ничем
 * от них не отличается.
 */
const RASTER_HEADERS: readonly (readonly number[])[] = [
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // PNG
  [0xff, 0xd8, 0xff], // JPEG
  [0x47, 0x49, 0x46, 0x38], // GIF87a / GIF89a
  [0x42, 0x4d], // BMP
  [0x49, 0x49, 0x2a, 0x00], // TIFF, порядок байтов от младшего
  [0x4d, 0x4d, 0x00, 0x2a], // TIFF, порядок байтов от старшего
];

/** WebP: «RIFF» в начале и «WEBP» четырьмя байтами дальше. */
const RIFF_HEADER = [0x52, 0x49, 0x46, 0x46];
const WEBP_TAG = [0x57, 0x45, 0x42, 0x50];
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: false });

function matchesAt(bytes: Uint8Array, offset: number, pattern: readonly number[]): boolean {
  if (offset + pattern.length > bytes.length) return false;
  for (let i = 0; i < pattern.length; i += 1) {
    if (bytes[offset + i] !== pattern[i]) return false;
  }
  return true;
}

export function detectKind(bytes: Uint8Array): PlanSourceKind | null {
  const limit = Math.min(bytes.length, PDF_HEADER_SEARCH_LIMIT);
  for (let offset = 0; offset < limit; offset += 1) {
    if (matchesAt(bytes, offset, PDF_HEADER)) return 'pdf';
  }

  for (const header of RASTER_HEADERS) {
    if (matchesAt(bytes, 0, header)) return 'image';
  }
  if (matchesAt(bytes, 0, RIFF_HEADER) && matchesAt(bytes, 8, WEBP_TAG)) return 'image';

  const head = UTF8_DECODER.decode(bytes.slice(0, Math.min(bytes.length, 4096))).trimStart();
  const lowered = head.toLocaleLowerCase('ru');
  if (lowered.startsWith('{') || lowered.startsWith('[')) return 'json';
  if (lowered.startsWith('<svg') || lowered.includes('<svg')) return 'svg';
  if (looksLikeDxf(lowered)) return 'dxf';

  return null;
}

function looksLikeDxf(text: string): boolean {
  return (
    text.includes('section') &&
    text.includes('entities') &&
    (text.includes('line') || text.includes('lwpolyline') || text.includes('polyline'))
  );
}
