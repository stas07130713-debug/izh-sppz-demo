/**
 * Поля карточки пожарного водоисточника (ТЗ, Дополнение 6).
 *
 * Спрашивается то, от чего зависит, доедет ли расчёт и наберёт ли воду:
 * сколько её там, как её забирать, встанет ли машина и сколько машин сразу.
 * Марки, изготовителя и заводского номера у водоёма нет — это сооружение, а не
 * изделие.
 */

import {
  WATER_INTAKE_METHODS, WATER_SOURCE_EXECUTIONS, WATER_SOURCE_PAD,
  WATER_SOURCE_PLACEMENTS, WATER_SOURCE_VEHICLE_COUNTS,
} from '@izh/core';
import type { WaterSourceProfile } from '@izh/contracts';
import { ComboField } from './ComboField';
import { SelectField } from './SelectField';

export const EMPTY_WATER_SOURCE: WaterSourceProfile = {
  execution: null,
  placement: null,
  volumeM3: null,
  designVolumeM3: null,
  tankCount: null,
  intakeMethod: null,
  pad: null,
  vehicleCount: null,
};

export interface WaterSourceFieldsProps {
  readonly value: WaterSourceProfile;
  readonly onChange: (value: WaterSourceProfile) => void;
}

/** Число из поля ввода: пустая строка и мусор дают «не указано», а не ноль. */
function numberOrNull(raw: string): number | null {
  if (raw.trim() === '') return null;
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function WaterSourceFields(props: WaterSourceFieldsProps): React.JSX.Element {
  const set = <K extends keyof WaterSourceProfile>(key: K, value: WaterSourceProfile[K]): void =>
    props.onChange({ ...props.value, [key]: value });

  return (
    <>
      <div className="field-row">
        <SelectField
                  label="Исполнение"
                  value={props.value.execution ?? ''}
                  options={WATER_SOURCE_EXECUTIONS.map((item) => ({ value: item, title: item }))}
                  placeholder="не указано"
                  onChange={(v) => set('execution', v === '' ? null : v)}
                />
        <SelectField
                  label="Расположение"
                  value={props.value.placement ?? ''}
                  options={WATER_SOURCE_PLACEMENTS.map((item) => ({ value: item, title: item }))}
                  placeholder="не указано"
                  onChange={(v) => set('placement', v === '' ? null : v)}
                />
      </div>

      <div className="field-row">
        <label className="field">
          <span>Объём одного резервуара, м³</span>
          <input
            inputMode="decimal"
            value={props.value.volumeM3 ?? ''}
            placeholder="50"
            onChange={(e) => set('volumeM3', numberOrNull(e.target.value))}
          />
        </label>
        <label className="field">
          <span>Расчётный объём, м³</span>
          <input
            inputMode="decimal"
            value={props.value.designVolumeM3 ?? ''}
            placeholder="по проекту"
            onChange={(e) => set('designVolumeM3', numberOrNull(e.target.value))}
          />
        </label>
      </div>

      <label className="field">
        <span>Количество резервуаров</span>
        <input
          inputMode="numeric"
          value={props.value.tankCount ?? ''}
          placeholder="1"
          onChange={(e) => set('tankCount', numberOrNull(e.target.value))}
        />
      </label>
      <p className="muted small">
        Общий запас считается сам: объём одного резервуара, умноженный на их количество. При
        нескольких резервуарах на табличке он подписывается общим.
      </p>

      <ComboField
        label="Способ забора воды"
        value={props.value.intakeMethod}
        options={WATER_INTAKE_METHODS}
        onChange={(intakeMethod) => set('intakeMethod', intakeMethod)}
      />

      <label className="field">
        <span>Площадка для установки пожарной техники</span>
        <SelectField
          value={props.value.pad ?? ''}
          placeholder="не указано"
          options={WATER_SOURCE_PAD.map((item) => ({ value: item, title: item }))}
          onChange={(chosen) => {
            const pad = chosen === '' ? null : chosen;
            // Без площадки ставить машины некуда: количество перестаёт значить
            // что-либо и не должно остаться от прежнего ответа.
            props.onChange({ ...props.value, pad, vehicleCount: pad === 'есть' ? props.value.vehicleCount : null });
          }}
        />
      </label>

      {props.value.pad === 'есть' && (
        <label className="field">
          <span>Автомобилей одновременно, по проекту</span>
          <SelectField
            value={props.value.vehicleCount === null ? '' : String(props.value.vehicleCount)}
            placeholder="не определено"
            options={WATER_SOURCE_VEHICLE_COUNTS.map((count) => ({ value: String(count), title: String(count) }))}
            onChange={(value) => set('vehicleCount', value === '' ? null : Number(value))}
          />
        </label>
      )}
    </>
  );
}
