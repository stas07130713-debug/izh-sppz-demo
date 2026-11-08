import type { ConditionColor, ObjectCondition } from '@izh/core';

export type PresentedCondition = {
  readonly color: ConditionColor;
  readonly label: 'норма' | 'исправен с замечаниями' | 'неисправен' | 'нет данных';
};

/** Одно итоговое состояние вместо одновременных «норма» и «с замечаниями». */
export function presentCondition(condition: ObjectCondition): PresentedCondition {
  if (condition.color === 'danger') return { color: 'danger', label: 'неисправен' };
  if (condition.color === 'warn') return { color: 'warn', label: 'исправен с замечаниями' };
  if (condition.color === 'unknown') return { color: 'unknown', label: 'нет данных' };
  return { color: 'ok', label: 'норма' };
}
