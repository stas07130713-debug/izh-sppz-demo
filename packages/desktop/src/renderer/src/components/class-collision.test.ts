/**
 * Столкновения имён классов.
 *
 * Написан по живой ошибке. Пустышка вместо знака раскрытия в дереве называлась
 * `class="tree-toggle empty"`, а `.empty` — это страница «показывать нечего»:
 * рамка, отступы и водяной знак в углу. Пока водяного знака не было, совпадение
 * ничего не портило; после него каждый лист дерева получил отступ в 130 точек и
 * знак огнетушителя, и дерево развалилось.
 *
 * Ошибку такого рода не ловит ни тип, ни сборка: разметка верна, стили верны,
 * неверно только их сочетание. Поэтому её ловит этот тест.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const RENDERER = join(HERE, '..');

/**
 * Классы, которые сами по себе задают вид целого блока: рамку, отступы, фон.
 *
 * Такой класс рассчитан стоять в `className` один. Добавленный к другому, он
 * приносит с собой всё своё оформление — а автор второго класса об этом не
 * знает и знать не может. Это ровно те три, что стоят в общем правиле
 * `.wizard, .empty, .panel` в стилях, плюс `.dropzone` с той же ролью.
 *
 * `modal` и `tile` сюда намеренно не входят: у них есть уговор о
 * видоизменениях — `modal settings-modal`, `tile tile-clickable tile-ok`, —
 * и приписка к ним не случайность, а замысел.
 */
const BLOCK_CLASSES: readonly string[] = ['empty', 'wizard', 'panel', 'dropzone'];

/** Все .tsx окна программы. */
function sourceFiles(dir: string): readonly string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(path));
    else if (entry.name.endsWith('.tsx')) found.push(path);
  }
  return found;
}

/** Наборы классов из статических `className="..."` — по одному набору на место. */
export function classSetsOf(source: string): readonly string[][] {
  return [...source.matchAll(/className="([^"{}]+)"/g)]
    .map((match) => (match[1] ?? '').trim().split(/\s+/).filter((name) => name !== ''));
}

/** Блочный класс, приписанный к другому классу. Пусто — столкновений нет. */
export function collisionsIn(source: string): readonly string[] {
  const found: string[] = [];
  for (const set of classSetsOf(source)) {
    if (set.length < 2) continue;
    for (const name of set) {
      if (BLOCK_CLASSES.includes(name)) found.push(set.join(' '));
    }
  }
  return found;
}

describe('проверка ловит то, ради чего написана', () => {
  it('находит ту самую разметку, которая сломала дерево', () => {
    // Если этот случай перестанет находиться, проверка ниже станет пустой
    // формальностью и молча пропустит следующую такую ошибку.
    expect(collisionsIn('<span className="tree-toggle empty" />')).toEqual(['tree-toggle empty']);
  });

  it('одиночный блочный класс — не столкновение', () => {
    expect(collisionsIn('<div className="empty">')).toEqual([]);
  });

  it('обычные пары классов не считаются столкновением', () => {
    expect(collisionsIn('<span className="badge muted">')).toEqual([]);
  });
});

describe('разметка окна программы', () => {
  it('блочные классы нигде не приписаны к другим классам', () => {
    const bad: string[] = [];
    for (const file of sourceFiles(RENDERER)) {
      for (const collision of collisionsIn(readFileSync(file, 'utf8'))) {
        bad.push(`${file.slice(RENDERER.length + 1)}: class="${collision}"`);
      }
    }
    expect(bad).toEqual([]);
  });
});
