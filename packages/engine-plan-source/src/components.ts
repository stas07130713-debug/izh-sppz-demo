/**
 * Прорастание удаления по рисунку — со стенами, которые трогать нельзя.
 *
 * Значок огнетушителя на плане эвакуации — это красная заливка в чёрной рамке.
 * Убрав только красное, получаем пустую чёрную рамку: по цвету обводка от стены
 * не отличается. Поэтому удаление прорастает от цветных точек в соседний
 * рисунок и снимает обводку.
 *
 * И тут возникала главная беда: значок примыкает к стене, прорастание уходит
 * вдоль неё, и вместе со значком пропадает кусок стены. Ограничение числа шагов
 * только уменьшало ущерб, но не убирало его.
 *
 * Настоящее решение — маска стен из wall-guard.ts. Стена отличается от обводки
 * значка не цветом и не связностью, а тем, что она длинная и имеет продолжение
 * в обе стороны. Такие точки помечаются заранее, и удаление через них не идёт:
 * значок уходит, стена остаётся целой, включая закрытый значком кусок.
 */

export interface ComponentSummary {
  readonly sizePx: number;
  /** Доля площади всего изображения. */
  readonly share: number;
}

/** Можно ли занимать точку: не стена и ещё не занята. */
function isPassable(
  pixel: number,
  inkMask: Uint8Array,
  guard: Uint8Array | undefined,
): boolean {
  if (inkMask[pixel] !== 1) return false;
  return guard === undefined || guard[pixel] !== 1;
}

/**
 * Прорастание по рисунку от уже отмеченных точек.
 *
 * Обход в ширину: сначала все точки на расстоянии одного шага, затем двух и так
 * далее, пока не кончатся шаги. Изменяет переданную маску на месте.
 */
export function growIntoInk(
  removalMask: Uint8Array,
  inkMask: Uint8Array,
  widthPx: number,
  heightPx: number,
  steps: number,
  guard?: Uint8Array,
): Uint8Array {
  if (steps < 1) return removalMask;

  let frontier: number[] = [];
  for (let pixel = 0; pixel < removalMask.length; pixel += 1) {
    if (removalMask[pixel] === 1) frontier.push(pixel);
  }

  for (let step = 0; step < steps && frontier.length > 0; step += 1) {
    const next: number[] = [];

    for (const pixel of frontier) {
      const column = pixel % widthPx;
      const row = (pixel - column) / widthPx;

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = column + dx;
          const ny = row + dy;
          if (nx < 0 || ny < 0 || nx >= widthPx || ny >= heightPx) continue;

          const neighbour = ny * widthPx + nx;
          if (removalMask[neighbour] === 1) continue;
          // Через стену прорастание не идёт.
          if (!isPassable(neighbour, inkMask, guard)) continue;

          removalMask[neighbour] = 1;
          next.push(neighbour);
        }
      }
    }

    frontier = next;
  }

  return removalMask;
}

/**
 * Обходит связную фигуру от заданной точки, не удаляясь дальше указанного
 * расстояния и не переходя через стены.
 */
function collectComponent(
  inkMask: Uint8Array,
  widthPx: number,
  heightPx: number,
  start: number,
  maxRadiusPx: number,
  limit: number,
  guard?: Uint8Array,
): number[] {
  if (!isPassable(start, inkMask, guard)) return [];

  const startColumn = start % widthPx;
  const startRow = (start - startColumn) / widthPx;

  const visited = new Uint8Array(inkMask.length);
  const stack = [start];
  visited[start] = 1;
  const found: number[] = [];

  while (stack.length > 0) {
    const pixel = stack.pop();
    if (pixel === undefined) break;

    found.push(pixel);
    if (found.length > limit) return found;

    const column = pixel % widthPx;
    const row = (pixel - column) / widthPx;

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = column + dx;
        const ny = row + dy;
        if (nx < 0 || ny < 0 || nx >= widthPx || ny >= heightPx) continue;
        if (Math.abs(nx - startColumn) > maxRadiusPx || Math.abs(ny - startRow) > maxRadiusPx) continue;

        const neighbour = ny * widthPx + nx;
        if (visited[neighbour] === 1) continue;
        if (!isPassable(neighbour, inkMask, guard)) continue;

        visited[neighbour] = 1;
        stack.push(neighbour);
      }
    }
  }

  return found;
}

/** Размер фигуры под точкой — чтобы предупредить пользователя до удаления. */
export function measureComponentAt(
  inkMask: Uint8Array,
  widthPx: number,
  heightPx: number,
  pixel: number,
  maxRadiusPx: number,
  guard?: Uint8Array,
): ComponentSummary | null {
  const totalPixels = widthPx * heightPx;
  if (pixel < 0 || pixel >= totalPixels) return null;
  if (!isPassable(pixel, inkMask, guard)) return null;

  const found = collectComponent(inkMask, widthPx, heightPx, pixel, maxRadiusPx, totalPixels, guard);
  return { sizePx: found.length, share: found.length / totalPixels };
}

/** Помечает в маске удаления фигуру, на которую указал пользователь. */
export function addComponentAt(
  removalMask: Uint8Array,
  inkMask: Uint8Array,
  widthPx: number,
  heightPx: number,
  pixel: number,
  maxShare: number,
  maxRadiusPx: number,
  guard?: Uint8Array,
): Uint8Array {
  const totalPixels = widthPx * heightPx;
  if (pixel < 0 || pixel >= totalPixels) return removalMask;
  if (!isPassable(pixel, inkMask, guard)) return removalMask;

  const limit = Math.max(1, Math.floor(totalPixels * maxShare));
  const found = collectComponent(inkMask, widthPx, heightPx, pixel, maxRadiusPx, limit, guard);

  // Слишком крупная фигура — это стены. Молча ничего не делаем: предупреждение
  // пользователь получает в интерфейсе ещё до добавления действия.
  if (found.length > limit) return removalMask;

  for (const item of found) removalMask[item] = 1;
  return removalMask;
}
