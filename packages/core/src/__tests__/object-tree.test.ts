/**
 * Эталонные тесты дерева объекта: структура.
 *
 * Они описывают договорённость о том, как устроено предприятие: что во что
 * вкладывается, у какого узла какая рабочая область, в каком порядке узлы
 * показываются и как собирается подпись схемы. Изменения уже заведённого дерева
 * проверяются в object-tree-changes.test.ts.
 *
 * Смотри docs/02_ТЗ_редакция_3.md, часть 3.
 */

import { describe, expect, it } from 'vitest';
import type { NodeKind, TreeNode } from '@izh/contracts';
import { createChildNode, createOrganization } from '../object-tree/create-node.js';
import { updateNode } from '../object-tree/update-node.js';
import { archiveNode } from '../object-tree/archive-node.js';
import {
  buildForest,
  filterForest,
  formatElevation,
  nodeTitle,
  planCaption,
} from '../object-tree/tree-shape.js';
import { allowedChildKinds, canContain, ruleFor } from '../object-tree/tree-rules.js';
import { EMPTY_BUILDING_PROFILE, missingProfileFields } from '../object-tree/building-profile.js';
import { FIXED_NOW } from './test-doubles.js';
import { makeSampleTree, makeTreeDeps, value } from './tree-fixtures.js';

describe('создание узлов дерева', () => {
  it('организация принадлежит сама себе, а потомки наследуют её признак', async () => {
    const deps = makeTreeDeps();
    const { organization, shop, building, level } = await makeSampleTree(deps);

    expect(organization.siteId).toBe(organization.id);
    expect(organization.parentId).toBeNull();
    expect([shop.siteId, building.siteId, level.siteId]).toEqual([
      organization.id,
      organization.id,
      organization.id,
    ]);
  });

  it('записывает узел целиком', async () => {
    const deps = makeTreeDeps();
    const { building } = await makeSampleTree(deps);

    expect(building).toEqual({
      id: 'id-3',
      siteId: 'id-1',
      parentId: 'id-2',
      kind: 'building',
      name: 'Учебная башня',
      code: 'инв. № 580115',
      elevationM: null,
      note: null,
      building: null,
      sortOrder: 0,
      inCommonJournal: true,
      objectsPinned: false,
      archivedAt: null,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
      rowVersion: 1,
    });
  });

  it('здание можно завести и прямо в организации, без цеха', async () => {
    const deps = makeTreeDeps();
    const organization = value(await createOrganization(deps, { name: 'Организация' }));
    const result = await createChildNode(deps, {
      parentId: organization.id,
      kind: 'building',
      name: 'АБК',
    });

    expect(result.ok).toBe(true);
  });

  it('не пускает этаж в цех', async () => {
    const deps = makeTreeDeps();
    const { shop } = await makeSampleTree(deps);
    const result = await createChildNode(deps, { parentId: shop.id, kind: 'level', name: '1 этаж' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_ARGUMENT');
    expect(result.error.message).toContain('нельзя поместить');
  });

  it('заводит склад для оборудования, числящегося за пожарной машиной', async () => {
    const deps = makeTreeDeps();
    const { building } = await makeSampleTree(deps);

    const storage = await createChildNode(deps, {
      parentId: building.id,
      kind: 'storage',
      name: 'АЦ 4.0-60',
      code: 'Газ 330811',
    });

    expect(value(storage).kind).toBe('storage');
    // Техника — частный случай склада, отдельного вида узла для неё нет.
    expect(ruleFor('storage').planKind).toBe('storage');
  });

  it('отметка задаётся только этажу', async () => {
    const deps = makeTreeDeps();
    const { building } = await makeSampleTree(deps);
    const result = await createChildNode(deps, {
      parentId: building.id,
      kind: 'storage',
      name: 'Склад',
      elevationM: 3,
    });

    expect(result.ok).toBe(false);
  });

  it('характеристики пожарной безопасности принимает только здание', async () => {
    const deps = makeTreeDeps();
    const { building } = await makeSampleTree(deps);

    const onLevel = await createChildNode(deps, {
      parentId: building.id,
      kind: 'level',
      name: '3 этаж',
      building: EMPTY_BUILDING_PROFILE,
    });
    expect(onLevel.ok).toBe(false);
  });

  it('не заводит двух одноимённых соседей одного вида', async () => {
    const deps = makeTreeDeps();
    const { building } = await makeSampleTree(deps);
    const again = await createChildNode(deps, {
      parentId: building.id,
      kind: 'level',
      // Лишние пробелы убираются, поэтому это тот же самый «2 этаж».
      name: '  2   этаж ',
      elevationM: 4.2,
    });

    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error.message).toContain('уже есть внутри');
  });
});

describe('правила вложенности и рабочие области', () => {
  it('внутри здания разрешены этаж и склад', () => {
    expect(allowedChildKinds('building')).toEqual(['level', 'storage']);
  });

  it('внутри организации — цех и здание', () => {
    expect(allowedChildKinds('organization')).toEqual(['shop', 'building']);
  });

  it('внутри этажа не заводится ничего: там работают объекты, а не узлы дерева', () => {
    expect(allowedChildKinds('level')).toEqual([]);
    expect(canContain('level', 'level')).toBe(false);
  });

  it('у здания генплан, у этажа поэтажный план, у склада окно склада', () => {
    expect(ruleFor('building').planKind).toBe('general');
    expect(ruleFor('level').planKind).toBe('floor');
    expect(ruleFor('storage').planKind).toBe('storage');
    expect(ruleFor('organization').planKind).toBe('none');
    expect(ruleFor('shop').planKind).toBe('none');
  });
});

describe('характеристики здания', () => {
  it('незаполненные характеристики перечисляются для дашборда', async () => {
    const deps = makeTreeDeps();
    const { building } = await makeSampleTree(deps);

    expect(missingProfileFields(building.building)).toContain('Степень огнестойкости');

    const filled = value(
      await updateNode(deps, {
        id: building.id,
        name: building.name,
        code: building.code,
        building: { ...EMPTY_BUILDING_PROFILE, fireResistance: 'II', constructiveClass: 'С0' },
      }),
    );

    expect(filled.building?.fireResistance).toBe('II');
    expect(missingProfileFields(filled.building)).not.toContain('Степень огнестойкости');
  });
});

describe('подпись схемы', () => {
  it('собирается из дерева, а не хранится на плане', async () => {
    const deps = makeTreeDeps();
    const { level } = await makeSampleTree(deps);
    const nodes = value(await deps.tree.list());

    expect(planCaption(nodes, level.id)).toBe('Кольская ГМК · МВАСО · Учебная башня · 2 этаж (отм. +4.200)');
  });

  it('следует за переименованием здания', async () => {
    const deps = makeTreeDeps();
    const { building, level } = await makeSampleTree(deps);
    await updateNode(deps, { id: building.id, name: 'Учебная башня АСС' });
    const nodes = value(await deps.tree.list());

    expect(planCaption(nodes, level.id)).toContain('Учебная башня АСС');
  });

  it('пишет отметку так, как принято на чертежах', () => {
    expect(formatElevation(0)).toBe('0.000');
    expect(formatElevation(4.2)).toBe('+4.200');
    expect(formatElevation(-3.6)).toBe('-3.600');
  });

  it('этаж без заданной отметки показывается без скобок', () => {
    const node: TreeNode = {
      id: 'x',
      siteId: 'x',
      parentId: null,
      kind: 'level',
      name: 'Антресоль',
      code: null,
      elevationM: null,
      note: null,
      building: null,
      sortOrder: 0,
      inCommonJournal: true,
      objectsPinned: false,
      archivedAt: null,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
      rowVersion: 1,
    };
    expect(nodeTitle(node)).toBe('Антресоль');
  });
});

describe('сборка дерева', () => {
  it('складывает узлы по родителям и по порядку', async () => {
    const deps = makeTreeDeps();
    const { organization, building } = await makeSampleTree(deps);
    await createChildNode(deps, { parentId: building.id, kind: 'level', name: '1 этаж', elevationM: 0 });
    const nodes = value(await deps.tree.list());

    const forest = buildForest(nodes);
    expect(forest).toHaveLength(1);
    expect(forest[0]?.node.id).toBe(organization.id);

    const levels = forest[0]?.children[0]?.children[0]?.children ?? [];
    // Порядок создания, а не алфавит: «2 этаж» заведён первым.
    expect(levels.map((child) => child.node.name)).toEqual(['2 этаж', '1 этаж']);
  });

  it('у отобранного дерева корнем становится верхний из оставшихся', async () => {
    /*
     * Так дерево видит ответственный, которому выдано одно здание: организация
     * и цех в его список не попадают. Считай корнями только узлы без родителя
     * вовсе — и такому человеку показалось бы пустое дерево, а вместе с ним
     * пропал бы и доступ к тому, что ему как раз выдано. Заказчик и увидел
     * обратное: «зашёл под ним — вижу все объекты».
     */
    const deps = makeTreeDeps();
    const { building, level } = await makeSampleTree(deps);
    const nodes = value(await deps.tree.list());

    const выдано = new Set([building.id, level.id]);
    const forest = buildForest(nodes.filter((node) => выдано.has(node.id)));

    expect(forest).toHaveLength(1);
    expect(forest[0]?.node.id).toBe(building.id);
    expect(forest[0]?.children.map((child) => child.node.id)).toEqual([level.id]);
  });

  it('поиск оставляет найденный узел вместе с родителями', async () => {
    const deps = makeTreeDeps();
    const { level } = await makeSampleTree(deps);
    const nodes = value(await deps.tree.list());

    const found = filterForest(nodes, '2 этаж');
    // Организация → цех → здание → этаж: цепочка сохранена целиком.
    expect(found[0]?.children[0]?.children[0]?.children[0]?.node.id).toBe(level.id);
  });

  it('поиск находит здание по инвентарному номеру', async () => {
    const deps = makeTreeDeps();
    const { building } = await makeSampleTree(deps);
    const nodes = value(await deps.tree.list());

    const found = filterForest(nodes, '580115');
    expect(found[0]?.children[0]?.children[0]?.node.id).toBe(building.id);
  });

  it('пустой запрос показывает всё дерево', async () => {
    const deps = makeTreeDeps();
    await makeSampleTree(deps);
    const nodes = value(await deps.tree.list());

    expect(filterForest(nodes, '   ')).toEqual(buildForest(nodes));
  });

  it('по умолчанию не показывает выведенное из эксплуатации', async () => {
    const deps = makeTreeDeps();
    const { level } = await makeSampleTree(deps);
    await archiveNode(deps, { id: level.id });
    const nodes = value(await deps.tree.list());

    const visible = buildForest(nodes)[0]?.children[0]?.children[0]?.children ?? [];
    expect(visible).toHaveLength(0);

    const withArchived = buildForest(nodes, { includeArchived: true })[0]?.children[0]?.children[0]?.children ?? [];
    expect(withArchived).toHaveLength(1);
  });

  it('дерево из одних выведенных узлов пусто: заводить организацию не из чего', async () => {
    /*
     * На этом свойстве держится форма «Новая организация»: она показывается,
     * когда на экране нет ни одного узла. Раньше пустоту считали по длине
     * списка, а в списке оставались выведенные — форма не появлялась, правым
     * щелчком нажать было не на что, и программа упиралась в тупик, из
     * которого нельзя завести ни одного узла.
     */
    const deps = makeTreeDeps();
    const { organization, shop, building, level } = await makeSampleTree(deps);
    // Узел с действующими потомками не выводится: снизу вверх, как в жизни.
    for (const node of [level, building, shop, organization]) {
      value(await archiveNode(deps, { id: node.id }));
    }
    const nodes = value(await deps.tree.list());

    expect(nodes.length).toBeGreaterThan(0);
    expect(filterForest(nodes, '')).toHaveLength(0);
  });
});

describe('откуда что заводится', () => {
  /*
   * Кнопки «Создать» больше нет: узлы заводят правым щелчком по дереву. Меню
   * предлагает и то, что внутрь узла, и то, что рядом с ним, — иначе на этаже
   * и на складе оно оказывалось пустым, и человек упирался в тупик.
   */
  it('ни один узел не тупик: рядом с любым узлом есть что завести', () => {
    const parentOf: Readonly<Record<string, NodeKind>> = {
      shop: 'organization',
      building: 'shop',
      level: 'building',
      storage: 'building',
    };

    for (const [kind, parent] of Object.entries(parentOf)) {
      const inside = allowedChildKinds(kind as NodeKind);
      const nearby = allowedChildKinds(parent);
      expect(
        [...inside, ...nearby].length,
        `от узла «${kind}» нельзя завести ни одного узла`,
      ).toBeGreaterThan(0);
    }
  });

  it('этаж и склад внутрь не принимают — заводить можно только рядом', () => {
    // Ради этого случая меню и научили предлагать соседей: правило ядра
    // осталось прежним, а тупик в интерфейсе исчез.
    expect(allowedChildKinds('level')).toHaveLength(0);
    expect(allowedChildKinds('storage')).toHaveLength(0);
    expect(allowedChildKinds('building')).toContain('level');
  });
});
