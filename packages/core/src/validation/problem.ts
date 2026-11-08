/**
 * Нарушения логики данных: запреты и предупреждения (ТЗ, Дополнение 7).
 *
 * Два вида намеренно. Часть сочетаний невозможна физически — огнетушитель не
 * поставили на учёт раньше, чем изготовили, — и такие данные принимать нельзя:
 * они испортят все расчёты, опирающиеся на эти даты.
 *
 * Другая часть выглядит ошибкой, но бывает законной. Проверка, датированная
 * раньше постановки на учёт, обычно опечатка — но при переносе старого журнала
 * это норма, потому что оборудование обслуживали и до того, как завели в
 * программе. Запрещать такое значило бы сорвать перенос; поэтому программа
 * переспрашивает, а решает человек.
 *
 * Проверки собраны здесь, а не в сценариях и не в формах, по одной причине:
 * правило должно быть одно. Разложенное по двум местам, оно разойдётся, и
 * пользователь получит запрет там, где интерфейс его пропустил, — или наоборот.
 */

export type ProblemSeverity = 'запрет' | 'предупреждение';

export interface Problem {
  readonly severity: ProblemSeverity;
  /** Текст для пользователя: что именно не сходится и почему это важно. */
  readonly message: string;
  /** Поле карточки или формы, к которому относится. Пусто — относится к записи целиком. */
  readonly field?: string;
}

export function forbid(message: string, field?: string): Problem {
  return field === undefined
    ? { severity: 'запрет', message }
    : { severity: 'запрет', message, field };
}

export function warn(message: string, field?: string): Problem {
  return field === undefined
    ? { severity: 'предупреждение', message }
    : { severity: 'предупреждение', message, field };
}

export function blocking(problems: readonly Problem[]): readonly Problem[] {
  return problems.filter((problem) => problem.severity === 'запрет');
}

export function warnings(problems: readonly Problem[]): readonly Problem[] {
  return problems.filter((problem) => problem.severity === 'предупреждение');
}

/** Календарная дата в формате `ГГГГ-ММ-ДД`; пустое значение не проверяется. */
export function isCalendarDate(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Сравнение календарных дат строками.
 *
 * Формат `ГГГГ-ММ-ДД` сравнивается лексикографически так же, как хронологически.
 * `Date` здесь не нужен — и вреден: календарная дата не имеет часового пояса.
 */
export function isBefore(a: string, b: string): boolean {
  return a < b;
}
