/**
 * Состав системы: как он читается (ТЗ, Дополнение 6).
 *
 * Просмотр отделён от правки намеренно. Смотрят состав постоянно — «что стоит
 * на втором этаже», «всё ли расставлено», — а меняют его считаные разы, при
 * монтаже и при замене оборудования. Поля ввода и кнопки, нужные для правки, в
 * остальное время только загораживают сам список.
 *
 * Читается по этажам: заголовок этажа, под ним виды оборудования с
 * количеством. Учётные номера свёрнуты и открываются по щелчку: в системе на
 * корпус бывает шестьдесят извещателей, и шестьдесят номеров сразу занимают
 * пол-экрана, а всё остальное в карточке уезжает вниз.
 */

import { useState } from 'react';
import type { PlanObject, TreeNode } from '@izh/contracts';
import { elementByCode, nodeTitle } from '@izh/core';
import { ElementIcon } from './ElementIcon';

export interface SystemCompositionViewProps {
  readonly members: readonly PlanObject[];
  readonly nodes: readonly TreeNode[];
  /** Показать элемент системы: переход к его карточке. */
  readonly onOpenMember: (object: PlanObject) => void;
}

export function SystemCompositionView(props: SystemCompositionViewProps): React.JSX.Element {
  /** Какая строка раскрыта: номера показываются по одной строке за раз. */
  const [openRow, setOpenRow] = useState<string | null>(null);
  const floorIds = [...new Set(props.members.map((member) => member.nodeId))];

  return (
    <>
      {floorIds.map((nodeId) => {
        const onFloor = props.members.filter((member) => member.nodeId === nodeId);
        const floor = props.nodes.find((node) => node.id === nodeId);
        const types = [...new Set(onFloor.map((member) => member.typeCode))]
          .map((typeCode) => ({ typeCode, own: onFloor.filter((member) => member.typeCode === typeCode) }))
          .sort((a, b) => b.own.length - a.own.length);

        return (
          <div key={nodeId} className="composition-floor">
            <h5>
              <span>{floor === undefined ? 'этаж не указан' : nodeTitle(floor)}</span>
              <span className="muted">
                {onFloor.length} шт. · на плане {onFloor.filter((member) => member.position !== null).length}
              </span>
            </h5>

            <ul className="composition-view">
              {types.map((row) => {
                const key = `${nodeId} ${row.typeCode}`;
                const open = openRow === key;
                const placed = row.own.filter((member) => member.position !== null).length;

                return (
                  <li key={key}>
                    <button
                      type="button"
                      className="composition-line"
                      title={open ? 'Свернуть номера' : 'Показать учётные номера'}
                      onClick={() => setOpenRow(open ? null : key)}
                    >
                      <ElementIcon typeCode={row.typeCode} />
                      <span className="composition-title">{elementByCode(row.typeCode)?.title ?? row.typeCode}</span>
                      <span className="muted small composition-amount">
                        {row.own.length} шт.{placed < row.own.length && ` · на плане ${placed}`}
                      </span>
                      <span className="muted small">{open ? '▾' : '▸'}</span>
                    </button>

                    {/* Номера — ссылками: с состава попадают прямо в карточку
                        нужного извещателя, а не ищут его в журнале по этажу и
                        виду. Пунктирный — ещё не расставлен на плане. */}
                    {open && (
                      <span className="composition-numbers">
                        {row.own.map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            className={`composition-chip${member.position === null ? ' unplaced' : ''}`}
                            title={member.position === null ? 'Ещё не расставлен на плане' : 'На плане'}
                            onClick={() => props.onOpenMember(member)}
                          >
                            {member.regNumber ?? '—'}
                          </button>
                        ))}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </>
  );
}
