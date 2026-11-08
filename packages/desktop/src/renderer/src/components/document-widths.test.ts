/**
 * Графы выгруженного документа не выходят за поле листа.
 *
 * Заказчик: «при выгрузке журнала в Word часть граф выходит за пределы
 * страницы: таблица шире листа, крайние графы обрезаются… обеспечить
 * размещение всех граф в пределах листа».
 *
 * Ширину граф выбирал сам Word: таблице задавали `width:100%`, но при обычной
 * раскладке это лишь пожелание, и длинное значение растягивало графу вместе со
 * всей таблицей. Здесь проверяется то, что это отменяет: жёсткая раскладка,
 * заданные доли ширины и перенос длинных слов.
 */

import { describe, expect, it } from 'vitest';
import { buildDocumentExportRequest, type DocumentTable } from './document-export';

const HEAD = { title: 'Журнал', scopeTitle: 'Весь журнал' };

function table(headers: readonly string[], rows: readonly (readonly string[])[]): DocumentTable {
  return { title: 'Раздел', headers, rows };
}

/**
 * Доли из разметки: по ним и видно, помещается таблица или нет.
 *
 * Разметки для Word может не быть вовсе — это тоже поломка выгрузки, и
 * проверка обязана на неё упасть, а не считать нулевые доли.
 */
function shares(html: string | undefined): readonly number[] {
  if (html === undefined) throw new Error('разметки для Word нет');
  return [...html.matchAll(/<col width="([\d.]+)%"/g)].map((match) => Number(match[1] ?? 0));
}

describe('ширины граф выгрузки', () => {
  const wide = buildDocumentExportRequest('word', {
    ...HEAD,
    tables: [table(
      ['№', 'Наименование', 'Место установки', 'Примечание'],
      [
        ['1', 'ОП-5', 'Цех № 1, корпус 2, отметка +4.200, помещение 105', 'Проверить пломбу'],
        ['2', 'ОП-4', 'Склад', ''],
      ],
    )],
  });

  it('доли граф складываются в целую ширину таблицы', () => {
    const parts = shares(wide.wordHtml);
    expect(parts).toHaveLength(4);
    // Сотые доли округляются, поэтому сумма сходится не до знака.
    expect(Math.abs(parts.reduce((sum, part) => sum + part, 0) - 100)).toBeLessThan(0.1);
  });

  it('узкая графа не сжимается в строчку по букве', () => {
    const [number] = shares(wide.wordHtml);
    // «№» — один знак, но пол ширины не даёт графе стать вертикальной.
    expect(number).toBeGreaterThan(5);
  });

  it('длинное значение не съедает всю строку', () => {
    const long = buildDocumentExportRequest('word', {
      ...HEAD,
      tables: [table(['№', 'Примечание'], [['1', 'слово '.repeat(60)]])],
    });
    const [, note] = shares(long.wordHtml);
    // Потолок держит примечание: без него оно заняло бы почти сто процентов.
    expect(note).toBeLessThan(90);
  });

  it('раскладка жёсткая и слова переносятся — и в Word, и на печати', () => {
    for (const html of [wide.wordHtml ?? '', wide.html]) {
      expect(html).toContain('table-layout:fixed');
      expect(html).toContain('mso-table-layout-alt:fixed');
      expect(html).toContain('word-wrap:break-word');
      expect(html).toContain('<colgroup>');
    }
  });

  it('шапка повторяется на каждом листе', () => {
    expect(wide.wordHtml ?? '').toContain('thead{display:table-header-group}');
    expect(wide.wordHtml ?? '').toContain('<thead>');
  });

  it('лист развёрнут поперёк', () => {
    expect(wide.wordHtml ?? '').toContain('mso-page-orientation:landscape');
    expect(wide.html).toContain('size:A4 landscape');
  });
});
