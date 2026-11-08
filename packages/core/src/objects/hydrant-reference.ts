/**
 * Справочник наружного пожарного гидранта и его таблички-указателя
 * (ТЗ, Дополнение 6).
 *
 * Надписи таблички собираются здесь, а не в самой табличке: это правило, а не
 * оформление. «Кольцевая сеть диаметром 200 мм» превращается в «К-200» по
 * договорённости, одинаковой для всего предприятия, и правило это должно
 * лежать там же, где остальные — в ядре, под проверкой.
 */

import type { OutdoorHydrantProfile } from '@izh/contracts';

/** Подземный или наземный: от этого зависит, нужна ли колонка. */
export const HYDRANT_PLACEMENT_KINDS: readonly string[] = ['подземный', 'наземный'];

export interface HydrantPattern {
  readonly name: string;
  /** Как образец обозначается на табличке: МО, ЛО, НО. */
  readonly sign: string;
}

/**
 * Образцы гидрантов.
 *
 * Различаются присоединительной резьбой и размерами: к гидранту одного образца
 * колонка другого не подходит, и на табличке это пишут отдельно, чтобы расчёт
 * взял с собой нужную.
 */
export const HYDRANT_PATTERNS: readonly HydrantPattern[] = [
  { name: 'московского образца', sign: 'МО' },
  { name: 'ленинградского образца', sign: 'ЛО' },
  { name: 'немецкого образца', sign: 'НО' },
  { name: 'другой', sign: '' },
];

export interface WaterNetworkKind {
  readonly name: string;
  /** Буква на табличке перед диаметром: К, Т, КТ. */
  readonly sign: string;
}

/**
 * Тип водопроводной сети.
 *
 * Кольцевая держит напор при повреждении участка, тупиковая — нет. Расчёту
 * это нужно знать до подключения, поэтому обозначение стоит на самой табличке.
 */
export const WATER_NETWORK_KINDS: readonly WaterNetworkKind[] = [
  { name: 'кольцевая', sign: 'К' },
  { name: 'тупиковая', sign: 'Т' },
  { name: 'кольцевая с тупиковыми участками', sign: 'КТ' },
];

/** Диаметры водопроводной сети, мм: ряд по ГОСТ 10704 для наружных сетей. */
export const NETWORK_DIAMETERS_MM: readonly number[] = [
  100, 125, 150, 200, 250, 300, 350, 400, 500, 600, 800, 1000,
];

/** Высоты гидранта по ГОСТ 8220-85: от 500 до 3500 мм с шагом 250. */
export const HYDRANT_HEIGHTS_MM: readonly number[] = [
  500, 750, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3250, 3500,
];

/** Обозначение образца на табличке. Пустая строка — образец не выбран или «другой». */
export function hydrantPatternSign(pattern: string | null): string {
  return HYDRANT_PATTERNS.find((item) => item.name === pattern)?.sign ?? '';
}

/**
 * Обозначение сети на табличке: «К-200», «Т-100», «КТ-300».
 *
 * Пустая строка, когда неизвестен тип сети или диаметр: половина обозначения
 * хуже его отсутствия — «К-» на табличке читается как обрыв краски, а не как
 * незаполненное поле.
 */
export function waterNetworkSign(profile: OutdoorHydrantProfile): string {
  const kind = WATER_NETWORK_KINDS.find((item) => item.name === profile.networkKind);
  if (kind === undefined || profile.networkDiameterMm === null) return '';
  return `${kind.sign}-${profile.networkDiameterMm}`;
}

/**
 * Расстояние в том виде, в каком его наносят на табличку: «12.0».
 *
 * Один знак после точки — так пишут на указателях, и «12» вместо «12.0»
 * выглядит недокрашенным. Пустая строка остаётся пустой: подставлять «0.0»
 * туда, где не измеряли, нельзя — расчёт поедет искать гидрант под указателем.
 */
export function formatSignDistance(raw: string | null): string {
  if (raw === null || raw.trim() === '') return '';
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value) || value < 0) return '';
  return value.toFixed(1);
}
