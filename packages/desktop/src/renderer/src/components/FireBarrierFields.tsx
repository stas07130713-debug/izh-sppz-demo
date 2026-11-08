/**
 * Поля карточки противопожарной преграды (ТЗ, Дополнение 6).
 *
 * Вид преграды и предел огнестойкости — то, по чему её подбирают, проверяют и
 * заменяют. Остальное у преграды общее с прочим оборудованием: марка,
 * изготовитель, заводской номер, дата установки, срок службы.
 *
 * Оба списка открытые: своё значение вводится прямо в поле. Обозначения
 * пределов стандартны, но встречаются и составные (EIW, EI 45 с уточнением по
 * проекту), и записать надо то, что стоит в документах на изделие.
 */

import type { FireBarrierProfile } from '@izh/contracts';
import { ComboField } from './ComboField';

export const EMPTY_FIRE_BARRIER: FireBarrierProfile = {
  barrierKind: null,
  fireResistance: null,
};

const KINDS: readonly string[] = ['Дверь', 'Ворота', 'Штора', 'Люк'];

/**
 * Обозначения предела огнестойкости.
 *
 * E — потеря целостности, I — потеря теплоизолирующей способности, W —
 * предельная плотность теплового потока. Число — время в минутах.
 */
const RESISTANCE: readonly string[] = ['EI 15', 'EI 30', 'EI 45', 'EI 60', 'EI 90', 'EI 120', 'EIW 30', 'EIW 60'];

export interface FireBarrierFieldsProps {
  readonly value: FireBarrierProfile;
  readonly onChange: (value: FireBarrierProfile) => void;
}

export function FireBarrierFields(props: FireBarrierFieldsProps): React.JSX.Element {
  return (
    <>
      <ComboField
        label="Вид противопожарной преграды"
        value={props.value.barrierKind}
        options={KINDS}
        onChange={(barrierKind) => props.onChange({ ...props.value, barrierKind })}
      />
      <ComboField
        label="Степень огнестойкости"
        value={props.value.fireResistance}
        options={RESISTANCE}
        onChange={(fireResistance) => props.onChange({ ...props.value, fireResistance })}
      />
    </>
  );
}
