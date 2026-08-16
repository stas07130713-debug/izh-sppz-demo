/**
 * Эталонные тесты классификации содержимого страницы.
 *
 * Значения счётчиков взяты из реальных материалов заказчика, см. комментарий
 * в content-signals.ts.
 */

import { describe, expect, it } from 'vitest';
import { classifyPageContent } from '../content-signals.js';

describe('classifyPageContent', () => {
  it('чертёж из САПР: много линий и подписей — вектор, не скан', () => {
    const verdict = classifyPageContent({
      textItemCount: 240,
      vectorPathCount: 5400,
      imageCount: 1,
    });
    expect(verdict.likelyVector).toBe(true);
    expect(verdict.likelyScan).toBe(false);
  });

  it('скан чертежа: одна картинка и ничего больше — скан, не вектор', () => {
    const verdict = classifyPageContent({
      textItemCount: 0,
      vectorPathCount: 0,
      imageCount: 1,
    });
    expect(verdict.likelyVector).toBe(false);
    expect(verdict.likelyScan).toBe(true);
  });

  it('план эвакуации, собранный в Excel: картинки плюс текст — вектор', () => {
    const verdict = classifyPageContent({
      textItemCount: 60,
      vectorPathCount: 12,
      imageCount: 3,
    });
    expect(verdict.likelyVector).toBe(true);
    expect(verdict.likelyScan).toBe(false);
  });

  it('пустая страница не относится ни к тому, ни к другому', () => {
    const verdict = classifyPageContent({
      textItemCount: 0,
      vectorPathCount: 0,
      imageCount: 0,
    });
    expect(verdict.likelyVector).toBe(false);
    expect(verdict.likelyScan).toBe(false);
  });

  it('скан с распознанным текстовым слоем считается вектором, а не сканом', () => {
    const verdict = classifyPageContent({
      textItemCount: 300,
      vectorPathCount: 0,
      imageCount: 1,
    });
    expect(verdict.likelyVector).toBe(true);
    expect(verdict.likelyScan).toBe(false);
  });
});
