/**
 * Поле для набора текста не блокируется занятостью.
 *
 * Написан по жалобе: «пытаюсь поставить размер масштаба в графу, но не ставится
 * туда курсор и данные не ввести». Заблокированное поле нельзя ни выбрать
 * щелчком, ни заполнить — от сломанной программы это неотличимо, и человек не
 * получает даже сообщения о том, почему.
 *
 * Правило: занятость останавливает **кнопку**, которая начинает работу. Набирать
 * число или слово можно всегда — набранное никуда не уходит, пока не нажали.
 *
 * Список и галочка под правило не подпадают: их выбор сразу меняет данные, и
 * запрет на время записи там осмыслен.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const RENDERER = join(HERE, '..');

/** Виды `input`, в которые набирают с клавиатуры. */
const TYPED = ['text', 'password', 'number', 'search', 'tel', 'url', 'email', 'date'];

function sourceFiles(dir: string): readonly string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(path));
    else if (entry.name.endsWith('.tsx')) found.push(path);
  }
  return found;
}

/** Разметка полей набора, заблокированных занятостью. Пусто — правило соблюдено. */
export function blockedFieldsIn(source: string): readonly string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/<(input|textarea)\b[^>]*?>/gs)) {
    const tag = match[0];
    if (!/disabled=\{[^}]*[Bb]usy/.test(tag)) continue;

    // Вид не указан — это `text` по умолчанию.
    const kind = /type="([a-z]+)"/.exec(tag)?.[1] ?? (match[1] === 'textarea' ? 'text' : 'text');
    if (!TYPED.includes(kind)) continue;

    found.push(tag.replace(/\s+/g, ' ').slice(0, 80));
  }
  return found;
}

describe('проверка ловит то, ради чего написана', () => {
  it('находит поле набора, заблокированное занятостью', () => {
    // Без этого случая проверка ниже стала бы формальностью, проходящей на
    // любом коде, — и следующую такую блокировку никто бы не заметил.
    expect(blockedFieldsIn('<input inputMode="decimal" value={v} disabled={props.busy} />')).toHaveLength(1);
    expect(blockedFieldsIn('<textarea value={v} disabled={busy} />')).toHaveLength(1);
  });

  it('список и галочка под правило не подпадают', () => {
    expect(blockedFieldsIn('<input type="checkbox" checked={v} disabled={props.busy} />')).toEqual([]);
    expect(blockedFieldsIn('<input type="range" value={v} disabled={props.busy} />')).toEqual([]);
  });

  it('поле, заблокированное по другой причине, не считается', () => {
    expect(blockedFieldsIn('<input value={v} disabled={archived} />')).toEqual([]);
  });
});

describe('разметка окна программы', () => {
  it('ни одно поле набора не блокируется занятостью', () => {
    const bad: string[] = [];
    for (const file of sourceFiles(RENDERER)) {
      for (const tag of blockedFieldsIn(readFileSync(file, 'utf8'))) {
        bad.push(`${file.slice(RENDERER.length + 1)}: ${tag}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
