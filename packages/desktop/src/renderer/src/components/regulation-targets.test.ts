/**
 * Куда можно назначить регламент (ТЗ, Дополнение 5, часть Р7).
 *
 * Главное здесь — что список читается как структура предприятия. Два цеха с
 * названием «Механический» в разных корпусах должны различаться, иначе
 * пользователь назначит сроки не туда и узнает об этом при проверке.
 */

import { describe, expect, it } from 'vitest';
import { ALL_OBJECTS_REGULATION_TARGET_ID, type TreeNode } from '@izh/contracts';
import { regulationTargets, scopeLabel } from './regulation-targets';

function node(patch: Partial<TreeNode> & { readonly id: string }): TreeNode {
  return {
    parentId: null,
    kind: 'building',
    name: 'Узел',
    archivedAt: null,
    ...patch,
  } as unknown as TreeNode;
}

const TREE: readonly TreeNode[] = [
  node({ id: 'org', parentId: null, kind: 'organization', name: 'Предприятие' }),
  node({ id: 'shop-1', parentId: 'org', kind: 'shop', name: 'Цех 1' }),
  node({ id: 'b-1', parentId: 'shop-1', kind: 'building', name: 'Корпус А' }),
  node({ id: 'level-1', parentId: 'b-1', kind: 'level', name: 'Этаж 1' }),
  node({ id: 'store-1', parentId: 'org', kind: 'storage', name: 'Склад' }),
];

describe('места назначения регламента', () => {
  it('предлагает общее правило, организацию, цех и здание — и ничего больше', () => {
    const targets = regulationTargets(TREE);

    expect(targets.map((item) => item.targetId).sort()).toEqual([
      ALL_OBJECTS_REGULATION_TARGET_ID, 'b-1', 'org', 'shop-1',
    ].sort());
    expect(targets[0]?.label).toBe('Общее — все объекты в системе');
  });

  it('показывает путь, а не одно название', () => {
    const building = regulationTargets(TREE).find((item) => item.targetId === 'b-1');

    expect(building?.label).toBe('Предприятие → Цех 1 → Корпус А');
    expect(building?.scope).toBe('здание');
  });

  it('не предлагает назначить на этаж или склад', () => {
    const ids = regulationTargets(TREE).map((item) => item.targetId);

    // Регламент «на второй этаж» не бывает: если порядок там действительно
    // свой, это задаётся на самом элементе.
    expect(ids).not.toContain('level-1');
    expect(ids).not.toContain('store-1');
  });

  it('выведенный из структуры узел не предлагается', () => {
    const archived = TREE.map((item) =>
      item.id === 'shop-1' ? ({ ...item, archivedAt: '2026-01-01T00:00:00.000Z' } as TreeNode) : item,
    );

    expect(regulationTargets(archived).map((item) => item.targetId)).not.toContain('shop-1');
  });

  it('называет уровень по-человечески', () => {
    expect(scopeLabel('организация')).toBe('на всю организацию');
    expect(scopeLabel('здание')).toBe('на здание');
  });
});
