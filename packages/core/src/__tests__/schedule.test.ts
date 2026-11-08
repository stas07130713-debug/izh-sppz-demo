/**
 * Эталонные тесты расчёта регламентных сроков.
 *
 * Таблица «дата последней работы → ожидаемая следующая дата и статус» — это и
 * есть спецификация поведения, о которой говорит AGENTS.md: посторонний
 * исполнитель понимает требуемое поведение по этим примерам, не читая
 * нормативных документов.
 */

import { describe, expect, it } from 'vitest';
import { addMonthsIso, computeSchedule, daysBetweenIso } from '../rules/schedule.js';

describe('прибавление месяцев к календарной дате', () => {
  it('не сдвигает день внутри месяца', () => {
    expect(addMonthsIso('2026-01-15', 1)).toBe('2026-02-15');
  });

  it('переходит через границу года', () => {
    expect(addMonthsIso('2026-12-01', 1)).toBe('2027-01-01');
  });

  it('прибавляет много месяцев разом', () => {
    expect(addMonthsIso('2026-01-01', 12)).toBe('2027-01-01');
  });
});

describe('разница в днях между календарными датами', () => {
  it('считает вперёд положительным числом', () => {
    expect(daysBetweenIso('2026-01-01', '2026-01-11')).toBe(10);
  });

  it('считает назад отрицательным числом', () => {
    expect(daysBetweenIso('2026-01-11', '2026-01-01')).toBe(-10);
  });
});

describe('расчёт статуса мероприятия', () => {
  it('без периодичности — «нет данных», дата не считается', () => {
    const result = computeSchedule({ periodicityMonths: null, lastPerformedOn: '2026-01-01', today: '2026-06-01' });
    expect(result).toEqual({ status: 'нет данных', nextDate: null, lastDate: '2026-01-01', daysToNext: null });
  });

  it('без единого выполнения — «нет данных», а не «просрочено»', () => {
    const result = computeSchedule({ periodicityMonths: 12, lastPerformedOn: null, today: '2026-06-01' });
    expect(result.status).toBe('нет данных');
    expect(result.nextDate).toBeNull();
  });

  it('до порога «скоро» — норма', () => {
    const result = computeSchedule({
      periodicityMonths: 1,
      lastPerformedOn: '2026-01-01',
      today: '2026-01-10',
      soonThresholdDays: 14,
    });
    expect(result.nextDate).toBe('2026-02-01');
    expect(result.status).toBe('норма');
  });

  it('внутри порога — скоро', () => {
    const result = computeSchedule({
      periodicityMonths: 1,
      lastPerformedOn: '2026-01-01',
      today: '2026-01-25',
      soonThresholdDays: 14,
    });
    // До 2026-02-01 осталось 7 дней — меньше порога в 14.
    expect(result.status).toBe('скоро');
    expect(result.daysToNext).toBe(7);
  });

  it('дата в прошлом — просрочено, с отрицательным числом дней', () => {
    const result = computeSchedule({
      periodicityMonths: 1,
      lastPerformedOn: '2026-01-01',
      today: '2026-02-15',
      soonThresholdDays: 14,
    });
    expect(result.status).toBe('просрочено');
    expect(result.daysToNext).toBe(-14);
  });

  it('порог «скоро» настраивается пользователем', () => {
    const result = computeSchedule({
      periodicityMonths: 1,
      lastPerformedOn: '2026-01-01',
      today: '2026-01-20',
      soonThresholdDays: 3,
    });
    // До 2026-02-01 осталось 12 дней — больше узкого порога в 3, значит норма.
    expect(result.status).toBe('норма');
  });
});
