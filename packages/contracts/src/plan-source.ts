/**
 * Движок E1 «Подложки планов»: превращение PDF или картинки в подложку,
 * на которую потом наносится противопожарное оборудование.
 *
 * Подложка — это растровое изображение фиксированного размера плюс сведения о
 * том, сколько метров содержится в одном её пикселе. Второе называется
 * калибровкой и без него нельзя ни считать площади помещений, ни проверять
 * расстояния между оборудованием.
 */

import type {
  BackdropId,
  ContentHash,
  IsoDateTime,
  PixelPoint,
  PixelRect,
  QuarterTurn,
} from './basic-types.js';
import type { CleanupOperation, PaletteEntry, RgbaImage } from './image.js';
import type { Result } from './result.js';

/** Что за файл загрузил пользователь. */
export type PlanSourceKind = 'pdf' | 'image' | 'svg' | 'json' | 'dxf';

/**
 * Сведения об одной странице PDF: только размеры и поворот.
 *
 * Читаются быстро для всех страниц сразу. Всё, что требует разбора содержимого
 * страницы, вынесено в PdfPageContentInfo и запрашивается отдельно — иначе
 * открытие многостраничного документа занимало бы минуты.
 */
export interface PdfPageInfo {
  /** Номер страницы, начиная с 1. */
  readonly pageNumber: number;
  /** Ширина страницы в пунктах PDF. Один пункт равен 1/72 дюйма.
   *  Собственный поворот страницы здесь уже учтён. */
  readonly widthPt: number;
  readonly heightPt: number;
  /** Собственный поворот страницы, заданный внутри самого PDF. Справочно. */
  readonly rotationDeg: QuarterTurn;
}

export interface PdfDocumentInfo {
  readonly pageCount: number;
  readonly pages: readonly PdfPageInfo[];
}

/**
 * Из чего состоит страница.
 *
 * Нужно, чтобы отличить настоящий чертёж от скана. У чертежа, выведенного из
 * САПР, сотни векторных линий и много текстовых подписей. У скана одна большая
 * картинка и почти ничего больше.
 *
 * Сейчас показывается пользователю справочно. В дальнейшем именно по этим
 * признакам решается, можно ли извлечь из чертежа стены и подписи помещений
 * автоматически, или остаётся только ручная разметка.
 */
export interface PdfPageContentInfo {
  readonly pageNumber: number;
  readonly textItemCount: number;
  readonly vectorPathCount: number;
  readonly imageCount: number;
  /** Итоговый вывод: похоже на векторный чертёж. */
  readonly likelyVector: boolean;
  /** Итоговый вывод: похоже на скан или фотографию. */
  readonly likelyScan: boolean;
}

/** Запрос на растеризацию страницы PDF в изображение подложки. */
export interface RasterizeRequest {
  readonly pageNumber: number;
  /** Разрешение подложки, точек на дюйм. Чем больше, тем крупнее файл. */
  readonly dpi: number;
  /** Дополнительный поворот, который задаёт пользователь поверх собственного
   *  поворота страницы. */
  readonly extraRotationDeg: QuarterTurn;
}

/** Оценка размера будущей подложки — показывается до растеризации,
 *  чтобы пользователь не запустил вычисление на 30 мегапикселей вслепую. */
export interface RasterSizeEstimate {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly megapixels: number;
  /** Превышен разумный предел: изображение будет тормозить или не поместится
   *  в графическую память. */
  readonly tooLarge: boolean;
}

/** Готовое изображение подложки. */
export interface RasterizedImage {
  readonly widthPx: number;
  readonly heightPx: number;
  /**
   * Разрешение подложки в точках на дюйм.
   *
   * Для подложки, построенной из PDF, известно точно. Для картинки, которую
   * пользователь загрузил напрямую, неизвестно — там нет сведений о размере
   * бумажного листа, поэтому здесь null, а масштаб задаётся только по двум
   * точкам.
   */
  readonly dpi: number | null;
  readonly imageBytes: Uint8Array;
  /** Тип содержимого: image/png или image/jpeg. */
  readonly mimeType: string;
}

/** Сохранённая подложка плана. */
export interface PlanBackdrop {
  readonly id: BackdropId;
  /**
   * Узел дерева, которому принадлежит подложка: здание — для генплана, этаж —
   * для поэтажного плана. null — подложка загружена до появления привязки.
   */
  readonly nodeId: string | null;
  /** Исходный файл в хранилище. */
  readonly sourceHash: ContentHash;
  readonly sourceFileName: string;
  readonly sourceKind: PlanSourceKind;
  /** Для PDF — номер страницы, для картинки всегда 1. */
  readonly pageNumber: number;
  /** Для подложки из картинки неизвестно, см. RasterizedImage.dpi. */
  readonly dpi: number | null;
  readonly rotationDeg: QuarterTurn;
  /** Обрезка полей и штампа. Появится на следующем шаге, сейчас всегда null. */
  readonly crop: PixelRect | null;
  readonly widthPx: number;
  readonly heightPx: number;
  /** Изображение подложки в хранилище. */
  readonly imageHash: ContentHash;
  readonly createdAt: IsoDateTime;
}

/** Способ задания масштаба. */
export type CalibrationMethod = 'two-points' | 'drawing-scale' | 'building-extents';

/**
 * Калибровка по габаритам здания: пользователь обводит здание прямоугольником и
 * вводит два известных размера — по горизонтали и по вертикали.
 *
 * Это основной способ. Габариты здания известны всегда, а два независимых
 * измерения позволяют заодно проверить сам чертёж: если масштаб по горизонтали
 * и по вертикали расходится, значит либо размеры введены неверно, либо
 * изображение непропорционально растянуто.
 */
export interface BuildingExtentsInput {
  /** Габаритный прямоугольник здания на подложке. */
  readonly rect: PixelRect;
  readonly horizontalMeters: number;
  readonly verticalMeters: number;
}

/** Что получилось при измерении по габаритам. */
export interface BuildingExtentsMeasurement {
  /** Принятое значение — среднее по двум направлениям. */
  readonly metersPerPixel: number;
  readonly metersPerPixelHorizontal: number;
  readonly metersPerPixelVertical: number;
  /** Расхождение между направлениями в процентах. Признак ошибки или искажения. */
  readonly discrepancyPercent: number;
}

/** Калибровка по двум точкам: пользователь указывает на плане отрезок с
 *  известной длиной, например размерную линию или габарит здания. */
export interface TwoPointsInput {
  readonly a: PixelPoint;
  readonly b: PixelPoint;
  /** Реальное расстояние между точками в метрах. */
  readonly realDistanceM: number;
}

/** Калибровка по масштабу чертежа: работает, если PDF выведен на печать в
 *  масштабе, то есть размер страницы соответствует размеру листа бумаги.
 *  Для чертежа 1:100 знаменатель равен 100. */
export interface DrawingScaleInput {
  readonly scaleDenominator: number;
}

export interface PlanCalibration {
  readonly backdropId: BackdropId;
  readonly method: CalibrationMethod;
  /** Главный результат: сколько метров в одном пикселе подложки. */
  readonly metersPerPixel: number;
  readonly twoPoints: TwoPointsInput | null;
  readonly drawingScale: DrawingScaleInput | null;
  readonly buildingExtents: BuildingExtentsInput | null;
  /** Заполняется только для способа по габаритам здания. */
  readonly discrepancyPercent: number | null;
  readonly createdAt: IsoDateTime;
}

/**
 * Контракт движка E1.
 *
 * Движок работает только с байтами и числами. Он не читает и не пишет файлы,
 * не знает о базе данных и об интерфейсе. Всё сохранение делает ядро.
 */
export interface PlanSourceEngine {
  readonly name: string;
  readonly version: string;

  /** Определяет тип файла по его содержимому, а не по расширению. */
  detectKind(bytes: Uint8Array): PlanSourceKind | null;

  /** Читает оглавление PDF: сколько страниц и каковы их размеры. Быстро. */
  probePdf(bytes: Uint8Array): Promise<Result<PdfDocumentInfo>>;

  /** Разбирает содержимое одной страницы, чтобы отличить чертёж от скана. */
  inspectPdfPage(bytes: Uint8Array, pageNumber: number): Promise<Result<PdfPageContentInfo>>;

  /** Считает размер будущей подложки без её построения. Чистая арифметика. */
  estimateRasterSize(page: PdfPageInfo, dpi: number, extraRotationDeg: QuarterTurn): RasterSizeEstimate;

  /** Строит изображение подложки из страницы PDF. */
  rasterizePdfPage(bytes: Uint8Array, request: RasterizeRequest): Promise<Result<RasterizedImage>>;

  /** Читает размеры растрового файла, который пользователь загрузил вместо PDF. */
  probeImage(bytes: Uint8Array): Promise<Result<RasterizedImage>>;

  /** Строит изображение подложки из SVG. */
  rasterizeSvg(bytes: Uint8Array): Promise<Result<RasterizedImage>>;

  /** Строит изображение подложки из простого DXF: линии и полилинии. */
  rasterizeDxf(bytes: Uint8Array): Promise<Result<RasterizedImage>>;

  /** Строит изображение подложки из JSON-описания: SVG или data URL. */
  rasterizeJson(bytes: Uint8Array): Promise<Result<RasterizedImage>>;

  /** Считает метры на пиксель по двум точкам. Чистая арифметика. */
  metersPerPixelFromTwoPoints(input: TwoPointsInput): Result<number>;

  /** Считает метры на пиксель по масштабу чертежа и разрешению подложки. */
  metersPerPixelFromDrawingScale(input: DrawingScaleInput, dpi: number): Result<number>;

  /** Считает метры на пиксель по габаритам здания и проверяет их согласованность. */
  measureByBuildingExtents(input: BuildingExtentsInput): Result<BuildingExtentsMeasurement>;

  /** Читает изображение из файла в память. Нужен графический холст. */
  decodeImage(bytes: Uint8Array): Promise<Result<RgbaImage>>;

  /** Записывает изображение из памяти в файл PNG. Нужен графический холст. */
  encodePng(image: RgbaImage): Promise<Result<Uint8Array>>;

  /** Применяет очистку. Чистая функция: те же действия дают то же изображение. */
  applyCleanup(image: RgbaImage, operations: readonly CleanupOperation[]): Result<RgbaImage>;

  /** Уменьшает изображение — для быстрого предпросмотра очистки. */
  downscale(image: RgbaImage, maxSidePx: number): RgbaImage;

  /** Основные цвета плана. По ним пользователь выбирает, что убрать. */
  samplePalette(image: RgbaImage, maxEntries: number): readonly PaletteEntry[];
}
