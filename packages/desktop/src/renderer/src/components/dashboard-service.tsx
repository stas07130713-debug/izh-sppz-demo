/**
 * Блок «Скоро ТО»: просрочено, семь дней, тридцать дней.
 *
 * Заказчик: «ниже блок скоро ТО: 3 отдельные красивые подблока: 1 — просрочены,
 * 2 — за 7 дней до ТО и 3 — за 30 дней».
 *
 * Три подблока рядом, а не три отдельных списка один под другим: вопрос у них
 * один — «что делать в ближайшее время», и отвечать на него, листая экран,
 * неудобно. Числа крупно, под ними — что именно предстоит, самое срочное
 * сверху.
 *
 * Считается одной сводкой (`dashboardSummary`) — той же, по которой стоят
 * плитки и круги. Второго счёта сроков в программе быть не должно: он
 * однажды разошёлся бы с первым, и человек не знал бы, какому верить.
 */

import type { PlanObject } from '@izh/contracts';
import { formatDateRu } from '../format';
import { ElementIcon } from './ElementIcon';
import { objectTitle, placeOf, type BlockContext } from './dashboard-context';
import type { JournalIntent } from './status-filter';

/** Сколько строк показывать в подблоке, прежде чем сказать «и ещё N». */
const SHOWN = 6;

/**
 * Что именно предстоит — поимённо, под строкой срока.
 *
 * Заказчик: «на дашборде до сих пор не удаётся узнать, что это за система или
 * элемент: „За 30 дней до ТО, 05.10.2026 — Осмотр (1 шт.)“».
 *
 * И правда: строка называла работу и число, а предмет — никогда. Число без
 * имени не даёт ничего сделать; чтобы найти ту самую систему, приходилось
 * перебирать журнал руками. Имя открывает карточку — как и в подблоке
 * просроченных, где так было с самого начала.
 */
function WorkItems(props: {
  readonly items: readonly { readonly object: PlanObject; readonly daysLeft: number }[];
  readonly context: BlockContext;
}): React.JSX.Element | null {
  if (props.items.length === 0) return null;
  const { nodes, onShowObject } = props.context;

  return (
    <ul className="plain-list dash-upcoming-items">
      {props.items.slice(0, 4).map((item) => (
        <li key={item.object.id}>
          <ElementIcon typeCode={item.object.typeCode} />
          <button type="button" className="link" onClick={() => onShowObject(item.object)}>
            {objectTitle(item.object)}
          </button>
          <span className="muted small"> · {placeOf(nodes, item.object.nodeId)}</span>
        </li>
      ))}
      {props.items.length > 4 && (
        <li className="muted small">И ещё {props.items.length - 4}.</li>
      )}
    </ul>
  );
}

function ServiceBox(props: {
  readonly title: string;
  readonly tone: 'danger' | 'warn' | 'muted';
  readonly count: number;
  readonly empty: string;
  readonly onOpen?: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className={`service-box service-${props.tone}`}>
      <header>
        {props.onOpen === undefined ? (
          <strong className="service-count">{props.count}</strong>
        ) : (
          <button type="button" className="service-count link" onClick={props.onOpen}>
            {props.count}
          </button>
        )}
        <span className="service-title">{props.title}</span>
      </header>
      {props.count === 0 ? <p className="muted small">{props.empty}</p> : props.children}
    </section>
  );
}

export function ServiceHorizons({ context }: { readonly context: BlockContext }): React.JSX.Element {
  const { summary, onOpenJournal, onShowObject } = context;

  const openOverdue = (): void => onOpenJournal({
    typeCode: null,
    statusTags: new Set(['просрочено']) as JournalIntent['statusTags'],
  });

  /*
   * «За 30 дней» — это следующий месяц целиком, а не то, что осталось после
   * недели. Иначе подблок пустел бы к концу недели и выглядел бы как «работ
   * нет», хотя на месяц их назначено много.
   */
  const soon7 = summary.upcoming7;
  const soon30 = summary.upcoming30;

  /*
   * Кто стоит за строкой срока. Перечень берётся из той же сводки, что и
   * число в ней: второго счёта сроков в программе нет.
   */
  const named = new Map<string, typeof summary.upcomingItems>();
  for (const item of summary.upcomingItems) {
    const key = `${item.activityTitle}|${item.date}`;
    named.set(key, [...(named.get(key) ?? []), item]);
  }
  const itemsOf = (activityTitle: string, date: string): typeof summary.upcomingItems =>
    named.get(`${activityTitle}|${date}`) ?? [];

  return (
    <section className="dash-card dash-card-wide">
      <h3>Скоро ТО</h3>
      <div className="service-horizons">
        <ServiceBox
          title="Просрочены"
          tone="danger"
          count={summary.overdue.length}
          empty="Просроченных работ нет."
          onOpen={openOverdue}
        >
          <ul className="plain-list">
            {summary.overdue.slice(0, SHOWN).map((item) => (
              <li key={`${item.object.id}-${item.activityTitle}`}>
                <button type="button" className="link" onClick={() => onShowObject(item.object)}>
                  {item.object.regNumber ?? 'без номера'}
                </button>
                {' — '}{item.activityTitle}
                <span className="muted small"> на {item.daysLate} дн.</span>
              </li>
            ))}
          </ul>
          {summary.overdue.length > SHOWN && (
            <p className="muted small">И ещё {summary.overdue.length - SHOWN}.</p>
          )}
        </ServiceBox>

        <ServiceBox
          title="За 7 дней до ТО"
          tone="warn"
          count={soon7.reduce((sum, item) => sum + item.count, 0)}
          empty="На неделю работ не запланировано."
        >
          <ul className="plain-list">
            {soon7.slice(0, SHOWN).map((item) => (
              <li key={`${item.activityTitle}-${item.date}`}>
                <strong>{formatDateRu(item.date)}</strong> — {item.activityTitle}
                <span className="muted small"> ({item.count} шт.)</span>
                <WorkItems items={itemsOf(item.activityTitle, item.date)} context={context} />
              </li>
            ))}
          </ul>
          {soon7.length > SHOWN && <p className="muted small">И ещё {soon7.length - SHOWN}.</p>}
        </ServiceBox>

        <ServiceBox
          title="За 30 дней до ТО"
          tone="muted"
          count={soon30.reduce((sum, item) => sum + item.count, 0)}
          empty="На месяц работ не запланировано."
        >
          <ul className="plain-list">
            {soon30.slice(0, SHOWN).map((item) => (
              <li key={`${item.activityTitle}-${item.date}`}>
                <strong>{formatDateRu(item.date)}</strong> — {item.activityTitle}
                <span className="muted small"> ({item.count} шт.)</span>
                <WorkItems items={itemsOf(item.activityTitle, item.date)} context={context} />
              </li>
            ))}
          </ul>
          {soon30.length > SHOWN && <p className="muted small">И ещё {soon30.length - SHOWN}.</p>}
        </ServiceBox>
      </div>
    </section>
  );
}
