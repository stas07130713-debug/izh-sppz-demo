/**
 * Опора для группового создания объектов правой кнопкой (ТЗ, часть 6.3).
 *
 * Здесь только чистые вычисления: список номеров по схеме нумерации, проверка
 * на уже занятые номера и расстановка точек по контуру помещения. Само
 * создание объектов — обычные вызовы `placeObject` в цикле со стороны
 * интерфейса; отдельного «пакетного» сценария в ядре нет, потому что каждый
 * объект и так проходит одну и ту же проверку, а собирать их в одну
 * транзакцию не даёт смысла: пользователь имеет право досмотреть партию до
 * половины и отменить остаток (эта часть — на интерфейсе).
 */

import type { PixelPoint, PlanObject } from '@izh/contracts';

export interface NumberingScheme {
  readonly prefix: string;
  readonly startNumber: number;
  readonly step: number;
}

/**
 * Список номеров по схеме: префикс + начальный номер + шаг.
 *
 * Пример из ТЗ: префикс «ОП-», начальный номер 15, шаг 1 → ОП-15, ОП-16, ОП-17.
 * Программа показывает этот список целиком до создания, а не после.
 */
export function generateRegNumbers(scheme: NumberingScheme, count: number): readonly string[] {
  if (count <= 0) return [];
  const numbers: string[] = [];
  const precision = Math.max(decimalPlaces(scheme.startNumber), decimalPlaces(scheme.step));
  for (let i = 0; i < count; i += 1) {
    numbers.push(`${scheme.prefix}${formatNumber(scheme.startNumber + i * scheme.step, precision)}`);
  }
  return numbers;
}

function decimalPlaces(value: number): number {
  const [, fraction = ''] = value.toString().split('.');
  return fraction.length;
}

function formatNumber(value: number, precision: number): string {
  if (precision === 0) return String(value);
  return value.toFixed(precision).replace(/\.?0+$/, '');
}

/**
 * Какие из предложенных номеров уже заняты.
 *
 * Область уникальности — организация: тот же номер в другом здании того же
 * предприятия тоже вводит в заблуждение при проверке. Выведенные из
 * эксплуатации объекты не в счёт — старый номер можно присвоить заново.
 */
export function duplicateRegNumbers(
  existing: readonly PlanObject[],
  siteId: string,
  candidates: readonly string[],
): readonly string[] {
  const taken = new Set(
    existing
      .filter((object) => object.siteId === siteId && object.archivedAt === null && object.regNumber !== null)
      .map((object) => object.regNumber),
  );
  return candidates.filter((candidate) => taken.has(candidate));
}

/**
 * Расставляет точки равномерно по периметру замкнутого контура.
 *
 * Так на планах эвакуации огнетушители стоят у стен: точки ложатся на
 * периметр, а не внутрь площади помещения. Расстановка приблизительная и
 * рассчитана на ручную правку — то же самое прямо оговаривает ТЗ («с
 * последующим ручным исправлением»).
 */
export function distributeAlongOutline(outline: readonly PixelPoint[], count: number): readonly PixelPoint[] {
  if (count <= 0 || outline.length < 3) return [];

  const edges: { readonly from: PixelPoint; readonly to: PixelPoint; readonly length: number }[] = [];
  let perimeter = 0;
  for (let i = 0; i < outline.length; i += 1) {
    const from = outline[i];
    const to = outline[(i + 1) % outline.length];
    if (from === undefined || to === undefined) continue;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    edges.push({ from, to, length });
    perimeter += length;
  }
  if (perimeter === 0) return outline.slice(0, count);

  const points: PixelPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    let target = (perimeter * i) / count;
    let placed = false;
    for (const edge of edges) {
      if (target <= edge.length) {
        const fraction = edge.length === 0 ? 0 : target / edge.length;
        points.push({
          x: Math.round(edge.from.x + (edge.to.x - edge.from.x) * fraction),
          y: Math.round(edge.from.y + (edge.to.y - edge.from.y) * fraction),
        });
        placed = true;
        break;
      }
      target -= edge.length;
    }
    // Накопленная погрешность округления в редком случае может не попасть ни
    // в один отрезок — тогда точка ставится в последнюю известную вершину,
    // а не теряется молча.
    if (!placed) {
      const last = edges[edges.length - 1];
      if (last !== undefined) points.push(last.to);
    }
  }
  return points;
}
