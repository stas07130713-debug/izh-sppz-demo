/**
 * Логические ограничения данных (ТЗ, Дополнение 7).
 *
 * Проверяется не только то, что нарушение находится, но и то, каким оно
 * считается. Разница существенная: запрет не даёт сохранить, предупреждение
 * лишь спрашивает. Ошибиться в сторону запрета так же плохо, как пропустить
 * нарушение, — программа станет отказывать там, где данные законны, и человек
 * начнёт обходить её любыми способами.
 */

import { describe, expect, it } from 'vitest';
import type { MaintenanceEvent, PlanObject, TreeNode } from '@izh/contracts';
import { blocking, warnings, type Problem } from '../validation/problem.js';
import { objectProblems } from '../validation/object-constraints.js';
import { maintenanceProblems } from '../validation/maintenance-constraints.js';
import { localDocumentProblems, periodicityProblems } from '../validation/regulation-constraints.js';

const TODAY = '2026-08-23';

const NODES: readonly TreeNode[] = [
  { id: 'org', parentId: null, kind: 'organization', name: 'П', archivedAt: null },
  { id: 'b1', parentId: 'org', kind: 'building', name: 'Корпус А', archivedAt: null },
  { id: 'f1', parentId: 'b1', kind: 'level', name: 'Этаж 1', archivedAt: null },
  { id: 'b2', parentId: 'org', kind: 'building', name: 'Корпус Б', archivedAt: null },
  { id: 'f2', parentId: 'b2', kind: 'level', name: 'Этаж 1', archivedAt: null },
] as unknown as readonly TreeNode[];

function object(patch: Partial<PlanObject>): PlanObject {
  return {
    id: 'obj', siteId: 'org', nodeId: 'f1', typeCode: 'extinguisher-powder',
    regNumber: null, commissionedOn: null, roomId: null, position: null,
    technicalState: 'исправен', archivedAt: null,
    ...patch,
  } as unknown as PlanObject;
}

function check(target: PlanObject, others: readonly PlanObject[] = []): readonly Problem[] {
  return objectProblems(target, { nodes: NODES, objects: [target, ...others], today: TODAY });
}

const messages = (problems: readonly Problem[]): string => problems.map((item) => item.message).join(' | ');

describe('А. даты жизненного цикла', () => {
  it('А1: постановка на учёт раньше изготовления — запрет', () => {
    const problems = check(object({
      commissionedOn: '2025-01-01',
      extinguisherProfile: { manufacturedOn: '2025-06-01' } as never,
    }));

    expect(blocking(problems).length).toBe(1);
    expect(messages(blocking(problems))).toContain('раньше даты изготовления');
  });

  it('А1: одинаковые даты нарушением не считаются', () => {
    // Изделие могли поставить на учёт в день изготовления.
    const problems = check(object({
      commissionedOn: '2025-06-01',
      extinguisherProfile: { manufacturedOn: '2025-06-01' } as never,
    }));

    expect(blocking(problems)).toEqual([]);
  });

  it('А2: перезарядка раньше изготовления — запрет', () => {
    const problems = check(object({
      extinguisherProfile: { manufacturedOn: '2025-06-01', lastRechargeOn: '2025-01-01' } as never,
    }));

    expect(messages(blocking(problems))).toContain('Дата перезарядки раньше даты изготовления');
  });

  it('А2: перезарядка раньше постановки на учёт нарушением не считается', () => {
    // Изделие могли перезарядить до того, как оно попало на этот объект.
    const problems = check(object({
      commissionedOn: '2026-05-01',
      extinguisherProfile: { manufacturedOn: '2024-01-01', lastRechargeOn: '2025-03-01' } as never,
    }));

    expect(blocking(problems)).toEqual([]);
  });

  it('А3–А4: изготовление и перезарядка в будущем — запрет', () => {
    const made = check(object({ extinguisherProfile: { manufacturedOn: '2027-01-01' } as never }));
    const recharged = check(object({ extinguisherProfile: { lastRechargeOn: '2027-01-01' } as never }));

    expect(blocking(made).length).toBe(1);
    expect(blocking(recharged).length).toBe(1);
  });

  it('А5: постановка на учёт в будущем — предупреждение, а не запрет', () => {
    // Так бывает при плановой установке: закупили и заводят заранее.
    const problems = check(object({ commissionedOn: '2026-12-01' }));

    expect(blocking(problems)).toEqual([]);
    expect(warnings(problems).length).toBe(1);
  });

  it('А6: срок службы вне 1–50 лет — запрет', () => {
    expect(blocking(check(object({ serviceLifeYears: 0 }))).length).toBe(1);
    expect(blocking(check(object({ serviceLifeYears: 120 }))).length).toBe(1);
    expect(blocking(check(object({ serviceLifeYears: 10 })))).toEqual([]);
  });
});

describe('В. числовые величины паспорта', () => {
  const withProfile = (profile: Record<string, unknown>): readonly Problem[] =>
    check(object({ extinguisherProfile: profile as never }));

  it('В1: давления вне порядка минимум ≤ номинал ≤ максимум', () => {
    expect(blocking(withProfile({ pressureMinMpa: 1.6, pressureMaxMpa: 1.2 })).length).toBe(1);
    expect(blocking(withProfile({ pressureMinMpa: 1.0, nominalPressureMpa: 0.8, pressureMaxMpa: 1.6 })).length).toBe(1);
    expect(blocking(withProfile({ pressureMinMpa: 1.0, nominalPressureMpa: 1.4, pressureMaxMpa: 1.6 }))).toEqual([]);
  });

  it('В2: масса корпуса не меньше полной — запрет', () => {
    expect(blocking(withProfile({ tareMassKg: 8, nominalFullMassKg: 6 })).length).toBe(1);
  });

  it('В3: нижняя температура не ниже верхней — запрет', () => {
    expect(blocking(withProfile({ temperatureMinC: 50, temperatureMaxC: -20 })).length).toBe(1);
  });

  it('В4: заряд не больше нуля — запрет', () => {
    expect(blocking(withProfile({ nominalCharge: 0 })).length).toBe(1);
  });
});

describe('Г. связи системы пожарной автоматики', () => {
  it('Г1: элемент не входит сам в себя', () => {
    const self = object({ id: 'x', typeCode: 'smoke-detector', systemId: 'x' });

    expect(blocking(check(self)).length).toBe(1);
  });

  it('Г2: прибор системы сам не может входить в другую систему', () => {
    const head = object({ id: 'ppku', typeCode: 'control-panel', systemId: 'other' });
    const unit = object({ id: 'd1', typeCode: 'smoke-detector', systemId: 'ppku' });

    expect(messages(blocking(check(unit, [head])))).toContain('подключается к прибору напрямую');
  });

  it('Г3: оборудование системы в другом здании — запрет', () => {
    const head = object({ id: 'ppku', typeCode: 'control-panel', nodeId: 'f2' });
    const unit = object({ id: 'd1', typeCode: 'smoke-detector', nodeId: 'f1', systemId: 'ppku' });

    expect(messages(blocking(check(unit, [head])))).toContain('в другом здании');
  });

  it('оборудование того же здания нарушением не считается', () => {
    const head = object({ id: 'ppku', typeCode: 'control-panel', nodeId: 'f1' });
    const unit = object({ id: 'd1', typeCode: 'smoke-detector', nodeId: 'f1', systemId: 'ppku' });

    expect(blocking(check(unit, [head]))).toEqual([]);
  });
});

describe('Д. место хранения комплекта', () => {
  it('Д1: цепочка из единиц запрещена', () => {
    const middle = object({ id: 'u1', typeCode: 'self-rescuer', placementId: 'head' });
    const tail = object({ id: 'u2', typeCode: 'self-rescuer', placementId: 'u1' });

    expect(messages(blocking(check(tail, [middle])))).toContain('не может быть местом хранения для другой');
  });

  it('Д2: в одном месте — оборудование одного вида', () => {
    const head = object({ id: 'head', typeCode: 'self-rescuer' });
    const alien = object({ id: 'u1', typeCode: 'extinguisher-powder', placementId: 'head' });

    expect(messages(blocking(check(alien, [head])))).toContain('одного вида');
  });
});

describe('Е. помещение и учётный номер', () => {
  it('Е1: помещение с другого этажа — запрет', () => {
    const problems = objectProblems(
      object({ roomId: 'r1' }),
      { nodes: NODES, objects: [], today: TODAY, rooms: [{ id: 'r1', levelId: 'f2' }] },
    );

    expect(messages(blocking(problems))).toContain('другому этажу');
  });

  it('Е2: повтор учётного номера в здании — предупреждение', () => {
    const twin = object({ id: 'other', regNumber: 'ОП-1', nodeId: 'f1' });
    const problems = check(object({ id: 'obj', regNumber: 'ОП-1', nodeId: 'f1' }), [twin]);

    expect(blocking(problems)).toEqual([]);
    expect(warnings(problems).length).toBe(1);
  });

  it('Е2: тот же номер в другом здании нарушением не считается', () => {
    const twin = object({ id: 'other', regNumber: 'ОП-1', nodeId: 'f2' });

    expect(check(object({ id: 'obj', regNumber: 'ОП-1', nodeId: 'f1' }), [twin])).toEqual([]);
  });
});

describe('Б. записи журнала', () => {
  const target = object({ commissionedOn: '2026-05-01', extinguisherProfile: { manufacturedOn: '2025-01-01' } as never });
  const context = (events: readonly MaintenanceEvent[] = []) => ({ object: target, events, today: TODAY });

  it('Б1: дата выполнения в будущем — запрет', () => {
    const problems = maintenanceProblems({ objectId: 'obj', activityCode: 'osmotr', performedOn: '2026-12-01' }, context());

    expect(messages(blocking(problems))).toContain('в будущем');
  });

  it('Б2: выполнение раньше изготовления — запрет', () => {
    const problems = maintenanceProblems({ objectId: 'obj', activityCode: 'osmotr', performedOn: '2024-06-01' }, context());

    expect(messages(blocking(problems))).toContain('раньше даты изготовления');
  });

  it('Б3: выполнение раньше постановки на учёт — предупреждение', () => {
    // При переносе старого журнала это норма: оборудование обслуживали и до
    // того, как завели в программе. Запрет сорвал бы перенос.
    const problems = maintenanceProblems({ objectId: 'obj', activityCode: 'osmotr', performedOn: '2026-02-01' }, context());

    expect(blocking(problems)).toEqual([]);
    expect(messages(warnings(problems))).toContain('переносе старого журнала');
  });

  it('Б4–Б5: акт в будущем — запрет, акт раньше работ — предупреждение', () => {
    const future = maintenanceProblems(
      { objectId: 'obj', activityCode: 'osmotr', performedOn: '2026-08-01', actDate: '2026-12-01' }, context(),
    );
    const early = maintenanceProblems(
      { objectId: 'obj', activityCode: 'osmotr', performedOn: '2026-08-01', actDate: '2026-07-01' }, context(),
    );

    expect(blocking(future).length).toBe(1);
    expect(blocking(early)).toEqual([]);
    expect(warnings(early).length).toBe(1);
  });

  it('Б6: та же работа в тот же день — предупреждение', () => {
    // Запретить нельзя: работу могли переделать после устранения замечания.
    const twin = { objectId: 'obj', activityCode: 'osmotr', performedOn: '2026-08-01' } as unknown as MaintenanceEvent;
    const problems = maintenanceProblems(
      { objectId: 'obj', activityCode: 'osmotr', performedOn: '2026-08-01' }, context([twin]),
    );

    expect(blocking(problems)).toEqual([]);
    expect(messages(warnings(problems))).toContain('уже есть запись');
  });
});

describe('Ж. регламенты и документы', () => {
  it('Ж1: периодичность вне пределов 1 месяц — 50 лет', () => {
    const make = (every: number, unit: 'месяц' | 'год') => ({
      id: 'p', title: 'Проверка', rule: { kind: 'интервал' as const, every, unit },
      enabled: true, activities: [], warnBeforeDays: null,
    } as never);

    expect(periodicityProblems(make(0, 'месяц')).length).toBe(1);
    expect(periodicityProblems(make(1000, 'год')).length).toBe(1);
    expect(periodicityProblems(make(6, 'месяц'))).toEqual([]);
    expect(periodicityProblems(make(5, 'год'))).toEqual([]);
  });

  it('Ж2: документ действует раньше своего утверждения — запрет', () => {
    expect(localDocumentProblems({ approvedOn: '2026-05-01', effectiveFrom: '2026-01-01' }).length).toBe(1);
    expect(localDocumentProblems({ approvedOn: '2026-01-01', effectiveFrom: '2026-05-01' })).toEqual([]);
  });
});
