/**
 * Что уже действует сверху и здесь не отменяется (ТЗ, Дополнение 5, часть Р8).
 *
 * Показывается везде, где настраивается нижний уровень: и в окне регламентов
 * для цеха или здания, и в карточке отдельного элемента. Без такого показа
 * пользователь неизбежно продублировал бы требование организации, а потом не
 * понял, почему работа в журнале осталась одна.
 */

import type { RegulationScope } from '@izh/contracts';
import type { EffectivePeriodicity } from '@izh/engine-regulations';
import { describePeriodicity } from './periodicity-text';

export interface InheritedPeriodicitiesProps {
  readonly items: readonly EffectivePeriodicity[];
  /** Что написать, когда сверху ничего не назначено. */
  readonly emptyNote: string;
}

/** Пометка, откуда пришло требование: «установлено организацией», «добавлено цехом». */
function originLabel(origin: RegulationScope): string {
  switch (origin) {
    case 'организация': return 'установлено организацией';
    case 'цех': return 'добавлено цехом';
    case 'здание': return 'добавлено зданием';
    case 'тип оборудования': return 'по виду оборудования';
    case 'элемент': return 'задано на элементе';
  }
}

export function InheritedPeriodicities(props: InheritedPeriodicitiesProps): React.JSX.Element {
  if (props.items.length === 0) return <p className="muted small">{props.emptyNote}</p>;

  return (
    <div className="inherited-block">
      <p className="muted small">Уже назначено на вышестоящем уровне — здесь только дополняется:</p>
      <ul className="inherited-list">
        {props.items.map((item) => (
          <li key={`${item.regulationId}-${item.id}`}>
            <span className="small"><strong>{item.title}</strong> — {describePeriodicity(item.rule)}</span>
            <span className="muted small"> ({originLabel(item.origin)}, работ: {item.activities.length})</span>
          </li>
        ))}
      </ul>
      <p className="muted small">
        Ниже задаётся только то, что этот уровень <strong>добавляет</strong> сверх перечисленного.
      </p>
    </div>
  );
}
