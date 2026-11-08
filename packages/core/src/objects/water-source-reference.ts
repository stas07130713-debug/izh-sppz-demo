/**
 * Справочник пожарного водоисточника и его таблички-указателя
 * (ТЗ, Дополнение 6).
 *
 * Надписи таблички собираются здесь, а не в самой табличке: «ПВ — 12» и
 * «V общее — 100 м³» пишут по договорённости, одинаковой для всего
 * предприятия, и правило это лежит там же, где остальные — в ядре, под
 * проверкой.
 */

import type { WaterSourceProfile } from '@izh/contracts';

/** Открытый источник или закрытый. */
export const WATER_SOURCE_EXECUTIONS: readonly string[] = ['открытый', 'закрытый'];

/** Подземное или надземное расположение. */
export const WATER_SOURCE_PLACEMENTS: readonly string[] = ['подземный', 'надземный'];

/** Есть ли площадка для установки пожарной техники. «Нет» — это ответ, а не пустое поле. */
export const WATER_SOURCE_PAD: readonly string[] = ['есть', 'нет'];

/**
 * Способы забора воды.
 *
 * От способа зависит, что расчёт готовит на месте: к приёмному колодцу
 * подъезжают и опускают рукав, из открытого водоёма забирают с пирса, а на
 * закрытом резервуаре может стоять стационарный насос.
 */
export const WATER_INTAKE_METHODS: readonly string[] = [
  'самотёком',
  'через приёмный колодец',
  'всасывающими рукавами с площадки',
  'с пирса',
  'стационарным насосом',
];

/** Сколько автомобилей ставится одновременно: по проекту от одного до пяти. */
export const WATER_SOURCE_VEHICLE_COUNTS: readonly number[] = [1, 2, 3, 4, 5];

/**
 * Обозначение номера на табличке: «ПВ — 12».
 *
 * Пустая строка, когда номера нет: «ПВ —» на указателе читается как обрыв
 * краски, а не как незаполненное поле.
 */
export function waterSourceNumberSign(regNumber: string | null): string {
  const number = regNumber === null ? '' : regNumber.trim();
  return number === '' ? '' : `ПВ — ${number}`;
}

/**
 * Обозначение объёма на табличке: «V — 50 м³», а при нескольких резервуарах
 * «V общее — 300 м³» — объём одного, умноженный на их количество.
 *
 * Общий объём подписывается отдельным словом не для красоты: расчёт, увидев
 * «V — 100» у источника из двух ёмкостей, решит, что столько воды в каждой.
 */
export function waterSourceVolumeSign(profile: WaterSourceProfile): string {
  const total = waterSourceTotalVolume(profile);
  if (total === null) return '';
  const label = (profile.tankCount ?? 1) > 1 ? 'V общее' : 'V';
  return `${label} — ${total} м³`;
}

/**
 * Весь запас воды источника, кубометров.
 *
 * Объём в карточке — объём одного резервуара: столько написано в его паспорте и
 * столько видно на месте. Общий запас получается умножением на их количество —
 * три резервуара по 100 м³ дают 300 м³, и именно это число идёт на табличку и
 * в журнал.
 */
export function waterSourceTotalVolume(profile: WaterSourceProfile): number | null {
  if (profile.volumeM3 === null) return null;
  const count = profile.tankCount ?? 1;
  return count > 1 ? profile.volumeM3 * count : profile.volumeM3;
}
