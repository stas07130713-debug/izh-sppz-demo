/**
 * Построение изображения подложки.
 *
 * Здесь используется холст графической подсистемы, поэтому этот файл работает
 * только в окне программы, а не в фоновом процессе. Так сделано намеренно:
 * иначе пришлось бы тащить в проект собираемую из исходников графическую
 * библиотеку, а это первое, что ломается при передаче проекта другому
 * исполнителю. Обоснование — docs/adr/ADR-003-подложка-плана.md.
 */

import type { RasterizeRequest, RasterizedImage, Result, RgbaImage } from '@izh/contracts';
import { describeUnknown, err, ok } from '@izh/contracts';
import { estimateRasterSize } from './scale-math.js';
import { openPdfDocument } from './pdfjs-setup.js';
import { probePdf } from './pdf-probe.js';

/** Читает файл изображения в массив точек, с которым работает очистка. */
export async function decodeImage(bytes: Uint8Array): Promise<Result<RgbaImage>> {
  try {
    const blob = new Blob([new Uint8Array(bytes) as BlobPart]);
    const bitmap = await createImageBitmap(blob);

    const canvas = createCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d') as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null;
    if (context === null) {
      bitmap.close();
      return err('RENDER_FAILED', 'Не удалось получить холст для чтения изображения.');
    }

    context.drawImage(bitmap, 0, 0);
    const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);
    bitmap.close();

    return ok({ widthPx: imageData.width, heightPx: imageData.height, data: imageData.data });
  } catch (e) {
    return err('UNSUPPORTED_FORMAT', 'Не удалось прочитать изображение.', describeUnknown(e));
  }
}

/** Записывает массив точек обратно в файл PNG. */
export async function encodePng(image: RgbaImage): Promise<Result<Uint8Array>> {
  try {
    const canvas = createCanvas(image.widthPx, image.heightPx);
    const context = canvas.getContext('2d') as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null;
    if (context === null) {
      return err('RENDER_FAILED', 'Не удалось получить холст для записи изображения.');
    }

    // Копия делается в собственный буфер: ImageData принимает только массив,
    // лежащий в обычной памяти, а не в разделяемой.
    const buffer = new Uint8ClampedArray(image.data.length);
    buffer.set(image.data);

    context.putImageData(new ImageData(buffer, image.widthPx, image.heightPx), 0, 0);
    return ok(await canvasToPngBytes(canvas));
  } catch (e) {
    return err('RENDER_FAILED', 'Не удалось сохранить изображение.', describeUnknown(e));
  }
}

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

export async function rasterizeSvg(bytes: Uint8Array): Promise<Result<RasterizedImage>> {
  try {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return await rasterizeSvgText(text);
  } catch (e) {
    return err('UNSUPPORTED_FORMAT', 'Не удалось прочитать SVG.', describeUnknown(e));
  }
}

export async function rasterizeJson(bytes: Uint8Array): Promise<Result<RasterizedImage>> {
  try {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const parsed = JSON.parse(text) as unknown;
    if (parsed === null || typeof parsed !== 'object') {
      return err('UNSUPPORTED_FORMAT', 'JSON подложки должен быть объектом.');
    }
    const record = parsed as Record<string, unknown>;
    if (typeof record.svg === 'string') return rasterizeSvgText(record.svg);
    if (typeof record.imageDataUrl === 'string') return rasterizeDataUrl(record.imageDataUrl);
    return err('UNSUPPORTED_FORMAT', 'JSON подложки должен содержать поле svg или imageDataUrl.');
  } catch (e) {
    return err('UNSUPPORTED_FORMAT', 'Не удалось прочитать JSON подложки.', describeUnknown(e));
  }
}

export async function rasterizeDxf(bytes: Uint8Array): Promise<Result<RasterizedImage>> {
  try {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const lines = readDxfLines(text);
    if (lines.length === 0) {
      return err('UNSUPPORTED_FORMAT', 'В DXF не найдены линии или полилинии.');
    }

    const bounds = boundsOf(lines);
    const padding = 40;
    const scale = Math.min(2, 2400 / Math.max(bounds.width, bounds.height, 1));
    const widthPx = Math.max(1, Math.ceil(bounds.width * scale + padding * 2));
    const heightPx = Math.max(1, Math.ceil(bounds.height * scale + padding * 2));
    const canvas = createCanvas(widthPx, heightPx);
    const context = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (context === null) return err('RENDER_FAILED', 'Не удалось получить холст для DXF.');

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, widthPx, heightPx);
    context.strokeStyle = '#111111';
    context.lineWidth = 2;
    context.lineCap = 'round';

    for (const line of lines) {
      context.beginPath();
      context.moveTo((line.x1 - bounds.minX) * scale + padding, heightPx - ((line.y1 - bounds.minY) * scale + padding));
      context.lineTo((line.x2 - bounds.minX) * scale + padding, heightPx - ((line.y2 - bounds.minY) * scale + padding));
      context.stroke();
    }

    return ok({ widthPx, heightPx, dpi: null, imageBytes: await canvasToPngBytes(canvas), mimeType: 'image/png' });
  } catch (e) {
    return err('RENDER_FAILED', 'Не удалось построить подложку из DXF.', describeUnknown(e));
  }
}

async function rasterizeSvgText(svg: string): Promise<Result<RasterizedImage>> {
  const normalized = normalizeSvgSize(svg);
  const blob = new Blob([normalized], { type: 'image/svg+xml' });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const decoded = await decodeImage(bytes);
  if (!decoded.ok) return rasterizeSvgWithImageElement(normalized);
  const imageBytes = await encodePng(decoded.value);
  if (!imageBytes.ok) return imageBytes;
  return ok({
    widthPx: decoded.value.widthPx,
    heightPx: decoded.value.heightPx,
    dpi: null,
    imageBytes: imageBytes.value,
    mimeType: 'image/png',
  });
}

async function rasterizeSvgWithImageElement(svg: string): Promise<Result<RasterizedImage>> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return err('UNSUPPORTED_FORMAT', 'SVG можно прочитать только в окне программы.');
  }

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const widthPx = Math.max(1, image.naturalWidth);
    const heightPx = Math.max(1, image.naturalHeight);
    const canvas = createCanvas(widthPx, heightPx);
    const context = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (context === null) return err('RENDER_FAILED', 'Не удалось получить холст для SVG.');

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, widthPx, heightPx);
    context.drawImage(image, 0, 0, widthPx, heightPx);

    return ok({ widthPx, heightPx, dpi: null, imageBytes: await canvasToPngBytes(canvas), mimeType: 'image/png' });
  } catch (e) {
    return err('UNSUPPORTED_FORMAT', 'Не удалось построить подложку из SVG.', describeUnknown(e));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('SVG не загрузился как изображение.'));
    image.src = url;
  });
}

function normalizeSvgSize(svg: string): string {
  if (/\swidth\s*=/.test(svg) && /\sheight\s*=/.test(svg)) return svg;

  const viewBoxMatch = /\sviewBox\s*=\s*["']\s*([-.\d]+)\s+[-.\d]+\s+([-.\d]+)\s+([-.\d]+)\s*["']/i.exec(svg);
  const width = viewBoxMatch?.[2] === undefined ? 1200 : Math.max(1, Math.round(Number(viewBoxMatch[2])));
  const height = viewBoxMatch?.[3] === undefined ? 800 : Math.max(1, Math.round(Number(viewBoxMatch[3])));

  return svg.replace(/<svg\b/i, `<svg width="${width}" height="${height}"`);
}

async function rasterizeDataUrl(url: string): Promise<Result<RasterizedImage>> {
  if (!url.startsWith('data:image/')) {
    return err('UNSUPPORTED_FORMAT', 'JSON подложки должен содержать встроенное imageDataUrl, без внешних ссылок.');
  }
  const response = await fetch(url);
  if (!response.ok) return err('UNSUPPORTED_FORMAT', 'Не удалось прочитать imageDataUrl из JSON.');
  return probeImage(new Uint8Array(await response.arrayBuffer()));
}

interface DxfLine {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

function readDxfLines(text: string): readonly DxfLine[] {
  const raw = text.split(/\r?\n/).map((line) => line.trim());
  const pairs: { code: string; value: string }[] = [];
  for (let i = 0; i + 1 < raw.length; i += 2) pairs.push({ code: raw[i] ?? '', value: raw[i + 1] ?? '' });

  const result: DxfLine[] = [];
  for (let i = 0; i < pairs.length; i += 1) {
    const entity = pairs[i]?.code === '0' ? pairs[i]?.value.toUpperCase() : '';
    if (entity === 'LINE') {
      const read = readEntityNumbers(pairs, i + 1);
      if (read.has(10) && read.has(20) && read.has(11) && read.has(21)) {
        result.push({ x1: read.get(10) ?? 0, y1: read.get(20) ?? 0, x2: read.get(11) ?? 0, y2: read.get(21) ?? 0 });
      }
    }
    if (entity === 'LWPOLYLINE') {
      const points = readPolylinePoints(pairs, i + 1);
      for (let p = 1; p < points.length; p += 1) {
        const a = points[p - 1];
        const b = points[p];
        if (a !== undefined && b !== undefined) result.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      }
    }
  }
  return result;
}

function readEntityNumbers(pairs: readonly { code: string; value: string }[], start: number): Map<number, number> {
  const numbers = new Map<number, number>();
  for (let i = start; i < pairs.length; i += 1) {
    const pair = pairs[i];
    if (pair === undefined || pair.code === '0') break;
    const code = Number(pair.code);
    const value = Number(pair.value.replace(',', '.'));
    if (Number.isFinite(code) && Number.isFinite(value)) numbers.set(code, value);
  }
  return numbers;
}

function readPolylinePoints(pairs: readonly { code: string; value: string }[], start: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  let x: number | null = null;
  for (let i = start; i < pairs.length; i += 1) {
    const pair = pairs[i];
    if (pair === undefined || pair.code === '0') break;
    const value = Number(pair.value.replace(',', '.'));
    if (!Number.isFinite(value)) continue;
    if (pair.code === '10') x = value;
    if (pair.code === '20' && x !== null) {
      points.push({ x, y: value });
      x = null;
    }
  }
  return points;
}

function boundsOf(lines: readonly DxfLine[]): { minX: number; minY: number; width: number; height: number } {
  const xs = lines.flatMap((line) => [line.x1, line.x2]);
  const ys = lines.flatMap((line) => [line.y1, line.y2]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { minX, minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}
