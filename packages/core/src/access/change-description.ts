/**
 * Из чего складывается запись журнала изменений.
 *
 * Заказчик (пункт 9 перечня доработок): «история должна отражать не только
 * входы, а все значимые изменения… создание записи, изменение записи, удаление
 * записи, создание элемента, изменение карточки элемента, перемещение элемента,
 * изменение состояния элемента, изменение характеристик пожарной безопасности
 * объекта, изменение данных здания, изменение данных этажа/отметки, изменение
 * настроек системы… Для каждого события хранить: дату и время, пользователя,
 * тип действия, тип объекта, ID объекта, краткое описание, какие данные были
 * изменены, старое значение, новое значение».
 *
 * Всё это уже проходит через одно место — историю команд Undo/Redo: она и так
 * получает каждое изменение сущности с тем, что было до и что стало после,
 * иначе ей нечего было бы откатывать. Отсюда правило: **журнал изменений
 * заполняется из тех же записей, а не вторым обходом хранилища.** Иначе
 * пришлось бы дописывать запись в журнал в каждом сценарии и в каждом окне —
 * и забывать её в половине из них.
 *
 * Здесь только перевод: из пары «было — стало» получаются вид записи, её
 * название, узел дерева и перечень изменившихся полей по-человечески.
 * Названия полей — таблицей, а не разбором имени: «regNumber» человеку ничего
 * не говорит, а «учётный номер» говорит.
 */

import type {
  ChangeAction, ChangeSubject, ChangedField, HistoryEntityChange, HistoryEntityKind, TreeNodeId,
} from '@izh/contracts';
import { elementTitle } from '../objects/element-lookup.js';

/** Как вид сущности из истории команд называется в журнале изменений. */
const SUBJECT_BY_KIND: Readonly<Record<HistoryEntityKind, ChangeSubject>> = {
  tree: 'узел дерева',
  room: 'помещение',
  object: 'оборудование',
  maintenance: 'запись журнала',
  settings: 'настройки',
  backdrop: 'подложка',
  calibration: 'масштаб',
  cleanup: 'правка подложки',
};

/**
 * Названия полей по-человечески.
 *
 * Общий словарь на все сущности: одно и то же поле в разных карточках
 * называется одинаково, и держать по словарю на вид значило бы разойтись в
 * названиях. Поля, которых здесь нет, в журнал не попадают — см. ниже.
 */
const FIELD_TITLES: Readonly<Record<string, string>> = {
  name: 'название',
  code: 'код или инвентарный номер',
  elevationM: 'отметка уровня, м',
  note: 'примечание',
  building: 'характеристики пожарной безопасности',
  sortOrder: 'порядок в дереве',
  inCommonJournal: 'показ в общем журнале',
  parentId: 'место в дереве',
  objectsPinned: 'закрепление объектов',
  number: 'номер по экспликации',
  category: 'категория помещения',
  categoryBasis: 'основание категории',
  purpose: 'назначение помещения',
  fireClasses: 'классы возможного пожара',
  areaM2: 'площадь, м²',
  outline: 'обводка на плане',
  sprinklered: 'защита установкой пожаротушения',
  levelId: 'этаж',
  nodeId: 'место в дереве',
  roomId: 'помещение',
  typeCode: 'вид элемента',
  regNumber: 'учётный номер',
  model: 'марка',
  manufacturer: 'изготовитель',
  serialNumber: 'заводской номер',
  commissionedOn: 'дата ввода в эксплуатацию',
  serviceLifeYears: 'срок службы, лет',
  serviceLifeMonths: 'срок службы, месяцев',
  responsible: 'ответственный',
  position: 'место на плане',
  technicalState: 'техническое состояние',
  storageSection: 'полка склада',
  archivedAt: 'вывод из обращения',
  systemId: 'система',
  placementId: 'место размещения',
  customFields: 'свои поля карточки',
  extinguisherProfile: 'сведения огнетушителя',
  hydrantProfile: 'сведения пожарного крана',
  outdoorHydrantProfile: 'сведения гидранта',
  waterSourceProfile: 'сведения водоисточника',
  ladderProfile: 'сведения лестницы',
  controlPanelProfile: 'сведения прибора',
  fireBarrierProfile: 'сведения преграды',
  fireproofingProfile: 'сведения огнезащиты',
  roofFenceProfile: 'сведения ограждения кровли',
  fireBoardProfile: 'сведения щита',
  pumpStationProfile: 'сведения насосной станции',
  suppressionProfile: 'сведения установки пожаротушения',
  metersPerPixel: 'масштаб',
  fileHash: 'файл подложки',
  title: 'название',

  /*
   * Поля внутри карточек отдельных видов. Они лежат вложенными объектами
   * («сведения огнетушителя»), и без своих названий строка журнала выглядела
   * бы как «agent: порошок».
   */
  agent: 'огнетушащее вещество',
  propulsion: 'способ вытеснения',
  execution: 'исполнение',
  nominalCharge: 'номинальный заряд',
  chargeUnit: 'единица заряда',
  fireRating: 'ранг очага',
  lastRechargeOn: 'дата последней перезарядки',
  nextAnnualCheckOn: 'срок ежегодной проверки',
  nextWeighingOn: 'срок взвешивания',
  nextCylinderTestOn: 'срок испытания баллона',
  serviceLifeEndsOn: 'окончание срока службы',
  placedOn: 'дата размещения',
  installationPoint: 'место установки',
  manufacturedOn: 'дата изготовления',
  certificateNumber: 'номер сертификата',
  responsiblePosition: 'должность ответственного',
  responsibleOrganization: 'организация ответственного',
  pressureMinMpa: 'давление, минимум, МПа',
  pressureMaxMpa: 'давление, максимум, МПа',
  nominalPressureMpa: 'номинальное давление, МПа',
  tareMassKg: 'масса корпуса, кг',
  nominalFullMassKg: 'полная масса, кг',
  temperatureMinC: 'температура, минимум, °C',
  temperatureMaxC: 'температура, максимум, °C',
  diameterMm: 'диаметр, мм',
  placementKind: 'вид установки',
  networkDiameterMm: 'диаметр сети, мм',
  heightMm: 'высота, мм',
  pad: 'площадка для техники',
  vehicleCount: 'количество машин',
  treatmentKind: 'вид огнезащитной обработки',
  fireResistance: 'предел огнестойкости',
  barrierKind: 'вид преграды',
  source: 'источник',
  backupPower: 'резервное питание',
};

/**
 * Служебные поля: в журнал не идут.
 *
 * Они меняются при каждой правке и ничего не говорят человеку: строка «версия
 * записи: 4 → 5» только мешает найти ту, где действительно поменялась
 * категория.
 */
const SKIPPED = new Set(['id', 'siteId', 'createdAt', 'updatedAt', 'rowVersion']);

/** Описание одного изменения — готовое к записи в журнал. */
export interface DescribedChange {
  readonly action: ChangeAction;
  readonly subject: ChangeSubject;
  readonly subjectId: string;
  readonly subjectTitle: string;
  readonly nodeId: TreeNodeId | null;
  readonly fields: readonly ChangedField[];
}

function record(value: unknown): Readonly<Record<string, unknown>> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Readonly<Record<string, unknown>>;
}

/**
 * Значение поля так, как его прочтёт человек.
 *
 * Заказчик: «колонка „что изменилось“ — информация там непонятна, видимо
 * системные названия какие-то; нужно конкретно указывать, поменял то-то и
 * то-то, кратко».
 *
 * Их и было двое: служебный код вида (`extinguisher-powder`) и голые `true` и
 * `false`. Ни то, ни другое человек не читает — а в журнале изменений строка
 * должна читаться без переводчика.
 */
function valueText(key: string, value: unknown): string | null {
  if (typeof value === 'boolean') return value ? 'да' : 'нет';
  if (key === 'typeCode' && typeof value === 'string' && value !== '') return elementTitle(value);
  return text(value);
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value === '' ? null : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.length === 0 ? null : value.map((item) => text(item) ?? '—').join(', ');
  }
  return JSON.stringify(value);
}

/**
 * Что за действие произошло.
 *
 * Вывод из обращения — это удаление: физически в программе не удаляют ничего
 * (AGENTS.md, правило 10), и человек, ищущий «кто удалил огнетушитель», должен
 * найти именно эту запись, а не «изменено».
 */
function actionOf(
  before: Readonly<Record<string, unknown>> | null,
  after: Readonly<Record<string, unknown>> | null,
): ChangeAction {
  if (before === null) return 'заведено';
  if (after === null) return 'удалено';
  const wasArchived = before['archivedAt'] !== null && before['archivedAt'] !== undefined;
  const isArchived = after['archivedAt'] !== null && after['archivedAt'] !== undefined;
  if (!wasArchived && isArchived) return 'удалено';
  if (wasArchived && !isArchived) return 'восстановлено';
  return 'изменено';
}

/** Как назвать изменённое, чтобы запись читалась без открытия карточки. */
function titleOf(kind: HistoryEntityKind, value: Readonly<Record<string, unknown>> | null): string {
  if (value === null) return SUBJECT_BY_KIND[kind];
  if (kind === 'settings') return 'Настройки программы';
  if (kind === 'object') {
    /*
     * Название по-русски, а не служебный код вида.
     *
     * Заказчик: «колонка „над чем“ выводит непонятную информацию, видимо
     * какое-то название в системе файлов». Это и был код вида —
     * `extinguisher-powder`: марку в карточке заполняют не всегда, и вместо
     * неё в ленту попадал код, которым вид зовётся внутри программы.
     */
    const number = text(value['regNumber']);
    const model = text(value['model']);
    const code = text(value['typeCode']);
    const kindTitle = code === null ? null : elementTitle(code);
    const name = model ?? kindTitle ?? 'оборудование';
    return number === null ? name : `${name} № ${number}`;
  }
  return text(value['name']) ?? text(value['title']) ?? SUBJECT_BY_KIND[kind];
}

/**
 * Узел дерева, к которому относится изменение.
 *
 * По нему журнал и смотрят — «что менялось по этому зданию», — и по нему же
 * проверяются права: ответственный видит только свои узлы. У самого узла это
 * он сам, у помещения — его этаж, у оборудования — узел, где оно числится.
 */
function nodeOf(kind: HistoryEntityKind, value: Readonly<Record<string, unknown>> | null): TreeNodeId | null {
  if (value === null) return null;
  if (kind === 'tree') return text(value['id']);
  if (kind === 'room') return text(value['levelId']);
  return text(value['nodeId']);
}

/**
 * Что именно поменялось.
 *
 * Сравниваются только поля из словаря названий: сущности растут, и поле, о
 * котором ещё не решили, как его назвать человеку, лучше не показывать вовсе,
 * чем показывать как «suppressionProfileVersion».
 */
function fieldsOf(
  before: Readonly<Record<string, unknown>> | null,
  after: Readonly<Record<string, unknown>> | null,
  prefix = '',
): readonly ChangedField[] {
  if (before === null || after === null) return [];

  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys
    .filter((key) => !SKIPPED.has(key))
    .flatMap((key) => {
      const own = FIELD_TITLES[key];
      if (own === undefined) return [];
      const title = prefix === '' ? own : `${prefix} · ${own}`;

      /*
       * Карточки отдельных видов лежат вложенными объектами. Сравниваются они
       * по полям, а не целиком: строка «сведения огнетушителя: {…} → {…}» с
       * полусотней ключей в фигурных скобках не говорит человеку ничего, а
       * «сведения огнетушителя · огнетушащее вещество: — → порошок» говорит всё.
       *
       * Глубже одного уровня не идём: там лежат перечни и точки на плане, у
       * которых своего смысла по отдельности нет.
       */
      if (prefix === '') {
        const wasInner = record(before[key]);
        const nowInner = record(after[key]);
        if (wasInner !== null || nowInner !== null) {
          return fieldsOf(wasInner ?? {}, nowInner ?? {}, own);
        }
      }

      const was = valueText(key, before[key]);
      const now = valueText(key, after[key]);
      return was === now ? [] : [{ title, before: was, after: now }];
    });
}

/**
 * Переводит изменение сущности в запись журнала.
 *
 * `null` — записывать нечего: правка ничего значимого не задела. Так бывает,
 * когда команда только пересчитала служебные поля.
 */
export function describeChange(change: HistoryEntityChange): DescribedChange | null {
  const before = record(change.before);
  const after = record(change.after);
  if (before === null && after === null) return null;

  const action = actionOf(before, after);
  const fields = fieldsOf(before, after);
  // Изменение без изменившихся полей не заносится: журнал заполнялся бы
  // пустыми строчками от каждого открытия карточки.
  if (action === 'изменено' && fields.length === 0) return null;

  const value = after ?? before;
  return {
    action,
    subject: SUBJECT_BY_KIND[change.kind],
    subjectId: change.id,
    subjectTitle: titleOf(change.kind, value),
    nodeId: nodeOf(change.kind, value),
    fields,
  };
}
