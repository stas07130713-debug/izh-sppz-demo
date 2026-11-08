/**
 * Полоса состояний — одна строка «Состояния по объектам».
 *
 * Заменяет три числа подряд: у объекта видно не только сколько просрочено, но
 * и какую долю от всего это составляет. Полоса делится ровно на те же четыре
 * состояния и теми же цветами, что круг и график, — иначе экран пришлось бы
 * читать блоками, а не целиком.
 */

import type { ScheduleStatus } from '@izh/core';
import { STATUS_COLOR_VAR, STATUS_ORDER } from './dashboard-context';

export interface StatusBarProps {
  readonly counts: Readonly<Record<ScheduleStatus, number>>;
  /** Что делать по нажатию на долю. Без обработчика полоса не кликабельна. */
  readonly onPick?: (status: ScheduleStatus) => void;
}

export function StatusBar(props: StatusBarProps): React.JSX.Element {
  const total = STATUS_ORDER.reduce((sum, status) => sum + props.counts[status], 0);

  return (
    <div className="status-bar" role="img" aria-label={STATUS_ORDER
      .filter((status) => props.counts[status] > 0)
      .map((status) => `${status}: ${props.counts[status]}`)
      .join(', ')}
    >
      {STATUS_ORDER.map((status) => {
        const value = props.counts[status];
        if (value === 0) return null;
        const width = `${(value / Math.max(1, total)) * 100}%`;
        const title = `${status}: ${value}`;

        // Нажимаемая доля — кнопка, ненажимаемая — просто заливка: элемент не
        // должен выглядеть интерактивным, если по нему некуда вести.
        if (props.onPick === undefined) {
          return (
            <span key={status} className="status-bar-part" style={{ width, background: STATUS_COLOR_VAR[status] }} title={title} />
          );
        }
        return (
          <button
            key={status}
            type="button"
            className="status-bar-part status-bar-part-clickable"
            style={{ width, background: STATUS_COLOR_VAR[status] }}
            title={`${title} — показать в журнале`}
            aria-label={`${title} — показать в журнале`}
            onClick={() => props.onPick?.(status)}
          />
        );
      })}
    </div>
  );
}
