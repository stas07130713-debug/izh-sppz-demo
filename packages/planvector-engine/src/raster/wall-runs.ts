/**
 * Поиск стен по изображению. Растровый конвейер, этапы 4–7 ТЗ.
 *
 * Почему растр, а не разбор векторной структуры. Данных в векторе больше, но их
 * устройство непредсказуемо: каждый экспортёр САПР рисует стену по-своему — то
 * простым прямоугольником, то сложным многоугольником с проёмами, то штриховкой
 * из сотен мелких фигур. Правило, подошедшее одному файлу, разваливается на
 * другом. На изображении же стена выглядит одинаково, кем бы файл ни был сделан:
 * это длинная сплошная полоса тёмных точек.
 *
 * Отсюда весь алгоритм: оставить только длинные сплошные полосы, а всё
 * короткое — значки, буквы, штриховку, размерные засечки — отбросить.
 *
 * Все функции чистые: на входе массив точек, на выходе числа. Поэтому они
 * проверяются обычными тестами на маленьких картинках.
 */

/** Двоичная маска: 1 — на точке что-то нарисовано. */
export interface Mask {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly data: Uint8Array;
}

export interface MaskRect {
  readonly x: number;
  readonly y: number;
  readonly widthPx: number;
  readonly heightPx: number;
}

/** Найденная стена в координатах изображения. */
export interface RasterWall {
  /** Осевая линия. */
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  /** Толщина в точках изображения. */
  readonly thickness: number;
  readonly horizontal: boolean;
}

/** Ярче этого точка считается фоном. */
export const DEFAULT_INK_LEVEL = 200;

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Двоичная маска рисунка.
 *
 * Цвет не различается намеренно: на этом шаге важно только, есть на точке
 * что-нибудь или нет. Разделение архитектуры и пожарной графики делается позже
 * и по другим признакам — по длине и связности, а не по цвету.
 */
export function inkMaskFromRgba(
  data: Uint8ClampedArray,
  widthPx: number,
  heightPx: number,
  inkLevel = DEFAULT_INK_LEVEL,
): Mask {
  const mask = new Uint8Array(widthPx * heightPx);
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const index = pixel * 4;
    if (luminance(data[index] ?? 255, data[index + 1] ?? 255, data[index + 2] ?? 255) < inkLevel) {
      mask[pixel] = 1;
    }
  }
  return { widthPx, heightPx, data: mask };
}

/** Стирает области: рамки надписей, легенду, штамп. Их положение известно из
 *  текстового слоя документа, поэтому распознавать текст не требуется. */
export function eraseRects(mask: Mask, rects: readonly MaskRect[]): Mask {
  const data = new Uint8Array(mask.data);

  for (const rect of rects) {
    const left = Math.max(0, Math.floor(rect.x));
    const top = Math.max(0, Math.floor(rect.y));
    const right = Math.min(mask.widthPx, Math.ceil(rect.x + rect.widthPx));
    const bottom = Math.min(mask.heightPx, Math.ceil(rect.y + rect.heightPx));

    for (let row = top; row < bottom; row += 1) {
      data.fill(0, row * mask.widthPx + left, row * mask.widthPx + right);
    }
  }

  return { widthPx: mask.widthPx, heightPx: mask.heightPx, data };
}

/** Один сплошной кусок закрашенных точек в строке или столбце. */
interface Run {
  readonly from: number;
  readonly to: number;
}

/** Ищет сплошные куски в одной строке или столбце. */
function runsAlong(
  mask: Mask,
  fixed: number,
  horizontal: boolean,
  maxGap: number,
): Run[] {
  const length = horizontal ? mask.widthPx : mask.heightPx;
  const runs: Run[] = [];

  let start = -1;
  let gap = 0;

  for (let i = 0; i < length; i += 1) {
    const index = horizontal ? fixed * mask.widthPx + i : i * mask.widthPx + fixed;
    const filled = mask.data[index] === 1;

    if (filled) {
      if (start < 0) start = i;
      gap = 0;
    } else if (start >= 0) {
      gap += 1;
      // Небольшой разрыв допускается: линию рвут пересечения и мелкие дефекты.
      if (gap > maxGap) {
        runs.push({ from: start, to: i - gap });
        start = -1;
        gap = 0;
      }
    }
  }

  if (start >= 0) runs.push({ from: start, to: length - 1 - gap });
  return runs;
}

export interface WallSearchOptions {
  /** Короче этого сплошная полоса стеной не считается, в точках. */
  readonly minLengthPx: number;
  /** Толще этого полоса стеной не считается. */
  readonly maxThicknessPx: number;
  /** Допустимый разрыв внутри полосы: пересечения, проёмы, дефекты печати. */
  readonly maxGapPx: number;
  /** Насколько куски соседних строк должны перекрываться, доля. */
  readonly minOverlapShare: number;
}

export const DEFAULT_WALL_SEARCH: WallSearchOptions = {
  minLengthPx: 60,
  maxThicknessPx: 40,
  maxGapPx: 3,
  minOverlapShare: 0.6,
};

interface Band {
  from: number;
  to: number;
  first: number;
  last: number;
}

/**
 * Собирает стены одного направления.
 *
 * Сначала в каждой строке ищутся длинные сплошные куски. Затем куски соседних
 * строк, лежащие друг над другом, объединяются в полосу — это и есть стена, а
 * число строк в полосе даёт её толщину.
 */
function collectWalls(mask: Mask, horizontal: boolean, options: WallSearchOptions): RasterWall[] {
  const across = horizontal ? mask.heightPx : mask.widthPx;
  const walls: RasterWall[] = [];
  let open: Band[] = [];

  const closeBand = (band: Band): void => {
    const thickness = band.last - band.first + 1;
    if (thickness > options.maxThicknessPx) return;

    const centre = (band.first + band.last) / 2;
    walls.push(
      horizontal
        ? { x1: band.from, y1: centre, x2: band.to, y2: centre, thickness, horizontal: true }
        : { x1: centre, y1: band.from, x2: centre, y2: band.to, thickness, horizontal: false },
    );
  };

  for (let line = 0; line < across; line += 1) {
    const runs = runsAlong(mask, line, horizontal, options.maxGapPx).filter(
      (run) => run.to - run.from + 1 >= options.minLengthPx,
    );

    const next: Band[] = [];

    for (const run of runs) {
      const runLength = run.to - run.from + 1;
      const match = open.find((band) => {
        const overlap = Math.min(band.to, run.to) - Math.max(band.from, run.from) + 1;
        const shorter = Math.min(band.to - band.from + 1, runLength);
        return band.last === line - 1 && shorter > 0 && overlap / shorter >= options.minOverlapShare;
      });

      if (match === undefined) {
        next.push({ from: run.from, to: run.to, first: line, last: line });
        continue;
      }

      // Полоса продолжается: границы берутся по пересечению, чтобы стена не
      // расползалась на примыкающие к ней куски.
      match.from = Math.max(match.from, run.from);
      match.to = Math.min(match.to, run.to);
      match.last = line;
      next.push(match);
    }

    for (const band of open) {
      if (!next.includes(band)) closeBand(band);
    }
    open = next;
  }

  for (const band of open) closeBand(band);

  return walls.filter((wall) => Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) >= options.minLengthPx);
}

/**
 * Находит стены на изображении.
 *
 * Ищутся только горизонтальные и вертикальные: на поэтажных планах подавляющее
 * большинство стен ортогональны, а наклонные надёжнее добавить руками, чем
 * угадывать. Пункт 25 ТЗ прямо разрешает такой размен.
 */
export function findWalls(mask: Mask, options: WallSearchOptions = DEFAULT_WALL_SEARCH): RasterWall[] {
  return [...collectWalls(mask, true, options), ...collectWalls(mask, false, options)];
}
