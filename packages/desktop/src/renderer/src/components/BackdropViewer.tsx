/**
 * Просмотр подложки: колесо мыши приближает, перетаскивание двигает.
 *
 * Кроме просмотра умеет две вещи: ставить точки и обводить прямоугольники.
 * Прямоугольниками задаются обрезка, стираемые области и габарит здания для
 * масштаба.
 *
 * Все координаты, которые отсюда выходят, — точки исходного изображения
 * подложки, а не экрана. Поэтому они не зависят ни от приближения, ни от
 * положения окна.
 */

import { useCallback, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import type { PixelPoint, PixelRect } from '@izh/contracts';

export type ViewerMode = 'pan' | 'pick-points' | 'draw-rect';

export interface OverlayRect {
  readonly rect: PixelRect;
  readonly kind: 'crop' | 'erase' | 'extents';
}

export interface BackdropViewerProps {
  readonly imageUrl: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly mode: ViewerMode;
  readonly hint: string | null;
  readonly points: readonly PixelPoint[];
  readonly overlays: readonly OverlayRect[];
  readonly onPickPoint: (point: PixelPoint) => void;
  readonly onRectDrawn: (rect: PixelRect) => void;
}

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 8;

const OVERLAY_COLORS: Record<OverlayRect['kind'], string> = {
  crop: '#38bdf8',
  erase: '#f97316',
  extents: '#22c55e',
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

    panFrom.current = { pointer: { x: event.clientX, y: event.clientY }, offset };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (props.mode === 'draw-rect' && rectFrom !== null) {
      setRectTo(toImagePoint(event.clientX, event.clientY));
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
    setRectFrom(null);
    setRectTo(null);
    panFrom.current = null;
  };

  const fitToWindow = (): void => {
    const area = areaRef.current;
    if (area === null) return;
    const bounds = area.getBoundingClientRect();
    const scale = Math.min(bounds.width / props.widthPx, bounds.height / props.heightPx) * 0.95;
    setZoom(scale);
    setOffset({
      x: (bounds.width - props.widthPx * scale) / 2,
      y: (bounds.height - props.heightPx * scale) / 2,
    });
  };

  const pending = rectFrom !== null && rectTo !== null ? rectFromPoints(rectFrom, rectTo) : null;
  const stroke = (value: number): number => value / zoom;

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

      <div
        ref={areaRef}
        className={`viewer-area mode-${props.mode}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="viewer-content"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            width: props.widthPx,
            height: props.heightPx,
          }}
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
                fill={overlay.kind === 'erase' ? 'rgba(249,115,22,.18)' : 'none'}
                stroke={OVERLAY_COLORS[overlay.kind]}
                strokeWidth={stroke(2)}
                strokeDasharray={overlay.kind === 'crop' ? stroke(10) : undefined}
              />
            ))}

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
