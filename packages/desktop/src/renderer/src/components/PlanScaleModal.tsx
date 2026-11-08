/**
 * Масштаб плана: сколько метров в одной точке чертежа.
 *
 * Способ один — отметить на чертеже отрезок, длину которого знаешь, и назвать
 * её в метрах. Длину берут откуда угодно: рулеткой по стене, из техпаспорта,
 * с размерной линии самого чертежа.
 *
 * Прежде способов было три. Заказчик: «нужно убрать введение размера напрямую,
 * сколько точек в одном метре — этого пользователь никогда не знает; габариты
 * по техпаспорту тоже убрать, так как чертёж никогда не занимает весь лист;
 * можно оставить поле, но после введения цифры сразу переводить на чертёж,
 * чтобы поставить две точки».
 *
 * Он прав в обоих случаях. Метры в точке — величина внутренняя, её неоткуда
 * взять. Ширина здания, делённая на ширину листа, верна только тогда, когда
 * чертёж занимает лист ровно от края до края, а так не бывает: есть поля,
 * штамп, экспликация. Оба способа давали правдоподобное, но неверное число, а
 * неверный масштаб врёт во всех расстояниях сразу.
 */

import { useState } from 'react';
import { backdropClose } from './modal-backdrop';

export interface PlanScaleModalProps {
  /** Ширина чертежа в точках. null — подложки нет, отмерять не по чему. */
  readonly planWidthPx: number | null;
  /** Нынешний масштаб. null — не задан. */
  readonly metersPerPixel: number | null;
  readonly busy: boolean;
  readonly onClose: () => void;
  /**
   * Уйти на план и отметить две точки.
   *
   * Длина передаётся, если она уже известна: тогда после двух точек масштаб
   * считается сразу, без повторного вопроса.
   */
  readonly onMeasureOnPlan: (knownMetres: number | null) => void;
}

function numberOrNull(raw: string): number | null {
  const value = Number(raw.replace(',', '.'));
  return raw.trim() !== '' && Number.isFinite(value) && value > 0 ? value : null;
}

export function PlanScaleModal(props: PlanScaleModalProps): React.JSX.Element {
  const [known, setKnown] = useState('');
  const metres = numberOrNull(known);
  const noPlan = props.planWidthPx === null;

  return (
    <div className="modal-backdrop" {...backdropClose(props.onClose)}>
      <div className="modal scale-modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h3>Масштаб плана</h3>
          <button type="button" className="link" onClick={props.onClose}>закрыть ✕</button>
        </div>

        <p className="muted small">
          Отметьте на чертеже отрезок известной длины — стену, пролёт, размерную линию.
          {props.metersPerPixel !== null && (
            <> Сейчас задано: {(props.metersPerPixel * 100).toFixed(1)} см в точке.</>
          )}
        </p>

        {noPlan && <p className="muted small">Подложка не загружена: отмерять не по чему.</p>}

        <div className="field-row">
          <label className="field">
            <span>Длина, м — если уже известна</span>
            <input
              inputMode="decimal"
              value={known}
              onChange={(event) => setKnown(event.target.value)}
              placeholder="например, 48"
            />
          </label>
          <button
            type="button"
            className="primary"
            disabled={props.busy || noPlan}
            onClick={() => props.onMeasureOnPlan(metres)}
          >
            📏 Отметить на плане
          </button>
        </div>

        <p className="muted small">
          Длину можно не вводить заранее — программа спросит её после того, как отрезок
          отмечен.
        </p>
      </div>
    </div>
  );
}
