/**
 * Сборка рабочего чек-листа (ТЗ, Дополнение 5, части Р10 и Р13).
 *
 * При открытии проверки программа сама определяет: какой регламент применим,
 * какая его версия действует, какие периодичности наступили и что в них входит.
 * Пользователь не выбирает это вручную и не переносит результаты в журнал —
 * иначе смысл конструктора теряется.
 *
 * Если на один день пришлось несколько периодичностей, они показываются одним
 * окном с разделами, но результаты записываются **отдельно по каждой**, и
 * следующие даты считаются независимо (часть Р10). Это важно: ежемесячный
 * осмотр и годовая перекатка рукава, выполненные в один день, не должны
 * сливаться в одну запись — у них разные сроки и разные основания.
 */

import type { IsoDate } from '@izh/contracts';
import type { EffectivePeriodicity } from './effective-regulation.js';
import { computeDue, type DueDate } from './periodicity.js';

/** Один раздел чек-листа: периодичность и её состав работ. */
export interface ChecklistSection {
  readonly periodicity: EffectivePeriodicity;
  readonly due: DueDate;
  /** Наступила ли работа: просрочена или подошла вплотную. */
  readonly isDue: boolean;
}

export interface AssembledChecklist {
  /** Разделы, которые наступили: то, что нужно сделать сейчас. */
  readonly due: readonly ChecklistSection[];
  /** Остальные периодичности регламента: показываются как «срок не наступил». */
  readonly upcoming: readonly ChecklistSection[];
  /** Худшее состояние среди наступивших: им окрашивается элемент на плане. */
  readonly worstState: DueDate['state'];
}

/** Что известно о прошлых выполнениях: последняя дата по каждой периодичности. */
export interface PeriodicityHistory {
  readonly periodicityId: string;
  readonly lastPerformedOn: IsoDate;
}

export interface AssembleChecklistInput {
  readonly periodicities: readonly EffectivePeriodicity[];
  readonly history: readonly PeriodicityHistory[];
  readonly today: IsoDate;
  /** Общий порог «скоро» из настроек. Периодичность может задать свой. */
  readonly warnDaysBefore: number;
  /** Дата отсчёта из карточки, если выполнений ещё не было: ввод в эксплуатацию, паспорт. */
  readonly baseline?: IsoDate | null;
  /** Даты наступивших событий по периодичностям с событийным правилом. */
  readonly triggeredOn?: ReadonlyMap<string, IsoDate>;
}

const STATE_RANK: Readonly<Record<DueDate['state'], number>> = {
  'просрочено': 0,
  'скоро': 1,
  'норма': 2,
  'нет данных': 3,
};

/**
 * Собирает чек-лист на дату.
 *
 * Выключенные периодичности пропускаются целиком: организация решила, что эта
 * работа у неё не ведётся, и показывать её как несделанную было бы неверно.
 */
export function assembleChecklist(input: AssembleChecklistInput): AssembledChecklist {
  const lastByPeriodicity = new Map(input.history.map((item) => [item.periodicityId, item.lastPerformedOn]));

  const sections: ChecklistSection[] = [];
  for (const periodicity of input.periodicities) {
    if (!periodicity.enabled) continue;

    const due = computeDue({
      rule: periodicity.rule,
      lastPerformedOn: lastByPeriodicity.get(periodicity.id) ?? null,
      today: input.today,
      warnDaysBefore: periodicity.warnDaysBefore ?? input.warnDaysBefore,
      baseline: input.baseline ?? null,
      triggeredOn: input.triggeredOn?.get(periodicity.id) ?? null,
    });

    // Наступившим считается просроченное и подошедшее вплотную. «Нет данных»
    // сюда не попадает: это либо работа без срока, либо нехватка сведений, и
    // предлагать её к выполнению наравне с просроченной нельзя.
    const isDue = due.state === 'просрочено' || due.state === 'скоро';
    sections.push({ periodicity, due, isDue });
  }

  const due = sections.filter((section) => section.isDue);
  const upcoming = sections.filter((section) => !section.isDue);

  const worstState = sections.reduce<DueDate['state']>(
    (worst, section) => (STATE_RANK[section.due.state] < STATE_RANK[worst] ? section.due.state : worst),
    'нет данных',
  );

  return { due, upcoming, worstState };
}

/**
 * Сколько работ в чек-листе всего — по всем наступившим разделам сразу.
 *
 * Нужно интерфейсу, чтобы показать «к выполнению: 12 пунктов в 3 разделах» до
 * того, как пользователь начнёт раскрывать разделы.
 */
export function countActivities(sections: readonly ChecklistSection[]): number {
  return sections.reduce((total, section) => total + section.periodicity.activities.length, 0);
}
