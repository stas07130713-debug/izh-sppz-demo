/**
 * Сводка систем узла в правом поле плана.
 *
 * Что на объекте есть и сколько — разложенное по разделам, с галочками показа
 * на плане. Галочка у раздела включает и выключает его целиком: чтобы
 * посмотреть одну автоматику, незачем снимать полтора десятка галочек по одной.
 *
 * Отметка «показывать» хранится наоборот — списком скрытых видов
 * (`hiddenTypes`): по умолчанию видно всё, и хранить нужно исключения, а не
 * правило.
 *
 * Рядом с числом элементов вида стоит, сколько из них на плане. Панель считает
 * по всему узлу вместе с вложенными, а план рисует только собственные точки
 * узла — и у вида, ни один элемент которого не размещён, галочка ничего не
 * меняет. Пока об этом не было сказано, это выглядело поломкой: отмечаешь
 * систему, а на плане ничего не появляется.
 */

import { useMemo, useState } from 'react';
import type { PlanObject, TreeNode } from '@izh/contracts';
import { elementByCode, journalScope, nodeTitle } from '@izh/core';
import { ElementIcon } from './ElementIcon';
import { GROUP_ORDER, GROUP_TITLES, byCatalogOrder, systemGroupOf, type SystemGroup } from './journal-groups';

export interface SystemSummaryPanelProps {
  readonly context: 'plan' | 'journal';
  readonly node: TreeNode | null;
  readonly nodes: readonly TreeNode[];
  readonly objects: readonly PlanObject[];
  /** Элементы, которые рисует план этого узла: у них есть точка. */
  readonly planObjects: readonly PlanObject[];
  readonly onOpenType: (typeCode: string) => void;
  readonly hiddenTypes: ReadonlySet<string>;
  readonly onToggleType: (typeCode: string) => void;
  /** Показать или скрыть сразу все виды раздела. */
  readonly onSetTypesVisible: (typeCodes: readonly string[], visible: boolean) => void;
}

/** Виды, которыми реально управляет галочка в текущем экране. */
export function filterableTypeCodes(
  context: 'plan' | 'journal',
  codes: readonly string[],
  placedByType: ReadonlyMap<string, number>,
): readonly string[] {
  return context === 'journal'
    ? codes
    : codes.filter((code) => (placedByType.get(code) ?? 0) > 0);
}

export function SystemSummaryPanel(props: SystemSummaryPanelProps): React.JSX.Element {
  const [open, setOpen] = useState<ReadonlySet<SystemGroup>>(new Set(GROUP_ORDER));

  const scope = useMemo(
    () => (props.node === null
      ? []
      : journalScope(props.nodes, props.objects, props.node.id).filter((item) => item.archivedAt === null)),
    [props.node, props.nodes, props.objects],
  );

  /** Сколько элементов вида стоит на плане этого узла. */
  const placedByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const object of props.planObjects) {
      if (object.position === null || object.archivedAt !== null) continue;
      map.set(object.typeCode, (map.get(object.typeCode) ?? 0) + 1);
    }
    return map;
  }, [props.planObjects]);

  const groups = GROUP_ORDER
    .map((group) => ({ group, items: scope.filter((item) => systemGroupOf(item.typeCode) === group) }))
    .filter((item) => item.items.length > 0);

  const toggleOpen = (group: SystemGroup): void => setOpen((current) => {
    const next = new Set(current);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    return next;
  });

  if (props.node === null) {
    return <div className="system-summary"><p className="muted small">Выберите узел в дереве</p></div>;
  }

  return (
    <div className="system-summary">
      <p className="muted small">{nodeTitle(props.node)}</p>

      {groups.length === 0 ? (
        <p className="muted small">Элементы ещё не добавлены.</p>
      ) : groups.map(({ group, items }) => {
        const types = new Map<string, PlanObject[]>();
        for (const item of items) types.set(item.typeCode, [...(types.get(item.typeCode) ?? []), item]);
        const codes = [...types.keys()].sort(byCatalogOrder);

        // В журнале отбор относится ко всей вложенной области узла. На плане
        // переключать можно только виды, у которых здесь есть координата.
        const selectable = filterableTypeCodes(props.context, codes, placedByType);
        const allVisible = selectable.length > 0
          && selectable.every((code) => !props.hiddenTypes.has(code));
        const partly = !allVisible && selectable.some((code) => !props.hiddenTypes.has(code));

        return (
          <section className="summary-group" key={group}>
            <div className="summary-group-head">
              {/* Галочка раздела: отмечена, когда виден весь раздел, закрашена
                  наполовину, когда часть. Промежуточное состояние показывается,
                  а не округляется: иначе по виду галочки не отличить «весь
                  раздел» от «одна система в нём». */}
              <label
                className="summary-group-check"
                title={`Показывать ${props.context === 'journal' ? 'в журнале' : 'на плане'} весь раздел «${GROUP_TITLES[group]}»`}
              >
                <input
                  type="checkbox"
                  checked={allVisible}
                  ref={(input) => { if (input !== null) input.indeterminate = partly; }}
                  onChange={() => props.onSetTypesVisible(selectable, !allVisible)}
                />
              </label>
              <button type="button" className="summary-group-title" onClick={() => toggleOpen(group)}>
                {open.has(group) ? '▾' : '▸'} {GROUP_TITLES[group]} <span>{items.length}</span>
              </button>
            </div>

            {open.has(group) && (
              <div className="summary-card-grid">
                {codes.map((type) => {
                  const values = types.get(type) ?? [];
                  const models = modelSummary(values);
                  const placed = placedByType.get(type) ?? 0;
                  const selectableType = props.context === 'journal' || placed > 0;
                  return (
                    <div
                      className={props.context === 'plan' && placed === 0
                        ? 'summary-type-card unplaced'
                        : 'summary-type-card'}
                      key={type}
                    >
                      {/* У вида без точек на плане галочка бессильна: скрывать
                          нечего. Она выключена и говорит почему — иначе это
                          выглядит поломкой. */}
                      <label
                        className="summary-type-visible"
                        title={!selectableType
                          ? 'Ни один элемент этого вида не размещён на плане'
                          : `Показывать ${props.context === 'journal' ? 'в журнале' : 'на плане'} (${values.length} шт.)`}
                      >
                        <input
                          type="checkbox"
                          disabled={!selectableType}
                          checked={selectableType && !props.hiddenTypes.has(type)}
                          onChange={() => props.onToggleType(type)}
                        />
                      </label>
                      <button
                        type="button"
                        className="summary-type-open"
                        onClick={() => props.onOpenType(type)}
                        title="Открыть этот вид в журнале"
                      >
                        <ElementIcon typeCode={type} />
                        <span className="summary-type-name">{elementByCode(type)?.title ?? type}</span>
                        <strong>{values.length}</strong>
                        {props.context === 'plan' && placed < values.length && (
                          <small className="muted">
                            {placed === 0 ? 'нет на плане' : `на плане ${placed}`}
                          </small>
                        )}
                        {models !== '' && <small>{models}</small>}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function modelSummary(items: readonly PlanObject[]): string {
  const models = new Map<string, number>();
  for (const item of items) {
    if (item.model !== null) models.set(item.model, (models.get(item.model) ?? 0) + 1);
  }
  return models.size === 0 ? '' : [...models].map(([name, count]) => `${name}: ${count}`).join(' · ');
}
