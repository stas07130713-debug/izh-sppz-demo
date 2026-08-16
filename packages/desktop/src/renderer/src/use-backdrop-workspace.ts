/**
 * Работа с изображениями выбранной подложки.
 *
 * Здесь три задачи, которые иначе загромоздили бы главный файл окна:
 *   1. загрузить исходное изображение и построить по нему палитру плана;
 *   2. держать уменьшенную копию для быстрого предпросмотра очистки;
 *   3. отдавать ссылку на изображение, которое сейчас нужно показать.
 *
 * Предпросмотр считается на уменьшенной копии: применять очистку к изображению
 * в семнадцать мегапикселей при каждом движении ползунка нельзя. К полному
 * изображению очистка применяется один раз, по кнопке.
 */

import { useEffect, useState } from 'react';
import type { BackdropCleanup, PaletteEntry, PlanBackdrop, RgbaImage } from '@izh/contracts';
import { planSourceEngine, scaleOperations } from '@izh/engine-plan-source';
import { deps } from './deps';
import { toPreviewOperations, type CleanupState } from './cleanup-state';

/** Длинная сторона уменьшенной копии. Хватает, чтобы видеть результат очистки. */
const PREVIEW_MAX_SIDE_PX = 1400;

/** Сколько цветов показывать в палитре плана. */
const PALETTE_SIZE = 12;

async function bytesToUrl(bytes: Uint8Array): Promise<string> {
  return URL.createObjectURL(new Blob([new Uint8Array(bytes) as BlobPart], { type: 'image/png' }));
}

export interface WorkspaceImages {
  /** Уменьшенная копия исходного изображения. Основа предпросмотра и палитры. */
  readonly preview: RgbaImage | null;
  readonly palette: readonly PaletteEntry[];
  /** Ссылка на изображение, которое нужно показать сейчас. */
  readonly displayUrl: string | null;
  readonly loading: boolean;
}

/** Загружает исходное изображение подложки и строит палитру. */
export function useOriginalPreview(backdrop: PlanBackdrop | null): {
  preview: RgbaImage | null;
  palette: readonly PaletteEntry[];
} {
  const [preview, setPreview] = useState<RgbaImage | null>(null);
  const [palette, setPalette] = useState<readonly PaletteEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    setPalette([]);
    if (backdrop === null) return;

    void (async () => {
      const bytes = await deps.fileStore.get(backdrop.imageHash);
      if (!bytes.ok || cancelled) return;

      const decoded = await planSourceEngine.decodeImage(bytes.value);
      if (!decoded.ok || cancelled) return;

      const small = planSourceEngine.downscale(decoded.value, PREVIEW_MAX_SIDE_PX);
      setPreview(small);
      setPalette(planSourceEngine.samplePalette(small, PALETTE_SIZE));
    })();

    return () => {
      cancelled = true;
    };
  }, [backdrop]);

  return { preview, palette };
}

/**
 * Строит ссылку на изображение предпросмотра очистки.
 *
 * Действия приходят в координатах подложки полного размера, а предпросмотр
 * считается на уменьшенной копии, поэтому они пересчитываются под её размер.
 * Без этого стёртая область оказалась бы в предпросмотре совсем не там, где её
 * обвели.
 */
export function useCleanupPreviewUrl(
  preview: RgbaImage | null,
  state: CleanupState,
  fullWidthPx: number,
  active: boolean,
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;

    if (preview === null || !active || fullWidthPx < 1) {
      setUrl(null);
      return;
    }

    void (async () => {
      const factor = preview.widthPx / fullWidthPx;
      const operations = scaleOperations(toPreviewOperations(state), factor);
      const cleaned = planSourceEngine.applyCleanup(preview, operations);
      if (!cleaned.ok || cancelled) return;

      const encoded = await planSourceEngine.encodePng(cleaned.value);
      if (!encoded.ok || cancelled) return;

      created = await bytesToUrl(encoded.value);
      if (cancelled) {
        URL.revokeObjectURL(created);
        return;
      }
      setUrl(created);
    })();

    return () => {
      cancelled = true;
      if (created !== null) URL.revokeObjectURL(created);
    };
  }, [preview, state, fullWidthPx, active]);

  return url;
}

/** Ссылка на сохранённое изображение подложки: очищенное, если очистка применена. */
export function useStoredImageUrl(
  backdrop: PlanBackdrop | null,
  cleanup: BackdropCleanup | null,
): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const hash = cleanup?.cleanedImageHash ?? backdrop?.imageHash ?? null;

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;

    setUrl(null);
    if (hash === null) return;

    void (async () => {
      const bytes = await deps.fileStore.get(hash);
      if (!bytes.ok || cancelled) return;

      created = await bytesToUrl(bytes.value);
      if (cancelled) {
        URL.revokeObjectURL(created);
        return;
      }
      setUrl(created);
    })();

    return () => {
      cancelled = true;
      if (created !== null) URL.revokeObjectURL(created);
    };
  }, [hash]);

  return url;
}
