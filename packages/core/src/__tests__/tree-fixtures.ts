/**
 * Общая заготовка для тестов дерева объекта.
 *
 * Дерево берётся из материалов заказчика: организация «Кольская ГМК», цех МВАСО,
 * здание «Учебная башня» с инвентарным номером и второй этаж на отметке +4.200.
 * Одно и то же дерево во всех тестах — чтобы отличия в поведении были видны
 * сразу, а не тонули в разных исходных данных.
 */

import type { Result, TreeNode } from '@izh/contracts';
import type { TreeDeps } from '../object-tree/tree-deps.js';
import { createChildNode, createOrganization } from '../object-tree/create-node.js';
import { fakeClock, fakeIdGenerator, fakeTreeRepository } from './test-doubles.js';

export function makeTreeDeps(): TreeDeps {
  return { tree: fakeTreeRepository(), clock: fakeClock(), ids: fakeIdGenerator() };
}

/** Разворачивает Result в значение, чтобы тесты читались как рассказ о сценарии. */
export function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`Ожидался успех, получена ошибка: ${result.error.message}`);
  return result.value;
}

export interface SampleTree {
  readonly organization: TreeNode;
  readonly shop: TreeNode;
  readonly building: TreeNode;
  readonly level: TreeNode;
}

export async function makeSampleTree(deps: TreeDeps): Promise<SampleTree> {
  const organization = value(await createOrganization(deps, { name: 'Кольская ГМК' }));
  const shop = value(
    await createChildNode(deps, { parentId: organization.id, kind: 'shop', name: 'МВАСО' }),
  );
  const building = value(
    await createChildNode(deps, {
      parentId: shop.id,
      kind: 'building',
      name: 'Учебная башня',
      code: 'инв. № 580115',
    }),
  );
  const level = value(
    await createChildNode(deps, {
      parentId: building.id,
      kind: 'level',
      name: '2 этаж',
      elevationM: 4.2,
    }),
  );
  return { organization, shop, building, level };
}
