/**
 * Форма своего вида элемента (движок E4).
 *
 * Форма только собирает введённое и показывает ответ ядра. Проверять здесь
 * нечего: те же правила нужны при переносе настроек из другой организации и
 * при импорте, и второй набор проверок в разметке разошёлся бы с первым.
 */

import { useState } from 'react';
import type { CustomElementType, CustomField, CustomElementPlacement } from '@izh/contracts';
import { CUSTOM_ELEMENT_PLACEMENTS, CUSTOM_FIELD_KINDS } from '@izh/contracts';
import { buildCustomElement, type CustomElementDraft } from '@izh/core';
import { readIconFile } from './icon-picker';
import { STANDARD_CARD_FIELDS } from './standard-card-fields';
import { SelectField } from './SelectField';

/** Цвета значка: те же, что у встроенных видов, чтобы план не пестрил. */
const COLORS: readonly string[] = [
  '#dc2626', '#ea580c', '#b45309', '#15803d', '#0891b2',
  '#2563eb', '#7c3aed', '#db2777', '#475569',
];

export interface CustomElementEditorProps {
  /** Правится существующий вид или заводится новый. */
  readonly type: CustomElementType | null;
  readonly existing: readonly CustomElementType[];
  readonly newId: () => string;
  readonly now: () => string;
  readonly onSave: (type: CustomElementType) => void;
  readonly onCancel: () => void;
}

function draftOf(type: CustomElementType | null): CustomElementDraft {
  if (type === null) {
    return {
      typeCode: null, title: '', mark: '', color: COLORS[0] as string, iconDataUrl: null,
      placements: ['этаж'], fields: [], note: null,
    };
  }
  return {
    typeCode: type.typeCode, title: type.title, mark: type.mark, color: type.color,
    iconDataUrl: type.iconDataUrl,
    placements: type.placements, fields: type.fields, note: type.note,
  };
}

export function CustomElementEditor(props: CustomElementEditorProps): React.JSX.Element {
  const [draft, setDraft] = useState<CustomElementDraft>(() => draftOf(props.type));
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CustomElementDraft>(key: K, value: CustomElementDraft[K]): void => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const setField = (id: string, patch: Partial<CustomField>): void =>
    set('fields', draft.fields.map((field) => (field.id === id ? { ...field, ...patch } : field)));

  const togglePlacement = (placement: CustomElementPlacement): void =>
    set('placements', draft.placements.includes(placement)
      ? draft.placements.filter((item) => item !== placement)
      : [...draft.placements, placement]);

  const save = (): void => {
    const result = buildCustomElement({
      draft, existing: props.existing, now: props.now(), newTypeCode: `custom-${props.newId()}`,
    });
    if (!result.ok) { setError(result.error.message); return; }
    props.onSave(result.value);
  };

  return (
    <div className="custom-element-editor">
      <div className="field-row">
        <label className="field custom-element-title">
          <span>Название вида</span>
          <input
            value={draft.title}
            placeholder="Ящик с песком"
            onChange={(event) => set('title', event.target.value)}
          />
        </label>
        <label className="field custom-element-mark">
          <span>Пометка на значке</span>
          <input value={draft.mark} placeholder="ЯП" maxLength={5} onChange={(event) => set('mark', event.target.value)} />
        </label>
      </div>

      <div className="field">
        <span>Значок</span>
        {/*
          * Картинка необязательна: без неё рисуется буквенная пометка на
          * цветном поле — так же, как у встроенных видов без своего рисунка.
          * Пометка и цвет остаются заданными и при картинке: они запасное
          * обозначение и подпись в списках.
          */}
        <div className="custom-icon-row">
          {draft.iconDataUrl === null ? (
            <span className="element-mark custom-mark-preview" style={{ background: draft.color }}>
              {draft.mark === '' ? '?' : draft.mark}
            </span>
          ) : (
            <span className="element-icon element-icon-large">
              <img src={draft.iconDataUrl} alt="Значок вида" />
            </span>
          )}
          <label className="link small custom-icon-pick">
            {draft.iconDataUrl === null ? 'выбрать картинку' : 'заменить картинку'}
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file === undefined) return;
                // Срыв чтения файла называется словами, а не молчанием:
                // необработанное обещание не оставляет даже следа.
                void readIconFile(file)
                  .then((result) => {
                    if (!result.ok) { setError(result.error); return; }
                    set('iconDataUrl', result.dataUrl);
                  })
                  .catch(() => setError('Картинку прочитать не удалось.'));
              }}
            />
          </label>
          {draft.iconDataUrl !== null && (
            <button
              type="button"
              className="link small"
              onClick={() => set('iconDataUrl', null)}
            >
              убрать картинку
            </button>
          )}
        </div>
      </div>

      <div className="field">
        <span>Цвет запасного значка</span>
        {/* Готовые цвета, а не палитра: цветом на плане обозначено состояние
            оборудования, и произвольный оттенок спорил бы с ним. */}
        <div className="custom-color-row">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={draft.color === color ? 'custom-color active' : 'custom-color'}
              style={{ background: color }}
              title={color}
              aria-label={`Цвет ${color}`}
              onClick={() => set('color', color)}
            />
          ))}
        </div>
      </div>

      <div className="field">
        <span>Где применяется</span>
        <div className="custom-placements">
          {CUSTOM_ELEMENT_PLACEMENTS.map((placement) => (
            <label key={placement} className="checkbox">
              <input
                type="checkbox"
                checked={draft.placements.includes(placement)}
                onChange={() => togglePlacement(placement)}
              />
              <span>{placement}</span>
            </label>
          ))}
        </div>
      </div>

      <h5>Поля карточки</h5>

      {/*
        * Сначала показывается то, что и так будет в карточке.
        *
        * Заказчик: «показывать стандартные поля для заполнения карточки +
        * предлагать создать собственные». Раньше здесь стояла строка «учётный
        * номер и прочее заводить не нужно» — и человек всё равно заводил
        * поля-двойники, потому что не видел, что именно уже есть.
        */}
      <p className="muted small">
        Эти поля будут у каждой единицы этого вида — заводить их не нужно:
      </p>
      <ul className="standard-fields">
        {STANDARD_CARD_FIELDS.map((field) => (
          <li key={field.title}>
            <span>{field.title}</span>
            <span className="muted small">{field.hint}</span>
          </li>
        ))}
      </ul>

      <h5>Свои поля</h5>
      <p className="muted small">
        То, что нужно именно этому виду и чего нет выше: объём, марка песка, длина рукава.
      </p>

      {draft.fields.length === 0 && <p className="muted small">Своих полей пока нет.</p>}

      <ul className="plain-list custom-fields">
        {draft.fields.map((field) => (
          <li key={field.id}>
            <div className="field-row">
              <label className="field">
                <span>Название поля</span>
                <input value={field.title} onChange={(event) => setField(field.id, { title: event.target.value })} />
              </label>
              <label className="field custom-field-kind">
                <span>Чем заполняется</span>
                <SelectField
                  value={field.kind}
                  options={CUSTOM_FIELD_KINDS.map((kind) => ({ value: kind, title: kind }))}
                  onChange={(value) => setField(field.id, { kind: value as CustomField['kind'] })}
                />
              </label>
              {field.kind === 'число' && (
                <label className="field custom-field-unit">
                  <span>Единица</span>
                  <input
                    value={field.unit ?? ''}
                    placeholder="кг"
                    onChange={(event) => setField(field.id, { unit: event.target.value })}
                  />
                </label>
              )}
              <button
                type="button"
                className="link small"
                onClick={() => set('fields', draft.fields.filter((item) => item.id !== field.id))}
              >
                убрать
              </button>
            </div>
            {field.kind === 'список' && (
              <label className="field">
                <span>Варианты через запятую</span>
                <input
                  value={field.options.join(', ')}
                  placeholder="целый, повреждён, отсутствует"
                  onChange={(event) => setField(field.id, {
                    options: event.target.value.split(',').map((option) => option.trim()),
                  })}
                />
              </label>
            )}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => set('fields', [
          ...draft.fields,
          { id: props.newId(), title: '', kind: 'текст', options: [], unit: null, hint: null },
        ])}
      >
        Добавить своё поле
      </button>

      <label className="field">
        <span>Примечание</span>
        <input
          value={draft.note ?? ''}
          placeholder="Для чего этот вид заведён"
          onChange={(event) => set('note', event.target.value)}
        />
      </label>

      {error !== null && <p className="error">{error}</p>}

      <div className="actions">
        <button type="button" className="primary" onClick={save}>
          {props.type === null ? 'Завести вид' : 'Сохранить вид'}
        </button>
        <button type="button" onClick={props.onCancel}>Отмена</button>
      </div>
    </div>
  );
}
