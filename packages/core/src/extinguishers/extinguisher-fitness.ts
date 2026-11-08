/**
 * Годится ли огнетушитель для помещения (ППР, приложение № 1; таблица выбора
 * огнетушителей по ГОСТ Р 51057-2001).
 *
 * Ранг берётся из двух источников по убыванию доверия:
 *
 *  1. **Ранг из карточки.** Он написан в паспорте изделия — это первоисточник, и
 *     он всегда главнее вычисленного: производитель подтверждает испытаниями то,
 *     чего в общей таблице нет.
 *  2. **Ранг, вычисленный по марке и заряду.** Таблица 3 читается в обратную
 *     сторону: «≥ ОП-6» в строке класса A означает, что ОП-6 обеспечивает 3A.
 *     Требовать ручного ввода того, что выводится из уже введённых
 *     характеристик, незачем.
 *
 * Вычисленный ранг — нижняя оценка. Отсутствие класса в нём не доказывает, что
 * огнетушитель этот класс не тушит: таблица перечисляет обычные решения. Поэтому
 * там, где вычисленного не хватает, вывод не «не подходит», а «нельзя
 * подтвердить» с предложением вписать ранг из паспорта.
 *
 * Пустая карточка не считается подходящей: молчаливое согласие на незаполненных
 * сведениях и есть то, из-за чего проверка расстановки перестаёт что-либо значить.
 */

import type { ExtinguisherProfile, PlanObject } from '@izh/contracts';
import {
  formatFireRank, parseFireRank, rankSatisfies, rankShortfall, type FireRank,
} from './fire-rank.js';
import { derivedRank } from './derived-rank.js';
import { massNorm, type HazardRow } from './ppr-tables.js';
import type { RoomRequirement } from './room-requirement.js';

export type FitnessVerdict = 'подходит' | 'не подходит' | 'нет сведений';

export interface ExtinguisherFitness {
  readonly verdict: FitnessVerdict;
  /** Марка с зарядом, как её пишут в справках: «ОП-6», «ОВЭ-10». */
  readonly mark: string;
  readonly execution: 'переносной' | 'передвижной';
  /** Чем обоснован вывод: карточкой или расчётом по марке и заряду. */
  readonly basis: 'ранг из карточки' | 'ранг по ГОСТ для марки и заряда' | 'сведений нет';
  /** Ранг, по которому сделан вывод. Пусто — вычислить не из чего. */
  readonly rankText: string;
  /** Чего не хватает — текстом для человека. */
  readonly reason: string | null;
}

/** Обозначения таблицы 3 по видам каталога. */
const MARK_BY_TYPE: ReadonlyMap<string, string> = new Map([
  ['extinguisher-powder', 'ОП'],
  ['extinguisher-foam', 'ОВП(н)'],
  ['extinguisher-emulsion', 'ОВЭ'],
  ['extinguisher-co2', 'ОУ'],
  ['extinguisher-halon', 'ОХ'],
  ['extinguisher-water', 'ОВ'],
  ['extinguisher-bantl', 'ОВЭ'],
]);

/** Тот же перечень по огнетушащему веществу — для карточек вида «Огнетушитель». */
const MARK_BY_AGENT: ReadonlyMap<string, string> = new Map([
  ['порошок', 'ОП'],
  ['пена', 'ОВП(н)'],
  ['вода с добавками', 'ОВЭ'],
  ['углекислота', 'ОУ'],
  ['хладон', 'ОХ'],
  ['вода', 'ОВ'],
]);

/** Обозначение по виду, а где вид общий — по огнетушащему веществу карточки. */
export function extinguisherMark(typeCode: string, profile: ExtinguisherProfile | null): string | null {
  const byType = MARK_BY_TYPE.get(typeCode);
  if (byType !== undefined) return byType;
  if (profile?.agent === undefined || profile.agent === null) return null;
  return MARK_BY_AGENT.get(profile.agent) ?? null;
}

/** «ОП-6», «ОВЭ-10» — как в приложении к справке. */
export function markWithCharge(mark: string | null, profile: ExtinguisherProfile | null): string {
  if (mark === null) return 'вид не определён';
  const charge = profile?.nominalCharge ?? null;
  return charge === null ? mark : `${mark}-${charge}`;
}

/** Ранг из карточки — пустой ранг означает «не заполнено», а не «нулевой». */
export function cardRank(profile: ExtinguisherProfile | null): FireRank {
  return parseFireRank(profile?.fireRating ?? null);
}

/**
 * Ранг огнетушителя и откуда он взят.
 *
 * Одна функция на всю программу: карточка показывает то же самое, что проверка
 * расстановки берёт в расчёт. Два независимых вычисления однажды разошлись бы, и
 * человек увидел бы в карточке один ранг, а в проверке — другой.
 */
export function rankOfExtinguisher(
  typeCode: string,
  profile: ExtinguisherProfile | null,
): { readonly rank: FireRank | null; readonly fromCard: boolean } {
  const card = cardRank(profile);
  const declared = card.a !== null || card.b !== null || card.c || card.d || card.e;
  if (declared) return { rank: card, fromCard: true };

  const mark = extinguisherMark(typeCode, profile);
  return { rank: derivedRank(mark, profile?.nominalCharge ?? null), fromCard: false };
}

/**
 * Не мал ли заряд для того, что здесь требуется.
 *
 * Это другой вопрос, чем «хватает ли ранга». Таблица 3 называет для марки
 * наименьший заряд: «≥ ОП-4» для класса E. Двухкилограммовый порошковый в
 * таком помещении не годится — и это не нехватка сведений, а несоответствие
 * норме, о котором нужно сказать прямо.
 */
function chargeShortfall(
  row: HazardRow,
  requirement: RoomRequirement,
  mark: string,
  charge: number,
): readonly string[] {
  const short: string[] = [];
  for (const fireClass of requirement.fireClasses) {
    const norm = massNorm(row, fireClass);
    const minimum = norm?.minimums.find((item) => item.mark === mark) ?? null;
    if (minimum === null) continue;
    if (charge < minimum.minCharge) {
      short.push(`класс ${fireClass}: нужен не менее ${minimum.mark}-${minimum.minCharge}`);
    }
  }
  return short;
}

/**
 * Чего недостаёт для расчёта ранга — целой фразой.
 *
 * Фраза собирается здесь, а не по кускам на месте: «укажите его» и «укажите
 * их» согласуются с тем, что названо недостающим, и сшивать это за пределами
 * функции значило бы рано или поздно написать «не указан заряд — укажите их».
 */
function missingFor(mark: string | null, charge: number | null): string {
  if (mark === null && charge === null) {
    return 'не указаны ни огнетушащее вещество, ни заряд ОТВ — укажите их, и ранг посчитается сам';
  }
  if (mark === null) return 'не указано огнетушащее вещество — укажите его, и ранг посчитается сам';
  if (charge === null) return 'не указан заряд ОТВ — укажите его, и ранг посчитается сам';
  // Вещество и заряд есть, а строки для них в таблице 3 нет: такой заряд
  // ниже наименьшего по ГОСТ ни для одного класса пожара.
  /*
   * Ссылки на приложение № 1 здесь нет намеренно.
   *
   * Приложение требует ранг, а марок и зарядов не называет вовсе (часть
   * С107). Наименьшие заряды по маркам — вспомогательная таблица из справок
   * заказчика, и выдавать её за требование постановления нельзя: по такой
   * ссылке инспектор пошёл бы искать то, чего в документе нет.
   */
  return `заряд ${mark}-${charge} ниже наименьшего по таблице наименьших зарядов`;
}

export function extinguisherFitness(object: PlanObject, requirement: RoomRequirement): ExtinguisherFitness {
  const profile = object.extinguisherProfile ?? null;
  const mark = extinguisherMark(object.typeCode, profile);
  // Исполнение в карточке может быть не заполнено. Переносной — не догадка, а
  // разумное умолчание: передвижной огнетушитель весит десятки килограммов, и
  // его в карточке отмечают.
  const execution = profile?.execution ?? 'переносной';
  const label = markWithCharge(mark, profile);
  const { rank, fromCard } = rankOfExtinguisher(object.typeCode, profile);

  const charge = profile?.nominalCharge ?? null;
  const short = mark === null || charge === null
    ? []
    : chargeShortfall(requirement.row, requirement, mark, charge);

  // Заряд меньше наименьшего по ГОСТ — несоответствие норме, а не нехватка
  // сведений: ОП-2 там, где нужен ОП-4, не станет годным от записи в паспорте.
  if (short.length > 0) {
    return {
      verdict: 'не подходит',
      mark: label,
      execution,
      basis: 'ранг по ГОСТ для марки и заряда',
      rankText: rank === null ? '' : formatFireRank(rank),
      reason: `ранг ниже требуемого: ${short.join('; ')}`,
    };
  }

  if (rank === null) {
    return {
      verdict: 'нет сведений',
      mark: label,
      execution,
      basis: 'сведений нет',
      rankText: '',
      // Спрашивается то, что человек читает с этикетки, а не ранг: ранг
      // программа выводит сама. Названо ровно недостающее — «заполните
      // карточку» ничего не подсказывает тому, кто её открыл.
      reason: `ранг не вычислить: в карточке ${missingFor(mark, charge)}.`,
    };
  }

  const basis = fromCard ? 'ранг из карточки' as const : 'ранг по ГОСТ для марки и заряда' as const;
  const rankText = formatFireRank(rank);

  if (rankSatisfies(rank, requirement.rank)) {
    return { verdict: 'подходит', mark: label, execution, basis, rankText, reason: null };
  }

  const shortfall = rankShortfall(rank, requirement.rank);

  /*
   * Ранг из карточки — приговор: паспорт написан для конкретного изделия, и если
   * там не хватает класса, огнетушитель для этого места не годится.
   *
   * Вычисленный ранг — только нижняя оценка, и объявлять по ней несоответствие
   * нельзя: воздушно-эмульсионные огнетушители заказчика стоят в помещениях с
   * классом E, которого таблица 3 для них не приводит, — а испытаниями он
   * подтверждён. Поэтому здесь «нельзя подтвердить», а не «не подходит».
   */
  if (fromCard) {
    return {
      verdict: 'не подходит',
      mark: label,
      execution,
      basis,
      rankText,
      reason: `ранг ниже требуемого: по паспорту ${rankText}, а здесь нужно не ниже`
        + ` ${requirement.rankText} — не подтверждён ${shortfall.join(', ')}`,
    };
  }

  return {
    verdict: 'нет сведений',
    mark: label,
    execution,
    basis,
    rankText,
    reason: `по марке и заряду ГОСТ подтверждает ранг ${rankText}, а здесь нужно ещё ${shortfall.join(', ')}.`
      + ' Если в паспорте изделия ранг выше, впишите его в карточку — паспорт главнее общей таблицы.',
  };
}
