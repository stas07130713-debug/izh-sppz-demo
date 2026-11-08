/**
 * Закрытие окна щелчком по затемнению — без ложных срабатываний.
 *
 * Заказчик: «когда просто выделяешь текст, чтобы скопировать его, то выкидывает
 * из этого окна».
 *
 * Так и было. Окно закрывалось по любому щелчку, пришедшему на затемнение, а
 * щелчок в браузере считается по **отпусканию** кнопки: начал выделять текст
 * внутри окна, повёл мышь и отпустил чуть за его краем — и окно закрылось,
 * унеся с собой и выделение, и то, ради чего его открывали.
 *
 * Поэтому закрытие требует двух условий сразу: нажали по затемнению и отпустили
 * тоже по нему. Тогда «щёлкнул мимо окна» закрывает, а «вёл мышью и вышел за
 * край» — нет.
 *
 * Место нажатия помнится одно на всю программу: указатель у мыши один, и двух
 * начатых нажатий одновременно не бывает. Заводить на это состояние в каждом из
 * семнадцати окон значило бы семнадцать раз написать одно и то же.
 */

import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';

/** Началось ли последнее нажатие на самом затемнении, а не внутри окна. */
let startedOnBackdrop = false;

export interface BackdropHandlers {
  readonly onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onClick: (event: ReactMouseEvent<HTMLElement>) => void;
}

export function backdropClose(onClose: () => void): BackdropHandlers {
  return {
    onPointerDown: (event) => {
      startedOnBackdrop = event.target === event.currentTarget;
    },
    onClick: (event) => {
      if (event.target !== event.currentTarget || !startedOnBackdrop) return;
      startedOnBackdrop = false;
      onClose();
    },
  };
}
