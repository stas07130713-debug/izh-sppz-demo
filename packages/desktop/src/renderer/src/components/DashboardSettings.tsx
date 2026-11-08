/**
 * Вкладка «Дашборд» в настройках программы (ТЗ, Дополнение 6, часть С50).
 *
 * Здесь задаётся состав экрана: какие блоки показывать и в каком порядке.
 * Включённость и порядок — один список, поэтому и управление одно: галочка
 * добавляет блок в конец, стрелки двигают его по списку. Отдельного поля
 * «место» нет: у выключенного блока места не бывает.
 */

import { DASHBOARD_BLOCKS, RECOMMENDED_DASHBOARD_BLOCKS, dashboardBlock } from '@izh/core';
import type { DashboardBlockKind } from '@izh/core';

export interface DashboardSettingsProps {
  readonly blocks: readonly string[];
  readonly onChange: (blocks: readonly string[]) => void;
}

const KIND_TITLES: Readonly<Record<DashboardBlockKind, string>> = {
  'показатель': 'Показатели верхнего ряда',
  'график': 'Графики и диаграммы',
  'список': 'Списки и таблицы',
};

const KIND_ORDER: readonly DashboardBlockKind[] = ['показатель', 'график', 'список'];

export function DashboardSettings(props: DashboardSettingsProps): React.JSX.Element {
  const { blocks, onChange } = props;

  const toggle = (id: string): void => {
    // Включённый блок встаёт в конец своего списка, а не на прежнее место:
    // помнить место выключенного блока значит хранить порядок того, чего нет.
    onChange(blocks.includes(id) ? blocks.filter((item) => item !== id) : [...blocks, id]);
  };

  /**
   * Двигает блок по списку.
   *
   * Меняется местами с соседом **того же вида**: показатели рисуются верхним
   * рядом, а графики и списки — карточками ниже, и перестановка показателя
   * через график ничего бы не изменила на экране, только запутала.
   */
  const move = (id: string, direction: -1 | 1): void => {
    const kind = dashboardBlock(id)?.kind;
    const sameKind = blocks.filter((item) => dashboardBlock(item)?.kind === kind);
    const at = sameKind.indexOf(id);
    const neighbour = sameKind[at + direction];
    if (neighbour === undefined) return;

    onChange(blocks.map((item) => (item === id ? neighbour : item === neighbour ? id : item)));
  };

  const position = (id: string): { readonly index: number; readonly total: number } => {
    const kind = dashboardBlock(id)?.kind;
    const sameKind = blocks.filter((item) => dashboardBlock(item)?.kind === kind);
    return { index: sameKind.indexOf(id), total: sameKind.length };
  };

  /**
   * Блоки одного вида в том порядке, в каком они и стоят на дашборде.
   *
   * Заказчик: «возможность менять местами отображаемые элементы не работает —
   * стрелочки есть, но ничего не происходит». Стрелки работали и порядок
   * меняли: менялся он в настройках программы, и дашборд складывался иначе. Не
   * менялся только сам список в этом окне — он строился по неизменному
   * каталогу видов, и человек, нажав стрелку, не видел ровно ничего.
   *
   * Теперь список — это порядок: включённые блоки идут так, как встанут на
   * экране, выключенные — следом, каталогом.
   */
  const listed = (kind: DashboardBlockKind): readonly string[] => {
    const all = DASHBOARD_BLOCKS.filter((block) => block.kind === kind).map((block) => block.id);
    const on = blocks.filter((id) => all.includes(id));
    return [...on, ...all.filter((id) => !on.includes(id))];
  };

  return (
    <>
      <p className="muted small">
        Дашборд собирается из блоков. Отметьте нужные и расставьте их порядок — экран сложится
        сверху вниз в том же порядке. Уровень объекта и отбор систем задаются на самом дашборде:
        деревом слева и галочками справа.
      </p>

      {KIND_ORDER.map((kind) => (
        <section key={kind} className="settings-section">
          <h4>{KIND_TITLES[kind]}</h4>
          <ul className="block-list">
            {listed(kind).map((id) => {
              const block = dashboardBlock(id);
              if (block === null) return null;
              const on = blocks.includes(block.id);
              const { index, total } = position(block.id);
              return (
                <li key={block.id} className={on ? 'block-row on' : 'block-row'}>
                  <label className="block-check">
                    <input type="checkbox" checked={on} onChange={() => toggle(block.id)} />
                    <span className="block-title">{block.title}</span>
                  </label>
                  <span className="muted small block-hint">{block.hint}</span>
                  {on && (
                    <span className="block-move">
                      <button
                        type="button" aria-label="Выше" title="Показывать выше"
                        disabled={index <= 0} onClick={() => move(block.id, -1)}
                      >↑</button>
                      <button
                        type="button" aria-label="Ниже" title="Показывать ниже"
                        disabled={index >= total - 1} onClick={() => move(block.id, 1)}
                      >↓</button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className="actions">
        <button type="button" onClick={() => onChange([...RECOMMENDED_DASHBOARD_BLOCKS])}>
          Вернуть рекомендуемые
        </button>
        <button type="button" onClick={() => onChange([])}>
          Выключить всё
        </button>
      </div>
    </>
  );
}
