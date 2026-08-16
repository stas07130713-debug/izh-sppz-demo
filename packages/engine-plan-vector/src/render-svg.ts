/**
 * Отрисовка планировки.
 *
 * Строит SVG: векторную графику, которая не мылится при увеличении и весит
 * килобайты вместо мегабайтов. Это и есть «нормальный формат», в который
 * перерисовывается план.
 *
 * Чистая функция без зависимостей: на вход данные, на выход строка.
 */

import type { DrawnElement, DrawnElementKind, PlanDrawing } from '@izh/contracts';

export interface RenderOptions {
  /** Подпись схемы. Собирается из дерева объекта, а не хранится на плане. */
  readonly caption: string | null;
  /** Показывать элементы, добавленные человеком, другим цветом. */
  readonly highlightManual: boolean;
}

/** Как рисуется каждый вид элемента. Один стиль на всю программу. */
const STYLES: Record<DrawnElementKind, { stroke: string; width: number; dash?: string }> = {
  wall: { stroke: '#111827', width: 0 },
  partition: { stroke: '#374151', width: 1.2 },
  window: { stroke: '#0ea5e9', width: 1.6 },
  door: { stroke: '#a16207', width: 1.2 },
  stairs: { stroke: '#4b5563', width: 1.2 },
  opening: { stroke: '#9ca3af', width: 1.2, dash: '6 4' },
  line: { stroke: '#9ca3af', width: 0.6 },
};

const MANUAL_STROKE = '#16a34a';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function round(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}

function renderElement(element: DrawnElement, options: RenderOptions): string {
  const style = STYLES[element.kind];
  const stroke = options.highlightManual && element.manual ? MANUAL_STROKE : style.stroke;
  // У стены толщина — это её настоящая толщина по чертежу, а не толщина пера.
  const width = element.thickness > 0 ? element.thickness : style.width;
  const dash = style.dash === undefined ? '' : ` stroke-dasharray="${style.dash}"`;

  return (
    `<line x1="${round(element.a.x)}" y1="${round(element.a.y)}"` +
    ` x2="${round(element.b.x)}" y2="${round(element.b.y)}"` +
    ` stroke="${stroke}" stroke-width="${round(width)}" stroke-linecap="butt"${dash} />`
  );
}

/**
 * Переворот по вертикали.
 *
 * В PDF ось Y направлена вверх, в SVG — вниз. Без переворота планировка
 * оказалась бы зеркальной.
 */
export function renderPlanSvg(drawing: PlanDrawing, options: RenderOptions): string {
  const { area } = drawing;
  const captionHeight = options.caption === null ? 0 : 26;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(area.width)} ${round(area.height + captionHeight)}"` +
      ` width="${round(area.width)}" height="${round(area.height + captionHeight)}">`,
  );
  parts.push('<rect width="100%" height="100%" fill="#ffffff" />');
  parts.push(
    `<g transform="translate(${round(-area.x)} ${round(area.y + area.height)}) scale(1 -1)">`,
  );

  for (const element of drawing.elements) {
    parts.push(renderElement(element, options));
  }

  parts.push('</g>');

  for (const label of drawing.labels) {
    const x = label.at.x - area.x;
    const y = area.y + area.height - label.at.y;
    parts.push(
      `<text x="${round(x)}" y="${round(y)}" font-family="sans-serif" font-size="7" fill="#111827">` +
        `${escapeXml(label.text)}</text>`,
    );
  }

  if (options.caption !== null) {
    parts.push(
      `<text x="4" y="${round(area.height + 18)}" font-family="sans-serif" font-size="13" fill="#111827">` +
        `${escapeXml(options.caption)}</text>`,
    );
  }

  parts.push('</svg>');
  return parts.join('\n');
}
