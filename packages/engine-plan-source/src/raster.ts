/**
 * Построение изображения подложки.
 *
 * Здесь используется холст графической подсистемы, поэтому этот файл работает
 * только в окне программы, а не в фоновом процессе. Так сделано намеренно:
 * иначе пришлось бы тащить в проект собираемую из исходников графическую
 * библиотеку, а это первое, что ломается при передаче проекта другому
 * исполнителю. Обоснование — docs/adr/ADR-003-подложка-плана.md.
 */

import type { RasterizeRequest, RasterizedImage, Result } from '@izh/contracts';
import { describeUnknown, err, ok } from '@izh/contracts';
import { estimateRasterSize } from './scale-math.js';
import { openPdfDocument } from './pdfjs-setup.js';
import { probePdf } from './pdf-probe.js';

/** Создаёт холст. Предпочитается внеэкранный: он не требует вставки в страницу. */
function createCanvas(widthPx: number, heightPx: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(widthPx, heightPx);
  }
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  return canvas;
}

async function canvasToPngBytes(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<Uint8Array> {
  if (canvas instanceof OffscreenCanvas) {
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return new Uint8Array(await blob.arrayBuffer());
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
  if (blob === null) throw new Error('Холст не смог отдать изображение.');
  return new Uint8Array(await blob.arrayBuffer());
}

/** Строит подложку из страницы PDF. */
export async function rasterizePdfPage(
  bytes: Uint8Array,
  request: RasterizeRequest,
): Promise<Result<RasterizedImage>> {
  const documentInfo = await probePdf(bytes);
  if (!documentInfo.ok) return documentInfo;

  const page = documentInfo.value.pages.find((p) => p.pageNumber === request.pageNumber);
  if (page === undefined) {
    return err('PDF_PAGE_NOT_FOUND', `В документе нет страницы ${request.pageNumber}.`);
  }

  const estimate = estimateRasterSize(page, request.dpi, request.extraRotationDeg);
  if (estimate.tooLarge) {
    return err(
      'INVALID_ARGUMENT',
      `При разрешении ${request.dpi} точек на дюйм подложка получится ${estimate.widthPx} на ${estimate.heightPx} точек — это слишком много. Выберите разрешение поменьше.`,
    );
  }

  try {
    const document = await openPdfDocument(bytes);
    try {
      const pdfPage = await document.getPage(request.pageNumber);

      const scale = request.dpi / 72;
      // К собственному повороту страницы добавляется поворот, выбранный пользователем.
      const rotation = (pdfPage.rotate + request.extraRotationDeg) % 360;
      const viewport = pdfPage.getViewport({ scale, rotation });

      const widthPx = Math.ceil(viewport.width);
      const heightPx = Math.ceil(viewport.height);

      const canvas = createCanvas(widthPx, heightPx);
      const context = canvas.getContext('2d') as
        | OffscreenCanvasRenderingContext2D
        | CanvasRenderingContext2D
        | null;
      if (context === null) {
        return err('RENDER_FAILED', 'Не удалось получить холст для построения подложки.');
      }

      // Страница PDF прозрачна. Без белой заливки подложка получится с чёрным
      // фоном везде, где на чертеже ничего не нарисовано.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, widthPx, heightPx);

      await pdfPage.render({
        canvasContext: context as CanvasRenderingContext2D,
        viewport,
      }).promise;

      const imageBytes = await canvasToPngBytes(canvas);
      pdfPage.cleanup();

      return ok({ widthPx, heightPx, dpi: request.dpi, imageBytes, mimeType: 'image/png' });
    } finally {
      await document.destroy();
    }
  } catch (e) {
    return err('RENDER_FAILED', 'Не удалось построить подложку из страницы.', describeUnknown(e));
  }
}

/**
 * Читает размеры растрового файла, загруженного вместо PDF.
 *
 * Содержимое не пересобирается: перекодировать многомегабайтный JPEG в PNG
 * значило бы раздуть его в несколько раз без всякой пользы.
 */
export async function probeImage(bytes: Uint8Array): Promise<Result<RasterizedImage>> {
  try {
    const copy = new Uint8Array(bytes);
    const blob = new Blob([copy]);
    const bitmap = await createImageBitmap(blob);
    const result: RasterizedImage = {
      widthPx: bitmap.width,
      heightPx: bitmap.height,
      dpi: null,
      imageBytes: copy,
      mimeType: blob.type === '' ? 'image/png' : blob.type,
    };
    bitmap.close();
    return ok(result);
  } catch (e) {
    return err('UNSUPPORTED_FORMAT', 'Не удалось прочитать изображение.', describeUnknown(e));
  }
}
