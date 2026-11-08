/**
 * Сохранение карточки объекта.
 *
 * Появился после сообщения заказчика «кнопка сохранить не работает». Проверяет
 * не кнопку, а то, что за ней: доходят ли до хранилища все поля карточки и
 * начинают ли от сохранённой даты считаться сроки.
 *
 * Отдельный файл нужен потому, что ошибка была именно в передаче: сценарий
 * работал, форма собирала данные, а между ними терялись поля, которых в вызове
 * просто не было. Такую потерю не ловит ни один тест сценария — он получает то,
 * что ему передали.
 */

import { describe, expect, it } from 'vitest';
import type { PlanObject } from '@izh/contracts';
import type { ObjectDeps } from '../objects/object-deps.js';
import { placeObject, updateObject } from '../objects/object-scenarios.js';
import { activityCellsForObject, rulePackageSource } from '../index.js';
import { fakeClock, fakeIdGenerator, fakePlanObjectRepository } from './test-doubles.js';
import { makeSampleTree, makeTreeDeps, value } from './tree-fixtures.js';

async function makeFixture(typeCode: string) {
  const treeDeps = makeTreeDeps();
  const tree = await makeSampleTree(treeDeps);
  const objects = fakePlanObjectRepository();
  const deps: ObjectDeps = { objects, tree: treeDeps.tree, clock: fakeClock(), ids: fakeIdGenerator() };
  const object = value<PlanObject>(
    await placeObject(deps, { nodeId: tree.level.id, typeCode, position: { x: 2, y: 2 } }),
  );
  return { deps, object };
}

describe('карточка сохраняется целиком', () => {
  it('дата постановки на учёт доходит до хранилища', async () => {
    // Без неё не считается ни один срок: элемент навсегда остаётся «нет данных».
    const { deps, object } = await makeFixture('fire-hydrant-indoor');

    const saved = value<PlanObject>(
      await updateObject(deps, { id: object.id, commissionedOn: '2026-08-15' }),
    );

    expect(saved.commissionedOn).toBe('2026-08-15');
    expect(value<PlanObject>(await deps.objects.getById(object.id)).commissionedOn).toBe('2026-08-15');
  });

  it('после сохранения даты сроки начинают считаться', async () => {
    const { deps, object } = await makeFixture('fire-hydrant-indoor');
    const saved = value<PlanObject>(
      await updateObject(deps, { id: object.id, commissionedOn: '2026-08-15' }),
    );

    const cells = activityCellsForObject(saved, [], '2026-08-23', 14, rulePackageSource);

    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((cell) => cell.schedule.status !== 'нет данных')).toBe(true);
    expect(cells.every((cell) => cell.schedule.nextDate !== null)).toBe(true);
  });

  it('поля карточки пожарного крана не теряются', async () => {
    // Именно здесь была потеря: сценарий их принимал, а вызов не передавал.
    const { deps, object } = await makeFixture('fire-hydrant-indoor');

    const saved = value<PlanObject>(await updateObject(deps, {
      id: object.id,
      hydrantProfile: {
        valveBore: 'Ду 65', hoseDiameter: '66 мм', couplingHead: 'ГР-70', nozzleBore: '19 мм',
      },
    }));

    expect(saved.hydrantProfile?.valveBore).toBe('Ду 65');
    expect(value<PlanObject>(await deps.objects.getById(object.id)).hydrantProfile?.nozzleBore).toBe('19 мм');
  });

  it('правка одного поля не стирает остальные', async () => {
    const { deps, object } = await makeFixture('fire-hydrant-indoor');
    await updateObject(deps, { id: object.id, regNumber: 'ПК-12', commissionedOn: '2026-08-15' });

    const saved = value<PlanObject>(await updateObject(deps, { id: object.id, note: 'у выхода' }));

    expect(saved.regNumber).toBe('ПК-12');
    expect(saved.commissionedOn).toBe('2026-08-15');
    expect(saved.note).toBe('у выхода');
  });

  it('дата изготовления огнетушителя сохраняется и меняет срок перезарядки', async () => {
    const { deps, object } = await makeFixture('extinguisher-powder');

    const saved = value<PlanObject>(await updateObject(deps, {
      id: object.id,
      commissionedOn: '2026-05-10',
      extinguisherProfile: { manufacturedOn: '2025-05-10', lastRechargeOn: null } as never,
    }));

    const recharge = activityCellsForObject(saved, [], '2026-08-23', 14, rulePackageSource)
      .find((cell) => cell.rule.activityCode === 'perezaryadka');

    expect(saved.extinguisherProfile?.manufacturedOn).toBe('2025-05-10');
    expect(recharge?.schedule.nextDate).toBe('2030-05-10');
  });
});
