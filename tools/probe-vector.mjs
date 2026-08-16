/**
 * Разведочный инструмент: что лежит внутри векторного PDF.
 *
 * Запуск:  node tools/probe-vector.mjs <путь к файлу.pdf> [номер страницы]
 *
 * Нужен, чтобы подбирать правила разбора чертежей по настоящим файлам
 * заказчика, а не по догадкам. В работе программы не участвует.
 */

import { readFile } from 'node:fs/promises';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const file = process.argv[2];
const pageNumber = Number(process.argv[3] ?? 1);
const data = new Uint8Array(await readFile(file));

const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: false }).promise;
const page = await doc.getPage(pageNumber);
const viewport = page.getViewport({ scale: 1 });
console.log('страниц:', doc.numPages, '| страница, пунктов:', Math.round(viewport.width), 'x', Math.round(viewport.height));

const opList = await page.getOperatorList();
const OPS = pdfjs.OPS;

/** Умножение матриц PDF [a b c d e f]. */
function multiply(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function apply(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Средний масштаб матрицы — переводит толщину линии в пункты страницы. */
function scaleOf(m) {
  return (Math.hypot(m[0], m[1]) + Math.hypot(m[2], m[3])) / 2;
}

let ctm = [1, 0, 0, 1, 0, 0];
const stack = [];
let lineWidth = 1;
let strokeColor = '#000000';

const shapes = [];
const colorUse = new Map();

for (let i = 0; i < opList.fnArray.length; i += 1) {
  const fn = opList.fnArray[i];
  const args = opList.argsArray[i];

  if (fn === OPS.save) stack.push({ ctm, lineWidth, strokeColor });
  else if (fn === OPS.restore) {
    const saved = stack.pop();
    if (saved) ({ ctm, lineWidth, strokeColor } = saved);
  } else if (fn === OPS.transform) ctm = multiply(ctm, args);
  else if (fn === OPS.setLineWidth) lineWidth = args[0];
  else if (fn === OPS.setStrokeRGBColor) strokeColor = `rgb(${args[0]},${args[1]},${args[2]})`;
  else if (fn === OPS.constructPath) {
    const ops = args[0];
    const coords = args[1];
    const points = [];
    let c = 0;
    for (const op of ops) {
      if (op === OPS.moveTo || op === OPS.lineTo) {
        points.push(apply(ctm, coords[c], coords[c + 1]));
        c += 2;
      } else if (op === OPS.curveTo) {
        points.push(apply(ctm, coords[c + 4], coords[c + 5]));
        c += 6;
      } else if (op === OPS.rectangle) {
        c += 4;
      }
    }
    shapes.push({ points, lineWidth: lineWidth * scaleOf(ctm), strokeColor, vertices: ops.length });
    colorUse.set(strokeColor, (colorUse.get(strokeColor) ?? 0) + 1);
  }
}

console.log('фигур:', shapes.length);

let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const shape of shapes) {
  for (const [x, y] of shape.points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
}
console.log('габариты геометрии, пунктов:', Math.round(minX), Math.round(minY), '..', Math.round(maxX), Math.round(maxY));

/** Замкнутая вытянутая фигура из 4–5 вершин — вероятная стена. */
function quadDimensions(points) {
  if (points.length < 4 || points.length > 5) return null;
  const sides = [];
  for (let i = 1; i < points.length; i += 1) {
    sides.push(Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  }
  sides.sort((a, b) => a - b);
  const thin = (sides[0] + sides[1]) / 2;
  const long = (sides[sides.length - 1] + sides[sides.length - 2]) / 2;
  return long > 0 ? { thin, long } : null;
}

const quads = [];
for (const shape of shapes) {
  const dimensions = quadDimensions(shape.points);
  if (dimensions !== null && dimensions.long > 0.5) quads.push(dimensions);
}

function histogram(values, edges, unit) {
  const counts = new Array(edges.length + 1).fill(0);
  for (const value of values) {
    let placed = false;
    for (let i = 0; i < edges.length; i += 1) {
      if (value < edges[i]) {
        counts[i] += 1;
        placed = true;
        break;
      }
    }
    if (!placed) counts[counts.length - 1] += 1;
  }
  edges.forEach((edge, i) => {
    if (counts[i] > 0) console.log(`    < ${edge} ${unit}: ${counts[i]}`);
  });
  if (counts[counts.length - 1] > 0) {
    console.log(`    >= ${edges[edges.length - 1]} ${unit}: ${counts[counts.length - 1]}`);
  }
}

console.log('\n=== вытянутые четырёхугольники (кандидаты в стены):', quads.length, '===');
console.log('  толщина (короткая сторона):');
histogram(quads.map((q) => q.thin), [0.5, 1, 2, 3, 5, 8, 12, 20], 'пт');
console.log('  длина (длинная сторона):');
histogram(quads.map((q) => q.long), [2, 5, 10, 20, 50, 100, 200, 400], 'пт');

console.log('\n=== число вершин в фигуре ===');
const vertexCounts = new Map();
for (const shape of shapes) vertexCounts.set(shape.vertices, (vertexCounts.get(shape.vertices) ?? 0) + 1);
[...vertexCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([vertices, count]) => console.log(`  ${vertices} вершин: ${count} фигур`));

console.log('\n=== цвета обводки ===');
[...colorUse.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 12)
  .forEach(([color, count]) => console.log(`  ${color}: ${count}`));

console.log('\n=== только чёрные фигуры (несущая графика чертежа) ===');
const black = shapes.filter((shape) => shape.strokeColor === 'rgb(0,0,0)' || shape.strokeColor === '#000000');
console.log('  всего:', black.length);
const blackSpans = black.map((shape) => {
  const xs = shape.points.map((p) => p[0]);
  const ys = shape.points.map((p) => p[1]);
  return { span: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)), minX: Math.min(...xs), maxX: Math.max(...xs) };
});
console.log('  длина фигур:');
histogram(blackSpans.map((s) => s.span), [1, 2, 5, 10, 20, 50, 100, 300], 'пт');
const longBlack = blackSpans.filter((s) => s.span >= 20);
console.log('  длинных (>= 20 пт):', longBlack.length);
if (longBlack.length > 0) {
  console.log('  они лежат в полосе x от', Math.round(Math.min(...longBlack.map((s) => s.minX))), 'до', Math.round(Math.max(...longBlack.map((s) => s.maxX))));
}

console.log('\n=== примеры самых частых фигур (8 вершин) ===');
shapes
  .filter((shape) => shape.vertices === 8)
  .slice(0, 4)
  .forEach((shape, index) => {
    const xs = shape.points.map((p) => p[0]);
    const ys = shape.points.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    console.log(`  пример ${index + 1}: габарит ${w.toFixed(2)} x ${h.toFixed(2)} пт, цвет ${shape.strokeColor}, толщина линии ${shape.lineWidth.toFixed(2)}`);
    console.log('    точки:', shape.points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('  '));
  });

console.log('\n=== габариты фигур по числу вершин ===');
for (const vertices of [2, 4, 5, 8, 16]) {
  const group = shapes.filter((shape) => shape.vertices === vertices);
  if (group.length === 0) continue;
  const spans = group.map((shape) => {
    const xs = shape.points.map((p) => p[0]);
    const ys = shape.points.map((p) => p[1]);
    return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  });
  spans.sort((a, b) => a - b);
  const at = (q) => spans[Math.floor(spans.length * q)]?.toFixed(1);
  console.log(`  ${vertices} вершин (${group.length}): длина по четвертям ${at(0.25)} / ${at(0.5)} / ${at(0.75)} / ${at(0.95)} пт, максимум ${spans[spans.length - 1].toFixed(1)}`);
}

const text = await page.getTextContent();
const labels = text.items
  .filter((item) => typeof item.str === 'string' && item.str.trim() !== '' && Array.isArray(item.transform))
  .map((item) => ({ s: item.str.trim(), x: Math.round(item.transform[4]), y: Math.round(item.transform[5]) }));
console.log('\n=== текст ===', labels.length, 'непустых элементов');
labels.slice(0, 30).forEach((label) => console.log('  ', JSON.stringify(label.s.slice(0, 45)), '@', label.x, label.y));

await doc.destroy();
