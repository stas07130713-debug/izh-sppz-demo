/**
 * Главное окно: подложка плана — создание, очистка, масштаб.
 *
 * Здесь только состояние интерфейса и связывание частей. Вся содержательная
 * работа — в сценариях ядра и в движке E1; этот файл не считает ничего сам.
 */

import { useCallback, useEffect, useState } from 'react';
import type {
  BackdropCleanup,
  PdfDocumentInfo,
  PixelPoint,
  PixelRect,
  PlanBackdrop,
  PlanCalibration,
  QuarterTurn,
} from '@izh/contracts';
import {
  applyBackdropCleanup,
  calibrateByBuildingExtents,
  calibrateByDrawingScale,
  calibrateByTwoPoints,
  createBackdropFromImage,
  createBackdropFromPdf,
  resetBackdropCleanup,
} from '@izh/core';
// inspectComponentAt не входит в контракт движка: это вспомогательный расчёт для
// интерфейса, чтобы предупредить пользователя до удаления, а не действие над данными.
import { inspectComponentAt, planSourceEngine } from '@izh/engine-plan-source';
import { deps } from './deps';
import {
  COMPONENT_MAX_RADIUS_PX,
  COMPONENT_MAX_SHARE,
  EMPTY_CLEANUP,
  fromOperations,
  toOperations,
  type CleanupState,
} from './cleanup-state';
import { BackdropList } from './components/BackdropList';
import { BackdropViewer, type OverlayRect, type ViewerMode } from './components/BackdropViewer';
import { CalibrationPanel } from './components/CalibrationPanel';
import { CleanupPanel, type RectPurpose } from './components/CleanupPanel';
import { ImportWizard } from './components/ImportWizard';
import { PlanImportScreen } from './components/PlanImportScreen';
import { useCleanupPreviewUrl, useOriginalPreview, useStoredImageUrl } from './use-backdrop-workspace';

interface PendingPdf {
  readonly fileName: string;
  readonly bytes: Uint8Array;
  readonly documentInfo: PdfDocumentInfo;
}

type InspectorTab = 'cleanup' | 'scale';

export function App(): React.JSX.Element {
  const [backdrops, setBackdrops] = useState<readonly PlanBackdrop[]>([]);
  const [calibratedIds, setCalibratedIds] = useState<ReadonlySet<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [calibration, setCalibration] = useState<PlanCalibration | null>(null);
  const [cleanup, setCleanup] = useState<BackdropCleanup | null>(null);
  const [cleanupState, setCleanupState] = useState<CleanupState>(EMPTY_CLEANUP);
  const [tab, setTab] = useState<InspectorTab>('cleanup');
  const [drawing, setDrawing] = useState<RectPurpose | null>(null);
  const [extentsRect, setExtentsRect] = useState<PixelRect | null>(null);
  const [points, setPoints] = useState<readonly PixelPoint[]>([]);
  const [pickingPoints, setPickingPoints] = useState(false);
  const [pickingComponents, setPickingComponents] = useState(false);
  const [pendingPdf, setPendingPdf] = useState<PendingPdf | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dataDir, setDataDir] = useState('');
  /** Какой экран открыт: работа с подложкой или импорт плана через PlanVector. */
  const [screen, setScreen] = useState<'backdrop' | 'import'>('backdrop');

  const selected = backdrops.find((b) => b.id === selectedId) ?? null;
  const editingCleanup = tab === 'cleanup' && selected !== null;

  const { preview, palette } = useOriginalPreview(selected);
  const previewUrl = useCleanupPreviewUrl(preview, cleanupState, selected?.widthPx ?? 0, editingCleanup);
  const storedUrl = useStoredImageUrl(selected, cleanup);

  // В режиме очистки показывается предпросмотр в координатах исходной подложки,
  // иначе — сохранённое изображение (очищенное, если очистка применена).
  const displayUrl = editingCleanup ? (previewUrl ?? storedUrl) : storedUrl;
  const displayWidth = editingCleanup ? (selected?.widthPx ?? 0) : (cleanup?.widthPx ?? selected?.widthPx ?? 0);
  const displayHeight = editingCleanup
    ? (selected?.heightPx ?? 0)
    : (cleanup?.heightPx ?? selected?.heightPx ?? 0);

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
    setCleanupState(EMPTY_CLEANUP);
    setExtentsRect(null);
    setPoints([]);
    setDrawing(null);
    setPickingPoints(false);
    setPickingComponents(false);
    if (selectedId === null) return;

    void deps.backdrops.getCalibration(selectedId).then((result) => {
      if (result.ok) setCalibration(result.value);
    });
    void deps.backdrops.getCleanup(selectedId).then((result) => {
      if (result.ok && result.value !== null) {
        setCleanup(result.value);
        setCleanupState(fromOperations(result.value.operations));
      }
    });
  }, [selectedId]);

  const openFile = async (): Promise<void> => {
    setMessage(null);
    const opened = await window.izh.openPlanFile();
    if (!opened.ok) return setMessage(opened.error.message);
    if (opened.value === null) return;

    const { fileName, bytes } = opened.value;
    const kind = planSourceEngine.detectKind(bytes);

    if (kind === 'pdf') {
      setBusy(true);
      const info = await planSourceEngine.probePdf(bytes);
      setBusy(false);
      if (!info.ok) return setMessage(info.error.message);
      setPendingPdf({ fileName, bytes, documentInfo: info.value });
      return;
    }

    if (kind === 'image') {
      setBusy(true);
      const created = await createBackdropFromImage(deps, { sourceBytes: bytes, sourceFileName: fileName });
      setBusy(false);
      if (!created.ok) return setMessage(created.error.message);
      await refreshList();
      setSelectedId(created.value.id);
      return;
    }

    setMessage('Такой файл не поддерживается. Нужен PDF, PNG или JPEG.');
  };

  const createFromPdf = async (pageNumber: number, dpi: number, rotation: QuarterTurn): Promise<void> => {
    if (pendingPdf === null) return;
    setBusy(true);
    const created = await createBackdropFromPdf(deps, {
      sourceBytes: pendingPdf.bytes,
      sourceFileName: pendingPdf.fileName,
      pageNumber,
      dpi,
      extraRotationDeg: rotation,
    });
    setBusy(false);
    if (!created.ok) return setMessage(created.error.message);

    setPendingPdf(null);
    await refreshList();
    setSelectedId(created.value.id);
  };

  const applyCleanup = async (): Promise<void> => {
    if (selected === null) return;
    setBusy(true);
    const result = await applyBackdropCleanup(deps, {
      backdropId: selected.id,
      operations: toOperations(cleanupState),
    });
    setBusy(false);
    if (!result.ok) return setMessage(result.error.message);

    setCleanup(result.value);
    setDrawing(null);
    setTab('scale');
  };

  const resetCleanup = async (): Promise<void> => {
    if (selected === null) return;
    setBusy(true);
    const result = await resetBackdropCleanup(deps, selected.id);
    setBusy(false);
    if (!result.ok) return setMessage(result.error.message);
    setCleanup(null);
    setCleanupState(EMPTY_CLEANUP);
  };

  /**
   * Щелчок по значку: убрать связную фигуру целиком.
   *
   * Прежде чем добавить действие, фигура измеряется на уменьшенной копии. Если
   * она оказалась слишком крупной, это не значок, а стены — тогда программа
   * предупреждает, вместо того чтобы снести пол-чертежа.
   */
  const pickComponent = (point: PixelPoint): void => {
    if (preview === null || selected === null) return;

    const factor = preview.widthPx / selected.widthPx;
    const found = inspectComponentAt(
      preview,
      { x: point.x * factor, y: point.y * factor },
      COMPONENT_MAX_RADIUS_PX * factor,
    );

    if (found === null) {
      setMessage('На этом месте ничего не нарисовано. Щёлкните точно по линии значка.');
      return;
    }
    if (found.share > COMPONENT_MAX_SHARE) {
      setMessage(
        'Эта фигура слишком велика — похоже, вы попали в стены здания. Щёлкните по значку или стрелке.',
      );
      return;
    }

    setCleanupState((current) => ({
      ...current,
      removedComponents: [...current.removedComponents, point],
    }));
  };

  const handleRectDrawn = (rect: PixelRect): void => {
    if (drawing === 'crop') setCleanupState({ ...cleanupState, crop: rect });
    else if (drawing === 'erase') setCleanupState({ ...cleanupState, eraseRects: [...cleanupState.eraseRects, rect] });
    else if (drawing === 'extents') {
      setExtentsRect(rect);
      setDrawing(null);
    }
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
    drawing !== null ? 'draw-rect' : pickingPoints || pickingComponents ? 'pick-points' : 'pan';

  const hint =
    drawing === 'crop'
      ? 'Обведите область чертежа, которую нужно оставить'
      : drawing === 'erase'
        ? 'Обведите область, которую нужно стереть'
        : drawing === 'extents'
          ? 'Обведите здание по габаритам'
          : pickingComponents
            ? 'Щёлкайте по значкам и стрелкам — каждая фигура убирается целиком'
            : pickingPoints
              ? 'Щёлкните две точки с известным расстоянием'
              : null;

  const overlays: OverlayRect[] = [];
  if (editingCleanup) {
    for (const rect of cleanupState.eraseRects) overlays.push({ rect, kind: 'erase' });
    if (cleanupState.crop !== null) overlays.push({ rect: cleanupState.crop, kind: 'crop' });
  }
  if (tab === 'scale' && extentsRect !== null) overlays.push({ rect: extentsRect, kind: 'extents' });

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <strong>ИЖ СППЗ</strong>
          <span className="muted"> — интерактивный журнал систем противопожарной защиты</span>
        </div>
        <div className="header-actions">
          <div className="tabs">
            <button
              type="button"
              className={screen === 'backdrop' ? 'tab active' : 'tab'}
              onClick={() => setScreen('backdrop')}
            >
              Подложка
            </button>
            <button
              type="button"
              className={screen === 'import' ? 'tab active' : 'tab'}
              onClick={() => setScreen('import')}
            >
              Импорт плана
            </button>
          </div>
          {screen === 'backdrop' && (
            <button type="button" className="primary" onClick={() => void openFile()} disabled={busy}>
              Загрузить план
            </button>
          )}
        </div>
      </header>

      {screen === 'import' && <PlanImportScreen />}

      {message !== null && (
        <div className="banner error" onClick={() => setMessage(null)}>
          {message} <span className="muted small">(щёлкните, чтобы скрыть)</span>
        </div>
      )}

      {screen === 'backdrop' && (
      <div className="app-body">
        <aside className="sidebar">
          <h3>Подложки</h3>
          <BackdropList
            items={backdrops}
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
              mode={mode}
              hint={hint}
              points={points}
              overlays={overlays}
              onPickPoint={(point) => {
                if (pickingComponents) pickComponent(point);
                else setPoints((current) => (current.length >= 2 ? [point] : [...current, point]));
              }}
              onRectDrawn={handleRectDrawn}
            />
          )}

          {pendingPdf === null && selected === null && (
            <div className="empty">
              <h2>Подложка плана</h2>
              <p>
                Загрузите план здания в формате PDF, PNG или JPEG. Дальше нужно сделать две вещи:
                очистить план, оставив только здание, и задать масштаб.
              </p>
              <p className="muted">
                Очистка убирает стрелки эвакуации, уже расставленные значки, легенду и штамп — всё то,
                что программа нанесёт сама и по своим правилам. Масштаб задаётся по габаритам здания.
              </p>
            </div>
          )}
        </main>

        {selected !== null && pendingPdf === null && (
          <aside className="inspector">
            <div className="tabs">
              <button
                type="button"
                className={tab === 'cleanup' ? 'tab active' : 'tab'}
                onClick={() => {
                  setTab('cleanup');
                  setPickingPoints(false);
                }}
              >
                1. Очистка
              </button>
              <button
                type="button"
                className={tab === 'scale' ? 'tab active' : 'tab'}
                onClick={() => {
                  setTab('scale');
                  setDrawing(null);
                }}
              >
                2. Масштаб
              </button>
            </div>

            {tab === 'cleanup' && (
              <CleanupPanel
                state={cleanupState}
                palette={palette}
                drawing={drawing}
                pickingComponents={pickingComponents}
                busy={busy}
                applied={cleanup !== null}
                onChange={setCleanupState}
                onDraw={(purpose) => {
                  setDrawing(purpose);
                  setPickingComponents(false);
                }}
                onPickComponents={() => {
                  setPickingComponents(!pickingComponents);
                  setDrawing(null);
                }}
                onApply={() => void applyCleanup()}
                onReset={() => void resetCleanup()}
              />
            )}

            {tab === 'scale' && (
              <CalibrationPanel
                backdrop={selected}
                calibration={calibration}
                extentsRect={extentsRect}
                points={points}
                drawingExtents={drawing === 'extents'}
                pickingPoints={pickingPoints}
                onDrawExtents={() => {
                  setDrawing(drawing === 'extents' ? null : 'extents');
                  setPickingPoints(false);
                }}
                onPickPoints={() => {
                  setPickingPoints(!pickingPoints);
                  setPoints([]);
                  setDrawing(null);
                }}
                onApplyExtents={(h, v) => void applyExtents(h, v)}
                onApplyTwoPoints={(distance) => void applyTwoPoints(distance)}
                onApplyDrawingScale={(denominator) => void applyDrawingScale(denominator)}
              />
            )}
          </aside>
        )}
      </div>
      )}
    </div>
  );
}

