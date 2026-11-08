/**
 * Поля карточки модульной автономной установки пожаротушения
 * (ТЗ, Дополнение 6).
 *
 * Установка срабатывает без прибора управления, поэтому в карточке должно быть
 * записано всё, чем она отличается от прочего оборудования: чем тушит, что
 * защищает, как запускается и как обнаруживает пожар. По этим сведениям её
 * проверяют и подбирают замену.
 *
 * Вид огнетушащего вещества здесь не задаётся: он выражен подвидом установки в
 * каталоге — так же, как заряд у огнетушителя. Выбирается он тем же списком
 * «Вид установки» выше, и второго места для той же величины быть не должно.
 */

import type { SuppressionProfile } from '@izh/contracts';
import { ComboField } from './ComboField';
import { MultiSelectField } from './MultiSelectField';

export const EMPTY_SUPPRESSION: SuppressionProfile = {
  protectedZone: null,
  startModes: [],
  detection: null,
};


const ZONES: readonly string[] = [
  'помещение', 'оборудование', 'шкаф', 'электроустановка', 'технологический участок',
];

/**
 * Способы пуска.
 *
 * Список разнородный намеренно: первые четыре — кто и откуда запускает, вторые
 * три — чем приводится в действие. На одной установке бывает и то, и другое
 * сразу: автоматический пуск с электрическим приводом и резервный ручной
 * местный. Поэтому выбирается несколько значений, а не одно.
 */
const START_MODES: readonly string[] = [
  'автоматический пуск', 'ручной пуск', 'дистанционный пуск', 'местный пуск',
  'электрический', 'механический', 'пневматический', 'иной способ',
];

const DETECTION: readonly string[] = ['тепловое', 'дымовое', 'пламени'];

export interface SuppressionFieldsProps {
  readonly value: SuppressionProfile;
  readonly onChange: (value: SuppressionProfile) => void;
}

export function SuppressionFields(props: SuppressionFieldsProps): React.JSX.Element {

  return (
    <>
      <ComboField
        label="Защищаемая зона"
        value={props.value.protectedZone}
        options={ZONES}
        onChange={(protectedZone) => props.onChange({ ...props.value, protectedZone })}
      />

      <MultiSelectField
        label="Пуск установки"
        options={START_MODES}
        value={props.value.startModes}
        emptyLabel="не задан"
        onChange={(startModes) => props.onChange({ ...props.value, startModes })}
      />
      <p className="muted small">
        Отмечается всё, что применимо: способ запуска и вид привода бывают на одной установке сразу.
      </p>


      <ComboField
        label="Обнаружение пожара"
        value={props.value.detection}
        options={DETECTION}
        onChange={(detection) => props.onChange({ ...props.value, detection })}
      />
    </>
  );
}
