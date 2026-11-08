/**
 * Поля карточки наружного пожарного гидранта (ТЗ, Дополнение 6).
 *
 * Марку, изготовителя и заводской номер здесь не спрашивают: в колодце гидрант
 * знают по учётному номеру и по табличке, а паспорт остаётся у водоканала.
 * Спрашивают то, без чего к нему не подъедешь и не подключишься: на какой сети
 * стоит, какая колонка подходит, на какой глубине сидит.
 */

import {
  HYDRANT_HEIGHTS_MM, HYDRANT_PATTERNS, HYDRANT_PLACEMENT_KINDS,
  NETWORK_DIAMETERS_MM, WATER_NETWORK_KINDS,
} from '@izh/core';
import type { OutdoorHydrantProfile } from '@izh/contracts';
import { ComboField } from './ComboField';
import { SelectField } from './SelectField';

export const EMPTY_OUTDOOR_HYDRANT: OutdoorHydrantProfile = {
  placementKind: null,
  pattern: null,
  networkKind: null,
  networkDiameterMm: null,
  heightMm: null,
  signDistanceLeftM: null,
  signDistanceRightM: null,
  signDistanceDownM: null,
};

export interface OutdoorHydrantFieldsProps {
  readonly value: OutdoorHydrantProfile;
  readonly onChange: (value: OutdoorHydrantProfile) => void;
}

export function OutdoorHydrantFields(props: OutdoorHydrantFieldsProps): React.JSX.Element {
  const set = <K extends keyof OutdoorHydrantProfile>(key: K, value: OutdoorHydrantProfile[K]): void =>
    props.onChange({ ...props.value, [key]: value });

  return (
    <>
      <label className="field">
        <span>Вид пожарного гидранта</span>
        <SelectField
          value={props.value.placementKind ?? ''}
          placeholder="не указан"
          options={HYDRANT_PLACEMENT_KINDS.map((kind) => ({ value: kind, title: kind }))}
          onChange={(value) => set('placementKind', value === '' ? null : value)}
        />
      </label>

      {/* Образец вводится и свой: у обозначения на табличке при этом не
          возникнет буквы — придумывать её нельзя, к гидранту чужого образца
          колонка не подходит. */}
      <ComboField
        label="Тип (образец) ПГ"
        value={props.value.pattern}
        options={HYDRANT_PATTERNS.filter((item) => item.sign !== '').map((item) => item.name)}
        onChange={(pattern) => set('pattern', pattern)}
      />

      <ComboField
        label="Тип водопроводной сети"
        value={props.value.networkKind}
        options={WATER_NETWORK_KINDS.map((item) => item.name)}
        onChange={(networkKind) => set('networkKind', networkKind)}
      />

      <div className="field-row">
        <label className="field">
          <span>Диаметр сети, мм</span>
          <SelectField
            value={props.value.networkDiameterMm === null ? '' : String(props.value.networkDiameterMm)}
            placeholder="не указан"
            options={NETWORK_DIAMETERS_MM.map((mm) => ({ value: String(mm), title: String(mm) }))}
            onChange={(value) => set('networkDiameterMm', value === '' ? null : Number(value))}
          />
        </label>

        <label className="field">
          <span>Высота ПГ, мм</span>
          <SelectField
            value={props.value.heightMm === null ? '' : String(props.value.heightMm)}
            placeholder="не указана"
            options={HYDRANT_HEIGHTS_MM.map((mm) => ({ value: String(mm), title: String(mm) }))}
            onChange={(value) => set('heightMm', value === '' ? null : Number(value))}
          />
        </label>
      </div>
    </>
  );
}
