/**
 * Главное окно шага 1: создание подложки плана.
 *
 * Здесь только связывание частей и состояние интерфейса. Вся содержательная
 * работа — в сценариях ядра и в движке E1; этот файл не считает ничего сам.
 */

import { useCallback, useEffect, useState } from 'react';
import type { PdfDocumentInfo, PixelPoint, PlanBackdrop, PlanCalibration, QuarterTurn } from '@izh/contracts';
import { calibrateByDrawingScale, calibrateByTwoPoints, createBackdropFromImage, createBackdropFromPdf } from '@izh/core';
import { planSourceEngine } from '@izh/engine-plan-source';
import { deps } from './deps';
import { BackdropList } from './components/BackdropList';
import { BackdropViewer } from './components/BackdropViewer';
import { CalibrationPanel } from './components/CalibrationPanel';
import { ImportWizard } from './components/ImportWizard';

interface PendingPdf {
  readonly fileName: string;
  readonly bytes: Uint8Array;
  readonly documentInfo: PdfDocumentInfo;
}

export function App(): React.JSX.Element {
  const [backdrops, setBackdrops] = useState<readonly PlanBackdrop[]>([]);
  const [calibratedIds, setCalibratedIds] = useState<ReadonlySet<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [calibration, setCalibration] = useState<PlanCalibration | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pendingPdf, setPendingPdf] = useState<PendingPdf | null>(null);
  const [points, setPoints] = useState<readonly PixelPoint[]>([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dataDir, setDataDir] = useState<string>('');

  const selected = backdrops.find((b) => b.id === selectedId) ?? null;

  const refreshList = useCallback(async (): Promise<readonly PlanBackdrop[]> => {
    const list = await deps.backdrops.list();
    if (!list.ok) {
      setMessage(list.error.message);
      return [];
    }
    setBackdrops(list.value);

    const calibrated = new Set<string>();
    for (const item of list.value) {
      const found = await deps.backdrops.getCalibration(item.id);
      if (found.ok && found.value !== null) calibrated.add(item.id);
    }
    setCalibratedIds(calibrated);
    return list.value;
  }, []);

  useEffect(() => {
    void refreshList();
    void window.izh.dataDir().then((result) => {
      if (result.ok) setDataDir(result.value);
    });
  }, [refreshList]);

  // Изображение подложки берётся из хранилища и показывается как временная ссылка.
  useEffect(() => {
    if (selected === null) {
      setImageUrl(null);
      return;
    }

    let revoked: string | null = null;
    void deps.fileStore.get(selected.imageHash).then((result) => {
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      const blob = new Blob([result.value as BlobPart]);
      const url = URL.createObjectURL(blob);
      revoked = url;
      setImageUrl(url);
    });

    void deps.backdrops.getCalibration(selected.id).then((result) => {
      if (result.ok) setCalibration(result.value);
    });

    return () => {
      if (revoked !== null) URL.revokeObjectURL(revoked);
    };
  }, [selected]);

  const openFile = async (): Promise<void> => {
    setMessage(null);
    const opened = await window.izh.openPlanFile();
    if (!opened.ok) {
      setMessage(opened.error.message);
      return;
    }
    if (opened.value === null) return;

    const { fileName, bytes } = opened.value;
    const kind = planSourceEngine.detectKind(bytes);

    if (kind === 'pdf') {
      setBusy(true);
      const info = await planSourceEngine.probePdf(bytes);
      setBusy(false);
      if (!info.ok) {
        setMessage(info.error.message);
        return;
      }
      setPendingPdf({ fileName, bytes, documentInfo: info.value });
      return;
    }

    if (kind === 'image') {
      setBusy(true);
      const created = await createBackdropFromImage(deps, { sourceBytes: bytes, sourceFileName: fileName });
      setBusy(false);
      if (!created.ok) {
        setMessage(created.error.message);
        return;
      }
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

    if (!created.ok) {
      setMessage(created.error.message);
      return;
    }
    setPendingPdf(null);
    await refreshList();
    setSelectedId(created.value.id);
  };

  const pickPoint = (point: PixelPoint): void => {
    setPoints((current) => (current.length >= 2 ? [point] : [...current, point]));
  };

  const applyTwoPoints = async (realDistanceM: number): Promise<void> => {
    const a = points[0];
    const b = points[1];
    if (selected === null || a === undefined || b === undefined) return;

    const result = await calibrateByTwoPoints(deps, {
      backdropId: selected.id,
      twoPoints: { a, b, realDistanceM },
    });
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    setCalibration(result.value);
    setPicking(false);
    setPoints([]);
    await refreshList();
  };

  const applyDrawingScale = async (scaleDenominator: number): Promise<void> => {
    if (selected === null) return;
    const result = await calibrateByDrawingScale(deps, { backdropId: selected.id, scaleDenominator });
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    setCalibration(result.value);
    await refreshList();
  };

  const removeBackdrop = async (id: string): Promise<void> => {
    const result = await deps.backdrops.remove(id);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    if (selectedId === id) setSelectedId(null);
    await refreshList();
  };

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <strong>ИЖ СППЗ</strong>
          <span className="muted"> — интерактивный журнал систем противопожарной защиты</span>
        </div>
        <div className="header-actions">
          <button type="button" className="primary" onClick={() => void openFile()} disabled={busy}>
            Загрузить план
          </button>
        </div>
      </header>

      {message !== null && (
        <div className="banner error" onClick={() => setMessage(null)}>
          {message} <span className="muted small">(щёлкните, чтобы скрыть)</span>
        </div>
      )}

      <div className="app-body">
        <aside className="sidebar">
          <h3>Подложки</h3>
          <BackdropList
            items={backdrops}
            selectedId={selectedId}
            calibratedIds={calibratedIds}
            onSelect={(id) => {
              setSelectedId(id);
              setPoints([]);
              setPicking(false);
            }}
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

          {pendingPdf === null && selected !== null && imageUrl !== null && (
            <BackdropViewer
              imageUrl={imageUrl}
              widthPx={selected.widthPx}
              heightPx={selected.heightPx}
              pickingPoints={picking}
              points={points}
              onPickPoint={pickPoint}
            />
          )}

          {pendingPdf === null && selected === null && (
            <div className="empty">
              <h2>Подложка плана</h2>
              <p>
                Загрузите план здания в формате PDF, PNG или JPEG. Программа сделает из него подложку,
                на которую в дальнейшем наносится противопожарное оборудование.
              </p>
              <p className="muted">
                Для PDF можно выбрать страницу, разрешение и поворот. Сразу после этого нужно задать
                масштаб — без него не считаются ни площади помещений, ни расстояния.
              </p>
            </div>
          )}
        </main>

        {selected !== null && pendingPdf === null && (
          <aside className="inspector">
            <CalibrationPanel
              backdrop={selected}
              calibration={calibration}
              points={points}
              picking={picking}
              onStartPicking={() => {
                setPicking(true);
                setPoints([]);
              }}
              onResetPoints={() => setPoints([])}
              onApplyTwoPoints={(distance) => void applyTwoPoints(distance)}
              onApplyDrawingScale={(denominator) => void applyDrawingScale(denominator)}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
