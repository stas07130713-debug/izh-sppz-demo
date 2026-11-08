/**
 * Перевод между строками базы и сущностями программы.
 *
 * Слой тонкий и намеренно скучный: он только раскладывает поля по колонкам и
 * обратно. Никаких правил здесь нет — правила живут в ядре, а хранилище обязано
 * отдать ровно то, что ему дали (AGENTS.md, правило 1).
 *
 * Три общих решения, из-за которых этот файл вообще существует.
 *
 * 1. **Дат и чисел в SQLite нет.** Даты хранятся строками в том же виде, в
 *    каком они приходят из программы (ISO), — так они и сравниваются, и
 *    сортируются лексикографически без всякого разбора.
 *
 * 2. **Истины и лжи тоже нет.** Признаки хранятся числами 0 и 1: это
 *    единственный способ, который понимают и SQLite, и человек, читающий базу
 *    сторонним просмотрщиком.
 *
 * 3. **`null` и `undefined` — разное.** В программе необязательное поле бывает
 *    `undefined` (его никогда не было) и `null` (его очистили). В базе и то и
 *    другое становится `NULL`; при чтении возвращается `null`, потому что
 *    именно так записаны необязательные поля в договорах.
 */

/** Строка из базы: значения приходят такими, какими их отдаёт драйвер. */
export type Row = Readonly<Record<string, unknown>>;

/** Текст или `null`. Пустая строка остаётся пустой строкой: её так и записали. */
export function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** Текст, которого не может не быть: имя, вид, состояние. */
export function required(value: unknown, field: string): string {
  const found = text(value);
  if (found === null) throw new Error(`В базе нет обязательного поля «${field}».`);
  return found;
}

export function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function integer(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

/** Признак: в базе 0 или 1, в программе — истина или ложь. */
export function flag(value: unknown, fallback = false): boolean {
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'boolean') return value;
  return fallback;
}

/** Число для записи: `null` остаётся пустотой, а не превращается в ноль. */
export function toNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function toFlag(value: boolean | null | undefined): number {
  return value === true ? 1 : 0;
}

/**
 * Составное значение колонкой JSON.
 *
 * Так хранится то, состав чего задаёт не схема базы, а предметная область:
 * чек-лист проверки, обводка помещения, отпечаток пароля. Разбирать их по
 * колонкам значило бы переписывать схему при каждом уточнении регламента.
 */
export function json<T>(value: unknown): T | null {
  const raw = text(value);
  if (raw === null || raw === '') return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    /*
     * Испорченное значение не подменяется пустым: пустой чек-лист читается как
     * «проверка проведена без замечаний», а это неправда. Пусть лучше запись
     * не прочтётся вовсе и об этом станет известно.
     */
    throw new Error('В базе повреждено составное значение.');
  }
}

/** То же, но для необязательного поля: нет значения — нет и записи. */
export function toJson(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

/** Обязательное составное значение: список, который бывает пустым, но есть всегда. */
export function jsonList<T>(value: unknown): readonly T[] {
  return json<readonly T[]>(value) ?? [];
}
