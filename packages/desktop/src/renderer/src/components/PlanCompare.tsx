/**
 * Окно сверки распознавания. Пункт 20 ТЗ.
 *
 * Три режима: цифровой план, оригинал, наложение. Наложение — главный: только
 * оно показывает, где именно распознавание разошлось с чертежом. Судить по
 * одной картинке «похоже или нет» бессмысленно, а по наложению видно место.
 */

import { useState } from 'react';

export type CompareMode = 'digital' | 'original' | 'overlay';

export interface PlanCompareProps {
  /** Отрисованная страница документа. */
  readonly originalUrl: string | null;
  /** Цифровой план в виде SVG. */
  readonly digitalSvg: string | null;
  readonly widthPt: number;
  readonly heightPt: number;
  readonly needsReview: number;
  readonly totalElements: number;
  readonly showConfidence: boolean;
  readonly onToggleConfidence: (value: boolean) => void;
}

const MODE_LABELS: Record<CompareMode, string> = {
  digital: 'Цифровой план',
  original: 'Оригинал',
  overlay: 'Наложение',
};

export function PlanCompare(props: PlanCompareProps): React.JSX.Element {
  const [mode, setMode] = useState<CompareMode>('overlay');
  const [opacity, setOpacity] = useState(60);
  const [zoom, setZoom] = useState(0.6);

  const digitalUrl =
    props.digitalSvg === null
      ? null
      : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(props.digitalSvg)}`;

  const showOriginal = mode !== 'digital' && props.originalUrl !== null;
  const showDigital = mode !== 'original' && digitalUrl !== null;
  const digitalOpacity = mode === 'overlay' ? opacity / 100 : 1;

  return (
    <div className="viewer">
      <div className="viewer-toolbar">
        {(Object.keys(MODE_LABELS) as CompareMode[]).map((value) => (
          <button
            key={value}
            type="button"
            className={mode === value ? 'tab active' : 'tab'}
            onClick={() => setMode(value)}
          >
            {MODE_LABELS[value]}
          </button>
        ))}

        {mode === 'overlay' && (
          <label className="inline-range">
            <span className="muted small">Цифровой план {opacity}%</span>
            <input
              type="range"
              min={0}
              max={100}
              value={opacity}
              onChange={(event) => setOpacity(Number(event.target.value))}
            />
          </label>
        )}

        <button type="button" onClick={() => setZoom((value) => Math.min(6, value * 1.25))}>
          Приблизить
        </button>
        <button type="button" onClick={() => setZoom((value) => Math.max(0.05, value / 1.25))}>
          Отдалить
        </button>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={props.showConfidence}
            onChange={(event) => props.onToggleConfidence(event.target.checked)}
          />
          <span className="small">Показать уверенность</span>
        </label>

        <span className="muted small">
          объектов {props.totalElements}
          {props.needsReview > 0 && <span className="warn"> · требуют проверки {props.needsReview}</span>}
        </span>
      </div>

      <div className="viewer-area compare">
        <div
          className="compare-stack"
          style={{ width: props.widthPt * zoom, height: props.heightPt * zoom }}
        >
          {showOriginal && (
            <img
              className="compare-layer"
              src={props.originalUrl ?? ''}
              alt="Оригинал"
              draggable={false}
            />
          )}
          {showDigital && (
            <img
              className="compare-layer"
              src={digitalUrl ?? ''}
              alt="Цифровой план"
              draggable={false}
              style={{
                opacity: digitalOpacity,
                // В наложении цифровой план идёт умножением, иначе белый фон
                // SVG закрыл бы оригинал целиком.
                mixBlendMode: mode === 'overlay' ? 'multiply' : 'normal',
              }}
            />
          )}
        </div>
      </div>

      {props.showConfidence && (
        <div className="legend-bar">
          <span><i className="dot" style={{ background: '#16a34a' }} /> принято</span>
          <span><i className="dot" style={{ background: '#f59e0b' }} /> проверить</span>
          <span><i className="dot" style={{ background: '#dc2626' }} /> сомнительно</span>
        </div>
      )}
    </div>
  );
}
