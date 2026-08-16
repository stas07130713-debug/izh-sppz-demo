/**
 * Чтение сведений о PDF: оглавление документа и разбор содержимого страницы.
 */

import type { PdfDocumentInfo, PdfPageContentInfo, PdfPageInfo, QuarterTurn, Result } from '@izh/contracts';
import { describeUnknown, err, ok } from '@izh/contracts';
import { classifyPageContent } from './content-signals.js';
import { openPdfDocument, pdfjs } from './pdfjs-setup.js';

/** Приводит произвольный угол поворота из PDF к одному из четырёх допустимых. */
function toQuarterTurn(degrees: number): QuarterTurn {
  const normalized = ((Math.round(degrees / 90) * 90) % 360 + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) return normalized;
  return 0;
}

/** Читает оглавление документа: количество страниц и их размеры. */
export async function probePdf(bytes: Uint8Array): Promise<Result<PdfDocumentInfo>> {
  try {
    const document = await openPdfDocument(bytes);
    try {
      const pages: PdfPageInfo[] = [];

      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        // Масштаб 1 даёт размеры в пунктах PDF, собственный поворот страницы
        // при этом уже учтён библиотекой.
        const viewport = page.getViewport({ scale: 1 });
        pages.push({
          pageNumber,
          widthPt: viewport.width,
          heightPt: viewport.height,
          rotationDeg: toQuarterTurn(page.rotate),
        });
        page.cleanup();
      }

      return ok({ pageCount: document.numPages, pages });
    } finally {
      await document.destroy();
    }
  } catch (e) {
    return err(
      'PDF_PARSE_FAILED',
      'Не удалось прочитать файл PDF. Возможно, он повреждён или защищён паролем.',
      describeUnknown(e),
    );
  }
}

/** Коды операций pdf.js, которые означают рисование растровой картинки. */
const IMAGE_OPS = new Set<number>([
  pdfjs.OPS.paintImageXObject,
  pdfjs.OPS.paintInlineImageXObject,
  pdfjs.OPS.paintImageMaskXObject,
  pdfjs.OPS.paintImageMaskXObjectGroup,
  pdfjs.OPS.paintImageXObjectRepeat,
]);

/** Разбирает содержимое страницы, чтобы отличить векторный чертёж от скана. */
export async function inspectPdfPage(
  bytes: Uint8Array,
  pageNumber: number,
): Promise<Result<PdfPageContentInfo>> {
  try {
    const document = await openPdfDocument(bytes);
    try {
      if (pageNumber < 1 || pageNumber > document.numPages) {
        return err('PDF_PAGE_NOT_FOUND', `В документе нет страницы ${pageNumber}.`);
      }

      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const operatorList = await page.getOperatorList();

      let vectorPathCount = 0;
      let imageCount = 0;

      for (const operation of operatorList.fnArray) {
        if (operation === pdfjs.OPS.constructPath) vectorPathCount += 1;
        else if (IMAGE_OPS.has(operation)) imageCount += 1;
      }

      const counters = {
        textItemCount: textContent.items.length,
        vectorPathCount,
        imageCount,
      };

      page.cleanup();

      return ok({ pageNumber, ...counters, ...classifyPageContent(counters) });
    } finally {
      await document.destroy();
    }
  } catch (e) {
    return err(
      'PDF_PARSE_FAILED',
      'Не удалось разобрать содержимое страницы.',
      describeUnknown(e),
    );
  }
}
