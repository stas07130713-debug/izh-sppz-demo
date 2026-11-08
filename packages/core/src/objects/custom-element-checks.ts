/**
 * Проверки и сроки своего вида элемента (движок E4 поверх E3).
 *
 * Задаются в том же окне конструктора, что значок и поля карточки, — заказчик
 * просил «чтобы было как конструктор». Но **хранятся** они регламентом, как у
 * встроенных видов: область «тип оборудования», цель — код вида.
 *
 * Это не обход просьбы, а её единственное надёжное исполнение. Сроки считает
 * движок регламентов, по ним строится журнал, они версионируются, и старая
 * проверка обязана навсегда помнить тот чек-лист, который действовал в её день.
 * Второе хранилище сроков рядом означало бы два ответа на вопрос «когда
 * следующая проверка» — и никакого способа узнать, чей верен.
 */

import type {
  IsoDate, RegulationActivity, RegulationPeriodicity, RegulationVersion, Regulation, Result,
} from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { RegulationDeps } from '../regulations/regulation-deps.js';
import { createRegulation, releaseRegulationVersion } from '../regulations/regulation-scenarios.js';

/** Область, которой конструктор пользуется. Вынесена, чтобы не разъехаться. */
const SCOPE = 'тип оборудования';

/**
 * Регламент своего вида, если он уже заведён.
 *
 * Ищется по области и цели, а не по названию: название пользователь правит.
 */
export function customElementRegulation(
  regulations: readonly Regulation[],
  typeCode: string,
): Regulation | null {
  return regulations.find((item) => item.scope === SCOPE
    && item.targetId === typeCode
    && item.archivedAt === null) ?? null;
}

/** Действующая версия регламента: последняя по номеру. */
export function latestVersion(
  versions: readonly RegulationVersion[],
  regulationId: string,
): RegulationVersion | null {
  const own = versions.filter((item) => item.regulationId === regulationId);
  if (own.length === 0) return null;
  return own.reduce((best, item) => (item.version > best.version ? item : best));
}

export interface SaveCustomChecksInput {
  readonly typeCode: string;
  /** Название вида: из него складывается название регламента. */
  readonly title: string;
  readonly periodicities: readonly RegulationPeriodicity[];
  readonly today: IsoDate;
  /** Уже прочитанные регламенты: сценарий не читает хранилище второй раз. */
  readonly regulations: readonly Regulation[];
}

/**
 * Записывает проверки своего вида: заводит регламент или выпускает новую версию.
 *
 * Новая версия, а не правка прежней (часть Р9): записи журнала ссылаются на
 * версию, и правка задним числом переписала бы состав уже проведённых проверок.
 */
export async function saveCustomElementChecks(
  deps: RegulationDeps,
  input: SaveCustomChecksInput,
): Promise<Result<Regulation>> {
  if (input.typeCode.trim() === '') return err('INVALID_ARGUMENT', 'Не указан вид оборудования.');

  const existing = customElementRegulation(input.regulations, input.typeCode);

  if (existing === null) {
    const created = await createRegulation(deps, {
      title: `Обслуживание: ${input.title}`,
      scope: SCOPE,
      targetId: input.typeCode,
      typeCode: input.typeCode,
      localDocumentId: null,
      effectiveFrom: input.today,
      periodicities: input.periodicities,
    });
    return created.ok ? ok(created.value.regulation) : created;
  }

  const released = await releaseRegulationVersion(deps, {
    regulationId: existing.id,
    effectiveFrom: input.today,
    periodicities: input.periodicities,
  });
  return released.ok ? ok(existing) : released;
}

export interface NewPeriodicityInput {
  readonly id: string;
  readonly title: string;
  readonly every: number;
  readonly unit: 'день' | 'месяц' | 'год';
  /** Названия работ. Каждая станет строкой чек-листа с ответом «галочка». */
  readonly works: readonly { readonly id: string; readonly title: string }[];
}

/**
 * Собирает периодичность из того немногого, что спрашивает конструктор.
 *
 * Полный конструктор регламентов умеет несравнимо больше: измерения с
 * единицами, критерии годности, ссылки на пункты НПА, отметки о фото и
 * документе. Здесь этого нет намеренно — заказчик просил простой и понятный
 * механизм без излишеств, а всё остальное доступно там же, в конструкторе
 * регламентов, куда раздел прямо ведёт.
 */
export function periodicityFromInput(input: NewPeriodicityInput): RegulationPeriodicity {
  const activities: readonly RegulationActivity[] = input.works
    .filter((work) => work.title.trim() !== '')
    .map((work) => ({
      id: work.id,
      title: work.title.trim(),
      description: null,
      answerKind: 'галочка',
      options: [],
      unit: null,
      required: true,
      // Основание — собственное решение организации: свой вид оборудования по
      // определению не описан ни ППР, ни ГОСТом, и ссылаться не на что.
      sources: [{ kind: 'пользовательское', reference: 'Решение организации', localDocumentId: null }],
      successCriterion: null,
      failureImpact: 'требует внимания',
      needsNote: false,
      needsPhoto: false,
      needsDocument: false,
    }));

  return {
    id: input.id,
    title: input.title.trim(),
    rule: { kind: 'интервал', every: Math.max(1, Math.round(input.every)), unit: input.unit },
    enabled: true,
    activities,
    warnDaysBefore: null,
  };
}
