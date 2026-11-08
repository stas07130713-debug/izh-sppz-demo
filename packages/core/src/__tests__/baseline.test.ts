/**
 * Исходная дата регламентной работы (ТЗ, Дополнение 6, часть А3).
 *
 * Программа определяет её сама: ручной галочки «считать отсюда» в системе нет.
 * Она перекладывала бы на человека решение, которое он принимает раз в жизни и
 * обычно неверно, — а ошибка в исходной дате сдвигает все последующие сроки
 * разом.
 *
 * Порядок: запись о выполнении → исходная дата по виду работы → ничего.
 */

import { describe, expect, it } from 'vitest';
import type { MaintenanceEvent, PlanObject } from '@izh/contracts';
import { activitiesFor, activityCellsForObject, rulePackageSource } from '../index.js';

function object(patch: Partial<PlanObject>): PlanObject {
  return {
    id: 'obj', siteId: 'org', nodeId: 'f1', typeCode: 'fire-hydrant-indoor',
    regNumber: '1', commissionedOn: null, position: null,
    technicalState: 'исправен', archivedAt: null,
    ...patch,
  } as unknown as PlanObject;
}

function event(activityCode: string, performedOn: string): MaintenanceEvent {
  return {
    id: `e-${activityCode}`, siteId: 'org', objectId: 'obj', activityCode, performedOn,
    result: 'выполнено', checklist: [], defect: null, executor: null, note: null,
    createdAt: `${performedOn}T09:00:00.000Z`,
  } as unknown as MaintenanceEvent;
}

function cells(source: PlanObject, events: readonly MaintenanceEvent[] = []) {
  return activityCellsForObject(source, events, '2026-08-23', 14, rulePackageSource);
}

describe('обычная эксплуатационная работа', () => {
  it('первый срок = дата постановки на учёт плюс периодичность', () => {
    // Пример заказчика: кран поставлен 15.08.2026, осмотр раз в полгода,
    // проверка работоспособности раз в год.
    const kran = object({ commissionedOn: '2026-08-15' });
    const byCode = new Map(cells(kran).map((cell) => [cell.rule.activityCode, cell]));

    const osmotr = byCode.get('osmotr');
    expect(osmotr?.rule.periodicityMonths).toBe(1);
    expect(osmotr?.schedule.lastDate).toBe('2026-08-15');
    expect(osmotr?.schedule.nextDate).toBe('2026-09-15');
  });

  it('срок считается от постановки на учёт по каждой работе своей периодичностью', () => {
    const kran = object({ commissionedOn: '2026-08-15' });
    for (const cell of cells(kran)) {
      const months = cell.rule.periodicityMonths ?? 1;
      expect(cell.schedule.lastDate, cell.rule.activityCode).toBe('2026-08-15');
      expect(cell.schedule.nextDate, cell.rule.activityCode).not.toBeNull();
      expect(months).toBeGreaterThan(0);
    }
  });

  it('без даты постановки на учёт срок не считается', () => {
    // Придуманная дата хуже честной пустоты: по ней примут решение.
    expect(cells(object({})).every((cell) => cell.schedule.status === 'нет данных')).toBe(true);
  });
});

describe('работа, привязанная к возрасту изделия', () => {
  const ognetushitel = object({
    typeCode: 'extinguisher-powder',
    commissionedOn: '2026-05-10',
    extinguisherProfile: { manufacturedOn: '2025-05-10', lastRechargeOn: null } as never,
  });

  it('перезарядка считается от даты изготовления, а не от размещения', () => {
    // Пример заказчика: изготовлен 10.05.2025, поставлен 10.05.2026,
    // перезарядка раз в 5 лет → 10.05.2030, а не 10.05.2031.
    const recharge = cells(ognetushitel).find((cell) => cell.rule.activityCode === 'perezaryadka');

    expect(recharge?.rule.periodicityMonths).toBe(60);
    expect(recharge?.schedule.lastDate).toBe('2025-05-10');
    expect(recharge?.schedule.nextDate).toBe('2030-05-10');
  });

  it('эксплуатационный осмотр того же огнетушителя считается от размещения', () => {
    // Осматривать начинают, когда изделие появилось на объекте.
    const yearly = cells(ognetushitel).find((cell) => cell.rule.activityCode === 'ezhegodnaya-proverka');

    expect(yearly?.schedule.lastDate).toBe('2026-05-10');
  });

  it('фактическая перезарядка из паспорта вытесняет дату изготовления', () => {
    // Она такая же запись о выполнении, как запись журнала.
    const recharged = object({
      typeCode: 'extinguisher-powder',
      commissionedOn: '2026-05-10',
      extinguisherProfile: { manufacturedOn: '2025-05-10', lastRechargeOn: '2027-03-01' } as never,
    });

    const recharge = cells(recharged).find((cell) => cell.rule.activityCode === 'perezaryadka');
    expect(recharge?.schedule.lastDate).toBe('2027-03-01');
    expect(recharge?.schedule.nextDate).toBe('2032-03-01');
  });

  it('к возрасту привязаны только работы по корпусу и заряду', () => {
    const byAge = activitiesFor('extinguisher-co2')
      .filter((rule) => rule.baselineKind === 'изготовление')
      .map((rule) => rule.activityCode);

    expect(byAge.sort()).toEqual(['gidroispytanie', 'perezaryadka', 'vzveshivanie']);
  });
});

describe('запись о выполнении важнее любой исходной даты', () => {
  it('считается от последнего выполнения', () => {
    const kran = object({ commissionedOn: '2026-01-01' });
    const osmotr = cells(kran, [event('osmotr', '2026-08-01')])
      .find((cell) => cell.rule.activityCode === 'osmotr');

    expect(osmotr?.schedule.lastDate).toBe('2026-08-01');
    expect(osmotr?.schedule.nextDate).toBe('2026-09-01');
  });

  it('выполнение одной работы не сбрасывает циклы остальных', () => {
    // У крана осмотр, испытание и перекатка — независимые события со своими
    // датами. Закрыв осмотр, нельзя сдвинуть перекатку.
    const kran = object({ commissionedOn: '2026-01-01' });
    const after = cells(kran, [event('osmotr', '2026-08-01')]);

    const osmotr = after.find((cell) => cell.rule.activityCode === 'osmotr');
    const perekatka = after.find((cell) => cell.rule.activityCode === 'perekatka');

    expect(osmotr?.schedule.lastDate).toBe('2026-08-01');
    // Перекатка выполнялась? Нет — значит, по-прежнему от постановки на учёт.
    expect(perekatka?.schedule.lastDate).toBe('2026-01-01');
  });

  it('у каждой работы свой независимый цикл', () => {
    const kran = object({ commissionedOn: '2026-01-01' });
    const after = cells(kran, [event('osmotr', '2026-08-01'), event('perekatka', '2026-03-15')]);

    expect(after.find((c) => c.rule.activityCode === 'osmotr')?.schedule.lastDate).toBe('2026-08-01');
    expect(after.find((c) => c.rule.activityCode === 'perekatka')?.schedule.lastDate).toBe('2026-03-15');
  });
});
