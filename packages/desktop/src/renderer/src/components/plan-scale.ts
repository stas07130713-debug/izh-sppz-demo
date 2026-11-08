/**
 * Масштаб плана в привычной записи: «М 1:200».
 *
 * Отношение считается по тому размеру, в котором план показан сейчас. Иначе
 * его не посчитать вовсе: подложка — растр, и своего физического размера у неё
 * нет. Есть только «метров в точке чертежа» и то, какой ширины эта картинка
 * оказалась на экране.
 *
 * Отсюда два следствия, и оба честные:
 *
 *  1. запись меняется при приближении. Это не сбой: увеличили план вдвое —
 *     масштаб и стал вдвое крупнее;
 *  2. отношение приблизительное. Точка CSS считается по стандартным 96 точкам
 *     на дюйм, а у настоящего монитора их бывает 92 или 110. Ошибка порядка
 *     десятой доли, поэтому перед числом стоит «≈».
 *
 * Значение округляется до двух значащих цифр: «1:317» обещает точность, которой
 * при неизвестном мониторе нет, а «1:320» — то же самое без обещания.
 */

/** Миллиметров в одной точке CSS при стандартных 96 точках на дюйм. */
export const MM_PER_CSS_PX = 25.4 / 96;

/**
 * Ширина, ниже которой подпись масштаба не показывается.
 *
 * Ширину плана на экране меряет наблюдатель размеров. Пока план не показан —
 * свёрнут, скрыт другой вкладкой, ещё не отрисован — намеренная ширина равна
 * толщине рамки, и отношение выходит в сотни раз крупнее настоящего: на стенде
 * при ширине 2 точки вместо «1:250» стояло «1:74000».
 *
 * Показать неверный масштаб хуже, чем не показать никакого: по подписи на плане
 * прикидывают расстояния. Поэтому при заведомо негодной ширине подписи нет.
 */
export const MIN_SHOWN_WIDTH_PX = 32;

/**
 * Во сколько раз действительность крупнее того, что видно на экране.
 *
 * null — посчитать не из чего: нет масштаба подложки или план ещё не отрисован.
 */
export function screenScaleRatio(
  metersPerPixel: number | null,
  imageWidthPx: number,
  renderedWidthCssPx: number,
): number | null {
  if (metersPerPixel === null || !Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return null;
  if (imageWidthPx <= 0 || renderedWidthCssPx < MIN_SHOWN_WIDTH_PX) return null;

  const realWidthMm = metersPerPixel * imageWidthPx * 1000;
  const shownWidthMm = renderedWidthCssPx * MM_PER_CSS_PX;
  const ratio = realWidthMm / shownWidthMm;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

/**
 * Округление до двух значащих цифр.
 *
 * До единицы — потому что масштаба «1:0,5» не бывает: при таком приближении
 * план крупнее действительности, и записывать это отношением незачем.
 */
export function roundRatio(ratio: number): number {
  if (ratio < 10) return Math.max(1, Math.round(ratio));
  const step = 10 ** (Math.floor(Math.log10(ratio)) - 1);
  return Math.round(ratio / step) * step;
}

/**
 * «М ≈ 1:320». Пусто, когда считать не из чего.
 *
 * Разряды не разделяются: на чертежах пишут «1:2000», а не «1:2 000».
 */
export function formatScale(
  metersPerPixel: number | null,
  imageWidthPx: number,
  renderedWidthCssPx: number,
): string {
  const ratio = screenScaleRatio(metersPerPixel, imageWidthPx, renderedWidthCssPx);
  if (ratio === null) return '';
  return `М ≈ 1:${roundRatio(ratio)}`;
}
