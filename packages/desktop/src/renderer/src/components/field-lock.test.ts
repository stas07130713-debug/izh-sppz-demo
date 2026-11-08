/**
 * Поля карточек не запираются без объяснения.
 *
 * Заказчик: «в ряде карточек поле визуально отображается как редактируемое, но
 * пользователь не может установить в него курсор либо ввести значение… Не
 * ограничиваться исправлением только поля "Учётный номер" — проверить данный
 * механизм системно по всем карточкам».
 *
 * Системно это проверяется здесь, по самой разметке: поле ввода, которому
 * поставили `disabled`, обязано объяснять человеку, почему оно недоступно, —
 * подсказкой в `placeholder` или подписью рядом. Молчаливый запрет выглядит
 * поломкой: поле как поле, а курсор в него не ставится.
 *
 * Проверка грубая нарочно: она не разбирает разметку разборщиком, а смотрит на
 * текст. Тонкую разметку она пропустит, зато не сломается от переноса строки —
 * а ловит она ровно тот случай, из-за которого требование и появилось.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = fileURLToPath(new URL('.', import.meta.url));

/** Файлы карточек: в них правят сведения об оборудовании и помещениях. */
const CARD_FILES = readdirSync(HERE)
  .filter((name) => name.endsWith('.tsx'))
  .filter((name) => /Fields|Card|DetailsForm/.test(name));

const SIGN_IN = readFileSync(join(HERE, 'SignInScreen.tsx'), 'utf8');
const STYLES = readFileSync(join(HERE, '..', 'styles.css'), 'utf8');

/** Текст без комментариев: в них `disabled` встречается как слово. */
function codeOnly(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('поля карточек принимают ввод', () => {
  it('карточки вообще нашлись', () => {
    // Иначе проверка «ничего не нашла и промолчала» была бы бесполезной.
    expect(CARD_FILES.length).toBeGreaterThan(5);
  });

  it('запертое поле объясняет, почему оно заперто', () => {
    const problems: string[] = [];

    for (const file of CARD_FILES) {
      const code = codeOnly(readFileSync(join(HERE, file), 'utf8'));

      /*
       * Поле ввода с `disabled` — и без подсказки рядом. Подсказкой считается
       * `placeholder` или `title` в том же теге: они и объясняют человеку, что
       * поле ждёт чего-то другого.
       */
      const tags = code.match(/<input[\s\S]*?\/>/g) ?? [];
      for (const tag of tags) {
        if (!tag.includes('disabled')) continue;
        if (tag.includes('type="checkbox"') || tag.includes('type="radio"')) continue;
        if (tag.includes('placeholder') || tag.includes('title')) continue;
        problems.push(`${file}: ${tag.replace(/\s+/g, ' ').slice(0, 80)}`);
      }
    }

    expect(problems).toEqual([]);
  });
});

describe('поля восстановления администратора принимают фокус', () => {
  it('после системного подтверждения фокус возвращается в первое поле', () => {
    expect(SIGN_IN).toContain('firstFieldRef.current?.focus({ preventScroll: true })');
    expect(SIGN_IN).toContain('window.izh.window.focusContent()');
    expect(SIGN_IN).toContain('ref={firstFieldRef}');
  });

  it('форма входа исключена из области перетаскивания окна', () => {
    expect(STYLES).toMatch(/\.sign-in-card\s*\{[\s\S]*?-webkit-app-region:\s*no-drag;/u);
  });
});
