/**
 * Поддельные реализации портов для тестов.
 *
 * Они держат всё в памяти и ведут себя предсказуемо: часы всегда показывают
 * одно и то же время, идентификаторы выдаются по порядку. Благодаря этому
 * результат сценария можно сравнивать с эталоном целиком.
 *
 * Внимание: здесь намеренно нет обращений к настоящему движку E1. Ядро не имеет
 * права зависеть от движка — ни в рабочем коде, ни в тестах. Нужная арифметика
 * повторена здесь в простейшем виде, а её правильность проверяется тестами
 * самого движка.
 */

import type {
  BackdropCleanup,
  BackdropRepository,
  Clock,
  ContentHash,
  FileStore,
  IdGenerator,
  PdfDocumentInfo,
  PdfPageContentInfo,
  PlanBackdrop,
  PlanCalibration,
  PlanSourceEngine,
  RasterizedImage,
  Result,
} from '@izh/contracts';
import { err, ok } from '@izh/contracts';

export const FIXED_NOW = '2026-08-16T00:00:00.000Z';

export function fakeClock(): Clock {
  return { nowUtc: () => FIXED_NOW };
}

export function fakeIdGenerator(): IdGenerator {
  let counter = 0;
  return {
    newId: () => {
      counter += 1;
      return `id-${counter}`;
    },
  };
}

export function fakeFileStore(): FileStore & { readonly saved: Map<ContentHash, Uint8Array> } {
  const saved = new Map<ContentHash, Uint8Array>();
  return {
    saved,
    async put(bytes, extension) {
      // Поддельный «хеш»: расширение и длина. Для тестов достаточно, лишь бы
      // одинаковое содержимое давало одинаковый адрес.
      const hash = `${extension}-${bytes.length}`;
      saved.set(hash, bytes);
      return ok(hash);
    },
    async get(hash) {
      const bytes = saved.get(hash);
      if (bytes === undefined) return err('FILE_NOT_FOUND', `Нет файла ${hash}.`);
      return ok(bytes);
    },
    async exists(hash) {
      return ok(saved.has(hash));
    },
  };
}

export function fakeBackdropRepository(): BackdropRepository {
  const backdrops = new Map<string, PlanBackdrop>();
  const calibrations = new Map<string, PlanCalibration>();
  const cleanups = new Map<string, BackdropCleanup>();
  return {
    async saveCleanup(cleanup) {
      cleanups.set(cleanup.backdropId, cleanup);
      return ok(undefined);
    },
    async getCleanup(id) {
      return ok(cleanups.get(id) ?? null);
    },
    async removeCleanup(id) {
      cleanups.delete(id);
      return ok(undefined);
    },
    async save(backdrop) {
      backdrops.set(backdrop.id, backdrop);
      return ok(undefined);
    },
    async list() {
      return ok([...backdrops.values()]);
    },
    async getById(id) {
      const found = backdrops.get(id);
      if (found === undefined) return err('NOT_FOUND', `Нет подложки ${id}.`);
      return ok(found);
    },
    async remove(id) {
      backdrops.delete(id);
      calibrations.delete(id);
      return ok(undefined);
    },
    async saveCalibration(calibration) {
      calibrations.set(calibration.backdropId, calibration);
      return ok(undefined);
    },
    async getCalibration(id) {
      return ok(calibrations.get(id) ?? null);
    },
  };
}

export interface FakeEngineOptions {
  readonly rasterized?: RasterizedImage;
  readonly rasterizeError?: boolean;
  readonly decodeError?: boolean;
}

/** Поддельный движок E1: подделывает всё, что требует холста и разбора PDF. */
export function fakeEngine(options: FakeEngineOptions = {}): PlanSourceEngine {
  const rasterized: RasterizedImage = options.rasterized ?? {
    widthPx: 4967,
    heightPx: 3509,
    dpi: 150,
    imageBytes: new Uint8Array(1000),
    mimeType: 'image/png',
  };

  const documentInfo: PdfDocumentInfo = {
    pageCount: 1,
    pages: [{ pageNumber: 1, widthPt: 2384, heightPt: 1684, rotationDeg: 0 }],
  };

  const contentInfo: PdfPageContentInfo = {
    pageNumber: 1,
    textItemCount: 240,
    vectorPathCount: 5400,
    imageCount: 1,
    likelyVector: true,
    likelyScan: false,
  };

  return {
    name: 'поддельный движок',
    version: '0.0.0',

    detectKind(bytes) {
      if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44) return 'pdf';
      if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50) return 'image';
      return null;
    },

    async probePdf(): Promise<Result<PdfDocumentInfo>> {
      return ok(documentInfo);
    },

    async inspectPdfPage(): Promise<Result<PdfPageContentInfo>> {
      return ok(contentInfo);
    },

    estimateRasterSize(page, dpi, extraRotationDeg) {
      const scale = dpi / 72;
      const swap = extraRotationDeg === 90 || extraRotationDeg === 270;
      const widthPx = Math.ceil((swap ? page.heightPt : page.widthPt) * scale);
      const heightPx = Math.ceil((swap ? page.widthPt : page.heightPt) * scale);
      const megapixels = (widthPx * heightPx) / 1_000_000;
      return { widthPx, heightPx, megapixels, tooLarge: false };
    },

    async rasterizePdfPage(): Promise<Result<RasterizedImage>> {
      if (options.rasterizeError === true) {
        return err('RENDER_FAILED', 'Подделка: построение подложки не удалось.');
      }
      return ok(rasterized);
    },

    async probeImage(): Promise<Result<RasterizedImage>> {
      return ok({ ...rasterized, dpi: null, mimeType: 'image/png' });
    },

    metersPerPixelFromTwoPoints(input) {
      const distancePx = Math.hypot(input.b.x - input.a.x, input.b.y - input.a.y);
      if (distancePx < 1) return err('INVALID_ARGUMENT', 'Отрезок слишком короткий.');
      if (input.realDistanceM <= 0) return err('INVALID_ARGUMENT', 'Расстояние должно быть больше нуля.');
      return ok(input.realDistanceM / distancePx);
    },

    metersPerPixelFromDrawingScale(input, dpi) {
      if (input.scaleDenominator <= 0) return err('INVALID_ARGUMENT', 'Знаменатель масштаба должен быть больше нуля.');
      return ok((0.0254 / dpi) * input.scaleDenominator);
    },

    measureByBuildingExtents(input) {
      if (input.horizontalMeters <= 0 || input.verticalMeters <= 0) {
        return err('INVALID_ARGUMENT', 'Размеры здания должны быть больше нуля.');
      }
      const metersPerPixelHorizontal = input.horizontalMeters / input.rect.widthPx;
      const metersPerPixelVertical = input.verticalMeters / input.rect.heightPx;
      const metersPerPixel = (metersPerPixelHorizontal + metersPerPixelVertical) / 2;
      return ok({
        metersPerPixel,
        metersPerPixelHorizontal,
        metersPerPixelVertical,
        discrepancyPercent:
          (Math.abs(metersPerPixelHorizontal - metersPerPixelVertical) / metersPerPixel) * 100,
      });
    },

    // Работа с точками изображения требует холста, поэтому здесь подделывается.
    // Правильность настоящих операций проверяется тестами самого движка.
    async decodeImage(bytes) {
      if (options.decodeError === true) {
        return err('UNSUPPORTED_FORMAT', 'Подделка: изображение не читается.');
      }
      return ok({ widthPx: bytes.length, heightPx: 1, data: new Uint8ClampedArray(bytes.length * 4) });
    },

    async encodePng(image) {
      // Длина результата зависит от размера, поэтому поддельный хеш будет разным
      // для разного результата очистки — как и у настоящего хранилища.
      return ok(new Uint8Array(image.widthPx * image.heightPx));
    },

    applyCleanup(image, operations) {
      let widthPx = image.widthPx;
      let heightPx = image.heightPx;
      for (const operation of operations) {
        if (operation.kind === 'crop') {
          widthPx = Math.round(operation.rect.widthPx);
          heightPx = Math.round(operation.rect.heightPx);
        }
      }
      if (widthPx < 1 || heightPx < 1) {
        return err('INVALID_ARGUMENT', 'Подделка: пустая область обрезки.');
      }
      return ok({ widthPx, heightPx, data: new Uint8ClampedArray(widthPx * heightPx * 4) });
    },

    downscale(image) {
      return image;
    },

    samplePalette() {
      return [{ color: { r: 0, g: 0, b: 0 }, share: 1 }];
    },
  };
}

/** Байты, которые опознаются как PDF. */
export function pdfBytes(length = 500): Uint8Array {
  const bytes = new Uint8Array(length);
  bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37], 0);
  return bytes;
}

/** Байты, которые опознаются как PNG. */
export function pngBytes(length = 300): Uint8Array {
  const bytes = new Uint8Array(length);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return bytes;
}
