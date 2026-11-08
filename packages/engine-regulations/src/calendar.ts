/**
 * Работа с календарными датами для движка регламентов.
 *
 * Даты — строки `ГГГГ-ММ-ДД` без времени и часового пояса (AGENTS.md). Правило
 * жёсткое: «проверка 12.05.2026» не должна сдвигаться оттого, что программу
 * открыли в другом часовом поясе.
 *
 * Все вычисления идут через UTC-полдень. Полдень, а не полночь, выбран
 * намеренно: перевод часов и високосные секунды не могут перекинуть дату на
 * соседние сутки при обратном выводе в строку.
 */

import type { IsoDate } from '@izh/contracts';

const NOON = 'T12:00:00Z';

interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** Разбирает дату. Возвращает null на любом мусоре — бросать исключение движку нельзя. */
export function parseIso(date: IsoDate): DateParts | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function toIso(utcMillis: number): IsoDate {
  return new Date(utcMillis).toISOString().slice(0, 10);
}

/**
 * Собирает дату, прижимая номер дня к длине месяца.
 *
 * «Каждое 31 число» в феврале означает последний день февраля, а не 3 марта.
 * Сдвиг на следующий месяц был бы ошибкой: проверка выпала бы из своего периода.
 */
export function makeIso(year: number, month: number, dayOfMonth: number): IsoDate {
  const lastDay = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
  const day = Math.min(Math.max(dayOfMonth, 1), lastDay);
  return toIso(Date.UTC(year, month - 1, day, 12));
}

/** Прибавляет месяцы. Конец месяца прижимается так же, как в makeIso. */
export function addMonths(date: IsoDate, months: number): IsoDate | null {
  const parts = parseIso(date);
  if (parts === null) return null;

  const targetMonth = parts.month - 1 + months;
  const year = parts.year + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  return makeIso(year, month + 1, parts.day);
}

export function addDays(date: IsoDate, days: number): IsoDate | null {
  const parts = parseIso(date);
  if (parts === null) return null;
  return toIso(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12));
}

/** Число дней от `from` до `to`. Отрицательное, если `to` раньше. */
export function daysBetween(from: IsoDate, to: IsoDate): number | null {
  if (parseIso(from) === null || parseIso(to) === null) return null;
  const a = Date.parse(`${from}${NOON}`);
  const b = Date.parse(`${to}${NOON}`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

/** Сравнение дат как строк: формат ГГГГ-ММ-ДД для этого и выбран. */
export function isBefore(left: IsoDate, right: IsoDate): boolean {
  return left < right;
}

export function isAfter(left: IsoDate, right: IsoDate): boolean {
  return left > right;
}
