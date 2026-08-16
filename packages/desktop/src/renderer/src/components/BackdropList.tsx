/** Список созданных подложек. Пока плоский; когда появится дерево объекта,
 *  подложки встанут под своими этажами. */

import type { PlanBackdrop } from '@izh/contracts';
import { formatDateTime, formatPixels } from '../format';

export interface BackdropListProps {
  readonly items: readonly PlanBackdrop[];
  readonly selectedId: string | null;
  readonly calibratedIds: ReadonlySet<string>;
  readonly onSelect: (id: string) => void;
  readonly onRemove: (id: string) => void;
}

export function BackdropList(props: BackdropListProps): React.JSX.Element {
  if (props.items.length === 0) {
    return <p className="muted small">Подложек пока нет. Загрузите план — это первый шаг.</p>;
  }

  return (
    <ul className="backdrop-list">
      {props.items.map((item) => (
        <li key={item.id} className={item.id === props.selectedId ? 'selected' : ''}>
          <button type="button" className="row" onClick={() => props.onSelect(item.id)}>
            <span className="name" title={item.sourceFileName}>
              {item.sourceFileName}
            </span>
            <span className="muted small">
              {item.sourceKind === 'pdf' ? `стр. ${item.pageNumber}, ${item.dpi ?? '—'} dpi` : 'изображение'}
              {' · '}
              {formatPixels(item.widthPx, item.heightPx)}
            </span>
            <span className="muted small">{formatDateTime(item.createdAt)}</span>
            <span className={props.calibratedIds.has(item.id) ? 'badge ok' : 'badge warn'}>
              {props.calibratedIds.has(item.id) ? 'масштаб задан' : 'без масштаба'}
            </span>
          </button>
          <button
            type="button"
            className="link danger"
            onClick={() => props.onRemove(item.id)}
            title="Удалить подложку"
          >
            удалить
          </button>
        </li>
      ))}
    </ul>
  );
}
