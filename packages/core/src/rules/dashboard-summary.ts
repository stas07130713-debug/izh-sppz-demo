/**
 * Сводка дашборда (ТЗ, Дополнение 6, часть С49).
 *
 * Считается в ядре, а не в разметке: у сводки есть правило отбора — уровень
 * объекта плюс выбранные системы, — и правило это надо уметь проверить, а не
 * пересказывать в каждом блоке экрана заново.
 *
 * Счёт идёт по **элементам**, а не по мероприятиям: у каждого элемента один
 * статус — худший из его проверок. Поэтому числа состояний всегда складываются
 * в общее число элементов, а не в сумму проверок, которую нельзя сверить на
 * глаз.
 */

import type { IsoDate, MaintenanceEvent, PlanObject, TechnicalState } from '@izh/contracts';
import { inStorage, needsPlacement } from '../objects/storage-placement.js';
import { isSystemHead } from '../objects/fire-system.js';
import { activityCellsForObject, technicalStateForObject, worstObjectStatus } from './activity-status.js';
import { systemCondition, type SystemCondition } from './system-condition.js';
import { conditionFilterTags, type FilterTag } from './filter-tags.js';
import { objectCondition } from './object-condition.js';
import type { ActivityScheduleSource } from './activity-source.js';
import type { ScheduleStatus } from './schedule.js';
import { technicalEscalation } from './object-condition.js';

/** Одна просроченная работа. */
export interface OverdueWork {
  readonly object: PlanObject;
  readonly activityTitle: string;
  readonly date: IsoDate;
  readonly daysLate: number;
}

/** Предстоящая работа: одна строка на пару «работа + дата». */
export interface UpcomingWork {
  readonly activityTitle: string;
  readonly date: IsoDate;
  readonly count: number;
}

/**
 * Предстоящая работа по конкретному элементу.
 *
 * Заказчик (пункт 12 перечня доработок): «формировать количество уведомлений
 * только по реально существующим событиям; каждое число в счётчике должно
 * соответствовать реальной записи; при нажатии на категорию пользователь
 * должен увидеть список соответствующих элементов; при нажатии на конкретное
 * уведомление переходить к соответствующему элементу».
 *
 * Прежде уведомление о ближайших сроках считалось по работам, сведённым в
 * пары «название работы плюс дата», а переход вёл в журнал с отбором «скоро».
 * Это два разных счёта: список сроков берёт всё, до чего меньше тридцати дней,
 * а метка «скоро» зависит от настроенного порога и может быть короче. Работа,
 * до которой двадцать пять дней, попадала в счётчик, но в журнале по метке
 * «скоро» не находилась — счётчик показывал единицу, а список выходил пустым.
 *
 * Поэтому здесь и счёт, и список берутся из одного перечня самих элементов.
 */
export interface UpcomingItem {
  readonly object: PlanObject;
  readonly activityTitle: string;
  readonly date: IsoDate;
  /** Сколько дней осталось. Ноль — срок сегодня. */
  readonly daysLeft: number;
}

/** Неисправный элемент и то, чем именно он неисправен. */
export interface BrokenItem {
  readonly object: PlanObject;
  readonly state: TechnicalState;
}

/** Сколько элементов вида и сколько из них не в норме. */
export interface TypeTally {
  readonly typeCode: string;
  readonly total: number;
  readonly counts: Readonly<Record<ScheduleStatus, number>>;
}

/** Сколько элементов в месте и сколько из них требуют внимания. */
export interface PlaceTally {
  readonly nodeId: string;
  readonly total: number;
  readonly overdue: number;
  readonly broken: number;
  /**
   * Разбивка по срокам — для полосы «Состояние по объектам».
   *
   * Отдельно от `overdue`: полоса рисует все четыре состояния, а не одно,
   * и складывать доли она обязана ровно в `total`. Считать их в разметке
   * значило бы завести второй счёт рядом с этим.
   */
  readonly counts: Readonly<Record<ScheduleStatus, number>>;
}

/** Прибор и оба его состояния — для блока «Системы пожарной автоматики». */
export interface SystemTally {
  readonly head: PlanObject;
  readonly condition: SystemCondition;
}

export interface DashboardSummaryInput {
  /** Область уровня — то же, что видит журнал (`journalScope`). */
  readonly objects: readonly PlanObject[];
  readonly events: readonly MaintenanceEvent[];
  readonly today: IsoDate;
  readonly soonThresholdDays: number;
  readonly source: ActivityScheduleSource;
  /**
   * Отбор систем. `null` — все; иначе только перечисленные виды.
   *
   * Пустое множество и `null` — разные вещи: пустое означает «не выбрано ни
   * одной системы», и дашборд честно показывает нули, а не всё подряд.
   */
  readonly typeCodes: ReadonlySet<string> | null;
  /**
   * Все элементы уровня, до отбора систем.
   *
   * Состояние системы считается по всему её составу, а не по отмеченному:
   * иначе снятая галочка «извещатели» делала бы систему благополучной, хотя в
   * ней ничего не изменилось. Отбор решает, что показать, а не что исправно.
   */
  readonly levelObjects?: readonly PlanObject[];
  /**
   * Узлы-склады: элементы в них не требуют размещения на плане.
   *
   * Требование заказчика: «склад ≠ этаж; элемент на складе ≠ элемент,
   * который забыли разместить на плане». Без этого множества резерв
   * попадал в «требуют размещения» и портил показатели объекта.
   *
   * Не задано — считается, что складов нет: так вела себя программа до
   * этого изменения, и старые вызовы менять смысла не должны.
   */
  readonly storageNodeIds?: ReadonlySet<string>;
}

export interface DashboardSummary {
  readonly total: number;
  readonly counts: Readonly<Record<ScheduleStatus, number>>;
  /**
   * Сколько элементов под каждой меткой отбора.
   *
   * По этим числам стоят плитки дашборда: нажав «Неисправно — 3», человек
   * обязан увидеть в журнале те же три. Раньше плитки считались по своим
   * правилам, и «требует ремонта» попадало у них в «Неисправно», а в журнале
   * значилось «Требует внимания» — плитка показывала единицу, журнал ноль.
   *
   * Метки не исключают друг друга: у просроченного и сломанного элемента их
   * две, и в сумме они дают больше, чем всего элементов. Это не ошибка счёта, а
   * свойство отбора: он работает по «ИЛИ».
   */
  readonly tagCounts: Readonly<Record<FilterTag, number>>;
  readonly broken: readonly BrokenItem[];
  /**
   * Сколько элементов неисправны **или** просрочены.
   *
   * Заказчик: «не нужно графы просрочено — это всё входит в неисправно». И по
   * существу верно: оборудование с прошедшим сроком проверки к применению не
   * готово так же, как сломанное, — про него нельзя сказать, сработает ли оно.
   *
   * Считается по элементам, а не сложением двух чисел: у элемента бывают обе
   * метки сразу, и сумма посчитала бы его дважды.
   */
  readonly brokenOrOverdue: number;
  /**
   * Сколько элементов лежит на складе.
   *
   * Справочная величина, отдельная от всего прочего: заказчик просил не
   * смешивать хранение с фактически установленным оборудованием.
   */
  readonly inStorage: number;
  readonly unplaced: number;
  readonly overdue: readonly OverdueWork[];
  readonly upcoming7: readonly UpcomingWork[];
  readonly upcoming30: readonly UpcomingWork[];
  /**
   * Предстоящие работы поимённо, за тридцать дней, ближайшие впереди.
   *
   * По нему считаются уведомления: число в счётчике равно длине списка,
   * который человек увидит, раскрыв категорию.
   */
  readonly upcomingItems: readonly UpcomingItem[];
  readonly byType: readonly TypeTally[];
  readonly byPlace: readonly PlaceTally[];
  readonly systems: readonly SystemTally[];
}

const EMPTY_COUNTS: Readonly<Record<ScheduleStatus, number>> = {
  'норма': 0, 'скоро': 0, 'просрочено': 0, 'нет данных': 0,
};

const EMPTY_TAGS: Readonly<Record<FilterTag, number>> = {
  'норма': 0, 'скоро': 0, 'просрочено': 0, 'неисправно': 0, 'нет данных': 0,
};

/** Элементы уровня после отбора систем. */
export function dashboardScope(input: DashboardSummaryInput): readonly PlanObject[] {
  const { typeCodes } = input;
  if (typeCodes === null) return input.objects;
  return input.objects.filter((object) => typeCodes.has(object.typeCode));
}

export function dashboardSummary(input: DashboardSummaryInput): DashboardSummary {
  const scope = dashboardScope(input);

  const counts: Record<ScheduleStatus, number> = { ...EMPTY_COUNTS };
  const tagCounts: Record<FilterTag, number> = { ...EMPTY_TAGS };
  const broken: BrokenItem[] = [];
  const overdue: OverdueWork[] = [];
  const upcoming = new Map<string, UpcomingWork>();
  const upcomingItems: UpcomingItem[] = [];
  const byType = new Map<string, { total: number; counts: Record<ScheduleStatus, number> }>();
  const byPlace = new Map<string, { total: number; overdue: number; broken: number; counts: Record<ScheduleStatus, number> }>();
  const storageIds = input.storageNodeIds ?? new Set<string>();
  let unplaced = 0;
  let stored = 0;
  let brokenOrOverdue = 0;

  for (const object of scope) {
    const status = worstObjectStatus(object, input.events, input.today, input.soonThresholdDays, input.source);
    counts[status] += 1;

    const tally = byType.get(object.typeCode) ?? { total: 0, counts: { ...EMPTY_COUNTS } };
    byType.set(object.typeCode, {
      total: tally.total + 1,
      counts: { ...tally.counts, [status]: tally.counts[status] + 1 },
    });

    // Метки — то же, по чему отбирает журнал: плитка и список за ней обязаны
    // показывать одно и то же число.
    const condition = objectCondition(object, input.events, input.today, input.soonThresholdDays, input.source);
    for (const tag of conditionFilterTags(condition)) tagCounts[tag] += 1;

    // Неисправность — не срок: элемент может быть проверен вовремя и признан
    // неисправным. В список ремонта идут только настоящие поломки — те же, что
    // журнал показывает по метке «Неисправно».
    const state = technicalStateForObject(object, input.events);
    const faulty = technicalEscalation(state) === 'danger';
    if (faulty) broken.push({ object, state });
    if (faulty || status === 'просрочено') brokenOrOverdue += 1;

    const place = byPlace.get(object.nodeId) ?? { total: 0, overdue: 0, broken: 0, counts: { ...EMPTY_COUNTS } };
    byPlace.set(object.nodeId, {
      total: place.total + 1,
      overdue: place.overdue + (status === 'просрочено' ? 1 : 0),
      broken: place.broken + (faulty ? 1 : 0),
      counts: { ...place.counts, [status]: place.counts[status] + 1 },
    });

    /*
     * Сначала «где элемент», потом «нужны ли координаты».
     *
     * На складе планов нет вовсе, и отсутствие координат там — обычное
     * состояние, а не недоделка. Раньше считалось наоборот, и резерв
     * показывался как «требует размещения».
     */
    if (inStorage(object, storageIds)) stored += 1;
    else if (needsPlacement(object, storageIds)) unplaced += 1;

    for (const cell of activityCellsForObject(object, input.events, input.today, input.soonThresholdDays, input.source)) {
      const { status: cellStatus, nextDate, daysToNext } = cell.schedule;
      if (nextDate === null) continue;

      if (cellStatus === 'просрочено') {
        overdue.push({
          object,
          activityTitle: cell.rule.title,
          date: nextDate,
          daysLate: Math.abs(daysToNext ?? 0),
        });
        continue;
      }

      // Предстоящее считается по числу дней до срока, а не по статусу «скоро»:
      // порог «скоро» задан настройкой и может быть короче недели, и тогда
      // работы седьмого дня в список бы не попали.
      if (daysToNext !== null && daysToNext >= 0 && daysToNext <= 30) {
        const key = `${cell.rule.title}|${nextDate}`;
        const existing = upcoming.get(key);
        upcoming.set(key, {
          activityTitle: cell.rule.title,
          date: nextDate,
          count: (existing?.count ?? 0) + 1,
        });
        // Тот же перечень, но поимённо: по нему считаются уведомления, и число
        // в них всегда равно длине показываемого списка.
        upcomingItems.push({ object, activityTitle: cell.rule.title, date: nextDate, daysLeft: daysToNext });
      }
    }
  }

  // Системы берутся от всего уровня: их состояние не зависит от того, какие
  // галочки стоят справа.
  const levelObjects = input.levelObjects ?? input.objects;
  const systems: SystemTally[] = [];
  for (const object of levelObjects) {
    if (!isSystemHead(object)) continue;
    const condition = systemCondition(object, levelObjects, input.events, input.today, input.soonThresholdDays, input.source);
    if (condition !== null) systems.push({ head: object, condition });
  }

  const upcomingAll = [...upcoming.values()].sort((a, b) => a.date.localeCompare(b.date));
  const upcomingItemsSorted = [...upcomingItems].sort((a, b) => a.daysLeft - b.daysLeft);
  const withinDays = (days: number): readonly UpcomingWork[] =>
    upcomingAll.filter((work) => daysBetween(input.today, work.date) <= days);

  return {
    total: scope.length,
    counts,
    tagCounts,
    broken,
    brokenOrOverdue,
    unplaced,
    inStorage: stored,
    overdue: overdue.sort((a, b) => b.daysLate - a.daysLate),
    upcoming7: withinDays(7),
    upcoming30: upcomingAll,
    upcomingItems: upcomingItemsSorted,
    byType: [...byType.entries()]
      .map(([typeCode, item]) => ({ typeCode, total: item.total, counts: item.counts }))
      .sort((a, b) => b.total - a.total),
    byPlace: [...byPlace.entries()]
      .map(([nodeId, item]) => ({ nodeId, ...item }))
      .sort((a, b) => b.overdue + b.broken - (a.overdue + a.broken) || b.total - a.total),
    systems,
  };
}

/** Календарных суток между датами. Без часовых поясов: обе даты местные. */
function daysBetween(from: IsoDate, to: IsoDate): number {
  const parse = (value: IsoDate): number => {
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}
