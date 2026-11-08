/**
 * Динамика состояния: как менялось соотношение исправного и просроченного.
 *
 * Программа не хранит снимков состояния по дням, и это не упущение: состояние
 * не вводят, его вычисляют из сроков и записей журнала. Поэтому динамика
 * считается **задним числом**: на каждую дату берутся записи, сделанные не
 * позже неё, и по ним тем же правилом, что и на сегодня, определяется состояние
 * каждого элемента.
 *
 * У такого способа есть честная оговорка, и её нужно проговаривать в интерфейсе:
 * это **взгляд сегодняшними глазами**, а не то, что человек видел тогда. Если
 * периодичность работ с тех пор изменили, прошлое пересчитается по нынешней. Для
 * вопроса «стало лучше или хуже» этого достаточно — а именно за этим на график и
 * смотрят.
 *
 * Правило состояния не переписывается: берётся та же `worstObjectStatus`, что и
 * у сводки. Два независимых счёта однажды разошлись бы, и график спорил бы с
 * плитками над ним.
 */

import type { IsoDate, MaintenanceEvent, PlanObject } from '@izh/contracts';
import { worstObjectStatus } from './activity-status.js';
import type { ActivityScheduleSource } from './activity-source.js';
import type { ScheduleStatus } from './schedule.js';

export interface TrendPoint {
  readonly date: IsoDate;
  readonly counts: Readonly<Record<ScheduleStatus, number>>;
}

export interface DashboardTrendInput {
  readonly objects: readonly PlanObject[];
  readonly events: readonly MaintenanceEvent[];
  /** Последняя точка графика — обычно сегодня. */
  readonly today: IsoDate;
  readonly soonThresholdDays: number;
  readonly source: ActivityScheduleSource;
  /** Сколько дней назад начинается график. */
  readonly days: number;
  /** Шаг между точками в днях. Реже — короче счёт, чаще — подробнее график. */
  readonly stepDays?: number;
}

const EMPTY: Record<ScheduleStatus, number> = {
  'норма': 0, 'скоро': 0, 'просрочено': 0, 'нет данных': 0,
};

/** «2026-08-31» минус N дней, тем же календарём, что и остальные даты программы. */
function shiftDays(date: IsoDate, days: number): IsoDate {
  const at = new Date(`${date}T00:00:00.000Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/**
 * Считает точки графика от прошлого к сегодняшнему дню.
 *
 * Пустой набор объектов даёт пустой график, а не череду нулей: нули означали бы,
 * что оборудование есть и оно в порядке, — а его нет вовсе.
 */
export function dashboardTrend(input: DashboardTrendInput): readonly TrendPoint[] {
  if (input.objects.length === 0 || input.days <= 0) return [];

  const step = Math.max(1, Math.round(input.stepDays ?? Math.max(1, Math.round(input.days / 14))));
  const points: TrendPoint[] = [];

  for (let back = input.days; back >= 0; back -= step) {
    const date = shiftDays(input.today, -back);

    /*
     * На каждую дату видны только записи, сделанные не позже неё.
     *
     * Без этого отсечения проверка, проведённая вчера, «чинила» прошлый месяц
     * задним числом, и график показывал бы благополучие там, где его не было.
     */
    const known = input.events.filter((event) => event.performedOn <= date);

    const counts: Record<ScheduleStatus, number> = { ...EMPTY };
    for (const object of input.objects) {
      // Элемент, заведённый позже этой даты, в счёт не идёт: его тогда не было.
      if (object.createdAt.slice(0, 10) > date) continue;
      counts[worstObjectStatus(object, known, date, input.soonThresholdDays, input.source)] += 1;
    }
    points.push({ date, counts });
  }

  // Последняя точка — всегда сегодня, даже когда шаг не делит промежуток нацело:
  // график, обрывающийся за три дня до сегодня, читается как потеря данных.
  const last = points[points.length - 1];
  if (last === undefined || last.date !== input.today) {
    const known = input.events.filter((event) => event.performedOn <= input.today);
    const counts: Record<ScheduleStatus, number> = { ...EMPTY };
    for (const object of input.objects) {
      if (object.createdAt.slice(0, 10) > input.today) continue;
      counts[worstObjectStatus(object, known, input.today, input.soonThresholdDays, input.source)] += 1;
    }
    points.push({ date: input.today, counts });
  }

  return points;
}
