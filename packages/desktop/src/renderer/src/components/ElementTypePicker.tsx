/**
 * Выбор вида оборудования — списком со значками, разбитым по разделам.
 *
 * Заказчик: «в правой графе выпадающим списком наши системы, разбитые также по
 * разделам и значками».
 *
 * Обычный `select` этого не умеет: в его строке нельзя показать картинку, а
 * значок здесь — половина узнавания. Человек, переносящий чужой журнал, ищет
 * глазами тот значок, который видит на своих планах, а не читает сорок строк
 * подряд. Поэтому список свой: кнопка с выбранным видом и раскрывающаяся панель
 * с разделами, значками и названиями.
 *
 * Набор видов приходит извне: здесь не решается, что можно выбрать, — только
 * как это показать.
 */

import { useEffect, useRef, useState } from 'react';
import type { ElementType } from '@izh/core';
import { GROUP_ORDER, GROUP_TITLES, systemGroupOf } from './journal-groups';
import { ElementIcon } from './ElementIcon';

export interface ElementTypePickerProps {
  readonly types: readonly ElementType[];
  readonly value: string;
  readonly onChange: (typeCode: string) => void;
  readonly disabled?: boolean;
}


export function ElementTypePicker(props: ElementTypePickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  /*
   * Щелчок мимо закрывает список.
   *
   * Без этого раскрытый список оставался бы висеть поверх мастера и закрывал
   * собой то, ради чего его открыли, — вторую графу сопоставления.
   */
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent): void => {
      if (boxRef.current !== null && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const selected = props.types.find((type) => type.typeCode === props.value) ?? null;

  return (
    <div className="type-picker" ref={boxRef}>
      <button
        type="button"
        className="type-picker-button"
        disabled={props.disabled}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ElementIcon typeCode={props.value} />
        <span className="type-picker-name">{selected?.title ?? 'выберите вид'}</span>
        <span className="type-picker-arrow" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="type-picker-list">
          {GROUP_ORDER.map((group) => {
            const items = props.types.filter((type) => systemGroupOf(type.typeCode) === group);
            if (items.length === 0) return null;

            return (
              <section key={group}>
                <h5>{GROUP_TITLES[group]}</h5>
                {items.map((type) => (
                  <button
                    key={type.typeCode}
                    type="button"
                    className={type.typeCode === props.value ? 'type-picker-item selected' : 'type-picker-item'}
                    onClick={() => { props.onChange(type.typeCode); setOpen(false); }}
                  >
                    <ElementIcon typeCode={type.typeCode} />
                    <span>{type.title}</span>
                  </button>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
