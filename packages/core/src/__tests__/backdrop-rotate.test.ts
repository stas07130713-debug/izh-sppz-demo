/**
 * Поворот подложки и стирание цвета в области (ТЗ, Дополнение 6, часть С89).
 *
 * Проверяется главное свойство обоих действий: они не портят того, что должны
 * сохранить. Поворот — ни одной точки; стирание цвета — чёрных линий здания за
 * пределами обведённого.
 */

import { describe, expect, it } from 'vitest';
import type { RgbaImage } from '@izh/contracts';
import { drawLine, eraseColoredInArea, rotateImage } from '@izh/engine-plan-source';

function image(width: number, height: number, paint: (x: number, y: number) => [number, number, number]): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = paint(x, y);
      const at = (y * width + x) * 4;
      data[at] = r;
      data[at + 1] = g;
      data[at + 2] = b;
      data[at + 3] = 255;
    }
  }
  return { widthPx: width, heightPx: height, data };
}

const at = (source: RgbaImage, x: number, y: number): readonly number[] => {
  const index = (y * source.widthPx + x) * 4;
  return [source.data[index] ?? 0, source.data[index + 1] ?? 0, source.data[index + 2] ?? 0];
};

const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];
const PURPLE: [number, number, number] = [128, 0, 200];

describe('поворот подложки', () => {
  it('четверть оборота меняет стороны местами', () => {
    const source = image(4, 2, () => [255, 255, 255]);
    const turned = rotateImage(source, 1);
    expect([turned.widthPx, turned.heightPx]).toEqual([2, 4]);
  });

  it('точка из левого верхнего угла уходит в правый верхний', () => {
    // По часовой стрелке: то, что было слева сверху, оказывается сверху справа.
    const source = image(3, 2, (x, y) => (x === 0 && y === 0 ? [0, 0, 0] : [255, 255, 255]));
    const turned = rotateImage(source, 1);
    expect(at(turned, turned.widthPx - 1, 0)).toEqual(BLACK);
  });

  it('четыре четверти возвращают чертёж точка в точку', () => {
    // Ради этого поворот и сделан кратным прямому углу: он ничего не теряет.
    const source = image(5, 3, (x, y) => [x * 40, y * 60, 30]);
    let turned = source;
    for (let step = 0; step < 4; step += 1) turned = rotateImage(turned, 1);
    expect(Array.from(turned.data)).toEqual(Array.from(source.data));
    expect([turned.widthPx, turned.heightPx]).toEqual([5, 3]);
  });

  it('пол-оборота — это две четверти', () => {
    const source = image(4, 3, (x, y) => [x * 50, y * 50, 0]);
    expect(Array.from(rotateImage(source, 2).data))
      .toEqual(Array.from(rotateImage(rotateImage(source, 1), 1).data));
  });
});

describe('стирание цвета в области', () => {
  /** Слева фиолетовая стрелка, справа — такая же, но за пределами обводки. */
  const plan = (): RgbaImage => image(20, 10, (x, y) => {
    if (y === 5) return BLACK as [number, number, number]; // стена через весь чертёж
    if (y === 2 && x >= 1 && x <= 4) return PURPLE;
    if (y === 2 && x >= 15 && x <= 18) return PURPLE;
    return [255, 255, 255];
  });

  const area = { kind: 'rect' as const, rect: { x: 0, y: 0, widthPx: 8, heightPx: 4 } };

  it('цветное внутри области убирается', () => {
    const cleaned = eraseColoredInArea(plan(), {
      area, color: null, tolerance: 0, saturationThreshold: 0.15, haloRadiusPx: 0,
    });
    expect(at(cleaned, 2, 2)).toEqual(WHITE);
  });

  it('такое же цветное вне области остаётся', () => {
    // В этом весь смысл: обводка ограничивает вред тем, что человек выбрал.
    const cleaned = eraseColoredInArea(plan(), {
      area, color: null, tolerance: 0, saturationThreshold: 0.15, haloRadiusPx: 0,
    });
    expect(at(cleaned, 16, 2)).toEqual(PURPLE);
  });

  it('чёрная стена не страдает даже внутри области', () => {
    const cleaned = eraseColoredInArea(plan(), {
      area: { kind: 'rect', rect: { x: 0, y: 0, widthPx: 20, heightPx: 10 } },
      color: null, tolerance: 0, saturationThreshold: 0.15, haloRadiusPx: 0,
    });
    expect(at(cleaned, 10, 5)).toEqual(BLACK);
  });

  it('указанный цвет убирает только себя', () => {
    const source = image(6, 3, (x, y) => {
      if (y === 1 && x === 1) return PURPLE;
      if (y === 1 && x === 3) return [0, 160, 0]; // зелёная стрелка рядом
      return [255, 255, 255];
    });
    const cleaned = eraseColoredInArea(source, {
      area: { kind: 'rect', rect: { x: 0, y: 0, widthPx: 6, heightPx: 3 } },
      color: { r: 128, g: 0, b: 200 }, tolerance: 20, saturationThreshold: 0.15, haloRadiusPx: 0,
    });
    expect(at(cleaned, 1, 1)).toEqual(WHITE);
    expect(at(cleaned, 3, 1)).toEqual([0, 160, 0]);
  });

  it('кайма сглаживания снимается, но за область не выходит', () => {
    // Расширение маски обрезано областью: иначе «убрать призрак» превращалось бы
    // в «стереть заодно кусок соседней стены».
    const source = image(10, 6, (x, y) => (y === 3 && x === 8 ? PURPLE : [255, 255, 255]));
    const cleaned = eraseColoredInArea(source, {
      area: { kind: 'rect', rect: { x: 0, y: 0, widthPx: 5, heightPx: 6 } },
      color: null, tolerance: 0, saturationThreshold: 0.15, haloRadiusPx: 3,
    });
    expect(at(cleaned, 8, 3)).toEqual(PURPLE);
  });

  it('обводка от руки работает так же, как прямоугольник', () => {
    const cleaned = eraseColoredInArea(plan(), {
      area: { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 4 }, { x: 0, y: 4 }] },
      color: null, tolerance: 0, saturationThreshold: 0.15, haloRadiusPx: 0,
    });
    expect(at(cleaned, 2, 2)).toEqual(WHITE);
    expect(at(cleaned, 16, 2)).toEqual(PURPLE);
  });
});

describe('рисование линии по чертежу', () => {
  const white = (): RgbaImage => image(20, 20, () => [255, 255, 255]);

  it('прямая линия ложится между двумя точками', () => {
    // Так рисуют перегородку, которой нет на выпущенном чертеже.
    const drawn = drawLine(white(), {
      points: [{ x: 2, y: 10 }, { x: 17, y: 10 }],
      color: { r: 0, g: 0, b: 0 },
      widthPx: 1,
    });
    expect(at(drawn, 2, 10)).toEqual(BLACK);
    expect(at(drawn, 10, 10)).toEqual(BLACK);
    expect(at(drawn, 17, 10)).toEqual(BLACK);
  });

  it('линия не разваливается на точки', () => {
    // Кисть ставится с шагом в половину радиуса: реже — и линия рассыпается.
    const drawn = drawLine(white(), {
      points: [{ x: 2, y: 2 }, { x: 17, y: 17 }],
      color: { r: 0, g: 0, b: 0 },
      widthPx: 2,
    });
    for (let step = 3; step <= 16; step += 1) {
      expect(at(drawn, step, step), `точка ${step}`).toEqual(BLACK);
    }
  });

  it('от руки — та же линия, только точек больше', () => {
    const drawn = drawLine(white(), {
      points: [{ x: 2, y: 2 }, { x: 6, y: 9 }, { x: 12, y: 4 }],
      color: { r: 0, g: 0, b: 0 },
      widthPx: 1,
    });
    expect(at(drawn, 6, 9)).toEqual(BLACK);
    expect(at(drawn, 12, 4)).toEqual(BLACK);
  });

  it('толщина задаётся в точках чертежа', () => {
    const thin = drawLine(white(), { points: [{ x: 10, y: 2 }, { x: 10, y: 17 }], color: { r: 0, g: 0, b: 0 }, widthPx: 1 });
    const thick = drawLine(white(), { points: [{ x: 10, y: 2 }, { x: 10, y: 17 }], color: { r: 0, g: 0, b: 0 }, widthPx: 6 });
    expect(at(thin, 12, 10)).toEqual(WHITE);
    expect(at(thick, 12, 10)).toEqual(BLACK);
  });

  it('цвет берётся тот, что задали', () => {
    const drawn = drawLine(white(), {
      points: [{ x: 2, y: 10 }, { x: 17, y: 10 }],
      color: { r: 220, g: 38, b: 38 },
      widthPx: 2,
    });
    expect(at(drawn, 10, 10)).toEqual([220, 38, 38]);
  });

  it('за края чертежа линия не выходит', () => {
    // Рука уводит мышь за подложку постоянно: выйти за массив нельзя.
    const drawn = drawLine(white(), {
      points: [{ x: -50, y: 10 }, { x: 80, y: 10 }],
      color: { r: 0, g: 0, b: 0 },
      widthPx: 3,
    });
    expect([drawn.widthPx, drawn.heightPx]).toEqual([20, 20]);
    expect(at(drawn, 0, 10)).toEqual(BLACK);
    expect(at(drawn, 19, 10)).toEqual(BLACK);
  });

  it('одна точка — это точка, а не пустое место', () => {
    const drawn = drawLine(white(), { points: [{ x: 10, y: 10 }], color: { r: 0, g: 0, b: 0 }, widthPx: 4 });
    expect(at(drawn, 10, 10)).toEqual(BLACK);
  });
});
