/**
 * Отрисовка цифрового плана. Пункт 18 ТЗ.
 *
 * Исходная графика не копируется как подложка: объекты рисуются заново из
 * библиотеки стандартных элементов. Благодаря этому чертежи разного качества
 * превращаются в единый цифровой вид.
 *
 * Пункт 13 ТЗ требует показывать сомнительные объекты. Поэтому предусмотрен
 * режим, где уверенность видна цветом: так пользователь сразу видит, что
 * проверять, а не ищет расхождения на глаз.
 *
 * Группы SVG заданы пунктом 13 документа об архитектурной подложке: walls,
 * doors, windows, stairs, columns.
 */

import type { ElementKind, PlanElement, PlanModel } from '../model/plan-model.js';

export interface RenderOptions {
  /** Подпись схемы. Собирается из дерева объекта основной программой. */
  readonly caption: string | null;
  /** Красить по уверенности распознавания вместо обычного вида. */
  readonly showConfidence: boolean;
  /** Ниже этой уверенности объект считается сомнительным. */
  readonly reviewThreshold: number;
}

export const DEFAULT_RENDER: RenderOptions = {
  caption: null,
  showConfidence: false,
  reviewThreshold: 0.5,
};

/** В какую группу SVG попадает вид объекта. */
function groupOf(kind: ElementKind): string {
  if (kind === 'WALL_EXT' || kind === 'WALL_INT' || kind === 'PARTITION') return 'walls';
  if (kind.startsWith('DOOR')) return 'doors';
  if (kind === 'WINDOW' || kind === 'OPENING') return 'windows';
  if (kind === 'STAIR' || kind === 'STAIR_FLIGHT' || kind === 'STAIRCASE') return 'stairs';
  if (kind === 'COLUMN' || kind === 'SHAFT' || kind === 'ELEVATOR') return 'columns';
  return 'other';
}

const GROUP_ORDER = ['walls', 'doors', 'windows', 'stairs', 'columns', 'other'] as const;

/** Единый вид элементов: толщина пера и цвет для каждого вида. */
const STYLE: Record<string, { stroke: string; width: number; dash?: string }> = {
  WALL_EXT: { stroke: '#111827', width: 0 },
  WALL_INT: { stroke: '#1f2937', width: 0 },
  PARTITION: { stroke: '#4b5563', width: 1.2 },
  WINDOW: { stroke: '#0ea5e9', width: 1.6 },
  OPENING: { stroke: '#9ca3af', width: 1.2, dash: '6 4' },
  DOOR: { stroke: '#a16207', width: 1.4 },
  STAIR: { stroke: '#4b5563', width: 1.2 },
  COLUMN: { stroke: '#374151', width: 1.4 },
};

const FALLBACK_STYLE = { stroke: '#9ca3af', width: 0.8 };

/** Цвет по уверенности: зелёный — принято, жёлтый — проверить, красный — сомнительно. */
function confidenceColor(confidence: number, threshold: number): string {
  if (confidence >= 0.8) return '#16a34a';
  if (confidence >= threshold) return '#f59e0b';
  return '#dc2626';
}

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

function styleFor(kind: ElementKind): { stroke: string; width: number; dash?: string } {
  return STYLE[kind] ?? STYLE[kind.split('_')[0] ?? ''] ?? FALLBACK_STYLE;
}

function renderElement(element: PlanElement, options: RenderOptions): string {
  const base = styleFor(element.kind);
  const stroke = options.showConfidence
    ? confidenceColor(element.confidence, options.reviewThreshold)
    : base.stroke;
  const dash = base.dash === undefined ? '' : ` stroke-dasharray="${base.dash}"`;
  const title = `<title>${escapeXml(element.kind)} — уверенность ${element.confidence.toFixed(2)}</title>`;

  if (element.geometry === 'segment') {
    const width = element.thickness > 0 ? element.thickness : base.width;
    return (
      `<line x1="${round(element.segment.a.x)}" y1="${round(element.segment.a.y)}"` +
      ` x2="${round(element.segment.b.x)}" y2="${round(element.segment.b.y)}"` +
      ` stroke="${stroke}" stroke-width="${round(width)}" stroke-linecap="butt"${dash}>${title}</line>`
    );
  }

  const points = element.polygon.points.map((point) => `${round(point.x)},${round(point.y)}`).join(' ');
  return `<polygon points="${points}" fill="none" stroke="${stroke}" stroke-width="${round(base.width)}"${dash}>${title}</polygon>`;
}

export interface RenderedPlan {
  readonly svg: string;
  readonly widthPt: number;
  readonly heightPt: number;
  /** Сколько объектов требует проверки. Показывается рядом с планом. */
  readonly needsReview: number;
}

/**
 * Рисует этаж модели.
 *
 * Ось Y в исходных документах направлена вверх, в SVG — вниз, поэтому холст
 * переворачивается. Без этого план оказался бы зеркальным.
 */
export function renderFloorSvg(
  model: PlanModel,
  floorIndex: number,
  options: RenderOptions = DEFAULT_RENDER,
): RenderedPlan | null {
  const floor = model.building.floors[floorIndex];
  if (floor === undefined) return null;

  const area = model.source.area ?? { x: 0, y: 0, width: 1000, height: 1000 };
  const captionHeight = options.caption === null ? 0 : 26;
  const height = area.height + captionHeight;

  const byGroup = new Map<string, string[]>();
  let needsReview = 0;

  for (const element of floor.elements) {
    if (element.confidence < options.reviewThreshold) needsReview += 1;
    const group = groupOf(element.kind);
    const list = byGroup.get(group) ?? [];
    list.push(renderElement(element, options));
    byGroup.set(group, list);
  }

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(area.width)} ${round(height)}"` +
      ` width="${round(area.width)}" height="${round(height)}">`,
  );
  parts.push('<rect width="100%" height="100%" fill="#ffffff" />');
  parts.push(`<g transform="translate(${round(-area.x)} ${round(area.y + area.height)}) scale(1 -1)">`);

  for (const group of GROUP_ORDER) {
    const list = byGroup.get(group);
    if (list === undefined || list.length === 0) continue;
    parts.push(`<g id="${group}">`);
    parts.push(...list);
    parts.push('</g>');
  }

  parts.push('</g>');

  for (const room of floor.rooms) {
    if (room.number.trim() === '') continue;
    const centre = room.polygon.points.reduce(
      (sum, point) => ({ x: sum.x + point.x / room.polygon.points.length, y: sum.y + point.y / room.polygon.points.length }),
      { x: 0, y: 0 },
    );
    const x = centre.x - area.x;
    const y = area.y + area.height - centre.y;
    parts.push(
      `<text x="${round(x)}" y="${round(y)}" font-family="sans-serif" font-size="8" fill="#111827">${escapeXml(room.number)}</text>`,
    );
  }

  if (options.caption !== null) {
    parts.push(
      `<text x="4" y="${round(area.height + 18)}" font-family="sans-serif" font-size="13" fill="#111827">${escapeXml(options.caption)}</text>`,
    );
  }

  parts.push('</svg>');

  return { svg: parts.join('\n'), widthPt: area.width, heightPt: height, needsReview };
}
