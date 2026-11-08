/**
 * Ранг тушения модельного очага пожара (ГОСТ Р 51057-2001, ГОСТ Р 51017-2009).
 *
 * Ранг — это то, чем огнетушители сравнивают между собой: «3A, 70B, C, E»
 * читается как «гасит очаг 3A класса А, очаг 70B класса B, годен для C и E».
 * Нормы ППР заданы именно рангами, поэтому проверка расстановки сводится к
 * сравнению ранга из карточки с рангом из таблицы 1.
 *
 * Ранг разбирается из строки, а не хранится числами: в паспорте он написан
 * строкой, человек вводит его как в паспорте, и хранить нужно то, что написано.
 * Разбор терпит и кириллицу — в документах заказчика «3А, 70В» набрано русскими
 * буквами, и отличить их на глаз нельзя.
 */

/** Класс пожара по ГОСТ 27331: A — твёрдые, B — жидкости, C — газы, D — металлы, E — электроустановки. */
export type FireClass = 'A' | 'B' | 'C' | 'D' | 'E';

export const FIRE_CLASSES: readonly FireClass[] = ['A', 'B', 'C', 'D', 'E'];

/**
 * Разобранный ранг.
 *
 * `null` — класс не заявлен вовсе; `0` — класс заявлен, но числовой ранг не
 * указан. Это разные вещи: «ОУ-5 класса B» без числа не подтверждает 55B, и
 * округлять такое до «подходит» нельзя.
 */
export interface FireRank {
  readonly a: number | null;
  readonly b: number | null;
  readonly c: boolean;
  readonly d: boolean;
  readonly e: boolean;
}

export const EMPTY_RANK: FireRank = { a: null, b: null, c: false, d: false, e: false };

/** Кириллические двойники латинских букв классов. */
const CYRILLIC: ReadonlyMap<string, string> = new Map([
  ['А', 'A'], ['В', 'B'], ['С', 'C'], ['Е', 'E'], ['Д', 'D'],
]);

function toLatin(text: string): string {
  let result = '';
  for (const char of text.toUpperCase()) result += CYRILLIC.get(char) ?? char;
  return result;
}

/**
 * Разбор строки ранга: «3A, 70B, C, E», «2А, 55В», «10A/233B», «55B,C,E».
 *
 * Возвращает пустой ранг, если разобрать нечего: пустая карточка — это
 * отсутствие сведений, а не подтверждение нулевого ранга.
 */
export function parseFireRank(text: string | null | undefined): FireRank {
  if (text === null || text === undefined) return EMPTY_RANK;

  let a: number | null = null;
  let b: number | null = null;
  let c = false;
  let d = false;
  let e = false;

  // Число перед буквой — ранг очага; буква без числа — заявленный класс.
  const tokens = toLatin(text).matchAll(/(\d+)?\s*([ABCDE])/g);
  for (const token of tokens) {
    const value = token[1] === undefined ? 0 : Number(token[1]);
    switch (token[2]) {
      case 'A': a = Math.max(a ?? 0, value); break;
      case 'B': b = Math.max(b ?? 0, value); break;
      case 'C': c = true; break;
      case 'D': d = true; break;
      case 'E': e = true; break;
      default: break;
    }
  }

  return { a, b, c, d, e };
}

/** Обратно в строку — так ранг показывается человеку и попадает в отчёт. */
export function formatFireRank(rank: FireRank): string {
  const parts: string[] = [];
  if (rank.a !== null) parts.push(rank.a > 0 ? `${rank.a}A` : 'A');
  if (rank.b !== null) parts.push(rank.b > 0 ? `${rank.b}B` : 'B');
  if (rank.c) parts.push('C');
  if (rank.d) parts.push('D');
  if (rank.e) parts.push('E');
  return parts.join(', ');
}

/**
 * Объединение требований по нескольким классам пожара.
 *
 * В помещении редко возможен один класс: для «А, В, Е» требования таблицы 1
 * складываются, и берётся наибольшее по каждому классу. Именно так получается
 * вывод из документов заказчика: «не ниже 3A, 70B, C, E» для В2–В4 и
 * «не ниже 2A, 55B, C, E» для Г и Д.
 */
export function mergeFireRanks(ranks: readonly FireRank[]): FireRank {
  let merged = EMPTY_RANK;
  for (const rank of ranks) {
    merged = {
      a: rank.a === null ? merged.a : Math.max(merged.a ?? 0, rank.a),
      b: rank.b === null ? merged.b : Math.max(merged.b ?? 0, rank.b),
      c: merged.c || rank.c,
      d: merged.d || rank.d,
      e: merged.e || rank.e,
    };
  }
  return merged;
}

/** Ранг пуст — сведений нет. Отличать от «ранг низкий»: это разные выводы. */
export function isEmptyRank(rank: FireRank): boolean {
  return rank.a === null && rank.b === null && !rank.c && !rank.d && !rank.e;
}

/**
 * Хватает ли фактического ранга под требуемый.
 *
 * ППР разрешает огнетушители более высокого ранга, чем предусмотрено
 * приложениями, поэтому сравнение односторонее: «не ниже», а не «равно».
 */
export function rankSatisfies(actual: FireRank, required: FireRank): boolean {
  if (required.a !== null && (actual.a === null || actual.a < required.a)) return false;
  if (required.b !== null && (actual.b === null || actual.b < required.b)) return false;
  if (required.c && !actual.c) return false;
  if (required.d && !actual.d) return false;
  if (required.e && !actual.e) return false;
  return true;
}

/** Чего именно не хватает — человеку нужно объяснение, а не «не подходит». */
export function rankShortfall(actual: FireRank, required: FireRank): readonly string[] {
  const missing: string[] = [];
  if (required.a !== null && (actual.a === null || actual.a < required.a)) {
    missing.push(`класс A не ниже ${required.a}A`);
  }
  if (required.b !== null && (actual.b === null || actual.b < required.b)) {
    missing.push(`класс B не ниже ${required.b}B`);
  }
  if (required.c && !actual.c) missing.push('класс C');
  if (required.d && !actual.d) missing.push('класс D');
  if (required.e && !actual.e) missing.push('класс E');
  return missing;
}
