/**
 * Ни одно всплывающее меню не рисуется мимо общего правила размещения
 * (ТЗ, Дополнение 6, часть С90).
 *
 * Заказчик: «все меню должны быть видны при их открытии». Проверка положения
 * сама по себе этого не гарантирует: достаточно завести ещё одно меню и забыть
 * её позвать. Поэтому здесь проверяется не поведение, а то, что каждое меню
 * вообще подключено к правилу.
 *
 * Проверка перечисляет исходные файлы, а не разметку в браузере: меню
 * открываются в разных местах программы, и собрать их все в одном прогоне
 * дороже, чем поймать забытый вызов прямо в коде.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Классы, которыми в программе обозначены всплывающие слои. */
const POPUP_CLASSES = ['context-menu', 'journal-menu-list'];

const DIRECTORY = join(process.cwd(), 'packages/desktop/src/renderer/src/components');

function componentFiles(): readonly string[] {
  return readdirSync(DIRECTORY)
    .filter((name) => name.endsWith('.tsx'))
    .map((name) => join(DIRECTORY, name));
}

/** Рисует ли файл всплывающий слой сам, а не просто упоминает его имя. */
function rendersPopup(source: string): boolean {
  return POPUP_CLASSES.some((klass) => source.includes(`className="${klass}`)
    || source.includes(`'${klass}`) && source.includes('className={'));
}

describe('размещение всплывающих меню', () => {
  it('каждое меню обращается к общему правилу', () => {
    const forgotten: string[] = [];
    for (const path of componentFiles()) {
      const source = readFileSync(path, 'utf8');
      if (!rendersPopup(source)) continue;
      if (!source.includes('menu-placement')) forgotten.push(path.split(/[\\/]/).pop() ?? path);
    }
    expect(forgotten).toEqual([]);
  });

  it('проверка ловит меню без правила', () => {
    // Без этого «всё чисто» ничего не значит: проверка, которая никогда не
    // срабатывает, выглядит ровно так же, как проверка, которой нечего ловить.
    const bad = 'export function X() { return <div className="context-menu" style={{ left: 0 }} />; }';
    expect(rendersPopup(bad)).toBe(true);
    expect(bad.includes('menu-placement')).toBe(false);
  });

  it('обычные окна под проверку не попадают', () => {
    const modal = 'export function X() { return <div className="modal-backdrop"><div className="modal" /></div>; }';
    expect(rendersPopup(modal)).toBe(false);
  });
});
