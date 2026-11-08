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

/**
 * Ждёт, пока картинка по ссылке готова к показу.
 *
 * Ожидание ограничено по времени и никогда не подвешивает показ. Это не
 * перестраховка: `HTMLImageElement.decode()`, которым это делалось сначала,
 * на скрытой вкладке не завершается вовсе — картинка загружена, размеры
 * известны, а обещание висит. В программе это означало бы план, который не
 * появляется никогда.
 *
 * Поэтому ждём обычной загрузки (`onload` срабатывает всегда) и всё равно
 * отпускаем по истечении срока: показать чуть раньше лучше, чем не показать.
 */
async function imageReady(url: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const image = new Image();
    let done = false;
    const finish = (): void => { if (!done) { done = true; resolve(); } };
    image.onload = finish;
    image.onerror = finish;
    window.setTimeout(finish, IMAGE_WAIT_MS);
    image.src = url;
  });
}

/** Предел ожидания картинки. Больше секунды ждать нечего — покажем как есть. */
const IMAGE_WAIT_MS = 1000;

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

export interface CleanupPreviewImage {
  readonly url: string;
  /** Размер в координатах полной подложки, а не уменьшенного предпросмотра. */
  readonly widthPx: number;
  readonly heightPx: number;
  readonly image: RgbaImage;
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
): CleanupPreviewImage | null {
  const [value, setValue] = useState<CleanupPreviewImage | null>(null);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;

    if (preview === null || !active || fullWidthPx < 1) {
      setValue(null);
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
      setValue({
        url: created,
        widthPx: cleaned.value.widthPx / factor,
        heightPx: cleaned.value.heightPx / factor,
        image: cleaned.value,
      });
    })();

    return () => {
      cancelled = true;
      if (created !== null) URL.revokeObjectURL(created);
    };
  }, [preview, state, fullWidthPx, active]);

  return value;
}

/**
 * Ссылка на сохранённое изображение подложки: очищенное, если очистка
 * применена.
 *
 * Ссылка выдаётся не сразу, как только прочитаны байты, а только после того,
 * как картинка **разобрана браузером** и готова к показу.
 *
 * Заказчик: «при смене объекта подложка высвечивает на секунду другую
 * (мигает)». Дело в том, как устроен показ картинки в браузере: когда у уже
 * нарисованной картинки меняют ссылку, прежнее изображение остаётся на экране
 * до тех пор, пока новое не разобрано. На чертеже в две тысячи точек это
 * заметная доля секунды — и всё это время виден план прежнего этажа.
 *
 * `decode()` переносит ожидание сюда, до показа: к моменту, когда ссылка
 * попадает в разметку, картинка уже готова и подменяется мгновенно. Не
 * поддержан `decode` — работаем как прежде: показать чуть раньше лучше, чем
 * не показать вовсе.
 */
export function useStoredImageUrl(
  backdrop: PlanBackdrop | null,
  cleanup: BackdropCleanup | null,
): string | null {
  const hash = cleanup?.cleanedImageHash ?? backdrop?.imageHash ?? null;
  const [loaded, setLoaded] = useState<{ readonly hash: string | null; readonly url: string | null }>({
    hash: null, url: null,
  });

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;

    if (hash === null) {
      setLoaded({ hash: null, url: null });
      return;
    }

    void (async () => {
      const bytes = await deps.fileStore.get(hash);
      if (!bytes.ok || cancelled) return;

      created = await bytesToUrl(bytes.value);
      if (cancelled) {
        URL.revokeObjectURL(created);
        return;
      }

      // Ждём, пока картинка загружена: иначе на экране ещё мгновение будет
      // виден прежний чертёж.
      await imageReady(created);
      if (cancelled) {
        URL.revokeObjectURL(created);
        return;
      }

      setLoaded({ hash, url: created });
    })();

    return () => {
      cancelled = true;
      if (created !== null) URL.revokeObjectURL(created);
    };
  }, [hash]);

  /*
   * `useEffect` начинается после отрисовки. Одного `setUrl(null)` в нём было
   * недостаточно: новый узел успевал получить ссылку прежнего плана на один
   * кадр. Совпадение хэша проверяется синхронно во время самой отрисовки.
   */
  return loaded.hash === hash ? loaded.url : null;
}
