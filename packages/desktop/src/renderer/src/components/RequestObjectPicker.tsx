/**
 * Выбор оборудования для заявки (ТЗ, Дополнение 6, часть С54).
 *
 * Список устроен как журнал — те же графы и тот же порядок чтения, — но с
 * галочками и с иной сортировкой: **сначала снятое в ремонт, потом неисправное
 * и просроченное**. Заявку подают именно на него, и листать до него через
 * сотню исправных строк незачем.
 *
 * Полка ремонта впереди всего: туда складывают снятое именно затем, чтобы
 * сдать его на перезарядку или в мастерскую. Заявка — следующий шаг после
 * этого снятия, и собирать её удобнее прямо оттуда.
 *
 * Несколько строк выделяются протяжкой с Shift, как в таблице: отмечать сорок
 * извещателей по одному никто не станет.
 */

import { useState } from 'react';
import type { MaintenanceEvent, PlanObject, TechnicalState, TreeNode } from '@izh/contracts';
import { nodeTitle, technicalEscalation, technicalStateForObject, elementByCode } from '@izh/core';
import { ElementIcon } from './ElementIcon';
import { technicalStatusClass } from './journal-summaries';

export interface RequestObjectPickerProps {
  readonly objects: readonly PlanObject[];
  readonly nodes: readonly TreeNode[];
  readonly events: readonly MaintenanceEvent[];
  /** Уже просроченные элементы — их строки поднимаются наверх вместе с неисправными. */
  readonly overdueIds: ReadonlySet<string>;
  readonly selected: ReadonlySet<string>;
  readonly onChange: (selected: ReadonlySet<string>) => void;
}

interface Row {
  readonly object: PlanObject;
  readonly state: TechnicalState;
  readonly place: string;
  /** Насколько тревожен элемент: по нему и сортируется список. */
  readonly rank: number;
}

export function RequestObjectPicker(props: RequestObjectPickerProps): React.JSX.Element {
  /** Якорь протяжки: с какой строки начали выделять с Shift. */
  const [anchor, setAnchor] = useState<number | null>(null);

  const rows: readonly Row[] = props.objects
    .map((object) => {
      const state = technicalStateForObject(object, props.events);
      const node = props.nodes.find((item) => item.id === object.nodeId);
      const faulty = technicalEscalation(state) !== null;
      const inRepair = object.storageSection === 'ремонт';
      // Снятое в ремонт впереди всего: заявку собирают именно с этой полки.
      // Дальше неисправное — сломанное чинят раньше, чем проверяют вовремя
      // работающее, — и только потом просроченное.
      const rank = inRepair ? 0 : faulty ? 1 : props.overdueIds.has(object.id) ? 2 : 3;
      const place = node === undefined
        ? '—'
        : inRepair ? `${nodeTitle(node)}, в ремонте`
          : object.storageSection === 'резерв' ? `${nodeTitle(node)}, резерв`
            : nodeTitle(node);
      return { object, state, place, rank };
    })
    .sort((a, b) => a.rank - b.rank
      || (a.object.regNumber ?? '').localeCompare(b.object.regNumber ?? '', 'ru'));

  const setOne = (id: string, on: boolean): void => {
    const next = new Set(props.selected);
    if (on) next.add(id);
    else next.delete(id);
    props.onChange(next);
  };

  /** Щелчок по строке: с Shift — от якоря до неё, иначе одна строка. */
  const click = (index: number, shiftKey: boolean): void => {
    const row = rows[index];
    if (row === undefined) return;

    if (shiftKey && anchor !== null) {
      const from = Math.min(anchor, index);
      const to = Math.max(anchor, index);
      const next = new Set(props.selected);
      // Протяжка добавляет, а не переключает: иначе внутри выделенного куска
      // строки снимались бы обратно, и результат зависел бы от направления.
      for (let at = from; at <= to; at += 1) {
        const item = rows[at];
        if (item !== undefined) next.add(item.object.id);
      }
      props.onChange(next);
      return;
    }

    setAnchor(index);
    setOne(row.object.id, !props.selected.has(row.object.id));
  };

  const allSelected = rows.length > 0 && rows.every((row) => props.selected.has(row.object.id));
  const alarming = rows.filter((row) => row.rank < 3);
  const repair = rows.filter((row) => row.rank === 0);

  return (
    <div className="request-picker">
      <div className="request-picker-actions">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => props.onChange(allSelected ? new Set() : new Set(rows.map((row) => row.object.id)))}
          />
          <span className="small">Все {rows.length}</span>
        </label>
        {/* Полка ремонта отдельной кнопкой: заявку на перезарядку и
            обслуживание собирают именно с неё, целиком. */}
        <button
          type="button"
          disabled={repair.length === 0}
          onClick={() => props.onChange(new Set(repair.map((row) => row.object.id)))}
        >
          Всё из ремонта и обслуживания ({repair.length})
        </button>
        <button
          type="button"
          disabled={alarming.length === 0}
          onClick={() => props.onChange(new Set(alarming.map((row) => row.object.id)))}
        >
          Только требующие внимания ({alarming.length})
        </button>
        <span className="muted small">Отмечено: {props.selected.size}</span>
      </div>

      <p className="muted small">
        Щелчок отмечает строку, щелчок с Shift — все строки от предыдущей отметки до этой.
      </p>

      <div className="request-picker-table">
        <table className="journal-table">
          <thead>
            <tr>
              <th />
              <th>Наименование</th>
              <th>Учётный номер</th>
              <th>Место установки</th>
              <th>Состояние</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.object.id}
                className={props.selected.has(row.object.id) ? 'journal-row picked' : 'journal-row'}
                onClick={(event) => click(index, event.shiftKey)}
              >
                <td>
                  <input
                    type="checkbox"
                    checked={props.selected.has(row.object.id)}
                    onChange={() => undefined}
                    onClick={(event) => event.stopPropagation()}
                    onMouseDown={(event) => { event.preventDefault(); click(index, event.shiftKey); }}
                  />
                </td>
                <td>
                  <ElementIcon typeCode={row.object.typeCode} />{' '}
                  {row.object.model ?? elementByCode(row.object.typeCode)?.title ?? row.object.typeCode}
                </td>
                <td className="journal-reg-number">{row.object.regNumber ?? '(без номера)'}</td>
                <td className="muted small">{row.place}</td>
                <td>
                  <span className={`status-pill ${technicalStatusClass(row.state)}`}>
                    <span className="status-dot" />
                    {row.state}
                  </span>
                  {row.rank === 1 && <span className="error small"> просрочено</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
