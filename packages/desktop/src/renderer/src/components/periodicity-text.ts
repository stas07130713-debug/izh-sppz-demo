/**
 * Правило периодичности словами.
 *
 * Пользователь настраивает регламент, не зная устройства программы, поэтому
 * рядом с названием периодичности показывается человеческая расшифровка:
 * «раз в 5 лет», «каждое 15 число месяца», «в марте и сентябре». Само правило
 * при этом остаётся данными и в интерфейсе не редактируется как выражение.
 */

import type { PeriodicityRule } from '@izh/contracts';

const MONTHS = [
  'январе', 'феврале', 'марте', 'апреле', 'мае', 'июне',
  'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре',
];

/** Русское склонение единиц интервала: 1 год, 2 года, 5 лет. */
function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = count % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function describePeriodicity(rule: PeriodicityRule): string {
  switch (rule.kind) {
    case 'интервал': {
      if (rule.unit === 'день') return `раз в ${rule.every} ${plural(rule.every, 'день', 'дня', 'дней')}`;
      if (rule.unit === 'год') return `раз в ${rule.every} ${plural(rule.every, 'год', 'года', 'лет')}`;
      if (rule.every === 1) return 'раз в месяц';
      if (rule.every === 12) return 'раз в год';
      if (rule.every % 12 === 0) {
        const years = rule.every / 12;
        return `раз в ${years} ${plural(years, 'год', 'года', 'лет')}`;
      }
      return `раз в ${rule.every} ${plural(rule.every, 'месяц', 'месяца', 'месяцев')}`;
    }

    case 'календарь-месяц':
      return `каждое ${rule.dayOfMonth} число месяца`;

    case 'календарь-годовой': {
      const names = rule.months
        .filter((month) => month >= 1 && month <= 12)
        .map((month) => MONTHS[month - 1] ?? '')
        .filter((name) => name !== '');
      if (names.length === 0) return 'месяцы не заданы';
      return `в ${names.join(' и ')}`;
    }

    case 'событие':
      return rule.trigger;

    case 'срок-службы':
      return 'по сроку службы из паспорта';

    case 'по-необходимости':
      return 'по необходимости';
  }
}
