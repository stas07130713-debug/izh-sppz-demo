/**
 * Поля карточки наружной пожарной лестницы (ТЗ, Дополнение 6).
 *
 * Марки и изготовителя у лестницы не спрашивают: её варят по проекту на месте,
 * а не покупают изделием. Спрашивают то, по чему её опознают и испытывают:
 * тип, место, размеры, ограждение и площадку.
 */

import { LADDER_PLACES, LADDER_PRESENCE, LADDER_TYPES, ladderSubtypesFor } from '@izh/core';
import type { LadderProfile } from '@izh/contracts';
import { ComboField } from './ComboField';
import { SelectField } from './SelectField';

export const EMPTY_LADDER: LadderProfile = {
  ladderType: null,
  ladderSubtype: null,
  mountingPlace: null,
  heightM: null,
  widthM: null,
  railing: null,
  platform: null,
};

export interface LadderFieldsProps {
  readonly value: LadderProfile;
  readonly onChange: (value: LadderProfile) => void;
}

/** Число из поля ввода: пустая строка и мусор дают «не указано», а не ноль. */
function numberOrNull(raw: string): number | null {
  if (raw.trim() === '') return null;
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function LadderFields(props: LadderFieldsProps): React.JSX.Element {
  const subtypes = ladderSubtypesFor(props.value.ladderType);

  return (
    <>
      <SelectField
        label="Тип лестницы"
        value={props.value.ladderType ?? ''}
        options={LADDER_TYPES.map((item) => ({ value: item, title: item }))}
        placeholder="не указан"
        onChange={(value) => {
          // Смена типа обнуляет подтип: у вертикальной лестницы подтип
          // маршевой бессмыслен, и оставшийся от прежнего типа соврал бы.
          props.onChange({ ...props.value, ladderType: value === '' ? null : value, ladderSubtype: null });
        }}
      />

      <SelectField
        label="Подтип лестницы"
        value={props.value.ladderSubtype ?? ''}
        options={subtypes.map((item) => ({ value: item, title: item }))}
        disabled={subtypes.length === 0}
        placeholder={subtypes.length === 0 ? 'сначала выберите тип' : 'не указан'}
        onChange={(value) => props.onChange({
          ...props.value,
          ladderSubtype: value === '' ? null : value,
        })}
      />

      <ComboField
        label="Место установки"
        value={props.value.mountingPlace}
        options={LADDER_PLACES}
        onChange={(mountingPlace) => props.onChange({ ...props.value, mountingPlace })}
      />

      <div className="field-row">
        <label className="field">
          <span>Высота, м</span>
          <input
            inputMode="decimal"
            value={props.value.heightM ?? ''}
            placeholder="12"
            onChange={(event) => props.onChange({ ...props.value, heightM: numberOrNull(event.target.value) })}
          />
        </label>
        <label className="field">
          <span>Ширина, м</span>
          <input
            inputMode="decimal"
            value={props.value.widthM ?? ''}
            placeholder="0,7"
            onChange={(event) => props.onChange({ ...props.value, widthM: numberOrNull(event.target.value) })}
          />
        </label>
      </div>

      {/* Отдельной графы «Ограждение» нет: оно уже сказано подтипом — П1-1 без
          ограждения, П1-2 с ним. Две графы об одном разошлись бы. */}
      <div className="field-row">
        <SelectField
                      label="Площадка"
                      value={props.value.platform ?? ''}
                      options={LADDER_PRESENCE.map((item) => ({ value: item, title: item }))}
                      placeholder="не указана"
                      onChange={(value) => props.onChange({
                        ...props.value,
                        platform: value === '' ? null : value,
                      })}
                    />
      </div>
      <p className="muted small">
        С высоты 6 м ограждение обязательно (ГОСТ Р 53254-2009), у маршевой лестницы обязательны и площадки.
      </p>
    </>
  );
}
