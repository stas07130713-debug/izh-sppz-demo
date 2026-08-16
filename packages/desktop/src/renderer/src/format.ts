/** Форматирование чисел для показа пользователю. Русские единицы, разумная точность. */

export function formatMegapixels(value: number): string {
  return `${value.toFixed(1)} Мп`;
}

export function formatPixels(widthPx: number, heightPx: number): string {
  return `${widthPx} × ${heightPx} точек`;
}

/** Размеры страницы в пунктах PDF переводятся в миллиметры — так понятнее. */
export function formatPageSizeMm(widthPt: number, heightPt: number): string {
  const toMm = (pt: number): number => (pt / 72) * 25.4;
  return `${Math.round(toMm(widthPt))} × ${Math.round(toMm(heightPt))} мм`;
}

/** Масштаб показываем и как «метров в пикселе», и как привычное 1:N. */
export function formatScale(metersPerPixel: number, dpi: number | null): string {
  const perPixel = metersPerPixel < 0.01
    ? `${(metersPerPixel * 1000).toFixed(2)} мм`
    : `${(metersPerPixel * 100).toFixed(2)} см`;

  if (dpi === null) return `${perPixel} в одной точке`;

  const denominator = Math.round(metersPerPixel / (0.0254 / dpi));
  return `${perPixel} в одной точке — это примерно 1:${denominator}`;
}

export function formatBytes(count: number): string {
  if (count < 1024) return `${count} Б`;
  if (count < 1024 * 1024) return `${(count / 1024).toFixed(0)} КБ`;
  return `${(count / (1024 * 1024)).toFixed(1)} МБ`;
}

export function formatDateTime(isoUtc: string): string {
  const date = new Date(isoUtc);
  return date.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}
