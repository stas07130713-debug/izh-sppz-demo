/**
 * Расшифровка периодичности словами.
 *
 * Это то, что пользователь читает в конструкторе рядом с названием, поэтому
 * важны и склонения: «раз в 5 лет», а не «раз в 5 год».
 */

import { describe, expect, it } from 'vitest';
import { describePeriodicity } from './periodicity-text.js';

describe('расшифровка периодичности', () => {
  it('месяцы', () => {
    expect(describePeriodicity({ kind: 'интервал', every: 1, unit: 'месяц' })).toBe('раз в месяц');
    expect(describePeriodicity({ kind: 'интервал', every: 3, unit: 'месяц' })).toBe('раз в 3 месяца');
    expect(describePeriodicity({ kind: 'интервал', every: 12, unit: 'месяц' })).toBe('раз в год');
  });

  it('месяцы, кратные году, показываются годами', () => {
    // 60 месяцев в пакете правил — это «раз в 5 лет» на языке пользователя.
    expect(describePeriodicity({ kind: 'интервал', every: 60, unit: 'месяц' })).toBe('раз в 5 лет');
    expect(describePeriodicity({ kind: 'интервал', every: 24, unit: 'месяц' })).toBe('раз в 2 года');
  });

  it('склонения не ломаются на 11–14', () => {
    expect(describePeriodicity({ kind: 'интервал', every: 11, unit: 'год' })).toBe('раз в 11 лет');
    expect(describePeriodicity({ kind: 'интервал', every: 21, unit: 'день' })).toBe('раз в 21 день');
    expect(describePeriodicity({ kind: 'интервал', every: 180, unit: 'день' })).toBe('раз в 180 дней');
  });

  it('календарные сроки', () => {
    expect(describePeriodicity({ kind: 'календарь-месяц', dayOfMonth: 15 })).toBe('каждое 15 число месяца');
    expect(describePeriodicity({ kind: 'календарь-годовой', months: [3, 9], dayOfMonth: 1 })).toBe('в марте и сентябре');
  });

  it('сроки без расчётной даты объясняются словами', () => {
    expect(describePeriodicity({ kind: 'событие', trigger: 'после срабатывания' })).toBe('после срабатывания');
    expect(describePeriodicity({ kind: 'срок-службы' })).toContain('паспорт');
    expect(describePeriodicity({ kind: 'по-необходимости' })).toBe('по необходимости');
  });
});
