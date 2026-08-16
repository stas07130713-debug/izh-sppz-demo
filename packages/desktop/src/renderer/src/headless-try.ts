/**
 * Безголовый прогон распознавания.
 *
 * Запускается командой `npm run try -- <файл.pdf>`. Окно при этом не
 * показывается: оно нужно только ради графического холста, без которого нельзя
 * отрисовать страницу.
 *
 * Смысл в том, чтобы результат можно было посмотреть, не нажимая кнопок.
 * Выполняется ровно тот же код, что и при обычной работе, поэтому расхождение
 * «в проверке одно, в программе другое» исключено.
 *
 * Складывает в папку: отрисованную страницу, маску после стирания надписей,
 * цифровой план, наложение и числа. По ним видно, на каком шаге ломается.
 */

import * as pdfjs from 'pdfjs-dist';
import { renderFloorSvg, type PageContent } from '@izh/planvector-engine';
import { planSourceEngine } from '@izh/engine-plan-source';
import { readPageContent } from './planvector/pdfjs-adapter';
import { recognizeByRaster, RECOGNIZE_DPI } from './planvector/raster-recognize';

/** Разрешение отрисовки страницы для сверки — то же, что и для распознавания. */
const PAGE_DPI = RECOGNIZE_DPI;

function log(message: string): void {
  // eslint-disable-next-line no-console -- вывод в консоль и есть отчёт прогона
  console.log(message);
}

/** Маска в чёрно-белую картинку: так видно, что осталось после стирания надписей. */
async function maskToPng(
  data: Uint8ClampedArray,
  widthPx: number,
  heightPx: number,
): Promise<Uint8Array | null> {
  const inverted = new Uint8ClampedArray(widthPx * heightPx * 4);
  for (let pixel = 0; pixel < widthPx * heightPx; pixel += 1) {
    const value = data[pixel] === 1 ? 0 : 255;
    inverted[pixel * 4] = value;
    inverted[pixel * 4 + 1] = value;
    inverted[pixel * 4 + 2] = value;
    inverted[pixel * 4 + 3] = 255;
  }
  const encoded = await planSourceEngine.encodePng({ widthPx, heightPx, data: inverted });
  return encoded.ok ? encoded.value : null;
}

/** Страница с наложением: оригинал и поверх него цифровой план. */
function overlayHtml(svg: string, widthPt: number, heightPt: number): string {
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return (
    '<!doctype html><html lang="ru"><head><meta charset="utf-8">' +
    '<title>Наложение</title><style>body{margin:0;background:#fff}' +
    `.stack{position:relative;width:${widthPt}px;height:${heightPt}px}` +
    '.stack img{position:absolute;top:0;left:0;width:100%;height:100%}' +
    '</style></head><body><div class="stack">' +
    '<img src="./original.png" alt="оригинал">' +
    `<img src="${svgUrl}" alt="цифровой план" style="mix-blend-mode:multiply;opacity:.65">` +
    '</div></body></html>'
  );
}

/** Возвращает true, если прогон состоялся и программу надо закрыть. */
export async function runHeadlessTry(): Promise<boolean> {
  const params = await window.izh.headless.params();
  if (params === null) return false;

  log(`прогон: ${params.pdfPath}`);
  log(`результат: ${params.outDir}`);

  const file = await window.izh.headless.readFile(params.pdfPath);
  if (!file.ok) {
    log(`ошибка чтения: ${file.error.message}`);
    return true;
  }

  const bytes = file.value;
  let counter = 0;
  const makeId = (): string => `e${(counter += 1)}`;

  const document = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false })
    .promise;
  const page: PageContent = await readPageContent(document, 1);
  log(`страница ${Math.round(page.widthPt)} × ${Math.round(page.heightPt)} пт, путей ${page.paths.length}, надписей ${page.texts.length}`);

  const rendered = await planSourceEngine.rasterizePdfPage(bytes, {
    pageNumber: 1,
    dpi: PAGE_DPI,
    extraRotationDeg: 0,
  });
  await document.destroy();

  if (!rendered.ok) {
    log(`ошибка отрисовки: ${rendered.error.message}`);
    return true;
  }
  await window.izh.headless.write('original.png', rendered.value.imageBytes);

  const outcome = await recognizeByRaster(bytes, page, makeId, params.pdfPath);
  if ('error' in outcome) {
    log(`ошибка распознавания: ${outcome.error}`);
    return true;
  }

  // Маска считается второй раз намеренно: прогон должен показывать ровно то,
  // с чем работал поиск стен, а не похожую картинку.
  const decoded = await planSourceEngine.decodeImage(rendered.value.imageBytes);
  if (decoded.ok) {
    const { inkMaskFromRgba, eraseRects } = await import('@izh/planvector-engine');
    const scale = PAGE_DPI / 72;
    const rects = page.texts.map((item) => {
      const padding = Math.max(1.5, item.height * 0.8);
      return {
        x: (item.x - padding) * scale,
        y: (page.heightPt - (item.y + item.height + padding)) * scale,
        widthPx: (item.width + padding * 2) * scale,
        heightPx: (item.height + padding * 2) * scale,
      };
    });
    const mask = eraseRects(
      inkMaskFromRgba(decoded.value.data, decoded.value.widthPx, decoded.value.heightPx),
      rects,
    );
    const png = await maskToPng(mask.data as unknown as Uint8ClampedArray, mask.widthPx, mask.heightPx);
    if (png !== null) await window.izh.headless.write('mask.png', png);
  }

  const floor = outcome.model.building.floors[0];
  const svg = renderFloorSvg(outcome.model, 0, {
    caption: null,
    showConfidence: false,
    reviewThreshold: 0.5,
  });

  if (svg !== null) {
    await window.izh.headless.write('digital.svg', svg.svg);
    await window.izh.headless.write(
      'overlay.html',
      overlayHtml(svg.svg, page.widthPt, page.heightPt),
    );
  }

  const facts = {
    файл: params.pdfPath,
    страница: { ширинаПт: page.widthPt, высотаПт: page.heightPt },
    изображение: { ширинаТч: outcome.imageWidthPx, высотаТч: outcome.imageHeightPx, dpi: PAGE_DPI },
    надписей: page.texts.length,
    стёртоНадписей: outcome.stats.erasedTextRects,
    стен: {
      всего: floor?.elements.length ?? 0,
      горизонтальных: outcome.stats.wallsHorizontal,
      вертикальных: outcome.stats.wallsVertical,
    },
    история: outcome.model.history.map((entry) => entry.summary),
  };

  await window.izh.headless.write('facts.json', JSON.stringify(facts, null, 2));
  log(`стен найдено: ${floor?.elements.length ?? 0}`);

  return true;
}
