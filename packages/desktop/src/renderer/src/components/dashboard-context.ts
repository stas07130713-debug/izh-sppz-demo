/**
 * Общее для всех блоков дашборда: что им передают и как они называют вещи.
 *
 * Отдельным файлом, потому что блоков полтора десятка и живут они в трёх
 * файлах — плитки, графики, списки. Цвета, доли и названия мест не должны
 * расходиться между ними: пользователь читает экран целиком, и «просрочено»
 * обязано быть одного цвета в круге, в полосе и в списке.
 */

import type { PlanObject, TreeNode } from '@izh/contracts';
import { elementByCode, nodeTitle, type DashboardSummary, type ScheduleStatus, type TrendPoint } from '@izh/core';
import type { JournalIntent } from './status-filter';

export const STATUS_COLOR_VAR: Readonly<Record<ScheduleStatus, string>> = {
  'норма': 'var(--ok)',
  'скоро': 'var(--warn)',
  'просрочено': 'var(--danger)',
  'нет данных': 'var(--text-muted)',
};

/** Порядок состояний — от спокойного к тревожному, как в легенде и в полосе. */
export const STATUS_ORDER: readonly ScheduleStatus[] = ['норма', 'скоро', 'просрочено', 'нет данных'];

/**
 * Палитра для круга «Всего по элементам систем».
 *
 * Цвет из каталога элементов здесь не годится: у половины видов он красный —
 * это цвет значка на плане, где рядом стоит буквенная метка. В круге такие
 * доли слились бы в одно пятно, и легенда перестала бы работать.
 */
export const SYSTEM_COLORS: readonly string[] = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed',
  '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5',
];

export interface BlockContext {
  readonly summary: DashboardSummary;
  /**
   * Точки графика динамики.
   *
   * Считаются в панели, а не в блоке: счёт тяжёлый — на каждую точку заново
   * определяется состояние всех элементов, — и повторять его при каждой
   * перерисовке блока нельзя.
   */
  readonly trend: readonly TrendPoint[];
  readonly nodes: readonly TreeNode[];
  readonly onShowObject: (object: PlanObject) => void;
  readonly onOpenJournal: (intent: JournalIntent) => void;
}

/** Доля в процентах или прочерк, если делить не на что. */
export function share(value: number, total: number): string {
  return total === 0 ? '—' : `${Math.round((value / total) * 100)}%`;
}

export function placeOf(nodes: readonly TreeNode[], nodeId: string): string {
  const node = nodes.find((item) => item.id === nodeId);
  return node === undefined ? '—' : nodeTitle(node);
}

export function typeTitle(typeCode: string): string {
  return elementByCode(typeCode)?.title ?? typeCode;
}

export function objectTitle(object: PlanObject): string {
  const title = typeTitle(object.typeCode);
  return object.regNumber === null ? title : `${title} № ${object.regNumber}`;
}
