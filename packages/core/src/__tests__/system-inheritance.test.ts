/**
 * Что элемент системы берёт от прибора (ТЗ, Дополнение 6).
 *
 * Наследуются две разные вещи, и по разным правилам. Дата постановки на учёт —
 * всему оборудованию системы: её проектируют, монтируют и сдают целиком.
 * Изготовитель — только оборудованию адресной линии (ДИП, ИПР, СОУЭ): протокол
 * линии у каждого свой, а клапан с вентилятором покупают отдельно и у других.
 *
 * Проверяется и обратное: своё значение элемента затирать нельзя. Извещатель,
 * заменённый позже остальных, имеет собственную дату, и подставленная соврала
 * бы о его возрасте.
 */

import { describe, expect, it } from 'vitest';
import type { PlanObject } from '@izh/contracts';
import type { ObjectDeps } from '../objects/object-deps.js';
import { placeObject, updateObject } from '../objects/object-scenarios.js';
import { setSystemComposition } from '../objects/system-composition-scenarios.js';
import { INHERITING_SYSTEM_TYPES, inheritsFromSystem, propagateSystemDefaults } from '../objects/system-inheritance.js';
import { systemMembers } from '../objects/fire-system.js';
import { fakeClock, fakeIdGenerator, fakePlanObjectRepository } from './test-doubles.js';
import { makeSampleTree, makeTreeDeps, value } from './tree-fixtures.js';

async function makeSystem(headFields: { manufacturer?: string; commissionedOn?: string } = {}) {
  const treeDeps = makeTreeDeps();
  const tree = await makeSampleTree(treeDeps);
  const objects = fakePlanObjectRepository();
  const deps: ObjectDeps = { objects, tree: treeDeps.tree, clock: fakeClock(), ids: fakeIdGenerator() };
  const nodes = value(await treeDeps.tree.list());

  let head = value<PlanObject>(
    await placeObject(deps, { nodeId: tree.level.id, typeCode: 'control-panel', position: { x: 1, y: 1 } }),
  );
  if (Object.keys(headFields).length > 0) {
    head = value<PlanObject>(await updateObject(deps, { id: head.id, ...headFields }));
  }
  await setSystemComposition(deps, {
    headId: head.id,
    nodes,
    items: [
      { typeCode: 'smoke-detector', nodeId: tree.level.id, count: 3 },
      { typeCode: 'smoke-valve', nodeId: tree.level.id, count: 2 },
    ],
  });
  const all = value<readonly PlanObject[]>(await deps.objects.list());
  const members = systemMembers(all, head.id);
  return {
    deps,
    head,
    members: members.filter((member) => member.typeCode === 'smoke-detector'),
    valves: members.filter((member) => member.typeCode === 'smoke-valve'),
  };
}

describe('правило действует на оборудование адресной линии', () => {
  it('изготовителя берут только ДИП, ИПР, СОУЭ — и больше никто', () => {
    // Эталон обновлён 24.08.2026: СОУЭ разделено на виды оповещателей, и
    // правило распространяется на каждый — вид меняет состав проверки, но не
    // то, у кого куплен оповещатель.
    expect([...INHERITING_SYSTEM_TYPES].sort()).toEqual([
      'manual-call-point', 'smoke-detector',
      'sounder', 'sounder-audible', 'sounder-combined', 'sounder-light', 'sounder-speech',
    ]);
    expect(inheritsFromSystem('smoke-valve')).toBe(false);
    expect(inheritsFromSystem('gas-module')).toBe(false);
    expect(inheritsFromSystem('heat-detector')).toBe(false);
  });

  it('извещателю изготовитель и дата берутся от прибора', async () => {
    const { members } = await makeSystem({ manufacturer: 'НВП «Болид»', commissionedOn: '2026-03-15' });

    expect(members).toHaveLength(3);
    expect(members.every((member) => member.manufacturer === 'НВП «Болид»')).toBe(true);
    expect(members.every((member) => member.commissionedOn === '2026-03-15')).toBe(true);
  });

  it('клапану дымоудаления подставляется дата, но не изготовитель', async () => {
    // Дата — потому что система проектируется и сдаётся целиком, и от неё
    // считаются все сроки. Изготовитель — нет: клапан покупают отдельно и у
    // другого, и марка прибора в его карточке была бы неправдой.
    const { valves } = await makeSystem({ manufacturer: 'НВП «Болид»', commissionedOn: '2026-03-15' });

    expect(valves).toHaveLength(2);
    expect(valves.every((valve) => valve.commissionedOn === '2026-03-15')).toBe(true);
    expect(valves.every((valve) => valve.manufacturer === null)).toBe(true);
  });
});

describe('правка карточки прибора расходится по элементам', () => {
  it('заполненные позже сведения доходят до заведённых раньше элементов', async () => {
    // Обычный порядок работы: состав завели сразу, карточку прибора заполнили
    // потом. Без рассылки элементы навсегда остались бы пустыми.
    const { deps, head } = await makeSystem();
    await updateObject(deps, { id: head.id, manufacturer: 'ГК «Рубеж»', commissionedOn: '2026-04-01' });

    const updated = value<readonly PlanObject[]>(await propagateSystemDefaults(deps, {
      headId: head.id,
      previous: { manufacturer: null, commissionedOn: null },
    }));

    // Дата дошла до всех пяти элементов, изготовитель — только до трёх
    // извещателей: у клапанов он свой.
    expect(updated).toHaveLength(5);
    expect(updated.every((member) => member.commissionedOn === '2026-04-01')).toBe(true);
    const byType = (typeCode: string) => updated.filter((member) => member.typeCode === typeCode);
    expect(byType('smoke-detector').every((member) => member.manufacturer === 'ГК «Рубеж»')).toBe(true);
    expect(byType('smoke-valve').every((member) => member.manufacturer === null)).toBe(true);
  });

  it('своё значение элемента не затирается', async () => {
    // Извещатель заменён позже остальных и другим изготовителем: подставленное
    // от прибора соврало бы и о возрасте, и о том, что стоит на объекте.
    const { deps, head, members } = await makeSystem({ manufacturer: 'НВП «Болид»', commissionedOn: '2026-03-15' });
    const replaced = members[0] as PlanObject;
    await updateObject(deps, { id: replaced.id, manufacturer: 'АО «Аргус-Спектр»', commissionedOn: '2026-07-20' });

    await updateObject(deps, { id: head.id, manufacturer: 'ГК «Рубеж»', commissionedOn: '2026-04-01' });
    await propagateSystemDefaults(deps, {
      headId: head.id,
      previous: { manufacturer: 'НВП «Болид»', commissionedOn: '2026-03-15' },
    });

    const after = value<PlanObject>(await deps.objects.getById(replaced.id));
    expect(after.manufacturer).toBe('АО «Аргус-Спектр»');
    expect(after.commissionedOn).toBe('2026-07-20');
  });

  it('когда у прибора ничего не изменилось, никого не трогает', async () => {
    const { deps, head } = await makeSystem({ manufacturer: 'НВП «Болид»', commissionedOn: '2026-03-15' });

    const updated = value<readonly PlanObject[]>(await propagateSystemDefaults(deps, {
      headId: head.id,
      previous: { manufacturer: 'НВП «Болид»', commissionedOn: '2026-03-15' },
    }));

    expect(updated).toEqual([]);
  });

  it('элементы чужой системы не задеваются', async () => {
    const { deps, head } = await makeSystem({ manufacturer: 'НВП «Болид»', commissionedOn: '2026-03-15' });
    const all = value<readonly PlanObject[]>(await deps.objects.list());
    const stranger = value<PlanObject>(await placeObject(deps, {
      nodeId: (all[0] as PlanObject).nodeId, typeCode: 'smoke-detector', position: { x: 9, y: 9 },
    }));

    await updateObject(deps, { id: head.id, manufacturer: 'ГК «Рубеж»' });
    await propagateSystemDefaults(deps, {
      headId: head.id,
      previous: { manufacturer: 'НВП «Болид»', commissionedOn: '2026-03-15' },
    });

    const after = value<PlanObject>(await deps.objects.getById(stranger.id));
    expect(after.manufacturer).toBeNull();
  });
});
