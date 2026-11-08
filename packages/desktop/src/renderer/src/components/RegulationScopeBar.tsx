/**
 * Выбор уровня, на котором настраивается регламент (ТЗ, Дополнение 5, Р7, Р8).
 *
 * Рядом с выбором — то, что уже действует сверху. Это не украшение: правило
 * части Р8 гласит, что нижний уровень **дополняет** верхний, а не заменяет
 * его, и без показа унаследованного пользователь неизбежно продублировал бы
 * ежемесячный осмотр организации ещё раз в цехе, а потом не понял, почему
 * работа в журнале одна.
 */

import type { EffectivePeriodicity } from '@izh/engine-regulations';
import { InheritedPeriodicities } from './InheritedPeriodicities';
import { scopeLabel, type RegulationTarget } from './regulation-targets';
import { SelectField } from './SelectField';

export interface RegulationScopeBarProps {
  readonly targets: readonly RegulationTarget[];
  readonly selected: RegulationTarget;
  /** Что уже действует на этот элемент от вышестоящих уровней. */
  readonly inherited: readonly EffectivePeriodicity[];
  readonly busy: boolean;
  readonly onSelect: (target: RegulationTarget) => void;
}

export function RegulationScopeBar(props: RegulationScopeBarProps): React.JSX.Element {
  return (
    <div className="regulation-scope-bar">
      <label className="field">
        <span>Где действует</span>
        <SelectField
          value={props.selected.targetId}
          disabled={props.busy}
          options={props.targets.map((target) => ({
            value: target.targetId,
            title: `${target.label} — ${scopeLabel(target.scope)}`,
          }))}
          onChange={(value) => {
            const next = props.targets.find((item) => item.targetId === value);
            if (next !== undefined) props.onSelect(next);
          }}
        />
      </label>

      <InheritedPeriodicities
        items={props.inherited}
        emptyNote={props.selected.scope === 'организация'
          ? 'Верхний уровень: заданное здесь действует на всё предприятие.'
          : 'На вышестоящих уровнях регламент не назначен — оборудование обслуживается по нормативной библиотеке. Заданное здесь дополнит её.'}
      />
    </div>
  );
}
