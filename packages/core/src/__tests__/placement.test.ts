/**
 * Места хранения комплектов: самоспасатели (Дополнение 6).
 *
 * На схеме одна точка — шкаф, а в нём пять штук. Учёт при этом поштучный: у
 * каждой свой заводской номер и свой срок службы, и при замене одной из пяти
 * иначе неясно, какую заменили и когда истекает срок у остальных.
 */

import { describe, expect, it } from 'vitest';
import type { PlanObject } from '@izh/contracts';
import type { ObjectDeps } from '../objects/object-deps.js';
import { placeObject } from '../objects/object-scenarios.js';
import { setPlacementCount } from '../objects/placement-scenarios.js';
import {
  isMultiUnitType, isPlacementHead, placementContents, placementCount, placementOf, placementUnits,
} from '../objects/placement.js';
import { checkGroupFor, checkGroupTitle } from '../objects/check-group.js';
import { placeableObjects } from '../objects/placement.js';
import { worstPlacementStatus } from '../rules/activity-status.js';
import { fakeClock, fakeIdGenerator, fakePlanObjectRepository } from './test-doubles.js';
import { makeSampleTree, makeTreeDeps, value } from './tree-fixtures.js';

async function makeFixture() {
  const treeDeps = makeTreeDeps();
  const tree = await makeSampleTree(treeDeps);
  const objects = fakePlanObjectRepository();
  const deps: ObjectDeps = { objects, tree: treeDeps.tree, clock: fakeClock(), ids: fakeIdGenerator() };
  const nodes = value(await treeDeps.tree.list());

  const head = value<PlanObject>(
    await placeObject(deps, { nodeId: tree.level.id, typeCode: 'self-rescuer', position: { x: 4, y: 4 } }),
  );
  return { deps, nodes, head };
}

describe('количество единиц в месте', () => {
  it('заводит недостающие, считая вместе с точкой на плане', async () => {
    // Пользователь говорит «здесь пять», а не «здесь один плюс четыре».
    const { deps, head } = await makeFixture();

    const result = value<{ created: readonly PlanObject[] }>(
      await setPlacementCount(deps, { headId: head.id, count: 5 }),
    );

    expect(result.created).toHaveLength(4);
    const all = value<readonly PlanObject[]>(await deps.objects.list());
    expect(placementCount(all, head)).toBe(5);
  });

  it('каждая единица — отдельный объект со своим учётным номером', async () => {
    const { deps, head } = await makeFixture();
    const result = value<{ created: readonly PlanObject[] }>(
      await setPlacementCount(deps, { headId: head.id, count: 3 }),
    );

    const numbers = result.created.map((unit) => unit.regNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(result.created.every((unit) => unit.placementId === head.id)).toBe(true);
  });

  it('единицы комплекта на плане не показываются: место обозначено точкой', async () => {
    const { deps, head } = await makeFixture();
    const result = value<{ created: readonly PlanObject[] }>(
      await setPlacementCount(deps, { headId: head.id, count: 4 }),
    );

    expect(result.created.every((unit) => unit.position === null)).toBe(true);
  });

  it('лишние выводятся из эксплуатации, а не удаляются', async () => {
    // По единице могли пройти проверки, и записи журнала на неё ссылаются.
    const { deps, head } = await makeFixture();
    await setPlacementCount(deps, { headId: head.id, count: 5 });

    const result = value<{ archived: readonly PlanObject[] }>(
      await setPlacementCount(deps, { headId: head.id, count: 2 }),
    );

    expect(result.archived).toHaveLength(3);
    const all = value<readonly PlanObject[]>(await deps.objects.list());
    expect(all.filter((object) => object.typeCode === 'self-rescuer')).toHaveLength(5);
    expect(placementCount(all, head)).toBe(2);
  });

  it('меньше одной единицы быть не может: точка и есть единица', async () => {
    const { deps, head } = await makeFixture();

    expect((await setPlacementCount(deps, { headId: head.id, count: 0 })).ok).toBe(false);
  });

  it('количество задаётся у точки на плане, а не у вложенной единицы', async () => {
    const { deps, head } = await makeFixture();
    const created = value<{ created: readonly PlanObject[] }>(
      await setPlacementCount(deps, { headId: head.id, count: 2 }),
    );
    const unit = created.created[0];
    if (unit === undefined) throw new Error('единица не заведена');

    expect((await setPlacementCount(deps, { headId: unit.id, count: 5 })).ok).toBe(false);
  });

  it('оборудование, которое комплектом не хранят, так не заводится', async () => {
    const { deps, nodes } = await makeFixture();
    void nodes;
    const treeDeps = makeTreeDeps();
    const tree = await makeSampleTree(treeDeps);
    const extinguisher = value<PlanObject>(
      await placeObject(deps, { nodeId: tree.level.id, typeCode: 'extinguisher-powder', position: { x: 1, y: 1 } }),
    );

    expect((await setPlacementCount(deps, { headId: extinguisher.id, count: 3 })).ok).toBe(false);
  });
});

describe('устройство места хранения', () => {
  it('точкой считается только место с несколькими единицами', async () => {
    // Подпись «(1 шт)» на плане только загромождала бы схему.
    const { deps, head } = await makeFixture();
    const alone = value<readonly PlanObject[]>(await deps.objects.list());
    expect(isPlacementHead(alone, head)).toBe(false);

    await setPlacementCount(deps, { headId: head.id, count: 3 });
    const all = value<readonly PlanObject[]>(await deps.objects.list());
    expect(isPlacementHead(all, head)).toBe(true);
  });

  it('по единице находится её место', async () => {
    const { deps, head } = await makeFixture();
    const created = value<{ created: readonly PlanObject[] }>(
      await setPlacementCount(deps, { headId: head.id, count: 3 }),
    );
    const all = value<readonly PlanObject[]>(await deps.objects.list());
    const unit = created.created[0];
    if (unit === undefined) throw new Error('единица не заведена');

    expect(placementOf(all, unit)?.id).toBe(head.id);
    expect(placementUnits(all, head.id)).toHaveLength(2);
    expect(placementContents(all, head)).toHaveLength(3);
  });

  it('самоспасатель хранится комплектом, огнетушитель — нет', () => {
    expect(isMultiUnitType('self-rescuer')).toBe(true);
    expect(isMultiUnitType('extinguisher-powder')).toBe(false);
  });
});

describe('проверка комплекта разом', () => {
  it('в группу проверки попадают все единицы места', async () => {
    // Подошёл к шкафу — проверил все пять, и отметка нужна каждой.
    const { deps, nodes, head } = await makeFixture();
    await setPlacementCount(deps, { headId: head.id, count: 4 });
    const all = value<readonly PlanObject[]>(await deps.objects.list());

    expect(checkGroupFor(nodes, all, head)).toHaveLength(4);
  });

  it('проверка от вложенной единицы охватывает то же место', async () => {
    const { deps, nodes, head } = await makeFixture();
    const created = value<{ created: readonly PlanObject[] }>(
      await setPlacementCount(deps, { headId: head.id, count: 4 }),
    );
    const all = value<readonly PlanObject[]>(await deps.objects.list());
    const unit = created.created[0];
    if (unit === undefined) throw new Error('единица не заведена');

    expect(checkGroupFor(nodes, all, unit).map((item) => item.id).sort())
      .toEqual(checkGroupFor(nodes, all, head).map((item) => item.id).sort());
  });

  it('заголовок группы говорит про место хранения, а не про здание', () => {
    const unit = { id: 'u', typeCode: 'self-rescuer' } as unknown as PlanObject;

    expect(checkGroupTitle(unit, 'Самоспасатель')).toBe('Самоспасатель — другие в этом же месте хранения');
  });
});

describe('на плане один значок, в журнале — строка на каждую единицу', () => {
  it('единицы комплекта на план не попадают ни при каких условиях', async () => {
    // Проверяется отбор, который применяют и план, и полоса «требуют
    // размещения». Раньше без подложки объекты раскладывались условно, и
    // каждая единица получала свою позицию — в одной комнате появлялось пять
    // значков вместо одного.
    /*
     * Отбор берётся прямым импортом, а не общим `index.js` внутри проверки.
     *
     * Загрузка всего ядра из тела проверки шла под общий пятисекундный предел
     * и под нагрузкой полного прогона в него не укладывалась: проверка падала
     * через раз, ничего при этом не проверив. Соседние берут своё так же —
     * прямо из модуля.
     */
    const { deps, head } = await makeFixture();
    await setPlacementCount(deps, { headId: head.id, count: 5 });
    const all = value<readonly PlanObject[]>(await deps.objects.list());

    const onPlan = placeableObjects(all);

    expect(onPlan).toHaveLength(1);
    expect(onPlan[0]?.id).toBe(head.id);
  });

  it('количество на значке совпадает с числом строк журнала', async () => {
    // Главное требование заказчика: «(5 шт.)» на плане и ровно пять записей.
    const { deps, head } = await makeFixture();
    await setPlacementCount(deps, { headId: head.id, count: 5 });
    const all = value<readonly PlanObject[]>(await deps.objects.list());

    const onLabel = placementCount(all, head);
    const inJournal = all.filter((object) => object.typeCode === 'self-rescuer' && object.archivedAt === null);

    expect(onLabel).toBe(5);
    expect(inJournal).toHaveLength(5);
  });

  it('после вывода лишних количество и журнал остаются согласованы', async () => {
    const { deps, head } = await makeFixture();
    await setPlacementCount(deps, { headId: head.id, count: 5 });
    await setPlacementCount(deps, { headId: head.id, count: 3 });
    const all = value<readonly PlanObject[]>(await deps.objects.list());

    const active = all.filter((object) => object.typeCode === 'self-rescuer' && object.archivedAt === null);
    expect(placementCount(all, head)).toBe(3);
    expect(active).toHaveLength(3);
  });
});

describe('состояние точки — по худшей единице', () => {
  it('одна просроченная единица красит всё место', async () => {
    const { deps, head } = await makeFixture();
    await setPlacementCount(deps, { headId: head.id, count: 3 });
    const all = value<readonly PlanObject[]>(await deps.objects.list());

    // Точке и одной единице срок задан, второй — давно просрочен.
    const dated = all.map((object, index) => ({
      ...object,
      commissionedOn: index === 2 ? '2020-01-01' : '2026-08-01',
    }));

    const status = worstPlacementStatus(
      dated[0] as PlanObject, dated, [], '2026-08-23', 14,
    );

    expect(status).toBe('просрочено');
  });

  it('когда все в норме, место в норме', async () => {
    const { deps, head } = await makeFixture();
    await setPlacementCount(deps, { headId: head.id, count: 3 });
    const all = value<readonly PlanObject[]>(await deps.objects.list());
    const dated = all.map((object) => ({ ...object, commissionedOn: '2026-08-01' }));

    expect(worstPlacementStatus(dated[0] as PlanObject, dated, [], '2026-08-23', 14)).toBe('норма');
  });
});

describe('состояние места обновляется вместе с датами', () => {
  it('новая единица наследует дату точки, а не остаётся без неё', async () => {
    // Без даты единица навсегда «нет данных», а вместе с ней и всё место:
    // оно показывает худшее из состояний. Статус в карточке переставал
    // меняться, что бы пользователь ни делал.
    const { deps, head } = await makeFixture();
    await deps.objects.save({ ...head, commissionedOn: '2026-08-01', serviceLifeYears: 5 });

    const result = value<{ created: readonly PlanObject[] }>(
      await setPlacementCount(deps, { headId: head.id, count: 4 }),
    );

    expect(result.created.every((unit) => unit.commissionedOn === '2026-08-01')).toBe(true);
    expect(result.created.every((unit) => unit.serviceLifeYears === 5)).toBe(true);
  });

  it('после заведения состава место в норме, а не «нет данных»', async () => {
    const { deps, head } = await makeFixture();
    await deps.objects.save({ ...head, commissionedOn: '2026-08-01' });
    await setPlacementCount(deps, { headId: head.id, count: 4 });
    const all = value<readonly PlanObject[]>(await deps.objects.list());
    const dated = all.find((object) => object.id === head.id);
    if (dated === undefined) throw new Error('точка не найдена');

    expect(worstPlacementStatus(dated, all, [], '2026-08-23', 14)).not.toBe('нет данных');
  });
});
