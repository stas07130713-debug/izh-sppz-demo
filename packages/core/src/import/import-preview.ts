/**
 * Предпросмотр импорта: что именно будет создано, прежде чем что-то создано.
 *
 * Требование Д12 ТЗ: «До окончательного импорта показывать предпросмотр
 * результата и количество создаваемых объектов», «Обнаруживать дубликаты»,
 * «Не перезаписывать существующие записи молча», «Неизвестные столбцы не
 * удалять».
 *
 * Здесь только вычисления: строки на входе, разобранный план импорта на
 * выходе. Ни одной записи не сохраняется — сохранение делает интерфейс, вызывая
 * обычные сценарии `placeObject` и `recordMaintenance` после подтверждения
 * пользователем.
 */

import type { PlanObject } from '@izh/contracts';
import { detectExtinguisherType, looksLikePlaceholder, normalizeModel, parseExcelDate, parseTechnicalState } from './excel-values.js';
import type { ColumnMatch, TargetField } from './column-mapping.js';

/** Что делать со строкой источника. */
export type RowVerdict =
  /** Создать объект. */
  | 'создать'
  /** Пропустить: строка-заготовка без данных или пометка человека. */
  | 'пропустить'
  /** Учётный номер уже есть в программе — нужно решение пользователя. */
  | 'дубликат';

export interface PreviewRow {
  /** Номер строки в исходном листе — чтобы пользователь нашёл её глазами. */
  readonly sourceRow: number;
  readonly verdict: RowVerdict;
  readonly typeCode: string;
  readonly regNumber: string | null;
  readonly model: string | null;
  readonly placement: string | null;
  readonly responsible: string | null;
  readonly technicalState: PlanObject['technicalState'];
  /** Дата последней проверки — станет мероприятием, а не полем карточки. */
  readonly lastCheck: string | null;
  /**
   * Заголовок колонки, из которой взята дата проверки.
   *
   * Нужен переносу: «Ежегодная проверка» и «Квартальный осмотр» — разные
   * работы, и по одной дате их не различить. Заголовок говорит прямо, какая
   * это была проверка, и запись ложится в свою колонку журнала.
   */
  readonly checkHeader: string | null;
  readonly lastRecharge: string | null;
  /**
   * Что программа не смогла разобрать в этой строке.
   *
   * Не ошибка импорта, а сведения для пользователя: «в колонке даты было
   * "дата не верна"». Строка всё равно создаётся, но без этой даты.
   */
  readonly warnings: readonly string[];
  /** Значения неизвестных колонок — уйдут в примечание, а не потеряются. */
  readonly note: string | null;
}

export interface ImportPreview {
  readonly rows: readonly PreviewRow[];
  readonly toCreate: number;
  readonly duplicates: number;
  readonly skipped: number;
  /** Колонки, для которых сопоставление не найдено: их значения идут в примечание. */
  readonly unmappedHeaders: readonly string[];
}

export interface BuildPreviewInput {
  /** Строки листа целиком, включая заголовок. */
  readonly rows: readonly (readonly string[])[];
  readonly headerRowIndex: number;
  readonly matches: readonly ColumnMatch[];
  /** Уже существующие объекты организации — для поиска дубликатов по учётному номеру. */
  readonly existingObjects: readonly PlanObject[];
  /** Базовый тип оборудования листа: лист «Огнетушители» → extinguisher и так далее. */
  readonly baseTypeCode: string;
}

/**
 * Совпадает ли строка с рядом заголовков.
 *
 * Достаточно двух совпадений подряд идущих непустых ячеек: полное совпадение
 * требовать нельзя, потому что у второй таблицы на листе часть колонок своя
 * («Взвешивание углекислотных огнетушителей» вместо «Состояние»).
 */
function isRepeatedHeader(row: readonly string[], header: readonly string[]): boolean {
  let matched = 0;
  for (let i = 0; i < header.length; i += 1) {
    const headerCell = header[i]?.trim();
    const rowCell = row[i]?.trim();
    if (headerCell === undefined || headerCell === '' || rowCell === undefined || rowCell === '') continue;
    if (headerCell === rowCell) matched += 1;
  }
  return matched >= 2;
}

function valueOf(row: readonly string[], matches: readonly ColumnMatch[], target: TargetField): string | null {
  for (let i = 0; i < matches.length; i += 1) {
    if (matches[i]?.target !== target) continue;
    const value = row[i];
    if (value !== undefined && value.trim() !== '') return value.trim();
  }
  return null;
}

/**
 * Собирает план импорта.
 *
 * Тип оборудования уточняется по марке: лист «Огнетушители» даёт базовый тип,
 * а «ОП-5» превращает его в порошковый — иначе объект попал бы в журнал без
 * применимых мероприятий (у общего типа пакета правил нет намеренно).
 */
export function buildImportPreview(input: BuildPreviewInput): ImportPreview {
  const takenNumbers = new Set(
    input.existingObjects
      .filter((object) => object.archivedAt === null && object.regNumber !== null)
      .map((object) => object.regNumber),
  );
  /** Номера внутри самого файла: два одинаковых номера в одном журнале — тоже конфликт. */
  const seenInFile = new Set<string>();

  const unmappedHeaders = input.matches
    .filter((match) => match.target === 'ignore' && match.confidence === 'низкая')
    .map((match) => match.sourceHeader);

  const rows: PreviewRow[] = [];

  for (let i = input.headerRowIndex + 1; i < input.rows.length; i += 1) {
    const row = input.rows[i];
    if (row === undefined) continue;

    const warnings: string[] = [];

    const regNumber = valueOf(row, input.matches, 'regNumber');
    const rawModel = valueOf(row, input.matches, 'model');
    const model = normalizeModel(rawModel);
    const placement = valueOf(row, input.matches, 'placement');
    const responsible = valueOf(row, input.matches, 'responsible');

    const stateRaw = valueOf(row, input.matches, 'technicalState');
    const checkRaw = valueOf(row, input.matches, 'lastCheck');
    const rechargeRaw = valueOf(row, input.matches, 'lastRecharge');

    const check = parseExcelDate(checkRaw);
    if (check.rejected !== null) warnings.push(`Дата проверки не распознана: «${check.rejected}»`);
    const recharge = parseExcelDate(rechargeRaw);
    if (recharge.rejected !== null) warnings.push(`Дата перезарядки не распознана: «${recharge.rejected}»`);

    const noteParts: string[] = [];
    for (let c = 0; c < input.matches.length; c += 1) {
      const match = input.matches[c];
      if (match === undefined || match.target !== 'ignore' || match.confidence !== 'низкая') continue;
      const value = row[c];
      if (value !== undefined && value.trim() !== '') noteParts.push(`${match.sourceHeader}: ${value.trim()}`);
    }

    /**
     * Строка-заготовка.
     *
     * Определяется по отсутствию и учётного номера, и марки: только они
     * опознают единицу оборудования. Место установки этого не делает — в
     * настоящем журнале заказчика сотни строк-заготовок содержат формулы,
     * считающие даты, и мусор в колонке места (например «7»), но самого
     * огнетушителя за ними нет. Если создавать по ним объекты, журнал
     * заполнится записями, которых не существует.
     */
    const empty = regNumber === null && model === null;

    const placeholder =
      looksLikePlaceholder(regNumber) || looksLikePlaceholder(placement) || looksLikePlaceholder(rawModel);

    /**
     * Повторный заголовок в середине листа.
     *
     * На одном листе журнала заказчика подряд идут несколько таблиц («Учёт
     * наличия», «Взвешивание углекислотных огнетушителей»), и у каждой свой
     * ряд заголовков. Такую строку легко принять за оборудование с маркой
     * «Тип и марка огнетушителя».
     */
    const repeatedHeader = isRepeatedHeader(row, input.rows[input.headerRowIndex] ?? []);

    let verdict: RowVerdict = 'создать';
    if (empty || placeholder || repeatedHeader) verdict = 'пропустить';
    else if (regNumber !== null && (takenNumbers.has(regNumber) || seenInFile.has(regNumber))) verdict = 'дубликат';

    if (verdict === 'создать' && regNumber !== null) seenInFile.add(regNumber);

    const typeCode =
      input.baseTypeCode === 'extinguisher' ? detectExtinguisherType(model) : input.baseTypeCode;

    rows.push({
      sourceRow: i + 1,
      verdict,
      typeCode,
      regNumber,
      model,
      placement,
      responsible,
      technicalState: parseTechnicalState(stateRaw),
      lastCheck: check.date,
      checkHeader: input.matches.find((match) => match.target === 'lastCheck')?.sourceHeader ?? null,
      lastRecharge: recharge.date,
      warnings,
      note: noteParts.length === 0 ? null : noteParts.join('; '),
    });
  }

  return {
    rows,
    toCreate: rows.filter((row) => row.verdict === 'создать').length,
    duplicates: rows.filter((row) => row.verdict === 'дубликат').length,
    skipped: rows.filter((row) => row.verdict === 'пропустить').length,
    unmappedHeaders,
  };
}
