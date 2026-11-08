/**
 * Поля карточки прибора приёмно-контрольного (ТЗ, Дополнение 6).
 *
 * Прибор — голова системы пожарной автоматики, поэтому его карточка отвечает
 * не только за железку, но и за систему целиком: исполнение, чем питается при
 * пропадании сети, какой проект по ней выполнен.
 *
 * Изготовитель и модель подсказываются справочником: «С2000М», «с2000 м» и
 * «Болид С2000М» в журнале оказываются тремя разными приборами. Список —
 * подсказка, а не запрет: своё значение вводится в том же поле.
 */

import {
  BATTERY_KINDS, BACKUP_POWER_SOURCES, BATTERY_SOURCES, AUTOMATION_MANUFACTURERS,
  automationModels, SYSTEM_HEAD_TYPE,
} from '@izh/core';
import { ComboField } from './ComboField';
import type { BackupPowerProfile, ControlPanelProfile } from '@izh/contracts';
import { SelectField } from './SelectField';

export const EMPTY_CONTROL_PANEL: ControlPanelProfile = {
  execution: null,
  backupPower: null,
  projectDocuments: [],
};

const EMPTY_BACKUP: BackupPowerProfile = {
  source: null,
  batteryKind: null,
  capacityAh: null,
  count: null,
};

export interface ControlPanelFieldsProps {
  readonly value: ControlPanelProfile;
  readonly onChange: (value: ControlPanelProfile) => void;
  /** Изготовитель и модель живут в общих полях объекта, а выбираются здесь. */
  readonly manufacturer: string;
  readonly model: string;
  readonly onManufacturerChange: (value: string) => void;
  readonly onModelChange: (value: string) => void;
}

/** Число из поля ввода: пустая строка и мусор дают «не указано», а не ноль. */
function numberOrNull(raw: string): number | null {
  if (raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function ControlPanelFields(props: ControlPanelFieldsProps): React.JSX.Element {
  const backup = props.value.backupPower;

  return (
    <>
      <label className="field">
        <span>Исполнение</span>
        <SelectField
          value={props.value.execution ?? ''}
          placeholder="не указано"
          options={[
            { value: 'ППКП', title: 'ППКП — приёмно-контрольный' },
            { value: 'ППКУ', title: 'ППКУ — приёмно-контрольный и управления' },
          ]}
          onChange={(value) => props.onChange({
            ...props.value,
            execution: value === '' ? null : value as 'ППКП' | 'ППКУ',
          })}
        />
      </label>

      <ComboField
        label="Изготовитель"
        value={props.manufacturer === '' ? null : props.manufacturer}
        options={AUTOMATION_MANUFACTURERS.map((item) => item.name)}
        onChange={(value) => {
          // Смена изготовителя обнуляет модель: держать «Сириус» у «Рубежа»
          // хуже, чем пустое поле, — такая пара выглядит достоверной.
          if (value !== props.manufacturer) props.onModelChange('');
          props.onManufacturerChange(value ?? '');
        }}
      />

      <ComboField
        label="Марка, модель"
        value={props.model === '' ? null : props.model}
        options={automationModels(props.manufacturer, SYSTEM_HEAD_TYPE)}
        onChange={(value) => props.onModelChange(value ?? '')}
      />

      <fieldset className="backup-power">
        <legend>Резервное питание</legend>

        <label className="field">
          <span>Чем запитан при пропадании сети</span>
          <SelectField
            value={backup?.source ?? ''}
            placeholder="не указано"
            options={BACKUP_POWER_SOURCES.map((source) => ({ value: source, title: source }))}
            onChange={(source) => props.onChange({
              ...props.value,
              backupPower: source === '' ? null : { ...(backup ?? EMPTY_BACKUP), source },
            })}
          />
        </label>

        {/* Тип, ёмкость и количество спрашиваются только там, где батареи
            есть: у отдельной линии их нет, и пустые графы только мешали бы. */}
        {backup !== null && BATTERY_SOURCES.includes(backup.source ?? '') && (
          <>
            <ComboField
              label="Тип АКБ"
              value={backup.batteryKind}
              options={BATTERY_KINDS}
              onChange={(batteryKind) => props.onChange({ ...props.value, backupPower: { ...backup, batteryKind } })}
            />

            <div className="field-row">
              <label className="field">
                <span>Ёмкость, А·ч</span>
                <input
                  inputMode="decimal"
                  value={backup.capacityAh ?? ''}
                  onChange={(event) => props.onChange({
                    ...props.value,
                    backupPower: { ...backup, capacityAh: numberOrNull(event.target.value) },
                  })}
                  placeholder="7"
                />
              </label>
              <label className="field">
                <span>Количество, шт.</span>
                <input
                  inputMode="numeric"
                  value={backup.count ?? ''}
                  onChange={(event) => props.onChange({
                    ...props.value,
                    backupPower: { ...backup, count: numberOrNull(event.target.value) },
                  })}
                  placeholder="2"
                />
              </label>
            </div>
            <p className="muted small">
              Время работы системы без сети считается по ёмкости и количеству вместе — одна цифра без
              другой ничего не говорит.
            </p>
          </>
        )}
      </fieldset>
    </>
  );
}
