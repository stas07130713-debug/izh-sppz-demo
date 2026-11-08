/**
 * Срок ближайшего мероприятия, подкрашенный по состоянию.
 *
 * Зелёный — в сроках, жёлтый — срок подходит, красный — просрочено. Порог
 * «подходит» берётся из настроек программы и потому не зашит здесь числом:
 * у одной организации две недели запаса это норма, у другой мало.
 *
 * Показывается в двух местах — в карточке объекта и рядом с выбором
 * периодичности в чек-листе. Один компонент на оба места нужен не ради
 * экономии строк, а чтобы цвет и текст нигде не разошлись: пользователь
 * сверяет их глазами, переходя из карточки в проверку.
 */

import type { ScheduleResult } from '@izh/core';
import { formatDateRu } from '../format';

export interface DueBadgeProps {
  readonly schedule: ScheduleResult;
}

/** Класс цвета по состоянию срока. */
export function dueClass(status: ScheduleResult['status']): string {
  switch (status) {
    case 'норма': return 'due-ok';
    case 'скоро': return 'due-soon';
    case 'просрочено': return 'due-late';
    case 'нет данных': return 'due-unknown';
  }
}

/** Подпись срока словами: «до 12.05.26», «просрочено на 4 дня». */
export function dueText(schedule: ScheduleResult): string {
  if (schedule.nextDate === null) return 'срок не рассчитан';
  if (schedule.status === 'просрочено') {
    const days = Math.abs(schedule.daysToNext ?? 0);
    return `просрочено с ${formatDateRu(schedule.nextDate)} (${days} ${dayWord(days)})`;
  }
  if (schedule.status === 'скоро') {
    const days = schedule.daysToNext ?? 0;
    return `до ${formatDateRu(schedule.nextDate)} — ${days} ${dayWord(days)}`;
  }
  return `до ${formatDateRu(schedule.nextDate)}`;
}

/** Склонение слова «день» по числу: 1 день, 2 дня, 5 дней. */
function dayWord(count: number): string {
  const tail = count % 100;
  if (tail >= 11 && tail <= 14) return 'дней';
  switch (count % 10) {
    case 1: return 'день';
    case 2:
    case 3:
    case 4: return 'дня';
    default: return 'дней';
  }
}

export function DueBadge(props: DueBadgeProps): React.JSX.Element {
  return (
    <span className={`due-badge ${dueClass(props.schedule.status)}`}>
      <span className="due-dot" />
      {dueText(props.schedule)}
    </span>
  );
}
