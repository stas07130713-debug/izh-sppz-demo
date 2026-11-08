/**
 * Сплошная проверка содержимого чек-листа по всем видам оборудования.
 *
 * Появился после замечания заказчика: в чек-листе извещателя оказались
 * огнетушители. Причина была в заголовке блока групповой проверки, который
 * показывался всегда и всегда назывался огнетушителями. Заплатка на одном
 * заголовке ничего бы не гарантировала — поэтому здесь проход по всему
 * каталогу: ни одному виду оборудования не должно достаться чужого.
 */

import { describe, expect, it } from 'vitest';
import type { PlanObject, TreeNode } from '@izh/contracts';
import {
  ELEMENT_CATALOG, activityCellsForObject, checkGroupFor, checkGroupTitle, rulePackageSource,
} from '@izh/core';
import { fieldsFor } from './ExtinguisherMeasurementFields';

const NODES: readonly TreeNode[] = [
  { id: 'org', parentId: null, kind: 'organization', name: 'Предприятие', archivedAt: null },
  { id: 'b1', parentId: 'org', kind: 'building', name: 'Корпус А', archivedAt: null },
  { id: 'f1', parentId: 'b1', kind: 'level', name: 'Этаж 1', archivedAt: null },
] as unknown as readonly TreeNode[];

function probe(typeCode: string): PlanObject {
  return {
    id: `probe-${typeCode}`, siteId: 'org', nodeId: 'f1', typeCode,
    regNumber: '1', model: null, manufacturer: null, serialNumber: null,
    commissionedOn: null, responsible: null, roomId: null, position: null,
    technicalState: 'исправен', note: null, archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', rowVersion: 1,
  } as unknown as PlanObject;
}

/** Всё, что чек-лист покажет пользователю по этому оборудованию, одной строкой. */
function checklistText(typeCode: string): string {
  const object = probe(typeCode);
  const cells = activityCellsForObject(object, [], '2026-08-23', 14, rulePackageSource);
  const works = cells.map((cell) => `${cell.rule.title} ${cell.rule.ndReference} ${cell.rule.checklist
    .map((item) => (typeof item === 'string' ? item : item.text)).join(' ')}`).join(' ');
  const group = checkGroupTitle(object, ELEMENT_CATALOG.find((e) => e.typeCode === typeCode)?.title ?? typeCode);
  const measurements = fieldsFor(typeCode).map((field) => field.label).join(' ');
  return `${works} ${group} ${measurements}`.toLowerCase();
}

/**
 * Слова, которых у неогнетушителя быть не может.
 *
 * Только по-настоящему видовые. «ОТВ» и «заряд» сюда не годятся: огнетушащее
 * вещество есть и у порошкового модуля, и «проверка без выпуска ОТВ» — его
 * законная работа по ГОСТ Р 59636.
 */
const EXTINGUISHER_WORDS = ['огнетушител', 'перезарядк'];

describe('чек-лист не смешивает оборудование', () => {
  it('ни одному виду, кроме огнетушителей, не достаётся огнетушительных работ', () => {
    for (const element of ELEMENT_CATALOG) {
      if (element.typeCode.startsWith('extinguisher')) continue;
      const text = checklistText(element.typeCode);
      for (const word of EXTINGUISHER_WORDS) {
        expect(text, `${element.typeCode} → «${word}»`).not.toContain(word);
      }
    }
  });

  it('дополнительные измерения предлагаются только там, где им место', () => {
    // Взвешивание и давление — это про огнетушители. У извещателя таких полей
    // быть не должно вовсе.
    for (const element of ELEMENT_CATALOG) {
      if (element.typeCode.startsWith('extinguisher')) continue;
      expect(fieldsFor(element.typeCode), element.typeCode).toEqual([]);
    }
  });

  it('у огнетушителей огнетушительные работы на месте', () => {
    // Обратная сторона: вычистив чужое, нельзя было потерять своё.
    expect(checklistText('extinguisher-powder')).toContain('перезарядк');
    expect(fieldsFor('extinguisher-co2').length).toBeGreaterThan(0);
  });

  it('в группе проверки не бывает чужого вида оборудования', () => {
    const objects = ELEMENT_CATALOG.map((element) => probe(element.typeCode));
    for (const object of objects) {
      const group = checkGroupFor(NODES, objects, object);
      expect(group.every((item) => item.typeCode === object.typeCode), object.typeCode).toBe(true);
    }
  });

  it('состав работ у каждого вида — только его собственный', () => {
    // Перекрёстная проверка: работа одного вида не должна встретиться у другого,
    // если её нет в его нормативной библиотеке.
    for (const element of ELEMENT_CATALOG) {
      const cells = activityCellsForObject(probe(element.typeCode), [], '2026-08-23', 14, rulePackageSource);
      const own = new Set(cells.map((cell) => cell.rule.activityCode));
      expect(own.size, element.typeCode).toBe(cells.length);
    }
  });
});
