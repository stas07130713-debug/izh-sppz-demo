import { describe, expect, it } from 'vitest';
import { detectKind } from '../detect-kind.js';

function bytesOf(values: readonly number[], totalLength = values.length): Uint8Array {
  const out = new Uint8Array(totalLength);
  out.set(values, 0);
  return out;
}

describe('detectKind', () => {
  it('узнаёт PDF по заголовку в начале файла', () => {
    // %PDF-1.7
    const bytes = bytesOf([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    expect(detectKind(bytes)).toBe('pdf');
  });

  it('узнаёт PDF, даже если заголовок смещён от начала файла', () => {
    const bytes = new Uint8Array(64);
    bytes.set([0x00, 0x00, 0x00], 0);
    bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d], 17);
    expect(detectKind(bytes)).toBe('pdf');
  });

  it('узнаёт PNG', () => {
    const bytes = bytesOf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectKind(bytes)).toBe('image');
  });

  it('узнаёт JPEG', () => {
    const bytes = bytesOf([0xff, 0xd8, 0xff, 0xe0]);
    expect(detectKind(bytes)).toBe('image');
  });

  it('не узнаёт посторонний файл', () => {
    const bytes = bytesOf([0x50, 0x4b, 0x03, 0x04]); // это ZIP, например xlsx
    expect(detectKind(bytes)).toBe(null);
  });

  it('не падает на пустом файле', () => {
    expect(detectKind(new Uint8Array(0))).toBe(null);
  });
});
