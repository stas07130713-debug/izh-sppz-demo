/**
 * Разбор значений из ячеек Excel: даты, состояния, мусор.
 *
 * Всё, что здесь есть, взято из реального журнала заказчика
 * (`Образец существующих планов и журналов/Журнал.xlsx`), а не придумано:
 * даты лежат числами Excel (46203 = 12.07.2026), встречается текст
 * «дата не верна» вместо даты, справа от данных стоят подсказки
 * «Необходимо заполнить следующие пункты !», а часть строк — пустые заготовки
 * с одним номером по порядку.
 *
 * Правило Д13 ТЗ: импортёр не должен «угадывать молча». Поэтому каждая функция
 * возвращает не только результат, но и признак того, что значение было
 * распознано как непригодное — чтобы мастер показал это пользователю до
 * сохранения.
 */

/** Что получилось из ячейки с датой. */
export interface ParsedDate {
  /** Календарная дата ГГГГ-ММ-ДД или null, если значения нет либо оно непригодно. */
  readonly date: string | null;
  /**
   * Исходный текст, который не удалось понять как дату.
   *
   * Именно это показывается пользователю в отчёте: «в этой ячейке было
   * "дата не верна", запись создана без даты». Молча превратить в пустоту
   * нельзя — человек должен знать, что данные в источнике испорчены.
   */
  readonly rejected: string | null;
}

/**
 * Дата из ячейки Excel.
 *
 * Excel хранит даты числом дней от 30.12.1899 (нулевой день системы 1900 с
 * учётом её известной ошибки с 29.02.1900). Проверка диапазона отсекает
 * значения, которые датой быть не могут: например, номер огнетушителя,
 * случайно попавший в колонку даты.
 */
export function parseExcelDate(raw: string | number | null | undefined): ParsedDate {
  if (raw === null || raw === undefined) return { date: null, rejected: null };

  const text = String(raw).trim();
  if (text === '') return { date: null, rejected: null };

  const serial = Number(text.replace(',', '.'));
  if (Number.isFinite(serial)) {
    // 20000 ≈ 1954 год, 60000 ≈ 2064 год: за этими границами дата в журнале
    // эксплуатации почти наверняка означает ошибку ввода, а не реальный срок.
    if (serial < 20_000 || serial > 60_000) return { date: null, rejected: text };
    const epoch = Date.UTC(1899, 11, 30);
    const shifted = new Date(epoch + Math.round(serial) * 24 * 60 * 60 * 1000);
    return { date: shifted.toISOString().slice(0, 10), rejected: null };
  }

  // Текстовая дата вида 12.07.2026 или 2026-07-12 — тоже встречается.
  const dotted = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/.exec(text);
  if (dotted !== null) {
    const [, day, month, year] = dotted;
    return { date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, rejected: null };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return { date: text, rejected: null };

  return { date: null, rejected: text };
}

/**
 * Строки-заглушки, которые в журнале означают «здесь ничего нет».
 *
 * В присланном журнале это «ВПВ отсутствует», «Не входит в СПЗ объекта инв
 * № 580115» в колонке идентификации. Создавать по ним объекты нельзя: это
 * пометка человека, а не оборудование.
 */
const PLACEHOLDER_MARKERS: readonly string[] = [
  'отсутствует',
  'не входит',
  'нет данных',
  'необходимо заполнить',
  'дата не верна',
];

export function looksLikePlaceholder(raw: string | null | undefined): boolean {
  if (raw === null || raw === undefined) return false;
  const lowered = raw.trim().toLocaleLowerCase('ru');
  if (lowered === '') return false;
  return PLACEHOLDER_MARKERS.some((marker) => lowered.includes(marker));
}

/**
 * Техническое состояние из текста журнала.
 *
 * В журнале это «Исправен» / «Неисправен» из выпадающего списка. Всё
 * непонятное превращается в «не определено», а не угадывается: неверно
 * поставленное состояние — это ложное благополучие в отчёте.
 */
export function parseTechnicalState(raw: string | null | undefined): 'исправен' | 'неисправен' | 'требует ремонта' | 'не определено' {
  if (raw === null || raw === undefined) return 'не определено';
  const lowered = raw.trim().toLocaleLowerCase('ru');
  if (lowered.startsWith('исправ')) return 'исправен';
  if (lowered.startsWith('неисправ')) return 'неисправен';
  if (lowered.includes('ремонт')) return 'требует ремонта';
  return 'не определено';
}

/**
 * Нормализует обозначение типа: «ОП-5 (з) АВСЕ», «ОП 5», «оп-5» — это одно и то же.
 *
 * Требование Д10 ТЗ: единые справочники, чтобы «ОП-5», «ОП 5» и «оп5» не
 * стали тремя разными сущностями.
 */
export function normalizeModel(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const value = raw.trim().replace(/\s+/g, ' ');
  return value === '' ? null : value;
}

/**
 * Определяет подтип огнетушителя по марке.
 *
 * Периодичность перезарядки зависит от заряда (ГОСТ Р 59641-2021, таблица 1
 * п. 5.1.11.1), поэтому «ОП-5» должен стать порошковым, а не общим типом без
 * правил. Марки в журнале заказчика: ОП (порошковый), ОУ (углекислотный),
 * ОВ/ОВЭ (водный, воздушно-эмульсионный), ОВП (воздушно-пенный).
 *
 * Неизвестная марка даёт общий тип: пусть пользователь уточнит сам, чем
 * программа подставит неверный пятилетний срок вместо годового.
 */
export function detectExtinguisherType(model: string | null): string {
  if (model === null) return 'extinguisher';
  const upper = model.trim().toLocaleUpperCase('ru');
  if (/BONTEL|БОНТЕЛ|БОНТЕЛЬ/.test(upper)) return 'extinguisher-bantl';
  if (/^ОУ/.test(upper)) return 'extinguisher-co2';
  if (/^ОП/.test(upper)) return 'extinguisher-powder';
  if (/^ОВП/.test(upper)) return 'extinguisher-foam';
  if (/^(ОВЭ|ОВ)/.test(upper)) return 'extinguisher-water';
  return 'extinguisher';
}
