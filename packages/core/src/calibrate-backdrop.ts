/**
 * Сценарий: задать масштаб подложки.
 *
 * Без масштаба подложка бесполезна: нельзя ни посчитать площадь помещения, ни
 * проверить расстояние между оборудованием. Поэтому масштаб задаётся сразу
 * после создания подложки, одним из двух способов.
 */

import type { BuildingExtentsInput, PlanCalibration, Result, TwoPointsInput } from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { BackdropDeps } from './backdrop-deps.js';

export interface CalibrateByBuildingExtentsInput {
  readonly backdropId: string;
  readonly extents: BuildingExtentsInput;
}

/**
 * Основной способ: по габаритам здания.
 *
 * Пользователь обводит здание прямоугольником и вводит два известных размера —
 * по горизонтали и по вертикали. Габариты здания известны всегда, а два
 * независимых измерения заодно проверяют сам чертёж: расхождение между
 * направлениями означает либо ошибку ввода, либо непропорционально растянутое
 * изображение. Расхождение сохраняется и показывается пользователю.
 */
export async function calibrateByBuildingExtents(
  deps: BackdropDeps,
  input: CalibrateByBuildingExtentsInput,
): Promise<Result<PlanCalibration>> {
  const backdrop = await deps.backdrops.getById(input.backdropId);
  if (!backdrop.ok) return backdrop;

  const measurement = deps.engine.measureByBuildingExtents(input.extents);
  if (!measurement.ok) return measurement;

  const calibration: PlanCalibration = {
    backdropId: input.backdropId,
    method: 'building-extents',
    metersPerPixel: measurement.value.metersPerPixel,
    twoPoints: null,
    drawingScale: null,
    buildingExtents: input.extents,
    discrepancyPercent: measurement.value.discrepancyPercent,
    createdAt: deps.clock.nowUtc(),
  };

  const saved = await deps.backdrops.saveCalibration(calibration);
  if (!saved.ok) return saved;

  return ok(calibration);
}

export interface CalibrateByTwoPointsInput {
  readonly backdropId: string;
  readonly twoPoints: TwoPointsInput;
}

/** Способ первый: указать на подложке отрезок с известной длиной. Работает всегда. */
export async function calibrateByTwoPoints(
  deps: BackdropDeps,
  input: CalibrateByTwoPointsInput,
): Promise<Result<PlanCalibration>> {
  const backdrop = await deps.backdrops.getById(input.backdropId);
  if (!backdrop.ok) return backdrop;

  const metersPerPixel = deps.engine.metersPerPixelFromTwoPoints(input.twoPoints);
  if (!metersPerPixel.ok) return metersPerPixel;

  const calibration: PlanCalibration = {
    backdropId: input.backdropId,
    method: 'two-points',
    metersPerPixel: metersPerPixel.value,
    twoPoints: input.twoPoints,
    drawingScale: null,
    buildingExtents: null,
    discrepancyPercent: null,
    createdAt: deps.clock.nowUtc(),
  };

  const saved = await deps.backdrops.saveCalibration(calibration);
  if (!saved.ok) return saved;

  return ok(calibration);
}

export interface CalibrateByDrawingScaleInput {
  readonly backdropId: string;
  /** Для чертежа 1:100 знаменатель равен 100. */
  readonly scaleDenominator: number;
}

/**
 * Способ второй: указать масштаб чертежа.
 *
 * Работает только для подложки из PDF, выведенного на печать в масштабе: там
 * размер страницы соответствует размеру бумажного листа, и по разрешению
 * подложки можно вычислить всё остальное. Для загруженной картинки размер листа
 * неизвестен, поэтому способ недоступен.
 */
export async function calibrateByDrawingScale(
  deps: BackdropDeps,
  input: CalibrateByDrawingScaleInput,
): Promise<Result<PlanCalibration>> {
  const backdrop = await deps.backdrops.getById(input.backdropId);
  if (!backdrop.ok) return backdrop;

  if (backdrop.value.dpi === null) {
    return err(
      'INVALID_ARGUMENT',
      'Для этой подложки неизвестен размер бумажного листа, поэтому масштаб чертежа применить нельзя. Задайте масштаб по двум точкам.',
    );
  }

  const metersPerPixel = deps.engine.metersPerPixelFromDrawingScale(
    { scaleDenominator: input.scaleDenominator },
    backdrop.value.dpi,
  );
  if (!metersPerPixel.ok) return metersPerPixel;

  const calibration: PlanCalibration = {
    backdropId: input.backdropId,
    method: 'drawing-scale',
    metersPerPixel: metersPerPixel.value,
    twoPoints: null,
    drawingScale: { scaleDenominator: input.scaleDenominator },
    buildingExtents: null,
    discrepancyPercent: null,
    createdAt: deps.clock.nowUtc(),
  };

  const saved = await deps.backdrops.saveCalibration(calibration);
  if (!saved.ok) return saved;

  return ok(calibration);
}
