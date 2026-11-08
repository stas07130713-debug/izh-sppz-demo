/**
 * Проверка расстановки огнетушителей: круги нормы, разбор и масштаб.
 *
 * Вынесено из главного экрана отдельно, потому что это законченный кусок работы
 * со своим предметом и своим состоянием. Главный экран занят связыванием
 * частей; правила «когда считать отчёт», «когда показывать круги» и «что делать,
 * если масштаба нет» к связыванию отношения не имеют.
 *
 * Здесь собрано всё, что относится к одному вопросу — хватает ли огнетушителей
 * и стоят ли они там, где нужно:
 *
 *   круги на плане + разбор соответствия + масштаб, без которого нет ни того,
 *   ни другого.
 *
 * Отчёт считается **только по запросу** и только для этажа: расчёт обходит все
 * помещения и все огнетушители, и делать его при каждой перерисовке плана
 * незачем — его никто не просил.
 */

import { useEffect, useMemo, useState } from 'react';
import type { PixelPoint, PlanBackdrop, PlanCalibration, PlanObject, Room, TreeNode } from '@izh/contracts';
import type { BuildingProfile } from '@izh/contracts';
import {
  FIRE_CLASSES, checkExtinguisherPlacement, purposeOfFunctionalClasses, type FireClass,
} from '@izh/core';
import { coverageLayer } from './components/plan-coverage';

/**
 * Классы возможного пожара из характеристики здания.
 *
 * Многозначные поля профиля хранятся строкой через запятую, а расчёту нужен
 * перечень. Кириллические двойники приводятся к латинским: в справках «А, В, Е»
 * набрано русскими буквами, и на глаз их не отличить.
 */
function parseFireClasses(raw: string | null): readonly FireClass[] {
  const latin: Readonly<Record<string, string>> = { А: 'A', В: 'B', С: 'C', Е: 'E', Д: 'D' };
  return (raw ?? '')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .map((value) => latin[value] ?? value)
    .filter((value): value is FireClass => FIRE_CLASSES.includes(value as FireClass));
}

export interface PlacementCheckInput {
  readonly selected: TreeNode | null;
  readonly rooms: readonly Room[];
  readonly objects: readonly PlanObject[];
  readonly calibration: PlanCalibration | null;
  readonly buildingProfile: BuildingProfile | null;
  readonly backdrop: PlanBackdrop | null;
}

export interface PlacementCheck {
  /** Круги нормы включены: на плане остаются одни огнетушители со своими кругами. */
  readonly checkRun: boolean;
  /** Открыт разбор соответствия видов и рангов. */
  readonly checkOpen: boolean;
  readonly setCheckOpen: (open: boolean) => void;
  /** Показывать ли сами круги. Остаются видны и после закрытия разбора. */
  readonly showCircles: boolean;
  readonly setShowCircles: (show: boolean) => void;
  /** Идёт отмер отрезка по двум точкам. */
  readonly measuring: boolean;
  readonly setMeasuring: (measuring: boolean) => void;
  /** Отмеренный отрезок: две точки плана. */
  readonly measured: readonly [PixelPoint, PixelPoint] | null;
  readonly setMeasured: (points: readonly [PixelPoint, PixelPoint] | null) => void;
  /** Открыто окно масштаба. */
  readonly scaleOpen: boolean;
  readonly setScaleOpen: (open: boolean) => void;
  /** Отчёт о расстановке. `null` — не запрашивали или узел не этаж. */
  readonly report: ReturnType<typeof checkExtinguisherPlacement> | null;
  /** Слой кругов для плана. `null` — круги выключены или отчёта нет. */
  readonly coverage: ReturnType<typeof coverageLayer> | null;
  /** Переключить круги. Без масштаба сначала спрашивает его. */
  readonly toggleCoverage: () => void;
}

export function usePlacementCheck(input: PlacementCheckInput): PlacementCheck {
  const [measuring, setMeasuring] = useState(false);
  const [measured, setMeasured] = useState<readonly [PixelPoint, PixelPoint] | null>(null);
  const [checkRun, setCheckRun] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [showCircles, setShowCircles] = useState(true);

  const { selected, rooms, objects, calibration, buildingProfile } = input;
  const selectedId = selected?.id ?? null;

  /*
   * Проверка относится к тому этажу, на котором её нажали.
   *
   * Заказчик: «при переходе на другой этаж или объект там нужно нажимать данную
   * кнопку заново». Круги считаются по помещениям и категориям конкретного
   * этажа, и оставленный включённым переключатель показывал бы на соседнем
   * этаже разбор, которого никто не запрашивал.
   */
  useEffect(() => {
    setCheckRun(false);
    setCheckOpen(false);
    setMeasuring(false);
    setMeasured(null);
    setScaleOpen(false);
  }, [selectedId]);

  /**
   * Отчёт о расстановке: только для этажа и только по запросу.
   *
   * Запрос — любой из двух: круги покрытия на плане или разбор соответствия.
   * Это разные занятия, и одно другого не требует: смотреть, что не подходит по
   * виду и рангу, можно и не включая круги.
   */
  const report = useMemo(
    () => ((checkRun || checkOpen) && selected?.kind === 'level'
      ? checkExtinguisherPlacement({
        rooms,
        objects,
        metersPerPixel: calibration?.metersPerPixel ?? null,
        buildingCategory: buildingProfile?.explosionCategory ?? null,
        // Характеристика объекта: по ней норма считается, пока помещений нет.
        building: buildingProfile === null ? null : {
          category: buildingProfile.explosionCategory,
          purpose: purposeOfFunctionalClasses(buildingProfile.functionalClasses),
          areaM2: buildingProfile.builtAreaM2,
          fireClasses: parseFireClasses(buildingProfile.fireClasses),
          hasSuppression: false,
        },
        buildingPurpose: purposeOfFunctionalClasses(buildingProfile?.functionalClasses ?? null),
        defaultFireClasses: parseFireClasses(buildingProfile?.fireClasses ?? null),
      })
      : null),
    [checkRun, checkOpen, selected, rooms, objects, calibration, buildingProfile],
  );

  const coverage = useMemo(
    () => (report !== null && showCircles
      ? coverageLayer(report, rooms, objects, calibration?.metersPerPixel ?? null)
      : null),
    [report, showCircles, rooms, objects, calibration],
  );

  /**
   * Включить круги покрытия.
   *
   * Без масштаба круги строить не из чего, поэтому сначала спрашивается он.
   * Отказать «задайте масштаб», не показав где, значило бы завести человека
   * в тупик.
   */
  const toggleCoverage = (): void => {
    if (checkRun) { setCheckRun(false); return; }
    if (calibration === null) { setScaleOpen(true); return; }
    setCheckRun(true);
    setShowCircles(true);
  };

  return {
    checkRun,
    checkOpen,
    setCheckOpen,
    showCircles,
    setShowCircles,
    measuring,
    setMeasuring,
    measured,
    setMeasured,
    scaleOpen,
    setScaleOpen,
    report,
    coverage,
    toggleCoverage,
  };
}
