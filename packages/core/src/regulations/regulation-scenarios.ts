/**
 * Сценарии работы с регламентами (ТЗ, Дополнение 5).
 *
 * Главное правило здесь одно и оно из части Р9: **действующая версия никогда не
 * переписывается.** Любое изменение состава работ или сроков выпускает новую
 * версию, а прежняя закрывается датой. Иначе запись журнала, сделанная месяц
 * назад, стала бы показывать сегодняшний чек-лист — и предъявить проверяющему
 * было бы нечего.
 */

import type {
  IsoDate,
  Regulation,
  RegulationPeriodicity,
  RegulationScope,
  RegulationTemplate,
  RegulationVersion,
  Result,
} from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { RegulationDeps } from './regulation-deps.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface CreateRegulationInput {
  readonly title: string;
  readonly scope: RegulationScope;
  /** Узел дерева, объект или код типа — смотря какая область действия. */
  readonly targetId: string;
  readonly typeCode: string | null;
  readonly localDocumentId: string | null;
  readonly effectiveFrom: IsoDate;
  readonly periodicities: readonly RegulationPeriodicity[];
}

/** Создаёт регламент вместе с первой версией: регламент без версии бессмыслен. */
export async function createRegulation(
  deps: RegulationDeps,
  input: CreateRegulationInput,
): Promise<Result<{ readonly regulation: Regulation; readonly version: RegulationVersion }>> {
  const title = input.title.trim();
  if (title === '') return err('INVALID_ARGUMENT', 'У регламента должно быть название.');
  if (input.targetId.trim() === '') return err('INVALID_ARGUMENT', 'Не указано, к чему применяется регламент.');
  if (!ISO_DATE.test(input.effectiveFrom)) {
    return err('INVALID_ARGUMENT', 'Дата начала действия должна быть в формате ГГГГ-ММ-ДД.');
  }

  const regulation: Regulation = {
    id: deps.ids.newId(),
    title,
    scope: input.scope,
    targetId: input.targetId,
    typeCode: input.typeCode,
    localDocumentId: input.localDocumentId,
    archivedAt: null,
  };

  const version: RegulationVersion = {
    id: deps.ids.newId(),
    regulationId: regulation.id,
    version: 1,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: null,
    periodicities: input.periodicities,
    createdAt: deps.clock.nowUtc(),
  };

  const savedRegulation = await deps.regulations.saveRegulation(regulation);
  if (!savedRegulation.ok) return savedRegulation;

  const savedVersion = await deps.regulations.saveVersions([version]);
  if (!savedVersion.ok) return savedVersion;

  return ok({ regulation, version });
}

export interface ReleaseVersionInput {
  readonly regulationId: string;
  readonly effectiveFrom: IsoDate;
  readonly periodicities: readonly RegulationPeriodicity[];
}

/**
 * Выпускает новую версию регламента (часть Р9).
 *
 * Прежняя действующая версия закрывается днём раньше начала новой: так на любую
 * дату действует ровно одна версия, и расчёт сроков остаётся определённым.
 * Обе записи уходят в хранилище одной операцией — разорвать их нельзя.
 *
 * Выпуск в тот же день разрешён намеренно. Регламент настраивают и тут же
 * правят: завели порядок, посмотрели в журнал, добавили ежеквартальную
 * проверку. Отказ в такой правке выглядел бы как «кнопка не работает» —
 * журнал остаётся прежним, и понять почему неоткуда.
 */
export async function releaseRegulationVersion(
  deps: RegulationDeps,
  input: ReleaseVersionInput,
): Promise<Result<RegulationVersion>> {
  if (!ISO_DATE.test(input.effectiveFrom)) {
    return err('INVALID_ARGUMENT', 'Дата начала действия должна быть в формате ГГГГ-ММ-ДД.');
  }

  const all = await deps.regulations.listVersions();
  if (!all.ok) return all;

  const own = all.value.filter((version) => version.regulationId === input.regulationId);
  if (own.length === 0) return err('NOT_FOUND', 'Регламент не найден или у него ещё нет ни одной версии.');

  const current = own.reduce((latest, version) => (version.version > latest.version ? version : latest));
  if (input.effectiveFrom < current.effectiveFrom) {
    return err(
      'INVALID_ARGUMENT',
      'Новая версия не может начать действовать раньше предыдущей: история проверок опирается на порядок версий.',
    );
  }

  /**
   * Каким числом закрывается прежняя версия.
   *
   * Обычно — днём раньше начала новой. Но если прежняя началась в тот же день,
   * вчерашним числом её закрыть нельзя: получился бы отрезок, кончающийся
   * раньше своего начала, и версия пропала бы из расчёта вовсе — вместе с
   * проверками, записанными по ней сегодня утром. Тогда она закрывается своим
   * же днём: обе действуют на эту дату, а при пересечении движок берёт старшую
   * по номеру — то есть только что выпущенную.
   */
  const closesOn = previousDay(input.effectiveFrom);
  const closed: RegulationVersion = {
    ...current,
    effectiveTo: closesOn < current.effectiveFrom ? current.effectiveFrom : closesOn,
  };
  const next: RegulationVersion = {
    id: deps.ids.newId(),
    regulationId: input.regulationId,
    version: current.version + 1,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: null,
    periodicities: input.periodicities,
    createdAt: deps.clock.nowUtc(),
  };

  const saved = await deps.regulations.saveVersions([closed, next]);
  if (!saved.ok) return saved;
  return ok(next);
}

/** День перед указанной датой. Календарная арифметика без часового пояса. */
function previousDay(date: IsoDate): IsoDate {
  const [year, month, day] = date.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return date;
  return new Date(Date.UTC(year, month - 1, day - 1, 12)).toISOString().slice(0, 10);
}

/**
 * Выводит регламент из обращения.
 *
 * Пометкой, а не удалением: записи журнала ссылаются на версии этого регламента,
 * и удаление сделало бы прошлые проверки нечитаемыми (AGENTS.md, правило 10).
 */
export async function archiveRegulation(deps: RegulationDeps, regulationId: string): Promise<Result<Regulation>> {
  const all = await deps.regulations.listRegulations();
  if (!all.ok) return all;

  const found = all.value.find((regulation) => regulation.id === regulationId);
  if (found === undefined) return err('NOT_FOUND', 'Регламент не найден.');
  if (found.archivedAt !== null) return ok(found);

  const archived: Regulation = { ...found, archivedAt: deps.clock.nowUtc() };
  const saved = await deps.regulations.saveRegulation(archived);
  if (!saved.ok) return saved;
  return ok(archived);
}

export interface SaveTemplateInput {
  readonly title: string;
  readonly typeCode: string;
  readonly periodicities: readonly RegulationPeriodicity[];
  readonly localDocumentId: string | null;
}

/**
 * Сохраняет настроенный регламент шаблоном (часть Р12).
 *
 * Шаблон — это заготовка, а не действующий регламент: он ничего не назначает и
 * ни на что не влияет, пока его не применят и не выпустят версией. Потому у
 * него нет ни области действия, ни даты начала — только название и содержимое.
 *
 * Смысл в повторе: настроив кран в одном цехе, тот же порядок переносят в
 * остальные, не набирая состав работ заново.
 */
export async function saveRegulationTemplate(
  deps: RegulationDeps,
  input: SaveTemplateInput,
): Promise<Result<RegulationTemplate>> {
  const title = input.title.trim();
  if (title === '') return err('INVALID_ARGUMENT', 'У шаблона должно быть название.');
  if (input.periodicities.length === 0) {
    return err('INVALID_ARGUMENT', 'Пустой шаблон сохранять незачем: в нём нет ни одной периодичности.');
  }

  const template: RegulationTemplate = {
    id: deps.ids.newId(),
    title,
    typeCode: input.typeCode,
    periodicities: input.periodicities,
    localDocumentId: input.localDocumentId,
    createdAt: deps.clock.nowUtc(),
  };

  const saved = await deps.regulations.saveTemplate(template);
  if (!saved.ok) return saved;
  return ok(template);
}
