/**
 * Прогон импортёра на настоящем журнале заказчика.
 *
 * Пропускается, если файла нет: он лежит вне репозитория, в папке заказчика.
 * Запуск с файлом:
 *   IZH_JOURNAL="C:/.../Журнал.xlsx" npx vitest run tools/try-import.test.ts
 *
 * Зачем нужен именно такой тест. Эталонные тесты в packages/ проверяют
 * поведение на выписанных строках — они быстрые и работают всегда. Но реальный
 * файл содержит то, чего не придумаешь: 742 строки, 11 листов, подсказки в
 * дальних колонках, разбитый по фрагментам текст. Этот прогон показывает, что
 * движок и ядро встречают настоящие данные, а не только подготовленные.
 *
 * Читается тем же движком E7, что работает в программе, — расхождения
 * «в проверке одно, в приложении другое» быть не может.
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildImportPreview, detectHeaderRow, hasAmbiguity, matchColumns } from '@izh/core';
import { journalSourceEngine } from '@izh/engine-journal-source';

const JOURNAL = process.env.IZH_JOURNAL ?? '';
const available = JOURNAL !== '' && existsSync(JOURNAL);

describe.skipIf(!available)('импорт настоящего журнала', () => {
  it('читает листы, находит заголовок и строит предпросмотр', () => {
    const bytes = new Uint8Array(readFileSync(JOURNAL));

    expect(journalSourceEngine.detectKind(bytes)).toBe('xlsx');

    const workbook = journalSourceEngine.probeWorkbook(bytes);
    expect(workbook.ok).toBe(true);
    if (!workbook.ok) return;
    // eslint-disable-next-line no-console -- вывод и есть отчёт прогона
    console.log('листы:', workbook.value.sheetNames.join(', '));

    const sheet = journalSourceEngine.readSheet(bytes, 'Огнетушители');
    expect(sheet.ok).toBe(true);
    if (!sheet.ok) return;
    const rows = sheet.value.rows;
    // eslint-disable-next-line no-console
    console.log('строк на листе «Огнетушители»:', rows.length);

    const headerIndex = detectHeaderRow(rows);
    expect(headerIndex).not.toBeNull();
    if (headerIndex === null) return;

    const header = rows[headerIndex] ?? [];
    const matches = matchColumns(header);
    // eslint-disable-next-line no-console
    console.log(
      'сопоставление содержательных колонок:\n' +
        matches
          .filter((m) => m.target !== 'ignore')
          .map((m) => `  ${m.sourceHeader} → ${m.target} (${m.confidence})`)
          .join('\n'),
    );
    // eslint-disable-next-line no-console
    console.log('требуется решение пользователя:', hasAmbiguity(matches));

    const preview = buildImportPreview({
      rows,
      headerRowIndex: headerIndex,
      matches,
      existingObjects: [],
      baseTypeCode: 'extinguisher',
    });

    // eslint-disable-next-line no-console
    console.log(
      `итог: создать ${preview.toCreate}, пропустить ${preview.skipped}, дубликатов ${preview.duplicates}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      'первые 5 записей:\n' +
        preview.rows
          .filter((r) => r.verdict === 'создать')
          .slice(0, 5)
          .map((r) => `  стр.${r.sourceRow}: ${r.regNumber} ${r.model} [${r.typeCode}] ${r.placement} / ${r.lastCheck}`)
          .join('\n'),
    );

    const warned = preview.rows.filter((r) => r.warnings.length > 0);
    // eslint-disable-next-line no-console
    console.log(`строк с предупреждениями: ${warned.length}`);
    if (warned.length > 0) {
      // eslint-disable-next-line no-console
      console.log('  примеры: ' + warned.slice(0, 3).map((r) => `стр.${r.sourceRow} ${r.warnings[0]}`).join('; '));
    }

    expect(preview.toCreate).toBeGreaterThan(0);
  });

  it('читает все листы журнала без падений', () => {
    const bytes = new Uint8Array(readFileSync(JOURNAL));
    const workbook = journalSourceEngine.probeWorkbook(bytes);
    if (!workbook.ok) return;

    for (const name of workbook.value.sheetNames) {
      const sheet = journalSourceEngine.readSheet(bytes, name);
      expect(sheet.ok).toBe(true);
      if (!sheet.ok) continue;

      const headerIndex = detectHeaderRow(sheet.value.rows);
      const header = headerIndex === null ? [] : (sheet.value.rows[headerIndex] ?? []);
      const recognized = headerIndex === null ? 0 : matchColumns(header).filter((m) => m.target !== 'ignore').length;
      // eslint-disable-next-line no-console
      console.log(
        `  ${name}: строк ${sheet.value.rows.length}, заголовок ${headerIndex === null ? 'не найден' : `в строке ${headerIndex + 1}`}, узнано колонок ${recognized}`,
      );
    }
  });
});
