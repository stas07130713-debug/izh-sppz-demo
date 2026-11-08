/**
 * Строка объектов, ожидающих размещения на плане.
 *
 * Объект можно завести до того, как появился план: элементы переносятся в
 * рабочую область и выстраиваются здесь, пока подложка не загружена. Сюда же
 * попадает всё, что пришло переносом журнала.
 *
 * Отсюда же оборудование переносят на другой этаж или в другое здание: до
 * плана дело может и не дойти — привезли не туда, и это выясняется сразу.
 * Поэтому здесь работает то же выделение, что на плане и в журнале.
 *
 * Строка — не украшение, а незакрытая работа: план и журнал показывают одно и
 * то же оборудование, и пока здесь есть записи, это равенство нарушено. Снять
 * объект с плана в эту строку нельзя: она заполняется только тем, что пришло
 * без координат, и опустеть должна.
 *
 * Смотри docs/02_ТЗ_редакция_3.md, часть 7.3.
 */

import type { PlanObject } from '@izh/contracts';
import { elementByCode } from '@izh/core';
import { ElementIcon } from './ElementIcon';
import type { PickMode } from './plan-selection';

export interface PendingStripProps {
  readonly objects: readonly PlanObject[];
  readonly selectedObjectId: string | null;
  readonly hasPlan: boolean;
  readonly onSelectObject: (objectId: string) => void;
  /** Общий с планом и журналом набор выделенного. */
  readonly selectedIds: ReadonlySet<string>;
  readonly onSelectMany: (objectIds: readonly string[], mode: PickMode) => void;
  /** Правая кнопка по единице: то же меню, что и на плане. */
  readonly onContextMenu: (object: PlanObject, screenPosition: { x: number; y: number }) => void;
}

export function PendingStrip(props: PendingStripProps): React.JSX.Element | null {
  const picked = props.objects.filter((object) => props.selectedIds.has(object.id)).length;

  if (props.objects.length === 0) return null;

  return (
    <div className="pending-strip">
      <div className="pending-title">
        Требуют размещения на плане: {props.objects.length}
        <span className="muted small">
          {props.hasPlan
            ? ' — перетащите значок на план'
            : ' — ждут загрузки плана; записи в журнале уже есть'}
        </span>

        {/* Ctrl набирает по одному, ссылка — все сразу: привезённую партию
            переносят целиком, и щёлкать по каждому незачем. */}
        <button
          type="button"
          className="link"
          onClick={() => props.onSelectMany(
            props.objects.map((object) => object.id),
            picked === props.objects.length ? 'remove' : 'add',
          )}
        >
          {picked === props.objects.length ? 'снять выделение' : 'выделить все'}
        </button>
        {picked > 0 && <span className="muted small">выделено: {picked}</span>}
      </div>

      <ul className="pending-list">
        {props.objects.map((object) => {
          const element = elementByCode(object.typeCode);
          return (
            <li key={object.id}>
              <button
                type="button"
                className={[
                  'pending-item',
                  object.id === props.selectedObjectId ? 'selected' : '',
                  props.selectedIds.has(object.id) ? 'picked' : '',
                ].join(' ').trim()}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'object', id: object.id }));
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onClick={(event) => {
                  if (event.ctrlKey || event.metaKey) props.onSelectMany([object.id], 'toggle');
                  else props.onSelectObject(object.id);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  props.onContextMenu(object, { x: event.clientX, y: event.clientY });
                }}
                title={element?.title ?? object.typeCode}
              >
                <ElementIcon typeCode={object.typeCode} />
                <span className="small">
                  {object.regNumber ?? element?.title ?? object.typeCode}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
