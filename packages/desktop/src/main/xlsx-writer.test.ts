import { describe, expect, it } from 'vitest';
import { journalSourceEngine } from '@izh/engine-journal-source';
import type { JournalExportSheet } from '@izh/contracts';
import { createXlsx } from './xlsx-writer';

function sheet(name: string, rows: readonly (readonly string[])[]): JournalExportSheet {
  return {
    name,
    rows,
    rowKinds: ['шапка'],
    columnWidths: rows[0]?.map(() => 14) ?? [],
    frozenRows: 1,
  };
}

describe('книга Excel', () => {
  it('читается тем же движком, каким мы читаем чужие журналы', () => {
    const bytes = createXlsx([sheet('Журнал СППЗ', [
      ['№', 'Наименование', 'Дата'],
      ['1', 'Огнетушитель ОП-5', '20.08.2026'],
    ])]);

    expect(journalSourceEngine.detectKind(bytes)).toBe('xlsx');
    const workbook = journalSourceEngine.probeWorkbook(bytes);
    expect(workbook.ok).toBe(true);
    if (!workbook.ok) return;
    expect(workbook.value.sheetNames).toEqual(['Журнал СППЗ']);

    const read = journalSourceEngine.readSheet(bytes, 'Журнал СППЗ');
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.rows[1]).toEqual(['1', 'Огнетушитель ОП-5', '20.08.2026']);
  });

  it('каждый вид оборудования — своей вкладкой', () => {
    // Заказчик: «системы СППЗ разделены по вкладкам». Одной простынёй виды с
    // разными проверками не читаются: шапка подходит только первому из них.
    const bytes = createXlsx([
      sheet('Огнетушители', [['№'], ['1']]),
      sheet('Пожарные краны', [['№'], ['1']]),
    ]);

    const workbook = journalSourceEngine.probeWorkbook(bytes);
    expect(workbook.ok).toBe(true);
    if (!workbook.ok) return;
    expect(workbook.value.sheetNames).toEqual(['Огнетушители', 'Пожарные краны']);
  });

  it('имена вкладок укорачиваются и не повторяются', () => {
    // Excel не принимает имя длиннее 31 знака и не открывает книгу с двумя
    // одинаковыми — а названия видов бывают и длиннее, и совпадающими.
    const long = 'Установка порошкового пожаротушения модульная автономная';
    const bytes = createXlsx([sheet(long, [['a']]), sheet(long, [['b']])]);

    const workbook = journalSourceEngine.probeWorkbook(bytes);
    expect(workbook.ok).toBe(true);
    if (!workbook.ok) return;

    const [first, second] = workbook.value.sheetNames;
    expect(first?.length).toBeLessThanOrEqual(31);
    expect(second?.length).toBeLessThanOrEqual(31);
    expect(first).not.toBe(second);
  });
});
