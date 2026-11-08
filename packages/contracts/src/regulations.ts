/**
 * Модель регламентов технического обслуживания (ТЗ, Дополнение 5).
 *
 * Это данные для движка E3. Здесь нет ни одного зашитого норматива: сроки,
 * состав работ и основания приходят из библиотеки по умолчанию и из настроек
 * организации, а не из кода (AGENTS.md, правило 9).
 *
 * Ключевое отличие от прежнего пакета правил: регламент теперь не один на всех.
 * Нормативная библиотека — только основа; поверх неё организация, цех, здание и
 * отдельный элемент добавляют свои требования, и итоговый регламент собирается
 * из всех применимых уровней (часть Р7).
 */

import type { IsoDate, IsoDateTime } from './basic-types.js';
import type { Result } from './result.js';

export type RegulationId = string;
export type PeriodicityId = string;
export type RegulationActivityId = string;
export type LocalDocumentId = string;

/**
 * Откуда взялось требование (часть Р2).
 *
 * На попадание в журнал не влияет — записывается всё одинаково. Влияет на две
 * вещи: что показано пользователю и что он вправе отключить (часть Р8).
 */
export type SourceKind =
  | 'обязательное требование'
  | 'рекомендация ГОСТ'
  | 'проектная документация'
  | 'требование изготовителя'
  | 'локальный документ'
  | 'пользовательское';

export interface ActivitySource {
  readonly kind: SourceKind;
  /** Документ и пункт: «ППР РФ №1479, п. 50». Для локального — название документа. */
  readonly reference: string;
  readonly localDocumentId: LocalDocumentId | null;
}

/**
 * Как заполняется результат мероприятия (часть Р5).
 *
 * «Число» нужно там, где проверка измеряет: давление, масса, утечка. Хранить
 * такие проверки галочкой значит терять само измерение.
 */
export type AnswerKind = 'галочка' | 'число' | 'текст' | 'выбор';

/** Во что отрицательный результат переводит элемент (часть Р5). */
export type FailureImpact = 'не влияет' | 'требует внимания' | 'неисправно';

export interface RegulationActivity {
  readonly id: RegulationActivityId;
  readonly title: string;
  readonly description: string | null;
  readonly answerKind: AnswerKind;
  /** Варианты для answerKind = 'выбор'. */
  readonly options: readonly string[];
  /** Единица измерения для answerKind = 'число': МПа, кг, %. */
  readonly unit: string | null;
  readonly required: boolean;
  /** Оснований может быть несколько сразу: НПА, ГОСТ и локальный регламент (часть Р6). */
  readonly sources: readonly ActivitySource[];
  readonly successCriterion: string | null;
  readonly failureImpact: FailureImpact;
  readonly needsNote: boolean;
  readonly needsPhoto: boolean;
  readonly needsDocument: boolean;
}

/** Единица интервала. Дни нужны для сроков вида «каждые 180 дней». */
export type IntervalUnit = 'день' | 'месяц' | 'год';

/**
 * Чем вызывается мероприятие с событийной периодичностью (часть Р3).
 *
 * У таких мероприятий нет плановой даты: они наступают по факту события и до
 * него не считаются просроченными.
 */
export type PeriodicityTrigger =
  | 'после ремонта'
  | 'после срабатывания'
  | 'после замены'
  | 'после длительного простоя';

/**
 * Правило расчёта срока (часть Р3).
 *
 * Размеченное объединение, а не набор необязательных полей: у календарного
 * правила нет интервала, у событийного нет ни того, ни другого, и тип обязан
 * это отражать, иначе расчёт придётся защищать проверками на каждом шагу.
 */
export type PeriodicityRule =
  /** Раз в N единиц от последнего выполнения. Ежемесячно, ежегодно, раз в 5 лет. */
  | { readonly kind: 'интервал'; readonly every: number; readonly unit: IntervalUnit }
  /** Каждое N число месяца. */
  | { readonly kind: 'календарь-месяц'; readonly dayOfMonth: number }
  /** В названные месяцы года: например, март и сентябрь. Месяцы — 1..12. */
  | { readonly kind: 'календарь-годовой'; readonly months: readonly number[]; readonly dayOfMonth: number }
  /** По факту события, плановой даты нет. */
  | { readonly kind: 'событие'; readonly trigger: PeriodicityTrigger }
  /** Привязано к сроку службы изделия из паспорта. */
  | { readonly kind: 'срок-службы' }
  /** По необходимости: сроков нет, выполняется по решению ответственного. */
  | { readonly kind: 'по-необходимости' };

export interface RegulationPeriodicity {
  readonly id: PeriodicityId;
  /** Название для пользователя: «Ежемесячно», «Раз в полгода». */
  readonly title: string;
  readonly rule: PeriodicityRule;
  /** Переключатель «использовать данную периодичность» (часть Р3). */
  readonly enabled: boolean;
  /** Состав работ именно этой периодичности (часть Р4). */
  readonly activities: readonly RegulationActivity[];
  /** За сколько дней предупреждать. null — берётся общий порог из настроек. */
  readonly warnDaysBefore: number | null;
  /**
   * Коды мероприятий журнала, вошедшие в эту периодичность.
   *
   * Нужны, чтобы переход на конструктор не оборвал уже накопленную историю.
   * Новые записи ссылаются на периодичность прямо (`periodicityId` в
   * `MaintenanceEvent`), но записи, сделанные раньше, знают только код
   * мероприятия — «osmotr», «perezaryadka». Переписать их задним числом нельзя:
   * журнал эксплуатации не правится (AGENTS.md, правило 10). Поэтому связь
   * хранится здесь, со стороны регламента, где её менять можно.
   */
  readonly activityCodes?: readonly string[];
}

/**
 * Уровень дерева, на котором задан регламент (часть Р7).
 *
 * Порядок в массиве — это порядок приоритета из части Р8, от старшего к
 * младшему. Младший уровень дополняет старший, а не заменяет его.
 */
export type RegulationScope = 'организация' | 'цех' | 'здание' | 'тип оборудования' | 'элемент';

/** Особая цель регламента: все организации и все объекты, заведённые в системе. */
export const ALL_OBJECTS_REGULATION_TARGET_ID = '__all_objects__';

export const REGULATION_SCOPE_ORDER: readonly RegulationScope[] = [
  'организация',
  'цех',
  'здание',
  'тип оборудования',
  'элемент',
];

/**
 * Версия регламента (часть Р9).
 *
 * Регламент не переписывается: изменение создаёт новую версию со своей датой
 * начала действия. Запись журнала ссылается на версию, поэтому старая проверка
 * навсегда показывает тот чек-лист, который действовал в её день.
 */
export interface RegulationVersion {
  readonly id: string;
  readonly regulationId: RegulationId;
  /** Порядковый номер: 1, 2, 3. Показывается пользователю как «v2». */
  readonly version: number;
  readonly effectiveFrom: IsoDate;
  /** null — действует по настоящее время. */
  readonly effectiveTo: IsoDate | null;
  readonly periodicities: readonly RegulationPeriodicity[];
  readonly createdAt: IsoDateTime;
}

/**
 * Регламент: к какому оборудованию и к какой части дерева он applies.
 *
 * Сам регламент — это «шапка», всё содержательное лежит в его версиях.
 */
export interface Regulation {
  readonly id: RegulationId;
  readonly title: string;
  readonly scope: RegulationScope;
  /**
   * К чему привязан: идентификатор узла дерева или объекта.
   * Для области «тип оборудования» — код типа из каталога элементов.
   */
  readonly targetId: string;
  /** Код типа оборудования. null — регламент применяется ко всем типам в области. */
  readonly typeCode: string | null;
  readonly localDocumentId: LocalDocumentId | null;
  readonly archivedAt: IsoDateTime | null;
}

/** Локальный нормативный документ организации (часть Р6). */
export interface LocalDocument {
  readonly id: LocalDocumentId;
  readonly title: string;
  readonly number: string | null;
  readonly approvedOn: IsoDate | null;
  readonly effectiveFrom: IsoDate | null;
  readonly effectiveTo: IsoDate | null;
  readonly organization: string | null;
  readonly department: string | null;
  /** Ссылка на файл в хранилище документов. */
  readonly fileHash: string | null;
  readonly note: string | null;
}

/** Шаблон настроенного регламента (часть Р12). */
export interface RegulationTemplate {
  readonly id: string;
  readonly title: string;
  readonly typeCode: string;
  readonly periodicities: readonly RegulationPeriodicity[];
  readonly localDocumentId: LocalDocumentId | null;
  readonly createdAt: IsoDateTime;
}

/**
 * Хранение регламентов.
 *
 * Версии пишутся только пачкой: выпуск новой одновременно закрывает прежнюю
 * (проставляет ей `effectiveTo`), и разорвать эти два действия нельзя — иначе
 * на диске окажутся либо две действующие версии сразу, либо ни одной, и расчёт
 * сроков перестанет быть определённым.
 *
 * Удаления в порте нет: регламент выводится из обращения пометкой `archivedAt`.
 * Записи журнала ссылаются на версии, и удаление версии сделало бы прошлую
 * проверку нечитаемой (AGENTS.md, правило 10).
 */
export interface RegulationRepository {
  listRegulations(): Promise<Result<readonly Regulation[]>>;
  listVersions(): Promise<Result<readonly RegulationVersion[]>>;
  listDocuments(): Promise<Result<readonly LocalDocument[]>>;
  listTemplates(): Promise<Result<readonly RegulationTemplate[]>>;
  saveRegulation(regulation: Regulation): Promise<Result<void>>;
  saveVersions(versions: readonly RegulationVersion[]): Promise<Result<void>>;
  saveDocument(document: LocalDocument): Promise<Result<void>>;
  saveTemplate(template: RegulationTemplate): Promise<Result<void>>;
}
