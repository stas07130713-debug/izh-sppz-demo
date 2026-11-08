/**
 * Контекстное меню объекта на плане (ТЗ, Дополнение 3, часть К7).
 *
 * Правая кнопка мыши по значку открывает две операции: «Переместить» — на
 * другой узел дерева, «Поменять местами» — обмен местом с уже заведённым
 * оборудованием: снятый на перезарядку уезжает туда, откуда пришёл подменный.
 * Меню — временный слой поверх плана, закрывается щелчком мимо или Escape.
 */

import { useEffect, useRef } from 'react';
import { useMenuPlacement } from '../menu-placement';

export interface ObjectContextMenuProps {
  readonly x: number;
  readonly y: number;
  readonly onMove: () => void;
  readonly onReplace: () => void;
  readonly onArchive: () => void;
  readonly onShowInJournal?: () => void;
  readonly onShowOnPlan?: () => void;
  readonly onClose: () => void;
}

export function ObjectContextMenu(props: ObjectContextMenuProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  // Меню не должно уходить за край окна: у полосы «требуют размещения» оно
  // открывается у самого низа и иначе целиком оказывается под экраном.
  const style = useMenuPlacement(ref, props.x, props.y);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent): void => {
      if (ref.current !== null && !ref.current.contains(event.target as Node)) props.onClose();
    };
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') props.onClose();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [props.onClose]);

  return (
    <div ref={ref} className="context-menu" style={style}>
      {props.onShowInJournal !== undefined && <button type="button" onClick={props.onShowInJournal}>Показать в журнале</button>}
      {props.onShowOnPlan !== undefined && <button type="button" onClick={props.onShowOnPlan}>Показать на плане</button>}
      <button type="button" onClick={props.onMove}>
        Переместить…
      </button>
      <button type="button" onClick={props.onReplace}>
        Поменять местами…
      </button>
      <button type="button" onClick={props.onArchive}>
        Вывести из эксплуатации
      </button>
    </div>
  );
}
