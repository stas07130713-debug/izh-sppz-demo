/**
 * Эталонные тесты расчёта сроков (ТЗ, Дополнение 5, часть Р3).
 *
 * Это спецификация поведения движка: каждый вид периодичности из требований
 * заказчика проверен на конкретном входе и выходе. Если тест краснеет — либо
 * сломано поведение, либо эталон меняется осознанно и с объяснением
 * (AGENTS.md, раздел о проверке себя).
 */

import { describe, expect, it } from 'vitest';
import type { PeriodicityRule } from '@izh/contracts';
import { computeDue } from '../periodicity.js';

const TODAY = '2026-08-19';

function due(rule: PeriodicityRule, lastPerformedOn: string | null, extra: Record<string, unknown> = {}) {
  return computeDue({ rule, lastPerformedOn, today: TODAY, warnDaysBefore: 14, ...extra });
}

describe('интервальная периодичность', () => {
  it('раз в год считает от последнего выполнения', () => {
    const result = due({ kind: 'интервал', every: 1, unit: 'год' }, '2026-03-30');
    expect(result.nextDate).toBe('2027-03-30');
    expect(result.state).toBe('норма');
  });

  it('раз в 5 лет — перезарядка порошкового огнетушителя', () => {
    // ГОСТ Р 59641-2021, таблица 1 п. 5.1.11.1: порошок — 1 раз в 5 лет.
    const result = due({ kind: 'интервал', every: 5, unit: 'год' }, '2022-03-30');
    expect(result.nextDate).toBe('2027-03-30');
  });

  it('просроченный срок показывает, на сколько дней', () => {
    const result = due({ kind: 'интервал', every: 1, unit: 'год' }, '2025-03-30');
    expect(result.state).toBe('просрочено');
    expect(result.nextDate).toBe('2026-03-30');
    expect(result.daysToNext).toBeLessThan(0);
  });

  it('за две недели до срока состояние «скоро»', () => {
    const result = due({ kind: 'интервал', every: 1, unit: 'месяц' }, '2026-07-25');
    expect(result.nextDate).toBe('2026-08-25');
    expect(result.state).toBe('скоро');
  });

  it('интервал в днях: каждые 180 дней', () => {
    const result = due({ kind: 'интервал', every: 180, unit: 'день' }, '2026-08-01');
    expect(result.nextDate).toBe('2027-01-28');
  });

  it('без выполнений и без точки отсчёта срока нет', () => {
    const result = due({ kind: 'интервал', every: 1, unit: 'год' }, null);
    expect(result.state).toBe('нет данных');
    expect(result.reason).toContain('не от чего');
  });

  it('без выполнений считает от даты из карточки', () => {
    // Так работает перезарядка: пока проверок не было, отсчёт идёт от даты
    // изготовления или последней перезарядки из паспорта.
    const result = due({ kind: 'интервал', every: 1, unit: 'год' }, null, { baseline: '2026-01-15' });
    expect(result.nextDate).toBe('2027-01-15');
  });

  it('конец месяца прижимается к длине месяца, а не переносится вперёд', () => {
    // 31 января + 1 месяц — это 28 февраля, а не 3 марта: иначе проверка
    // выпала бы за пределы своего месяца.
    const result = due({ kind: 'интервал', every: 1, unit: 'месяц' }, '2026-01-31');
    expect(result.nextDate).toBe('2026-02-28');
  });
});

describe('календарная периодичность', () => {
  it('каждое 15 число: ближайшее будущее 15-е', () => {
    const result = due({ kind: 'календарь-месяц', dayOfMonth: 15 }, '2026-08-15');
    expect(result.nextDate).toBe('2026-09-15');
  });

  it('каждое 25 число: в этом же месяце, если ещё не наступило', () => {
    const result = due({ kind: 'календарь-месяц', dayOfMonth: 25 }, '2026-07-25');
    expect(result.nextDate).toBe('2026-08-25');
    expect(result.state).toBe('скоро');
  });

  it('«март и сентябрь» — весна и осень, а не полгода от выполнения', () => {
    // ППР РФ №1479, п. 48: проверка источников наружного противопожарного
    // водоснабжения — весной и осенью. Срок привязан к сезону, поэтому
    // выполнение с опозданием не сдвигает следующую проверку.
    const result = due({ kind: 'календарь-годовой', months: [3, 9], dayOfMonth: 1 }, '2026-04-20');
    expect(result.nextDate).toBe('2026-09-01');
  });

  it('после сентября следующая проверка — в марте будущего года', () => {
    const result = due({ kind: 'календарь-годовой', months: [3, 9], dayOfMonth: 1 }, '2026-09-10');
    expect(result.nextDate).toBe('2027-03-01');
  });
});

describe('событийная периодичность', () => {
  const afterRepair: PeriodicityRule = { kind: 'событие', trigger: 'после ремонта' };

  it('пока события не было, срока не существует', () => {
    const result = due(afterRepair, '2026-01-10');
    expect(result.state).toBe('нет данных');
    expect(result.reason).toContain('после ремонта');
    expect(result.nextDate).toBeNull();
  });

  it('событие произошло — работа назначена на его дату', () => {
    const result = due(afterRepair, null, { triggeredOn: '2026-08-01' });
    expect(result.nextDate).toBe('2026-08-01');
    expect(result.state).toBe('просрочено');
  });

  it('после события отработали — снова норма', () => {
    const result = due(afterRepair, '2026-08-05', { triggeredOn: '2026-08-01' });
    expect(result.state).toBe('норма');
    expect(result.reason).toContain('после события');
  });
});

describe('периодичности без расчётного срока', () => {
  it('«по необходимости» не бывает просроченной', () => {
    const result = due({ kind: 'по-необходимости' }, null);
    expect(result.state).toBe('нет данных');
    expect(result.reason).toContain('по необходимости');
  });

  it('срок службы берётся из карточки', () => {
    const result = due({ kind: 'срок-службы' }, null, { baseline: '2030-06-01' });
    expect(result.nextDate).toBe('2030-06-01');
    expect(result.state).toBe('норма');
  });

  it('без срока службы в карточке объясняет, чего не хватает', () => {
    const result = due({ kind: 'срок-службы' }, null);
    expect(result.state).toBe('нет данных');
    expect(result.reason).toContain('не указан');
  });
});

describe('устойчивость к плохим данным', () => {
  it('мусор вместо даты не роняет расчёт', () => {
    const result = due({ kind: 'интервал', every: 1, unit: 'год' }, 'не дата');
    expect(result.state).toBe('нет данных');
  });

  it('нулевой интервал не даёт бесконечного срока', () => {
    const result = due({ kind: 'интервал', every: 0, unit: 'месяц' }, '2026-01-01');
    expect(result.state).toBe('нет данных');
  });
});
