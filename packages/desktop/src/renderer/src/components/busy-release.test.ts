/**
 * Занятость снимается всегда, даже когда действие сорвалось.
 *
 * Написан по ошибке, которая ломала программу дважды. Занятость включали перед
 * вызовом и снимали после него:
 *
 *     setBusy(true);
 *     const result = await действие();
 *     setBusy(false);
 *
 * Пока действие возвращает отказ значением — всё хорошо. Но оно может
 * **сорваться броском**: мост к основному процессу отклоняет обещание, когда
 * обработчик на той стороне упал, а разбор чертежа падает на нехватке памяти.
 * Тогда `setBusy(false)` не выполняется никогда, занятость остаётся включённой
 * до перезапуска, а кнопки и поля заблокированы. Со стороны — сломанная
 * программа без единого сообщения.
 *
 * Правило: между включением занятости и её снятием обязан стоять `finally`.
 *
 * Ищется **любое** имя вида `set…Busy`, а не одно `setBusy`. Первая редакция
 * проверки смотрела только на `setBusy` и прошла мимо `setSettingsBusy` в
 * сохранении настроек — там была ровно та же ошибка.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const RENDERER = join(HERE, '..');

function sourceFiles(dir: string): readonly string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts')) found.push(path);
  }
  return found;
}

/**
 * Убирает пояснения: в них живут примеры неправильного кода.
 *
 * Без этого проверка спотыкалась о собственный разбор ошибки в заголовке
 * `use-busy-run.ts`, где неверный образец приведён нарочно.
 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Включения занятости, у которых снятие не защищено `finally`.
 *
 * Смотрится текст после включения до конца функции — грубо, по хвосту в тысячу
 * знаков: этого хватает на любое обозримое тело и не требует разбора кода.
 */
export function unguardedBusyIn(source: string): number {
  const parts = codeOnly(source).split(/set[A-Za-z]*Busy\(true\)/);
  let count = 0;
  for (const part of parts.slice(1)) {
    const tail = part.slice(0, 1500);
    const releaseAt = tail.search(/set[A-Za-z]*Busy\(false\)/);
    if (releaseAt < 0) continue; // снятия рядом нет — значит, оно у стража
    const finallyAt = tail.lastIndexOf('finally', releaseAt);
    if (finallyAt < 0) count += 1;
  }
  return count;
}

describe('проверка ловит то, ради чего написана', () => {
  it('находит незащищённое включение', () => {
    const bad = [
      'setBusy(true);',
      'const result = await действие();',
      'setBusy(false);',
    ].join('\n');
    expect(unguardedBusyIn(bad)).toBe(1);
  });

  it('видит занятость под другим именем', () => {
    // Первая редакция проверки смотрела только на «setBusy» и прошла мимо
    // «setSettingsBusy» в сохранении настроек.
    const bad = [
      'setSettingsBusy(true);',
      'const saved = await сохранить();',
      'setSettingsBusy(false);',
    ].join('\n');
    expect(unguardedBusyIn(bad)).toBe(1);
  });

  it('защищённое включение не считается', () => {
    const good = [
      'setBusy(true);',
      'try {',
      '  await действие();',
      '} catch (e) {',
      '  setMessage(e);',
      '} finally {',
      '  setBusy(false);',
      '}',
    ].join('\n');
    expect(unguardedBusyIn(good)).toBe(0);
  });
});

describe('окно программы', () => {
  it('занятость нигде не снимается вне finally', () => {
    const bad: string[] = [];
    for (const file of sourceFiles(RENDERER)) {
      const count = unguardedBusyIn(readFileSync(file, 'utf8'));
      if (count > 0) bad.push(`${file.slice(RENDERER.length + 1)}: ${count}`);
    }
    expect(bad).toEqual([]);
  });
});
