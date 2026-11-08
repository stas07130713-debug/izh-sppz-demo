/**
 * Правка загруженной подложки: поворот и стирание лишнего.
 *
 * Чертежи приходят с нагрузкой: штамп, рамка, экспликация, соседний цех в тех
 * же осях, цветные стрелки эвакуации поверх планировки. Убирать это в той
 * программе, где чертили, умеет не каждый, а на плане лишнее мешает — значки
 * теряются в чужих линиях.
 *
 * Инструмента выделения два, и они не взаимозаменяемы. Прямоугольником снимают
 * то, что прямоугольно: штамп в углу, таблицу, рамку листа. Обводкой от руки —
 * всё остальное: соседний цех за ломаной стеной, крыльцо, вырез в плане.
 * Прямоугольник там захватил бы половину своего здания.
 *
 * Отдельно — «убрать только цветное». Тем же выделением, но внутри него гибнут
 * только цветные точки: стрелки уходят, стены под ними остаются. Без этого
 * стрелку, лежащую поперёк коридора, стереть нечем — вместе с ней уходит и
 * коридор.
 *
 * Отдельно — перо. Чертежи приходят не только с лишним, но и с недостающим:
 * перегородку поставили после выпуска плана, проём заложили. Стереть такое
 * нечем — там нечего стирать, — а без линии план врёт.
 *
 * Правка неразрушающая. Исходный файл остаётся в хранилище, а подложка всегда
 * считается заново от него по списку действий, поэтому «вернуть исходный
 * чертёж» — это пустой список. Отменять по одному умеют кнопки «назад» и
 * «вперёд» в шапке: правки подложки — обычные действия программы.
 */

import type { CleanupOperation } from '@izh/contracts';

export type EraserTool = 'rect' | 'lasso' | 'line' | 'free';

export interface BackdropEraserProps {
  /** Каким инструментом выделяют сейчас. null — стирание выключено. */
  readonly tool: EraserTool | null;
  readonly onPickTool: (tool: EraserTool | null) => void;
  /** Убирать внутри выделенного только цветное, не трогая линии здания. */
  readonly colorOnly: boolean;
  readonly onColorOnly: (colorOnly: boolean) => void;
  /** Выделенное, но ещё не стёртое. */
  readonly pending: readonly CleanupOperation[];
  /** Сколько действий уже применено к подложке. */
  readonly applied: number;
  readonly busy: boolean;
  readonly onApply: () => void;
  readonly onRestore: () => void;
  /** Поворот на четверть оборота: 3 — против часовой стрелки, 1 — по часовой. */
  readonly onRotate: (quarterTurns: 1 | 3) => void;
  /** Чем и как рисовать: цвет и толщина линии в точках чертежа. */
  readonly penColor: string;
  readonly onPenColor: (color: string) => void;
  readonly penWidthPx: number;
  readonly onPenWidthPx: (widthPx: number) => void;
}

function describe(operation: CleanupOperation): string {
  if (operation.kind === 'erase-rect') {
    return `прямоугольник ${Math.round(operation.rect.widthPx)} × ${Math.round(operation.rect.heightPx)} точек`;
  }
  if (operation.kind === 'erase-polygon') return `обводка из ${operation.points.length} точек`;
  if (operation.kind === 'draw-line') {
    return operation.points.length === 2
      ? `линия ${Math.round(operation.widthPx)} точек толщиной`
      : `рисунок от руки, ${operation.points.length} точек`;
  }
  if (operation.kind === 'erase-colored-in-area') {
    const where = operation.area.kind === 'rect'
      ? `прямоугольнике ${Math.round(operation.area.rect.widthPx)} × ${Math.round(operation.area.rect.heightPx)} точек`
      : `обводке из ${operation.area.points.length} точек`;
    return `только цветное в ${where}`;
  }
  return 'область';
}

export function BackdropEraser(props: BackdropEraserProps): React.JSX.Element {
  const hint = props.colorOnly
    ? 'Внутри выделенного уйдёт только цветное: стрелки, заливки, значки. Чёрные линии здания останутся.'
    : 'Внутри выделенного уйдёт всё до белого листа.';

  return (
    <section className="backdrop-eraser">
      <h3>Поправить чертёж</h3>

      {/* Поворот первым: лежащий на боку план разбирать бессмысленно, и
          стирать на нём лишнее — тем более. */}
      <div className="eraser-tools">
        <span className="small">Развернуть:</span>
        <button type="button" title="Против часовой стрелки" disabled={props.busy} onClick={() => props.onRotate(3)}>
          ↺ влево
        </button>
        <button type="button" title="По часовой стрелке" disabled={props.busy} onClick={() => props.onRotate(1)}>
          ↻ вправо
        </button>
      </div>
      <p className="muted small">
        Поворот только на прямой угол — при нём чертёж не теряет ни одной линии.
        Разметку масштаба после поворота задают заново: она указывала на прежние места.
        Уже расставленные значки поворот не переносит — если они есть, разверните чертёж до расстановки.
      </p>

      <div className="backdrop-tool-section">
      <h4>Убрать лишнее</h4>
      <p className="muted small">
        Выделите штамп, рамку, экспликацию, соседнее здание или цветные пометки.
        Исходный файл сохраняется, отмена работает общей кнопкой «Назад» в шапке.
      </p>
      <div className="eraser-tools">
        <button
          type="button"
          className={props.tool === 'rect' ? 'primary' : undefined}
          disabled={props.busy}
          onClick={() => props.onPickTool(props.tool === 'rect' ? null : 'rect')}
        >
          ▭ Прямоугольник
        </button>
        <button
          type="button"
          className={props.tool === 'lasso' ? 'primary' : undefined}
          disabled={props.busy}
          onClick={() => props.onPickTool(props.tool === 'lasso' ? null : 'lasso')}
        >
          ✎ Обводка от руки
        </button>
      </div>

      <label className="check-line">
        <input
          type="checkbox"
          checked={props.colorOnly}
          disabled={props.busy}
          onChange={(event) => props.onColorOnly(event.target.checked)}
        />
        <span>Убрать только цветное, оставить линии здания</span>
      </label>

      {(props.tool === 'rect' || props.tool === 'lasso') && (
        <p className="muted small">
          {props.tool === 'rect' ? `Обведите прямоугольную область. ${hint}`
            : `Ведите мышью по границе области, не отпуская кнопку; обводка замкнётся сама. ${hint}`}
        </p>
      )}

      {props.pending.length > 0 && (
        <>
          {/* Выделенное перечислено, а не только показано на чертеже: обводок
              бывает несколько, и по списку видно, что именно уйдёт. */}
          <ul className="eraser-list">
            {props.pending.map((operation, index) => (
              <li key={`${operation.kind}-${index}`}>{describe(operation)}</li>
            ))}
          </ul>

          <div className="actions">
            <button type="button" className="primary" disabled={props.busy} onClick={props.onApply}>
              Стереть выделенное ({props.pending.length})
            </button>
          </div>
        </>
      )}
      </div>

      <div className="backdrop-tool-section">
        <h4>Дочертить чертёж</h4>
        <p className="muted small">
          Добавьте недостающую перегородку прямой линией или дорисуйте участок от руки.
          Толщина показана на экране во время рисования.
        </p>
        <div className="eraser-tools">
          <button
            type="button"
            className={props.tool === 'line' ? 'primary' : undefined}
            disabled={props.busy}
            onClick={() => props.onPickTool(props.tool === 'line' ? null : 'line')}
          >
            ╱ Прямая линия
          </button>
          <button
            type="button"
            className={props.tool === 'free' ? 'primary' : undefined}
            disabled={props.busy}
            onClick={() => props.onPickTool(props.tool === 'free' ? null : 'free')}
          >
            ✐ От руки
          </button>
          <input
            type="color"
            className="pen-color"
            value={props.penColor}
            disabled={props.busy}
            title="Цвет линии"
            onChange={(event) => props.onPenColor(event.target.value)}
          />
          <label className="pen-width">
            <span className="small">толщина</span>
            <input
              type="range"
              min={1}
              max={20}
              value={props.penWidthPx}
              disabled={props.busy}
              onChange={(event) => props.onPenWidthPx(Number(event.target.value))}
            />
            <span className="small">{props.penWidthPx}</span>
          </label>
        </div>
        {(props.tool === 'line' || props.tool === 'free') && (
          <p className="muted small">
            {props.tool === 'line'
              ? 'Щёлкните начало и конец линии.'
              : 'Ведите мышью, не отпуская кнопку.'}
          </p>
        )}
      </div>

      {props.applied > 0 && props.pending.length === 0 && (
        <>
          <p className="muted small">
            Правок применено: {props.applied}. Отменить по одной — кнопкой «назад» в шапке.
          </p>
          <div className="actions">
            {/* Своей кнопки «шаг назад» здесь больше нет: правки подложки —
                обычные действия программы, и откатывает их «назад» в шапке.
                Две кнопки для одного и того же только сбивали с толку. */}
            <button type="button" className="link" disabled={props.busy} onClick={props.onRestore}>
              вернуть исходный чертёж
            </button>
          </div>
        </>
      )}
    </section>
  );
}
