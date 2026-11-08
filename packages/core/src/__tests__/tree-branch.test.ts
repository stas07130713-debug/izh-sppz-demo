/**
 * Ветвь для свёрнутого дерева (ТЗ, Дополнение 6, часть С48).
 *
 * Полоса шириной в сорок точек не вместит весь объект, а ветвь своего цеха
 * вмещает — и её хватает, потому что переходят почти всегда внутри неё.
 */

import { describe, expect, it } from 'vitest';
import type { TreeNode } from '@izh/contracts';
import { branchOf, branchRoot } from '../object-tree/tree-branch.js';

function node(id: string, parentId: string | null, kind: TreeNode['kind'], sortOrder = 1, archived = false): TreeNode {
  return {
    id, parentId, kind, siteId: 'site', name: id, code: null, sortOrder,
    elevationM: null, inCommonJournal: true, objectsPinned: false,
    archivedAt: archived ? '2026-01-01T00:00:00.000Z' : null,
    createdAt: '', updatedAt: '', rowVersion: 1,
  } as unknown as TreeNode;
}

const NODES: readonly TreeNode[] = [
  node('орг', null, 'organization'),
  node('цех-1', 'орг', 'shop', 1),
  node('корпус-1', 'цех-1', 'building', 1),
  node('этаж-1', 'корпус-1', 'level', 1),
  node('этаж-2', 'корпус-1', 'level', 2),
  node('корпус-2', 'цех-1', 'building', 2),
  node('этаж-3', 'корпус-2', 'level', 1),
  node('цех-2', 'орг', 'shop', 2),
  node('корпус-3', 'цех-2', 'building', 1),
];

describe('ветвь текущего цеха', () => {
  it('начинается с цеха, а не с родителя выбранного узла', () => {
    // У этажа родитель — здание, и соседние здания цеха из полосы пропали бы,
    // хотя переход между ними обычен.
    expect(branchRoot(NODES, 'этаж-1')?.id).toBe('цех-1');
  });

  it('включает соседние здания и их этажи', () => {
    const ids = branchOf(NODES, 'этаж-1').map((step) => step.node.id);
    expect(ids).toEqual(['цех-1', 'корпус-1', 'этаж-1', 'этаж-2', 'корпус-2', 'этаж-3']);
  });

  it('не заходит в соседний цех', () => {
    const ids = branchOf(NODES, 'этаж-1').map((step) => step.node.id);
    expect(ids).not.toContain('цех-2');
    expect(ids).not.toContain('корпус-3');
  });

  it('глубина считается от начала ветви, а не от корня объекта', () => {
    const steps = branchOf(NODES, 'этаж-1');
    expect(steps.find((step) => step.node.id === 'цех-1')?.depth).toBe(0);
    expect(steps.find((step) => step.node.id === 'корпус-1')?.depth).toBe(1);
    expect(steps.find((step) => step.node.id === 'этаж-1')?.depth).toBe(2);
  });

  it('без цеха ветвь начинается со здания', () => {
    const flat: readonly TreeNode[] = [
      node('орг', null, 'organization'),
      node('корпус', 'орг', 'building'),
      node('этаж', 'корпус', 'level'),
      node('склад', 'корпус', 'storage', 2),
    ];
    expect(branchRoot(flat, 'этаж')?.id).toBe('корпус');
    expect(branchOf(flat, 'этаж').map((step) => step.node.id)).toEqual(['корпус', 'этаж', 'склад']);
  });

  it('одинокая организация — тоже ветвь, просто короткая', () => {
    const only: readonly TreeNode[] = [node('орг', null, 'organization')];
    expect(branchOf(only, 'орг').map((step) => step.node.id)).toEqual(['орг']);
  });

  it('удалённый узел в полосу не возвращается', () => {
    const withArchived: readonly TreeNode[] = [
      ...NODES.filter((item) => item.id !== 'корпус-2'),
      node('корпус-2', 'цех-1', 'building', 2, true),
    ];
    const ids = branchOf(withArchived, 'этаж-1').map((step) => step.node.id);
    expect(ids).not.toContain('корпус-2');
    // Вместе с ним уходит и то, что внутри: показывать этаж удалённого здания
    // значило бы предлагать переход в несуществующее место.
    expect(ids).not.toContain('этаж-3');
  });

  it('несуществующий узел даёт пустую ветвь, а не падение', () => {
    expect(branchOf(NODES, 'нет-такого')).toEqual([]);
  });
});
