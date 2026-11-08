/** Сегодняшняя календарная дата в формате ГГГГ-ММ-ДД, без времени и часового пояса. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
