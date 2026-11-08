/**
 * Схема расположения огнетушителей для приложения к справке.
 *
 * В документах заказчика это «Приложение 1. Схема расположения огнетушителей» —
 * план с кругами радиуса нормы. Программа рисует ту же схему: подложка этажа,
 * обводки помещений, круги покрытия и значки огнетушителей с марками.
 *
 * Схема собирается в растр, а не в SVG. Word показывает векторную разметку не
 * во всех версиях, и справка, у которой в половине случаев нет приложения, —
 * это не справка. Растр открывается везде одинаково.
 *
 * Заказчик (пункт 1 перечня доработок): «во всех экспортируемых документах
 * использовать те же значки… не создавать для Word/PDF отдельные упрощённые
 * или автоматически генерируемые значки… круги должны отображаться со
 * штриховкой в том же виде, в котором они отображаются на плане в программе».
 *
 * Так и было: здесь рисовался **красный квадрат** вместо переданного заказчиком
 * знака и **синий пунктирный круг без всякой штриховки** вместо оранжевого
 * заштрихованного. Один и тот же огнетушитель на экране и в справке выглядел
 * по-разному, и схему приходилось читать заново.
 *
 * Теперь источник один и тот же, что у экрана: знак — `elementIconSource`,
 * вид круга — `coverage-style.ts`. Отличие осталось только в способе рисования:
 * экран — разметка, здесь — холст.
 */

import type { PixelPoint } from '@izh/contracts';
import { VERDICT_COLOR, type CoverageCircle, type CoverageLayer } from './plan-coverage';
import { elementIconFallback, elementIconSource } from './element-icon-source';
import {
  COVERAGE_COLOR, COVERAGE_DASH, COVERAGE_STROKE_OPACITY_UNCOUNTED, COVERAGE_STROKE_WIDTH_PX,
  COVERAGE_HALO_COLOR, COVERAGE_HALO_OPACITY, COVERAGE_HALO_WIDTH_PX,
  GAP_COLOR, GAP_OPACITY, GAP_RADIUS_PX, PLAN_ICON_PX, ROOM_FILL_OPACITY, ROOM_STROKE_WIDTH_PX,
  coverageHatch,
} from './coverage-style';

/** Огнетушитель на схеме: точка, вид и марка, которую подписывают рядом. */
export interface SchemeMark {
  readonly position: PixelPoint;
  /** Вид элемента: по нему берётся тот же значок, что на плане. */
  readonly typeCode: string;
  readonly mark: string;
}

export interface SchemeInput {
  /** Подложка этажа. null — схема рисуется по белому полю. */
  readonly imageUrl: string | null;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly layer: CoverageLayer;
  readonly marks: readonly SchemeMark[];
}

/** Больше этого схему не рисуем: лист всё равно меньше, а память не резиновая. */
const MAX_SIDE = 2600;

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** Картинки всех видов, встреченных на схеме, — по одной загрузке на вид. */
async function loadIcons(marks: readonly SchemeMark[]): Promise<ReadonlyMap<string, HTMLImageElement>> {
  const types = [...new Set(marks.map((item) => item.typeCode))];
  const loaded = new Map<string, HTMLImageElement>();

  await Promise.all(types.map(async (typeCode) => {
    const source = elementIconSource(typeCode);
    if (source === null) return;
    const image = await loadImage(source);
    if (image !== null) loaded.set(typeCode, image);
  }));

  return loaded;
}

function drawRooms(context: CanvasRenderingContext2D, layer: CoverageLayer): void {
  for (const room of layer.rooms) {
    if (room.points.length < 3) continue;

    context.beginPath();
    for (const [index, point] of room.points.entries()) {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    }
    context.closePath();

    const color = VERDICT_COLOR[room.verdict];
    context.fillStyle = color;
    context.globalAlpha = ROOM_FILL_OPACITY;
    context.fill();
    context.globalAlpha = 1;
    context.strokeStyle = color;
    context.lineWidth = ROOM_STROKE_WIDTH_PX;
    context.stroke();
  }
}

/**
 * Штриховка круга — тем же узором, что на экране.
 *
 * На экране это `<pattern>` с одной наклонной линией; на холсте — маленькая
 * картинка-плитка и поворот на те же 45 градусов. Шаг, толщина и прозрачность
 * взяты из общего описания, а не подобраны на глаз.
 */
function hatchPattern(context: CanvasRenderingContext2D, counted: boolean): CanvasPattern | null {
  const hatch = coverageHatch(counted);
  const tile = document.createElement('canvas');
  tile.width = hatch.stepPx;
  tile.height = hatch.stepPx;

  const paint = tile.getContext('2d');
  if (paint === null) return null;

  paint.strokeStyle = COVERAGE_COLOR;
  paint.globalAlpha = hatch.opacity;
  paint.lineWidth = hatch.widthPx;
  paint.beginPath();
  paint.moveTo(0, 0);
  paint.lineTo(0, hatch.stepPx);
  paint.stroke();

  const pattern = context.createPattern(tile, 'repeat');
  if (pattern === null) return null;
  pattern.setTransform(new DOMMatrix().rotate(45));
  return pattern;
}

function drawCircle(context: CanvasRenderingContext2D, circle: CoverageCircle): void {
  context.beginPath();
  context.arc(circle.x, circle.y, circle.radiusPx, 0, Math.PI * 2);

  /*
   * Круг заштрихован целиком, а не только внутри обведённых помещений.
   *
   * Заказчик: «нужно, чтобы круги имели штриховку». Обрезка по обводкам была
   * моим решением, и на этажах без обведённых помещений — а таких у него
   * большинство — от круга оставалась одна дуга. На бумажных схемах в
   * справках зона обслуживания огнетушителя — заштрихованный круг, и обводки
   * помещений тут ни при чём.
   *
   * Схема в справке и экран рисуются по одному описанию (coverage-style.ts) и
   * по одному правилу: разойтись им нельзя.
   */
  const fill = hatchPattern(context, circle.counted);
  if (fill !== null) {
    context.beginPath();
    context.arc(circle.x, circle.y, circle.radiusPx, 0, Math.PI * 2);
    context.fillStyle = fill;
    context.fill();
  }

  context.beginPath();
  context.arc(circle.x, circle.y, circle.radiusPx, 0, Math.PI * 2);
  context.strokeStyle = COVERAGE_HALO_COLOR;
  context.lineWidth = COVERAGE_HALO_WIDTH_PX;
  context.globalAlpha = COVERAGE_HALO_OPACITY;
  context.setLineDash(circle.counted ? [] : [...COVERAGE_DASH]);
  context.stroke();

  context.beginPath();
  context.arc(circle.x, circle.y, circle.radiusPx, 0, Math.PI * 2);
  context.strokeStyle = COVERAGE_COLOR;
  context.lineWidth = COVERAGE_STROKE_WIDTH_PX;
  context.globalAlpha = circle.counted ? 1 : COVERAGE_STROKE_OPACITY_UNCOUNTED;
  context.setLineDash(circle.counted ? [] : [...COVERAGE_DASH]);
  context.stroke();
  context.setLineDash([]);
  context.globalAlpha = 1;
}

function drawCircles(context: CanvasRenderingContext2D, layer: CoverageLayer): void {
  for (const circle of layer.circles) drawCircle(context, circle);

  // Непокрытые места — то, чего на бумажной схеме нет и о чём спорят дольше
  // всего: видно не только «не хватает», но и где именно.
  context.fillStyle = GAP_COLOR;
  context.globalAlpha = GAP_OPACITY;
  for (const gap of layer.gaps) {
    context.beginPath();
    context.arc(gap.x, gap.y, GAP_RADIUS_PX, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

/** Знак вида: картинка, а нет её — буквенная пометка, как и на экране. */
function drawIcon(
  context: CanvasRenderingContext2D,
  item: SchemeMark,
  icons: ReadonlyMap<string, HTMLImageElement>,
): void {
  const { x, y } = item.position;
  const half = PLAN_ICON_PX / 2;
  const image = icons.get(item.typeCode);

  if (image !== undefined) {
    context.drawImage(image, x - half, y - half, PLAN_ICON_PX, PLAN_ICON_PX);
    return;
  }

  const fallback = elementIconFallback(item.typeCode);
  context.fillStyle = fallback.color;
  context.fillRect(x - half, y - half, PLAN_ICON_PX, PLAN_ICON_PX);
  context.fillStyle = '#ffffff';
  context.font = '700 12px "Segoe UI", Arial, sans-serif';
  context.textAlign = 'center';
  context.fillText(fallback.mark, x, y + 4);
  context.textAlign = 'left';
}

function drawMarks(
  context: CanvasRenderingContext2D,
  marks: readonly SchemeMark[],
  icons: ReadonlyMap<string, HTMLImageElement>,
): void {
  context.font = '600 13px "Segoe UI", Arial, sans-serif';
  context.textBaseline = 'middle';

  for (const item of marks) {
    drawIcon(context, item, icons);

    // Подпись на белой подложке: на тёмном чертеже её иначе не прочесть.
    const { x, y } = item.position;
    const width = context.measureText(item.mark).width;
    context.fillStyle = 'rgba(255,255,255,.85)';
    context.fillRect(x + PLAN_ICON_PX / 2 + 2, y - 9, width + 6, 18);
    context.fillStyle = '#111827';
    context.fillText(item.mark, x + PLAN_ICON_PX / 2 + 5, y);
  }
}

/**
 * Рисует схему и возвращает её ссылкой `data:image/png`.
 *
 * `null` — рисовать не на чем: нет ни подложки, ни размеров.
 */
export async function renderPlacementScheme(input: SchemeInput): Promise<string | null> {
  if (input.widthPx <= 0 || input.heightPx <= 0) return null;

  const scale = Math.min(1, MAX_SIDE / Math.max(input.widthPx, input.heightPx));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(input.widthPx * scale);
  canvas.height = Math.round(input.heightPx * scale);

  const context = canvas.getContext('2d');
  if (context === null) return null;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(scale, scale);

  if (input.imageUrl !== null) {
    const image = await loadImage(input.imageUrl);
    if (image !== null) context.drawImage(image, 0, 0, input.widthPx, input.heightPx);
  }

  // Значки грузятся до рисования: рисовать их по мере загрузки значило бы
  // класть часть знаков поверх подписей, а часть под них.
  const icons = await loadIcons(input.marks);

  drawRooms(context, input.layer);
  drawCircles(context, input.layer);
  drawMarks(context, input.marks, icons);

  return canvas.toDataURL('image/png');
}
