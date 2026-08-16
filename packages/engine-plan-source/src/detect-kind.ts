/**
 * Определение типа загруженного файла по его содержимому.
 *
 * Расширению файла не доверяем: пользователи присылают чертежи с любыми
 * расширениями, а иногда и вовсе без них.
 */

import type { PlanSourceKind } from '@izh/contracts';

/** Заголовок PDF может быть смещён от начала файла — по стандарту допускается. */
const PDF_HEADER_SEARCH_LIMIT = 1024;

const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_HEADER = [0xff, 0xd8, 0xff];

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

  if (matchesAt(bytes, 0, PNG_HEADER)) return 'image';
  if (matchesAt(bytes, 0, JPEG_HEADER)) return 'image';

  return null;
}
