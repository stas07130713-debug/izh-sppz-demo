/**
 * Поля карточки пожарного крана (ТЗ, Дополнение 6).
 *
 * Четыре величины, по которым кран подбирают и обслуживают: условный проход
 * клапана, диаметр рукава, соединительная головка и диаметр спрыска ствола. Без
 * них нельзя ни проверить водоотдачу, ни подобрать рукав на замену.
 *
 * Марки, изготовителя и заводского номера у крана в карточке нет намеренно: их
 * на объекте не ведут, и пустые графы только мешали бы искать нужное.
 *
 * Значение выбирается из обычных или вписывается своё. Список закрытым делать
 * нельзя: заказчик называет Ду 50 и Ду 65 как расхожие, но на объекте
 * встречается и другое, и записать надо то, что стоит, а не ближайшее из
 * списка.
 */

import type { HydrantProfile } from '@izh/contracts';
import { ComboField } from './ComboField';

export const EMPTY_HYDRANT_PROFILE: HydrantProfile = {
  valveBore: null,
  hoseDiameter: null,
  couplingHead: null,
  nozzleBore: null,
};

interface FieldSpec {
  readonly key: keyof HydrantProfile;
  readonly label: string;
  readonly options: readonly string[];
}

const FIELDS: readonly FieldSpec[] = [
  { key: 'valveBore', label: 'Условный проход пожарного клапана (Ду)', options: ['Ду 50', 'Ду 65'] },
  { key: 'hoseDiameter', label: 'Диаметр пожарного рукава', options: ['51 мм', '66 мм'] },
  { key: 'couplingHead', label: 'Соединительная головка (полугайка)', options: ['ГР-50', 'ГР-70'] },
  { key: 'nozzleBore', label: 'Диаметр спрыска пожарного ствола', options: ['13 мм', '16 мм', '19 мм'] },
];

export interface HydrantProfileFieldsProps {
  readonly value: HydrantProfile;
  readonly onChange: (value: HydrantProfile) => void;
}

export function HydrantProfileFields(props: HydrantProfileFieldsProps): React.JSX.Element {
  return (
    <>
      {FIELDS.map((field) => (
        <ComboField
          key={field.key}
          label={field.label}
          value={props.value[field.key]}
          options={field.options}
          onChange={(value) => props.onChange({ ...props.value, [field.key]: value })}
        />
      ))}
    </>
  );
}
