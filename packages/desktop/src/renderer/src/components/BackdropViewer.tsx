/**
 * Просмотр подложки: колесо мыши приближает, перетаскивание двигает.
 *
 * Подложка показывается обычной картинкой с преобразованием, а не холстом:
 * браузер сам справляется с изображением в несколько тысяч точек по стороне, а
 * кода получается втрое меньше. Когда на подложку начнут наноситься объекты,
 * поверх картинки ляжет слой векторной графики в той же системе координат.
 */

import { useCallback, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import type { PixelPoint } from '@izh/contracts';

export interface BackdropViewerProps {
  readonly imageUrl: string;
  readonly widthPx: number;
  readonly heightPx: number;
  /** В режиме калибровки щелчок ставит точку, а не двигает подложку. */
  readonly pickingPoints: boolean;
  readonly points: readonly PixelPoint[];
  readonly onPickPoint: (point: PixelPoint) => void;
}

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 8;

export function BackdropViewer(props: BackdropViewerProps): React.JSX.Element {
  const areaRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.25);
  const [offset, setOffset] = useState<PixelPoint>({ x: 40, y: 40 });
  const dragFrom = useRef<{ pointer: PixelPoint; offset: PixelPoint } | null>(null);

  /** Переводит координаты указателя в координаты точки на подложке. */
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

    const rect = area.getBoundingClientRect();
    const cursor = { x: event.clientX - rect.left, y: event.clientY - rect.top };

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
    if (props.pickingPoints) {
      props.onPickPoint(toImagePoint(event.clientX, event.clientY));
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragFrom.current = { pointer: { x: event.clientX, y: event.clientY }, offset };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const from = dragFrom.current;
    if (from === null) return;
    setOffset({
      x: from.offset.x + (event.clientX - from.pointer.x),
      y: from.offset.y + (event.clientY - from.pointer.y),
    });
  };

  const handlePointerUp = (): void => {
    dragFrom.current = null;
  };

  const fitToWindow = (): void => {
    const area = areaRef.current;
    if (area === null) return;
    const rect = area.getBoundingClientRect();
    const scale = Math.min(rect.width / props.widthPx, rect.height / props.heightPx) * 0.95;
    setZoom(scale);
    setOffset({
      x: (rect.width - props.widthPx * scale) / 2,
      y: (rect.height - props.heightPx * scale) / 2,
    });
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
        <span className="muted">Масштаб просмотра {Math.round(zoom * 100)}%</span>
        {props.pickingPoints && <span className="hint">Щёлкните две точки с известным расстоянием</span>}
      </div>

      <div
        ref={areaRef}
        className={props.pickingPoints ? 'viewer-area picking' : 'viewer-area'}
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
          <img src={props.imageUrl} width={props.widthPx} height={props.heightPx} alt="Подложка плана" draggable={false} />

          <svg
            className="viewer-overlay"
            width={props.widthPx}
            height={props.heightPx}
            viewBox={`0 0 ${props.widthPx} ${props.heightPx}`}
          >
            {props.points.length === 2 && props.points[0] !== undefined && props.points[1] !== undefined && (
              <line
                x1={props.points[0].x}
                y1={props.points[0].y}
                x2={props.points[1].x}
                y2={props.points[1].y}
                stroke="#e11d48"
                strokeWidth={2 / zoom}
              />
            )}
            {props.points.map((point, index) => (
              <circle
                key={`${point.x}-${point.y}-${index}`}
                cx={point.x}
                cy={point.y}
                r={5 / zoom}
                fill="#e11d48"
                stroke="#ffffff"
                strokeWidth={1.5 / zoom}
              />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
