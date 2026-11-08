/**
 * Файл, который журналом не является.
 *
 * Заказчик: «программа зависает, когда загружаешь файл, который не является
 * журналом. Нужно это исправить и просто указывать, что данные не опознаны».
 *
 * Зависало опознание: чтобы ответить «это не книга Excel», архив
 * распаковывался целиком — а тем же архивом устроены docx, pptx и обычный zip,
 * и в них лежат картинки на десятки мегабайт.
 *
 * Проверяется поэтому не только ответ, но и его цена: опознание обязано быть
 * дешёвым, иначе «не опознано» человек увидит через минуту замершего окна.
 */

import { describe, expect, it } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { looksLikeXlsx, xlsxSheetNames } from '../xlsx.js';

/** Собирает zip из записей: только локальные заголовки — их и читает движок. */
function zip(entries: readonly { name: string; data: Uint8Array }[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const entry of entries) {
    const packed = new Uint8Array(deflateRawSync(Buffer.from(entry.data)));
    const name = new TextEncoder().encode(entry.name);
    const head = new Uint8Array(30 + name.length);
    const view = new DataView(head.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(8, 8, true); // deflate
    view.setUint32(18, packed.length, true);
    view.setUint32(22, entry.data.length, true);
    view.setUint16(26, name.length, true);
    head.set(name, 30);
    parts.push(head, packed);
  }
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}

describe('файл, который не журнал', () => {
  it('обычный файл не признаётся книгой', () => {
    const pdf = new TextEncoder().encode('%PDF-1.7\nчто-то совсем другое');
    expect(looksLikeXlsx(pdf)).toBe(false);
  });

  it('чужой архив с тяжёлым содержимым опознаётся мгновенно и без распаковки', () => {
    // Так устроен docx: тот же zip, только внутри картинки на десятки мегабайт.
    const picture = new Uint8Array(24 * 1024 * 1024);
    for (let i = 0; i < picture.length; i += 7) picture[i] = i % 251;

    const docx = zip([
      { name: '[Content_Types].xml', data: new TextEncoder().encode('<Types/>') },
      { name: 'word/document.xml', data: new TextEncoder().encode('<w:document/>') },
      { name: 'word/media/image1.png', data: picture },
    ]);

    const started = Date.now();
    expect(looksLikeXlsx(docx)).toBe(false);
    // Опознание читает только имена записей: распаковка этой картинки заняла
    // бы секунды, и окно на них замирало бы.
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('обрубок архива разбирается и заканчивается, а не крутится', () => {
    // Сигнатура записи на месте, всё остальное — нули. Такой файл получается
    // из недокачанного вложения, и разбор обязан на нём закончиться.
    const broken = new Uint8Array(64);
    new DataView(broken.buffer).setUint32(0, 0x04034b50, true);

    const started = Date.now();
    expect(looksLikeXlsx(broken)).toBe(false);
    expect(xlsxSheetNames(broken)).toEqual([]);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
