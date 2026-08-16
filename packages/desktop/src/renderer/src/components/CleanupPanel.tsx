/**
 * Очистка подложки: убрать с плана всё, кроме здания.
 *
 * Планы приходят со стрелками эвакуации, уже расставленными значками
 * огнетушителей, легендой, экспликацией и штампом. Нужна голая архитектура —
 * стены, проёмы, лестницы, — на которую программа сама нанесёт оборудование.
 *
 * Всё показывается в предпросмотре сразу, а применяется к полному изображению
 * только по кнопке: считать очистку на изображении в семнадцать мегапикселей
 * при каждом движении ползунка нельзя.
 */

import type { PaletteEntry, PixelRect } from '@izh/contracts';
import type { CleanupState } from '../cleanup-state';
import { hasAnything } from '../cleanup-state';

export type RectPurpose = 'crop' | 'erase' | 'extents';

export interface CleanupPanelProps {
  readonly state: CleanupState;
  readonly palette: readonly PaletteEntry[];
  readonly drawing: RectPurpose | null;
  readonly busy: boolean;
  readonly applied: boolean;
  readonly onChange: (next: CleanupState) => void;
  readonly onDraw: (purpose: RectPurpose | null) => void;
  readonly onApply: () => void;
  readonly onReset: () => void;
}

function rectLabel(rect: PixelRect): string {
  return `${Math.round(rect.widthPx)} × ${Math.round(rect.heightPx)}`;
}

function colorCss(entry: PaletteEntry): string {
  return `rgb(${entry.color.r}, ${entry.color.g}, ${entry.color.b})`;
}

export function CleanupPanel(props: CleanupPanelProps): React.JSX.Element {
  const { state, onChange } = props;

  return (
    <div className="panel">
      <h3>Очистка подложки</h3>
      <p className="muted small">
        Уберите с плана всё, кроме здания: стрелки эвакуации, уже расставленные значки, легенду и штамп.
        Исходный файл при этом не меняется — очистку можно поправить или отменить в любой момент.
      </p>

      <section>
        <h4>Убрать всё цветное</h4>
        <p className="muted small">
          Одним движением снимает зелёные стрелки, красные значки первичных средств и цветные зоны.
          Чёрные и серые линии здания остаются.
        </p>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={state.removeColored}
            onChange={(e) => onChange({ ...state, removeColored: e.target.checked })}
          />
          <span>Убирать цветное</span>
        </label>
        {state.removeColored && (
          <label className="field">
            <span>Порог насыщенности: {state.chromaThreshold}. Меньше — убирается больше</span>
            <input
              type="range"
              min={10}
              max={200}
              value={state.chromaThreshold}
              onChange={(e) => onChange({ ...state, chromaThreshold: Number(e.target.value) })}
            />
          </label>
        )}
      </section>

      <section>
        <h4>Убрать отдельные цвета</h4>
        <p className="muted small">Основные цвета плана. Щёлкните тот, который нужно убрать.</p>
        <div className="palette">
          {props.palette.map((entry) => {
            const active = state.removedColors.some(
              (removed) =>
                removed.color.r === entry.color.r &&
                removed.color.g === entry.color.g &&
                removed.color.b === entry.color.b,
            );
            return (
              <button
                key={`${entry.color.r}-${entry.color.g}-${entry.color.b}`}
                type="button"
                className={active ? 'swatch active' : 'swatch'}
                style={{ background: colorCss(entry) }}
                title={`${colorCss(entry)} — ${Math.round(entry.share * 100)}% рисунка`}
                onClick={() =>
                  onChange({
                    ...state,
                    removedColors: active
                      ? state.removedColors.filter(
                          (removed) =>
                            removed.color.r !== entry.color.r ||
                            removed.color.g !== entry.color.g ||
                            removed.color.b !== entry.color.b,
                        )
                      : [...state.removedColors, { color: entry.color, tolerance: 28 }],
                  })
                }
              >
                {Math.round(entry.share * 100)}%
              </button>
            );
          })}
          {props.palette.length === 0 && <span className="muted small">Палитра ещё не построена.</span>}
        </div>
      </section>

      <section>
        <h4>Стереть области</h4>
        <p className="muted small">Легенда, экспликация, таблицы, роза ветров, подписи.</p>
        <button
          type="button"
          className={props.drawing === 'erase' ? 'primary' : ''}
          onClick={() => props.onDraw(props.drawing === 'erase' ? null : 'erase')}
        >
          {props.drawing === 'erase' ? 'Обводите области — нажмите для завершения' : 'Стереть область'}
        </button>
        {state.eraseRects.length > 0 && (
          <ul className="rect-list">
            {state.eraseRects.map((rect, index) => (
              <li key={`${rect.x}-${rect.y}-${index}`}>
                <span className="muted small">область {rectLabel(rect)}</span>
                <button
                  type="button"
                  className="link danger"
                  onClick={() =>
                    onChange({ ...state, eraseRects: state.eraseRects.filter((_, i) => i !== index) })
                  }
                >
                  убрать
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4>Обрезка</h4>
        <p className="muted small">Оставить только чертёж, убрав рамку и штамп. Выполняется последней.</p>
        <button
          type="button"
          className={props.drawing === 'crop' ? 'primary' : ''}
          onClick={() => props.onDraw(props.drawing === 'crop' ? null : 'crop')}
        >
          {props.drawing === 'crop' ? 'Обведите область чертежа' : 'Задать обрезку'}
        </button>
        {state.crop !== null && (
          <p className="muted small">
            Обрезка {rectLabel(state.crop)}{' '}
            <button type="button" className="link danger" onClick={() => onChange({ ...state, crop: null })}>
              убрать
            </button>
          </p>
        )}
      </section>

      <section>
        <h4>Оставить только тёмное</h4>
        <p className="muted small">Убирает светлую заливку, штриховку и серость скана.</p>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={state.keepDark}
            onChange={(e) => onChange({ ...state, keepDark: e.target.checked })}
          />
          <span>Убирать светлое</span>
        </label>
        {state.keepDark && (
          <label className="field">
            <span>Порог яркости: {state.luminanceThreshold}. Больше — убирается больше</span>
            <input
              type="range"
              min={60}
              max={250}
              value={state.luminanceThreshold}
              onChange={(e) => onChange({ ...state, luminanceThreshold: Number(e.target.value) })}
            />
          </label>
        )}
      </section>

      <div className="actions">
        {props.applied && (
          <button type="button" className="secondary" onClick={props.onReset} disabled={props.busy}>
            Отменить очистку
          </button>
        )}
        <button
          type="button"
          className="primary"
          disabled={props.busy || !hasAnything(state)}
          onClick={props.onApply}
        >
          {props.busy ? 'Обрабатывается…' : 'Применить к подложке'}
        </button>
      </div>
    </div>
  );
}
