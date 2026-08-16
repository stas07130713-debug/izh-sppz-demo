/**
 * Экран «Импорт плана»: загрузка PDF, распознавание, сверка.
 *
 * Здесь только состояние и связывание. Всё распознавание — в ядре PlanVector,
 * чтение PDF — в переходнике. Этот файл не считает ничего сам.
 */

import { useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import {
  recognizeFloor,
  renderFloorSvg,
  type PageContent,
  type PlanModel,
  type RecognizeOutcome,
} from '@izh/planvector-engine';
import { planSourceEngine } from '@izh/engine-plan-source';
import { readPageContent } from '../planvector/pdfjs-adapter';
import { recognizeByRaster } from '../planvector/raster-recognize';
import { PlanCompare } from './PlanCompare';

/** Разрешение отрисовки оригинала для сверки. Больше не нужно: сравнивается
 *  расположение линий, а не мелкий текст. */
const COMPARE_DPI = 150;

interface Recognized {
  readonly outcome: RecognizeOutcome;
  readonly page: PageContent;
  readonly originalUrl: string;
  readonly fileName: string;
}

function captionOf(model: PlanModel): string {
  // Подпись собирается из дерева объекта. Дерева пока нет, поэтому берётся имя
  // файла: когда дерево появится, изменится только этот кусок.
  return model.source.fileName;
}

export function PlanImportScreen(): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<Recognized | null>(null);
  const [showConfidence, setShowConfidence] = useState(true);

  const importPlan = async (): Promise<void> => {
    setMessage(null);
    const opened = await window.izh.openPlanFile();
    if (!opened.ok) return setMessage(opened.error.message);
    if (opened.value === null) return;

    const { fileName, bytes } = opened.value;
    if (planSourceEngine.detectKind(bytes) !== 'pdf') {
      return setMessage('Пока распознаются только документы PDF. Разбор сканов ещё не реализован.');
    }

    setBusy(true);
    try {
      setStage('Чтение документа');
      const document = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false })
        .promise;

      setStage('Разбор геометрии');
      const page = await readPageContent(document, 1);

      setStage('Распознавание по изображению');
      let counter = 0;
      const makeId = (): string => `e${(counter += 1)}`;
      // Векторный разбор оставлен для сведений об источнике: масштаб в тексте,
      // область плана, признаки документа. Стены ищутся по изображению.
      const outcome = recognizeFloor({
        page,
        source: { fileName, contentHash: '', kind: 'pdf', pageNumber: 1, area: null },
        createdAt: new Date().toISOString(),
        makeId,
      });

      const raster = await recognizeByRaster(bytes, page, makeId, fileName);
      if ('error' in raster) {
        setMessage(raster.error);
        return;
      }

      setStage('Отрисовка оригинала');
      const original = await planSourceEngine.rasterizePdfPage(bytes, {
        pageNumber: 1,
        dpi: COMPARE_DPI,
        extraRotationDeg: 0,
      });
      await document.destroy();

      if (!original.ok) {
        setMessage(original.error.message);
        return;
      }

      const originalUrl = URL.createObjectURL(
        new Blob([new Uint8Array(original.value.imageBytes) as BlobPart], { type: 'image/png' }),
      );

      // Стены берутся из растрового распознавания, сведения об источнике — из
      // векторного разбора: масштаб в тексте, признаки документа.
      const merged = { ...outcome, model: raster.model };
      setResult((previous) => {
        if (previous !== null) URL.revokeObjectURL(previous.originalUrl);
        return { outcome: merged, page, originalUrl, fileName };
      });
    } catch (error) {
      setMessage(`Не удалось обработать документ: ${String(error)}`);
    } finally {
      setBusy(false);
      setStage('');
    }
  };

  const rendered =
    result === null
      ? null
      : renderFloorSvg(result.outcome.model, 0, {
          caption: captionOf(result.outcome.model),
          showConfidence,
          reviewThreshold: 0.5,
        });

  const area = result?.outcome.model.source.area ?? null;
  const elements = result?.outcome.model.building.floors[0]?.elements ?? [];

  return (
    <div className="workspace">
      <div className="viewer-toolbar">
        <button type="button" className="primary" onClick={() => void importPlan()} disabled={busy}>
          Импорт плана
        </button>
        {busy && <span className="hint">{stage}…</span>}
        {result !== null && <span className="muted small">{result.fileName}</span>}
      </div>

      {message !== null && (
        <div className="banner error" onClick={() => setMessage(null)}>
          {message} <span className="muted small">(щёлкните, чтобы скрыть)</span>
        </div>
      )}

      {result === null && !busy && (
        <div className="empty">
          <h2>Импорт плана</h2>
          <p>
            Загрузите PDF с планом здания. Программа прочитает геометрию чертежа и построит цифровой
            план: стены, перегородки, их толщины и координаты.
          </p>
          <p className="muted">
            После распознавания откроется окно сверки. Режим «Наложение» показывает цифровой план
            поверх оригинала — по нему видно, где распознавание разошлось с чертежом. Режим
            «Показать уверенность» красит сомнительные объекты, чтобы не искать их глазами.
          </p>
        </div>
      )}

      {result !== null && rendered !== null && area !== null && (
        <>
          <PlanCompare
            originalUrl={result.originalUrl}
            digitalSvg={rendered.svg}
            widthPt={result.page.widthPt}
            heightPt={result.page.heightPt}
            needsReview={rendered.needsReview}
            totalElements={elements.length}
            showConfidence={showConfidence}
            onToggleConfidence={setShowConfidence}
          />
          <RecognitionFacts outcome={result.outcome} />
        </>
      )}

      {result !== null && (rendered === null || area === null) && (
        <div className="empty">
          <h2 className="warn">Распознать не удалось</h2>
          <p>{result.outcome.model.history[0]?.summary ?? 'Причина не указана.'}</p>
          <RecognitionFacts outcome={result.outcome} />
        </div>
      )}
    </div>
  );
}

/** Числа вместо впечатления. Пункт 27 ТЗ: качество нельзя принимать на глаз. */
function RecognitionFacts({ outcome }: { outcome: RecognizeOutcome }): React.JSX.Element {
  const { analysis, trace, walls } = outcome;

  return (
    <div className="facts-bar">
      <dl className="facts">
        <dt>Документ</dt>
        <dd>
          {analysis.hasVectorGeometry ? 'векторный чертёж' : 'без векторной геометрии'}
          {' · '}
          путей {analysis.vectorPathCount}
          {' · '}
          надписей {analysis.textItemCount}
        </dd>

        <dt>Масштаб в тексте</dt>
        <dd>{analysis.scaleFromText === null ? 'не найден' : `1:${analysis.scaleFromText}`}</dd>

        <dt>Область плана</dt>
        <dd>
          {analysis.planArea === null
            ? 'не определена'
            : `${Math.round(analysis.planArea.width)} × ${Math.round(analysis.planArea.height)} пт`}
          {' · уверенность '}
          {Math.round(analysis.planAreaConfidence * 100)}%
          {' · исключено текстовых блоков '}
          {analysis.textClusters.length}
        </dd>

        <dt>Отброшено при очистке</dt>
        <dd>
          вне области {trace.droppedOutsideArea}
          {' · внутри текста '}
          {trace.droppedInsideText}
          {' · заливок не в счёт '}
          {trace.droppedFills}
        </dd>

        <dt>Геометрия</dt>
        <dd>
          отрезков после склейки {trace.afterMerge}
          {' · залитых полос '}
          {trace.barsFound}
        </dd>

        <dt>Конструкция</dt>
        <dd>
          стен из полос {walls.fromBars}
          {' · из пар граней '}
          {walls.fromPairs}
          {' · перегородок '}
          {walls.partitions}
          {' · наружных '}
          {walls.exterior}
          {walls.needsReview > 0 && <span className="warn"> · требуют проверки {walls.needsReview}</span>}
        </dd>
      </dl>
    </div>
  );
}
