/**
 * Куда положить дату из чужого журнала: в какое мероприятие.
 *
 * В старом журнале даты лежат колонками («Квартальная проверка», «Дата
 * перезарядки»), а у нас каждая дата — это выполненное мероприятие в ленте
 * истории (Д5). Значит при переносе дату нужно превратить в событие, и событие
 * должно быть тем, которое действительно применимо к типу оборудования по
 * пакету правил — иначе запись повиснет мимо всех колонок журнала.
 */

import type { ActivityRule } from '../rules/rule-package.js';
import { alwaysApplicable } from '../rules/rule-package.js';

export interface ImportedActivity {
  readonly activityCode: string;
  readonly performedOn: string;
}

/**
 * Работа, которую можно считать «проверкой» в смысле старого журнала.
 *
 * Определяется по названию, а не по списку кодов. Список кодов уже подвёл: в
 * нём стояли `osmotr`, `proverka`, `kontrol` — а у огнетушителей работы зовутся
 * `lokalny-kvartalny-osmotr`, `ezhegodnaya-proverka`, `proverka-poroshka`, и ни
 * один код не совпадал. Перенос журнала огнетушителей — самый частый случай —
 * не переносил ни одной даты проверки: объекты появлялись с пустой историей, и
 * все сроки выходили просроченными в день переноса.
 */
function isCheckLike(rule: ActivityRule): boolean {
  const title = rule.title.toLocaleLowerCase('ru');
  return title.includes('осмотр')
    || title.includes('проверк')
    || title.includes('контрол')
    || title.includes('обследован');
}

/** Периодичность, названная в заголовке колонки источника. В месяцах. */
function periodicityFromHeader(header: string | null): number | null {
  if (header === null) return null;
  const text = header.toLocaleLowerCase('ru');
  if (text.includes('ежемесяч') || text.includes('месячн')) return 1;
  if (text.includes('квартал')) return 3;
  if (text.includes('полугод')) return 6;
  if (text.includes('ежегод') || text.includes('годов') || text.includes('годич')) return 12;
  if (text.includes('пятилет') || text.includes('5 лет')) return 60;
  return null;
}

/**
 * Какая именно проверка стоит за датой.
 *
 * Если заголовок колонки называет периодичность («Ежегодная проверка»,
 * «Квартальный осмотр»), берётся работа ровно с этой периодичностью: источник
 * сказал прямо, и догадываться не о чем.
 *
 * Если заголовок молчит («Дата последней проверки»), берётся самая частая из
 * применимых проверок — та, которую источник заведомо покрывает.
 */
function checkRuleFor(typeCode: string, header: string | null): ActivityRule | null {
  /*
   * Берётся то, что применимо **без отдельного решения организации**.
   *
   * Работы с пометкой «по решению организации» (ежеквартальный осмотр по
   * локальному регламенту, полугодовая проверка при неблагоприятных условиях)
   * запись журнала не принимает: они действуют, только если организация их
   * включила. Выбрать такую работу здесь значит получить отказ «мероприятие не
   * применимо» на каждой строке переноса.
   */
  const checks = alwaysApplicable(typeCode).filter(isCheckLike);
  const first = checks[0];
  if (first === undefined) return null;

  const named = periodicityFromHeader(header);
  if (named !== null) {
    /*
     * Заголовок назвал периодичность — берётся ровно она, и ничего другого.
     *
     * Если такой работы в регламенте нет, дата **не переносится**. Записать
     * ежегодную проверку по колонке «Квартальная проверка» значит объявить
     * выполненной работу, которой не было: годовая проверка серьёзнее
     * квартального осмотра, а убрать запись из журнала эксплуатации нельзя
     * (AGENTS.md, правило 10). Пропуск виден в отчёте о переносе.
     */
    return checks.find((rule) => rule.periodicityMonths === named) ?? null;
  }

  return checks.reduce((best, rule) => {
    const bestMonths = best.periodicityMonths ?? Number.POSITIVE_INFINITY;
    const months = rule.periodicityMonths ?? Number.POSITIVE_INFINITY;
    return months < bestMonths ? rule : best;
  }, first);
}

/**
 * Мероприятия, которыми станут перенесённые даты.
 *
 * Дата перезарядки ищет строго перезарядку. Если применимого мероприятия нет
 * (пакет правил для типа не заведён), дата не переносится: создать событие
 * «неизвестного вида» значит завести запись, которую потом никто не найдёт ни в
 * одной колонке журнала.
 */
export function datesToActivities(
  typeCode: string,
  lastCheck: string | null,
  lastRecharge: string | null,
  /** Заголовок колонки, из которой взята дата проверки, — как он был в файле. */
  checkHeader: string | null = null,
): readonly ImportedActivity[] {
  const result: ImportedActivity[] = [];

  if (lastCheck !== null) {
    const rule = checkRuleFor(typeCode, checkHeader);
    if (rule !== null) result.push({ activityCode: rule.activityCode, performedOn: lastCheck });
  }

  if (lastRecharge !== null) {
    const found = alwaysApplicable(typeCode).find((rule) => rule.activityCode === 'perezaryadka');
    if (found !== undefined) result.push({ activityCode: found.activityCode, performedOn: lastRecharge });
  }

  return result;
}
