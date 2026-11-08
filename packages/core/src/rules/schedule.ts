/**
 * Расчёт регламентных сроков и статусов.
 *
 * Работает только с календарными датами-строками (`ГГГГ-ММ-ДД`), не с `Date` и
 * часовым поясом — правило из AGENTS.md: «Проверка 12.05.2026» не должна
 * сдвигаться из-за часового пояса компьютера, на котором открыли программу.
 *
 * Смотри docs/02_ТЗ_редакция_3.md, Дополнение 1, разделы Д6, Д11.
 */

import type { IsoDate } from '@izh/contracts';

/**
 * Регламентный статус мероприятия.
 *
 * Ровно та ось, которую называет часть Д6 и Д11 дополнения: статус — это
 * измерение отдельное от технического состояния (`TechnicalState` в
 * plan-objects.ts). Мероприятие может быть «нет данных» даже у полностью
 * исправного оборудования — если по нему просто ни разу не отчитались.
 */
export type ScheduleStatus = 'норма' | 'скоро' | 'просрочено' | 'нет данных';

export interface ScheduleResult {
  readonly status: ScheduleStatus;
  /** null — не вычисляется: либо периодичность не задана, либо нет ни одного выполнения. */
  readonly nextDate: IsoDate | null;
  readonly lastDate: IsoDate | null;
  /** Отрицательное число — сколько дней просрочено. Положительное — сколько дней в запасе. */
  readonly daysToNext: number | null;
}

/** Прибавляет месяцы к календарной дате, не трогая часовой пояс. */
export function addMonthsIso(date: IsoDate, months: number): IsoDate {
  const [year, month, day] = date.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Некорректная дата: ${date}`);
  }
  // UTC-полдень — подальше от полуночи, чтобы перевод часов на клиенте не
  // мог перекинуть дату на соседние сутки при выводе обратно в строку.
  const shifted = new Date(Date.UTC(year, month - 1 + months, day, 12));
  return shifted.toISOString().slice(0, 10);
}

/** Число дней от `from` до `to`. Отрицательное, если `to` раньше `from`. */
export function daysBetweenIso(from: IsoDate, to: IsoDate): number {
  const a = Date.parse(`${from}T12:00:00Z`);
  const b = Date.parse(`${to}T12:00:00Z`);
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export interface ComputeScheduleInput {
  readonly periodicityMonths: number | null;
  readonly lastPerformedOn: IsoDate | null;
  readonly today: IsoDate;
  /** Порог «скоро» в днях. Настраивается пользователем (Д11), по умолчанию — 2 недели. */
  readonly soonThresholdDays?: number;
}

/**
 * Считает следующую дату и статус.
 *
 * Мероприятие без единого выполнения — «нет данных», а не «просрочено»: это
 * рабочее задание, которое ещё не назначено календарно, а не нарушение сроков
 * (решение из документа 00, П2 — отсутствие записи не приравнивается к
 * неисправности, и по аналогии не приравнивается к просрочке).
 */
export function computeSchedule(input: ComputeScheduleInput): ScheduleResult {
  if (input.periodicityMonths === null || input.lastPerformedOn === null) {
    return { status: 'нет данных', nextDate: null, lastDate: input.lastPerformedOn, daysToNext: null };
  }

  return statusForDue({
    nextDate: addMonthsIso(input.lastPerformedOn, input.periodicityMonths),
    lastPerformedOn: input.lastPerformedOn,
    today: input.today,
    soonThresholdDays: input.soonThresholdDays,
  });
}

export interface StatusForDueInput {
  /** Уже посчитанный срок. null — периодичность не переводится в дату. */
  readonly nextDate: IsoDate | null;
  readonly lastPerformedOn: IsoDate | null;
  readonly today: IsoDate;
  readonly soonThresholdDays?: number;
}

/**
 * Переводит готовый срок в статус.
 *
 * Вынесено отдельно, потому что сроки считают двое: простой интервал в месяцах
 * (`computeSchedule`) и движок регламентов, который умеет сезонное окно, число
 * месяца и прочие виды из части Р2 Дополнения 5. Сама граница «норма — скоро —
 * просрочено» при этом обязана быть одна на всю программу: иначе один и тот же
 * элемент показывался бы в журнале и на плане по-разному.
 */
export function statusForDue(input: StatusForDueInput): ScheduleResult {
  if (input.nextDate === null) {
    return { status: 'нет данных', nextDate: null, lastDate: input.lastPerformedOn, daysToNext: null };
  }

  const daysToNext = daysBetweenIso(input.today, input.nextDate);
  const threshold = input.soonThresholdDays ?? 14;
  const status: ScheduleStatus = daysToNext < 0 ? 'просрочено' : daysToNext <= threshold ? 'скоро' : 'норма';

  return { status, nextDate: input.nextDate, lastDate: input.lastPerformedOn, daysToNext };
}
