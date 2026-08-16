/**
 * Матрицы преобразования PDF.
 *
 * Внутри PDF координаты записаны в своей системе, а к странице их приводит
 * цепочка матриц. Без этого разбор чертежа даёт бессмысленные числа: у файла
 * заказчика собственные координаты доходят до 14173 при странице в 1701 пункт.
 *
 * Матрица PDF — это шесть чисел [a b c d e f], означающих
 *   x' = a·x + c·y + e
 *   y' = b·x + d·y + f
 */

export type Matrix = readonly [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** Произведение матриц: сначала применяется inner, затем outer. */
export function multiply(outer: Matrix, inner: Matrix): Matrix {
  return [
    outer[0] * inner[0] + outer[2] * inner[1],
    outer[1] * inner[0] + outer[3] * inner[1],
    outer[0] * inner[2] + outer[2] * inner[3],
    outer[1] * inner[2] + outer[3] * inner[3],
    outer[0] * inner[4] + outer[2] * inner[5] + outer[4],
    outer[1] * inner[4] + outer[3] * inner[5] + outer[5],
  ];
}

export function applyToPoint(matrix: Matrix, x: number, y: number): { x: number; y: number } {
  return {
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5],
  };
}

/**
 * Средний масштаб матрицы.
 *
 * Нужен, чтобы перевести толщину линии из внутренних единиц в пункты страницы:
 * толщина задаётся до преобразования, а сравнивать её надо после.
 */
export function averageScale(matrix: Matrix): number {
  return (Math.hypot(matrix[0], matrix[1]) + Math.hypot(matrix[2], matrix[3])) / 2;
}
