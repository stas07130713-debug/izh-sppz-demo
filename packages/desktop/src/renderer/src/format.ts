/** Форматирование чисел для показа пользователю. Русские единицы, разумная точность. */

export function formatMegapixels(value: number): string {
  return `${value.toFixed(1)} Мп`;
}

export function formatPixels(widthPx: number, heightPx: number): string {
  return `${widthPx} × ${heightPx} точек`;
}

/** Размеры страницы в пунктах PDF переводятся в миллиметры — так понятнее. */
export function formatPageSizeMm(widthPt: number, heightPt: number): string {
  const toMm = (pt: number): number => (pt / 72) * 25.4;
  return `${Math.round(toMm(widthPt))} × ${Math.round(toMm(heightPt))} мм`;
}

/** Масштаб показываем и как «метров в пикселе», и как привычное 1:N. */
export function formatScale(metersPerPixel: number, dpi: number | null): string {
  const perPixel = metersPerPixel < 0.01
    ? `${(metersPerPixel * 1000).toFixed(2)} мм`
    : `${(metersPerPixel * 100).toFixed(2)} см`;

  if (dpi === null) return `${perPixel} в одной точке`;

  const denominator = Math.round(metersPerPixel / (0.0254 / dpi));
  return `${perPixel} в одной точке — это примерно 1:${denominator}`;
}

export function formatBytes(count: number): string {
  if (count < 1024) return `${count} Б`;
  if (count < 1024 * 1024) return `${(count / 1024).toFixed(0)} КБ`;
  return `${(count / (1024 * 1024)).toFixed(1)} МБ`;
}

/**
 * Дата со временем: «06.09.2026 14:35».
 *
 * Тот же порядок и тот же год, что у календарной даты, — иначе на одном экране
 * встречались бы «06.09.26» и «06.09.2026».
 */
export function formatDateTime(isoUtc: string): string {
  const date = new Date(isoUtc);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/**
 * Календарная дата `ГГГГ-ММ-ДД` в российском виде `ДД.ММ.ГГГГ`
 * (ТЗ, Дополнение 3, часть К1).
 *
 * Заказчик: «все записи даты должны стоять в едином формате: сначала дата,
 * месяц и год». Порядок был верный и раньше, а вот год писался по-разному:
 * в журнале и карточках двумя цифрами, в истории действий и выгрузках —
 * четырьмя. На одном экране встречались «06.09.26» и «06.09.2026».
 *
 * Выбран полный год. Журнал эксплуатации предъявляют при проверке, и срок
 * перезарядки «до 15.05.31» читается двусмысленно, когда рядом стоят записи
 * десятилетней давности. Две сэкономленные цифры того не стоят.
 *
 * Строковая перестановка, а не `Date`: календарная дата не имеет часового
 * пояса (правило AGENTS.md), а `new Date('2026-08-18')` в JS читается как
 * полночь UTC и на компьютере западнее Гринвича печаталась бы как 17-е число.
 * Хранение остаётся ISO — меняется только то, что видит пользователь.
 */
export function formatDateRu(iso: string): string {
  const [year, month, day] = iso.split('-');
  if (year === undefined || month === undefined || day === undefined) return iso;
  return `${day}.${month}.${year}`;
}

/** То же, но пустая дата показывается прочерком, а не пустотой. */
export function formatDateRuOrDash(iso: string | null | undefined): string {
  return iso === null || iso === undefined || iso === '' ? '—' : formatDateRu(iso);
}

/**
 * Русское числительное: «1 строка», «2 строки», «5 строк».
 *
 * Иначе счётчики в подписях выглядят сокращением «3 стр.», которое человек
 * читает как опечатку, — или прямой ошибкой вроде «1 строки».
 */
export function pluralRu(count: number, one: string, few: string, many: string): string {
  const tens = Math.abs(count) % 100;
  if (tens >= 11 && tens <= 14) return many;
  const units = Math.abs(count) % 10;
  if (units === 1) return one;
  if (units >= 2 && units <= 4) return few;
  return many;
}

/**
 * Точка в конце — если её там ещё нет.
 *
 * Фамилия с инициалами уже кончается точкой: «Янишевский С. А.». Приписанная
 * следом вторая («С. А..») выглядит опечаткой в том самом месте, где программа
 * называет подписавшего.
 */
export function endSentence(text: string): string {
  return text.endsWith('.') ? text : `${text}.`;
}
