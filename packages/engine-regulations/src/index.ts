/**
 * Движок E3 — регламенты технического обслуживания и проверок.
 *
 * Отвечает на три вопроса и больше ни на что:
 *   1. когда следующий срок по данному правилу периодичности;
 *   2. какой регламент действует для данного элемента на данную дату;
 *   3. что нужно сделать сегодня и каким составом.
 *
 * Правила движка соблюдаются буквально (AGENTS.md):
 *   — зависит только от `@izh/contracts`;
 *   — ничего не читает и не пишет: ни файлов, ни базы. Получает данные
 *     параметрами, возвращает результат;
 *   — детерминирован: сегодняшняя дата приходит извне, внутри `Date.now()` нет.
 *     Поэтому расчёт сроков воспроизводим в тестах, а это единственный способ
 *     доверять ему в предметной области, где ошибка стоит замечания МЧС.
 *
 * Нормативных чисел здесь тоже нет: сроки и состав работ приходят данными из
 * библиотеки по умолчанию и из настроек организации (правило 9).
 *
 * Смотри docs/04_Дополнение_5_движок_регламентов.md.
 */

export { addDays, addMonths, daysBetween, makeIso, parseIso } from './calendar.js';
export { computeDue, type DueDate, type DueInput, type DueState } from './periodicity.js';
export {
  assembleRegulation,
  canDisableActivity,
  type AssembleInput,
  type EffectivePeriodicity,
  type EffectiveRegulation,
} from './effective-regulation.js';
export {
  assembleChecklist,
  countActivities,
  type AssembledChecklist,
  type AssembleChecklistInput,
  type ChecklistSection,
  type PeriodicityHistory,
} from './checklist.js';
