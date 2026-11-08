/**
 * Перенос оборудования на другой узел — одного или сразу набора.
 *
 * Окно одно на оба случая: для человека это одно действие, и два разных окна
 * означали бы, что «переместить» работает по-разному в зависимости от того,
 * сколько отмечено.
 *
 * Первым делом окно перечисляет, что именно едет — учётными номерами. Набор
 * собирают рамкой и Ctrl, ошибиться в нём легко, и увидеть список до переноса
 * важнее, чем сэкономить строку.
 *
 * Склад в списке целей раскрыт по полкам: «резерв» и «в ремонт» — разные места
 * назначения, а не одно с настройкой после. Огнетушитель снимают со стены
 * именно в ремонт, и лишний шаг здесь только мешает.
 *
 * Пригодность считается **до** переноса: в набор попадают огнетушители, краны и
 * извещатели сразу, а наружные средства живут на генплане, внутренние системы и
 * автоматика — на этажах. Окно говорит числом, сколько уедет, а сколько
 * останется и почему. Молча перенести часть значило бы оставить человека в
 * уверенности, что перенесено всё.
 */

import { useMemo, useState } from 'react';
import { backdropClose } from './modal-backdrop';
import type { PlanObject, StorageSection, TreeNode } from '@izh/contracts';
import { elementByCode, planCaption, ruleFor } from '@izh/core';
import { SelectField } from './SelectField';

export interface MoveTarget {
  readonly nodeId: string;
  /** Полка склада. null — узел не склад. */
  readonly section: StorageSection | null;
}

export interface MoveObjectsModalProps {
  readonly objects: readonly PlanObject[];
  readonly nodes: readonly TreeNode[];
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (target: MoveTarget, objectIds: readonly string[]) => void;
}

/** Значение выпадающего списка: узел и полка одной строкой. */
function keyOf(target: MoveTarget): string {
  return target.section === null ? target.nodeId : `${target.nodeId}|${target.section}`;
}

export function MoveObjectsModal(props: MoveObjectsModalProps): React.JSX.Element {
  const [key, setKey] = useState('');

  /**
   * Куда можно переносить: узлы со своей рабочей областью.
   *
   * Здание, этаж и склад — у остальных плана нет, и объекту там не место.
   * Ограничения одним зданием нет намеренно: партию огнетушителей везут и в
   * соседний цех, а перенос по одному ради этого — не работа.
   */
  const targets = useMemo(() => {
    const list: { readonly key: string; readonly caption: string; readonly target: MoveTarget }[] = [];

    for (const node of props.nodes) {
      const planKind = ruleFor(node.kind).planKind;
      if (planKind === 'none' || node.archivedAt !== null) continue;

      const caption = planCaption(props.nodes, node.id);
      if (planKind === 'storage') {
        for (const section of ['резерв', 'ремонт'] as const) {
          const target: MoveTarget = { nodeId: node.id, section };
          list.push({
            key: keyOf(target),
            caption: `${caption} — ${section === 'резерв' ? 'резерв' : 'в ремонт и на обслуживание'}`,
            target,
          });
        }
        continue;
      }

      const target: MoveTarget = { nodeId: node.id, section: null };
      list.push({ key: keyOf(target), caption, target });
    }

    return list.sort((a, b) => a.caption.localeCompare(b.caption, 'ru'));
  }, [props.nodes]);

  const chosen = targets.find((item) => item.key === key) ?? null;

  /** Что поедет, а что останется: считается по выбранному месту. */
  const split = useMemo(() => {
    if (chosen === null) return { fit: [], unfit: [] as readonly PlanObject[] };

    const node = props.nodes.find((item) => item.id === chosen.target.nodeId) ?? null;
    if (node === null) return { fit: [], unfit: props.objects };

    const planKind = ruleFor(node.kind).planKind;
    const fit: PlanObject[] = [];
    const unfit: PlanObject[] = [];
    for (const object of props.objects) {
      const element = elementByCode(object.typeCode);
      const allowed = element !== null && planKind !== 'none' && element.appliesTo.includes(planKind);
      // Перенос на ту же полку того же узла — не операция: такой объект остаётся.
      const sameShelf = object.nodeId === node.id
        && (chosen.target.section === null || (object.storageSection ?? 'резерв') === chosen.target.section);
      if (allowed && !sameShelf) fit.push(object);
      else unfit.push(object);
    }
    return { fit, unfit };
  }, [chosen, props.nodes, props.objects]);

  const unfitTypes = [...new Set(split.unfit.map(
    (object) => elementByCode(object.typeCode)?.title ?? object.typeCode,
  ))];

  /** Что переносим — видами и номерами, как это назвал бы человек. */
  const listed = useMemo(() => {
    const byType = new Map<string, string[]>();
    for (const object of props.objects) {
      const title = elementByCode(object.typeCode)?.title ?? object.typeCode;
      byType.set(title, [...(byType.get(title) ?? []), object.regNumber ?? '(без номера)']);
    }
    return [...byType.entries()].map(([title, numbers]) => ({ title, numbers }));
  }, [props.objects]);

  return (
    <div className="modal-backdrop" {...backdropClose(props.onClose)}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h3>Переместить {props.objects.length === 1 ? 'объект' : `объектов: ${props.objects.length}`}</h3>
          <button type="button" className="link" onClick={props.onClose}>закрыть ✕</button>
        </div>

        <div className="move-list">
          {listed.map((group) => (
            <p key={group.title} className="small">
              <b>{group.title}</b>{' — '}
              <span className="muted">{group.numbers.join(', ')}</span>
            </p>
          ))}
        </div>

        <label className="field">
          <span>Куда переместить</span>
          <SelectField
            value={key}
            placeholder="выберите место"
            disabled={props.busy}
            options={targets.map((target) => ({ value: target.key, title: target.caption }))}
            onChange={setKey}
          />
        </label>

        {chosen !== null && (
          <p className={split.fit.length === 0 ? 'small warn' : 'muted small'}>
            Переедет: {split.fit.length} из {props.objects.length}.
            {split.unfit.length > 0 && (
              <> Останется {split.unfit.length}: {unfitTypes.join(', ')} — этот вид на выбранной
                рабочей области не размещается либо объект уже там.</>
            )}
          </p>
        )}

        <p className="muted small">
          Место на прежнем плане освобождается. На новом узле объекты появятся в списке «Требуют
          размещения»: координаты чужого плана к ним не подходят, место указывается заново. На складе
          места не требуется — там важен состав.
        </p>

        <div className="actions">
          <button
            type="button"
            className="primary"
            disabled={props.busy || chosen === null || split.fit.length === 0}
            onClick={() => {
              if (chosen === null) return;
              props.onConfirm(chosen.target, split.fit.map((object) => object.id));
            }}
          >
            Переместить: {split.fit.length}
          </button>
        </div>
      </div>
    </div>
  );
}
