/**
 * Кто отвечает за оборудование (Дополнение 6).
 *
 * Ответственный не вписывается в каждую карточку, а берётся с ближайшего узла
 * дерева, где назначен. При сотне огнетушителей ручной ввод означал бы сотню
 * одинаковых строк — и при смене человека какую-нибудь всё равно пропустили бы,
 * оставив в журнале фамилию уволившегося.
 */

import { describe, expect, it } from 'vitest';
import type { PlanObject, TreeNode } from '@izh/contracts';
import { responsibleFor } from '../objects/responsible.js';

const NODES: readonly TreeNode[] = [
  { id: 'org', parentId: null, kind: 'organization', name: 'Предприятие', archivedAt: null, building: null },
  {
    id: 'b1', parentId: 'org', kind: 'building', name: 'Корпус А', archivedAt: null,
    building: { responsible: 'Иванов И.И.' },
  },
  { id: 'f1', parentId: 'b1', kind: 'level', name: 'Этаж 1', archivedAt: null, building: null },
  { id: 'b2', parentId: 'org', kind: 'building', name: 'Корпус Б', archivedAt: null, building: null },
  { id: 'f2', parentId: 'b2', kind: 'level', name: 'Этаж 1', archivedAt: null, building: null },
] as unknown as readonly TreeNode[];

function object(nodeId: string, responsible: string | null = null): PlanObject {
  return { id: 'obj', nodeId, responsible } as unknown as PlanObject;
}

describe('ответственный за объект', () => {
  it('берётся с ближайшего узла вверх по дереву', () => {
    expect(responsibleFor(NODES, object('f1'))).toBe('Иванов И.И.');
  });

  it('не найден — честно сообщается, а не подставляется пустая строка', () => {
    // Пустая графа в журнале означает «не назначен», и её видно.
    expect(responsibleFor(NODES, object('f2'))).toBeNull();
  });

  it('собственное поле объекта имеет преимущество', () => {
    // В старых данных оно заполнено, и молча игнорировать его значило бы
    // потерять то, что пользователь уже внёс.
    expect(responsibleFor(NODES, object('f1', 'Петров П.П.'))).toBe('Петров П.П.');
  });

  it('пустые строки не считаются назначением', () => {
    expect(responsibleFor(NODES, object('f1', '   '))).toBe('Иванов И.И.');
  });

  it('смена ответственного на здании меняет его сразу у всего оборудования', () => {
    // Ради этого механизм и заведён: одно место вместо сотни карточек.
    const renamed = NODES.map((node) => (node.id === 'b1'
      ? ({ ...node, building: { responsible: 'Сидоров С.С.' } } as unknown as TreeNode)
      : node));

    for (const nodeId of ['f1', 'b1']) {
      expect(responsibleFor(renamed, object(nodeId)), nodeId).toBe('Сидоров С.С.');
    }
  });

  it('объект вне дерева не роняет расчёт', () => {
    expect(responsibleFor(NODES, object('нет-такого-узла'))).toBeNull();
  });
});
