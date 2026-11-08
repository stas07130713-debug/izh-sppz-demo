/**
 * Состав системы пожарной автоматики (ТЗ, Дополнение 6).
 *
 * Показывается в карточке прибора приёмно-контрольного: он и есть система.
 * Строка состава — «вид оборудования · этаж · количество». Добавляется снизу
 * тремя полями, правится прямо в строке.
 *
 * Строками, а не таблицей «виды × этажи»: в таблице колонка на каждый этаж, и
 * при пяти этажах она уезжает вправо за край панели. Панель узкая и шире не
 * станет — значит, расти состав должен вниз, а не вбок. Заодно исчезают пустые
 * клетки: в живой системе оборудование стоит не на всех этажах подряд.
 *
 * Этаж указывает пользователь, а не программа. Разложить состав поровну было бы
 * заманчиво, но программа не знает, где на самом деле стоят извещатели: такая
 * раскладка выглядела бы достоверной, а человек искал бы датчик там, где его
 * нет.
 */

import { useState } from 'react';
import type { PlanObject, TreeNode } from '@izh/contracts';
import { SYSTEM_MEMBER_TYPES, elementByCode, nodeTitle, systemFloors, systemMembers } from '@izh/core';
import { ElementIcon } from './ElementIcon';
import { SystemCompositionView } from './SystemCompositionView';
import { SelectField } from './SelectField';

export interface CompositionItem {
  readonly typeCode: string;
  readonly nodeId: string;
  readonly count: number;
}

export interface SystemCompositionEditorProps {
  readonly head: PlanObject;
  readonly objects: readonly PlanObject[];
  readonly nodes: readonly TreeNode[];
  readonly busy: boolean;
  readonly onApply: (items: readonly CompositionItem[]) => void;
  /** Показать элемент системы: переход к его карточке. */
  readonly onOpenMember: (object: PlanObject) => void;
}

function keyOf(typeCode: string, nodeId: string): string {
  return `${typeCode} ${nodeId}`;
}

export function SystemCompositionEditor(props: SystemCompositionEditorProps): React.JSX.Element {
  const members = systemMembers(props.objects, props.head.id);
  const floors = systemFloors(props.nodes, props.head);

  /** Что заведено сейчас: вид на этаже → количество. */
  const current = new Map<string, number>();
  for (const member of members) {
    const key = keyOf(member.typeCode, member.nodeId);
    current.set(key, (current.get(key) ?? 0) + 1);
  }

  const [draft, setDraft] = useState<ReadonlyMap<string, number>>(new Map());
  /** Строки, добавленные вручную и пока пустые. */
  const [added, setAdded] = useState<readonly string[]>([]);
  /** Правка состава: поля ввода нужны при монтаже и замене, а не при каждом взгляде. */
  const [editing, setEditing] = useState(false);

  const [newType, setNewType] = useState('');
  const [newFloor, setNewFloor] = useState(floors[0]?.id ?? '');

  const countOf = (key: string): number => draft.get(key) ?? current.get(key) ?? 0;
  const setCount = (key: string, value: number): void => {
    const next = new Map(draft);
    next.set(key, Math.max(0, Math.trunc(value)));
    setDraft(next);
  };

  /** Строки состава: заведённые плюс добавленные вручную. */
  const rows = [...new Set([...current.keys(), ...added])]
    .map((key) => {
      const [typeCode = '', nodeId = ''] = key.split(' ');
      return { key, typeCode, nodeId };
    })
    .filter((row) => countOf(row.key) > 0 || added.includes(row.key))
    .sort((a, b) => a.typeCode.localeCompare(b.typeCode) || a.nodeId.localeCompare(b.nodeId));

  /** Строки по этажам: этаж читается один раз, а не повторяется в каждой строке. */
  const byFloor = [...new Set(rows.map((row) => row.nodeId))]
    .map((nodeId) => ({ nodeId, floorRows: rows.filter((row) => row.nodeId === nodeId) }));

  const changed = [...draft.entries()].some(([key, value]) => value !== (current.get(key) ?? 0));
  const placed = members.filter((member) => member.position !== null).length;

  const addRow = (): void => {
    if (newType === '' || newFloor === '') return;
    const key = keyOf(newType, newFloor);
    setAdded((items) => (items.includes(key) ? items : [...items, key]));
    setNewType('');
  };

  return (
    <section className="system-composition">
      <div className="composition-head">
        <h4>Состав системы</h4>
        {members.length > 0 && (
          <button type="button" className="link" onClick={() => setEditing(!editing)}>
            {editing ? 'готово' : 'изменить состав'}
          </button>
        )}
      </div>

      {members.length > 0 && (
        <p className="muted small composition-total">
          Всего в системе: {members.length}, расставлено на планах: {placed}.
          {placed < members.length && ' Остальные ждут расстановки — они уже в журнале и со своими сроками.'}
        </p>
      )}

      {/* Просмотр — то, ради чего в состав заглядывают чаще всего. Поля ввода
          и кнопки нужны при монтаже и замене, а в остальное время только
          загораживают список. */}
      {!editing && members.length > 0 && (
        <SystemCompositionView members={members} nodes={props.nodes} onOpenMember={props.onOpenMember} />
      )}

      {(editing || members.length === 0) && <>
        {rows.length === 0 ? (
          <p className="muted small">
            Оборудование системы заводится здесь: выберите вид, этаж и количество. На планы
            вы расставите элементы сами.
          </p>
        ) : (
          byFloor.map(({ nodeId, floorRows }) => {
            const floor = props.nodes.find((node) => node.id === nodeId);

            return (
              <div key={nodeId} className="composition-floor">
                <h5><span>{floor === undefined ? 'этаж не указан' : nodeTitle(floor)}</span></h5>

                <ul className="composition-rows">
                  {floorRows.map((row) => (
                    <li key={row.key} className="composition-row">
                      <ElementIcon typeCode={row.typeCode} />
                      <span className="composition-title" title={elementByCode(row.typeCode)?.title}>
                        {elementByCode(row.typeCode)?.title ?? row.typeCode}
                      </span>
                      <input
                        type="number"
                        min={0}
                        className="composition-count"
                        value={countOf(row.key)}
                        onChange={(event) => setCount(row.key, Number(event.target.value))}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}

        {/* Добавление строки: вид и этаж выбираются, количество правится в самой
            строке. Так панель растёт вниз и никогда не уезжает вбок. */}
        <div className="composition-add">
          <SelectField
            value={newType}
            placeholder="— вид оборудования —"
            disabled={props.busy}
            options={SYSTEM_MEMBER_TYPES.map((typeCode) => ({
              value: typeCode, title: elementByCode(typeCode)?.title ?? typeCode,
            }))}
            onChange={setNewType}
          />
          <SelectField
            value={newFloor}
            disabled={props.busy}
            options={floors.map((floor) => ({ value: floor.id, title: nodeTitle(floor) }))}
            onChange={setNewFloor}
          />
          <button type="button" disabled={props.busy || newType === ''} onClick={addRow}>Добавить</button>
        </div>

        <div className="actions">
          <button
            type="button"
            className="primary"
            disabled={props.busy || !changed}
            onClick={() => {
              props.onApply(rows.map((row) => ({
                typeCode: row.typeCode,
                nodeId: row.nodeId,
                count: countOf(row.key),
              })));
              setEditing(false);
            }}
          >
            Применить состав
          </button>
          {changed && (
            <button type="button" className="link" onClick={() => { setDraft(new Map()); setAdded([]); }}>
              отменить правки
            </button>
          )}
        </div>
      </>}
    </section>
  );
}