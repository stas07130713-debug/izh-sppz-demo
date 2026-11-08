/**
 * Подключение движка регламентов к журналу (ТЗ, Дополнение 5, части Р9, Р19).
 *
 * Здесь и только здесь встречаются три вещи: регламенты организации, дерево
 * объектов и движок E3. Ядро о движке не знает (AGENTS.md, правило 1), движок
 * не знает о дереве, а связать их — работа приложения.
 *
 * Правило замещения простое: если для элемента на сегодняшнюю дату собрался
 * хоть один действующий регламент, журнал считает по нему. Если регламентов
 * нет — считает по нормативной библиотеке, ровно как считал раньше. Так
 * появление конструктора не сдвигает сроки тем, кто им ещё не пользовался.
 */

import type { IsoDate, PlanObject, RegulationActivity, Regulation, RegulationVersion, TreeNode } from '@izh/contracts';
import { rulePackageSource, type ActivityRule, type ActivityScheduleSource } from '@izh/core';
import { pathToNode } from '@izh/core';
import { assembleRegulation, computeDue, type EffectivePeriodicity } from '@izh/engine-regulations';

export interface RegulationSourceInput {
  readonly regulations: readonly Regulation[];
  readonly versions: readonly RegulationVersion[];
  readonly nodes: readonly TreeNode[];
  /** Общий порог «скоро» из настроек. Периодичность вправе задать свой. */
  readonly soonThresholdDays: number;
}

/** Основание работы одной строкой: то, что пользователь видит под названием. */
function referenceOf(activities: readonly RegulationActivity[]): string {
  const references = new Set<string>();
  for (const activity of activities) {
    for (const source of activity.sources) references.add(source.reference);
  }
  return references.size === 0 ? 'Регламент организации' : [...references].join('; ');
}

/**
 * Периодичность конструктора становится строкой журнала.
 *
 * Периодичность, а не отдельная работа: в конструкторе состав задаётся внутри
 * срока («Ежемесячно» и что именно делать ежемесячно), и проверка закрывается
 * целиком одним окном (часть Р14). Прежние коды мероприятий сохраняются в
 * `historyCodes`, иначе накопленная история осталась бы висеть без правила.
 */
function ruleFromPeriodicity(periodicity: EffectivePeriodicity): ActivityRule {
  // Снятая в конструкторе галочка убирает работу из чек-листа. Из регламента
  // она при этом не исчезает: состав библиотеки остаётся виден, чтобы было
  // понятно, от чего именно организация отказалась (часть Р3).
  const included = periodicity.activities.filter((activity) => activity.required);

  return {
    activityCode: periodicity.id,
    title: periodicity.title,
    // Число месяцев здесь больше ничего не решает: срок считает движок, который
    // умеет и сезонное окно, и число месяца. Поле оставлено пустым намеренно,
    // чтобы никто не начал считать по нему вторым способом.
    periodicityMonths: null,
    checklist: included.map((activity) => ({
      text: activity.title,
      severity: activity.failureImpact === 'неисправно' ? 'критический' : 'значительный',
      ...(activity.answerKind === 'число' ? { measurementCode: activity.id } : {}),
    })),
    ndReference: referenceOf(included),
    needsVerification: false,
    regulationVersionId: periodicity.versionId,
    periodicityId: periodicity.id,
    historyCodes: periodicity.activityCodes ?? [periodicity.id],
  };
}

/**
 * Источник правил по регламентам организации.
 *
 * Сборка идёт на каждую дату заново: регламент версионируется, и для записи
 * прошлого года должен собраться прошлогодний состав работ. Повторные сборки
 * для одного и того же элемента и одной даты запоминаются — журнал перебирает
 * сотни строк на каждую перерисовку, и без этого дерево обходилось бы заново
 * на каждую ячейку.
 */
export function regulationScheduleSource(input: RegulationSourceInput): ActivityScheduleSource {
  const cache = new Map<string, readonly ActivityRule[]>();

  const rulesFor = (object: PlanObject, today: IsoDate): readonly ActivityRule[] => {
    const key = `${object.id}|${object.typeCode}|${today}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    const effective = assembleRegulation({
      regulations: input.regulations,
      versions: input.versions,
      nodePath: pathToNode(input.nodes, object.nodeId).map((node) => node.id),
      objectId: object.id,
      typeCode: object.typeCode,
      onDate: today,
    });

    const own = effective.periodicities.filter((periodicity) => periodicity.enabled).map(ruleFromPeriodicity);

    /**
     * Заменила ли организация нормативную библиотеку своим регламентом.
     *
     * Заменяет только уровень организации, цеха, здания или вида оборудования.
     * Особый порядок отдельного элемента — всегда **добавка** (часть Р8): он
     * назначается поверх общего порядка, а не вместо него. Без этой разницы
     * достаточно было бы добавить крану одну свою проверку, чтобы он потерял
     * все остальные, — и заметили бы это уже при проверке МЧС.
     */
    const replacesLibrary = effective.periodicities.some((periodicity) => periodicity.origin !== 'элемент');

    // Ни одного регламента выше элемента — база берётся из библиотеки. Пустой
    // журнал был бы худшим из ответов: пользователь решил бы, что оборудование
    // обслуживать не нужно.
    const rules = replacesLibrary ? own : [...rulePackageSource.rulesFor(object, today), ...own];

    cache.set(key, rules);
    return rules;
  };

  const nextDueOn = (rule: ActivityRule, lastPerformedOn: IsoDate | null, today: IsoDate): IsoDate | null => {
    // Правило без периодичности пришло из библиотеки — считаем по-старому.
    if (rule.periodicityId === undefined) return rulePackageSource.nextDueOn(rule, lastPerformedOn, today);

    const periodicity = findPeriodicity(input, rule);
    if (periodicity === null) return null;

    return computeDue({
      rule: periodicity.rule,
      lastPerformedOn,
      today,
      warnDaysBefore: periodicity.warnDaysBefore ?? input.soonThresholdDays,
    }).nextDate;
  };

  return { rulesFor, nextDueOn };
}

/** Ищет правило периодичности по её идентификатору среди всех версий. */
function findPeriodicity(input: RegulationSourceInput, rule: ActivityRule): EffectivePeriodicity | null {
  for (const version of input.versions) {
    if (version.id !== rule.regulationVersionId) continue;
    for (const periodicity of version.periodicities) {
      if (periodicity.id !== rule.periodicityId) continue;
      const regulation = input.regulations.find((item) => item.id === version.regulationId);
      return {
        ...periodicity,
        origin: regulation?.scope ?? 'организация',
        regulationId: version.regulationId,
        regulationTitle: regulation?.title ?? '',
        versionId: version.id,
        version: version.version,
      };
    }
  }
  return null;
}
