/**
 * Требование показывается так, как напечатано в приложении № 1 (часть С108).
 *
 * Заказчик: «показывать как требуется согласно таблиц ППР». Сложенный ранг
 * отвечает на вопрос «что купить», но прячет, откуда взялась каждая его часть:
 * буква «С» приходит вместе с классом E, где ранг так и напечатан — «55В, С, Е».
 */

import { describe, expect, it } from 'vitest';
import { roomRequirement } from '../extinguishers/room-requirement.js';

function requirement(classes: readonly ('A' | 'B' | 'C' | 'D' | 'E')[]) {
  return roomRequirement({
    category: 'Д', purpose: 'производственное', areaM2: 300,
    fireClasses: [...classes], hasSuppression: false,
  });
}

describe('графы приложения показываются дословно', () => {
  it('на каждый объявленный класс — своя графа', () => {
    const shown = requirement(['A', 'E']).printedCells;
    expect(shown.map((cell) => cell.fireClass)).toEqual(['A', 'E']);
  });

  it('буква «С» видна в графе класса E, а не сама по себе', () => {
    // Ровно то недоразумение, ради которого графы и показываются: «С» в
    // требовании приходит из класса E, где ранг так и напечатан.
    const shown = requirement(['A', 'E']);
    expect(shown.rankText).toBe('2A, 55B, C, E');
    expect(shown.printedCells.find((cell) => cell.fireClass === 'A')?.asPrinted).toBe('2A');
    expect(shown.printedCells.find((cell) => cell.fireClass === 'E')?.asPrinted).toContain('55B, C, E');
  });

  it('класса С среди объявленных нет — нет и его графы', () => {
    expect(requirement(['A', 'E']).printedCells.some((cell) => cell.fireClass === 'C')).toBe(false);
  });

  it('без классов граф нет', () => {
    expect(requirement([]).printedCells).toEqual([]);
  });
});
