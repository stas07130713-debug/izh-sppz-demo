/**
 * Сценарии работы с объектами СППЗ.
 *
 * Создание объекта на плане и появление записи в журнале — одна операция, а не
 * две: запись одна, поэтому состояния «нарисовали, но не записали» не бывает.
 *
 * Снятия с плана нет: план и журнал — одно и то же оборудование, увиденное с
 * двух сторон. Объект, снятый с плана и оставленный в журнале, разрушал бы это
 * равенство — в журнале числится, на плане не найти.
 *
 * Уйти с плана объект может только вместе с местом: переносом на другой узел,
 * где его ставят заново, или выводом из эксплуатации. И то и другое сохраняет
 * историю: журнал задним числом не переписывается.
 *
 * Смотри docs/02_ТЗ_редакция_3.md, часть 7.
 */

import type {
  IsoDate,
  StorageSection,
  ExtinguisherProfile,
  FireBarrierProfile,
  SuppressionProfile,
  ControlPanelProfile,
  OutdoorHydrantProfile,
  WaterSourceProfile,
  LadderProfile,
  RoofFenceProfile,
  FireproofingProfile,
  FireBoardProfile,
  PumpStationProfile,
  HydrantProfile,
  PixelPoint,
  PlanObject,
  PlanObjectId,
  Result,
  TechnicalState,
  TreeNodeId,
} from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { ObjectDeps } from './object-deps.js';
import type { Signer } from '../access/signer.js';
import { signSimple } from '../access/simple-signature.js';
import { signedObjectContent } from '../access/signed-content.js';
import { configurableFamily } from './element-catalog.js';
import { elementByCode } from './element-lookup.js';
import { ruleFor } from '../object-tree/tree-rules.js';
import { blocking, type Problem } from '../validation/problem.js';
import { objectProblems } from '../validation/object-constraints.js';

function clean(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const value = raw.trim().replace(/\s+/g, ' ');
  return value.length === 0 ? null : value;
}

export interface PlaceObjectInput {
  readonly nodeId: TreeNodeId;
  readonly typeCode: string;
  /** Место на плане. null — объект заводится без размещения: так работает склад. */
  readonly position: PixelPoint | null;
  readonly regNumber?: string | null;
  readonly roomId?: string | null;
  /**
   * Общие характеристики, которые заполняются при групповом создании
   * (ТЗ, часть 6.3): марка, изготовитель, дата ввода, срок службы,
   * ответственный. При одиночном создании перетаскиванием не заполняются и
   * правятся потом в карточке.
   */
  readonly model?: string | null;
  readonly manufacturer?: string | null;
  readonly commissionedOn?: IsoDate | null;
  readonly serviceLifeYears?: number | null;
  /** @deprecated Старое поле до перехода на срок службы в годах. */
  readonly serviceLifeMonths?: number | null;
  readonly responsible?: string | null;
  readonly extinguisherProfile?: ExtinguisherProfile | null;
  /**
   * Кто заводит строку в журнал и чем это подтверждает.
   *
   * Заказчик: «при заведении нового огнетушителя или элемента, и вообще при
   * создании новых строк в журнале должна ставиться ПЭП». Программа заводит
   * оборудование только через этот сценарий, и подпись ставится **здесь**, а не
   * в окне: забыть её в ядре нельзя, а в окне — можно, и однажды забудут.
   *
   * Необязательное поле: без него сценарий остаётся пригодным для проверок и
   * для служебных заведений, где подписывать нечего и некому. Все окна
   * программы подписывающего передают.
   */
  readonly signer?: Signer;
}

/**
 * Создаёт объект на плане выбранного узла.
 *
 * Тип проверяется по каталогу и по рабочей области: на генплане нет извещателей,
 * на поэтажном плане нет гидрантов. Без этой проверки объект попал бы не на свой
 * уровень и потерялся бы в журнале.
 */
export async function placeObject(deps: ObjectDeps, input: PlaceObjectInput): Promise<Result<PlanObject>> {
  const element = elementByCode(input.typeCode);
  if (element === null) return err('INVALID_ARGUMENT', 'Неизвестный тип элемента.');

  const node = await deps.tree.getById(input.nodeId);
  if (!node.ok) return node;
  if (node.value.archivedAt !== null) {
    return err('INVALID_ARGUMENT', `Узел «${node.value.name}» выведен из эксплуатации.`);
  }

  const planKind = ruleFor(node.value.kind).planKind;
  if (planKind === 'none') {
    return err('INVALID_ARGUMENT', 'У этого узла нет рабочей области: выберите здание, этаж или склад.');
  }
  if (!element.appliesTo.includes(planKind)) {
    return err('INVALID_ARGUMENT', `«${element.title}» на этой рабочей области не размещается.`);
  }

  const now = deps.clock.nowUtc();
  const object: PlanObject = {
    id: deps.ids.newId(),
    siteId: node.value.siteId,
    nodeId: node.value.id,
    typeCode: element.typeCode,
    regNumber: clean(input.regNumber),
    model: clean(input.model),
    manufacturer: clean(input.manufacturer),
    serialNumber: null,
    commissionedOn: clean(input.commissionedOn),
    serviceLifeYears: input.serviceLifeYears ?? null,
    serviceLifeMonths: input.serviceLifeYears === undefined ? input.serviceLifeMonths ?? null : null,
    responsible: clean(input.responsible),
    extinguisherProfile: input.extinguisherProfile ?? null,
    roomId: clean(input.roomId),
    // На складе координат нет по существу: важен состав, а не расположение.
    position: planKind === 'storage' ? null : input.position,
    technicalState: 'не определено',
    note: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    rowVersion: 1,
  };

  const forbidden = await checkConstraints(deps, object);
  if (forbidden !== null) return forbidden;

  /*
   * Подпись ставится до записи, а не после.
   *
   * Не подписалось — не записано: строка журнала без подписи не заводится
   * вовсе. Дописать подпись вторым действием значило бы допустить состояние
   * «строка есть, подписи нет», в котором её и оставят при первом же сбое.
   */
  let stored = object;
  if (input.signer !== undefined) {
    const signature = await signSimple(input.signer.hasher, {
      user: input.signer.user,
      password: input.signer.password,
      kind: 'заведение в журнал',
      content: signedObjectContent(object),
      at: now,
      keys: input.signer.keys,
      basis: input.signer.basis ?? null,
    });
    if (!signature.ok) return signature;
    stored = { ...object, registrationSignature: signature.value };
  }

  const saved = await deps.objects.save(stored);
  if (!saved.ok) return saved;
  return ok(stored);
}

/**
 * Проверяет запреты логики данных перед записью (Дополнение 7).
 *
 * Только запреты: предупреждения показывает интерфейс, а решает человек.
 * Сценарий их не знает и знать не должен — иначе он начал бы отказывать там,
 * где пользователь уже согласился.
 */
async function checkConstraints(deps: ObjectDeps, object: PlanObject): Promise<Result<PlanObject> | null> {
  const all = await deps.objects.list();
  if (!all.ok) return all;
  const nodes = await deps.tree.list();
  if (!nodes.ok) return nodes;

  const problems = blocking(objectProblems(object, {
    nodes: nodes.value,
    objects: all.value,
    today: deps.clock.nowUtc().slice(0, 10),
  }));

  return problems.length === 0 ? null : err('INVALID_ARGUMENT', problems.map((item: Problem) => item.message).join(' '));
}

export interface MoveObjectInput {
  readonly id: PlanObjectId;
  readonly position: PixelPoint;
}

/** Перетаскивание значка по плану. */
export async function moveObject(deps: ObjectDeps, input: MoveObjectInput): Promise<Result<PlanObject>> {
  const current = await deps.objects.getById(input.id);
  if (!current.ok) return current;

  const object: PlanObject = {
    ...current.value,
    position: input.position,
    updatedAt: deps.clock.nowUtc(),
    rowVersion: current.value.rowVersion + 1,
  };

  const saved = await deps.objects.save(object);
  if (!saved.ok) return saved;
  return ok(object);
}

export interface RelocateObjectInput {
  readonly id: PlanObjectId;
  readonly nodeId: string;
}

/**
 * Переносит объект на другой узел дерева — контекстное меню «Переместить»
 * (ТЗ, Дополнение 3, часть К7.1).
 *
 * Прежние координаты и помещение теряют смысл на новом плане — у чужого
 * этажа своя система координат и свой список помещений, поэтому оба поля
 * сбрасываются. Объект не пропадает: он появляется в «Требуют размещения» на
 * новом узле, откуда его ставят на план обычным перетаскиванием.
 */
export async function relocateObject(deps: ObjectDeps, input: RelocateObjectInput): Promise<Result<PlanObject>> {
  const current = await deps.objects.getById(input.id);
  if (!current.ok) return current;
  const target = await deps.tree.getById(input.nodeId);
  if (!target.ok) return target;
  const element = elementByCode(current.value.typeCode);
  const targetPlanKind = ruleFor(target.value.kind).planKind;
  if (element === null || targetPlanKind === 'none' || !element.appliesTo.includes(targetPlanKind)) {
    return err('INVALID_ARGUMENT', 'Этот элемент нельзя переместить на выбранный план: наружные средства размещаются на генплане, внутренние системы и автоматика — на этажах.');
  }

  const object: PlanObject = {
    ...current.value,
    nodeId: input.nodeId,
    roomId: null,
    position: null,
    updatedAt: deps.clock.nowUtc(),
    rowVersion: current.value.rowVersion + 1,
  };

  const saved = await deps.objects.save(object);
  if (!saved.ok) return saved;
  return ok(object);
}

/**
 * Что меняется в карточке.
 *
 * Все поля необязательны, и это существенно: вызов вида `{ id, note }` обязан
 * менять только примечание. Непереданное поле сохраняет прежнее значение,
 * переданное пустым — очищается.
 */
export interface UpdateObjectInput {
  readonly id: PlanObjectId;
  /** Уточнение подтипа внутри настраиваемой группы: ОП вместо общего огнетушителя. */
  readonly typeCode?: string;
  readonly regNumber?: string | null;
  readonly model?: string | null;
  readonly manufacturer?: string | null;
  readonly serialNumber?: string | null;
  readonly commissionedOn?: IsoDate | null;
  readonly serviceLifeYears?: number | null;
  /** Срок службы в месяцах — для того, что живёт меньше года. */
  readonly serviceLifeMonths?: number | null;
  readonly responsible?: string | null;
  readonly extinguisherProfile?: ExtinguisherProfile | null;
  readonly hydrantProfile?: HydrantProfile | null;
  readonly outdoorHydrantProfile?: OutdoorHydrantProfile | null;
  readonly waterSourceProfile?: WaterSourceProfile | null;
  readonly ladderProfile?: LadderProfile | null;
  readonly roofFenceProfile?: RoofFenceProfile | null;
  readonly fireproofingProfile?: FireproofingProfile | null;
  readonly fireBoardProfile?: FireBoardProfile | null;
  readonly pumpStationProfile?: PumpStationProfile | null;
  readonly fireBarrierProfile?: FireBarrierProfile | null;
  readonly suppressionProfile?: SuppressionProfile | null;
  readonly controlPanelProfile?: ControlPanelProfile | null;
  /** Значения полей своего вида элемента (движок E4). */
  readonly customFields?: Readonly<Record<string, string>> | null;
  readonly roomId?: string | null;
  readonly technicalState?: TechnicalState;
  readonly note?: string | null;
}

export interface SetStorageSectionInput {
  readonly id: PlanObjectId;
  readonly section: StorageSection;
}

/**
 * Переложить складское оборудование с полки на полку.
 *
 * Полка есть только у склада: на этаже у объекта есть место на плане, и
 * «резерв» там ничего не значит. Поэтому попытка переложить объект, стоящий
 * на плане, — не молчаливый пропуск, а отказ с объяснением: человек метил в
 * склад и должен узнать, что промахнулся.
 */
export async function setStorageSection(
  deps: ObjectDeps,
  input: SetStorageSectionInput,
): Promise<Result<PlanObject>> {
  const current = await deps.objects.getById(input.id);
  if (!current.ok) return current;

  const node = await deps.tree.getById(current.value.nodeId);
  if (!node.ok) return node;
  if (ruleFor(node.value.kind).planKind !== 'storage') {
    return err('INVALID_ARGUMENT', 'Полки есть только у склада. Сначала перенесите объект на склад.');
  }

  if ((current.value.storageSection ?? null) === input.section) return ok(current.value);

  const object: PlanObject = {
    ...current.value,
    storageSection: input.section,
    updatedAt: deps.clock.nowUtc(),
    rowVersion: current.value.rowVersion + 1,
  };

  const saved = await deps.objects.save(object);
  if (!saved.ok) return saved;
  return ok(object);
}

export interface SwapObjectsInput {
  readonly firstId: PlanObjectId;
  readonly secondId: PlanObjectId;
}

/**
 * Поменять два объекта местами.
 *
 * Так выглядит настоящая замена: огнетушитель сдают на перезарядку, а на его
 * место с полки резерва встаёт другой, уже существующий. Оба остаются в
 * журнале со своей историей — меняется только место.
 *
 * Прежняя «замена» заводила новый объект и выводила старый из эксплуатации.
 * Это другая операция: она годится, когда изделие действительно новое, и
 * оставлена рядом. Но подменный огнетушитель из резерва не новый, и
 * списывать его предшественника нельзя — он вернётся с перезарядки.
 *
 * Обмен проверяется в обе стороны: наружное средство не встанет на этаж, а
 * внутреннее — на генплан, и узнать об этом нужно до записи, а не после.
 */
export async function swapObjects(deps: ObjectDeps, input: SwapObjectsInput): Promise<Result<readonly PlanObject[]>> {
  if (input.firstId === input.secondId) return err('INVALID_ARGUMENT', 'Объект нельзя поменять местами с самим собой.');

  const first = await deps.objects.getById(input.firstId);
  if (!first.ok) return first;
  const second = await deps.objects.getById(input.secondId);
  if (!second.ok) return second;

  for (const pair of [[first.value, second.value], [second.value, first.value]] as const) {
    const [moved, target] = pair;
    const node = await deps.tree.getById(target.nodeId);
    if (!node.ok) return node;
    if (node.value.archivedAt !== null) {
      return err('INVALID_ARGUMENT', `Узел «${node.value.name}» выведен из эксплуатации.`);
    }

    const element = elementByCode(moved.typeCode);
    const planKind = ruleFor(node.value.kind).planKind;
    if (element === null || planKind === 'none' || !element.appliesTo.includes(planKind)) {
      return err('INVALID_ARGUMENT', `«${element?.title ?? moved.typeCode}» не размещается там, где стоит второй объект: наружные средства живут на генплане, внутренние системы и автоматика — на этажах.`);
    }
  }

  const now = deps.clock.nowUtc();
  /** Место — это узел, помещение, точка на плане и полка склада вместе. */
  const place = (object: PlanObject, from: PlanObject): PlanObject => ({
    ...object,
    nodeId: from.nodeId,
    siteId: from.siteId,
    roomId: from.roomId,
    position: from.position,
    storageSection: from.storageSection ?? null,
    updatedAt: now,
    rowVersion: object.rowVersion + 1,
  });

  const movedFirst = place(first.value, second.value);
  const movedSecond = place(second.value, first.value);

  const savedFirst = await deps.objects.save(movedFirst);
  if (!savedFirst.ok) return savedFirst;
  const savedSecond = await deps.objects.save(movedSecond);
  if (!savedSecond.ok) return savedSecond;

  return ok([movedFirst, movedSecond]);
}

/** Правка карточки объекта. Смена типа разрешена только внутри одной настраиваемой группы. */
export async function updateObject(deps: ObjectDeps, input: UpdateObjectInput): Promise<Result<PlanObject>> {
  const current = await deps.objects.getById(input.id);
  if (!current.ok) return current;
  if (current.value.archivedAt !== null) {
    return err('INVALID_ARGUMENT', 'Объект выведен из эксплуатации, правка недоступна.');
  }

  const nextTypeCode = input.typeCode ?? current.value.typeCode;
  if (elementByCode(nextTypeCode) === null) return err('INVALID_ARGUMENT', 'Неизвестный тип элемента.');
  const currentFamily = configurableFamily(current.value.typeCode);
  const nextFamily = configurableFamily(nextTypeCode);
  if (nextTypeCode !== current.value.typeCode && (currentFamily === null || currentFamily !== nextFamily)) {
    return err('INVALID_ARGUMENT', 'В карточке можно уточнить только подтип оборудования внутри выбранной группы.');
  }

  /**
   * Поле, которого нет во входных данных, остаётся прежним.
   *
   * Все поля правки необязательные, поэтому вызов вида `{ id, note }` обязан
   * менять только примечание. Раньше непереданное поле молча превращалось в
   * `null`, и такой вызов стирал бы учётный номер, марку, изготовителя и даты.
   */
  const keep = <T>(value: T | undefined, previous: T): T => (value === undefined ? previous : value);

  /**
   * Отличает «поле не передали» от «поле очистили».
   *
   * `clean` приводит пустую строку к `null`, но `undefined` обязан остаться
   * `undefined`: иначе непереданное поле не отличить от намеренно очищенного,
   * и `keep` не сможет сохранить прежнее значение.
   */
  const cleanIfGiven = (raw: string | null | undefined): string | null | undefined =>
    raw === undefined ? undefined : clean(raw);

  const object: PlanObject = {
    ...current.value,
    typeCode: nextTypeCode,
    regNumber: keep(cleanIfGiven(input.regNumber), current.value.regNumber),
    model: keep(cleanIfGiven(input.model), current.value.model),
    manufacturer: keep(cleanIfGiven(input.manufacturer), current.value.manufacturer),
    serialNumber: keep(cleanIfGiven(input.serialNumber), current.value.serialNumber),
    commissionedOn: keep(cleanIfGiven(input.commissionedOn), current.value.commissionedOn),
    serviceLifeYears: keep(input.serviceLifeYears, current.value.serviceLifeYears ?? null),
    serviceLifeMonths: input.serviceLifeYears === undefined ? input.serviceLifeMonths ?? null : null,
    responsible: keep(cleanIfGiven(input.responsible), current.value.responsible),
    extinguisherProfile: keep(input.extinguisherProfile, current.value.extinguisherProfile ?? null),
    hydrantProfile: keep(input.hydrantProfile, current.value.hydrantProfile ?? null),
    outdoorHydrantProfile: keep(input.outdoorHydrantProfile, current.value.outdoorHydrantProfile ?? null),
    waterSourceProfile: keep(input.waterSourceProfile, current.value.waterSourceProfile ?? null),
    ladderProfile: keep(input.ladderProfile, current.value.ladderProfile ?? null),
    roofFenceProfile: keep(input.roofFenceProfile, current.value.roofFenceProfile ?? null),
    fireproofingProfile: keep(input.fireproofingProfile, current.value.fireproofingProfile ?? null),
    fireBoardProfile: keep(input.fireBoardProfile, current.value.fireBoardProfile ?? null),
    pumpStationProfile: keep(input.pumpStationProfile, current.value.pumpStationProfile ?? null),
    fireBarrierProfile: keep(input.fireBarrierProfile, current.value.fireBarrierProfile ?? null),
    suppressionProfile: keep(input.suppressionProfile, current.value.suppressionProfile ?? null),
    controlPanelProfile: keep(input.controlPanelProfile, current.value.controlPanelProfile ?? null),
    customFields: keep(input.customFields, current.value.customFields ?? null),
    roomId: keep(cleanIfGiven(input.roomId), current.value.roomId),
    technicalState: keep(input.technicalState, current.value.technicalState),
    note: keep(cleanIfGiven(input.note), current.value.note),
    updatedAt: deps.clock.nowUtc(),
    rowVersion: current.value.rowVersion + 1,
  };

  const saved = await deps.objects.save(object);
  if (!saved.ok) return saved;
  return ok(object);
}

/** Вывод из эксплуатации: замена, списание, демонтаж. История сохраняется. */
export async function archiveObject(deps: ObjectDeps, id: PlanObjectId): Promise<Result<PlanObject>> {
  const current = await deps.objects.getById(id);
  if (!current.ok) return current;
  if (current.value.archivedAt !== null) return ok(current.value);

  const now = deps.clock.nowUtc();
  const object: PlanObject = {
    ...current.value,
    archivedAt: now,
    updatedAt: now,
    rowVersion: current.value.rowVersion + 1,
  };

  const saved = await deps.objects.save(object);
  if (!saved.ok) return saved;
  return ok(object);
}
