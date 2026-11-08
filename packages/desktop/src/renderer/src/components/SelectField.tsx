/**
 * Выпадающий список — один на всю программу.
 *
 * Заказчик: «разные выпадающие списки в одной карточке выглядят по-разному: в
 * карточке огнетушителя "Тип огнетушителя" имеет один внешний вид, а
 * "Изготовитель" — другую стрелку и другое раскрывающееся окно… привести все
 * Select/Dropdown/ComboBox к единому компоненту и единому дизайн-стандарту».
 *
 * Так и было: часть граф рисовалась браузерным `<select>`, часть — своим полем
 * с подсказками (`ComboField`). Браузерный список не поддаётся оформлению: он
 * выпадает окном чужого вида, со своей стрелкой и своими отступами, и на тёмной
 * теме выглядит белым пятном.
 *
 * Поэтому список здесь свой, а разметка и классы — общие с `ComboField`
 * (`picker-*`). Отличие между ними ровно одно и по существу: сюда нельзя
 * вписать своё значение, туда — можно.
 *
 * Клавиатура работает как у обычного списка: стрелки ведут по пунктам, Enter
 * выбирает, Escape закрывает. Поле остаётся доступным с клавиатуры — иначе
 * заполнять карточку без мыши стало бы нельзя.
 *
 * Раскрытый список нарисован поверх страницы и держится своего поля
 * (`useAnchoredMenu`), а не лежит внутри него. Внутри он обрезался: карточка
 * узла и настройки прокручиваются, а прокручиваемая область срезает всё, что
 * из неё выходит, — у нижних полей список было видно наполовину. По той же
 * причине он раскрывается вверх, когда под полем места нет.
 *
 * Рисуется список не на своём месте в разметке, а в конце страницы (портал).
 * Одного `position: fixed` не хватило: точкой отсчёта для него становится
 * любой предок, который браузер считает отдельной областью вывода. Так ведёт
 * себя `<details>` — раскрывающийся блок «Сведения для норм ППР» в карточке
 * помещения, — и список уезжал из окна вниз на высоту карточки. В конце
 * страницы предков нет, и отсчёт всегда идёт от окна.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAnchoredMenu } from '../menu-placement';

export interface SelectOption {
  readonly value: string;
  readonly title: string;
  /**
   * Раздел списка: пункты одного раздела идут вместе, под его заголовком.
   *
   * Нужен там, где выбор длинный и неоднородный: у системы пожаротушения
   * сама установка не должна читаться наравне со своим оросителем.
   */
  readonly group?: string;
}

export interface SelectFieldProps {
  readonly label?: string;
  readonly value: string;
  readonly options: readonly SelectOption[];
  /** Что показать, когда ничего не выбрано. */
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly hint?: string;
  readonly title?: string;
  readonly onChange: (value: string) => void;
}

/** Один пункт списка. Отдельно, чтобы разделы и общий список рисовались одним. */
function Option(props: {
  readonly option: SelectOption;
  readonly value: string;
  readonly onPick: (value: string) => void;
}): React.JSX.Element {
  const chosen = props.option.value === props.value;
  return (
    <button
      type="button"
      role="option"
      aria-selected={chosen}
      className={chosen ? 'picker-option chosen' : 'picker-option'}
      onClick={() => props.onPick(props.option.value)}
    >
      {props.option.title}
    </button>
  );
}

export function SelectField(props: SelectFieldProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /**
   * Ширина списка равна ширине поля.
   *
   * Список вынут из потока, и своей ширины у него больше нет: без этого он
   * сжался бы по самому длинному пункту и перестал совпадать с полем.
   */
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!open) return;
    setWidth(boxRef.current?.getBoundingClientRect().width ?? 0);
  }, [open]);
  /*
   * Ширина входит в примету пересчёта: положение считается по настоящему
   * размеру списка, а ширину ему задают после первой отрисовки. Без этого
   * список встал бы по своей природной ширине и разъехался бы с полем.
   */
  const listStyle = useAnchoredMenu(listRef, boxRef, open, `${props.options.length}:${width}`);

  useEffect(() => {
    if (!open) return undefined;

    const closeOutside = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (boxRef.current?.contains(target) === true) return;
      // Список нарисован в конце страницы, и щелчок по пункту иначе считался
      // бы щелчком мимо: поле закрылось бы раньше, чем пункт сработал.
      if (listRef.current?.contains(target) === true) return;
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

  const chosen = props.options.find((option) => option.value === props.value) ?? null;

  /** Соседний пункт: стрелками список листают, не открывая его. */
  const step = (delta: number): void => {
    if (props.options.length === 0) return;
    const at = props.options.findIndex((option) => option.value === props.value);
    const next = props.options[Math.min(props.options.length - 1, Math.max(0, at + delta))];
    if (next !== undefined) props.onChange(next.value);
  };

  const pick = (value: string): void => { props.onChange(value); setOpen(false); };

  const field = (
    <div className="picker-box" ref={boxRef}>
      <button
        type="button"
        className="picker-input picker-button"
        disabled={props.disabled}
        title={props.title}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') { event.preventDefault(); if (open) return; step(1); }
          if (event.key === 'ArrowUp') { event.preventDefault(); if (open) return; step(-1); }
        }}
      >
        <span className={chosen === null ? 'picker-placeholder' : undefined}>
          {chosen?.title ?? props.placeholder ?? 'не выбрано'}
        </span>
      </button>
      <span className="picker-arrow" aria-hidden="true">▾</span>

      {open && createPortal(
        <div
          className="picker-list floating"
          role="listbox"
          ref={listRef}
          style={width === 0 ? listStyle : {
            ...listStyle,
            width: 'max-content',
            minWidth: width,
            maxWidth: 'calc(100vw - 16px)',
          }}
        >
          {props.options.length === 0 ? (
            <p className="muted small picker-empty">Выбирать не из чего.</p>
          ) : (
            <>
              {/* Сначала пункты без раздела: там «не выбрано» и общий вид. */}
              {props.options.filter((option) => option.group === undefined).map((option) => (
                <Option key={option.value} option={option} value={props.value} onPick={pick} />
              ))}
              {[...new Set(props.options.map((option) => option.group))]
                .filter((group): group is string => group !== undefined)
                .map((group) => (
                  <section key={group}>
                    <h6 className="picker-group">{group}</h6>
                    {props.options.filter((option) => option.group === group).map((option) => (
                      <Option key={option.value} option={option} value={props.value} onPick={pick} />
                    ))}
                  </section>
                ))}
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  );

  if (props.label === undefined) return field;

  return (
    <label className="field">
      <span>{props.label}</span>
      {field}
      {props.hint !== undefined && <span className="muted small">{props.hint}</span>}
    </label>
  );
}
