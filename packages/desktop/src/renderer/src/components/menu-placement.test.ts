/**
 * Всплывающее меню не должно уходить за край окна (ТЗ, Дополнение 6, часть С90).
 *
 * Заказчик: «когда нажимаешь ПКМ на объекты, которые не расставлены на плане, то
 * окно открывается ниже видимого экрана и его не видно… все меню должны быть
 * видны при их открытии».
 *
 * Проверяется одно свойство, зато для всех случаев: что бы ни пришло на вход,
 * меню целиком помещается в окно. Отдельно закреплено поведение списка под
 * кнопкой: он раскрывается вверх, если под кнопкой места нет.
 */

import { describe, expect, it } from 'vitest';
import { MENU_MARGIN_PX, fitOnScreen, fitUnderAnchor } from '../menu-placement';

const VIEW = { width: 1280, height: 720 };

/** Помещается ли меню целиком, с учётом наложенного предела высоты. */
function fits(at: { left: number; top: number; maxHeight: number | null }, width: number, height: number): boolean {
  const shown = at.maxHeight === null ? height : at.maxHeight;
  return at.left >= 0 && at.top >= 0
    && at.left + width <= VIEW.width
    && at.top + shown <= VIEW.height;
}

describe('меню по правой кнопке', () => {
  it('у нижнего края раскрывается вверх', () => {
    // Полоса «требуют размещения» лежит внизу окна: меню от неё уходило под край.
    const at = fitOnScreen(40, 700, 200, 166, VIEW.width, VIEW.height);
    expect(at.top).toBe(700 - 166);
    expect(fits(at, 200, 166)).toBe(true);
  });

  it('у правого края раскрывается влево', () => {
    const at = fitOnScreen(1260, 100, 200, 166, VIEW.width, VIEW.height);
    expect(at.left).toBe(1260 - 200);
    expect(fits(at, 200, 166)).toBe(true);
  });

  it('в самом углу помещается по обеим сторонам', () => {
    const at = fitOnScreen(1279, 719, 200, 166, VIEW.width, VIEW.height);
    expect(fits(at, 200, 166)).toBe(true);
  });

  it('меню выше окна прижимается к верху и получает прокрутку', () => {
    // Обрезать список нельзя: нижние пункты — тоже команды. Прокрутка внутри
    // меню оставляет их доступными.
    const at = fitOnScreen(40, 700, 200, 2000, VIEW.width, VIEW.height);
    expect(at.top).toBe(MENU_MARGIN_PX);
    expect(at.maxHeight).toBe(VIEW.height - 2 * MENU_MARGIN_PX);
    expect(fits(at, 200, 2000)).toBe(true);
  });

  it('помещается при любом положении курсора и любом размере меню', () => {
    for (const x of [0, 1, 300, 900, 1279, 1280]) {
      for (const y of [0, 1, 300, 700, 719, 720]) {
        for (const [w, h] of [[160, 40], [200, 166], [300, 700], [200, 1500]] as const) {
          const at = fitOnScreen(x, y, w, h, VIEW.width, VIEW.height);
          expect(fits(at, w, h), `x=${x} y=${y} ${w}×${h}`).toBe(true);
        }
      }
    }
  });
});

describe('список под кнопкой', () => {
  const anchor = (top: number, height = 30) => ({ left: 1000, right: 1160, top, bottom: top + height });

  it('обычно раскрывается вниз от кнопки', () => {
    const at = fitUnderAnchor(anchor(100), 168, 160, VIEW.width, VIEW.height);
    expect(at.top).toBe(134);
    expect(fits(at, 168, 160)).toBe(true);
  });

  it('у нижнего края раскрывается вверх от кнопки', () => {
    // Кнопка выгрузки стоит в нижней панели: список под ней не помещался.
    const at = fitUnderAnchor(anchor(660), 168, 160, VIEW.width, VIEW.height);
    expect(at.top).toBe(660 - 4 - 160);
    expect(fits(at, 168, 160)).toBe(true);
  });

  it('правым краем равняется по кнопке', () => {
    const at = fitUnderAnchor(anchor(100), 168, 160, VIEW.width, VIEW.height);
    expect(at.left).toBe(1160 - 168);
  });

  it('не выходит за левый край, когда список шире места до него', () => {
    const at = fitUnderAnchor(
      { left: 0, right: 120, top: 100, bottom: 130 }, 400, 160, VIEW.width, VIEW.height,
    );
    expect(at.left).toBe(MENU_MARGIN_PX);
  });

  it('список выше любого места получает прокрутку и остаётся в окне', () => {
    const at = fitUnderAnchor(anchor(340), 168, 2000, VIEW.width, VIEW.height);
    expect(at.maxHeight).not.toBeNull();
    expect(fits(at, 168, 2000)).toBe(true);
  });

  it('помещается при любом положении кнопки', () => {
    for (const top of [0, 40, 200, 500, 690, 719]) {
      for (const [w, h] of [[168, 60], [168, 300], [300, 900]] as const) {
        const at = fitUnderAnchor(anchor(top), w, h, VIEW.width, VIEW.height);
        expect(fits(at, w, h), `top=${top} ${w}×${h}`).toBe(true);
      }
    }
  });
});
