/**
 * Связывает пакет правил, ленту мероприятий и расчёт сроков в одно значение
 * для ячейки журнала: правило, дата последнего выполнения и статус.
 *
 * Чистые функции без хранилища: журнал вызывает их над уже загруженным
 * списком мероприятий, поэтому пересчёт таблицы не требует обращения к диску.
 */

import type { IsoDate, MaintenanceEvent, PlanObject, TechnicalState } from '@izh/contracts';
import { rulePackageSource, type ActivityScheduleSource } from './activity-source.js';
import type { ActivityRule } from './rule-package.js';
import { statusForDue, type ScheduleResult, type ScheduleStatus } from './schedule.js';

export interface ActivityCell {
  readonly rule: ActivityRule;
  readonly schedule: ScheduleResult;
  /** Мероприятия этого вида для этого объекта, самое новое — первым. */
  readonly history: readonly MaintenanceEvent[];
}

/** Лента, разложенная по оборудованию и виду работ; внутри — свежие записи первыми. */
type ByKey = ReadonlyMap<string, ReadonlyMap<string, readonly MaintenanceEvent[]>>;

/**
 * Два разреза одной ленты.
 *
 * `byActivity` — по коду мероприятия, как было всегда. `byPeriodicity` — по
 * периодичности конструктора регламентов: новые записи ссылаются на неё прямо
 * (часть Р9), и это точнее кода, потому что состав работ у периодичности со
 * временем меняется, а код остаётся прежним.
 */
interface EventIndex {
  readonly byActivity: ByKey;
  readonly byPeriodicity: ByKey;
}

/** Пустая лента, чтобы не создавать новый массив на каждый промах. */
const NO_EVENTS: readonly MaintenanceEvent[] = [];

/**
 * Разложенная лента запоминается для конкретного массива мероприятий.
 *
 * Зачем: журнал, план и дашборд пересчитывают состояние всех объектов на каждую
 * перерисовку, а раньше поиск шёл перебором всей ленты заново для каждого
 * правила каждого объекта. При 2000 объектов и пятилетней истории это давало
 * почти две секунды на одну перерисовку. Теперь лента разбирается один раз.
 *
 * Ключ — сам массив, поэтому кэш не мешает: пришла новая лента — будет новый
 * разбор, а старый освободится сборщиком мусора. Чистота функции сохраняется:
 * одинаковый вход по-прежнему даёт одинаковый выход (AGENTS.md, правило 3).
 */
const indexCache = new WeakMap<object, EventIndex>();

/** Свежие записи первыми: сначала по дате проведения, при равенстве — по вводу. */
function newestFirst(a: MaintenanceEvent, b: MaintenanceEvent): number {
  return b.performedOn.localeCompare(a.performedOn) || b.createdAt.localeCompare(a.createdAt);
}

function put(index: Map<string, Map<string, MaintenanceEvent[]>>, objectId: string, key: string, event: MaintenanceEvent): void {
  let byKey = index.get(objectId);
  if (byKey === undefined) {
    byKey = new Map<string, MaintenanceEvent[]>();
    index.set(objectId, byKey);
  }
  const list = byKey.get(key);
  if (list === undefined) byKey.set(key, [event]);
  else list.push(event);
}

function sortAll(index: Map<string, Map<string, MaintenanceEvent[]>>): void {
  for (const byKey of index.values()) {
    for (const list of byKey.values()) list.sort(newestFirst);
  }
}

function indexEvents(events: readonly MaintenanceEvent[]): EventIndex {
  const cached = indexCache.get(events);
  if (cached !== undefined) return cached;

  const byActivity = new Map<string, Map<string, MaintenanceEvent[]>>();
  const byPeriodicity = new Map<string, Map<string, MaintenanceEvent[]>>();
  for (const event of events) {
    put(byActivity, event.objectId, event.activityCode, event);
    const periodicityId = event.periodicityId ?? null;
    if (periodicityId !== null) put(byPeriodicity, event.objectId, periodicityId, event);
  }

  sortAll(byActivity);
  sortAll(byPeriodicity);

  const index: EventIndex = { byActivity, byPeriodicity };
  indexCache.set(events, index);
  return index;
}

/**
 * История, относящаяся к правилу: самое новое — первым.
 *
 * Ищется по всем известным ключам разом. Один и тот же осмотр не должен
 * попасть в ленту дважды, если он подошёл и по периодичности, и по коду, —
 * поэтому записи собираются через множество по идентификатору.
 */
function historyFor(
  events: readonly MaintenanceEvent[],
  objectId: string,
  rule: ActivityRule,
): readonly MaintenanceEvent[] {
  const index = indexEvents(events);
  const byActivity = index.byActivity.get(objectId);
  const direct = rule.periodicityId === undefined
    ? undefined
    : index.byPeriodicity.get(objectId)?.get(rule.periodicityId);
  const codes = rule.historyCodes ?? [rule.activityCode];

  // Обычный случай — одно правило, один код, никаких пересечений: возвращаем
  // готовый отсортированный список, не создавая ни одного лишнего объекта.
  if (direct === undefined && codes.length === 1) {
    return byActivity?.get(codes[0] as string) ?? NO_EVENTS;
  }

  const collected = new Map<string, MaintenanceEvent>();
  for (const event of direct ?? NO_EVENTS) collected.set(event.id, event);
  for (const code of codes) {
    for (const event of byActivity?.get(code) ?? NO_EVENTS) collected.set(event.id, event);
  }

  return [...collected.values()].sort(newestFirst);
}

/**
 * Строит ячейки мероприятий для одного объекта — действующие правила, с
 * последней датой и статусом по фактической ленте мероприятий.
 *
 * Источник правил передаётся снаружи (`activity-source.ts`). Без него берётся
 * нормативная библиотека — ровно то поведение, что было до конструктора
 * регламентов, чтобы обновление программы не сдвинуло сроки в journal'е тем,
 * кто своих регламентов ещё не завёл.
 */
export function activityCellsForObject(
  object: PlanObject,
  events: readonly MaintenanceEvent[],
  today: IsoDate,
  soonThresholdDays: number,
  source: ActivityScheduleSource = rulePackageSource,
): readonly ActivityCell[] {
  return [...source.rulesFor(object, today)].sort(byFrequency).map((rule) => {
    const history = historyFor(events, object.id, rule);
    const lastPerformedOn = history[0]?.performedOn ?? baselineFor(object, rule);
    const schedule = statusForDue({
      nextDate: source.nextDueOn(rule, lastPerformedOn, today),
      lastPerformedOn,
      today,
      soonThresholdDays,
    });
    return { rule, schedule, history };
  });
}

/**
 * От какой даты считать срок, если работа ещё ни разу не выполнялась
 * (ТЗ, Дополнение 6, часть А3).
 *
 * Порядок определяется программой, а не пользователем. Ручной галочки «считать
 * отсюда» нет намеренно: она перекладывала бы на человека решение, которое он
 * принимает раз в жизни и обычно неверно, а ошибка в исходной дате сдвигает все
 * последующие сроки разом.
 *
 * Алгоритм:
 *
 * 1. Есть запись о выполнении — считается от неё (это делает вызывающий код).
 * 2. Записи нет — исходная дата определяется **видом работы**:
 *    — работа, привязанная к возрасту изделия, корпусу или первоначальному
 *      заряду (признак `изготовление` в правиле), считается от даты
 *      изготовления.
 *      Огнетушитель, пролежавший год на складе, к моменту установки уже
 *      израсходовал год своего срока;
 *    — обычная эксплуатационная работа считается от даты постановки на учёт:
 *      осматривать оборудование начинают, когда оно появилось на объекте.
 * 3. Нужной даты нет вовсе — срок не считается, элемент показывается как «нет
 *    данных». Придуманная дата хуже честной пустоты: по ней примут решение.
 */
function baselineFor(object: PlanObject, rule: ActivityRule): string | null {
  // Фактическая перезарядка из паспорта — это запись о выполнении, а не
  // допущение: она вытесняет дату изготовления по тому же правилу 1.
  if (rule.activityCode === 'perezaryadka' && object.extinguisherProfile?.lastRechargeOn != null) {
    return object.extinguisherProfile.lastRechargeOn;
  }

  if (rule.baselineKind === 'изготовление') {
    return object.extinguisherProfile?.manufacturedOn ?? object.commissionedOn ?? null;
  }

  return object.commissionedOn ?? null;
}

/**
 * Порядок работ: от частых к редким — ежемесячно, ежеквартально, ежегодно.
 *
 * Один порядок на карточку, журнал, план и чек-лист. Разный порядок в разных
 * местах заставляет искать нужную работу заново на каждом экране, а глаз
 * запоминает именно положение строки.
 *
 * Внутри одного срока порядок сохраняется как есть — там обязательные
 * требования НПА идут первыми (`activitiesFor`), и это тоже осмысленный
 * порядок, ломать который сортировкой незачем.
 */
function byFrequency(a: ActivityRule, b: ActivityRule): number {
  const months = (rule: ActivityRule): number => {
    const value = rule.periodicityMonths;
    // Срока нет — работа считается ежемесячной: пустых сроков в программе
    // больше не бывает, но правило может прийти из старых данных.
    return value === null || value === undefined || value <= 0 ? 1 : value;
  };
  return months(a) - months(b);
}

/**
 * Итоговое состояние объекта — худшее из состояний его мероприятий.
 *
 * Иначе просроченная перезарядка терялась бы за спокойным техосмотром: именно
 * просроченный элемент нужен пользователю в первую очередь, поэтому статус
 * не усредняется, а берётся по худшему случаю. Используется везде, где нужен
 * один статус на объект: значок на плане, строка журнала, дашборд, карточка.
 */
export function worstObjectStatus(
  object: PlanObject,
  events: readonly MaintenanceEvent[],
  today: IsoDate,
  soonThresholdDays: number,
  source: ActivityScheduleSource = rulePackageSource,
): ScheduleStatus {
  const cells = activityCellsForObject(object, events, today, soonThresholdDays, source);
  if (cells.length === 0) return 'нет данных';
  if (cells.some((cell) => cell.schedule.status === 'просрочено')) return 'просрочено';
  if (cells.some((cell) => cell.schedule.status === 'скоро')) return 'скоро';
  if (cells.every((cell) => cell.schedule.status === 'норма')) return 'норма';
  return 'нет данных';
}

/**
 * Состояние места хранения комплекта — худшее среди его единиц
 * (ТЗ, Дополнение 6).
 *
 * Точка на плане отвечает за весь комплект: если хоть один самоспасатель из
 * пяти просрочен, зелёный значок соврал бы. Поэтому берётся худшее — по тому же
 * правилу, по которому состояние одного объекта берётся по худшей из его работ.
 *
 * Обычный объект, не являющийся местом хранения, отвечает только за себя, и
 * функция возвращает его собственное состояние.
 */
export function worstPlacementStatus(
  object: PlanObject,
  allObjects: readonly PlanObject[],
  events: readonly MaintenanceEvent[],
  today: IsoDate,
  soonThresholdDays: number,
  source: ActivityScheduleSource = rulePackageSource,
): ScheduleStatus {
  const contents = [object, ...allObjects.filter(
    (item) => item.placementId === object.id && item.archivedAt === null,
  )];

  const statuses = contents.map((item) => worstObjectStatus(item, events, today, soonThresholdDays, source));
  return statuses.reduce(worseStatus);
}

/** Какое из двух состояний тревожнее. Порядок тот же, что в карточке. */
function worseStatus(a: ScheduleStatus, b: ScheduleStatus): ScheduleStatus {
  const rank = (status: ScheduleStatus): number =>
    status === 'просрочено' ? 0 : status === 'скоро' ? 1 : status === 'нет данных' ? 2 : 3;
  return rank(a) <= rank(b) ? a : b;
}

/**
 * Текущее техническое состояние: импорт служит исходным значением, а после
 * первой проверки состояние определяется последней неизменяемой записью.
 */
export function technicalStateForObject(
  object: PlanObject,
  events: readonly MaintenanceEvent[],
): TechnicalState {
  const completedChecks = events
    // Перенесённые из старого журнала даты создают события без чек-листа и
    // не должны затирать явно перенесённое техническое состояние.
    .filter((event) => event.objectId === object.id && event.checklist.length > 0)
    .sort((a, b) => b.performedOn.localeCompare(a.performedOn) || b.createdAt.localeCompare(a.createdAt));
  if (completedChecks.length === 0) {
    // Новый огнетушитель с заполненной учётной карточкой не должен выглядеть
    // неисправным только потому, что первый плановый чек-лист ещё не наступил.
    // После первой проверки состояние определяется неизменяемой лентой ниже.
    return hasInitialExtinguisherData(object) ? 'исправен' : object.technicalState;
  }

  // Последующая проверка закрывает прежний дефект только по тому же виду
  // работ. Успешное взвешивание не должно скрывать провал испытания корпуса.
  const latestByActivity = new Map<string, MaintenanceEvent>();
  for (const event of completedChecks) {
    if (!latestByActivity.has(event.activityCode)) latestByActivity.set(event.activityCode, event);
  }
  const current = [...latestByActivity.values()];
  if (current.some((event) => event.result === 'не выполнено')) return 'неисправен';
  if (current.some((event) => event.result === 'выполнено с замечаниями')) return 'исправен с замечаниями';
  return 'исправен';
}

function hasInitialExtinguisherData(object: PlanObject): boolean {
  if (!object.typeCode.startsWith('extinguisher')) return false;
  const profile = object.extinguisherProfile;
  return object.regNumber !== null && object.regNumber.trim() !== ''
    && object.model !== null && object.model.trim() !== ''
    && object.manufacturer !== null && object.manufacturer.trim() !== ''
    && object.serialNumber !== null && object.serialNumber.trim() !== ''
    && object.commissionedOn !== null
    && profile?.manufacturedOn !== null && profile?.manufacturedOn !== undefined
    && ((object.serviceLifeYears ?? null) !== null || (object.serviceLifeMonths ?? null) !== null)
    && object.responsible !== null && object.responsible.trim() !== '';
}
