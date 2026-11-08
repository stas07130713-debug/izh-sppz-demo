/**
 * Поля карточек наружного оборудования (ТЗ, Дополнение 6):
 * ограждение кровли, пожарный щит, насосная станция.
 *
 * Три коротких набора в одном файле: у каждого по горсти граф, и разносить их
 * по трём файлам значило бы плодить одинаковую обвязку ради пяти полей.
 * Спрашивается только то, без чего оборудование не проверить.
 */

import {
  FIRE_BOARD_INVENTORY, PRESENCE, PUMP_CONTROL_MODES,
  PUMP_STATION_PURPOSES, ROOF_KINDS, SAND_BOX_VOLUMES, WATER_BARREL_VOLUMES,
  requiredFenceHeight,
} from '@izh/core';
import type { FireBoardProfile, PumpStationProfile, RoofFenceProfile } from '@izh/contracts';
import { ComboField } from './ComboField';
import { MultiSelectField } from './MultiSelectField';
import { SelectField } from './SelectField';

export const EMPTY_ROOF_FENCE: RoofFenceProfile = {
  roofKind: null, buildingHeightM: null, fenceHeightM: null, fenceLengthM: null, coating: null,
};
export const EMPTY_FIRE_BOARD: FireBoardProfile = {
  place: null, inventory: [], sandBoxM3: null, waterBarrelL: null,
};
export const EMPTY_PUMP_STATION: PumpStationProfile = {
  purpose: null, workingPumps: null, standbyPumps: null,
  capacityLps: null, headM: null, control: [], backupPower: null,
};

/** Число из поля ввода: пустая строка и мусор дают «не указано», а не ноль. */
function numberOrNull(raw: string): number | null {
  if (raw.trim() === '') return null;
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function Picker(props: {
  readonly label: string; readonly value: string | null;
  readonly options: readonly string[]; readonly empty: string;
  readonly onChange: (value: string | null) => void;
}): React.JSX.Element {
  return (
    <label className="field">
      <span>{props.label}</span>
      <SelectField
        value={props.value ?? ''}
        placeholder={props.empty}
        options={props.options.map((item) => ({ value: item, title: item }))}
        onChange={(value) => props.onChange(value === '' ? null : value)}
      />
    </label>
  );
}

/** Число с подсказками: типовое выбирается из списка, своё вводится в том же поле. */
function NumberComboField(props: {
  readonly label: string; readonly value: number | null;
  readonly options: readonly number[];
  readonly onChange: (value: number | null) => void;
}): React.JSX.Element {
  return (
    <ComboField
      label={props.label}
      value={props.value === null ? null : String(props.value)}
      options={props.options.map((item) => String(item))}
      placeholder="нет или своё значение"
      onChange={(raw) => props.onChange(raw === null ? null : numberOrNull(raw))}
    />
  );
}

export function RoofFenceFields(props: {
  readonly value: RoofFenceProfile;
  readonly onChange: (value: RoofFenceProfile) => void;
}): React.JSX.Element {
  const set = <K extends keyof RoofFenceProfile>(key: K, value: RoofFenceProfile[K]): void =>
    props.onChange({ ...props.value, [key]: value });
  const required = requiredFenceHeight(props.value.buildingHeightM);
  const low = required !== null && props.value.fenceHeightM !== null && props.value.fenceHeightM < required;

  return (
    <>
      <Picker
        label="Вид кровли" value={props.value.roofKind} options={ROOF_KINDS} empty="не указан"
        onChange={(roofKind) => set('roofKind', roofKind)}
      />

      <div className="field-row">
        <label className="field"><span>Высота здания, м</span>
          <input
            inputMode="decimal" placeholder="24" value={props.value.buildingHeightM ?? ''}
            onChange={(event) => set('buildingHeightM', numberOrNull(event.target.value))}
          />
        </label>
        <label className="field"><span>Высота ограждения, м</span>
          <input
            inputMode="decimal" placeholder="0,8" value={props.value.fenceHeightM ?? ''}
            onChange={(event) => set('fenceHeightM', numberOrNull(event.target.value))}
          />
        </label>
      </div>

      {/* Целое ограждение может быть ниже положенного: одной целостности мало,
          низкое ограждение не удержит человека (ГОСТ Р 53254-2009, таблица 3). */}
      {required !== null && (
        <p className={low ? 'error small' : 'muted small'}>
          При такой высоте здания ограждение должно быть не ниже {required} м
          {low ? ' — фактическое ниже нормы.' : '.'}
        </p>
      )}

      <div className="field-row">
        <label className="field"><span>Длина ограждения, м</span>
          <input
            inputMode="decimal" placeholder="180" value={props.value.fenceLengthM ?? ''}
            onChange={(event) => set('fenceLengthM', numberOrNull(event.target.value))}
          />
        </label>
        <Picker
          label="Защитное покрытие" value={props.value.coating} options={PRESENCE} empty="не указано"
          onChange={(coating) => set('coating', coating)}
        />
      </div>
    </>
  );
}

export function FireBoardFields(props: {
  readonly value: FireBoardProfile;
  readonly onChange: (value: FireBoardProfile) => void;
}): React.JSX.Element {
  const set = <K extends keyof FireBoardProfile>(key: K, value: FireBoardProfile[K]): void =>
    props.onChange({ ...props.value, [key]: value });

  return (
    <>
      {/* Место пишется как есть: подсказывать «у склада» бессмысленно —
          на каждом предприятии свои названия мест. */}
      <label className="field">
        <span>Место установки</span>
        <input
          value={props.value.place ?? ''}
          placeholder="у ворот склада ГСМ"
          onChange={(event) => set('place', event.target.value.trim() === '' ? null : event.target.value)}
        />
      </label>

      {/* Главное у щита — что на нём есть. Отмечается по списку, а не пишется
          текстом: только так видно, чего не хватает, и только так это попадает
          в журнал сравнимым видом. */}
      <MultiSelectField
        label="Инвентарь на щите" options={FIRE_BOARD_INVENTORY}
        value={props.value.inventory} emptyLabel="не отмечен" allowCustom
        onChange={(inventory) => set('inventory', inventory)}
      />
      <p className="muted small">
        Отмечается то, что на щите есть; чего нет в списке — вписывается своим значением. Нормы
        комплектации по типу щита — ППР РФ №1479, приложение 6.
      </p>

      {/* Объёмы вводятся своим значением: типовые ящики бывают 0,5, 1 и 3 м³,
          но на объекте встречается и сваренный по месту. */}
      <div className="field-row">
        <NumberComboField
          label="Ящик с песком, м³" value={props.value.sandBoxM3} options={SAND_BOX_VOLUMES}
          onChange={(sandBoxM3) => set('sandBoxM3', sandBoxM3)}
        />
        <NumberComboField
          label="Бочка с водой, л" value={props.value.waterBarrelL} options={WATER_BARREL_VOLUMES}
          onChange={(waterBarrelL) => set('waterBarrelL', waterBarrelL)}
        />
      </div>
    </>
  );
}

export function PumpStationFields(props: {
  readonly value: PumpStationProfile;
  readonly onChange: (value: PumpStationProfile) => void;
}): React.JSX.Element {
  const set = <K extends keyof PumpStationProfile>(key: K, value: PumpStationProfile[K]): void =>
    props.onChange({ ...props.value, [key]: value });

  return (
    <>
      <Picker
        label="Назначение" value={props.value.purpose} options={PUMP_STATION_PURPOSES}
        empty="не указано" onChange={(purpose) => set('purpose', purpose)}
      />

      {/* Рабочие и резервные считаются порознь: станция с одним рабочим и без
          резервного своей задачи не выполняет, хотя «насос есть». */}
      <div className="field-row">
        <label className="field"><span>Насосов рабочих</span>
          <input
            inputMode="numeric" placeholder="1" value={props.value.workingPumps ?? ''}
            onChange={(event) => set('workingPumps', numberOrNull(event.target.value))}
          />
        </label>
        <label className="field"><span>Насосов резервных</span>
          <input
            inputMode="numeric" placeholder="1" value={props.value.standbyPumps ?? ''}
            onChange={(event) => set('standbyPumps', numberOrNull(event.target.value))}
          />
        </label>
      </div>

      <div className="field-row">
        <label className="field"><span>Подача, л/с</span>
          <input
            inputMode="decimal" placeholder="20" value={props.value.capacityLps ?? ''}
            onChange={(event) => set('capacityLps', numberOrNull(event.target.value))}
          />
        </label>
        <label className="field"><span>Напор, м</span>
          <input
            inputMode="decimal" placeholder="60" value={props.value.headM ?? ''}
            onChange={(event) => set('headM', numberOrNull(event.target.value))}
          />
        </label>
      </div>

      <MultiSelectField
        label="Управление насосами" options={PUMP_CONTROL_MODES}
        value={props.value.control} emptyLabel="не задано"
        onChange={(control) => set('control', control)}
      />

      <Picker
        label="Резервное электропитание" value={props.value.backupPower} options={PRESENCE}
        empty="не указано" onChange={(backupPower) => set('backupPower', backupPower)}
      />
    </>
  );
}
