/**
 * Блоки дашборда, которые рисуются: круги, полосы, динамика.
 *
 * Все они кликабельны насквозь (ТЗ, Дополнение 3, часть К4): доля круга, доля
 * полосы и строка объекта ведут в журнал с тем же отбором, который человек
 * увидел глазами. Показатель, по которому нельзя перейти к списку, заставляет
 * искать те же элементы руками — а ради этого на дашборд и не заходят.
 */

import type { ScheduleStatus } from '@izh/core';
import { DonutChart } from './DonutChart';
import { StatusBar } from './StatusBar';
import { TrendChart } from './TrendChart';
import { GROUP_ORDER, GROUP_TITLES, systemGroupOf, type SystemGroup } from './journal-groups';
import {
  STATUS_COLOR_VAR, STATUS_ORDER, SYSTEM_COLORS,
  placeOf, share, typeTitle, type BlockContext,
} from './dashboard-context';
import type { FilterTag } from './status-filter';

const GROUP_COLOR_VAR: Readonly<Record<SystemGroup, string>> = {
  outside: 'var(--group-outside)',
  inside: 'var(--group-inside)',
  automation: 'var(--group-automation)',
};

/** Состояние как метка отбора журнала: имена совпадают, приведение явное. */
function statusTag(status: ScheduleStatus): ReadonlySet<FilterTag> {
  return new Set<FilterTag>([status]);
}

/**
 * Общее состояние: доли складываются в число элементов.
 *
 * Круг рисуется по срокам, а не по меткам отбора: метки пересекаются —
 * просроченный и вдобавок неисправный элемент попал бы сразу в две доли, и
 * круг перестал бы быть кругом.
 */
export function StatusDonut({ context }: { readonly context: BlockContext }): React.JSX.Element {
  const { summary, onOpenJournal } = context;
  const segments = STATUS_ORDER.map((status) => ({
    key: status, label: status, value: summary.counts[status], color: STATUS_COLOR_VAR[status],
  }));

  return (
    <section className="dash-card dash-card-donut">
      <h3>Общее состояние</h3>
      <DonutChart
        segments={segments}
        size={132}
        centerValue={String(summary.total)}
        centerLabel="всего"
        onPick={(key) => onOpenJournal({ typeCode: null, statusTags: statusTag(key as ScheduleStatus) })}
      />
      <ul className="plain-list dash-legend">
        {segments.map((segment) => (
          <li key={segment.key}>
            <button
              type="button"
              className="link dash-group-link"
              onClick={() => onOpenJournal({ typeCode: null, statusTags: statusTag(segment.key) })}
            >
              <span className="group-dot" style={{ background: segment.color }} />
              {segment.label}
            </button>
            <span className="muted small"> — {segment.value} ({share(segment.value, summary.total)})</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Всего по элементам систем: у каждой системы своё название.
 *
 * Заказчик: «переименовать диаграмму, где отображается распределение всех
 * систем в выбранном уровне здания». Прежнее название обещало состояние
 * системы целиком, а круг показывает состав — сколько элементов в каждой.
 *
 * «Прочего» здесь нет намеренно — заказчик: «у нас все системы имеют своё
 * название». Если видов много, лишние не сваливаются в общий мешок, а остаются
 * строками легенды под кругом: сколько чего, столько и написано.
 */
export function SystemsDonut({ context }: { readonly context: BlockContext }): React.JSX.Element {
  const { summary, onOpenJournal } = context;
  const segments = summary.byType.map((tally, index) => ({
    key: tally.typeCode,
    label: typeTitle(tally.typeCode),
    value: tally.total,
    color: SYSTEM_COLORS[index % SYSTEM_COLORS.length] as string,
  }));

  return (
    <section className="dash-card dash-card-donut">
      <h3>Всего по элементам систем</h3>
      {segments.length === 0 ? (
        <p className="muted small">Ни одна система не выбрана.</p>
      ) : (
        <>
          <DonutChart
            segments={segments}
            size={132}
            centerValue={String(summary.byType.length)}
            centerLabel={summary.byType.length === 1 ? 'система' : 'систем'}
            onPick={(key) => onOpenJournal({ typeCode: key, statusTags: new Set() })}
          />
          <ul className="plain-list dash-legend">
            {segments.map((segment) => (
              <li key={segment.key}>
                <button
                  type="button"
                  className="link dash-group-link"
                  onClick={() => onOpenJournal({ typeCode: segment.key, statusTags: new Set() })}
                >
                  <span className="group-dot" style={{ background: segment.color }} />
                  {segment.label}
                </button>
                <span className="muted small"> — {segment.value} шт.</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Разделы: снаружи здания, внутри здания, пожарная автоматика. */
export function GroupsCard({ context }: { readonly context: BlockContext }): React.JSX.Element {
  const { summary, onOpenJournal } = context;

  const byGroup = new Map<SystemGroup, { total: number; firstType: string }>();
  for (const tally of summary.byType) {
    const group = systemGroupOf(tally.typeCode);
    const known = byGroup.get(group);
    byGroup.set(group, {
      total: (known?.total ?? 0) + tally.total,
      firstType: known?.firstType ?? tally.typeCode,
    });
  }

  const segments = GROUP_ORDER.map((group) => ({
    key: group,
    label: GROUP_TITLES[group],
    value: byGroup.get(group)?.total ?? 0,
    color: GROUP_COLOR_VAR[group],
  }));

  return (
    <section className="dash-card dash-card-donut dash-card-groups">
      <h3>Состояние по разделам</h3>
      <DonutChart segments={segments} size={104} />
      <ul className="plain-list dash-legend">
        {segments.map((segment) => {
          const firstType = byGroup.get(segment.key)?.firstType;
          return (
            <li key={segment.key} className={`dash-group-row group-${segment.key}`}>
              <button
                type="button"
                className="link dash-group-link"
                disabled={firstType === undefined}
                onClick={() => firstType !== undefined
                  && onOpenJournal({ typeCode: firstType, statusTags: new Set() })}
              >
                <span className="group-dot" style={{ background: segment.color }} />
                {segment.label}
              </button>
              <span className="muted small"> — {segment.value} ({share(segment.value, summary.total)})</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Динамика состояния за последние месяцы.
 *
 * Под графиком стоит оговорка о способе счёта, и она обязательна: программа не
 * хранит снимков по дням, прошлое пересчитывается сегодняшними правилами. Без
 * этой строки график читался бы как архив, которого нет.
 */
export function TrendCard({ context }: { readonly context: BlockContext }): React.JSX.Element {
  const series = STATUS_ORDER.map((status) => ({ status, color: STATUS_COLOR_VAR[status] }));

  return (
    <section className="dash-card dash-card-wide">
      <h3>Динамика состояния</h3>
      {context.trend.length === 0 ? (
        <p className="muted small">Показывать нечего: на этом уровне нет элементов.</p>
      ) : (
        <>
          <TrendChart points={context.trend} series={series} />
          <p className="muted small">
            Прошлое пересчитано по записям журнала на каждую дату и по нынешней периодичности работ.
          </p>
        </>
      )}
    </section>
  );
}

/**
 * Состояние по объектам дерева.
 *
 * Полосой, а не тремя числами: у объекта видно и сколько просрочено, и какую
 * долю от всего оборудования это составляет. Название объекта ведёт в журнал
 * этого объекта, доля полосы — в журнал с этим же состоянием.
 */
export function PlacesCard({ context }: { readonly context: BlockContext }): React.JSX.Element {
  const { summary, nodes, onOpenJournal } = context;
  const shown = summary.byPlace.slice(0, 8);

  return (
    <section className="dash-card dash-card-wide">
      <h3>Состояние по объектам</h3>
      {shown.length === 0 ? (
        <p className="muted small">Показывать нечего.</p>
      ) : (
        <ul className="plain-list dash-places">
          {shown.map((place) => (
            <li key={place.nodeId}>
              <div className="dash-place-head">
                <button
                  type="button"
                  className="link"
                  onClick={() => onOpenJournal({ typeCode: null, statusTags: new Set(), nodeId: place.nodeId })}
                >
                  {placeOf(nodes, place.nodeId)}
                </button>
                <span className="muted small">{place.total} шт.</span>
              </div>
              <StatusBar
                counts={place.counts}
                onPick={(status) => onOpenJournal({
                  typeCode: null, statusTags: statusTag(status), nodeId: place.nodeId,
                })}
              />
            </li>
          ))}
        </ul>
      )}
      {summary.byPlace.length > shown.length && (
        <p className="muted small">И ещё {summary.byPlace.length - shown.length}. Выберите объект в дереве слева.</p>
      )}
    </section>
  );
}
