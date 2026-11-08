/**
 * Ограничения регламентов и локальных документов
 * (ТЗ, Дополнение 7, часть Ж).
 */

import type { LocalDocument, RegulationPeriodicity } from '@izh/contracts';
import { forbid, isBefore, isCalendarDate, warn, type Problem } from './problem.js';

/** Предел периодичности: от месяца до пятидесяти лет. */
const MIN_MONTHS = 1;
const MAX_MONTHS = 50 * 12;

/**
 * Ж1: периодичность — целое число месяцев в разумных пределах.
 *
 * Верхняя граница не нормативная, а защитная: пятьдесят лет больше срока службы
 * любого средства СППЗ, и число крупнее означает опечатку — «600» вместо «60».
 * Такая опечатка тиха: срок уедет за горизонт, и работа просто исчезнет из
 * поля зрения.
 */
export function periodicityProblems(periodicity: RegulationPeriodicity): readonly Problem[] {
  const rule = periodicity.rule;
  if (rule.kind !== 'интервал') return [];

  const months = rule.unit === 'месяц' ? rule.every
    : rule.unit === 'год' ? rule.every * 12
      : null;
  if (months === null) return [];

  if (!Number.isInteger(rule.every) || rule.every < 1) {
    return [forbid(`«${periodicity.title}»: периодичность — целое число больше нуля.`)];
  }
  if (months < MIN_MONTHS || months > MAX_MONTHS) {
    return [forbid(`«${periodicity.title}»: периодичность вне разумных пределов — от 1 месяца до 50 лет.`)];
  }
  return [];
}

/** Ж2: документ не может начать действовать раньше, чем его утвердили. */
export function localDocumentProblems(document: {
  readonly approvedOn: string | null;
  readonly effectiveFrom: string | null;
}): readonly Problem[] {
  const { approvedOn, effectiveFrom } = document;
  if (!isCalendarDate(approvedOn) || !isCalendarDate(effectiveFrom)) return [];

  return isBefore(effectiveFrom, approvedOn)
    ? [forbid('Документ начинает действовать раньше даты своего утверждения.', 'effectiveFrom')]
    : [];
}

/**
 * Ж3: работа ссылается на документ, который на эту дату не действует.
 *
 * Не запрет: организация вправе сослаться на приказ, который вот-вот вступит в
 * силу, или оставить ссылку на отменённый, пока не переоформит регламент. Но
 * проверяющему такое основание не предъявишь, и знать об этом надо заранее.
 */
export function documentReferenceProblems(
  documents: readonly LocalDocument[],
  referencedIds: readonly string[],
  onDate: string,
): readonly Problem[] {
  return referencedIds.flatMap((id) => {
    const document = documents.find((item) => item.id === id);
    if (document === undefined) {
      return [warn('Работа ссылается на локальный документ, которого нет в перечне.')];
    }

    const started = document.effectiveFrom === null || !isBefore(onDate, document.effectiveFrom);
    const notEnded = document.effectiveTo === null || !isBefore(document.effectiveTo, onDate);
    return started && notEnded
      ? []
      : [warn(`Документ «${document.title}» на эту дату не действует, а работа на него ссылается.`)];
  });
}
