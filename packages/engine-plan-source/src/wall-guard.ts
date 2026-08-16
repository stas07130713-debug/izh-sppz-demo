/**
 * Защита стен при очистке.
 *
 * Главная и, по сути, единственная беда очистки была в том, что удаление значка
 * или стрелки забирало с собой кусок стены, к которой они примыкают: по цвету и
 * по связности обводка значка от стены не отличается.
 *
 * Отличается другим. Стена — это длинная сплошная полоса точек, у которой есть
 * продолжение в обе стороны. У обводки значка, буквы, засечки такого
 * продолжения нет. Поэтому перед стиранием строится маска стен, и удалению
 * запрещено её трогать: значок уходит, стена остаётся целой — включая тот её
 * кусок, который значок закрывал.
 *
 * Чистые функции, покрытые тестами.
 */

/** Короче этого сплошная полоса стеной не считается, в точках изображения. */
export const WALL_MIN_RUN_PX = 45;

/** Толще этого полоса стеной не считается: это заливка или пятно. */
export const WALL_MAX_THICKNESS_PX = 40;

/** Разрыв внутри полосы, который не прерывает её: пересечения и проёмы. */
export const WALL_MAX_GAP_PX = 3;

/** Насколько маска стен расширяется наружу: сглаживание краёв тоже надо беречь. */
export const WALL_GUARD_PADDING_PX = 1;

export interface WallGuardOptions {
  readonly minRunPx: number;
  readonly maxThicknessPx: number;
  readonly maxGapPx: number;
  readonly paddingPx: number;
}

export const DEFAULT_WALL_GUARD: WallGuardOptions = {
  minRunPx: WALL_MIN_RUN_PX,
  maxThicknessPx: WALL_MAX_THICKNESS_PX,
  maxGapPx: WALL_MAX_GAP_PX,
  paddingPx: WALL_GUARD_PADDING_PX,
};

/**
 * Отмечает в маске длинные сплошные полосы одного направления.
 *
 * Толстые полосы пропускаются: сплошная заливка легенды тоже даёт длинные
 * строки, но стеной не является.
 */
function markRuns(
  ink: Uint8Array,
  guard: Uint8Array,
  widthPx: number,
  heightPx: number,
  horizontal: boolean,
  options: WallGuardOptions,
): void {
  const alongLength = horizontal ? widthPx : heightPx;
  const acrossLength = horizontal ? heightPx : widthPx;

  /** Сколько подряд идущих линий уже дали полосу в этом же месте. */
  const thicknessAt = new Uint16Array(alongLength);

  for (let line = 0; line < acrossLength; line += 1) {
    const inRun = new Uint8Array(alongLength);

    let start = -1;
    let gap = 0;

    const closeRun = (end: number): void => {
      if (start >= 0 && end - start + 1 >= options.minRunPx) {
        inRun.fill(1, start, end + 1);
      }
      start = -1;
      gap = 0;
    };

    for (let i = 0; i < alongLength; i += 1) {
      const index = horizontal ? line * widthPx + i : i * widthPx + line;
      if (ink[index] === 1) {
        if (start < 0) start = i;
        gap = 0;
      } else if (start >= 0) {
        gap += 1;
        if (gap > options.maxGapPx) closeRun(i - gap);
      }
    }
    closeRun(alongLength - 1 - gap);

    for (let i = 0; i < alongLength; i += 1) {
      if (inRun[i] === 1) {
        const thickness = (thicknessAt[i] ?? 0) + 1;
        thicknessAt[i] = thickness;
        // Слишком толстое место — это заливка, а не стена: не защищаем.
        if (thickness <= options.maxThicknessPx) {
          const index = horizontal ? line * widthPx + i : i * widthPx + line;
          guard[index] = 1;
        }
      } else {
        thicknessAt[i] = 0;
      }
    }
  }
}

/** Расширяет маску на несколько точек: края линий сглажены, их тоже беречь. */
function pad(guard: Uint8Array, widthPx: number, heightPx: number, radius: number): Uint8Array {
  if (radius < 1) return guard;

  const result = new Uint8Array(guard);
  for (let row = 0; row < heightPx; row += 1) {
    for (let column = 0; column < widthPx; column += 1) {
      if (guard[row * widthPx + column] !== 1) continue;
      for (let dy = -radius; dy <= radius; dy += 1) {
        const y = row + dy;
        if (y < 0 || y >= heightPx) continue;
        const from = Math.max(0, column - radius);
        const to = Math.min(widthPx - 1, column + radius);
        result.fill(1, y * widthPx + from, y * widthPx + to + 1);
      }
    }
  }
  return result;
}

/**
 * Маска стен: точки, которые очистке трогать нельзя.
 *
 * Ищутся только горизонтальные и вертикальные полосы. На поэтажных планах
 * подавляющее большинство стен ортогональны, а наклонную стену пользователь при
 * необходимости защитит вручную — это надёжнее, чем угадывать.
 */
export function buildWallGuard(
  inkMask: Uint8Array,
  widthPx: number,
  heightPx: number,
  options: WallGuardOptions = DEFAULT_WALL_GUARD,
): Uint8Array {
  const guard = new Uint8Array(inkMask.length);
  markRuns(inkMask, guard, widthPx, heightPx, true, options);
  markRuns(inkMask, guard, widthPx, heightPx, false, options);
  return pad(guard, widthPx, heightPx, options.paddingPx);
}
