/**
 * Кольцевая диаграмма состава — по образцу заказчика («Вид ИЖ СППЗ»): на
 * дашборде и в карточке группы состояние показывается кругом с разбивкой по
 * цветам, а не только списком чисел. Список остаётся рядом как расшифровка —
 * круг даёт мгновенное соотношение долей, список даёт точные цифры.
 */

export interface DonutSegment {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly color: string;
}

export interface DonutChartProps {
  readonly segments: readonly DonutSegment[];
  /** Подпись в центре круга, например «Всего» или число элементов. */
  readonly centerLabel?: string;
  readonly centerValue?: string;
  readonly size?: number;
  /**
   * Нажатие на долю круга (ТЗ, Дополнение 3, часть К4).
   *
   * Заказчик: «нажал на просроченные — и вывело только просроченные». Доля
   * круга — такой же показатель, как плитка, и вести должна туда же.
   */
  readonly onPick?: (key: string) => void;
}

export function DonutChart(props: DonutChartProps): React.JSX.Element {
  const size = props.size ?? 120;
  const stroke = size * 0.18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = props.segments.reduce((sum, segment) => sum + segment.value, 0);

  let offset = 0;
  const arcs = props.segments
    .filter((segment) => segment.value > 0)
    .map((segment) => {
      const fraction = total === 0 ? 0 : segment.value / total;
      const length = fraction * circumference;
      const dashArray = `${length} ${circumference - length}`;
      const dashOffset = -offset;
      offset += length;
      return { ...segment, dashArray, dashOffset };
    });

  return (
    <svg
      className="donut-chart"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={props.segments.map((segment) => `${segment.label}: ${segment.value}`).join(', ')}
    >
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      {total > 0 &&
        arcs.map((arc) => (
          <circle
            key={arc.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={stroke}
            strokeDasharray={arc.dashArray}
            strokeDashoffset={arc.dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className={props.onPick === undefined ? undefined : 'donut-arc-clickable'}
            onClick={props.onPick === undefined ? undefined : () => props.onPick?.(arc.key)}
          >
            <title>{`${arc.label}: ${arc.value}`}</title>
          </circle>
        ))}
      {(props.centerLabel !== undefined || props.centerValue !== undefined) && (
        <text x="50%" y="50%" textAnchor="middle" className="donut-center">
          {props.centerValue !== undefined && (
            <tspan x="50%" dy={props.centerLabel === undefined ? '0.35em' : '-0.15em'} className="donut-center-value">
              {props.centerValue}
            </tspan>
          )}
          {props.centerLabel !== undefined && (
            <tspan x="50%" dy="1.2em" className="donut-center-label">
              {props.centerLabel}
            </tspan>
          )}
        </text>
      )}
    </svg>
  );
}
