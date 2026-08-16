/**
 * Прорастание удаления по рисунку.
 *
 * Значок огнетушителя на плане эвакуации — это красная заливка в чёрной рамке.
 * Убрав только красное, получаем пустую чёрную рамку: по цвету обводка от стены
 * не отличается. Поэтому удаление прорастает от цветных точек в соседний
 * рисунок и снимает обводку.
 *
 * Прорастание обязательно ограничено числом шагов. Ранняя попытка убирать
 * связную фигуру целиком приводила к тому, что стрелка, коснувшаяся стены,
 * утаскивала за собой всю стену: они образуют одну связную фигуру. С
 * ограничением стена теряет лишь несколько точек в месте касания.
 */

export interface ComponentSummary {
  readonly sizePx: number;
  /** Доля площади всего изображения. */
  readonly share: number;
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
          if (inkMask[neighbour] === 1 && removalMask[neighbour] === 0) {
            removalMask[neighbour] = 1;
            next.push(neighbour);
          }
        }
      }
    }

    frontier = next;
  }

  return removalMask;
}

/**
 * Обходит связную фигуру от заданной точки, не удаляясь дальше указанного
 * расстояния. Возвращает найденные точки.
 *
 * Ограничение по расстоянию защищает от случая, когда значок касается стены:
 * без него один щелчок снёс бы полчертежа.
 */
function collectComponent(
  inkMask: Uint8Array,
  widthPx: number,
  heightPx: number,
  start: number,
  maxRadiusPx: number,
  limit: number,
): number[] {
  if (inkMask[start] !== 1) return [];

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
        if (inkMask[neighbour] === 1 && visited[neighbour] === 0) {
          visited[neighbour] = 1;
          stack.push(neighbour);
        }
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
): ComponentSummary | null {
  const totalPixels = widthPx * heightPx;
  if (pixel < 0 || pixel >= totalPixels) return null;
  if (inkMask[pixel] !== 1) return null;

  const found = collectComponent(inkMask, widthPx, heightPx, pixel, maxRadiusPx, totalPixels);
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
): Uint8Array {
  const totalPixels = widthPx * heightPx;
  if (pixel < 0 || pixel >= totalPixels || inkMask[pixel] !== 1) return removalMask;

  const limit = Math.max(1, Math.floor(totalPixels * maxShare));
  const found = collectComponent(inkMask, widthPx, heightPx, pixel, maxRadiusPx, limit);

  // Слишком крупная фигура — это стены. Молча ничего не делаем: предупреждение
  // пользователь получает в интерфейсе ещё до добавления действия.
  if (found.length > limit) return removalMask;

  for (const item of found) removalMask[item] = 1;
  return removalMask;
}
