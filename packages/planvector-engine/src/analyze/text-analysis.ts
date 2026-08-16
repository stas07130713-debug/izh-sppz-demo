/**
 * Разбор текстового слоя. Пункты 5 и 14 ТЗ.
 *
 * Текст на чертеже решает две задачи сразу.
 *
 * Во-первых, он прямо сообщает масштаб: «М 1:100» встречается почти на каждом
 * листе, и это надёжнее любого измерения по картинке.
 *
 * Во-вторых, он показывает, где на листе не здание. Легенда, штамп, таблицы и
 * блоки «Действия при пожаре» — это плотные скопления надписей. Ранняя попытка
 * делить графику по цвету проваливалась именно здесь: чёрным нарисованы и стены,
 * и разлиновка таблицы. По тексту эти области отделяются точно.
 */

import type { SourceRect, TextItem } from '../source/page-content.js';
import { rectsOverlap, unionRect } from '../source/page-content.js';

/** Запас вокруг надписи, доли её высоты: разлиновка таблиц и рамки идут вплотную. */
export const TEXT_PADDING_SHARE = 0.6;

/** Надписи ниже этого размера — мусор разбора, а не текст. */
const MIN_TEXT_HEIGHT = 1.5;

/** На таком расстоянии надписи считаются одним блоком. */
export const CLUSTER_GAP = 30;

/** Скопление меньше этого числа надписей блоком не считается. */
const MIN_CLUSTER_ITEMS = 3;

export interface TextCluster {
  readonly rect: SourceRect;
  readonly itemCount: number;
}

function boxOf(item: TextItem): SourceRect {
  const padding = Math.max(1.5, item.height * TEXT_PADDING_SHARE);
  return {
    x: item.x - padding,
    y: item.y - padding,
    width: item.width + padding * 2,
    height: item.height + padding * 2,
  };
}

/** Рамки надписей с запасом. Всё, что попало внутрь, зданием не является. */
export function textBoxes(texts: readonly TextItem[]): SourceRect[] {
  return texts
    .filter((item) => item.text.trim() !== '' && item.height >= MIN_TEXT_HEIGHT && item.width > 0)
    .map(boxOf);
}

/**
 * Скопления надписей: легенда, штамп, таблицы, пояснительные блоки.
 *
 * Объединяются постепенно, пока есть что объединять: два блока могли оказаться
 * рядом только после того, как каждый из них подрос.
 */
export function textClusters(texts: readonly TextItem[]): TextCluster[] {
  const clusters: { rect: SourceRect; itemCount: number }[] = textBoxes(texts).map((rect) => ({
    rect,
    itemCount: 1,
  }));

  let merged = true;
  while (merged) {
    merged = false;

    for (let i = 0; i < clusters.length && !merged; i += 1) {
      for (let j = i + 1; j < clusters.length; j += 1) {
        const first = clusters[i];
        const second = clusters[j];
        if (first === undefined || second === undefined) continue;
        if (!rectsOverlap(first.rect, second.rect, CLUSTER_GAP)) continue;

        clusters[i] = {
          rect: unionRect(first.rect, second.rect),
          itemCount: first.itemCount + second.itemCount,
        };
        clusters.splice(j, 1);
        merged = true;
        break;
      }
    }
  }

  return clusters.filter((cluster) => cluster.itemCount >= MIN_CLUSTER_ITEMS);
}

/**
 * Масштаб, записанный в тексте.
 *
 * Понимаются «М 1:100», «M1:100», «1:100», «Масштаб 1:100». Возвращается
 * знаменатель. Если на листе несколько разных масштабов, доверять им нельзя:
 * обычно это значит, что рядом врезка или узел в другом масштабе.
 */
export function scaleFromText(texts: readonly TextItem[]): number | null {
  const pattern = /(?:^|[^\d])1\s*[:：]\s*(\d{1,5})(?!\d)/g;
  const found = new Set<number>();

  for (const item of texts) {
    pattern.lastIndex = 0;
    let match = pattern.exec(item.text);
    while (match !== null) {
      const denominator = Number(match[1]);
      // Осмысленные строительные масштабы: от 1:10 до 1:5000.
      if (denominator >= 10 && denominator <= 5000) found.add(denominator);
      match = pattern.exec(item.text);
    }
  }

  if (found.size !== 1) return null;
  const [only] = [...found];
  return only ?? null;
}

/** Признаки того, что перед нами план эвакуации, а не технический план. */
const EVACUATION_WORDS = [
  'ЭВАКУАЦ',
  'ОГНЕТУШИТЕЛЬ',
  'ПОЖАРНЫЙ КРАН',
  'ВЫ НАХОДИТЕСЬ ЗДЕСЬ',
  'УСЛОВНЫЕ ОБОЗНАЧЕНИЯ',
  'ПРИ ПОЖАРЕ',
];

/** Профиль распознавания по пункту 11 ТЗ. */
export function detectProfile(texts: readonly TextItem[]): 'TECHNICAL_PLAN' | 'EVACUATION_PLAN' {
  const haystack = texts.map((item) => item.text.toUpperCase()).join(' ');
  const hits = EVACUATION_WORDS.filter((word) => haystack.includes(word)).length;
  return hits >= 2 ? 'EVACUATION_PLAN' : 'TECHNICAL_PLAN';
}
