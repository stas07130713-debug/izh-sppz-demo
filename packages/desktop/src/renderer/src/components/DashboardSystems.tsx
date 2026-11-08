/**
 * Правое поле дашборда: системы выбранного уровня (ТЗ, Дополнение 6, часть С51).
 *
 * Показываются только те виды, которые на этом уровне есть. Полный каталог тут
 * был бы вреден: два десятка нулей, среди которых нужно найти три ненулевых
 * строки, — это не выбор, а поиск.
 *
 * Отбор снимается галочками, а не одиночным выбором: дашборд отвечает на
 * вопросы вроде «что с автоматикой и оповещением вместе», и одна система за
 * раз на такой вопрос не отвечает.
 *
 * Разделом управляет его же галочка «Все объекты раздела», а не пара кнопок
 * сверху. Кнопки действовали на всё поле разом: чтобы посмотреть одну
 * автоматику, приходилось снять всё и отметить нужное заново. Галочка раздела
 * делает это одним нажатием и стоит там, где раздел, — над своим списком.
 */

import { elementByCode } from '@izh/core';
import { ElementIcon } from './ElementIcon';
import { GROUP_ORDER, GROUP_TITLES, byCatalogOrder, systemGroupOf, type SystemGroup } from './journal-groups';

export interface DashboardSystemsProps {
  /** Виды на уровне и сколько их — считает дашборд, панель только показывает. */
  readonly counts: ReadonlyMap<string, number>;
  /**
   * Скрытые виды — тот же отбор, что у плана и журнала.
   *
   * Хранятся скрытые, а не показанные: по умолчанию видно всё, и хранить нужно
   * исключения. Иначе на новом уровне отбор пришлось бы пересобирать, и виды,
   * которых там раньше не было, появлялись бы уже снятыми.
   */
  readonly hiddenTypes: ReadonlySet<string>;
  readonly onToggle: (typeCode: string) => void;
  /** Показать или скрыть сразу все виды раздела. */
  readonly onSetTypesVisible: (typeCodes: readonly string[], visible: boolean) => void;
  readonly collapsed: boolean;
  readonly onToggleCollapsed: () => void;
}

export function DashboardSystems(props: DashboardSystemsProps): React.JSX.Element {
  if (props.collapsed) {
    return (
      <aside className="inspector collapsed">
        <button
          type="button"
          className="panel-expand"
          onClick={props.onToggleCollapsed}
          title="Открыть отбор систем"
        >
          <span aria-hidden="true">‹</span>
          <span>Системы</span>
        </button>
      </aside>
    );
  }

  const types = [...props.counts.keys()].sort(byCatalogOrder);
  const grouped = new Map<SystemGroup, readonly string[]>();
  for (const group of GROUP_ORDER) {
    const own = types.filter((typeCode) => systemGroupOf(typeCode) === group);
    if (own.length > 0) grouped.set(group, own);
  }

  const sum = (list: readonly string[]): number =>
    list.reduce((total, typeCode) => total + (props.counts.get(typeCode) ?? 0), 0);
  const total = sum(types);
  const shown = sum(types.filter((typeCode) => !props.hiddenTypes.has(typeCode)));

  return (
    <aside className="inspector dashboard-systems">
      <div className="panel-head">
        <h3>Системы уровня</h3>
        <button
          type="button"
          className="panel-icon-button"
          onClick={props.onToggleCollapsed}
          title="Свернуть отбор систем"
          aria-label="Свернуть отбор систем"
        >
          ›
        </button>
      </div>

      {types.length === 0 ? (
        <p className="muted small">На этом уровне оборудования пока нет.</p>
      ) : (
        <>
          {/* Сколько элементов попадает в дашборд при текущем отборе: без этой
              строки снятая галочка меняет цифры молча, и понять, почему их
              стало меньше, можно только пересчитав галочки. */}
          <p className="muted small systems-total">
            Показано {shown} из {total} элементов уровня.
          </p>

          {[...grouped.entries()].map(([group, own]) => {
            const checked = own.every((typeCode) => !props.hiddenTypes.has(typeCode));
            const partly = !checked && own.some((typeCode) => !props.hiddenTypes.has(typeCode));

            return (
              <section key={group} className={`systems-group group-${group}`}>
                {/* Галочка раздела: отмечена, когда отмечены все его виды;
                    закрашена наполовину, когда часть. Промежуточное состояние
                    показывается, а не округляется, — иначе по виду галочки
                    нельзя отличить «весь раздел» от «одна система в нём». */}
                <label className="systems-group-head" title={`Все объекты раздела «${GROUP_TITLES[group]}»`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    ref={(input) => { if (input !== null) input.indeterminate = partly; }}
                    onChange={() => props.onSetTypesVisible(own, !checked)}
                  />
                  <span className="systems-group-title">Все объекты раздела</span>
                  <span className="muted small systems-group-count">{sum(own)}</span>
                </label>
                <h4>{GROUP_TITLES[group]}</h4>

                <ul className="systems-list">
                  {own.map((typeCode) => (
                    <li key={typeCode}>
                      {/* Поле узкое, длинные названия обрезаются — полное
                          показывается подсказкой, чтобы обрезка не скрывала,
                          что именно отмечают. */}
                      <label className="system-row" title={elementByCode(typeCode)?.title ?? typeCode}>
                        <input
                          type="checkbox"
                          checked={!props.hiddenTypes.has(typeCode)}
                          onChange={() => props.onToggle(typeCode)}
                        />
                        <ElementIcon typeCode={typeCode} />
                        <span className="system-name">{elementByCode(typeCode)?.title ?? typeCode}</span>
                        <span className="muted small system-count">{props.counts.get(typeCode) ?? 0}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </aside>
  );
}
