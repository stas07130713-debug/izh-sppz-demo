/**
 * Приближение колесом мыши — для плана и для журнала.
 *
 * Кнопки «−» и «+» остаются: колесом хорошо подбирать величину на глаз, а
 * кнопками — вернуться к известной. Одно другого не заменяет.
 *
 * Колесо ведёт себя по-разному там, где под ним чертёж, и там, где таблица.
 *
 * На плане колесо приближает без всяких клавиш: план — рисунок, его смотрят, а
 * не листают, и так же устроен редактор подложки. Точка под курсором при этом
 * остаётся на месте: прокрутка подтягивается вслед за размером, иначе
 * приближение уводило бы взгляд в левый верхний угол.
 *
 * В журнале обычное колесо листает строки — иначе до нижних записей не
 * добраться. Приближение там на Ctrl (и на ⌘), как в таблицах и браузере.
 *
 * Обработчик вешается сам, а не через onWheel. React слушает колесо на корне
 * страницы и слушает пассивно: отменить прокрутку из onWheel нельзя, браузер
 * такую отмену просто игнорирует.
 *
 * ── Почему приближение дрожало ──
 *
 * Заказчик: «иногда подложка, когда уменьшаешь её размер или увеличиваешь,
 * заедает и начинает дрожать». Причин было две, и обе — в порядке событий.
 *
 * Первая: обработчик снимался и вешался заново на каждое изменение величины.
 * Колесо шлёт события подряд, десятками в секунду, и те из них, что попадали
 * в промежуток между снятием и подпиской, пропадали. Со стороны это и есть
 * «заедает»: колесо крутится, а план стоит.
 *
 * Вторая: прокрутка подтягивалась в `requestAnimationFrame`, то есть до того,
 * как React успевал перерисовать план новой ширины. Прокрутка обрезалась по
 * старым, ещё не выросшим границам, а после перерисовки вставала иначе — и
 * план на каждом щелчке дёргался назад и вперёд.
 *
 * Теперь обработчик вешается один раз, величина живёт в ссылке, а прокрутка
 * задаётся в `useLayoutEffect` — после того как новая ширина уже в разметке,
 * но до того, как экран нарисован. Дёргаться нечему.
 */

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

export interface WheelZoomOptions {
  /** Пределы в процентах. */
  readonly min: number;
  readonly max: number;
  /** Шаг одного щелчка колеса, в процентах. */
  readonly step: number;
  /**
   * Приближать ли обычным колесом, без Ctrl.
   *
   * true — для чертежа, false — для таблицы, где колесо занято прокруткой.
   */
  readonly plain: boolean;
  /**
   * Держать ли точку под курсором на месте.
   *
   * Имеет смысл, когда окно из ref само прокручивает содержимое: без этого
   * приближение всякий раз уезжает в левый верхний угол.
   */
  readonly anchor: boolean;
}

/** Точка, которую нужно удержать под курсором после перерисовки. */
interface Anchor {
  /** Где эта точка внутри фактически нарисованного содержимого — долей. */
  readonly atX: number;
  readonly atY: number;
  /** Где курсор внутри окна прокрутки. */
  readonly shiftX: number;
  readonly shiftY: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function useWheelZoom(
  ref: RefObject<HTMLElement | null>,
  zoom: number,
  setZoom: (zoom: number) => void,
  options: WheelZoomOptions,
): void {
  const { min, max, step, plain, anchor } = options;

  /**
   * Последняя заказанная величина.
   *
   * Отдельно от нарисованной: пока идёт перерисовка, колесо успевает щёлкнуть
   * ещё раз, и складывать шаг надо с заказанным, иначе половина щелчков
   * пропадёт.
   */
  const wantedRef = useRef(zoom);
  const pendingRef = useRef<Anchor | null>(null);
  const setZoomRef = useRef(setZoom);
  setZoomRef.current = setZoom;

  useLayoutEffect(() => {
    const area = ref.current;
    const pending = pendingRef.current;
    pendingRef.current = null;
    // Величину могли сменить и не колесом — кнопкой, возвратом «по окну».
    // Тогда заказанное подтягивается к ней, чтобы следующий щелчок считался
    // от того, что человек видит.
    wantedRef.current = zoom;

    if (area === null || pending === null) return;
    const content = area.firstElementChild;
    if (content === null) return;
    const areaBox = area.getBoundingClientRect();
    const contentBox = content.getBoundingClientRect();
    // Считаем поправку по настоящей рамке чертежа после перерисовки. Это
    // учитывает вписывание по высоте, центрирование и переход через 100%, где
    // появляются полосы прокрутки. Формула по одним процентам этого не знала
    // и уводила точку вместе со значком от курсора.
    area.scrollLeft += contentBox.left + pending.atX * contentBox.width
      - (areaBox.left + pending.shiftX);
    area.scrollTop += contentBox.top + pending.atY * contentBox.height
      - (areaBox.top + pending.shiftY);
  }, [ref, zoom]);

  useEffect(() => {
    const area = ref.current;
    if (area === null) return;

    const onWheel = (event: WheelEvent): void => {
      if (!plain && !event.ctrlKey && !event.metaKey) return;
      // Ctrl с колесом в Electron меняет размер шрифта всего окна. Здесь это
      // не нужно: увеличивается план или таблица, а не программа целиком.
      event.preventDefault();

      const next = clamp(wantedRef.current + (event.deltaY < 0 ? step : -step), min, max);
      if (next === wantedRef.current) return;
      wantedRef.current = next;

      if (anchor) {
        // Куда смотрит курсор — в долях от прокручиваемого содержимого. Доля
        // считается от нарисованной величины: прокрутка сейчас отвечает ей.
        const box = area.getBoundingClientRect();
        const shiftX = event.clientX - box.left;
        const shiftY = event.clientY - box.top;
        const content = area.firstElementChild;
        const contentBox = content?.getBoundingClientRect();
        pendingRef.current = contentBox === undefined || contentBox.width <= 0 || contentBox.height <= 0
          ? null
          : {
            atX: clamp((event.clientX - contentBox.left) / contentBox.width, 0, 1),
            atY: clamp((event.clientY - contentBox.top) / contentBox.height, 0, 1),
            shiftX,
            shiftY,
          };
      }

      setZoomRef.current(next);
    };

    area.addEventListener('wheel', onWheel, { passive: false });
    return () => area.removeEventListener('wheel', onWheel);
  }, [ref, min, max, step, plain, anchor]);
}
