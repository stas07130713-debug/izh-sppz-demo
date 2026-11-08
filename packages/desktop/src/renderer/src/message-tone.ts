/** Цвет верхнего сообщения: красный только для настоящего отказа или ошибки. */
export function messageTone(message: string): 'error' | 'notice' {
  const error = /не удалось|ошиб|нельзя|запрещ|отказ|недоступ|не найден|не относится|не заполн|не указан|не выбран|поврежд|неверн|не поддерж/i;
  return error.test(message) ? 'error' : 'notice';
}
