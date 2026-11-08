/**
 * Хуки не должны стоять после раннего возврата.
 *
 * React считает хуки по порядку вызова. Хук, объявленный ниже `return`,
 * вызывается не при каждом наборе данных: пустой журнал рисовался без подсчёта
 * меток, заполненный — с ним, и на переходе между этими состояниями экран падал
 * с «Rendered more hooks than during the previous render».
 *
 * Проверка идёт по исходникам, а не по поведению: собрать все сочетания данных,
 * при которых компонент уходит в ранний возврат, дороже, чем прочитать код.
 *
 * Первая проверка здесь — проверка самой проверки. Сканер уже один раз объявил
 * «всё чисто», не умея видеть возврат внутри `if`, и его вывод ничего не значил.
 * Пока он не ловит заведомо ошибочный пример, верить его молчанию нельзя.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const COMPONENT = /^(?:export )?function [A-Z]\w*\(/;
const HOOK = /(?:^|[\s=(])use[A-Z]\w*\(/;
const RETURN = /^\s*return[\s(;<]/;
const IF_OPEN = /^\s*(?:\}\s*else\s+)?if\s*\(/;

interface HookAfterReturn {
  readonly file: string;
  readonly line: number;
  readonly returnedAt: number;
  readonly text: string;
}

/** Скобки в строках и комментариях блоков не открывают. */
function strip(line: string): string {
  return line
    .replace(/\/\/.*$/, '')
    .replace(/\/\*.*?\*\//g, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

/**
 * Ранним возвратом считается возврат на верхнем уровне тела компонента или
 * внутри сторожевого `if`. Возврат внутри `useMemo` или обработчика — обычное
 * дело, и на порядок хуков он не влияет.
 */
export function hooksAfterReturn(source: string, file = ''): readonly HookAfterReturn[] {
  const lines = source.split(/\r?\n/);
  const found: HookAfterReturn[] = [];

  let depth = 0;
  let inComponent = false;
  let componentDepth = 0;
  const opened: string[] = [];
  let returnedAt = -1;

  for (const [index, raw] of lines.entries()) {
    const line = strip(raw);
    const opens = (line.match(/\{/g) ?? []).length;
    const closes = (line.match(/\}/g) ?? []).length;

    if (!inComponent && COMPONENT.test(raw)) {
      inComponent = true;
      componentDepth = depth;
      returnedAt = -1;
    }

    if (inComponent) {
      const bodyDepth = depth - componentDepth;
      const guarded = bodyDepth === 2 && opened[opened.length - 1] === 'if';

      if (returnedAt < 0 && RETURN.test(line) && (bodyDepth === 1 || guarded)) returnedAt = index;

      if (returnedAt >= 0 && bodyDepth === 1 && HOOK.test(line)) {
        found.push({ file, line: index + 1, returnedAt: returnedAt + 1, text: raw.trim() });
        returnedAt = -1;
      }
    }

    for (let i = 0; i < opens; i += 1) opened.push(IF_OPEN.test(line) ? 'if' : 'иное');
    for (let i = 0; i < closes; i += 1) opened.pop();
    depth += opens - closes;

    if (inComponent && depth <= componentDepth && closes > 0) {
      inComponent = false;
      returnedAt = -1;
    }
  }

  return found;
}

function sources(dir: string): readonly string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sources(path));
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts')) out.push(path);
  }
  return out;
}

const BAD = [
  'export function Bad(props: { readonly rows: readonly string[] }): React.JSX.Element {',
  '  const [open, setOpen] = useState(false);',
  '',
  '  if (props.rows.length === 0) {',
  '    return <p>пусто</p>;',
  '  }',
  '',
  '  const counts = useMemo(() => props.rows.length, [props.rows]);',
  '  return <p>{counts}{open}</p>;',
  '}',
].join('\n');

const GOOD = [
  'export function Good(props: { readonly rows: readonly string[] }): React.JSX.Element {',
  '  const [open, setOpen] = useState(false);',
  '  const counts = useMemo(() => props.rows.length, [props.rows]);',
  '',
  '  if (props.rows.length === 0) {',
  '    return <p>пусто</p>;',
  '  }',
  '',
  '  return <p>{counts}{open}</p>;',
  '}',
].join('\n');

describe('порядок хуков', () => {
  it('проверка ловит хук после сторожевого возврата', () => {
    const found = hooksAfterReturn(BAD, 'Bad.tsx');
    expect(found).toHaveLength(1);
    expect(found[0]?.line).toBe(8);
  });

  it('хук до возврата нарушением не считается', () => {
    expect(hooksAfterReturn(GOOD, 'Good.tsx')).toHaveLength(0);
  });

  it('возврат внутри useMemo ранним не считается', () => {
    // Иначе честный `useMemo` с ранним `return` внутри объявлял бы весь
    // остальной компонент ошибочным.
    const source = [
      'export function Fine(props: { readonly rows: readonly string[] }): React.JSX.Element {',
      '  const first = useMemo(() => {',
      '    if (props.rows.length === 0) return null;',
      '    return props.rows[0];',
      '  }, [props.rows]);',
      '',
      '  const [open, setOpen] = useState(false);',
      '  return <p>{first}{open}</p>;',
      '}',
    ].join('\n');

    expect(hooksAfterReturn(source, 'Fine.tsx')).toHaveLength(0);
  });

  it('в экранах программы хуков после раннего возврата нет', () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const problems = sources(root).flatMap((file) => hooksAfterReturn(readFileSync(file, 'utf8'), file));

    expect(
      problems.map((item) => `${item.file}:${item.line} — возврат на строке ${item.returnedAt}: ${item.text}`),
    ).toEqual([]);
  });
});
