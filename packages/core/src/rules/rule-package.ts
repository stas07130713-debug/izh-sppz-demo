/**
 * Минимальный пакет правил: какие мероприятия применимы к каждому типу
 * оборудования, с какой периодичностью и по какому чек-листу.
 *
 * Это данные, а не код: правило 9 из AGENTS.md запрещает зашивать нормативные
 * требования в `if`. Здесь ровно то, о чём говорит часть Д18 ТЗ (шаг 1) —
 * стартовый пакет, без которого не построить ни одной колонки в журнале, но
 * ещё не полный нормативный реестр.
 *
 * Периодичности взяты из справочника заказчика
 * `ИЖ_СППЗ_периодичность_проверок_и_ТО_2026.docx` (раздел 1, сводная таблица) —
 * это не догадка, а прямая выписка с указанием документа и пункта. Сам
 * справочник прямо предупреждает: «Перед вводом системы в эксплуатацию
 * нормативную базу следует повторно проверить на действующую редакцию» —
 * поэтому каждая запись всё равно несёт `needsVerification: true`.
 *
 * Тип, для которого справочник не даёт числовой периодичности (например,
 * «по регламенту ТО», «по паспорту изготовителя»), получает
 * `periodicityMonths: null`. Считать такую периодичность в календарную дату
 * нечестно — движок сроков пока умеет только простой интервал в месяцах
 * (документ 00, П3: сезонное окно и выборка с ротацией ещё не реализованы).
 *
 * Типы, которых в справочнике нет вовсе, возвращают пустой список — это тоже
 * честный ответ: «правило для этого оборудования пока не заведено», а не
 * молчаливая тишина.
 */

import { npaRequirementsFor } from './npa-requirements.js';
import { SUPPRESSION_RULES } from './suppression-rules.js';

/** Периодичность мероприятия. Пока — только простой интервал в месяцах.
 *  Остальные виды из документа 00 (П3: сезонное окно, выборка с ротацией,
 *  условный интервал) добавятся вместе с полным движком регламентов (Э4). */
export interface ActivityChecklistItem {
  readonly text: string;
  readonly severity: 'критический' | 'значительный' | 'незначительный';
  readonly measurementCode?: string;
}

export interface ActivityRule {
  /** Внутренний код мероприятия. Устойчив, к нему привязывается лента истории. */
  readonly activityCode: string;
  readonly title: string;
  /** Раз в сколько месяцев. null — периодичность задаётся регламентом/паспортом, не числом из НД. */
  readonly periodicityMonths: number | null;
  /** Пункты чек-листа, специфичные для этого мероприятия и этого типа оборудования. */
  readonly checklist: readonly (string | ActivityChecklistItem)[];
  /** Документ и пункт, которым назначен срок. Показывается пользователю как основание. */
  readonly ndReference: string;
  /** Заполняется, если периодичность требует сверки по официальному фонду. */
  readonly needsVerification: boolean;
  /**
   * Работа применяется не всегда, а по решению организации или по условиям.
   *
   * Таких в библиотеке две: ежеквартальный осмотр по локальному регламенту —
   * это выбор организации, и полугодовая проверка — только при категории А или
   * постоянном воздействии неблагоприятных факторов (ГОСТ Р 59641-2021,
   * п. 5.1.7). Обе применимы к оборудованию, но по умолчанию выключены, пока
   * организация их не включила.
   *
   * Признак живёт здесь, в данных, а не списком кодов в коде: правило 9
   * AGENTS.md запрещает зашивать нормативные условия в `if`.
   */
  readonly optIn?: boolean;
  /**
   * По работе оформляется акт проверки, и его прикладывают к записи журнала.
   *
   * Не то же самое, что акт сторонней организации: тот подтверждает, кто
   * выполнял работы, а этот — что проверка состоялась и с каким результатом.
   * Проверку водоисточника оформляют актом независимо от того, своими силами
   * её провели или подрядчиком, и предъявляют потом этот акт.
   *
   * Признак живёт здесь, в данных, а не списком кодов в коде: правило 9
   * AGENTS.md запрещает зашивать нормативные требования в `if`.
   */
  readonly needsAct?: boolean;
  /**
   * Срок назначает организация: норматив называет мероприятия, но не число.
   *
   * Так устроены проверка комплектности пожарного щита и обслуживание насосной
   * станции: Правила требуют содержать их исправными, а периодичности не дают.
   * Подставленный программой срок в таком случае — предложение, а не норма, и
   * конструктор обязан сказать об этом прямо, чтобы на него не сослались перед
   * проверяющим.
   */
  readonly periodicityByOrganization?: boolean;
  /**
   * От чего отсчитывается первый срок, пока работа ни разу не выполнялась
   * (ТЗ, Дополнение 6, часть А3).
   *
   * `эксплуатация` (по умолчанию) — от даты постановки на учёт. Так считаются
   * осмотры, испытания и прочие работы, которые начинаются после того, как
   * оборудование поставили на объект.
   *
   * `изготовление` — от даты изготовления. Так считается всё, что привязано к
   * возрасту изделия, его корпусу или первоначальному заряду: перезарядка,
   * освидетельствование корпуса, контроль утечки. Огнетушитель, пролежавший
   * год на складе, к моменту установки уже израсходовал год своего срока, и
   * считать перезарядку от даты размещения значило бы дать ему лишний год.
   */
  readonly baselineKind?: 'эксплуатация' | 'изготовление';
  /**
   * Откуда правило пришло, если его собрал конструктор регламентов
   * (ТЗ, Дополнение 5, части Р9 и Р15).
   *
   * Записывается в мероприятие журнала, чтобы прошлая проверка навсегда знала
   * свой состав работ. У правил из нормативной библиотеки этих полей нет —
   * там нет ни версии, ни периодичности как отдельной сущности.
   */
  readonly regulationVersionId?: string;
  readonly periodicityId?: string;
  /**
   * Коды мероприятий, чья прежняя история относится к этому же правилу.
   *
   * Конструктор может собрать в одну периодичность то, что нормативная
   * библиотека держала порознь. Записи, сделанные до конструктора, знают только
   * старый код, и без этого списка они бы потерялись, а элемент показался бы
   * ни разу не проверенным. Переписывать сами записи нельзя (правило 10),
   * поэтому связь идёт отсюда.
   */
  readonly historyCodes?: readonly string[];
}

// СПС — извещатели: дымовые, тепловые, пламени, ручные. Справочник не
// различает их периодичность — все под одной строкой таблицы 1 ГОСТ Р 59638.
const OSMOTR_IZVESHCHATEL: ActivityRule = {
  activityCode: 'osmotr',
  title: 'Осмотр',
  periodicityMonths: 6,
  checklist: [
    'Извещатель не загрязнён, не окрашен, не закрыт посторонними предметами',
    'Крепление надёжно, индикация исправна',
  ],
  ndReference: 'ГОСТ Р 59638-2021, п. 6.4.2, таблица 1, строка 1 — типовой регламент',
  needsVerification: true,
};
const KONTROL_IZVESHCHATEL: ActivityRule = {
  activityCode: 'kontrol',
  title: 'Контроль функционирования',
  periodicityMonths: 12,
  checklist: [
    'Извещатель реагирует на тестовое воздействие',
    'Сигнал доходит до прибора приёмно-контрольного',
  ],
  ndReference: 'ГОСТ Р 59638-2021, п. 6.4.2, таблица 1, строка 1 — типовой регламент',
  needsVerification: true,
};

// СПС — ППКП, прибор приёмно-контрольный.
const OSMOTR_PPKP: ActivityRule = {
  activityCode: 'osmotr',
  title: 'Осмотр',
  periodicityMonths: 1,
  checklist: ['Индикация исправна, нет сообщений о неисправности', 'Корпус и подключения без повреждений'],
  ndReference: 'ГОСТ Р 59638-2021, п. 6.4.2, таблица 1, строка 2 — типовой регламент',
  needsVerification: true,
};
const KONTROL_PPKP: ActivityRule = {
  activityCode: 'kontrol',
  title: 'Контроль функционирования',
  periodicityMonths: 3,
  checklist: ['Проверка индикации по всем шлейфам', 'Проверка перехода на резервное питание'],
  ndReference: 'ГОСТ Р 59638-2021, п. 6.4.2, таблица 1, строка 2 — типовой регламент',
  needsVerification: true,
};
const KOMPLEKS_PPKP: ActivityRule = {
  activityCode: 'kompleks',
  title: 'Комплексные испытания на работоспособность',
  periodicityMonths: 12,
  checklist: [
    'Проверена работоспособность всех подключённых устройств',
    'Проверено взаимодействие с СОУЭ и другими системами',
    'Оформлен протокол испытаний',
  ],
  ndReference:
    'ГОСТ Р 59638-2021, п. 6.4.2, таблица 1, строка 5 — не более 15 месяцев между испытаниями, типовой регламент',
  needsVerification: true,
};

// СОУЭ — оповещатели.
const OBSLUZHIVANIE_OPOVESHCHATEL: ActivityRule = {
  activityCode: 'obsluzhivanie',
  title: 'Обслуживание',
  periodicityMonths: 3,
  checklist: ['Оповещатель подаёт сигнал по команде', 'Крепление и подключение исправны'],
  ndReference: 'ГОСТ Р 59639-2021, таблица 1, п. 1 — не реже 1 раза в 3 месяца, типовой регламент',
  needsVerification: true,
};
const RABOTOSPOSOBNOST_SOUE: ActivityRule = {
  activityCode: 'rabotosposobnost',
  title: 'Проверка работоспособности СОУЭ',
  periodicityMonths: 6,
  checklist: ['Уровень звукового давления субъективно достаточен', 'Оповещение проходит по всем зонам'],
  ndReference: 'ГОСТ Р 59639-2021, таблица 1, п. 3 — не более 7 месяцев между проверками, типовой регламент',
  needsVerification: true,
};

// АУП порошковое — модуль порошкового пожаротушения.
const RABOTOSPOSOBNOST_AUP: ActivityRule = {
  activityCode: 'rabotosposobnost',
  title: 'Проверка работоспособности',
  periodicityMonths: 6,
  checklist: ['Проверка в ручном/дистанционном режиме', 'Проверка в автоматическом режиме, без выпуска ОТВ'],
  ndReference: 'ГОСТ Р 59636-2021, приложения Г/Д/Е — не реже 1 раза в 6 месяцев, типовой регламент',
  needsVerification: true,
};
const KIP_AUP: ActivityRule = {
  activityCode: 'kip',
  title: 'Проверка КИП',
  periodicityMonths: 12,
  checklist: ['Метрологическая проверка контрольно-измерительных приборов'],
  ndReference: 'ГОСТ Р 59636-2021, приложения Г/Д/Е — типовой регламент',
  needsVerification: true,
};

// Автономная установка пожаротушения: состав работ зависит от вида заряда.
// Общие для всех видов — проверка работоспособности и КИП по ГОСТ Р 59636;
// ниже то, что различается.

// ВПВ — пожарный кран, шкаф.
const OSMOTR_PK: ActivityRule = {
  activityCode: 'osmotr',
  title: 'Осмотр',
  periodicityMonths: 1,
  checklist: [
    'Шкаф закрыт, пломба на месте',
    'Клапан не подтекает, маховик вращается свободно',
    'Рукав присоединён, скатан, без видимых повреждений',
  ],
  ndReference: 'ГОСТ Р 59643-2021, приложение А — ежемесячно, типовой регламент',
  needsVerification: true,
};
const ISPYTANIE_PK: ActivityRule = {
  activityCode: 'ispytanie',
  title: 'Испытание клапана на исправность',
  periodicityMonths: 6,
  checklist: ['Клапан открывается и закрывается без заеданий', 'Утечек в затворе нет'],
  ndReference: 'ГОСТ Р 59643-2021, п. 7.1.1.2 — 1 раз в полгода, требование ГОСТ',
  needsVerification: true,
};
const PEREKATKA_RUKAVA: ActivityRule = {
  activityCode: 'perekatka',
  title: 'Перекатка рукава на новую скатку',
  periodicityMonths: 12,
  checklist: ['Рукав перекатан на новую складку', 'Внешний осмотр рукава на разрывы и потёртости'],
  ndReference: 'ППР РФ №1479, п. 50 — не реже 1 раза в год, обязательно',
  needsVerification: true,
};

// Огнетушители: СП 9.13130.2009 отменён с 01.03.2025 приказом МЧС России от
// 20.11.2024 № 1017 — без замены. Периодичности ниже основаны на ППР РФ № 1479,
// паспорте изделия и действующей редакции ГОСТ Р 59641-2021 с Изменением № 1.
//
// СВЕРЕНО 19.08.2026 по тексту ГОСТ Р 59641-2021 (введён 15.09.2021, приказ
// Росстандарта от 24.08.2021 № 794-ст). Поэтому у правил ниже стоит
// needsVerification: false — флаг подтверждён проверкой, а не снят заодно:
//   таблица 1 п. 5.1.11.1 — вода и пена 1 раз в год, порошок 1 раз в 5 лет,
//     углекислота 1 раз в 5 лет (сноска: у огнетушителей со стабилизированным
//     зарядом, полимерным/эпоксидным покрытием или корпусом из нержавеющей
//     стали — по периодичности изготовителя, отсюда оговорка про паспорт);
//   п. 5.1.1 — ТО включает ежегодную проверку, испытания и перезарядку;
//   п. 5.1.7 — при 5 и более порошковых огнетушителях ежегодной проверке
//     подвергается не менее 3%; при категории А или постоянном воздействии
//     неблагоприятных факторов проверка не реже 1 раза в 6 мес;
//   п. 5.1.9 — раз в 5 лет разрядка, очистка корпуса, внешний и внутренний
//     осмотр, испытания на прочность и герметичность;
//   п. 5.1.11.2 — гидростатическое испытание корпуса не реже 1 раза в 5 лет;
//   п. 6.2 — утечка определяется взвешиванием при ежегодной проверке.
//
// Внимание при обновлении: справочник заказчика
// «ИЖ_СППЗ_периодичность_проверок_и_ТО_2026.docx» по огнетушителям ссылается на
// СП 9.13130.2009. Числа в нём те же, но документ уже недействующий — ссылаться
// нужно на ГОСТ Р 59641-2021.
const LOKALNY_OSMOTR_OGNETUSHITEL: ActivityRule = {
  activityCode: 'lokalny-kvartalny-osmotr',
  title: 'Ежеквартальный осмотр по локальному регламенту',
  periodicityMonths: 3,
  checklist: [
    { text: 'Огнетушитель находится на установленном месте, хорошо виден и доступен', severity: 'значительный' },
    { text: 'Огнетушитель и его крепление не препятствуют эвакуации', severity: 'критический' },
    { text: 'Корпус без видимых повреждений и следов коррозии', severity: 'критический' },
    { text: 'Маркировка и инструкция читаемы', severity: 'незначительный' },
    { text: 'Пломба и предохранительное устройство не нарушены', severity: 'значительный' },
    { text: 'Шланг, насадок или раструб исправны', severity: 'критический' },
    { text: 'Индикатор давления находится в допустимом секторе', severity: 'критический', measurementCode: 'pressure-sector' },
    { text: 'Сроки проверки, перезарядки, испытания и службы не истекли', severity: 'критический' },
  ],
  ndReference: 'Локальный нормативный акт организации — применяется, если мероприятие назначено владельцем объекта',
  needsVerification: false,
  optIn: true,
};

const EZHEGODNAYA_PROVERKA_OGNETUSHITEL: ActivityRule = {
  activityCode: 'ezhegodnaya-proverka',
  title: 'Ежегодная проверка',
  periodicityMonths: 12,
  checklist: [
    { text: 'Корпус, покрытие, узлы управления и крепления не имеют повреждений', severity: 'критический' },
    { text: 'Инструкция, маркировка, пломба и предохранительное устройство исправны', severity: 'значительный' },
    { text: 'Манометр/индикатор исправен, давление соответствует паспорту', severity: 'критический', measurementCode: 'pressure-mpa' },
    { text: 'Фактическая масса соответствует паспортным значениям', severity: 'критический', measurementCode: 'full-mass-kg' },
    { text: 'Шланг, насадок/раструб и запорно-пусковое устройство исправны', severity: 'критический' },
    { text: 'Кронштейн, шкаф, подставка или ходовая часть исправны', severity: 'значительный' },
    { text: 'Утечка ОТВ или вытесняющего газа не превышает допустимую', severity: 'критический', measurementCode: 'leak-percent' },
  ],
  ndReference: 'ГОСТ Р 59641-2021, пп. 5.1.1, 5.1.7 и 6.2 — ежегодная проверка технического состояния и утечки',
  needsVerification: false,
};

const POLUGODOVAYA_PROVERKA_OGNETUSHITEL: ActivityRule = {
  activityCode: 'polugodovaya-proverka',
  title: 'Полугодовая проверка при неблагоприятных условиях',
  // Норматив называет срок прямо — «не реже 1 раза в 6 месяцев». Раньше здесь
  // стоял null, и работа висела без срока, хотя число в самом пункте есть.
  periodicityMonths: 6,
  checklist: EZHEGODNAYA_PROVERKA_OGNETUSHITEL.checklist,
  ndReference: 'ГОСТ Р 59641-2021, п. 5.1.7 — категория А или постоянное воздействие неблагоприятных факторов: не реже 1 раза в 6 месяцев',
  needsVerification: false,
  optIn: true,
};

const PYATILETNEE_OSVIDETELSTVOVANIE: ActivityRule = {
  activityCode: 'pyatiletnee-osvidetelstvovanie',
  title: 'Пятилетнее освидетельствование',
  periodicityMonths: 60,
  checklist: [
    { text: 'Огнетушитель разряжен, ОТВ собрано, корпус очищен', severity: 'значительный' },
    { text: 'Проведены наружный и внутренний осмотры корпуса', severity: 'критический' },
    { text: 'Коррозия, вмятины, вздутия и повреждения внутреннего покрытия отсутствуют', severity: 'критический' },
    { text: 'Уплотнения, ЗПУ, фильтры, приборы давления и источник газа исправны', severity: 'критический' },
    { text: 'Корпус, шланг и запорные устройства выдержали испытание', severity: 'критический', measurementCode: 'test-pressure-mpa' },
    { text: 'Оформлен протокол испытания, отметка в паспорте и сервисная этикетка', severity: 'значительный' },
  ],
  ndReference: 'ГОСТ Р 59641-2021, пп. 5.1.9 и 5.1.11.2 — раз в 5 лет осмотр и испытание на прочность/герметичность',
  needsVerification: false,
  baselineKind: 'изготовление',
};

const PROVERKA_OTV_VODA: ActivityRule = {
  activityCode: 'proverka-otv-voda',
  title: 'Проверка параметров водного/пенного ОТВ',
  periodicityMonths: 12,
  checklist: ['Масса и уровень заряда в норме', 'Пломба и бирка не повреждены'],
  ndReference: 'ГОСТ Р 59641-2021, таблица 1 п. 5.1.11.1 — проверка параметров и перезарядка не реже 1 раза в год, кроме паспортных исключений',
  needsVerification: false,
  // Прежнее имя работы — см. проверку порошка. Пенные огнетушители в старых
  // записях помечались проверкой порошка: работа была общая, а имя у неё —
  // от самого частого заряда.
  historyCodes: ['proverka-otv-voda', 'proverka-otv', 'proverka-poroshka'],
};
const PEREZARYADKA_VODA: ActivityRule = {
  activityCode: 'perezaryadka',
  title: 'Перезарядка',
  periodicityMonths: 12,
  checklist: ['Заряд заменён', 'Пломба и бирка о перезарядке установлены'],
  ndReference: 'ГОСТ Р 59641-2021, таблица 1 п. 5.1.11.1 — 1 раз в год, если изготовитель не установил исключение',
  needsVerification: false,
  baselineKind: 'изготовление',
};
const PROVERKA_OTV_POROSHOK: ActivityRule = {
  activityCode: 'proverka-poroshka',
  title: 'Выборочная проверка порошка',
  periodicityMonths: 12,
  checklist: ['Выборочная проверка массы и текучести порошка', 'Пломба и бирка не повреждены'],
  ndReference: 'ГОСТ Р 59641-2021, п. 5.1.7 — ежегодно, при 5 и более порошковых огнетушителях выборка не менее 3%',
  needsVerification: false,
  // Прежнее имя работы: до разделения по виду заряда проверка ОТВ была одна.
  // Без этой строки записанные тогда проверки не нашлись бы, и срок считался
  // бы от постановки на учёт — «норма» там, где на деле просрочка.
  historyCodes: ['proverka-poroshka', 'proverka-otv'],
};
const PEREZARYADKA_POROSHOK: ActivityRule = {
  activityCode: 'perezaryadka',
  title: 'Перезарядка',
  periodicityMonths: 60,
  checklist: ['Заряд заменён', 'Пломба и бирка о перезарядке установлены'],
  ndReference: 'ГОСТ Р 59641-2021, таблица 1 п. 5.1.11.1 — не реже 1 раза в 5 лет',
  needsVerification: false,
  baselineKind: 'изготовление',
};
const PROVERKA_OTV_CO2: ActivityRule = {
  activityCode: 'vzveshivanie',
  title: 'Проверка ОТВ взвешиванием',
  periodicityMonths: 12,
  checklist: ['Масса баллона соответствует паспорту'],
  ndReference: 'ГОСТ Р 59641-2021, пп. 5.1.7 и 6.2 — ежегодный контроль утечки взвешиванием',
  needsVerification: false,
  baselineKind: 'изготовление',
  // Прежнее имя работы — см. проверку порошка.
  historyCodes: ['vzveshivanie', 'proverka-otv'],
};
const PEREZARYADKA_CO2: ActivityRule = {
  activityCode: 'perezaryadka',
  title: 'Перезарядка',
  periodicityMonths: 60,
  checklist: ['Заряд заменён', 'Пломба и бирка о перезарядке установлены'],
  ndReference: 'ГОСТ Р 59641-2021, таблица 1 п. 5.1.11.1 — не реже 1 раза в 5 лет',
  needsVerification: false,
  baselineKind: 'изготовление',
};
const GIDROISPYTANIE_CO2: ActivityRule = {
  activityCode: 'gidroispytanie',
  title: 'Гидравлическое испытание корпуса',
  periodicityMonths: 60,
  checklist: ['Корпус выдержал испытательное давление', 'Оформлен протокол испытаний'],
  ndReference: 'ГОСТ Р 59641-2021, пп. 5.1.9 и 5.1.11.2 — не реже 1 раза в 5 лет',
  needsVerification: false,
  baselineKind: 'изготовление',
};

// Воздушно-эмульсионные огнетушители BONTEL. Это не обычный водный/пенный
// срок: официальный паспорт изготовителя прямо назначает перезарядку и
// переосвидетельствование баллона один раз в 10 лет.
const KONTROL_BONTEL: ActivityRule = {
  activityCode: 'vizualny-kontrol',
  title: 'Визуальный контроль давления',
  // Ежемесячно по решению заказчика от 23.08.2026. Паспорт срока не называет —
  // «контролировать в эксплуатации», — но работы без срока в программе не
  // бывает: без даты индикатор молчит, и пропуск замечать нечем.
  periodicityMonths: 1,
  checklist: ['Показание индикатора давления соответствует рабочему диапазону, указанному на огнетушителе'],
  ndReference: 'Руководство по эксплуатации (паспорт) огнетушителя ОВЭ BONTEL: в эксплуатации достаточно визуально контролировать давление по индикатору',
  needsVerification: true,
};
const PEREZARYADKA_BONTEL: ActivityRule = {
  activityCode: 'perezaryadka',
  title: 'Перезарядка и переосвидетельствование баллона',
  periodicityMonths: 120,
  checklist: [
    'Огнетушащий состав BONTEL заменён',
    'Баллон прошёл переосвидетельствование',
    'Дата следующей перезарядки указана на маркировке',
  ],
  ndReference: 'Руководство по эксплуатации (паспорт) огнетушителя ОВЭ BONTEL: перезарядка и переосвидетельствование баллона — 1 раз в 10 лет',
  needsVerification: true,
  baselineKind: 'изготовление',
};

// Наружное ППВ — гидранты, водоёмы, резервуары.
/**
 * Проверка на водоотдачу — работа водопроводной сети, а не запаса воды.
 *
 * Меряют давление и расход на гидранте и сверяют с проектом. У водоёма и
 * резервуара мерить нечего: там нет ни сети, ни напора — есть объём воды и
 * подъезд к нему, и проверяются они отдельной работой (`PROVERKA_VODOISTOCHNIKA`).
 * Раньше водоотдача стояла и у них, и в чек-листе водоёма появлялись пункты про
 * давление, которого там не бывает.
 */
const VODOOTDACHA_NARUZHNOE: ActivityRule = {
  activityCode: 'vodootdacha',
  title: 'Проверка на водоотдачу',
  periodicityMonths: 6,
  checklist: ['Давление и расход измерены и записаны', 'Результат сопоставлен с проектными данными'],
  ndReference: 'ППР РФ №1479, п. 48 — не реже 2 раз в год, весной и осенью, обязательно',
  needsVerification: true,
};


/**
 * Проверка пожарного водоисточника (ТЗ, Дополнение 6).
 *
 * Отдельно от проверки на водоотдачу: та измеряет напор и расход, а эта
 * отвечает на другой вопрос — доедет ли расчёт и наберёт ли воду вообще.
 * Исправный водоём с полным запасом бесполезен, если к нему не подъехать
 * или указателя не видно.
 *
 * Состав пунктов задан заказчиком; периодичность — раз в полгода, весной и
 * осенью, вместе с проверкой водоотдачи: сезонные условия и есть то, из-за
 * чего к источнику перестают подъезжать.
 */
const PROVERKA_VODOISTOCHNIKA: ActivityRule = {
  activityCode: 'proverka-vodoistochnika',
  title: 'Проверка водоисточника',
  periodicityMonths: 6,
  needsAct: true,
  checklist: [
    { text: 'Пожарный водоём / резервуар находится в исправном состоянии', severity: 'критический' },
    { text: 'Обеспечен требуемый пожарный запас воды', severity: 'критический' },
    { text: 'Обеспечена возможность забора воды пожарными автомобилями или мотопомпами', severity: 'критический' },
    { text: 'Устройство для отбора воды исправно и доступно', severity: 'критический' },
    { text: 'Приёмный колодец исправен и доступен — при его наличии', severity: 'значительный' },
    { text: 'Обеспечен свободный подъезд пожарной техники к месту забора воды', severity: 'критический' },
    { text: 'Площадка / пирс для установки пожарной техники позволяет осуществлять забор воды — если предусмотрены', severity: 'значительный' },
    { text: 'Указатель направления к источнику противопожарного водоснабжения имеется', severity: 'значительный' },
    { text: 'Указатель видим и читаем', severity: 'значительный' },
    { text: 'Расстояние до водоисточника указано и соответствует фактическому расположению', severity: 'значительный' },
    { text: 'Обеспечена возможность использования водоисточника для целей пожаротушения', severity: 'критический' },
    { text: 'Сезонные условия не препятствуют подъезду и забору воды', severity: 'критический' },
  ],
  ndReference: 'ППР РФ №1479, п. 48 — проверка источников наружного противопожарного водоснабжения не реже 2 раз в год, весной и осенью, обязательно',
  needsVerification: true,
};

// Наружные пожарные лестницы и ограждения кровли — одна норма на двоих.
// Два разных мероприятия: ежегодное обследование целостности и испытания
// раз в пять лет. Их легко спутать и оставить только второе — тогда объект
// девять лет из десяти выглядел бы «в норме» без единой проверки.
const OBSLEDOVANIE_LESTNITSA: ActivityRule = {
  activityCode: 'obsledovanie',
  title: 'Обследование целостности конструкции',
  periodicityMonths: 12,
  checklist: [
    'Целостность конструкции без нарушений, коррозии и деформаций',
    'Крепления к стене надёжны',
    'Составлен акт по результатам проверки',
  ],
  ndReference: 'ГОСТ Р 53254-2009, п. 6.1.4 — не менее одного раза в год',
  needsVerification: true,
};
const ISPYTANIE_LESTNITSA: ActivityRule = {
  activityCode: 'ispytanie',
  title: 'Эксплуатационные испытания',
  periodicityMonths: 60,
  checklist: ['Испытание нагрузкой по методике', 'Оформлен протокол испытаний'],
  ndReference: 'ППР РФ №1479, п. 17, подп. «б»; ГОСТ Р 53254-2009, п. 6.1.4 — не реже 1 раза в 5 лет',
  needsVerification: true,
  needsAct: true,
};


/**
 * Ограждение кровли: свои работы, а не лестничные (ТЗ, Дополнение 6).
 *
 * Норма и сроки те же, что у лестницы, — ГОСТ Р 53254-2009 покрывает и то,
 * и другое, — а проверяют разное: у лестницы ступени и крепление к стене, у
 * ограждения высоту, стойки и крепление к парапету. Раньше у ограждения стоял
 * чек-лист лестницы, и человек читал в нём про ступени, которых нет.
 */
const OBSLEDOVANIE_OGRAZHDENIYA: ActivityRule = {
  activityCode: 'obsledovanie',
  title: 'Обследование целостности ограждения',
  periodicityMonths: 12,
  checklist: [
    'Стойки и элементы ограждения целы, без коррозии и деформаций',
    'Крепление к парапету или кровле надёжно',
    'Высота ограждения соответствует высоте здания',
    'Составлен акт по результатам проверки',
  ],
  ndReference: 'ГОСТ Р 53254-2009, п. 6.1.4 — не менее одного раза в год',
  needsVerification: true,
};
const ISPYTANIE_OGRAZHDENIYA: ActivityRule = {
  activityCode: 'ispytanie',
  title: 'Эксплуатационные испытания ограждения',
  periodicityMonths: 60,
  checklist: ['Испытание ограждения нагрузкой по методике', 'Оформлен протокол испытаний'],
  ndReference: 'ППР РФ №1479, п. 17, подп. «б»; ГОСТ Р 53254-2009, п. 6.1.4 — не реже 1 раза в 5 лет',
  needsVerification: true,
  needsAct: true,
};

/**
 * Пожарный щит: проверяется его укомплектованность (ТЗ, Дополнение 6).
 *
 * Щит без багра и вёдер числится, но не работает, и проверять у него больше
 * нечего: конструкция простая, а весь смысл — в инвентаре на месте и в
 * рабочем состоянии.
 *
 * Периодичность назначена организацией: Правила требуют содержать щиты в
 * исправном состоянии, но числа не называют. Ежеквартально — обычная практика;
 * организация меняет срок в конструкторе.
 */
const PROVERKA_SHCHITA: ActivityRule = {
  activityCode: 'komplektnost-shchita',
  title: 'Проверка комплектности щита',
  periodicityMonths: 3,
  checklist: [
    { text: 'Инвентарь на щите в наличии по норме его типа', severity: 'критический' },
    { text: 'Инвентарь исправен и пригоден к применению', severity: 'критический' },
    { text: 'Ящик с песком заполнен, песок сухой и сыпучий', severity: 'значительный' },
    { text: 'Ёмкость с водой заполнена; зимой приняты меры от замерзания', severity: 'значительный' },
    { text: 'Щит окрашен, обозначен и доступен для подхода', severity: 'значительный' },
  ],
  ndReference: 'ППР РФ №1479, раздел XIX и приложение 6 — содержание щитов и нормы комплектации; периодичность назначает организация',
  needsVerification: true,
  periodicityByOrganization: true,
};

/**
 * Насосная станция: работоспособность насосов и приборов.
 *
 * Насос, который не запускали, считается неработающим: подшипники прикипают,
 * а обнаруживается это при пожаре. Поэтому пуск проверяют ежемесячно, а
 * измерительные приборы — раз в год, вместе с прочими КИП установки.
 */
const RABOTOSPOSOBNOST_NASOSOV: ActivityRule = {
  activityCode: 'rabotosposobnost-nasosov',
  title: 'Проверка работоспособности насосов',
  periodicityMonths: 1,
  checklist: [
    { text: 'Основной насос запускается и выходит на режим', severity: 'критический' },
    { text: 'Резервный насос запускается и принимает нагрузку', severity: 'критический' },
    { text: 'Автоматический пуск от прибора работает', severity: 'критический' },
    { text: 'Задвижки и обратные клапаны исправны, подтеканий нет', severity: 'значительный' },
    { text: 'Резервное электропитание переключается', severity: 'критический' },
  ],
  ndReference: 'ГОСТ Р 59636-2021 — техническое обслуживание установок пожаротушения; конкретная периодичность проверки насосов назначается регламентом организации',
  needsVerification: true,
  periodicityByOrganization: true,
};


/**
 * Огнезащитная обработка: проверка состояния покрытия (ТЗ, Дополнение 6).
 *
 * ППР РФ №1479, п. 13: состояние огнезащитного покрытия проверяют в сроки,
 * установленные изготовителем средства огнезащиты, а если изготовитель срока
 * не назвал — **не реже одного раза в год**, с составлением акта (протокола).
 * Год и стоит сроком по умолчанию: это тот случай, когда норматив число даёт.
 *
 * Организация меняет срок в конструкторе, если документация изготовителя
 * называет свой, — на это прямо указывает тот же пункт Правил.
 */
const PROVERKA_OGNEZASHCHITY: ActivityRule = {
  activityCode: 'proverka-ognezashchity',
  title: 'Проверка состояния огнезащитного покрытия',
  periodicityMonths: 12,
  needsAct: true,
  checklist: [
    { text: 'Покрытие сплошное, без отслоений, вздутий и трещин', severity: 'критический' },
    { text: 'Повреждений и участков без огнезащиты не выявлено', severity: 'критический' },
    { text: 'Толщина покрытия соответствует проектной (для покрытий и обмазок)', severity: 'критический' },
    { text: 'Пропитка сохранила огнезащитные свойства по результатам испытания образцов', severity: 'критический' },
    { text: 'Срок действия обработки по документации изготовителя не истёк', severity: 'критический' },
    { text: 'Оформлен акт (протокол) проверки состояния огнезащитной обработки', severity: 'значительный' },
  ],
  ndReference: 'ППР РФ №1479, п. 13 — в сроки изготовителя, а при их отсутствии не реже 1 раза в год с составлением акта; ГОСТ Р 53295-2009 и ГОСТ Р 53292-2009 — методы контроля',
  needsVerification: true,
};

/**
 * Возобновление огнезащитной обработки.
 *
 * Работа условная: она нужна не по календарю, а когда истёк срок действия
 * состава или проверка выявила повреждения. Поэтому по умолчанию выключена —
 * включает её организация, когда такой случай наступил.
 */
const VOZOBNOVLENIE_OGNEZASHCHITY: ActivityRule = {
  activityCode: 'vozobnovlenie-ognezashchity',
  title: 'Возобновление огнезащитной обработки',
  periodicityMonths: 60,
  optIn: true,
  needsAct: true,
  checklist: [
    { text: 'Повреждённые и утратившие свойства участки обработаны заново', severity: 'критический' },
    { text: 'Применён состав с действующим сертификатом соответствия', severity: 'критический' },
    { text: 'Оформлен акт выполненных работ по огнезащите', severity: 'значительный' },
  ],
  ndReference: 'ППР РФ №1479, п. 13 — устранение повреждений огнезащитных покрытий; срок зависит от документации изготовителя и назначается организацией',
  needsVerification: true,
  periodicityByOrganization: true,
};

// Противодымная вентиляция: клапаны, вентиляторы, шкафы управления.
const TO_PDZ_MESYAC: ActivityRule = {
  activityCode: 'to-mesyachnoe',
  title: 'Ежемесячное техническое обслуживание',
  periodicityMonths: 1,
  checklist: [
    'Внешний осмотр и проверка технического состояния в месте установки',
    'Проверка поступления управляющих сигналов на исполнительные устройства',
    'Проверка работоспособности в ручном, местном и автоматическом режимах',
    'Проверка автоматического переключения на резервное электропитание',
  ],
  ndReference: 'ГОСТ Р 54101-2010, п. 6.1; ППР РФ №1479, п. 42 — ежемесячно',
  needsVerification: true,
};
const TO_PDZ_GOD: ActivityRule = {
  activityCode: 'to-godovoe',
  title: 'Проверка продолжительности действия',
  periodicityMonths: 12,
  checklist: [
    'Продолжительность работы при отключении основного электропитания соответствует норме',
    'При несоответствии заменены аккумуляторные батареи и проведена повторная проверка',
  ],
  ndReference: 'ГОСТ Р 54101-2010, п. 6.2 — ежегодное техническое обслуживание',
  needsVerification: true,
};

// Заполнение проёмов в противопожарных преградах: двери, люки, шторы.
const TO_DVER: ActivityRule = {
  activityCode: 'to-kvartal',
  title: 'Эксплуатационно-техническое обслуживание',
  periodicityMonths: 3,
  checklist: [
    'Визуальный контроль полотна и коробки на механические дефекты и коррозию',
    'Проверка работы замка и устройства «антипаника»',
    'Проверка петель пятикратным открыванием-закрыванием',
    'Проверка устройства самозакрывания и последовательности закрывания полотен',
    'Зазоры между полотном и коробкой соответствуют документации изготовителя',
    'Уплотнения без повреждений, прилегают плотно',
  ],
  ndReference: 'ГОСТ Р 59642-2021, п. 4.1.6.3 — не реже одного раза в квартал',
  needsVerification: true,
};

// Средства индивидуальной защиты: самоспасатели, СИЗОД.
const PROVERKA_SIZ: ActivityRule = {
  activityCode: 'proverka',
  title: 'Проверка средств индивидуальной защиты',
  periodicityMonths: 12,
  checklist: [
    'Механических повреждений нет, целостность не нарушена',
    'Срок годности не истёк',
  ],
  ndReference: 'ППР РФ №1479, п. 30 — 1 раз в год',
  needsVerification: true,
};

/** Пакет правил: тип оборудования → применимые мероприятия. */
export const RULE_PACKAGE: Readonly<Record<string, readonly ActivityRule[]>> = {
  'smoke-detector': [OSMOTR_IZVESHCHATEL, KONTROL_IZVESHCHATEL],
  'heat-detector': [OSMOTR_IZVESHCHATEL, KONTROL_IZVESHCHATEL],
  'flame-detector': [OSMOTR_IZVESHCHATEL, KONTROL_IZVESHCHATEL],
  'manual-call-point': [OSMOTR_IZVESHCHATEL, KONTROL_IZVESHCHATEL],
  'control-panel': [OSMOTR_PPKP, KONTROL_PPKP, KOMPLEKS_PPKP],
  sounder: [OBSLUZHIVANIE_OPOVESHCHATEL, RABOTOSPOSOBNOST_SOUE],
  // Виды оповещателей обслуживают по одному регламенту: различается не срок, а
  // что именно смотрят при проверке, и это записано в чек-листе работ.
  'sounder-audible': [OBSLUZHIVANIE_OPOVESHCHATEL, RABOTOSPOSOBNOST_SOUE],
  'sounder-speech': [OBSLUZHIVANIE_OPOVESHCHATEL, RABOTOSPOSOBNOST_SOUE],
  'sounder-light': [OBSLUZHIVANIE_OPOVESHCHATEL, RABOTOSPOSOBNOST_SOUE],
  'sounder-combined': [OBSLUZHIVANIE_OPOVESHCHATEL, RABOTOSPOSOBNOST_SOUE],
  'powder-module': [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  // Газовый модуль обслуживают по тому же ГОСТ Р 59636, что и порошковый:
  // раньше правил у него не было вовсе, и он показывался необслуживаемым.
  'gas-module': [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  // Виды установок пожаротушения: базовый регламент один на все — проверка
  // работоспособности и метрологическая проверка КИП по ГОСТ Р 59636-2021.
  // Что различается между водяной и газовой, задаётся проектом и паспортом
  // изделия, и придумывать за них периодичность здесь нельзя.
  'aup-sprinkler': [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  'aup-drencher': [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  'aup-sprinkler-drencher': [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  'aup-mist': [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  'aup-foam': [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  'aup-gas': [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  'aup-powder': [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  'aup-aerosol': [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  'aup-combined': [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  'aup-robotic': [RABOTOSPOSOBNOST_AUP, KIP_AUP],
  // Автономная установка: базовый набор. Работы, зависящие от вида заряда,
  // подставляются в `activitiesForObject` по полю `suppressionKind` карточки —
  // как у огнетушителя состав зависит от ОТВ.
  // У общего вида работ нет намеренно: пока не выбрано, чем установка тушит,
  // назначать нечего — у порошкового модуля осматривают мембрану, у газового
  // взвешивают заряд, у водяного ищут подтекания.
  'autonomous-suppression': [],
  ...SUPPRESSION_RULES,
  'fire-hydrant-indoor': [OSMOTR_PK, ISPYTANIE_PK, PEREKATKA_RUKAVA],
  hydrant: [VODOOTDACHA_NARUZHNOE],
  'water-reservoir': [PROVERKA_VODOISTOCHNIKA],
  'water-tank': [PROVERKA_VODOISTOCHNIKA],
  'water-pond': [PROVERKA_VODOISTOCHNIKA],
  'water-natural': [PROVERKA_VODOISTOCHNIKA],
  'outdoor-ladder': [OBSLEDOVANIE_LESTNITSA, ISPYTANIE_LESTNITSA],
  'roof-fence': [OBSLEDOVANIE_OGRAZHDENIYA, ISPYTANIE_OGRAZHDENIYA],
  'pump-station': [RABOTOSPOSOBNOST_NASOSOV, KIP_AUP],
  fireproofing: [PROVERKA_OGNEZASHCHITY, VOZOBNOVLENIE_OGNEZASHCHITY],
  'outdoor-cabinet': [PROVERKA_SHCHITA],
  'fire-board-a': [PROVERKA_SHCHITA],
  'fire-board-v': [PROVERKA_SHCHITA],
  'fire-board-e': [PROVERKA_SHCHITA],
  'fire-board-sh': [PROVERKA_SHCHITA],
  'fire-board-mobile': [PROVERKA_SHCHITA],
  'outdoor-cabinet-box': [PROVERKA_SHCHITA],
  'extinguisher-water': [LOKALNY_OSMOTR_OGNETUSHITEL, EZHEGODNAYA_PROVERKA_OGNETUSHITEL, POLUGODOVAYA_PROVERKA_OGNETUSHITEL, PROVERKA_OTV_VODA, PEREZARYADKA_VODA, PYATILETNEE_OSVIDETELSTVOVANIE],
  'extinguisher-foam': [LOKALNY_OSMOTR_OGNETUSHITEL, EZHEGODNAYA_PROVERKA_OGNETUSHITEL, POLUGODOVAYA_PROVERKA_OGNETUSHITEL, PROVERKA_OTV_VODA, PEREZARYADKA_VODA, PYATILETNEE_OSVIDETELSTVOVANIE],
  'extinguisher-emulsion': [LOKALNY_OSMOTR_OGNETUSHITEL, EZHEGODNAYA_PROVERKA_OGNETUSHITEL, POLUGODOVAYA_PROVERKA_OGNETUSHITEL, PROVERKA_OTV_VODA, PEREZARYADKA_VODA, PYATILETNEE_OSVIDETELSTVOVANIE],
  'extinguisher-powder': [LOKALNY_OSMOTR_OGNETUSHITEL, EZHEGODNAYA_PROVERKA_OGNETUSHITEL, POLUGODOVAYA_PROVERKA_OGNETUSHITEL, PROVERKA_OTV_POROSHOK, PEREZARYADKA_POROSHOK, PYATILETNEE_OSVIDETELSTVOVANIE],
  'extinguisher-co2': [LOKALNY_OSMOTR_OGNETUSHITEL, EZHEGODNAYA_PROVERKA_OGNETUSHITEL, POLUGODOVAYA_PROVERKA_OGNETUSHITEL, PROVERKA_OTV_CO2, PEREZARYADKA_CO2, GIDROISPYTANIE_CO2],
  'extinguisher-halon': [LOKALNY_OSMOTR_OGNETUSHITEL, EZHEGODNAYA_PROVERKA_OGNETUSHITEL, POLUGODOVAYA_PROVERKA_OGNETUSHITEL, PROVERKA_OTV_CO2, PEREZARYADKA_CO2, PYATILETNEE_OSVIDETELSTVOVANIE],
  // BONTEL: пятилетнего освидетельствования здесь нет намеренно. Паспорт
  // изделия назначает перезарядку и переосвидетельствование баллона раз в
  // 10 лет одной работой, и типовой пятилетний срок ГОСТ к нему не
  // применяется. Держать оба значило бы требовать вскрывать огнетушитель
  // вдвое чаще, чем предписал изготовитель.
  'extinguisher-bantl': [LOKALNY_OSMOTR_OGNETUSHITEL, EZHEGODNAYA_PROVERKA_OGNETUSHITEL, POLUGODOVAYA_PROVERKA_OGNETUSHITEL, KONTROL_BONTEL, PEREZARYADKA_BONTEL],
  'smoke-valve': [TO_PDZ_MESYAC, TO_PDZ_GOD],
  'damper-fire': [TO_PDZ_MESYAC, TO_PDZ_GOD],
  'damper-smoke': [TO_PDZ_MESYAC, TO_PDZ_GOD],
  'damper-dual': [TO_PDZ_MESYAC, TO_PDZ_GOD],
  'damper-pressure': [TO_PDZ_MESYAC, TO_PDZ_GOD],
  'smoke-fan': [TO_PDZ_MESYAC, TO_PDZ_GOD],
  'fan-exhaust': [TO_PDZ_MESYAC, TO_PDZ_GOD],
  'fan-supply': [TO_PDZ_MESYAC, TO_PDZ_GOD],
  'fire-door': [TO_DVER],
  'self-rescuer': [PROVERKA_SIZ],
  'self-rescuer-filter': [PROVERKA_SIZ],
  'self-rescuer-isolating': [PROVERKA_SIZ],

  // У генерического «Огнетушителя» типовых сроков ГОСТ нет намеренно:
  // периодичность перезарядки зависит от заряженного ОТВ (ГОСТ Р 59641-2021,
  // таблица 1: вода/пена — 1 год, порошок, CO₂ и хладон — 5 лет), и подставить
  // одно число для всех означало бы соврать для большинства. Нужен конкретный
  // подтип — extinguisher-water / -powder / -co2.
  //
  // Обязательное требование ППР РФ №1479, п. 60 к нему при этом относится и
  // подставляется в `activitiesFor`: вести учёт наличия, осмотров и сроков
  // перезарядки обязана организация независимо от того, каким ОТВ заряжен
  // огнетушитель. Ежегодная проверка технического состояния — тоже: она не
  // зависит от вида заряда.
  extinguisher: [EZHEGODNAYA_PROVERKA_OGNETUSHITEL, LOKALNY_OSMOTR_OGNETUSHITEL],
  'fire-detector': [],
  'combined-detector': [OSMOTR_IZVESHCHATEL, KONTROL_IZVESHCHATEL],
  'gas-detector': [OSMOTR_IZVESHCHATEL, KONTROL_IZVESHCHATEL],
  'aspiration-detector': [OSMOTR_IZVESHCHATEL, KONTROL_IZVESHCHATEL],
  'fire-suppression-system': [],
};

/**
 * Мероприятия, применимые к типу оборудования.
 *
 * Сначала — обязательные требования нормативных правовых актов, потом типовые
 * регламенты ГОСТ и СП. Порядок не косметический: он же становится порядком
 * работ в конструкторе и в чек-листе, и обязательное должно быть видно первым.
 *
 * Пустой список — правил для этого типа ещё не заведено вовсе. Это честный
 * ответ, а не молчаливая тишина.
 */
export function activitiesFor(typeCode: string): readonly ActivityRule[] {
  const npa = npaRequirementsFor(typeCode);
  const gost = RULE_PACKAGE[typeCode] ?? [];
  if (npa.length === 0) return gost;

  // Требование НПА не дублируется, если типовой регламент уже несёт этот код.
  const known = new Set(gost.map((rule) => rule.activityCode));
  return [...npa.filter((rule) => !known.has(rule.activityCode)), ...gost];
}

export function activityRule(typeCode: string, activityCode: string): ActivityRule | null {
  return activitiesFor(typeCode).find((rule) => rule.activityCode === activityCode) ?? null;
}


/** Работы, действующие без отдельного решения организации. */
export function alwaysApplicable(typeCode: string): readonly ActivityRule[] {
  return activitiesFor(typeCode).filter((rule) => rule.optIn !== true);
}

/**
 * Правила, применимые к объекту.
 *
 * Раньше здесь учитывался выбор из карточки огнетушителя — механизм, живший до
 * конструктора регламентов и делавший то же самое в обход общего порядка. Он
 * убран: состав работ задаёт регламент организации (Дополнение 5), а библиотека
 * отвечает только на вопрос «что вообще применимо к этому виду оборудования».
 */
export function activitiesForObject(object: import('@izh/contracts').PlanObject): readonly ActivityRule[] {
  // Вид оборудования — единственное, что определяет состав работ. У модульной
  // установки вид огнетушащего вещества выражен подвидом каталога, как у
  // огнетушителя — зарядом: и там, и там второго механизма нет.
  return alwaysApplicable(object.typeCode);
}
