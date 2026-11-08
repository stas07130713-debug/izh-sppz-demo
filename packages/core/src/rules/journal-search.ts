/**
 * Поиск по журналу.
 *
 * Заказчик: «поисковая строка не обеспечивает нормальный поиск: вводишь
 * "извещатель пожарный", а записи не находятся».
 *
 * Причина была в том, **по чему** искали: по учётному номеру, марке и месту.
 * Наименования вида — того самого «Извещатель пожарный», которое человек и
 * видит в первой графе, — в поиске не было вовсе. Искали не по тому, что
 * написано на экране.
 *
 * Теперь правило такое:
 *
 *  — ищется по всему, что показано в строке журнала: наименование вида, вид
 *    системы, учётный номер, марка, место, ответственный, состояние, примечание;
 *  — запрос делится на слова, и **каждое** должно найтись. «пожарн изв» находит
 *    «Извещатель пожарный»: порядок слов не важен, а незаконченное слово ищется
 *    как начало;
 *  — регистр не важен, «ё» и «е» считаются одной буквой: в журналах пишут и так
 *    и так, а человек не обязан угадывать, как набрал прежний оператор.
 */

/** Приведение к виду, в котором сравнивают: без регистра и без «ё». */
function normalize(text: string): string {
  return text.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

/**
 * Подходит ли строка под запрос.
 *
 * Пустой запрос подходит всему: отбор не задан, и прятать записи не за что.
 */
export function matchesSearch(haystack: string, query: string): boolean {
  const words = normalize(query).split(' ').filter((word) => word !== '');
  if (words.length === 0) return true;

  const text = normalize(haystack);
  return words.every((word) => text.includes(word));
}

/** Из чего складывается искомая строка записи журнала. */
export interface JournalSearchParts {
  /** Наименование, как оно стоит в первой графе: вид или марка. */
  readonly name: string;
  /** Вид системы: «Огнетушитель», «Пожарный кран». */
  readonly kind: string;
  readonly regNumber: string | null;
  readonly model: string | null;
  readonly place: string | null;
  readonly responsible: string | null;
  readonly technicalState: string | null;
  readonly note: string | null;
}

/**
 * Всё, по чему ищется запись.
 *
 * Собирается из показанного, а не из полей хранилища: человек ищет то, что
 * видит на экране. Пустые части опускаются — они дали бы лишние пробелы, и
 * поиск по двум словам сработал бы там, где второго слова нет.
 */
export function journalSearchText(parts: JournalSearchParts): string {
  return [
    parts.name,
    parts.kind,
    parts.regNumber,
    parts.model,
    parts.place,
    parts.responsible,
    parts.technicalState,
    parts.note,
  ].filter((part) => part !== null && part.trim() !== '').join(' ');
}
