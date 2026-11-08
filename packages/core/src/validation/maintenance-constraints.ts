/**
 * Ограничения записи о проверке (ТЗ, Дополнение 7, часть Б).
 *
 * Запись журнала неизменяема: внесённое остаётся навсегда (AGENTS.md,
 * правило 10). Поэтому проверять её нужно до записи, а не после — исправить
 * потом будет нечем.
 */

import type { MaintenanceEvent, PlanObject } from '@izh/contracts';
import { forbid, isBefore, isCalendarDate, warn, type Problem } from './problem.js';

export interface MaintenanceConstraintInput {
  readonly objectId: string;
  readonly activityCode: string;
  readonly performedOn: string;
  /** Реквизиты акта сторонней организации, если работы выполняла она. */
  readonly actDate?: string | null;
}

export interface MaintenanceConstraintContext {
  readonly object: PlanObject;
  /** Уже записанные мероприятия по этому объекту: по ним ищутся повторы. */
  readonly events: readonly MaintenanceEvent[];
  readonly today: string;
}

export function maintenanceProblems(
  input: MaintenanceConstraintInput,
  context: MaintenanceConstraintContext,
): readonly Problem[] {
  const problems: Problem[] = [];
  const performed = input.performedOn;
  if (!isCalendarDate(performed)) return problems;

  // Б1. Отчитаться о работе, которой ещё не было, нельзя. Это не придирка:
  // от даты выполнения считается следующий срок, и дата из будущего отодвинула
  // бы проверку неизвестно куда.
  if (isBefore(context.today, performed)) {
    problems.push(forbid('Дата выполнения в будущем: работа ещё не выполнена.', 'performedOn'));
  }

  // Б2. Изделия не существовало — проверять было нечего.
  const made = context.object.extinguisherProfile?.manufacturedOn ?? null;
  if (isCalendarDate(made) && isBefore(performed, made)) {
    problems.push(forbid('Дата выполнения раньше даты изготовления оборудования.', 'performedOn'));
  }

  // Б3. Обычно опечатка, но при переносе старого журнала — норма: оборудование
  // обслуживали и до того, как завели в программе. Поэтому вопрос, а не запрет.
  const placed = context.object.commissionedOn ?? null;
  if (isCalendarDate(placed) && isBefore(performed, placed)) {
    problems.push(warn(
      'Проверка датирована раньше постановки на учёт. Так бывает при переносе старого журнала — убедитесь, что дата верна.',
      'performedOn',
    ));
  }

  problems.push(...actProblems(input, context, performed));
  problems.push(...duplicateProblems(input, context, performed));
  return problems;
}

/** Б4–Б5: реквизиты акта сторонней организации. */
function actProblems(
  input: MaintenanceConstraintInput,
  context: MaintenanceConstraintContext,
  performed: string,
): readonly Problem[] {
  const actDate = input.actDate ?? null;
  if (!isCalendarDate(actDate)) return [];

  const problems: Problem[] = [];
  if (isBefore(context.today, actDate)) {
    problems.push(forbid('Дата акта в будущем.', 'actDate'));
  }
  // Акт оформляют по итогу работ. Более ранняя дата встречается, когда акт
  // выписан на весь визит, а работы шли несколько дней, — поэтому вопрос.
  if (isBefore(actDate, performed)) {
    problems.push(warn('Акт датирован раньше самих работ. Проверьте, та ли это дата.', 'actDate'));
  }
  return problems;
}

/**
 * Б6: повтор той же работы в тот же день.
 *
 * Чаще всего это второе нажатие кнопки или повторное занесение того же обхода.
 * Запретить нельзя: бывает, что работу в тот же день переделали после
 * устранения замечания, и вторая запись законна. Но спросить надо — удалить
 * лишнюю запись потом будет уже невозможно.
 */
function duplicateProblems(
  input: MaintenanceConstraintInput,
  context: MaintenanceConstraintContext,
  performed: string,
): readonly Problem[] {
  const twin = context.events.find((event) => event.objectId === input.objectId
    && event.activityCode === input.activityCode
    && event.performedOn === performed);

  return twin === undefined
    ? []
    : [warn('По этому элементу уже есть запись об этой же работе за эту дату. Записи журнала не удаляются.')];
}
