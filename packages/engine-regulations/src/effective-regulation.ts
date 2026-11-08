/**
 * Сборка действующего регламента по дереву объекта (ТЗ, Дополнение 5, Р7–Р9).
 *
 * Регламент не лежит готовым в одном месте. Организация задаёт основу, цех и
 * здание её дополняют, у отдельного элемента могут быть свои требования — и
 * итоговый регламент конкретного крана собирается из всех применимых уровней.
 *
 * Главное правило: **нижний уровень дополняет верхний, а не заменяет его.**
 * Поэтому сборка — это объединение с указанием источника, а не перекрытие. У
 * каждой строки итогового регламента видно, откуда она взялась: так пользователь
 * понимает, почему кран проверяется ежеквартально, если организация такого не
 * назначала.
 */

import type {
  IsoDate,
  Regulation,
  RegulationActivity,
  RegulationPeriodicity,
  RegulationScope,
  RegulationVersion,
} from '@izh/contracts';
import { ALL_OBJECTS_REGULATION_TARGET_ID, REGULATION_SCOPE_ORDER } from '@izh/contracts';

/** Периодичность с указанием, на каком уровне она назначена. */
export interface EffectivePeriodicity extends RegulationPeriodicity {
  /** Уровень, откуда пришла периодичность: «установлено организацией», «добавлено цехом». */
  readonly origin: RegulationScope;
  readonly regulationId: string;
  readonly regulationTitle: string;
  /** Версия, действовавшая на запрошенную дату: попадает в запись журнала (часть Р9). */
  readonly versionId: string;
  readonly version: number;
}

export interface EffectiveRegulation {
  readonly typeCode: string;
  readonly periodicities: readonly EffectivePeriodicity[];
  /** Регламенты, участвовавшие в сборке. Нужны интерфейсу «просмотреть итоговый регламент». */
  readonly appliedRegulationIds: readonly string[];
}

export interface AssembleInput {
  /** Все регламенты организации. Отобранные и отсортированные — забота движка. */
  readonly regulations: readonly Regulation[];
  /** Все версии. Действующая на дату выбирается здесь же. */
  readonly versions: readonly RegulationVersion[];
  /**
   * Путь по дереву от организации к узлу элемента: идентификаторы узлов по
   * порядку. Строится вызывающей стороной — движок дерева не знает.
   */
  readonly nodePath: readonly string[];
  /** Идентификатор самого объекта: для регламентов уровня «элемент». */
  readonly objectId: string;
  readonly typeCode: string;
  /** Дата, на которую собирается регламент. Обычно сегодня, но для старой записи — её дата. */
  readonly onDate: IsoDate;
}

/** Версия, действовавшая на указанную дату. */
function versionOnDate(
  versions: readonly RegulationVersion[],
  regulationId: string,
  onDate: IsoDate,
): RegulationVersion | null {
  const applicable = versions
    .filter((version) => version.regulationId === regulationId)
    .filter((version) => version.effectiveFrom <= onDate)
    .filter((version) => version.effectiveTo === null || version.effectiveTo >= onDate);

  if (applicable.length === 0) return null;
  // Если по недосмотру пересеклись две версии, берём старшую по номеру: она
  // введена позже, и это ближе к намерению пользователя.
  return applicable.reduce((latest, current) => (current.version > latest.version ? current : latest));
}

/** Относится ли регламент к этому объекту: по области действия и по типу. */
function applies(regulation: Regulation, input: AssembleInput): boolean {
  if (regulation.archivedAt !== null) return false;
  if (regulation.typeCode !== null && regulation.typeCode !== input.typeCode) return false;

  switch (regulation.scope) {
    case 'организация':
      if (regulation.targetId === ALL_OBJECTS_REGULATION_TARGET_ID) return true;
      return input.nodePath.includes(regulation.targetId);
    case 'цех':
    case 'здание':
      // Уровень дерева применим, если он лежит на пути к элементу.
      return input.nodePath.includes(regulation.targetId);
    case 'тип оборудования':
      return regulation.targetId === input.typeCode;
    case 'элемент':
      return regulation.targetId === input.objectId;
  }
}

/**
 * Объединяет две одноимённые периодичности разных уровней.
 *
 * Совпадение по названию считается совпадением по смыслу: если и организация, и
 * цех задали «Ежемесячно», это одна и та же ежемесячная работа с разным
 * составом, а не две независимые. Состав объединяется, источником указывается
 * младший уровень — именно он дополнил требование.
 */
function mergePeriodicity(base: EffectivePeriodicity, addition: EffectivePeriodicity): EffectivePeriodicity {
  const known = new Set(base.activities.map((activity) => activity.title));
  const extra = addition.activities.filter((activity) => !known.has(activity.title));

  return {
    ...base,
    // Включённой периодичность считается, если её включил хоть один уровень:
    // выключение вышестоящего требования — отдельное действие (часть Р8).
    enabled: base.enabled || addition.enabled,
    origin: addition.origin,
    activities: [...base.activities, ...extra],
    warnDaysBefore: addition.warnDaysBefore ?? base.warnDaysBefore,
  };
}

/**
 * Собирает действующий регламент.
 *
 * Порядок обхода — от организации к элементу (часть Р8): так младший уровень
 * дополняет уже собранное, а не наоборот.
 */
export function assembleRegulation(input: AssembleInput): EffectiveRegulation {
  const applicable = input.regulations.filter((regulation) => applies(regulation, input));

  const ordered = [...applicable].sort(
    (a, b) => {
      const scope = REGULATION_SCOPE_ORDER.indexOf(a.scope) - REGULATION_SCOPE_ORDER.indexOf(b.scope);
      if (scope !== 0) return scope;
      // Общее правило — фундамент. Правило конкретной организации дополняет
      // его после, а не наоборот.
      return Number(b.targetId === ALL_OBJECTS_REGULATION_TARGET_ID)
        - Number(a.targetId === ALL_OBJECTS_REGULATION_TARGET_ID);
    },
  );

  const byTitle = new Map<string, EffectivePeriodicity>();
  const appliedRegulationIds: string[] = [];

  for (const regulation of ordered) {
    const version = versionOnDate(input.versions, regulation.id, input.onDate);
    if (version === null) continue;
    appliedRegulationIds.push(regulation.id);

    for (const periodicity of version.periodicities) {
      const effective: EffectivePeriodicity = {
        ...periodicity,
        origin: regulation.scope,
        regulationId: regulation.id,
        regulationTitle: regulation.title,
        versionId: version.id,
        version: version.version,
      };

      const existing = byTitle.get(periodicity.title);
      byTitle.set(periodicity.title, existing === undefined ? effective : mergePeriodicity(existing, effective));
    }
  }

  return {
    typeCode: input.typeCode,
    periodicities: [...byTitle.values()],
    appliedRegulationIds,
  };
}

/**
 * Можно ли выключить это мероприятие (часть Р8).
 *
 * Обязательное требование нормативного правового акта отключать нельзя.
 * Рекомендации ГОСТ и всё остальное организация включает и выключает свободно,
 * исходя из принятой у неё системы ТО.
 */
export function canDisableActivity(activity: RegulationActivity): boolean {
  return !activity.sources.some((source) => source.kind === 'обязательное требование');
}
