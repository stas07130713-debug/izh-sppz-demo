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

  it('узнаёт GIF, BMP, WebP и TIFF — любой чертёж, скан или снимок', () => {
    // Под подложку годится любая картинка, и снимок с телефона в BMP или
    // скан в TIFF ничем не отличается от PNG. Раньше они не принимались.
    const cases: readonly (readonly [string, readonly number[]])[] = [
      ['GIF', [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
      ['BMP', [0x42, 0x4d, 0x36, 0x00]],
      ['TIFF (младший первым)', [0x49, 0x49, 0x2a, 0x00]],
      ['TIFF (старший первым)', [0x4d, 0x4d, 0x00, 0x2a]],
    ];
    for (const [name, header] of cases) {
      expect(`${name}: ${detectKind(bytesOf(header, 32))}`).toBe(`${name}: image`);
    }
  });

  it('узнаёт WebP по паре меток RIFF и WEBP', () => {
    // Одного RIFF мало: так начинаются и звук, и видео.
    const webp = bytesOf([0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50], 32);
    expect(detectKind(webp)).toBe('image');

    const riffOnly = bytesOf([0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20], 32);
    expect(detectKind(riffOnly)).toBeNull();
  });

  it('узнаёт JPEG', () => {
    const bytes = bytesOf([0xff, 0xd8, 0xff, 0xe0]);
    expect(detectKind(bytes)).toBe('image');
  });

  it('узнаёт SVG как открытый векторный формат', () => {
    expect(detectKind(new TextEncoder().encode('<?xml version="1.0"?><svg viewBox="0 0 10 10"></svg>'))).toBe('svg');
  });

  it('узнаёт JSON-описание подложки', () => {
    expect(detectKind(new TextEncoder().encode('{"svg":"<svg></svg>"}'))).toBe('json');
  });

  it('узнаёт простой DXF с линиями', () => {
    const dxf = '0\nSECTION\n2\nENTITIES\n0\nLINE\n8\n0\n10\n0\n20\n0\n11\n10\n21\n10\n0\nENDSEC\n0\nEOF';
    expect(detectKind(new TextEncoder().encode(dxf))).toBe('dxf');
  });

  it('не узнаёт посторонний файл', () => {
    const bytes = bytesOf([0x50, 0x4b, 0x03, 0x04]); // это ZIP, например xlsx
    expect(detectKind(bytes)).toBe(null);
  });

  it('не падает на пустом файле', () => {
    expect(detectKind(new Uint8Array(0))).toBe(null);
  });
});
