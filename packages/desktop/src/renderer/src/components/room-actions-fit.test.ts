/**
 * Действия помещения не вылезают за рамку карточки узла.
 *
 * Заказчик: «кнопка удалить в карточке узла по помещению выходит за рамки
 * окна».
 *
 * Так и было: кнопок в строке помещения стало четыре — «изменить обводку»,
 * «показать на плане», «снять обводку», «удалить», — а карточка узла стоит в
 * узкой колонке около трёхсот точек. Ряд без переноса вытолкнул последнюю
 * кнопку за край.
 *
 * Проверка держит само правило, а не ширину: сколько бы действий у помещения
 * ни появилось, они обязаны переноситься по строкам. Ширину кнопок задаёт
 * шрифт и язык, и загадывать её числом бессмысленно — а вот забыть перенос при
 * добавлении пятой кнопки очень легко.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = fileURLToPath(new URL('.', import.meta.url));

/**
 * Тело правила по точному селектору.
 *
 * Поиском по строке, а не выражением: селекторы содержат точки и скобки, и
 * экранирование их в выражении — лишний способ ошибиться там, где ошибка
 * выглядит как «правила нет».
 */
function ruleFor(selector: string): string {
  const css = readFileSync(join(HERE, '..', 'styles.css'), 'utf8');
  const at = css.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`В styles.css нет правила ${selector}`);
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

describe('строка действий помещения', () => {
  it('переносится по строкам, а не выталкивает кнопки за край', () => {
    const rule = ruleFor('.room-actions');

    expect(rule).toContain('display: flex');
    expect(rule).toContain('flex-wrap: wrap');
  });

  it('не разрывает надписи кнопок посреди фразы', () => {
    // «Изменить обводку» в две строки внутри кнопки читается как две кнопки.
    expect(ruleFor('.room-actions button')).toContain('white-space: nowrap');
  });
});
