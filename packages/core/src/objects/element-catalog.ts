/**
 * Каталог элементов СППЗ — то, что показывается в правой панели.
 *
 * Живёт в ядре, а не в интерфейсе: этот же список нужен журналу, отчётам и
 * правилам, и второй копии у него быть не должно.
 *
 * Коды систем — из «Регламента ТО СПЗ» заказчика, поэтому названия для него
 * привычные. Внутренний код типа (typeCode) наш собственный и неизменный: к
 * нему будут привязаны правила. Это ровно то разделение, о котором говорит
 * решение Р7: свой код плюс код заказчика.
 *
 * Позже каталог заменит конструктор типов (движок E4) и типы станут данными
 * пользователя. До тех пор список лежит здесь как данные, а не как код формы.
 *
 * Смотри docs/02_ТЗ_редакция_3.md, часть 6.
 */

import type { PlanKind } from '../object-tree/tree-rules.js';
import { SYSTEM_MEMBER_TYPES } from './fire-system.js';

export interface ElementType {
  /** Внутренний неизменный код типа. К нему привязываются правила. */
  readonly typeCode: string;
  /** Код системы по регламенту заказчика: 01, 02.1, 03.1 и так далее. */
  readonly systemCode: string;
  readonly title: string;
  /** На каких рабочих областях элемент применим. */
  readonly appliesTo: readonly PlanKind[];
  /** Цвет значка на плане. Условный, не нормативное обозначение. */
  readonly color: string;
  /** Короткая пометка на значке: длинные названия на плане не помещаются. */
  readonly mark: string;
  /** Служебные подтипы участвуют в правилах, но не дублируют элемент в библиотеке. */
  readonly showInLibrary?: boolean;
}

const FLOOR: readonly PlanKind[] = ['floor', 'storage'];
const GENERAL: readonly PlanKind[] = ['general'];

export const ELEMENT_CATALOG: readonly ElementType[] = [
  // Генплан объекта: то, что стоит на территории и вокруг здания.
  { typeCode: 'hydrant', systemCode: '18', title: 'Пожарный гидрант', appliesTo: GENERAL, color: '#dc2626', mark: 'ПГ' },
  { typeCode: 'water-reservoir', systemCode: '18', title: 'Пожарный водоём, резервуар', appliesTo: GENERAL, color: '#2563eb', mark: 'ПВ' },
  // Резервуар закрыт и заполняется из водопровода, водоём открыт и зависит
  // от сезона: зимой к нему нужна прорубь и подъезд. В одной строке они
  // стояли только потому, что оба про запас воды.
  { typeCode: 'water-tank', systemCode: '18', title: 'Пожарный резервуар', appliesTo: GENERAL, color: '#2563eb', mark: 'ПР', showInLibrary: false },
  { typeCode: 'water-pond', systemCode: '18', title: 'Пожарный водоём', appliesTo: GENERAL, color: '#2563eb', mark: 'ПВ', showInLibrary: false },
  { typeCode: 'water-natural', systemCode: '18', title: 'Естественный водоисточник', appliesTo: GENERAL, color: '#2563eb', mark: 'ЕВ', showInLibrary: false },
  { typeCode: 'fire-truck-connection', systemCode: '02.1', title: 'Место подключения пожарной техники', appliesTo: GENERAL, color: '#b91c1c', mark: 'ПТ' },
  { typeCode: 'outdoor-ladder', systemCode: '16', title: 'Наружная пожарная лестница', appliesTo: GENERAL, color: '#475569', mark: 'ПЛ' },
  { typeCode: 'roof-fence', systemCode: '17', title: 'Ограждение кровли', appliesTo: GENERAL, color: '#64748b', mark: 'ОК' },
  { typeCode: 'outdoor-cabinet', systemCode: '01', title: 'Пожарный щит', appliesTo: GENERAL, color: '#dc2626', mark: 'ПЩ' },
  // Типы щитов по ППР РФ №1479, приложение 6: комплектация у них разная —
  // ЩП-В несёт бочку с водой и вёдра, ЩП-Е — диэлектрические перчатки и
  // коврик. Проверять комплектность «щита вообще» не по чему.
  { typeCode: 'fire-board-a', systemCode: '01', title: 'Щит пожарный ЩП-А', appliesTo: GENERAL, color: '#dc2626', mark: 'ЩП-А', showInLibrary: false },
  { typeCode: 'fire-board-v', systemCode: '01', title: 'Щит пожарный ЩП-В', appliesTo: GENERAL, color: '#dc2626', mark: 'ЩП-В', showInLibrary: false },
  { typeCode: 'fire-board-e', systemCode: '01', title: 'Щит пожарный ЩП-Е', appliesTo: GENERAL, color: '#dc2626', mark: 'ЩП-Е', showInLibrary: false },
  { typeCode: 'fire-board-sh', systemCode: '01', title: 'Щит пожарный ЩП-СХ', appliesTo: GENERAL, color: '#dc2626', mark: 'ЩП-СХ', showInLibrary: false },
  { typeCode: 'fire-board-mobile', systemCode: '01', title: 'Щит пожарный передвижной ЩПП', appliesTo: GENERAL, color: '#dc2626', mark: 'ЩПП', showInLibrary: false },
  { typeCode: 'outdoor-cabinet-box', systemCode: '01', title: 'Шкаф пожарный наружный', appliesTo: GENERAL, color: '#dc2626', mark: 'ШПН', showInLibrary: false },
  { typeCode: 'fire-post', systemCode: '09', title: 'Пожарный пост', appliesTo: GENERAL, color: '#16a34a', mark: 'ПС', showInLibrary: false },
  { typeCode: 'pump-station', systemCode: '02.2', title: 'Насосная станция', appliesTo: GENERAL, color: '#1d4ed8', mark: 'НС' },

  // Поэтажный план и склад: системы защиты внутри здания.
  //
  // В библиотеке огнетушитель один. Подтипы выбираются в карточке и нужны
  // пакету правил: разные ОТВ имеют разные сроки и чек-листы.
  // Периодичность перезарядки различается на порядок в зависимости от заряда
  // (вода/пена — 1 год, порошок и CO₂ — 5 лет, ГОСТ Р 59641-2021, таблица 1
  // п. 5.1.11.1), поэтому у общего типа пакета правил нет — конкретный срок
  // можно назначить только зная заряд. Общий тип остаётся для случаев, когда
  // заряд неизвестен или не важен (например, при первом переносе журнала).
  { typeCode: 'extinguisher', systemCode: '01', title: 'Огнетушитель', appliesTo: FLOOR, color: '#dc2626', mark: 'ОГ' },
  { typeCode: 'extinguisher-water', systemCode: '01', title: 'Огнетушитель водный', appliesTo: FLOOR, color: '#dc2626', mark: 'ОВ', showInLibrary: false },
  { typeCode: 'extinguisher-foam', systemCode: '01', title: 'Огнетушитель пенный', appliesTo: FLOOR, color: '#dc2626', mark: 'ОВП', showInLibrary: false },
  { typeCode: 'extinguisher-emulsion', systemCode: '01', title: 'Огнетушитель воздушно-эмульсионный', appliesTo: FLOOR, color: '#dc2626', mark: 'ОВЭ', showInLibrary: false },
  { typeCode: 'extinguisher-powder', systemCode: '01', title: 'Огнетушитель порошковый', appliesTo: FLOOR, color: '#dc2626', mark: 'ОП', showInLibrary: false },
  { typeCode: 'extinguisher-co2', systemCode: '01', title: 'Огнетушитель углекислотный', appliesTo: FLOOR, color: '#dc2626', mark: 'ОУ', showInLibrary: false },
  { typeCode: 'extinguisher-halon', systemCode: '01', title: 'Огнетушитель хладоновый', appliesTo: FLOOR, color: '#dc2626', mark: 'ОХ', showInLibrary: false },
  // Исторический внутренний код сохранён для совместимости с базой; правильное
  // название в интерфейсе — BONTEL, это подтип общей строки «Огнетушитель».
  { typeCode: 'extinguisher-bantl', systemCode: '01', title: 'Огнетушитель BONTEL', appliesTo: FLOOR, color: '#dc2626', mark: 'ОВЭ', showInLibrary: false },
  { typeCode: 'fire-hydrant-indoor', systemCode: '02.1', title: 'Пожарный кран', appliesTo: FLOOR, color: '#ea580c', mark: 'ПК' },
  { typeCode: 'fire-detector', systemCode: '03.1', title: 'Извещатель пожарный', appliesTo: FLOOR, color: '#0891b2', mark: 'ИП' },
  // Добавлены к трём прежним видам: комбинированный совмещает дымовой и
  // тепловой каналы, газовый следит за угарным газом, аспирационный сам
  // забирает пробу воздуха трубками. Раньше комбинированные извещатели
  // приходилось записывать дымовыми, что неверно.
  { typeCode: 'combined-detector', systemCode: '03.1', title: 'Извещатель пожарный комбинированный', appliesTo: FLOOR, color: '#0891b2', mark: 'ИПК', showInLibrary: false },
  { typeCode: 'gas-detector', systemCode: '03.1', title: 'Извещатель пожарный газовый', appliesTo: FLOOR, color: '#0891b2', mark: 'ИПГ', showInLibrary: false },
  { typeCode: 'aspiration-detector', systemCode: '03.1', title: 'Извещатель пожарный аспирационный', appliesTo: FLOOR, color: '#0891b2', mark: 'ИПА', showInLibrary: false },
  { typeCode: 'smoke-detector', systemCode: '03.1', title: 'Извещатель пожарный дымовой', appliesTo: FLOOR, color: '#0891b2', mark: 'ИПД', showInLibrary: false },
  { typeCode: 'heat-detector', systemCode: '03.1', title: 'Извещатель пожарный тепловой', appliesTo: FLOOR, color: '#0e7490', mark: 'ИПТ', showInLibrary: false },
  { typeCode: 'flame-detector', systemCode: '03.1', title: 'Извещатель пожарный пламени', appliesTo: FLOOR, color: '#7c3aed', mark: 'ИПП', showInLibrary: false },
  { typeCode: 'manual-call-point', systemCode: '03.1', title: 'Извещатель пожарный ручной ИПР', appliesTo: FLOOR, color: '#dc2626', mark: 'ИПР' },
  { typeCode: 'control-panel', systemCode: '03.2', title: 'Прибор приёмно-контрольный ППКП', appliesTo: FLOOR, color: '#1d4ed8', mark: 'ППКП' },
  { typeCode: 'sounder', systemCode: '04', title: 'СОУЭ', appliesTo: FLOOR, color: '#16a34a', mark: 'СОУЭ' },
  // Виды оповещателей по СП 3.13130.2009: звуковые, речевые и световые
  // работают по-разному и проверяются по-разному — у речевого слушают
  // разборчивость записи, у светового смотрят яркость и видимость
  // указателя. Одной строкой «СОУЭ» их не различить, а в журнале они и
  // должны различаться. В библиотеку по отдельности не выносятся: вид
  // уточняется в карточке, как заряд у огнетушителя.
  { typeCode: 'sounder-audible', systemCode: '04', title: 'Звуковой оповещатель (СОУЭ)', appliesTo: FLOOR, color: '#16a34a', mark: 'ЗО', showInLibrary: false },
  { typeCode: 'sounder-speech', systemCode: '04', title: 'Речевой оповещатель (СОУЭ)', appliesTo: FLOOR, color: '#16a34a', mark: 'РО', showInLibrary: false },
  { typeCode: 'sounder-light', systemCode: '04', title: 'Световой оповещатель (СОУЭ)', appliesTo: FLOOR, color: '#16a34a', mark: 'СО', showInLibrary: false },
  { typeCode: 'sounder-combined', systemCode: '04', title: 'Свето-звуковой оповещатель (СОУЭ)', appliesTo: FLOOR, color: '#16a34a', mark: 'СЗО', showInLibrary: false },
  { typeCode: 'smoke-valve', systemCode: '05', title: 'Клапан противодымный', appliesTo: FLOOR, color: '#0f766e', mark: 'КП' },
  // Виды противодымных клапанов по СП 7.13130.2013. Огнезадерживающий
  // стоит открытым и закрывается при пожаре, дымовой — наоборот; проверяют
  // их поэтому в разные стороны, и одной строкой «клапан» это не различить.
  { typeCode: 'damper-fire', systemCode: '05', title: 'Клапан противопожарный огнезадерживающий', appliesTo: FLOOR, color: '#0f766e', mark: 'КОЗ', showInLibrary: false },
  { typeCode: 'damper-smoke', systemCode: '05', title: 'Клапан дымовой', appliesTo: FLOOR, color: '#0f766e', mark: 'КД', showInLibrary: false },
  { typeCode: 'damper-dual', systemCode: '05', title: 'Клапан двойного действия', appliesTo: FLOOR, color: '#0f766e', mark: 'КДД', showInLibrary: false },
  { typeCode: 'damper-pressure', systemCode: '05', title: 'Клапан избыточного давления', appliesTo: FLOOR, color: '#0f766e', mark: 'КИД', showInLibrary: false },
  { typeCode: 'smoke-fan', systemCode: '05', title: 'Вентилятор дымоудаления', appliesTo: FLOOR, color: '#0f766e', mark: 'ВД' },
  // Вентилятор дымоудаления вытягивает дым, вентилятор подпора нагнетает
  // воздух в лестничную клетку. Работа противоположная, и путать их в
  // журнале нельзя.
  { typeCode: 'fan-exhaust', systemCode: '05', title: 'Вентилятор дымоудаления (вытяжной)', appliesTo: FLOOR, color: '#0f766e', mark: 'ВД', showInLibrary: false },
  { typeCode: 'fan-supply', systemCode: '05', title: 'Вентилятор подпора воздуха (приточный)', appliesTo: FLOOR, color: '#0f766e', mark: 'ВП', showInLibrary: false },
  { typeCode: 'fire-suppression-system', systemCode: '06', title: 'Система пожаротушения', appliesTo: FLOOR, color: '#2563eb', mark: 'АУПТ' },
  { typeCode: 'sprinkler', systemCode: '06', title: 'Ороситель', appliesTo: FLOOR, color: '#2563eb', mark: 'ОР', showInLibrary: false },
  { typeCode: 'powder-module', systemCode: '08', title: 'Модуль порошкового пожаротушения', appliesTo: FLOOR, color: '#a16207', mark: 'МП', showInLibrary: false },
  { typeCode: 'gas-module', systemCode: '07', title: 'Модуль газового пожаротушения', appliesTo: FLOOR, color: '#2563eb', mark: 'МГ', showInLibrary: false },
  // Виды установок пожаротушения по СП 485.1311500.2020 (газовые и
  // порошковые), ГОСТ Р 50680 (водяные), ГОСТ Р 50800 (пенные) и
  // ГОСТ Р 59636-2021. В библиотеку по отдельности не выносятся: на плане
  // это одна строка «Система пожаротушения», а вид уточняется в карточке —
  // так же, как заряд у огнетушителя.
  { typeCode: 'aup-sprinkler', systemCode: '06', title: 'Спринклерная установка водяного пожаротушения', appliesTo: FLOOR, color: '#2563eb', mark: 'АУПТ', showInLibrary: false },
  { typeCode: 'aup-drencher', systemCode: '06', title: 'Дренчерная установка водяного пожаротушения', appliesTo: FLOOR, color: '#2563eb', mark: 'АУПТ', showInLibrary: false },
  { typeCode: 'aup-sprinkler-drencher', systemCode: '06', title: 'Спринклерно-дренчерная установка пожаротушения', appliesTo: FLOOR, color: '#2563eb', mark: 'АУПТ', showInLibrary: false },
  { typeCode: 'aup-mist', systemCode: '06', title: 'Установка пожаротушения тонкораспылённой водой', appliesTo: FLOOR, color: '#2563eb', mark: 'АУПТ', showInLibrary: false },
  { typeCode: 'aup-foam', systemCode: '06', title: 'Установка пенного пожаротушения', appliesTo: FLOOR, color: '#2563eb', mark: 'АУПТ', showInLibrary: false },
  { typeCode: 'aup-gas', systemCode: '06', title: 'Установка газового пожаротушения', appliesTo: FLOOR, color: '#2563eb', mark: 'АУПТ', showInLibrary: false },
  { typeCode: 'aup-powder', systemCode: '06', title: 'Установка порошкового пожаротушения', appliesTo: FLOOR, color: '#2563eb', mark: 'АУПТ', showInLibrary: false },
  { typeCode: 'aup-aerosol', systemCode: '06', title: 'Установка аэрозольного пожаротушения', appliesTo: FLOOR, color: '#2563eb', mark: 'АУПТ', showInLibrary: false },
  { typeCode: 'aup-combined', systemCode: '06', title: 'Комбинированная установка пожаротушения', appliesTo: FLOOR, color: '#2563eb', mark: 'АУПТ', showInLibrary: false },
  { typeCode: 'aup-robotic', systemCode: '06', title: 'Роботизированная установка пожаротушения', appliesTo: FLOOR, color: '#2563eb', mark: 'АУПТ', showInLibrary: false },
  // Автономная установка стоит отдельно от систем, работающих от ППКУ:
  // у неё нет прибора управления, она срабатывает сама и обслуживается сама.
  { typeCode: 'autonomous-suppression', systemCode: '08', title: 'Модульная автономная установка пожаротушения', appliesTo: FLOOR, color: '#a16207', mark: 'АУП' },
  // Подвиды по огнетушащему веществу: у каждого свой порядок обслуживания по
  // паспорту изделия, и одним списком работ их не покрыть — как и огнетушители.
  { typeCode: 'suppression-powder', systemCode: '08', title: 'Установка порошкового пожаротушения', appliesTo: FLOOR, color: '#a16207', mark: 'АУП', showInLibrary: false },
  { typeCode: 'suppression-gas', systemCode: '08', title: 'Установка газового пожаротушения', appliesTo: FLOOR, color: '#a16207', mark: 'АУП', showInLibrary: false },
  { typeCode: 'suppression-aerosol', systemCode: '08', title: 'Установка аэрозольного пожаротушения', appliesTo: FLOOR, color: '#a16207', mark: 'АУП', showInLibrary: false },
  { typeCode: 'suppression-water', systemCode: '08', title: 'Установка водяного пожаротушения', appliesTo: FLOOR, color: '#a16207', mark: 'АУП', showInLibrary: false },
  { typeCode: 'suppression-mist', systemCode: '08', title: 'Установка пожаротушения тонкораспылённой водой', appliesTo: FLOOR, color: '#a16207', mark: 'АУП', showInLibrary: false },
  { typeCode: 'fire-door', systemCode: '15', title: 'Противопожарная дверь, люк, штора', appliesTo: FLOOR, color: '#7c2d12', mark: 'ПД' },
  // Огнезащитная обработка — не изделие, а состояние конструкции: её
  // наносят, она действует свой срок и по его истечении возобновляется.
  { typeCode: 'fireproofing', systemCode: '15', title: 'Огнезащитная обработка', appliesTo: FLOOR, color: '#15803d', mark: 'ОЗ' },
  { typeCode: 'exit', systemCode: '—', title: 'Эвакуационный выход, лестничная клетка', appliesTo: FLOOR, color: '#16a34a', mark: 'ЭВ', showInLibrary: false },
  { typeCode: 'self-rescuer', systemCode: '26', title: 'Самоспасатель, СИЗОД', appliesTo: FLOOR, color: '#9333ea', mark: 'СИЗ' },
  // Фильтрующий самоспасатель очищает наружный воздух и в дыму без
  // кислорода бесполезен; изолирующий несёт свой запас. Срок службы и
  // условия применения у них разные.
  { typeCode: 'self-rescuer-filter', systemCode: '26', title: 'Самоспасатель фильтрующий', appliesTo: FLOOR, color: '#9333ea', mark: 'СИЗ-Ф', showInLibrary: false },
  { typeCode: 'self-rescuer-isolating', systemCode: '26', title: 'Самоспасатель изолирующий', appliesTo: FLOOR, color: '#9333ea', mark: 'СИЗ-И', showInLibrary: false },
  { typeCode: 'evacuation-plan', systemCode: '09', title: 'План эвакуации, знак безопасности', appliesTo: FLOOR, color: '#059669', mark: 'ЗН', showInLibrary: false },
];


/**
 * Оборудование системы пожарной автоматики: в библиотеку по отдельности не
 * выносится, а заводится составом прибора.
 *
 * Раньше здесь лежала копия перечня из `fire-system.ts`, а совпадение копий
 * держал тест. Копия дважды отставала при добавлении новых видов, поэтому
 * перечень теперь один: цикла между модулями нет — `fire-system.ts` каталог
 * не читает.
 */
export const SYSTEM_MEMBER_TYPES_IN_LIBRARY: readonly string[] = SYSTEM_MEMBER_TYPES;

/** Общий огнетушитель и его служебные подтипы — одна семья оборудования. */
export function isExtinguisherType(typeCode: string): boolean {
  return typeCode === 'extinguisher' || typeCode.startsWith('extinguisher-');
}

/**
 * Семейства, внутри которых вид уточняется в карточке.
 *
 * Общий вид стоит в библиотеке одной строкой, а конкретный выбирается уже в
 * карточке — так же, как заряд у огнетушителя. Смена вида в карточке
 * разрешена только внутри своего семейства: превратить извещатель в клапан
 * правкой карточки нельзя, для этого есть «Заменить».
 */
export type ConfigurableFamily =
  | 'extinguisher' | 'fire-detector' | 'sounder' | 'fire-suppression' | 'autonomous-suppression'
  | 'smoke-valve' | 'smoke-fan' | 'self-rescuer' | 'water-reservoir' | 'outdoor-cabinet';

const FAMILY_KEYS: readonly TabledFamily[] = [
  'fire-detector', 'sounder', 'smoke-valve', 'smoke-fan',
  'self-rescuer', 'water-reservoir', 'outdoor-cabinet',
];
/** Семейства, заданные таблицей. Огнетушители и пожаротушение опознаются по коду. */
type TabledFamily = Exclude<ConfigurableFamily, 'extinguisher' | 'fire-suppression' | 'autonomous-suppression'>;

const FAMILY_OF: Readonly<Record<TabledFamily, readonly string[]>> = {
  'fire-detector': [
    'fire-detector', 'smoke-detector', 'heat-detector', 'flame-detector',
    'combined-detector', 'gas-detector', 'aspiration-detector',
  ],
  sounder: ['sounder', 'sounder-audible', 'sounder-speech', 'sounder-light', 'sounder-combined'],
  'smoke-valve': ['smoke-valve', 'damper-fire', 'damper-smoke', 'damper-dual', 'damper-pressure'],
  'smoke-fan': ['smoke-fan', 'fan-exhaust', 'fan-supply'],
  'self-rescuer': ['self-rescuer', 'self-rescuer-filter', 'self-rescuer-isolating'],
  'water-reservoir': ['water-reservoir', 'water-pond', 'water-tank', 'water-natural'],
  'outdoor-cabinet': [
    'outdoor-cabinet', 'fire-board-a', 'fire-board-v', 'fire-board-e',
    'fire-board-sh', 'fire-board-mobile', 'outdoor-cabinet-box',
  ],
};

/**
 * Семейство, внутри которого вид уточняется в карточке.
 *
 * Огнетушители и установки пожаротушения опознаются по началу кода — их
 * подвиды заводятся часто, и перечислять их пришлось бы дважды. Остальные
 * семейства заданы таблицей: у них коды разнородные («ЩП-А» и «шкаф»),
 * угадать их правилом нельзя.
 */
export function configurableFamily(typeCode: string): ConfigurableFamily | null {
  if (isExtinguisherType(typeCode)) return 'extinguisher';
  if (typeCode === 'fire-suppression-system' || typeCode.startsWith('aup-')
    || ['sprinkler', 'powder-module', 'gas-module'].includes(typeCode)) return 'fire-suppression';
  // Вид ОТВ модульной установки уточняется в карточке, как заряд огнетушителя:
  // на объект её ставят одним значком, а чем она тушит, выясняется по паспорту.
  if (typeCode === 'autonomous-suppression' || typeCode.startsWith('suppression-')) return 'autonomous-suppression';

  for (const family of FAMILY_KEYS) {
    if (FAMILY_OF[family].includes(typeCode)) return family;
  }
  return null;
}

