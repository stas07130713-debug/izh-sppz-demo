/**
 * Выпадающие списки — одного вида на всю программу.
 *
 * Заказчик: «разные выпадающие списки в одной карточке выглядят по-разному: в
 * карточке огнетушителя "Тип огнетушителя" имеет один внешний вид, а
 * "Изготовитель" — другую стрелку и другое раскрывающееся окно… привести все
 * Select/Dropdown/ComboBox к единому компоненту и единому дизайн-стандарту».
 *
 * Единый вид держится на одном: браузерного `<select>` в разметке быть не
 * должно. Он не поддаётся оформлению — выпадает окном чужого вида, со своей
 * стрелкой и своими отступами, и на тёмной теме белеет. Заменять его пришлось
 * по одному в двадцати восьми файлах, и без этой проверки следующий вернулся бы
 * вместе с новым окном.
 *
 * Проверка смотрит на текст разметки, а не разбирает её: тонкий случай она
 * пропустит, зато не сломается от переноса строки. Ловит она ровно тот случай,
 * из-за которого требование и появилось.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SRC = join(HERE, '..');

/** Вся разметка окна: списки заводятся не только в карточках. */
function screens(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return screens(full);
    return entry.name.endsWith('.tsx') ? [full] : [];
  });
}

const FILES = screens(SRC);

/** Текст без комментариев: в них `<select>` упоминается как слово. */
function codeOnly(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('выпадающие списки одного вида', () => {
  it('разметка вообще нашлась', () => {
    // Иначе проверка «ничего не нашла и промолчала» была бы бесполезной.
    expect(FILES.length).toBeGreaterThan(50);
  });

  it('браузерного списка в программе нет', () => {
    const problems = FILES
      .filter((file) => codeOnly(readFileSync(file, 'utf8')).includes('<select'))
      .map((file) => file.slice(SRC.length + 1));

    expect(problems).toEqual([]);
  });
});
