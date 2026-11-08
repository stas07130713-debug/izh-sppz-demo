/**
 * Группа оборудования, закрываемая одной проверкой (Дополнение 6, С5).
 *
 * Ошибка, из-за которой этот файл появился: в чек-листе извещателя стоял
 * заголовок «Огнетушители, обслуживаемые одной партией». Блок показывался
 * всегда и всегда назывался огнетушителями, каким бы ни было оборудование.
 * Здесь закреплено, что группа собирается по смыслу, а не по одному частному
 * случаю, и что чужое в неё не попадает.
 */

import { describe, expect, it } from 'vitest';
import type { PlanObject, TreeNode } from '@izh/contracts';
import { ELEMENT_CATALOG } from '../objects/element-catalog.js';
import { checkGroupFor, checkGroupTitle } from '../objects/check-group.js';

const NODES: readonly TreeNode[] = [
  { id: 'org', parentId: null, kind: 'organization', name: 'Предприятие', archivedAt: null },
  { id: 'b1', parentId: 'org', kind: 'building', name: 'Корпус А', archivedAt: null },
  { id: 'f1', parentId: 'b1', kind: 'level', name: 'Этаж 1', archivedAt: null },
  { id: 'f2', parentId: 'b1', kind: 'level', name: 'Этаж 2', archivedAt: null },
  { id: 'b2', parentId: 'org', kind: 'building', name: 'Корпус Б', archivedAt: null },
  { id: 'f3', parentId: 'b2', kind: 'level', name: 'Этаж 1', archivedAt: null },
] as unknown as readonly TreeNode[];

function object(patch: Partial<PlanObject> & { readonly id: string; readonly typeCode: string }): PlanObject {
  return {
    siteId: 'org', nodeId: 'f1', regNumber: patch.id, model: null, manufacturer: null,
    serialNumber: null, commissionedOn: null, responsible: null, roomId: null,
    position: null, technicalState: 'исправен', note: null, archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', rowVersion: 1,
    ...patch,
  } as unknown as PlanObject;
}

const OBJECTS: readonly PlanObject[] = [
  object({ id: 'ppku-1', typeCode: 'control-panel' }),
  object({ id: 'ppku-2', typeCode: 'control-panel', nodeId: 'f3' }),
  object({ id: 'd1', typeCode: 'smoke-detector', systemId: 'ppku-1' }),
  object({ id: 'd2', typeCode: 'smoke-detector', systemId: 'ppku-1', nodeId: 'f2' }),
  object({ id: 'd3', typeCode: 'smoke-detector', systemId: 'ppku-2', nodeId: 'f3' }),
  object({ id: 'h1', typeCode: 'heat-detector', systemId: 'ppku-1' }),
  object({ id: 'ipr1', typeCode: 'manual-call-point', systemId: 'ppku-1' }),
  object({ id: 'og1', typeCode: 'extinguisher-powder' }),
  object({ id: 'og2', typeCode: 'extinguisher-powder', nodeId: 'f2' }),
  object({ id: 'og3', typeCode: 'extinguisher-co2' }),
  object({ id: 'og4', typeCode: 'extinguisher-powder', nodeId: 'f3' }),
  object({ id: 'gid1', typeCode: 'hydrant' }),
];

const byId = (id: string): PlanObject => {
  const found = OBJECTS.find((item) => item.id === id);
  if (found === undefined) throw new Error(`нет объекта ${id}`);
  return found;
};

describe('группа проверки', () => {
  it('у извещателя нет ни одного огнетушителя', () => {
    // Та самая ошибка: в чек-листе извещателя оказывались огнетушители.
    const group = checkGroupFor(NODES, OBJECTS, byId('d1'));

    expect(group.every((item) => item.typeCode === 'smoke-detector')).toBe(true);
    expect(group.map((item) => item.id).sort()).toEqual(['d1', 'd2']);
  });

  it('группа элемента не выходит за пределы своей системы', () => {
    // У соседнего прибора свой регламент и свои сроки: закрывать его чужой
    // проверкой нельзя.
    const group = checkGroupFor(NODES, OBJECTS, byId('d1'));

    expect(group.map((item) => item.id)).not.toContain('d3');
  });

  it('разные виды внутри одной системы не смешиваются', () => {
    const group = checkGroupFor(NODES, OBJECTS, byId('h1'));

    expect(group.map((item) => item.id)).toEqual(['h1']);
  });

  it('у огнетушителя группа — однотипные того же здания', () => {
    const group = checkGroupFor(NODES, OBJECTS, byId('og1'));

    expect(group.map((item) => item.id).sort()).toEqual(['og1', 'og2']);
    // Углекислотный другого вида, а порошковый из другого корпуса — не в счёт.
    expect(group.map((item) => item.id)).not.toContain('og3');
    expect(group.map((item) => item.id)).not.toContain('og4');
  });

  it('у гидранта группы нет: его проверяют поштучно', () => {
    expect(checkGroupFor(NODES, OBJECTS, byId('gid1')).map((item) => item.id)).toEqual(['gid1']);
  });

  it('сам элемент всегда в своей группе', () => {
    for (const item of OBJECTS) {
      expect(checkGroupFor(NODES, OBJECTS, item).map((object_) => object_.id), item.id).toContain(item.id);
    }
  });

  it('ни по одному виду оборудования в группу не попадает чужой вид', () => {
    // Сплошная проверка по всему каталогу: частный случай сюда больше не
    // просочится незамеченным.
    for (const element of ELEMENT_CATALOG) {
      const probe = object({ id: 'probe', typeCode: element.typeCode });
      const group = checkGroupFor(NODES, [...OBJECTS, probe], probe);
      expect(group.every((item) => item.typeCode === element.typeCode), element.typeCode).toBe(true);
    }
  });
});

describe('заголовок группы', () => {
  it('называет то, что человек видит перед собой', () => {
    expect(checkGroupTitle(byId('d1'), 'Извещатель дымовой')).toBe('Извещатель дымовой — другие в этой же системе');
    expect(checkGroupTitle(byId('og1'), 'Огнетушитель порошковый')).toBe('Огнетушитель порошковый — другие в этом здании');
    expect(checkGroupTitle(byId('gid1'), 'Пожарный гидрант')).toBe('Пожарный гидрант');
  });

  it('слово «огнетушители» не появляется у другого оборудования', () => {
    for (const element of ELEMENT_CATALOG) {
      if (element.typeCode.startsWith('extinguisher')) continue;
      const probe = object({ id: 'probe', typeCode: element.typeCode });
      expect(checkGroupTitle(probe, element.title).toLowerCase(), element.typeCode).not.toContain('огнетушител');
    }
  });
});
