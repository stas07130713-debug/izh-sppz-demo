/**
 * Откуда журнал берёт состав работ и сроки (ТЗ, Дополнение 5, часть Р19).
 *
 * Часть Р19 запрещает заводить отдельную логику периодичности под каждый вид
 * оборудования. Здесь это выражено прямо: у журнала ровно один вход за
 * правилами — этот порт, — и что бы за ним ни стояло, таблица, план и дашборд
 * считают одинаково.
 *
 * Реализации две:
 *
 * 1. `rulePackageSource` — нормативная библиотека `RULE_PACKAGE`. Работает без
 *    настройки: у организации сразу есть рабочие сроки, а не пустой экран.
 * 2. Движок регламентов (`@izh/engine-regulations`) — собирает регламент по
 *    дереву «организация → цех → здание → тип → элемент» и умеет все виды
 *    периодичности из части Р2.
 *
 * Ядро не зависит от движка (AGENTS.md, правило 1): реализацию передаёт
 * приложение снаружи, а сюда попадает только описание.
 */

import type { IsoDate, PlanObject } from '@izh/contracts';
import { activitiesForObject, type ActivityRule } from './rule-package.js';
import { addMonthsIso } from './schedule.js';

export interface ActivityScheduleSource {
  /**
   * Работы, действующие для объекта на указанную дату.
   *
   * Дата нужна не для красоты: регламент версионируется, и в мае мог
   * действовать другой состав работ, чем в сентябре (часть Р9).
   */
  readonly rulesFor: (object: PlanObject, today: IsoDate) => readonly ActivityRule[];
  /**
   * Следующий срок по правилу и дате последнего выполнения.
   *
   * `null` — срок числом не задан («по необходимости», «по паспорту»): такое
   * мероприятие показывается как «нет данных», а не как просроченное.
   */
  readonly nextDueOn: (rule: ActivityRule, lastPerformedOn: IsoDate | null, today: IsoDate) => IsoDate | null;
}

/**
 * Источник по нормативной библиотеке — поведение программы до конструктора.
 *
 * Остаётся значением по умолчанию намеренно: пока организация не завела свой
 * регламент, журнал обязан считать ровно так же, как считал раньше, иначе
 * обновление программы молча изменило бы сроки в действующем журнале.
 */
export const rulePackageSource: ActivityScheduleSource = {
  rulesFor: (object) => activitiesForObject(object),
  nextDueOn: (rule, lastPerformedOn) =>
    rule.periodicityMonths === null || lastPerformedOn === null
      ? null
      : addMonthsIso(lastPerformedOn, rule.periodicityMonths),
};
