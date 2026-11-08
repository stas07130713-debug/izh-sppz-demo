/**
 * Главный экран: четыре поля одного рабочего пространства (ТЗ, Дополнение 2).
 *
 * Сверху шапка с переключателем режимов, слева структура объекта и сведения о
 * ней, в центре рабочая область — план, журнал или дашборд, справа добавление
 * элементов или карточка выбранного.
 *
 * Режим и выбранный узел — две независимые оси: пользователь ходит по дереву,
 * оставаясь в том режиме, в котором работает. Исключение одно: у цеха своего
 * плана нет, и при переходе на него режим переключается на дашборд.
 *
 * Здесь только связывание частей: состояние дерева живёт в useObjectTree, все
 * проверки — в сценариях ядра.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  JournalExportFormat, JournalExportRequest, MaintenanceEvent, PixelPoint, PlanObject,
  TreeNodeId,
} from '@izh/contracts';
import {
  propagateSystemDefaults,
  placementOf,
  dashboardSummary,
  elementTitle,
  incompleteCards,
  missingCardFields,
  needsPlacement,
  storageNodeIds,
  isSystemHead,
  archiveObject,
  extinguisherMark,
  markWithCharge,
  pathToNode,
  distributeAlongOutline,
  moveObject,
  placeObject,
  planCaption,
  setPlacementCount,
  setSystemComposition,
  type SystemCompositionItem,
  relocateObject,
  ruleFor,
  setObjectsPinned,
  setStorageSection,
  swapObjects,
  setRoomOutline,
  updateObject,
  signedEventsOfObject, signatureWithdrawalWarning, withoutSignature,
  can,
} from '@izh/core';
import { maintenanceDeps, objectDeps, roomDeps, treeDeps } from '../deps';
import { todayIso } from '../today';
import { formatDateRu, pluralRu } from '../format';
import { useObjectTree } from '../use-object-tree';
import { useAllPlanObjects } from '../use-all-plan-objects';
import { useAllRooms } from '../use-all-rooms';
import { useAppSettings } from '../use-app-settings';
import { useRegulations } from '../use-regulations';
import { regulationScheduleSource } from '../regulation-source';
import { ScheduleSourceProvider } from '../schedule-source-context';
import { useCommandHistory } from '../use-command-history';
import { useTreeActions } from '../use-tree-actions';
import { newExtinguisherProfile, useObjectBatch } from '../use-object-batch';
import type { SessionState } from '../use-session';
import { useMaintenanceEvents } from '../use-maintenance-events';
import { useNodePlan } from '../use-node-plan';
import { usePlanObjects } from '../use-plan-objects';
import { useRooms } from '../use-rooms';
import { useStoredImageUrl } from '../use-backdrop-workspace';
import { AppHeader, type ViewMode } from './AppHeader';
import { BatchCreateModal, type BatchCommonFields } from './BatchCreateModal';
import { CenterArea, type PickedFile } from './CenterArea';
import { JournalImportWizard } from './JournalImportWizard';
import { MoveObjectsModal } from './MoveObjectsModal';
import { ObjectContextMenu } from './ObjectContextMenu';
import { ObjectHistoryModal } from './ObjectHistoryModal';
import { ReplaceObjectModal } from './ReplaceObjectModal';
import { DashboardSystems } from './DashboardSystems';
import { RightPanel } from './RightPanel';
import { describeUnknown } from '@izh/contracts';
import type { FilterTag, JournalIntent } from './status-filter';
import type { NotificationItem } from './NotificationsMenu';
import { TreePanel } from './TreePanel';
import { NodeSheet } from './NodeSheet';
import { ChecklistScreen } from './ChecklistScreen';
import { useBackdropScales } from '../use-backdrop-scales';
import { calibrateByTwoPoints } from '@izh/core';
import { deps as backdropDeps } from '../deps';
import { coverageLayer } from './plan-coverage';
import type { UpcomingItem } from '@izh/core';
import { usePlacementCheck } from '../use-placement-check';
import type { SelectionScope } from './plan-selection';
import { buildPlacementDocument, type MarkTally } from './placement-report-export';
import { renderPlacementScheme } from './placement-scheme';
import { PlacementScreens } from './PlacementScreens';
import { SettingsScreens, type SettingsRequest } from './SettingsScreens';
import { confirmObjectArchive } from './archive-confirmation';
import { messageTone } from '../message-tone';
import { MaintenanceSignatureModal } from './MaintenanceSignatureModal';
import { SignPasswordModal } from './SignPasswordModal';
import { useSigning } from '../use-signing';

/** Что подписывается при заведении партии — теми же словами в обоих способах. */
function batchReason(count: number): string {
  return `заведение партии: ${count} ${pluralRu(count, 'единица', 'единицы', 'единиц')} оборудования`;
}

/** Очередь расстановки по щелчку: что ставим и что у всех объектов общего. */
interface BatchQueue {
  readonly typeCode: string;
  readonly common: BatchCommonFields;
  readonly regNumbers: readonly string[];
}

export interface MainScreenProps {
  /** Выбор файла подложки через диалог. Подложка привязывается к указанному узлу. */
  /** Кто работает: имя в шапке, права и список пользователей в настройках. */
  readonly session: SessionState;
  readonly onOpenAccount: () => void;
  /**
   * Куда открыться при появлении экрана. Пусто — как обычно, с начала.
   *
   * Нужен возврату с подготовки подложки: «Всё готово» должно приводить на
   * план того узла, чей чертёж правили.
   */
  readonly openAt?: { readonly nodeId: string; readonly mode: ViewMode } | null;
  /**
   * Куда просят перейти из истории действий личного кабинета.
   *
   * Кабинет копий записей не держит: он ведёт к первоисточнику — в журнал того
   * узла, где элемент числится, с подсветкой его строки и раскрытой карточкой,
   * где и лежит его история эксплуатации.
   *
   * Элемента может не быть: правки здания, этажа и помещения относятся к узлу
   * дерева — тогда открывается он.
   */
  readonly focusTarget?: { readonly objectId: string | null; readonly nodeId: string | null } | null;
  readonly onFocusApplied?: () => void;
  readonly onPickBackdrop: (nodeId: string) => void;
  /** Открыть подготовку подложки узла: там задаётся масштаб. */
  /** Открыть подготовку подложки узла: поворот, обрезка, стирание лишнего. */
  readonly onEditBackdrop: (nodeId: string) => void;
  /** Файл подложки, брошенный в рабочую область выбранного узла. */
  readonly onDropBackdrop: (file: PickedFile, nodeId: string) => void;
}


/** Сколько держать полосу уведомления: отказ — дольше сообщения об успехе. */
const MESSAGE_OK_MS = 4000;
const MESSAGE_ERROR_MS = 12000;

export function MainScreen(props: MainScreenProps): React.JSX.Element {
  const { nodes, busy, message, setMessage, reload: reloadTree, run } = useObjectTree(props.session.user);
  /*
   * С какого узла открыться.
   *
   * Главный экран пересобирается при возврате с подготовки подложки, и
   * выбранный узел терялся: человек нажимал «Всё готово», а попадал не на
   * тот план, который только что правил, — и решал, что подложка не
   * загрузилась. Теперь тот, кто нас вернул, называет узел.
   */
  const [selectedId, setSelectedId] = useState<TreeNodeId | null>(props.openAt?.nodeId ?? null);
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);

  const [dashboardSystemsCollapsed, setDashboardSystemsCollapsed] = useState(false);
  /**
   * Просьба открыть настройки — и вся память о них, что осталась здесь.
   *
   * Какое из окон настроек открыто, идёт ли запись и что вышло у выпуска
   * версии регламента, знает сама группа окон (`SettingsScreens`). Отсюда
   * ей говорят только «откройся на такой-то вкладке».
   */
  const [settingsRequest, setSettingsRequest] = useState<SettingsRequest>(null);
  const [dashboardCounts, setDashboardCounts] = useState<ReadonlyMap<string, number>>(new Map());
  const [libraryReset, setLibraryReset] = useState(0);

  /**
   * Отбор систем — один на все три экрана.
   *
   * Снял галочку с извещателей — их не видно ни на плане, ни в журнале, ни на
   * дашборде. Раньше отборов было два: план прятал виды своим списком, дашборд
   * держал свой, а журнал не слушал ни того, ни другого. Человек снимал
   * галочку и видел, что «ничего не работает», — на самом деле работало, но не
   * там, где он смотрел.
   *
   * Хранятся **скрытые** виды, а не показанные: по умолчанию видно всё, и
   * хранить нужно исключения. Иначе при переходе на другой уровень отбор
   * пришлось бы пересобирать, и новые виды появлялись бы уже снятыми.
   */
  const [hiddenTypes, setHiddenTypes] = useState<ReadonlySet<string>>(new Set());

  const toggleType = (typeCode: string): void => setHiddenTypes((current) => {
    const next = new Set(current);
    if (next.has(typeCode)) next.delete(typeCode);
    else next.add(typeCode);
    return next;
  });

  const setTypesVisible = (typeCodes: readonly string[], visible: boolean): void =>
    setHiddenTypes((current) => {
      const next = new Set(current);
      for (const typeCode of typeCodes) {
        if (visible) next.delete(typeCode);
        else next.add(typeCode);
      }
      return next;
    });
  /** Помещение, которое сейчас обводится на плане. */
  const [drawingRoomId, setDrawingRoomId] = useState<string | null>(null);
  /**
   * Подсвеченная обводка помещения и её угасание.
   *
   * Заказчик: «добавь кнопку показать на плане — обводка помещения
   * подсвечивается и пропадает». Живёт здесь, а не в плане: переход на план
   * пересоздаёт чертёж, и отметка внутри него не пережила бы перехода (тот же
   * урок, что со вспышкой значка, С142).
   */
  const [flashRoomId, setFlashRoomId] = useState<string | null>(null);
  /** Узел, для которого из настроек попросили задать масштаб. */
  const [scaleWantedFor, setScaleWantedFor] = useState<string | null>(null);
  /** Узел и подложка, на которых начата незавершённая обводка. */
  const [drawingScope, setDrawingScope] = useState<{
    readonly nodeId: string;
    readonly backdropId: string;
  } | null>(null);
  /*
   * Точки обводки и наведённое помещение живут здесь, а не в самом плане.
   *
   * Кнопка «Готово» стоит в карточке узла, рядом со списком помещений
   * (заказчик: «пускай она отображается там же, в карточке учёта узла»), а
   * подсветку помещения включает наведение и на фигуру, и на строку списка.
   * И то и другое — разговор между двумя окнами, значит общее у них состояние.
   */
  const [outlinePoints, setOutlinePoints] = useState<readonly PixelPoint[]>([]);
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);
  /*
   * Открыта ли карточка узла. Состояние живёт здесь, а не в дереве: панель
   * лежит над всей рабочей областью, и дерево — лишь одна из кнопок к ней.
   *
   * Свёрнута по умолчанию: дерево нужно постоянно, карточка — изредка.
   */
  const [cardOpen, setCardOpen] = useState(false);
  /** Объект, выбранный на плане: пока он выбран, справа его карточка. */
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  /** Единица комплекта, раскрытая в карточке. На плане подсвечивается её точка. */
  const [focusUnitId, setFocusUnitId] = useState<string | null>(null);
  /**
   * Счётчик нажатий «показать на плане».
   *
   * Нужен, чтобы подсветка проигрывалась и тогда, когда значок уже выбран:
   * анимация запускается появлением класса, а он в этом случае уже стоит, и
   * повторное нажатие внешне не давало ничего.
   */
  const [planFocusTick, setPlanFocusTick] = useState(0);
  /*
   * Просьба мигнуть значком на плане.
   *
   * Живёт здесь, а не в самом плане: переход из журнала меняет этаж, план при
   * этом пересоздаётся, и всё, что он помнил о просьбе, пропадало вместе с
   * ним — вспышки, ради которой нажимали кнопку, не случалось.
   *
   * Ставится только по явной команде «показать на плане» — из журнала, из
   * карточки, из меню значка. Обычный щелчок по значку её не ставит, и потому
   * не мигает.
   */
  const [flashRequest, setFlashRequest] = useState<{ objectId: string; tick: number } | null>(null);
  const askToFlash = (objectId: string): void => {
    setFlashRequest((current) => ({ objectId, tick: (current?.tick ?? 0) + 1 }));
  };
  /** Режим работы: план, журнал или дашборд (Дополнение 2, часть П2). Управляется
   *  отсюда: «показать на плане» из журнала обязано переключить режим принудительно. */
  const [mode, setMode] = useState<ViewMode>(props.openAt?.mode ?? 'plan');
  /** Объект, для которого открыта история (П6.3). */
  const [historyObject, setHistoryObject] = useState<PlanObject | null>(null);
  /** Запись журнала, которую подписывают или чью подпись проверяют. */
  const [signatureEvent, setSignatureEvent] = useState<MaintenanceEvent | null>(null);
  /** Мероприятие, чей чек-лист сейчас открыт: объект + код мероприятия. */
  const [openActivity, setOpenActivity] = useState<{ object: PlanObject; activityCode: string } | null>(null);
  /** Фильтр, с которым нужно открыть журнал при переходе с показателя дашборда (ТЗ, Дополнение 3, часть К4). */
  const [journalIntent, setJournalIntent] = useState<JournalIntent | null>(null);
  const [journalFocusObjectId, setJournalFocusObjectId] = useState<string | null>(null);
  /** Контекстное меню объекта на плане: правая кнопка мыши (ТЗ, Дополнение 3, часть К7). */
  const [contextMenu, setContextMenu] = useState<{ object: PlanObject; x: number; y: number; source: ViewMode } | null>(null);
  /**
   * Что переносим по «Переместить…».
   *
   * Пусто — окно закрыто. Один объект — правый щелчок по объекту вне набора.
   * Несколько — щелчок по объекту из набора или кнопка полосы выделения:
   * человек отметил их именно затем, чтобы действовать над всеми сразу.
   */
  const [movingObjects, setMovingObjects] = useState<readonly PlanObject[]>([]);
  const [replaceObjectFor, setReplaceObjectFor] = useState<PlanObject | null>(null);
  /** Порог «скоро» в днях (Д11) — настраивается на дашборде, хранится в настройках программы. */
  const { settings, reload: reloadSettings } = useAppSettings();
  const soonThresholdDays = settings.soonThresholdDays;
  /** Тип элемента, для которого открыто окно «Создать несколько» (ТЗ, часть 6.3). */
  const [batchModalTypeCode, setBatchModalTypeCode] = useState<string | null>(null);
  /** Очередь расстановки по щелчку. Пока не пуста — план принимает щелчки как размещение, а не выбор. */
  const [batchQueue, setBatchQueue] = useState<BatchQueue | null>(null);
  /** Идёт ли сейчас создание партии — чтобы не запускать второй клик поверх незавершённого сохранения. */
  /** Открыт ли мастер переноса существующего журнала (Д12–Д13). */
  const [importOpen, setImportOpen] = useState(false);
  /**
   * Проверка расстановки огнетушителей (ППР РФ № 1479, пункт 409).
   *
   * Отчёт не запоминается снимком, а пересчитывается: в окне проверки тут же
   * заполняют назначение помещения и классы пожара, и вывод обязан меняться
   * сразу. Снимок показывал бы старое замечание над исправленным полем.
   */
  /**
   * Групповое выделение значков на плане (ТЗ, Дополнение 6, часть С77).
   *
   * Рамкой берут то, что лежит кучно; обводкой — то, что вдоль стены или
   * вокруг оборудования, где рамка захватила бы половину цеха.
   */
  /**
   * Куда сдвинута подпись на плане каждого узла.
   *
   * По узлам, а не одна на всех: на разных чертежах мешает разное место.
   * Хранится на время сеанса — это удобство просмотра, а не сведения об
   * объекте, и класть его в журнал незачем.
   */
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  /**
   * Окно, в котором собран набор.
   *
   * Набор действует только там: уход на другую вкладку и переход на другой
   * узел его снимают. Общий на все экраны он опасен — человек выделил строки
   * в журнале, ушёл на план, обвёл там другое и не помнит, что в наборе
   * лежит прежнее.
   */
  const [selectionScope, setSelectionScope] = useState<SelectionScope>('план');
  /**
   * Отмеривание отрезка для масштаба.
   *
   * `measuring` — ждём двух щелчков по плану; `measured` — отрезок отмерен и
   * спрашивается его длина в метрах. Масштаб задают и при загрузке подложки,
   * но там его часто пропускают, а без него круги радиусом нормы не построить.
   */
  /*
   * Проверка расстановки живёт своим хуком (`use-placement-check`).
   *
   * Круги нормы, разбор соответствия и масштаб — один вопрос: хватает ли
   * огнетушителей и стоят ли они там, где нужно. Держать его состояние и его
   * правила здесь значило бы примешивать предмет к связыванию частей.
   */
  /**
   * Приближение плана.
   *
   * Живёт здесь, а не в самом плане: холст пересоздаётся при переходе на
   * другой этаж и при возврате из журнала, и подобранное приближение
   * сбрасывалось бы на «по окну». Подбирают его как раз затем, чтобы смотреть
   * этажи один за другим в одном и том же виде.
   */
  const [planZoom, setPlanZoom] = useState(100);
  /**
   * Помещение, к которому отправила проверка.
   *
   * Проверка называет недостающее и ведёт в карточку помещения. Без такой
   * отметки человек попадал бы в список из десятка помещений и заново искал
   * то, о котором читал.
   */
  const [hazardRoomId, setHazardRoomId] = useState<string | null>(null);
  const regulationsState = useRegulations();
  /**
   * Источник правил для всего окна: регламенты организации, а где их нет —
   * нормативная библиотека (ТЗ, Дополнение 5, часть Р19).
   *
   * Пересобирается только при смене регламентов, дерева или порога. Внутри
   * источника есть память о уже собранных регламентах, и сохранить её между
   * перерисовками — единственное, ради чего здесь `useMemo`.
   */
  const scheduleSource = useMemo(
    () => regulationScheduleSource({
      regulations: regulationsState.regulations,
      versions: regulationsState.versions,
      nodes,
      soonThresholdDays,
    }),
    [regulationsState.regulations, regulationsState.versions, nodes, soonThresholdDays],
  );

  const selected = nodes.find((node) => node.id === selectedId) ?? null;
  const caption = selected === null ? '' : planCaption(nodes, selected.id);
  const planKind = selected === null ? 'none' : ruleFor(selected.kind).planKind;
  /**
   * Закреплены ли объекты на плане — защита от случайного перетаскивания
   * (Дополнение 2, П3.2). Свойство узла, а не сеанса работы (Дополнение 3,
   * К5): переживает переход между узлами, режимами и перезапуск программы.
   */
  const pinned = selected?.objectsPinned ?? false;

  /**
   * Какие режимы доступны для выбранного уровня (Дополнение 2, часть П2).
   *
   * У организации и цеха своего плана нет — они только объединяют то, что
   * внутри. Дашборд доступен всегда: он и есть то, ради чего эти уровни
   * открывают.
   */
  const hasOwnPlan = planKind !== 'none';
  /*
   * У организации и цеха вкладки «План» нет вовсе, а не «есть, но серая».
   *
   * Недоступная вкладка обещает то, чего не будет: у этих уровней своего
   * плана не появится никогда — они только объединяют то, что внутри.
   * Оставшиеся вкладки делят строку поровну и занимают её целиком.
   */
  const modes = [
    ...(hasOwnPlan ? [{
      mode: 'plan' as const,
      // Подпись постоянна, хотя план бывает разный. Раньше здесь стояло
      // «Генплан», «План» или «Склад» по узлу, и соседние вкладки прыгали при
      // каждом переходе по дереву. Какой именно план открыт, сказано в подписи
      // под вкладками и в подсказке.
      title: 'План',
      disabled: false,
      hint: `Рабочая область выбранного узла: ${planTitleFor(planKind).toLowerCase()}`,
    }] : []),
    { mode: 'journal' as const, title: 'Журнал', disabled: false, hint: 'Журнал по выбранному узлу и всему, что в него входит' },
    { mode: 'dashboard' as const, title: 'Дашборд', disabled: false, hint: 'Показатели по выбранному узлу' },
  ];

  /**
   * Режим, который показывается на самом деле.
   *
   * Если выбран узел без плана, а пользователь стоял в режиме плана, показывается
   * дашборд: пустой экран с надписью «здесь ничего нет» был бы бесполезен.
   * Само состояние `mode` при этом не меняется — вернувшись на этаж, пользователь
   * снова окажется в плане, где и работал.
   */
  const effectiveMode: ViewMode = mode === 'plan' && !hasOwnPlan ? 'dashboard' : mode;

  const { backdrop, cleanup, calibration, loading: nodePlanLoading, reload: reloadPlan } = useNodePlan(selectedId);
  const backdropScales = useBackdropScales(nodes);
  const planUrl = useStoredImageUrl(backdrop, cleanup);
  const planLoading = nodePlanLoading || (backdrop !== null && planUrl === null);
  const { rooms, reload: reloadRooms } = useRooms(selected?.kind === 'level' ? selected.id : null);
  const { objects, reload: reloadObjects } = usePlanObjects(selectedId);
  const { objects: everyObject, reload: reloadAllObjects } = useAllPlanObjects();
  const { rooms: everyRoom, reload: reloadAllRooms } = useAllRooms();

  /*
   * Оборудование и помещения — тоже по области прав.
   *
   * Дерево уже отобрано, но списки «всего» читаются из хранилища целиком: они
   * нужны журналу и дашборду, которым мало одного узла. Без отбора
   * ответственный видел бы в общем журнале и на дашборде чужие цеха — дерево
   * при этом показывало бы только его собственные, и понять, откуда взялись
   * лишние строки, было бы нельзя.
   *
   * Отбор идёт по тем же узлам, что остались в дереве: одна область прав, один
   * ответ на вопрос «что мне доступно».
   */
  const allowedNodeIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);
  const allObjects = useMemo(
    () => everyObject.filter((object) => allowedNodeIds.has(object.nodeId)),
    [everyObject, allowedNodeIds],
  );
  const allRooms = useMemo(
    () => everyRoom.filter((room) => allowedNodeIds.has(room.levelId)),
    [everyRoom, allowedNodeIds],
  );
  const { events: maintenanceEvents, reload: reloadEvents } = useMaintenanceEvents();

  const cancelOutline = useCallback((): void => {
    setDrawingRoomId(null);
    setDrawingScope(null);
    setOutlinePoints([]);
  }, []);

  /**
   * Показать обводку помещения на плане.
   *
   * Карточка узла закрывается: она лежит поверх рабочей области, и показывать
   * план из-под неё бессмысленно — кнопка обещает план, значит, показывает
   * его. Подсветка гаснет сама через три секунды: нашёл глазами — и довольно,
   * снимать её отдельным действием человек не станет.
   */
  const showRoomOnPlan = useCallback((roomId: string): void => {
    setMode('plan');
    setCardOpen(false);
    setRoomShownAt(0);
    setFlashRoomId(roomId);
  }, []);

  /*
   * Подсветка гаснет через три секунды **после того, как её показали**, а не
   * после нажатия кнопки.
   *
   * Считать от нажатия нельзя: между нажатием и появлением обводки успевает
   * смениться режим, дочитаться узел и разобраться чертёж. На медленном плане
   * три секунды кончались до того, как обводку было видно, и человек
   * справедливо говорил «не показывает».
   */
  const [roomShownAt, setRoomShownAt] = useState(0);
  const noteRoomShown = useCallback(() => setRoomShownAt(Date.now()), []);
  useEffect(() => {
    if (flashRoomId === null || roomShownAt === 0) return undefined;
    const timer = setTimeout(() => setFlashRoomId(null), 3000);
    return () => clearTimeout(timer);
  }, [flashRoomId, roomShownAt]);

  const startOutline = useCallback((roomId: string): void => {
    if (selected?.kind !== 'level' || backdrop === null) return;
    const room = rooms.find((item) => item.id === roomId);
    if (room === undefined) return;
    setMode('plan');
    setOutlinePoints(room.outline ?? []);
    setDrawingScope({ nodeId: selected.id, backdropId: backdrop.id });
    setDrawingRoomId(roomId);
  }, [selected, backdrop, rooms]);

  /*
   * Черновик существует только на том этаже и на той версии подложки, где
   * его начали. Переход на другой объект, замена плана или удаление помещения
   * немедленно выключают инструмент — старые точки больше не могут появиться
   * поверх чужого здания.
   */
  useEffect(() => {
    if (drawingRoomId === null) return;
    const belongsHere = selected?.kind === 'level'
      && effectiveMode === 'plan'
      && drawingScope?.nodeId === selected.id
      && drawingScope.backdropId === backdrop?.id
      && rooms.some((room) => room.id === drawingRoomId && room.archivedAt === null);
    if (!belongsHere) cancelOutline();
  }, [drawingRoomId, drawingScope, selected, backdrop, rooms, effectiveMode, cancelOutline]);

  /* Escape всегда прекращает рисование, даже если карточка узла открыта. */
  useEffect(() => {
    if (drawingRoomId === null) return undefined;
    const stopDrawing = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      cancelOutline();
    };
    document.addEventListener('keydown', stopDrawing, true);
    return () => document.removeEventListener('keydown', stopDrawing, true);
  }, [drawingRoomId, cancelOutline]);

  /**
   * Характеристика здания, в котором стоит этаж.
   *
   * Категория и классы возможного пожара указываются на здание: так они
   * записаны и в информационных справках. Помещение вправе их уточнить, и
   * тогда считается по помещению.
   */
  const buildingNode = useMemo(
    () => (selected === null
      ? null
      : pathToNode(nodes, selected.id).find((node) => node.kind === 'building') ?? null),
    [nodes, selected],
  );
  const buildingProfile = buildingNode?.building ?? null;

  /**
   * Организация выбранного узла — верхний узел его пути.
   *
   * Её название подставляется в чек-лист графой «организация исполнителя»:
   * свою проверку проводят своими силами, и набирать название предприятия
   * при каждом чек-листе незачем.
   */
  const organizationNode = useMemo(
    () => (selected === null
      ? null
      : pathToNode(nodes, selected.id).find((node) => node.kind === 'organization') ?? null),
    [nodes, selected],
  );

  const check = usePlacementCheck({
    selected, rooms, objects, calibration, buildingProfile, backdrop,
  });
  const {
    checkRun, setCheckOpen, measuring, setMeasuring, setMeasured, setScaleOpen,
    coverage, toggleCoverage,
  } = check;
  const placementReport = check.report;
  /**
   * Что показать в карточке справа.
   *
   * `selectedObjectId` всегда указывает на объект, который **стоит на плане**:
   * по нему план подсвечивает значок. Единица комплекта на плане не стоит, и
   * хранить её здесь нельзя — подсвечивать было бы нечего, и «показать на
   * плане» ничего бы не делала.
   *
   * Какую именно единицу раскрыть в карточке, помнит отдельное состояние. Две
   * величины разведены намеренно: одна отвечает на вопрос «что подсветить на
   * схеме», другая — «что открыть в карточке», и это разные вопросы.
   */
  const selectedObject = objects.find((object) => object.id === selectedObjectId)
    ?? allObjects.find((object) => object.id === selectedObjectId)
    ?? null;

  /**
   * Выбирает объект: и для плана, и для карточки.
   *
   * Единица комплекта переводится в свою точку размещения — её и подсветит
   * план, — а сама единица запоминается, чтобы карточка открылась на ней.
   * Один вход на все места выбора: раньше каждое место решало это по-своему, и
   * из журнала подсветка не работала, а из карточки работала.
   */
  const selectObject = useCallback((object: PlanObject | null): void => {
    if (object === null) {
      setSelectedObjectId(null);
      setFocusUnitId(null);
      return;
    }
    const host = placementOf(allObjects, object);
    setSelectedObjectId((host ?? object).id);
    setFocusUnitId(host === null ? null : object.id);
  }, [allObjects]);

  /*
   * Переход из истории действий личного кабинета.
   *
   * Кабинет копий записей не держит и ведёт к первоисточнику: журнал того
   * узла, где элемент числится, его строка подсвечена, карточка раскрыта — а в
   * карточке лежит история эксплуатации, та самая, о которой была строка.
   *
   * Ждём, пока список объектов прочитан: сразу после входа он ещё пуст, и
   * переход просто ничего бы не нашёл.
   */
  useEffect(() => {
    const wanted = props.focusTarget ?? null;
    if (wanted === null) return;
    // Ждём, пока список объектов прочитан: сразу после входа он ещё пуст.
    if (wanted.objectId !== null && allObjects.length === 0) return;

    props.onFocusApplied?.();

    const object = wanted.objectId === null
      ? null
      : allObjects.find((item) => item.id === wanted.objectId) ?? null;

    if (object !== null) {
      setSelectedId(object.nodeId);
      selectObject(object);
      setMode('journal');
      setJournalFocusObjectId(object.id);
      setLibraryCollapsed(false);
      return;
    }

    // Элемента нет — ведём к узлу: правки здания и этажа относятся к нему.
    if (wanted.nodeId !== null && nodes.some((node) => node.id === wanted.nodeId)) {
      setSelectedId(wanted.nodeId);
      setMode('journal');
      return;
    }

    setMessage(wanted.objectId === null
      ? 'Узла, о котором запись, больше нет в дереве.'
      : 'Записи об этом элементе больше нет: его вывели из обращения или удалили.');
    // Зависимость по самому переходу: перечитывание объектов не должно
    // возвращать человека к элементу, от которого он уже ушёл.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.focusTarget, allObjects.length]);

  /*
   * Окно масштаба открывается, когда переход к нужному узлу состоялся.
   *
   * Объявлено после `usePlacementCheck`: её сброс при смене узла срабатывает
   * раньше, и открытие окна происходит уже поверх сброса, а не до него.
   */
  useEffect(() => {
    if (scaleWantedFor === null || selectedId !== scaleWantedFor) return;
    setScaleWantedFor(null);
    setScaleOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scaleWantedFor, selectedId]);

  /*
   * Сообщение уходит само.
   *
   * Прежде его убирали щелчком по нему же — и до тех пор оно висело поверх
   * всего, накрывая первые поля открытых окон. Извещение о сделанном не должно
   * требовать отдельного действия: прочитал — и довольно.
   *
   * Отказы висят дольше сообщений об успехе: их читают внимательнее, а иногда
   * и переписывают.
   */
  useEffect(() => {
    if (message === null) return;
    const тон = messageTone(message);
    const срок = тон === 'error' ? MESSAGE_ERROR_MS : MESSAGE_OK_MS;
    const timer = window.setTimeout(() => setMessage(null), срок);
    return () => window.clearTimeout(timer);
  }, [message, setMessage]);

  const reloadWorkspace = useCallback((): void => {
    void reloadTree();
    void reloadRooms();
    void reloadObjects();
    void reloadAllObjects();
    void reloadAllRooms();
    void reloadEvents();
    void reloadSettings();
    void reloadPlan();
  }, [reloadAllObjects, reloadAllRooms, reloadEvents, reloadObjects, reloadPlan, reloadRooms, reloadSettings, reloadTree]);
  // Автор нужен журналу изменений: запись без ответа на «кто изменил»
  // бесполезна.
  const history = useCommandHistory(reloadWorkspace, props.session.user);

  /** Снять набор целиком: он больше ни к чему не относится. */
  const clearSelection = useCallback((): void => {
    setSelectedIds(new Set());
  }, []);

  /*
   * Набор снимается при уходе из окна, где он собран, и при смене узла.
   *
   * Оба случая — это «человек занялся другим»: держать за ним невидимый набор
   * значит однажды перенести не то, что он думал.
   */
  useEffect(() => { clearSelection(); }, [clearSelection, effectiveMode, selectedId]);
  useEffect(() => { setHoveredRoomId(null); }, [selectedId]);


  /**
   * Что требует действий — для колокольчика в шапке.
   *
   * Считается по всему объекту, а не по выбранному узлу: колокольчик
   * отвечает на вопрос «что где-то ждёт меня», и ответ, зависящий от того,
   * какой этаж сейчас открыт, на этот вопрос не отвечает. Считается тем же
   * правилом, что и дашборд: два счёта однажды разошлись бы, и колокольчик
   * спорил бы с плитками.
   */
  const notifications = useMemo((): readonly NotificationItem[] => {
    const live = allObjects.filter((object) => object.archivedAt === null);
    const summary = dashboardSummary({
      objects: live,
      events: maintenanceEvents,
      today: todayIso(),
      soonThresholdDays,
      source: scheduleSource,
      typeCodes: null,
      levelObjects: live,
      storageNodeIds: storageNodeIds(nodes),
    });

    const toJournal = (tag: FilterTag) => () => {
      setJournalIntent({ typeCode: null, statusTags: new Set<FilterTag>([tag]) });
      setMode('journal');
    };

    /*
     * Состав — те же блоки, что на дашборде.
     *
     * Заказчик: «в мини-окне кратко: информация по блокам из ТО + те, что
     * требуют заполнения и размещения». Счёт один и тот же — та же сводка, что
     * рисует дашборд: два счёта сроков однажды разошлись бы, и человек не знал
     * бы, какому верить.
     */
    /*
     * Ближайшие сроки: и счёт, и список — из одного перечня самих элементов.
     *
     * Заказчик: «показывается "В ближайшие 30 дней — 1", но после нажатия
     * ничего не открывается и соответствующей записи нет». Так и было: счёт
     * брался из перечня работ за тридцать дней, а переход вёл в журнал с
     * отбором «скоро», который считается по настроенному порогу и может быть
     * короче. Работа, до которой двадцать пять дней, попадала в счётчик, но по
     * метке «скоро» не находилась.
     */
    /*
     * Порог берётся из настроек, а не из твёрдых семи и тридцати дней.
     *
     * Заказчик: «уведомления должны опираться на сроки, когда предупреждать, в
     * зависимости от того, какой срок в настройках поставил пользователь».
     * Настройка одна и та же для метки «скоро» в журнале и для колокольчика —
     * иначе журнал и уведомления снова разошлись бы.
     */
    const soonItems = summary.upcomingItems.filter((item) => item.daysLeft <= soonThresholdDays);

    /** Переход к элементу: журнал того узла, где он числится, с подсветкой. */
    const toObject = (object: PlanObject) => () => {
      setSelectedId(object.nodeId);
      selectObject(object);
      setMode('journal');
      setJournalFocusObjectId(object.id);
    };

    /**
     * Элементы, стоящие за числом: их и показывает раскрытая категория.
     *
     * Строка ведёт к самому элементу, а не на дашборд: заказчик просит «при
     * нажатии на конкретное уведомление переходить к соответствующему
     * элементу, карточке, записи журнала или сроку проверки».
     */
    const soonLines = (items: readonly UpcomingItem[]) => items.slice(0, 10).map((item) => ({
      id: `${item.object.id}-${item.activityTitle}-${item.date}`,
      title: `${item.object.regNumber ?? 'без номера'} — ${item.activityTitle}`,
      note: item.daysLeft === 0 ? 'сегодня' : `через ${item.daysLeft} дн. · ${formatDateRu(item.date)}`,
      onOpen: toObject(item.object),
    }));

    return [
      {
        id: 'просрочено', title: 'Просрочено ТО', tone: 'danger',
        count: summary.overdue.length,
        onOpen: toJournal('просрочено'),
        lines: summary.overdue.slice(0, 10).map((item) => ({
          id: `${item.object.id}-${item.activityTitle}`,
          title: `${item.object.regNumber ?? 'без номера'} — ${item.activityTitle}`,
          note: `на ${item.daysLate} дн.`,
          onOpen: toObject(item.object),
        })),
      },
      /*
       * Категория одна, а не две: срок предупреждения теперь задаёт человек, и
       * делить его на семь и тридцать дней значило бы спорить с настройкой.
       *
       * Своего перехода у неё нет: число здесь — про сроки работ, а отбор
       * журнала — про метку состояния. Категория раскрывается списком, а ведёт
       * к элементу уже строка.
       */
      {
        id: 'скоро-то',
        title: `ТО в ближайшие ${soonThresholdDays} дн.`,
        tone: 'warn',
        count: soonItems.length,
        lines: soonLines(soonItems),
      },
      {
        id: 'неисправно', title: 'Неисправное оборудование', tone: 'danger',
        count: summary.tagCounts['неисправно'], onOpen: toJournal('неисправно'),
        lines: summary.broken.slice(0, 10).map((item) => ({
          id: item.object.id,
          title: `${item.object.regNumber ?? 'без номера'} — ${elementTitle(item.object.typeCode)}`,
          note: item.state,
          onOpen: toObject(item.object),
        })),
      },
      {
        id: 'не размещено', title: 'Требуют размещения на плане', tone: 'warn',
        // Склад сюда не входит: там планов нет, и координаты не нужны.
        count: summary.unplaced,
        lines: live.filter((object) => needsPlacement(object, storageNodeIds(nodes)))
          .slice(0, 10).map((object) => ({
            id: object.id,
            title: `${object.regNumber ?? 'без номера'} — ${elementTitle(object.typeCode)}`,
            onOpen: toObject(object),
          })),
        // Расставляют на плане: туда и ведём, отбор состояния тут ни при чём.
        onOpen: () => { setMode('plan'); setLibraryCollapsed(false); },
      },
      {
        id: 'требуют заполнения', title: 'Требуют заполнения карточки', tone: 'warn',
        count: incompleteCards(live).length,
        onOpen: toJournal('нет данных'),
        lines: incompleteCards(live).slice(0, 10).map((object) => ({
          id: object.id,
          title: `${object.regNumber ?? 'без номера'} — ${elementTitle(object.typeCode)}`,
          note: missingCardFields(object).join(', '),
          onOpen: toObject(object),
        })),
      },
      {
        id: 'нет данных', title: 'Нет сведений о проверках', tone: 'muted',
        count: summary.tagCounts['нет данных'], onOpen: toJournal('нет данных'),
      },
    ];
  }, [allObjects, maintenanceEvents, soonThresholdDays, scheduleSource]);

  /* Escape снимает набор — привычный способ отказаться от начатого. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearSelection]);

  /**
   * Выполняет действие с записью в историю и **не теряет срыв**.
   *
   * `history.run` намеренно пробрасывает бросок дальше: он отменяет начатую
   * запись истории и обязан сообщить вызывающему, что действие не
   * состоялось. Но все двадцать восемь вызовов отсюда сделаны через `void`,
   * и брошенное превращалось в необработанное обещание: ни сообщения, ни
   * следа — со стороны «нажал и ничего не произошло».
   *
   * Здесь срыв называется словами и возвращается `null` — то же, что при
   * обычном отказе, так что разбирать его вызывающим отдельно не нужно.
   */
  const runCommand = async <T,>(label: string, action: () => Promise<T>): Promise<T | null> => {
    try {
      return await history.run(label, action);
    } catch (e) {
      setMessage(`Не удалось выполнить «${label}»: ${describeUnknown(e)}`);
      return null;
    }
  };

  const reloadObjectLists = (): void => {
    void reloadObjects();
    void reloadAllObjects();
  };

  const reloadRoomLists = (): void => {
    void reloadRooms();
    void reloadAllRooms();
  };

  /**
   * Действия над составом объекта: узлы дерева и помещения этажа.
   *
   * Собраны отдельно (`useTreeActions`), потому что это работа над одним
   * предметом со своими правилами, а не связывание частей экрана.
   */
  /**
   * Заведение объектов помногу: партия одинаковых и перенос чужого журнала.
   *
   * Занятость у них общая с размещением из очереди по щелчку: пока идёт
   * запись, план щелчков не принимает — иначе один номер лёг бы дважды.
   */
  /*
   * Подпись под всем, что заводит строки журнала.
   *
   * Заказчик: «при заведении нового огнетушителя или элемента, и вообще при
   * создании новых строк в журнале должна ставиться ПЭП». Пароль спрашивается
   * один раз на действие: завести партию, расставить очередь, перенести чужой
   * журнал — по одному разу на каждое.
   */
  const signing = useSigning(props.session.user);

  const batch = useObjectBatch({
    selected, setMessage, runCommand,
    reloadObjectLists,
    reloadEvents: () => { void reloadEvents(); },
  });

  const treeActions = useTreeActions({
    nodes, rooms, allRooms, allObjects, selected, selectedId,
    run, runCommand, setMessage, setSelectedId, setSelectedObjectId,
    reloadRooms: reloadRoomLists,
    reloadObjectLists,
  });

  /**
   * Выполняет сценарий над объектом и перечитывает оба списка — узловой и
   * общий. План и журнал берут данные из одной и той же записи (Д7.4 ТЗ), но
   * читаются двумя разными запросами, поэтому оба обязаны обновиться вместе.
   */
  const runObject = (label: string, action: () => Promise<{ ok: boolean; error?: { message: string } }>): void => {
    void runCommand(label, action).then((result) => {
      if (result === null) return;
      if (!result.ok && result.error !== undefined) setMessage(result.error.message);
      else reloadObjectLists();
    });
  };

  const exportDocument = (request: JournalExportRequest, title: string): void => {
    // Срыв выгрузки называется словами: раньше он уходил необработанным
    // обещанием, и человек не узнавал даже того, что она не удалась.
    void window.izh.exportJournal(request).then((result) => {
      if (!result.ok) { setMessage(result.error.message); return; }
      /*
       * Название документа стоит после глагола, а не перед ним: «Журнал»,
       * «Карточка», «Проверка размещения» — разного рода, и «Журнал сохранена»
       * читалось безграмотно. Проверка не на `!== null`, а на непустую строку:
       * отсутствующий путь показывался как «сохранена: undefined».
       */
      const saved = result.value.savedPath;
      if (typeof saved === 'string' && saved !== '') setMessage(`Сохранено — ${title}: ${saved}`);
    }).catch((e: unknown) => {
      setMessage(`Не удалось выгрузить «${title}»: ${describeUnknown(e)}`);
    });
  };

  /**
   * Приводит состав системы пожарной автоматики к указанным числам
   * (Дополнение 6).
   *
   * Заведение и вывод из эксплуатации идут одной операцией ядра: сбой на
   * середине оставил бы систему наполовину собранной, а элементы журнала
   * удалять нельзя.
   */
  const applySystemComposition = async (
    head: PlanObject,
    items: readonly SystemCompositionItem[],
  ): Promise<void> => {
    await runCommand('Изменить состав системы', async () => {
      const result = await setSystemComposition(objectDeps, { headId: head.id, items, nodes });
      if (!result.ok) { setMessage(result.error.message); return; }

      reloadObjectLists();
      const { created, archived } = result.value;
      if (created.length === 0 && archived.length === 0) { setMessage('Состав системы не изменился.'); return; }
      setMessage(
        [
          created.length > 0 ? `заведено элементов: ${created.length}` : null,
          archived.length > 0 ? `выведено из эксплуатации: ${archived.length}` : null,
        ].filter((part) => part !== null).join(', ') + '. Расставьте новые элементы на планах этажей.',
      );
    });
  };



  /**
   * Замкнуть обводку и записать её помещению.
   *
   * Одна на две кнопки: «Готово» в карточке узла и двойной щелчок по плану.
   * Разводить их на два обработчика значило бы завести два способа записать
   * одно и то же — и однажды они разойдутся.
   */
  const finishOutline = (points: readonly PixelPoint[]): void => {
    if (drawingRoomId === null || points.length < 3) return;
    const roomId = drawingRoomId;

    void runCommand('Отметить помещение на плане', () =>
      setRoomOutline(roomDeps, {
        id: roomId,
        points,
        // Масштаб берётся из калибровки подложки: без него площадь не считается.
        metersPerPixel: calibration?.metersPerPixel ?? null,
      }),
    ).then((result) => {
      cancelOutline();
      if (result === null) return;
      if (!result.ok) setMessage(result.error.message);
      else { void reloadRooms(); void reloadAllRooms(); }
    });
  };

  const planImage =
    planUrl === null || backdrop === null
      ? null
      : {
          url: planUrl,
          widthPx: cleanup?.widthPx ?? backdrop.widthPx,
          heightPx: cleanup?.heightPx ?? backdrop.heightPx,
        };
  /**
   * Одно действие над всем выделенным.
   *
   * Весь набор — одна команда в истории: человек выделил и нажал один раз,
   * и отменять это он будет тоже один раз, а не по объекту.
   */
  const runOnSelected = (
    label: string,
    action: (objectId: string) => Promise<{ ok: boolean; error?: { message: string } }>,
  ): void => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    void runCommand(label, async () => {
      const failed: string[] = [];
      for (const id of ids) {
        const result = await action(id);
        if (!result.ok) failed.push(result.error?.message ?? id);
      }
      return failed;
    }).then((failed) => {
      reloadObjectLists();
      setSelectedIds(new Set());
      if (failed === null || failed.length === 0) return;
      // Часть могла не пройти: объект уже выведен, занят мероприятием.
      // Молча потерять эти сообщения нельзя — человек считает, что сделано всё.
      setMessage(`Не удалось обработать ${failed.length} из ${ids.length}: ${failed[0] ?? ''}`);
    });
  };

  /**
   * Справка о размещении огнетушителей — по образцу заказчика.
   *
   * Схема рисуется в растр здесь же: приложение к справке — это план с
   * кругами, а не отдельный документ, и собирать его должен тот, у кого
   * подложка уже загружена.
   */
  const exportPlacement = async (format: JournalExportFormat): Promise<void> => {
    if (placementReport === null || selected === null) return;

    const layer = coverageLayer(placementReport, rooms, objects, calibration?.metersPerPixel ?? null);
    const placed = objects.filter(
      (object) => object.position !== null && object.archivedAt === null
        && (object.typeCode === 'extinguisher' || object.typeCode.startsWith('extinguisher-')),
    );

    const marks = placed.map((object) => ({
      position: object.position ?? { x: 0, y: 0 },
      // Вид нужен схеме, чтобы взять тот же значок, что на плане: заказчик
      // требует одного знака на экране, в PDF и в Word.
      typeCode: object.typeCode,
      mark: markWithCharge(extinguisherMark(object.typeCode, object.extinguisherProfile ?? null), object.extinguisherProfile ?? null),
    }));

    // Перечень марок приложения 1: «ОВЭ-10 — 8 шт., ОП-8 — 1 шт.».
    const tally = new Map<string, number>();
    for (const item of marks) tally.set(item.mark, (tally.get(item.mark) ?? 0) + 1);
    const tallies: readonly MarkTally[] = [...tally.entries()]
      .map(([mark, count]) => ({ mark, count }))
      .sort((a, b) => b.count - a.count);

    const scheme = planImage === null ? null : await renderPlacementScheme({
      imageUrl: planImage.url,
      widthPx: planImage.widthPx,
      heightPx: planImage.heightPx,
      layer,
      marks,
    });

    const path = pathToNode(nodes, selected.id).map((node) => node.name).join(', ');

    const elevation = selected.elevationM === null || !Number.isFinite(selected.elevationM)
      ? null
      : `отм. ${selected.elevationM > 0 ? '+' : ''}${selected.elevationM.toFixed(3)}`;

    exportDocument(
      buildPlacementDocument(format, {
        report: placementReport,
        objectName: path,
        levelName: selected.name,
        elevation,
        building: buildingProfile,
        marks: tallies,
        schemeDataUrl: scheme,
      }),
      'Проверка размещения огнетушителей',
    );
  };

  /**
   * Сведения помещения о пожарной опасности — из окна проверки расстановки.
   *
   * Сохраняется вся карточка помещения целиком: сценарий ядра принимает её
   * такой, какой она станет, и сам считает новую версию записи.
   */
  /**
   * Что делать с выделенным. Отдельная строка над планом: набор бывает
   * большой, а действия над ним — необратимые, и прятать их в тесной шапке
   * рядом с прочими кнопками нельзя.
   */
  const barScope: SelectionScope = effectiveMode === 'journal' ? 'журнал' : 'план';
  // Полоса появляется, когда набор собран: отдельного режима выделения
  // больше нет — рамку тянут мышью по свободному месту плана.
  const selectionBar = selectedIds.size === 0 || selectionScope !== barScope ? null : (
    <>
      <span className="muted small">Выделено объектов: {selectedIds.size}</span>

      {/* Перенос — то, ради чего набор чаще всего и собирают: привезли
          партию не на тот этаж, выделили и отправили целиком. */}
      <button
        type="button"
        className="primary"
        disabled={busy || selectedIds.size === 0}
        onClick={() => setMovingObjects(allObjects.filter((object) => selectedIds.has(object.id)))}
      >
        Переместить…
      </button>
      <button
        type="button"
        className="danger"
        disabled={busy || selectedIds.size === 0}
        onClick={() => {
          // Вывод из эксплуатации подтверждается: записи журнала остаются, но
          // оборудование уходит из работы, и сделать это разом для десятка
          // объектов случайным движением нельзя.
          const count = selectedIds.size;
          if (!window.confirm(`Вывести из эксплуатации выделенные объекты: ${count}? Записи журнала сохранятся.`)) return;
          runOnSelected('Вывести объекты из эксплуатации', (id) => archiveObject(objectDeps, id));
        }}
      >
        Вывести из эксплуатации
      </button>
      <button type="button" className="link" onClick={clearSelection}>
        снять выделение
      </button>
    </>
  );

  /**
   * Кнопки вкладки «План».
   *
   * Стояли в шапке программы, рядом с темой и учётной записью, — и читались
   * как настройки всей программы, хотя относятся к одному плану одного узла.
   * Теперь они в самой вкладке, над планом, к которому применяются.
   */


  /**
   * Кнопки вкладки «План».
   *
   * Стояли в шапке программы, рядом с темой и учётной записью, — и читались
   * как настройки всей программы, хотя относятся к одному плану одного узла.
   * Теперь они в самой вкладке, над планом, к которому применяются, и
   * разложены по сторонам: слева то, что план показывает, справа — то, что
   * в нём меняют.
   */
  const planActions = selected === null ? null : {
    left: (
      <>
        {/* Проверки — только для этажа: первичные средства считаются по
            площади и категории помещений (Дополнение 2, П3.3). */}
        {selected.kind === 'level' && (
          <>
            {/*
              * Круги нормы — переключатель, а не окно. Нажали — на плане
              * остались одни огнетушители со своими кругами; нажали ещё раз —
              * план вернулся весь. Разбор с перечнем выводов открывает соседняя
              * кнопка: смотреть покрытие и читать замечания — разные занятия.
              */}
            <button
              type="button"
              className={checkRun ? 'primary' : undefined}
              title="Показать круги нормы расстояния до огнетушителей (ППР РФ № 1479, приложение № 1)"
              onClick={toggleCoverage}
            >
              ⭕ Проверить расстановку огнетушителей
            </button>
            <button
              type="button"
              title="Разбор: подходят ли виды и ранги огнетушителей требованиям"
              onClick={() => setCheckOpen(true)}
            >
              ✔ Проверить соответствие видов огнетушителей
            </button>
          </>
        )}
      </>
    ),
    right: (
      <button
        type="button"
        className={pinned ? 'primary' : undefined}
        title={
          pinned
            ? 'Объекты закреплены: перетаскивание по плану запрещено'
            : 'Запретить перетаскивание значков, чтобы не сдвинуть их случайно'
        }
        onClick={() => {
          if (selected === null) return;
          void runCommand(
            pinned ? 'Открепить объекты на плане' : 'Закрепить объекты на плане',
            () => run(() => setObjectsPinned(treeDeps, { id: selected.id, pinned: !pinned })),
          );
        }}
      >
        {/*
          * Надпись называет нынешнее состояние, а не только действие.
          *
          * Прежде на кнопке всегда стояло «Закрепить объекты», а закрепление
          * было видно одной подсветкой. Заказчик: «значки не таскаются» — и
          * это было закрепление, о котором он не догадывался: значок молча не
          * брался мышью, а подсветку кнопки среди трёх соседних не различить.
          */}
        {pinned ? '🔒 Объекты закреплены — открепить' : '🔓 Закрепить объекты'}
      </button>
    ),
  };

  return (
    <ScheduleSourceProvider value={scheduleSource}>
      <AppHeader
        notifications={notifications}
        /*
         * Настройки программы — только администратору.
         *
         * Заказчик: «для ответственных и гостей не должно быть возможности
         * войти в настройки программы, эта функция только для администратора».
         * Так же говорит и таблица прав: «настройки.править» есть только у
         * администратора — окно просто не спрашивало её. Кнопки нет вовсе, а не
         * «нажимается и ругается»: недоступное лучше не показывать.
         */
        onOpenSettings={!can(props.session.user, 'настройки.править') ? undefined : () => {
          // Открывается с первой вкладки, а не с той, где были в прошлый раз:
          // человек приходит сюда за разным, и «где я остановился» помнить не
          // обязан. Исключение — переход с дашборда за его составом, он
          // называет вкладку сам.
          void backdropScales.reload();
          setSettingsRequest('план');
        }}
        account={{
          title: props.session.user?.fullName ?? '',
          onOpen: props.onOpenAccount,
          onSignOut: props.session.signOut,
        }}
        onReportProblem={() =>
          setMessage(
            'Опишите, что пошло не так, разработчику проекта. Отправка обращения прямо из программы появится вместе с серверным вариантом.',
          )
        }
        canUndo={outlinePoints.length > 0 || history.state.canUndo}
        canRedo={history.state.canRedo}
        onUndo={() => {
          if (drawingRoomId !== null && outlinePoints.length > 0) {
            setOutlinePoints((current) => current.slice(0, -1));
            return;
          }
          void history.undo();
        }}
        onRedo={() => { void history.redo(); }}
      />

      {message !== null && (
        <div className={`banner ${messageTone(message)} app-message`}>{message}</div>
      )}

      <div className="app-body">
        <TreePanel
          nodes={nodes}
          selected={selected}
          busy={busy}
          cardOpen={cardOpen}
          onToggleCard={() => setCardOpen(!cardOpen)}
          card={selected === null ? null : (
            <NodeSheet
              open={cardOpen}
              onClose={() => setCardOpen(false)}
              node={selected}
              caption={caption}
              busy={busy}
              rooms={rooms}
              hasPlan={planImage !== null}
              hasScale={calibration !== null}
              drawingRoomId={drawingRoomId}
              hazardRoomId={hazardRoomId}
              /*
               * Обводка включается вместе с показом плана.
               *
               * Заказчик: «кнопка обвести по плану не выводит этот план».
               * Кнопка стоит в карточке узла, а карточка открывается в любом
               * режиме — и в журнале, и на дашборде. Обводка включалась
               * честно, но обводить было нечего: в середине экрана стояла
               * таблица. Кнопка обещает план — значит, она его и показывает.
               */
              onDrawRoom={startOutline}
              onShowRoomOnPlan={showRoomOnPlan}
              outlinePointCount={outlinePoints.length}
              onFinishOutline={() => finishOutline(outlinePoints)}
              onCancelOutline={cancelOutline}
              hoveredRoomId={hoveredRoomId}
              onHoverRoom={setHoveredRoomId}
              onAddRoom={treeActions.addRoom}
              onArchiveRoom={treeActions.archiveRoom}
              onClearRoomOutline={treeActions.clearRoomOutline}
              onChangeRoomHazard={treeActions.changeRoomHazard}
              onSave={treeActions.saveNode}
              onToggleJournal={treeActions.toggleJournal}
            />
          )}
          onSelect={setSelectedId}
          /*
           * Действия над составом объекта собраны в `useTreeActions`: создание
           * и правка узлов, помещения, вывод из эксплуатации. Здесь остаётся
           * только то, что относится к самому экрану, — что выбрано и что
           * обводится на плане.
           */
          onCreateOrganization={treeActions.createOrganization}
          onAddChild={treeActions.addChild}
          onReorder={treeActions.reorder}
          onMoveTo={treeActions.moveTo}
          onArchive={treeActions.archive}
        />

        <CenterArea
          selected={selected}
          nodes={nodes}
          caption={caption}
          planImage={planImage}
          rooms={rooms}
          allRooms={allRooms}
          objects={objects}
          allObjects={allObjects}
          maintenanceEvents={maintenanceEvents}
          soonThresholdDays={soonThresholdDays}
          modes={modes}
          onModeChange={setMode}
          planActions={planActions}
          planLoading={planLoading}
          settings={settings}
          coverage={coverage}
          selectionBar={selectionBar}
          onSetStorageSection={(objectId, section) => runObject(
            section === 'ремонт' ? 'Отправить в ремонт' : 'Вернуть в резерв',
            () => setStorageSection(objectDeps, { id: objectId, section }),
          )}
          measuring={measuring}
          onMeasured={(a, b) => { setMeasuring(false); setMeasured([a, b]); }}
          onlyExtinguishers={checkRun}
          planZoom={planZoom}
          onPlanZoom={setPlanZoom}
          metersPerPixel={calibration?.metersPerPixel ?? null}
          selectedIds={selectedIds}
          onSelectMany={(ids, mode) => {
            setSelectionScope(effectiveMode === 'journal' ? 'журнал' : 'план');
            setSelectedIds((current) => {
              if (mode === 'replace') return new Set(ids);
              if (mode === 'add') return new Set([...current, ...ids]);
              if (mode === 'remove') {
                const rest = new Set(current);
                for (const id of ids) rest.delete(id);
                return rest;
              }
              const next = new Set(current);
              for (const id of ids) {
                if (next.has(id)) next.delete(id);
                else next.add(id);
              }
              return next;
            });
          }}
          onDashboardTypesChange={setDashboardCounts}
          onShowAllTypes={() => setHiddenTypes(new Set())}
          onOpenDashboardSettings={!can(props.session.user, 'настройки.править')
            ? undefined
            : () => { void backdropScales.reload(); setSettingsRequest('дашборд'); }}
          selectedObjectId={selectedObjectId}
          planFocusTick={planFocusTick}
          flashRequest={flashRequest}
          onFlashed={() => setFlashRequest(null)}
          drawingRoomId={drawingRoomId}
          batchRemaining={batchQueue === null ? null : batchQueue.regNumbers.length}
          onBatchPlaceClick={(position) => {
            if (batchQueue === null || batch.busy) return;
            const [nextNumber, ...rest] = batchQueue.regNumbers;
            if (nextNumber === undefined) return;
            // Очередь укорачивается только после успешной записи: иначе номер
            // выпал бы из неё, так и не появившись на плане.
            signing.withSignature(`заведение элемента № ${nextNumber}`, (signer) => {
              void batch.placeOne(batchQueue.typeCode, position, nextNumber, batchQueue.common, signer)
                .then((placed) => {
                  if (placed === null) return;
                  setBatchQueue(rest.length === 0 ? null : { ...batchQueue, regNumbers: rest });
                });
            });
          }}
          onCancelBatchPlacement={() => setBatchQueue(null)}
          mode={effectiveMode}
          pinned={pinned}
          hiddenTypes={hiddenTypes}
          onToggleType={toggleType}
          onSelectObject={(objectId) => {
            selectObject(objectId === null ? null : allObjects.find((item) => item.id === objectId) ?? null);
            if (objectId === null) setLibraryReset((value) => value + 1);
          }}
          onOpenActivity={(object, activityCode) => {
            if (object.nodeId !== selectedId) setSelectedId(object.nodeId);
            setSelectedObjectId(object.id);
            setLibraryCollapsed(false);
            setOpenActivity({ object, activityCode });
          }}
          canSign={props.session.user !== null
            && can(props.session.user, 'подпись.ставить')
            && !props.session.user.mustChangePassword}
          onOpenSignature={setSignatureEvent}
          onShowOnPlan={(object) => {
            const target = placementOf(allObjects, object) ?? object;
            if (target.nodeId !== selectedId) setSelectedId(target.nodeId);
            selectObject(object);
            setPlanFocusTick((tick) => tick + 1);
            askToFlash(target?.id ?? selectedObjectId ?? '');
            setMode('plan');
            setLibraryCollapsed(false);
          }}
          onPlaceElement={(typeCode, position) => {
            if (selected === null) return;
            if (!signing.canSign) { setMessage(signing.hint ?? 'Заводить оборудование нельзя.'); return; }
            // Заведение элемента — новая строка журнала, и она заводится только
            // за подписью. Пароль спросится, если он ещё не введён.
            signing.withSignature(`заведение элемента «${elementTitle(typeCode)}»`, (signer) => {
            void runCommand('Разместить объект на плане', async () => {
              const placed = await placeObject(objectDeps, {
                nodeId: selected.id, typeCode, position,
                extinguisherProfile: newExtinguisherProfile(typeCode), signer,
              });
              if (!placed.ok) { setMessage(placed.error.message); return placed; }

              reloadObjectLists();
              // Прибор — начало системы, и следующий шаг всегда один: задать
              // состав. Открываем его карточку сразу, чтобы пользователь не
              // искал, куда теперь нажимать.
              if (isSystemHead(placed.value)) {
                setSelectedObjectId(placed.value.id);
                setMessage('Прибор размещён. Задайте состав системы в его карточке справа.');
              }
              return placed;
            });
            });
          }}
          onMoveObject={(objectId, position) => {
            runObject('Переместить объект на плане', () => moveObject(objectDeps, { id: objectId, position }));
          }}
          onObjectContextMenu={(object, screenPosition) => setContextMenu({ object, ...screenPosition, source: mode })}
          outlinePoints={outlinePoints}
          onOutlinePoint={(point: PixelPoint) => setOutlinePoints((current) => [...current, point])}
          onOutlinePointMove={(index, point) => setOutlinePoints((current) =>
            current.map((item, currentIndex) => (currentIndex === index ? point : item)))}
          onOutlineClose={() => finishOutline(outlinePoints)}
          onOutlinePointRemove={(index) => setOutlinePoints((current) =>
            current.length <= 3 ? current : current.filter((_, currentIndex) => currentIndex !== index))}
          hoveredRoomId={hoveredRoomId}
          onHoverRoom={setHoveredRoomId}
          onFinishOutline={finishOutline}
          onCancelOutline={cancelOutline}
          onPickBackdrop={() => {
            if (selected !== null) props.onPickBackdrop(selected.id);
          }}
          onDropBackdrop={(file) => {
            if (selected !== null) props.onDropBackdrop(file, selected.id);
          }}
          onImportJournal={() => setImportOpen(true)}
          journalColumns={settings.journalColumns}
          flashRoomId={flashRoomId}
          onRoomShown={noteRoomShown}
          onExportJournal={(request) => {
            exportDocument(request, 'Журнал');
          }}
          onOpenJournal={(intent) => {
            // Переход с дашборда может вести на чужой уровень: строка
            // «Состояние по объектам» показывает этажи и склады соседей.
            const target = intent.nodeId ?? null;
            if (target !== null && target !== selectedId) setSelectedId(target);
            if (intent.typeCode !== null) setTypesVisible([intent.typeCode], true);
            setJournalIntent(intent);
            setMode('journal');
          }}
          journalIntent={journalIntent}
          onJournalIntentApplied={() => setJournalIntent(null)}
          journalFocusObjectId={journalFocusObjectId}
          onJournalFocusApplied={() => setJournalFocusObjectId(null)}
          onOpenObjectCard={(object) => { selectObject(object); setLibraryCollapsed(false); }}
        />

        {effectiveMode === 'dashboard' ? (
          <DashboardSystems
            counts={dashboardCounts}
            hiddenTypes={hiddenTypes}
            onToggle={toggleType}
            onSetTypesVisible={setTypesVisible}
            collapsed={dashboardSystemsCollapsed}
            onToggleCollapsed={() => setDashboardSystemsCollapsed(!dashboardSystemsCollapsed)}
          />
        ) : (
        <RightPanel
          filterContext={effectiveMode === 'journal' ? 'journal' : 'plan'}
          onSetTypesVisible={setTypesVisible}
          planKind={planKind}
          nodes={nodes}
          selectedNode={selected}
          allObjects={allObjects}
          planObjects={objects}
          libraryReset={libraryReset}
          hiddenTypes={hiddenTypes}
          onToggleType={toggleType}
          selectedObject={selectedObject}
          rooms={rooms}
          busy={busy}
          maintenanceEvents={maintenanceEvents}
          soonThresholdDays={soonThresholdDays}
          settings={settings}
          onExportCard={(request) => exportDocument(request, 'Карточка')}
          collapsed={libraryCollapsed}
          onToggle={() => setLibraryCollapsed(!libraryCollapsed)}
          onDropObject={() => setMessage(
            'Объект с плана не снимается: всё, что есть в журнале, стоит на плане, и наоборот. '
            + 'Перенесите его на другой узел или выведите из эксплуатации.',
          )}
          onBatchCreate={(typeCode) => setBatchModalTypeCode(typeCode)}
          onSaveObject={(fields) => {
            if (selectedObject === null) return;
            const host = selectedObject;

            /*
             * Правка учётных данных снимает простую электронную подпись.
             *
             * Заказчик: «если после подписания ПЭП вносятся изменения в номер
             * элемента или вид, должно выскакивать предупреждение, что ПЭП
             * будет снята и потребуется новое проставление».
             *
             * Так и по закону. Простая электронная подпись подтверждает только,
             * что подписал определённый человек (63-ФЗ, статья 5 часть 2);
             * неизменности подписанного она сама не обеспечивает — это
             * обязанность программы. В журнале печатается учётный номер и вид
             * на сегодня, а подписывали то, что было в день проверки: поменяли
             * номер — и подписанная строка говорит уже не то, под чем
             * расписались. Значит, подпись снимается и ставится заново.
             */
            const учётноеИзменилось = fields.regNumber !== host.regNumber
              || fields.typeCode !== host.typeCode
              || fields.model !== host.model
              || fields.serialNumber !== host.serialNumber;
            const подписанные = учётноеИзменилось
              ? signedEventsOfObject(maintenanceEvents, host.id)
              : [];
            if (подписанные.length > 0
              && !window.confirm(signatureWithdrawalWarning(подписанные.length))) return;
            // Изготовитель и дата прибора до правки: по ним рассылка отличит
            // унаследованное значение элемента от его собственного.
            const previous = { manufacturer: host.manufacturer, commissionedOn: host.commissionedOn };
            runObject('Сохранить карточку объекта', async () => {
              // Подпись снимается до правки: сначала перестаёт удостоверять,
              // потом меняются данные. Обратный порядок оставил бы мгновение,
              // когда подпись стоит под изменённым.
              for (const event of подписанные) {
                await maintenanceDeps.events.save(withoutSignature(event));
              }
              /*
               * Журнал перечитывается сразу.
               *
               * Заказчик: «предупреждение выскакивает, но подпись после замены
               * данных не снимает». Снимала — в хранилище. На экране оставалась
               * прежняя: обычное сохранение карточки перечитывает списки
               * оборудования, а записи журнала не трогает, и графа подписи
               * показывала то, чего в базе уже нет.
               */
              if (подписанные.length > 0) void reloadEvents();

              const saved = await updateObject(objectDeps, {
                id: selectedObject.id,
                typeCode: fields.typeCode,
                regNumber: fields.regNumber,
                model: fields.model,
                manufacturer: fields.manufacturer,
                serialNumber: fields.serialNumber,
                commissionedOn: fields.commissionedOn,
                serviceLifeYears: fields.serviceLifeYears,
                responsible: fields.responsible,
                extinguisherProfile: fields.extinguisherProfile,
                // Карточка пожарного крана: без этой строки её четыре графы
                // молча терялись при сохранении.
                hydrantProfile: fields.hydrantProfile ?? null,
                fireBarrierProfile: fields.fireBarrierProfile ?? null,
                suppressionProfile: fields.suppressionProfile ?? null,
                controlPanelProfile: fields.controlPanelProfile ?? null,
                outdoorHydrantProfile: fields.outdoorHydrantProfile ?? null,
                waterSourceProfile: fields.waterSourceProfile ?? null,
                ladderProfile: fields.ladderProfile ?? null,
                roofFenceProfile: fields.roofFenceProfile ?? null,
                fireproofingProfile: fields.fireproofingProfile ?? null,
                fireBoardProfile: fields.fireBoardProfile ?? null,
                pumpStationProfile: fields.pumpStationProfile ?? null,
                customFields: fields.customFields ?? null,
                roomId: fields.roomId,
                note: fields.note,
              });
              if (!saved.ok) return saved;
              // Порядок работы обратный ожидаемому: состав системы заводят
              // сразу, а карточку прибора заполняют потом. Без рассылки сорок
              // извещателей остались бы без изготовителя и без даты.
              if (isSystemHead(host)) {
                await propagateSystemDefaults(objectDeps, { headId: host.id, previous });
              }
              return saved;
            });
          }}
          onArchiveObject={() => {
            if (selectedObject === null) return;
            if (!confirmObjectArchive(selectedObject)) return;
            runObject('Удалить объект', () => archiveObject(objectDeps, selectedObject.id));
            setSelectedObjectId(null);
          }}
          onCloseCard={() => selectObject(null)}
          onShowInJournal={() => {
            if (selectedObject !== null) {
              setJournalIntent({ typeCode: selectedObject.typeCode, statusTags: new Set() });
              // Без этого журнал открывался на нужном виде, но строку среди
              // сотни таких же приходилось искать глазами. Подсветка — тот же
              // приём, что и при переходе со значка плана.
              setJournalFocusObjectId(selectedObject.id);
            }
            setMode('journal');
          }}
          onShowOnPlan={() => {
            if (selectedObject === null) return;
            /**
             * Кнопка всегда открывает план.
             *
             * Раньше при неразмещённом элементе она молча отказывалась
             * работать и писала подсказку в баннер — и выглядело это как
             * сломанная кнопка. Между тем неразмещённых элементов много:
             * прибор с извещателями заводят составом системы, и точки им
             * ставят потом. Показать план и сказать прямо на нём, что элемент
             * ещё не расставлен, полезнее, чем не показать ничего.
             *
             * Единица комплекта своей точки не имеет — на плане она показана
             * точкой места хранения, к нему и ведём.
             */
            const target = selectedObject.position === null
              ? placementOf(allObjects, selectedObject) ?? selectedObject
              : selectedObject;

            if (target.nodeId !== selectedId) setSelectedId(target.nodeId);
            if (target.id !== selectedObjectId) setSelectedObjectId(target.id);
            // Значок уже выбран — подсветку надо запустить заново.
            setPlanFocusTick((tick) => tick + 1);
            askToFlash(target?.id ?? selectedObjectId ?? '');
            setMode('plan');
            setLibraryCollapsed(false);

            if (target.position === null) {
              setMessage('Элемент ещё не размещён на плане. Перетащите его из строки «Требуют размещения».');
            }
          }}
          onOpenHistory={() => setHistoryObject(selectedObject)}
          onOpenChecklist={(activityCode, object) => {
            setOpenActivity({ object, activityCode });
          }}
          onOpenSystem={(object) => selectObject(object)}
          onSetPlacementCount={(count) => {
            if (selectedObject === null) return;
            void runCommand('Изменить количество в месте хранения', async () => {
              const result = await setPlacementCount(objectDeps, { headId: selectedObject.id, count });
              if (!result.ok) { setMessage(result.error.message); return result; }
              reloadObjectLists();
              const { created, archived } = result.value;
              setMessage(created.length > 0
                ? `Заведено единиц: ${created.length}. Заполните их номера и сроки в карточке.`
                : archived.length > 0
                  ? `Выведено из эксплуатации: ${archived.length}.`
                  : 'Количество не изменилось.');
              return result;
            });
          }}
          focusUnitId={focusUnitId}
          onSaveProjectDocuments={(profile) => {
            if (selectedObject === null) return;
            void runCommand('Сохранить документацию системы', async () => {
              // Пишется только карточка прибора: остальные поля updateObject
              // оставляет прежними, и набранное в форме не затирается.
              const result = await updateObject(objectDeps, { id: selectedObject.id, controlPanelProfile: profile });
              if (!result.ok) { setMessage(result.error.message); return result; }
              reloadObjectLists();
              setMessage('Документация системы сохранена.');
              return result;
            });
          }}
          onSaveUnit={(unit, fields) => {
            void runCommand('Сохранить единицу комплекта', async () => {
              const years = fields.serviceLifeYears.trim() === '' ? null : Number(fields.serviceLifeYears);
              const result = await updateObject(objectDeps, {
                id: unit.id,
                regNumber: fields.regNumber,
                model: fields.model,
                manufacturer: fields.manufacturer,
                serialNumber: fields.serialNumber,
                commissionedOn: fields.commissionedOn === '' ? null : fields.commissionedOn,
                serviceLifeYears: years === null || Number.isNaN(years) ? null : years,
              });
              if (!result.ok) { setMessage(result.error.message); return result; }
              reloadObjectLists();
              setMessage('Единица сохранена.');
              return result;
            });
          }}
          onApplyComposition={(items) => {
            if (selectedObject === null) return;
            void applySystemComposition(selectedObject, items);
          }}
          onOpenType={(typeCode) => {
            setTypesVisible([typeCode], true);
            setJournalIntent({ typeCode, statusTags: new Set() });
            setMode('journal');
          }}
        />
        )}

      </div>

      {/*
        * Окно масштаба открывается само, когда просят круги, а масштаба нет:
        * иначе отказ «масштаб не задан» некуда было бы исправить.
        */}
      {/*
        * Окна проверки расстановки — одной группой (`PlacementScreens`).
        *
        * Масштаб, разбор соответствия и отрезок отвечают на один вопрос и
        * открываются одно из другого. Здесь остаются переходы за их пределы:
        * обводка помещения, карточка здания, сведения помещения и план.
        */}
      <PlacementScreens
        check={check}
        busy={busy}
        backdrop={backdrop}
        calibration={calibration}
        onCalibrate={(backdropId, a, b, realDistanceM) => {
          void runCommand('Задать масштаб плана', () => calibrateByTwoPoints(backdropDeps, {
            backdropId,
            twoPoints: { a, b, realDistanceM },
          })).then((result) => {
            if (result === null) return;
            if (!result.ok) setMessage(result.error.message);
            else void reloadPlan();
          });
        }}
        onExport={(format) => { void exportPlacement(format); }}
        onGoToPlan={() => setMode('plan')}
        /*
         * Кнопка правки обязана привести туда, где правят.
         *
         * Заказчик: «не работает нормально вкладка помещение в карточке узла».
         * Одна из причин — здесь: кнопки «Открыть карточку помещения» и
         * «Открыть карточку здания» закрывали окно проверки и не открывали
         * ничего. Человек читал «не заполнена категория», нажимал кнопку,
         * которая обещает карточку, и оставался на пустом плане.
         *
         * Карточку узла теперь открывает сама кнопка: обещает карточку —
         * показывает карточку.
         */
        onFix={(fix, roomId) => {
          if (fix === 'обводка') {
            startOutline(roomId);
            return;
          }
          if (fix === 'масштаб') {
            // Масштаб задают отрезком на плане: окно масштаба и открывается.
            setMode('plan');
            setScaleOpen(true);
            return;
          }
          if (fix === 'здание') {
            // Характеристика здания живёт в карточке здания: туда и ведём.
            if (buildingNode !== null) setSelectedId(buildingNode.id);
            setCardOpen(true);
            return;
          }
          // Категория, назначение и классы — сведения помещения: они в его
          // карточке, в списке помещений этажа.
          setHazardRoomId(roomId === '' ? null : roomId);
          setMode('plan');
          setCardOpen(true);
        }}
        onShowObject={(object) => {
          setSelectedId(object.nodeId);
          selectObject(object);
          setLibraryCollapsed(false);
        }}
      />

      {movingObjects.length > 0 && (
        <MoveObjectsModal
          objects={movingObjects}
          nodes={nodes}
          busy={busy}
          onClose={() => setMovingObjects([])}
          onConfirm={(target, objectIds) => {
            setMovingObjects([]);
            void runCommand('Переместить объекты', async () => {
              const failed: string[] = [];
              for (const id of objectIds) {
                const moved = await relocateObject(objectDeps, { id, nodeId: target.nodeId });
                if (!moved.ok) { failed.push(moved.error.message); continue; }

                // Полка склада — часть места назначения, а не отдельный шаг:
                // огнетушитель снимают со стены сразу в ремонт.
                if (target.section !== null) {
                  const shelved = await setStorageSection(objectDeps, { id, section: target.section });
                  if (!shelved.ok) failed.push(shelved.error.message);
                }
              }
              return failed;
            }).then((failed) => {
              reloadObjectLists();
              setSelectedIds(new Set());
              if (failed !== null && failed.length > 0) {
                setMessage(`Не удалось перенести ${failed.length} из ${objectIds.length}: ${failed[0] ?? ''}`);
              }
            });
          }}
        />
      )}

      {/*
        * Окна настройки программы — одной группой (`SettingsScreens`).
        *
        * Настройки, регламенты и локальные документы отвечают на один вопрос —
        * «как программа настроена», — открываются одно из другого и пользуются
        * одними сведениями. Здесь остаётся решение, какое из них открыто.
        */}
      <SettingsScreens
        /*
         * Последний рубеж: без права «настройки.править» окно не открывается,
         * какой бы кнопкой его ни позвали. Прятать кнопки нужно — но полагаться
         * только на спрятанные кнопки нельзя: их много, и одну однажды забудут.
         */
        request={can(props.session.user, 'настройки.править') ? settingsRequest : null}
        onClosed={() => setSettingsRequest(null)}
        settings={settings}
        reloadSettings={reloadSettings}
        setMessage={setMessage}
        nodes={nodes}
        selected={selected}
        allObjects={allObjects}
        events={maintenanceEvents}
        regulations={regulationsState}
        backdropRows={backdropScales.rows}
        onSetBackdropScale={(row) => {
          /*
           * Масштаб задают на плане того узла, которому подложка принадлежит:
           * способ «по двум точкам» без плана не работает.
           *
           * Заказчик: «изменить масштаб в настройках — ничего не происходит,
           * выкидывает просто на план». Так и было: окно открывалось тут же, а
           * следом менялся узел — и смена узла закрывала его, потому что
           * проверка расстановки намеренно сбрасывается при переходе на другой
           * этаж. Оставалось только «выкинуло на план».
           *
           * Теперь окно не открывается сразу, а **запоминается**: оно откроется,
           * когда переход к нужному узлу состоится.
           */
          setSettingsRequest(null);
          setSelectedId(row.nodeId);
          setMode('plan');
          setScaleWantedFor(row.nodeId);
        }}
        onEditBackdrop={(row) => { setSettingsRequest(null); props.onEditBackdrop(row.nodeId); }}
        onReplaceBackdrop={(row) => { setSettingsRequest(null); props.onPickBackdrop(row.nodeId); }}
        onExport={exportDocument}
      />

      {batchModalTypeCode !== null && selected !== null && (
        <BatchCreateModal
          typeCode={batchModalTypeCode}
          planKind={planKind}
          hasPlan={planImage !== null}
          rooms={rooms}
          existingObjects={allObjects}
          siteId={selected.siteId}
          busy={batch.busy}
          canSign={signing.canSign}
          signHint={signing.hint}
          signerName={props.session.user?.fullName ?? null}
          onClose={() => setBatchModalTypeCode(null)}
          onCreateNow={(typeCode, regNumbers, common, placeInRoom) => {
            const room = placeInRoom ? rooms.find((item) => item.id === common.roomId) ?? null : null;
            const positions: readonly (PixelPoint | null)[] =
              room?.outline != null ? distributeAlongOutline(room.outline, regNumbers.length) : regNumbers.map(() => null);
            // Окно закрывается уже после ввода пароля: откажись человек от
            // подписи — заполненная форма осталась бы потерянной ни за что.
            signing.withSignature(batchReason(regNumbers.length), (signer) => {
              setBatchModalTypeCode(null);
              void runCommand('Создать несколько объектов',
                () => batch.createBatch(typeCode, regNumbers, common, positions, signer));
            });
          }}
          onStartClickPlacement={(typeCode, regNumbers, common) => {
            signing.withSignature(batchReason(regNumbers.length), () => {
              setBatchQueue({ typeCode, common, regNumbers });
              setBatchModalTypeCode(null);
              setMode('plan');
            });
          }}
        />
      )}

      {importOpen && selected !== null && (
        <JournalImportWizard
          node={selected}
          existingObjects={allObjects}
          busy={batch.busy}
          onClose={() => setImportOpen(false)}
          /*
           * Кто не подписывает — тот и не переносит.
           *
           * Заказчик: «тот, кто не имеет доступа, и менять ничего не может».
           * Перенос заводит записи журнала, а запись журнала без подписи в этой
           * программе не заводится: значит, гостю и человеку с временным
           * паролем переносить нечего.
           */
          canSign={signing.canSign}
          signHint={signing.hint}
          signerName={props.session.user?.fullName ?? null}
          onImport={(importedRows) => {
            signing.withSignature(
              `перенос журнала: ${importedRows.length} ${pluralRu(importedRows.length, 'строка', 'строки', 'строк')}`,
              (signer) => {
                void runCommand(
                  'Импортировать журнал',
                  () => batch.importJournal(importedRows, () => setImportOpen(false), signer),
                );
              },
            );
          }}
        />
      )}

      {historyObject !== null && (
        <ObjectHistoryModal
          object={historyObject}
          events={maintenanceEvents}
          onClose={() => setHistoryObject(null)}
          onOpenSignature={setSignatureEvent}
        />
      )}

      {contextMenu !== null && (
        <ObjectContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onMove={() => {
            // Щелчок по объекту из набора переносит весь набор: человек отметил
            // их именно затем, чтобы действовать над всеми сразу. По объекту вне
            // набора — только его: набор он к этому объекту не относил.
            const object = contextMenu.object;
            setContextMenu(null);
            setMovingObjects(selectedIds.has(object.id)
              ? allObjects.filter((item) => selectedIds.has(item.id))
              : [object]);
          }}
          onReplace={() => {
            setReplaceObjectFor(contextMenu.object);
            setContextMenu(null);
          }}
          onArchive={() => {
            const object = contextMenu.object;
            setContextMenu(null);
            if (!confirmObjectArchive(object)) return;
            void runCommand('Вывести объект из эксплуатации', () => archiveObject(objectDeps, object.id)).then((result) => {
              if (result === null) return;
              if (!result.ok) {
                setMessage(result.error.message);
                return;
              }
              reloadObjectLists();
              if (selectedObjectId === object.id) setSelectedObjectId(null);
            });
          }}
          onShowInJournal={contextMenu.source === 'plan' ? () => {
            setJournalIntent({ typeCode: contextMenu.object.typeCode, statusTags: new Set() });
            setJournalFocusObjectId(contextMenu.object.id); setSelectedId(contextMenu.object.nodeId); selectObject(contextMenu.object); setMode('journal'); setContextMenu(null);
          } : undefined}
          onShowOnPlan={contextMenu.source === 'journal' ? () => {
            setSelectedId(contextMenu.object.nodeId); selectObject(contextMenu.object); setPlanFocusTick((tick) => tick + 1);
            askToFlash(contextMenu.object.id); setMode('plan'); setLibraryCollapsed(false); setContextMenu(null);
          } : undefined}
        />
      )}

      {replaceObjectFor !== null && selected !== null && (
        <ReplaceObjectModal
          allObjects={allObjects}
          nodes={nodes}
          onSwap={(otherId) => {
            const target = replaceObjectFor;
            setReplaceObjectFor(null);
            void runCommand('Поменять объекты местами', () => swapObjects(objectDeps, { firstId: target.id, secondId: otherId })).then((result) => {
              if (result === null) return;
              if (!result.ok) setMessage(result.error.message);
              else reloadObjectLists();
            });
          }}
          object={replaceObjectFor}
          busy={batch.busy}
          onClose={() => setReplaceObjectFor(null)}
        />
      )}

      <ChecklistScreen
        request={openActivity}
        onClose={() => setOpenActivity(null)}
        performer={props.session.user}
        organization={organizationNode?.name ?? null}
        nodes={nodes}
        allObjects={allObjects}
        events={maintenanceEvents}
        settings={settings}
        busy={busy}
        runCommand={runCommand}
        setMessage={setMessage}
        reloadEvents={() => { void reloadEvents(); }}
      />

      {signatureEvent !== null && (
        <MaintenanceSignatureModal
          event={signatureEvent}
          user={props.session.user}
          onClose={() => setSignatureEvent(null)}
          onSaved={(notice) => {
            void reloadEvents();
            setSignatureEvent(null);
            setMessage(notice);
          }}
        />
      )}

      {/*
        * Окно пароля подписи. Одно на все действия, заводящие строки журнала:
        * человек видит здесь, что именно подписывает.
        */}
      {signing.asking !== null && (
        <SignPasswordModal
          reason={signing.asking}
          onCancel={signing.cancel}
          onSubmit={signing.submit}
        />
      )}
    </ScheduleSourceProvider>
  );
}


/**
 * Название режима плана: у здания это генплан, у склада — склад.
 *
 * Пользователь должен видеть в шапке то слово, которым сам называет эту часть
 * работы, а не общее «План» для всего подряд.
 */
function planTitleFor(planKind: string): string {
  if (planKind === 'general') return 'Генплан';
  if (planKind === 'storage') return 'Склад';
  return 'План';
}
