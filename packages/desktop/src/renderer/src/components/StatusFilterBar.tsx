/**
 * Строка выбора состояния для нижней панели (ТЗ, Дополнение 3, часть К3).
 *
 * Один и тот же компонент на плане и в журнале — заказчик прямо просит
 * единообразие: «Интерфейс и логика выбора должны быть максимально
 * единообразными». Отметка применяется сразу, без кнопки «применить».
 *
 * Состояния показаны кнопками-метками, а не голыми чекбоксами. Причина не в
 * красоте: галочка, точка, подпись и число в скобках — четыре мелких предмета
 * на каждое из пяти состояний, и строка из двадцати предметов переносилась на
 * второй ряд, разъезжаясь при каждом изменении числа. Метка — один предмет:
 * она целиком нажимается, целиком подсвечивается выбранной и держит строку
 * ровной. Отмеченность видна цветом и рамкой, а не отдельным значком.
 */

import { FILTER_TAG_LABELS, FILTER_TAG_ORDER, type FilterTag } from './status-filter';

export interface StatusFilterBarProps {
  readonly selected: ReadonlySet<FilterTag>;
  readonly onToggle: (tag: FilterTag) => void;
  /** Сколько элементов у каждого статуса — показывается рядом с подписью. */
  readonly counts?: ReadonlyMap<FilterTag, number>;
}

export function StatusFilterBar(props: StatusFilterBarProps): React.JSX.Element {
  return (
    <div className="status-filter-bar">
      <span className="status-filter-label">Состояние</span>
      <div className="status-filter-chips">
        {FILTER_TAG_ORDER.map((tag) => {
          const on = props.selected.has(tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={on}
              className={`status-chip status-filter-${statusClass(tag)}${on ? ' on' : ''}`}
              onClick={() => props.onToggle(tag)}
            >
              <span className="status-dot" />
              <span className="status-chip-name">{FILTER_TAG_LABELS[tag]}</span>
              {props.counts !== undefined && (
                <span className="status-chip-count">{props.counts.get(tag) ?? 0}</span>
              )}
            </button>
          );
        })}
      </div>
      {/* Снять отбор — значком, а не словами: «показать все» занимало столько
          же места, сколько целая метка, и из-за него подписи переставали
          помещаться ровно тогда, когда отбор включён. */}
      {props.selected.size > 0 && (
        <button
          type="button"
          className="status-filter-reset"
          title="Показать все: снять отбор по состоянию"
          aria-label="Показать все: снять отбор по состоянию"
          onClick={() => {
            for (const tag of props.selected) props.onToggle(tag);
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

function statusClass(tag: FilterTag): string {
  if (tag === 'норма') return 'ok';
  if (tag === 'скоро') return 'warn';
  if (tag === 'просрочено' || tag === 'неисправно') return 'danger';
  return 'unknown';
}
