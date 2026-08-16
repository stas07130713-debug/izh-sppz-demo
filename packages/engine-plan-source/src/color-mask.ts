/**
 * Поиск цветных точек и работа с масками.
 *
 * Почему простого «убрать насыщенное» недостаточно. При выводе плана в
 * изображение края всех линий сглаживаются: вокруг зелёной стрелки остаётся
 * кайма из бледно-зелёных точек, у которых насыщенность почти нулевая. Убрав
 * только ярко-зелёное, получаем призрак стрелки из этой каймы. Поэтому маска
 * цветного расширяется на несколько точек наружу.
 *
 * Второе: насыщенность считается относительной, а не абсолютной. У бледной
 * заливки разброс каналов невелик, но по отношению к её собственной яркости он
 * заметен — так бледно-зелёная зона отличается от серой штриховки.
 */

/** Ярче этого считается фоном, а не рисунком. */
export const INK_LEVEL = 240;

export interface ColorMaskOptions {
  /** Относительная насыщенность, от 0 до 1. Меньше — убирается больше. */
  readonly saturationThreshold: number;
  /** На сколько точек расширить маску, чтобы снять кайму сглаживания. */
  readonly haloRadiusPx: number;
}

/**
 * Цветная ли точка.
 *
 * Порог по разбросу каналов нужен, чтобы шум сжатия на почти чёрных линиях не
 * принимался за цвет.
 */
export function isColoredPixel(r: number, g: number, b: number, saturationThreshold: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  if (chroma < 8) return false;
  if (max === 0) return false;
  return chroma / max >= saturationThreshold;
}

/** Яркость. Используется, чтобы отличить рисунок от белого фона. */
export function luminanceOf(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Маска цветных точек: 1 — цветная. */
export function buildColorMask(
  data: Uint8ClampedArray,
  saturationThreshold: number,
): Uint8Array {
  const mask = new Uint8Array(data.length / 4);
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const index = pixel * 4;
    if (isColoredPixel(data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0, saturationThreshold)) {
      mask[pixel] = 1;
    }
  }
  return mask;
}

/** Маска рисунка: 1 — точка не белая, то есть на ней что-то нарисовано. */
export function buildInkMask(data: Uint8ClampedArray): Uint8Array {
  const mask = new Uint8Array(data.length / 4);
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const index = pixel * 4;
    const luminance = luminanceOf(data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0);
    if (luminance < INK_LEVEL) mask[pixel] = 1;
  }
  return mask;
}

/**
 * Расширяет маску на заданное число точек.
 *
 * Выполняется как два прохода — по строкам и по столбцам, — иначе на больших
 * изображениях с радиусом в несколько точек это работало бы недопустимо долго.
 */
export function dilateMask(
  mask: Uint8Array,
  widthPx: number,
  heightPx: number,
  radiusPx: number,
): Uint8Array {
  if (radiusPx < 1) return mask;

  const horizontal = new Uint8Array(mask.length);
  for (let row = 0; row < heightPx; row += 1) {
    const rowStart = row * widthPx;
    for (let column = 0; column < widthPx; column += 1) {
      if (mask[rowStart + column] !== 1) continue;
      const from = Math.max(0, column - radiusPx);
      const to = Math.min(widthPx - 1, column + radiusPx);
      for (let x = from; x <= to; x += 1) horizontal[rowStart + x] = 1;
    }
  }

  const result = new Uint8Array(mask.length);
  for (let column = 0; column < widthPx; column += 1) {
    for (let row = 0; row < heightPx; row += 1) {
      if (horizontal[row * widthPx + column] !== 1) continue;
      const from = Math.max(0, row - radiusPx);
      const to = Math.min(heightPx - 1, row + radiusPx);
      for (let y = from; y <= to; y += 1) result[y * widthPx + column] = 1;
    }
  }

  return result;
}
