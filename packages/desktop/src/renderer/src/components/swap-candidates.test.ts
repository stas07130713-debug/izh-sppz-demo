/**
 * Список для обмена местами (ТЗ, Дополнение 6, часть С82).
 *
 * Заказчик: «почему-то некорректно отображает выбор всех огнетушителей при
 * замене». Список собирался по точному виду, а вид у огнетушителей дробный:
 * порошковый, углекислотный, воздушно-эмульсионный. Подменный со склада почти
 * всегда другого вида, чем снимаемый, — и список оказывался пустым там, где
 * замена есть.
 */

import { describe, expect, it } from 'vitest';
import type { PlanObject } from '@izh/contracts';
import { swapCandidates } from './swap-candidates';

function object(id: string, typeCode: string, archived = false): PlanObject {
  return {
    id, siteId: 'объект', nodeId: 'узел', typeCode, regNumber: id,
    position: null, archivedAt: archived ? '2026-01-01T00:00:00Z' : null,
  } as unknown as PlanObject;
}

const ALL: readonly PlanObject[] = [
  object('ОП-1', 'extinguisher-powder'),
  object('ОУ-1', 'extinguisher-co2'),
  object('ОВЭ-1', 'extinguisher-emulsion'),
  object('ОГ-1', 'extinguisher'),
  object('ОП-старый', 'extinguisher-powder', true),
  object('ПК-1', 'fire-hydrant-indoor'),
  object('ИПД-1', 'smoke-detector'),
];

const ids = (list: readonly PlanObject[]): readonly string[] => list.map((item) => item.id);

describe('кем можно заменить', () => {
  it('огнетушитель меняется на огнетушитель любого вида', () => {
    const candidates = swapCandidates(object('ОП-1', 'extinguisher-powder'), ALL);
    expect(ids(candidates)).toEqual(['ОУ-1', 'ОВЭ-1', 'ОГ-1']);
  });

  it('сам объект в списке не предлагается', () => {
    expect(ids(swapCandidates(object('ОУ-1', 'extinguisher-co2'), ALL))).not.toContain('ОУ-1');
  });

  it('выведенное из эксплуатации не предлагается', () => {
    // Его место в архиве, а не на стене.
    expect(ids(swapCandidates(object('ОП-1', 'extinguisher-powder'), ALL))).not.toContain('ОП-старый');
  });

  it('кран не предлагается взамен огнетушителя', () => {
    // Это не замена, а другое оборудование.
    const candidates = ids(swapCandidates(object('ОП-1', 'extinguisher-powder'), ALL));
    expect(candidates).not.toContain('ПК-1');
    expect(candidates).not.toContain('ИПД-1');
  });

  it('у вида без подвидов сравнивается сам вид', () => {
    expect(ids(swapCandidates(object('ПК-2', 'fire-hydrant-indoor'), ALL))).toEqual(['ПК-1']);
  });

  it('извещатели меняются внутри своей группы, а не с огнетушителями', () => {
    const another = [...ALL, object('ИПТ-1', 'heat-detector')];
    expect(ids(swapCandidates(object('ИПД-2', 'smoke-detector'), another))).toEqual(['ИПД-1', 'ИПТ-1']);
  });
});
