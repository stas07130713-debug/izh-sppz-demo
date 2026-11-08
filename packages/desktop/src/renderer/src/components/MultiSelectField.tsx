/**
 * Выбор нескольких значений из списка.
 *
 * Уже выбранное показывается «фишками» с крестиком, невыбранное добавляется
 * выпадающим списком. Так сделан класс функциональной пожарной опасности
 * здания, и это единственный вид многозначного выбора в программе: два разных
 * вида одного и того же заставляли бы пользователя каждый раз соображать
 * заново, как здесь отмечают несколько значений.
 *
 * Порядок хранится тот же, что в справочнике, а не порядок нажатий: иначе одно
 * и то же сочетание выглядело бы по-разному в карточке и в отчёте.
 */

import { useState } from 'react';
import { SelectField } from './SelectField';

export interface MultiSelectFieldProps {
  readonly label: string;
  readonly options: readonly string[];
  readonly value: readonly string[];
  readonly disabled?: boolean;
  /** Что написать в списке, когда не выбрано ничего. */
  readonly emptyLabel?: string;
  /**
   * Разрешить своё значение помимо списка.
   *
   * Нужно там, где список — подсказка, а не перечень: на пожарном щите бывает
   * инвентарь, которого в норме нет, и записать его надо как есть.
   */
  readonly allowCustom?: boolean;
  readonly onChange: (value: readonly string[]) => void;
}

export function MultiSelectField(props: MultiSelectFieldProps): React.JSX.Element {
  const [custom, setCustom] = useState('');
  // Своё значение идёт после справочных: порядок справочника сохраняется, а
  // дописанное вручную не теряется среди него.
  const known = props.options.filter((option) => props.value.includes(option));
  const own = props.value.filter((item) => !props.options.includes(item));
  const chosen = [...known, ...own];
  const available = props.options.filter((option) => !props.value.includes(option));

  const set = (next: readonly string[]): void => {
    props.onChange([
      ...props.options.filter((option) => next.includes(option)),
      ...next.filter((item) => !props.options.includes(item)),
    ]);
  };

  const addCustom = (): void => {
    const value = custom.trim();
    if (value === '' || chosen.includes(value)) return;
    set([...chosen, value]);
    setCustom('');
  };

  return (
    <label className="field">
      <span>{props.label}</span>
      <div className="multi-select">
        {chosen.length > 0 && (
          <div className="chips">
            {chosen.map((item) => (
              <span className="chip" key={item}>
                {item}
                {props.disabled !== true && (
                  <button
                    type="button"
                    className="chip-remove"
                    title="Убрать"
                    onClick={() => set(chosen.filter((current) => current !== item))}
                  >
                    ✕
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        {/*
          * Выбор остаётся пустым: он не показывает выбранное, а добавляет к
          * нему. Уже выбранное стоит метками выше и в списке не повторяется.
          */}
        <SelectField
          value=""
          placeholder={chosen.length === 0 ? props.emptyLabel ?? 'не задано' : 'добавить ещё'}
          disabled={props.disabled === true || available.length === 0}
          options={available.map((option) => ({ value: option, title: option }))}
          onChange={(value) => { if (value !== '') set([...chosen, value]); }}
        />

        {props.allowCustom === true && (
          <div className="multi-select-custom">
            <input
              value={custom}
              disabled={props.disabled === true}
              placeholder="своё значение"
              onChange={(event) => setCustom(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                addCustom();
              }}
            />
            <button type="button" className="link" disabled={props.disabled === true || custom.trim() === ''} onClick={addCustom}>
              добавить
            </button>
          </div>
        )}
      </div>
    </label>
  );
}
