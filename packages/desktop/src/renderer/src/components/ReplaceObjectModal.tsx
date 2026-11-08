/**
 * «Заменить» — обмен местами с уже заведённым оборудованием
 * (ТЗ, Дополнение 3, часть К7.2; Дополнение 6, часть С81).
 *
 * Так это и происходит на объекте: огнетушитель сдают на перезарядку, а на его
 * место со склада встаёт подменный. Оба уже заведены, у обоих своя история, и
 * списывать никого нельзя — сданный вернётся. Меняется только место, поэтому
 * это обмен, а не замена записи.
 *
 * Заводить здесь новое изделие нельзя. Раньше «заменить» умело создать объект,
 * которого в программе ещё нет, и выводить старый из эксплуатации — и это
 * расходилось с правилом, что план и журнал показывают одно и то же
 * оборудование: новое появлялось из ниоткуда, минуя приход на склад. Новое
 * изделие заводят там, где оно физически появляется, — на складе или сразу на
 * плане, — а сюда оно приходит уже существующим.
 *
 * Список кандидатов — по настраиваемой группе, а не по точному виду. У
 * огнетушителей вид дробный: порошковый, углекислотный, воздушно-эмульсионный.
 * Подменный со склада почти всегда другого вида, чем снимаемый, и список из
 * одних порошковых показывал бы пустоту там, где замена есть.
 */

import { useMemo, useState } from 'react';
import { backdropClose } from './modal-backdrop';
import type { PlanObject, TreeNode } from '@izh/contracts';
import { elementByCode, planCaption } from '@izh/core';
import { swapCandidates } from './swap-candidates';
import { SelectField } from './SelectField';

export interface ReplaceObjectModalProps {
  readonly object: PlanObject;
  /** Всё оборудование: из него выбирают того, с кем меняются местами. */
  readonly allObjects: readonly PlanObject[];
  readonly nodes: readonly TreeNode[];
  readonly busy: boolean;
  readonly onClose: () => void;
  /** Поменять местами с уже заведённым объектом. */
  readonly onSwap: (otherId: string) => void;
}

export function ReplaceObjectModal(props: ReplaceObjectModalProps): React.JSX.Element {
  const currentElement = elementByCode(props.object.typeCode);
  const [otherId, setOtherId] = useState('');

  /** Правило отбора — в swap-candidates.ts, здесь только показ. */
  const candidates = useMemo(
    () => swapCandidates(props.object, props.allObjects)
      .map((item) => ({
        id: item.id,
        title: `${elementByCode(item.typeCode)?.title ?? item.typeCode}`
          + ` № ${item.regNumber ?? 'без номера'} — ${placeOf(item, props.nodes)}`,
      }))
      .sort((a, b) => a.title.localeCompare(b.title, 'ru')),
    [props.allObjects, props.object, props.nodes],
  );

  return (
    <div className="modal-backdrop" {...backdropClose(props.onClose)}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h3>Поменять местами</h3>
          <button type="button" className="link" onClick={props.onClose}>
            закрыть ✕
          </button>
        </div>

        <p className="muted small">
          Сейчас: {currentElement?.title ?? props.object.typeCode}
          {props.object.regNumber !== null && ` № ${props.object.regNumber}`}
          {' — '}{placeOf(props.object, props.nodes)}.
        </p>

        <p className="muted small">
          Оба объекта останутся в журнале со своей историей — поменяются только места. Так снимают
          огнетушитель на перезарядку: на его место встаёт подменный со склада, а он уезжает туда,
          где лежал подменный.
        </p>

        {candidates.length === 0 ? (
          <p className="small warn">
            Другого такого оборудования в программе нет. Заведите подменное на складе — новое изделие
            приходит на склад, а не появляется прямо на стене.
          </p>
        ) : (
          <label className="field">
            <span>С чем меняем местами</span>
            <SelectField
              value={otherId}
              placeholder="выберите объект"
              disabled={props.busy}
              options={candidates.map((candidate) => ({ value: candidate.id, title: candidate.title }))}
              onChange={setOtherId}
            />
          </label>
        )}

        <div className="actions">
          <button
            type="button"
            className="primary"
            disabled={props.busy || otherId === ''}
            onClick={() => props.onSwap(otherId)}
          >
            Поменять местами
          </button>
        </div>
      </div>
    </div>
  );
}

/** Где объект лежит: узел, а для склада — ещё и полка. */
function placeOf(object: PlanObject, nodes: readonly TreeNode[]): string {
  const caption = planCaption(nodes, object.nodeId);
  if (object.storageSection === 'ремонт') return `${caption}, в ремонте`;
  if (object.storageSection === 'резерв') return `${caption}, резерв`;
  return caption;
}
