/**
 * План: подложка, обводки помещений и значки объектов СППЗ.
 *
 * Обводка помещения — любой замкнутый многоугольник, а не прямоугольник: в
 * цеховых зданиях помещения редко бывают прямыми. Точки ставятся щелчками,
 * фигура замыкается щелчком по первой точке или кнопкой в карточке.
 *
 * Объекты появляются перетаскиванием из правой панели и переносятся по плану
 * тем же движением. Перетаскивание значка обратно в панель снимает объект с
 * плана — запись в журнале при этом остаётся.
 *
 * Режим «по щелчку» из группового создания (ТЗ, часть 6.3) работает так же,
 * как обводка помещения: каждый щелчок по плану вместо выбора объекта ставит
 * следующий по очереди, счётчик показывает, сколько осталось.
 *
 * Координаты хранятся в точках подложки, поэтому холст работает в системе
 * координат изображения (viewBox): масштаб показа меняется, а записанные точки
 * остаются прежними.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MaintenanceEvent, PixelPoint, PlanObject, Room } from '@izh/contracts';
import {
  categoryColor, placeableObjects, placementCount, placementCondition, systemCondition,
  elementByCode, extinguisherMark, markWithCharge,
  type ObjectCondition, type SystemCondition,
} from '@izh/core';
import { todayIso } from '../today';
import { conditionFilterTags, matchesFilterTags, type FilterTag } from './status-filter';
import { StatusFilterBar } from './StatusFilterBar';
import { pickedObjects, type PickMode } from './plan-selection';
import { arrangeWithoutBackdrop } from './plan-field';
import type { CoverageLayer } from './plan-coverage';
import {
  COVERAGE_COLOR, COVERAGE_DASH, COVERAGE_STROKE_OPACITY_UNCOUNTED, COVERAGE_STROKE_WIDTH_PX,
  COVERAGE_HALO_COLOR, COVERAGE_HALO_OPACITY, COVERAGE_HALO_WIDTH_PX,
  COVERAGE_HATCH_COUNTED, COVERAGE_HATCH_UNCOUNTED,
} from './coverage-style';
import { ElementIcon } from './ElementIcon';
import { useScheduleSource } from '../schedule-source-context';
import { useWheelZoom } from '../use-wheel-zoom';
import { formatScale } from './plan-scale';
import { isPointerDrag, toImagePoint as imagePoint } from './plan-point';

/**
 * Насколько нужно протянуть мышь, чтобы это считалось рамкой, а не щелчком.
 *
 * Меньше — и любое дрожание руки при щелчке рисовало бы пустую рамку.
 */
const DRAG_START_PX = 4;

/** Пока состояние не посчитано, значок не должен врать спокойным цветом. */
const UNKNOWN_CONDITION: ObjectCondition = { schedule: 'нет данных', technical: 'не определено', color: 'unknown' };

export interface PlanCanvasProps {
  /** Подложка необязательна: слой объектов существует и без неё. */
  readonly imageUrl: string | null;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly caption: string;
  readonly rooms: readonly Room[];
  readonly objects: readonly PlanObject[];
  /** Все объекты узла, включая не размещённые: по ним считается состав места хранения. */
  readonly allObjects: readonly PlanObject[];
  readonly selectedObjectId: string | null;
  /** Счётчик показа: меняется при каждом «показать на плане». */
  readonly focusTick: number;
  /**
   * Просьба показать значок: какой и по какому счёту.
   *
   * Держится **снаружи** плана, в главном окне. Заказчик: «при переходе из
   * журнала, нажимая кнопку показать на плане, значок должен мигать».
   *
   * Переход из журнала меняет этаж, а вместе с этажом план пересоздаётся — и
   * всё, что план помнил о просьбе, пропадало вместе с ним. Просьба обязана
   * пережить пересоздание, значит и жить она должна выше.
   *
   * `tick` растёт при каждом нажатии: повторное «показать» на тот же значок —
   * это новая просьба, и мигнуть надо снова.
   */
  readonly flashRequest: { readonly objectId: string; readonly tick: number } | null;
  /** Просьба отработана: значок найден и показан. */
  readonly onFlashed: () => void;
  /** Помещение, которое сейчас обводится. null — обычная работа. */
  readonly drawingRoomId: string | null;
  /**
   * Какую обводку подсветить по просьбе из карточки узла.
   *
   * Заказчик: «добавь кнопку показать на плане — и обводка помещения
   * подсвечивается и пропадает». Просьба живёт выше плана, в главном окне:
   * переход на план пересоздаёт чертёж, и отметка, спрятанная внутри него, не
   * пережила бы этого перехода (тот же урок, что со вспышкой значка, С142).
   */
  readonly flashRoomId: string | null;
  /** Обводка найдена на чертеже и подведена в видимую часть. */
  readonly onRoomShown: () => void;
  /**
   * Уже поставленные точки обводки.
   *
   * Держатся снаружи, а не здесь. Заказчик: «кнопка готово при выделении
   * помещения отображается не там, пускай она отображается там же, в карточке
   * учёта узла». Карточка — там же, где список помещений и кнопка «отметить
   * на плане»; чтобы кнопка «Готово» знала, замкнулась ли фигура, точки должны
   * быть видны и ей.
   */
  readonly outlinePoints: readonly PixelPoint[];
  /** Поставлена очередная точка обводки. */
  readonly onOutlinePoint: (point: PixelPoint) => void;
  /** Существующая вершина обводки передвинута мышью. */
  readonly onOutlinePointMove: (index: number, point: PixelPoint) => void;
  /** Щелчок по первой вершине замыкает готовую границу. */
  readonly onOutlineClose: () => void;
  /** Удалить выбранную вершину при редактировании. */
  readonly onOutlinePointRemove: (index: number) => void;
  /** Помещение, на которое сейчас показывает мышь: подсвечивается только оно. */
  readonly hoveredRoomId: string | null;
  readonly onHoverRoom: (roomId: string | null) => void;
  /** Групповая расстановка по щелчку: сколько объектов ещё не поставлено. null — режим выключен. */
  readonly batchRemaining: number | null;
  /** Объекты закреплены: значки не двигаются мышью (ТЗ, Дополнение 2, часть П3.2). */
  readonly pinned: boolean;
  /** Лента мероприятий — из неё берётся цвет состояния на значке (часть П3.1). */
  readonly events: readonly MaintenanceEvent[];
  readonly soonThresholdDays: number;
  /**
   * Слой проверки расстановки огнетушителей: круги нормы и непокрытые места.
   * null — проверка не запущена или показ кругов выключен.
   */
  readonly coverage: CoverageLayer | null;
  readonly onFinishOutline: (points: readonly PixelPoint[]) => void;
  readonly onCancelOutline: () => void;
  readonly onSelectObject: (objectId: string | null) => void;
  readonly onPlaceElement: (typeCode: string, position: PixelPoint | null) => void;
  readonly onMoveObject: (objectId: string, position: PixelPoint) => void;
  readonly onBatchPlaceClick: (position: PixelPoint) => void;
  readonly onCancelBatchPlacement: () => void;
  /** Правая кнопка мыши по значку — контекстное меню (ТЗ, Дополнение 3, часть К7). */
  readonly onContextMenu: (object: PlanObject, screenPosition: { x: number; y: number }) => void;
  readonly onPickBackdrop?: () => void;
  readonly onDropBackdrop?: (file: { readonly fileName: string; readonly bytes: Uint8Array }) => void;
  readonly hiddenTypes: ReadonlySet<string>;
  readonly onToggleType: (typeCode: string) => void;
  /**
   * Групповое выделение значков: рамкой или обводкой от руки.
   * null — обычная работа, щелчок выбирает один объект.
   */
  /** Куда сдвинута подпись плана. Долями от размеров плана. */
  /**
   * Отмеривание отрезка для масштаба: два щелчка по концам известной стены.
   *
   * Масштаб задают и при загрузке подложки, но там его часто пропускают —
   * а без него круги радиусом нормы не построить. Отмерить стену можно и
   * потом, не уходя с плана.
   */
  readonly measuring: boolean;
  readonly onMeasured: (a: PixelPoint, b: PixelPoint) => void;
  /**
   * Показывать только огнетушители.
   *
   * Включается вместе с кругами покрытия: круги строятся по огнетушителям, и
   * значки прочих систем среди них только мешают смотреть — их на плане
   * десятки, а к норме расстояния они отношения не имеют.
   */
  readonly onlyExtinguishers: boolean;
  /**
   * Масштаб подложки: метров в одной точке чертежа. null — не задан.
   *
   * Из него под планом пишется привычное «М ≈ 1:200».
   */
  readonly metersPerPixel: number | null;
  /**
   * Приближение плана в процентах и его смена.
   *
   * Хранится снаружи, а не здесь: этот холст пересоздаётся при переходе на
   * другой этаж и при возврате из журнала. Своё состояние он бы каждый раз
   * терял, и подобранное приближение сбрасывалось бы на «по окну» — а
   * подбирают его как раз затем, чтобы смотреть этажи один за другим.
   */
  readonly zoom: number;
  readonly onZoom: (zoom: number) => void;
  readonly selectedIds: ReadonlySet<string>;
  /** Выделено мышью: рамкой, обводкой или щелчком по значку. */
  readonly onSelectMany: (objectIds: readonly string[], mode: PickMode) => void;
}

/**
 * Сколько ждать появления значка после команды «показать на плане».
 *
 * Шесть секунд, а не одна. Переход из журнала — это смена этажа: читается
 * дерево, читаются объекты, грузится и разбирается чертёж в две тысячи точек.
 * Секунды на это не хватает, и вспышка, которой человек ждал, не случалась
 * вовсе — а именно ради неё кнопку и нажимают.
 *
 * Ожидание безопасно: оно отменяется, как только пришла следующая команда
 * показа или окно плана закрылось.
 */
const FLASH_ATTEMPTS = 60;
const FLASH_RETRY_MS = 100;

export function PlanCanvas(props: PlanCanvasProps): React.JSX.Element {
  // Регламент организации, а где его нет — нормативная библиотека (Дополнение 5, Р19).
  const scheduleSource = useScheduleSource();
  const points = props.outlinePoints;
  const drawing = props.drawingRoomId !== null;
  const batching = props.batchRemaining !== null;
  /** Рамка выделения: две точки. Обводка: список точек. */
  /*
   * Приближение плана.
   *
   * Задаётся шириной самого плана, а не `zoom` и не `transform`. Подложка
   * растянута на ширину плана, а значки стоят долями от неё — стоит плану
   * стать шире, и чертёж со значками увеличивается вместе, сохраняя
   * взаимное расположение.
   *
   * `zoom` здесь не годится: ширина плана задана процентами от окна, и
   * `zoom` их же и пересчитывал — подложка оставалась прежнего размера, а
   * менялось только то, что задано в точках.
   */
  const zoom = props.zoom;
  /**
   * Величина, заказанная последним нажатием.
   *
   * Нажатия по «+» идут быстрее, чем окно успевает перерисоваться, и все они
   * считались от одной и той же — уже устаревшей — величины: восемь нажатий
   * давали один шаг. Ссылка помнит заказанное, и каждое нажатие прибавляет к
   * нему, а не к нарисованному.
   */
  const wantedZoomRef = useRef(zoom);
  const setZoom = (next: number | ((value: number) => number)): void => {
    const from = wantedZoomRef.current;
    const value = typeof next === 'function' ? next(from) : next;
    wantedZoomRef.current = value;
    props.onZoom(value);
  };
  // Величину меняют и снаружи — колесом, возвратом «по окну»: держим в согласии.
  useLayoutEffect(() => { wantedZoomRef.current = zoom; }, [zoom]);
  /**
   * Ширина, в которой план показан сейчас.
   *
   * Нужна для подписи масштаба: у растровой подложки своего физического
   * размера нет, и отношение «1:200» считается от того, какой ширины
   * чертёж оказался на экране. Меряется наблюдателем, а не при отрисовке:
   * ширина меняется и от окна, и от приближения, и от свёрнутых панелей.
   */
  const stackRef = useRef<HTMLDivElement>(null);
  const [shownWidthPx, setShownWidthPx] = useState(0);
  useEffect(() => {
    const element = stackRef.current;
    if (element === null) return;
    const watch = new ResizeObserver(() => setShownWidthPx(element.getBoundingClientRect().width));
    watch.observe(element);
    setShownWidthPx(element.getBoundingClientRect().width);
    return () => watch.disconnect();
  }, []);

  /** Окно прокрутки плана: по нему колесо держит точку под курсором. */
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element === null) return;
    const measure = (): void => {
      const bounds = element.getBoundingClientRect();
      setViewport({ width: bounds.width, height: bounds.height });
    };
    const watch = new ResizeObserver(measure);
    watch.observe(element);
    measure();
    return () => watch.disconnect();
  }, []);
  useWheelZoom(scrollRef, zoom, setZoom, { min: 50, max: 300, step: 10, plain: true, anchor: true });
  /** Концы отмеряемого отрезка: первый щелчок ставит начало, второй конец. */
  const [measured, setMeasured] = useState<readonly PixelPoint[]>([]);
  const [pickRect, setPickRect] = useState<readonly [PixelPoint, PixelPoint] | null>(null);
  /** Живая точка курсора продолжает последнюю сторону незамкнутой обводки. */
  const [outlineCursor, setOutlineCursor] = useState<PixelPoint | null>(null);
  /** Номер вершины, которую сейчас перетаскивают. */
  const draggedOutlinePoint = useRef<{
    readonly index: number;
    readonly clientX: number;
    readonly clientY: number;
    moved: boolean;
  } | null>(null);
  const suppressVertexClick = useRef(false);
  const [roomTip, setRoomTip] = useState<{ readonly roomId: string; readonly x: number; readonly y: number } | null>(null);

  useEffect(() => {
    if (drawing) return;
    setOutlineCursor(null);
    draggedOutlinePoint.current = null;
    suppressVertexClick.current = false;
  }, [drawing]);
  /**
   * Выделение рамкой — обычным протягиванием мыши по свободному месту плана.
   *
   * Отдельной кнопки «выделить рамкой» нет и не должно быть: во всех
   * графических программах рамку просто тянут. Кнопка заставляла человека
   * сначала объявить намерение, а потом уже выделять.
   *
   * Протягивание отличается от щелчка длиной: короче порога — это щелчок
   * мимо значков, он снимает выделение. Без порога любое дрожание руки при
   * щелчке превращалось бы в пустую рамку.
   */
  const picking = !drawing && !batching && !props.measuring;

  /**
   * Показ значка по команде извне — и только по ней.
   *
   * Заказчик: «значки не таскаются, и всё так же куда-то двигаются при их
   * нажатии». Причина была здесь. Действие срабатывало на любую смену
   * выбранного значка — в том числе на обычный щелчок мышью по плану, — и в тот
   * самый миг, когда человек нажал кнопку и повёл мышь, план начинал плавно
   * прокручиваться. Содержимое уезжало из-под курсора: перетаскивание браузер
   * отменял, а на экране это выглядело как «значок сам куда-то поехал».
   *
   * Теперь действие привязано к счётчику показа. Счётчик растёт только тогда,
   * когда значок велели показать снаружи — из журнала, из дашборда, из окна
   * проверки. От щелчка по самому плану он не меняется, и план стоит на месте.
   */
  // Новый холст может смонтироваться уже с новым счётчиком после перехода с
  // журнала на другой этаж. Нельзя считать такой счётчик уже показанным.
  /**
   * Какой показ уже отыгран.
   *
   * Начинается с нынешнего счётчика, а не с «ничего не показано». Заказчик:
   * «зачем-то при нажатии просто на значок он начинает моргать, причём только
   * первый раз при переходе на подложку».
   *
   * Так и было. Отметка стояла в -1, то есть при появлении плана считалось,
   * что показ **не отыгран**, — а отыграть его было некому: значка на экране
   * ещё нет. Действие ждало и срабатывало на первом же щелчке по любому
   * значку: щелчок задаёт выбранный элемент, значок находится, и старый,
   * никем не запрошенный показ наконец проигрывался.
   */
  const request = props.flashRequest;

  useEffect(() => {
    if (request === null) return;

    /*
     * Значка на экране может ещё не быть: показ пришёл из журнала, вместе с
     * ним сменился этаж, и его объекты дочитываются, а чертёж разбирается.
     * Ждём появления — своим таймером, а не через смену выбранного элемента:
     * на щелчки мышью это ожидание не откликается, и обычный щелчок по значку
     * мигания не вызывает.
     */
    let attempts = 0;
    let timer = 0;
    let done = false;
    const show = (): void => {
      const marker = document.querySelector<HTMLButtonElement>(`[data-object-id="${request.objectId}"]`);
      if (marker === null) {
        attempts += 1;
        if (attempts <= FLASH_ATTEMPTS) timer = window.setTimeout(show, FLASH_RETRY_MS);
        else props.onFlashed();
        return;
      }

      /*
       * Подсветка проигрывается заново без пересоздания кнопки: класс
       * снимается, разметка пересчитывается принудительно, класс
       * возвращается. Иначе браузер не считает анимацию новой и не запускает
       * её второй раз подряд.
       */
      marker.classList.remove('flash');
      void marker.offsetWidth;
      marker.classList.add('flash');
      // Уже видимый значок не центрируем: `nearest` прокручивает, только когда
      // значок действительно оказался за границей видимой области.
      marker.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      done = true;
      props.onFlashed();
    };
    show();

    return () => { if (!done) window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.objectId, request?.tick]);

  /*
   * Показ обводки помещения: дождаться её и подвести к глазам.
   *
   * Ровно то же, что делается для значка выше, и по той же причине. Обводки на
   * экране может ещё не быть: показ пришёл из карточки узла, вместе с ним
   * сменился режим, и чертёж только разбирается. А главное — план бывает
   * увеличен и прокручен в другой угол, и подсвеченная обводка оказывается за
   * краем видимой части. Человек жмёт «показать на плане» и не видит ничего:
   * подсветка есть, но не там, куда он смотрит.
   */
  const flashRoomId = props.flashRoomId;
  const onRoomShown = props.onRoomShown;
  useEffect(() => {
    if (flashRoomId === null) return undefined;

    let attempts = 0;
    let timer = 0;
    let done = false;
    const show = (): void => {
      const shape = document.querySelector<SVGPolygonElement>(`[data-room-id="${flashRoomId}"]`);
      if (shape === null) {
        attempts += 1;
        if (attempts <= FLASH_ATTEMPTS) timer = window.setTimeout(show, FLASH_RETRY_MS);
        else onRoomShown();
        return;
      }
      /*
       * Подводится сразу, без плавной прокрутки.
       *
       * Подсветка живёт три секунды, и тратить их часть на проезд по чертежу
       * незачем: человек нажал кнопку, чтобы увидеть помещение, а не поездку.
       * Плавная прокрутка вдобавок прерывается любой перерисовкой плана — и
       * тогда она не доезжает вовсе.
       */
      shape.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
      done = true;
      onRoomShown();
    };
    show();

    return () => { if (!done) window.clearTimeout(timer); };
  }, [flashRoomId, onRoomShown]);

  /** Точка события в координатах подложки. `null` — у области нет размера. */
  const toImagePoint = (event: { clientX: number; clientY: number }, element: Element): PixelPoint | null =>
    imagePoint(event, element.getBoundingClientRect(), props.widthPx, props.heightPx);

  const finish = (): void => {
    if (points.length >= 3) props.onFinishOutline(points);
  };

  /**
   * Состояние каждого объекта — одно на всю программу: и сроки работ, и
   * исправность, и то и другое по худшей единице комплекта. Считается в ядре,
   * чтобы значок на плане и полоса карточки не расходились (Дополнение 6).
   */
  const conditions = useMemo(() => {
    const today = todayIso();
    const map = new Map<string, ObjectCondition>();
    for (const object of props.objects) {
      map.set(object.id, placementCondition(object, props.allObjects, props.events, today, props.soonThresholdDays, scheduleSource));
    }
    return map;
  }, [props.objects, props.allObjects, props.events, props.soonThresholdDays]);

  /**
   * Второе состояние прибора приёмно-контрольного — по всей его системе.
   *
   * Прибор может быть исправен, а система нет: полсотни извещателей не чищены,
   * и одна зелёная точка об этом молчит. Считается только для приборов: у
   * остальных элементов второго состояния не бывает.
   */
  const systems = useMemo(() => {
    const today = todayIso();
    const map = new Map<string, SystemCondition>();
    for (const object of props.objects) {
      const condition = systemCondition(object, props.allObjects, props.events, today, props.soonThresholdDays, scheduleSource);
      if (condition !== null) map.set(object.id, condition);
    }
    return map;
  }, [props.objects, props.allObjects, props.events, props.soonThresholdDays]);

  /**
   * Нижняя панель фильтра (ТЗ, Дополнение 3, часть К3): чекбоксы состояния и
   * вида системы, множественный выбор, пустой набор — «показать всё». Та же
   * логика и тот же компонент состояния, что и в журнале — заказчик прямо
   * просит единообразие плана и журнала.
   */
  const [statusTags, setStatusTags] = useState<ReadonlySet<FilterTag>>(new Set());

  const toggleStatusTag = (tag: FilterTag): void => {
    setStatusTags((current) => {
      const next = new Set(current);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  // До загрузки подложки координаты не считаются реальными: объекты
  // раскладываются условно и после загрузки окажутся в «Требуют размещения».
  // Единицы комплекта на плане не показываются: место обозначено одной точкой.
  // Отсекать надо до раскладки — на условном поле без подложки она выдала бы
  // каждой единице свою позицию, и в одной комнате появилось бы пять значков.
  const planObjects = placeableObjects(props.objects);
  // Без подложки поле условное, и высота у него своя: столько, сколько нужно
  // всем значкам с подписями.
  const arranged = props.imageUrl === null
    ? arrangeWithoutBackdrop(planObjects, props.widthPx, props.heightPx)
    : null;
  const shownObjects = arranged?.objects ?? planObjects;
  const surfaceHeightPx = arranged?.heightPx ?? props.heightPx;
  const fittedWidthPx = viewport.width > 0 && viewport.height > 0
    ? Math.min(viewport.width - 2, (viewport.height - 2) * (props.widthPx / surfaceHeightPx))
    : 0;
  const renderedWidthPx = fittedWidthPx > 0 ? fittedWidthPx * (zoom / 100) : null;
  const placedAll = shownObjects.filter((object) => object.position !== null);

  const statusCounts = useMemo(() => {
    const counts = new Map<FilterTag, number>();
    for (const object of placedAll) {
      for (const tag of conditionFilterTags(conditions.get(object.id) ?? UNKNOWN_CONDITION)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return counts;
  }, [placedAll, conditions]);

  // Проверка огнетушителей — не фильтр, а отдельный взгляд на план:
  // прочие системы на время убраны, и в счёт скрытого фильтром они не идут.
  const shown = props.onlyExtinguishers
    ? placedAll.filter((object) => object.typeCode.startsWith('extinguisher'))
    : placedAll;
  const placed = shown.filter(
    (object) =>
      !props.hiddenTypes.has(object.typeCode) &&
      matchesFilterTags(conditionFilterTags(conditions.get(object.id) ?? UNKNOWN_CONDITION), statusTags),
  );
  const hidden = shown.length - placed.length;
  const scaleText = formatScale(props.metersPerPixel, props.widthPx, shownWidthPx);
  const filtersActive = statusTags.size > 0 || props.hiddenTypes.size > 0;

  return (
    <div className="plan-canvas">
      {drawing ? (
        <div className="plan-hint">
          Ставьте точки по углам помещения. Поставленные точки можно перетаскивать мышью,
          последнюю — убрать кнопкой «Назад». Замкните фигуру щелчком по первой точке
          или кнопкой «Готово»; правой кнопкой по вершине можно удалить её.
          {points.length > 0 && <> Поставлено точек: {points.length}.</>}
          {points.length > 0 && points.length < 3 && <> Для замкнутой фигуры нужно хотя бы три.</>}
          <button type="button" className="link" onClick={props.onCancelOutline}>
            отменить
          </button>
        </div>
      ) : batching ? (
        <div className="plan-hint">
          Щёлкайте по плану, чтобы поставить объекты по очереди. Осталось: {props.batchRemaining}.
          <button type="button" className="link" onClick={props.onCancelBatchPlacement}>
            отменить
          </button>
        </div>
      ) : props.measuring ? (
        <div className="plan-hint">
          Щёлкните по двум концам стены или пролёта, длину которых знаете, — по ним
          считается масштаб всего плана.
          {measured.length === 1 && <> Начало отмечено, поставьте вторую точку.</>}
        </div>
      ) : null}



      {/*
        * Название узла — строкой над чертежом, а не поверх него.
        *
        * Поверх чертежа подпись всегда кому-то мешает: у одного под ней
        * штамп, у другого вход и лестница. Двигать её приходилось руками
        * на каждом плане. Над чертежом она не закрывает ничего и при
        * печати попадает туда, где ей место, — в заголовок листа.
        */}
      {/*
        * Название узла и кнопки приближения — в одной строке, а не друг поверх
        * друга.
        *
        * Заказчик: «при увеличении масштаба плана накладывается на подпись
        * объекта сверху». Кнопки стояли поверх, углом: пока величина писалась
        * тремя знаками, они не мешали, а «230 %» и «300 %» шире — и уголок
        * наползал на середину строки, где стоит название.
        *
        * Строка разложена на три доли: пустая слева, название по середине,
        * кнопки справа. Название остаётся по центру чертежа, а места кнопок и
        * названия больше не пересекаются ни при какой величине.
        */}
      <div className="plan-head">
        <span />
        <div className="plan-title">{props.caption}</div>
        <div className="plan-zoom-corner">
          <button type="button" title="Отдалить" onClick={() => setZoom((value) => Math.max(50, value - 10))}>−</button>
          <button
            type="button"
            className="plan-zoom-value"
            title="Вернуть по окну"
            onClick={() => setZoom(100)}
          >{zoom} %</button>
          <button type="button" title="Приблизить" onClick={() => setZoom((value) => Math.min(300, value + 10))}>+</button>
        </div>
      </div>
      <div className="plan-scroll" ref={scrollRef}>
      {/*
        * Масштаб — в углу над планом, а не полосой над ним.
        *
        * Полоса занимала строку во всю ширину ради трёх кнопок и оттягивала
        * взгляд от чертежа. В углу они не мешают и всегда под рукой; то же
        * делает колесо мыши.
        */}
      <div
        ref={stackRef}
        className="plan-stack"
        /*
         * Пропорции чертежа передаются разметке всегда: по ним поле вписывает
         * план по высоте. При приближении ограничение по высоте снимается —
         * тогда план и должен вылезать за поле, для того приближение и нужно.
         */
        style={{
          width: renderedWidthPx === null ? `${zoom}%` : `${renderedWidthPx}px`,
          maxWidth: 'none',
          maxHeight: 'none',
          aspectRatio: `${props.widthPx} / ${surfaceHeightPx}`,
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file !== undefined && props.onDropBackdrop !== undefined) {
            void file.arrayBuffer().then((buffer) => props.onDropBackdrop?.({ fileName: file.name, bytes: new Uint8Array(buffer) }));
            return;
          }
          const raw = event.dataTransfer.getData('text/plain');
          if (raw === '') return;
          let payload: { kind?: string; typeCode?: string; id?: string };
          try { payload = JSON.parse(raw) as { kind?: string; typeCode?: string; id?: string }; } catch { return; }
          const point = toImagePoint(event, event.currentTarget);
          if (point === null) return;
          if (payload.kind === 'element' && typeof payload.typeCode === 'string') {
            props.onPlaceElement(payload.typeCode, props.imageUrl === null ? null : point);
          }
          // Закрепление защищает уже расставленное от случайного сдвига, но не
          // мешает заводить новое: добавить объект и подвинуть чужой — разные
          // по цене ошибки.
          if (payload.kind === 'object' && typeof payload.id === 'string' && !props.pinned) {
            props.onMoveObject(payload.id, point);
          }
        }}
      >
        {props.imageUrl === null ? (
          <div className="empty-plan-surface" style={{ aspectRatio: `${props.widthPx} / ${surfaceHeightPx}` }}>
            <strong>Подложка плана не загружена</strong>
            <span className="muted small">Размещённые объекты доступны к работе без подложки.</span>
            <span className="muted small">
              PDF, SVG, DXF, а также PNG, JPEG, GIF, BMP, WebP и TIFF — чертёж, скан или фотография.
              Файл можно и просто перетащить сюда.
            </span>
            {props.onPickBackdrop !== undefined && <button type="button" onClick={props.onPickBackdrop}>Загрузить подложку</button>}
          </div>
        ) : <img key={props.imageUrl} src={props.imageUrl} alt="План" style={{ width: '100%', display: 'block' }} />}

        <svg
          /*
            * Перекрестье — только когда что-то действительно чертят: комнату,
            * партию значков или мерную линию.
            *
            * Раньше сюда входило и `picking`, а оно истинно в обычном
            * состоянии плана — протянуть рамку выделения можно всегда. Из-за
            * этого курсор был перекрестьем над всей подложкой, и план
            * выглядел как чертёж в режиме правки, хотя ничего не правилось.
            */
          className={drawing || batching || props.measuring ? 'plan-overlay drawing' : 'plan-overlay'}
          viewBox={`0 0 ${props.widthPx} ${props.heightPx}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={(event) => {
            if (!picking || event.button !== 0) return;
            const point = toImagePoint(event, event.currentTarget);
            if (point === null) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            setPickRect([point, point]);
          }}
          onPointerMove={(event) => {
            if (drawing) {
              const point = toImagePoint(event, event.currentTarget);
              if (point === null) return;
              setOutlineCursor(point);
              const drag = draggedOutlinePoint.current;
              if (drag !== null) {
                if (!drag.moved && Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) >= DRAG_START_PX) {
                  drag.moved = true;
                }
                if (drag.moved) props.onOutlinePointMove(drag.index, point);
              }
              return;
            }
            if (!picking || pickRect === null) return;
            const point = toImagePoint(event, event.currentTarget);
            if (point === null) return;
            setPickRect((current) => (current === null ? null : [current[0], point]));
          }}
          onPointerUp={(event) => {
            if (!picking || pickRect === null) return;
            setPickRect(null);

            // Короткое движение — это щелчок мимо значков, а не рамка: он
            // снимает выделение, как и раньше по onClick.
            const [from, to] = pickRect;
            if (from === undefined || to === undefined) return;
            if (Math.abs(to.x - from.x) < DRAG_START_PX && Math.abs(to.y - from.y) < DRAG_START_PX) {
              props.onSelectObject(null);
              props.onSelectMany([], 'replace');
              return;
            }

            const inside = pickedObjects(placed, 'rect', pickRect, []);
            props.onSelectMany(inside, event.shiftKey ? 'add' : 'replace');
          }}
          onClick={(event) => {
            if (props.measuring) {
              const point = toImagePoint(event, event.currentTarget);
              if (point === null) return;
              const next = [...measured, point];
              if (next.length < 2) { setMeasured(next); return; }

              const [first, second] = next;
              setMeasured([]);
              if (first !== undefined && second !== undefined) props.onMeasured(first, second);
              return;
            }
            if (batching) {
              const point = toImagePoint(event, event.currentTarget);
              if (point !== null) props.onBatchPlaceClick(point);
              return;
            }
            // Щелчок по пустому месту закрывает карточку и снимает набор, но
            // делает это onPointerUp: он же отличает щелчок от рамки.
            if (!drawing) return;
            const point = toImagePoint(event, event.currentTarget);
            if (point === null) return;
            props.onOutlinePoint(point);
          }}
          onDoubleClick={(event) => {
            if (!drawing) return;
            event.preventDefault();
            finish();
          }}
          onPointerLeave={() => {
            if (draggedOutlinePoint.current === null) setOutlineCursor(null);
          }}
        >
{/*
            * Обведённое помещение не залито цветом постоянно.
            *
            * Заказчик: «после того как мы отметили зону, она не должна
            * постоянно подсвечиваться каким-то цветом. При наведении — да, или
            * при расчёте огнетушителей, в остальных случаях нет». И он прав:
            * заливка по категории закрашивала чертёж целиком, а читают по нему
            * не категории, а линии стен и значки.
            *
            * Граница остаётся всегда — тонкой и приглушённой: без неё нельзя
            * понять, обведено помещение или нет. Заливка появляется при
            * наведении (на фигуру или на строку в списке помещений) и во время
            * проверки расстановки, где цвет и есть предмет разговора.
            */}
          {props.rooms.map((room) => {
            if (room.outline === null) return null;
            const flashing = props.flashRoomId === room.id;
            const lit = props.hoveredRoomId === room.id || flashing;
            return (
              <polygon
                key={room.id}
                data-room-id={room.id}
                className={flashing ? 'room-outline flash' : 'room-outline'}
                points={room.outline.map((point) => `${point.x},${point.y}`).join(' ')}
                fill={categoryColor(room.category)}
                fillOpacity={lit ? 0.25 : 0}
                stroke={categoryColor(room.category)}
                strokeOpacity={lit ? 1 : 0}
                strokeWidth={lit ? 2 : 1}
                pointerEvents="all"
                onPointerEnter={() => props.onHoverRoom(room.id)}
                onPointerMove={(event) => setRoomTip({ roomId: room.id, x: event.clientX + 14, y: event.clientY + 14 })}
                onPointerLeave={() => { props.onHoverRoom(null); setRoomTip(null); }}
              />
            );
          })}

          {/* Проверка расстановки огнетушителей: круги радиуса нормы и точки,
              до которых огнетушитель не достаёт (ППР, пункт 409). Слой поверх
              помещений — иначе заливка помещения прячет и круги, и разрывы. */}
          {props.coverage !== null && (
            <g className="coverage-layer">
              {/*
                * Штриховка вместо сплошной заливки: круги накладываются друг на
                * друга, и сплошная краска в три слоя закрашивает чертёж. Сквозь
                * штриховку планировка видна, а перекрытие кругов читается как
                * более частая сетка — то есть само по себе полезно.
                */}
{/*
                * Шаг сетки, толщина штриха и цвет взяты из общего описания
                * (coverage-style.ts): по нему же рисуется схема в приложении к
                * справке. Заказчик требует, чтобы круг на экране и круг в
                * выгрузке выглядели одинаково, а два отдельных описания
                * совпали бы только случайно.
                */}
              <defs>
                <pattern
                  id="покрытие-штрих"
                  width={COVERAGE_HATCH_COUNTED.stepPx}
                  height={COVERAGE_HATCH_COUNTED.stepPx}
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <line
                    x1="0" y1="0" x2="0" y2={COVERAGE_HATCH_COUNTED.stepPx}
                    stroke={COVERAGE_COLOR}
                    strokeWidth={COVERAGE_HATCH_COUNTED.widthPx}
                    strokeOpacity={COVERAGE_HATCH_COUNTED.opacity}
                  />
                </pattern>
                {/* Непригодный огнетушитель — та же оранжевая штриховка, только
                    реже: круг остаётся кругом нормы, а что он не в счёт —
                    сказано пунктиром обводки и словами в перечне. */}
                <pattern
                  id="покрытие-штрих-редкий"
                  width={COVERAGE_HATCH_UNCOUNTED.stepPx}
                  height={COVERAGE_HATCH_UNCOUNTED.stepPx}
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <line
                    x1="0" y1="0" x2="0" y2={COVERAGE_HATCH_UNCOUNTED.stepPx}
                    stroke={COVERAGE_COLOR}
                    strokeWidth={COVERAGE_HATCH_UNCOUNTED.widthPx}
                    strokeOpacity={COVERAGE_HATCH_UNCOUNTED.opacity}
                  />
                </pattern>
              </defs>
              {/* Круги оранжевые: это круг нормы, и он один и тот же для всех.
                  Зачтённый обведён сплошной линией, незачтённый пунктиром — но
                  цветом они не различаются, иначе половина плана оказывается
                  серой там, где просто не заполнены карточки. */}
              {/*
                * Круг зоны заштрихован всегда.
                *
                * Заказчик: «ещё раз говорю, нужно чтобы круги имели штриховку».
                * Прежде штриховка ложилась только внутрь обведённых помещений —
                * я решил, что без обводок заливать нечего. Решение было моё, а
                * не его: на этажах, где помещения не обведены (а таких у него
                * большинство), от круга оставалась одна дуга, и проверка
                * выглядела пустой.
                *
                * Так рисуют и на бумажных схемах в справках: зона обслуживания
                * огнетушителя — заштрихованный круг, и обводки помещений тут
                * ни при чём. Плотность штриховки подобрана так, чтобы чертёж
                * сквозь неё читался (coverage-style.ts).
                */}
              {props.coverage.circles.map((circle) => (
                <circle
                  key={`заливка-${circle.key}`}
                  cx={circle.x}
                  cy={circle.y}
                  r={circle.radiusPx}
                  fill={circle.counted ? 'url(#покрытие-штрих)' : 'url(#покрытие-штрих-редкий)'}
                  stroke="none"
                />
              ))}
              {props.coverage.circles.map((circle) => (
                <g key={circle.key}>
                  {/* Белая подложка не меняет границу нормы, но отделяет одну
                      окружность от другой и от чёрных линий чертежа. */}
                  <circle
                    cx={circle.x}
                    cy={circle.y}
                    r={circle.radiusPx}
                    fill="none"
                    stroke={COVERAGE_HALO_COLOR}
                    vectorEffect="non-scaling-stroke"
                    strokeWidth={COVERAGE_HALO_WIDTH_PX}
                    strokeOpacity={COVERAGE_HALO_OPACITY}
                    {...(circle.counted ? {} : { strokeDasharray: COVERAGE_DASH.join(' ') })}
                  />
                  <circle
                    cx={circle.x}
                    cy={circle.y}
                    r={circle.radiusPx}
                    fill="none"
                    stroke={COVERAGE_COLOR}
                    /*
                     * Обводка не сжимается вместе с планом.
                     *
                     * Толщина здесь задана в точках чертежа, а чертёж вписан в
                     * окно: на плане в две тысячи точек, показанном на тысяче,
                     * линия в два пикселя превращалась в один — отсюда и
                     * «плохо видно». non-scaling-stroke держит её постоянной на
                     * экране, каким бы ни был чертёж и приближение.
                     */
                    vectorEffect="non-scaling-stroke"
                    strokeWidth={COVERAGE_STROKE_WIDTH_PX}
                    strokeOpacity={circle.counted ? 1 : COVERAGE_STROKE_OPACITY_UNCOUNTED}
                    {...(circle.counted ? {} : { strokeDasharray: COVERAGE_DASH.join(' ') })}
                  />
                </g>
              ))}
              {/*
                * Красных точек непокрытых мест нет.
                *
                * Заказчик: «красные точки не отображаются, но они и не нужны —
                * просто пусть будут круги, и там, где они не покрывают объект,
                * пользователь сам увидит». Так и есть: незакрытое место видно
                * по самой картине, а точки поверх неё только добавляли ряби.
                * Само вычисление разрывов остаётся — по нему проверка считает
                * долю покрытия и пишет вывод словами.
                */}
            </g>
          )}

          {/* Рамка и обводка выделения: показываются, пока ведут мышь. */}
          {pickRect !== null && (
            <rect
              x={Math.min(pickRect[0].x, pickRect[1].x)}
              y={Math.min(pickRect[0].y, pickRect[1].y)}
              width={Math.abs(pickRect[1].x - pickRect[0].x)}
              height={Math.abs(pickRect[1].y - pickRect[0].y)}
              fill="rgba(37,99,235,.12)"
              stroke="#2563eb"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          )}

          {measured.map((point, index) => (
            <circle key={`мера-${index}`} cx={point.x} cy={point.y} r={5} fill="#ea580c" />
          ))}

          {points.length > 0 && (
            <polyline
              points={points.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke="#2563eb"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {points.length > 0 && outlineCursor !== null && (
            <line
              x1={points[points.length - 1]?.x}
              y1={points[points.length - 1]?.y}
              x2={outlineCursor.x}
              y2={outlineCursor.y}
              stroke="#2563eb"
              strokeWidth={2}
              strokeDasharray="6 4"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
          {points.map((point, index) => (
            <g key={`вершина-${index}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r={12}
                fill="transparent"
                stroke="transparent"
                className="outline-point-hit"
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  event.stopPropagation();
                  draggedOutlinePoint.current = {
                    index, clientX: event.clientX, clientY: event.clientY, moved: false,
                  };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerUp={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  suppressVertexClick.current = draggedOutlinePoint.current?.moved ?? false;
                  draggedOutlinePoint.current = null;
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                }}
                onPointerCancel={(event) => {
                  event.stopPropagation();
                  draggedOutlinePoint.current = null;
                  suppressVertexClick.current = false;
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (suppressVertexClick.current) {
                    suppressVertexClick.current = false;
                    return;
                  }
                  if (index === 0 && points.length >= 3) props.onOutlineClose();
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (points.length > 3) props.onOutlinePointRemove(index);
                }}
                aria-label={index === 0 && points.length >= 3
                  ? 'Замкнуть границу помещения'
                  : 'Перетащить вершину; правой кнопкой удалить'}
              />
              <circle
                cx={point.x}
                cy={point.y}
                r={5}
                fill="#2563eb"
                stroke="#ffffff"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            </g>
          ))}
        </svg>

        {/* Значки объектов лежат отдельным слоем: их нужно таскать мышью, а
            перетаскивание элементов SVG в браузере не работает. */}
        {placed.map((object) => (
          /*
           * Ключ значка — его номер, и только он.
           *
           * Прежде в ключ выбранного значка входил счётчик показа: так
           * перезапускалась подсветка после «показать на плане». Цена
           * оказалась несоразмерной. Ключ менялся в тот же миг, когда по
           * значку нажимали мышью, — React выбрасывал кнопку и создавал новую,
           * а вместе со старой пропадало и начатое перетаскивание. Заказчик:
           * «элементы на плане перестали перетаскиваться; при нажатии мышкой
           * на элемент его тяжело поймать».
           *
           * Подсветка перезапускается иначе — снятием и возвратом класса на
           * той же самой кнопке (смотри действие ниже). Значок при этом
           * остаётся на месте, и перетаскивание не рвётся.
           */
          <ObjectMarker
            key={object.id}
            object={object}
            unitCount={placementCount(props.allObjects, object)}
            widthPx={props.widthPx}
            heightPx={surfaceHeightPx}
            selected={object.id === props.selectedObjectId}
            picked={props.selectedIds.has(object.id)}
            condition={conditions.get(object.id) ?? UNKNOWN_CONDITION}
            system={systems.get(object.id) ?? null}
            /*
             * Значок не таскается, только когда объекты закреплены или
             * подложки нет вовсе. Раньше сюда добавлялось и «идёт выделение» —
             * при отдельном режиме рамки это было верно. Теперь рамку тянут
             * обычным движением по свободному месту, и «идёт выделение»
             * означает попросту «ничего не происходит»: значки от такого
             * условия переставали двигаться совсем.
             */
            pinned={props.pinned || props.imageUrl === null}
            transparent={props.measuring}
            onSelect={(withCtrl) => {
              /*
               * Простой щелчок открывает карточку. Набор собирается только с
               * Ctrl или рамкой.
               *
               * Здесь стояло ещё и «идёт выделение» — при отдельном режиме рамки
               * это было верно. После перехода на обычное протягивание мышью
               * (часть С92) выделение идёт всегда, и щелчок по значку перестал
               * открывать карточку вовсе: вместо неё объект молча попадал в набор.
               */
              if (withCtrl) props.onSelectMany([object.id], 'toggle');
              else props.onSelectObject(object.id);
            }}
            onMove={(position) => props.onMoveObject(object.id, position)}
            onContextMenu={(screenPosition) => props.onContextMenu(object, screenPosition)}
          />
        ))}
      </div>

      {roomTip !== null && (() => {
        const room = props.rooms.find((item) => item.id === roomTip.roomId);
        if (room === undefined) return null;
        return (
          <div className="room-plan-tooltip" style={{ left: roomTip.x, top: roomTip.y }}>
            <strong>{room.name}{room.number === null ? '' : ` № ${room.number}`}</strong>
            <span>Категория: {room.category ?? 'не задана'}</span>
            <span>Площадь: {room.areaM2 === null ? 'не рассчитана' : `${room.areaM2.toFixed(2)} м²`}</span>
          </div>
        );
      })()}
      </div>

      {/*
        * Масштаб под чертежом — как на бумажном плане.
        *
        * Отношение считается от того размера, в котором план показан сейчас:
        * у растровой подложки своего физического размера нет. Поэтому запись
        * меняется при приближении — увеличили вдвое, масштаб стал вдвое
        * крупнее, — и поэтому она приблизительная: точка CSS считается по
        * стандартным 96 на дюйм, а у монитора их бывает 92 или 110.
        */}
      {scaleText !== '' && (
        <div
          className="plan-scale-note"
          title="Отношение к тому, что показано на экране сейчас; при приближении меняется"
        >{scaleText}</div>
      )}

      {/* Нижняя панель фильтра (ТЗ, Дополнение 3, часть К3): та же строка
          состояния, что и в журнале, плюс чекбоксы видов оборудования,
          реально присутствующих на этом плане. */}
      <div className="plan-bottom-filter">
        <StatusFilterBar selected={statusTags} onToggle={toggleStatusTag} counts={statusCounts} />
        {filtersActive && hidden > 0 && <span className="muted small">Скрыто фильтром: {hidden}.</span>}
      </div>
    </div>
  );
}

interface ObjectMarkerProps {
  readonly object: PlanObject;
  /** Сколько единиц лежит в этом месте: у комплекта на плане одна точка. */
  readonly unitCount: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly selected: boolean;
  /** Объект попал в групповое выделение. */
  readonly picked: boolean;
  /**
   * Значок не перехватывает щелчки.
   *
   * Нужно, пока отмеряют отрезок: точку ставят по чертежу, и попасть в неё
   * мешал бы значок, лежащий сверху.
   */
  readonly transparent: boolean;
  readonly condition: ObjectCondition;
  /** Состояние всей системы — только у прибора приёмно-контрольного. */
  readonly system: SystemCondition | null;
  readonly pinned: boolean;
  /**
   * Щелчок по значку. `withCtrl` — держали Ctrl или ⌘.
   *
   * С Ctrl набирают группу, не переключая режимов: так привыкли работать
   * со списками файлов, и объяснять это никому не приходится.
   */
  readonly onSelect: (withCtrl: boolean) => void;
  /** Завершённый перенос значка. Короткое нажатие сюда не попадает. */
  readonly onMove: (position: PixelPoint) => void;
  readonly onContextMenu: (screenPosition: { x: number; y: number }) => void;
}

interface MarkerPress {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly withCtrl: boolean;
}

/**
 * Значок объекта на плане.
 *
 * Цвет заливки говорит, что это за оборудование, а ободок — в каком оно
 * состоянии (часть П3.1). Две разные вещи показаны разными средствами
 * намеренно: перекрасив сам значок по состоянию, мы потеряли бы вид системы,
 * а по плану чаще всего ищут именно «где тут краны».
 */
function ObjectMarker(props: ObjectMarkerProps): React.JSX.Element | null {
  const pressRef = useRef<MarkerPress | null>(null);
  const draggingRef = useRef(false);
  const [dragOffset, setDragOffset] = useState<PixelPoint>({ x: 0, y: 0 });
  const position = props.object.position;
  if (position === null) return null;

  const element = elementByCode(props.object.typeCode);
  /*
   * Марка показывается только у огнетушителей: у извещателя или клапана такого
   * обозначения нет, и скобки под значком были бы пустыми.
   */
  const mark = props.object.typeCode.startsWith('extinguisher')
    ? markWithCharge(
      extinguisherMark(props.object.typeCode, props.object.extinguisherProfile ?? null),
      props.object.extinguisherProfile ?? null,
    )
    : null;
  const classes = ['object-marker'];
  if (props.selected) classes.push('selected');
  // Групповое выделение показывается иначе, чем открытая карточка: это
  // разные вещи, и путать их нельзя — из группы карточку не открывают.
  if (props.picked) classes.push('picked');
  if (props.transparent) classes.push('transparent');
  if (draggingRef.current) classes.push('dragging');

  const finishPointer = (event: React.PointerEvent<HTMLButtonElement>, cancelled: boolean): void => {
    const press = pressRef.current;
    if (press === null || press.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const dragged = draggingRef.current;
    pressRef.current = null;
    draggingRef.current = false;
    setDragOffset({ x: 0, y: 0 });
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (cancelled) return;

    if (!dragged) {
      props.onSelect(press.withCtrl);
      return;
    }
    const stack = event.currentTarget.closest('.plan-stack');
    if (stack === null) return;
    const next = imagePoint(event, stack.getBoundingClientRect(), props.widthPx, props.heightPx);
    if (next !== null) props.onMove(next);
  };

  return (
    <button
      type="button"
      className={classes.join(' ')}
      data-object-id={props.object.id}
      style={{
        left: `${(position.x / props.widthPx) * 100}%`,
        top: `${(position.y / props.heightPx) * 100}%`,
        background: 'transparent',
        ...(dragOffset.x === 0 && dragOffset.y === 0
          ? {}
          : { transform: `translate(calc(-50% + ${dragOffset.x}px), calc(-50% + ${dragOffset.y}px))` }),
      }}
      title={`${element?.title ?? props.object.typeCode}${props.object.regNumber === null ? '' : ` № ${props.object.regNumber}`}`
        + ` — ${props.condition.technical}; сроки: ${props.condition.schedule}`
        + (props.pinned ? '. Объекты закреплены: значок не двигается' : '')}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        /*
         * Ввод переводится на кнопку самими руками — и без прокрутки.
         *
         * Заказчик: «значки на плане при нажатии мышкой куда-то дёргаются».
         * Браузер, устанавливая ввод на нажатую кнопку, подкручивает к ней
         * прокручиваемые области — и на большом плане значок в этот миг уезжал
         * из-под курсора. Сделать это самим с `preventScroll` дешевле, чем
         * бороться с последствиями: установка ввода нужна (с клавиатуры по
         * значкам ходят), а прокрутка при ней — нет.
        */
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        pressRef.current = {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          withCtrl: event.ctrlKey || event.metaKey,
        };
      }}
      onPointerMove={(event) => {
        const press = pressRef.current;
        if (press === null || press.pointerId !== event.pointerId || props.pinned) return;
        const x = event.clientX - press.clientX;
        const y = event.clientY - press.clientY;
        if (!draggingRef.current && !isPointerDrag(press, event, DRAG_START_PX)) return;
        draggingRef.current = true;
        setDragOffset({ x, y });
      }}
      onPointerUp={(event) => finishPointer(event, false)}
      onPointerCancel={(event) => finishPointer(event, true)}
      onClick={(event) => {
        event.stopPropagation();
        // detail=0 — Enter/пробел с клавиатуры. Мышь уже обработана pointerup.
        if (event.detail === 0) props.onSelect(event.ctrlKey || event.metaKey);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        props.onContextMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      <ElementIcon typeCode={props.object.typeCode} size="plan" />
      {/*
        * Подпись под значком: номер, а под ним марка огнетушителя.
        *
        * Заказчик: «значки огнетушителей пусть показывают учётный номер и в
        * скобках ниже вид огнетушителя — ОП-5, ОУ-8, ОВП-10. Если учётного
        * номера нет, показывать просто вид в скобках».
        *
        * Марка берётся тем же расчётом, что и проверка расстановки
        * (`extinguisherMark` и `markWithCharge`): обозначение по виду или по
        * огнетушащему веществу карточки, а через дефис — заряд. Второго
        * вычисления заводить нельзя, иначе на плане и в проверке однажды
        * окажутся разные марки одного и того же огнетушителя.
        *
        * У комплекта номер одной штуки бессмыслен: на плане место, а в нём
        * несколько единиц. Показывается их число (Дополнение 6).
        */}
      <span className="marker-label">
        {props.unitCount > 1 ? (
          `(${props.unitCount} шт.)`
        ) : (
          <>
            {props.object.regNumber !== null && (
              <span className="marker-number">{props.object.regNumber}</span>
            )}
            {mark !== null && <span className="marker-kind">({mark})</span>}
            {props.object.regNumber === null && mark === null
              && (props.object.model ?? 'Без номера')}
          </>
        )}
      </span>
      {/* Маленькая точка в углу значка, а не подсветка всей рамки — по образцу
          заказчика: индикация состояния «не должна занимать много места». */}
      <span
        className={`marker-status-dot marker-${props.condition.color}`}
        title={`Состояние прибора: ${props.condition.schedule}`}
      />
      {/* Вторая точка — состояние системы целиком. Стоит ниже первой, чтобы
          их нельзя было спутать: верхняя всегда про сам элемент. */}
      {props.system !== null && (
        <span
          className={`marker-status-dot marker-system marker-${props.system.whole.color}`}
          title={`Состояние системы (${props.system.memberCount} элементов): ${props.system.whole.schedule}`}
        />
      )}
    </button>
  );
}
