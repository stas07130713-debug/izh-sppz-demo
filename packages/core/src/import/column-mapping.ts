/**
 * Сопоставление колонок чужого журнала с полями нашей модели.
 *
 * Требование Д13 ТЗ: сопоставление не должно зависеть от точного совпадения
 * названий — нужен словарь синонимов и нормализация. «№ ОТ», «№ огнетушителя»
 * и «инв. № ОТ» означают одно и то же.
 *
 * И главное правило оттуда же: **импортёр не угадывает молча.** Поэтому каждое
 * сопоставление несёт уровень уверенности, а мастер обязан показать его
 * пользователю до сохранения. Точное совпадение можно предлагать к
 * автоматическому принятию, догадку — только с подтверждением.
 */

/** Поле нашей модели, куда попадёт колонка. */
export type TargetField =
  | 'regNumber'
  | 'model'
  | 'placement'
  | 'responsible'
  | 'technicalState'
  | 'lastCheck'
  | 'lastRecharge'
  | 'note'
  /** Служебная колонка источника: номер по порядку, счётчики дней, подсказки. */
  | 'ignore';

export type MatchConfidence = 'высокая' | 'средняя' | 'низкая';

export interface ColumnMatch {
  /** Название колонки в источнике, как его увидел пользователь. */
  readonly sourceHeader: string;
  readonly target: TargetField;
  readonly confidence: MatchConfidence;
  /** Почему программа так решила — показывается в мастере. */
  readonly reason: string;
}

/**
 * Словарь синонимов: поле → признаки в заголовке источника.
 *
 * Ключевые слова, а не полные названия: заголовки в журнале заказчика
 * многословны («Ответственный должность, Ф.И.О», «Дата следующей ежегодной
 * проверки»), и требовать точного совпадения бессмысленно.
 */
const SYNONYMS: Readonly<Record<Exclude<TargetField, 'ignore'>, readonly string[]>> = {
  regNumber: ['номер огнетушителя', 'инв. №', 'инвентарный номер', '№ от', 'учётный номер', 'учетный номер', 'номер'],
  model: ['тип и марка', 'марка', 'модель', 'тип огнетушителя', 'обозначение'],
  placement: ['место установки', 'место размещения', 'помещение', 'расположение', 'место'],
  responsible: ['ответственный', 'ф.и.о', 'фио', 'должность'],
  technicalState: ['состояние', 'исправность', 'результат'],
  lastCheck: ['квартальная проверка', 'ежегодная проверка', 'дата проверки', 'проверка', 'осмотр'],
  lastRecharge: ['дата перезарядки', 'перезарядка'],
  note: ['примечание', 'комментарий'],
};

/** Заголовки, которые точно не переносятся: счётчики и служебные подсказки. */
const IGNORED: readonly string[] = [
  '№ п/п',
  'количество дней',
  'колличество дней',
  'дата следующей',
  'необходимо заполнить',
  'сегодня',
];

function normalizeHeader(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');
}

/**
 * Слова заголовка, укороченные на одно окончание.
 *
 * Заголовки склоняются: «Дата последней провер**ки**», «после перезаряд**ки**»,
 * «результат осмотр**а**». Сравнение по вхождению этого не понимает — оно ищет
 * «проверка» и не находит «проверки», хотя это то же слово. Отсюда и брался
 * отказ на самом обычном заголовке.
 *
 * Правило нарочно простое: у слова от пяти букв отсекается последняя буква.
 * Этого хватает на падежи, которые встречаются в заголовках, и это не
 * склеивает разные слова: «марка» и «место» после отсечения остаются разными.
 * Длинного разбора морфологии здесь не нужно — заголовков в журнале десяток.
 */
function stems(text: string): readonly string[] {
  return normalizeHeader(text)
    .split(/[^0-9a-zа-яё]+/iu)
    .filter((word) => word.length > 0)
    .map((word) => (word.length >= 5 ? word.slice(0, -1) : word));
}

/** Все слова признака нашлись в заголовке — пусть и не подряд. */
function hasAllWords(headerStems: readonly string[], key: string): boolean {
  const keyStems = stems(key);
  return keyStems.length > 0 && keyStems.every((word) => headerStems.includes(word));
}

/**
 * Подбирает поле для одной колонки.
 *
 * Порядок важен: сначала отсекается заведомо служебное (иначе «Дата следующей
 * проверки» попала бы в lastCheck как «проверка» и перезаписала бы факт
 * расчётным значением), потом ищется точное совпадение, потом вхождение.
 */
export function matchColumn(sourceHeader: string): ColumnMatch {
  const header = normalizeHeader(sourceHeader);

  // Пустой заголовок — это не «неизвестная колонка», а отсутствие колонки:
  // в реальном листе справа от таблицы тянутся десятки пустых столбцов.
  // Требовать по ним решения пользователя значит утопить отчёт в шуме.
  if (header === '') {
    return { sourceHeader, target: 'ignore', confidence: 'высокая', reason: 'Пустой столбец' };
  }

  for (const ignored of IGNORED) {
    if (header.includes(ignored)) {
      return {
        sourceHeader,
        target: 'ignore',
        confidence: 'высокая',
        reason: 'Служебная колонка источника: счётчик, подсказка или расчётное поле',
      };
    }
  }

  for (const [field, keys] of Object.entries(SYNONYMS) as [Exclude<TargetField, 'ignore'>, readonly string[]][]) {
    for (const key of keys) {
      if (header === key) {
        return { sourceHeader, target: field, confidence: 'высокая', reason: `Точное совпадение с «${key}»` };
      }
    }
  }

  for (const [field, keys] of Object.entries(SYNONYMS) as [Exclude<TargetField, 'ignore'>, readonly string[]][]) {
    for (const key of keys) {
      if (header.includes(key)) {
        return { sourceHeader, target: field, confidence: 'средняя', reason: `Заголовок содержит «${key}»` };
      }
    }
  }

  /*
   * Последняя попытка — по основам слов, вразбивку.
   *
   * «Дата последней проверки» не содержит ни «дата проверки», ни «проверка»
   * целиком: между словами вставлено ещё одно, а само слово склонено. Раньше
   * такой заголовок объявлялся нераспознанным, и дата последней проверки
   * молча уезжала в примечание — перенос истории не срабатывал вовсе.
   *
   * Уверенность здесь средняя: это догадка, и мастер обязан её показать.
   */
  const headerStems = stems(header);
  for (const [field, keys] of Object.entries(SYNONYMS) as [Exclude<TargetField, 'ignore'>, readonly string[]][]) {
    for (const key of keys) {
      if (hasAllWords(headerStems, key)) {
        return { sourceHeader, target: field, confidence: 'средняя', reason: `Заголовок говорит о «${key}»` };
      }
    }
  }

  return {
    sourceHeader,
    target: 'ignore',
    confidence: 'низкая',
    reason: 'Соответствие не найдено — колонку можно сохранить в примечание или пропустить',
  };
}

/**
 * Сопоставляет все колонки и помечает неоднозначности.
 *
 * Если на одно поле претендуют несколько колонок — так в журнале заказчика
 * «Квартальная проверка» и «Ежегодная проверка» обе означают дату проверки —
 * уверенность понижается, а в пояснении прямо сказано, что нужно выбрать.
 * Требование Д13 ТЗ: при неоднозначности программа обязана запрашивать
 * подтверждение, а не молча взять первую подходящую колонку.
 */
export function matchColumns(headers: readonly string[]): readonly ColumnMatch[] {
  const initial = headers.map(matchColumn);

  const countByTarget = new Map<TargetField, number>();
  for (const match of initial) {
    if (match.target === 'ignore') continue;
    countByTarget.set(match.target, (countByTarget.get(match.target) ?? 0) + 1);
  }

  return initial.map((match) => {
    if (match.target === 'ignore') return match;
    const count = countByTarget.get(match.target) ?? 0;
    if (count < 2) return match;
    return {
      ...match,
      confidence: 'низкая' as MatchConfidence,
      reason: `${match.reason}; на это же поле претендуют ещё ${count - 1} — выберите нужную колонку`,
    };
  });
}

/** Есть ли в сопоставлении неоднозначности, требующие решения пользователя. */
export function hasAmbiguity(matches: readonly ColumnMatch[]): boolean {
  return matches.some((match) => match.target !== 'ignore' && match.confidence === 'низкая');
}

/**
 * Ищет строку заголовков в листе.
 *
 * В журнале заказчика заголовки лежат в строке 2, 3 или 5 — над ними название
 * формы и ссылка на пункт ППР. Признак заголовка: несколько непустых ячеек, из
 * которых хотя бы часть узнаётся словарём. Так строка «Учет наличия…
 * (п.60 Правил…)» не будет принята за заголовок из-за единственной ячейки.
 */
export function detectHeaderRow(rows: readonly (readonly string[])[], maxLookahead = 10): number | null {
  let best: { index: number; score: number } | null = null;

  for (let i = 0; i < Math.min(rows.length, maxLookahead); i += 1) {
    const row = rows[i];
    if (row === undefined) continue;
    const filled = row.filter((cell) => cell.trim() !== '');
    if (filled.length < 3) continue;

    const recognized = filled.filter((cell) => matchColumn(cell).confidence !== 'низкая').length;
    const score = recognized;
    if (score >= 3 && (best === null || score > best.score)) best = { index: i, score };
  }

  return best === null ? null : best.index;
}
