/**
 * Растровое распознавание плана: отрисовка страницы и поиск стен по изображению.
 *
 * Здесь только перевод координат и склейка готовых частей. Сам поиск стен — в
 * ядре PlanVector, отрисовка страницы — в движке подложек. Этот файл нужен
 * потому, что ядру нельзя иметь зависимости, а холст есть только в окне.
 *
 * Про координаты. В документе ось Y направлена вверх, в изображении — вниз, и
 * это главный источник ошибок при переводе. Перевод собран в двух функциях
 * ниже, чтобы он был в одном месте и его можно было проверить.
 */

import {
  createEmptyPlanModel,
  eraseRects,
  findWalls,
  inkMaskFromRgba,
  withHistory,
  type MaskRect,
  type PageContent,
  type PlanElement,
  type PlanModel,
  type RasterWall,
  type WallSearchOptions,
} from '@izh/planvector-engine';
import { planSourceEngine } from '@izh/engine-plan-source';

/** Разрешение отрисовки. Больше не нужно: стена шириной 200 мм при 150 точках
 *  на дюйм и масштабе 1:100 занимает около 12 точек — этого достаточно. */
export const RECOGNIZE_DPI = 150;

/** Запас вокруг надписи, доли её высоты: разлиновка таблиц идёт вплотную. */
const TEXT_PADDING_SHARE = 0.8;

export interface RasterRecognizeResult {
  readonly model: PlanModel;
  readonly imageWidthPx: number;
  readonly imageHeightPx: number;
  readonly stats: {
    readonly erasedTextRects: number;
    readonly wallsHorizontal: number;
    readonly wallsVertical: number;
  };
}

/** Точка страницы → точка изображения. */
function toImageRect(
  x: number,
  y: number,
  width: number,
  height: number,
  pageHeightPt: number,
  scale: number,
): MaskRect {
  return {
    x: x * scale,
    // Верх надписи в документе — это меньшая координата в изображении.
    y: (pageHeightPt - (y + height)) * scale,
    widthPx: width * scale,
    heightPx: height * scale,
  };
}

/** Стена в точках изображения → отрезок в координатах страницы. */
function toPageSegment(
  wall: RasterWall,
  pageHeightPt: number,
  scale: number,
): { a: { x: number; y: number }; b: { x: number; y: number }; thickness: number } {
  return {
    a: { x: wall.x1 / scale, y: pageHeightPt - wall.y1 / scale },
    b: { x: wall.x2 / scale, y: pageHeightPt - wall.y2 / scale },
    thickness: wall.thickness / scale,
  };
}

/**
 * Распознаёт план по изображению страницы.
 *
 * Текстовый слой документа используется только для того, чтобы стереть надписи
 * с изображения: их координаты уже известны, поэтому распознавать текст не
 * требуется. Это снимает разом легенду, штамп, таблицы и подписи.
 */
export async function recognizeByRaster(
  pdfBytes: Uint8Array,
  page: PageContent,
  makeId: () => string,
  fileName: string,
  options?: Partial<WallSearchOptions>,
): Promise<RasterRecognizeResult | { error: string }> {
  const rendered = await planSourceEngine.rasterizePdfPage(pdfBytes, {
    pageNumber: page.pageNumber,
    dpi: RECOGNIZE_DPI,
    extraRotationDeg: 0,
  });
  if (!rendered.ok) return { error: rendered.error.message };

  const decoded = await planSourceEngine.decodeImage(rendered.value.imageBytes);
  if (!decoded.ok) return { error: decoded.error.message };

  const scale = RECOGNIZE_DPI / 72;
  const image = decoded.value;

  const textRects: MaskRect[] = page.texts.map((item) => {
    const padding = Math.max(1.5, item.height * TEXT_PADDING_SHARE);
    return toImageRect(
      item.x - padding,
      item.y - padding,
      item.width + padding * 2,
      item.height + padding * 2,
      page.heightPt,
      scale,
    );
  });

  const mask = eraseRects(
    inkMaskFromRgba(image.data, image.widthPx, image.heightPx),
    textRects,
  );

  // Пороги задаются в точках изображения, поэтому пересчитываются под
  // разрешение: иначе смена разрешения молча меняла бы результат.
  const walls = findWalls(mask, {
    minLengthPx: options?.minLengthPx ?? Math.round(0.55 * RECOGNIZE_DPI),
    maxThicknessPx: options?.maxThicknessPx ?? Math.round(0.3 * RECOGNIZE_DPI),
    maxGapPx: options?.maxGapPx ?? Math.round(0.03 * RECOGNIZE_DPI),
    minOverlapShare: options?.minOverlapShare ?? 0.6,
  });

  const base = createEmptyPlanModel({
    id: makeId(),
    createdAt: new Date().toISOString(),
    source: {
      fileName,
      contentHash: '',
      kind: 'pdf',
      pageNumber: page.pageNumber,
      area: { x: 0, y: 0, width: page.widthPt, height: page.heightPt },
    },
    profile: 'EVACUATION_PLAN',
  });

  const elements: PlanElement[] = walls.map((wall) => {
    const segment = toPageSegment(wall, page.heightPt, scale);
    return {
      id: makeId(),
      kind: 'WALL_INT',
      // Растровый поиск надёжен по построению: полоса либо длинная и сплошная,
      // либо не попала в результат. Отдельная проверка человеком всё равно нужна.
      confidence: 0.7,
      provenance: 'recognized',
      attributes: { horizontal: wall.horizontal },
      geometry: 'segment',
      segment: { a: segment.a, b: segment.b },
      thickness: segment.thickness,
    };
  });

  const floor = base.building.floors[0];
  if (floor === undefined) return { error: 'в новой модели нет этажа' };

  const horizontal = walls.filter((wall) => wall.horizontal).length;

  const model = withHistory(
    { ...base, building: { ...base.building, floors: [{ ...floor, elements }] } },
    {
      at: base.createdAt,
      stage: 'растровое распознавание',
      summary: `стен ${walls.length}: горизонтальных ${horizontal}, вертикальных ${walls.length - horizontal}; стёрто надписей ${textRects.length}`,
    },
  );

  return {
    model,
    imageWidthPx: image.widthPx,
    imageHeightPx: image.heightPx,
    stats: {
      erasedTextRects: textRects.length,
      wallsHorizontal: horizontal,
      wallsVertical: walls.length - horizontal,
    },
  };
}
