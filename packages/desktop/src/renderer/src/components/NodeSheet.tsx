/**
 * Карточка узла: панель, выезжающая снизу в левом поле.
 *
 * Заказчик: «карточка узла должна раскрываться только в рамках левого окна,
 * только сделай до самого верха. Проблема была в том, что сама кнопка открыть
 * и скрыть карточку узла была плохо сделана — нужно, чтобы она была
 * контрастной и нормально выглядела; потом повторно нажимаешь — карточка
 * уходит вниз, как была».
 *
 * Поэтому панель занимает левое поле целиком, от самого верха до низа, и
 * закрывается той же полосой, которой открывалась: полоса стоит на одном и том
 * же месте — у нижнего края левого поля — и в свёрнутом виде, и в раскрытом.
 * Движение читается как выдвижной ящик: вверх — открыть, вниз — убрать.
 *
 * Высоту панель не делит с деревом: пока карточку правят, дерево не нужно, а
 * делённая пополам колонка в 340 точек не годится ни для того, ни для другого.
 */

import { useEffect } from 'react';
import { NodeCard, type NodeCardProps } from './NodeCard';

export interface NodeSheetProps extends NodeCardProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function NodeSheet(props: NodeSheetProps): React.JSX.Element | null {
  const { open, onClose, ...card } = props;

  // Escape закрывает панель — как и всякое временное окно в программе.
  useEffect(() => {
    if (!open) return undefined;
    const close = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <section className="node-sheet" role="dialog" aria-label="Карточка узла">
      <NodeCard {...card} />

      {/*
        * Та же полоса, что открывала карточку, и на том же месте. Отдельного
        * крестика в углу нет намеренно: он был мелкой целью в стороне от того
        * места, куда человек нажимал, чтобы карточку открыть.
        */}
      <button
        type="button"
        className="card-toggle open"
        title="Скрыть карточку узла (Escape)"
        onClick={onClose}
      >
        ▼ Скрыть карточку узла
      </button>
    </section>
  );
}
