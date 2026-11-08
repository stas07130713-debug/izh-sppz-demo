/**
 * Вкладка «Журнал»: единица отображения — конкретное оборудование, одной
 * строкой; применимые мероприятия — колонками (Дополнение 1, часть Д6).
 *
 * Область видимости зависит от узла (часть 3.1 ТЗ): журнал здания включает
 * этажи и склады, журнал этажа — только его содержимое. Внутри — под-вкладки
 * по типу оборудования, сгруппированные по трём цветным блокам (ТЗ, Дополнение
 * 2, часть П4.1: снаружи здания / внутри здания / системы пожарной автоматики) —
 * у всех строк одной таблицы один и тот же набор колонок: смешивать
 * огнетушители и извещатели в одной таблице бессмысленно, у них разные
 * мероприятия.
 *
 * У каждого мероприятия — две колонки, «Последняя» и «Следующая» (по образцу
 * «Вид ИЖ СППЗ»): дата последнего выполнения и плановая дата следующего.
 * Отдельная колонка «Состояние» слева показывает статус всей строки — худший
 * из статусов её мероприятий, тот же расчёт, что красит значок на плане.
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type {
  JournalExportFormat, JournalExportRequest, MaintenanceEvent, NodeKind, PlanObject, Room, TreeNode,
} from '@izh/contracts';
import {
  activityCellsForObject,
  journalSearchText,
  matchesSearch,
  systemKindOf,
  systemKindTitle,
  responsibleFor,
  elementByCode,
  journalScope,
  nodeTitle,
  objectCondition,
  pathToNode,
  placementCondition,
  type ActivityRule,
} from '@izh/core';
import { formatDateRu } from '../format';
import { signatureCell } from './journal-signature';
import { useWheelZoom } from '../use-wheel-zoom';
import { useAnchoredMenu } from '../menu-placement';
import { todayIso } from '../today';
import { GROUP_ORDER, GROUP_TITLES, byCatalogOrder, systemGroupOf, type SystemGroup } from './journal-groups';
import { JournalCellPair, dedupeRules, periodicityLabel } from './journal-summaries';
import { cardColumnsFor, journalName } from './journal-columns';
import type { PickMode } from './plan-selection';
import { conditionFilterTags, matchesFilterTags, type FilterTag, type JournalIntent } from './status-filter';
import { StatusFilterBar } from './StatusFilterBar';
import { buildJournalExportRequest } from './journal-export';
import {
  JOURNAL_NAME, JOURNAL_NOTE, JOURNAL_NUMBER, JOURNAL_PLACE, JOURNAL_RESPONSIBLE,
  JOURNAL_SIGNATURE, JOURNAL_STATE, cardColumnKey, hiddenJournalColumns,
} from './journal-column-choice';
import { ElementIcon } from './ElementIcon';
import { useScheduleSource } from '../schedule-source-context';
import { presentCondition } from './condition-presentation';

/** Куда выгружается журнал (ТЗ, Дополнение 2, часть П4.3). */
/**
 * Что открыто: один вид, целый раздел или весь журнал.
 *
 * Раздел и «весь журнал» показываются одинаково — списком разделов, — но это
 * разные состояния: из раздела человек возвращается к своим вкладкам, а из
 * всего журнала видит сразу всё.
 */
/**
 * Подпись кнопки «показать всё» для каждого вида узла.
 *
 * Кнопка одна и та же — она снимает деление по видам систем, — но названа по
 * тому, что откроется. «Весь журнал» на этаже было бы обещанием, которого
 * список не выполняет: этаж не весь журнал здания. Обходя же этаж, смотрят
 * подряд и огнетушители, и краны, и извещатели, и переключать разделы при этом
 * незачем.
 *
 * У здания подпись осталась «Весь журнал»: это тот уровень, на котором журнал
 * и ведётся одной книгой, и предъявляется целиком.
 */
const WHOLE_LABELS: Readonly<Record<NodeKind, {
  readonly first: string;
  readonly second: string;
  readonly scopeTitle: string;
  readonly hint: string;
}>> = {
  organization: {
    first: 'Вся', second: 'организация', scopeTitle: 'Вся организация',
    hint: 'Все системы предприятия одним списком, по всем цехам и зданиям',
  },
  shop: {
    first: 'Весь', second: 'цех', scopeTitle: 'Весь цех',
    hint: 'Все системы цеха одним списком, по всем его зданиям',
  },
  building: {
    first: 'Весь', second: 'журнал', scopeTitle: 'Весь журнал',
    hint: 'Все виды оборудования здания одним списком',
  },
  level: {
    first: 'Весь', second: 'этаж', scopeTitle: 'Весь этаж',
    hint: 'Все системы этажа одним списком — и внутри здания, и пожарная автоматика',
  },
  storage: {
    first: 'Весь', second: 'склад', scopeTitle: 'Весь склад',
    hint: 'Всё оборудование склада одним списком: запасное, снятое, на перезарядке',
  },
};

/**
 * Форматы выгрузки в порядке употребимости.
 *
 * Печать стоит рядом с файлами намеренно: для человека это тот же вопрос
 * «куда вывести журнал», и разносить её по разным кнопкам незачем.
 */
const EXPORT_FORMATS: readonly (readonly [JournalExportFormat, string])[] = [
  ['excel', 'Excel (.xlsx)'],
  ['word', 'Word (.docx)'],
  ['pdf', 'PDF'],
  ['print', 'Печать'],
];

type JournalSelection =
  | { readonly kind: 'вид'; readonly typeCode: string | null }
  | { readonly kind: 'раздел'; readonly group: SystemGroup }
  | { readonly kind: 'весь' };

export interface JournalPanelProps {
  readonly nodes: readonly TreeNode[];
  readonly node: TreeNode;
  readonly allObjects: readonly PlanObject[];
  readonly allRooms: readonly Room[];
  readonly events: readonly MaintenanceEvent[];
  readonly busy: boolean;
  readonly soonThresholdDays: number;
  /**
   * Скрытые виды — общий отбор систем для плана, журнала и дашборда.
   *
   * Снятая справа галочка убирает вид отовсюду. Раньше журнал её не слушал:
   * человек снимал галочку и видел, что «ничего не работает», — работало, но
   * не там, где он смотрел.
   */
  /**
   * Общий с планом набор выделенного.
   *
   * Выделять приходится и здесь: половина оборудования на план ещё не
   * поставлена, а перенести его на другой этаж нужно уже сейчас. Набор один
   * на журнал и план — человек считает объекты, а не экраны.
   */
  readonly selectedIds: ReadonlySet<string>;
  readonly onSelectMany: (objectIds: readonly string[], mode: PickMode) => void;
  readonly hiddenTypes: ReadonlySet<string>;
  readonly onShowAllTypes: () => void;
  readonly onOpenActivity: (object: PlanObject, activityCode: string) => void;
  readonly canSign: boolean;
  readonly onOpenSignature: (event: MaintenanceEvent) => void;
  readonly onShowOnPlan: (object: PlanObject) => void;
  readonly onObjectContextMenu: (object: PlanObject, screenPosition: { x: number; y: number }) => void;
  readonly onOpenObjectCard: (object: PlanObject) => void;
  readonly onImportJournal: () => void;
  readonly onExport: (request: JournalExportRequest) => void;
  /**
   * Убранные графы по видам оборудования — настройка «состав таблицы».
   *
   * Действует и на экран, и на выгрузку: убранная графа не должна остаться в
   * распечатанном журнале, иначе настройка обманывает.
   */
  readonly journalColumns: Readonly<Record<string, readonly string[]>>;
  /** Фильтр с дашборда, который нужно применить один раз при открытии (часть К4). */
  readonly initialFilter: JournalIntent | null;
  readonly onFilterApplied: () => void;
  /** Строка, на которую пришли с конкретного значка плана. */
  readonly focusObjectId: string | null;
  readonly onFocusApplied: () => void;
}

/**
 * Строки от прошлой отмеченной до нынешней включительно.
 *
 * Если прошлой нет или она из другой таблицы — отмечается только нынешняя:
 * полоса «неизвестно откуда докуда» отметила бы не то, что человек видел.
 */
function rangeTo(
  rows: readonly PlanObject[],
  fromId: string | null,
  toId: string,
): readonly string[] {
  const from = rows.findIndex((row) => row.id === fromId);
  const to = rows.findIndex((row) => row.id === toId);
  if (from < 0 || to < 0) return [toId];

  const [start, end] = from <= to ? [from, to] : [to, from];
  return rows.slice(start, end + 1).map((row) => row.id);
}

export function JournalPanel(props: JournalPanelProps): React.JSX.Element {
  // Регламент организации, а где его нет — нормативная библиотека (Дополнение 5, Р19).
  const scheduleSource = useScheduleSource();
  const wholeScope = useMemo(
    () => journalScope(props.nodes, props.allObjects, props.node.id),
    [props.nodes, props.allObjects, props.node.id],
  );

  /** Область журнала за вычетом скрытых видов — тот же отбор, что на плане. */
  const scope = useMemo(
    () => wholeScope.filter((object) => !props.hiddenTypes.has(object.typeCode)),
    [wholeScope, props.hiddenTypes],
  );

  /** Сколько элементов спрятано отбором: без этого пустой журнал необъясним. */
  const hiddenCount = wholeScope.length - scope.length;

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const object of scope) counts.set(object.typeCode, (counts.get(object.typeCode) ?? 0) + 1);
    return counts;
  }, [scope]);

  /**
   * Виды в журнале идут каталожным порядком, а не порядком появления
   * объектов. Иначе рядом оказывались порошковый огнетушитель, СИЗОД и
   * только потом углекислотный: схожее врозь, журнал читается как
   * перемешанная стопка.
   */
  const types = useMemo(() => [...typeCounts.keys()].sort(byCatalogOrder), [typeCounts]);

  /**
   * Что сейчас открыто в журнале.
   *
   * Вид — одна таблица, как и было. Раздел — все виды этого раздела подряд,
   * каждый со своим заголовком: нажав «Внутри здания», человек видит именно
   * внутреннее оборудование, а не один его вид. «Весь журнал» — то же самое по
   * всем разделам сразу; он нужен реже и вынесен отдельной кнопкой.
   */
  const [selection, setSelection] = useState<JournalSelection>({ kind: 'вид', typeCode: null });
  const activeType = selection.kind === 'вид'
    ? (selection.typeCode !== null && types.includes(selection.typeCode) ? selection.typeCode : (types[0] ?? null))
    : null;
  const activeGroup = selection.kind === 'раздел' ? selection.group : null;
  const setSelectedType = (typeCode: string): void => setSelection({ kind: 'вид', typeCode });

  /**
   * Фильтры журнала (ТЗ, Дополнение 3, часть К3): состояние — чекбоксы в
   * нижней панели, множественный выбор; помещение и текстовый поиск остаются
   * как есть — заказчик их не касался.
   */
  /**
   * Масштаб таблицы.
   *
   * У журнала с несколькими проверками колонок больше десятка, и на ноутбуке
   * таблица не помещается целиком. Уменьшение — единственный способ увидеть
   * её всю сразу; горизонтальная прокрутка этого не даёт, потому что состояние
   * строки и её сроки оказываются на разных экранах.
   *
   * Через `zoom`, а не `transform: scale`: `zoom` пересчитывает раскладку, и
   * таблица честно занимает меньше места. `scale` только рисует мельче, оставляя
   * прежнюю ширину и полосу прокрутки.
   */
  const [scale, setScale] = useState(100);
  /**
   * Приближение колесом — на Ctrl.
   *
   * Обычное колесо в журнале листает строки, и отнимать его нельзя: до
   * нижних записей иначе не добраться. Прокрутку ведёт страница целиком,
   * поэтому точку под курсором здесь не держим.
   *
   * Колесо слушает весь журнал, а не таблицу: таблица то одна, то несколько
   * подряд, и слушатель на ней терялся бы при переключении раздела.
   */
  const bodyRef = useRef<HTMLDivElement>(null);
  useWheelZoom(bodyRef, scale, setScale, { min: 60, max: 150, step: 10, plain: false, anchor: false });
  const [formatsOpen, setFormatsOpen] = useState(false);
  /**
   * Список форматов держится своей кнопки и не уходит за край окна.
   *
   * Раньше он раскрывался вниз всегда. Панель с кнопкой стоит над таблицей,
   * но при низком окне и длинном списке нижние форматы оказывались за краем:
   * пункт есть, а нажать нельзя.
   */
  const formatsRef = useRef<HTMLDivElement>(null);
  const formatsButtonRef = useRef<HTMLButtonElement>(null);
  const formatsStyle = useAnchoredMenu(formatsRef, formatsButtonRef, formatsOpen);

  const [statusTags, setStatusTags] = useState<ReadonlySet<FilterTag>>(new Set());
  const [search, setSearch] = useState('');
  /** Последняя отмеченная строка — от неё Shift отмеряет полосу. */
  const [lastPicked, setLastPicked] = useState<string | null>(null);

  const toggleStatusTag = (tag: FilterTag): void => {
    setStatusTags((current) => {
      const next = new Set(current);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  /**
   * Фильтр, пришедший с дашборда (часть К4), применяется один раз и сразу
   * забывается — иначе повторное открытие журнала руками ловило бы старый
   * фильтр, оставшийся от прошлого перехода.
   */
  useEffect(() => {
    if (props.initialFilter === null) return;
    if (props.initialFilter.typeCode !== null) {
      setSelectedType(props.initialFilter.typeCode);
    } else {
      /*
       * Пришли с дашборда за состоянием, а не за видом: «в норме — 6» должно
       * показать эти шесть, где бы они ни стояли. Раньше отбор ложился на
       * открытый раздел, и если шесть исправных были внутри здания, а открыт
       * был раздел «снаружи», журнал отвечал «записей нет» — цифра с дашборда
       * выглядела враньём.
       */
      setSelection({ kind: 'весь' });
    }
    if (props.initialFilter.statusTags.size > 0) setStatusTags(props.initialFilter.statusTags);
    props.onFilterApplied();
  }, [props.initialFilter]);
  useEffect(() => {
    if (props.focusObjectId === null) return;
    const row = document.querySelector<HTMLTableRowElement>(`[data-journal-object-id="${props.focusObjectId}"]`);
    // При переходе с плана журнал может ещё дочитывать строки. Не считаем
    // показ выполненным, пока нужная строка действительно не появилась.
    if (row === null) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = window.setTimeout(props.onFocusApplied, 3400);
    return () => window.clearTimeout(timer);
  }, [props.focusObjectId, scope.length, selection]);

  /** Вкладки, разложенные по трём цветным блокам (П4.1). */
  const grouped = useMemo(() => {
    const map = new Map<SystemGroup, string[]>();
    for (const typeCode of types) {
      const group = systemGroupOf(typeCode);
      map.set(group, [...(map.get(group) ?? []), typeCode]);
    }
    return map;
  }, [types]);

  const today = todayIso();

  /*
   * Строки, по которым считается нижняя строка состояния.
   *
   * Заказчик: «строка состояния внизу журнала должна отображать статусы в
   * рамках открытых вкладок: если открыт весь журнал — значит по всему
   * журналу, если только отдельная группа элементов — то только по ним.
   * Сейчас всё одинаково отображает».
   *
   * Так и было: отбор шёл только по выбранному виду, а раздел — «снаружи
   * здания», «внутри здания», «автоматика» — не учитывался вовсе, и открыв
   * раздел, человек видел числа по всему уровню.
   */
  const allRows = scope
    .filter((object) => activeType === null || object.typeCode === activeType)
    .filter((object) => activeGroup === null || systemGroupOf(object.typeCode) === activeGroup);

  /**
   * Сколько строк этого вида оборудования попадает под каждую метку — подписи
   * в нижней панели.
   *
   * Стоит до пустых экранов намеренно. React считает хуки по порядку вызова, и
   * хук после `return` вызывается не всегда: пустой журнал рисовался без него,
   * а заполненный — с ним, и на переходе между этими состояниями экран падал
   * с ошибкой о разном числе хуков. Ранний возврат обязан стоять после всех
   * хуков, а не между ними.
   */
  const statusCounts = useMemo(() => {
    const counts = new Map<FilterTag, number>();
    for (const object of allRows) {
      for (const tag of conditionFilterTags(objectCondition(object, props.events, today, props.soonThresholdDays, scheduleSource))) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return counts;
  }, [allRows, props.events, today, props.soonThresholdDays, scheduleSource]);

  if (scope.length === 0 && hiddenCount > 0) {
    return (
      <div className="empty">
        <h2>Все системы скрыты отбором</h2>
        <p>
          В «{props.node.name}» есть {hiddenCount} элементов, но все их виды сняты галочками в правом
          поле. Этот отбор общий: он действует и на плане, и в журнале, и на дашборде.
        </p>
        <div className="actions">
          <button type="button" className="primary" onClick={props.onShowAllTypes}>
            Показать все системы
          </button>
        </div>
      </div>
    );
  }

  if (scope.length === 0) {
    return (
      <div className="empty">
        <h2>Журнал пуст</h2>
        <p>
          В этой области пока нет ни одного объекта. Оборудование заводится перетаскиванием элемента на план
          или переносом существующего журнала.
        </p>
        <div className="actions">
          <button type="button" onClick={props.onImportJournal}>
            Перенести существующий журнал
          </button>
        </div>
      </div>
    );
  }

  const whole = WHOLE_LABELS[props.node.kind];


  // Колонки журнала — это работы действующего регламента, а не библиотеки:
  // включённое в конструкторе должно совпасть с тем, что видно в таблице.
  // Собираются по всем объектам вида: у элементов одного вида в разных цехах
  // регламент может отличаться, и колонка нужна для каждой встреченной работы.
  const rulesFor = (typeCode: string): readonly ActivityRule[] => dedupeRules(
    scope.filter((object) => object.typeCode === typeCode)
      .flatMap((object) => scheduleSource.rulesFor(object, today)),
  );
  /**
   * К какой системе относится элемент — по номеру прибора.
   *
   * Прочерк у оборудования, которое в систему не входит: у огнетушителя,
   * гидранта, автономной установки. Пустое место здесь честнее слова «нет»:
   * системы у них не должно быть, а не «пока не назначена».
   */
  const placeOf = (object: PlanObject): string => {
    if (object.roomId !== null) {
      const room = props.allRooms.find((item) => item.id === object.roomId);
      if (room !== undefined) return room.number === null ? room.name : `${room.name} (№ ${room.number})`;
    }
    const node = props.nodes.find((item) => item.id === object.nodeId);
    return node === undefined ? '—' : nodeTitle(node);
  };



  const rows = allRows.filter((object) => {
    const tags = conditionFilterTags(objectCondition(object, props.events, today, props.soonThresholdDays, scheduleSource));
    if (!matchesFilterTags(tags, statusTags)) return false;
    /*
     * Поиск идёт по тому, что человек видит в строке.
     *
     * Раньше искали по учётному номеру, марке и месту — а наименование вида,
     * стоящее в первой графе, в поиск не входило вовсе. Оттого «извещатель
     * пожарный» ничего не находил: это название вида, а не марка.
     */
    if (!matchesSearch(journalSearchText({
      name: journalName(object),
      kind: systemKindTitle(systemKindOf(object.typeCode)),
      regNumber: object.regNumber,
      model: object.model,
      place: placeOf(object),
      responsible: responsibleFor(props.nodes, object),
      technicalState: object.technicalState,
      note: object.note,
    }), search)) return false;
    return true;
  });

  const resetFilters = (): void => {
    setStatusTags(new Set());
    setSearch('');
  };

  const filtersActive = statusTags.size > 0 || search.trim() !== '';

  /**
   * Таблица одного вида оборудования.
   *
   * Отдельной функцией, потому что видов на экране бывает много: в общем
   * списке каждый идёт своим разделом, а графы у них разные.
   */
  const renderTable = (typeCode: string, tableRows: readonly PlanObject[]): React.JSX.Element => {
    const hidden = hiddenJournalColumns(typeCode, { journalColumns: props.journalColumns });
    const shown = (key: string): boolean => !hidden.has(key);
    const columns = cardColumnsFor(typeCode).filter((column) => shown(cardColumnKey(column.title)));
    const rules = rulesFor(typeCode);

    // Вид без заведённых правил показывается тем же списком, только без граф
    // мероприятий: строки должны быть видны и до того, как настроен регламент.
    return (
      <div className="journal-table-wrap">
        <table className="journal-table">
          <thead>
            {/*
              * Порядок граф одинаков во всех журналах: сначала «что это и где» —
              * номер по порядку, наименование, учётный номер, место, состояние и
              * сведения карточки; потом проверки, у каждого вида свои; и в конце
              * ответственный с примечанием.
              *
              * Наименование и учётный номер разведены: раньше в одной графе
              * стоял номер, а марка мелко под ним, и наименования в журнале
              * фактически не было.
              */}
            <tr>
              <th rowSpan={2}>№</th>
              {shown(JOURNAL_NAME) && <th rowSpan={2}>Наименование</th>}
              {shown(JOURNAL_NUMBER) && <th rowSpan={2}>Учётный номер</th>}
              {shown(JOURNAL_PLACE) && <th rowSpan={2}>Место установки</th>}
              {shown(JOURNAL_STATE) && <th rowSpan={2}>Состояние</th>}
              {rules.map((rule) => (
                <th key={rule.activityCode} colSpan={2} title={rule.ndReference}>
                  {rule.title}
                  <div className="muted small journal-th-period">{periodicityLabel(rule)}</div>
                </th>
              ))}
              {/* Графы карточки бывают длинными — «данные карточки
                  огнетушителя» уходили строкой на пол-экрана. Им задана
                  своя, ограниченная ширина с переносом по словам. */}
              {columns.map((column) => (
                <th key={column.title} rowSpan={2} className="journal-card-col">{column.title}</th>
              ))}
              {shown(JOURNAL_RESPONSIBLE) && <th rowSpan={2}>Ответственный</th>}
              {/*
                * Графа простой электронной подписи.
                *
                * Заказчик: «в журнале в графе регистрируется ПЭП». Показывается
                * подпись последней записи по элементу: журнал построчно — про
                * оборудование, и подпись в строке отвечает на вопрос «кто
                * подтвердил последнюю проверку».
                */}
              {shown(JOURNAL_SIGNATURE) && <th rowSpan={2}>ПЭП</th>}
              {shown(JOURNAL_NOTE) && <th rowSpan={2}>Примечание</th>}
            </tr>
            <tr>
              {rules.map((rule) => (
                <Fragment key={rule.activityCode}>
                  <th className="journal-subhead">Последняя</th>
                  <th className="journal-subhead">Следующая</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((object, index) => {
              const cells = activityCellsForObject(object, props.events, today, props.soonThresholdDays, scheduleSource);
              /*
               * Состояние строки — то же, что красит значок на плане и полосу
               * карточки: и сроки, и исправность вместе.
               *
               * Раньше здесь стояла одна исправность, и огнетушитель с
               * просроченной на год перезарядкой значился «исправен» — зелёным.
               * На плане он при этом горел красным. Человек верил журналу:
               * журнал он предъявляет проверяющему.
               */
              const condition = placementCondition(object, props.allObjects, props.events, today, props.soonThresholdDays, scheduleSource);
              const presentedCondition = presentCondition(condition);
              return (
                <tr
                  key={object.id}
                  data-journal-object-id={object.id}
                  className={[
                    'journal-row',
                    object.id === props.focusObjectId ? 'journal-focus-row' : '',
                    props.selectedIds.has(object.id) ? 'journal-row-picked' : '',
                  ].join(' ').trim()}
                  title="Открыть карточку объекта"
                  onContextMenu={(event) => { event.preventDefault(); props.onObjectContextMenu(object, { x: event.clientX, y: event.clientY }); }}
                  onClick={(event) => {
                    /*
                     * Ctrl набирает по одной строке, Shift — всё от прошлой
                     * отмеченной до этой: подряд идущие строки отмечают чаще,
                     * чем разрозненные, и щёлкать по каждой из двадцати — не
                     * работа. Обычный щелчок открывает карточку и снимает набор:
                     * человек ушёл к одному объекту, набор ему больше не нужен.
                     */
                    if (event.ctrlKey || event.metaKey) {
                      props.onSelectMany([object.id], 'toggle');
                      setLastPicked(object.id);
                      return;
                    }
                    if (event.shiftKey) {
                      props.onSelectMany(rangeTo(tableRows, lastPicked, object.id), 'add');
                      setLastPicked(object.id);
                      return;
                    }
                    props.onOpenObjectCard(object);
                  }}
                >
                  <td className="muted small">{index + 1}</td>
                  {/* Чем строка называет предмет, решает `journalName`: у
                      огнетушителя это вид, у прочего — марка. */}
                  {shown(JOURNAL_NAME) && <td>{journalName(object)}</td>}
                  {shown(JOURNAL_NUMBER) && (
                    <td className="journal-reg-number">{object.regNumber ?? '(без номера)'}</td>
                  )}
                  {shown(JOURNAL_PLACE) && <td className="muted small">{placeOf(object)}</td>}
                  {shown(JOURNAL_STATE) && (
                    <td>
                      <span className={`status-pill status-${presentedCondition.color}`}>
                        <span className="status-dot" />
                        {presentedCondition.label}
                      </span>
                    </td>
                  )}
                  {rules.map((rule) => {
                    const cell = cells.find((item) => item.rule.activityCode === rule.activityCode);
                    return cell === undefined
                      ? <Fragment key={rule.activityCode}><td className="journal-cell muted small">—</td><td className="journal-cell muted small">не применяется</td></Fragment>
                      : <JournalCellPair key={rule.activityCode} cell={cell} onOpen={() => props.onOpenActivity(object, rule.activityCode)} />;
                  })}
                  {columns.map((column) => (
                    <td key={column.title} className="muted small journal-card-col">
                      {column.value(object, props.events)}
                    </td>
                  ))}
                  {shown(JOURNAL_RESPONSIBLE) && (
                    <td className="muted small">{responsibleFor(props.nodes, object) ?? 'не назначен'}</td>
                  )}
                  {shown(JOURNAL_SIGNATURE) && (
                    <td className="muted small journal-sign-col">
                      {signatureCell(props.events, object, props.onOpenSignature, props.canSign)}
                    </td>
                  )}
                  {shown(JOURNAL_NOTE) && <td className="muted small">{object.note ?? ''}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  /**
   * Разделы общего списка: вид оборудования и его строки.
   *
   * Порядок тот же, что у вкладок сверху: снаружи здания, внутри, автоматика.
   * Иначе глаз ищет раздел не там, где только что видел вкладку.
   */
  const sections = GROUP_ORDER
    .filter((group) => activeGroup === null || group === activeGroup)
    .flatMap((group) => grouped.get(group) ?? [])
    .map((typeCode) => ({ typeCode, items: rows.filter((object) => object.typeCode === typeCode) }))
    .filter((section) => section.items.length > 0);

  /**
   * Раздел журнала: подпись вида и его таблица.
   *
   * Одной функцией на оба случая — и когда открыт один вид, и когда показан
   * весь раздел. Иначе таблица одного вида оставалась бы без подписи, и по
   * распечатанному листу было бы не понять, чей это журнал.
   */
  const renderSection = (typeCode: string, items: readonly PlanObject[]): React.JSX.Element => (
    <section key={typeCode} className="journal-section">
      <h3 className="journal-section-title">
        <ElementIcon typeCode={typeCode} />
        <span>{elementByCode(typeCode)?.title ?? typeCode}</span>
        <span className="muted small">{items.length}</span>
      </h3>
      {/* Вид без регламента: строки видны, а граф проверок нет. Без этой
          строки «нет данных» у каждого элемента читается как недосмотр
          пользователя, хотя проверок для этого вида просто не заведено. */}
      {rulesFor(typeCode).length === 0 && (
        <p className="muted small">
          Для этого вида работы по обслуживанию не заведены — ни в нормативной библиотеке, ни в
          регламенте организации. Задать их можно в настройках, вкладка «Журнал».
        </p>
      )}
      {renderTable(typeCode, items)}
    </section>
  );

  /**
   * Выгрузка того, что показано.
   *
   * Разделами — так же, как на экране: у каждого вида свои проверки и свои
   * графы карточки. Когда открыт один вид, раздел ровно один, и файл выглядит
   * прежней таблицей.
   */
  const exportJournal = (format: JournalExportFormat): void => {
    const scopeTitle = activeType !== null
      ? (elementByCode(activeType)?.title ?? activeType)
      : activeGroup !== null ? GROUP_TITLES[activeGroup] : whole.scopeTitle;

    /** Состояние строки словами — то же, что показывает метка на экране. */
    const stateOf = (object: PlanObject): string => {
      const condition = placementCondition(object, props.allObjects, props.events, today, props.soonThresholdDays, scheduleSource);
      return presentCondition(condition).label;
    };

    const exportSection = (typeCode: string, items: readonly PlanObject[]) => {
      const hidden = hiddenJournalColumns(typeCode, { journalColumns: props.journalColumns });
      const columns = cardColumnsFor(typeCode).filter((column) => !hidden.has(cardColumnKey(column.title)));
      return {
        // Убранные графы уходят и из выгрузки: распечатанный журнал должен
        // совпадать с тем, что человек видит на экране.
        hiddenColumns: [...hidden],
        equipmentTitle: elementByCode(typeCode)?.title ?? typeCode,
        // Вид нужен оглавлению: по нему раздел попадает в свою часть —
        // снаружи здания, внутри здания или автоматика.
        typeCode,
        cardTitles: columns.map((column) => column.title),
        rows: items.map((object, index) => {
          const cells = activityCellsForObject(object, props.events, today, props.soonThresholdDays, scheduleSource);
          return {
            number: index + 1,
            name: journalName(object),
            registrationNumber: object.regNumber ?? '',
            place: placeOf(object),
            // В выгрузке та же графа, что на экране: и сроки, и исправность.
            // Иначе распечатанный журнал говорил бы «исправен» о том, что на
            // экране красное.
            state: stateOf(object),
            activities: cells.map((cell) => ({
              title: cell.rule.title,
              lastDate: cell.schedule.lastDate === null ? '—' : formatDateRu(cell.schedule.lastDate),
              nextDate: cell.schedule.nextDate === null ? '—' : formatDateRu(cell.schedule.nextDate),
              status: cell.schedule.status,
            })),
            card: columns.map((column) => column.value(object, props.events)),
            responsible: responsibleFor(props.nodes, object) ?? 'не назначен',
            note: object.note ?? '',
          };
        }),
      };
    };

    const exportSections = activeType !== null
      ? [exportSection(activeType, rows)]
      : sections.map(({ typeCode, items }) => exportSection(typeCode, items));

    props.onExport(
      buildJournalExportRequest(format, {
        title: `Журнал СППЗ — ${nodeTitle(props.node)}`,
        scopeTitle,
        // Путь по дереву целиком: по нему на обложке видно, о каком объекте
        // журнал, без обращения к самой программе.
        objectTitle: props.node === null
          ? 'Объект не выбран'
          : pathToNode(props.nodes, props.node.id).map((node) => node.name).join(' · '),
        sections: exportSections,
      }),
    );
  };

  return (
    <div
      ref={bodyRef}
      className="journal"
      /*
       * Щелчок без Ctrl и Shift снимает набор — где бы он ни случился, кроме
       * самих строк с этими клавишами. Так набор не переживает переход к
       * другому делу: человек ткнул мимо, значит, отказался от начатого.
       */
      onClick={(event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (props.selectedIds.size > 0) props.onSelectMany([], 'replace');
      }}
    >
      <div className="journal-groups">
        {/* Стоит рядом с разделами, а не среди кнопок выгрузки: это такой же
            выбор «что показать», как и они. */}
        <button
          type="button"
          className={selection.kind === 'весь' ? 'journal-whole active' : 'journal-whole'}
          title={whole.hint}
          onClick={() => {
            setSelection({ kind: 'весь' });
            resetFilters();
            props.onShowAllTypes();
          }}
        >
          {whole.first}<br />{whole.second}
        </button>
        {GROUP_ORDER.filter((group) => (grouped.get(group) ?? []).length > 0).map((group) => (
          <div
            key={group}
            className={`journal-group group-${group}${activeGroup === group ? ' active' : ''}`}
            onClick={(event) => {
              /* Кнопки видов сохраняют собственное действие. Щелчок по любой
                 свободной площади карточки выбирает раздел целиком. */
              if ((event.target as HTMLElement).closest('button') !== null) return;
              setSelection({ kind: 'раздел', group });
              resetFilters();
            }}
          >
            {/* Название раздела — тоже вкладка: нажав «Внутри здания», человек
                видит всё внутреннее оборудование, а не один его вид. */}
            <button
              type="button"
              className={activeGroup === group ? 'journal-group-title active' : 'journal-group-title'}
              title={`Весь раздел «${GROUP_TITLES[group]}» одним списком`}
              onClick={() => { setSelection({ kind: 'раздел', group }); resetFilters(); }}
            >
              {GROUP_TITLES[group]}
            </button>
            <div className="journal-group-tabs">
              {(grouped.get(group) ?? []).map((typeCode) => {
                const element = elementByCode(typeCode);
                return (
                  <button
                    key={typeCode}
                    type="button"
                    className={typeCode === activeType ? 'group-tab active' : 'group-tab'}
                    title={element?.title ?? typeCode}
                    onClick={() => {
                      setSelectedType(typeCode);
                      resetFilters();
                    }}
                  >
                    <ElementIcon typeCode={typeCode} />
                    <span className="muted small">{typeCounts.get(typeCode)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="journal-toolbar">

        <input
          className="journal-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск: наименование, номер, марка, место…"
        />

        {filtersActive && (
          <button type="button" className="link" onClick={resetFilters}>
            ✕ сбросить
          </button>
        )}

        <span className="muted small">
          Показано: {rows.length} из {allRows.length}
        </span>

        {/* Скрытое отбором названо числом и снимается отсюда же: иначе журнал
            молча короче, чем оборудование на объекте. */}
        {hiddenCount > 0 && (
          <button type="button" className="link" onClick={props.onShowAllTypes}>
            Скрыто отбором: {hiddenCount} — показать все
          </button>
        )}

        {/* Масштаб таблицы: увидеть журнал целиком, не листая вбок. */}
        <div className="journal-scale" title="Масштаб таблицы журнала. Колесо с Ctrl — то же самое; без Ctrl колесо листает строки">
          <button
            type="button" aria-label="Мельче" disabled={scale <= 60}
            onClick={() => setScale((value) => Math.max(60, value - 10))}
          >−</button>
          <button
            type="button" className="journal-scale-value" title="Вернуть обычный размер"
            onClick={() => setScale(100)}
          >{scale}%</button>
          <button
            type="button" aria-label="Крупнее" disabled={scale >= 150}
            onClick={() => setScale((value) => Math.min(150, value + 10))}
          >+</button>
        </div>

        <div className="journal-export">
          {/*
            * Одна кнопка выгрузки со списком форматов вместо четырёх кнопок.
            * Выгружается то, что показано: выбранный вид, раздел или весь
            * журнал вместе с наложенными фильтрами — человек видит на экране
            * ровно тот список, который получит файлом.
            */}
          <div className="journal-menu">
            <button
              ref={formatsButtonRef}
              type="button" className="primary" aria-expanded={formatsOpen}
              onClick={() => setFormatsOpen((open) => !open)}
            >
              ↓ Выгрузить журнал ▾
            </button>
            {formatsOpen && (
              <>
                <div className="journal-menu-catch" onClick={() => setFormatsOpen(false)} />
                <div className="journal-menu-list" ref={formatsRef} style={formatsStyle}>
                  {EXPORT_FORMATS.map(([format, title]) => (
                    <button
                      key={format} type="button"
                      onClick={() => { setFormatsOpen(false); exportJournal(format); }}
                    >
                      {title}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button type="button" className="success" onClick={props.onImportJournal}>
            ↑ Загрузить журнал
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <h2>Записей нет</h2>
          <p>Здесь появятся строки журнала, когда на объекте будет заведено оборудование.</p>
        </div>
      ) : activeType !== null ? (
        <div className="journal-body" style={{ zoom: `${scale}%` }}>{renderSection(activeType, rows)}</div>
      ) : (
        /*
         * Раздел целиком: виды идут сверху вниз, каждый со своим заголовком и
         * своей таблицей.
         *
         * Одной таблицей их не свести: графы карточек у видов разные, и общая
         * шапка была бы наполовину пустой в каждой строке.
         */
        <div className="journal-sections journal-body" style={{ zoom: `${scale}%` }}>
          {sections.map(({ typeCode, items }) => renderSection(typeCode, items))}
        </div>
      )}

      {/* Нижняя панель фильтра состояния (ТЗ, Дополнение 3, часть К3): та же
          строка чекбоксов, что и на плане, — заказчик просит единообразие. */}
      <StatusFilterBar selected={statusTags} onToggle={toggleStatusTag} counts={statusCounts} />
    </div>
  );
}
