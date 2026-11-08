/**
 * Превращение нормативной библиотеки в регламент (ТЗ, Дополнение 5, часть Р16).
 *
 * `RULE_PACKAGE` перестаёт быть истиной в последней инстанции и становится
 * **библиотекой по умолчанию**: основой, с которой организация начинает и
 * которую потом дополняет своими требованиями. Сами выверенные данные никуда не
 * деваются — в том числе сверенные 19.08.2026 сроки по огнетушителям.
 *
 * Этот файл — единственное место перевода. Пока конструктор регламентов не
 * заполнен пользователем, программа собирает начальный регламент отсюда, и у
 * организации сразу есть рабочие сроки, а не пустой экран.
 *
 * Обратного перевода нет и не будет: регламент организации богаче библиотеки
 * (несколько оснований, локальные документы, свои периодичности), и сводить его
 * назад к `ActivityRule` значило бы терять сведения.
 */

import type {
  ActivitySource,
  IsoDateTime,
  PeriodicityRule,
  Regulation,
  RegulationActivity,
  RegulationPeriodicity,
  RegulationVersion,
} from '@izh/contracts';
import { activitiesFor, type ActivityChecklistItem, type ActivityRule } from './rule-package.js';

/**
 * Название периодичности по числу месяцев — то, что пользователь видит и в
 * конструкторе, и в чек-листе.
 *
 * Одна функция на оба места намеренно: если настройки назовут срок «Раз в
 * полгода», а чек-лист «Раз в 6 мес.», человек решит, что это разные сроки, и
 * станет искать между ними разницу.
 */
export function periodicityTitle(months: number): string {
  if (months === 1) return 'Ежемесячно';
  if (months === 3) return 'Ежеквартально';
  if (months === 6) return 'Раз в полгода';
  if (months === 12) return 'Ежегодно';
  if (months === 24) return 'Раз в два года';
  if (months === 36) return 'Раз в три года';
  if (months % 12 === 0) return `Раз в ${months / 12} лет`;
  return `Раз в ${months} мес.`;
}

/**
 * Срок по умолчанию для работы, которой норматив числа не даёт.
 *
 * Один месяц. Выбран не из норматива — его там нет, — а из простого правила:
 * у каждой работы должен быть срок, иначе программа не сможет ни посчитать
 * следующую дату, ни напомнить. Прежнее «по необходимости» этого не давало:
 * работа висела в журнале вечным «нет данных» и на глаза не попадалась.
 *
 * Месяц взят как самый частый разумный интервал: ошибиться в сторону более
 * частой проверки безопаснее, чем в сторону редкой. Организация меняет его в
 * конструкторе одним движением, и в основании прямо написано, что срок
 * назначен программой, а не нормативом.
 */
const DEFAULT_MONTHS = 1;

export const DEFAULT_PERIOD_NOTE =
  'Срок норматив не устанавливает — назначен программой по умолчанию, ежемесячно. Измените его под свой регламент ТО.';

/**
 * Правило срока по числу месяцев из библиотеки.
 *
 * `null` в библиотеке означает «срок задан регламентом ТО, паспортом или
 * проектом, а не числом из норматива». Раньше это переводилось в
 * «по необходимости» — честно, но бесполезно: считать по такому правилу нечего.
 * Теперь подставляется срок по умолчанию, а его происхождение видно в
 * основании работы.
 */
function ruleFromMonths(months: number | null): PeriodicityRule {
  return { kind: 'интервал', every: months ?? DEFAULT_MONTHS, unit: 'месяц' };
}

/**
 * Признак источника по тексту нормативной ссылки.
 *
 * ППР — правила противопожарного режима, это нормативный правовой акт, его
 * требования отключать нельзя (часть Р8). ГОСТ и СП — типовые регламенты,
 * организация вправе включать их в свою систему ТО или не включать.
 */
function sourceKindOf(ndReference: string): ActivitySource['kind'] {
  if (ndReference.includes('ППР')) return 'обязательное требование';
  if (ndReference.includes('ГОСТ') || ndReference.includes('СП ')) return 'рекомендация ГОСТ';
  if (ndReference.includes('Локальный')) return 'локальный документ';
  return 'рекомендация ГОСТ';
}

function itemText(item: string | ActivityChecklistItem): string {
  return typeof item === 'string' ? item : item.text;
}

/** Измеряемый пункт становится числовым полем, остальные — галочкой (часть Р5). */
function activityFromItem(rule: ActivityRule, item: string | ActivityChecklistItem, index: number): RegulationActivity {
  const measurementCode = typeof item === 'string' ? undefined : item.measurementCode;
  const severity = typeof item === 'string' ? 'значительный' : item.severity;

  return {
    id: `${rule.activityCode}-${index}`,
    title: itemText(item),
    description: null,
    answerKind: measurementCode === undefined ? 'галочка' : 'число',
    options: [],
    unit: null,
    // Условная работа приходит выключенной: ежеквартальный осмотр по локальному
    // регламенту и полугодовая проверка при неблагоприятных условиях назначаются
    // решением организации, а не действуют сами собой (ГОСТ Р 59641-2021, п. 5.1.7).
    required: rule.optIn !== true,
    sources: [
      { kind: sourceKindOf(rule.ndReference), reference: rule.ndReference, localDocumentId: null },
      // Срок, которого в нормативе нет, обязан быть подписан как назначенный
      // программой: иначе пользователь примет его за требование документа.
      ...(rule.periodicityMonths === null
        ? [{ kind: 'пользовательское' as const, reference: DEFAULT_PERIOD_NOTE, localDocumentId: null }]
        : []),
    ],
    successCriterion: null,
    // Критический пункт выводит элемент из строя, остальные требуют внимания.
    failureImpact: severity === 'критический' ? 'неисправно' : 'требует внимания',
    needsNote: false,
    needsPhoto: false,
    needsDocument: false,
  };
}

/**
 * Собирает периодичности стартового регламента для типа оборудования.
 *
 * Мероприятия библиотеки с одинаковым сроком попадают в одну периодичность:
 * именно так их и показывает конструктор — «Ежемесячно» и внутри состав работ,
 * а не список независимых мероприятий с одинаковой цифрой.
 */
export function defaultPeriodicities(typeCode: string): readonly RegulationPeriodicity[] {
  const byTitle = new Map<string, RegulationActivity[]>();
  const rules = new Map<string, PeriodicityRule>();
  // Какие коды журнала попали в каждую периодичность: по ним подхватывается
  // история, накопленная до появления конструктора.
  const codes = new Map<string, Set<string>>();

  for (const rule of activitiesFor(typeCode)) {
    const title = periodicityTitle(rule.periodicityMonths ?? DEFAULT_MONTHS);
    rules.set(title, ruleFromMonths(rule.periodicityMonths));
    const known = codes.get(title) ?? new Set<string>();
    known.add(rule.activityCode);
    codes.set(title, known);

    const activities = byTitle.get(title) ?? [];
    // Мероприятие библиотеки без чек-листа само становится пунктом работы:
    // «Перекатка рукава» — это и есть работа, отдельных подпунктов у неё нет.
    const items: readonly RegulationActivity[] =
      rule.checklist.length === 0
        ? [activityFromItem(rule, rule.title, 0)]
        : rule.checklist.map((item, index) => activityFromItem(rule, item, index));

    byTitle.set(title, [...activities, ...items]);
  }

  // Порядок — от частого к редкому: ежемесячно, ежеквартально, раз в полгода,
  // ежегодно. Раньше периодичности шли в порядке их появления в библиотеке, и в
  // конструкторе «Раз в полгода» оказывалось после «Ежегодно». Порядок здесь
  // становится порядком и в настройках, и в журнале, и в чек-листе.
  const monthsOf = (title: string): number => {
    const rule = rules.get(title);
    return rule !== undefined && rule.kind === 'интервал' && rule.unit === 'месяц'
      ? rule.every
      : DEFAULT_MONTHS;
  };

  return [...byTitle.entries()]
    .sort(([a], [b]) => monthsOf(a) - monthsOf(b) || a.localeCompare(b, 'ru'))
    .map(([title, activities]) => ({
      id: `default-${typeCode}-${title}`,
      title,
      rule: rules.get(title) ?? { kind: 'интервал', every: DEFAULT_MONTHS, unit: 'месяц' },
      enabled: true,
      activities,
      warnDaysBefore: null,
      activityCodes: [...(codes.get(title) ?? new Set<string>())],
    }));
}

export interface DefaultRegulationInput {
  readonly typeCode: string;
  /** Узел организации: стартовый регламент назначается на неё целиком. */
  readonly organizationId: string;
  readonly now: IsoDateTime;
  /** С какой даты действует. Обычно день создания организации в программе. */
  readonly effectiveFrom: string;
  readonly newId: () => string;
}

/**
 * Создаёт стартовый регламент организации из нормативной библиотеки.
 *
 * Назначается на уровень организации: это основа, поверх которой цех, здание и
 * отдельный элемент добавят своё (часть Р7).
 */
export function defaultRegulation(
  input: DefaultRegulationInput,
): { readonly regulation: Regulation; readonly version: RegulationVersion } {
  const regulationId = input.newId();

  return {
    regulation: {
      id: regulationId,
      title: 'Нормативная библиотека по умолчанию',
      scope: 'организация',
      targetId: input.organizationId,
      typeCode: input.typeCode,
      localDocumentId: null,
      archivedAt: null,
    },
    version: {
      id: input.newId(),
      regulationId,
      version: 1,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: null,
      periodicities: defaultPeriodicities(input.typeCode),
      createdAt: input.now,
    },
  };
}
