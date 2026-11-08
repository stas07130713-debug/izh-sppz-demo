/**
 * Вкладки рабочей области: план, журнал, дашборд (ТЗ, Дополнение 2, часть П2).
 *
 * Стояли в шапке программы, среди значков темы и учётной записи, — там они
 * читались как настройки, а не как разделы работы. Теперь это вкладки над самой
 * областью, устроенные как в браузере: щёлкнул по корешку — под ним открылось
 * его содержимое. Активная вкладка сливается с полем, остальные лежат за ним.
 *
 * Ширина вкладки задана и не зависит от подписи. Раньше подпись плана менялась
 * вместе с узлом («Генплан», «План», «Склад»), и соседние вкладки прыгали при
 * каждом переходе по дереву — попасть в «Журнал» второй раз подряд, не глядя,
 * было нельзя. Какой именно план открыт, сказано в подписи под вкладками.
 */

import type { ViewMode } from './AppHeader';

export interface ModeOption {
  readonly mode: ViewMode;
  readonly title: string;
  /** Недоступен для этого уровня дерева: у организации и цеха нет своего плана. */
  readonly disabled: boolean;
  readonly hint: string;
}

export interface ModeTabsProps {
  readonly modes: readonly ModeOption[];
  readonly active: ViewMode;
  readonly onChange: (mode: ViewMode) => void;
}

export function ModeTabs(props: ModeTabsProps): React.JSX.Element {
  return (
    <div className="mode-tabs" role="tablist" aria-label="Разделы рабочей области">
      {props.modes.map((option) => {
        const active = option.mode === props.active;
        return (
          <button
            key={option.mode}
            type="button"
            role="tab"
            aria-selected={active}
            className={`mode-tab mode-tab-${option.mode}${active ? ' active' : ''}`}
            disabled={option.disabled}
            title={option.hint}
            onClick={() => props.onChange(option.mode)}
          >
            {option.title}
          </button>
        );
      })}
    </div>
  );
}
