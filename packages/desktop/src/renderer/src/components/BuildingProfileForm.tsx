/**
 * Карточка характеристик здания в части пожарной безопасности.
 *
 * Форма строится из данных: перечень полей и наборы значений живут в ядре
 * (building-profile.ts). Добавить характеристику при смене нормативной базы —
 * значит дописать строку в ту таблицу, а не править этот файл.
 *
 * Значения с фиксированным набором выбираются списком, а не набираются руками:
 * от степени огнестойкости и класса функциональной пожарной опасности зависят
 * нормативные требования, и опечатка исказила бы выводы программы.
 */

import type { BuildingProfile } from '@izh/contracts';
import { functionalClassLabel, BUILDING_PROFILE_FIELDS, EMPTY_BUILDING_PROFILE, type ProfileField } from '@izh/core';
import { SelectField } from './SelectField';

export interface BuildingProfileFormProps {
  readonly profile: BuildingProfile | null;
  readonly disabled: boolean;
  readonly onChange: (profile: BuildingProfile) => void;
}

export function BuildingProfileForm(props: BuildingProfileFormProps): React.JSX.Element {
  const profile = props.profile ?? EMPTY_BUILDING_PROFILE;

  const change = (field: ProfileField, raw: string): void => {
    const value = raw.trim() === '' ? null : raw;
    if (field.kind === 'number') {
      const parsed = value === null ? null : Number(value.replace(',', '.'));
      props.onChange({ ...profile, [field.key]: parsed === null || Number.isFinite(parsed) ? parsed : null });
      return;
    }
    props.onChange({ ...profile, [field.key]: value });
  };

  return (
    <div className="profile-form">
      {/*
        * Своего заголовка у формы нет: его ставит карточка, внутри которой
        * форма и показывается. Раньше их было два подряд — «Характеристики по
        * пожарной безопасности» от карточки и «Характеристики пожарной
        * безопасности» отсюда, — и раздел читался как два разных.
        */}
      <p className="muted small">
        Значения берутся из проекта, паспорта здания или расчёта категорий. Программа их не рассчитывает.
      </p>

      {BUILDING_PROFILE_FIELDS.map((field) => {
        const current = profile[field.key];
        const shown = current === null ? '' : String(current);

        return (
          <label className="field" key={field.key}>
            <span>
              {field.title}
              {field.unit !== null && `, ${field.unit}`}
            </span>

            {field.kind === 'multi-select' ? (
              <MultiSelect
                value={shown}
                options={field.options}
                {...(field.key === 'functionalClasses' ? { label: functionalClassLabel } : {})}
                disabled={props.disabled}
                onChange={(next) => props.onChange({ ...profile, [field.key]: next === '' ? null : next })}
              />
            ) : field.kind === 'select' ? (
              <SelectField
                value={shown}
                placeholder="не задано"
                disabled={props.disabled}
                options={field.options.map((option) => ({ value: option, title: option }))}
                onChange={(value) => change(field, value)}
              />
            ) : (
              <input
                value={shown}
                disabled={props.disabled}
                inputMode={field.kind === 'number' ? 'decimal' : 'text'}
                placeholder="не задано"
                onChange={(event) => change(field, event.target.value)}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}

interface MultiSelectProps {
  readonly value: string;
  /**
   * Как назвать значение в списке выбора.
   *
   * Обозначение «Ф4.3» само по себе не говорит ничего, и в списке рядом с ним
   * стоит расшифровка. Среди выбранного остаётся одно обозначение: там оно
   * уже опознано, а описание заняло бы всю строку.
   */
  readonly label?: (option: string) => string;
  readonly options: readonly string[];
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
}

/**
 * Несколько значений в одном поле.
 *
 * Здание нередко совмещает назначения: административная часть Ф4.3 и
 * производственная Ф5.1. Выбранные значения показываются отдельными метками и
 * хранятся строкой через запятую — так их видно и в выгрузке, и в отчёте.
 */
function MultiSelect(props: MultiSelectProps): React.JSX.Element {
  const chosen = props.value === '' ? [] : props.value.split(',').map((item) => item.trim());
  const available = props.options.filter((option) => !chosen.includes(option));

  const set = (next: readonly string[]): void => {
    // Порядок хранится тот же, что в справочнике: иначе одно и то же сочетание
    // выглядело бы по-разному в отчётах.
    const ordered = props.options.filter((option) => next.includes(option));
    props.onChange(ordered.join(', '));
  };

  return (
    <div className="multi-select">
      {chosen.length > 0 && (
        <div className="chips">
          {chosen.map((item) => (
            <span className="chip" key={item}>
              {item}
              {!props.disabled && (
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
        * Выбор остаётся пустым: он не показывает выбранное, а добавляет к нему.
        * Уже выбранное стоит метками выше и в списке не повторяется.
        */}
      <SelectField
        value=""
        placeholder={chosen.length === 0 ? 'не задано' : 'добавить ещё'}
        disabled={props.disabled || available.length === 0}
        options={available.map((option) => ({
          value: option,
          title: props.label === undefined ? option : props.label(option),
        }))}
        onChange={(value) => { if (value !== '') set([...chosen, value]); }}
      />
    </div>
  );
}
