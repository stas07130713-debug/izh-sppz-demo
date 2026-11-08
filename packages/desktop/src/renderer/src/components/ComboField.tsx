/**
 * Поле с выбором из списка и возможностью написать своё — одно поле, не два.
 *
 * Раньше «Другое» в списке открывало ниже вторую графу, куда и вводили
 * название. Это неудобно и путает: граф становится больше, чем сведений, а
 * значение живёт то в одном поле, то в другом. Здесь список — подсказка, а не
 * ограничение: можно выбрать готовое, а можно набрать своё прямо здесь.
 *
 * Список рисуется свой, а не браузерный (`datalist`). Браузерный не поддаётся
 * оформлению: он выпадал белым окном чужого вида, не совпадающим ни с обычными
 * выпадающими списками программы, ни с тёмной темой. Свой список выглядит как
 * остальные и ведёт себя как они.
 *
 * Набранное в поле сужает список: у изготовителей и марок их десятки, и искать
 * нужную глазами дольше, чем набрать три буквы.
 */

import { useEffect, useId, useRef, useState } from 'react';

export interface ComboFieldProps {
  readonly label: string;
  readonly value: string | null;
  readonly options: readonly string[];
  readonly placeholder?: string;
  readonly disabled?: boolean;
  /** Подпись под полем: чем оно отличается от соседнего или откуда берётся. */
  readonly hint?: string;
  readonly onChange: (value: string | null) => void;
}

export function ComboField(props: ComboFieldProps): React.JSX.Element {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLLabelElement | null>(null);

  // Щелчок мимо закрывает список. Без этого он оставался висеть над соседними
  // графами, и было непонятно, к какой из них он относится.
  useEffect(() => {
    if (!open) return undefined;

    const closeOutside = (event: MouseEvent): void => {
      if (boxRef.current?.contains(event.target as Node) === true) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const typed = props.value ?? '';
  // Набранное сужает список, но точное совпадение его не схлопывает: выбрав
  // значение, человек должен видеть, из чего ещё можно выбрать.
  const needle = typed.trim().toLocaleLowerCase('ru');
  const shown = needle === '' || props.options.includes(typed)
    ? props.options
    : props.options.filter((option) => option.toLocaleLowerCase('ru').includes(needle));

  return (
    <>
      <label className="field combo-field" ref={boxRef}>
        <span>{props.label}</span>
        <div className="combo-box">
          <input
            className="combo-input"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            autoComplete="off"
            value={typed}
            disabled={props.disabled}
            placeholder={props.placeholder ?? 'выберите или введите своё'}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setOpen(true);
              props.onChange(event.target.value.trim() === '' ? null : event.target.value);
            }}
          />
          <button
            type="button"
            className="combo-arrow"
            tabIndex={-1}
            disabled={props.disabled}
            aria-label={open ? 'Закрыть список' : 'Открыть список'}
            /* Нажатие не уводит фокус: поле лежит внутри подписи, и перевод
               фокуса открыл бы список ещё раз — стрелка перестала бы работать. */
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setOpen(!open)}
          >
            ▾
          </button>

          {open && !(props.disabled ?? false) && (
            <div className="combo-list" id={listId} role="listbox">
              {shown.length === 0 ? (
                <div className="combo-empty muted small">
                  Ничего похожего нет — останется набранное вами.
                </div>
              ) : shown.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={option === typed}
                  className={option === typed ? 'combo-option chosen' : 'combo-option'}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => { props.onChange(option); setOpen(false); }}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      </label>
      {props.hint !== undefined && <p className="muted small">{props.hint}</p>}
    </>
  );
}
