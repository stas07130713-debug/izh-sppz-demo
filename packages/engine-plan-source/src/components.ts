/**
 * Связные фигуры на плане.
 *
 * Значок огнетушителя на плане эвакуации — это красная заливка в чёрной рамке.
 * Убрав только красное, получаем пустую чёрную рамку: по цвету обводка от стены
 * не отличается. Поэтому фигура рассматривается целиком: если связный кусок
 * рисунка в основном цветной и невелик по площади, он убирается полностью,
 * вместе с обводкой и подписью, которая к нему прилипла.
 *
 * Стены при этом защищены размером: они образуют одну огромную связную фигуру
 * на весь чертёж, которая заведомо больше допустимой доли площади.
 */

/** Выше этого числа точек разбор фигур не выполняется: слишком дорого по памяти. */
export const MAX_PIXELS_FOR_COMPONENTS = 30_000_000;

export interface ComponentSummary {
  readonly sizePx: number;
  /** Доля площади всего изображения. */
  readonly share: number;
}

/**
 * Обходит связную фигуру от заданной точки и вызывает visit для каждой её точки.
 *
 * Обход итеративный, со своим стеком: рекурсия на фигуре в миллион точек
 * переполнила бы стек вызовов.
 */
function walkComponent(
  inkMask: Uint8Array,
  visited: Uint8Array,
  widthPx: number,
  heightPx: number,
  start: number,
  visit: (pixel: number) => void,
): number {
  if (inkMask[start] !== 1 || visited[start] === 1) return 0;

  const stack = [start];
  visited[start] = 1;
  let size = 0;

  while (stack.length > 0) {
    const pixel = stack.pop();
    if (pixel === undefined) break;

    visit(pixel);
    size += 1;

    const column = pixel % widthPx;
    const row = (pixel - column) / widthPx;

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = column + dx;
        const ny = row + dy;
        if (nx < 0 || ny < 0 || nx >= widthPx || ny >= heightPx) continue;

        const neighbour = ny * widthPx + nx;
        if (inkMask[neighbour] === 1 && visited[neighbour] === 0) {
          visited[neighbour] = 1;
          stack.push(neighbour);
        }
      }
    }
  }

  return size;
}

export interface WholeSymbolOptions {
  /** Какая доля точек фигуры должна быть цветной, чтобы убрать её целиком. */
  readonly minColoredShare: number;
  /** Фигуры крупнее этой доли площади считаются зданием и не трогаются. */
  readonly maxSymbolShare: number;
}

/**
 * Дополняет маску удаления целыми фигурами, которые в основном состоят из
 * цветного. Изменяет переданную маску на месте и возвращает её же.
 */
export function addWholeColoredSymbols(
  removalMask: Uint8Array,
  inkMask: Uint8Array,
  colorMask: Uint8Array,
  widthPx: number,
  heightPx: number,
  options: WholeSymbolOptions,
): Uint8Array {
  const totalPixels = widthPx * heightPx;
  if (totalPixels > MAX_PIXELS_FOR_COMPONENTS) return removalMask;

  const visited = new Uint8Array(totalPixels);
  const maxSize = Math.max(1, Math.floor(totalPixels * options.maxSymbolShare));

  for (let start = 0; start < totalPixels; start += 1) {
    if (inkMask[start] !== 1 || visited[start] === 1) continue;

    const pixels: number[] = [];
    let colored = 0;

    walkComponent(inkMask, visited, widthPx, heightPx, start, (pixel) => {
      // Крупные фигуры не запоминаем целиком: это стены, они всё равно останутся.
      if (pixels.length <= maxSize) pixels.push(pixel);
      if (colorMask[pixel] === 1) colored += 1;
    });

    if (pixels.length > maxSize) continue;
    if (colored / pixels.length < options.minColoredShare) continue;

    for (const pixel of pixels) removalMask[pixel] = 1;
  }

  return removalMask;
}

/** Сведения о фигуре под указанной точкой. Нужно, чтобы предупредить пользователя
 *  до того, как он щелчком снесёт полчертежа. */
export function measureComponentAt(
  inkMask: Uint8Array,
  widthPx: number,
  heightPx: number,
  pixel: number,
): ComponentSummary | null {
  const totalPixels = widthPx * heightPx;
  if (pixel < 0 || pixel >= totalPixels) return null;
  if (inkMask[pixel] !== 1) return null;

  const visited = new Uint8Array(totalPixels);
  const size = walkComponent(inkMask, visited, widthPx, heightPx, pixel, () => undefined);
  return { sizePx: size, share: size / totalPixels };
}

/** Помечает в маске удаления фигуру, на которую указал пользователь. */
export function addComponentAt(
  removalMask: Uint8Array,
  inkMask: Uint8Array,
  widthPx: number,
  heightPx: number,
  pixel: number,
  maxShare: number,
): Uint8Array {
  const totalPixels = widthPx * heightPx;
  if (pixel < 0 || pixel >= totalPixels || inkMask[pixel] !== 1) return removalMask;

  const visited = new Uint8Array(totalPixels);
  const pixels: number[] = [];
  const maxSize = Math.max(1, Math.floor(totalPixels * maxShare));

  walkComponent(inkMask, visited, widthPx, heightPx, pixel, (found) => {
    if (pixels.length <= maxSize) pixels.push(found);
  });

  // Слишком крупная фигура — это стены. Молча ничего не делаем: предупреждение
  // пользователь получает в интерфейсе ещё до добавления действия.
  if (pixels.length > maxSize) return removalMask;

  for (const found of pixels) removalMask[found] = 1;
  return removalMask;
}
