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
import type { CleanupState, CleanupStrength } from '../cleanup-state';
import { STRENGTH_LABELS, hasAnything } from '../cleanup-state';

export type RectPurpose = 'crop' | 'erase' | 'extents';

export interface CleanupPanelProps {
  readonly state: CleanupState;
  readonly palette: readonly PaletteEntry[];
  readonly drawing: RectPurpose | null;
  readonly pickingComponents: boolean;
  readonly busy: boolean;
  readonly applied: boolean;
  readonly onChange: (next: CleanupState) => void;
  readonly onDraw: (purpose: RectPurpose | null) => void;
  readonly onPickComponents: () => void;
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
        Сначала оставьте нужный фрагмент чертежа, затем подготовьте архитектурную основу: стены,
        проёмы и лестницы. Исходный файл не меняется — очистку можно поправить или отменить.
      </p>

      <section>
        <h4>1. Вырезать нужную область</h4>
        <p className="muted small">Оставить только рабочий чертёж, убрав рамку, штамп и лишние поля.</p>
        <button
          type="button"
          className={props.drawing === 'crop' ? 'primary' : ''}
          onClick={() => props.onDraw(props.drawing === 'crop' ? null : 'crop')}
        >
          {props.drawing === 'crop' ? 'Обведите нужную область' : 'Вырезать нужную область'}
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
        <h4>2. Автоматически подготовить основу</h4>
        <p className="muted small">
          Для планов эвакуации убирает цветные маршруты и значки, но короткие разрывы стен восстанавливает,
          если линия продолжается с двух сторон. Для сканов можно отдельно оставить только тёмный контур.
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
          <>
            <div className="strength">
              {(Object.keys(STRENGTH_LABELS) as CleanupStrength[]).map((strength) => (
                <button
                  key={strength}
                  type="button"
                  className={state.strength === strength ? 'tab active' : 'tab'}
                  onClick={() => onChange({ ...state, strength })}
                >
                  {STRENGTH_LABELS[strength]}
                </button>
              ))}
            </div>
            <p className="muted small">
              {state.strength === 'light' && 'Только явно цветное. Ничего лишнего не заденет.'}
              {state.strength === 'normal' && 'Плюс кайма сглаживания. Чёрные стены и обводки не трогает.'}
              {state.strength === 'strong' &&
                'Ловит бледные заливки. Чёрные остатки значков удаляйте областью или щелчком.'}
            </p>
          </>
        )}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={state.removeTextLike}
            onChange={(e) => onChange({ ...state, removeTextLike: e.target.checked })}
          />
          <span>Убирать мелкие подписи</span>
        </label>
        {state.removeTextLike && (
          <label className="field">
            <span>Сила: {state.textMaxPixels}. Больше — убирается больше мелких элементов</span>
            <input
              type="range"
              min={200}
              max={2500}
              step={100}
              value={state.textMaxPixels}
              onChange={(e) => onChange({ ...state, textMaxPixels: Number(e.target.value) })}
            />
          </label>
        )}
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

      <section>
        <h4>3. Ручная доочистка</h4>
        <p className="muted small">Если автоматике не хватило контекста, уберите лишнее точечно.</p>
        <button
          type="button"
          className={props.pickingComponents ? 'primary' : ''}
          onClick={props.onPickComponents}
        >
          {props.pickingComponents ? 'Щёлкайте по лишнему — нажмите для завершения' : 'Убрать фигуру щелчком'}
        </button>
        {state.removedComponents.length > 0 && (
          <p className="muted small">
            Убрано фигур: {state.removedComponents.length}{' '}
            <button
              type="button"
              className="link danger"
              onClick={() => onChange({ ...state, removedComponents: [] })}
            >
              вернуть все
            </button>
          </p>
        )}
        <p className="muted small">Или выберите цвет из палитры, который нужно убрать.</p>
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
        <button
          type="button"
          className={props.drawing === 'erase' ? 'primary' : ''}
          onClick={() => props.onDraw(props.drawing === 'erase' ? null : 'erase')}
        >
          {props.drawing === 'erase' ? 'Обведите ненужное — нажмите для завершения' : 'Удалить ненужную область'}
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
          {props.busy ? 'Обрабатывается…' : 'Сохранить подложку и перейти к масштабу'}
        </button>
      </div>
    </div>
  );
}
