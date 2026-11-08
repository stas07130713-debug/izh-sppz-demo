/**
 * Главное окно: подложка плана — создание, очистка, масштаб.
 *
 * Здесь только состояние интерфейса и связывание частей. Вся содержательная
 * работа — в сценариях ядра и в движке E1; этот файл не считает ничего сам.
 */

import { useCallback, useEffect, useState } from 'react';
import type {
  BackdropCleanup,
  CleanupOperation,
  EraseArea,
  PdfDocumentInfo,
  PixelPoint,
  PixelRect,
  PlanBackdrop,
  PlanCalibration,
  QuarterTurn,
  TreeNode,
} from '@izh/contracts';
import { CLEANUP_ENGINE_VERSION, describeUnknown } from '@izh/contracts';
import {
  applyBackdropCleanup,
  calibrateByBuildingExtents,
  calibrateByDrawingScale,
  calibrateByTwoPoints,
  createBackdropFromSource,
  createBackdropFromPdf,
  planCaption,
  unplaceNodeObjects,
  acceptLegal,
  needsLegalAcceptance,
  LEGAL_VERSION,
} from '@izh/core';
import { changesExtent, planSourceEngine } from '@izh/engine-plan-source';
import { accessDeps, deps, objectDeps } from './deps';
import { BackdropList } from './components/BackdropList';
import { BackdropEraser, type EraserTool } from './components/BackdropEraser';
import {
  BackdropViewer, type OverlayPolygon, type OverlayRect, type ViewerMode,
} from './components/BackdropViewer';
import { CalibrationPanel } from './components/CalibrationPanel';
import { AppHeader } from './components/AppHeader';
import { ImportWizard } from './components/ImportWizard';
import { MainScreen } from './components/MainScreen';
import { useStoredImageUrl } from './use-backdrop-workspace';
import { useCommandHistory } from './use-command-history';
import { useSession } from './use-session';
import { SignInScreen } from './components/SignInScreen';
import { LegalConsentScreen } from './components/LegalConsentScreen';
import { AccountPanel } from './components/AccountPanel';
import { messageTone } from './message-tone';

interface PendingPdf {
  readonly fileName: string;
  readonly bytes: Uint8Array;
  readonly documentInfo: PdfDocumentInfo;
  /** Узел дерева, для которого готовится подложка: здание или этаж. */
  readonly nodeId: string | null;
}

export function App(): React.JSX.Element {
  const [backdrops, setBackdrops] = useState<readonly PlanBackdrop[]>([]);
  const [calibratedIds, setCalibratedIds] = useState<ReadonlySet<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [calibration, setCalibration] = useState<PlanCalibration | null>(null);
  const [cleanup, setCleanup] = useState<BackdropCleanup | null>(null);
  /** Обводка габаритов здания — для масштаба. */
  const [drawingExtents, setDrawingExtents] = useState(false);
  /**
   * Обрезка подложки: выделяют область, потом подтверждают.
   *
   * Два шага, а не один: выделение мышью легко промахнуться, и обрезать сразу
   * по отпусканию кнопки значило бы портить чертёж на каждое неловкое движение.
   * Пока область не подтверждена, она только нарисована поверх.
   */
  const [cropping, setCropping] = useState(false);
  const [cropRect, setCropRect] = useState<PixelRect | null>(null);
  const [extentsRect, setExtentsRect] = useState<PixelRect | null>(null);
  /**
   * Стирание лишнего: сначала выделяют, потом стирают.
   *
   * Два шага по той же причине, что и у обрезки: стирать по отпусканию
   * кнопки значило бы портить чертёж на каждое неловкое движение мышью.
   * Пока не подтверждено, выделенное только нарисовано поверх.
   */
  const [eraserTool, setEraserTool] = useState<EraserTool | null>(null);
  const [pendingErase, setPendingErase] = useState<readonly CleanupOperation[]>([]);
  /**
   * Убирать внутри выделенного только цветное.
   *
   * Настройка выделения, а не отдельный инструмент: обводят одинаково, а
   * разница в том, что внутри обводки гибнет. Стрелку эвакуации поперёк
   * коридора иначе не снять — вместе с ней уходит и коридор.
   */
  const [colorOnly, setColorOnly] = useState(false);
  /**
   * Перо: цвет и толщина линии в точках чертежа.
   *
   * Чёрный по умолчанию — линии здания на чертеже чёрные, и дорисованная
   * перегородка должна выглядеть так же, а не выделяться цветом.
   */
  const [penColor, setPenColor] = useState('#111827');
  const [penWidthPx, setPenWidthPx] = useState(4);
  /** Начало прямой линии: первый щелчок. null — линию ещё не начали. */
  const [lineFrom, setLineFrom] = useState<PixelPoint | null>(null);
  const [points, setPoints] = useState<readonly PixelPoint[]>([]);
  const [pickingPoints, setPickingPoints] = useState(false);
  const [pendingPdf, setPendingPdf] = useState<PendingPdf | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Выполняет длинную работу, показывая занятость.
   *
   * Занятость снимается в `finally`, а не после вызова. Сорвавшаяся работа —
   * упавший разбор PDF, нехватка памяти при большом разрешении, ошибка
   * движка при правке чертежа — иначе оставляла её включённой до перезапуска
   * программы. А при включённой занятости поля и кнопки экрана подложки
   * заблокированы: человек щёлкает по графе, курсор в неё не встаёт, ввести
   * ничего нельзя, и программа выглядит сломанной без единого сообщения.
   *
   * Тот же урок уже записан в `use-object-tree.ts`. Здесь он повторён,
   * потому что счётчик занятости у экрана подложки свой.
   */
  const withBusy = async <T,>(action: () => Promise<T>): Promise<T> => {
    setBusy(true);
    try {
      return await action();
    } finally {
      setBusy(false);
    }
  };
  const [message, setMessage] = useState<string | null>(null);
  const [dataDir, setDataDir] = useState('');
  const [backdropCaption, setBackdropCaption] = useState<string | null>(null);
  /**
   * Узел, на план которого вернуться с подготовки подложки.
   *
   * Заказчик: «при нажатии «Всё готово» подложка не появляется на ПЛАНЕ;
   * нужно, чтобы пользователь оказывался на странице этого Плана». Главный
   * экран при уходе сюда разбирается, и по возвращении он начинал с чистого
   * листа — не на том узле, чей чертёж только что правили.
   */
  const [openPlanAt, setOpenPlanAt] = useState<string | null>(null);
  /**
   * Какой экран открыт. Программа начинается с главного экрана: пока не заведены
   * площадка и здание, подложке не к чему привязываться.
   *
   * «Подложка» и «Импорт плана» — подготовительные операции с чертежом. Они
   * останутся отдельными до тех пор, пока подложка не привяжется к этажу; после
   * этого они уйдут внутрь вкладки «План» главного экрана.
   */
  // Дашборд перестал быть отдельным экраном: он стал режимом рабочей области,
  // потому что показывает состояние выбранного узла дерева, а не программы
  // целиком (ТЗ, Дополнение 2, часть П2).
  const [screen, setScreen] = useState<'main' | 'backdrop'>('main');
  /**
   * Кто работает сейчас.
   *
   * Пока не вошли, программа не показывается вовсе: у каждого действия
   * должен быть автор — иначе ни журнал изменений, ни подпись невозможны.
   */
  const session = useSession();
  /*
   * Элемент, к которому просят перейти из истории действий кабинета.
   *
   * Держится здесь, а не в кабинете: кабинет закрывается, а переход должен
   * пережить его закрытие и дойти до окна программы.
   */
  const [activityTarget, setActivityTarget] =
    useState<{ readonly objectId: string | null; readonly nodeId: string | null } | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [treeNodes, setTreeNodes] = useState<readonly TreeNode[]>([]);

  useEffect(() => {
    if (session.user === null) return;
    // Дерево нужно личному кабинету и списку пользователей: область прав
    // выдаётся его узлами, и показывать их надо названиями, а не кодами.
    void window.izh.tree.list().then((result) => {
      if (result.ok) setTreeNodes(result.value);
    });
  }, [session.user]);

  const selected = backdrops.find((b) => b.id === selectedId) ?? null;

  /*
   * Что показывается: подложка или её очищенная копия.
   *
   * Правка — обрезка и стирание лишнего — хранится списком действий отдельно
   * от файла и применяется к исходнику заново при каждом изменении. Поэтому
   * показывается очищенная копия, когда правка есть, и размеры берутся из неё:
   * после обрезки чертёж другого размера.
   */
  const displayUrl = useStoredImageUrl(selected, cleanup);
  const displayWidth = cleanup?.widthPx ?? selected?.widthPx ?? 0;
  const displayHeight = cleanup?.heightPx ?? selected?.heightPx ?? 0;

  const refreshList = useCallback(async (): Promise<void> => {
    const list = await deps.backdrops.list();
    if (!list.ok) {
      setMessage(list.error.message);
      return;
    }
    setBackdrops(list.value);

    const calibrated = new Set<string>();
    for (const item of list.value) {
      const found = await deps.backdrops.getCalibration(item.id);
      if (found.ok && found.value !== null) calibrated.add(item.id);
    }
    setCalibratedIds(calibrated);
  }, []);

  /**
   * Правка подложки — такое же действие программы, как всё остальное.
   *
   * Каждое стирание, поворот и обрезка записываются в общую историю, и
   * кнопки «назад» и «вперёд» в шапке откатывают их по одному. Раньше их
   * там не было вовсе: стёр лишнее — и вернуть можно было только весь
   * исходный чертёж, потеряв всю работу над ним.
   *
   * После отката перечитывается и список подложек, и правка выбранной: откат
   * меняет хранилище, а показанное считается от него.
   */
  const reloadBackdrop = useCallback((): void => {
    void refreshList();
    if (selectedId === null) return;
    void deps.backdrops.getCleanup(selectedId).then((result) => {
      if (!result.ok) return;
      const stored = result.value;
      setCleanup(stored !== null && stored.engineVersion === CLEANUP_ENGINE_VERSION ? stored : null);
    });
    void deps.backdrops.getCalibration(selectedId).then((result) => {
      if (result.ok) setCalibration(result.value);
    });
  }, [refreshList, selectedId]);
  // Автор нужен журналу изменений: запись без ответа на «кто изменил»
  // бесполезна. До входа значимых изменений не бывает.
  const history = useCommandHistory(reloadBackdrop, session.user);

  /*
   * Возвращаясь к подготовке подложки, программа перечитывает состояние
   * истории.
   *
   * Главный экран ведёт свой счёт того же журнала и создаётся заново при каждом
   * возврате, а этот — нет: без перечитывания кнопка «назад» здесь оставалась бы
   * недоступной после действий, сделанных на главном экране.
   */
  useEffect(() => {
    if (screen === 'backdrop') void history.reload();
  }, [screen, history]);

  useEffect(() => {
    void refreshList();
    void window.izh.dataDir().then((result) => {
      if (result.ok) setDataDir(result.value);
    });
  }, [refreshList]);

  // Загрузка сохранённых сведений о выбранной подложке.
  useEffect(() => {
    setCalibration(null);
    setCleanup(null);
    setBackdropCaption(null);
    setExtentsRect(null);
    setCropRect(null);
    setCropping(false);
    setPoints([]);
    setDrawingExtents(false);
    setPickingPoints(false);
    if (selectedId === null) return;

    void deps.backdrops.getCalibration(selectedId).then((result) => {
      if (result.ok) setCalibration(result.value);
    });
    void deps.backdrops.getCleanup(selectedId).then((result) => {
      // Правку больше не задают, но раньше заданную читают: иначе подложка
      // вернулась бы к необрезанному виду, и расставленные значки уехали бы.
      if (result.ok && result.value !== null) {
        setCleanup(result.value.engineVersion === CLEANUP_ENGINE_VERSION ? result.value : null);
      }
    });
  }, [selectedId]);

  useEffect(() => {
    if (selected === null) {
      setBackdropCaption(null);
      return;
    }
    if (selected.nodeId === null) {
      setBackdropCaption(`Подложка: ${selected.sourceFileName}`);
      return;
    }

    void window.izh.tree.list().then((result) => {
      if (!result.ok) {
        setBackdropCaption(`Подложка: ${selected.sourceFileName}`);
        return;
      }
      const nodes: readonly TreeNode[] = result.value;
      const found = nodes.some((node) => node.id === selected.nodeId);
      setBackdropCaption(found ? planCaption(nodes, selected.nodeId ?? '') : `Подложка: ${selected.sourceFileName}`);
    });
  }, [selected]);

  const openFile = async (): Promise<void> => {
    setMessage(null);
    const opened = await window.izh.openPlanFile();
    if (!opened.ok) return setMessage(opened.error.message);
    if (opened.value === null) return;
    await acceptPlanFile(opened.value.fileName, opened.value.bytes);
  };

  /**
   * Принимает файл подложки — из диалога выбора или брошенный в рабочую область.
   * Тип определяется по содержимому файла, а не по расширению.
   */
  const acceptPlanFile = async (
    fileName: string,
    bytes: Uint8Array,
    nodeId: string | null = null,
  ): Promise<void> => {
    setMessage(null);
    const kind = planSourceEngine.detectKind(bytes);

    if (kind === 'pdf') {
      const info = await withBusy(() => planSourceEngine.probePdf(bytes));
      if (!info.ok) return setMessage(info.error.message);
      setPendingPdf({ fileName, bytes, documentInfo: info.value, nodeId });
      return;
    }

    if (kind === 'image' || kind === 'svg' || kind === 'dxf' || kind === 'json') {
      const created = await withBusy(() => createBackdropFromSource(deps, {
        sourceBytes: bytes,
        sourceFileName: fileName,
        nodeId,
      }));
      if (!created.ok) return setMessage(created.error.message);
      // Чертёж у узла другой — значки на нём стоять уже не могут.
      await unplaceOnNode(nodeId);
      await refreshList();
      setSelectedId(created.value.id);
      return;
    }

    /*
     * Что программа читает, она читает сама; чего не читает — говорит прямо и
     * называет выход. Принять DWG или Visio и показать вместо чертежа пустоту
     * было бы хуже отказа: человек решил бы, что подложка загружена.
     */
    setMessage(
      'Этот файл прочитать не удалось. Программа принимает PDF, SVG, DXF и любые растровые изображения — '
      + 'PNG, JPEG, GIF, BMP, WebP, TIFF: чертежи, сканы и фотографии. '
      + 'Чертежи AutoCAD и NanoCAD (DWG), Visio (VSD, VSDX) и файлы других закрытых форматов '
      + 'сначала сохраните из своей программы через «Экспорт» или «Печать в PDF» — годится и PDF, и картинка.',
    );
  };

  const createFromPdf = async (pageNumber: number, dpi: number, rotation: QuarterTurn): Promise<void> => {
    if (pendingPdf === null) return;
    const created = await withBusy(() => createBackdropFromPdf(deps, {
      sourceBytes: pendingPdf.bytes,
      sourceFileName: pendingPdf.fileName,
      pageNumber,
      dpi,
      extraRotationDeg: rotation,
      nodeId: pendingPdf.nodeId,
    }));
    if (!created.ok) return setMessage(created.error.message);

    setPendingPdf(null);
    await unplaceOnNode(pendingPdf.nodeId);
    await refreshList();
    setSelectedId(created.value.id);
  };

  const applyExtents = async (horizontalMeters: number, verticalMeters: number): Promise<void> => {
    if (selected === null || extentsRect === null) return;
    const result = await calibrateByBuildingExtents(deps, {
      backdropId: selected.id,
      extents: { rect: extentsRect, horizontalMeters, verticalMeters },
    });
    if (!result.ok) return setMessage(result.error.message);
    setCalibration(result.value);
    await refreshList();
  };

  const applyTwoPoints = async (realDistanceM: number): Promise<void> => {
    const [a, b] = points;
    if (selected === null || a === undefined || b === undefined) return;
    const result = await calibrateByTwoPoints(deps, {
      backdropId: selected.id,
      twoPoints: { a, b, realDistanceM },
    });
    if (!result.ok) return setMessage(result.error.message);
    setCalibration(result.value);
    setPickingPoints(false);
    setPoints([]);
    await refreshList();
  };

  const applyDrawingScale = async (scaleDenominator: number): Promise<void> => {
    if (selected === null) return;
    const result = await calibrateByDrawingScale(deps, { backdropId: selected.id, scaleDenominator });
    if (!result.ok) return setMessage(result.error.message);
    setCalibration(result.value);
    await refreshList();
  };

  const removeBackdrop = async (id: string): Promise<void> => {
    const result = await deps.backdrops.remove(id);
    if (!result.ok) return setMessage(result.error.message);
    if (selectedId === id) setSelectedId(null);
    await refreshList();
  };

  const mode: ViewerMode =
    cropping || drawingExtents || eraserTool === 'rect'
      ? 'draw-rect'
      : eraserTool === 'lasso' || eraserTool === 'free'
        ? 'draw-lasso'
        : pickingPoints || eraserTool === 'line' ? 'pick-points' : 'pan';

  const hint = eraserTool !== null
    ? (eraserTool === 'rect'
      ? 'Обведите прямоугольную область, которую нужно стереть'
      : eraserTool === 'line'
        ? (lineFrom === null ? 'Щёлкните начало линии' : 'Щёлкните конец линии')
        : eraserTool === 'free'
          ? 'Ведите мышью, не отпуская кнопку'
          : 'Ведите мышью по границе того, что нужно стереть')
    : cropping
    ? 'Обведите область, которая пойдёт на план'
    : drawingExtents
      ? 'Обведите здание по габаритам'
      : pickingPoints
        ? 'Щёлкните две точки с известным расстоянием'
        : null;

  /**
   * Пересчитывает подложку по полному списку действий.
   *
   * Список именно полный: очистка неразрушающая и всегда считается заново от
   * исходного файла. Поэтому «вернуть исходный чертёж» — это пустой список, а
   * не откат по шагам, и результат не зависит от порядка нажатий в прошлом.
   */
  /**
   * Снять с плана всё расставленное на узле подложки.
   *
   * Значок стоит в точке чертежа. Сменился чертёж — та же точка указывает уже
   * не туда, и оставить значки на месте значило бы показывать неверный план.
   * Из журнала объекты не уходят: они возвращаются в «Требуют размещения»,
   * откуда их ставят на новый чертёж перетаскиванием.
   */
  const unplaceOnNode = async (nodeId: string | null): Promise<void> => {
    if (nodeId === null) return;
    const result = await unplaceNodeObjects(objectDeps, { nodeId });
    if (!result.ok) { setMessage(result.error.message); return; }
    if (result.value.length > 0) {
      setMessage(`Чертёж изменился: снято с плана объектов — ${result.value.length}.`
        + ' Они ждут в «Требуют размещения» на этом узле.');
    }
  };

  const applyOperations = async (
    operations: readonly CleanupOperation[],
    label = 'Поправить подложку',
  ): Promise<boolean> => {
    if (selected === null) return false;
    /*
     * Название действия попадает в историю: по нему человек и понимает, что
     * откатит кнопка «назад».
     *
     * Срыв правки ловится здесь, а не остаётся необработанным обещанием:
     * иначе человек не узнаёт ни что случилось, ни почему чертёж не
     * изменился (ADR-005: ошибку показывают, а не подменяют пустотой).
     */
    let result: Awaited<ReturnType<typeof applyBackdropCleanup>> | null;
    try {
      result = await withBusy(() => history.run(label, () => applyBackdropCleanup(deps, {
        backdropId: selected.id,
        operations,
      })));
    } catch (e) {
      setMessage(`Не удалось поправить подложку: ${describeUnknown(e)}`);
      return false;
    }
    if (result === null) return false;
    if (!result.ok) { setMessage(result.error.message); return false; }

    setCleanup(operations.length === 0 ? null : result.value);

    /*
     * Обрезка и поворот меняют систему координат чертежа, стирание — нет.
     * Поэтому значки снимаются только после первых двух: после стирания они
     * стоят там же, где стояли, и снимать их было бы напрасной работой.
     *
     * Сравниваются списки до и после: важно не то, что правку применили, а
     * то, изменилась ли от неё геометрия.
     */
    const before = appliedOperations.filter(changesExtent).length;
    const after = operations.filter(changesExtent).length;
    if (before !== after) await unplaceOnNode(selected.nodeId);

    return true;
  };

  /**
   * Что получится из выделенной области.
   *
   * Одна область — одно действие, и какое именно, решает переключатель
   * «только цветное». Насыщенность и кайма взяты те же, что у обычной
   * цветной очистки: настройка здесь и так не одна, а результат тот же.
   */
  const eraseOperation = (area: EraseArea): CleanupOperation => {
    if (colorOnly) {
      return { kind: 'erase-colored-in-area', area, color: null, tolerance: 0, saturationThreshold: 0.15, haloRadiusPx: 2 };
    }
    return area.kind === 'rect' ? { kind: 'erase-rect', rect: area.rect } : { kind: 'erase-polygon', points: area.points };
  };

  /** Уже применённые действия — основа для следующего. */
  const appliedOperations = cleanup?.operations ?? [];

  /**
   * Нарисовать линию на чертеже.
   *
   * Применяется сразу, без промежуточного «выделено — подтвердите»: линию
   * видно там же, где её провели, и подтверждать нечего. Ошиблись — «назад»
   * в шапке, как и с любой другой правкой.
   */
  const applyLine = async (points: readonly PixelPoint[]): Promise<void> => {
    if (points.length < 1) return;
    await applyOperations(
      [...appliedOperations, { kind: 'draw-line', points, color: penColor, widthPx: penWidthPx }],
      'Нарисовать линию на подложке',
    );
  };

  /** Стереть выделенное. */
  const applyErase = async (): Promise<void> => {
    if (pendingErase.length === 0) return;
    const done = await applyOperations([...appliedOperations, ...pendingErase], 'Стереть лишнее с подложки');
    if (!done) return;
    setPendingErase([]);
    setEraserTool(null);
  };

  /**
   * Развернуть чертёж на четверть оборота.
   *
   * Разметка сбрасывается вся: и обрезка, и габариты, и точки масштаба
   * указывали на прежнюю сторону листа. Оставить их — значит мерить не то.
   */
  const rotateBackdrop = async (quarterTurns: 1 | 3): Promise<void> => {
    const done = await applyOperations(
      [...appliedOperations, { kind: 'rotate', quarterTurns }],
      'Развернуть подложку',
    );
    if (!done) return;
    setPendingErase([]);
    setEraserTool(null);
    setCropRect(null);
    setExtentsRect(null);
    setPoints([]);
  };


  /** Вернуть подложку к загруженному виду. */
  const restoreBackdrop = async (): Promise<void> => {
    const done = await applyOperations([], 'Вернуть исходный чертёж');
    if (!done) return;
    setPendingErase([]);
    setEraserTool(null);
    // Обрезка тоже отменена: габариты и точки масштаба указывали на
    // обрезанный чертёж и после возврата смотрели бы не туда.
    setCropRect(null);
    setExtentsRect(null);
    setPoints([]);
  };

  /** Оставить от подложки только выделенную область. */
  const applyCrop = async (): Promise<void> => {
    if (selected === null || cropRect === null) return;
    const done = await applyOperations(
      [...appliedOperations, { kind: 'crop', rect: cropRect }],
      'Обрезать подложку',
    );
    if (!done) return;

    setCropRect(null);
    setCropping(false);
    // Габариты здания были отмечены на старом чертеже: после обрезки они
    // указывают не туда, и масштаб пришлось бы задавать заново.
    setExtentsRect(null);
    setPoints([]);
  };

  /*
   * Разметка поверх подложки: выделенная под обрезку область и габариты здания
   * для масштаба. Обе показываются рамкой — цвет разный, чтобы не спутать.
   */
  const overlays: OverlayRect[] = [
    ...(cropRect === null ? [] : [{ rect: cropRect, kind: 'crop' as const }]),
    ...(extentsRect === null ? [] : [{ rect: extentsRect, kind: 'extents' as const }]),
    // Выделенное под стирание закрашивается белым — видно, каким чертёж станет.
    ...pendingErase
      .filter((operation) => operation.kind === 'erase-rect')
      .map((operation) => ({ rect: (operation as { rect: PixelRect }).rect, kind: 'erase' as const })),
    // Область, где уйдёт только цветное, обведена своим цветом: чертёж под
    // ней остаётся, и путать её с полным стиранием нельзя.
    ...pendingErase
      .filter((operation) => operation.kind === 'erase-colored-in-area'
        && operation.area.kind === 'rect')
      .map((operation) => ({
        rect: ((operation as { area: { kind: 'rect'; rect: PixelRect } }).area).rect,
        kind: 'erase-color' as const,
      })),
  ];

  const overlayPolygons: OverlayPolygon[] = [
    ...pendingErase
      .filter((operation) => operation.kind === 'erase-polygon')
      .map((operation) => ({ points: (operation as { points: readonly PixelPoint[] }).points, kind: 'erase' as const })),
    ...pendingErase
      .filter((operation) => operation.kind === 'erase-colored-in-area'
        && operation.area.kind === 'polygon')
      .map((operation) => ({
        points: ((operation as { area: { kind: 'polygon'; points: readonly PixelPoint[] } }).area).points,
        kind: 'erase-color' as const,
      })),
  ];

  const hasBackdropDraft = lineFrom !== null || pendingErase.length > 0
    || cropRect !== null || cropping || extentsRect !== null || drawingExtents || points.length > 0;
  const undoBackdrop = (): void => {
    // Сначала снимается последнее незавершённое действие на экране. Только
    // когда черновика нет, «Назад» обращается к сохранённой истории.
    if (lineFrom !== null) { setLineFrom(null); return; }
    if (pendingErase.length > 0) { setPendingErase((current) => current.slice(0, -1)); return; }
    if (cropRect !== null || cropping) { setCropRect(null); setCropping(false); return; }
    if (points.length > 0) { setPoints((current) => current.slice(0, -1)); return; }
    if (extentsRect !== null || drawingExtents) { setExtentsRect(null); setDrawingExtents(false); return; }
    void history.undo();
  };

  /*
   * Пока неизвестно, есть ли учётные записи, не показывается ничего.
   *
   * Иначе на мгновение мелькал бы экран первого запуска — и человек, у
   * которого учётные записи есть, успевал бы испугаться, что программа их
   * потеряла.
   */
  if (session.checking) return <div className="app" />;

  if (session.user === null) {
    return <SignInScreen firstRun={session.firstRun} onSignedIn={session.signIn} />;
  }

  /*
   * Соглашения — раньше рабочего экрана и мимо них не пройти.
   *
   * Заказчик: «пользователь при первом входе ОБЯЗАН прочитать и
   * согласиться». Проверяется редакция, а не признак: изменённые условия —
   * это другие условия, и молча считать их принятыми нельзя.
   */
  if (needsLegalAcceptance(session.user.acceptedLegalVersion)) {
    const user = session.user;
    return (
      <LegalConsentScreen
        userName={user.fullName}
        busy={busy}
        onAccept={() => void (async () => {
          const accepted = await acceptLegal(accessDeps, {
            id: user.id, version: LEGAL_VERSION, acceptedAt: new Date().toISOString(),
          });
          if (accepted.ok) session.refresh(accepted.value);
          else setMessage(accepted.error.message);
        })()}
        onDecline={session.signOut}
      />
    );
  }

  return (
    <div className="app">
      {/* Главный экран рисует шапку сам: переключатель режимов и кнопки зависят
          от выбранного узла дерева, который живёт там. Здесь шапка нужна только
          для подготовки подложки — это шаг работы, а не раздел программы
          (ТЗ, часть 11.1). */}
      {screen !== 'main' && (
        <AppHeader
          canUndo={hasBackdropDraft || history.state.canUndo}
          canRedo={history.state.canRedo}
          onUndo={undoBackdrop}
          onRedo={() => { void history.redo(); }}
          account={{
            title: session.user.fullName,
            onOpen: () => setAccountOpen(true),
            onSignOut: session.signOut,
          }}
          onReportProblem={() =>
            setMessage(
              'Обращение к разработчику появится вместе с серверной частью. Пока напишите напрямую — программа работает без сети.',
            )
          }
          actions={
            <>
              <button type="button" onClick={() => void openFile()} disabled={busy}>
                Загрузить другой файл
              </button>
              {/* «Всё готово» стоит у самой подложки, рядом с обрезкой: это
                  конец работы с ней, а не выход из раздела. Здесь остаётся
                  только возврат — на случай, когда подложку не выбрали. */}
              <button type="button" onClick={() => setScreen('main')}>
                К объекту
              </button>
            </>
          }
        />
      )}

      {screen === 'main' && (
        <MainScreen
          openAt={openPlanAt === null ? null : { nodeId: openPlanAt, mode: 'plan' }}
          focusTarget={activityTarget}
          onFocusApplied={() => setActivityTarget(null)}
          session={session}
          onOpenAccount={() => setAccountOpen(true)}
          onEditBackdrop={(nodeId) => {
            /*
             * Сюда приходят из настроек править чертёж: поворот, обрезка,
             * стирание лишнего. Всё это живёт на экране подготовки подложки —
             * там же, где чертёж принимают, и где лежит исходный файл, от
             * которого правки считаются заново.
             *
             * Подложки у узла нет — просить файл: править нечего, а вернуть
             * человека ни с чем значило бы оставить его гадать, почему кнопка
             * ничего не сделала.
             */
            // Куда бы отсюда ни вышли, вернёмся на план этого узла.
            setOpenPlanAt(nodeId);

            const own = [...backdrops]
              .filter((item) => item.nodeId === nodeId)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
            if (own !== null) {
              setSelectedId(own.id);
              setScreen('backdrop');
              return;
            }

            setScreen('backdrop');
            void window.izh.openPlanFile().then((opened) => {
              if (!opened.ok) return setMessage(opened.error.message);
              if (opened.value === null) return;
              void acceptPlanFile(opened.value.fileName, opened.value.bytes, nodeId);
            });
          }}
          onPickBackdrop={(nodeId) => {
            setOpenPlanAt(nodeId);
            setScreen('backdrop');
            void window.izh.openPlanFile().then((opened) => {
              if (!opened.ok) return setMessage(opened.error.message);
              if (opened.value === null) return;
              void acceptPlanFile(opened.value.fileName, opened.value.bytes, nodeId);
            });
          }}
          onDropBackdrop={(file, nodeId) => {
            setOpenPlanAt(nodeId);
            setScreen('backdrop');
            void acceptPlanFile(file.fileName, file.bytes, nodeId);
          }}
        />
      )}

      {accountOpen && (
        <AccountPanel
          user={session.user}
          nodes={treeNodes}
          onClose={() => setAccountOpen(false)}
          onChanged={session.refresh}
          users={session.users}
          onUsersChanged={() => { void session.reloadUsers(); }}
          onOpenActivity={(target) => { setActivityTarget(target); setAccountOpen(false); }}
        />
      )}

      {message !== null && (
        <div className={`banner ${messageTone(message)}`} onClick={() => setMessage(null)}>
          {message} <span className="muted small">(щёлкните, чтобы скрыть)</span>
        </div>
      )}

      {screen === 'backdrop' && (
      <div className="app-body">
        <aside className="sidebar">
          <h3>Подложка уровня</h3>
          <BackdropList
            items={selected === null ? [] : [selected]}
            selectedId={selectedId}
            calibratedIds={calibratedIds}
            onSelect={setSelectedId}
            onRemove={(id) => void removeBackdrop(id)}
          />
          <p className="muted small path">Данные хранятся в папке: {dataDir}</p>
        </aside>

        <main className="workspace">
          {pendingPdf !== null && (
            <ImportWizard
              fileName={pendingPdf.fileName}
              documentInfo={pendingPdf.documentInfo}
              bytes={pendingPdf.bytes}
              busy={busy}
              onCreate={(page, dpi, rotation) => void createFromPdf(page, dpi, rotation)}
              onCancel={() => setPendingPdf(null)}
            />
          )}

          {pendingPdf === null && selected !== null && displayUrl !== null && (
            <BackdropViewer
              imageUrl={displayUrl}
              widthPx={displayWidth}
              heightPx={displayHeight}
              caption={backdropCaption}
              mode={mode}
              hint={hint}
              points={points}
              previewLineFrom={eraserTool === 'line' ? lineFrom : null}
              previewLineColor={penColor}
              previewLineWidthPx={penWidthPx}
              overlays={overlays}
              polygons={overlayPolygons}
              onLassoDrawn={(drawn) => {
                // Обводкой и стирают, и рисуют: движение одно и то же,
                // а что получится, решает выбранный инструмент.
                if (eraserTool === 'free') { void applyLine(drawn); return; }
                setPendingErase((current) => [...current, eraseOperation({ kind: 'polygon', points: drawn })]);
              }}
              onPickPoint={(point) => {
                if (eraserTool === 'line') {
                  // Первый щелчок — начало, второй — конец и сразу линия.
                  if (lineFrom === null) { setLineFrom(point); return; }
                  void applyLine([lineFrom, point]);
                  setLineFrom(null);
                  return;
                }
                setPoints((current) => (current.length >= 2 ? [point] : [...current, point]));
              }}
              onRectDrawn={(rect) => {
                if (eraserTool === 'rect') {
                  setPendingErase((current) => [...current, eraseOperation({ kind: 'rect', rect })]);
                  return;
                }
                if (cropping) { setCropRect(rect); setCropping(false); return; }
                setExtentsRect(rect);
                setDrawingExtents(false);
              }}
            />
          )}

          {pendingPdf === null && selected === null && (
            <div className="empty">
              <h2>Подложка плана</h2>
              <p>
                Загрузите план здания: PDF, SVG, DXF или изображение — PNG, JPEG, GIF, BMP,
                WebP, TIFF. Годятся чертёж, скан и фотография.
              </p>
              <p className="muted">
                Чертежи AutoCAD и NanoCAD (DWG), Visio (VSD, VSDX) и другие закрытые форматы
                сохраните из своей программы через «Экспорт» или «Печать в PDF»: подойдёт и PDF,
                и обычная картинка.
              </p>
              <p className="muted">
                После загрузки останется один шаг — задать масштаб. Без него план показывает
                картинку, но не мерит расстояния.
              </p>            </div>
          )}
        </main>

        {selected !== null && pendingPdf === null && (
          <aside className="inspector">
            {/*
              * Автоматический разбор чертежа убран: очистка по цветам и поиск
              * фигур требовали от пользователя работы художника, а результат
              * всё равно зависел от исходного файла.
              *
              * Ручное осталось — и обрезка, и стирание: убрать штамп или
              * соседний цех человек умеет, а программа за него угадывать не
              * бралась. Правка неразрушающая: исходный файл в хранилище.
              */}
            <section className="backdrop-actions">
              <h3>Подложка</h3>
              <p className="muted small">
                Чертёж вписан в окно целиком. Приближайте и отдаляйте кнопками сверху или колесом мыши —
                на плане подложка всё равно встанет целиком.
              </p>

              {!cropping && cropRect === null && (
                <button type="button" onClick={() => { setCropping(true); setDrawingExtents(false); }}>
                  Выделить область
                </button>
              )}

              {cropping && cropRect === null && (
                <p className="muted small">Обведите на чертеже область, которая пойдёт на план.</p>
              )}

              {cropRect !== null && (
                <>
                  <p className="muted small">
                    Выделено {Math.round(cropRect.widthPx)} × {Math.round(cropRect.heightPx)} точек.
                    На план пойдёт только эта область.
                  </p>
                  <div className="actions">
                    <button type="button" className="primary" disabled={busy} onClick={() => void applyCrop()}>
                      Оставить эту область
                    </button>
                    <button type="button" onClick={() => { setCropRect(null); setCropping(false); }}>
                      Отменить выделение
                    </button>
                  </div>
                </>
              )}

              {/* Пока область выделена, но не подтверждена, главная кнопка —
                  та, что решает её судьбу: две синие рядом спорят за нажатие. */}
              <div className="actions">
                <button
                  type="button"
                  className={cropRect === null ? 'primary' : undefined}
                  onClick={() => {
                    // Возвращаемся на план того узла, чей чертёж правили.
                    setOpenPlanAt(selected?.nodeId ?? null);
                    setScreen('main');
                  }}
                >
                  Всё готово
                </button>
              </div>
            </section>

            <BackdropEraser
              tool={eraserTool}
              onPickTool={(tool) => {
                setEraserTool(tool);
                // Начатая линия к другому инструменту не относится.
                setLineFrom(null);
                // Инструменты выделения не совмещаются: обрезка и габариты
                // рисуют такой же рамкой, и два режима разом означали бы, что
                // непонятно, чем окажется нарисованное.
                if (tool !== null) { setCropping(false); setDrawingExtents(false); setPickingPoints(false); }
              }}
              colorOnly={colorOnly}
              onColorOnly={setColorOnly}
              pending={pendingErase}
              // Считаются все правки, а не одни стирания: поворот тоже
              // правка, и шаг назад должен уметь снять именно его.
              applied={appliedOperations.length}
              busy={busy}
              onApply={() => void applyErase()}
              onRotate={(quarterTurns) => void rotateBackdrop(quarterTurns)}
              penColor={penColor}
              onPenColor={setPenColor}
              penWidthPx={penWidthPx}
              onPenWidthPx={setPenWidthPx}
              onRestore={() => void restoreBackdrop()}
            />

            {/* Масштаб — не обязательный шаг: без него план показывает чертёж,
                но не мерит расстояний. Нужен он не всем и не сразу, поэтому
                свёрнут и подписан прямо. */}
            <details className="backdrop-scale">
              <summary>Масштаб плана (необязательно)</summary>
              <p className="muted small">
                Задаёт, сколько метров в точке чертежа. Нужен для измерения расстояний и проверки
                расстановки; на показ подложки и расстановку значков не влияет.
              </p>
            <CalibrationPanel
              backdrop={selected}
              calibration={calibration}
              extentsRect={extentsRect}
              points={points}
              drawingExtents={drawingExtents}
              pickingPoints={pickingPoints}
              onDrawExtents={() => {
                setDrawingExtents(!drawingExtents);
                setPickingPoints(false);
              }}
              onPickPoints={() => {
                setPickingPoints(!pickingPoints);
                setPoints([]);
                setDrawingExtents(false);
              }}
              onApplyExtents={(h, v) => void applyExtents(h, v)}
              onApplyTwoPoints={(distance) => void applyTwoPoints(distance)}
              onApplyDrawingScale={(denominator) => void applyDrawingScale(denominator)}
            />
            </details>
          </aside>
        )}
      </div>
      )}
    </div>
  );
}
