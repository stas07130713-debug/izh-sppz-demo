/**
 * Задание масштаба подложки.
 *
 * Основной способ — по габаритам здания: они известны всегда, а два независимых
 * измерения заодно проверяют сам чертёж. Два других способа оставлены на случаи,
 * когда габариты неизвестны.
 *
 * Масштаб задаётся после очистки: очистка может обрезать подложку, и указанные
 * до неё точки уехали бы.
 */

import { useState } from 'react';
import type { PixelPoint, PixelRect, PlanBackdrop, PlanCalibration } from '@izh/contracts';
import { EXTENTS_DISCREPANCY_WARNING_PERCENT } from '@izh/engine-plan-source';
import { formatScale } from '../format';

export interface CalibrationPanelProps {
  readonly backdrop: PlanBackdrop;
  readonly calibration: PlanCalibration | null;
  readonly extentsRect: PixelRect | null;
  readonly points: readonly PixelPoint[];
  readonly drawingExtents: boolean;
  readonly pickingPoints: boolean;
  readonly onDrawExtents: () => void;
  readonly onPickPoints: () => void;
  readonly onApplyExtents: (horizontalMeters: number, verticalMeters: number) => void;
  readonly onApplyTwoPoints: (realDistanceM: number) => void;
  readonly onApplyDrawingScale: (scaleDenominator: number) => void;
}

function parseMeters(text: string): number {
  return Number(text.replace(',', '.'));
}

export function CalibrationPanel(props: CalibrationPanelProps): React.JSX.Element {
  const [horizontalText, setHorizontalText] = useState('');
  const [verticalText, setVerticalText] = useState('');
  const [distanceText, setDistanceText] = useState('');
  const [scaleText, setScaleText] = useState('100');

  const horizontal = parseMeters(horizontalText);
  const vertical = parseMeters(verticalText);
  const extentsValid =
    props.extentsRect !== null &&
    Number.isFinite(horizontal) &&
    horizontal > 0 &&
    Number.isFinite(vertical) &&
    vertical > 0;

  const distance = parseMeters(distanceText);
  const distanceValid = Number.isFinite(distance) && distance > 0;
  const scaleDenominator = parseMeters(scaleText);
  const scaleValid = Number.isFinite(scaleDenominator) && scaleDenominator > 0;

  const discrepancy = props.calibration?.discrepancyPercent ?? null;

  return (
    <div className="panel">
      <h3>Масштаб подложки</h3>

      {props.calibration === null ? (
        <p className="warn">Масштаб не задан. Без него не считаются ни площади, ни расстояния.</p>
      ) : (
        <>
          <p className="ok">{formatScale(props.calibration.metersPerPixel, props.backdrop.dpi)}</p>
          <p className="muted small">
            способ:{' '}
            {props.calibration.method === 'building-extents'
              ? 'по габаритам здания'
              : props.calibration.method === 'two-points'
                ? 'по двум точкам'
                : 'по масштабу чертежа'}
          </p>
          {discrepancy !== null && discrepancy > EXTENTS_DISCREPANCY_WARNING_PERCENT && (
            <p className="warn small">
              Масштаб по горизонтали и по вертикали расходится на {discrepancy.toFixed(1)} %.
              Проверьте введённые размеры: либо чертёж непропорционально растянут, либо габариты указаны неверно.
              Принято среднее значение.
            </p>
          )}
        </>
      )}

      <section>
        <h4>Способ 1. По габаритам здания</h4>
        <p className="muted small">
          Обведите здание прямоугольником и укажите два его размера. Это основной способ: габариты
          известны всегда, а два измерения сразу проверяют друг друга.
        </p>

        <button type="button" className={props.drawingExtents ? 'primary' : ''} onClick={props.onDrawExtents}>
          {props.drawingExtents ? 'Обведите здание на плане' : 'Обвести здание'}
        </button>

        {props.extentsRect !== null && (
          <p className="muted small">
            Габарит: {Math.round(props.extentsRect.widthPx)} × {Math.round(props.extentsRect.heightPx)} точек
          </p>
        )}

        <div className="field-row">
          <label className="field">
            <span>По горизонтали, м</span>
            <input
              type="text"
              inputMode="decimal"
              value={horizontalText}
              placeholder="например 60"
              onChange={(e) => setHorizontalText(e.target.value)}
            />
          </label>
          <label className="field">
            <span>По вертикали, м</span>
            <input
              type="text"
              inputMode="decimal"
              value={verticalText}
              placeholder="например 30"
              onChange={(e) => setVerticalText(e.target.value)}
            />
          </label>
        </div>

        <button
          type="button"
          className="primary"
          disabled={!extentsValid}
          onClick={() => props.onApplyExtents(horizontal, vertical)}
        >
          Применить масштаб
        </button>
      </section>

      <section>
        <h4>Способ 2. По двум точкам</h4>
        <p className="muted small">
          Если габариты здания неизвестны: укажите любой отрезок с известной длиной — размерную линию,
          шаг колонн. Чем длиннее, тем точнее.
        </p>
        <button type="button" className={props.pickingPoints ? 'primary' : ''} onClick={props.onPickPoints}>
          {props.pickingPoints ? `Поставлено точек: ${props.points.length} из 2` : 'Указать две точки'}
        </button>
        {props.pickingPoints && (
          <>
            <label className="field">
              <span>Расстояние между точками, м</span>
              <input
                type="text"
                inputMode="decimal"
                value={distanceText}
                placeholder="например 12,5"
                onChange={(e) => setDistanceText(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="primary"
              disabled={props.points.length !== 2 || !distanceValid}
              onClick={() => props.onApplyTwoPoints(distance)}
            >
              Применить масштаб
            </button>
          </>
        )}
      </section>

      <section>
        <h4>Способ 3. По масштабу чертежа</h4>
        {props.backdrop.dpi === null ? (
          <p className="muted small">
            Недоступен: подложка сделана из картинки, а в ней нет сведений о размере бумажного листа.
          </p>
        ) : (
          <>
            <p className="muted small">
              Подходит, если чертёж выведен в масштабе и размер страницы совпадает с размером листа.
              Не работает, если подложка была обрезана в другом разрешении.
            </p>
            <label className="field">
              <span>Знаменатель масштаба (для 1:100 введите 100)</span>
              <input
                type="text"
                inputMode="numeric"
                value={scaleText}
                onChange={(e) => setScaleText(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={!scaleValid}
              onClick={() => props.onApplyDrawingScale(scaleDenominator)}
            >
              Применить 1:{scaleValid ? Math.round(scaleDenominator) : '—'}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
