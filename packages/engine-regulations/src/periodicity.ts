/**
 * Расчёт сроков по правилу периодичности (ТЗ, Дополнение 5, часть Р3).
 *
 * Здесь заканчивается прежнее ограничение «раз в N месяцев». Заказчику нужны
 * ещё календарные сроки («каждое 15 число», «март и сентябрь») и событийные
 * («после срабатывания», «после ремонта»), и все они считаются одной функцией.
 *
 * Движок детерминирован (AGENTS.md, правило 3): сегодняшняя дата приходит
 * параметром, изнутри время не берётся. Иначе тесты были бы невоспроизводимы, а
 * расчёт сроков — именно то место, где ошибка стоит дороже всего.
 */

import type { IsoDate, PeriodicityRule } from '@izh/contracts';
import { addDays, addMonths, daysBetween, makeIso, parseIso } from './calendar.js';

/**
 * Состояние срока.
 *
 * Совпадает с прежними значениями `ScheduleStatus` ядра намеренно: журнал,
 * план и дашборд уже говорят на этом языке, и менять его заодно с движком
 * значило бы переписывать половину интерфейса без нужды.
 */
export type DueState = 'норма' | 'скоро' | 'просрочено' | 'нет данных';

export interface DueDate {
  readonly state: DueState;
  /** Плановая дата. null — у события и «по необходимости» её нет по существу. */
  readonly nextDate: IsoDate | null;
  readonly lastDate: IsoDate | null;
  /** Отрицательное — просрочено на столько дней. */
  readonly daysToNext: number | null;
  /** Почему срока нет: показывается вместо даты, чтобы пустота была объяснена. */
  readonly reason: string | null;
}

export interface DueInput {
  readonly rule: PeriodicityRule;
  /** Дата последнего выполнения. null — не выполнялось ни разу. */
  readonly lastPerformedOn: IsoDate | null;
  readonly today: IsoDate;
  /** За сколько дней до срока считать состояние «скоро». */
  readonly warnDaysBefore: number;
  /**
   * Дата, от которой считать срок, если выполнений ещё не было: ввод в
   * эксплуатацию, дата изготовления, дата последней перезарядки из паспорта.
   */
  readonly baseline?: IsoDate | null;
  /** Дата наступления события для событийной периодичности. */
  readonly triggeredOn?: IsoDate | null;
}

function unknown(reason: string, lastDate: IsoDate | null): DueDate {
  return { state: 'нет данных', nextDate: null, lastDate, daysToNext: null, reason };
}

/** Состояние по плановой дате: просрочено, скоро или норма. */
function stateFor(nextDate: IsoDate, today: IsoDate, warnDaysBefore: number, lastDate: IsoDate | null): DueDate {
  const daysToNext = daysBetween(today, nextDate);
  if (daysToNext === null) return unknown('Некорректная дата', lastDate);

  const state: DueState = daysToNext < 0 ? 'просрочено' : daysToNext <= warnDaysBefore ? 'скоро' : 'норма';
  return { state, nextDate, lastDate, daysToNext, reason: null };
}

/**
 * Ближайшая дата с указанным числом месяца, не раньше `from`.
 *
 * Если в этом месяце нужное число уже прошло, берётся следующий месяц.
 */
function nextMonthlyDay(from: IsoDate, dayOfMonth: number): IsoDate | null {
  const parts = parseIso(from);
  if (parts === null) return null;

  const thisMonth = makeIso(parts.year, parts.month, dayOfMonth);
  if (thisMonth >= from) return thisMonth;
  return makeIso(parts.year + (parts.month === 12 ? 1 : 0), parts.month === 12 ? 1 : parts.month + 1, dayOfMonth);
}

/**
 * Ближайшая дата из названных месяцев года, не раньше `from`.
 *
 * Пример заказчика — «март и сентябрь»: два раза в год в конкретные месяцы, а
 * не «раз в полгода от последней проверки». Разница существенная: проверка
 * источников наружного водоснабжения привязана к весне и осени (ППР РФ №1479,
 * п. 48), и сдвигать её вслед за фактической датой выполнения нельзя.
 */
function nextAnnualMonth(from: IsoDate, months: readonly number[], dayOfMonth: number): IsoDate | null {
  const parts = parseIso(from);
  if (parts === null || months.length === 0) return null;

  const sorted = [...months].filter((month) => month >= 1 && month <= 12).sort((a, b) => a - b);
  if (sorted.length === 0) return null;

  for (const month of sorted) {
    const candidate = makeIso(parts.year, month, dayOfMonth);
    if (candidate >= from) return candidate;
  }
  // В этом году названные месяцы уже прошли — берём первый в следующем.
  return makeIso(parts.year + 1, sorted[0] as number, dayOfMonth);
}

/**
 * Считает срок следующего выполнения и его состояние.
 *
 * Общее правило для всех видов: пока выполнять нечего или не от чего считать,
 * возвращается «нет данных» с объяснением, а не «просрочено». Отсутствие записи
 * — это несделанная работа, а не нарушение срока, и путать их нельзя.
 */
export function computeDue(input: DueInput): DueDate {
  const { rule, lastPerformedOn, today, warnDaysBefore } = input;
  const baseline = input.baseline ?? null;
  const from = lastPerformedOn ?? baseline;

  switch (rule.kind) {
    case 'интервал': {
      if (rule.every <= 0) return unknown('Интервал не задан', lastPerformedOn);
      if (from === null) return unknown('Ещё не выполнялось, отсчитывать не от чего', null);

      const next =
        rule.unit === 'день'
          ? addDays(from, rule.every)
          : addMonths(from, rule.unit === 'год' ? rule.every * 12 : rule.every);

      if (next === null) return unknown('Некорректная дата последнего выполнения', lastPerformedOn);
      return stateFor(next, today, warnDaysBefore, lastPerformedOn);
    }

    case 'календарь-месяц': {
      // Отсчёт от дня после последнего выполнения: иначе выполненная сегодня
      // работа тут же снова показалась бы назначенной на сегодня.
      const searchFrom = from === null ? today : addDays(from, 1) ?? today;
      const next = nextMonthlyDay(searchFrom > today ? searchFrom : today, rule.dayOfMonth);
      if (next === null) return unknown('Некорректное число месяца', lastPerformedOn);
      return stateFor(next, today, warnDaysBefore, lastPerformedOn);
    }

    case 'календарь-годовой': {
      const searchFrom = from === null ? today : addDays(from, 1) ?? today;
      const next = nextAnnualMonth(searchFrom > today ? searchFrom : today, rule.months, rule.dayOfMonth);
      if (next === null) return unknown('Не заданы месяцы выполнения', lastPerformedOn);
      return stateFor(next, today, warnDaysBefore, lastPerformedOn);
    }

    case 'событие': {
      const triggeredOn = input.triggeredOn ?? null;
      // События не произошло — работать не нужно, и это не «нет данных» в смысле
      // упущения: срока просто не существует.
      if (triggeredOn === null) return unknown(`Выполняется ${rule.trigger}`, lastPerformedOn);
      // Событие было, но после него уже отработали.
      if (lastPerformedOn !== null && lastPerformedOn >= triggeredOn) {
        return { state: 'норма', nextDate: null, lastDate: lastPerformedOn, daysToNext: null, reason: `Выполнено после события ${triggeredOn}` };
      }
      return stateFor(triggeredOn, today, warnDaysBefore, lastPerformedOn);
    }

    case 'срок-службы': {
      if (baseline === null) return unknown('Срок службы не указан в карточке', lastPerformedOn);
      return stateFor(baseline, today, warnDaysBefore, lastPerformedOn);
    }

    case 'по-необходимости':
      return unknown('Выполняется по необходимости', lastPerformedOn);
  }
}
