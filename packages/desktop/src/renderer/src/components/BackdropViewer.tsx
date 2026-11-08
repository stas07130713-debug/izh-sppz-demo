/**
 * Просмотр подложки: колесо мыши приближает, перетаскивание двигает.
 *
 * Кроме просмотра умеет три вещи: ставить точки, обводить прямоугольники и
 * обводить область от руки. Прямоугольниками задаются обрезка, стираемые
 * области и габарит здания для масштаба; обводкой от руки — то, что
 * прямоугольником не выделить: соседний цех за ломаной стеной, крыльцо,
 * вырез в плане.
 *
 * Все координаты, которые отсюда выходят, — точки исходного изображения
 * подложки, а не экрана. Поэтому они не зависят ни от приближения, ни от
 * положения окна.
 */

import { useEffect, useCallback, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from 'react';
import type { PixelPoint, PixelRect } from '@izh/contracts';

export type ViewerMode = 'pan' | 'pick-points' | 'draw-rect' | 'draw-lasso';

/**
 * Что обведено. Цвет рамки говорит, чем обведённое станет.
 *
 * erase-color отделён от erase не для красоты: стереть область целиком и
 * убрать в ней одно цветное — разные по последствиям вещи, и перепутать их
 * на чужом чертеже стоит дорого.
 */
export type OverlayKind = 'crop' | 'erase' | 'erase-color' | 'extents';

/** Обведённая от руки область поверх подложки. */
export interface OverlayPolygon {
  readonly points: readonly PixelPoint[];
  readonly kind: OverlayKind;
}

export interface OverlayRect {
  readonly rect: PixelRect;
  readonly kind: OverlayKind;
}

export interface BackdropViewerProps {
  readonly imageUrl: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly caption: string | null;
  readonly mode: ViewerMode;
  readonly hint: string | null;
  readonly points: readonly PixelPoint[];
  /** Первый конец прямой и её оформление — для живого предпросмотра. */
  readonly previewLineFrom?: PixelPoint | null;
  readonly previewLineColor?: string;
  readonly previewLineWidthPx?: number;
  readonly overlays: readonly OverlayRect[];
  /** Обведённые от руки области. Показываются так же, как прямоугольные. */
  readonly polygons?: readonly OverlayPolygon[];
  readonly onPickPoint: (point: PixelPoint) => void;
  readonly onRectDrawn: (rect: PixelRect) => void;
  /** Обводка от руки завершена. Меньше трёх точек не приходит. */
  readonly onLassoDrawn?: (points: readonly PixelPoint[]) => void;
}

/** Ближе этого расстояния точки обводки не копятся: иначе их набегают тысячи. */
const LASSO_STEP_PX = 3;

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 8;

const OVERLAY_COLORS: Record<OverlayKind, string> = {
  crop: '#38bdf8',
  erase: '#f97316',
  'erase-color': '#a855f7',
  extents: '#22c55e',
};

type ViewerContentStyle = CSSProperties & {
  readonly '--viewer-zoom': number;
};

function rectFromPoints(a: PixelPoint, b: PixelPoint): PixelRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    widthPx: Math.abs(b.x - a.x),
    heightPx: Math.abs(b.y - a.y),
  };
}

export function BackdropViewer(props: BackdropViewerProps): React.JSX.Element {
  const areaRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.25);
  const [offset, setOffset] = useState<PixelPoint>({ x: 40, y: 40 });
  const panFrom = useRef<{ pointer: PixelPoint; offset: PixelPoint } | null>(null);
  const [rectFrom, setRectFrom] = useState<PixelPoint | null>(null);
  const [rectTo, setRectTo] = useState<PixelPoint | null>(null);
  /** Точки текущей обводки от руки. Пусто — обводка не идёт. */
  const [lasso, setLasso] = useState<readonly PixelPoint[]>([]);
  const [cursorPoint, setCursorPoint] = useState<PixelPoint | null>(null);

  const toImagePoint = useCallback(
    (clientX: number, clientY: number): PixelPoint => {
      const area = areaRef.current;
      if (area === null) return { x: 0, y: 0 };
      const rect = area.getBoundingClientRect();
      return {
        x: (clientX - rect.left - offset.x) / zoom,
        y: (clientY - rect.top - offset.y) / zoom,
      };
    },
    [offset, zoom],
  );

  const handleWheel = (event: WheelEvent<HTMLDivElement>): void => {
    const area = areaRef.current;
    if (area === null) return;

    const bounds = area.getBoundingClientRect();
    const cursor = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    const applied = nextZoom / zoom;

    // Точка под курсором должна остаться на месте.
    setOffset({
      x: cursor.x - (cursor.x - offset.x) * applied,
      y: cursor.y - (cursor.y - offset.y) * applied,
    });
    setZoom(nextZoom);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    const point = toImagePoint(event.clientX, event.clientY);

    if (props.mode === 'pick-points') {
      props.onPickPoint(point);
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    if (props.mode === 'draw-rect') {
      setRectFrom(point);
      setRectTo(point);
      return;
    }

    if (props.mode === 'draw-lasso') {
      setLasso([point]);
      return;
    }

    panFrom.current = { pointer: { x: event.clientX, y: event.clientY }, offset };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (props.previewLineFrom !== null && props.previewLineFrom !== undefined) {
      setCursorPoint(toImagePoint(event.clientX, event.clientY));
    }
    if (props.mode === 'draw-rect' && rectFrom !== null) {
      setRectTo(toImagePoint(event.clientX, event.clientY));
      return;
    }

    if (props.mode === 'draw-lasso' && lasso.length > 0) {
      const point = toImagePoint(event.clientX, event.clientY);
      setLasso((current) => {
        const last = current[current.length - 1];
        // Точки копятся не подряд, а через шаг: за один проход мыши их
        // набегают тысячи, и список пришлось бы хранить и пересчитывать
        // целиком. Шаг задан в точках подложки и делится на приближение —
        // на увеличенном чертеже рука ведёт границу точнее.
        if (last !== undefined && Math.hypot(point.x - last.x, point.y - last.y) < LASSO_STEP_PX / zoom) {
          return current;
        }
        return [...current, point];
      });
      return;
    }

    const from = panFrom.current;
    if (from === null) return;
    setOffset({
      x: from.offset.x + (event.clientX - from.pointer.x),
      y: from.offset.y + (event.clientY - from.pointer.y),
    });
  };

  const handlePointerUp = (): void => {
    if (props.mode === 'draw-rect' && rectFrom !== null && rectTo !== null) {
      const drawn = rectFromPoints(rectFrom, rectTo);
      if (drawn.widthPx >= 4 && drawn.heightPx >= 4) props.onRectDrawn(drawn);
    }

    if (props.mode === 'draw-lasso' && lasso.length >= 3) props.onLassoDrawn?.(lasso);
    setLasso([]);
    setRectFrom(null);
    setRectTo(null);
    panFrom.current = null;
  };

  /**
   * Вписать подложку в окно.
   *
   * Вызывается и сама при открытии: человек нажал «загрузить», и первое, что он
   * должен увидеть, — чертёж целиком. Прежде начальный масштаб был 25 %, и
   * маленький план терялся в углу, а большой не помещался — и то и другое
   * приходилось поправлять руками, прежде чем начать работу.
   */
  const fitToWindow = useCallback((): void => {
    const area = areaRef.current;
    if (area === null) return;
    const bounds = area.getBoundingClientRect();
    const scale = Math.min(bounds.width / props.widthPx, bounds.height / props.heightPx) * 0.95;
    setZoom(scale);
    setOffset({
      x: (bounds.width - props.widthPx * scale) / 2,
      y: (bounds.height - props.heightPx * scale) / 2,
    });
  }, [props.widthPx, props.heightPx]);

  // Другая подложка — снова целиком: размеры у чертежей разные, и оставлять
  // масштаб от предыдущего значит показывать новый обрезком.
  useEffect(() => { fitToWindow(); }, [fitToWindow, props.imageUrl]);

  const pending = rectFrom !== null && rectTo !== null ? rectFromPoints(rectFrom, rectTo) : null;
  const stroke = (value: number): number => value / zoom;
  const viewerContentStyle: ViewerContentStyle = {
    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
    width: props.widthPx,
    height: props.heightPx,
    '--viewer-zoom': zoom,
  };

  return (
    <div className="viewer">
      <div className="viewer-toolbar">
        <button type="button" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.25))}>
          Приблизить
        </button>
        <button type="button" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.25))}>
          Отдалить
        </button>
        <button type="button" onClick={fitToWindow}>
          Вписать в окно
        </button>
        <span className="muted">Просмотр {Math.round(zoom * 100)}%</span>
        {props.hint !== null && <span className="hint">{props.hint}</span>}
      </div>

      {/*
        * Подпись стоит над чертежом, а не на нём.
        *
        * Заказчик: «при загрузке подложки появляется надпись названия этой
        * подложки на самом плане — нужно убрать это». Поверх чертежа она
        * всегда кому-то мешала: там штамп, там вход, там стена, которую как
        * раз меряют. Ту же правку раньше сделали на вкладке «План», а в
        * редакторе подложки она осталась.
        */}
      {props.caption !== null && <div className="plan-title viewer-title">{props.caption}</div>}

      <div
        ref={areaRef}
        className={`viewer-area mode-${props.mode}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => setCursorPoint(null)}
      >
        <div
          className="viewer-content"
          style={viewerContentStyle}
        >
          <img
            src={props.imageUrl}
            width={props.widthPx}
            height={props.heightPx}
            alt="Подложка плана"
            draggable={false}
          />

          <svg
            className="viewer-overlay"
            width={props.widthPx}
            height={props.heightPx}
            viewBox={`0 0 ${props.widthPx} ${props.heightPx}`}
          >
            {props.overlays.map((overlay, index) => (
              <rect
                key={`${overlay.kind}-${index}`}
                x={overlay.rect.x}
                y={overlay.rect.y}
                width={overlay.rect.widthPx}
                height={overlay.rect.heightPx}
                fill={overlay.kind === 'erase' ? 'rgba(255,255,255,.72)' : 'none'}
                stroke={OVERLAY_COLORS[overlay.kind]}
                strokeWidth={stroke(2)}
                strokeDasharray={overlay.kind === 'crop' ? stroke(10) : undefined}
              />
            ))}

            {(props.polygons ?? []).map((polygon, index) => (
              <polygon
                key={`обводка-${polygon.kind}-${index}`}
                points={polygon.points.map((point) => `${point.x},${point.y}`).join(' ')}
                fill={polygon.kind === 'erase' ? 'rgba(255,255,255,.72)' : 'none'}
                stroke={OVERLAY_COLORS[polygon.kind]}
                strokeWidth={stroke(2)}
              />
            ))}

            {/* Незамкнутая обводка ведётся линией: замкнуть её раньше времени
                значило бы показывать не то, что человек обводит. */}
            {lasso.length > 1 && (
              <polyline
                points={lasso.map((point) => `${point.x},${point.y}`).join(' ')}
                fill="rgba(249,115,22,.15)"
                stroke="#f97316"
                strokeWidth={stroke(2)}
              />
            )}

            {pending !== null && (
              <rect
                x={pending.x}
                y={pending.y}
                width={pending.widthPx}
                height={pending.heightPx}
                fill="rgba(56,189,248,.15)"
                stroke="#38bdf8"
                strokeWidth={stroke(2)}
              />
            )}

            {props.previewLineFrom !== null
              && props.previewLineFrom !== undefined
              && cursorPoint !== null && (
              <line
                x1={props.previewLineFrom.x}
                y1={props.previewLineFrom.y}
                x2={cursorPoint.x}
                y2={cursorPoint.y}
                stroke={props.previewLineColor ?? '#111827'}
                strokeWidth={props.previewLineWidthPx ?? 4}
                strokeDasharray={`${stroke(8)} ${stroke(5)}`}
                pointerEvents="none"
              />
            )}

            {props.points.length === 2 && props.points[0] !== undefined && props.points[1] !== undefined && (
              <line
                x1={props.points[0].x}
                y1={props.points[0].y}
                x2={props.points[1].x}
                y2={props.points[1].y}
                stroke="#e11d48"
                strokeWidth={stroke(2)}
              />
            )}
            {props.points.map((point, index) => (
              <circle
                key={`${point.x}-${point.y}-${index}`}
                cx={point.x}
                cy={point.y}
                r={stroke(5)}
                fill="#e11d48"
                stroke="#ffffff"
                strokeWidth={stroke(1.5)}
              />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
