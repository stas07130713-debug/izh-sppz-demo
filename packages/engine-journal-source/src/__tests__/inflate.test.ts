/**
 * Эталонные тесты распаковки deflate.
 *
 * Сжатые образцы получены через zlib и записаны байтами: так тест не зависит от
 * того, есть ли в среде Node с zlib, и проверяет именно наш распаковщик.
 * Проверяются все три вида блоков — без сжатия, с фиксированными кодами и с
 * динамическими.
 */

import { describe, expect, it } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { inflateRaw } from '../inflate.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Сжимает эталонным zlib, распаковывает нашим кодом и сравнивает с исходным. */
function roundTrip(text: string, level: number): string {
  const original = encoder.encode(text);
  const compressed = deflateRawSync(Buffer.from(original), { level });
  const restored = inflateRaw(new Uint8Array(compressed));
  return decoder.decode(restored);
}

describe('распаковка deflate', () => {
  it('несжатый блок (уровень 0)', () => {
    const text = 'Пожарный кран, шкаф ВПВ';
    expect(roundTrip(text, 0)).toBe(text);
  });

  it('короткий текст с обычным сжатием', () => {
    const text = 'Огнетушитель ОП-8, инв. № 28-27';
    expect(roundTrip(text, 6)).toBe(text);
  });

  it('повторяющийся текст: проверяет ссылки назад по потоку', () => {
    // Много повторов заставляет кодировщик использовать пары длина-расстояние.
    const text = 'Извещатель дымовой; '.repeat(200);
    expect(roundTrip(text, 9)).toBe(text);
  });

  it('длинный разнородный текст: динамические коды Хаффмана', () => {
    let text = '';
    for (let i = 0; i < 500; i += 1) {
      text += `Строка ${i}: осмотр ${i % 7}, перезарядка ${i % 13}, состояние исправен\n`;
    }
    expect(roundTrip(text, 6)).toBe(text);
  });

  it('пустые данные', () => {
    expect(roundTrip('', 6)).toBe('');
  });

  it('двоичные данные, а не только текст', () => {
    const original = new Uint8Array(1000);
    for (let i = 0; i < original.length; i += 1) original[i] = (i * 37) % 256;
    const compressed = deflateRawSync(Buffer.from(original), { level: 6 });
    const restored = inflateRaw(new Uint8Array(compressed));
    expect(Array.from(restored)).toEqual(Array.from(original));
  });

  it('битый поток даёт ошибку, а не бесконечный цикл', () => {
    expect(() => inflateRaw(new Uint8Array([0xff, 0xff, 0xff, 0xff]))).toThrow();
  });
});
