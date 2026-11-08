/**
 * Левая часть конструктора: по какому оборудованию настраивается регламент.
 *
 * Разделено на виды систем — пожарная автоматика, внутри здания, снаружи
 * здания. Один сплошной список из тридцати строк заставлял искать глазами;
 * разделы совпадают с тем, как на предприятии распределена ответственность.
 *
 * Внутри разделов оборудование собрано в семейства: огнетушители по заряду,
 * извещатели по виду, установки пожаротушения по исполнению. Общий вид служит
 * заголовком и сам не настраивается — у него нельзя назначить срок, не зная
 * исполнения: у водного огнетушителя перезарядка раз в год, у порошкового раз
 * в пять лет.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ELEMENT_FAMILIES, elementByCode, familyOf, groupOfType,
  isFamilyMember, type ElementGroup,
} from '@izh/core';
import { ElementIcon } from './ElementIcon';

/** Порядок соответствует движению по объекту: территория → здание → автоматика. */
export const REGULATION_GROUP_ORDER: readonly ElementGroup[] = [
  'снаружи здания',
  'внутри здания',
  'пожарная автоматика',
];

function groupClass(group: ElementGroup): string {
  if (group === 'снаружи здания') return 'outside';
  if (group === 'внутри здания') return 'inside';
  return 'automation';
}

/** Простые контурные знаки не зависят от системного набора эмодзи. */
export function RegulationGroupIcon({ group }: { readonly group: ElementGroup }): React.JSX.Element {
  if (group === 'пожарная автоматика') {
    return (
      <svg className="regulation-group-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <circle cx="5" cy="5" r="2" /><circle cx="19" cy="5" r="2" />
        <circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" />
        <path d="M7 7l3 3m4 0 3-3m-7 7-3 3m7-3 3 3" />
      </svg>
    );
  }

  return (
    <svg className="regulation-group-icon" viewBox="0 0 24 24" aria-hidden="true">
      {group === 'снаружи здания' ? (
        <><path d="M3 21h18M5 21V8l7-4 7 4v13" /><path d="M9 21v-5h6v5" /></>
      ) : (
        <><path d="M4 21V3h16v18H4Z" /><path d="M8 7h2m4 0h2M8 11h2m4 0h2M10 21v-5h4v5" /></>
      )}
    </svg>
  );
}

export interface SelectableType {
  readonly typeCode: string;
  readonly title: string;
  /** Есть ли в нормативной библиотеке хоть одно правило для этого вида. */
  readonly hasRules: boolean;
}

export interface RegulationTypeListProps {
  readonly types: readonly SelectableType[];
  readonly selected: string;
  readonly focusedGroup: ElementGroup | null;
  readonly onSelect: (typeCode: string) => void;
}

function TypeRow(props: {
  readonly item: SelectableType;
  readonly selected: boolean;
  readonly nested?: boolean;
  readonly onSelect: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={`type-row${props.selected ? ' active' : ''}${props.nested === true ? ' nested' : ''}`}
      onClick={props.onSelect}
    >
      <ElementIcon typeCode={props.item.typeCode} />
      <span className="type-row-title">{props.item.title}</span>
      {/* Вид без правил помечается прямо в списке: иначе пустой конструктор
          выглядит как поломка программы, а не как незаполненный раздел. */}
      {!props.item.hasRules && <small className="muted">нет правил</small>}
    </button>
  );
}

export function RegulationTypeList(props: RegulationTypeListProps): React.JSX.Element {
  const listRef = useRef<HTMLElement>(null);
  const groupRefs = useRef<Partial<Record<ElementGroup, HTMLElement | null>>>({});
  /** Раскрытые семейства. То, внутри которого выбран вид, открыто сразу. */
  const [open, setOpen] = useState<ReadonlySet<string>>(() => {
    const family = familyOf(props.selected);
    return new Set(family === null || !isFamilyMember(props.selected) ? [] : [family.parent]);
  });

  const toggle = (parent: string): void => setOpen((current) => {
    const next = new Set(current);
    if (next.has(parent)) next.delete(parent);
    else next.add(parent);
    return next;
  });

  useEffect(() => {
    if (props.focusedGroup === null) return;
    const list = listRef.current;
    const section = groupRefs.current[props.focusedGroup];
    if (list === null || section === null || section === undefined) return;
    list.scrollTo({ top: Math.max(0, section.offsetTop - list.offsetTop - 4), behavior: 'smooth' });
  }, [props.focusedGroup]);

  /** Виды раздела, не входящие ни в одно семейство. */
  const loose = (group: ElementGroup): readonly SelectableType[] =>
    props.types.filter((item) => familyOf(item.typeCode) === null && groupOfType(item.typeCode) === group);

  /** Семейства, чьи исполнения относятся к этому разделу. */
  const families = (group: ElementGroup) => ELEMENT_FAMILIES
    .map((family) => ({
      family,
      members: props.types.filter(
        (item) => family.members.includes(item.typeCode) && groupOfType(item.typeCode) === group,
      ),
    }))
    .filter((entry) => entry.members.length > 0);

  return (
    <aside className="regulations-types" ref={listRef}>
      <button
        type="button"
        className={`type-row type-row-overview${props.selected === '' ? ' active' : ''}`}
        onClick={() => props.onSelect('')}
      >
        <span className="regulation-overview-mark" aria-hidden="true">▦</span>
        <span className="type-row-title">Все разделы</span>
      </button>

      {REGULATION_GROUP_ORDER.map((group) => {
        const own = loose(group);
        const inGroup = families(group);
        if (own.length === 0 && inGroup.length === 0) return null;

        return (
          <section
            key={group}
            ref={(element) => { groupRefs.current[group] = element; }}
            className={`type-group type-group-${groupClass(group)}${props.focusedGroup === group ? ' focused' : ''}`}
          >
            <h5><RegulationGroupIcon group={group} /><span>{group}</span></h5>

            {inGroup.map(({ family, members }) => {
              const expanded = open.has(family.parent);
              const parentTitle = elementByCode(family.parent)?.title ?? family.parent;

              return (
                <div key={family.parent}>
                  <button type="button" className="type-row type-row-parent" onClick={() => toggle(family.parent)}>
                    <ElementIcon typeCode={family.parent} />
                    <span className="type-row-title">{parentTitle}</span>
                    <small className="muted">{expanded ? '▾' : '▸'} {members.length}</small>
                  </button>

                  {expanded && members.map((item) => (
                    <TypeRow
                      key={item.typeCode}
                      item={item}
                      nested
                      selected={item.typeCode === props.selected}
                      onSelect={() => props.onSelect(item.typeCode)}
                    />
                  ))}
                </div>
              );
            })}

            {own.map((item) => (
              <TypeRow
                key={item.typeCode}
                item={item}
                selected={item.typeCode === props.selected}
                onSelect={() => props.onSelect(item.typeCode)}
              />
            ))}
          </section>
        );
      })}
    </aside>
  );
}
