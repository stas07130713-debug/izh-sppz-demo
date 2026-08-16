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

import type { PlanBackdrop, QuarterTurn, Result } from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { BackdropDeps } from './backdrop-deps.js';

export interface CreateBackdropFromPdfInput {
  readonly sourceBytes: Uint8Array;
  readonly sourceFileName: string;
  readonly pageNumber: number;
  readonly dpi: number;
  readonly extraRotationDeg: QuarterTurn;
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

export interface CreateBackdropFromImageInput {
  readonly sourceBytes: Uint8Array;
  readonly sourceFileName: string;
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
