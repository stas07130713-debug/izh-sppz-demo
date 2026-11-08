/**
 * График динамики состояния — накопленные области по датам.
 *
 * Области, а не линии: сумма всех состояний на каждую дату — это число
 * элементов, и её видно как высоту всей заливки. Линиями пришлось бы читать
 * четыре кривые и складывать их в уме.
 *
 * Рисуется своим SVG без библиотек: график здесь один, а любая библиотека
 * графиков тянет за собой свою тему, свои шрифты и свой способ считать цвета —
 * и первым же делом разошлась бы с палитрой программы.
 */

import { useId, useState } from 'react';
import type { ScheduleStatus } from '@izh/core';
import { formatDateRu } from '../format';

export interface TrendSeries {
  readonly status: ScheduleStatus;
  readonly color: string;
}

export interface TrendChartPoint {
  readonly date: string;
  readonly counts: Readonly<Record<ScheduleStatus, number>>;
}

export interface TrendChartProps {
  readonly points: readonly TrendChartPoint[];
  /** Порядок снизу вверх: первым — то, что лежит в основании заливки. */
  readonly series: readonly TrendSeries[];
  readonly height?: number;
}

const WIDTH = 320;
const PAD_TOP = 6;
const PAD_BOTTOM = 18;

export function TrendChart(props: TrendChartProps): React.JSX.Element {
  const height = props.height ?? 132;
  const clipId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const points = props.points;
  const max = Math.max(1, ...points.map((point) => sumOf(point, props.series)));
  const plotHeight = height - PAD_TOP - PAD_BOTTOM;

  const xAt = (index: number): number =>
    points.length <= 1 ? WIDTH / 2 : (index / (points.length - 1)) * WIDTH;
  const yAt = (value: number): number => PAD_TOP + plotHeight - (value / max) * plotHeight;

  /*
   * Каждая полоса — от накопленной суммы «под ней» до суммы «включая её».
   * Считается снизу вверх, поэтому порядок серий и порядок легенды совпадают.
   */
  const areas = props.series.map((series, seriesIndex) => {
    const lower = points.map((point) =>
      props.series.slice(0, seriesIndex).reduce((sum, item) => sum + point.counts[item.status], 0));
    const upper = lower.map((value, index) => value + (points[index]?.counts[series.status] ?? 0));

    const top = upper.map((value, index) => `${xAt(index)},${yAt(value)}`).join(' ');
    const bottom = [...lower].reverse().map((value, index) => {
      const at = lower.length - 1 - index;
      return `${xAt(at)},${yAt(value)}`;
    }).join(' ');

    return { key: series.status, color: series.color, points: `${top} ${bottom}` };
  });

  const active = hover === null ? null : points[hover] ?? null;

  return (
    <div className="trend-chart">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${WIDTH} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Динамика состояния за ${points.length} точек, последняя — ${points[points.length - 1]?.date ?? ''}`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y={PAD_TOP} width={WIDTH} height={plotHeight} />
          </clipPath>
        </defs>

        {/* Толщина линий не тянется вместе с полотном: preserveAspectRatio
            «none» растягивает график по ширине карточки втрое, и обычная
            вертикальная линия в единицу толщины стала бы жирной чертой. */}
        <line
          x1="0" y1={PAD_TOP + plotHeight} x2={WIDTH} y2={PAD_TOP + plotHeight}
          className="trend-axis" vectorEffect="non-scaling-stroke"
        />

        <g clipPath={`url(#${clipId})`}>
          {areas.map((area) => (
            <polygon key={area.key} points={area.points} fill={area.color} fillOpacity={0.75} />
          ))}
        </g>

        {hover !== null && (
          <line
            x1={xAt(hover)} y1={PAD_TOP} x2={xAt(hover)} y2={PAD_TOP + plotHeight}
            className="trend-cursor" vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Прозрачные полосы наведения: попасть мышью в тонкую линию нельзя. */}
        {points.map((point, index) => (
          <rect
            key={point.date}
            x={index === 0 ? 0 : xAt(index) - WIDTH / (points.length - 1) / 2}
            y={PAD_TOP}
            width={points.length <= 1 ? WIDTH : WIDTH / (points.length - 1)}
            height={plotHeight}
            fill="transparent"
            onMouseEnter={() => setHover(index)}
          />
        ))}
      </svg>

      <div className="trend-scale muted small">
        <span>{points[0] === undefined ? '' : formatDateRu(points[0].date)}</span>
        <span>{points[points.length - 1] === undefined ? '' : formatDateRu(points[points.length - 1]!.date)}</span>
      </div>

      {/* Всплывающего окошка нет: на дашборде оно закрывало бы соседний блок.
          Значения показываются строкой под графиком, на своём месте. */}
      <div className="trend-readout small">
        {active === null ? (
          <span className="muted">Наведите на график, чтобы увидеть числа на дату.</span>
        ) : (
          <>
            <strong>{formatDateRu(active.date)}</strong>
            {props.series.map((series) => (
              <span key={series.status} className="trend-readout-item">
                <span className="group-dot" style={{ background: series.color }} />
                {series.status}: {active.counts[series.status]}
              </span>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function sumOf(point: TrendChartPoint, series: readonly TrendSeries[]): number {
  return series.reduce((sum, item) => sum + point.counts[item.status], 0);
}
