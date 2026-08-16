/**
 * Арифметика подложки: размер растра и перевод пикселей в метры.
 *
 * Здесь нет ни PDF, ни холста, ни файлов — только числа. Поэтому весь файл
 * покрывается обычными тестами и является спецификацией поведения движка.
 */

import type {
  DrawingScaleInput,
  PdfPageInfo,
  QuarterTurn,
  RasterSizeEstimate,
  Result,
  TwoPointsInput,
} from '@izh/contracts';
import { err, ok } from '@izh/contracts';

/** В одном дюйме 25,4 мм. */
const METERS_PER_INCH = 0.0254;

/** В одном дюйме 72 пункта PDF. */
const POINTS_PER_INCH = 72;

/**
 * Пределы размера подложки.
 *
 * Ограничение по стороне идёт от графической подсистемы: холст больше 16384
 * пикселей по стороне не отображается на большинстве видеокарт. Ограничение по
 * площади — практическое: 60 мегапикселей это примерно 240 МБ в памяти.
 */
export const MAX_BACKDROP_SIDE_PX = 16384;
export const MAX_BACKDROP_MEGAPIXELS = 60;

/** Разрешения подложки, предлагаемые пользователю. */
export const DPI_PRESETS = [96, 150, 200, 300] as const;

/**
 * Считает размер будущей подложки, не строя её.
 *
 * Размеры страницы в PdfPageInfo уже учитывают собственный поворот страницы,
 * заданный внутри PDF. Здесь добавляется только поворот, выбранный
 * пользователем.
 */
export function estimateRasterSize(
  page: PdfPageInfo,
  dpi: number,
  extraRotationDeg: QuarterTurn,
): RasterSizeEstimate {
  const scale = dpi / POINTS_PER_INCH;
  const swapSides = extraRotationDeg === 90 || extraRotationDeg === 270;

  const widthPx = Math.ceil((swapSides ? page.heightPt : page.widthPt) * scale);
  const heightPx = Math.ceil((swapSides ? page.widthPt : page.heightPt) * scale);

  const megapixels = (widthPx * heightPx) / 1_000_000;
  const tooLarge =
    widthPx > MAX_BACKDROP_SIDE_PX ||
    heightPx > MAX_BACKDROP_SIDE_PX ||
    megapixels > MAX_BACKDROP_MEGAPIXELS;

  return { widthPx, heightPx, megapixels, tooLarge };
}

/**
 * Метры на пиксель по двум точкам.
 *
 * Пользователь указывает на подложке отрезок с известной длиной — размерную
 * линию, габарит здания, шаг колонн — и вводит эту длину в метрах.
 */
export function metersPerPixelFromTwoPoints(input: TwoPointsInput): Result<number> {
  if (!Number.isFinite(input.realDistanceM) || input.realDistanceM <= 0) {
    return err('INVALID_ARGUMENT', 'Расстояние в метрах должно быть больше нуля.');
  }

  const dx = input.b.x - input.a.x;
  const dy = input.b.y - input.a.y;
  const distancePx = Math.hypot(dx, dy);

  if (distancePx < 1) {
    return err(
      'INVALID_ARGUMENT',
      'Точки калибровки стоят слишком близко друг к другу. Укажите отрезок подлиннее — так масштаб получится точнее.',
    );
  }

  return ok(input.realDistanceM / distancePx);
}

/**
 * Метры на пиксель по масштабу чертежа.
 *
 * Работает, если PDF выведен на печать в масштабе, то есть размер страницы
 * равен размеру бумажного листа. Тогда один пиксель подложки — это 1/dpi дюйма
 * бумаги, а на местности во столько раз больше, каков знаменатель масштаба.
 * Для чертежа 1:100 знаменатель равен 100.
 */
export function metersPerPixelFromDrawingScale(
  input: DrawingScaleInput,
  dpi: number,
): Result<number> {
  if (!Number.isFinite(input.scaleDenominator) || input.scaleDenominator <= 0) {
    return err('INVALID_ARGUMENT', 'Знаменатель масштаба должен быть больше нуля. Для масштаба 1:100 введите 100.');
  }
  if (!Number.isFinite(dpi) || dpi <= 0) {
    return err('INVALID_ARGUMENT', 'Разрешение подложки должно быть больше нуля.');
  }

  return ok((METERS_PER_INCH / dpi) * input.scaleDenominator);
}

/** Обратная величина: сколько пикселей приходится на один метр. Нужна интерфейсу
 *  для рисования масштабной линейки. */
export function pixelsPerMeter(metersPerPixel: number): number {
  return 1 / metersPerPixel;
}
