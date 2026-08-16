/**
 * Задание масштаба подложки.
 *
 * Без масштаба подложка — просто картинка: нельзя ни посчитать площадь
 * помещения, ни проверить расстояние до оборудования. Поэтому панель всегда на
 * виду и прямо говорит, задан масштаб или нет.
 */

import { useState } from 'react';
import type { PixelPoint, PlanBackdrop, PlanCalibration } from '@izh/contracts';
import { formatScale } from '../format';

export interface CalibrationPanelProps {
  readonly backdrop: PlanBackdrop;
  readonly calibration: PlanCalibration | null;
  readonly points: readonly PixelPoint[];
  readonly picking: boolean;
  readonly onStartPicking: () => void;
  readonly onResetPoints: () => void;
  readonly onApplyTwoPoints: (realDistanceM: number) => void;
  readonly onApplyDrawingScale: (scaleDenominator: number) => void;
}

export function CalibrationPanel(props: CalibrationPanelProps): React.JSX.Element {
  const [distanceText, setDistanceText] = useState('');
  const [scaleText, setScaleText] = useState('100');

  const bothPointsSet = props.points.length === 2;
  const distance = Number(distanceText.replace(',', '.'));
  const distanceValid = Number.isFinite(distance) && distance > 0;

  const scaleDenominator = Number(scaleText.replace(',', '.'));
  const scaleValid = Number.isFinite(scaleDenominator) && scaleDenominator > 0;

  return (
    <div className="panel">
      <h3>Масштаб подложки</h3>

      {props.calibration === null ? (
        <p className="warn">Масштаб не задан. Задайте его одним из двух способов.</p>
      ) : (
        <p className="ok">
          Задан: {formatScale(props.calibration.metersPerPixel, props.backdrop.dpi)}
          <br />
          <span className="muted small">
            способ: {props.calibration.method === 'two-points' ? 'по двум точкам' : 'по масштабу чертежа'}
          </span>
        </p>
      )}

      <section>
        <h4>Способ 1. По двум точкам</h4>
        <p className="muted small">
          Укажите на плане отрезок, длину которого вы знаете: размерную линию, габарит здания, шаг колонн.
          Чем длиннее отрезок, тем точнее масштаб.
        </p>

        {!props.picking && (
          <button type="button" onClick={props.onStartPicking}>
            Указать две точки
          </button>
        )}

        {props.picking && (
          <>
            <p className="hint">Поставлено точек: {props.points.length} из 2</p>
            <label className="field">
              <span>Расстояние между точками, метров</span>
              <input
                type="text"
                inputMode="decimal"
                value={distanceText}
                placeholder="например 12,5"
                onChange={(e) => setDistanceText(e.target.value)}
              />
            </label>
            <div className="actions">
              <button type="button" className="secondary" onClick={props.onResetPoints}>
                Сбросить точки
              </button>
              <button
                type="button"
                className="primary"
                disabled={!bothPointsSet || !distanceValid}
                onClick={() => props.onApplyTwoPoints(distance)}
              >
                Применить
              </button>
            </div>
          </>
        )}
      </section>

      <section>
        <h4>Способ 2. По масштабу чертежа</h4>
        {props.backdrop.dpi === null ? (
          <p className="muted small">
            Недоступен: подложка сделана из картинки, а в ней нет сведений о размере бумажного листа.
          </p>
        ) : (
          <>
            <p className="muted small">
              Подходит, если чертёж выведен в масштабе и размер страницы совпадает с размером листа.
              Для чертежа 1:100 введите 100.
            </p>
            <label className="field">
              <span>Знаменатель масштаба</span>
              <input
                type="text"
                inputMode="numeric"
                value={scaleText}
                onChange={(e) => setScaleText(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="primary"
              disabled={!scaleValid}
              onClick={() => props.onApplyDrawingScale(scaleDenominator)}
            >
              Применить масштаб 1:{scaleValid ? Math.round(scaleDenominator) : '—'}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
