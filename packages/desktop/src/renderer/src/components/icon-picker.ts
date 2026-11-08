/**
 * Картинка значка своего вида: чтение файла и уменьшение до значка.
 *
 * Уменьшать обязательно. Пользователь берёт первую попавшуюся картинку — снимок
 * с телефона на четыре мегабайта, — а значок на плане занимает десятки точек.
 * Настройки же читаются при каждом запуске одним документом, и несколько таких
 * картинок сделали бы запуск заметно медленнее.
 *
 * Отдельным файлом от формы: работа с `FileReader` и `canvas` — не разметка, и
 * проверять её удобнее там, где нет React.
 */

/** Сторона значка после уменьшения. Хватает и для плана, и для списков. */
const SIDE = 64;

export interface IconReadResult {
  readonly ok: boolean;
  readonly dataUrl: string;
  readonly error: string;
}

function fail(error: string): IconReadResult {
  return { ok: false, dataUrl: '', error };
}

/**
 * Читает выбранный файл и возвращает значок как `data:`-строку.
 *
 * SVG не растрируется: он и так весит килобайты, а растянутый до 64 точек
 * рисунок потерял бы то, ради чего его выбрали, — чёткость на любом увеличении.
 */
export async function readIconFile(file: File): Promise<IconReadResult> {
  if (!file.type.startsWith('image/')) {
    return fail('Это не картинка. Подойдут PNG, JPEG или SVG.');
  }

  const source = await readAsDataUrl(file);
  if (source === null) return fail('Картинку не удалось прочитать.');

  if (file.type === 'image/svg+xml') {
    return { ok: true, dataUrl: source, error: '' };
  }

  const shrunk = await shrink(source);
  return shrunk === null
    ? fail('Картинку не удалось открыть. Попробуйте другой файл.')
    : { ok: true, dataUrl: shrunk, error: '' };
}

function readAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/**
 * Вписывает картинку в квадрат значка, сохраняя пропорции.
 *
 * Не растягивает: растянутый значок читается как другой предмет. Пустое место
 * остаётся прозрачным, поэтому значок ложится на любой фон и в любой теме.
 */
function shrink(dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = SIDE;
      canvas.height = SIDE;
      const context = canvas.getContext('2d');
      if (context === null) { resolve(null); return; }

      const scale = Math.min(SIDE / image.width, SIDE / image.height);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      context.drawImage(image, Math.round((SIDE - width) / 2), Math.round((SIDE - height) / 2), width, height);

      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}
