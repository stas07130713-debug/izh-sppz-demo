/**
 * Окна проверки расстановки огнетушителей: масштаб, разбор, отрезок.
 *
 * Вынесено из главного экрана одной группой: все три отвечают на один вопрос —
 * хватает ли огнетушителей и стоят ли они там, где нужно, — и открываются одно
 * из другого. Без масштаба разбор не построить, поэтому окно масштаба открывается
 * прямо из разбора, а способ «по двум точкам» отправляет на план за отрезком.
 *
 * Состояние всех трёх окон живёт в `usePlacementCheck` и приходит сюда целиком:
 * оно нужно и плану — он рисует круги нормы и принимает отрезок, — поэтому
 * держится выше. Сюда же уходят решения, которые касаются только этих окон:
 * что окно закрывается прежде, чем отправить человека туда, куда он нажал.
 */

import type { JournalExportFormat, PixelPoint, PlanBackdrop, PlanCalibration, PlanObject } from '@izh/contracts';
import { useEffect, useState } from 'react';
import { PlanScaleModal } from './PlanScaleModal';
import { ExtinguisherCheckModal } from './ExtinguisherCheckModal';
import { ScaleSegmentModal } from './ScaleSegmentModal';
import type { PlacementCheck } from '../use-placement-check';
import type { PlacementFix } from '@izh/core';

export interface PlacementScreensProps {
  readonly check: PlacementCheck;
  readonly busy: boolean;
  readonly backdrop: PlanBackdrop | null;
  readonly calibration: PlanCalibration | null;

  /** Масштаб по отрезку, отмеренному на плане. */
  readonly onCalibrate: (backdropId: string, a: PixelPoint, b: PixelPoint, realDistanceM: number) => void;
  readonly onExport: (format: JournalExportFormat) => void;

  /**
   * Устранение замечания за пределами этих окон: обводка помещения, карточка
   * здания, сведения помещения. Масштаб сюда не попадает — он свой и решается
   * здесь же.
   */
  readonly onFix: (fix: PlacementFix, roomId: string) => void;
  readonly onShowObject: (object: PlanObject) => void;
  /** Переход на план: за отрезком для масштаба. */
  readonly onGoToPlan: () => void;
}

export function PlacementScreens(props: PlacementScreensProps): React.JSX.Element {
  const { check } = props;
  const measured = check.measured;
  const backdrop = props.backdrop;
  /*
   * Длина, названная до отмеривания.
   *
   * Заказчик просит вводить её из техпаспорта первой, а потом ставить точки.
   * Тогда после второй точки спрашивать нечего — масштаб считается сразу.
   */
  const [knownMetres, setKnownMetres] = useState<number | null>(null);

  /*
   * Длина названа заранее — спрашивать нечего.
   *
   * Как только отрезок отмечен, масштаб считается сразу: человек уже сказал,
   * сколько в нём метров, и второй раз спрашивать об одном и том же незачем.
   */
  useEffect(() => {
    if (measured === null || backdrop === null || knownMetres === null) return;
    check.setMeasured(null);
    setKnownMetres(null);
    props.onCalibrate(backdrop.id, measured[0], measured[1], knownMetres);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measured, backdrop, knownMetres]);

  return (
    <>
      {check.scaleOpen && (
        <PlanScaleModal
          planWidthPx={props.backdrop?.widthPx ?? null}
          metersPerPixel={props.calibration?.metersPerPixel ?? null}
          busy={props.busy}
          onClose={() => check.setScaleOpen(false)}
          onMeasureOnPlan={(knownMetres) => {
            check.setScaleOpen(false);
            setKnownMetres(knownMetres);
            props.onGoToPlan();
            check.setMeasuring(true);
          }}
        />
      )}

      {check.checkOpen && check.report !== null && (
        <ExtinguisherCheckModal
          report={check.report}
          busy={props.busy}
          onExport={props.onExport}
          onFix={(fix, roomId) => {
            /*
             * Окно закрывается всегда: всё, к чему оно отправляет, находится
             * под ним, и держать его поверх значило бы прятать то, ради чего
             * человек и нажал.
             */
            check.setCheckOpen(false);
            if (fix === 'масштаб') { check.setScaleOpen(true); return; }
            props.onFix(fix, roomId);
          }}
          onShowObject={(object) => {
            /*
             * Окно закрывается: карточка, ради которой нажали ссылку,
             * находится под ним, и держать разбор поверх значило бы прятать
             * то, к чему он отправил.
             */
            check.setCheckOpen(false);
            props.onShowObject(object);
          }}
          onClose={() => check.setCheckOpen(false)}
        />
      )}

      {measured !== null && backdrop !== null && knownMetres === null && (
        <ScaleSegmentModal
          a={measured[0]}
          b={measured[1]}
          busy={props.busy}
          onClose={() => check.setMeasured(null)}
          onConfirm={(realDistanceM) => {
            const segment = measured;
            check.setMeasured(null);
            setKnownMetres(null);
            props.onCalibrate(backdrop.id, segment[0], segment[1], realDistanceM);
          }}
        />
      )}
    </>
  );
}
