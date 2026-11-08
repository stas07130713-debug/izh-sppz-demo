/**
 * Длина отмеренного на плане отрезка.
 *
 * Заказчик: «можно вручную указать любой известный размер стены какой-то, и
 * остальное уже программа вычисляет — масштаб всего плана».
 *
 * Так это и работает: на плане отмечают две точки — концы стены, пролёта, оси, —
 * а здесь пишут, сколько между ними метров. Из отношения метров к точкам
 * получается масштаб всего чертежа.
 *
 * Стена удобнее габарита здания: её длину помнят или меряют рулеткой, а внешний
 * габарит по чертежу ещё нужно определить — где именно край, по осям или по
 * штукатурке.
 */

import { useState } from 'react';
import { backdropClose } from './modal-backdrop';
import type { PixelPoint } from '@izh/contracts';

export interface ScaleSegmentModalProps {
  readonly a: PixelPoint;
  readonly b: PixelPoint;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (realDistanceM: number) => void;
}

export function ScaleSegmentModal(props: ScaleSegmentModalProps): React.JSX.Element {
  const [value, setValue] = useState('');

  const lengthPx = Math.round(Math.hypot(props.b.x - props.a.x, props.b.y - props.a.y));
  const parsed = Number(value.replace(',', '.'));
  const valid = value.trim() !== '' && Number.isFinite(parsed) && parsed > 0;

  return (
    <div className="modal-backdrop" {...backdropClose(props.onClose)}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h3>Длина отрезка</h3>
          <button type="button" className="link" onClick={props.onClose}>закрыть ✕</button>
        </div>

        <p className="muted small">
          Отмерено {lengthPx} точек плана. Сколько это метров на самом деле?
        </p>

        <label className="field">
          <span>Длина в метрах</span>
          {/*
            * Поле не блокируется занятостью намеренно.
            *
            * Заблокированное поле нельзя ни выбрать щелчком, ни заполнить, и
            * от сломанной программы это неотличимо. Занятость останавливает
            * кнопку, которая начинает работу, — набирать число можно всегда.
            */}
          <input
            autoFocus
            inputMode="decimal"
            value={value}
            placeholder="12,5"
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              // Ввод завершается клавишей: число короткое, и тянуться мышью к
              // кнопке ради двух цифр незачем.
              if (event.key === 'Enter' && valid) props.onConfirm(parsed);
            }}
          />
        </label>

        {valid && (
          <p className="muted small">
            Масштаб получится: в одной точке плана {((parsed / lengthPx) * 100).toFixed(1)} см.
            По нему и строятся круги радиусом нормы.
          </p>
        )}

        <div className="actions">
          <button
            type="button"
            className="primary"
            disabled={props.busy || !valid}
            onClick={() => props.onConfirm(parsed)}
          >
            Задать масштаб
          </button>
        </div>
      </div>
    </div>
  );
}
