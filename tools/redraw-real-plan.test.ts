/**
 * Проверка перерисовки на настоящем чертеже.
 *
 * Не выполняется, пока не указан файл: в хранилище исходников заказчика нет и
 * быть не должно. Запуск:
 *
 *   IZH_SAMPLE_PDF="C:\путь\к\плану.pdf" npx vitest run tools
 *
 * Результат кладётся в tools/out/ — SVG можно открыть браузером и сравнить с
 * исходником глазами.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { redrawFromPdfPage, renderPlanSvg, type PdfPageSource } from '@izh/engine-plan-vector';

const samplePath = process.env['IZH_SAMPLE_PDF'];
const outDir = join(dirname(fileURLToPath(import.meta.url)), 'out');

describe.skipIf(samplePath === undefined || samplePath === '')('перерисовка настоящего чертежа', () => {
  it('строит планировку и сохраняет SVG', async () => {
    const bytes = new Uint8Array(await readFile(samplePath as string));
    const document = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
    const page = await document.getPage(Number(process.env['IZH_SAMPLE_PAGE'] ?? 1));
    const viewport = page.getViewport({ scale: 1 });
    const operatorList = await page.getOperatorList();

    const source: PdfPageSource = {
      widthPt: viewport.width,
      heightPt: viewport.height,
      fnArray: operatorList.fnArray,
      argsArray: operatorList.argsArray,
      ops: {
        save: pdfjs.OPS.save,
        restore: pdfjs.OPS.restore,
        transform: pdfjs.OPS.transform,
        setLineWidth: pdfjs.OPS.setLineWidth,
        setStrokeRGBColor: pdfjs.OPS.setStrokeRGBColor,
        constructPath: pdfjs.OPS.constructPath,
        moveTo: pdfjs.OPS.moveTo,
        lineTo: pdfjs.OPS.lineTo,
        curveTo: pdfjs.OPS.curveTo,
        rectangle: pdfjs.OPS.rectangle,
        closePath: pdfjs.OPS.closePath,
      },
    };

    // Область чертежа можно задать вручную: IZH_SAMPLE_AREA="x,y,ширина,высота".
    // Так проверяется, сколько мусора даёт легенда и штамп.
    const areaText = process.env['IZH_SAMPLE_AREA'];
    const areaParts = areaText === undefined ? [] : areaText.split(',').map(Number);
    const area =
      areaParts.length === 4
        ? { x: areaParts[0] as number, y: areaParts[1] as number, width: areaParts[2] as number, height: areaParts[3] as number }
        : undefined;

    let counter = 0;
    const result = redrawFromPdfPage(source, {
      backdropId: 'проверка',
      labels: [],
      createdAt: new Date().toISOString(),
      makeId: () => `e${(counter += 1)}`,
      ...(area === undefined ? {} : { area }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { drawing, stats } = result.value;
    console.log('страница, пунктов:', Math.round(viewport.width), 'x', Math.round(viewport.height));
    console.log('область чертежа:', JSON.stringify(drawing.area));
    console.log('отрезков всего:', stats.rawSegments);
    console.log('после отбора и склейки:', stats.structuralSegments);
    console.log('стен:', stats.walls, '| перегородок:', stats.partitions, '| линий:', stats.lines);

    const walls = drawing.elements.filter((element) => element.kind === 'wall');
    const lengths = walls
      .map((wall) => Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y))
      .sort((first, second) => first - second);
    const thicknesses = walls.map((wall) => wall.thickness).sort((first, second) => first - second);
    const at = (values: number[], quantile: number): string =>
      (values[Math.floor(values.length * quantile)] ?? 0).toFixed(1);
    console.log(
      'длина стен по четвертям, пт:',
      at(lengths, 0.25), '/', at(lengths, 0.5), '/', at(lengths, 0.75), '/', at(lengths, 0.95),
      '| максимум', (lengths[lengths.length - 1] ?? 0).toFixed(0),
    );
    console.log(
      'толщина стен по четвертям, пт:',
      at(thicknesses, 0.25), '/', at(thicknesses, 0.5), '/', at(thicknesses, 0.75), '/', at(thicknesses, 0.95),
    );

    const svg = renderPlanSvg(drawing, { caption: 'Этаж 1, здание АБК ХМЦ', highlightManual: true });
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, 'redraw.svg'), svg, 'utf8');
    console.log('SVG сохранён:', join(outDir, 'redraw.svg'), `${Math.round(svg.length / 1024)} КБ`);

    expect(drawing.elements.length).toBeGreaterThan(0);
    await document.destroy();
  }, 120_000);
});
