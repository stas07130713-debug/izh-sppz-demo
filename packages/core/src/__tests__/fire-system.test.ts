/**
 * Система пожарной автоматики: состав по этажам и целостность.
 *
 * Главное, что здесь закреплено: элементы состава — полноценные объекты со
 * своей карточкой и своими сроками, а не строки внутри прибора. Этаж каждому
 * указывает пользователь, программа не раскладывает состав сама. И убрать
 * элемент можно только пометкой: по нему могли пройти проверки, а записи
 * журнала не удаляются (AGENTS.md, правило 10).
 */

import { describe, expect, it } from 'vitest';
import type { PlanObject, TreeNode } from '@izh/contracts';
import type { ObjectDeps } from '../objects/object-deps.js';
import { placeObject } from '../objects/object-scenarios.js';
import { setSystemComposition } from '../objects/system-composition-scenarios.js';
import {
  SYSTEM_MEMBER_TYPES, canJoinSystem, isSystemHead, systemComposition, systemMembers, systemOf,
} from '../objects/fire-system.js';
import { fakeClock, fakeIdGenerator, fakePlanObjectRepository } from './test-doubles.js';
import { makeSampleTree, makeTreeDeps, value } from './tree-fixtures.js';

async function makeFixture() {
  const treeDeps = makeTreeDeps();
  const tree = await makeSampleTree(treeDeps);
  const objects = fakePlanObjectRepository();
  const deps: ObjectDeps = { objects, tree: treeDeps.tree, clock: fakeClock(), ids: fakeIdGenerator() };
  const nodes = value<readonly TreeNode[]>(await treeDeps.tree.list());

  const head = value<PlanObject>(
    await placeObject(deps, { nodeId: tree.level.id, typeCode: 'control-panel', position: { x: 5, y: 5 } }),
  );

  return { deps, nodes, head, tree };
}

describe('состав системы пожарной автоматики', () => {
  it('заводит указанное число элементов и привязывает их к прибору', async () => {
    const { deps, nodes, head, tree } = await makeFixture();

    const result = value<{ created: readonly PlanObject[] }>(
      await setSystemComposition(deps, {
        headId: head.id,
        nodes,
        items: [
          { typeCode: 'smoke-detector', nodeId: tree.level.id, count: 5 },
          { typeCode: 'manual-call-point', nodeId: tree.level.id, count: 2 },
        ],
      }),
    );

    expect(result.created).toHaveLength(7);
    expect(result.created.every((object) => object.systemId === head.id)).toBe(true);
  });

  it('элементы состава — полноценные объекты, но пока не на плане', async () => {
    // Не полуфабрикат: у элемента уже есть карточка и сроки. На плане он
    // появится, когда его туда перетащат.
    const { deps, nodes, head, tree } = await makeFixture();

    const result = value<{ created: readonly PlanObject[] }>(
      await setSystemComposition(deps, { headId: head.id, nodes, items: [{ typeCode: 'smoke-detector', nodeId: tree.level.id, count: 3 }] }),
    );

    expect(result.created.every((object) => object.position === null)).toBe(true);
    expect(result.created.every((object) => object.regNumber !== null)).toBe(true);
  });

  it('добавляет только недостающие, а не заводит всё заново', async () => {
    const { deps, nodes, head, tree } = await makeFixture();
    await setSystemComposition(deps, { headId: head.id, nodes, items: [{ typeCode: 'smoke-detector', nodeId: tree.level.id, count: 3 }] });

    const second = value<{ created: readonly PlanObject[] }>(
      await setSystemComposition(deps, { headId: head.id, nodes, items: [{ typeCode: 'smoke-detector', nodeId: tree.level.id, count: 5 }] }),
    );

    expect(second.created).toHaveLength(2);
    const all = value<readonly PlanObject[]>(await deps.objects.list());
    expect(systemComposition(all, head.id).get('smoke-detector')).toBe(5);
  });

  it('лишние выводит из эксплуатации пометкой, а не удаляет', async () => {
    // По элементу могли уже пройти проверки, и записи журнала на него ссылаются.
    const { deps, nodes, head, tree } = await makeFixture();
    await setSystemComposition(deps, { headId: head.id, nodes, items: [{ typeCode: 'smoke-detector', nodeId: tree.level.id, count: 4 }] });

    const result = value<{ archived: readonly PlanObject[] }>(
      await setSystemComposition(deps, { headId: head.id, nodes, items: [{ typeCode: 'smoke-detector', nodeId: tree.level.id, count: 1 }] }),
    );

    expect(result.archived).toHaveLength(3);
    expect(result.archived.every((object) => object.archivedAt !== null)).toBe(true);

    const all = value<readonly PlanObject[]>(await deps.objects.list());
    // Записи остались в хранилище: удаления не было.
    expect(all.filter((object) => object.typeCode === 'smoke-detector')).toHaveLength(4);
    expect(systemMembers(all, head.id).filter((o) => o.typeCode === 'smoke-detector')).toHaveLength(1);
  });

  it('не убирает элемент, уже расставленный на плане', async () => {
    // За расставленным вручную элементом стоит работа человека: молча снять
    // его нельзя, программа обязана сказать об этом.
    const { deps, nodes, head, tree } = await makeFixture();
    const first = value<{ created: readonly PlanObject[] }>(
      await setSystemComposition(deps, { headId: head.id, nodes, items: [{ typeCode: 'smoke-detector', nodeId: tree.level.id, count: 2 }] }),
    );
    const placed = first.created[0];
    if (placed === undefined) throw new Error('элементы не заведены');
    await deps.objects.save({ ...placed, position: { x: 10, y: 10 } });

    const result = await setSystemComposition(deps, {
      headId: head.id, nodes, items: [{ typeCode: 'smoke-detector', nodeId: tree.level.id, count: 0 }],
    });

    expect(result.ok).toBe(false);
  });

  it('отказывается принимать оборудование, которое в систему не входит', async () => {
    const { deps, nodes, head, tree } = await makeFixture();

    const result = await setSystemComposition(deps, {
      headId: head.id, nodes, items: [{ typeCode: 'extinguisher-powder', nodeId: tree.level.id, count: 3 }],
    });

    expect(result.ok).toBe(false);
  });

  it('состав задаётся только у прибора, а не у произвольного элемента', async () => {
    const { deps, nodes, tree } = await makeFixture();
    const detector = value<PlanObject>(
      await placeObject(deps, { nodeId: tree.level.id, typeCode: 'smoke-detector', position: { x: 1, y: 1 } }),
    );

    const result = await setSystemComposition(deps, {
      headId: detector.id, nodes, items: [{ typeCode: 'smoke-detector', nodeId: tree.level.id, count: 1 }],
    });

    expect(result.ok).toBe(false);
  });
});

describe('принадлежность к системе', () => {
  it('прибор — голова системы, а не её участник', async () => {
    const { head } = await makeFixture();

    expect(isSystemHead(head)).toBe(true);
    expect(head.systemId ?? null).toBeNull();
  });

  it('по элементу находится его система', async () => {
    const { deps, nodes, head, tree } = await makeFixture();
    const result = value<{ created: readonly PlanObject[] }>(
      await setSystemComposition(deps, { headId: head.id, nodes, items: [{ typeCode: 'sounder', nodeId: tree.level.id, count: 1 }] }),
    );
    const all = value<readonly PlanObject[]>(await deps.objects.list());
    const member = result.created[0];
    if (member === undefined) throw new Error('элемент не заведён');

    expect(systemOf(all, member)?.id).toBe(head.id);
  });

  it('автономная установка в систему не входит', () => {
    // Она срабатывает без прибора управления и обслуживается сама по себе.
    expect(canJoinSystem('autonomous-suppression')).toBe(false);
    expect(canJoinSystem('smoke-detector')).toBe(true);
  });
});

describe('этаж указывает пользователь', () => {
  it('элементы заводятся ровно на указанном этаже', async () => {
    const { deps, nodes, head, tree } = await makeFixture();

    const result = value<{ created: readonly PlanObject[] }>(
      await setSystemComposition(deps, {
        headId: head.id,
        nodes,
        items: [{ typeCode: 'smoke-detector', nodeId: tree.level.id, count: 4 }],
      }),
    );

    expect(result.created.every((object) => object.nodeId === tree.level.id)).toBe(true);
  });

  it('оборудование нельзя завести на чужое здание', async () => {
    // Система защищает своё здание. Молча принять чужой этаж значило бы
    // потерять оборудование: искать его будут не там.
    const { deps, nodes, head, tree } = await makeFixture();

    const result = await setSystemComposition(deps, {
      headId: head.id,
      nodes,
      items: [{ typeCode: 'smoke-detector', nodeId: tree.building.id, count: 2 }],
    });

    expect(result.ok).toBe(false);
  });

  it('правка одного этажа не трогает оборудование на других', async () => {
    // Пользователь может править состав по одному этажу; строки, которых он не
    // прислал, обязаны остаться как были.
    const { deps, nodes, head, tree } = await makeFixture();
    await setSystemComposition(deps, {
      headId: head.id, nodes, items: [{ typeCode: 'smoke-detector', nodeId: tree.level.id, count: 3 }],
    });

    const second = value<{ created: readonly PlanObject[]; archived: readonly PlanObject[] }>(
      await setSystemComposition(deps, {
        headId: head.id, nodes, items: [{ typeCode: 'manual-call-point', nodeId: tree.level.id, count: 1 }],
      }),
    );

    expect(second.archived).toHaveLength(0);
    const all = value<readonly PlanObject[]>(await deps.objects.list());
    expect(systemComposition(all, head.id).get('smoke-detector')).toBe(3);
  });

  it('номера продолжаются сквозь систему, а не начинаются заново', async () => {
    // Два разных извещателя с номером «1» в одной системе не различить.
    const { deps, nodes, head, tree } = await makeFixture();
    await setSystemComposition(deps, {
      headId: head.id, nodes, items: [{ typeCode: 'smoke-detector', nodeId: tree.level.id, count: 2 }],
    });

    const second = value<{ created: readonly PlanObject[] }>(
      await setSystemComposition(deps, {
        headId: head.id, nodes, items: [{ typeCode: 'manual-call-point', nodeId: tree.level.id, count: 2 }],
      }),
    );

    expect(second.created.map((object) => object.regNumber)).toEqual(['3', '4']);
  });
});

describe('оборудование системы не заводится из библиотеки', () => {
  it('в библиотеке этажа нет ни извещателей, ни оповещателей, ни клапанов', async () => {
    // Второй путь заведения дал бы датчик без системы: он не попал бы ни в
    // проверку системы, ни в её журнал, и выпал бы из обслуживания незаметно.
    const { elementsFor } = await import('../objects/element-lookup.js');
    const library = elementsFor('floor').map((item) => item.typeCode);

    for (const typeCode of SYSTEM_MEMBER_TYPES) {
      expect(library, typeCode).not.toContain(typeCode);
    }
  });

  it('сам прибор в библиотеке остаётся: с него система начинается', async () => {
    const { elementsFor } = await import('../objects/element-lookup.js');

    expect(elementsFor('floor').map((item) => item.typeCode)).toContain('control-panel');
  });

  it('огнетушители и автономная установка из библиотеки не пропали', async () => {
    const { elementsFor } = await import('../objects/element-lookup.js');
    const library = elementsFor('floor').map((item) => item.typeCode);

    expect(library).toContain('extinguisher');
    expect(library).toContain('autonomous-suppression');
  });

    it('перечень видов системы в каталоге и в движке — один и тот же', async () => {
      // Эталон обновлён 24.08.2026. Раньше перечней было два, и совпадение
      // держал этот тест — но копия дважды отставала при добавлении новых
      // видов, и тест ловил уже сделанную ошибку. Теперь перечень один, а
      // проверка сторожит, чтобы копию не завели снова.
      const { SYSTEM_MEMBER_TYPES_IN_LIBRARY } = await import('../objects/element-catalog.js');

      expect(SYSTEM_MEMBER_TYPES_IN_LIBRARY).toBe(SYSTEM_MEMBER_TYPES);
    });
});
