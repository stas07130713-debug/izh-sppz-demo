/**
 * Куда поставить всплывающее меню, чтобы оно осталось на экране.
 *
 * Меню открывается там, где щёлкнули, — и на этом всё ломается. Полоса «требуют
 * размещения» лежит внизу окна, и меню от неё уходило под нижний край: пункты
 * есть, а увидеть их нельзя. Так же ведёт себя любое меню у правого края.
 *
 * Правило простое и привычное по другим программам:
 *
 *  1. не помещается вниз — открываем вверх от курсора;
 *  2. не помещается вправо — открываем влево;
 *  3. не помещается и так — прижимаем к краю и даём прокрутку внутри меню:
 *     край лучше, чем за экраном, а прокрутка лучше, чем обрезанный список.
 *
 * Отступ от края оставляется намеренно: меню, приклеенное вплотную, выглядит
 * обрезанным, и по нему непонятно, всё ли видно.
 *
 * Здесь два способа поставить меню, и они не взаимозаменяемы:
 *
 * - useMenuPlacement — для меню по правой кнопке: оно открывается в точке
 *   курсора, и других привязок у него нет;
 * - useAnchoredMenu — для списка под кнопкой: он должен держаться своей кнопки,
 *   даже когда та уехала при прокрутке, и раскрываться вверх, если под кнопкой
 *   места нет.
 */

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

export interface MenuPosition {
  readonly left: number;
  readonly top: number;
  /**
   * Предел высоты, когда меню выше окна.
   *
   * null — вписалось целиком и ограничивать нечего. Число — внутри меню будет
   * прокрутка: список длиннее экрана бывает у выгрузки форматов и у дерева с
   * развёрнутой формой.
   */
  readonly maxHeight: number | null;
}

/** Отступ от края окна, точки. */
export const MENU_MARGIN_PX = 8;

export function fitOnScreen(
  x: number,
  y: number,
  widthPx: number,
  heightPx: number,
  viewportWidth: number,
  viewportHeight: number,
  margin = MENU_MARGIN_PX,
): MenuPosition {
  const room = viewportHeight - 2 * margin;
  const height = Math.min(heightPx, room);
  const flippedLeft = x + widthPx + margin > viewportWidth ? x - widthPx : x;
  const flippedTop = y + height + margin > viewportHeight ? y - height : y;

  return {
    left: clamp(flippedLeft, margin, viewportWidth - widthPx - margin),
    top: clamp(flippedTop, margin, viewportHeight - height - margin),
    maxHeight: heightPx > room ? room : null,
  };
}

/**
 * Куда поставить список, раскрывающийся от кнопки.
 *
 * Под кнопкой места нет — раскрываем над ней. Это не то же самое, что переворот
 * от курсора: список должен примыкать к своей кнопке, иначе непонятно, чей он.
 *
 * По правому краю список равняется правым краем кнопки: так его пункты
 * начинаются там же, где название кнопки, и не уезжают за окно.
 */
export function fitUnderAnchor(
  anchor: { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number },
  widthPx: number,
  heightPx: number,
  viewportWidth: number,
  viewportHeight: number,
  gap = 4,
  margin = MENU_MARGIN_PX,
): MenuPosition {
  const below = viewportHeight - anchor.bottom - gap - margin;
  const above = anchor.top - gap - margin;
  const openUp = heightPx > below && above > below;
  const room = Math.max(0, openUp ? above : below);
  const height = Math.min(heightPx, room);

  return {
    left: clamp(anchor.right - widthPx, margin, viewportWidth - widthPx - margin),
    top: openUp ? Math.max(margin, anchor.top - gap - height) : anchor.bottom + gap,
    maxHeight: heightPx > room ? room : null,
  };
}

/**
 * Зажимает значение в границы, а если границы вывернуты — прижимает к началу.
 *
 * Вывернуты они, когда меню шире самого окна: тогда «не выходить за оба края»
 * невыполнимо, и выбирается левый край. Остальное показывает прокрутка.
 */
function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Свой размер меню, а не тот, до которого его уже ужали.
 *
 * Когда предел высоты наложен, обычное измерение вернёт именно этот предел —
 * и получится, что меню «поместилось». На следующем пересчёте предел снялся
 * бы, меню снова стало высоким, и так по кругу. Поэтому высота берётся по
 * содержимому, с добавкой на рамку.
 */
function naturalSize(element: HTMLElement): { readonly width: number; readonly height: number } {
  const frame = element.offsetHeight - element.clientHeight;
  return { width: element.offsetWidth, height: element.scrollHeight + frame };
}

function styleOf(at: MenuPosition | null): CSSProperties {
  if (at === null) return { left: 0, top: 0, visibility: 'hidden' };
  return at.maxHeight === null
    ? { left: at.left, top: at.top }
    : { left: at.left, top: at.top, maxHeight: at.maxHeight, overflowY: 'auto' };
}

/**
 * Считает положение меню по его настоящему размеру и отдаёт готовый стиль.
 *
 * Первой отрисовкой меню ставится в угол и скрывается: там оно занимает свою
 * природную ширину, и её можно измерить. Заранее размер не вычислить — в меню
 * разное число пунктов и разной длины названия.
 *
 * Измерение идёт после разметки, но до отрисовки, поэтому мигнуть в углу меню
 * не успевает.
 *
 * revision передают, когда меню меняет размер, не меняя места: в дереве по
 * пункту «добавить» разворачивается форма, и высота становится другой.
 */
export function useMenuPlacement(
  ref: RefObject<HTMLElement | null>,
  x: number,
  y: number,
  revision: string | number = '',
): CSSProperties {
  const key = `${x}:${y}:${revision}`;
  const [state, setState] = useState<{ key: string; at: MenuPosition | null }>({ key, at: null });

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    if (state.key === key && state.at !== null) return;

    const box = naturalSize(element);
    setState({ key, at: fitOnScreen(x, y, box.width, box.height, window.innerWidth, window.innerHeight) });
  });

  return styleOf(state.key === key ? state.at : null);
}

/**
 * То же для списка под кнопкой.
 *
 * Положение пересчитывается на прокрутку и изменение окна: список нарисован
 * поверх страницы, и без пересчёта он остался бы висеть там, где кнопки уже
 * нет. Проще было бы закрывать его на прокрутку, но тогда пропадал бы список,
 * до которого человек как раз дотягивается колесом.
 */
export function useAnchoredMenu(
  menuRef: RefObject<HTMLElement | null>,
  anchorRef: RefObject<HTMLElement | null>,
  open: boolean,
  revision: string | number = '',
): CSSProperties {
  const [at, setAt] = useState<MenuPosition | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      if (at !== null) setAt(null);
      return;
    }

    const place = (): void => {
      const menu = menuRef.current;
      const anchor = anchorRef.current;
      if (menu === null || anchor === null) return;

      const box = naturalSize(menu);
      const from = anchor.getBoundingClientRect();
      const next = fitUnderAnchor(from, box.width, box.height, window.innerWidth, window.innerHeight);
      setAt((current) => (current !== null
        && current.left === next.left
        && current.top === next.top
        && current.maxHeight === next.maxHeight ? current : next));
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
    // Пересчёт нужен на открытие и на смену содержимого; за остальным
    // следят слушатели прокрутки и размера окна.
  }, [open, revision, menuRef, anchorRef]);

  return styleOf(open ? at : null);
}
