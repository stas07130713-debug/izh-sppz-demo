/**
 * Результат операции: либо значение, либо ошибка.
 *
 * Зачем это вместо исключений: движки обязаны возвращать сбой как обычное
 * значение, чтобы ошибка в движке не роняла программу и не могла остаться
 * незамеченной. Смотри правило 2 в AGENTS.md.
 */

/** Код ошибки. Строка, а не число: коды должны быть читаемыми в логах. */
export type ErrorCode =
  | 'FILE_NOT_FOUND'
  | 'FILE_READ_FAILED'
  | 'FILE_WRITE_FAILED'
  /**
   * Файл данных есть, но прочитать его не удалось.
   *
   * Отличается от FILE_NOT_FOUND намеренно: отсутствие файла — обычное
   * состояние до первой записи, а повреждение означает, что данные на диске
   * есть и их нельзя затирать. Получив этот код, программа обязана показать
   * ошибку и ничего не сохранять поверх.
   */
  | 'FILE_CORRUPTED'
  | 'UNSUPPORTED_FORMAT'
  | 'PDF_PARSE_FAILED'
  | 'PDF_PAGE_NOT_FOUND'
  | 'RENDER_FAILED'
  | 'INVALID_ARGUMENT'
  | 'NOT_FOUND'
  /** Запись изменена кем-то другим с тех пор, как её прочитали. */
  | 'VERSION_CONFLICT'
  /**
   * Действие запрещено правами.
   *
   * Отличается от NOT_FOUND намеренно: «нельзя» и «нет такого» — разные
   * ответы, и путать их можно только в одном месте, при входе, где разница
   * подсказала бы подбирающему существующее имя.
   */
  | 'FORBIDDEN'
  /** Запись с таким уникальным признаком уже есть: имя для входа, номер. */
  | 'CONFLICT'
  | 'INTERNAL';

export interface AppError {
  readonly code: ErrorCode;
  /** Текст для пользователя, на русском, без технического жаргона. */
  readonly message: string;
  /** Технические подробности для журнала диагностики. Пользователю не показываются. */
  readonly details?: string;
}

export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: AppError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T>(code: ErrorCode, message: string, details?: string): Result<T> {
  return { ok: false, error: details === undefined ? { code, message } : { code, message, details } };
}

/** Превращает неизвестное значение из catch в строку для поля details. */
export function describeUnknown(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
}
