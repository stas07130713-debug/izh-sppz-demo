/**
 * Сценарий: сделать подложку плана из загруженного файла.
 *
 * Порядок действий одинаков для PDF и для картинки:
 *   1. убедиться, что файл того типа, за который себя выдаёт;
 *   2. построить изображение подложки — это делает движок E1;
 *   3. положить в хранилище исходный файл и изображение подложки;
 *   4. записать сведения о подложке.
 *
 * Исходный файл сохраняется всегда, даже если подложка уже построена. Он нужен,
 * чтобы позже пересобрать подложку в другом разрешении или извлечь из чертежа
 * геометрию, не прося пользователя искать файл заново.
 */

import type { PlanBackdrop, PlanSourceKind, QuarterTurn, RasterizedImage, Result } from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { BackdropDeps } from './backdrop-deps.js';

export interface CreateBackdropFromPdfInput {
  readonly sourceBytes: Uint8Array;
  readonly sourceFileName: string;
  readonly pageNumber: number;
  readonly dpi: number;
  readonly extraRotationDeg: QuarterTurn;
  /** Узел дерева, для которого готовится подложка: здание или этаж. */
  readonly nodeId?: string | null;
}

export async function createBackdropFromPdf(
  deps: BackdropDeps,
  input: CreateBackdropFromPdfInput,
): Promise<Result<PlanBackdrop>> {
  if (deps.engine.detectKind(input.sourceBytes) !== 'pdf') {
    return err('UNSUPPORTED_FORMAT', 'Этот файл не является документом PDF.');
  }

  const rasterized = await deps.engine.rasterizePdfPage(input.sourceBytes, {
    pageNumber: input.pageNumber,
    dpi: input.dpi,
    extraRotationDeg: input.extraRotationDeg,
  });
  if (!rasterized.ok) return rasterized;

  const sourceHash = await deps.fileStore.put(input.sourceBytes, 'pdf');
  if (!sourceHash.ok) return sourceHash;

  const imageHash = await deps.fileStore.put(rasterized.value.imageBytes, 'png');
  if (!imageHash.ok) return imageHash;

  const backdrop: PlanBackdrop = {
    id: deps.ids.newId(),
    nodeId: input.nodeId ?? null,
    sourceHash: sourceHash.value,
    sourceFileName: input.sourceFileName,
    sourceKind: 'pdf',
    pageNumber: input.pageNumber,
    dpi: rasterized.value.dpi,
    rotationDeg: input.extraRotationDeg,
    crop: null,
    widthPx: rasterized.value.widthPx,
    heightPx: rasterized.value.heightPx,
    imageHash: imageHash.value,
    createdAt: deps.clock.nowUtc(),
  };

  const saved = await deps.backdrops.save(backdrop);
  if (!saved.ok) return saved;

  return ok(backdrop);
}

export interface CreateBackdropFromSourceInput {
  readonly sourceBytes: Uint8Array;
  readonly sourceFileName: string;
  readonly pageNumber?: number;
  readonly dpi?: number;
  readonly extraRotationDeg?: QuarterTurn;
  readonly nodeId?: string | null;
}

export async function createBackdropFromSource(
  deps: BackdropDeps,
  input: CreateBackdropFromSourceInput,
): Promise<Result<PlanBackdrop>> {
  const kind = deps.engine.detectKind(input.sourceBytes);
  if (kind === null) {
    return err('UNSUPPORTED_FORMAT', 'Формат подложки не поддерживается.');
  }

  const rasterized = await rasterizeSource(deps, input, kind);
  if (!rasterized.ok) return rasterized;

  const sourceHash = await deps.fileStore.put(input.sourceBytes, sourceExtension(kind, input.sourceFileName));
  if (!sourceHash.ok) return sourceHash;

  const imageHash = await deps.fileStore.put(rasterized.value.imageBytes, 'png');
  if (!imageHash.ok) return imageHash;

  const backdrop: PlanBackdrop = {
    id: deps.ids.newId(),
    nodeId: input.nodeId ?? null,
    sourceHash: sourceHash.value,
    sourceFileName: input.sourceFileName,
    sourceKind: kind,
    pageNumber: kind === 'pdf' ? input.pageNumber ?? 1 : 1,
    dpi: rasterized.value.dpi,
    rotationDeg: kind === 'pdf' ? input.extraRotationDeg ?? 0 : 0,
    crop: null,
    widthPx: rasterized.value.widthPx,
    heightPx: rasterized.value.heightPx,
    imageHash: imageHash.value,
    createdAt: deps.clock.nowUtc(),
  };

  const saved = await deps.backdrops.save(backdrop);
  if (!saved.ok) return saved;

  return ok(backdrop);
}

export interface CreateBackdropFromImageInput {
  readonly sourceBytes: Uint8Array;
  readonly sourceFileName: string;
  /** Узел дерева, для которого готовится подложка: здание или этаж. */
  readonly nodeId?: string | null;
}

export async function createBackdropFromImage(
  deps: BackdropDeps,
  input: CreateBackdropFromImageInput,
): Promise<Result<PlanBackdrop>> {
  if (deps.engine.detectKind(input.sourceBytes) !== 'image') {
    return err('UNSUPPORTED_FORMAT', 'Этот файл не является изображением PNG или JPEG.');
  }

  const probed = await deps.engine.probeImage(input.sourceBytes);
  if (!probed.ok) return probed;

  const extension = probed.value.mimeType === 'image/jpeg' ? 'jpg' : 'png';
  const imageHash = await deps.fileStore.put(probed.value.imageBytes, extension);
  if (!imageHash.ok) return imageHash;

  const backdrop: PlanBackdrop = {
    id: deps.ids.newId(),
    nodeId: input.nodeId ?? null,
    // Для картинки исходный файл и изображение подложки — это одно и то же,
    // поэтому в хранилище лежит один файл, а не две копии.
    sourceHash: imageHash.value,
    sourceFileName: input.sourceFileName,
    sourceKind: 'image',
    pageNumber: 1,
    dpi: null,
    rotationDeg: 0,
    crop: null,
    widthPx: probed.value.widthPx,
    heightPx: probed.value.heightPx,
    imageHash: imageHash.value,
    createdAt: deps.clock.nowUtc(),
  };

  const saved = await deps.backdrops.save(backdrop);
  if (!saved.ok) return saved;

  return ok(backdrop);
}

function rasterizeSource(
  deps: BackdropDeps,
  input: CreateBackdropFromSourceInput,
  kind: PlanSourceKind,
): Promise<Result<RasterizedImage>> {
  if (kind === 'pdf') {
    return deps.engine.rasterizePdfPage(input.sourceBytes, {
      pageNumber: input.pageNumber ?? 1,
      dpi: input.dpi ?? 150,
      extraRotationDeg: input.extraRotationDeg ?? 0,
    });
  }
  if (kind === 'image') return rasterizeImageAsPng(deps, input.sourceBytes);
  if (kind === 'svg') return deps.engine.rasterizeSvg(input.sourceBytes);
  if (kind === 'dxf') return deps.engine.rasterizeDxf(input.sourceBytes);
  return deps.engine.rasterizeJson(input.sourceBytes);
}

async function rasterizeImageAsPng(deps: BackdropDeps, bytes: Uint8Array): Promise<Result<RasterizedImage>> {
  const decoded = await deps.engine.decodeImage(bytes);
  if (!decoded.ok) return decoded;
  const encoded = await deps.engine.encodePng(decoded.value);
  if (!encoded.ok) return encoded;
  return ok({
    widthPx: decoded.value.widthPx,
    heightPx: decoded.value.heightPx,
    dpi: null,
    imageBytes: encoded.value,
    mimeType: 'image/png',
  });
}

function sourceExtension(kind: PlanSourceKind, fileName: string): string {
  const found = fileName.split('.').pop();
  if (found !== undefined && found.trim().length > 0) return found.toLowerCase();
  if (kind === 'image') return 'png';
  return kind;
}
