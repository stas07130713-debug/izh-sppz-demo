/**
 * Экран и выгрузка рисуют одно и то же одним источником.
 *
 * Заказчик (пункт 1 перечня доработок): «во всех экспортируемых документах
 * использовать те же значки огнетушителей и других элементов СППЗ, которые
 * используются в интерфейсе программы… не создавать для Word/PDF отдельные
 * упрощённые или автоматически генерируемые значки… экспорт должен
 * использовать единый источник графических ресурсов с интерфейсом программы…
 * круги зон покрытия должны отображаться со штриховкой в том же виде, в
 * котором они отображаются на плане».
 *
 * Критерий приёмки заказчик сформулировал так: «один и тот же элемент на
 * экране программы, в PDF и в Word визуально должен использовать один и тот же
 * принятый значок и одинаковый принцип отображения зоны покрытия».
 *
 * Глазами это не удержать: правку цвета или шага штриховки легко внести в
 * одном месте и забыть о другом — так и вышло в прошлый раз, когда на схеме
 * оказались красные квадраты и синие круги. Проверка следит за самим правилом:
 * ни экран, ни схема не должны нести своих чисел и цветов — только общие.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = fileURLToPath(new URL('.', import.meta.url));

function source(name: string): string {
  return readFileSync(join(HERE, name), 'utf8');
}

/** Текст без комментариев: в них цвета упоминаются как пример. */
function codeOnly(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const SCHEME = source('placement-scheme.ts');
const PLAN = source('PlanCanvas.tsx');
const STYLE = source('coverage-style.ts');

describe('единый источник графики', () => {
  it('схема берёт значок оттуда же, откуда экран', () => {
    // Не своя таблица и не рисование квадратов: тот же выбор знака, что у
    // значка в разметке, — картинка своего вида, замена пользователя, знак.
    expect(SCHEME).toContain("from './element-icon-source'");
    expect(SCHEME).toContain('elementIconSource');
  });

  it('своих значков схема не рисует', () => {
    // Красный квадрат вместо переданного заказчиком знака — та самая ошибка,
    // из-за которой требование и появилось.
    expect(codeOnly(SCHEME)).not.toContain("fillStyle = '#dc2626'");
  });

  it('вид круга покрытия задан одним описанием', () => {
    for (const file of [SCHEME, PLAN]) {
      expect(file).toContain("from './coverage-style'");
    }
    expect(STYLE).toContain("COVERAGE_COLOR = '#ea580c'");

    /*
     * В самом слое покрытия цвет не написан числом — только общая величина.
     * Проверяется именно слой, а не файл целиком: тем же оранжевым нарисована
     * линейка измерения, и к покрытию она отношения не имеет.
     */
    const layer = codeOnly(PLAN).split('coverage-layer')[1]?.split('</g>')[0] ?? '';
    expect(layer).not.toBe('');
    expect(layer).not.toContain('#ea580c');
    expect(codeOnly(SCHEME)).not.toContain('#ea580c');
  });

  it('штриховка есть и на экране, и в выгрузке', () => {
    // На экране — узором разметки, в выгрузке — плиткой на холсте; шаг и
    // толщина у обоих из общего описания.
    expect(PLAN).toContain('COVERAGE_HATCH_COUNTED');
    expect(SCHEME).toContain('coverageHatch');
    expect(codeOnly(SCHEME)).toContain('createPattern');
  });

  it('круг заштрихован целиком — и на экране, и в выгрузке', () => {
    /*
     * Заказчик: «нужно, чтобы круги имели штриховку». Была обрезка по
     * обводкам помещений — и на этажах, где помещения не обведены, от круга
     * оставалась одна дуга. Обрезки нет ни там, ни там: разойтись экрану и
     * справке нельзя.
     */
    expect(PLAN).not.toContain('clipPath="url(#покрытие-только-помещения)"');
    expect(SCHEME).not.toContain('clipToRooms');
    expect(PLAN).toContain("fill={circle.counted ? 'url(#покрытие-штрих)'");
    expect(codeOnly(SCHEME)).toContain('context.fillStyle = fill');
  });

  it('размер значка на схеме совпадает с размером на плане', () => {
    // На экране размер задан оформлением, здесь — числом: разойтись им нельзя,
    // иначе один и тот же элемент выйдет в справке крупнее или мельче.
    const css = readFileSync(join(HERE, '..', 'styles.css'), 'utf8');
    const rule = /\.element-icon-plan \{ width: (\d+)px;/.exec(css);
    expect(rule, 'правило .element-icon-plan не найдено').not.toBeNull();

    const shown = Number(rule?.[1] ?? 0);
    const drawn = Number(/PLAN_ICON_PX = (\d+)/.exec(STYLE)?.[1] ?? -1);
    expect(drawn).toBe(shown);
  });
});
