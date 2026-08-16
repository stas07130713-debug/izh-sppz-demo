/**
 * Классификация страницы: векторный чертёж или скан.
 *
 * Чистая функция без зависимостей — поэтому покрыта тестами и является
 * спецификацией. Пороговые значения подобраны по реальным материалам заказчика:
 * план, выведенный из AutoCAD, содержит тысячи векторных примитивов и десятки
 * текстовых подписей; план эвакуации, собранный в Excel, — несколько картинок и
 * умеренное количество фигур; скан — одну картинку почти без всего остального.
 */

/** Ниже этого числа векторных примитивов страница не считается чертежом. */
export const VECTOR_PATH_THRESHOLD = 20;

/** Столько текстовых элементов достаточно, чтобы считать текст осмысленным,
 *  а не подписью в углу. */
export const TEXT_ITEM_THRESHOLD = 5;

export interface ContentCounters {
  readonly textItemCount: number;
  readonly vectorPathCount: number;
  readonly imageCount: number;
}

export interface ContentVerdict {
  readonly likelyVector: boolean;
  readonly likelyScan: boolean;
}

export function classifyPageContent(counters: ContentCounters): ContentVerdict {
  const hasEnoughVectors = counters.vectorPathCount >= VECTOR_PATH_THRESHOLD;
  const hasEnoughText = counters.textItemCount >= TEXT_ITEM_THRESHOLD;

  const likelyVector = hasEnoughVectors || hasEnoughText;

  // Сканом считаем страницу, где есть картинка и почти нет ничего своего.
  const likelyScan = counters.imageCount > 0 && !hasEnoughVectors && !hasEnoughText;

  return { likelyVector, likelyScan };
}
