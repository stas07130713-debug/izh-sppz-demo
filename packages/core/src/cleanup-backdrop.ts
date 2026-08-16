/**
 * Сценарий: очистить подложку.
 *
 * Планы приходят с нагрузкой: стрелки эвакуации, уже расставленные значки
 * огнетушителей, легенда, экспликация, штамп, рамка. Для работы нужна голая
 * архитектура — стены, проёмы, лестницы, — на которую программа сама нанесёт
 * оборудование.
 *
 * Очистка неразрушающая. Она всегда выполняется заново от исходного
 * изображения, а не поверх предыдущего результата. Поэтому любое действие можно
 * убрать из списка и получить подложку такой, как если бы его и не было.
 */

import type { BackdropCleanup, CleanupOperation, Result } from '@izh/contracts';
import { ok } from '@izh/contracts';
import type { BackdropDeps } from './backdrop-deps.js';

export interface ApplyBackdropCleanupInput {
  readonly backdropId: string;
  readonly operations: readonly CleanupOperation[];
}

export async function applyBackdropCleanup(
  deps: BackdropDeps,
  input: ApplyBackdropCleanupInput,
): Promise<Result<BackdropCleanup>> {
  const backdrop = await deps.backdrops.getById(input.backdropId);
  if (!backdrop.ok) return backdrop;

  // Берём именно исходное изображение: очистка всегда считается с нуля.
  const originalBytes = await deps.fileStore.get(backdrop.value.imageHash);
  if (!originalBytes.ok) return originalBytes;

  const decoded = await deps.engine.decodeImage(originalBytes.value);
  if (!decoded.ok) return decoded;

  const cleaned = deps.engine.applyCleanup(decoded.value, input.operations);
  if (!cleaned.ok) return cleaned;

  const encoded = await deps.engine.encodePng(cleaned.value);
  if (!encoded.ok) return encoded;

  const cleanedHash = await deps.fileStore.put(encoded.value, 'png');
  if (!cleanedHash.ok) return cleanedHash;

  const cleanup: BackdropCleanup = {
    backdropId: input.backdropId,
    operations: input.operations,
    cleanedImageHash: cleanedHash.value,
    widthPx: cleaned.value.widthPx,
    heightPx: cleaned.value.heightPx,
    updatedAt: deps.clock.nowUtc(),
  };

  const saved = await deps.backdrops.saveCleanup(cleanup);
  if (!saved.ok) return saved;

  return ok(cleanup);
}

/** Отменить очистку целиком и вернуться к исходному изображению. */
export async function resetBackdropCleanup(
  deps: BackdropDeps,
  backdropId: string,
): Promise<Result<void>> {
  return deps.backdrops.removeCleanup(backdropId);
}
